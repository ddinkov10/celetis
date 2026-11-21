# The scripts

This folder holds the verify gate, the build, the pin installer, the worktree setup, and the Herdr
lab. Run each one in a checkout of this repository. No check needs model credentials or tokens. A
product project runs no build: each machine installs the engine one time
(`plugins/celetis/README.md`, "First install"), and that install puts only the locked dependencies
of the engine into its version folder. `scripts/worktree-setup.ts` installs the full lockfile, the
gate tools of the devDependencies too, into `engine/node_modules` of a checkout of this repository.
It installs into the checkout that holds it; the worktree setup passes the main checkout as an
argument that the script does not read.
[`AGENTS.md`](../AGENTS.md#verify-gate) gives the rules of the gate, the build, the worktree setup,
and the pin installer for a change.

## The verify gate

`scripts/verify.ts` is the verify gate. It runs these jobs, each by its name:

- The role of each tracked path.
- Biome on the authored TypeScript, JSON, and CSS, also of `website/`.
- Strict types, also of the TypeScript of `website/`, with no site packages.
- Native actionlint, and YAML validation.
- Plugin validation: `claude plugin validate plugins/celetis` and `claude plugin validate .`.
- `checkCitations`: the citations and the links of the agent text
  ([`AGENTS.md`](../AGENTS.md#where-agent-text-lives) lists its rules).
- `checkContract`: each `celetis` form and each exit code of the agent text against
  `engine/lib/contract/contract.ts` (ADR-0079 and ADR-0084).
- `checkImports`: the import rules of `engine/` (ADR-0081 and ADR-0087).
- `checkContractVersion`: the contract version of the plugin against the served versions, and
  the digest of the declarations of `engine/lib/contract/contract.ts`
  ([`AGENTS.md`](../AGENTS.md#verify-gate) gives the rule, ADR-0090).
- `checkTools`: the MCP tools that `engine/lib/mcp/tools.ts` builds from the agent forms of
  `engine/lib/contract/contract.ts`
  ([`engine/README.md`](../engine/README.md#the-mcp-server), "The gate", lists its rules, ADR-0125).
- The tracked-test check (ADR-0029).
- The generated files of the build.

Before the jobs, `checkDependencies` checks that `engine/package.json`, `engine/bun.lock`, and
`engine/node_modules` agree, in both `dependencies` and `devDependencies`, and `checkBunTypes`
checks that `@types/bun` is `bunFloor`. The gate installs nothing, so a stale or production-only
install refuses with the command of the worktree setup, and the jobs do not start.

The jobs run in bounded workers. A passing run prints the success line of
[`AGENTS.md`](../AGENTS.md#verify-gate). That section gives the command and the pinned tools.

## The build

`scripts/build.ts` writes the files that come from other files. Besides the files that
[`AGENTS.md`](../AGENTS.md#verify-gate) names, it writes the engine entry `engine/celetis` and
`plugins/celetis/hooks/entry.js`, which embeds `plugins/celetis/references/procedures/entry.md`. An edit of
that file needs a run of the build. The build installs nothing. Add the file `engine/<name>.ts` with each new declared command.

The board page has two steps, in `pageArtifacts`. The bundle step builds `engine/board/page/main.tsx`
into `engine/board/board.js`, with the production JSX runtime and the production condition and
`NODE_ENV` of React. Its guard refuses each bundle input that is not a file of `engine/board/`, an
issue key file of the tracker, or a file of a package that `packages` of `engine/bun.lock` holds,
nested packages too. The CSS step runs the Tailwind CLI of the lockfile on
`engine/board/page/app.css` and writes `engine/board/board.css`, with `--cwd engine/board`. Before
it, its guard runs `compile` of `@tailwindcss/node`, the compile that the CLI runs, and refuses
each path that the compile reads when the path is neither in `engine/board/` nor in a package of
`engine/bun.lock` (the decision of the maintainer on issue #344,
https://github.com/ddinkov10/celetis/issues/344#issuecomment-7060263068). The hooks of the compile
refuse each `@plugin` and `@config`, and each `@import` or `@reference` id that is absolute, a
URL, an escape, a brace pattern, a relative id with no `.css` end, or an unlocked package. Each
stylesheet that the compile reads must be in `engine/board/` or in a locked package. Each base and
pattern of the sources of the compile must stay in `engine/board/`, with no `..` segment. An
`@import` that the output still holds is refused. Tailwind drops a repeated `@tailwind utilities` rule, so the guard accepts that
repeat, and it has no effect. ADR-0123, "The limits of the checks", lists the probe of each case.
The hand-written rules of the board are in `engine/board/page/board.css`.

```sh
BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 bun --no-env-file --no-install --config=/dev/null --no-macros scripts/build.ts
```

## The workflow

The workflow `test.yml` has one job, `test`, on Linux. It installs the locked packages of the
engine, the gate tools and the packages of the board page too, with `scripts/worktree-setup.ts`,
then `actionlint` and Claude Code with `scripts/install-tools.ts`, then runs the verify gate.

The workflow `docs.yml` builds the site of `website/` and deploys it to GitHub Pages on each push
to `main`. It is no check of a change.

## The pin installer

`scripts/install-tools.ts` installs the native `actionlint` after a check of its hash, and with
`--claude` Claude Code. Biome, TypeScript, and `@types/bun` are devDependencies of
`engine/package.json`: the gate runs the JavaScript entries of Biome and TypeScript from
`engine/node_modules` on the selected Bun. [`AGENTS.md`](../AGENTS.md#verify-gate) gives its command.

## The release

`scripts/release.ts <X.Y.Z>` makes a release. The maintainer runs it at the top of the main checkout,
on `main`, with a clean tree and `HEAD` equal to `origin/main`. It makes a detached worktree in the
OS temporary folder, adds `"version": "<X.Y.Z>"` to the two plugin manifests, commits that as
`release: v<X.Y.Z>`, installs the locked packages of the engine there, runs the verify gate on that
commit, and then tags it `v<X.Y.Z>` and pushes the tag. `main` and each other branch do not move.
The tag form is `v<int>.<int>.<int>` with no leading zero and no pre-release part.

Each refusal prints `release: <reason>`. Only the failed push leaves a ref, the local tag:

- Exit 2: the argument is not one version `X.Y.Z`.
- Exit 3: the folder is not the top of a checkout, the branch is not `main`, the tree is not clean,
  or `HEAD` is not the commit of `origin/main`.
- Exit 3: `v<X.Y.Z>` is not newer than the greatest release tag of `origin`; the line names that tag.
- Exit 3: a manifest has no single line `  "name": "celetis",`, or it holds a `version` already.
- Exit 3: the release commit has no `engine/bun.lock`, or the locked package install or the verify
  gate failed on it; the line names the commit, and nothing was tagged.
- Exit 3: the local tag `v<X.Y.Z>` exists and `origin` has no such tag; the line names the push command.
- Exit 6: another Git command failed, for example `git ls-remote` with an `origin` that it cannot
  reach, or `git commit` with a hook that fails. The reason is `git <command> failed: ` and the
  error text of Git, which can have more than one line. Nothing was tagged.
- Exit 6: the push failed. The local tag stays. Run `git push origin refs/tags/v<X.Y.Z>`; the script
  does not retry, and a second run refuses because of the local tag.

A manifest that is not valid JSON gives no `release:` line: the script ends with the stack of the
JSON parse error and exit 1, and nothing was tagged.

On success it prints `release: v<X.Y.Z> -> <full commit>` and exits 0.

## The Herdr lab

`scripts/herdr-lab.ts` runs a runtime check that uses the Herdr app or the hc core, away from the
maintainer's window and core. It is no job of the gate. [`AGENTS.md`](../AGENTS.md#host-checks) gives
its use.

The lab runs on macOS and Windows. On Windows, the root is `%TEMP%\<id>`, and the lab core keeps its
state in `%LOCALAPPDATA%\herdr-core\<id>`. `up` sets a protected access list on the root (the current
user, SYSTEM, and the administrators, with no inherited entry), and `down` exits 2 with `refused` for
a root that another user owns or can reach. Windows gives no read of the environment of another
process, so a named job `Local\<id>` holds the lab processes. `up` joins the job before it starts
the core and the window, and records the window process in `app.json` of the root. A keeper
process in the job holds the job name until `down`, because the name ends with its last handle,
also while members run. `run` joins the job before it starts its command. The lab core and the
window get the full environment of the caller with the lab keys; macOS gives the window only the
lab keys, `PATH`, and the telemetry opt-out. `down` stops the lab core, ends the job and the
recorded window, and deletes the core state and the root only after the job holds no process.

A Windows `down` keeps the root, names each cause, and exits 1 in these cases: a bad `app.json`; a
lab job that cannot be opened when no earlier `down` saw it empty; a member of the lab job that
still runs after 90 seconds, or a member list that cannot be read; a lab window process that still
runs or cannot be read; a core that still answers; a real core or window that holds lab text; and
an unset `LOCALAPPDATA`. In each case, `down` still stops the lab core and ends what it can find.
Most causes clear when the cause ends and `down` runs again. Two need a manual remedy. A bad
`app.json` hides a window outside the job: confirm that no lab window is open, then delete the root
by hand. When the job cannot be opened and no `down` saw it empty (the keeper ended early), no read
finds the other lab processes, because the job name is gone and Windows gives no read of the
environment of another process. Restart Windows, or accept the risk, then delete the root by hand.
