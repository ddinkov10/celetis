#!/usr/bin/env bash
set -euo pipefail
root=$(cd "$(dirname "$0")/.." && pwd)
. "$root/tests/lib/pool.sh"
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
export CELETIS_TEST_HERDR_FIXTURES="$root/tests/fixtures/herdr"
export GIT_AUTHOR_NAME=t GIT_AUTHOR_EMAIL=t@t GIT_COMMITTER_NAME=t GIT_COMMITTER_EMAIL=t@t
unset HERDR_ENV HERDR_PANE_ID HERDR_TAB_ID CELETIS_AGENT
plugin="$tmp/installed package"
template="$tmp/product checkout"
mkdir -p "$plugin" "$template/scripts" "$tmp/bin" "$tmp/codex-only"
cp -R "$root/scripts" "$root/.claude-plugin" "$plugin/"
mkdir -p "$plugin/skills/guide"
echo fixture >"$plugin/skills/guide/SKILL.md"
cat >"$plugin/step-prompt.md" <<'EOF'
Keep "quotes", 'quotes', \slashes, tabs:	and Unicode: →.
$(touch "$SESSION_TEST/substitution") `touch "$SESSION_TEST/backticks"`

EOF
cp "$root/scripts/celetis" "$template/scripts/celetis"
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
        sid=$(cat "$S/id")
        [ ! -f "$S/wrong-saved-id" ] || sid=00000000-0000-4000-8000-000000000002
        jq -nc --argjson id "$id" --arg sid "$sid" --arg cwd "$cwd" --argjson created "$(cat "$S/created")" \
          --argjson ephemeral "$(test -f "$S/ephemeral" && echo true || echo false)" \
          '{id:$id,result:{thread:{id:$sid,cwd:$cwd,createdAt:$created,ephemeral:$ephemeral}}}' ;;
      *) exit 82 ;;
    esac
  done
  exit 0
fi
jq -nc --arg h "$host" --arg cwd "$PWD" --args '{host:$h,cwd:$cwd,args:$ARGS.positional}' -- "$@" >>"$S/calls"
IFS= read -r typed || typed=
printf '%s\n' "$typed" >>"$S/stdin"
if [ "$1" = resume ] || [ "$1" = --resume ]; then exit 0; fi
[ ! -f "$S/change-host" ] || printf 'landing: merge\nhost: %s\n' "$(cat "$S/change-host")" >.celetis.yaml
created=$(date +%s)
[ ! -f "$S/old-session" ] || created=0
echo "$created" >"$S/created"
if [ ! -f "$S/no-save" ]; then
  touch "$S/saved"
  mkdir -p "$CLAUDE_CONFIG_DIR/projects/fixture"
  cwd=$PWD
  [ ! -f "$S/foreign-checkout" ] || cwd=/other-checkout
  timestamp=$(date -u +%Y-%m-%dT%H:%M:%SZ)
  [ ! -f "$S/old-session" ] || timestamp=2000-01-01T00:00:00Z
  jq -nc --arg id "$(cat "$S/id")" --arg cwd "$cwd" --arg timestamp "$timestamp" '{type:"user",sessionId:$id,cwd:$cwd,timestamp:$timestamp,message:{role:"user",content:"fixture"}}' >"$CLAUDE_CONFIG_DIR/projects/fixture/$(cat "$S/id").jsonl"
fi
touch "$S/live"
if [ "${HERDR_ENV:-}" = 1 ]; then
  count=0
  until [ -f "$S/settled" ] || [ "$count" -ge 200 ]; do count=$((count + 1)); /bin/sleep 0.05; done
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
    host=$CELETIS_AGENT
    id=$(cat "$S/id")
    status=$(cat "$S/status")
    if [ -f "$S/prior-host" ] && [ ! -f "$S/prior-reported" ]; then
      if [ -f "$S/prior-seen" ]; then touch "$S/prior-reported"; else touch "$S/prior-seen"; fi
      host=$(cat "$S/prior-host")
      id=$(cat "$S/prior-id")
      status=done
    elif [ ! -f "$S/live" ]; then
      [ -f "$S/prior-id" ] || exit 1
      id=$(cat "$S/prior-id")
      status=done
    else
      [ ! -f "$S/observed" ] || touch "$S/settled"
      touch "$S/observed"
      [ ! -f "$S/bad-json" ] || { echo broken; exit 0; }
    fi
    jq -c --arg id "$id" --arg status "$status" --arg cwd "$PWD" --arg pane "$HERDR_PANE_ID" '
      .result.agent |= (.agent_status = $status | .cwd = $cwd | .foreground_cwd = $cwd | .pane_id = $pane
        | .agent_session = (if $id == "" then null else (.agent_session | .value = $id) end))
    ' "$CELETIS_TEST_HERDR_FIXTURES/$host.json" | jq "$(cat "$S/herdr-filter")" ;;
  'agent wait')
    touch "$S/settled"
    while [ -f "$S/live" ]; do /bin/sleep 0.05; done
    exit 1 ;;
  'pane read')
    touch "$S/settled"
    echo 'Update, trust, or sign-in action is required.' ;;
  *) exit 1 ;;
