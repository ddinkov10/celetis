#!/usr/bin/env bash
set -eu
here=$(cd "$(dirname "$0")" && pwd)
scorer="$here/../scripts/capscore.sh"
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
fails=0
git init -q "$tmp/project"
printf 'landing: merge\n' >"$tmp/project/.celetis.yaml"
unset CELETIS_AGENT CELETIS_HOST CAP_EFFORT_BIAS CAP_CURRENT_MODEL CAP_MODEL_PROFILE CAP_RUNTIME_MODELS OPENCODE GIT_CONFIG GIT_CONFIG_PARAMETERS

cat >"$tmp/profile.json" <<'JSON'
{"schema":1,"runtime":"fixture-desktop@1","slots":["small","standard","large","largest"],"reviewer":{"rank":1,"effort":"medium"}}
JSON
cat >"$tmp/models.json" <<'JSON'
{"schema":1,"runtime":"fixture-desktop@1","models":[
{"id":"small","efforts":["low","medium","high","xhigh","max"]},
{"id":"standard","efforts":["low","medium","high","xhigh","max"]},
{"id":"large","efforts":["low","medium","high","xhigh","max"]},
{"id":"largest","efforts":["low","medium","high","xhigh","max","ultra"]}]}
JSON
export CAP_MODEL_PROFILE="$tmp/profile.json" CAP_RUNTIME_MODELS="$tmp/models.json"
export GIT_CONFIG_NOSYSTEM=1 GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_COUNT=0

run_at() {
  local location=$1
  shift
  code=0
  out=$(cd "$location" && /bin/bash "$scorer" "$@" 2>"$tmp/err") || code=$?
  err=$(cat "$tmp/err")
}
run() { run_at "$tmp/project" "$@"; }
check() {
  local label=$1
  shift
  if "$@"; then printf 'ok   %s\n' "$label"; else
    printf 'FAIL %s\n  stdout: %s\n  stderr: %s\n  exit: %s\n' "$label" "$out" "$err" "$code"
    fails=$((fails + 1))
  fi
}
expect() { check "$1" test "$code:$out:$err" = "0:$2:"; }
json() { printf '%s\n' "$out" | jq -e "$1" >/dev/null 2>&1; }
error() {
  check "$1 exits with setup error and no result" test "$code:$out" = '2:'
  check "$1 explains the repair" test "${err#*"$2"}" != "$err"
}
codex_run() { run --agent codex "$@"; }
codex_at() {
  local location=$1
  shift
  run_at "$location" --agent codex "$@"
}
retry_sequence() {
  local label=$1 profile_path=$2 expected=$3 records= retry
  shift 3
  for retry in 1 2 3; do
    codex_run "$@" ${profile_path:+--profile "$profile_path"} --attempt "$retry" --json
    check "$label attempt $retry succeeds" test "$code:$err" = '0:'
    records=$records$out$'\n'
  done
  out=$(printf '%s' "$records" | jq -sc '[.[] | [.rank,.effort,.dispatch.rank,.dispatch.model,.dispatch.effort]]')
  check "$label portable scores and applied pairs" test "$out" = "$expected"
}

