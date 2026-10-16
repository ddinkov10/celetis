#!/usr/bin/env bash
set -eu
here=$(cd "$(dirname "$0")" && pwd)
launcher="$here/../scripts/celetis"
helper="$here/../scripts/lib/host.sh"
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
fails=0

plug="$tmp/plug in"
proj="$tmp/proj dir"
mkdir -p "$plug/scripts" "$plug/skills/guide" "$plug/.claude-plugin" "$proj/scripts" "$tmp/stub" "$tmp/oops" "$tmp/nobin" "$tmp/nojq" "$tmp/cyg" "$tmp/codex" "$tmp/pipes"
cp "$launcher" "$proj/scripts/celetis"
celetis="$proj/scripts/celetis"
printf '%s\n' '{"name":"celetis"}' >"$plug/.claude-plugin/plugin.json"
printf '%s\n' 'fixture skill' >"$plug/skills/guide/SKILL.md"
cat >"$plug/scripts/echo.sh" <<'EOF'
printf '[%s]' "$@"
EOF
echo 'exit 7' >"$plug/scripts/fail.sh"
echo 'printf project' >"$proj/scripts/echo.sh"
echo 'printf "%s" "$CELETIS_HOST"' >"$plug/scripts/host.sh"

export LIST="$tmp/list.json"
export SKILLS="$tmp/skills.json" CALLS="$tmp/calls" PID_FILE="$tmp/pid"
export REAL_GIT="$(command -v git)"
export GIT_HOST= CODEX_MODE= TMPDIR="$tmp/pipes" LOOKUP_FAIL=0
unset CELETIS_HOST
cat >"$tmp/stub/claude" <<'EOF'
#!/bin/bash
if [ "$1 $2 $3" = "plugin list --json" ]; then
  cat "$LIST"
  [ "$LOOKUP_FAIL" -eq 0 ] || { echo 'fixture: lookup failed' >&2; exit "$LOOKUP_FAIL"; }
else
  exit 81
fi
exit 0
EOF
cat >"$tmp/stub/git" <<'EOF'
#!/bin/bash
if [ "$*" = 'config --get celetis-flow.host' ] && [ "${GIT_HOST+x}" = x ] && [ -n "$GIT_HOST" ]; then
  printf '%s\n' "$GIT_HOST"
else
  exec "$REAL_GIT" "$@"
fi
EOF
cat >"$tmp/codex/codex" <<'EOF'
#!/bin/bash
printf '%s\n' "$*" >>"$CALLS"
[ "$*" = 'app-server --stdio' ] || exit 81
printf '%s\n' "$$" >"$PID_FILE"
trap 'exit 0' TERM
while IFS= read -r line; do
  printf '%s\n' "$line" >>"$CALLS"
  method=$(printf '%s\n' "$line" | jq -r .method)
  id=$(printf '%s\n' "$line" | jq -c .id)
  case "$method:$CODEX_MODE" in
    initialize:exit) exit 4 ;;
    initialize:timeout) continue ;;
    initialize:flood) while :; do printf '%s\n' '{"method":"skills/changed"}'; done ;;
    initialize:fragment)
      printf '{"id":%s,"result":' "$id"
      sleep 1.2
      printf '%s\n' '{"userAgent":"fixture"}}'
      continue ;;
    initialize:malformed) printf '%s\n' 'not JSON'; continue ;;
    initialize:error) printf '{"id":%s,"error":{"code":-1,"message":"fixture error"}}\n' "$id"; continue ;;
  esac
  case $method in
    initialize)
      printf '%s\n' '{"method":"skills/changed"}' '{"id":99,"result":{}}'
      printf '{"id":%s,"result":{"userAgent":"fixture"}}\n' "$id"
      ;;
    initialized) ;;
    skills/list)
      printf '%s\n' '{"method":"skills/changed"}' '{"id":"2","result":{}}'
      jq -c --argjson id "$id" '{id:$id,result:.}' "$SKILLS"
      ;;
    *) exit 82 ;;
  esac
