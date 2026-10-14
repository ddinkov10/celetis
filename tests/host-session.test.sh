#!/usr/bin/env bash
set -euo pipefail
root=$(cd "$(dirname "$0")/.." && pwd)
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
export SESSION_TEST="$tmp/state" CLAUDE_CONFIG_DIR="$tmp/claude"
export GIT_AUTHOR_NAME=t GIT_AUTHOR_EMAIL=t@t GIT_COMMITTER_NAME=t GIT_COMMITTER_EMAIL=t@t
unset HERDR_ENV HERDR_PANE_ID HERDR_TAB_ID CELETIS_HOST
S=$SESSION_TEST
plugin="$tmp/installed package"
repo="$tmp/product checkout"
mkdir -p "$S" "$plugin" "$repo/scripts" "$tmp/bin" "$tmp/codex-only"
cp -R "$root/scripts" "$root/.claude-plugin" "$plugin/"
mkdir -p "$plugin/skills/guide"
echo fixture >"$plugin/skills/guide/SKILL.md"
cat >"$plugin/step-prompt.md" <<'EOF'
Keep "quotes", 'quotes', \slashes, tabs:	and Unicode: →.
$(touch "$SESSION_TEST/substitution") `touch "$SESSION_TEST/backticks"`

EOF
cp "$root/scripts/celetis" "$repo/scripts/celetis"
export SESSION_PLUGIN="$plugin"
cat >"$plugin/scripts/next-step.sh" <<'EOF'
#!/bin/bash
if [ -f "$SESSION_TEST/progress" ]; then echo 'stop #7 is finished.'
else printf 'run /celetis:%s #7\n' "$(cat "$SESSION_TEST/step")"; fi
EOF
cat >"$tmp/bin/host" <<'EOF'
#!/bin/bash
set -eu
S=$SESSION_TEST
host=${0##*/}
if [ "$1" = plugin ]; then
  printf '%s %s\n' "$host" "$*" >>"$S/updates"
  if [ "${2:-}" = list ]; then
    jq -nc --arg p "$SESSION_PLUGIN" '[{id:"celetis@celetis",scope:"user",enabled:true,installPath:$p}]'
  fi
  exit 0
fi
if [ "$1" = app-server ]; then
  while IFS= read -r line; do
    method=$(printf '%s\n' "$line" | jq -r .method)
    id=$(printf '%s\n' "$line" | jq -r .id)
    case $method in
      initialize) printf '{"id":%s,"result":{}}\n' "$id" ;;
      initialized) ;;
      config/read)
        if [ -f "$S/config-invalid" ]; then printf '{"id":%s,"result":{"config":{"developer_instructions":7}}}\n' "$id"
        else jq -nc --argjson id "$id" --rawfile instructions "$S/developer" '{id:$id,result:{config:{developer_instructions:$instructions}}}'; fi ;;
      skills/list)
        [ ! -f "$S/replace-record" ] || cp "$S/replace-record" "$(git rev-parse --git-common-dir)/celetis-flow/sessions/7.json"
        jq -nc --argjson id "$id" --arg p "$SESSION_PLUGIN" --arg cwd "$PWD" \
          '{id:$id,result:{data:[{cwd:$cwd,skills:[{name:"celetis:guide",pluginId:"celetis@celetis",enabled:true,path:($p+"/skills/guide/SKILL.md")}]}]}}' ;;
      thread/turns/list)
        jq -nc --argjson id "$id" --arg saved "$(test -f "$S/saved" && echo yes || true)" \
          '{id:$id,result:{data:(if $saved == "yes" then [{id:"turn",status:"completed",items:[]}] else [] end)}}' ;;
      thread/read)
        cwd=$PWD
        [ ! -f "$S/foreign-checkout" ] || cwd=/other-checkout
        created=$(date +%s)
        [ ! -f "$S/old-session" ] || created=0
        jq -nc --argjson id "$id" --arg sid "$(cat "$S/id")" --arg cwd "$cwd" --argjson created "$created" '{id:$id,result:{thread:{id:$sid,cwd:$cwd,createdAt:$created,ephemeral:false}}}' ;;
      *) exit 82 ;;
    esac
  done
  exit 0
