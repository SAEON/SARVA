from __future__ import annotations

import json
import os
import signal
import tempfile
import time
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

import cfgrib
import numpy as np
import psycopg
import xarray as xr
from ecmwf.opendata import Client


SAST = ZoneInfo("Africa/Johannesburg")
UTC = timezone.utc

WEST = float(os.getenv("FORECAST_RISK_WEST", "16.0"))
EAST = float(os.getenv("FORECAST_RISK_EAST", "33.0"))
SOUTH = float(os.getenv("FORECAST_RISK_SOUTH", "-35.0"))
NORTH = float(os.getenv("FORECAST_RISK_NORTH", "-22.0"))
FORECAST_DAYS = max(1, min(int(os.getenv("FORECAST_RISK_DAYS", "5")), 10))
FORECAST_STEPS = list(range(3, FORECAST_DAYS * 24 + 1, 3))
SOURCE = "ecmwf-open-data"
SOURCE_URL = "https://www.ecmwf.int/en/forecasts/datasets/open-data"
ATTRIBUTION = (
    "ECMWF Open Data IFS 0.25 degree forecast fields. SARVA development indices use daily "
    "precipitation totals, maximum 2 m temperature and maximum 10 m wind speed for screening and exploration."
)
DOWNLOAD_TIMEOUT_SECONDS = max(300, int(os.getenv("FORECAST_RISK_DOWNLOAD_TIMEOUT_SECONDS", "1800")))
SYNC_INTERVAL_HOURS = max(1.0, float(os.getenv("FORECAST_RISK_SYNC_INTERVAL_HOURS", "5")))
SYNC_INTERVAL = timedelta(hours=SYNC_INTERVAL_HOURS)


class DownloadTimeout(RuntimeError):
    pass


def db_connect() -> psycopg.Connection:
    return psycopg.connect(
        host=os.getenv("DB_HOST", "db"),
        port=int(os.getenv("DB_PORT", "5432")),
        dbname=os.getenv("DB_NAME", "sarva"),
        user=os.getenv("DB_USER", "sarva"),
        password=os.getenv("DB_PASSWORD", "sarva_dev_password"),
    )


def latest_successful_sync_at(conn: psycopg.Connection) -> datetime | None:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT max(coalesce(finished_at, started_at))
            FROM sarva.forecast_risk_sync_run
            WHERE source = %s
              AND status = 'success'
            """,
            (SOURCE,),
        )
        row = cur.fetchone()
        latest = row[0] if row else None
        if latest is not None and latest.tzinfo is None:
            return latest.replace(tzinfo=UTC)
        return latest


def has_recent_successful_sync(conn: psycopg.Connection) -> bool:
    if os.getenv("FORECAST_RISK_FORCE", "false").lower() in {"1", "true", "yes"}:
        return False

    latest = latest_successful_sync_at(conn)
    if latest is None:
        return False

    return latest >= datetime.now(UTC) - SYNC_INTERVAL


def mark_interrupted_runs(conn: psycopg.Connection) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE sarva.forecast_risk_sync_run
            SET finished_at = now(),
                status = 'failed',
                error_message = 'Sync was interrupted before completion.'
            WHERE source = %s
              AND status = 'running'
              AND finished_at IS NULL
            """,
            (SOURCE,),
        )


def create_sync_run(conn: psycopg.Connection) -> int:
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO sarva.forecast_risk_sync_run (source, forecast_days)
            VALUES (%s, %s)
            RETURNING id
            """,
            (SOURCE, FORECAST_DAYS),
        )
        return int(cur.fetchone()[0])


def update_sync_run(
    conn: psycopg.Connection,
    sync_run_id: int,
    status: str,
    point_count: int = 0,
    error_message: str | None = None,
) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE sarva.forecast_risk_sync_run
            SET finished_at = now(),
                status = %s,
                point_count = %s,
                error_message = %s
            WHERE id = %s
            """,
            (status, point_count, error_message, sync_run_id),
        )


