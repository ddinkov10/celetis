#!/usr/bin/env bash
set -eu
here=$(cd "$(dirname "$0")" && pwd)
launcher="$here/../scripts/celetis"
tmp=$(mktemp -d)
trap 'chmod -R u+rwX "$tmp"; rm -rf "$tmp"' EXIT
repo="$tmp/repo dir"
mkdir -p "$repo" "$tmp/no-parser" "$tmp/parser"
repo=$(cd "$repo" && pwd -P)
git -C "$repo" init -q
git -C "$repo" -c user.name=Fixture -c user.email=fixture@example.test commit --allow-empty -qm fixture
fails=0
cases=0
real_yq=$(command -v yq)
base_path=$PATH
read_path=$PATH

check() {
  local name=$1
  shift
  cases=$((cases + 1))
  if "$@" >/dev/null; then
    printf 'ok   %s\n' "$name"
  else
    printf 'FAIL %s\n' "$name"
    fails=$((fails + 1))
  fi
}

run_read() {
  code=0
  out=$(PATH="$read_path" celetis_config_read "$repo" 2>"$tmp/err") || code=$?
  err=$(cat "$tmp/err")
}

valid() {
  local name=$1 want=$2
  run_read
  check "$name" test "$code:$out:$err" = "0:$want:"
}

invalid_result() {
  local field=$1
  [ "$code" -eq 2 ] && [ -z "$out" ] &&
    [[ $err == *"$repo/.celetis.yaml"* && $err == *"$field"* ]]
}

invalid() {
  local name=$1 field=$2
  cat >"$repo/.celetis.yaml"
  run_read
  check "$name" invalid_result "$field"
}

source_out=$(PATH="$tmp/no-parser" /bin/bash -c 'source "$1"' _ "$launcher" 2>"$tmp/err")
check source_does_not_discover test -z "$source_out$(cat "$tmp/err")"
source "$launcher"
if ! declare -F celetis_config_main >/dev/null; then
  check celetis_config_main_exists false
fi
if ! declare -F celetis_config_read >/dev/null; then
  check celetis_config_read_exists false
  exit 1
fi

main=$(cd "$repo" && celetis_config_main)
check main_checkout test "$main" = "$repo"
mkdir "$repo/subdir"
main=$(cd "$repo/subdir" && celetis_config_main)
check main_from_subdir test "$main" = "$repo"
git -C "$repo" worktree add -qb lane "$tmp/lane dir"
main=$(cd "$tmp/lane dir" && celetis_config_main)
check main_from_lane test "$main" = "$repo"
code=0
main=$(cd "$tmp" && celetis_config_main 2>"$tmp/err") || code=$?
check main_git_failure test "$code" -ne 0
check main_git_failure_stdout test -z "$main"

cat >"$repo/.celetis.yaml" <<'EOF'
host: codex
landing: pr
board:
  port: 4404
EOF
minimal='{"host":"codex","landing":"pr","board":{"port":4404}}'
valid minimal_config "$minimal"
check absent_optional_keys jq -e 'has("gates") or has("custom") or has("worktreeSetup") or has("codexProfiles") | not' <<<"$out"
cat >"$repo/.celetis.yaml" <<'EOF'
# Repository defaults.
host: codex # Selected host.
landing: pr
board:
  port: 4404
EOF
valid comments "$minimal"
printf 'landing: merge\n' >"$repo/.celetis.yaml"
valid no_reader_defaults '{"landing":"merge"}'
cat >"$repo/.celetis.yaml" <<'EOF'
%YAML 1.2
---
landing: pr
worktreeSetup: yes
custom:
  bug: on
EOF
valid yaml_1_2_strings '{"landing":"pr","worktreeSetup":"yes","custom":{"bug":"on"}}'
cat >"$repo/.celetis.yaml" <<'EOF'
landing: pr
worktreeSetup: |
  A "quote" and \path.
custom:
  bug: |-
    A "quote" and \path.
  plan: |+
    Добър ден.

    End.


