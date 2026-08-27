#!/usr/bin/env bash
# Snapshot the bind-mounted MinIO data directory (./minio-data) to backups/.
# Usage: scripts/backup-minio.sh [path/to/archive.tar.gz]
set -euo pipefail
cd "$(dirname "$0")/.."

DATA_DIR="minio-data"
STAMP="$(date +%Y%m%d-%H%M%S)"
OUT="${1:-backups/minio-${STAMP}.tar.gz}"

if [[ ! -d "$DATA_DIR" ]]; then
  echo "Nothing to back up: $DATA_DIR does not exist yet." >&2
  echo "Start MinIO once with: docker compose up -d minio" >&2
  exit 1
fi

mkdir -p "$(dirname "$OUT")"

MINIO_WAS_RUNNING=0
if docker compose ps --status running --services 2>/dev/null | grep -qx minio; then
  MINIO_WAS_RUNNING=1
  echo "Stopping MinIO for a consistent snapshot…"
  docker compose stop minio
fi

echo "Archiving $DATA_DIR → $OUT"
tar -czf "$OUT" "$DATA_DIR"

if [[ "$MINIO_WAS_RUNNING" -eq 1 ]]; then
  echo "Starting MinIO…"
  docker compose start minio
fi

echo "Backup written to $OUT ($(du -h "$OUT" | awk '{print $1}'))"