def download_forecast(target_file: str) -> None:
    client = Client(source="ecmwf", model="ifs", resol="0p25")
    previous_handler = signal.getsignal(signal.SIGALRM)

    def handle_timeout(_signum, _frame):
        raise DownloadTimeout(
            f"ECMWF download did not complete within {DOWNLOAD_TIMEOUT_SECONDS} seconds."
        )

    signal.signal(signal.SIGALRM, handle_timeout)
    signal.alarm(DOWNLOAD_TIMEOUT_SECONDS)
    try:
        client.retrieve(
            stream="oper",
            type="fc",
            param=["tp", "2t", "10u", "10v"],
            step=FORECAST_STEPS,
            target=target_file,
        )
    finally:
        signal.alarm(0)
        signal.signal(signal.SIGALRM, previous_handler)


def open_grib_datasets(grib_file: str) -> list[xr.Dataset]:
    return list(cfgrib.open_datasets(grib_file))


def find_dataarray(datasets: list[xr.Dataset], candidates: set[str], label: str) -> xr.DataArray:
    for dataset in datasets:
        for name, dataarray in dataset.data_vars.items():
            short_name = str(dataarray.attrs.get("GRIB_shortName") or "").lower()
            if name.lower() in candidates or short_name in candidates:
                return dataarray
    raise RuntimeError(f"ECMWF GRIB variable for {label} was not found.")


def find_precipitation_dataset(grib_file: str) -> xr.Dataset:
    for dataset in open_grib_datasets(grib_file):
        if "tp" in dataset.data_vars:
            return dataset
    raise RuntimeError("Total precipitation variable 'tp' was not found in ECMWF GRIB data.")


def clip_to_southern_africa(dataarray: xr.DataArray) -> xr.DataArray:
    latitude_values = dataarray["latitude"].values
    latitude_slice = slice(NORTH, SOUTH) if latitude_values[0] > latitude_values[-1] else slice(SOUTH, NORTH)
    return dataarray.sel(latitude=latitude_slice, longitude=slice(WEST, EAST))


def cumulative_to_intervals(cumulative_mm: xr.DataArray) -> list[dict]:
    cumulative_mm = cumulative_mm.sortby("step")
    model_start = np.datetime64(cumulative_mm["time"].values).astype("datetime64[s]")
    model_start_python = model_start.astype(datetime).replace(tzinfo=UTC)

    intervals: list[dict] = []
    previous_values = np.zeros_like(cumulative_mm.isel(step=0).values, dtype=float)
    previous_hour = 0

    for index in range(cumulative_mm.sizes["step"]):
        step_value = cumulative_mm["step"].values[index]
        step_hours = int(step_value / np.timedelta64(1, "h"))
        current_values = np.asarray(cumulative_mm.isel(step=index).values, dtype=float)
        interval_values = np.maximum(current_values - previous_values, 0.0)
        intervals.append(
            {
                "start_utc": model_start_python + timedelta(hours=previous_hour),
                "end_utc": model_start_python + timedelta(hours=step_hours),
                "rainfall_mm": interval_values,
            }
        )
        previous_values = current_values
        previous_hour = step_hours

    return intervals


def split_interval_across_local_days(start_utc: datetime, end_utc: datetime) -> list[tuple[str, float]]:
    start_local = start_utc.astimezone(SAST)
    end_local = end_utc.astimezone(SAST)
    total_seconds = (end_local - start_local).total_seconds()
    if total_seconds <= 0:
        return []

    allocations: list[tuple[str, float]] = []
    cursor = start_local
    while cursor < end_local:
        next_midnight = datetime.combine(
            cursor.date() + timedelta(days=1),
            datetime.min.time(),
            tzinfo=SAST,
        )
        segment_end = min(end_local, next_midnight)
        allocations.append((cursor.date().isoformat(), (segment_end - cursor).total_seconds() / total_seconds))
        cursor = segment_end

    return allocations


