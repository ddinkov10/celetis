#!/usr/bin/env bash
set -euo pipefail
[ $# -eq 0 ] || {
  echo 'usage: scripts/celetis board' >&2
  exit 2
}
plugin=$(cd "$(dirname "$0")/.." && pwd)
source "$plugin/scripts/celetis"
clean= rest=$PATH:
while [ -n "$rest" ]; do
  entry=${rest%%:*} rest=${rest#*:}
  [[ $entry =~ node_modules/\.bin/*$ ]] || clean=${clean:+$clean:}$entry
done
PATH=$clean
command -v node >/dev/null || {
  echo 'celetis-board: node is not on PATH; the board needs Node 22.18, or Node 24.2 or later' >&2
  exit 1
}
[ -f "$plugin/board/cli.mjs" ] || {
  printf 'celetis-board: the plugin has no board/cli.mjs: %s; reinstall the plugin\n' "$plugin" >&2
  exit 1
}
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
}' | node "$plugin/board/cli.mjs" --config-stdin
