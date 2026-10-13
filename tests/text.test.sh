#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

allow=tests/product-words.allow
words='backend|frontend|staging|promote|fwhr|DESIGN\.md|verify\.py'
source_repo=ddinkov10/fwrh_calculator
record_glob='docs/adr/[0-9]*.md'
copies=11
least=12
skills='intake triage feature bug hotfix chore specify plan implement critic-loop polishing-code-comments lesson lesson-review record-architecture-decisions doc-drift-sync prototype writing-for-agents guide'
commands='intake|triage|feature|bug|hotfix|chore|plan|implement|guide|critic-loop|lesson|lesson-review|record-architecture-decisions|doc-drift-sync'
texts=(skills step-prompt.md)
documents=':(glob)docs/*.md'
root='${CLAUDE_PLUGIN_ROOT}/'
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
hits=$(search -i -w -E "$words" -- . ":(exclude,glob)$record_glob" ':!tests/text.test.sh' ":!$allow")
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
[ -z "$unallowed" ] || fail "a product word in a file that is no record of docs/adr/, as <path>:<line>:<text>:" "$unallowed"
[ -z "$stale" ] || fail "a line of $allow that allows no hit:" "$stale"

records=$(git -c core.quotePath=false ls-files ":(glob)$record_glob")
have=
count=0
while IFS= read -r record; do
  [ -f "$record" ] || continue
  number=${record#docs/adr/}
  have+="${number%%-*} "
  count=$((count + 1))
done <<<"$records"
want=
for ((n = 1; n <= count; n++)); do
  printf -v number '%04d' "$n"
  want+="$number "
done
[ "$have" = "$want" ] && [ "$count" -ge "$least" ] ||
  fail "docs/adr/ must hold one record for each number from 0001 with no gap, and $least records or more; it holds: ${have:-no record}"

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

tracked=$(git -c core.quotePath=false ls-files)
is_tracked() { [[ "$nl$tracked$nl" == *"$nl$1$nl"* ]]; }
# A frontmatter holds "key: value" lines only: so a "---" line of the body does not end a frontmatter that has no end line.
frontmatter() { awk 'NR == 1 { if ($0 != "---") exit; next } $0 == "---" { printf "%s", front; exit } $0 !~ /^[A-Za-z0-9_-]+: ./ { exit } { front = front $0 "\n" }' "$1"; }

stray=
while IFS= read -r path; do
  [[ $path == skills/* ]] || continue
  inside=${path#skills/}
  [[ $inside == */* && " $skills " == *" ${inside%%/*} "* ]] || stray+=$path$nl
done <<<"$tracked"
[ -z "$stray" ] || fail "a file of skills/ that is in no folder of a skill of the list:" "$stray"

key=disable-model-invocation
missing=
lacks=
disabled=
ends=
dynamic=
for skill in $skills; do
  file=skills/$skill/SKILL.md
  if ! is_tracked "$file" || [ ! -f "$file" ]; then
    missing+=$file$nl
    continue
  fi
  front=$(frontmatter "$file")
  [[ "$nl$front$nl" == *"${nl}name: $skill$nl"* ]] || lacks+="$file:name: $skill$nl"
  if [ "$skill" = guide ]; then
    [[ "$nl$front$nl" == *"$nl$key: true$nl"* ]] || lacks+="$file:$key: true$nl"
  else
    n=1
    while IFS= read -r line; do
      n=$((n + 1))
      [[ $line != "$key":* ]] || disabled+="$file:$n:$line$nl"
    done <<<"$front"
  fi
  printf -v custom '!`cat "$(git rev-parse --show-toplevel)/.claude/agent-flow/custom/%s.md" 2>/dev/null || true`' "$skill"
  end=$(awk -v want="$custom" '{ before = last; last = $0 } END { if (last != want) print FILENAME ":" NR ":" last; else if (before != "") print FILENAME ":" (NR - 1) ":" before }' "$file")
  [ -z "$end" ] || ends+=$end$nl
  more=$(awk 'index($0, "!`") || index($0, "```!") { where[++n] = NR; text[n] = $0 } END { for (i = 1; i <= n; i++) if (where[i] != NR) print FILENAME ":" where[i] ":" text[i] }' "$file")
  [ -z "$more" ] || dynamic+=$more$nl
done
[ -z "$missing" ] || fail "a skill of the list with no SKILL.md:" "$missing"
[ -z "$lacks" ] || fail "a line that the frontmatter of a SKILL.md must hold, as <path>:<the line> (a frontmatter holds one-line \"key: value\" lines only: with another line in it, the test reads no frontmatter):" "$lacks"
[ -z "$disabled" ] || fail "a SKILL.md other than skills/guide/SKILL.md with $key in its frontmatter, as <path>:<line>:<text>:" "$disabled"
[ -z "$ends" ] || fail "the last line of a SKILL.md must be the line of its custom part, with an empty line before it:" "$ends"
[ -z "$dynamic" ] || fail "a line of a SKILL.md, not its last line, with an exclamation mark directly before a backtick or with three backticks directly before an exclamation mark, as <path>:<line>:<text>:" "$dynamic"

old_folders=$(search -F -e .claude/scripts/ -e .claude/skills/ -e .claude/commands/ -e docs/agents/ -- "${texts[@]}" "$documents")
[ -z "$old_folders" ] || fail "an old folder of the harness, as <path>:<line>:<text>:" "$old_folders$nl"
scripts=()
while IFS= read -r path; do
  [[ $path == scripts/*.sh && $path != scripts/*/* ]] || continue
  scripts[${#scripts[@]}]=-e
  scripts[${#scripts[@]}]=$path
done <<<"$tracked"
script_files=
[ ${#scripts[@]} -eq 0 ] || script_files=$(search -F "${scripts[@]}" -- "${texts[@]}")
[ -z "$script_files" ] || fail "a script of the plugin by its file, where the form is \"scripts/celetis <name>\", as <path>:<line>:<text>:" "$script_files$nl"
# The arrow is outside the bracket: in a C locale, a bracket holds each byte of the arrow as one character.
bare_commands=$(search -E "(^|[ \`(\"']|→)/($commands)([^A-Za-z0-9_-]|\$)" -- "${texts[@]}" "$documents")
[ -z "$bare_commands" ] || fail "a lane command with no \"celetis:\" before its name, as <path>:<line>:<text>:" "$bare_commands$nl"

cites=$(search -o -E '\$\{CLAUDE_PLUGIN_ROOT\}/[A-Za-z0-9._/-]*[A-Za-z0-9]' -- skills)
skill_file='^skills/([^/]+)/SKILL\.md$'
broken=
alone=
seen=$nl
while IFS= read -r cite; do
  [ -n "$cite" ] || continue
  path=${cite#*:*:"$root"}
  is_tracked "$path" || { broken+=$cite$nl; continue; }
  [[ ${cite%%:*} =~ $skill_file ]] || continue
  from=${BASH_REMATCH[1]}
  [[ $path =~ $skill_file ]] || continue
  other=${BASH_REMATCH[1]}
  [[ $from != "$other" && $seen != *"$nl$from $other$nl"* ]] || continue
  seen+="$from $other$nl"
  grep -qF -- ".claude/agent-flow/custom/$other.md" "skills/$from/SKILL.md" || alone+=$cite$nl
done <<<"$cites"
[ -z "$broken" ] || fail "a citation of the plugin root in skills/ that names no tracked file:" "$broken"
[ -z "$alone" ] || fail "a SKILL.md that cites the SKILL.md of another skill and does not name the custom part of that skill, .claude/agent-flow/custom/<name>.md:" "$alone"
raw=$(search -F CLAUDE_PLUGIN_ROOT -- skills ':(exclude,glob)skills/*/SKILL.md')
[ -z "$raw" ] || fail "the text CLAUDE_PLUGIN_ROOT in a file of skills/ that is no SKILL.md of a skill, as <path>:<line>:<text>:" "$raw$nl"

unparsed=
for manifest in .claude-plugin/plugin.json .claude-plugin/marketplace.json; do
  jq empty "$manifest" 2>/dev/null || unparsed+=$manifest$nl
done
[ -z "$unparsed" ] || fail "a manifest of the plugin that is missing or that jq cannot parse:" "$unparsed"

[ "$fails" -eq 0 ]
echo "PASS"
