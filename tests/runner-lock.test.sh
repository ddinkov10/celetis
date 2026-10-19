#!/usr/bin/env bash
set -euo pipefail
root=$(cd "$(dirname "$0")/.." && pwd)
tmp=$(mktemp -d)
export LOCK_TEST="$tmp/state"
export LOCK_TEST_PLUGIN="$root" CLAUDE_CONFIG_DIR="$tmp/claude" CODEX_HOME="$tmp/codex"
export GIT_AUTHOR_NAME=t GIT_AUTHOR_EMAIL=t@t GIT_COMMITTER_NAME=t GIT_COMMITTER_EMAIL=t@t
unset HERDR_ENV HERDR_PANE_ID HERDR_TAB_ID
S=$LOCK_TEST
mkdir -p "$S" "$tmp/bin" "$tmp/project"
trap 'touch "$S/release" 2>/dev/null || true; wait 2>/dev/null || true; rm -rf "$tmp"' EXIT
fail() { echo "FAIL: $1"; exit 1; }
cat >"$tmp/bin/ps" <<'EOF'
#!/bin/bash
S=$LOCK_TEST
if [ "$2" = 90000001 ]; then
  case "$*" in
    *lstart=*) echo fixture ;;
    *stat=*) echo Z ;;
  esac
  exit 0
fi
if [ "$2" = 12345678 ]; then
  touch "$S/read-$CELETIS_AGENT"
  for attempt in {1..200}; do
    [ ! -f "$S/read-claude" ] || [ ! -f "$S/read-codex" ] || break
    /bin/sleep 0.01
  done
  if [ "$CELETIS_AGENT" = codex ]; then
    for attempt in {1..200}; do
      [ ! -f "$S/started-claude" ] || break
      /bin/sleep 0.01
    done
  fi
  touch "$S/returned-$CELETIS_AGENT"
  exit 1
fi
exec /bin/ps "$@"
EOF
cat >"$tmp/bin/host" <<'EOF'
#!/bin/bash
S=$LOCK_TEST
if [ "$1" = plugin ]; then
  [ "$2" != list ] || jq -nc --arg p "$LOCK_TEST_PLUGIN" '[{id:"celetis@celetis",scope:"user",enabled:true,installPath:$p}]'
  exit 0
fi
if [ "$1" = app-server ]; then
  while IFS= read -r line; do
    case $(printf '%s\n' "$line" | jq -r .method) in
      initialize) echo '{"id":1,"result":{}}' ;;
      config/read) echo '{"id":2,"result":{"config":{}}}' ;;
      skills/list)
        jq -nc --arg p "$LOCK_TEST_PLUGIN" --arg cwd "$PWD" '{id:2,result:{data:[{cwd:$cwd,skills:[{name:"celetis:guide",pluginId:"celetis@celetis",enabled:true,path:($p+"/skills/guide/SKILL.md")}]}]}}' ;;
    esac
  done
  exit 0
fi
touch "$S/started-$CELETIS_AGENT"
for attempt in {1..200}; do
  [ ! -f "$S/release" ] || exit 0
  /bin/sleep 0.05
done
exit 3
EOF
cp "$tmp/bin/host" "$tmp/bin/claude"
cp "$tmp/bin/host" "$tmp/bin/codex"
cat >"$tmp/bin/gh" <<'EOF'
#!/bin/bash
[ "$1" = api ] || { echo "HTTP 403: GitHub GraphQL is not available from Claude Code sessions" >&2; exit 1; }
doc='{"number":7,"state":"open","labels":[{"name":"enhancement"}],"body":"Spec: fixture","comments":0}'
filter=. endpoint=
while [ $# -gt 0 ]; do case $1 in --jq) filter=$2; shift ;; repos/*) endpoint=$1 ;; esac; shift; done
case $endpoint in
  'repos/{owner}/{repo}/issues/7') json=$doc ;;
  'repos/{owner}/{repo}/issues/7/comments?'*) json='[]' ;;
  'repos/{owner}/{repo}/issues?state=open&'*) json="[$doc]" ;;
  *) exit 1 ;;