esac
EOF
printf '#!/bin/bash\nexit 0\n' >"$tmp/bin/gh"
printf '#!/bin/bash\nexec /bin/sleep 0.05\n' >"$tmp/bin/sleep"
chmod +x "$tmp/bin/"* "$plugin/scripts/next-step.sh"
for command in bash jq yq git dirname mkdir cat mktemp mkfifo rm mv ps touch perl date; do ln -s "$(command -v "$command")" "$tmp/codex-only/$command"; done
for command in codex gh sleep; do ln -s "$tmp/bin/$command" "$tmp/codex-only/$command"; done
export PATH="$tmp/bin:$PATH"
git init -q "$template"
printf 'landing: merge\n' >"$template/.celetis.yaml"
git -C "$template" add .
git -C "$template" commit -qm fixture
uuid=01a139fc-2ffa-74c0-9b14-e35e23339910
fail() { printf 'FAIL: %s\n' "$1"; exit 1; }
reset() {
  rm -rf "$S" "$common/celetis-flow" "$CLAUDE_CONFIG_DIR"
  mkdir -p "$S"
  echo plan >"$S/step"
  echo "$uuid" >"$S/id"
  echo idle >"$S/status"
  echo . >"$S/herdr-filter"
  : >"$S/developer"
  unset HERDR_ENV HERDR_PANE_ID HERDR_TAB_ID
}
new_case() {
  dir=$(mktemp -d "$tmp/case.XXXXXX")
  export SESSION_TEST="$dir/state" CLAUDE_CONFIG_DIR="$dir/claude" CODEX_HOME="$dir/codex"
  S=$SESSION_TEST
  cp -R "$template" "$dir/product checkout"
  repo=$(cd "$dir/product checkout" && pwd -P)
  common=$(git -C "$repo" rev-parse --path-format=absolute --git-common-dir)
  record="$common/celetis-flow/sessions/7.json"
  reset
}
run() {
  code=0
  (cd "$repo" && PATH="${test_path:-$PATH}" CELETIS_AGENT="${test_host:-claude}" "$BASH" "$plugin/scripts/celetis-flow.sh" "$@" < <(printf 'terminal input\n')) >"$dir/out" 2>"$dir/err" || code=$?
  out=$(cat "$dir/out"); err=$(cat "$dir/err")
}
other_of() { if [ "$1" = codex ]; then echo claude; else echo codex; fi; }

saved_status() {
  local host=$1 status=$2
  new_case
  echo "$status" >"$S/status"
  export HERDR_ENV=1 HERDR_PANE_ID=wW:pE
  test_host=$host run 7
  [ "$code" -eq 0 ] && [ -z "$err" ] && jq -e --arg h "$host" --arg id "$uuid" '.host == $h and .session_id == $id' "$record" >/dev/null || fail "$host did not save the current $status session: $code [$err]"
  : >"$S/calls"
  test_host=$host run --resume 7
  [ "$code" -eq 0 ] && jq -e --arg h "$host" --arg id "$uuid" '.host == $h and .args[-1] == $id' "$S/calls" >/dev/null || fail "$host could not resume the saved $status session"
}

valid_pane() {
  local host=$1 pane=$2
  new_case
  export HERDR_ENV=1 HERDR_PANE_ID="$pane"
  test_host=$host run 7
  [ "$code" -eq 0 ] && [ -z "$err" ] || fail "$host rejected $pane: $code [$err]"
  jq -e --arg h "$host" '.host == $h' "$S/calls" >/dev/null || fail "$host did not launch for $pane"
  jq -e --arg h "$host" --arg id "$uuid" '.host == $h and .session_id == $id' "$record" >/dev/null || fail "$host lost the saved identity for $pane"
  [[ $(cat "$S/herdr-calls") == *"agent get $pane"* ]] || fail "$host changed $pane"
}

