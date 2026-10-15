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
    1 | 2) out=$'## Stopped\ngh issue edit 7 --add-label ready-for-human\nThen: my step ends' ;;
    3) out=$'## Landing refused\ngh issue edit 7 --add-label ready-for-human\nThen: my step ends' ;;
    4 | 8) out=$'## Before landing\ngh issue comment 7 --body-file /tmp/reason\ngh issue edit 7 --remove-label ready-for-agent --add-label ready-for-human\nThen: my step ends' ;;
    5 | 7 | 15) out='Then: I wait for the person' ;;
    6) out=$'Fix the cause\ngh issue edit 7 --add-label ready-for-human\nThen: my step ends' ;;
    9) out=$'gh issue edit 7 --add-label needs-info\nThen: my step ends' ;;
    10 | 17)
      if [ -n "$answer" ]; then out=$'scripts/celetis --host codex land 7 subject\nThen: my step ends'
      else out=$'scripts/celetis --host claude land 7 subject\nThen: my step ends'; fi ;;
    11) out=$'gh issue edit 7 --add-label ready-for-agent\nThen: my step ends' ;;
    13 | 16) out=$'gh issue edit 7 --add-label ready-for-human\nThen: my step ends' ;;
    12) out=$'gh issue edit 7 --add-label bug\nThen: my step ends' ;;
    14) out='Then: I go on with the repair and Verify loop' ;;
  esac
  if [ "$k" = 4 ]; then
    case ${MANUAL_FAULT:-} in
      land-bare) out="$out"$'\nscripts/celetis land 7 subject' ;;
      land-claude) out="$out"$'\nscripts/celetis --host claude land 7 subject' ;;
      land-codex) out="$out"$'\nscripts/celetis --host codex land 7 subject' ;;
      exit) exit 1 ;;
    esac
  fi
fi
if [ "$mode" = step ] && [ "$k" = 13 ] && [ "${MANUAL_FAULT:-}" = no-completion-land ]; then
  out="$out"$'\nscripts/celetis --host codex land 7 subject'
fi
case "$mode:$k:${MANUAL_FAULT:-}" in
  step:13:bound-stop) out="cd '$MANUAL_BINDING_DIR' && $out" ;;
  step:13:wrong-bound-stop) out="cd '/tmp/wrong-product' && $out" ;;
  step:13:bound-work-stop) out="cd '$MANUAL_BINDING_DIR' && git apply /tmp/repair.patch"$'\n'"$out" ;;
  step:13:blocked-build-label) out=$'gh issue edit 7 --add-label ready-for-agent\ngh issue edit 7 --add-label ready-for-human\nThen: my step ends' ;;
  step:13:blocked-rebuild) out=$'I re-dispatch the implementer to rebuild task 1.\ngh issue edit 7 --add-label ready-for-human\nThen: my step ends' ;;
  step:13:blocked-work-ended) out=$'I continue with the remaining implementation work.\ngh issue edit 7 --add-label ready-for-human\nThen: my step ends' ;;
  step:13:blocked-command-ended) out=$'git apply /tmp/repair.patch\ngh issue edit 7 --add-label ready-for-human\nThen: my step ends' ;;
  step:13:blocked-continue) out=$'gh issue edit 7 --add-label ready-for-human\nThen: I go on with task 1' ;;
  step:13:blocked-two-endings) out="$out"$'\nThen: I go on with task 1' ;;
  step:14:verify-land | step:16:stale-completion-land) out="$out"$'\nscripts/celetis --host codex land 7 subject' ;;
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
fails=0
for host in claude codex; do
  if PATH="$tmp/bin:$PATH" /bin/bash tests/manual/step-prompt.test.sh --host "$host" >"$tmp/$host" 2>&1 &&
      [ "$(grep -c '^PASS: case ' "$tmp/$host")" -eq 21 ]; then
    echo "ok: $host runs all twenty-one scenarios"
  else
    echo "FAIL: $host omitted or rejected a valid fixture"; cat "$tmp/$host"; fails=$((fails + 1))
  fi
