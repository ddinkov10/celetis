#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
root=$PWD
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
mkdir -p "$tmp/bin"
cat >"$tmp/bin/claude" <<'MOCK'
#!/usr/bin/env bash
set -eu
if [ -n "${MANUAL_CALLS:-}" ]; then printf 'called\n' >>"$MANUAL_CALLS"; fi
if [ "${1:-}" = --version ]; then echo 'manual fixture'; exit 0; fi
answer=
while [ $# -gt 0 ]; do
  case $1 in --output-last-message) answer=$2; shift ;; esac
  shift
done
prompt=$(cat)
k=$(printf '%s\n' "$prompt" | sed -n 's/^Case \([0-9][0-9]*\).*/\1/p')
case $prompt in *'A person started the session by hand'*) mode=hand ;; *) mode=step ;; esac
if [ -n "${MANUAL_INPUTS:-}" ]; then printf '%s\n' "$prompt" >"$MANUAL_INPUTS/received-$k-$mode"; fi
out='Then: my step ends'
if [ "$mode" = step ]; then
  case $k in
    1 | 2 | 18 | 19) out=$'## Stopped\ngh issue edit 7 --add-label ready-for-human\nThen: my step ends' ;;
    20) out=$'Fallback: NONE\nIssue: NOT POSTED\nTools: none\nLimit: no usable native file-only reader or checkout locator, and no shell\nSetup: enable native file metadata and whole-file reads for the product checkout\nThen: my step ends' ;;
    3) out=$'## Landing refused\ngh issue edit 7 --add-label ready-for-human\nThen: my step ends' ;;
    4 | 8) out=$'## Before landing\ngh issue comment 7 --body-file /tmp/reason\ngh issue edit 7 --remove-label ready-for-agent --add-label ready-for-human\nThen: my step ends' ;;
    5 | 7 | 15) out='Then: I wait for the person' ;;
    6) out=$'Fix the cause\ngh issue edit 7 --add-label ready-for-human\nThen: my step ends' ;;
    9) out=$'gh issue edit 7 --add-label needs-info\nThen: my step ends' ;;
    10 | 17)
      if [ -n "$answer" ]; then out=$'scripts/celetis --agent codex land 7 subject\nThen: my step ends'
      else out=$'scripts/celetis --agent claude land 7 subject\nThen: my step ends'; fi ;;
    11) out=$'gh issue edit 7 --add-label ready-for-agent\nDuring the build: HUMAN_PREP_11\nAfter the landing: HAND_CHECK_11\nRun /celetis:implement #7 in a fresh context.\nThen: my step ends' ;;
    13 | 16) out=$'gh issue edit 7 --add-label ready-for-human\nThen: my step ends' ;;
    12) out=$'gh issue edit 7 --add-label bug\nThen: my step ends' ;;
    14) out='Then: I go on with the repair and Verify loop' ;;
    21) out=$'The landing is done. Run git pull on main in the main checkout yourself:\nland: the main checkout did not move to origin/main; run git pull on main there\nland: cannot close the epic #3; close it by hand\nThen: my step ends' ;;
  esac
  if [ "$k" = 4 ]; then
    case ${MANUAL_FAULT:-} in
      land-bare) out="$out"$'\nscripts/celetis land 7 subject' ;;
      land-claude) out="$out"$'\nscripts/celetis --agent claude land 7 subject' ;;
      land-codex) out="$out"$'\nscripts/celetis --agent codex land 7 subject' ;;
      exit) exit 1 ;;
    esac
  fi
fi
if [ "$mode" = step ] && [ "$k" = 13 ] && [ "${MANUAL_FAULT:-}" = no-completion-land ]; then
  out="$out"$'\nscripts/celetis --agent codex land 7 subject'
fi
if [ "${MANUAL_STYLE:-}" = fenced-named ]; then
  case "$mode:$k" in
    step:13) out=$'```\ngh issue edit 7 --add-label ready-for-human\n```\n\nThen: my step ends' ;;
    step:20) out=$'```\nFallback: NONE\nIssue: NOT POSTED\nTools: `Glob`, `Grep`, `Read`\nLimit: no tool locates the checkout or reads the config, and no shell runs gh\nSetup: enable `Glob`, `Grep`, and `Read` for this checkout\n```\nThen: my step ends' ;;
  esac
