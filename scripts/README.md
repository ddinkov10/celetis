# The scripts

This folder holds the verify gate, the build, the pin installer, and the Herdr lab. Run each one in a
checkout of this repository. No check needs model credentials or tokens. A product project runs no
build and installs no package dependency: each machine installs the engine one time
(`plugins/celetis/README.md`, "First install"). [`AGENTS.md`](../AGENTS.md#verify-gate) gives the
rules of the gate, the build, and the pin installer for a change.

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
  `engine/lib/contract.ts` (ADR-0079 and ADR-0084).
- `checkImports`: the import rules of `engine/` (ADR-0081 and ADR-0087).
- `checkContractVersion`: the contract version of the plugin against the served versions, and
  the digest of the declarations of `engine/lib/contract.ts`
  ([`AGENTS.md`](../AGENTS.md#verify-gate) gives the rule, ADR-0090).
- The tracked-test check (ADR-0029).
- The generated files of the build.

The jobs run in bounded workers. A passing run prints the success line of
[`AGENTS.md`](../AGENTS.md#verify-gate). That section gives the command and the pinned tools.

## The build

`scripts/build.ts` writes the files that come from other files. Besides the files that
[`AGENTS.md`](../AGENTS.md#verify-gate) names, it writes the engine entry `engine/celetis` and
`plugins/celetis/hooks/entry.js`, which embeds `plugins/celetis/docs/procedures/entry.md`. An edit of
that file needs a run of the build. The build installs nothing. Add the file `engine/<name>.ts` with each new declared command.

```sh
BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 bun --no-env-file --no-install --config=/dev/null --no-macros scripts/build.ts
```

## The workflow

The workflow has one job, `test`, on Linux. It installs the pinned tools, then runs the verify gate.

## The pin installer

`scripts/install-tools.ts` installs the tool pins. The gate runs the JavaScript tool entries on the
selected Bun. [`AGENTS.md`](../AGENTS.md#verify-gate) gives its command.

## The Herdr lab

`scripts/herdr-lab.ts` runs a runtime check that uses the Herdr app or the hc core, away from the
maintainer's window and core. It is no job of the gate. [`AGENTS.md`](../AGENTS.md#host-checks) gives
its use.