GIT_CONFIG=/dev/null GIT_CONFIG_COUNT=0 run 1 0 2 1 1 0
expect 'default Claude human CAP remains unchanged' 'CAP: J1 V0 B2 N1 S1 X0 = 5 +b2 → sonnet/xhigh'
GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=celetis-flow.host GIT_CONFIG_VALUE_0=codex run 1 0 2 1 1 0
expect 'obsolete Git host has no effect on scoring' 'CAP: J1 V0 B2 N1 S1 X0 = 5 +b2 → sonnet/xhigh'
GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=celetis-flow.agent GIT_CONFIG_VALUE_0=codex run 1 0 2 1 1 0
expect 'obsolete Git agent has no effect on scoring' 'CAP: J1 V0 B2 N1 S1 X0 = 5 +b2 → sonnet/xhigh'
CELETIS_HOST=codex run 1 0 2 1 1 0
expect 'obsolete host environment has no effect on scoring' 'CAP: J1 V0 B2 N1 S1 X0 = 5 +b2 → sonnet/xhigh'
run --host codex 1 0 2 1 1 0
check 'obsolete scorer option is rejected' test "$code:$out" = '2:'
run --agent '' 1 0 2 1 1 0
check 'empty explicit scorer agent fails' test "$code:$out" = '2:'
printf 'landing: merge\nhost: codex\n' >"$tmp/project/.celetis.yaml"
run 1 0 2 1 1 0
expect 'main YAML host selects Codex for scoring' 'CAP: J1 V0 B2 N1 S1 X0 = 5 +b2 → standard/xhigh'
printf 'landing: merge\n' >"$tmp/project/.celetis.yaml"
GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=celetis-flow.host GIT_CONFIG_VALUE_0=codex CELETIS_AGENT=claude run 1 0 2 1 1 0
expect 'host environment overrides an obsolete Git host' 'CAP: J1 V0 B2 N1 S1 X0 = 5 +b2 → sonnet/xhigh'
CELETIS_AGENT=claude run 1 0 2 1 1 0
expect 'selected Claude human CAP remains unchanged' 'CAP: J1 V0 B2 N1 S1 X0 = 5 +b2 → sonnet/xhigh'
run --agent claude 0 0 0 0 0 0 --bias 0
expect 'zero bias keeps the original line format' 'CAP: J0 V0 B0 N0 S0 X0 = 0 → haiku/low'
run --agent claude 2 1 1 0 0 0 --bias 0 --attempt 2
expect 'retry CAP retains the original suffix' 'CAP: J2 V1 B1 N0 S0 X0 = 4 → sonnet/high [attempt 2]'
run --agent claude 1 0 2 1 1 0 --json
check 'machine result keeps digits, original bias and portable ranks' json '.schema == 1 and .digits == {J:1,V:0,B:2,N:1,S:1,X:0} and .bias == 2 and .attempt == 1 and .sum == 5 and .rank == 1 and .effort == "xhigh" and .status == "ready" and .host == "claude" and .dispatch == {rank:1,model:"sonnet",effort:"xhigh",runtime:null,reviewer:false} and .line == "CAP: J1 V0 B2 N1 S1 X0 = 5 +b2 → sonnet/xhigh"'
claude_score=$(printf '%s\n' "$out" | jq -c '{digits,bias,attempt,sum,rank,effort}')
codex_run 1 0 2 1 1 0 --json
check 'Codex resolves the same portable score' test "$code:$(printf '%s\n' "$out" | jq -c '{digits,bias,attempt,sum,rank,effort}' 2>/dev/null)" = "0:$claude_score"
check 'Codex records the applied model effort and runtime' json '.dispatch == {rank:1,model:"standard",effort:"xhigh",runtime:"fixture-desktop@1",reviewer:false} and .host == "codex"'
explicit_result=$out
codex_run 1 0 2 1 1 0
expect 'Codex human CAP uses its selected profile' 'CAP: J1 V0 B2 N1 S1 X0 = 5 +b2 → standard/xhigh'
CELETIS_AGENT=codex run 1 0 2 1 1 0
expect 'shared host environment selects Codex' 'CAP: J1 V0 B2 N1 S1 X0 = 5 +b2 → standard/xhigh'
CELETIS_AGENT=codex run --agent claude 1 0 2 1 1 0
expect 'explicit host overrides the environment' 'CAP: J1 V0 B2 N1 S1 X0 = 5 +b2 → sonnet/xhigh'

profile_path=$CAP_MODEL_PROFILE
unset CAP_MODEL_PROFILE
cat >"$tmp/project/.celetis.yaml" <<'YAML'
landing: merge
codexProfiles:
  fixture-cli@1:
    slots: [largest, large, standard, small]
    reviewer: {rank: 1, effort: medium}
  fixture-desktop@1:
    slots: [small, standard, large, largest]
    reviewer: {rank: 1, effort: medium}
