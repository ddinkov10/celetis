#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
unset SHELLCHECK_OPTS
. tests/lib/pool.sh

missing=0
for tool in git perl jq node npm claude bun; do
  command -v "$tool" >/dev/null || {
    echo "verify: $tool is missing (README.md, \"Requirements\")"
    missing=1
  }
done
[ "$missing" = 0 ] || exit 1

npm_root=$(npm root -g)
while read -r tool pin installer package; do
  case $tool in '#'*) continue ;; esac
  if [ "$tool" = @types/bun ]; then
    if [ ! -f "$npm_root/@types/bun/package.json" ]; then
      echo "verify: $tool is missing from $npm_root: install $package with $installer (AGENTS.md, \"Verify gate\")"
      missing=1
      continue
    fi
    version=$(jq -r .version "$npm_root/@types/bun/package.json")
  else
    if ! command -v "$tool" >/dev/null; then
      echo "verify: $tool is missing: install $package with $installer (AGENTS.md, \"Verify gate\")"
      missing=1
      continue
    fi
    version=$("$tool" --version </dev/null 2>&1 | grep -Eo '[0-9]+\.[0-9]+\.[0-9]+' | head -n 1 || true)
  fi
  echo "== $tool $version"
  [ "$version" = "$pin" ] || echo "verify: warning: $tool $version is not the pin $pin (tests/lib/tools.txt)"
done <tests/lib/tools.txt
[ "$missing" = 0 ] || exit 1

shell_files=()
biome_files=()
node_files=()
bun_files=()
jq_files=()
workflow_files=()
config_files=()
perl_files=()
unknown=0
while IFS= read -r path; do
  case $path in
    *.sh | scripts/celetis | board/fixtures/herdr) shell_files+=("$path") ;;
    *.js | *.mjs)
      biome_files+=("$path")
      node_files+=("$path")
      ;;
    scripts/*.ts)
      biome_files+=("$path")
      bun_files+=("$path")
      ;;
    *.ts | *.json | *.jsonc | *.css) biome_files+=("$path") ;;
    *.jq) jq_files+=("$path") ;;
    .github/workflows/*.yml) workflow_files+=("$path") ;;
    .celetis.yaml) config_files+=("$path") ;;
    *.pl) perl_files+=("$path") ;;
    # the text rules only: the maintainer's decision in #83
    *.md) ;;
    # Git reads them, and no established checker exists
    .gitignore | .gitattributes) ;;
    # no checker runs without the Codex CLI; tests/setup.test.sh checks its text
    .codex/rules/*.rules) ;;
    # tests/text.test.sh reads it and fails on a line that allows no hit
    tests/product-words.allow) ;;
    # tests/text.test.sh compares each one with its one allowed text
    skills/*/agents/openai.yaml) ;;
    # the gate or its tool reads each one at each run
    .editorconfig | .shellcheckrc | tests/lib/tools.txt) ;;
    # a font is binary; its licence is text that the text rules read
    board/fonts/*) ;;
    # the text rules read the licence, and tsc reads the declarations through the import of scripts/lib/config.ts
    scripts/lib/vendor/yaml.LICENSE | scripts/lib/vendor/yaml.d.mts) ;;
    # Biome 2.5.15 checks HTML only as an experimental feature, and the spec of #83 exempts HTML until it is stable
    *.html) ;;
    *)
      echo "verify: no check for $path: add a row or an exemption in scripts/verify.sh"
      unknown=1
      ;;
  esac
done < <(git ls-files)
[ "$unknown" = 0 ] || exit 1

check_perl() {
  local file
  for file in "${perl_files[@]}"; do
    echo "== perl -c $file"
    perl -c "$file"
  done
}
check_text() {
  echo "== tests/text.test.sh"
  PATH="/bin:$PATH" /bin/bash tests/text.test.sh
}
check_plugin() {
  echo "== claude plugin validate"
  claude plugin validate .
}
check_shfmt() {
  local file bad=0
  [ ${#shell_files[@]} -eq 0 ] && return 0
  echo "== shfmt -l"
  while IFS= read -r file; do
    if [ -f "$file" ]; then
      shfmt -d "$file" || true
      echo "verify: run shfmt -w $file"
    else
      echo "$file"
    fi
    bad=1
  done < <(shfmt -l "${shell_files[@]}" 2>&1)
  [ "$bad" = 0 ]
}
check_biome() {
  local out bad=0
  [ ${#biome_files[@]} -eq 0 ] && return 0
  echo "== biome check"
  out=$(biome check --error-on-warnings --max-diagnostics=none "${biome_files[@]}" 2>&1) || bad=1
  echo "$out"
  # Biome exits 0 on an info finding
  if grep -Eq '^Found .* info' <<<"$out"; then bad=1; fi
  [ "$bad" = 0 ] || {
    echo "verify: fix each file that Biome names above with biome check --write <file>"
    return 1
  }
}
check_shellcheck() {
  echo "== shellcheck: $1"
  shellcheck -f gcc "$1" || {
    echo "verify: shellcheck $1: fix each finding above, or disable its rule with a reason"
    return 1
  }
}
check_bash_syntax() {
  local file bad=0
  [ ${#shell_files[@]} -eq 0 ] && return 0
  echo "== bash -n"
  for file in "${shell_files[@]}"; do
    /bin/bash -n "$file" || {
      echo "verify: $file: syntax error (/bin/bash -n)"
      bad=1
    }
  done
  [ "$bad" = 0 ]
}
check_node_syntax() {
  local file bad=0
  [ ${#node_files[@]} -eq 0 ] && return 0
  echo "== node --check"
  for file in "${node_files[@]}"; do
    node --check "$file" || {
      echo "verify: $file: syntax error (node --check)"
      bad=1
    }
  done
  [ "$bad" = 0 ]
}
check_jq_syntax() {
  local file bad=0
  [ ${#jq_files[@]} -eq 0 ] && return 0
  echo "== jq -f"
  for file in "${jq_files[@]}"; do
    jq -f "$file" /dev/null || {
      echo "verify: $file: syntax error (jq)"
      bad=1
    }
  done
  [ "$bad" = 0 ]
}
check_actionlint() {
  [ ${#workflow_files[@]} -eq 0 ] && return 0
  echo "== actionlint"
  actionlint "${workflow_files[@]}"
}
check_config() {
  [ ${#config_files[@]} -eq 0 ] && return 0
  echo "== celetis_config_read"
  (. scripts/celetis && celetis_config_read "$PWD" >/dev/null) || {
    echo "verify: .celetis.yaml: fix the error above"
    return 1
  }
}
check_tsc() {
  if [ ${#bun_files[@]} -eq 0 ]; then
    echo "== tsc: no TypeScript file in scripts/"
    return 0
  fi
  echo "== tsc"
  tsc -p scripts/tsconfig.json --typeRoots "$npm_root/@types"
}
pool_run shfmt check_shfmt
pool_run biome check_biome
if [ ${#shell_files[@]} -gt 0 ]; then
  for file in "${shell_files[@]}"; do
    pool_run "shellcheck $file" check_shellcheck "$file"
  done
fi
pool_run "bash -n" check_bash_syntax
pool_run "node --check" check_node_syntax
pool_run jq check_jq_syntax
pool_run actionlint check_actionlint
pool_run config check_config
pool_run tsc check_tsc
pool_run perl check_perl
pool_run text check_text
pool_run plugin check_plugin
pool_wait || {
  echo "verify: FAIL"
  exit 1
}
echo "verify: PASS"