done
mkdir -p "$tmp/product/area/sub" "$tmp/product/other"
git -C "$tmp/product" init -q
printf '%s\n' 'Never apply OUTSIDE_PRODUCT_21 to this product.' >"$tmp/AGENTS.md"
printf '%s\n' 'Keep PRODUCT_ROOT_21 open when Verify cannot run.' >"$tmp/product/AGENTS.md"
printf '%s\n' 'Check PRODUCT_AREA_21 before a landing.' >"$tmp/product/area/AGENTS.md"
printf '%s\n' 'Wait for PRODUCT_SUBFOLDER_21 when approval is missing.' >"$tmp/product/area/sub/AGENTS.md"
printf '%s\n' 'Apply UNRELATED_SUBFOLDER_21 only in this folder.' >"$tmp/product/other/AGENTS.md"
for host in claude codex; do
  for folder in . area/sub; do
    evidence="$tmp/context-$host-${folder//\//-}"
    if ! (cd "$tmp/product/$folder" && MANUAL_INPUTS="$evidence" PATH="$tmp/bin:$PATH" /bin/bash "$root/tests/manual/step-prompt.test.sh" \
        --host "$host" --output-dir "$evidence") >"$tmp/context-run" 2>&1; then
      echo "FAIL: $host product-context run from $folder"; cat "$tmp/context-run"; fails=$((fails + 1)); continue
    fi
    if perl -e '
          use strict; use warnings;
          my ($dir, $nested) = @ARGV;
          my @expected = ("Keep PRODUCT_ROOT_21 open when Verify cannot run.");
          push @expected, "Check PRODUCT_AREA_21 before a landing.",
            "Wait for PRODUCT_SUBFOLDER_21 when approval is missing." if $nested;
          my @files = glob "$dir/received-*";
          die "expected 21 prompts\n" unless @files == 21;
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
      echo "FAIL: $host omitted or changed product instructions from $folder"; fails=$((fails + 1))
    fi
  done
done
git -C "$tmp/product" add AGENTS.md
git -C "$tmp/product" -c user.name=Fixture -c user.email=fixture@example.invalid commit -qm fixture
git -C "$tmp/product" worktree add -q --detach "$tmp/product/.claude/worktrees/lane"
printf '%s\n' 'Apply LINKED_PRODUCT_21 to this checkout.' >"$tmp/product/.claude/worktrees/lane/AGENTS.md"
if (cd "$tmp/product/.claude/worktrees/lane" && PATH="$tmp/bin:$PATH" /bin/bash "$root/tests/manual/step-prompt.test.sh" \
    --host codex --output-dir "$tmp/linked-context") >"$tmp/linked-run" 2>&1 &&
    grep -q 'LINKED_PRODUCT_21' "$tmp/linked-context/in-1-step" &&
    ! grep -Eq 'PRODUCT_ROOT_21|OUTSIDE_PRODUCT_21' "$tmp/linked-context/in-1-step"; then
  echo 'ok: a nested linked checkout excludes its physical parent instructions'
else
  echo 'FAIL: linked checkout product instructions'; cat "$tmp/linked-run"; fails=$((fails + 1))
fi
mkdir -p "$tmp/empty"
git -C "$tmp/empty" init -q
if (cd "$tmp/empty" && PATH="$tmp/bin:$PATH" /bin/bash "$root/tests/manual/step-prompt.test.sh" \
    --host codex --output-dir "$tmp/empty-context") >"$tmp/empty-run" 2>&1 &&
    jq -e '.sources == []' "$tmp/empty-context/product-context.json" >/dev/null 2>&1 &&
    grep -q 'No product AGENTS.md was found.' "$tmp/empty-context/in-1-step"; then
  echo 'ok: no product instructions is explicit'
else
  echo 'FAIL: missing empty product context'; cat "$tmp/empty-run"; fails=$((fails + 1))
fi
mkdir "$tmp/empty/AGENTS.md"
for host in claude codex; do
  if (cd "$tmp/empty" && MANUAL_CALLS="$tmp/unreadable-calls-$host" PATH="$tmp/bin:$PATH" \
      /bin/bash "$root/tests/manual/step-prompt.test.sh" --host "$host") >"$tmp/unreadable-$host" 2>&1; then
    echo "FAIL: $host accepted unreadable product instructions"; fails=$((fails + 1))
  elif [ ! -e "$tmp/unreadable-calls-$host" ] && grep -q 'cannot read product instructions' "$tmp/unreadable-$host"; then
    echo "ok: $host stops on a product instruction read error before client startup"
  else
    echo "FAIL: $host instruction read failed outside preparation"; cat "$tmp/unreadable-$host"; fails=$((fails + 1))
  fi