fi
jq -nc --arg h "$host" --arg cwd "$PWD" --args '{host:$h,cwd:$cwd,args:$ARGS.positional}' -- "$@" >>"$S/calls"
IFS= read -r typed || typed=
printf '%s\n' "$typed" >>"$S/stdin"
if [ "$1" = resume ] || [ "$1" = --resume ]; then exit 0; fi
[ ! -f "$S/change-host" ] || git config celetis-flow.host "$(cat "$S/change-host")"
echo "$host" >"$S/host"
touch "$S/live"
if [ ! -f "$S/no-save" ]; then
  touch "$S/saved"
  mkdir -p "$CLAUDE_CONFIG_DIR/projects/fixture"
  cwd=$PWD
  [ ! -f "$S/foreign-checkout" ] || cwd=/other-checkout
  timestamp=$(date -u +%Y-%m-%dT%H:%M:%SZ)
  [ ! -f "$S/old-session" ] || timestamp=2000-01-01T00:00:00Z
  jq -nc --arg id "$(cat "$S/id")" --arg cwd "$cwd" --arg timestamp "$timestamp" '{type:"user",sessionId:$id,cwd:$cwd,timestamp:$timestamp,message:{role:"user",content:"fixture"}}' >"$CLAUDE_CONFIG_DIR/projects/fixture/$(cat "$S/id").jsonl"
fi
if [ -n "${HERDR_PANE_ID:-}" ]; then
  count=0
  until jq -e '.session_id != null' "$(git rev-parse --git-common-dir)/celetis-flow/sessions/7.json" >/dev/null 2>&1 || [ "$count" -ge 40 ]; do count=$((count + 1)); /bin/sleep 0.05; done
  /bin/sleep 0.15
fi
[ ! -f "$S/advance" ] || touch "$S/progress"
rm -f "$S/live"
exit "$(cat "$S/exit" 2>/dev/null || echo 0)"
EOF
cp "$tmp/bin/host" "$tmp/bin/claude"
cp "$tmp/bin/host" "$tmp/bin/codex"
cat >"$tmp/bin/herdr" <<'EOF'
#!/bin/bash
S=$SESSION_TEST
printf '%s\n' "$*" >>"$S/herdr-calls"
case "$1 $2" in
  'tab rename') ;;
  'agent get')
    if [ -f "$S/prior-host" ] && [ ! -f "$S/prior-reported" ]; then
      if [ -f "$S/prior-seen" ]; then touch "$S/prior-reported"; else touch "$S/prior-seen"; fi
      jq -nc --arg h "$(cat "$S/prior-host")" --arg id "$(cat "$S/prior-id")" '{result:{agent:{agent:$h,interactive_ready:true,agent_session:{agent:$h,kind:"id",value:$id}}}}'
      exit 0
    fi
    if [ ! -f "$S/live" ]; then
      [ -f "$S/prior-id" ] || exit 1
      jq -nc --arg h "$CELETIS_HOST" --arg id "$(cat "$S/prior-id")" '{result:{agent:{agent:$h,interactive_ready:true,agent_session:{agent:$h,kind:"id",value:$id}}}}'
      exit 0
    fi
    touch "$S/observed"
    [ ! -f "$S/bad-json" ] || { echo broken; exit 0; }
    jq -nc --arg h "$(cat "$S/host")" --arg id "$(cat "$S/id")" --arg ready "$(test -f "$S/not-ready" && echo no || echo yes)" --arg cwd "$PWD" \
      '{result:{agent:{agent:$h,interactive_ready:($ready == "yes"),agent_status:"idle",cwd:$cwd,agent_session:(if $id == "" then null else {agent:$h,kind:"id",value:$id} end)}}}' ;;
  'agent wait')
    while [ -f "$S/live" ]; do /bin/sleep 0.05; done
    exit 1 ;;
  'pane read') echo 'Update, trust, or sign-in action is required.' ;;
  *) exit 1 ;;
