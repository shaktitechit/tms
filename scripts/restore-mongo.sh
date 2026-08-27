#!/usr/bin/env bash
# Restore MongoDB from a backup created by scripts/backup-mongo.sh.
# Usage: scripts/restore-mongo.sh backups/mongo-YYYYMMDD-HHMMSS.tar.gz
set -euo pipefail
cd "$(dirname "$0")/.."

DATA_DIR="mongo-data"
ARCHIVE="${1:-}"

if [[ -z "$ARCHIVE" ]]; then
  echo "Usage: scripts/restore-mongo.sh <backup.tar.gz>" >&2
  echo "Available backups:" >&2
  ls -1 backups/mongo-*.tar.gz 2>/dev/null || echo "  (none in ./backups)" >&2
  exit 1
fi

if [[ ! -f "$ARCHIVE" ]]; then
  echo "Backup not found: $ARCHIVE" >&2
  exit 1
fi

if ! tar -tzf "$ARCHIVE" | grep -q "^${DATA_DIR}/"; then
  echo "Archive does not contain ${DATA_DIR}/: $ARCHIVE" >&2
  exit 1
fi

MONGO_WAS_RUNNING=0
if docker compose ps --status running --services 2>/dev/null | grep -qx mongodb; then
  MONGO_WAS_RUNNING=1
  echo "Stopping MongoDB…"
  docker compose stop mongodb
fi

if [[ -d "$DATA_DIR" ]]; then
  PREV="backups/mongo-data-replaced-$(date +%Y%m%d-%H%M%S)"
  mkdir -p backups
  echo "Moving current $DATA_DIR aside to $PREV"
  mv "$DATA_DIR" "$PREV"
fi

echo "Extracting $ARCHIVE"
tar -xzf "$ARCHIVE"

if [[ "$MONGO_WAS_RUNNING" -eq 1 ]]; then
  echo "Starting MongoDB…"
  docker compose start mongodb
fi

echo "Restore complete. Data is in ./$DATA_DIR"