YAML
codex_run 1 0 2 1 1 0 --json
check 'configured profile succeeds' test "$code:$err" = '0:'
check 'configured runtime matches' json '.dispatch.runtime == "fixture-desktop@1" and .dispatch.model == "standard" and .dispatch.effort == "xhigh"'
check 'configured profile equals explicit profile result' test "$out" = "$explicit_result"

git -C "$tmp/project" -c user.name=fixture -c user.email=fixture@example.test commit -q --allow-empty -m fixture
git -C "$tmp/project" worktree add -q -b lane "$tmp/lane"
mkdir "$tmp/project/subfolder"
cat >"$tmp/lane/.celetis.yaml" <<'YAML'
landing: merge
codexProfiles:
  fixture-desktop@1:
    slots: [small, large, standard, largest]
    reviewer: {rank: 1, effort: medium}
YAML
codex_at "$tmp/lane" 1 0 2 1 1 0 --json
check 'lane selects the main profile' test "$code:$out:$err" = "0:$explicit_result:"
codex_at "$tmp/project/subfolder" 1 0 2 1 1 0 --json
check 'subfolder selects the main profile' test "$code:$out:$err" = "0:$explicit_result:"

jq '.slots[1] = "large"' "$profile_path" >"$tmp/env-profile.json"
CAP_MODEL_PROFILE="$tmp/env-profile.json" codex_run 1 0 2 1 1 0 --json
check 'profile environment overrides main config' json '.dispatch.model == "large" and .dispatch.runtime == "fixture-desktop@1"'
CAP_MODEL_PROFILE="$tmp/env-profile.json" codex_run 1 0 2 1 1 0 --profile "$profile_path" --json
check 'profile flag overrides environment' test "$code:$out:$err" = "0:$explicit_result:"
codex_run 1 0 2 1 1 0 --profile '' --json
error 'empty explicit profile has no config fallback' '--profile'
CAP_MODEL_PROFILE= codex_run 1 0 2 1 1 0 --json
error 'empty profile environment has no config fallback' '--profile'
codex_run 1 0 2 1 1 0 --profile "$tmp/missing" --json
error 'invalid explicit profile has no config fallback' '--profile'

cat >"$tmp/project/.celetis.yaml" <<'YAML'
landing: merge
codexProfiles:
  fixture-cli@1:
    slots: [small, standard, large, largest]
    reviewer: {rank: 1, effort: medium}
YAML
codex_run 1 0 2 1 1 0 --json
error 'missing live runtime identity' 'fixture-desktop@1'
cat >"$tmp/project/.celetis.yaml" <<'YAML'
landing: merge
codexProfiles:
  fixture-desktop@1:
    slots: [small]
    reviewer: {rank: 1, effort: medium}
YAML
codex_run 1 0 2 1 1 0 --json
error 'malformed configured profile' 'codexProfiles.fixture-desktop@1.slots'
cat >"$tmp/project/.celetis.yaml" <<'YAML'
landing: merge
codexProfiles:
  fixture-desktop@1:
    slots: [small, standard, large, unavailable]
    reviewer: {rank: 1, effort: medium}
YAML
codex_run 1 0 2 1 1 0 --json
error 'unavailable configured slot' 'unavailable'
cat >"$tmp/project/.celetis.yaml" <<'YAML'
landing: merge
codexProfiles:
  fixture-desktop@1:
    slots: [small, standard, large, largest]
    reviewer: {rank: 1, effort: medium}
