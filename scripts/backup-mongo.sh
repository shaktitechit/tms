#!/usr/bin/env bash
# Snapshot the bind-mounted MongoDB data directory (./mongo-data) to backups/.
# Usage: scripts/backup-mongo.sh [path/to/archive.tar.gz]
set -euo pipefail
cd "$(dirname "$0")/.."

DATA_DIR="mongo-data"
STAMP="$(date +%Y%m%d-%H%M%S)"
OUT="${1:-backups/mongo-${STAMP}.tar.gz}"

if [[ ! -d "$DATA_DIR" ]]; then
  echo "Nothing to back up: $DATA_DIR does not exist yet." >&2
  echo "Start MongoDB once with: docker compose up -d mongodb" >&2
  exit 1
fi

mkdir -p "$(dirname "$OUT")"

MONGO_WAS_RUNNING=0
if docker compose ps --status running --services 2>/dev/null | grep -qx mongodb; then
  MONGO_WAS_RUNNING=1
  echo "Stopping MongoDB for a consistent snapshot…"
  docker compose stop mongodb
fi

echo "Archiving $DATA_DIR → $OUT"
tar -czf "$OUT" "$DATA_DIR"

if [[ "$MONGO_WAS_RUNNING" -eq 1 ]]; then
  echo "Starting MongoDB…"
  docker compose start mongodb
fi

echo "Backup written to $OUT ($(du -h "$OUT" | awk '{print $1}'))"
