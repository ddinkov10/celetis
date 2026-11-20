# The scripts

This folder holds the verify gate, the build, the pin installer, the worktree setup, and the Herdr
lab. Run each one in a checkout of this repository. No check needs model credentials or tokens. A
product project runs no build: each machine installs the engine one time
(`plugins/celetis/README.md`, "First install"), and that install puts the locked packages of the
engine into its version folder. `scripts/worktree-setup.ts` installs the same packages into
`engine/node_modules` of a checkout of this repository. It installs into the checkout that holds it;
the worktree setup passes the main checkout as an argument that the script does not read.
[`AGENTS.md`](../AGENTS.md#verify-gate) gives the rules of the gate, the build, the worktree setup,
and the pin installer for a change.

## The verify gate

`scripts/verify.ts` is the verify gate. It runs these jobs, each by its name:

- The role of each tracked path.
- Biome on the authored TypeScript, JSON, and CSS.
- Strict types.
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
- The tracked-test check (ADR-0029).
- The generated files of the build.

Before the jobs, `checkDependencies` checks that `engine/package.json`, `engine/bun.lock`, and
`engine/node_modules` agree. The gate installs nothing, so a stale install refuses with the install
command, and the jobs do not start.

The jobs run in bounded workers. A passing run prints the success line of
[`AGENTS.md`](../AGENTS.md#verify-gate). That section gives the command and the pinned tools.

## The build

`scripts/build.ts` writes the files that come from other files. Besides the files that
[`AGENTS.md`](../AGENTS.md#verify-gate) names, it writes the engine entry `engine/celetis` and
`plugins/celetis/hooks/entry.js`, which embeds `plugins/celetis/references/procedures/entry.md`. An edit of
that file needs a run of the build. The build installs nothing. Add the file `engine/<name>.ts` with each new declared command.

```sh
BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 bun --no-env-file --no-install --config=/dev/null --no-macros scripts/build.ts
```

## The workflow

The workflow has one job, `test`, on Linux. It installs the locked packages of the engine with
`scripts/worktree-setup.ts`, then the pinned tools, then runs the verify gate.

## The pin installer

`scripts/install-tools.ts` installs the tool pins. The gate runs the JavaScript tool entries on the
selected Bun. [`AGENTS.md`](../AGENTS.md#verify-gate) gives its command.

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