YAML
jq '.models[1].efforts = ["low","high","xhigh","max"]' "$CAP_RUNTIME_MODELS" >"$tmp/no-config-medium.json"
codex_run 1 0 2 1 1 0 --runtime-models "$tmp/no-config-medium.json" --json
error 'unavailable configured reviewer pair' 'medium'
CAP_RUNTIME_MODELS= codex_run 1 0 2 1 1 0 --json
error 'configured profile needs its runtime file' '--runtime-models'
printf 'invalid: [\n' >"$tmp/project/.celetis.yaml"
CAP_MODEL_PROFILE= CAP_RUNTIME_MODELS= codex_run 1 0 2 1 1 0 --attempt 4
expect 'STOP precedes invalid config and runtime lookup' 'CAP: J1 V0 B2 N1 S1 X0 = 5 +b2 → STOP (attempt 4: escalate to user with failure trail)'
printf 'landing: merge\n' >"$tmp/project/.celetis.yaml"
codex_run 1 0 2 1 1 0 --json
check 'no profile scores with the parent model' json '.status == "ready" and .host == "codex" and .rank == 1 and .effort == "xhigh" and .dispatch == {rank:1,model:null,effort:"xhigh",runtime:null,reviewer:false} and .line == "CAP: J1 V0 B2 N1 S1 X0 = 5 +b2 → inherit/xhigh"'
check 'no profile keeps the portable score' test "$(printf '%s\n' "$out" | jq -c '{digits,bias,attempt,sum,rank,effort}')" = "$claude_score"
codex_run 1 0 2 1 1 0
expect 'no profile human line names inherit' 'CAP: J1 V0 B2 N1 S1 X0 = 5 +b2 → inherit/xhigh'
printf 'landing: merge\ncodexProfiles: {}\n' >"$tmp/project/.celetis.yaml"
codex_run 1 0 2 1 1 0 --json
check 'empty codexProfiles uses the parent model' json '.dispatch == {rank:1,model:null,effort:"xhigh",runtime:null,reviewer:false}'
printf 'landing: merge\n' >"$tmp/project/.celetis.yaml"
CAP_RUNTIME_MODELS= codex_run 1 0 2 1 1 0 --json
check 'parent model needs no runtime file' json '.dispatch.model == null and .dispatch.effort == "xhigh"'
printf '%s\n' 'not json' >"$tmp/parent-bad-models.json"
codex_run 1 0 2 1 1 0 --runtime-models "$tmp/parent-bad-models.json" --json
check 'a supplied runtime file is not read' json '.dispatch.model == null'
codex_run 1 0 2 1 1 0 --runtime-models "$tmp/missing" --json
check 'a missing runtime file is not checked' json '.dispatch.model == null'
codex_run 0 0 0 0 0 0 --bias 0 --reviewer --json
check 'parent model reviewer minimum is rank 1 medium' json '.rank == 0 and .effort == "low" and .dispatch == {rank:1,model:null,effort:"medium",runtime:null,reviewer:true}'
retry_sequence 'parent model retains max at attempt 3' '' \
  '[[1,"xhigh",1,null,"xhigh"],[1,"max",1,null,"max"],[2,"xhigh",2,null,"max"]]' \
  1 0 2 1 1 0 --bias 2
codex_run 1 0 2 1 1 0 --attempt 2
expect 'parent model human retry line' 'CAP: J1 V0 B2 N1 S1 X0 = 5 +b2 → inherit/max [attempt 2]'
codex_run 1 0 2 1 1 0 --attempt 3
expect 'parent model human attempt 3 keeps max' 'CAP: J1 V0 B2 N1 S1 X0 = 5 +b2 → inherit/max [attempt 3]'
codex_run 1 0 2 1 1 0 --attempt 4 --json
check 'parent model attempt 4 stops' json '.status == "stop" and .dispatch == null'
codex_at "$tmp/lane" 1 0 2 1 1 0 --json
check 'main config decides over a lane profile' json '.dispatch.model == null and .dispatch.runtime == null'
rm "$tmp/project/.celetis.yaml"
codex_run 1 0 2 1 1 0 --json
error 'missing config with no profile' '.celetis.yaml'
printf 'invalid: [\n' >"$tmp/project/.celetis.yaml"
codex_run 1 0 2 1 1 0 --json
error 'invalid config with no profile' '.celetis.yaml'
printf 'landing: merge\n' >"$tmp/project/.celetis.yaml"

