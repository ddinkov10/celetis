# The board is a part of the plugin

## Date

2026-10-21

## Related

- ddinkov10/celetis#84: the spec of this change. ddinkov10/celetis#83: the fast gate of a lane.
- ADR-0009: the board is a package of its own. This record replaces parts of it.
  ADR-0012: the harness is the plugin `celetis`, with no version and no release step.
  ADR-0014: the explicit host operations, with the Codex limit on installed files.
  ADR-0015: one repository YAML config, and the stdin config of the board.
- ddinkov10/agent-board#27: the board reads its config from stdin only.
- The source repository `https://github.com/ddinkov10/agent-board` at commit
  `95144d35b8e1de6ae6b3a261dff4f541091e3dd1`. It keeps its history and its tags `v1.0.0` to
  `v2.2.1`, and it is archived after the landing.
- `board/`, `scripts/board.sh`, `scripts/verify.sh`, and `.github/workflows/test.yml`.

## Supersedes

From ADR-0009, "The board is a package of its own, and a contract with a version is its input",
these parts:

- Decision 1: the design for a second repository with no scripts.
- Decision 3: the `npx github:` start, and the git tag as the release.
- Decision 4: the repository `ddinkov10/agent-board`. The name `agent-board` stays in the log line
  and in the browser storage keys.
- The call "The tests of this repository start the checker through the variable `AGENT_BOARD`,
  else through the pinned `npx` command", and the plan decision on `AGENT_BOARD`.

From ADR-0015, "One repository YAML file owns Celetis setup", this part of its Decision:

- The words "to the exact released board" and "The separate board package keeps its command/path
  validator and contract 1". `scripts/celetis board` now sends the config to `board/cli.mjs` of
  the same plugin. The validator and contract 1 stay, now in `board/` of the plugin. The board
  still does not know YAML or Celetis field names. The storage decision of ADR-0015 stands, and
  this record changes no other part of it.

This record keeps contract 1, the config keys `data`, `run`, `resume`, and `port`, the five trust
rules, and the flat layout, now under `board/`. ADR-0015 replaced Decision 5 before this record.

## Context

Until this change, the board was the private package `ddinkov10/agent-board`.
`scripts/celetis board` fetched it at each start with this command:

```bash
npx --yes 'github:ddinkov10/agent-board#v2.2.1' --config-stdin
```

This had four costs:

- Each start needed the network and git credentials for a private repository.
- npm 12 sets `allow-git` to `none` by default, so it refuses the git spec. `scripts/board.sh` did
  not pass `--allow-git=root`.
- The pin `v2.2.1` was in 9 files of this repository. A change across the boundary needed a board
  change, a board tag, and then a pin change here, in two issue trackers.
- CI set `CELETIS_FLOW_SKIP_BOARD_CHECK=1`. So no CI run checked contract 1 against the board, and
  no CI run started the board with the config of `scripts/board.sh`.

The reason for a separate package (ADR-0009, Decision 1) was a second repository with no Celetis
scripts. No repository uses the board without Celetis now. Each user of the board runs Celetis.

## Constraints and evidence

The spec and the plan of #84 read these facts on 2026-10-21.

The plugin hosts:

- Claude Code: `${CLAUDE_PLUGIN_ROOT}` is in hook, MCP, and LSP processes, not in a Bash tool
  command. A `bin/` folder is on the `PATH` of the Bash tool, but claude.ai and Cowork do not
  install a plugin that has it. A plugin has no install step
  ([plugins reference](https://code.claude.com/docs/en/plugins-reference)).
- Claude Code copies the whole tree of the plugin to
  `~/.claude/plugins/cache/<marketplace>/<plugin>/<version>/`. On the build machine,
  `/root/.claude/plugins/cache/celetis/celetis/644bac42215d/` holds `docs/`, `hooks/`,
  `scripts/`, `skills/`, `tests/`, and the root files. Its name is the short commit of `main`.
  Claude Code removes the folder of an old version 14 days after an update (`AGENTS.md`,
  "Traps").
- Codex CLI 0.162.1: `copy_dir_recursive` copies each folder and each regular file of the plugin
  source. It skips each other entry, for example a symbolic link
  ([`store.rs`](https://github.com/openai/codex/blob/rust-v0.162.1/codex-rs/core-plugins/src/store.rs)).
  It copies a file with `std::fs::copy`, which "will also copy the permission bits of the original
  file to the destination file" ([`std::fs::copy`](https://doc.rust-lang.org/std/fs/fn.copy.html)).
  `board/` has no symbolic link, so the Codex install holds each file of it.
- Codex: a refresh replaced an installed file at the same path while a process still used that
  path (`docs/celetis-flow.md`, "Stable installed resources remain open"; ADR-0014).

npm 12.0.0: "allow-git and allow-remote now default to none" (the release notes, cited in
ADR-0009).

The board:

- The board has no dependency. Its files import only `node:` modules and other files of the
  board. `board/server.mjs` imports `node:child_process`, `node:fs/promises`, `node:http`, and
  `node:path`.
- `board/server.mjs` loads its modules once at the start. It reads each file of the page
  (`index.html`, `board.css`, `board.js`, and the fonts) from its own folder at each request.
- The board code at `95144d3` is the code of the release commit `2014361` (`v2.2.1`).
  `git diff --stat 2014361 95144d3` changes only `.celetis.yaml`, `.claude/celetis-flow/*`,
  `AGENTS.md`, `README.md`, and `scripts/celetis`.

CI: the board repository is private, and a workflow of this repository cannot read it. That was
the cause of the skip variable.

The build of #84 gave these results on Linux, with Node 22.22.0, as the root user:

- The copy of 31 files matched the source: `diff -r` printed nothing. `(cd board && node --test)`
  passed 320 tests, with 2 skipped. The 2 skipped tests covered the file mode only.
- After the file mode went, the board suite passed 300 tests, with 0 skipped and 0 failed, in 15
  to 19 s.
- `tests/text.test.sh` failed on one line of the font licence `board/fonts/OFL.txt`. One line of
  `tests/product-words.allow` allows it.
- With no `AGENT_BOARD` and no skip variable, `tests/board.test.sh` passed in 3 s,
  `tests/board-agent.test.sh` in 13 s, and `tests/celetis-flow.test.sh` in 22 s.
- A dry run of the copy passed `claude plugin validate .`, with the warnings that it gives on
  `main`.

## Decision

The board is `board/` of the plugin `celetis`. A plugin install or update gives each product
project the board. `scripts/celetis board` starts the board file of the installed plugin.

- **The layout and the start.** The board files are in `board/` at the plugin root, in the flat
  layout of ADR-0009. `scripts/board.sh` removes each `node_modules/.bin` entry from `PATH`. Then
  it starts `node "$plugin/board/cli.mjs" --config-stdin`. `$plugin` is the absolute root of the
  plugin that holds `scripts/board.sh`. So a product project cannot put its own `node` first, and
  no `.npmrc` is read. The fifth trust rule of ADR-0009 holds before `node` starts.
- **Stdin is the only config source.** The file mode (`.claude/celetis-flow/board.json`) goes.
  Since ADR-0015, no Celetis repository has that file, and ddinkov10/agent-board#27 asks for this
  change. So that issue closes with this change, not with a v3.0.0 release.
- **`board/package.json` has no `version`.** The plugin has no version, so its commit is the only
  version of the board. The file keeps `"private": true`, the `engines` range, and the `bin` entry,
  with no dependency and no script. So `node --test` and the Node range check have one home.
- **One squash commit.** The lane copies the files at `95144d3` into `board/`, and it lands with
  the normal squash of `scripts/land.sh`. The history stays in the archived repository. The
  maintainer chose this on 2026-10-21, over a hand merge commit of a rewritten history and over a
  no-squash mode of `land.sh`.
- **The board suite runs in the gate, and in CI on Node 22.** `scripts/verify.sh` runs
  `(cd board && node --test)` after the Perl syntax check. The workflow has the step `Board tests`,
  and it runs `scripts/verify.sh` with no skip variable. The Node 22 and Node 24 matrix of the old
  repository does not come.

**Calls of the plan.** The spec did not fix these. The plan made them:

- A start with no `--config-stdin` is a usage error. `node cli.mjs` and `node cli.mjs check` exit 2
  with the usage line
  `usage: agent-board --config-stdin | check --config-stdin | check --stdin (scripts/celetis board starts the board)`.
- The status text with no data is `no issue data: the config has no "data"`. The old text named
  `.claude/celetis-flow/board.json`.
- `board/README.md` names the source commit. It points to this record for the link to the source
  repository.
- The font licence gets an allow line, not an edit. `tests/product-words.allow` has the line
  `board/fonts/OFL.txt<TAB>used to promote, endorse`.
- `scripts/board.sh` cleans `PATH` at its top, so `jq`, `yq`, `git`, and `node` all come from the
  clean `PATH`. It stops with one line when `node` is not on `PATH`:
  `celetis-board: node is not on PATH; the board needs Node 22.18, or Node 24.2 or later`. It also
  stops with one line when the plugin has no `board/cli.mjs`:
  `celetis-board: the plugin has no board/cli.mjs: <plugin>; reinstall the plugin`.
- `AGENTS.md` has a short section "The board". It holds the two rules of the old `AGENTS.md` of the
  board that no other file holds: keep the trust boundaries of `server.mjs` and `config.mjs`, and
  check a UI change in Chromium at desktop width and at 375×812.
- The acceptance row of `v2.2.1` in `docs/celetis-flow.md` becomes a row of `board/` at source
  commit `95144d3`. That commit has the board code of the release commit `2014361`.

## Alternatives considered

- **Keep the package, and add `--allow-git=root` and a new pin.** This fixes npm 12 only. Each start
  still needs the network and git credentials. A change across the boundary still needs a tag and
  a pin change, and CI still cannot read the private repository.
- **A public npm package.** It needs an npm account, and it makes the source public: ADR-0009
  rejected it for these causes. Each start still needs the network, and a release step stays
  between the board and its producer.
- **A subtree merge that keeps the history.** `scripts/land.sh` squashes each lane. So a subtree
  merge needs a hand merge commit of a rewritten history, or a no-squash mode of `land.sh`. The
  archived repository keeps the history with no such step.
- **A `bin/` folder.** claude.ai and Cowork do not install a plugin that has it.
- **An install step with `node_modules`.** A plugin has no install step, and the board has no
  dependency to install.
- **Keep the file mode.** Since ADR-0015, no Celetis repository has the file. A second config source
  is a second path for each check of the config.

## Consequences

- A board change and its producer change land in one PR, with one gate and one issue tracker.
- A start fetches no board code, so the board needs no network and no git credentials of its own.
  It needs `node` on `PATH`.
- CI checks contract 1 against the board. The flow test gives each `--board` document to
  `board/cli.mjs check --stdin` of the same checkout.
- The verify gate needs Node 22.18, or Node 24.2 or later. The other commands of the plugin still
  run with no Node.
- After a plugin update, start each running board again. On Claude Code, a running board serves the
  files of its old version folder until that folder is removed, 14 days after the update. On Codex,
  a refresh can replace a page file in place, so the page is new and the server code is old.
- The open board issues move to this tracker.
- Each plugin install holds `board/`, also on a machine that never starts the board.

## Reconsider when

- A repository without Celetis needs the board.
- The plugin hosts get an install step, or a `bin/` folder that each surface installs.
- Claude Code or Codex stops copying the whole tree of a plugin.
- The board needs a dependency or a build step.
