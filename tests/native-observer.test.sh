#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
cp -R tests/manual/native-observer "$tmp/observer"
cp "$tmp/observer/projection.case.ts" "$tmp/observer/projection.test.ts"
claude plugin test "$tmp/observer"