mkdir "$tmp/outside"
yq() {
  printf 'unexpected yq call\n' >&2
  return 99
}
export -f yq
codex_at "$tmp/outside" 1 0 2 1 1 0 --profile "$profile_path" --runtime-models "$CAP_RUNTIME_MODELS" --json
check 'standalone explicit scoring needs no repository or yq' test "$code:$out:$err" = "0:$explicit_result:"
unset -f yq
codex_at "$tmp/outside" 1 0 2 1 1 0 --json
error 'outside a checkout with no profile' '--profile'
export CAP_MODEL_PROFILE=$profile_path

CAP_EFFORT_BIAS=0 codex_run 1 0 2 1 1 0
expect 'bias environment remains available' 'CAP: J1 V0 B2 N1 S1 X0 = 5 → standard/medium'
CAP_EFFORT_BIAS=0 codex_run 1 0 2 1 1 0 --bias 1
expect 'explicit bias overrides environment' 'CAP: J1 V0 B2 N1 S1 X0 = 5 +b1 → standard/high'
codex_run 0 0 0 0 0 2 --bias 1
expect 'security floor precedes bias' 'CAP: J0 V0 B0 N0 S0 X2 = 2 +b1 → large/xhigh'
codex_run 0 2 0 0 0 0 --bias 1
expect 'verifiability effort floor precedes bias' 'CAP: J0 V2 B0 N0 S0 X0 = 2 +b1 → small/xhigh'
codex_run 2 1 1 0 0 0 --bias 0 --attempt 2
expect 'attempt 2 raises only effort' 'CAP: J2 V1 B1 N0 S0 X0 = 4 → standard/high [attempt 2]'
codex_run 2 1 1 0 0 0 --bias 0 --attempt 3
expect 'attempt 3 raises rank and floors effort' 'CAP: J2 V1 B1 N0 S0 X0 = 4 → large/high [attempt 3]'
codex_run 2 2 2 2 2 0 --attempt 3
expect 'clamp follows bias and escalation below sum 12' 'CAP: J2 V2 B2 N2 S2 X0 = 10 +b2 → largest/xhigh [attempt 3]'
codex_run 2 2 2 2 2 2
expect 'sum 12 retains the top effort' 'CAP: J2 V2 B2 N2 S2 X2 = 12 +b2 → largest/max'
codex_run 0 0 0 0 0 0 --bias 0 --reviewer --json
check 'reviewer minimum applies without rewriting the portable score' json '.rank == 0 and .effort == "low" and .dispatch == {rank:1,model:"standard",effort:"medium",runtime:"fixture-desktop@1",reviewer:true}'
codex_run 2 2 2 2 2 2 --reviewer --json
check 'reviewer floor never lowers a stronger score' json '.rank == 3 and .dispatch.rank == 3 and .dispatch.effort == "max"'
run --agent claude 0 0 0 0 0 0 --bias 0 --reviewer
expect 'Claude reviewer minimum uses its standard tier' 'CAP: J0 V0 B0 N0 S0 X0 = 0 → sonnet/medium'
OPENCODE=1 run --agent claude 1 0 2 1 1 0 --current-model provider/current
expect 'opencode explicit current-model behavior is preserved' 'CAP: J1 V0 B2 N1 S1 X0 = 5 +b2 → provider/current/xhigh'
OPENCODE=1 CAP_CURRENT_MODEL=provider/env run --agent claude 2 2 2 2 2 0 --attempt 3 --json
check 'opencode preserves current model and portable clamp' json '.host == "opencode" and .rank == 3 and .effort == "xhigh" and .dispatch.model == "provider/env"'
OPENCODE=1 CAP_CURRENT_MODEL=provider/env run --agent claude 1 0 2 1 1 0 --current-model provider/flag
expect 'opencode flag still wins over current-model environment' 'CAP: J1 V0 B2 N1 S1 X0 = 5 +b2 → provider/flag/xhigh'

