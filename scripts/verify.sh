#!/usr/bin/env bash
set -eu
cd "$(dirname "$0")/.."
for t in tests/*.test.sh; do
  echo "== $t"
  bash "$t"
done
echo "== scripts/capscore.sh --test"
scripts/capscore.sh --test
echo "== claude plugin validate"
claude plugin validate .
echo "verify: PASS"
