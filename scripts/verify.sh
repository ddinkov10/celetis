#!/usr/bin/env bash
set -eu
cd "$(dirname "$0")/.."
for t in tests/*.test.sh; do
  echo "== $t"
  PATH="/bin:$PATH" /bin/bash "$t"
done
echo "== scripts/capscore.sh --test"
PATH="/bin:$PATH" /bin/bash scripts/capscore.sh --test
echo "== claude plugin validate"
claude plugin validate .
echo "verify: PASS"