jq '.slots[3] = "large"' "$CAP_MODEL_PROFILE" >"$tmp/repeated.json"
codex_run 2 2 2 2 2 2 --profile "$tmp/repeated.json" --json
check 'repeated model IDs preserve four distinct capability ranks' json '.rank == 3 and .dispatch.model == "large"'
jq '.reviewer = {rank:3,effort:"xhigh"}' "$CAP_MODEL_PROFILE" >"$tmp/top-reviewer.json"
codex_run 0 0 0 0 0 0 --bias 2 --reviewer --profile "$tmp/top-reviewer.json"
expect 'reviewer promotion obeys the top-rank clamp' 'CAP: J0 V0 B0 N0 S0 X0 = 0 +b2 → largest/xhigh'

retry_sequence 'repeated rank 2/3 retains max' "$tmp/repeated.json" \
  '[[2,"max",2,"large","max"],[2,"max",2,"large","max"],[3,"xhigh",3,"large","max"]]' \
  2 2 1 1 2 1 --bias 2
retry_sequence 'repeated rank 2/3 retains raised effort at zero bias' "$tmp/repeated.json" \
  '[[2,"high",2,"large","high"],[2,"xhigh",2,"large","xhigh"],[3,"high",3,"large","xhigh"]]' \
  2 2 1 1 2 1 --bias 0
jq '.slots[2] = "standard"' "$CAP_MODEL_PROFILE" >"$tmp/repeated-middle.json"
retry_sequence 'repeated rank 1/2 retains raised effort at bias 1' "$tmp/repeated-middle.json" \
  '[[1,"high",1,"standard","high"],[1,"xhigh",1,"standard","xhigh"],[2,"high",2,"standard","xhigh"]]' \
  1 0 2 1 1 0 --bias 1
jq '.slots = ["standard","standard","standard","standard"]' "$CAP_MODEL_PROFILE" >"$tmp/single.json"
retry_sequence 'single model saturates at max' "$tmp/single.json" \
  '[[1,"xhigh",1,"standard","xhigh"],[1,"max",1,"standard","max"],[2,"xhigh",2,"standard","max"]]' \
  1 0 2 1 1 0 --bias 2
retry_sequence 'distinct models keep ordered rank escalation' "$CAP_MODEL_PROFILE" \
  '[[2,"max",2,"large","max"],[2,"max",2,"large","max"],[3,"xhigh",3,"largest","xhigh"]]' \
  2 2 1 1 2 1 --bias 2
jq '.reviewer = {rank:2,effort:"medium"}' "$CAP_MODEL_PROFILE" >"$tmp/large-reviewer.json"
retry_sequence 'reviewer retry compares the applied model' "$tmp/large-reviewer.json" \
  '[[1,"high",2,"large","high"],[1,"xhigh",2,"large","xhigh"],[2,"high",2,"large","xhigh"]]' \
  1 0 2 1 1 0 --bias 1 --reviewer
retry_sequence 'reviewer retry retains its applied cap' "$tmp/top-reviewer.json" \
  '[[2,"max",3,"largest","xhigh"],[2,"max",3,"largest","xhigh"],[3,"xhigh",3,"largest","xhigh"]]' \
  2 2 1 1 2 1 --bias 2 --reviewer
jq '.models[2].efforts = ["low","medium","high","xhigh"]' "$CAP_RUNTIME_MODELS" >"$tmp/no-large-max.json"
codex_run 2 2 1 1 2 1 --bias 2 --attempt 3 --profile "$tmp/repeated.json" --runtime-models "$tmp/no-large-max.json"
error 'unsupported retained retry effort' 'large/max'