done
EOF
printf '#!/bin/bash\necho oops\n' >"$tmp/oops/claude"
cat >"$tmp/cyg/cygpath" <<EOF
#!/bin/bash
[ "\$1" = -u ] && [ "\$2" = 'C:\\plug' ] && printf '%s\\n' "$plug"
EOF
chmod +x "$tmp"/stub/claude "$tmp"/stub/git "$tmp"/codex/codex "$tmp"/oops/claude "$tmp"/cyg/cygpath
for t in bash jq tr mktemp mkfifo rm cat sleep dirname; do ln -s "$(command -v "$t")" "$tmp/nobin/$t"; done
for t in bash tr; do ln -s "$(command -v "$t")" "$tmp/nojq/$t"; done

rec() { jq -nc --arg s "$1" --arg p "$2" '{id:"celetis@celetis",version:"x",scope:$s,enabled:true,installPath:$p}'; }
other() { jq -nc '{id:"other@market",version:"x",scope:"user",enabled:true,installPath:"/nowhere"}'; }
list() {
  local sep=''
  printf '[' >"$LIST"
  for r in "$@"; do printf '%s%s' "$sep" "$r" >>"$LIST"; sep=,; done
  printf ']' >>"$LIST"
}

run() {
  local p=$1
  shift
  code=0
  out=$(cd "${from:-$proj}" && PATH="$p" "$celetis" "$@" 2>"$tmp/err") || code=$?
  err=$(cat "$tmp/err")
}

skills() {
  jq -nc --arg cwd "${from:-$proj}" --args '{data:[{cwd:$cwd,skills:[$ARGS.positional[] | fromjson],errors:[]}]}' -- "$@" >"$SKILLS"
}
skill() {
  jq -nc --arg path "$1" --arg enabled "${2:-true}" --arg id "${3:-celetis@celetis}" --arg name "${4:-celetis:guide}" \
    '{path:$path,enabled:($enabled == "true"),pluginId:$id,name:$name,scope:"user"}'
}
check() {
  local label=$1
  shift
  if "$@"; then printf 'ok   %s\n' "$label"; else printf 'FAIL %s\n' "$label"; fails=$((fails + 1)); fi
}
cleaned() {
  [ ! -f "$PID_FILE" ] || ! kill -0 "$(cat "$PID_FILE")" 2>/dev/null || return 1
  [ "$(printf '%s' "$tmp/pipes"/*)" = "$tmp/pipes/*" ]
}

expect() {
  if [ "$out" = "$2" ] && [ "$err" = "$3" ] && [ "$code" = "$4" ]; then
    printf 'ok   %s\n' "$1"
  else
    printf 'FAIL %s\n  stdout: %s\n  stderr: %s\n  exit:   %s\n' "$1" "$out" "$err" "$code"
    fails=$((fails + 1))
  fi
}

git init -q "$proj"
printf 'landing: merge\n' >"$proj/.celetis.yaml"
git -C "$proj" add .
git -C "$proj" -c user.name=t -c user.email=t@t commit -qm fixture
proj=$(cd "$proj" && pwd -P)
celetis="$proj/scripts/celetis"
git -C "$proj" worktree add -q -b feat/1-lane "$tmp/lane"
lane=$(cd "$tmp/lane" && pwd -P)
printf 'landing: pr\nhost: claude\n' >"$lane/.celetis.yaml"
mkdir "$proj/sub" "$lane/sub" "$tmp/outside"
printf 'printf "%%s\\n" "%s"\n' "$plug" >"$plug/scripts/root.sh"
stub="$tmp/stub:$PATH"
install='celetis: the plugin is not installed; run: claude plugin marketplace add ddinkov10/celetis && claude plugin install celetis@celetis'
usage='usage: scripts/celetis <script> [<argument>...], e.g. scripts/celetis next-step --open'
nojq='celetis: jq is not on PATH'

