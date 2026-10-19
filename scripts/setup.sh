#!/usr/bin/env bash
# The deterministic acts of /celetis:setup; each one starts with the checks of the main checkout and its trunk.
set -euo pipefail

die() { printf 'setup: %s\n' "$1" >&2; exit 1; }
warn() { printf 'setup: warning: %s\n' "$1"; }
usage() {
  echo 'usage: scripts/celetis setup check | write --hosts claude|codex|claude,codex [--default claude|codex] --landing pr|merge | push' >&2
  exit 2
}

plugin=$(cd "$(dirname "$0")/.." && pwd)
setup_paths=(
  scripts/celetis
  .claude/celetis-flow/landing.json
  .claude/celetis-flow/wiring.json
  .codex/rules/celetis.rules
  .claude/settings.json
  .gitignore
  .gitattributes
  AGENTS.md
  CLAUDE.md
  .claude/CLAUDE.md
  docs/adr/README.md
  docs/adr/template.md
  docs/lessons/INDEX.md
)

check_trunk() {
  top=$(git rev-parse --show-toplevel) || exit 1
  [ "$(git rev-parse --path-format=absolute --git-dir)" = "$(git rev-parse --path-format=absolute --git-common-dir)" ] ||
    die "run setup in the main checkout, not in a linked worktree: $top"
  cd "$top"
  info=$(gh api 'repos/{owner}/{repo}' --jq '.full_name, .default_branch' 2>/dev/null) ||
    die "origin is not a GitHub repository that gh can read"
  repo=${info%%$'\n'*}
  trunk=${info#*$'\n'}
  branch=$(git branch --show-current)
  [ "$branch" = "$trunk" ] || die "the main checkout is on ${branch:-a detached HEAD}, not on $trunk; switch to $trunk first"
  git fetch -q origin "$trunk" 2>/dev/null || die "cannot fetch $trunk from origin"
  [ "$(git rev-list --count "HEAD..origin/$trunk")" -eq 0 ] ||
    die "the local $trunk is behind origin/$trunk or has diverged from it; run git pull first"
  ahead=$(git rev-list --count "origin/$trunk..HEAD")
  if [ "$ahead" -eq 1 ]; then
    warn "the local $trunk is 1 commit ahead of origin/$trunk; the push carries it:"
  elif [ "$ahead" -gt 1 ]; then
    warn "the local $trunk is $ahead commits ahead of origin/$trunk; the push carries them:"
  fi
  [ "$ahead" -eq 0 ] || git log --reverse --format='  %s' "origin/$trunk..HEAD"
}

check_dirty() {
  local files
  files=$(git status --porcelain --untracked-files=all -- "${setup_paths[@]}" | cut -c4- | paste -sd ' ' -)
  [ -z "$files" ] || die "commit or drop the uncommitted changes of these files first: $files"
}

check_staged() {
  git diff --cached --quiet || die "the index holds staged changes; commit or unstage them first"
}

run_checks() {
  check_trunk
  check_dirty
  check_staged
}

case ${1:-} in
  check) [ $# -eq 1 ] || usage; run_checks ;;
  *) usage ;;
esac
