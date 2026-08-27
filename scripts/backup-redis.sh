#!/usr/bin/env bash
# Snapshot the bind-mounted Redis data directory (./redis-data) to backups/.
# Usage: scripts/backup-redis.sh [path/to/archive.tar.gz]
set -euo pipefail
cd "$(dirname "$0")/.."

DATA_DIR="redis-data"
STAMP="$(date +%Y%m%d-%H%M%S)"
OUT="${1:-backups/redis-${STAMP}.tar.gz}"

if [[ ! -d "$DATA_DIR" ]]; then
  echo "Nothing to back up: $DATA_DIR does not exist yet." >&2
  echo "Start Redis once with: docker compose up -d redis" >&2
  exit 1
fi

mkdir -p "$(dirname "$OUT")"

REDIS_WAS_RUNNING=0
if docker compose ps --status running --services 2>/dev/null | grep -qx redis; then
  REDIS_WAS_RUNNING=1
  echo "Stopping Redis for a consistent snapshot…"
  docker compose stop redis
fi

echo "Archiving $DATA_DIR → $OUT"
tar -czf "$OUT" "$DATA_DIR"

if [[ "$REDIS_WAS_RUNNING" -eq 1 ]]; then
  echo "Starting Redis…"
  docker compose start redis
fi

echo "Backup written to $OUT ($(du -h "$OUT" | awk '{print $1}'))"
