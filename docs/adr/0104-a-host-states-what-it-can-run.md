# A host states what it can run

## Date

2026-11-12

## Related

- [Issue #308](https://github.com/ddinkov10/celetis/issues/308): the spec (the body of the issue). In this record,
  "The capability of the host", "The adapter", "D3", and "D4" name parts of that body.
- [Issue #307](https://github.com/ddinkov10/celetis/issues/307): the agent registry, the board default write, and
  availability. It reads its choices from the adapter table that this record extends.
- [ADR-0058](0058-herdr-core-hosts-the-agent-terminals.md): the status of a session is only what the host reports,
  and the host stays the child of the runner in the terminal of the runner. OpenCode follows it with no new
  tracking code.
- [ADR-0087](0087-the-board-reads-engine-state-through-one-read-model.md), decision 3: `engine/lib/fields.ts` keeps
  its patterns and checks. This record adds one check to the same module; it replaces none of them.
- [ADR-0090](0090-a-contract-version-replaces-the-same-revision-rule.md), decision 2: `requireContract` finds the
  plugin folder with `installedRoot`. The lookups of Claude Code and Codex stay. For OpenCode, the lookup gives the
  folder of the engine (decision 3 of this record).
- `engine/lib/hosts.ts`, `engine/lib/host-types.ts`, `engine/lib/host-opencode.ts`, `engine/lib/fields.ts`,
  `engine/lib/run-activities.ts`, and `engine/lib/interactive.ts`.

## Supersedes

Only these clauses change. The accepted record keeps its historical text and evidence.

- [ADR-0088](0088-one-adapter-for-each-host-holds-the-host-differences.md), decision 1, "the table
  `{ claude, codex } satisfies Record<Host, HostAdapter>`": the table is `{ claude, codex, opencode }`, and
  `hosts.ts` also holds `canRun`, `requireCan`, and `capableOrder` (decision 2 of this record).
- ADR-0088, decision 3, "`homeEnv()` of the adapter is the only place that puts it into the environment of the
  `session-start` form": `homeEnv()` is still the only place for the home. A second adapter part, `sessionEnv`,
  gives other values of the session environment through a file of the start folder (decision 4 of this record).
- ADR-0088, decision 5, "A grep of `[!=]== '(claude|codex)'`": the grep is `[!=]== '(claude|codex|opencode)'`, and
  it finds lines in the same ten modules.
- [ADR-0067](0067-local-agent-priority-and-usage-recovery.md), "Decision", "New default work uses the first included
  host without a confirmed active usage block" and "Try each eligible host once per failure cycle": the host must
  also be able to run the step or the session (decision 3 of this record); a host that cannot is not eligible.
- [ADR-0069](0069-step-agent-preference-is-tracked-policy.md), "Decision", "Pass the effective order to the
  unchanged selection, recovery, and wait": the selection, the recovery, and the wait get the effective order
  filtered by `capableOrder`, which keeps the preferred agent. "Intake, Assist, Make visual, control operations, and
  the board admission check keep the local order": Intake, Assist, Make visual, and the coordinator session get the
  local order filtered by `capableOrder` for an interactive session. The control operations and the board admission
  check keep the local order.

## Context

Issue #308 adds OpenCode as a runner host for the step `triage` only. The engine had two hosts that can run each
step and each command. A third host that can run only one step needs a rule for each other step and each command
that `--agent opencode` or `CELETIS_AGENT=opencode` reaches. Without one, a consumer that assumes Claude Code or
Codex after an `isHost` guard silently takes the path of another host, or an OpenCode session starts for a step
whose skill text has no OpenCode part.

The need: each host states what it can run, each start and each command refuses a host that cannot run it with
its cause and the exit class `prerequisite`, no other host is substituted, and the default order does not choose
a host that cannot run the step.

## Constraints and evidence

- ADR-0088: one adapter for each host holds the host differences, and a new host adds one adapter and one row of
  the table. So the capability is a part of the adapter, and no consumer compares a host with `'opencode'`.
- The spec, "The adapter": OpenCode reads its skills through `OPENCODE_CONFIG_CONTENT` with `--standalone`. It has
  no plugin installation of its own, and the engine edits no OpenCode configuration file of the maintainer.
- The OpenCode session ID has the form `ses_` and 26 characters (the spec, "Design probes", P2). It is no UUID, so
  the session ID check depends on the host.
- The build probes of the third task of the plan of #308 (the
  [`## Plan` comment](https://github.com/ddinkov10/celetis/issues/308#issuecomment-6827042418)) ran in a scratch fixture repository with no remote, a fake `gh`, and fake host
  programs, with the daemon in a lab of `scripts/herdr-lab.ts`. Each refused command exited 3 with its cause and
  started no host and sent no daemon request. On the base commit, the same commands passed, failed later with
  another class, or started the host. A Resume of a saved OpenCode `specify` session exited 3 with the step cause
  and opened no tab; on the base commit it started `opencode` in a tab.

## Decision

1. **OpenCode is the third host.** `engine/lib/host-names.ts` lists `claude`, `codex`, and `opencode`, and
   `engine/lib/host-opencode.ts` is its adapter. `PluginHost` and `pluginHosts` name the hosts with an installed
   plugin (Claude Code and Codex); the installation and update modules take only those.
2. **The adapter states its capability.** `HostAdapter.capability` is
   `{ steps: 'all' | readonly Step[]; interactive; dispatch; landing; setup }`. OpenCode has
   `{ steps: ['triage'], interactive: false, dispatch: false, landing: false, setup: false }`; Claude Code and Codex
   can run everything. `hosts.ts` reads it in `canRun(host, need)`, `requireCan(host, need, prefix)`, and
   `capableOrder(order, need, preferred)`. A refusal names the host, the step or the command, what the host runs,
   and the hosts that can, with the exit class `prerequisite`.
3. **Where a refusal sits.**
   - A step: `requireStart` of `engine/lib/run-activities.ts`, before any other start check, for the start of a
     step (`preparing`) and for a Resume (`prepareResume`, with the step of the saved record). It covers each source
     of the host: an explicit choice, a queue choice, `agents.<step>`, the order, a Resume, and the next step of a
     run with the explicit host (D4). The refusal takes the existing failure path of a start.
   - A command, where it resolves its host and before it starts a process or sends a daemon request: `land` (the
     client, from `--agent` or `CELETIS_AGENT`, and the landing in the daemon after its `createOperation`),
     `dispatch` (after its `createOperation`), `capscore` (from `--agent` or `CELETIS_AGENT` before its
     `--attempt` branch, and after its `createOperation`), `assist`, `intake`, and `visual` (`interactiveHost` of
     `engine/lib/interactive.ts`, right after their `createOperation`), `coordinator` (the client before the open
     request, and `interactiveHost` in the daemon), and `setup` (after the `createOperation` of `main`, also for
     `setup status`). The later `createOperation` calls of the landing and of `setup` reuse the selection that
     the first call checked. The forms `coordinator status`, `read`, and `send` select no host and are not refused.
   - The default order: `selecting` of `engine/lib/run-machine.ts` passes
     `capableOrder(effectiveOrder(order, preferred), { kind: 'step', step }, preferred)` to `selectAgent`, and
     `interactiveHost` filters the order with `{ kind: 'interactive' }`. `capableOrder` drops each host that cannot
     run the need, except the preferred host of `agents.<step>`. When no host is left, it keeps the order, so the
     start refuses with its cause. So a usage limit of the other hosts makes the step wait (D3), and the quota wait
     counts a renewed host only when it can run the step of the wait.
4. **The plugin and the session environment of OpenCode.** `installedRoot('opencode')` is the folder
   `plugins/celetis` of the engine version folder, so `requireContract` reads that folder. OpenCode has no install
   and no update path: `celetis update` covers the folder as a part of the engine. The adapter part
   `sessionEnv({ plugin, folder, stepText })` writes the step text to `step.md` of the start folder and returns
   `OPENCODE_CONFIG_CONTENT` with the skills folder and that file. The daemon writes the values to the file `env`
   of the start folder (`startFiles(dir).env`), and the `session-start` form adds them to the environment of the
   host child. Claude Code and Codex return `{}`.
5. **The session ID check depends on the host.** `isSessionId(host, value)` of `engine/lib/fields.ts` accepts a
   UUID for Claude Code and Codex, and `ses_` with 26 letters and digits for OpenCode. Each record that holds a
   session ID (the session record, the run record, the quota recovery record, the usage records, and the step end)
   and each adapter check uses it.

## Alternatives considered

- **A host comparison at each consumer** (`host === 'opencode' ? refuse : …`). It puts the facts of one host in
  many modules, against ADR-0088, and a new limited host would edit each site again.
- **A refusal at the board or in the client only.** The daemon also starts a step from a queue choice, from
  `agents.<step>`, from the order after a usage limit, and for the next step of a run. Only the start check covers
  each source.
- **A default order that substitutes another host.** The spec forbids it: an explicit choice or a preference of
  OpenCode for a step other than triage refuses, and no other host is started in its place.
- **An empty order after the filter.** It makes the step wait for a host that cannot exist. The unfiltered order
  makes the start refuse with the cause that names the fix.

## Consequences

- A start or a command that OpenCode cannot run exits 3 with one line that names the fix, and nothing starts.
- The default order and the quota recovery take OpenCode only for `triage`. A run that waits for a usage limit
  with no other capable host keeps waiting, as when every host is blocked.
- A command with the default choice uses the first host of the order. When that host is OpenCode, `land`,
  `dispatch`, `capscore`, and `setup` refuse instead of taking the next host.
- The new parts are in the adapter type, so the compiler requires them for each next host.

## Reconsider when

- OpenCode gets the skill text of more steps or an interactive session: its capability grows, and no consumer
  changes.
- The capability moves into the registry entry of each agent. #307 added the registry, and the merge kept the
  capability in the adapters.
- OpenCode gets a plugin installation or a session ID form of its own: decisions 4 and 5 change.
