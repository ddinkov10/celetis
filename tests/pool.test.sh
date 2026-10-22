#!/usr/bin/env bash
set -euo pipefail
root=$(cd "$(dirname "$0")/.." && pwd)
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
fail() {
  echo "FAIL: $1"
  exit 1
}
. "$root/tests/lib/pool.sh"

slow_a() {
  /bin/sleep 0.3
  echo a
}
pool_run first slow_a
pool_run second echo b
pool_run third echo c
pool_wait >"$tmp/out"
out=$(cat "$tmp/out")
[ "$out" = "$(printf 'a\nb\nc')" ] || fail "the output is not in start order: $out"

pool_run good true
pool_run bad false
code=0
pool_wait >"$tmp/out" || code=$?
out=$(cat "$tmp/out")
[ "$code" = 1 ] || fail "a failed job did not fail the pool"
[ "$out" = "FAIL: bad (exit 1)" ] || fail "the failed job is not named: $out"
pool_run good true
pool_wait >/dev/null || fail "a pool of passing jobs failed"

stops() {
  false
  echo after
}
pool_run stops stops
pool_wait >"$tmp/out" || true
out=$(cat "$tmp/out")
case $out in *after*) fail "a job went on after a failed command" ;; esac

mkdir "$tmp/live"
busy() {
  touch "$tmp/live/$1"
  ls "$tmp/live" | wc -l | tr -d ' ' >"$tmp/count-$1"
  /bin/sleep 0.2
  rm "$tmp/live/$1"
}
for j in 1 2 3 4 5 6; do POOL_JOBS=2 pool_run "busy $j" busy "$j"; done
pool_wait >/dev/null || fail "a limited pool failed"
high=$(cat "$tmp"/count-* | sort -n | tail -1)
[ "$high" -le 2 ] || fail "$high jobs ran at once with POOL_JOBS=2"

pool_run one echo one
pool_wait >/dev/null
pool_run two echo two
pool_wait >"$tmp/out"
out=$(cat "$tmp/out")
[ "$out" = two ] || fail "a second phase printed: $out"

echo "PASS: job pool"
