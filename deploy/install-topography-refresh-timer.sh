#!/usr/bin/env bash
set -Eeuo pipefail

REPO_DIR="${SARVA_REPO_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
UNIT_NAME="${TOPOGRAPHY_REFRESH_UNIT:-sarva-topography-refresh}"
RUN_TIME="${TOPOGRAPHY_REFRESH_TIME:-03:20}"

if ! command -v systemctl >/dev/null 2>&1; then
  echo "systemd is required for this installer. Use cron to call deploy/topography-refresh.sh on non-systemd hosts." >&2
  exit 1
fi

if [ ! -f "$REPO_DIR/deploy/topography-refresh.sh" ]; then
  echo "Could not find $REPO_DIR/deploy/topography-refresh.sh" >&2
  exit 1
fi

sudo tee "/etc/systemd/system/$UNIT_NAME.service" >/dev/null <<SERVICE
[Unit]
Description=SARVA topography DEM download/process/import refresh
Wants=docker.service
After=docker.service network-online.target

[Service]
Type=oneshot
WorkingDirectory=$REPO_DIR
Environment=SARVA_REPO_DIR=$REPO_DIR
ExecStart=$REPO_DIR/deploy/topography-refresh.sh
SERVICE

sudo tee "/etc/systemd/system/$UNIT_NAME.timer" >/dev/null <<TIMER
[Unit]
Description=Run SARVA topography refresh daily

[Timer]
OnCalendar=*-*-* $RUN_TIME:00
Persistent=true
RandomizedDelaySec=20m

[Install]
WantedBy=timers.target
TIMER

sudo systemctl daemon-reload
sudo systemctl enable --now "$UNIT_NAME.timer"
sudo systemctl list-timers "$UNIT_NAME.timer" --no-pager

echo "Installed $UNIT_NAME.timer. Logs will be written to $REPO_DIR/logs/topography-refresh.log"
