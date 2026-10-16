#!/usr/bin/env bash
source "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/celetis"

celetis_host_require() {
  celetis_host_select || return $?
  command -v "$CELETIS_AGENT" >/dev/null 2>&1 || {
    printf 'celetis: %s is not on PATH\n' "$CELETIS_AGENT" >&2
    return 1
  }
}