prior_host() {
  local host=$1 other
  other=$(other_of "$host")
  new_case
  echo "$other" >"$S/prior-host"
  echo 00000000-0000-4000-8000-000000000001 >"$S/prior-id"
  export HERDR_ENV=1 HERDR_PANE_ID=w1:p1
  test_host=$host run 7
  [ "$code" -eq 0 ] && [ -z "$err" ] && jq -e --arg h "$host" --arg id "$uuid" '.host == $h and .session_id == $id' "$record" >/dev/null || fail "$host did not start after the prior $other report: $code [$err]"
  : >"$S/calls"
  test_host=$other run --resume 7
  [ "$code" -eq 0 ] && jq -e --arg h "$host" --arg id "$uuid" '.host == $h and .args[-1] == $id' "$S/calls" >/dev/null || fail "$host resumed the prior $other session"
}

codex_only() {
  new_case
  test_host=codex test_path="$tmp/codex-only" run 7
  [ "$code" -eq 0 ] && jq -e '.host == "codex"' "$S/calls" >/dev/null || fail "Codex-only refresh and launch required Claude: $code [$err]"
}

replaced_record() {
  local replacement=$1
  new_case
  mkdir -p "${record%/*}"
  jq -nc --arg cwd "$repo" --arg id "$uuid" '{schema:1,host:"codex",issue:7,step:"plan",checkout:$cwd,session_id:$id}' >"$record"
  jq "$replacement" "$record" >"$S/replace-record"
  code=0
  (cd "$repo" && scripts/celetis --agent codex celetis-flow --resume 7) >"$dir/out" 2>"$dir/err" || code=$?
  [ "$code" -ne 0 ] && [ ! -e "$S/calls" ] || fail "a resume record changed during package discovery: $replacement"
}

old_session() {
  local host=$1
  new_case
  touch "$S/old-session"
  export HERDR_ENV=1 HERDR_PANE_ID=w1:p1
  test_host=$host run 7
  [ "$code" -ne 0 ] && jq -e '.session_id == null' "$record" >/dev/null || fail "$host accepted an older saved turn that herdr first reported after launch"
}

launch() {
  local host=$1 step=$2
  new_case
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
    jq -e --arg p "Use the celetis:$step skill for #7. Complete its Host entry startup reads before any response, including commentary." '.args[-1] == $p and .args[0] == "--no-daemon"' "$S/calls" >/dev/null || fail "Codex skill prompt or foreground mode"
    if [ "$step" = feature ]; then
      jq -e '.args | length == 2' "$S/calls" >/dev/null || fail "Codex specify has step text"
    else
      jq -e --rawfile text "$plugin/step-prompt.md" '.args[1] == "-c" and (.args[2] | sub("^developer_instructions=";"") | fromjson) == $text and (.args | length == 4)' "$S/calls" >/dev/null || fail "Codex lost literal developer instructions"
    fi
  fi
  [ ! -e "$S/substitution" ] && [ ! -e "$S/backticks" ] || fail "step text executed as shell code"
  jq -e --arg h "$host" --arg step "${step/feature/specify}" --arg cwd "$repo" '.schema == 1 and .host == $h and .issue == 7 and .step == $step and .checkout == $cwd and .session_id == null' "$record" >/dev/null || fail "the start record is missing or wrong"
}

existing_developer() {
  new_case
  printf 'Keep my instructions and literal $(value).\n\n' >"$S/developer"
  test_host=codex run 7
  [ "$code" -eq 0 ] && jq -e --rawfile existing "$S/developer" --rawfile step "$plugin/step-prompt.md" '(.args[2] | sub("^developer_instructions=";"") | fromjson) == ($existing + "\n\n" + $step)' "$S/calls" >/dev/null || fail "Codex replaced the existing developer instructions"
}

