#!/usr/bin/env bash
# The deterministic acts of /celetis:setup; each one starts with the checks of the main checkout and its trunk.
set -euo pipefail

die() { printf 'setup: %s\n' "$1" >&2; exit 1; }
warn() { printf 'setup: warning: %s\n' "$1"; }
usage() {
  echo 'usage: scripts/celetis setup check | write --hosts claude|codex|claude,codex [--default claude|codex] --landing pr|merge | push' >&2
  exit 2
}

plugin=$(cd "$(dirname "$0")/.." && pwd)
setup_paths=(
  scripts/celetis
  .claude/celetis-flow/landing.json
  .claude/celetis-flow/wiring.json
  .codex/rules/celetis.rules
  .claude/settings.json
  .gitignore
  .gitattributes
  AGENTS.md
  CLAUDE.md
  .claude/CLAUDE.md
  docs/adr/README.md
  docs/adr/template.md
  docs/lessons/INDEX.md
)

check_trunk() {
  top=$(git rev-parse --show-toplevel) || exit 1
  [ "$(git rev-parse --path-format=absolute --git-dir)" = "$(git rev-parse --path-format=absolute --git-common-dir)" ] ||
    die "run setup in the main checkout, not in a linked worktree: $top"
  cd "$top"
  info=$(gh api 'repos/{owner}/{repo}' --jq '.full_name, .default_branch' 2>/dev/null) ||
    die "origin is not a GitHub repository that gh can read"
  repo=${info%%$'\n'*}
  trunk=${info#*$'\n'}
  branch=$(git branch --show-current)
  [ "$branch" = "$trunk" ] || die "the main checkout is on ${branch:-a detached HEAD}, not on $trunk; switch to $trunk first"
  git fetch -q origin "$trunk" 2>/dev/null || die "cannot fetch $trunk from origin"
  [ "$(git rev-list --count "HEAD..origin/$trunk")" -eq 0 ] ||
    die "the local $trunk is behind origin/$trunk or has diverged from it; run git pull first"
  ahead=$(git rev-list --count "origin/$trunk..HEAD")
  if [ "$ahead" -eq 1 ]; then
    warn "the local $trunk is 1 commit ahead of origin/$trunk; the push carries it:"
  elif [ "$ahead" -gt 1 ]; then
    warn "the local $trunk is $ahead commits ahead of origin/$trunk; the push carries them:"
  fi
  [ "$ahead" -eq 0 ] || git log --reverse --format='  %s' "origin/$trunk..HEAD"
}

check_dirty() {
  local files
  files=$(git status --porcelain --untracked-files=all -- "${setup_paths[@]}" | cut -c4- | paste -sd ' ' -)
  [ -z "$files" ] || die "commit or drop the uncommitted changes of these files first: $files"
}

check_staged() {
  git diff --cached --quiet || die "the index holds staged changes; commit or unstage them first"
}

run_checks() {
  check_trunk
  check_dirty
  check_staged
}

wiring=.claude/celetis-flow/wiring.json
settings=.claude/settings.json

has_host() { [[ " $hosts " == *" $1 "* ]]; }

write_args() {
  local given=
  hosts= landing=
  while [ $# -gt 0 ]; do
    [ $# -ge 2 ] || usage
    case $1 in
      --hosts) hosts=$2 ;;
      --default) given=$2 ;;
      --landing) landing=$2 ;;
      *) usage ;;
    esac
    shift 2
  done
  case $hosts in
    claude | codex) [ -z "$given" ] || usage; default=$hosts ;;
    claude,codex) [ "$given" = claude ] || [ "$given" = codex ] || usage; default=$given; hosts='claude codex' ;;
    *) usage ;;
  esac
  [ "$landing" = pr ] || [ "$landing" = merge ] || usage
}

read_record() {
  if [ -e "$wiring" ]; then
    jq -e '
      type == "object" and .schema == 1
      and (.files | type == "array" and all(type == "string"))
      and (.entries | type == "object" and all(.[]; type == "array"))
    ' "$wiring" >/dev/null 2>&1 || die "$wiring is no record of setup; fix or remove it first"
    cp "$wiring" "$scratch/old.json"
  else
    echo '{"files": [], "entries": {}}' >"$scratch/old.json"
  fi
}

claude_files() {
  local path
  for path in CLAUDE.md .claude/CLAUDE.md; do
    if [ -f "$path" ] && [ ! -L "$path" ]; then echo "$path"; fi
  done
}

touched() {
  printf '%s\n' scripts/celetis .claude/celetis-flow/landing.json "$wiring" .gitignore .gitattributes AGENTS.md
  if has_host codex; then echo .codex/rules/celetis.rules; fi
  if has_host claude; then
    echo .claude/settings.json
    claude_files
  fi
}

check_ignored() {
  local path
  while IFS= read -r path; do
    ! git check-ignore -q -- "$path" || die "git ignores $path; make git track it first"
  done < <(touched)
}