esac
EOF
printf '#!/bin/bash\nexit 0\n' >"$tmp/bin/gh"
chmod +x "$tmp/bin/"* "$plugin/scripts/next-step.sh"
for command in bash jq git dirname mkdir cat mktemp mkfifo rm sleep mv; do ln -s "$(command -v "$command")" "$tmp/codex-only/$command"; done
ln -s "$tmp/bin/codex" "$tmp/codex-only/codex"
export PATH="$tmp/bin:$PATH"
git init -q "$repo"
git -C "$repo" add .
git -C "$repo" commit -qm fixture
repo=$(cd "$repo" && pwd -P)
common=$(git -C "$repo" rev-parse --path-format=absolute --git-common-dir)
record="$common/celetis-flow/sessions/7.json"
uuid=01a139fc-2ffa-74c0-9b14-e35e23339910
fail() { printf 'FAIL: %s\n' "$1"; exit 1; }
reset() {
  rm -rf "$S" "$common/celetis-flow" "$CLAUDE_CONFIG_DIR"
  mkdir -p "$S"
  echo plan >"$S/step"
  echo "$uuid" >"$S/id"
  : >"$S/developer"
  unset HERDR_ENV HERDR_PANE_ID HERDR_TAB_ID
}
run() {
  code=0
  (cd "$repo" && PATH="${test_path:-$PATH}" CELETIS_HOST="${test_host:-claude}" "$BASH" "$plugin/scripts/celetis-flow.sh" "$@" < <(printf 'terminal input\n')) >"$tmp/out" 2>"$tmp/err" || code=$?
  out=$(cat "$tmp/out"); err=$(cat "$tmp/err")
}
for host in claude codex; do
  reset
  other=codex; [ "$host" != codex ] || other=claude
  echo "$other" >"$S/prior-host"
  echo 00000000-0000-4000-8000-000000000001 >"$S/prior-id"
  export HERDR_ENV=1 HERDR_PANE_ID=w1:p1
  test_host=$host run 7
  [ "$code" -eq 0 ] && [ -z "$err" ] && jq -e --arg h "$host" --arg id "$uuid" '.host == $h and .session_id == $id' "$record" >/dev/null || fail "$host did not start after the prior $other report: $code [$err]"
  : >"$S/calls"
  test_host=$other run --resume 7
  [ "$code" -eq 0 ] && jq -e --arg h "$host" --arg id "$uuid" '.host == $h and .args[-1] == $id' "$S/calls" >/dev/null || fail "$host resumed the prior $other session"
done
for replacement in '.host="claude"' '.session_id="00000000-0000-4000-8000-000000000001"'; do
  reset
  mkdir -p "${record%/*}"
  jq -nc --arg cwd "$repo" --arg id "$uuid" '{schema:1,host:"codex",issue:7,step:"plan",checkout:$cwd,session_id:$id}' >"$record"
  jq "$replacement" "$record" >"$S/replace-record"
  code=0
  (cd "$repo" && scripts/celetis --host codex celetis-flow --resume 7) >"$tmp/out" 2>"$tmp/err" || code=$?
  [ "$code" -ne 0 ] && [ ! -e "$S/calls" ] || fail "a resume record changed during package discovery: $replacement"
done
for host in claude codex; do
  reset
  touch "$S/old-session"
  export HERDR_ENV=1 HERDR_PANE_ID=w1:p1
  test_host=$host run 7
  [ "$code" -ne 0 ] && jq -e '.session_id == null' "$record" >/dev/null || fail "$host accepted an older saved turn that herdr first reported after launch"