exact_resume() {
  local host=$1 step=$2 other
  other=$(other_of "$host")
  new_case
  echo "$step" >"$S/step"
  export HERDR_ENV=1 HERDR_PANE_ID=w1:p1
  test_host=$host run 7
  [ "$code" -eq 0 ] && jq -e --arg id "$uuid" '.session_id == $id' "$record" >/dev/null || fail "$host did not save the reported identity: $code [$err]"
  : >"$S/calls"; : >"$S/herdr-calls"; : >"$S/updates"
  test_host=$other run --resume 7
  [ "$code" -eq 0 ] || fail "$host exact resume: $code [$err]"
  jq -e --arg h "$host" --arg id "$uuid" --arg cwd "$repo" '.host == $h and .cwd == $cwd and .args == (if $h == "codex" then ["resume","--no-daemon",$id] else ["--resume",$id] end)' "$S/calls" >/dev/null || fail "resume used the wrong host, mode or identity"
  [ ! -s "$S/herdr-calls" ] && [ ! -s "$S/updates" ] || fail "resume started a watcher or update"
}

saved_codex_session() {
  new_case
  export HERDR_ENV=1 HERDR_PANE_ID=w1:p1
  test_host=codex run 7
  unset HERDR_ENV HERDR_PANE_ID
  jq -e --arg id "$uuid" '.host == "codex" and .session_id == $id' "$record" >/dev/null || fail "Codex did not save the reported identity: $code [$err]"
}

launcher_resume() {
  local default
  saved_codex_session
  for default in claude codex; do
    printf 'landing: merge\nhost: %s\n' "$default" >"$repo/.celetis.yaml"
    : >"$S/calls"
    code=0
    (cd "$repo" && unset CELETIS_AGENT && PATH="$tmp/codex-only" GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=celetis-flow.agent GIT_CONFIG_VALUE_0="$default" scripts/celetis celetis-flow --resume 7 < <(printf 'terminal input\n')) >"$dir/out" 2>"$dir/err" || code=$?
    [ "$code" -eq 0 ] && jq -e --arg id "$uuid" '.host == "codex" and .args == ["resume","--no-daemon",$id]' "$S/calls" >/dev/null || fail "copied launcher resume with $default default and no Claude: $code [$(cat "$dir/err")]"
  done
  printf 'landing: merge\nhost: claude\n' >"$repo/.celetis.yaml"
  code=0
  (cd "$repo" && scripts/celetis --agent claude celetis-flow --resume 7) >"$dir/out" 2>"$dir/err" || code=$?
  [ "$code" -ne 0 ] && [[ $(cat "$dir/err") == *'recorded host is codex'* ]] || fail "an explicit host request switched a saved session"
}

bad_records() {
  local expression invalid
  saved_codex_session
  cp "$record" "$dir/valid-record"
  for expression in '.schema=0' '.host="other"' '.step="feature"' '.issue=8' '.issue="7"' '.checkout="/other"' '.session_id="--last"' '.session_id=7' '.extra=true' 'del(.schema)'; do
    jq "$expression" "$dir/valid-record" >"$record"
    run --resume 7
    [ "$code" -ne 0 ] && [[ $err == *'invalid or obsolete session record'* ]] || fail "bad record accepted: $expression [$err]"
  done
  for invalid in '{"schema":0}' '{}' '[]' 'invalid' '{"schema":1,"host":"other"}' ; do
    printf '%s\n' "$invalid" >"$record"
    run --resume 7
    [ "$code" -ne 0 ] && [[ $err == *'invalid or obsolete session record'* ]] || fail "bad record accepted: $invalid [$err]"
  done
}

name_based_resume() {
  new_case
  mkdir -p "$common/celetis-flow"
  printf '7\trun /celetis:plan #7\n' >"$common/celetis-flow/no-progress"
  run --resume 7
  [ "$code" -ne 0 ] && [[ $err == *'no current session record'* ]] || fail "obsolete name-based resume was accepted"
}

recovery() {
  local host=$1
  new_case
  test_host=$host run 7
  test_host=$host run --resume 7
  [ "$code" -ne 0 ] && [[ $err == *'herdr identity'* ]] && [[ $err == *"$host"*'resume'* ]] || fail "$host recovery without herdr: $code [$err]"
}