def calculate_sast_daily_totals(intervals: list[dict]) -> dict[str, np.ndarray]:
    daily_totals: dict[str, np.ndarray] = {}
    for interval in intervals:
        for local_date, fraction in split_interval_across_local_days(interval["start_utc"], interval["end_utc"]):
            contribution = interval["rainfall_mm"] * fraction
            if local_date not in daily_totals:
                daily_totals[local_date] = np.zeros_like(contribution, dtype=float)
            daily_totals[local_date] += contribution
    return daily_totals


def step_end_local_date(dataarray: xr.DataArray, step_index: int) -> str:
    model_start = np.datetime64(dataarray["time"].values).astype("datetime64[s]")
    model_start_python = model_start.astype(datetime).replace(tzinfo=UTC)
    step_value = dataarray["step"].values[step_index]
    step_hours = int(step_value / np.timedelta64(1, "h"))
    return (model_start_python + timedelta(hours=step_hours)).astimezone(SAST).date().isoformat()


def calculate_sast_daily_max(dataarray: xr.DataArray) -> dict[str, np.ndarray]:
    dataarray = dataarray.sortby("step")
    daily_max: dict[str, np.ndarray] = {}
    for index in range(dataarray.sizes["step"]):
        local_date = step_end_local_date(dataarray, index)
        values = np.asarray(dataarray.isel(step=index).values, dtype=float)
        if local_date not in daily_max:
            daily_max[local_date] = values
        else:
            daily_max[local_date] = np.maximum(daily_max[local_date], values)
    return daily_max


def score_linear(value: float, low: float, high: float) -> float:
    if not np.isfinite(value):
        return 0.0
    return float(np.clip((value - low) / (high - low) * 100.0, 0.0, 100.0))


def inverse_score(value: float, good: float, bad: float) -> float:
    if not np.isfinite(value):
        return 0.0
    return float(np.clip((good - value) / (good - bad) * 100.0, 0.0, 100.0))


def score_class(score: float) -> tuple[int, str]:
    if not np.isfinite(score):
        return 0, "Very low"
    if score >= 80:
        return 4, "Very high"
    if score >= 60:
        return 3, "High"
    if score >= 40:
        return 2, "Moderate"
    if score >= 20:
        return 1, "Low"
    return 0, "Very low"


def classify_forecast_risk(value: float) -> tuple[int, str]:
    if not np.isfinite(value) or value <= 0:
        return 0, "Minimal"
    if value >= 50:
        return 4, "Very high"
    if value >= 25:
        return 3, "High"
    if value >= 10:
        return 2, "Moderate"
    return 1, "Low"


def build_rows(
    rainfall: xr.DataArray,
    daily_totals: dict[str, np.ndarray],
    daily_temperature_max_c: dict[str, np.ndarray],
    daily_wind_max_kmh: dict[str, np.ndarray],
) -> list[tuple]:
    latitudes = rainfall["latitude"].values
    longitudes = rainfall["longitude"].values
    rows: list[tuple] = []

    for forecast_date, values in sorted(daily_totals.items())[:FORECAST_DAYS]:
        temperature_values = daily_temperature_max_c.get(forecast_date)
        wind_values = daily_wind_max_kmh.get(forecast_date)
        for lat_index, latitude in enumerate(latitudes):
            for lon_index, longitude in enumerate(longitudes):
                value = float(values[lat_index, lon_index])
                if not np.isfinite(value):
                    continue
                rainfall_class, rainfall_label = classify_forecast_risk(value)
                temperature = (
                    float(temperature_values[lat_index, lon_index])
                    if temperature_values is not None
                    else float("nan")
                )
                wind = (
                    float(wind_values[lat_index, lon_index])
                    if wind_values is not None
                    else float("nan")
                )
                rain_risk = score_linear(value, 10.0, 60.0)
                heat_risk = score_linear(temperature, 30.0, 42.0)
                wind_risk = score_linear(wind, 30.0, 80.0)
                dryness_risk = inverse_score(value, good=8.0, bad=0.0)
                fire_risk = float(np.clip(0.45 * heat_risk + 0.35 * wind_risk + 0.20 * dryness_risk, 0.0, 100.0))
                components = {
                    "Rain / flood proxy": rain_risk,
                    "Heat": heat_risk,
                    "Wind": wind_risk,
                    "Fire-weather proxy": fire_risk,
                }
                dominant_hazard, overall_risk = max(components.items(), key=lambda item: item[1])
                overall_class, overall_label = score_class(overall_risk)
                rows.append(
                    (
                        forecast_date,
                        float(latitude),
                        float(longitude),
                        round(value, 2),
                        overall_class,
                        overall_label,
                        round(temperature, 2) if np.isfinite(temperature) else None,
                        round(wind, 2) if np.isfinite(wind) else None,
                        round(rain_risk, 2),
                        round(heat_risk, 2),
                        round(wind_risk, 2),
                        round(fire_risk, 2),
                        round(overall_risk, 2),
                        dominant_hazard,
                        json.dumps({
                            "gridResolutionDegrees": 0.25,
                            "rainfallRiskClass": rainfall_class,
                            "rainfallRiskLabel": rainfall_label,
                            "thresholds": {
                                "rainRiskMmDay": [10, 60],
                                "heatRiskTempC": [30, 42],
                                "windRiskKmh": [30, 80],
                                "fireWeatherProxy": "45% heat + 35% wind + 20% forecast dryness",
                            },
                        }),
                    )
                )
    return rows