list "$(other)" "$(rec user "$plug")"
run "$stub" echo a 'b c' '#7'
expect "user record runs its script with the arguments" '[a][b c][#7]' '' 0

list "$(rec project "$proj")" "$(rec user "$plug")"
run "$stub" echo x
expect "user record wins over an earlier project record" '[x]' '' 0

list "$(rec project "$proj")"
run "$stub" echo
expect "a project record alone runs" 'project' '' 0

list "$(rec user "$plug" | jq 'del(.enabled)')"
run "$stub" echo
expect 'Claude record without enabled is refused' '' "$install" 1

list "$(other)"
run "$stub" echo
expect "no record of the plugin" '' "$install" 1

list "$(rec user "$plug" | jq '.enabled = false')"
run "$stub" echo
expect 'disabled Claude installation is refused' '' "$install" 1

list "$(rec project "$proj")" "$(rec user "$plug" | jq '.enabled = false')"
run "$stub" echo
expect 'disabled preferred Claude scope cannot fall back to a project copy' '' "$install" 1

run "$tmp/oops:$PATH" echo
expect "claude prints no JSON" '' $'celetis: invalid plugin list JSON\noops' 1

list "$(rec user "$plug")"
LOOKUP_FAIL=23 run "$stub" echo
check 'Claude lookup preserves the failing exit status' test "$code" -eq 23
check 'Claude lookup preserves the command and original cause' test "$err" = "fixture: lookup failed
celetis: claude plugin list --json failed (exit 23)
$(cat "$LIST")"
check 'failed Claude lookup starts no installed script' test -z "$out"

run "$tmp/nobin" echo
expect "no claude on PATH" '' "$install" 1

list "$(rec user "$plug")"
run "$tmp/stub:$tmp/nojq" echo
expect "no jq on PATH" '' "$nojq" 1

run "$tmp/nojq" echo
expect "no jq and no claude on PATH" '' "$nojq" 1

run "$stub"
expect "no argument" '' "$usage" 2

run "$stub" nope
expect "unknown script name" '' 'celetis: the plugin has no script nope' 2

run "$stub" ../echo
expect "name with a path" '' 'celetis: the plugin has no script ../echo' 2

run "$stub" fail
expect "exit code of the script" '' '' 7

list "$(rec user 'C:\plug')"
run "$tmp/cyg:$stub" echo w
expect "installPath through cygpath" '[w]' '' 0

list "$(rec user "$plug")"
skills "$(skill "$plug/skills/guide/SKILL.md")"
both="$tmp/codex:$stub"
codex_only="$tmp/codex:$tmp/nobin"
missing='celetis: Codex has no enabled celetis@celetis installation; install and enable the plugin in Codex'

run "$both" host
expect 'both hosts installed still defaults to Claude' claude '' 0

GIT_HOST=codex run "$both" host
expect 'obsolete Git host has no effect' claude '' 0
printf 'landing: merge\nhost: codex\n' >"$proj/.celetis.yaml"
GIT_HOST=claude run "$both" host
expect 'main YAML host selects Codex' codex '' 0

CELETIS_HOST=codex GIT_HOST=claude run "$both" host
expect 'environment host overrides the project host' codex '' 0

CELETIS_HOST=claude GIT_HOST=claude run "$both" --host codex host
expect 'explicit host overrides environment and project' codex '' 0

CELETIS_HOST=codex run "$both" --host claude host
expect 'explicit Claude ignores installed Codex' claude '' 0

: >"$CALLS"
run "$codex_only" --host codex echo a 'b c' '' '#7' --host claude
expect 'standalone bootstrap works without Claude and preserves arguments' '[a][b c][][#7][--host][claude]' '' 0
check 'successful discovery removes its process and temporary pipes' cleaned
check 'one lookup makes exactly the handshake and skills request' test "$(sed '1d' "$CALLS" | jq -rs '[.[].method] | join(",")')" = 'initialize,initialized,skills/list'
check 'lookup uses the current checkout and forces enabled-state refresh' test "$(tail -1 "$CALLS" | jq -r --arg cwd "$proj" '.params == {cwds:[$cwd],forceReload:true}')" = true