done
for host in claude codex; do
  if MANUAL_FAULT=bound-stop MANUAL_BINDING_DIR="$(pwd -P)" PATH="$tmp/bin:$PATH" \
      /bin/bash tests/manual/step-prompt.test.sh --host "$host" >"$tmp/bound-$host" 2>&1; then
    echo "ok: $host accepts the required stop command bound to the exact product folder"
  else
    echo "FAIL: $host rejected the stop command with its exact product binding"; cat "$tmp/bound-$host"; fails=$((fails + 1))
  fi
done
for fault in wrong-bound-stop bound-work-stop; do
  if MANUAL_FAULT=$fault MANUAL_BINDING_DIR="$(pwd -P)" PATH="$tmp/bin:$PATH" \
      /bin/bash tests/manual/step-prompt.test.sh --host codex >"$tmp/$fault" 2>&1; then
    echo "FAIL: accepted $fault"; fails=$((fails + 1))
  elif grep -q '^FAIL: case 13 step:' "$tmp/$fault"; then
    echo "ok: rejects $fault"
  else
    echo "FAIL: $fault failed outside its scenario"; cat "$tmp/$fault"; fails=$((fails + 1))
  fi
done
for fault in land-bare land-claude land-codex tool error exit incomplete; do
  if MANUAL_FAULT=$fault PATH="$tmp/bin:$PATH" /bin/bash tests/manual/step-prompt.test.sh --host codex >"$tmp/$fault" 2>&1; then
    echo "FAIL: accepted $fault"; fails=$((fails + 1))
  elif grep -q '^FAIL: case 4 step:' "$tmp/$fault"; then
    echo "ok: rejects $fault"
  else
    echo "FAIL: $fault failed outside its scenario"; cat "$tmp/$fault"; fails=$((fails + 1))
  fi
done
if MANUAL_FAULT=reconnect PATH="$tmp/bin:$PATH" /bin/bash tests/manual/step-prompt.test.sh --host codex >"$tmp/reconnect" 2>&1 &&
    grep -q '^WARN: case 4 step recovered 1 service event(s)$' "$tmp/reconnect"; then
  echo 'ok: a completed reconnect is reported'
else
  echo 'FAIL: completed reconnect'; cat "$tmp/reconnect"; fails=$((fails + 1))
fi
if MANUAL_FAULT=no-completion-land PATH="$tmp/bin:$PATH" /bin/bash tests/manual/step-prompt.test.sh --host codex >"$tmp/no-completion-land" 2>&1; then
  echo 'FAIL: landed without completion evidence'; fails=$((fails + 1))
elif grep -q '^FAIL: case 13 step:' "$tmp/no-completion-land"; then
  echo 'ok: rejects landing without completion evidence'
else
  echo 'FAIL: missing-evidence scenario did not run'; cat "$tmp/no-completion-land"; fails=$((fails + 1))
fi
for pair in '13 step blocked-build-label' '13 step blocked-rebuild' '13 step blocked-work-ended' '13 step blocked-command-ended' '13 step blocked-continue' '13 step blocked-two-endings' '14 step verify-land' '15 specify approval-publish' '16 step stale-completion-land' '17 step built-rebuild'; do
  set -- $pair
  if MANUAL_FAULT=$3 PATH="$tmp/bin:$PATH" /bin/bash tests/manual/step-prompt.test.sh --host codex >"$tmp/$3" 2>&1; then
    echo "FAIL: accepted $3"; fails=$((fails + 1))
  elif grep -q "^FAIL: case $1 $2:" "$tmp/$3"; then
    echo "ok: rejects $3"
  else
    echo "FAIL: $3 failed outside its scenario"; cat "$tmp/$3"; fails=$((fails + 1))
  fi
done
[ "$fails" -eq 0 ]
echo 'PASS'