fi
case "$mode:$k:${MANUAL_FAULT:-}" in
  step:18:invalid-config-continue) out='Then: I go on with the skill' ;;
  step:18:entry-setup) out="$out"$'\nbash -c "$worktreeSetup"' ;;
  step:19:denied-entry-retry) out="$out"$'\ncat .celetis.yaml' ;;
  step:20:form-fallback) out=${out/Fallback: NONE/Fallback: cat .celetis.yaml} ;;
  step:20:form-posted) out=${out/Issue: NOT POSTED/Issue: POSTED} ;;
  step:20:form-continue) out=${out/Then: my step ends/Then: I go on with guide} ;;
  step:20:form-two-endings) out="$out"$'\nThen: my step ends' ;;
  step:20:form-extra-act) out="$out"$'\ngh issue edit 7 --add-label ready-for-human' ;;
  step:20:form-empty-tools) out=${out/Tools: none/Tools:} ;;
  step:20:form-empty-limit) out=${out/Limit: no usable native file-only reader or checkout locator, and no shell/Limit:} ;;
  step:20:form-empty-setup) out=${out/Setup: enable native file metadata and whole-file reads for the product checkout/Setup:} ;;
  step:20:form-markdown) out=${out/Fallback: NONE/**Fallback:** NONE} ;;
  step:20:form-prose) out=$'File-only config entry is BLOCKED: no usable native file reader or checkout locator exists.\nShell access is absent, so I cannot run gh to report this issue.\nEnable native file metadata and full-file reads for the product checkout.\nThen: my step ends' ;;
  step:20:form-two-faults) out=${out/Fallback: NONE/Fallback: cat .celetis.yaml}; out=${out/Issue: NOT POSTED/Issue: POSTED} ;;
  step:21:landed-git) out="git pull --ff-only origin main"$'\n'"$out" ;;
  step:21:landed-git-list) out=$'1. git switch main\n'"$out" ;;
  step:21:landed-stop) out=$'## Stopped\nland: the main checkout did not move to origin/main; run git pull on main there\nland: cannot close the epic #3; close it by hand\ngh issue edit 7 --add-label ready-for-human\nThen: my step ends' ;;
  step:21:landed-silent) out='Then: my step ends' ;;

  step:11:plan-no-lists) out=$'gh issue edit 7 --add-label ready-for-agent\nRun /celetis:implement #7 in a fresh context.\nThen: my step ends' ;;
  step:11:plan-lists-late) out=$'gh issue edit 7 --add-label ready-for-agent\nRun /celetis:implement #7 in a fresh context.\nDuring the build: HUMAN_PREP_11\nAfter the landing: HAND_CHECK_11\nThen: my step ends' ;;
  step:13:fenced-extra-action) out=$'```\ngh issue edit 7 --add-label ready-for-human\ngit apply /tmp/repair.patch\n```\nThen: my step ends' ;;
  step:13:bound-stop) out="cd '$MANUAL_BINDING_DIR' && $out" ;;
  step:13:wrong-bound-stop) out="cd '/tmp/wrong-product' && $out" ;;
  step:13:bound-work-stop) out="cd '$MANUAL_BINDING_DIR' && git apply /tmp/repair.patch"$'\n'"$out" ;;
  step:13:blocked-build-label) out=$'gh issue edit 7 --add-label ready-for-agent\ngh issue edit 7 --add-label ready-for-human\nThen: my step ends' ;;
  step:13:blocked-rebuild) out=$'I re-dispatch the implementer to rebuild task 1.\ngh issue edit 7 --add-label ready-for-human\nThen: my step ends' ;;
  step:13:blocked-work-ended) out=$'I continue with the remaining implementation work.\ngh issue edit 7 --add-label ready-for-human\nThen: my step ends' ;;
  step:13:blocked-command-ended) out=$'git apply /tmp/repair.patch\ngh issue edit 7 --add-label ready-for-human\nThen: my step ends' ;;
  step:13:blocked-continue) out=$'gh issue edit 7 --add-label ready-for-human\nThen: I go on with task 1' ;;
  step:13:blocked-two-endings) out="$out"$'\nThen: I go on with task 1' ;;
  step:14:verify-land | step:16:stale-completion-land) out="$out"$'\nscripts/celetis --agent codex land 7 subject' ;;
  step:15:approval-publish) out="$out"$'\ngh issue edit 7 --body-file /tmp/spec' ;;
  step:17:built-rebuild) out="$out"$'\ngh issue edit 7 --add-label ready-for-agent' ;;
esac
if [ -z "$answer" ]; then printf '%s\n' "$out"; exit 0; fi
printf '%s\n' "$out" >"$answer"
if [ "$mode" = step ] && [ "$k" = 4 ]; then
  case ${MANUAL_FAULT:-} in
    tool) echo '{"type":"item.completed","item":{"type":"command_execution","command":"true"}}' ;;
    error) echo '{"type":"error","message":"test failure"}' ;;
    reconnect) echo '{"type":"error","message":"Reconnecting... 1/5"}' ;;
    incomplete) echo '{"type":"error","message":"Reconnecting... 1/5"}'; exit 0 ;;
  esac
fi
echo '{"type":"turn.completed"}'
MOCK
cp "$tmp/bin/claude" "$tmp/bin/codex"
chmod +x "$tmp/bin/claude" "$tmp/bin/codex"
. tests/lib/pool.sh
all_pass() {
  local host=$1
  if PATH="$tmp/bin:$PATH" /bin/bash tests/manual/step-prompt.test.sh --agent "$host" >"$tmp/$host" 2>&1 &&
      [ "$(grep -c '^PASS: case ' "$tmp/$host")" -eq 25 ]; then
    echo "ok: $host runs all twenty-five scenarios"
  else
    echo "FAIL: $host omitted or rejected a valid fixture"; cat "$tmp/$host"; return 1
  fi
}
fenced_named() {
  local host=$1
  if MANUAL_STYLE=fenced-named PATH="$tmp/bin:$PATH" /bin/bash tests/manual/step-prompt.test.sh --agent "$host" >"$tmp/fenced-named-$host" 2>&1; then
    echo "ok: $host accepts fenced exact stops and named native setup"
  else
    echo "FAIL: $host rejected fenced exact stops or named native setup"; cat "$tmp/fenced-named-$host"; return 1
  fi
}
product_context() {
  local host=$1 folder=$2 evidence="$tmp/context-$1-${2//\//-}" run="$tmp/context-run-$1-${2//\//-}"
  if ! (cd "$tmp/product/$folder" && MANUAL_INPUTS="$evidence" PATH="$tmp/bin:$PATH" /bin/bash "$root/tests/manual/step-prompt.test.sh" \
      --agent "$host" --output-dir "$evidence") >"$run" 2>&1; then
    echo "FAIL: $host product-context run from $folder"; cat "$run"; return 1
  fi
  if perl -e '
        use strict; use warnings;
        my ($dir, $nested) = @ARGV;
        my @expected = ("Keep PRODUCT_ROOT_21 open when Verify cannot run.");
        push @expected, "Check PRODUCT_AREA_21 before a landing.",
          "Wait for PRODUCT_SUBFOLDER_21 when approval is missing." if $nested;
        my @files = glob "$dir/received-*";
        die "expected 25 prompts\n" unless @files == 25;
        push @files, "$dir/product-context.md";
        for my $file (@files) {
          open my $fh, "<", $file or die "$file: $!";
          local $/; my $text = <$fh>;
          my $offset = -1;
          for my $rule (@expected) {
            my $at = index($text, $rule, $offset + 1);
            die "$file: missing or out-of-order product rule $rule\n" if $at < 0;
            $offset = $at;
          }
          die "$file: unrelated instruction\n" if $text =~ /OUTSIDE_PRODUCT_21|UNRELATED_SUBFOLDER_21/;
          die "$file: subfolder instruction at root\n" if !$nested && $text =~ /PRODUCT_AREA_21|PRODUCT_SUBFOLDER_21/;
          if ($file =~ /received-13-step$/) {
            die "$file: missing case 13 shell-only format\n" unless index($text, "For this case, return shell commands and the final Then line only.") >= 0;
          }
          if ($file =~ /received-20-step$/) {
            die "$file: missing case 20 form\n" unless index($text, "For this case, answer with these six lines only") >= 0
              && index($text, "no tool of this session reaches GitHub") >= 0;
          }
        }
      ' "$evidence" "$([ "$folder" = . ] && echo 0 || echo 1)" &&
      perl -MJSON::PP -MDigest::SHA=sha256_hex -e '
        use strict; use warnings;
        my ($dir, $cwd, $root, $nested) = @ARGV;
        sub read_file { open my $fh, "<", $_[0] or die "$!: $_[0]"; local $/; return <$fh>; }
        my $context = decode_json(read_file("$dir/product-context.json"));
        die "wrong product binding\n" unless $context->{cwd} eq $cwd && $context->{root} eq $root;
        my @paths = ("$root/AGENTS.md");
        push @paths, "$root/area/AGENTS.md", "$root/area/sub/AGENTS.md" if $nested;
        my @sources = @{$context->{sources}};
        die "wrong source count\n" unless @sources == @paths;
        for my $i (0 .. $#paths) {
          my $source = $sources[$i];
          die "wrong source path\n" unless $source->{path} eq $paths[$i];
          my $bytes = read_file("$dir/$source->{snapshot}");
          die "changed source bytes\n" unless $bytes eq read_file($paths[$i]);
          die "wrong source hash\n" unless sha256_hex($bytes) eq $source->{sha256};
        }
      ' "$evidence" "$(cd "$tmp/product/$folder" && pwd -P)" "$(cd "$tmp/product" && pwd -P)" \
      "$([ "$folder" = . ] && echo 0 || echo 1)"; then
    echo "ok: $host preserves product instructions from $folder"
  else
    echo "FAIL: $host omitted or changed product instructions from $folder"; return 1
  fi
}
linked_checkout() {
  git -C "$tmp/linked" add AGENTS.md
  git -C "$tmp/linked" -c user.name=Fixture -c user.email=fixture@example.invalid commit -qm fixture
  git -C "$tmp/linked" worktree add -q --detach "$tmp/linked/.claude/worktrees/lane"
  printf '%s\n' 'Apply LINKED_PRODUCT_21 to this checkout.' >"$tmp/linked/.claude/worktrees/lane/AGENTS.md"
  if (cd "$tmp/linked/.claude/worktrees/lane" && PATH="$tmp/bin:$PATH" /bin/bash "$root/tests/manual/step-prompt.test.sh" \
      --agent codex --output-dir "$tmp/linked-context") >"$tmp/linked-run" 2>&1 &&
      grep -q 'LINKED_PRODUCT_21' "$tmp/linked-context/in-1-step" &&
      ! grep -Eq 'PRODUCT_ROOT_21|OUTSIDE_PRODUCT_21' "$tmp/linked-context/in-1-step"; then
    echo 'ok: a nested linked checkout excludes its physical parent instructions'
  else
    echo 'FAIL: linked checkout product instructions'; cat "$tmp/linked-run"; return 1
  fi
}
empty_context() {
  mkdir -p "$tmp/empty"
  git -C "$tmp/empty" init -q
  if (cd "$tmp/empty" && PATH="$tmp/bin:$PATH" /bin/bash "$root/tests/manual/step-prompt.test.sh" \
      --agent codex --output-dir "$tmp/empty-context") >"$tmp/empty-run" 2>&1 &&
      jq -e '.sources == []' "$tmp/empty-context/product-context.json" >/dev/null 2>&1 &&
      grep -q 'No product AGENTS.md was found.' "$tmp/empty-context/in-1-step"; then
    echo 'ok: no product instructions is explicit'
  else
    echo 'FAIL: missing empty product context'; cat "$tmp/empty-run"; return 1
  fi
}
unreadable_instructions() {
  local host=$1 product="$tmp/unreadable-$1"
  mkdir -p "$product/AGENTS.md"
  git -C "$product" init -q
  if (cd "$product" && MANUAL_CALLS="$tmp/unreadable-calls-$host" PATH="$tmp/bin:$PATH" \
      /bin/bash "$root/tests/manual/step-prompt.test.sh" --agent "$host") >"$product.log" 2>&1; then
    echo "FAIL: $host accepted unreadable product instructions"; return 1
  elif [ ! -e "$tmp/unreadable-calls-$host" ] && grep -q 'cannot read product instructions' "$product.log"; then
    echo "ok: $host stops on a product instruction read error before client startup"
  else
    echo "FAIL: $host instruction read failed outside preparation"; cat "$product.log"; return 1
  fi
}
bound_stop() {
  local host=$1
  if MANUAL_FAULT=bound-stop MANUAL_BINDING_DIR="$(pwd -P)" PATH="$tmp/bin:$PATH" \
      /bin/bash tests/manual/step-prompt.test.sh --agent "$host" --only 13:step >"$tmp/bound-$host" 2>&1 &&
      grep -q '^PASS: case 13 step ' "$tmp/bound-$host"; then
    echo "ok: $host accepts the required stop command bound to the exact product folder"
  else
    echo "FAIL: $host rejected the stop command with its exact product binding"; cat "$tmp/bound-$host"; return 1
  fi
}
rejects() {
  local fault=$1 k=$2 mode=$3
  if MANUAL_FAULT=$fault MANUAL_BINDING_DIR="$(pwd -P)" PATH="$tmp/bin:$PATH" \
      /bin/bash tests/manual/step-prompt.test.sh --agent codex --only "$k:$mode" >"$tmp/$fault" 2>&1; then
    echo "FAIL: accepted $fault"; return 1
  elif grep -q "^FAIL: case $k $mode:" "$tmp/$fault"; then
    echo "ok: rejects $fault"
  else
    echo "FAIL: $fault failed outside its scenario"; cat "$tmp/$fault"; return 1
  fi
}
completed_reconnect() {
  if MANUAL_FAULT=reconnect PATH="$tmp/bin:$PATH" /bin/bash tests/manual/step-prompt.test.sh --agent codex --only 4:step >"$tmp/reconnect" 2>&1 &&
      grep -q '^WARN: case 4 step recovered 1 service event(s)$' "$tmp/reconnect"; then
    echo 'ok: a completed reconnect is reported'
  else
    echo 'FAIL: completed reconnect'; cat "$tmp/reconnect"; return 1
  fi
}
landing_without_evidence() {
  if MANUAL_FAULT=no-completion-land PATH="$tmp/bin:$PATH" /bin/bash tests/manual/step-prompt.test.sh --agent codex --only 13:step >"$tmp/no-completion-land" 2>&1; then
    echo 'FAIL: landed without completion evidence'; return 1
  elif grep -q '^FAIL: case 13 step:' "$tmp/no-completion-land"; then
    echo 'ok: rejects landing without completion evidence'
  else
    echo 'FAIL: missing-evidence scenario did not run'; cat "$tmp/no-completion-land"; return 1
  fi
}
two_failed_checks() {
  if MANUAL_FAULT=form-two-faults PATH="$tmp/bin:$PATH" /bin/bash tests/manual/step-prompt.test.sh --agent codex --only 20:step >"$tmp/form-two-faults" 2>&1; then
    echo 'FAIL: accepted form-two-faults'; return 1
  elif grep -qxF 'FAIL: case 20 step: missing "Fallback: NONE", missing "Issue: NOT POSTED"' "$tmp/form-two-faults"; then
    echo 'ok: names each failed check of case 20'
  else
    echo 'FAIL: form-two-faults did not name each failed check'; cat "$tmp/form-two-faults"; return 1
  fi
}
mkdir -p "$tmp/product/area/sub" "$tmp/product/other"
git -C "$tmp/product" init -q
printf '%s\n' 'Never apply OUTSIDE_PRODUCT_21 to this product.' >"$tmp/AGENTS.md"
printf '%s\n' 'Keep PRODUCT_ROOT_21 open when Verify cannot run.' >"$tmp/product/AGENTS.md"
printf '%s\n' 'Check PRODUCT_AREA_21 before a landing.' >"$tmp/product/area/AGENTS.md"
printf '%s\n' 'Wait for PRODUCT_SUBFOLDER_21 when approval is missing.' >"$tmp/product/area/sub/AGENTS.md"
printf '%s\n' 'Apply UNRELATED_SUBFOLDER_21 only in this folder.' >"$tmp/product/other/AGENTS.md"
cp -R "$tmp/product" "$tmp/linked"
for host in claude codex; do pool_run "all_pass $host" all_pass "$host"; done
for host in claude codex; do pool_run "fenced_named $host" fenced_named "$host"; done
for host in claude codex; do
  for folder in . area/sub; do pool_run "product_context $host $folder" product_context "$host" "$folder"; done
done
pool_run linked_checkout linked_checkout
pool_run empty_context empty_context
for host in claude codex; do pool_run "unreadable_instructions $host" unreadable_instructions "$host"; done
for host in claude codex; do pool_run "bound_stop $host" bound_stop "$host"; done
for fault in wrong-bound-stop bound-work-stop; do pool_run "rejects $fault" rejects "$fault" 13 step; done
for fault in land-bare land-claude land-codex tool error exit incomplete; do pool_run "rejects $fault" rejects "$fault" 4 step; done
pool_run completed_reconnect completed_reconnect
pool_run landing_without_evidence landing_without_evidence
for pair in '11 step plan-no-lists' '11 step plan-lists-late' '13 step blocked-build-label' '13 step blocked-rebuild' '13 step blocked-work-ended' '13 step blocked-command-ended' '13 step blocked-continue' '13 step blocked-two-endings' '13 step fenced-extra-action' '14 step verify-land' '15 specify approval-publish' '16 step stale-completion-land' '17 step built-rebuild' '18 step invalid-config-continue' '18 step entry-setup' '19 step denied-entry-retry' '20 step form-fallback' '20 step form-posted' '20 step form-continue' '20 step form-two-endings' '20 step form-extra-act' '20 step form-empty-tools' '20 step form-empty-limit' '20 step form-empty-setup' '20 step form-markdown' '20 step form-prose' '21 step landed-git' '21 step landed-stop' '21 step landed-silent' '21 step landed-git-list'; do
  set -- $pair
  pool_run "rejects $3" rejects "$3" "$1" "$2"
done
pool_run two_failed_checks two_failed_checks
pool_wait
echo 'PASS'
