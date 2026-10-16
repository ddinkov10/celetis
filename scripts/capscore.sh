#!/usr/bin/env bash

CC_MODELS=(haiku sonnet opus fable)
efforts=(low medium high xhigh max)
MODELS=("${CC_MODELS[@]}")
CURRENT_MODEL=""

die() { printf 'capscore: %s\n' "$1" >&2; exit 2; }
is_uint() { case "$1" in ''|*[!0-9]*) return 1;; *) return 0;; esac; }
need_value() { [ $# -ge 2 ] && [ -n "$2" ] || die "$1 needs a value"; }
need_jq() { command -v jq >/dev/null 2>&1 || die 'jq is not on PATH; install jq for JSON output and Codex profiles'; }

usage() {
  cat <<'USAGE'
usage: scripts/celetis capscore J V B N S X [options]
       scripts/celetis capscore --test
--bias N                 effort bias (CAP_EFFORT_BIAS; default 2)
--attempt N              gate-fail attempt (default 1; 4 or later stops)
--host claude|codex       explicit host (CELETIS_HOST > project config > claude)
--json                   portable score plus the applied dispatch pair
--reviewer               apply the selected host's reviewer minimum
--profile FILE           Codex profile (CAP_MODEL_PROFILE > main config profile)
--runtime-models FILE    active dispatch allowlist (CAP_RUNTIME_MODELS)
--current-model ID       opencode current model (CAP_CURRENT_MODEL)
See docs/capability.md of the plugin celetis for profile and result schemas.
USAGE
}

model_name() {
  if [ "${#MODELS[@]}" -eq 1 ]; then printf '%s\n' "${MODELS[0]}"
  else printf '%s\n' "${MODELS[$1]}"; fi
}

detect_current_model() {
  command -v sqlite3 >/dev/null 2>&1 || return 1
  local db="${OPENCODE_DATA_DIR:-$HOME/.local/share/opencode}/opencode.db"
  [ -f "$db" ] || return 1
  local m cwd
  cwd=$(pwd -P); cwd=${cwd//\'/\'\'}
  m=$(sqlite3 "$db" "SELECT json_extract(data,'$.providerID') || '/' || json_extract(data,'$.modelID') FROM message WHERE json_extract(data,'$.modelID') IS NOT NULL AND json_extract(data,'$.path.cwd') = '${cwd}' ORDER BY time_created DESC LIMIT 1;" 2>/dev/null)
  if [ -z "$m" ] || [ "$m" = "/" ]; then
    m=$(sqlite3 "$db" "SELECT json_extract(data,'$.providerID') || '/' || json_extract(data,'$.modelID') FROM message WHERE json_extract(data,'$.modelID') IS NOT NULL ORDER BY time_created DESC LIMIT 1;" 2>/dev/null)
  fi
  [ -n "$m" ] && [ "$m" != "/" ] || return 1
  echo "$m"
}

resolve_score() {
  local j=$1 v=$2 b=$3 n=$4 s=$5 x=$6 bias=$7 attempt=$8
  local sum=$(( j + v + b + n + s + x )) m e
  if [ "$attempt" -ge 4 ]; then echo STOP; return; fi

  if   [ "$sum" -le 3 ];  then m=0; e=0
  elif [ "$sum" -le 6 ];  then m=1; e=1
  elif [ "$sum" -le 9 ];  then m=2; e=2
  elif [ "$sum" -le 11 ]; then m=2; e=3
  else                         m=3; e=4
  fi
  if [ "$x" -eq 2 ]; then [ "$m" -lt 2 ] && m=2; [ "$e" -lt 2 ] && e=2; fi
  if [ "$v" -eq 2 ]; then [ "$e" -lt 2 ] && e=2; fi
  e=$(( e + bias ))
  if   [ "$attempt" -eq 3 ]; then m=$(( m + 1 )); [ "$e" -lt 2 ] && e=2
  elif [ "$attempt" -eq 2 ]; then e=$(( e + 1 ))
  fi
  [ "$m" -gt 3 ] && m=3
  [ "$e" -gt 4 ] && e=4
  if [ "$m" -eq 3 ] && [ "$sum" -lt 12 ]; then [ "$e" -gt 3 ] && e=3; fi
  printf '%s %s\n' "$m" "$e"
}

resolve() {
  local score m e
  score=$(resolve_score "$@")
  if [ "$score" = STOP ]; then echo STOP; return; fi
  m=${score% *}; e=${score#* }
  printf '%s/%s\n' "$(model_name "$m")" "${efforts[$e]}"
}

apply_score() {
  local score=$1 e reviewer_e=0
  applied_rank=${score% *}; applied_e=${score#* }
  if [ "$reviewer" = true ]; then
    [ "$applied_rank" -ge "$reviewer_rank" ] || applied_rank=$reviewer_rank
    for ((e = 0; e < ${#efforts[@]}; e++)); do
      if [ "${efforts[$e]}" = "$reviewer_effort" ]; then reviewer_e=$e; fi
    done
    [ "$applied_e" -ge "$reviewer_e" ] || applied_e=$reviewer_e
    if [ "$applied_rank" -eq 3 ] && [ "$sum" -lt 12 ] && [ "$applied_e" -gt 3 ]; then applied_e=3; fi
  fi
  model=$(model_name "$applied_rank")
}

setup_codex_profile() {
  local profiles='[]' config='{}' main='' config_file=''
  if [ "$profile_supplied" = true ]; then
    [ -n "$profile" ] && [ -f "$profile" ] && [ -r "$profile" ] || die 'Codex needs a readable --profile FILE (or CAP_MODEL_PROFILE); configure four ordered slots and a reviewer minimum'
    need_jq
    profiles=$(jq -cs '.' "$profile" 2>&1) || die "invalid Codex profile: $profiles"
  else
    main=$(celetis_config_main 2>/dev/null) || die 'Codex needs a main checkout with codexProfiles or an explicit --profile FILE'
    config_file="$main/.celetis.yaml"
    config=$(celetis_config_read "$main") || exit $?
  fi
  [ -n "$runtime_models" ] && [ -f "$runtime_models" ] && [ -r "$runtime_models" ] || die 'Codex needs a readable --runtime-models FILE (or CAP_RUNTIME_MODELS) from the active dispatch surface'
  need_jq
  binding=$(jq -cn --argjson profiles "$profiles" --argjson config "$config" --argjson explicit "$profile_supplied" --arg config_file "$config_file" --slurpfile runtimes "$runtime_models" '
    def text: type == "string" and length > 0 and (explode | all(. >= 32 and . != 127));
    def model_id: text and test("^[A-Za-z0-9][A-Za-z0-9._/-]*$");
    if ($runtimes | length) != 1 then error("invalid runtime allowlist: need one JSON object") else . end
    | $runtimes[0] as $r
    | if ($r | type) != "object" or $r.schema != 1 or ($r.runtime | text | not) or
         ($r.models | type) != "array" or ($r.models | length) == 0 or
         (all($r.models[]; type == "object" and (.id | model_id) and
           (.efforts | type) == "array" and (.efforts | length) > 0 and all(.efforts[]; text) and
           (.efforts | unique | length) == (.efforts | length)) | not) or
         ([$r.models[].id] | unique | length) != ($r.models | length)
      then error("invalid runtime allowlist: schema 1 needs unique model IDs and supported efforts") else . end
    | (if $explicit then $profiles
       elif ($config.codexProfiles | type) == "object" and ($config.codexProfiles | has($r.runtime))
       then [$config.codexProfiles[$r.runtime] | {schema:1,runtime:$r.runtime,slots,reviewer}]
       else error($config_file + ": codexProfiles." + $r.runtime + ": missing profile; configure it or pass --profile") end) as $selected
    | if ($selected | length) != 1 then error("invalid Codex profile: need one JSON object") else . end
    | $selected[0] as $p
    | if ($p | type) != "object" or $p.schema != 1 or ($p.runtime | text | not) or
         ($p.slots | type) != "array" or ($p.slots | length) != 4 or
         (all($p.slots[]; model_id) | not)
      then error("invalid Codex profile: schema 1 needs runtime and four ordered model slots") else . end
    | if ($p.reviewer | type) != "object" or ($p.reviewer.rank | type) != "number" or
         $p.reviewer.rank < 0 or $p.reviewer.rank > 3 or ($p.reviewer.rank | floor) != $p.reviewer.rank or
         (["low","medium","high","xhigh"] | index($p.reviewer.effort)) == null
      then error("invalid Codex profile: reviewer needs rank 0-3 and effort low, medium, high or xhigh (max is reserved for sum 12)") else . end
    | if $p.runtime != $r.runtime then error("profile runtime does not match the active dispatch runtime") else . end
    | reduce $p.slots[] as $id (.;
        if any($r.models[]; .id == $id) then . else error("profile model unavailable in active runtime: " + $id) end)
    | $p.slots[$p.reviewer.rank] as $reviewer
    | if any($r.models[]; .id == $reviewer and (.efforts | index($p.reviewer.effort)) != null)
      then {runtime:$r.runtime,slots:$p.slots,reviewer:$p.reviewer,models:$r.models}
      else error("reviewer minimum effort unavailable: " + $reviewer + "/" + $p.reviewer.effort) end
  ' 2>&1) || die "$binding; repair the Codex profile (--profile) and runtime allowlist (--runtime-models) for this dispatch surface"
  MODELS=()
  while IFS= read -r model; do MODELS[${#MODELS[@]}]=$model; done < <(printf '%s\n' "$binding" | jq -r '.slots[]')
  reviewer_rank=$(printf '%s\n' "$binding" | jq -r '.reviewer.rank')
  reviewer_effort=$(printf '%s\n' "$binding" | jq -r '.reviewer.effort')
  runtime=$(printf '%s\n' "$binding" | jq -r '.runtime')
}

emit_json() {
  need_jq
  jq -cn --argjson j "$j" --argjson v "$v" --argjson b "$b" --argjson n "$n" --argjson s "$s" --argjson x "$x" \
    --argjson bias "$bias" --argjson attempt "$attempt" --argjson sum "$sum" --arg status "$status" \
    --arg host "$host" --arg rank "$rank" --arg effort "$effort" --arg applied_rank "$applied_rank" \
    --arg model "$model" --arg applied_effort "$applied_effort" --arg runtime "$runtime" --argjson reviewer "$reviewer" --arg line "$line" '
      {schema:1,digits:{J:$j,V:$v,B:$b,N:$n,S:$s,X:$x},bias:$bias,attempt:$attempt,sum:$sum,status:$status,
       host:(if $host == "" then null else $host end),rank:(if $rank == "" then null else ($rank | tonumber) end),
       effort:(if $effort == "" then null else $effort end),
       dispatch:(if $status == "stop" then null else
         {rank:($applied_rank | tonumber),model:$model,effort:$applied_effort,
          runtime:(if $runtime == "" then null else $runtime end),reviewer:$reviewer} end),line:$line}'
}

run_tests() {
  local fails=0 total=0 got
  OPENCODE= CURRENT_MODEL= MODELS=(haiku sonnet opus fable)
  check() {
    local desc=$1 exp=$2; shift 2
    got=$(resolve "$@"); total=$(( total + 1 ))
    if [ "$got" = "$exp" ]; then printf 'ok   %s\n' "$desc"
    else printf 'FAIL %s : expected %s got %s\n' "$desc" "$exp" "$got"; fails=$(( fails + 1 )); fi
  }
  check_err() {
    local desc=$1; shift; total=$(( total + 1 ))
    if "$0" "$@" >/dev/null 2>&1; then
      printf 'FAIL %s : expected non-zero exit\n' "$desc"; fails=$(( fails + 1 ))
    else printf 'ok   %s\n' "$desc"; fi
  }

  check "band sum0 -> haiku/low"      haiku/low      0 0 0 0 0 0 0 1
  check "band sum3 top-haiku"         haiku/low      1 1 1 0 0 0 0 1
  check "band sum4 bottom-sonnet"     sonnet/medium  2 1 1 0 0 0 0 1
  check "band sum6 top-sonnet"        sonnet/medium  2 1 1 1 1 0 0 1
  check "band sum7 bottom-opus"       opus/high      2 1 2 1 1 0 0 1
  check "band sum9 top-opus"          opus/high      2 2 2 2 1 0 0 1
  check "band sum10 opus/xhigh"       opus/xhigh     2 2 2 2 2 0 0 1
  check "band sum11 opus/xhigh"       opus/xhigh     2 2 2 2 2 1 0 1
  check "band sum12 -> fable/max"     fable/max      2 2 2 2 2 2 0 1

  check "X=2 floor -> opus/high"      opus/high      0 0 0 0 0 2 0 1
  check "V=2 floor -> effort high"    haiku/high     0 2 0 0 0 0 0 1
  check "X=2 no-lower at sum10"       opus/xhigh     2 2 2 1 1 2 0 1

  check "b2 verify-gates example"     sonnet/xhigh   1 0 1 1 1 0 2 1
  check "b2 type-lanes example"       opus/max       2 2 2 1 1 0 2 1
  check "b2 at sum10 -> opus/max"     opus/max       2 2 2 2 2 0 2 1
  check "sum12 keeps fable/max +b2"   fable/max      2 2 2 2 2 2 2 1
  check "b2 attempt3 no fable/max<12" fable/xhigh    2 2 2 2 2 0 2 3

  check "attempt2 effort +1"          sonnet/high    2 1 1 0 0 0 0 2
  check "attempt3 model+1 effort>=hi" opus/high      2 1 1 0 0 0 0 3
  check "attempt3 from haiku"         sonnet/high    0 0 0 0 0 0 0 3
  check "attempt4 -> STOP"            STOP           0 0 0 0 0 0 0 4
  check "model clamps at fable"       fable/high     2 1 2 1 1 0 0 3

  check_err "digit>2 rejected"        3 0 0 0 0 0
  check_err "too few digits"          1 1 1
  check_err "non-numeric digit"       a 0 0 0 0 0
  check_err "bad --bias"              1 1 1 1 1 1 --bias x
  check_err "attempt<1 rejected"      1 1 1 1 1 1 --attempt 0

  printf '\n%d/%d passed\n' "$(( total - fails ))" "$total"
  [ "$fails" -eq 0 ]
}

bias=""; attempt=1; digits=""; selected_host=""; json=false; reviewer=false
profile=${CAP_MODEL_PROFILE-}; runtime_models=${CAP_RUNTIME_MODELS:-}; profile_supplied=false
[ "${CAP_MODEL_PROFILE+x}" = x ] && profile_supplied=true
[ $# -gt 0 ] || die 'need six digits J V B N S X (or --test); see docs/capability.md of the plugin celetis'
while [ $# -gt 0 ]; do
  case "$1" in
    --test) run_tests; exit $? ;;
    -h|--help) usage; exit 0 ;;
    --json) json=true ;;
    --reviewer) reviewer=true ;;
    --bias) need_value "$@"; shift; bias=$1; is_uint "$bias" || die '--bias needs a non-negative integer' ;;
    --attempt) need_value "$@"; shift; attempt=$1; is_uint "$attempt" || die '--attempt needs a positive integer' ;;
    --host) need_value "$@"; shift; selected_host=$1 ;;
    --profile) need_value "$@"; shift; profile=$1; profile_supplied=true ;;
    --runtime-models) need_value "$@"; shift; runtime_models=$1 ;;
    --current-model) need_value "$@"; shift; CURRENT_MODEL=$1 ;;
    -*) die "unknown flag: $1" ;;
    *) digits="$digits $1" ;;
  esac
  shift
done
if [ -z "$bias" ]; then
  bias=${CAP_EFFORT_BIAS:-2}
  is_uint "$bias" || die 'CAP_EFFORT_BIAS must be a non-negative integer'
fi
[ "$attempt" -ge 1 ] || die '--attempt needs a positive integer'

# shellcheck disable=SC2086
set -- $digits
[ $# -eq 6 ] || die "need exactly six digits J V B N S X, got $#"
for d in "$@"; do is_uint "$d" && [ "$d" -le 2 ] || die "digit out of range (0-2): $d"; done
j=$1 v=$2 b=$3 n=$4 s=$5 x=$6
sum=$(( j + v + b + n + s + x ))
label="CAP: J$j V$v B$b N$n S$s X$x = $sum"
[ "$bias" -eq 0 ] || label="$label +b$bias"
score=$(resolve_score "$j" "$v" "$b" "$n" "$s" "$x" "$bias" "$attempt")
host= rank= effort= applied_rank= applied_effort= model= runtime=
if [ "$score" = STOP ]; then
  status=stop
  line="$label → STOP (attempt $attempt: escalate to user with failure trail)"
else
  status=ready
  rank=${score% *}; effort=${efforts[${score#* }]}
  source "$(cd "$(dirname "$0")" && pwd)/lib/host.sh"
  if [ -n "$selected_host" ]; then celetis_host_select "$selected_host" || exit $?
  else celetis_host_select || exit $?; fi
  host=$CELETIS_HOST
  reviewer_rank=1; reviewer_effort=medium
  if [ "$host" = codex ]; then
    setup_codex_profile
  elif [ "${OPENCODE:-}" = 1 ]; then
    host=opencode
    CURRENT_MODEL=${CURRENT_MODEL:-${CAP_CURRENT_MODEL:-}}
    if [ -n "$CURRENT_MODEL" ]; then MODELS=("$CURRENT_MODEL")
    elif detected=$(detect_current_model); then MODELS=("$detected"); fi
  fi
  if [ "$host" = codex ]; then
    previous_model=; previous_e=0
    for ((retry = 1; retry <= attempt; retry++)); do
      apply_score "$(resolve_score "$j" "$v" "$b" "$n" "$s" "$x" "$bias" "$retry")"
      if [ "$model" = "$previous_model" ] && [ "$applied_e" -lt "$previous_e" ]; then applied_e=$previous_e; fi
      previous_model=$model; previous_e=$applied_e
    done
  else
    apply_score "$score"
  fi
  applied_effort=${efforts[$applied_e]}
  if [ "$host" = codex ]; then
    printf '%s\n' "$binding" | jq -e --arg model "$model" --arg effort "$applied_effort" \
      'any(.models[]; .id == $model and (.efforts | index($effort)) != null)' >/dev/null ||
      die "effort unavailable in active runtime: $model/$applied_effort; repair --profile or select a runtime that supports this effort"
  fi
  line="$label → $model/$applied_effort"
  [ "$attempt" -le 1 ] || line="$line [attempt $attempt]"
fi
if [ "$json" = true ]; then emit_json; else printf '%s\n' "$line"; fi
