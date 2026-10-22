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

gate_copy() {
  mkdir -p "$1"
  (cd "$root" && git ls-files -z | tar --null -T - -cf -) | tar -C "$1" -xf -
  git -C "$1" init -q
  git -C "$1" add -A
}

has_line() { grep -Fxq -- "$2" "$1" || fail "no line '$2' in: $(cat "$1")"; }
lacks_line() { ! grep -q -- "$2" "$1" || fail "unexpected line '$2' in: $(cat "$1")"; }

clean_drift() {
  local dir=$tmp/clean_drift code=0 tool real
  gate_copy "$dir/re po"
  mkdir "$dir/stubs"
  real=$(command -v shfmt)
  printf '#!/bin/sh\nif [ "$1" = --version ]; then echo v3.13.0; exit 0; fi\nexec %s "$@"\n' "$real" >"$dir/stubs/shfmt"
  chmod +x "$dir/stubs/shfmt"
  PATH="$dir/stubs:$PATH" /bin/bash "$dir/re po/scripts/verify.sh" >"$dir/out" 2>&1 || code=$?
  [ "$code" = 0 ] || fail "the gate exited $code: $(cat "$dir/out")"
  has_line "$dir/out" "== shfmt 3.13.0"
  while read -r tool _; do
    case $tool in '#'*) continue ;; esac
    grep -Eq "^== $tool [0-9]+\.[0-9]+\.[0-9]+\$" "$dir/out" || fail "no == $tool line in: $(cat "$dir/out")"
  done <"$root/tests/lib/tools.txt"
  has_line "$dir/out" 'verify: warning: shfmt 3.13.0 is not the pin 3.14.1 (tests/lib/tools.txt)'
  [ "$(tail -n 1 "$dir/out")" = 'verify: PASS' ] || fail "the last line is not verify: PASS: $(cat "$dir/out")"
}

tools_missing() {
  local dir=$tmp/tools_missing code=0 path file name
  local -a paths
  gate_copy "$dir/re po"
  mkdir "$dir/bin"
  IFS=: read -r -a paths <<<"$PATH"
  for path in "${paths[@]}"; do
    for file in "$path"/*; do
      name=${file##*/}
      if [ -f "$file" ] && [ -x "$file" ] && [ ! -e "$dir/bin/$name" ] && [ "$name" != shfmt ]; then
        ln -s "$file" "$dir/bin/$name"
      fi
    done
  done
  PATH="$dir/bin" /bin/bash "$dir/re po/scripts/verify.sh" >"$dir/out" 2>&1 || code=$?
  [ "$code" = 1 ] || fail "the gate exited $code: $(cat "$dir/out")"
  [ "$(grep -c '^verify: shfmt' "$dir/out")" = 1 ] || fail "not one shfmt line: $(cat "$dir/out")"
  has_line "$dir/out" 'verify: shfmt is missing: install shfmt-py==4.2.0 with pip (AGENTS.md, "Verify gate")'
  lacks_line "$dir/out" '^verify: PASS'
  lacks_line "$dir/out" '^== shellcheck:'
}

tools_missing_bun_types() {
  local dir=$tmp/tools_missing_bun_types code=0
  gate_copy "$dir/re po"
  mkdir "$dir/prefix"
  NPM_CONFIG_PREFIX="$dir/prefix" /bin/bash "$dir/re po/scripts/verify.sh" >"$dir/out" 2>&1 || code=$?
  [ "$code" = 1 ] || fail "the gate exited $code: $(cat "$dir/out")"
  has_line "$dir/out" "verify: @types/bun is missing from $dir/prefix/lib/node_modules: install @types/bun@1.4.2 with npm (AGENTS.md, \"Verify gate\")"
  lacks_line "$dir/out" '^verify: PASS'
  lacks_line "$dir/out" '^== shellcheck:'
}

unknown_path() {
  local dir=$tmp/unknown_path code=0
  gate_copy "$dir/re po"
  : >"$dir/re po/notes.xyz"
  git -C "$dir/re po" add -A
  /bin/bash "$dir/re po/scripts/verify.sh" >"$dir/out" 2>&1 || code=$?
  [ "$code" = 1 ] || fail "the gate exited $code: $(cat "$dir/out")"
  has_line "$dir/out" 'verify: no check for notes.xyz: add a row or an exemption in scripts/verify.sh'
  lacks_line "$dir/out" '^verify: PASS'
}

faults() {
  local dir=$tmp/faults code=0
  gate_copy "$dir/re po"
  printf 'if true;then echo x;fi\n' >"$dir/re po/bad-format.sh"
  printf 'const a = {b:1}\n' >"$dir/re po/bad-format.js"
  printf '#!/usr/bin/env bash\necho $1\n' >"$dir/re po/bad-lint.sh"
  git -C "$dir/re po" add -A
  /bin/bash "$dir/re po/scripts/verify.sh" >"$dir/out" 2>&1 || code=$?
  [ "$code" = 1 ] || fail "the gate exited $code: $(cat "$dir/out")"
  has_line "$dir/out" 'verify: run shfmt -w bad-format.sh'
  has_line "$dir/out" 'verify: fix each file that Biome names above with biome check --write <file>'
  has_line "$dir/out" 'bad-lint.sh:2:6: note: Double quote to prevent globbing and word splitting. [SC2086]'
  has_line "$dir/out" 'verify: shellcheck bad-lint.sh: fix each finding above, or disable its rule with a reason'
  grep -q 'bad-format.js' "$dir/out" || fail "Biome does not name bad-format.js: $(cat "$dir/out")"
  lacks_line "$dir/out" '^verify: PASS'
}

parse_fault() {
  local dir=$tmp/parse_fault code=0
  gate_copy "$dir/re po"
  printf 'if then\n' >"$dir/re po/bad-parse.sh"
  git -C "$dir/re po" add -A
  /bin/bash "$dir/re po/scripts/verify.sh" >"$dir/out" 2>&1 || code=$?
  [ "$code" = 1 ] || fail "the gate exited $code: $(cat "$dir/out")"
  grep -q 'bad-parse.sh:1:1: ' "$dir/out" || fail "shfmt does not name the parse error of bad-parse.sh: $(cat "$dir/out")"
  lacks_line "$dir/out" 'verify: run shfmt -w bad-parse.sh'
  lacks_line "$dir/out" '^verify: PASS'
}

for case_name in clean_drift tools_missing tools_missing_bun_types unknown_path faults parse_fault; do
  pool_run "$case_name" "$case_name"
done
pool_wait || exit 1
echo "PASS: verify gate"
