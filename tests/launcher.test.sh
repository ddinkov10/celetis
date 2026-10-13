#!/usr/bin/env bash
set -eu
here=$(cd "$(dirname "$0")" && pwd)
celetis="$here/../scripts/celetis"
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
fails=0

plug="$tmp/plug in"
proj="$tmp/proj dir"
mkdir -p "$plug/scripts" "$proj/scripts" "$tmp/stub" "$tmp/oops" "$tmp/nobin" "$tmp/nojq" "$tmp/cyg"
cat >"$plug/scripts/echo.sh" <<'EOF'
printf '[%s]' "$@"
EOF
echo 'exit 7' >"$plug/scripts/fail.sh"
echo 'printf project' >"$proj/scripts/echo.sh"

export LIST="$tmp/list.json"
cat >"$tmp/stub/claude" <<'EOF'
#!/bin/bash
[ "$1 $2 $3" = "plugin list --json" ] && cat "$LIST"
exit 0
EOF
printf '#!/bin/bash\necho oops\n' >"$tmp/oops/claude"
cat >"$tmp/cyg/cygpath" <<EOF
#!/bin/bash
[ "\$1" = -u ] && [ "\$2" = 'C:\\plug' ] && printf '%s\\n' "$plug"
EOF
chmod +x "$tmp"/stub/claude "$tmp"/oops/claude "$tmp"/cyg/cygpath
for t in bash jq tr; do ln -s "$(command -v "$t")" "$tmp/nobin/$t"; done
for t in bash tr; do ln -s "$(command -v "$t")" "$tmp/nojq/$t"; done

rec() { jq -nc --arg s "$1" --arg p "$2" '{id:"celetis@celetis",version:"x",scope:$s,enabled:true,installPath:$p}'; }
other() { jq -nc '{id:"other@market",version:"x",scope:"user",enabled:true,installPath:"/nowhere"}'; }
list() {
  local sep=''
  printf '[' >"$LIST"
  for r in "$@"; do printf '%s%s' "$sep" "$r" >>"$LIST"; sep=,; done
  printf ']' >>"$LIST"
}

run() {
  local p=$1
  shift
  code=0
  out=$(PATH="$p" "$celetis" "$@" 2>"$tmp/err") || code=$?
  err=$(cat "$tmp/err")
}

expect() {
  if [ "$out" = "$2" ] && [ "$err" = "$3" ] && [ "$code" = "$4" ]; then
    printf 'ok   %s\n' "$1"
  else
    printf 'FAIL %s\n  stdout: %s\n  stderr: %s\n  exit:   %s\n' "$1" "$out" "$err" "$code"
    fails=$((fails + 1))
  fi
}

stub="$tmp/stub:$PATH"
install='celetis: the plugin is not installed; run: claude plugin marketplace add ddinkov10/celetis && claude plugin install celetis@celetis'
usage='usage: scripts/celetis <script> [<argument>...], e.g. scripts/celetis next-step --open'
nojq='celetis: jq is not on PATH'

list "$(other)" "$(rec user "$plug")"
run "$stub" echo a 'b c' '#7'
expect "user record runs its script with the arguments" '[a][b c][#7]' '' 0

list "$(rec project "$proj")" "$(rec user "$plug")"
run "$stub" echo x
expect "user record wins over an earlier project record" '[x]' '' 0

list "$(rec project "$proj")"
run "$stub" echo
expect "a project record alone runs" 'project' '' 0

list "$(other)"
run "$stub" echo
expect "no record of the plugin" '' "$install" 1

run "$tmp/oops:$PATH" echo
expect "claude prints no JSON" '' "$install" 1

run "$tmp/nobin" echo
expect "no claude on PATH" '' "$install" 1

list "$(rec user "$plug")"
run "$tmp/stub:$tmp/nojq" echo
expect "no jq on PATH" '' "$nojq" 1

run "$tmp/nojq" echo
expect "no jq and no claude on PATH" '' "$nojq" 1

run "$stub"
expect "no argument" '' "$usage" 2

run "$stub" nope
expect "unknown script name" '' 'celetis: the plugin has no script nope' 2

run "$stub" ../echo
expect "name with a path" '' 'celetis: the plugin has no script ../echo' 2

run "$stub" fail
expect "exit code of the script" '' '' 7

list "$(rec user 'C:\plug')"
run "$tmp/cyg:$stub" echo w
expect "installPath through cygpath" '[w]' '' 0

[ "$fails" -eq 0 ]
