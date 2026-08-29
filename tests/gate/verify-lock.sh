#!/usr/bin/env bash
# Recompute digests of every locked gate asset and fail on any drift, missing file, or unlisted
# file. Locked set: tests/gate/** (except LOCK.sha256 and adapter.mjs), scripts/gate.sh,
# legacy-urls.txt. adapter.mjs is the declared post-lock integration seam and is not locked.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/../.."
LOCK="tests/gate/LOCK.sha256"
[ -f "${LOCK}" ] || { echo "verify-lock: ${LOCK} missing"; exit 1; }
expected="$(find tests/gate scripts/gate.sh legacy-urls.txt -type f ! -name LOCK.sha256 ! -name adapter.mjs ! -name '.DS_Store' | LC_ALL=C sort)"
listed="$(awk '{print $2}' "${LOCK}" | LC_ALL=C sort)"
if [ "${expected}" != "${listed}" ]; then
  echo "verify-lock: locked file set differs from the working tree"
  diff <(printf '%s\n' "${listed}") <(printf '%s\n' "${expected}") || true
  exit 1
fi
shasum -a 256 --check --strict "${LOCK}"
echo "verify-lock: OK ($(printf '%s\n' "${listed}" | wc -l | tr -d ' ') files)"
