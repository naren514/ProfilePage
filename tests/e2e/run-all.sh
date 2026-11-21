#!/usr/bin/env bash
# Run every end-to-end suite against a fresh database, the way CI does.
#
#   ADMIN_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/postgres \
#   DATABASE_URL=postgresql://postgres:postgres@localhost:5432/studio \
#   tests/e2e/run-all.sh [suite ...]        # default: all suites
#
# Expects `npm run build` to have run. Each suite gets a freshly seeded
# database, a fresh mock AI/search server (port 3999) and a fresh app (3100).
set -uo pipefail
cd "$(dirname "$0")/../.."

SUITES=("$@")
if [ ${#SUITES[@]} -eq 0 ]; then
  SUITES=(writing-studio writing-studio-ai writing-studio-agent writing-studio-memory writing-studio-security reading-list)
fi
DB_NAME="${DATABASE_URL##*/}"

export DATABASE_DRIVER=pg
export ADMIN_EMAIL="${ADMIN_EMAIL:-admin@example.com}"
export ADMIN_PASSWORD="${ADMIN_PASSWORD:-e2e-password}"
export AUTH_SESSION_SECRET="${AUTH_SESSION_SECRET:-e2e-secret-e2e-secret}"
export NEXT_TELEMETRY_DISABLED=1
export OPENAI_BASE_URL=http://localhost:3999/v1
export TAVILY_BASE_URL=http://localhost:3999
# Test-only: lets the reading list fetch fixture pages from localhost
export READING_ALLOW_PRIVATE_HOSTS=1

stop() { [ -n "${1:-}" ] && kill "$1" 2>/dev/null; wait "$1" 2>/dev/null; }
failed=()
for suite in "${SUITES[@]}"; do
  echo "::group::$suite"
  psql "$ADMIN_DATABASE_URL" -q -c "DROP DATABASE IF EXISTS \"$DB_NAME\" WITH (FORCE)" -c "CREATE DATABASE \"$DB_NAME\"" >/dev/null
  psql "$DATABASE_URL" -q -f tests/e2e/seed.sql >/dev/null
  node tests/e2e/mock-openai.cjs 3999 >/tmp/mock-$suite.log 2>&1 & MOCK=$!
  npx next start -p 3100 >/tmp/app-$suite.log 2>&1 & APP=$!
  for _ in $(seq 1 60); do curl -s -o /dev/null http://localhost:3100/login && break; sleep 1; done
  if node "tests/e2e/$suite.cjs" "test-results/$suite"; then echo "PASS $suite"; else failed+=("$suite"); echo "FAIL $suite"; tail -40 /tmp/app-$suite.log; fi
  stop $APP; stop $MOCK
  echo "::endgroup::"
done
if [ ${#failed[@]} -gt 0 ]; then echo "Failed: ${failed[*]}"; exit 1; fi
echo "All suites passed."
