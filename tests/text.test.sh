#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

allow=tests/product-words.allow
words='backend|frontend|staging|promote|fwhr|DESIGN\.md|verify\.py'
source_repo=ddinkov10/fwrh_calculator
copies=11
last=12
tab=$'\t'
nl=$'\n'
fails=0

fail() {
  fails=1
  printf 'FAIL: %s\n' "$1"
  [ $# -eq 1 ] || printf '%s' "$2"
}

# --no-color and --no-column: a git config of the user can add a color or a column to each line.
search() { git grep --no-color --no-column -n -I "$@" || [ $? -eq 1 ]; }

# An explicit stop: bash 3.2 goes on after a loop whose input file is missing.
[ -f "$allow" ] || { fail "$allow is missing"; exit 1; }
entries=()
while IFS= read -r entry || [ -n "$entry" ]; do entries[${#entries[@]}]=$entry; done <"$allow"
used=()
hits=$(search -i -w -E "$words" -- . ':!docs/adr' ':!tests/text.test.sh' ":!$allow")
unallowed=
while IFS= read -r hit; do
  [ -n "$hit" ] || continue
  path=${hit%%:*}
  text=${hit#*:*:}
  allowed=
  for ((i = 0; i < ${#entries[@]}; i++)); do
    entry=${entries[i]}
    needle=${entry#*"$tab"}
    if [[ $entry == "$path$tab"?* && $text == *"$needle"* ]]; then
      allowed=1
      used[i]=1
    fi
  done
  [ -n "$allowed" ] || unallowed+=$hit$nl
done <<<"$hits"
stale=
for ((i = 0; i < ${#entries[@]}; i++)); do
  [ -n "${used[i]:-}" ] || stale+="$allow:$((i + 1)):${entries[i]}$nl"
done
[ -z "$unallowed" ] || fail "a product word outside docs/adr/, as <path>:<line>:<text>:" "$unallowed"
[ -z "$stale" ] || fail "a line of $allow that allows no hit:" "$stale"

records=$(git ls-files 'docs/adr/[0-9]*.md')
have=
while IFS= read -r record; do
  [ -f "$record" ] || continue
  number=${record#docs/adr/}
  have+="${number%%-*} "
done <<<"$records"
want=
for ((n = 1; n <= last; n++)); do
  printf -v number '%04d' "$n"
  want+="$number "
done
[ "$have" = "$want" ] || fail "docs/adr/ must hold one record for each number from 0001 to $number (\`last\` in this test); it holds: ${have:-no record}"

source_line() { echo "Source: $source_repo ADR-$1. Each issue number of this record is an issue of that repository."; }
wrong=
for ((n = 1; n <= copies; n++)); do
  printf -v number '%04d' "$n"
  printf -v old '%04d' $((n + 6))
  while IFS= read -r record; do
    [[ $record == docs/adr/$number-* && -f $record ]] || continue
    line=$(sed -n 3p "$record")
    [ "$line" = "$(source_line "$old")" ] || wrong+="$record:3:$line$nl"
  done <<<"$records"
done
[ -z "$wrong" ] || fail "line 3 of a copy must be \"$(source_line '<its number + 6>')\":" "$wrong"

refs=$(search -o -E "($source_repo )?ADR-[0-9]+")
dangling=
while IFS= read -r ref; do
  token=${ref#*:*:}
  case $token in '' | "$source_repo "*) continue ;; esac
  [[ " $have" == *" ${token#ADR-} "* ]] || dangling+=$ref$nl
done <<<"$refs"
[ -z "$dangling" ] || fail "an ADR reference that names no record of docs/adr/ and has no \"$source_repo \" before it:" "$dangling"

[ "$fails" -eq 0 ]
echo "PASS"