identity_failure() {
  local host=$1 failure=$2 other
  new_case
  case $failure in
    no-id) : >"$S/id" ;;
    bad-id) echo --last >"$S/id" ;;
    stale-id) cp "$S/id" "$S/prior-id" ;;
    unsaved-*) echo "${failure#unsaved-}" >"$S/status"; touch "$S/no-save" ;;
    wrong-host)
      other=$(other_of "$host")
      printf '.result.agent |= (.agent="%s" | .agent_session.agent="%s")\n' "$other" "$other" >"$S/herdr-filter" ;;
    wrong-session-host) echo '.result.agent.agent_session.agent="other"' >"$S/herdr-filter" ;;
    wrong-kind) echo '.result.agent.agent_session.kind="name"' >"$S/herdr-filter" ;;
    malformed-identity) echo '.result.agent.agent_session="invalid"' >"$S/herdr-filter" ;;
    missing-status) echo 'del(.result.agent.agent_status)' >"$S/herdr-filter" ;;
    invalid-status) echo '.result.agent.agent_status="ready"' >"$S/herdr-filter" ;;
    *) touch "$S/$failure" ;;
  esac
  export HERDR_ENV=1 HERDR_PANE_ID=w1:p1
  test_host=$host run 7
  [ "$code" -ne 0 ] && [ ! -e "$common/celetis-flow/no-progress" ] || fail "$host $failure became false no progress: $code [$out] [$err]"
  [[ $err == *'startup'* ]] && [[ $err == *'Update, trust, or sign-in'* ]] || fail "$host $failure lacks startup output: [$err]"
  test_host=$host run --resume 7
  [ "$code" -ne 0 ] || fail "$host $failure was resumable"
}

old_pane_identity() {
  local host=$1
  new_case
  echo 00000000-0000-4000-8000-000000000001 >"$S/prior-id"
  export HERDR_ENV=1 HERDR_PANE_ID=w1:p1
  test_host=$host run 7
  [ "$code" -eq 0 ] && jq -e --arg id "$uuid" '.session_id == $id' "$record" >/dev/null || fail "$host did not replace the old pane identity"
}

codex_persistence() {
  local failure=$1
  new_case
  touch "$S/$failure"
  export HERDR_ENV=1 HERDR_PANE_ID=w1:p1
  test_host=codex run 7
  [ "$code" -ne 0 ] && jq -e '.session_id == null' "$record" >/dev/null || fail "Codex accepted $failure persistence"
}

invalid_config() {
  new_case
  touch "$S/config-invalid"
  test_host=codex run 7
  [ "$code" -ne 0 ] && [ ! -e "$S/calls" ] && [ ! -e "$record" ] || fail "an invalid effective instruction value started a session"
}

startup_exit() {
  local host=$1
  new_case
  echo 1 >"$S/exit"
  test_host=$host run 7
  [ "$code" -ne 0 ] && [ ! -e "$common/celetis-flow/no-progress" ] || fail "$host startup exit became no progress outside herdr"
}

outside_herdr() {
  local host=$1 environment=$2
  new_case
  [ "$environment" = unset ] || export HERDR_ENV="$environment"
  export HERDR_PANE_ID=wW:pE
  test_host=$host run 7
  [ "$code" -eq 0 ] && [ ! -e "$S/herdr-calls" ] && jq -e --arg h "$host" '.host == $h' "$S/calls" >/dev/null && jq -e '.session_id == null' "$record" >/dev/null || fail "$host controlled herdr outside its environment: $environment"
}

invalid_panes() {
  local host=$1 pane
  new_case
  for pane in '' invalid w:p1 w1:p w1:t1 w1:p1:extra -w1:p1 ' w1:p1' 'w1:p1 ' 'w1:p1/x' $'w1:p1\n' $'w1:p1\t'; do
    reset
    export HERDR_ENV=1 HERDR_PANE_ID="$pane"
    test_host=$host run 7
    [ "$code" -eq 1 ] && [[ $err == *'HERDR_ENV=1 needs a valid HERDR_PANE_ID; start from a herdr pane'* ]] || fail "$host accepted an invalid pane: [$err]"
    [ ! -e "$S/herdr-calls" ] && [ ! -e "$S/calls" ] && [ ! -e "$S/updates" ] || fail "$host acted before pane validation"
  done
  reset
  export HERDR_ENV=1
  test_host=$host run 7
  [ "$code" -eq 1 ] && [[ $err == *'HERDR_ENV=1 needs a valid HERDR_PANE_ID; start from a herdr pane'* ]] || fail "$host accepted an unset pane: [$err]"
  [ ! -e "$S/herdr-calls" ] && [ ! -e "$S/calls" ] && [ ! -e "$S/updates" ] || fail "$host acted before unset pane validation"
}

