#!/usr/bin/env bash
source "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/celetis"

celetis_host_require() {
  celetis_host_select || return $?
  command -v "$CELETIS_HOST" >/dev/null 2>&1 || {
    printf 'celetis: %s is not on PATH\n' "$CELETIS_HOST" >&2
    return 1
  }
}

celetis_host_update() {
  celetis_host_require || return $?
  case $CELETIS_HOST in
    claude) claude plugin marketplace update celetis && claude plugin update celetis@celetis --scope user ;;
    codex) codex plugin marketplace upgrade celetis ;;
  esac
}