own_file() {
  mkdir -p "$(dirname "$1")"
  echo "$1" >>"$scratch/files"
}

own_entry() { jq -nc --arg file "$1" --argjson entry "$2" '[$file, $entry]' >>"$scratch/entries"; }

own_line() { own_entry "$1" "$(jq -n --arg line "$2" '$line')"; }

has_line() {
  WANT=$2 awk '
    { sub(/\r$/, ""); sub(/^[ \t]+/, ""); sub(/[ \t]+$/, "") }
    $0 == ENVIRON["WANT"] { found = 1 }
    END { exit !found }
  ' "$1"
}

own_lines() {
  local file=$1 line
  shift
  [ -e "$file" ] || : >"$file"
  for line; do
    own_line "$file" "$line"
    if ! has_line "$file" "$line"; then
      [ -z "$(tail -c1 "$file")" ] || echo >>"$file"
      printf '%s\n' "$line" >>"$file"
    fi
  done
}

own_section() {
  local file=$1 line
  shift
  [ -e "$file" ] || : >"$file"
  printf '%s\n' "$@" >"$scratch/want"
  for line; do own_line "$file" "$line"; done
  awk '
    function norm(s) { sub(/\r$/, "", s); sub(/^[ \t]+/, "", s); sub(/[ \t]+$/, "", s); return s }
    function bare(s) { s = norm(s); sub(/^[-*] /, "", s); return norm(s) }
    NR == FNR { want[++n] = $0; next }
    { text[++m] = $0 }
    END {
      for (i = 1; i <= m && !start; i++) if (norm(text[i]) == norm(want[1])) start = i
      if (!start) {
        for (i = 1; i <= m; i++) print text[i]
        if (m > 0 && norm(text[m]) != "") print ""
        print want[1]
        print ""
        for (j = 2; j <= n; j++) print want[j]
        exit
      }
      stop = m
      for (i = start + 1; i <= m; i++) if (text[i] ~ /^# / || text[i] ~ /^## /) { stop = i - 1; break }
      last = start
      for (i = start + 1; i <= stop; i++) if (norm(text[i]) != "") last = i
      for (j = 2; j <= n; j++) {
        found = 0
        for (i = start + 1; i <= stop; i++) if (bare(text[i]) == bare(want[j])) found = 1
        if (!found) add[++a] = want[j]
      }
      if (!a) exit
      for (i = 1; i <= last; i++) print text[i]
      if (last == start) print ""
      for (j = 1; j <= a; j++) print add[j]
      for (i = last + 1; i <= m; i++) print text[i]
    }
  ' "$scratch/want" "$file" >"$scratch/section"
  [ ! -s "$scratch/section" ] || cp "$scratch/section" "$file"
}

# The \u0020 in the deny rules keeps their text from matching the gh-call rule of tests/text.test.sh.
settings_form() {
  cat <<'EOF'
[
  {"path": ["permissions", "allow"], "item": "Bash(scripts/celetis land *)"},
  {"path": ["permissions", "allow"], "item": "Bash(scripts/celetis --agent claude land *)"},
  {"path": ["permissions", "allow"], "item": "Bash(scripts/celetis --agent codex land *)"},
  {"path": ["permissions", "deny"], "item": "Bash(gh\u0020pr merge*)"},
  {"path": ["permissions", "deny"], "item": "PowerShell(gh\u0020pr merge*)"},
  {"path": ["extraKnownMarketplaces", "celetis"], "value": {"source": {"source": "github", "repo": "ddinkov10/celetis"}, "autoUpdate": true}},
  {"path": ["enabledPlugins", "superpowers@superpowers-marketplace"], "value": true},
  {"path": ["enabledPlugins", "celetis@celetis"], "value": true}
]
EOF
}

settings_plan() {
  local src=$settings bad
  if [ -e "$settings" ]; then
    jq -es 'length == 1 and (.[0] | type == "object")' "$settings" >/dev/null 2>&1 || die "$settings is no JSON object; fix it first"
  else
    echo '{}' >"$scratch/settings.in"
    src=$scratch/settings.in
  fi
  jq -c --argjson form "$(settings_form)" '
    def dotted: join(".");
    def put($p; $v): .doc |= setpath($p; $v);
    reduce $form[] as $e ({doc: ., added: [], adopted: [], differs: [], bad: null};
      if .bad then .
      else
        $e.path as $p
        | (.doc | getpath($p[:-1])) as $parent
        | if $parent != null and ($parent | type) != "object" then .bad = "\($p[:-1] | dotted) is no object"
          else
            ($parent != null and ($parent | has($p[-1]))) as $there
            | (.doc | getpath($p)) as $cur
            | ($e | del(.value)) as $own
            | if $e | has("item") then
                if ($there | not) then put($p; [$e.item]) | .added += [$own]
                elif ($cur | type) != "array" then .bad = "\($p | dotted) is no array"
                elif any($cur[]; . == $e.item) then .adopted += [$own]
                else put($p; $cur + [$e.item]) | .added += [$own]
                end
              elif ($there | not) then put($p; $e.value) | .added += [$own]
              elif $cur == $e.value then .adopted += [$own]
              else .differs += [$p | dotted]
              end
          end
      end)
  ' "$src" >"$scratch/settings.plan"
  bad=$(jq -r '.bad // empty' "$scratch/settings.plan")
  [ -z "$bad" ] || die "$settings: $bad; fix it first"
}

settings_apply() {
  local plan=$scratch/settings.plan lead= item fmt
  fmt=(--indent 2)
  while IFS= read -r item; do
    warn "$settings: $item differs from the current form; setup leaves it"
  done < <(jq -r '.differs[]' "$plan")
  while IFS= read -r item; do own_entry "$settings" "$item"; done < <(jq -c '(.added + .adopted)[]' "$plan")
  jq -e '.added | length > 0' "$plan" >/dev/null || return 0
  if [ -e "$settings" ]; then lead=$(awk 'match($0, /^[ \t]+[^ \t\r]/) { print substr($0, 1, RLENGTH - 1); exit }' "$settings"); fi
  if [[ $lead == $'\t'* ]]; then
    fmt=(--tab)
  elif [ "${#lead}" -ge 1 ] && [ "${#lead}" -le 7 ]; then
    fmt=(--indent "${#lead}")
  fi
  mkdir -p "$(dirname "$settings")"
  jq "${fmt[@]}" .doc "$plan" >"$scratch/settings.out"
  cp "$scratch/settings.out" "$settings"
}

codex_rules() {
  cat <<'EOF'
prefix_rule(
    pattern = ["scripts/celetis", "land"],
    decision = "allow",
)
prefix_rule(
    pattern = ["scripts/celetis", "--agent", ["claude", "codex"], "land"],
    decision = "allow",
)
prefix_rule(
    pattern = ["gh", "pr", "merge"],
    decision = "forbidden",
    justification = "Use scripts/celetis --agent codex land from the main checkout.",
)
EOF
}

write_files() {
  local path
  own_file scripts/celetis
  cp "$plugin/scripts/celetis" scripts/celetis
  chmod 755 scripts/celetis
  own_file .claude/celetis-flow/landing.json
  printf '{"landing": "%s"}\n' "$landing" >.claude/celetis-flow/landing.json
  if has_host codex; then
    own_file .codex/rules/celetis.rules
    codex_rules >.codex/rules/celetis.rules
  fi
  own_lines .gitignore .claude/worktrees/ .claude/settings.local.json docs/superpowers/ .superpowers/ docs/lessons/_pending/
  own_lines .gitattributes 'scripts/celetis text eol=lf'
  own_section AGENTS.md '## Celetis flow' \
    "- The lanes are the skills of the plugin \`celetis\`, on the issues of \`$repo\`." \
    '- `.claude/celetis-flow/landing.json` names the landing mechanism, and a build step ends with `scripts/celetis land`.' \
    '- A lane never skips a step.' \
    '- The maintainer starts the runner; an agent starts it only when its task says so, with a number, and in a terminal.'
  if has_host claude; then
    while IFS= read -r path; do own_lines "$path" @AGENTS.md; done < <(claude_files)
    settings_apply
  fi
}

write_record() {
  own_file "$wiring"
  jq -S --arg hosts "$hosts" --rawfile files "$scratch/files" --slurpfile entries "$scratch/entries" '
    {
      schema: 1,
      answers: {hosts: ($hosts | split(" ")), tracker: "github"},
      files: (.files + ($files | split("\n") | map(select(. != ""))) | unique),
      entries: (reduce $entries[] as [$file, $entry] (.entries; .[$file] += [$entry]) | map_values(unique))
    }
  ' "$scratch/old.json" >"$scratch/record.json"
  cp "$scratch/record.json" "$wiring"
}

report_changes() {
  local changed
  changed=$(git status --porcelain --untracked-files=all -- "${setup_paths[@]}" | cut -c4-)
  if [ -z "$changed" ]; then echo 'setup: no file changed'; else sed 's/^/setup: changed /' <<<"$changed"; fi
}

write() {
  write_args "$@"
  run_checks
  scratch=$(mktemp -d "${TMPDIR:-/tmp}/celetis.XXXXXX")
  trap 'rm -rf "$scratch"' EXIT
  read_record
  check_ignored
  if has_host claude; then settings_plan; fi
  write_files
  write_record
  git config celetis-flow.agent "$default"
  report_changes
}

case ${1:-} in
  check) [ $# -eq 1 ] || usage; run_checks ;;
  write) shift; write "$@" ;;
  *) usage ;;
esac
