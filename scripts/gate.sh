#!/usr/bin/env bash
# Acceptance gate for the ajvanbeest.com Astro rebuild (SPEC.md scenarios 1-18).
# Owned by the evaluator; locked by tests/gate/LOCK.sha256. Builders never edit this file.
#
# Usage (from the repo root):  bash scripts/gate.sh
#   GATE_PORT   port for the static server (default 4321)
#   GATE_SKIP_INSTALL=1   skip `npm ci` (local iteration only; CI must install)
#
# Exit 0  => accepted. Any other exit => rejected (or the gate itself could not run).
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."
ROOT="$(pwd)"
PORT="${GATE_PORT:-4321}"
export BASE_URL="http://127.0.0.1:${PORT}"
export DIST="${ROOT}/dist"
export SRC_CONTENT="${ROOT}/src/content"
WORK="$(mktemp -d "${TMPDIR:-/tmp}/gate.XXXXXX")"
SERVER_LOG="${WORK}/serve.log"
TAP="${WORK}/results.tap"
SERVER_PID=""

say() { printf '%s\n' "GATE: $*"; }
fail_exit() { say "FAIL ($*)"; exit 1; }
cleanup() {
  if [ -n "${SERVER_PID}" ] && kill -0 "${SERVER_PID}" 2>/dev/null; then
    kill "${SERVER_PID}" 2>/dev/null || true
    wait "${SERVER_PID}" 2>/dev/null || true
  fi
}
trap cleanup EXIT

say "root ${ROOT}  node $(node --version)  npm $(npm --version)"

# 1. Integrity: the gate must not have been altered since lock.
say "verifying lock"
bash tests/gate/verify-lock.sh || fail_exit "gate assets differ from tests/gate/LOCK.sha256"

# 2. Install (lockfile-exact) and build the product.
[ -f package.json ] || fail_exit "no package.json at repo root"
if [ "${GATE_SKIP_INSTALL:-0}" != "1" ]; then
  say "npm ci"
  npm ci --no-audit --no-fund || fail_exit "npm ci failed"
fi
for dep in playwright @axe-core/playwright lighthouse serve; do
  [ -d "node_modules/${dep}" ] || fail_exit "gate dependency ${dep} is not installed (INTERFACES §10)"
done
say "npm run build"
rm -rf "${DIST}"
npm run build || fail_exit "npm run build failed"
[ -f "${DIST}/index.html" ] || fail_exit "build produced no dist/index.html"

# 3. Serve dist/ statically (directory URLs with trailing slash resolve to index.html).
say "serving ${DIST} on ${BASE_URL}"
if lsof -nP -iTCP:"${PORT}" -sTCP:LISTEN >/dev/null 2>&1; then fail_exit "port ${PORT} already in use"; fi
npx --no-install serve "${DIST}" -l "${PORT}" -n >"${SERVER_LOG}" 2>&1 &
SERVER_PID=$!
up=0
for _ in $(seq 1 60); do
  if curl -fsS -o /dev/null "${BASE_URL}/"; then up=1; break; fi
  if ! kill -0 "${SERVER_PID}" 2>/dev/null; then break; fi
  sleep 0.5
done
if [ "${up}" != "1" ]; then cat "${SERVER_LOG}" || true; fail_exit "static server did not come up on ${BASE_URL}"; fi

# 4. Run the suite. Files run one at a time (browser + mutation builds must not overlap).
say "running tests/gate/*.test.mjs"
set +e
node --test --test-concurrency=1 \
  --test-reporter=spec --test-reporter-destination=stdout \
  --test-reporter=tap --test-reporter-destination="${TAP}" \
  tests/gate/*.test.mjs
STATUS=$?
set -e

FAILS="$(grep -E '^# fail [0-9]+' "${TAP}" 2>/dev/null | tail -1 | awk '{print $3}')"
PASSES="$(grep -E '^# pass [0-9]+' "${TAP}" 2>/dev/null | tail -1 | awk '{print $3}')"
say "tap report: ${TAP}"
if [ "${STATUS}" -eq 0 ] && [ "${FAILS:-0}" = "0" ]; then
  say "PASS (${PASSES:-?} passing)"
  exit 0
fi
if [ -z "${FAILS}" ] || [ "${FAILS}" = "0" ]; then FAILS="unknown"; fi
say "FAIL (${FAILS} failing)"
exit 1
