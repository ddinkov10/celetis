pool_dir=
pool_n=0
pool_labels=()
pool_pids=()

pool_running() {
  local i=0 n=0
  while [ "$i" -lt "$pool_n" ]; do
    [ -f "$pool_dir/$i.rc" ] || n=$((n + 1))
    i=$((i + 1))
  done
  echo "$n"
}

pool_run() {
  local label=$1 max=${POOL_JOBS:-$(getconf _NPROCESSORS_ONLN)}
  shift
  [ -n "$pool_dir" ] || pool_dir=$(mktemp -d)
  while [ "$(pool_running)" -ge "$max" ]; do
    /bin/sleep 0.05
  done
  (
    set +e
    (set -e; "$@") >"$pool_dir/$pool_n.log" 2>&1
    echo "$?" >"$pool_dir/$pool_n.tmp"
    mv "$pool_dir/$pool_n.tmp" "$pool_dir/$pool_n.rc"
  ) &
  pool_pids[pool_n]=$!
  pool_labels[pool_n]=$label
  pool_n=$((pool_n + 1))
}

pool_wait() {
  local i=0 code failed=0
  while [ "$i" -lt "$pool_n" ]; do
    code=0
    wait "${pool_pids[i]}" 2>/dev/null || code=$?
    [ ! -f "$pool_dir/$i.rc" ] || code=$(cat "$pool_dir/$i.rc")
    cat "$pool_dir/$i.log"
    if [ "$code" != 0 ]; then
      echo "FAIL: ${pool_labels[i]} (exit $code)"
      failed=1
    fi
    i=$((i + 1))
  done
  [ -z "$pool_dir" ] || rm -rf "$pool_dir"
  pool_dir=
  pool_n=0
  pool_labels=()
  pool_pids=()
  return "$failed"
}
