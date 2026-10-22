#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
. tests/lib/pool.sh
timed() {
  local start=$SECONDS
  echo "== $1"
  PATH="/bin:$PATH" /bin/bash "$1"
  echo "-- $1: $((SECONDS - start)) s"
}
board() {
  echo "== board: node --test"
  (cd board && node --test)
}
pool_run board board
for t in tests/*.test.sh; do
  pool_run "$t" timed "$t"
done
pool_wait || { echo "suite: FAIL"; exit 1; }
echo "== scripts/capscore.sh --test"
PATH="/bin:$PATH" /bin/bash scripts/capscore.sh --test
echo "suite: PASS"
