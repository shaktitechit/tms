#!/usr/bin/env bash
# Restore MinIO object storage from a backup created by scripts/backup-minio.sh.
# Usage: scripts/restore-minio.sh backups/minio-YYYYMMDD-HHMMSS.tar.gz
set -euo pipefail
cd "$(dirname "$0")/.."

DATA_DIR="minio-data"
ARCHIVE="${1:-}"

if [[ -z "$ARCHIVE" ]]; then
  echo "Usage: scripts/restore-minio.sh <backup.tar.gz>" >&2
  echo "Available backups:" >&2
  ls -1 backups/minio-*.tar.gz 2>/dev/null || echo "  (none in ./backups)" >&2
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

MINIO_WAS_RUNNING=0
if docker compose ps --status running --services 2>/dev/null | grep -qx minio; then
  MINIO_WAS_RUNNING=1
  echo "Stopping MinIO…"
  docker compose stop minio
fi

if [[ -d "$DATA_DIR" ]]; then
  PREV="backups/minio-data-replaced-$(date +%Y%m%d-%H%M%S)"
  mkdir -p backups
  echo "Moving current $DATA_DIR aside to $PREV"
  mv "$DATA_DIR" "$PREV"
fi

echo "Extracting $ARCHIVE"
tar -xzf "$ARCHIVE"

if [[ "$MINIO_WAS_RUNNING" -eq 1 ]]; then
  echo "Starting MinIO…"
  docker compose start minio
fi

echo "Restore complete. Data is in ./$DATA_DIR"
echo "If the API is already up, it can keep using the restored bucket as-is."
