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
real_bun=$(command -v bun)
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
  if [ "$code" -eq 0 ]; then
    check "host_hint_$cases" test "$(PATH="$read_path" celetis_config_host "$repo")" = "$(jq -r '.host // "claude"' <<<"$out")"
  fi
}

run_host() {
  code=0
  out=$(PATH="$read_path" celetis_config_host "$repo" 2>"$tmp/err") || code=$?
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
printf 'landing: pr\ncustom:\n  bug: |\n    Keep' >"$repo/.celetis.yaml"
valid literal_ends_the_file '{"landing":"pr","custom":{"bug":"Keep"}}'
printf 'landing: pr\ncustom:\n  bug: |+\n    Keep' >"$repo/.celetis.yaml"
valid literal_keep_ends_the_file '{"landing":"pr","custom":{"bug":"Keep"}}'
printf 'landing: pr\ncustom:\n  bug: |\n    Keep\n      ' >"$repo/.celetis.yaml"
valid literal_spaces_end_the_file '{"landing":"pr","custom":{"bug":"Keep\n  "}}'
printf 'landing: pr\ncustom:\n  bug: |\n    Keep\n    ' >"$repo/.celetis.yaml"
valid literal_indent_ends_the_file '{"landing":"pr","custom":{"bug":"Keep\n"}}'
printf 'landing: pr\ncustom:\n  bug: |\n    Keep\r' >"$repo/.celetis.yaml"
valid literal_carriage_return_ends_the_file '{"landing":"pr","custom":{"bug":"Keep\n"}}'
printf 'landing: pr\ncustom:\n  bug: "Keep\\n"' >"$repo/.celetis.yaml"
valid quoted_break_ends_the_file '{"landing":"pr","custom":{"bug":"Keep\n"}}'
printf 'landing: pr\ncustom:\n  bug: |\n    \ta\n' >"$repo/.celetis.yaml"
valid literal_tab_after_indent '{"landing":"pr","custom":{"bug":"\ta\n"}}'
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
check skill_inventory_count test "$inventory" -eq 19
check all_skill_values_retained jq -e '.custom | length == 19 and all(.[]; . == "Instruction.")' <<<"$out"

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
mkdir "$tmp/reader"
cp "$launcher" "$tmp/reader/celetis"
cp -R "$here/../scripts/lib" "$tmp/reader/lib"
chmod 755 "$tmp" "$repo"
chmod 000 "$repo/.celetis.yaml"
denied=0
perl -e 'open my $f, "<", $ARGV[0] or exit 1; exit 0' "$repo/.celetis.yaml" 2>"$tmp/probe-err" || denied=$?
if [ "$denied" -eq 0 ] && [ "$(id -u)" -eq 0 ]; then
  mkdir "$tmp/nobody-bin"
  cp "$(command -v bun)" "$tmp/nobody-bin/bun"
  chmod -R a+rX "$tmp/reader" "$tmp/nobody-bin"
  denied=0
  perl -e '$< = $> = 65534; open my $f, "<", $ARGV[0] or exit 1; exit 0' "$repo/.celetis.yaml" 2>"$tmp/probe-err" || denied=$?
  code=0
  out=$(PATH="$tmp/nobody-bin:$PATH" perl -e '$< = $> = 65534; exec @ARGV or die $!' /bin/bash -c 'source "$1"; celetis_config_read "$2"' _ "$tmp/reader/celetis" "$repo" 2>"$tmp/err") || code=$?
  err=$(cat "$tmp/err")
else
  run_read
fi
check permission_fixture_denies_actual_read test "$denied" -ne 0
check unreadable_config invalid_result 'cannot open the file'
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
for port in 08080 09999 +08080; do
  invalid "leading_zero_port_$port" board.port < <(printf 'landing: pr\nboard: {port: %s}\n' "$port")
done
check leading_zero_port_message test "$err" = "celetis: $repo/.celetis.yaml: board.port: need an integer"
printf 'landing: pr\nboard: {port: 04404}\n' >"$repo/.celetis.yaml"
valid leading_zero_port_without_8_or_9 '{"landing":"pr","board":{"port":4404}}'
for tag in '!!null' '!<tag:yaml.org,2002:null>' '!!seq'; do
  invalid "collection_tag_$tag" gates < <(printf 'landing: pr\ngates: %s {plan: me}\n' "$tag")
done
invalid collection_tag_block gates < <(printf 'landing: pr\ngates: !!null\n  plan: me\n')
invalid collection_tag_slots codexProfiles.r.slots < <(printf 'landing: pr\ncodexProfiles: {r: {slots: !!null [a, a, a, a], reviewer: {rank: 1, effort: low}}}\n')
check collection_tag_message test "$err" = "celetis: $repo/.celetis.yaml: codexProfiles.r.slots: unsupported YAML tag"
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
invalid invalid_utf8 '<document>' < <(printf 'landing: pr\ncustom: {bug: "\377"}\n')
invalid raw_escape '<document>' < <(printf 'landing: pr\ncustom:\n  bug: |\n    a\033b\n')
invalid line_separator '<document>' < <(printf 'landing: pr\ncustom:\n  bug: |\n    a\342\200\250b\n')
invalid underscore_port board.port < <(printf 'landing: pr\nboard: {port: 4_404}\n')
for value in '!!float 12' '!!int abc' '!!bool yes' '!!null abc'; do
  invalid "unresolved_tag_$value" custom.bug < <(printf 'landing: pr\ncustom: {bug: %s}\n' "$value")
done
for probe in underscore_text:1_000 binary_text:0b101 upper_hex_text:0X1A signed_hex_text:-0x1A underscore_float_text:1_0.5; do
  invalid "${probe%%:*}" custom.bug < <(printf 'landing: pr\ncustom: {bug: %s}\n' "${probe#*:}")
done
check yaml_1_1_number_message test "$err" = "celetis: $repo/.celetis.yaml: custom.bug: quote this value: YAML 1.1 reads it as a number"
cat >"$repo/.celetis.yaml" <<'EOF'
landing: pr
custom: {bug: '1_000', plan: !!str 0b101}
EOF
valid quoted_yaml_1_1_number '{"landing":"pr","custom":{"bug":"1_000","plan":"0b101"}}'
printf 'landing: pr\ncustom: {bug: _1}\n' >"$repo/.celetis.yaml"
valid leading_underscore_text '{"landing":"pr","custom":{"bug":"_1"}}'
invalid underscore_slot codexProfiles.r.slots.0 < <(printf 'landing: pr\ncodexProfiles: {r: {slots: [1_000, a, a, a], reviewer: {rank: 1, effort: low}}}\n')
invalid underscore_runtime_key codexProfiles.1_000 < <(printf 'landing: pr\ncodexProfiles: {1_000: {slots: [a, a, a, a], reviewer: {rank: 1, effort: low}}}\n')
invalid merge_runtime_key 'codexProfiles.<<: mapping keys must be strings' < <(printf 'landing: pr\ncodexProfiles:\n  <<: {slots: [a, a, a, a], reviewer: {rank: 1, effort: low}}\n')
invalid merge_value_text 'custom.bug: unsupported YAML tag' < <(printf 'landing: pr\ncustom: {bug: <<}\n')
invalid lone_surrogate custom.bug < <(printf 'landing: pr\ncustom: {bug: "\\ud800"}\n')
check lone_surrogate_message test "$err" = "celetis: $repo/.celetis.yaml: custom.bug: invalid character U+D800"
printf '%%YAML 1.1\n---\nlanding: pr\nworktreeSetup: yes\n' >"$repo/.celetis.yaml"
valid yaml_1_1_directive_keeps_strings '{"landing":"pr","worktreeSetup":"yes"}'
floor=$(sed -n 's/^celetis_bun_floor=//p' "$launcher")
check bun_floor_is_set test -n "$floor"
check bun_floor_agrees test "$floor" = "$(sed -n "s/^const floor = [\"']\(.*\)[\"'];\$/\1/p" "$here/../scripts/lib/config.ts")"

mkdir "$tmp/start"
printf 'preload = ["./mark.js"]\n' >"$tmp/start/bunfig.toml"
printf 'require("node:fs").writeFileSync(process.env.START_MARK, "ran")\n' >"$tmp/start/mark.js"
printf 'CELETIS_START=loaded\n' >"$tmp/start/.env"
export START_MARK="$tmp/start-ran"
printf 'landing: pr\n' >"$repo/.celetis.yaml"
start_out=$(cd "$tmp/start" && celetis_config_read "$repo" && celetis_config_host "$repo")
check start_folder_has_no_effect test "$start_out" = $'{"landing":"pr"}\nclaude'
check start_folder_preload_did_not_run test ! -e "$START_MARK"
(cd "$tmp/start" && bun -e 1)
check start_folder_control_runs_the_preload test -e "$START_MARK"

mkdir "$tmp/cache"
cache_out=$(
  export HOME="$tmp/cache" XDG_CACHE_HOME="$tmp/cache"
  unset BUN_RUNTIME_TRANSPILER_CACHE_PATH
  celetis_config_read "$repo"
)
check read_writes_no_cache_file test "$cache_out:$(find "$tmp/cache" ! -type d)" = '{"landing":"pr"}:'

mkdir -p "$tmp/copy/scripts"
cp "$launcher" "$tmp/copy/scripts/celetis"
code=0
out=$(/bin/bash -c 'source "$1"; celetis_config_read "$2"' _ "$tmp/copy/scripts/celetis" "$repo" 2>"$tmp/err") || code=$?
check product_copy_names_the_plugin_launcher test "$code:$out" = '2:'
check product_copy_message grep -qF 'source the launcher of the plugin, $(scripts/celetis root)/scripts/celetis' "$tmp/err"

mkdir "$tmp/args"
cat >"$tmp/args/bun" <<'EOF'
#!/bin/sh
printf '%s\n' "$@"
EOF
chmod +x "$tmp/args/bun"
# shellcheck disable=SC2154 # scripts/celetis sets celetis_reader
for drive in 'C:/Users/me/repo' 'c:\Users\me\repo'; do
  out=$(PATH="$tmp/args:$base_path" celetis_config_run "$celetis_reader" "$drive")
  check "drive_path_$drive" test "$out" = "$celetis_reader"$'\n'"$drive"
done

printf 'landing: pr\n' >"$repo/.celetis.yaml"
read_path="$tmp/no-parser"
run_read
check missing_bun invalid_result 'need Bun >=1.4.2 on PATH'
read_path="$tmp/parser:$base_path"
cat >"$tmp/parser/bun" <<'EOF'
#!/bin/bash
exec "$REAL_BUN" --define "Bun.version:\"$FAKE_BUN_VERSION\"" "$@"
EOF
chmod +x "$tmp/parser/bun"
export REAL_BUN="$real_bun" FAKE_BUN_VERSION
for version in 0.9.0 1.2.10 1.4.1 1.4.2-canary.1; do
  FAKE_BUN_VERSION=$version
  run_read
  check "old_bun_$version" invalid_result "need Bun >=1.4.2 on PATH, found $version"
  run_host
  check "old_bun_host_hint_$version" invalid_result "need Bun >=1.4.2 on PATH, found $version"
done
for version in 1.4.3 1.5.0-canary.1 2.0.0; do
  FAKE_BUN_VERSION=$version
  valid "newer_bun_$version" '{"landing":"pr"}'
done
mkdir "$tmp/broken"
printf '#!/bin/sh\nexit 1\n' >"$tmp/broken/bun"
chmod +x "$tmp/broken/bun"
read_path="$tmp/broken:$base_path"
run_read
check broken_bun invalid_result 'Bun stopped with exit 1'
run_host
check broken_bun_host_hint invalid_result 'Bun stopped with exit 1'

mkdir "$tmp/swap"
cat >"$tmp/swap.mjs" <<'EOF'
import fs from "node:fs";
const open = fs.openSync;
fs.openSync = (path, ...rest) => {
  if (String(path) === process.env.SWAP_FILE) fs.renameSync(process.env.SWAP_FROM, process.env.SWAP_FILE);
  return open(path, ...rest);
};
EOF
printf '#!/bin/bash\nexec "$REAL_BUN" --preload "$SWAP_PRELOAD" "$@"\n' >"$tmp/swap/bun"
chmod +x "$tmp/swap/bun"
printf 'landing: pr\n' >"$repo/.celetis.yaml"
printf 'landing: merge\n' >"$tmp/other.yaml"
read_path="$tmp/swap:$base_path" SWAP_FILE="$repo/.celetis.yaml" SWAP_FROM="$tmp/other.yaml" SWAP_PRELOAD="$tmp/swap.mjs" run_read
check file_changed_during_read invalid_result 'the file changed during the read'

printf '%s cases; %s failures\n' "$cases" "$fails"
[ "$fails" -eq 0 ]
