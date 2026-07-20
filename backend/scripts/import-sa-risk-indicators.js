import "dotenv/config";
import pg from "pg";
import { pool as sarvaPool } from "../src/db/pool.js";

const { Pool } = pg;

const sourcePool = new Pool({
  host: process.env.SA_RISK_HOST || "127.0.0.1",
  port: Number(process.env.SA_RISK_PORT || 5432),
  database: process.env.SA_RISK_DB || "sa_risk",
  user: process.env.SA_RISK_USER || "postgres",
  password: process.env.SA_RISK_PASSWORD || undefined,
});

const SOURCE_URLS = {
  agsaMfma2024: "https://mfma-2024.agsareports.co.za/",
  municipalMoneyDocs: "https://municipaldata.treasury.gov.za/docs",
  municipalMoney: "https://municipaldata.treasury.gov.za/",
  sapsCrimeStats: "https://www.saps.gov.za/services/crimestats.php",
  statsSa: "https://www.statssa.gov.za/",
};

function directionFromPolarity(polarity) {
  const value = String(polarity || "").toLowerCase();
  if (["beneficial", "positive", "resilience"].includes(value)) return "higher_resilience";
  if (["neutral", "context"].includes(value)) return "context";
  return "higher_risk";
}

function indicatorText(row) {
  return `${row.key || ""} ${row.label || ""} ${row.description || ""} ${row.unit || ""} ${row.theme || ""} ${row.category || ""}`.toLowerCase();
}

function inferDirection(row) {
  const explicit = String(row.polarity || "").trim();
  if (explicit) return directionFromPolarity(explicit);

  const text = indicatorText(row);
  if (/clean audit|unqualified.*no findings|cash cover|current ratio|collection rate|capital expenditure|infrastructure expenditure|response capacity|institutional capacity/.test(text)) {
    return "higher_resilience";
  }
  if (/audit finding|qualified|adverse|disclaimed|stress|pressure|lack|without|deprivation|backlog|unserved|crime|poverty|unemployment|deficit|uifw|unauthorised|irregular|fruitless|wasteful|liabilit|creditor|overdraft|vacanc/.test(text)) return "higher_risk";
  if (/access|piped water|electricity|refuse|sanitation|service delivery|flush toilet|weekly refuse|higher education|tertiary|matric|completed secondary|literacy/.test(text)) return "higher_resilience";
  return "higher_risk";
}

function themeForIndicator(row) {
  const key = String(row.key || "").toLowerCase();
  const theme = String(row.theme || row.category || "").trim();
  const text = indicatorText(row);
  if (/police[_ -]?action[_ -]?subindex|police-action sub-index|police-action detected crimes sub-index/.test(text)) return "Safety - public order and police-detected crime";
  if (/contact[_ -]?subindex|contact crimes sub-index/.test(text)) return "Safety - violent contact crime";
  if (/sexual|rape|assault.*sexual|gbv|gender-based violence|domestic violence/.test(text)) return "Safety - gender and sexual violence";
  if (/murder|attempted murder|assault|robbery|carjacking|hijacking|kidnapping|violent|contact crime/.test(text) || key.startsWith("crime_contact")) return "Safety - violent contact crime";
  if (/burglary|theft|vehicle|stock theft|property|commercial|shoplifting|fraud|arson|malicious damage/.test(text)) return "Safety - property and economic crime";
  if (/drug|public order|illegal possession|firearm|community reported|police detected/.test(text) || key.startsWith("crime_")) return "Safety - public order and police-detected crime";
  if (/audit|auditor|agsa|uifw|unauthorised|irregular|fruitless|wasteful|mfma|governance|compliance/.test(text)) return "Governance - audit and compliance";
  if (/cash|liquid|current ratio|creditor|debtor|collection|operating|surplus|deficit|borrow|liabilit|financial health/.test(text)) return "Governance - financial resilience";
  if (/capital expenditure|capex|infrastructure|repairs|maintenance|grant/.test(text)) return "Governance - infrastructure investment";
  if (/capacity|official|manager|cfo|vacanc|response|disaster|institution/.test(text)) return "Governance - institutional capacity";
  if (/population|household|age|youth|elder|dependency|gender/i.test(`${key} ${theme}`)) return theme || "Demographics";
  if (/income|poverty|employment|unemployment|education/i.test(`${key} ${theme}`)) return theme || "Socio-economic";
  if (/water|sanitation|electricity|refuse|service/i.test(`${key} ${theme}`)) return theme || "Basic services";
  return theme || "Municipal indicators";
}

