#!/usr/bin/env bash
# capscore.sh — deterministic capability-gate scorer (see docs/capability.md).
# Turns six 0-2 rubric digits into a model/effort tier via bands -> floors -> bias ->
# escalation -> clamp (that order). bash 3.2-safe (macOS default): no mapfile, no assoc arrays.
#
# Usage:  capscore.sh J V B N S X [--attempt N] [--bias N] [--current-model provider/id]
#         capscore.sh --test
# Bias fallback: CAP_EFFORT_BIAS env; default 2. Model is never biased.
#
# Model label: Claude Code -> haiku/sonnet/opus/fable by rank. opencode (OPENCODE=1) ->
# current model only (auto-detected from the opencode DB, or --current-model / CAP_CURRENT_MODEL);
# the rank still drives effort/floors/STOP, but the model label is whatever is running.

CC_MODELS=(haiku sonnet opus fable)   # 0..3 (Claude Code)
efforts=(low medium high xhigh max)    # 0..4
MODELS=("${CC_MODELS[@]}")
CURRENT_MODEL=""

die() { printf 'capscore: %s\n' "$1" >&2; exit 2; }

is_uint() { case "$1" in ''|*[!0-9]*) return 1;; *) return 0;; esac; }

# Pick the model label for a 0..3 rank. Under opencode with a current model the rank is
# ignored (the running model is what executes); otherwise rank maps into MODELS low->high.
model_name() {
  local m=$1 n=${#MODELS[@]}
  if [ "$n" -eq 1 ]; then echo "${MODELS[0]}"
  elif [ "$m" -ge "$n" ]; then echo "${MODELS[$((n - 1))]}"
  else echo "${MODELS[$m]}"; fi
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

# Resolve the active MODELS array + CURRENT_MODEL from the runtime context.
setup_models() {
  if [ "${OPENCODE:-}" = "1" ]; then
    if [ -n "$CURRENT_MODEL" ]; then
      MODELS=("$CURRENT_MODEL")
    elif detected=$(detect_current_model); then
      MODELS=("$detected")
    fi
  fi
}

# resolve J V B N S X BIAS ATTEMPT -> echoes "model/effort" or "STOP"
resolve() {
  local j=$1 v=$2 b=$3 n=$4 s=$5 x=$6 bias=$7 attempt=$8
  local sum=$(( j + v + b + n + s + x ))
  local m e

  # band
  if   [ "$sum" -le 3 ];  then m=0; e=0
  elif [ "$sum" -le 6 ];  then m=1; e=1
  elif [ "$sum" -le 9 ];  then m=2; e=2
  elif [ "$sum" -le 11 ]; then m=2; e=3
  else                         m=3; e=4
  fi

  # floors (raise only)
  if [ "$x" -eq 2 ]; then [ "$m" -lt 2 ] && m=2; [ "$e" -lt 2 ] && e=2; fi
  if [ "$v" -eq 2 ]; then [ "$e" -lt 2 ] && e=2; fi

  # bias (effort only)
  e=$(( e + bias ))

  # escalation (discrete rung on the post-bias base)
  if   [ "$attempt" -ge 4 ]; then echo "STOP"; return 0
  elif [ "$attempt" -eq 3 ]; then m=$(( m + 1 )); [ "$e" -lt 2 ] && e=2
  elif [ "$attempt" -eq 2 ]; then e=$(( e + 1 ))
  fi

  # clamp: model ceiling fable; effort ceiling max; fable below Sigma=12 caps at xhigh
  [ "$m" -gt 3 ] && m=3
  [ "$e" -gt 4 ] && e=4
  if [ "$m" -eq 3 ] && [ "$sum" -lt 12 ]; then [ "$e" -gt 3 ] && e=3; fi

  echo "$(model_name "$m")/${efforts[$e]}"
}

run_tests() {
  local fails=0 total=0 got
  OPENCODE= CURRENT_MODEL= MODELS=(haiku sonnet opus fable)
  check() { # desc expected  J V B N S X BIAS ATTEMPT
    local desc=$1 exp=$2; shift 2
    got=$(resolve "$@"); total=$(( total + 1 ))
    if [ "$got" = "$exp" ]; then printf 'ok   %s\n' "$desc"
    else printf 'FAIL %s : expected %s got %s\n' "$desc" "$exp" "$got"; fails=$(( fails + 1 )); fi
  }
  check_err() { # desc  <args to script>
    local desc=$1; shift; total=$(( total + 1 ))
    if "$0" "$@" >/dev/null 2>&1; then
      printf 'FAIL %s : expected non-zero exit\n' "$desc"; fails=$(( fails + 1 ))
    else printf 'ok   %s\n' "$desc"; fi
  }

  # --- band edges (bias 0, attempt 1) ---
  check "band sum0 -> haiku/low"      haiku/low      0 0 0 0 0 0 0 1
  check "band sum3 top-haiku"         haiku/low      1 1 1 0 0 0 0 1
  check "band sum4 bottom-sonnet"     sonnet/medium  2 1 1 0 0 0 0 1
  check "band sum6 top-sonnet"        sonnet/medium  2 1 1 1 1 0 0 1
  check "band sum7 bottom-opus"       opus/high      2 1 2 1 1 0 0 1
  check "band sum9 top-opus"          opus/high      2 2 2 2 1 0 0 1
  check "band sum10 opus/xhigh"       opus/xhigh     2 2 2 2 2 0 0 1
  check "band sum11 opus/xhigh"       opus/xhigh     2 2 2 2 2 1 0 1
  check "band sum12 -> fable/max"     fable/max      2 2 2 2 2 2 0 1

  # --- floors (bias 0, attempt 1) ---
  check "X=2 floor -> opus/high"      opus/high      0 0 0 0 0 2 0 1
  check "V=2 floor -> effort high"    haiku/high     0 2 0 0 0 0 0 1
  check "X=2 no-lower at sum10"       opus/xhigh     2 2 2 1 1 2 0 1

  # --- bias + clamp (default b2) ---
  check "b2 verify-gates example"     sonnet/xhigh   1 0 1 1 1 0 2 1
  check "b2 type-lanes example"       opus/max       2 2 2 1 1 0 2 1
  check "b2 at sum10 -> opus/max"     opus/max       2 2 2 2 2 0 2 1
  check "sum12 keeps fable/max +b2"   fable/max      2 2 2 2 2 2 2 1
  check "b2 attempt3 no fable/max<12" fable/xhigh    2 2 2 2 2 0 2 3

  # --- escalation ladder (bias 0) ---
  check "attempt2 effort +1"          sonnet/high    2 1 1 0 0 0 0 2
  check "attempt3 model+1 effort>=hi" opus/high      2 1 1 0 0 0 0 3
  check "attempt3 from haiku"         sonnet/high    0 0 0 0 0 0 0 3
  check "attempt4 -> STOP"            STOP           0 0 0 0 0 0 0 4
  check "model clamps at fable"       fable/high     2 1 2 1 1 0 0 3

  # --- validation error paths ---
  check_err "digit>2 rejected"        3 0 0 0 0 0
  check_err "too few digits"          1 1 1
  check_err "non-numeric digit"       a 0 0 0 0 0
  check_err "bad --bias"              1 1 1 1 1 1 --bias x
  check_err "attempt<1 rejected"      1 1 1 1 1 1 --attempt 0

  printf '\n%d/%d passed\n' "$(( total - fails ))" "$total"
  [ "$fails" -eq 0 ]
}

# ---- arg parse ----
[ $# -eq 0 ] && die "need six digits J V B N S X (or --test); see docs/capability.md"

bias=""; attempt=1; digits=""
while [ $# -gt 0 ]; do
  case "$1" in
    --test) run_tests; exit $? ;;
    -h|--help) sed -n '2,11p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    --bias)    shift; bias=$1;    is_uint "${bias:-}"    || die "--bias needs a non-negative integer";;
    --attempt) shift; attempt=$1; is_uint "${attempt:-}" || die "--attempt needs a positive integer";;
    --current-model) shift; CURRENT_MODEL=$1; [ -n "${CURRENT_MODEL:-}" ] || die "--current-model needs a provider/id";;
    -*) die "unknown flag: $1" ;;
    *)  digits="$digits $1" ;;
  esac
  shift