done
for host in claude codex; do
  for step in triage feature bug chore hotfix plan implement; do
    reset
    echo "$step" >"$S/step"
    test_host=$host run 7
    [ "$code" -eq 0 ] || fail "$host $step: $code [$err]"
    [ "$(jq -r .host "$S/calls")" = "$host" ] || fail "$host $step used the wrong host"
    [ "$(cat "$S/stdin")" = 'terminal input' ] || fail "$host $step lost terminal stdin"
    if [ "$host" = claude ]; then
      jq -e --arg p "/celetis:$step #7" '.args[-1] == $p and .args[0:2] == ["--permission-mode","auto"]' "$S/calls" >/dev/null || fail "Claude launch arguments"
      if [ "$step" = feature ]; then
        jq -e '.args == ["--permission-mode","auto","-n","#7 specify","/celetis:feature #7"]' "$S/calls" >/dev/null || fail "Claude specify has step text"
      else
        jq -e --arg p "$plugin/step-prompt.md" '.args[4:6] == ["--append-system-prompt-file",$p]' "$S/calls" >/dev/null || fail "Claude step file"
      fi
    else
      jq -e --arg p "Use the celetis:$step skill for #7" '.args[-1] == $p' "$S/calls" >/dev/null || fail "Codex skill prompt"
      if [ "$step" = feature ]; then
        jq -e '.args | length == 1' "$S/calls" >/dev/null || fail "Codex specify has step text"
      else
        jq -e --rawfile text "$plugin/step-prompt.md" '.args[0] == "-c" and (.args[1] | sub("^developer_instructions=";"") | fromjson) == $text and (.args | length == 3)' "$S/calls" >/dev/null || fail "Codex lost literal developer instructions"
      fi
    fi
    [ ! -e "$S/substitution" ] && [ ! -e "$S/backticks" ] || fail "step text executed as shell code"
    jq -e --arg h "$host" --arg step "${step/feature/specify}" --arg cwd "$repo" '.schema == 1 and .host == $h and .issue == 7 and .step == $step and .checkout == $cwd and .session_id == null' "$record" >/dev/null || fail "the start record is missing or wrong"
  done
done

reset
printf 'Keep my instructions and literal $(value).\n\n' >"$S/developer"
test_host=codex run 7
[ "$code" -eq 0 ] && jq -e --rawfile existing "$S/developer" --rawfile step "$plugin/step-prompt.md" '(.args[1] | sub("^developer_instructions=";"") | fromjson) == ($existing + "\n\n" + $step)' "$S/calls" >/dev/null || fail "Codex replaced the existing developer instructions"

for host in claude codex; do
  for step in triage feature bug chore hotfix plan implement; do
    reset
    echo "$step" >"$S/step"
    export HERDR_ENV=1 HERDR_PANE_ID=w1:p1
    test_host=$host run 7
    [ "$code" -eq 0 ] && jq -e --arg id "$uuid" '.session_id == $id' "$record" >/dev/null || fail "$host did not save the reported identity: $code [$err]"
    : >"$S/calls"; : >"$S/herdr-calls"; : >"$S/updates"
    other=codex; [ "$host" != codex ] || other=claude
    test_host=$other run --resume 7
    [ "$code" -eq 0 ] || fail "$host exact resume: $code [$err]"
    jq -e --arg h "$host" --arg id "$uuid" --arg cwd "$repo" '.host == $h and .cwd == $cwd and .args == [(if $h == "codex" then "resume" else "--resume" end),$id]' "$S/calls" >/dev/null || fail "resume used the wrong host or identity"
    [ ! -s "$S/herdr-calls" ] && [ ! -s "$S/updates" ] || fail "resume started a watcher or update"
  done
done

reset
export HERDR_ENV=1 HERDR_PANE_ID=w1:p1
test_host=codex run 7
unset HERDR_ENV HERDR_PANE_ID
for default in claude codex; do
  : >"$S/calls"
  code=0
  (cd "$repo" && unset CELETIS_HOST && PATH="$tmp/codex-only" GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=celetis-flow.host GIT_CONFIG_VALUE_0="$default" scripts/celetis celetis-flow --resume 7 < <(printf 'terminal input\n')) >"$tmp/out" 2>"$tmp/err" || code=$?
  [ "$code" -eq 0 ] && jq -e --arg id "$uuid" '.host == "codex" and .args == ["resume",$id]' "$S/calls" >/dev/null || fail "copied launcher resume with $default default and no Claude: $code [$(cat "$tmp/err")]"
done
code=0
(cd "$repo" && scripts/celetis --host claude celetis-flow --resume 7) >"$tmp/out" 2>"$tmp/err" || code=$?
[ "$code" -ne 0 ] && [[ $(cat "$tmp/err") == *'recorded host is codex'* ]] || fail "an explicit host request switched a saved session"

cp "$record" "$tmp/valid-record"
for expression in '.schema=0' '.host="other"' '.step="feature"' '.issue=8' '.issue="7"' '.checkout="/other"' '.session_id="--last"' '.session_id=7' '.extra=true' 'del(.schema)'; do
  jq "$expression" "$tmp/valid-record" >"$record"
  run --resume 7
  [ "$code" -ne 0 ] && [[ $err == *'invalid or obsolete session record'* ]] || fail "bad record accepted: $expression [$err]"