esac
printf '%s\n' "$json" | jq -r "$filter"
EOF
cat >"$tmp/bin/sleep" <<'EOF'
#!/bin/bash
if [ "$1" = 60 ]; then kill -TERM "$PPID"; else exec /bin/sleep "$@"; fi
EOF
chmod +x "$tmp/bin/"*
export PATH="$tmp/bin:$PATH"
git -C "$tmp/project" init -q
mkdir -p "$tmp/project/.claude/celetis-flow"
echo '{"plan":"auto"}' >"$tmp/project/.claude/celetis-flow/gates.json"
git -C "$tmp/project" add .
git -C "$tmp/project" commit -qm fixture
state="$tmp/project/.git/celetis-flow"
mkdir -p "$state"
for name in issue-7 runner; do
  rm -rf "$S" "$state"
  mkdir -p "$S" "$state"
  owner=$(printf '{"runner":{"pid":12345678,"start":"dead"},"session":null}\n' | git -C "$tmp/project" hash-object -w --stdin)
  git -C "$tmp/project" update-ref "refs/celetis-flow/locks/$name" "$owner"
  set --
  [ "$name" != issue-7 ] || set -- 7
  for host in claude codex; do
    (cd "$tmp/project" && CELETIS_AGENT="$host" exec "$BASH" "$root/scripts/celetis-flow.sh" "$@" >"$tmp/$host.out" 2>"$tmp/$host.err") &
  done
  for attempt in {1..200}; do
    [ ! -f "$S/returned-codex" ] || break
    /bin/sleep 0.05
  done
  [ -f "$S/returned-codex" ] || fail "the contenders did not both inspect the stale owner"
  /bin/sleep 0.5
  [ -f "$S/started-claude" ] && [ ! -f "$S/started-codex" ] || fail "both hosts replaced the same stale $name lock"
  git -C "$tmp/project" log --all --oneline >/dev/null || fail "a live lock broke git log"
  touch "$S/release"
  wait 2>/dev/null || true
  if [ "$name" = issue-7 ]; then
    grep -q 'another celetis-flow.sh' "$tmp/codex.out" || fail "the losing host did not report the owner"
  else
    grep -q 'another automatic runner' "$tmp/codex.err" || fail "the losing automatic runner did not report the owner"
  fi
  [ -z "$(git -C "$tmp/project" for-each-ref --format='%(refname)' refs/celetis-flow/locks)" ] || fail "a finished runner kept its lock"
done
rm -rf "$S" "$state"
mkdir -p "$S" "$state"
(cd "$tmp/project" && CELETIS_AGENT=claude exec "$BASH" "$root/scripts/celetis-flow.sh" 7 >"$tmp/claude.out" 2>"$tmp/claude.err") &
runner=$!
for attempt in {1..200}; do
  [ ! -f "$S/started-claude" ] || break
  /bin/sleep 0.05
done
[ -f "$S/started-claude" ] || fail "owner-release fixture did not start"
replacement=$(printf '{"runner":{"pid":12345679,"start":"replacement"},"session":null}\n' | git -C "$tmp/project" hash-object -w --stdin)
git -C "$tmp/project" update-ref refs/celetis-flow/locks/issue-7 "$replacement"
touch "$S/release"
wait "$runner"
[ "$(git -C "$tmp/project" rev-parse refs/celetis-flow/locks/issue-7)" = "$replacement" ] || fail "an old runner released a different owner's lock"
git -C "$tmp/project" update-ref -d refs/celetis-flow/locks/issue-7 "$replacement"
rm -rf "$S" "$state"
mkdir -p "$S" "$state"
owner=$(printf '{"runner":null,"session":{"pid":90000001,"start":"fixture"}}\n' | git -C "$tmp/project" hash-object -w --stdin)
git -C "$tmp/project" update-ref refs/celetis-flow/locks/issue-7 "$owner"
touch "$S/release"
(cd "$tmp/project" && CELETIS_AGENT=claude "$BASH" "$root/scripts/celetis-flow.sh" 7) >"$tmp/zombie.out" 2>"$tmp/zombie.err"
[ -f "$S/started-claude" ] || fail "an exited zombie session kept the issue lock"
echo PASS