def insert_rows(conn: psycopg.Connection, sync_run_id: int, rows: list[tuple]) -> int:
    with conn.cursor() as cur:
        cur.execute(
            """
            CREATE TEMP TABLE forecast_risk_stage (
              forecast_date date,
              latitude double precision,
              longitude double precision,
              rainfall_mm numeric(8, 2),
              risk_score integer,
              risk_label text,
              temperature_max_c numeric(6, 2),
              wind_max_kmh numeric(6, 2),
              rain_risk_score numeric(5, 2),
              heat_risk_score numeric(5, 2),
              wind_risk_score numeric(5, 2),
              fire_risk_score numeric(5, 2),
              overall_risk_score numeric(5, 2),
              dominant_hazard text,
              raw_payload jsonb
            ) ON COMMIT DROP
            """
        )
        cur.executemany(
            """
            INSERT INTO forecast_risk_stage
              (
                forecast_date,
                latitude,
                longitude,
                rainfall_mm,
                risk_score,
                risk_label,
                temperature_max_c,
                wind_max_kmh,
                rain_risk_score,
                heat_risk_score,
                wind_risk_score,
                fire_risk_score,
                overall_risk_score,
                dominant_hazard,
                raw_payload
              )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s::jsonb)
            """,
            rows,
        )
        cur.execute(
            """
            DELETE FROM sarva.forecast_risk_points
            WHERE source IN (%s, %s, %s)
            """,
            (SOURCE, "ecmwf-ifs025-via-open-meteo", "open-meteo-ecmwf"),
        )
        cur.execute(
            """
            WITH boundary AS (
              SELECT ST_UnaryUnion(ST_Collect(ST_Transform(geom, 4326))) AS geom
              FROM sarva.municipal_boundaries
              WHERE geom IS NOT NULL
            )
            INSERT INTO sarva.forecast_risk_points
              (
                sync_run_id,
                source,
                source_url,
                attribution,
                forecast_date,
                latitude,
                longitude,
                rainfall_mm,
                risk_score,
                risk_label,
                temperature_max_c,
                wind_max_kmh,
                rain_risk_score,
                heat_risk_score,
                wind_risk_score,
                fire_risk_score,
                overall_risk_score,
                dominant_hazard,
                raw_payload
              )
            SELECT
              %s,
              %s,
              %s,
              %s,
              stage.forecast_date,
              stage.latitude,
              stage.longitude,
              stage.rainfall_mm,
              stage.risk_score,
              stage.risk_label,
              stage.temperature_max_c,
              stage.wind_max_kmh,
              stage.rain_risk_score,
              stage.heat_risk_score,
              stage.wind_risk_score,
              stage.fire_risk_score,
              stage.overall_risk_score,
              stage.dominant_hazard,
              stage.raw_payload
            FROM forecast_risk_stage AS stage, boundary
            WHERE ST_Intersects(
              boundary.geom,
              ST_SetSRID(ST_MakePoint(stage.longitude, stage.latitude), 4326)
            )
            """,
            (sync_run_id, SOURCE, SOURCE_URL, ATTRIBUTION),
        )
        return cur.rowcount


