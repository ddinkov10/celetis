#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

allow=tests/product-words.allow
words='backend|frontend|staging|promote|fwhr|DESIGN\.md|verify\.py'
source_repo=ddinkov10/fwrh_calculator
record_glob='docs/adr/[0-9]*.md'
copies=11
least=14
skills='intake triage feature bug hotfix chore specify plan implement critic-loop polishing-code-comments lesson lesson-review record-architecture-decisions doc-drift-sync prototype writing-for-agents guide setup'
human='guide setup'
commands='intake|triage|feature|bug|hotfix|chore|plan|implement|guide|setup|critic-loop|lesson|lesson-review|record-architecture-decisions|doc-drift-sync'
texts=(skills step-prompt.md)
documents=(':(glob)docs/*.md' ':(glob)docs/hosts/*.md')
root='<plugin>/'
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
[ -f "$allow" ] || {
  fail "$allow is missing"
  exit 1
}
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
dynamic=
host_entries=
for skill in $skills; do
  file=skills/$skill/SKILL.md
  if ! is_tracked "$file" || [ ! -f "$file" ]; then
    missing+=$file$nl
    continue
  fi
  front=$(frontmatter "$file")
  entry=$(awk 'BEGIN { section = 0 } /^---$/ { section++; next } section == 2 && NF { print; exit }' "$file")
  [ "$entry" = '**Host entry.** Before any step or response, including commentary or an announcement, bind `<plugin>` to the absolute prefix before `/skills/<name>/SKILL.md` in this loaded file'"'"'s path. Read [the host operations](../../docs/hosts/entry.md) at `<plugin>/docs/hosts/entry.md` directly, before any product-path scan. The relative link starts in the absolute directory containing this SKILL.md. Complete its startup reads on each invocation, including a same-session handoff.' ] || host_entries+=$file$nl
  [[ "$nl$front$nl" == *"${nl}name: $skill$nl"* ]] || lacks+="$file:name: $skill$nl"
  if [[ " $human " == *" $skill "* ]]; then
    [[ "$nl$front$nl" == *"$nl$key: true$nl"* ]] || lacks+="$file:$key: true$nl"
  else
    n=1
    while IFS= read -r line; do
      n=$((n + 1))
      [[ $line != "$key":* ]] || disabled+="$file:$n:$line$nl"
    done <<<"$front"
  fi
  more=$(awk 'index($0, "!`") || index($0, "```!") { print FILENAME ":" NR ":" $0 }' "$file")
  [ -z "$more" ] || dynamic+=$more$nl
done
[ -z "$missing" ] || fail "a skill of the list with no SKILL.md:" "$missing"
[ -z "$lacks" ] || fail "a line that the frontmatter of a SKILL.md must hold, as <path>:<the line> (a frontmatter holds one-line \"key: value\" lines only: with another line in it, the test reads no frontmatter):" "$lacks"
[ -z "$disabled" ] || fail "a SKILL.md of a skill other than ${human// / and } with $key in its frontmatter, as <path>:<line>:<text>:" "$disabled"
[ -z "$host_entries" ] || fail "a skill without the common host entry before its procedure:" "$host_entries"
[ -z "$dynamic" ] || fail "a shell injection in a SKILL.md, as <path>:<line>:<text>:" "$dynamic"