function indexKeyForIndicator(row) {
  const text = indicatorText(row);
  const key = String(row.key || "").toLowerCase();
  if (/police[_ -]?action[_ -]?subindex|police-action sub-index|police-action detected crimes sub-index/.test(text)) return "safety_public_order_imported";
  if (/contact[_ -]?subindex|contact crimes sub-index/.test(text)) return "safety_violent_contact_imported";
  if (/sexual|rape|assault.*sexual|gbv|gender-based violence|domestic violence/.test(text)) return "safety_gender_violence_imported";
  if (/murder|attempted murder|assault|robbery|carjacking|hijacking|kidnapping|violent|contact crime/.test(text) || key.startsWith("crime_contact")) return "safety_violent_contact_imported";
  if (/burglary|theft|vehicle|stock theft|property|commercial|shoplifting|fraud|arson|malicious damage/.test(text)) return "safety_property_economic_imported";
  if (/drug|public order|illegal possession|firearm|community reported|police detected/.test(text) || key.startsWith("crime_")) return "safety_public_order_imported";
  if (/audit|auditor|agsa|uifw|unauthorised|irregular|fruitless|wasteful|mfma|governance|compliance/.test(text)) return "governance_audit_compliance_imported";
  if (/cash|liquid|current ratio|creditor|debtor|collection|operating|surplus|deficit|borrow|liabilit|financial health/.test(text)) return "governance_financial_resilience_imported";
  if (/capital expenditure|capex|infrastructure|repairs|maintenance|grant/.test(text)) return "governance_infrastructure_investment_imported";
  if (/capacity|official|manager|cfo|vacanc|response|disaster|institution/.test(text)) return "governance_institutional_capacity_imported";
  if (/water|sanitation|electricity|refuse|service/.test(text)) return "service_access_imported";
  if (/population|household|age|youth|elder|dependency|gender|income|poverty|employment|unemployment|education/.test(text)) {
    return "stats_sa_vulnerability_imported";
  }
  return "municipal_context_imported";
}

function compositeDomainForIndex(indexKey) {
  if (indexKey.startsWith("safety_")) return "safety";
  if (indexKey.startsWith("governance_")) return "governance";
  if (indexKey === "service_access_imported") return "services";
  if (indexKey === "stats_sa_vulnerability_imported") return "people";
  return "context";
}

function compositeDomainWeights(domains) {
  const preferred = {
    people: 0.28,
    services: 0.22,
    safety: 0.20,
    governance: 0.25,
    context: 0.05,
  };
  const present = Object.keys(preferred).filter((domain) => domains.has(domain));
  const total = present.reduce((sum, domain) => sum + preferred[domain], 0);
  return new Map(present.map((domain) => [domain, preferred[domain] / total]));
}

function sourceForIndicator(row) {
  const text = indicatorText(row);
  if (/audit|auditor|agsa/.test(text)) {
    return {
      sourceName: "Auditor-General South Africa MFMA local government audit outcomes 2023-24",
      sourceUrl: SOURCE_URLS.agsaMfma2024,
    };
  }
  if (/uifw|unauthorised|irregular|fruitless|wasteful|cash|liquid|current ratio|creditor|debtor|collection|operating|surplus|deficit|capital expenditure|capex|infrastructure|borrow|liabilit|municipal money|national treasury|section 71|mfma|mscoa/.test(text)) {
    return {
      sourceName: "National Treasury Municipal Money API, 2026 Q2 snapshot of Section 71 and audited municipal finance data",
      sourceUrl: SOURCE_URLS.municipalMoneyDocs,
    };
  }
  if (/crime|murder|assault|robbery|burglary|theft|rape|sexual|drug|firearm/.test(text)) {
    return {
      sourceName: "SAPS crime statistics, official release series",
      sourceUrl: SOURCE_URLS.sapsCrimeStats,
    };
  }
  if (/population|household|age|youth|elder|dependency|income|poverty|employment|unemployment|education|water|sanitation|electricity|refuse|dwelling/.test(text)) {
    return {
      sourceName: "Stats SA Census 2022 and municipal indicator products",
      sourceUrl: SOURCE_URLS.statsSa,
    };
  }
  return {
    sourceName: row.source_name || "SA Risk Profiler",
    sourceUrl: row.source_url,
  };
}