def sync_once() -> dict:
    with db_connect() as conn:
        mark_interrupted_runs(conn)
        conn.commit()

        if has_recent_successful_sync(conn):
            return {
                "status": "skipped",
                "reason": f"ECMWF forecast risk synced within the last {SYNC_INTERVAL_HOURS:g} hours.",
            }

        sync_run_id = create_sync_run(conn)
        conn.commit()
        point_count = 0

        try:
            with tempfile.TemporaryDirectory() as temporary_directory:
                grib_file = os.path.join(temporary_directory, "ecmwf_environmental_risk.grib2")
                print("Downloading ECMWF Open Data forecast fields...")
                download_forecast(grib_file)
                print("Opening ECMWF GRIB data...")
                datasets = open_grib_datasets(grib_file)
                precipitation = find_dataarray(datasets, {"tp"}, "total precipitation")
                temperature = find_dataarray(datasets, {"2t", "t2m"}, "2 m temperature")
                u_wind = find_dataarray(datasets, {"10u", "u10"}, "10 m u-wind")
                v_wind = find_dataarray(datasets, {"10v", "v10"}, "10 m v-wind")

                rainfall_mm = clip_to_southern_africa(precipitation * 1000.0)
                temperature_c = clip_to_southern_africa(temperature - 273.15)
                wind_kmh = clip_to_southern_africa(np.sqrt((u_wind ** 2) + (v_wind ** 2)) * 3.6)
                intervals = cumulative_to_intervals(rainfall_mm)
                daily_totals = calculate_sast_daily_totals(intervals)
                daily_temperature_max_c = calculate_sast_daily_max(temperature_c)
                daily_wind_max_kmh = calculate_sast_daily_max(wind_kmh)
                rows = build_rows(rainfall_mm, daily_totals, daily_temperature_max_c, daily_wind_max_kmh)
                print(f"Prepared {len(rows)} raw ECMWF grid/date rows.")
                point_count = insert_rows(conn, sync_run_id, rows)
                update_sync_run(conn, sync_run_id, "success", point_count)
                conn.commit()
                print(f"ECMWF forecast risk sync complete: {point_count} cached points.")
                return {"status": "success", "pointCount": point_count}
        except Exception as error:
            conn.rollback()
            update_sync_run(conn, sync_run_id, "failed", point_count, str(error))
            conn.commit()
            raise


def seconds_until_next_run() -> float:
    try:
        with db_connect() as conn:
            latest = latest_successful_sync_at(conn)
    except Exception as error:
        print(f"Could not inspect latest ECMWF forecast sync time: {error}", flush=True)
        return SYNC_INTERVAL.total_seconds()

    if latest is None:
        return 60.0

    next_run = latest.astimezone(SAST) + SYNC_INTERVAL
    return max(60.0, (next_run - datetime.now(SAST)).total_seconds())


def main() -> None:
    run_once = os.getenv("FORECAST_RISK_RUN_ONCE", "false").lower() in {"1", "true", "yes"}
    while True:
        failed = False
        try:
            result = sync_once()
            print(result)
        except Exception as error:
            failed = True
            print(f"ECMWF forecast risk sync failed: {error}", flush=True)

        if run_once:
            break

        delay = 3600 if failed else seconds_until_next_run()
        print(f"Next ECMWF forecast risk sync check in {delay / 60:.1f} minutes.")
        time.sleep(delay)


if __name__ == "__main__":
    main()