sleep 30 &
unrelated=$!
run "$codex_only" --host codex fail
check 'cleanup leaves an unrelated process alive' kill -0 "$unrelated"
kill "$unrelated"
wait "$unrelated" 2>/dev/null || true

expect 'Codex preserves subcommand exit status' '' '' 7

run "$both" --host other echo
expect 'invalid explicit host fails' '' 'celetis: invalid host other; use claude or codex' 2
CELETIS_HOST=other run "$both" echo
expect 'invalid environment host fails' '' 'celetis: invalid host other; use claude or codex' 2
GIT_HOST=other run "$both" host
expect 'invalid obsolete Git host has no effect' codex '' 0
CELETIS_HOST= run "$both" echo
expect 'empty environment host fails' '' 'celetis: invalid host ; use claude or codex' 2
CELETIS_HOST=other run "$both" --host codex host
expect 'explicit host overrides an invalid lower-precedence value' codex '' 0
run "$both" --host
check 'host option needs a value' test "$code" = 2
run "$both" --host codex
check 'host option needs a command' test "$code" = 2
run "$tmp/nobin" --host codex echo
expect 'missing selected Codex binary fails' '' 'celetis: codex is not on PATH' 1

skills "$(skill "$plug/skills/guide/SKILL.md" false)"
run "$both" --host codex echo
expect 'disabled Codex installation cannot fall back to Claude' '' "$missing" 1
skills "$(skill "$plug/skills/guide/SKILL.md" true celetis@other)" "$(skill "$plug/skills/guide/SKILL.md" true celetis@celetis celetis-other:guide)"
run "$both" --host codex echo
expect 'only the exact plugin and skill namespace count' '' "$missing" 1
skills
run "$both" --host codex echo
expect 'missing Codex installation fails' '' "$missing" 1

skills "$(skill "$plug/skills/guide/SKILL.md")" "$(skill "$proj/skills/guide/SKILL.md")"
run "$both" --host codex echo
expect 'ambiguous Codex package roots fail' '' 'celetis: Codex reports multiple celetis package roots; fix the enabled installation' 1
skills "$(skill "$plug/skills/guide/SKILL.md")" "$(skill "$plug/skills/guide/SKILL.md")"
run "$both" --host codex echo ok
expect 'several skills in one package root are unambiguous' '[ok]' '' 0

for path in "$tmp/missing/skills/guide/SKILL.md" "$plug/guide/SKILL.md" "$plug/skills/../SKILL.md" 'relative/skills/guide/SKILL.md'; do
  skills "$(skill "$path")"
  run "$both" --host codex echo
  check "invalid installed skill path is refused: $path" test "$code:$out" = '1:'
done
skills "$(skill "$plug/skills/guide/SKILL.md")"
mv "$plug/skills/guide/SKILL.md" "$plug/skills/guide/SKILL.saved"
run "$both" --host codex echo
expect 'missing installed skill is refused' '' 'celetis: Codex reports a missing installed skill; reinstall the plugin' 1
mv "$plug/skills/guide/SKILL.saved" "$plug/skills/guide/SKILL.md"
printf '%s\n' '{"name":"other"}' >"$plug/.claude-plugin/plugin.json"
run "$both" --host codex echo
expect 'wrong package manifest is refused' '' 'celetis: Codex reports an invalid celetis package; reinstall the plugin' 1
printf '%s\n' '{"name":"celetis"}' >"$plug/.claude-plugin/plugin.json"
CODEX_MODE=fragment run "$codex_only" --host codex echo fragmented
expect 'response fragments survive a bounded read timeout' '[fragmented]' '' 0
printf '%s\n' '{"data":"bad"}' >"$SKILLS"
run "$both" --host codex echo
expect 'malformed skills result fails' '' 'celetis: invalid Codex skills/list response' 1