done
for invalid in '{"schema":0}' '{}' '[]' 'invalid' '{"schema":1,"host":"other"}' ; do
  printf '%s\n' "$invalid" >"$record"
  run --resume 7
  [ "$code" -ne 0 ] && [[ $err == *'invalid or obsolete session record'* ]] || fail "bad record accepted: $invalid [$err]"
done
reset
mkdir -p "$common/celetis-flow"
printf '7\trun /celetis:plan #7\n' >"$common/celetis-flow/no-progress"
run --resume 7
[ "$code" -ne 0 ] && [[ $err == *'no current session record'* ]] || fail "obsolete name-based resume was accepted"

for host in claude codex; do
  reset
  test_host=$host run 7
  test_host=$host run --resume 7
  [ "$code" -ne 0 ] && [[ $err == *'herdr identity'* ]] && [[ $err == *"$host"*'resume'* ]] || fail "$host recovery without herdr: $code [$err]"
  for failure in no-id bad-id no-save not-ready bad-json foreign-checkout stale-id; do
    reset
    case $failure in
      no-id) : >"$S/id" ;;
      bad-id) echo --last >"$S/id" ;;
      stale-id) cp "$S/id" "$S/prior-id" ;;
      *) touch "$S/$failure" ;;
    esac
    export HERDR_ENV=1 HERDR_PANE_ID=w1:p1
    test_host=$host run 7
    [ "$code" -ne 0 ] && [ ! -e "$common/celetis-flow/no-progress" ] || fail "$host $failure became false no progress: $code [$out] [$err]"
    [[ $err == *'startup'* ]] && [[ $err == *'Update, trust, or sign-in'* ]] || fail "$host $failure lacks startup output: [$err]"
    test_host=$host run --resume 7
    [ "$code" -ne 0 ] || fail "$host $failure was resumable"
  done
  reset
  echo 00000000-0000-4000-8000-000000000001 >"$S/prior-id"
  export HERDR_ENV=1 HERDR_PANE_ID=w1:p1
  test_host=$host run 7
  [ "$code" -eq 0 ] && jq -e --arg id "$uuid" '.session_id == $id' "$record" >/dev/null || fail "$host did not replace the old pane identity"
done

reset
touch "$S/config-invalid"
test_host=codex run 7
[ "$code" -ne 0 ] && [ ! -e "$S/calls" ] && [ ! -e "$record" ] || fail "an invalid effective instruction value started a session"

for host in claude codex; do
  reset
  echo 1 >"$S/exit"
  test_host=$host run 7
  [ "$code" -ne 0 ] && [ ! -e "$common/celetis-flow/no-progress" ] || fail "$host startup exit became no progress outside herdr"

  reset
  export HERDR_PANE_ID=w1:p1
  test_host=$host run 7
  [ "$code" -eq 0 ] && [ ! -e "$S/herdr-calls" ] && jq -e '.session_id == null' "$record" >/dev/null || fail "$host controlled herdr outside its environment"
done
reset
export HERDR_ENV=1 HERDR_PANE_ID=invalid
run 7
[ "$code" -ne 0 ] && [ ! -e "$S/herdr-calls" ] && [ ! -e "$S/calls" ] || fail "a bad pane ID started herdr control"

for host in claude codex; do
  reset
  other=codex; [ "$host" != codex ] || other=claude
  echo "$other" >"$S/change-host"
  git -C "$repo" config celetis-flow.host "$host"
  code=0
  (cd "$repo" && unset CELETIS_HOST && GIT_CONFIG_COUNT=0 scripts/celetis celetis-flow 7 < <(printf 'terminal input\n')) >"$tmp/out" 2>"$tmp/err" || code=$?
  [ "$code" -eq 0 ] && jq -e --arg h "$host" '.host == $h' "$S/calls" >/dev/null && jq -e --arg h "$host" '.host == $h' "$record" >/dev/null || fail "the current project default did not select and retain $host: $code [$(cat "$tmp/err")]"
done
echo 'PASS: host launch and exact resume'
