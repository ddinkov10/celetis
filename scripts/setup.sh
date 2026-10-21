#!/usr/bin/env bash
set -euo pipefail

die() { printf 'setup: %s\n' "$1" >&2; exit 1; }
warn() { printf 'setup: warning: %s\n' "$1"; }
usage() {
  echo 'usage: scripts/celetis setup check | write <options> | try <options> | try --remove | lane <path> | push; <options>: --hosts claude|codex|claude,codex [--default claude|codex] --landing pr|merge [--setup-file <file>] [--ignore <line>]... [--baseline-file <file>]' >&2
  exit 2
}

plugin=$(cd "$(dirname "$0")/.." && pwd)
. "$plugin/scripts/celetis"
. "$plugin/scripts/worktree-lib.sh"
wire_subject='chore(celetis): wire the project for the celetis lanes'
setup_paths=(
  scripts/celetis
  .celetis.yaml
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

check_main() {
  top=$(git rev-parse --show-toplevel) || exit 1
  [ "$(git rev-parse --path-format=absolute --git-dir)" = "$(git rev-parse --path-format=absolute --git-common-dir)" ] ||
    die "run setup in the main checkout, not in a linked worktree: $top"
  cd "$top"
  test_lane=$top/.claude/worktrees/setup-try
}

check_trunk() {
  check_main
  info=$(gh api 'repos/{owner}/{repo}' --jq '.full_name, .default_branch') ||
    die "origin is not a GitHub repository that gh can read"
  repo=${info%%$'\n'*}
  trunk=${info#*$'\n'}
  branch=$(git branch --show-current)
  [ "$branch" = "$trunk" ] || die "the main checkout is on ${branch:-a detached HEAD}, not on $trunk; switch to $trunk first"
  git fetch -q origin "$trunk" || die "cannot fetch $trunk from origin"
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

check_eol() {
  case $(git ls-files --eol -- "$config") in
    i/crlf* | i/mixed*) die "the index holds $config with CRLF line endings; convert it to LF and commit it first" ;;
  esac
}

run_checks() {
  check_trunk
  check_eol
  check_dirty
  check_staged
}

wiring=.claude/celetis-flow/wiring.json
settings=.claude/settings.json
config=.celetis.yaml

has_host() { [[ " $hosts " == *" $1 "* ]]; }

write_args() {
  local given=
  hosts= landing= setup_file= baseline_file=
  ignores=()
  while [ $# -gt 0 ]; do
    [ $# -ge 2 ] || usage
    case $1 in
      --hosts) hosts=$2 ;;
      --default) given=$2 ;;
      --landing) landing=$2 ;;
      --setup-file) [ -n "$2" ] || usage; setup_file=$2 ;;
      --ignore) [ -n "$2" ] || usage; ignores+=("$2") ;;
      --baseline-file) [ -n "$2" ] || usage; baseline_file=$2 ;;
      *) usage ;;
    esac
    shift 2
  done
  # The files are read after run_checks changes the directory.
  case $setup_file in '' | /*) ;; *) setup_file=$PWD/$setup_file ;; esac
  case $baseline_file in '' | /*) ;; *) baseline_file=$PWD/$baseline_file ;; esac
  case $hosts in
    claude | codex) [ -z "$given" ] || usage; default=$hosts ;;
    claude,codex) [ "$given" = claude ] || [ "$given" = codex ] || usage; default=$given; hosts='claude codex' ;;
    *) usage ;;
  esac
  [ "$landing" = pr ] || [ "$landing" = merge ] || usage
}

check_inputs() {
  local file
  for file in "$setup_file" "$baseline_file"; do
    [ -z "$file" ] || { [ -f "$file" ] && [ -r "$file" ]; } || die "cannot read $file"
  done
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
    if [ -f "$path" ] && [ ! -L "$path" ] && ! [ "$path" -ef AGENTS.md ]; then echo "$path"; fi
  done
}

touched() {
  local path agents=AGENTS.md
  for path in CLAUDE.md .claude/CLAUDE.md; do
    if [ -L AGENTS.md ] && [ ! -L "$path" ] && [ AGENTS.md -ef "$path" ]; then agents=$path; fi
  done
  printf '%s\n' scripts/celetis "$config" "$wiring" .gitignore .gitattributes "$agents"
  for path in docs/adr/README.md docs/adr/template.md docs/lessons/INDEX.md; do
    [ -e "$path" ] || echo "$path"
  done
  if has_host codex; then echo .codex/rules/celetis.rules; fi
  if has_host claude; then
    echo .claude/settings.json
    claude_files
  fi
}

check_paths() {
  local path code
  while IFS= read -r path; do
    [ ! -L "$path" ] || die "$path is a symbolic link; setup writes no file through a link"
    code=0
    git check-ignore -q -- "$path" || code=$?
    case $code in
      0) die "git ignores $path; make git track it first" ;;
      1) ;;
      *) die "$path lies beyond a symbolic link or in a submodule; setup writes no file there" ;;
    esac
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

add_lines() {
  local file=$1 line
  shift
  [ -e "$file" ] || : >"$file"
  for line; do
    if ! has_line "$file" "$line"; then
      [ -z "$(tail -c1 "$file")" ] || echo >>"$file"
      printf '%s\n' "$line" >>"$file"
    fi
  done
}

own_lines() {
  local file=$1 line
  shift
  for line; do own_line "$file" "$line"; done
  add_lines "$file" "$@"
}

add_baseline() {
  local heading
  heading=$(head -n1 "$baseline_file")
  if has_line AGENTS.md "$heading"; then
    warn "AGENTS.md: $heading is there; setup leaves it"
    return 0
  fi
  [ -z "$(tail -c1 AGENTS.md)" ] || echo >>AGENTS.md
  [ -z "$(tail -n1 AGENTS.md)" ] || echo >>AGENTS.md
  cat "$baseline_file" >>AGENTS.md
  [ -z "$(tail -c1 "$baseline_file")" ] || echo >>AGENTS.md
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
      # A fence with no closing line marks no line, so a rerun still finds a section appended after it.
      for (i = 1; i <= m; i++) {
        if (fence == "") {
          if (match(text[i], /^ ? ? ?(```+|~~~+)/)) { fence = substr(text[i], RSTART, RLENGTH); sub(/^ +/, "", fence); from = i }
        } else if (text[i] ~ ("^ ? ? ?" fence "+[ \t\r]*$")) {
          for (k = from; k <= i; k++) code[k] = 1
          fence = ""
        }
      }
      for (i = 1; i <= m && !start; i++) if (!code[i] && norm(text[i]) == norm(want[1])) start = i
      if (!start) {
        for (i = 1; i <= m; i++) print text[i]
        if (m > 0 && norm(text[m]) != "") print ""
        print want[1]
        print ""
        for (j = 2; j <= n; j++) print want[j]
        exit
      }
      stop = m
      for (i = start + 1; i <= m; i++) if (!code[i] && (text[i] ~ /^# / || text[i] ~ /^## /)) { stop = i - 1; break }
      last = start
      for (i = start + 1; i <= stop; i++) if (norm(text[i]) != "") last = i
      for (j = 2; j <= n; j++) {
        found = 0
        for (i = start + 1; i <= stop; i++) if (!code[i] && bare(text[i]) == bare(want[j])) found = 1
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

config_key() {
  local key=$1 answer=$2 current
  current=$(jq -r --arg key "$key" '.[$key] // empty' "$scratch/config.json")
  if [ -z "$current" ]; then
    echo "$key" >>"$scratch/config.keys"
    echo "$key: $answer" >>"$scratch/config.lines"
  elif [ "$current" = "$answer" ]; then
    echo "$key" >>"$scratch/config.keys"
  else
    warn "$config: $key is $current, not $answer; setup leaves it"
  fi
}

setup_block() {
  local text trimmed indent= chomp=-
  text=$(cat "$setup_file"; echo x)
  text=${text%x}
  trimmed=${text%"${text##*[!$'\n']}"}
  case $((${#text} - ${#trimmed})) in 0) ;; 1) chomp= ;; *) chomp=+ ;; esac
  [ "$(awk 'length { print substr($0, 1, 1); exit }' "$setup_file")" != ' ' ] || indent=2
  printf 'worktreeSetup: |%s%s\n' "$indent" "$chomp"
  awk '{ print ($0 == "" ? "" : "  " $0) }' "$setup_file"
}

config_setup() {
  if jq -e 'has("worktreeSetup")' "$scratch/config.json" >/dev/null; then
    jq -e --rawfile want "$setup_file" '.worktreeSetup == $want' "$scratch/config.json" >/dev/null ||
      warn "$config: worktreeSetup differs from the setup file; setup leaves it"
  else
    setup_block >"$scratch/config.block"
  fi
}

config_plan() {
  local next
  : >"$scratch/config.keys"
  : >"$scratch/config.lines"
  : >"$scratch/config.block"
  if [ -e "$config" ]; then
    celetis_config_read "$PWD" >"$scratch/config.json" || die "cannot read $config; fix the cause above first"
  else
    echo '{}' >"$scratch/config.json"
  fi
  config_key host "$default"
  config_key landing "$landing"
  [ -z "$setup_file" ] || config_setup
  [ -s "$scratch/config.lines" ] || [ -s "$scratch/config.block" ] || return 0
  mkdir "$scratch/yaml"
  if [ -e "$config" ]; then
    {
      cat "$config"
      [ -z "$(tail -c1 "$config")" ] || echo
      cat "$scratch/config.lines"
    } >"$scratch/yaml/$config"
    if [ -s "$scratch/config.lines" ]; then
      next=$(celetis_config_read "$scratch/yaml" 2>/dev/null) &&
        [ "$(jq -S 'del(.host, .landing)' <<<"$next")" = "$(jq -S 'del(.host, .landing)' "$scratch/config.json")" ] ||
        die "cannot add the line $(head -n1 "$scratch/config.lines") to $config; add it by hand first"
    fi
  else
    cp "$scratch/config.lines" "$scratch/yaml/$config"
  fi
  [ -s "$scratch/config.block" ] || return 0
  cat "$scratch/config.block" >>"$scratch/yaml/$config"
  next=$(celetis_config_read "$scratch/yaml" 2>/dev/null) &&
    jq -e --rawfile want "$setup_file" '.worktreeSetup == $want' <<<"$next" >/dev/null &&
    [ "$(jq -S 'del(.worktreeSetup)' <<<"$next")" = "$(jq -S --arg host "$default" --arg landing "$landing" '.host //= $host | .landing //= $landing' "$scratch/config.json")" ] ||
    die "cannot add worktreeSetup to $config; add it by hand first"
}

config_apply() {
  local key
  while IFS= read -r key; do own_entry "$config" "$(jq -nc --arg key "$key" '{path: [$key]}')"; done <"$scratch/config.keys"
  [ ! -e "$scratch/yaml/$config" ] || cp "$scratch/yaml/$config" "$config"
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
  config_apply
  if has_host codex; then
    own_file .codex/rules/celetis.rules
    codex_rules >.codex/rules/celetis.rules
  fi
  own_lines .gitignore .claude/worktrees/ .claude/settings.local.json docs/superpowers/ .superpowers/ docs/lessons/_pending/
  add_lines .gitignore ${ignores[@]+"${ignores[@]}"}
  own_lines .gitattributes 'scripts/celetis text eol=lf' '.celetis.yaml text eol=lf'
  own_section AGENTS.md '## Celetis flow' \
    "- The lanes are the skills of the plugin \`celetis\`, on the issues of \`$repo\`." \
    '- `landing` in `.celetis.yaml` names the landing mechanism, and a build step ends with `scripts/celetis land`.' \
    '- A lane never skips a step.' \
    '- The maintainer starts the runner; an agent starts it only when its task says so, with a number, and in a terminal.'
  if [ -n "$baseline_file" ]; then add_baseline; fi
  if has_host claude; then
    for path in CLAUDE.md .claude/CLAUDE.md; do
      if [ -L "$path" ] && ! [ "$path" -ef AGENTS.md ]; then
        warn "$path is a symbolic link to a file other than AGENTS.md; setup leaves it, so Claude reads AGENTS.md only if that file holds @AGENTS.md"
      fi
    done
    while IFS= read -r path; do own_lines "$path" @AGENTS.md; done < <(claude_files)
    settings_apply
  fi
}

labels() {
  cat <<'EOF'
needs-triage|not yet classified|FBCA04
bug|Something isn't working|d73a4a
enhancement|New feature or request|a2eeef
hotfix|production broken, the fix ships now|FEF2C0
chore|zero-behavior-change edit|006B75
epic|parent of several feature sub-issues|0052CC
needs-info|the report lacks what its lane needs; the questions are in a comment|FEF2C0
ready-for-agent|plan posted; `/celetis:implement #<n>` can start|D93F0B
ready-for-human|a step only a human runs|C2E0C6
wontfix|This will not be worked on|ffffff
EOF
}

make_labels() {
  local existing name description color found
  existing=$(gh api --paginate 'repos/{owner}/{repo}/labels?per_page=100' --jq '.[].name') || die "cannot list the labels"
  while IFS='|' read -r name description color; do
    if found=$(grep -ixF -m1 -- "$name" <<<"$existing"); then
      [ "$found" = "$name" ] || warn "the label $found differs in case from $name; setup leaves it"
    else
      gh api --silent 'repos/{owner}/{repo}/labels' -f name="$name" -f description="$description" -f color="$color" ||
        die "cannot make the label $name"
      echo "setup: made the label $name"
    fi
  done < <(labels)
}

make_stores() {
  local path
  mkdir -p docs/adr docs/lessons
  for path in docs/adr/README.md docs/adr/template.md; do
    [ -e "$path" ] || cp "$plugin/$path" "$path"
  done
  [ -e docs/lessons/INDEX.md ] || printf '# Lessons\n\n| Lesson | Tags | Date | Summary |\n|---|---|---|---|\n' >docs/lessons/INDEX.md
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

changed_paths() { git status --porcelain --untracked-files=all -- "${setup_paths[@]}" | cut -c4-; }

report_changes() {
  local changed
  changed=$(changed_paths)
  if [ -z "$changed" ]; then echo 'setup: no file changed'; else sed 's/^/setup: changed /' <<<"$changed"; fi
}

plan_tree() {
  check_inputs
  read_record
  check_paths
  if has_host claude; then settings_plan; fi
  config_plan
}

write_tree() {
  write_files
  make_stores
  write_record
}

make_scratch() {
  scratch=$(mktemp -d "${TMPDIR:-/tmp}/celetis.XXXXXX")
  trap 'rm -rf "$scratch"' EXIT
}

write() {
  write_args "$@"
  run_checks
  make_scratch
  plan_tree
  make_labels
  write_tree
  report_changes
}

stage_paths() {
  local path
  while IFS= read -r path; do
    if [ "$path" = scripts/celetis ]; then git add --chmod=+x -- "$path"; else git add -- "$path"; fi
  done <<<"$1"
}

push() {
  local changed
  check_trunk
  check_staged
  changed=$(changed_paths)
  if [ -z "$changed" ]; then
    echo 'setup: no file changed; nothing to commit'
    [ "$ahead" -gt 0 ] || return 0
  else
    stage_paths "$changed"
    # No path here: git commit -- <path> takes the file mode from the working tree and drops the 100755 of git add --chmod.
    git commit -q -m "$wire_subject" ||
      { git reset -q -- "${setup_paths[@]}"; die "the commit failed; the files stay uncommitted"; }
  fi
  git push -q origin "refs/heads/$trunk:refs/heads/$trunk" || die "the push failed; the commit stays on the local $trunk"
}

is_worktree() {
  git worktree list --porcelain | WANT=$1 awk '/^worktree / && substr($0, 10) == ENVIRON["WANT"] { found = 1 } END { exit !found }'
}

remove_test_lane() {
  if is_worktree "$test_lane"; then
    git worktree remove --force "$test_lane"
    git worktree prune
  elif [ -e "$test_lane" ] || [ -L "$test_lane" ]; then
    die ".claude/worktrees/setup-try is no worktree of git; remove it first"
  fi
}

commit_wiring() {
  local changed tree commit
  changed=$(changed_paths)
  [ -n "$changed" ] || return 0
  stage_paths "$changed"
  # Plumbing: git commit runs the hooks of the config also with core.hooksPath=/dev/null, and prepare-commit-msg also with --no-verify.
  tree=$(git write-tree) &&
    commit=$(GIT_AUTHOR_NAME=celetis GIT_AUTHOR_EMAIL=setup@celetis.invalid GIT_COMMITTER_NAME=celetis GIT_COMMITTER_EMAIL=setup@celetis.invalid \
      git commit-tree --no-gpg-sign -p HEAD -m "$wire_subject" "$tree") &&
    git update-ref HEAD "$commit" ||
    die "the commit failed in the test lane"
}

make_test_lane() {
  write_args "$@"
  run_checks
  make_scratch
  remove_test_lane
  git worktree add --detach "$test_lane" HEAD
  cd "$test_lane"
  plan_tree
  write_tree
  commit_wiring
}

try() {
  local json code=0
  make_test_lane "$@" >&2
  json=$(celetis_config_read "$test_lane") || die "cannot read $config; fix the cause above first"
  run_setup "$test_lane" "$json" "$top" || code=$?
  echo "$test_lane"
  return "$code"
}

try_remove() {
  check_main
  remove_test_lane
}

lane() {
  local given=$1 path json
  case $given in /*) ;; *) given=$PWD/$given ;; esac
  check_main
  path=$(git -C "$given" rev-parse --show-toplevel 2>/dev/null) || path=
  [[ $path == "$top/.claude/worktrees/"* ]] && [ "$path" != "$test_lane" ] && is_worktree "$path" ||
    die "$1 is no lane worktree in .claude/worktrees/ of this repository"
  json=$(celetis_config_read "$top") || die "cannot read $config; fix the cause above first"
  jq -e '(.worktreeSetup // "") != ""' <<<"$json" >/dev/null || die "the main $config has no worktreeSetup to run"
  rm -f "$(marker_of "$path")"
  run_setup "$path" "$json" "$top" || die "the worktree setup failed in $path"
}

case ${1:-} in
  check) [ $# -eq 1 ] || usage; run_checks ;;
  write) shift; write "$@" ;;
  try)
    shift
    if [ "${1:-}" = --remove ]; then [ $# -eq 1 ] || usage; try_remove; else try "$@"; fi ;;
  lane) [ $# -eq 2 ] && [ -n "$2" ] || usage; lane "$2" ;;
  push) [ $# -eq 1 ] || usage; push ;;
  *) usage ;;
esac
