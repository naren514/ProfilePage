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
  SUITES=(writing-studio writing-studio-ai writing-studio-agent writing-studio-memory writing-studio-security reading-list agent-server agent-loop agent-weekly-reading admin-shell)
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
# Agent A1: the scheduler endpoint's secret, and a test clock for ?now= (test only)
export CRON_SECRET="${CRON_SECRET:-e2e-cron-secret}"
export AGENT_TEST_CLOCK=1
# Agent A2: page reads (web.fetch) replay from the mock server (test only)
export AGENT_FETCH_REPLAY_URL=http://localhost:3999/__page
# Vercel Workflow's local engine calls back into the app on this port
export PORT=3100

# Each process runs in its own process group (setsid), so stopping it also
# stops the children npx starts (the real Next.js server).
stop() {
  [ -n "${1:-}" ] || return 0
  kill -TERM -- "-$1" 2>/dev/null || kill "$1" 2>/dev/null
  wait "$1" 2>/dev/null
}
# Wait until nothing listens on a port (a fresh server per suite, never a leftover one)
port_free() {
  for _ in $(seq 1 30); do
    curl -s -o /dev/null "http://localhost:$1" || return 0
    sleep 1
  done
  echo "Port $1 is still in use" >&2
  return 1
}
failed=()
for suite in "${SUITES[@]}"; do
  echo "::group::$suite"
  psql "$ADMIN_DATABASE_URL" -q -c "DROP DATABASE IF EXISTS \"$DB_NAME\" WITH (FORCE)" -c "CREATE DATABASE \"$DB_NAME\"" >/dev/null
  psql "$DATABASE_URL" -q -f tests/e2e/seed.sql >/dev/null
  port_free 3100 && port_free 3999 || { failed+=("$suite"); echo "FAIL $suite (ports busy)"; continue; }
  setsid node tests/e2e/mock-openai.cjs 3999 >/tmp/mock-$suite.log 2>&1 & MOCK=$!
  setsid npx next start -p 3100 >/tmp/app-$suite.log 2>&1 & APP=$!
  for _ in $(seq 1 60); do curl -s -o /dev/null http://localhost:3100/login && break; sleep 1; done
  # The app must be this suite's own server (it fails to start if the port was taken)
  if grep -q EADDRINUSE "/tmp/app-$suite.log"; then failed+=("$suite"); echo "FAIL $suite (app didn't start)"; stop $APP; stop $MOCK; continue; fi
  if node "tests/e2e/$suite.cjs" "test-results/$suite"; then echo "PASS $suite"; else failed+=("$suite"); echo "FAIL $suite"; tail -40 /tmp/app-$suite.log; fi
  stop $APP; stop $MOCK
  echo "::endgroup::"
done
if [ ${#failed[@]} -gt 0 ]; then echo "Failed: ${failed[*]}"; exit 1; fi
echo "All suites passed."