done

# resolve bias: flag > env > default 2
if [ -z "$bias" ]; then
  if [ -n "${CAP_EFFORT_BIAS:-}" ]; then
    is_uint "$CAP_EFFORT_BIAS" || die "CAP_EFFORT_BIAS must be a non-negative integer"
    bias=$CAP_EFFORT_BIAS
  else bias=2; fi
fi
[ "$attempt" -ge 1 ] || die "--attempt needs a positive integer"

if [ -z "$CURRENT_MODEL" ] && [ -n "${CAP_CURRENT_MODEL:-}" ]; then CURRENT_MODEL=$CAP_CURRENT_MODEL; fi
setup_models

# shellcheck disable=SC2086
set -- $digits
[ $# -eq 6 ] || die "need exactly six digits J V B N S X, got $#"
for d in "$@"; do
  is_uint "$d" && [ "$d" -le 2 ] || die "digit out of range (0-2): $d"
done
j=$1 v=$2 b=$3 n=$4 s=$5 x=$6
sum=$(( j + v + b + n + s + x ))

label="CAP: J$j V$v B$b N$n S$s X$x = $sum"
[ "$bias" -ne 0 ] && label="$label +b$bias"
res=$(resolve "$j" "$v" "$b" "$n" "$s" "$x" "$bias" "$attempt")
if [ "$res" = "STOP" ]; then
  printf '%s → STOP (attempt %s: escalate to user with failure trail)\n' "$label" "$attempt"
else
  line="$label → $res"
  [ "$attempt" -gt 1 ] && line="$line [attempt $attempt]"
  printf '%s\n' "$line"
fi