for mode in malformed error exit timeout flood; do
  start=$SECONDS
  CODEX_MODE=$mode run "$codex_only" --host codex echo
  check "protocol $mode is a setup error" test "$code:$out" = '1:'
  check "protocol $mode reports diagnostics on stderr" test -n "$err"
  check "protocol $mode cleans up" cleaned
  check "protocol $mode returns within its deadline" test "$((SECONDS - start))" -le 12
done

helper_run() {
  local p=$1
  shift
  code=0
  out=$(cd "${from:-$proj}" && PATH="$p" bash -c 'set -eu; source "$1"; shift; "$@"; if [ "$1" = celetis_host_select ]; then bash -c '\''printf "%s" "$CELETIS_HOST"'\''; fi' helper "$helper" "$@" 2>"$tmp/err") || code=$?
  err=$(cat "$tmp/err")
}
helper_run "$stub" celetis_host_select
expect 'direct helper uses main YAML and exports to children' codex '' 0
GIT_HOST=claude helper_run "$both" celetis_host_select
expect 'direct helper ignores the obsolete Git host' codex '' 0
CELETIS_HOST=claude GIT_HOST=codex helper_run "$both" celetis_host_select
expect 'direct helper environment overrides the project host' claude '' 0
CELETIS_HOST=codex helper_run "$codex_only" celetis_host_require
expect 'direct Codex helper does not require Claude' '' '' 0
CELETIS_HOST=other helper_run "$both" celetis_host_require
expect 'direct helper rejects an invalid host' '' 'celetis: invalid host other; use claude or codex' 2
CELETIS_HOST=codex helper_run "$tmp/nobin" celetis_host_require
expect 'direct helper checks the selected binary' '' 'celetis: codex is not on PATH' 1


for from in "$proj" "$lane" "$proj/sub" "$lane/sub"; do
  skills "$(skill "$plug/skills/guide/SKILL.md")"
  GIT_HOST=claude run "$both" host
  expect "main YAML host from $from" codex '' 0
  CELETIS_HOST=claude run "$both" host
  expect "environment host from $from" claude '' 0
  CELETIS_HOST=codex run "$both" --host claude host
  expect "explicit host from $from" claude '' 0
  printf 'landing: merge\n' >"$proj/.celetis.yaml"
  GIT_HOST=codex run "$both" host
  expect "default host from $from" claude '' 0
  printf 'landing: merge\nhost: codex\n' >"$proj/.celetis.yaml"
done
unset from
skills "$(skill "$plug/skills/guide/SKILL.md")"
export LAUNCH_LOG="$tmp/launched"
printf 'touch "$LAUNCH_LOG"\n' >"$plug/scripts/next-step.sh"
for bad in missing invalid; do
  if [ "$bad" = missing ]; then rm "$proj/.celetis.yaml"
  else printf 'landing: merge\nhost: other\n' >"$proj/.celetis.yaml"; fi
  run "$both" --host claude next-step 7
  check "$bad main config stops a project command" test "$code" -eq 2
  check "$bad main config starts no installed script" test ! -e "$LAUNCH_LOG"
  check "$bad main config reports the selected path" test "${err#*"$proj/.celetis.yaml"}" != "$err"
  run "$tmp/stub:$tmp/nobin" --host claude root
  expect "explicit installation root bypasses $bad project config without yq" "$plug" '' 0
done
printf 'landing: merge\nhost: codex\n' >"$proj/.celetis.yaml"
from="$tmp/outside" run "$tmp/stub:$tmp/nobin" --host claude root
expect 'explicit installation root works outside Git without yq' "$plug" '' 0
from="$tmp/outside" run "$stub" root
expect 'outside Git has no required project defaults' "$plug" '' 0

[ "$fails" -eq 0 ]