function codeCandidates(row) {
  const values = [];
  for (const value of [row.namecode, row.municname, row.map_title]) {
    const text = String(value || "").trim();
    if (!text) continue;
    values.push(text.toLowerCase());
    const match = text.match(/\(([A-Z]{2,3}\d{0,3}|[A-Z]{3})\)\s*$/i);
    if (match) values.push(match[1].toLowerCase());
  }
  return values;
}

async function main() {
  const sourceClient = await sourcePool.connect();
  const targetClient = await sarvaPool.connect();

  try {
    const sourceInfo = await sourceClient.query("select current_database() as database, current_user as user_name");
    console.log(`Reading ${sourceInfo.rows[0].database} as ${sourceInfo.rows[0].user_name}`);

    const indicatorResult = await sourceClient.query(`
      SELECT
        id,
        key,
        COALESCE(NULLIF(label, ''), key) AS label,
        category,
        COALESCE(NULLIF(unit, ''), 'value') AS unit,
        polarity,
        COALESCE(NULLIF(description, ''), COALESCE(NULLIF(label, ''), key)) AS description,
        COALESCE(sort_order, id) AS sort_order,
        measure_type,
        theme,
        COALESCE(NULLIF(source_name, ''), 'SA Risk Profiler') AS source_name,
        source_url
      FROM catalog.indicator
      ORDER BY COALESCE(sort_order, id), key
    `);

    const indicators = indicatorResult.rows;
    if (indicators.length === 0) {
      console.log("No indicators found in sa_risk.catalog.indicator");
      return;
    }

    await targetClient.query("BEGIN");

    for (const row of indicators) {
      const source = sourceForIndicator(row);
      await targetClient.query(
        `
          INSERT INTO sarva.municipal_indicator_definition
            (key, label, theme, description, unit, direction, source_name, source_url, is_proxy, sort_order)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, false, $9)
          ON CONFLICT (key) DO UPDATE SET
            label = EXCLUDED.label,
            theme = EXCLUDED.theme,
            description = EXCLUDED.description,
            unit = EXCLUDED.unit,
            direction = EXCLUDED.direction,
            source_name = EXCLUDED.source_name,
            source_url = EXCLUDED.source_url,
            is_proxy = false,
            sort_order = EXCLUDED.sort_order,
            updated_at = now()
        `,
        [
          row.key,
          row.label,
          themeForIndicator(row),
          row.description,
          row.unit,
          inferDirection(row),
          source.sourceName,
          source.sourceUrl,
          row.sort_order || 0,
        ]
      );
    }

    const indexDefinitions = [
      ["stats_sa_vulnerability_imported", "Stats SA vulnerability indicators", "People", "Imported demographic and socio-economic municipal indicators from the earlier risk profiler."],
      ["safety_violent_contact_imported", "Violent contact crime pressure", "Safety", "Imported SAPS violent/contact-crime indicators grouped separately from property and public-order offences."],
      ["safety_property_economic_imported", "Property and economic crime pressure", "Safety", "Imported SAPS property, theft, commercial and damage-to-property indicators."],
      ["safety_gender_violence_imported", "Gender and sexual violence pressure", "Safety", "Imported SAPS sexual-offence and gender-safety indicators where available."],
      ["safety_public_order_imported", "Public-order and police-detected crime pressure", "Safety", "Imported SAPS public-order, drug, firearm and police-detected crime indicators."],
      ["crime_safety_imported", "Combined crime and safety pressure", "Safety", "Compatibility roll-up of imported SAPS safety indicators; use the more specific safety indices for interpretation."],
      ["service_access_imported", "Basic service access indicators", "Services", "Imported municipal service-access indicators from the earlier risk profiler."],
      ["governance_audit_compliance_imported", "Audit and compliance governance pressure", "Governance", "Imported AGSA audit-outcome, MFMA compliance and UIFW expenditure indicators where available."],
      ["governance_financial_resilience_imported", "Financial resilience governance pressure", "Governance", "Imported National Treasury Municipal Money liquidity, operating-balance, debt, creditor and collection indicators where available."],
      ["governance_infrastructure_investment_imported", "Infrastructure investment governance pressure", "Governance", "Imported National Treasury Municipal Money capital expenditure, infrastructure investment, repairs, maintenance and grant-delivery indicators where available."],
      ["governance_institutional_capacity_imported", "Institutional response capacity pressure", "Governance", "Imported municipal institutional-capacity, vacancy and response-capacity indicators where available."],
      ["municipal_context_imported", "Municipal context indicators", "Context", "Imported contextual municipal indicators from the earlier risk profiler."],
      ["imported_governance_risk", "Imported governance risk pressure", "Governance", "Composite of imported audit, finance, infrastructure and institutional-capacity governance indicators."],
      ["imported_composite_risk", "Imported composite municipal risk", "Overall", "Composite of imported Stats SA, SAPS, National Treasury, AGSA and municipal-context indicators currently available in the SARVA Docker database."],
    ];

    for (const [key, label, theme, description] of indexDefinitions) {
      await targetClient.query(
        `
          INSERT INTO sarva.municipal_index_definition
            (key, label, theme, description, source_name, is_proxy, sort_order)
          VALUES ($1, $2, $3, $4, 'Imported sa_risk profiler catalogue', false, $5)
          ON CONFLICT (key) DO UPDATE SET
            label = EXCLUDED.label,
            theme = EXCLUDED.theme,
            description = EXCLUDED.description,
            source_name = EXCLUDED.source_name,
            is_proxy = false,
            sort_order = EXCLUDED.sort_order,
            updated_at = now()
        `,
        [key, label, theme, description, indexDefinitions.findIndex(([candidate]) => candidate === key) * 10 + 60]
      );
    }

    const indexWeights = new Map();
    const compositeByDomain = new Map();
    for (const row of indicators) {
      if (inferDirection(row) === "context") continue;
      const groupKey = indexKeyForIndicator(row);
      if (!indexWeights.has(groupKey)) indexWeights.set(groupKey, []);
      indexWeights.get(groupKey).push(row.key);
      if (groupKey.startsWith("safety_")) {
        if (!indexWeights.has("crime_safety_imported")) indexWeights.set("crime_safety_imported", []);
        indexWeights.get("crime_safety_imported").push(row.key);
      }
      if (groupKey.startsWith("governance_")) {
        if (!indexWeights.has("imported_governance_risk")) indexWeights.set("imported_governance_risk", []);
        indexWeights.get("imported_governance_risk").push(row.key);
      }
      const domain = compositeDomainForIndex(groupKey);
      if (!compositeByDomain.has(domain)) compositeByDomain.set(domain, []);
      compositeByDomain.get(domain).push(row.key);
    }

    const domainWeights = compositeDomainWeights(compositeByDomain);
    const compositeWeights = [];
    for (const [domain, keys] of compositeByDomain.entries()) {
      const domainWeight = domainWeights.get(domain);
      if (!domainWeight || keys.length === 0) continue;
      for (const key of keys) compositeWeights.push([key, domainWeight / keys.length]);
    }

    await targetClient.query(
      `
        DELETE FROM sarva.municipal_index_indicator
        WHERE index_key = ANY($1::text[])
      `,
      [indexDefinitions.map(([key]) => key)]
    );

    for (const [indexKey, keys] of indexWeights.entries()) {
      const weight = keys.length > 0 ? 1 / keys.length : 1;
      for (let i = 0; i < keys.length; i += 1) {
        await targetClient.query(
          `
            INSERT INTO sarva.municipal_index_indicator (index_key, indicator_key, weight, sort_order)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (index_key, indicator_key) DO UPDATE SET
              weight = EXCLUDED.weight,
              sort_order = EXCLUDED.sort_order
          `,
          [indexKey, keys[i], weight, i + 1]
        );
      }
    }

    for (let i = 0; i < compositeWeights.length; i += 1) {
      const [key, weight] = compositeWeights[i];
      await targetClient.query(
        `
          INSERT INTO sarva.municipal_index_indicator (index_key, indicator_key, weight, sort_order)
          VALUES ('imported_composite_risk', $1, $2, $3)
          ON CONFLICT (index_key, indicator_key) DO UPDATE SET
            weight = EXCLUDED.weight,
            sort_order = EXCLUDED.sort_order
        `,
        [key, weight, i + 1]
      );
    }

    const valuesResult = await sourceClient.query(`
      WITH value_base AS (
        SELECT
          i.key AS indicator_key,
          v.entity_code,
          t.period::text AS period,
          COALESCE(s.key, v.scenario_id::text, 'baseline') AS scenario,
          v.raw_value,
          v.value_0_100,
          min(v.raw_value) FILTER (WHERE v.raw_value IS NOT NULL) OVER (PARTITION BY v.indicator_id, v.time_id, v.scenario_id) AS min_raw,
          max(v.raw_value) FILTER (WHERE v.raw_value IS NOT NULL) OVER (PARTITION BY v.indicator_id, v.time_id, v.scenario_id) AS max_raw,
          i.source_name,
          i.source_url
        FROM data.indicator_value v
        JOIN catalog.indicator i ON i.id = v.indicator_id
        LEFT JOIN dim.time t ON t.id = v.time_id
        LEFT JOIN dim.scenario s ON s.id = v.scenario_id
        WHERE v.raw_value IS NOT NULL OR v.value_0_100 IS NOT NULL
      )
      SELECT
        indicator_key,
        entity_code,
        COALESCE(period, 'unknown') AS period,
        COALESCE(scenario, 'baseline') AS scenario,
        raw_value,
        COALESCE(
          value_0_100,
          CASE
            WHEN raw_value IS NULL THEN NULL
            WHEN max_raw IS NULL OR min_raw IS NULL OR max_raw = min_raw THEN 50
            ELSE ((raw_value - min_raw) / NULLIF(max_raw - min_raw, 0)) * 100
          END
        ) AS value,
        source_name,
        source_url
      FROM value_base
      WHERE COALESCE(
        value_0_100,
        CASE
          WHEN raw_value IS NULL THEN NULL
          WHEN max_raw IS NULL OR min_raw IS NULL OR max_raw = min_raw THEN 50
          ELSE ((raw_value - min_raw) / NULLIF(max_raw - min_raw, 0)) * 100
        END
      ) IS NOT NULL
    `);

    const gidResult = await targetClient.query(`
      SELECT gid, namecode, municname, map_title
      FROM sarva.municipal_boundaries
      WHERE namecode IS NOT NULL AND btrim(namecode) <> ''
    `);
    const gidByCode = new Map();
    for (const row of gidResult.rows) {
      for (const candidate of codeCandidates(row)) gidByCode.set(candidate, row.gid);
    }

    let importedValues = 0;
    for (const row of valuesResult.rows) {
      const gid = gidByCode.get(String(row.entity_code || "").toLowerCase());
      if (!gid) continue;

      await targetClient.query(
        `
          INSERT INTO sarva.municipal_indicator_value
            (municipality_gid, indicator_key, period, scenario, value, raw_value, raw_unit, confidence, source_label, source_url, notes)
          VALUES ($1, $2, $3, $4, LEAST(100, GREATEST(0, $5::numeric)), $6, $7, 'imported', $8, $9, $10)
          ON CONFLICT (municipality_gid, indicator_key, period, scenario) DO UPDATE SET
            value = EXCLUDED.value,
            raw_value = EXCLUDED.raw_value,
            raw_unit = EXCLUDED.raw_unit,
            confidence = EXCLUDED.confidence,
            source_label = EXCLUDED.source_label,
            source_url = EXCLUDED.source_url,
            notes = EXCLUDED.notes,
            updated_at = now()
        `,
        [
          gid,
          row.indicator_key,
          row.period,
          row.scenario,
          row.value,
          row.raw_value,
          indicators.find((indicator) => indicator.key === row.indicator_key)?.unit || null,
          row.source_name || "Imported sa_risk profiler",
          row.source_url,
          row.raw_value === null
            ? "Imported normalized 0-100 value from sa_risk."
            : `Imported from sa_risk. Raw value: ${row.raw_value}. Value is min-max normalized within indicator, period and scenario when source value_0_100 was not available.`,
        ]
      );
      importedValues += 1;
    }

    await targetClient.query("COMMIT");
    console.log(JSON.stringify({
      importedIndicators: indicators.length,
      importedIndexDefinitions: indexDefinitions.length,
      importedValues,
      skippedValuesWithoutMunicipalityMatch: valuesResult.rows.length - importedValues,
    }, null, 2));
  } catch (error) {
    await targetClient.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    sourceClient.release();
    targetClient.release();
    await sourcePool.end();
    await sarvaPool.end();
  }
}

main().catch((error) => {
  console.error(`sa_risk import failed: ${error.message}`);
  process.exit(1);
});