old_folders=$(search -F -e .claude/scripts/ -e .claude/skills/ -e .claude/commands/ -e docs/agents/ -- "${texts[@]}" "${documents[@]}")
[ -z "$old_folders" ] || fail "an old folder of the harness, as <path>:<line>:<text>:" "$old_folders$nl"
old_name=$(search -i -E 'agent[-_ ]flow' -- "${texts[@]}" "${documents[@]}")
[ -z "$old_name" ] || fail "the old name of the flow, as <path>:<line>:<text>:" "$old_name$nl"
scripts=()
while IFS= read -r path; do
  [[ $path == scripts/*.sh && $path != scripts/*/* ]] || continue
  scripts[${#scripts[@]}]=-e
  scripts[${#scripts[@]}]=$path
done <<<"$tracked"
script_files=
[ ${#scripts[@]} -eq 0 ] || script_files=$(search -F "${scripts[@]}" -- "${texts[@]}")
[ -z "$script_files" ] || fail "a script of the plugin by its file, where the form is \"scripts/celetis <name>\", as <path>:<line>:<text>:" "$script_files$nl"
refused_gh=$(search -E '(^|[^[:alnum:]_])gh ((issue|pr|repo|label|search) |api .*(graphql|search/))' -- scripts)
[ -z "$refused_gh" ] || fail "a gh call in scripts/ that uses GraphQL or a search/ path, where the form is \"gh api <REST path>\", as <path>:<line>:<text>:" "$refused_gh$nl"
# The arrow is outside the bracket: in a C locale, a bracket holds each byte of the arrow as one character.
bare_commands=$(search -E "(^|[ \`(\"']|→)/($commands)([^A-Za-z0-9_-]|\$)" -- "${texts[@]}" "${documents[@]}")
[ -z "$bare_commands" ] || fail "a lane command with no \"celetis:\" before its name, as <path>:<line>:<text>:" "$bare_commands$nl"

cites=$(search -o -E '<plugin>/[A-Za-z0-9._/-]*[A-Za-z0-9]' -- skills)
skill_file='^skills/([^/]+)/SKILL\.md$'
broken=
alone=
seen=$nl
while IFS= read -r cite; do
  [ -n "$cite" ] || continue
  path=${cite#*:*:"$root"}
  is_tracked "$path" || {
    broken+=$cite$nl
    continue
  }
  [[ ${cite%%:*} =~ $skill_file ]] || continue
  from=${BASH_REMATCH[1]}
  [[ $path =~ $skill_file ]] || continue
  other=${BASH_REMATCH[1]}
  [[ $from != "$other" && $seen != *"$nl$from $other$nl"* ]] || continue
  seen+="$from $other$nl"
  grep -qF -- "custom.$other" "skills/$from/SKILL.md" || alone+=$cite$nl
done <<<"$cites"
[ -z "$broken" ] || fail "a citation of the plugin root in skills/ that names no tracked file:" "$broken"
[ -z "$alone" ] || fail "a SKILL.md that cites another skill without its custom.<target> entry:" "$alone"
old_custom=$(search -F '.claude/celetis-flow/custom/' -- skills docs/hosts)
[ -z "$old_custom" ] || fail "an obsolete custom file in active entry instructions:" "$old_custom$nl"
for contract in '.celetis.yaml' 'custom.<name>' 'configuration.md' 'whole' 'once' 'parsed string' 'absolute directory containing' 'before any product-path scan'; do
  grep -qF -- "$contract" docs/hosts/entry.md || fail "Host entry is missing the YAML contract: $contract"
done
for host in claude codex; do
  for contract in '.git' 'shell' 'context'; do
    grep -qF -- "$contract" "docs/hosts/$host.md" || fail "$host is missing native entry guidance: $contract"
  done
done
grep -qF '.celetis.yaml' hooks/entry.js || fail 'Claude native entry must select .celetis.yaml'
grep -qF '.celetis.yaml' docs/hosts/codex.md || fail 'Codex native entry must select .celetis.yaml'
grep -qF 'active checkout binding' docs/hosts/codex.md || fail 'Codex entry must use the active checkout binding'
grep -qF 'tool process cwd' docs/hosts/codex.md || fail 'Codex entry must distinguish the tool process cwd'
for contract in 'hooks/entry.js' 'native destination' '$.session.root()' '$.session.cwd()' '$.fs.stat' 'permission-checked' 'zero content reads' 'one whole `Read` request' 'including commentary' 'file_unchanged' 'seeded result' 'compacted' 'another access path' 'hook setup' 'later full-file' 'new invocation' 'same agent loop'; do
  grep -qF -- "$contract" docs/hosts/claude.md || fail "Claude entry must preserve native hook guarantees: $contract"
done
raw=$(search -F '<plugin>/' -- skills ':(exclude,glob)skills/*/SKILL.md')
[ -z "$raw" ] || fail "the text <plugin>/ in a file of skills/ that is no SKILL.md of a skill, as <path>:<line>:<text>:" "$raw$nl"

links=$(search -o -E '\]\([./A-Za-z0-9_-]+[.]md\)' -- skills docs/hosts docs/docs-lookup.md)
broken_links=
repo_root=$PWD
while IFS= read -r link; do
  [ -n "$link" ] || continue
  from=${link%%:*}
  target=${link#*:*:](}
  target=${target%)}
  folder=$(cd "$(dirname "$from")/$(dirname "$target")" 2>/dev/null && pwd) || {
    broken_links+=$link$nl
    continue
  }
  resolved="$folder/$(basename "$target")"
  is_tracked "${resolved#"$repo_root/"}" || broken_links+=$link$nl
done <<<"$links"
[ -z "$broken_links" ] || fail "a bundled Markdown link that does not resolve to a tracked file:" "$broken_links"

host_missing=
for path in docs/hosts/entry.md docs/hosts/claude.md docs/hosts/codex.md skills/guide/agents/openai.yaml skills/setup/agents/openai.yaml; do
  is_tracked "$path" && [ -f "$path" ] || host_missing+=$path$nl
done
[ -z "$host_missing" ] || fail "a host contract file that is missing or untracked:" "$host_missing"
for contract in 'launcher recommendation' '--agent claude <command>' '--agent codex <command>' "person's terminal"; do
  grep -qF -- "$contract" skills/guide/SKILL.md || fail "guide must select the running host in terminal advice: $contract"
done
for contract in 'After Host entry succeeds' 'If entry stops' 'conditional commands'; do
  grep -qF -- "$contract" skills/guide/SKILL.md || fail "guide must gate goal advice on successful entry: $contract"
done
grep -qF 'Do not read a `.git` directory' docs/hosts/codex.md || fail 'Codex metadata must branch before reading .git'
for contract in 'multi_agent_v1.spawn_agent' 'fork_context: false' 'multi_agent_v1.send_input' 'codex debug models' 'tool search' 'collaboration.followup_task'; do
  grep -qF -- "$contract" docs/hosts/codex.md || fail "Codex dispatch must cover both tool sets: $contract"
done
grep -qF 'not in the environment of a Bash tool command' docs/hosts/claude.md ||
  fail 'Claude host must say that the Bash tool has no CLAUDE_PLUGIN_ROOT'
for contract in 'Claude Code 2.1.299 or later' 'Codex CLI 0.162.1 or later'; do
  grep -qF -- "$contract" README.md || fail "README must name the minimum host version: $contract"
done
host_leaks=$(search -E '\$ARGUMENTS|CLAUDE_PLUGIN_ROOT|EnterWorktree|ExitWorktree|\(Skill tool\)|scratchpad directory' -- skills step-prompt.md)
[ -z "$host_leaks" ] || fail "a native host assumption outside the host references:" "$host_leaks$nl"
for skill in $human; do
  policy=skills/$skill/agents/openai.yaml
  [ ! -f "$policy" ] || [ "$(cat "$policy")" = $'policy:\n  allow_implicit_invocation: false' ] ||
    fail "$skill must remain human-invoked in Codex"
done

jq -se '
  length == 1 and (.[0] |
    .name == "celetis" and (.description | type == "string" and length > 0)
    and (has("version") | not))
' .claude-plugin/plugin.json >/dev/null 2>&1 || fail "the shared plugin manifest must name celetis and have no version"
jq -se '
  length == 1 and (.[0] |
    .name == "celetis" and (.owner.name | type == "string" and length > 0)
    and (.plugins | type == "array" and length == 1)
    and .plugins[0].name == "celetis" and .plugins[0].source == "./"
    and (.plugins[0] | has("version") | not))
' .claude-plugin/marketplace.json >/dev/null 2>&1 || fail "the shared marketplace must expose celetis from its root with no version"

package_missing=
for path in .claude-plugin/plugin.json .claude-plugin/marketplace.json scripts/celetis \
  scripts/celetis-flow.sh scripts/next-step.sh scripts/worktree.sh scripts/land.sh scripts/setup.sh \
  scripts/capscore.sh scripts/plugin-update.pl scripts/lib/host.sh scripts/lib/session.sh \
  step-prompt.md docs/capability.md docs/docs-lookup.md docs/adr/README.md docs/adr/template.md; do
  is_tracked "$path" && [ -f "$path" ] || package_missing+=$path$nl
done
[ -z "$package_missing" ] || fail "a shared package resource that is missing or untracked:" "$package_missing"

jq -se '
  length == 1 and (.[0].permissions |
    (.allow | type == "array" and index("Bash(scripts/celetis land *)") != null
      and index("Bash(scripts/celetis --agent claude land *)") != null
      and index("Bash(scripts/celetis --agent codex land *)") != null)
    and (.deny | type == "array" and index("Bash(gh pr merge*)") != null
      and index("PowerShell(gh pr merge*)") != null))
' .claude/settings.json >/dev/null 2>&1 || fail "Claude wiring must allow current landing forms and deny direct merges"

[ "$fails" -eq 0 ]
echo "PASS"
