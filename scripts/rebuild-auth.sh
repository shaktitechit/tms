#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
docker compose build --build-arg WEB_BUILD_ID="auth-$(date +%s)" web api
docker compose up -d --force-recreate web api nginx
echo "Waiting for web..."
sleep 4
echo "=== form login probe (Location must be localhost, not 0.0.0.0) ==="
curl -si -c /tmp/vs-auth.txt -X POST http://localhost:3000/api/auth/session \
  -H 'Host: localhost:3000' \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  --data-urlencode 'intent=login-tenant' \
  --data-urlencode "email=${1:-cookietest1787593779@example.com}" \
  --data-urlencode "password=${2:-Password1!}" | head -25
echo
echo "=== /api/auth/me ==="
curl -si -b /tmp/vs-auth.txt http://localhost:3000/api/auth/me | head -15
