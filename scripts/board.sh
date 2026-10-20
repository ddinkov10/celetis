#!/usr/bin/env bash
set -euo pipefail
[ $# -eq 0 ] || { echo 'usage: scripts/celetis board' >&2; exit 2; }
source "$(cd "$(dirname "$0")" && pwd)/celetis"
main=$(celetis_config_main)
config=$(celetis_config_read "$main")
checkout=$(git rev-parse --show-toplevel)
[ "$(cd "$checkout" && pwd -P)" = "$(cd "$main" && pwd -P)" ] || {
  printf 'celetis-board: start the board in the main checkout: %s\n' "$main" >&2
  exit 1
}
cd "$main"
printf '%s\n' "$config" | jq -c '{
  data:["scripts/celetis","celetis-flow","--board"],
  run:["scripts/celetis","--agent","{agent}","celetis-flow","{n}"],
  resume:["scripts/celetis","celetis-flow","--resume","{n}"],
  port:(.board.port // 4403)
}' | npx --yes 'github:ddinkov10/agent-board#v2.2.1' --config-stdin
