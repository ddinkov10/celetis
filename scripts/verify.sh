#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
. tests/lib/pool.sh
echo "== scripts/plugin-update.pl syntax"
perl -c scripts/plugin-update.pl
echo "== board: node --test"
(cd board && node --test)
timed() {
  local start=$SECONDS
  echo "== $1"
  PATH="/bin:$PATH" /bin/bash "$1"
  echo "-- $1: $((SECONDS - start)) s"
}
for t in tests/*.test.sh; do
  pool_run "$t" timed "$t"
done
pool_wait || exit 1
echo "== scripts/capscore.sh --test"
PATH="/bin:$PATH" /bin/bash scripts/capscore.sh --test
echo "== claude plugin validate"
claude plugin validate .
echo "verify: PASS"