CAP_MODEL_PROFILE= codex_run 1 0 2 1 1 0
error 'absent profile' '--profile'
CAP_RUNTIME_MODELS= codex_run 1 0 2 1 1 0
error 'absent runtime allowlist' '--runtime-models'
codex_run 1 0 2 1 1 0 --profile "$tmp/missing"
error 'missing profile file' '--profile'
printf '%s\n' 'not json' >"$tmp/bad.json"
codex_run 1 0 2 1 1 0 --profile "$tmp/bad.json"
error 'malformed profile' 'profile'
codex_run 1 0 2 1 1 0 --runtime-models "$tmp/bad.json"
error 'malformed runtime allowlist' 'runtime allowlist'
jq '.slots = ["small","standard","large"]' "$CAP_MODEL_PROFILE" >"$tmp/short.json"
codex_run 1 0 2 1 1 0 --profile "$tmp/short.json"
error 'fewer than four capability slots' 'four'
jq '.runtime = "fixture-cli@1"' "$CAP_RUNTIME_MODELS" >"$tmp/other-runtime.json"
codex_run 1 0 2 1 1 0 --runtime-models "$tmp/other-runtime.json"
error 'CLI and desktop identity mismatch' 'runtime'
jq '.slots[3] = "unavailable"' "$CAP_MODEL_PROFILE" >"$tmp/unavailable.json"
codex_run 1 0 2 1 1 0 --profile "$tmp/unavailable.json"
error 'even an unselected slot must exist in the runtime' 'unavailable'
jq '.models[1].efforts = ["low","medium","high"]' "$CAP_RUNTIME_MODELS" >"$tmp/no-xhigh.json"
codex_run 1 0 2 1 1 0 --runtime-models "$tmp/no-xhigh.json"
error 'unsupported applied effort' 'xhigh'
jq '.models[1].efforts = ["low","high","xhigh","max"]' "$CAP_RUNTIME_MODELS" >"$tmp/no-medium.json"
codex_run 1 0 2 1 1 0 --runtime-models "$tmp/no-medium.json"
error 'unsupported reviewer minimum effort' 'medium'
jq '.reviewer.effort = "ultra"' "$CAP_MODEL_PROFILE" >"$tmp/ultra.json"
codex_run 1 0 2 1 1 0 --profile "$tmp/ultra.json"
error 'runtime extras cannot become rubric efforts' 'reviewer'
jq '.reviewer.effort = "max"' "$CAP_MODEL_PROFILE" >"$tmp/max-floor.json"
codex_run 1 0 2 1 1 0 --profile "$tmp/max-floor.json"
error 'reviewer floor cannot break reserved max invariant' 'reviewer'
jq '.models += [.models[0]]' "$CAP_RUNTIME_MODELS" >"$tmp/duplicate.json"
codex_run 1 0 2 1 1 0 --runtime-models "$tmp/duplicate.json"
error 'ambiguous runtime model IDs' 'runtime allowlist'
printf '%s\n%s\n' "$(cat "$CAP_MODEL_PROFILE")" "$(cat "$CAP_MODEL_PROFILE")" >"$tmp/multiple.json"
codex_run 1 0 2 1 1 0 --profile "$tmp/multiple.json"
error 'multiple profile documents' 'profile'

CAP_MODEL_PROFILE= CAP_RUNTIME_MODELS= codex_run 1 0 2 1 1 0 --attempt 4
expect 'attempt 4 stops before missing setup is validated' 'CAP: J1 V0 B2 N1 S1 X0 = 5 +b2 → STOP (attempt 4: escalate to user with failure trail)'
codex_run 1 0 2 1 1 0 --attempt 5 --reviewer --profile "$tmp/missing" --runtime-models "$tmp/bad.json" --json
check 'STOP machine result retains inputs and has no dispatch' json '.status == "stop" and .attempt == 5 and .digits.J == 1 and .bias == 2 and .rank == null and .effort == null and .dispatch == null'
run --agent claude 1 0 2 1 1 0 --attempt 4
expect 'Claude STOP line remains unchanged' 'CAP: J1 V0 B2 N1 S1 X0 = 5 +b2 → STOP (attempt 4: escalate to user with failure trail)'

for flag in --agent --profile --runtime-models --bias --attempt --current-model; do
  run 0 0 0 0 0 0 "$flag"
  error "missing $flag value" "$flag"
done
run --agent other 0 0 0 0 0 0
error 'invalid selected agent' 'claude or codex'
run --test
check 'original built-in test entry point stays compatible' test "$code" = 0
printf '\ncapscore tests: %s failures\n' "$fails"
[ "$fails" -eq 0 ]