project_default() {
  local host=$1 other
  other=$(other_of "$host")
  new_case
  echo "$other" >"$S/change-host"
  printf 'landing: merge\nhost: %s\n' "$host" >"$repo/.celetis.yaml"
  git -C "$repo" config celetis-flow.host "$other"
  git -C "$repo" config celetis-flow.agent "$other"
  export HERDR_ENV=1 HERDR_PANE_ID=w1:p1
  code=0
  (cd "$repo" && unset CELETIS_AGENT && GIT_CONFIG_COUNT=0 scripts/celetis celetis-flow 7 < <(printf 'terminal input\n')) >"$dir/out" 2>"$dir/err" || code=$?
  [ "$code" -eq 0 ] && jq -e --arg h "$host" '.host == $h' "$S/calls" >/dev/null && jq -e --arg h "$host" '.host == $h' "$record" >/dev/null || fail "the current project default did not select and retain $host: $code [$(cat "$dir/err")]"
  [ "$(yq -r .host "$repo/.celetis.yaml")" = "$other" ] || fail "the project preference did not change after $host started"
  unset HERDR_ENV HERDR_PANE_ID
  : >"$S/calls"
  code=0
  (cd "$repo" && unset CELETIS_AGENT && GIT_CONFIG_COUNT=0 scripts/celetis celetis-flow --resume 7 < <(printf 'terminal input\n')) >"$dir/out" 2>"$dir/err" || code=$?
  [ "$code" -eq 0 ] && jq -e --arg h "$host" --arg id "$uuid" '.host == $h and .args == (if $h == "codex" then ["resume","--no-daemon",$id] else ["--resume",$id] end)' "$S/calls" >/dev/null || fail "unprefixed resume switched the saved $host agent or UUID after the project preference changed: $code [$(cat "$dir/err")]"
  : >"$S/calls"
  code=0
  (cd "$repo" && scripts/celetis --agent "$other" celetis-flow --resume 7) >"$dir/out" 2>"$dir/err" || code=$?
  [ "$code" -ne 0 ] && [ ! -s "$S/calls" ] && [[ $(cat "$dir/err") == *"recorded host is $host"* ]] || fail "an explicit agent request switched the saved $host session"
}

for c in 'claude idle' 'claude working' 'claude unknown' 'codex done' 'codex blocked'; do pool_run "status $c" saved_status $c; done
for c in 'claude w1:p1' 'claude w1:pE' 'claude wa0:pz9' 'codex wW:p14' 'codex wW:pE'; do pool_run "pane $c" valid_pane $c; done
for host in claude codex; do
  pool_run "prior host $host" prior_host "$host"
  pool_run "old session $host" old_session "$host"
  pool_run "recovery $host" recovery "$host"
  pool_run "old pane identity $host" old_pane_identity "$host"
  pool_run "startup exit $host" startup_exit "$host"
  pool_run "invalid panes $host" invalid_panes "$host"
  pool_run "project default $host" project_default "$host"
  for environment in unset '' 0; do pool_run "outside herdr $host '$environment'" outside_herdr "$host" "$environment"; done
  for step in triage feature bug chore hotfix plan implement; do pool_run "launch $host $step" launch "$host" "$step"; done
  for failure in no-save unsaved-blocked unsaved-unknown foreign-checkout wrong-host; do pool_run "identity $host $failure" identity_failure "$host" "$failure"; done
done
for failure in no-id stale-id wrong-session-host malformed-identity invalid-status; do pool_run "identity claude $failure" identity_failure claude "$failure"; done
for failure in bad-id bad-json wrong-kind missing-status; do pool_run "identity codex $failure" identity_failure codex "$failure"; done
for step in triage bug hotfix implement; do pool_run "exact resume claude $step" exact_resume claude "$step"; done
for step in feature chore plan; do pool_run "exact resume codex $step" exact_resume codex "$step"; done
for replacement in '.host="claude"' '.session_id="00000000-0000-4000-8000-000000000001"'; do pool_run "replaced record $replacement" replaced_record "$replacement"; done
for failure in wrong-saved-id ephemeral; do pool_run "codex persistence $failure" codex_persistence "$failure"; done
pool_run "codex only" codex_only
pool_run "existing developer instructions" existing_developer
pool_run "launcher resume" launcher_resume
pool_run "bad records" bad_records
pool_run "name-based resume" name_based_resume
pool_run "invalid config" invalid_config
pool_wait
echo 'PASS: host launch and exact resume'