EOF
run_read
check literal_bytes test "$(printf '%s' "$out" | jq -c .worktreeSetup)" = '"A \"quote\" and \\path.\n"'
check literal_strip test "$(printf '%s' "$out" | jq -c .custom.bug)" = '"A \"quote\" and \\path."'
printf 'Добър ден.\n\nEnd.\n\n\n' >"$tmp/literal-want"
printf '%s' "$out" | jq -j .custom.plan >"$tmp/literal-got"
check literal_unicode_blank_trailing_lines cmp -s "$tmp/literal-want" "$tmp/literal-got"
cat >"$repo/.celetis.yaml" <<'EOF'
landing: pr
worktreeSetup: ""
gates: {}
board: {}
custom: {}
codexProfiles: {}
EOF
valid empty_optional_values '{"landing":"pr","worktreeSetup":"","gates":{},"board":{},"custom":{},"codexProfiles":{}}'
export CONFIG_EXECUTION_MARKER="$tmp/executed"
cat >"$repo/.celetis.yaml" <<'EOF'
landing: pr
worktreeSetup: |
  touch "$CONFIG_EXECUTION_MARKER"
EOF
run_read
check setup_is_data test "$code:$err" = '0:'
check setup_is_not_executed test ! -e "$CONFIG_EXECUTION_MARKER"
cat >"$repo/.celetis.yaml" <<'EOF'
landing: merge
host: claude
board: {port: 1024}
gates: {triage: me, specify: auto, bug: me, chore: auto, hotfix: me, plan: auto, implement: me}
codexProfiles:
  codex-desktop:
    slots: [gpt-6-luna, gpt-6.1-sol, org/model-v2, gpt-6-astra]
    reviewer: {rank: 3, effort: xhigh}
EOF
run_read
check complete_config test "$code:$err" = '0:'
check profile_has_no_added_fields jq -e '.codexProfiles["codex-desktop"] | keys == ["reviewer","slots"]' <<<"$out"
for port in 4403 65535; do
  printf 'landing: pr\nboard: {port: %s}\n' "$port" >"$repo/.celetis.yaml"
  run_read
  check "integer_port_$port" test "$code:$err" = '0:'
done
printf 'landing: pr\ncustom:\n' >"$repo/.celetis.yaml"
inventory=0
for file in "$here"/../skills/*/SKILL.md; do
  skill=$(basename "$(dirname "$file")")
  printf '  %s: "Instruction."\n' "$skill" >>"$repo/.celetis.yaml"
  inventory=$((inventory + 1))
done
run_read
check current_skill_allowlist test "$code:$err" = '0:'
check skill_inventory_count test "$inventory" -eq 18
check all_skill_values_retained jq -e '.custom | length == 18 and all(.[]; . == "Instruction.")' <<<"$out"

rm "$repo/.celetis.yaml"
run_read
check missing_config invalid_result '<document>'
mkdir "$repo/.celetis.yaml"
run_read
check directory_config invalid_result '<document>'
rmdir "$repo/.celetis.yaml"
mkfifo "$repo/.celetis.yaml"
run_read
check fifo_config invalid_result '<document>'
rm "$repo/.celetis.yaml"
printf 'landing: pr\n' >"$tmp/external.yaml"
ln -s "$tmp/external.yaml" "$repo/.celetis.yaml"
run_read
check symlink_config invalid_result '<document>'
rm "$repo/.celetis.yaml"
printf 'landing: pr\n' >"$repo/.celetis.yaml"
cp "$launcher" "$tmp/reader"
chmod 755 "$tmp" "$repo"
chmod 000 "$repo/.celetis.yaml"
denied=0
perl -e 'open my $f, "<", $ARGV[0] or exit 1; exit 0' "$repo/.celetis.yaml" 2>"$tmp/probe-err" || denied=$?
if [ "$denied" -eq 0 ] && [ "$(id -u)" -eq 0 ]; then
  denied=0
  perl -e '$< = $> = 65534; open my $f, "<", $ARGV[0] or exit 1; exit 0' "$repo/.celetis.yaml" 2>"$tmp/probe-err" || denied=$?
  code=0
  out=$(perl -e '$< = $> = 65534; exec @ARGV or die $!' /bin/bash -c 'source "$1"; celetis_config_read "$2"' _ "$tmp/reader" "$repo" 2>"$tmp/err") || code=$?
  err=$(cat "$tmp/err")
else
  run_read
fi
check permission_fixture_denies_actual_read test "$denied" -ne 0
check unreadable_config invalid_result '<document>'
chmod 600 "$repo/.celetis.yaml"

invalid empty_config '<document>' </dev/null
invalid malformed_yaml '<document>' <<'EOF'
landing: [pr
EOF
invalid two_documents '<document>' <<'EOF'
landing: pr
---
landing: merge
EOF
invalid empty_second_document '<document>' <<'EOF'
landing: pr
---
EOF
invalid sequence_root '<document>' <<'EOF'
- landing
- pr
EOF
invalid null_root '<document>' <<'EOF'
null
EOF
invalid duplicate_root landing <<'EOF'
landing: pr
landing: merge
EOF
invalid duplicate_nested board.port <<'EOF'
landing: pr
board: {port: 4403, port: 4404}
EOF
invalid duplicate_profile codexProfiles.desktop.slots <<'EOF'
landing: pr
codexProfiles:
  desktop:
    slots: [a, b, c, d]
    slots: [a, b, c, e]
    reviewer: {rank: 1, effort: medium}
EOF
invalid numeric_key 12 <<'EOF'
landing: pr
12: value
EOF
invalid complex_key '<document>' <<'EOF'
landing: pr
? [a, b]
: value
EOF
invalid boolean_key true <<'EOF'
landing: pr
true: value
EOF
invalid unknown_root extra <<'EOF'
landing: pr
extra: value
EOF
invalid unknown_board board.extra <<'EOF'
landing: pr
board: {port: 4403, extra: value}
EOF
invalid unknown_step gates.feature <<'EOF'
landing: pr
gates: {feature: me}
EOF
invalid unknown_skill custom.missing <<'EOF'
landing: pr
custom: {missing: text}
EOF
for field in host landing gates board worktreeSetup custom codexProfiles; do
  invalid "null_$field" "$field" < <(
    [ "$field" = landing ] || printf 'landing: pr\n'
    printf '%s: null\n' "$field"
  )
done
for port in '"4403"' true 4403.5 4403.0 1023 65536; do
  invalid "invalid_port_$port" board.port < <(printf 'landing: pr\nboard: {port: %s}\n' "$port")
done
invalid invalid_host host <<'EOF'
landing: pr
host: other
EOF
invalid invalid_landing landing <<'EOF'
landing: auto
EOF
invalid missing_landing landing <<'EOF'
host: codex
EOF
invalid invalid_gate gates.bug <<'EOF'
landing: pr
gates: {bug: manual}
EOF
invalid gate_type gates <<'EOF'
landing: pr
gates: [bug]
EOF
invalid board_type board <<'EOF'
landing: pr
board: 4403
EOF
invalid script_array worktreeSetup <<'EOF'
landing: pr
worktreeSetup: [echo, hi]
EOF
invalid instruction_array custom.bug <<'EOF'
landing: pr
custom: {bug: [one, two]}
EOF
invalid null_instruction custom.bug <<'EOF'
landing: pr
custom: {bug: null}
EOF
invalid null_gate gates.bug <<'EOF'
landing: pr
gates: {bug: null}
EOF
invalid null_port board.port <<'EOF'
landing: pr
board: {port: null}
EOF
invalid custom_type custom <<'EOF'
landing: pr
custom: [bug]
EOF
invalid nul_script worktreeSetup <<'EOF'
landing: pr
worktreeSetup: "one\0two"
EOF
invalid nul_instruction custom.bug <<'EOF'
landing: pr
custom: {bug: "one\0two"}
EOF
invalid folded_script worktreeSetup <<'EOF'
landing: pr
worktreeSetup: >
  echo one
  echo two
EOF
invalid folded_instruction custom.bug <<'EOF'
landing: pr
custom:
  bug: >-
    one
    two
EOF
invalid custom_tag host <<'EOF'
landing: pr
host: !host codex
EOF
invalid timestamp_tag custom.bug <<'EOF'
landing: pr
custom: {bug: 2026-10-16}
EOF
invalid binary_tag custom.bug <<'EOF'
landing: pr
custom: {bug: !!binary SGVsbG8=}
EOF
invalid alias_value host <<'EOF'
landing: pr
worktreeSetup: &selected codex
host: *selected
EOF
invalid merge_key board <<'EOF'
landing: pr
board:
  <<: {port: 4403}
EOF
for number in .nan .inf -.Inf; do
  invalid "nonfinite_$number" board.port < <(printf 'landing: pr\nboard: {port: %s}\n' "$number")
done
invalid empty_runtime codexProfiles <<'EOF'
landing: pr
codexProfiles:
  "": {slots: [a, b, c, d], reviewer: {rank: 1, effort: medium}}
EOF
invalid profile_type codexProfiles.desktop <<'EOF'
landing: pr
codexProfiles: {desktop: null}
EOF
for key in schema runtime models extra; do
  invalid "unknown_profile_$key" "codexProfiles.desktop.$key" < <(
    printf 'landing: pr\ncodexProfiles:\n  desktop:\n    slots: [a, b, c, d]\n    reviewer: {rank: 1, effort: medium}\n    %s: x\n' "$key"
  )
done
for slots in 'null' '[a, b, c]' '[a, b, c, d, e]' '[a, b, c, ""]' '[a, b, c, true]' '[a, b, c, "not a model"]' '[a, b, c, "d\n"]'; do
  invalid "invalid_slots_$slots" codexProfiles.desktop.slots < <(
    printf 'landing: pr\ncodexProfiles:\n  desktop:\n    slots: %s\n    reviewer: {rank: 1, effort: medium}\n' "$slots"
  )
done
for rank in null '"1"' true 1.5 -1 4; do
  invalid "invalid_reviewer_rank_$rank" codexProfiles.desktop.reviewer.rank < <(
    printf 'landing: pr\ncodexProfiles:\n  desktop:\n    slots: [a, b, c, d]\n    reviewer: {rank: %s, effort: medium}\n' "$rank"
  )
done
invalid invalid_reviewer_effort codexProfiles.desktop.reviewer.effort <<'EOF'
landing: pr
codexProfiles:
  desktop: {slots: [a, b, c, d], reviewer: {rank: 1, effort: max}}
EOF
invalid unknown_reviewer_key codexProfiles.desktop.reviewer.extra <<'EOF'
landing: pr
codexProfiles:
  desktop: {slots: [a, b, c, d], reviewer: {rank: 1, effort: medium, extra: x}}
EOF
invalid null_reviewer codexProfiles.desktop.reviewer <<'EOF'
landing: pr
codexProfiles:
  desktop: {slots: [a, b, c, d], reviewer: null}
EOF
invalid null_reviewer_effort codexProfiles.desktop.reviewer.effort <<'EOF'
landing: pr
codexProfiles:
  desktop: {slots: [a, b, c, d], reviewer: {rank: 1, effort: null}}
EOF
invalid missing_slots codexProfiles.desktop.slots <<'EOF'
landing: pr
codexProfiles:
  desktop: {reviewer: {rank: 1, effort: medium}}
EOF
invalid missing_reviewer codexProfiles.desktop.reviewer <<'EOF'
landing: pr
codexProfiles:
  desktop: {slots: [a, b, c, d]}
EOF
invalid missing_reviewer_rank codexProfiles.desktop.reviewer.rank <<'EOF'
landing: pr
codexProfiles:
  desktop: {slots: [a, b, c, d], reviewer: {effort: medium}}
EOF
invalid missing_reviewer_effort codexProfiles.desktop.reviewer.effort <<'EOF'
landing: pr
codexProfiles:
  desktop: {slots: [a, b, c, d], reviewer: {rank: 1}}
EOF

for tool in jq perl mktemp rm dirname cat; do
  ln -s "$(command -v "$tool")" "$tmp/no-parser/$tool"
done
printf 'landing: pr\n' >"$repo/.celetis.yaml"
read_path="$tmp/no-parser"
run_read
check missing_parser invalid_result yq
read_path="$tmp/parser:$base_path"
cat >"$tmp/parser/yq" <<'EOF'
#!/bin/bash
if [ "$1" = --version ]; then
  printf '%s\n' "$PARSER_VERSION"
else
  exec "$REAL_YQ" "$@"
fi
EOF
chmod +x "$tmp/parser/yq"
export REAL_YQ="$real_yq" PARSER_VERSION
for version in 'yq 3.4.3' 'yq (https://github.com/mikefarah/yq/) version v3.4.1' 'yq (https://github.com/mikefarah/yq/) version v5.0.0' 'yq (https://github.com/mikefarah/yq/) version v4.54.0' 'yq (https://github.com/mikefarah/yq/) version v4.53.9'; do
  PARSER_VERSION=$version
  run_read
  check "unsupported_parser_$version" invalid_result yq
done
PARSER_VERSION='yq (https://github.com/mikefarah/yq/) version v4.55.0'
valid newer_v4_parser '{"landing":"pr"}'

cat >"$repo/.celetis.yaml" <<'EOF'
host: codex
landing: pr
board: {port: 4404}
EOF
export CONFIG_FILE="$repo/.celetis.yaml" PARSER_MARKER="$tmp/parser-used"
cat >"$tmp/parser/yq" <<'EOF'
#!/bin/bash
"$REAL_YQ" "$@"
code=$?
if [ "$1" != --version ] && [ ! -e "$PARSER_MARKER" ]; then
  printf 'landing: pr\nlanding: merge\n' >"$CONFIG_FILE"
  : >"$PARSER_MARKER"
fi
exit "$code"
EOF
valid single_snapshot "$minimal"

printf '%s cases; %s failures\n' "$cases" "$fails"
[ "$fails" -eq 0 ]
