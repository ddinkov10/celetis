# The board starts each step from the copy of its host

## Date

2026-10-27

## Related

- [Issue #145](https://github.com/ddinkov10/celetis/issues/145): the root-cause report and plan.
- [ADR-0030](0030-the-installed-plugin-owns-the-entrypoint.md),
  [ADR-0035](0035-the-board-is-a-part-of-the-engine.md), and
  [ADR-0028](0028-terminal-confirmed-native-plugin-updates.md).
- `engine/board/adapter.ts`, `engine/board/server.ts`, `engine/lib/host.ts`,
  `engine/lib/plugin-metadata.ts`, and `engine/lib/session.ts`.

## Supersedes

Only these clauses change. The accepted records keep their historical text and evidence.

- ADR-0035, "The board is a part of the engine": in Decision, "A fixed adapter", the entrypoint
  of the running package checked once at the start; the 409
  `the plugin version of this board was removed after an update; start the board again` in
  Decision and Consequences; call 7; in "The trust boundary", "the start checks the two paths
  once"; and the Consequence on Finding 5 for a board.
  The adapter now finds and checks the copy of the session's host at each press. A Codex board
  Run or Resume can therefore use the enabled Codex root without an install of the board build.
- ADR-0030, "The installed plugin owns the entrypoint": the Decision sentence "It validates the
  package entrypoint and selected Bun." for the board adapter. The start checks only the runtime;
  each press checks its found entrypoint.

## Context

A board that ran from the Claude copy used that package for a Codex Run or Resume. Before the
session started, `codexSessionPin` refused the runner because its root was not the enabled Codex
root. The pin keeps the runner's step text and the session's skills at one revision. The choice
of package in the board was the defect.

## Constraints and evidence

- The red repro of #145 passed `codexSessionPin` with the enabled Codex root and failed with two
  Claude roots. The pin and `engine/celetis-flow.ts` stay unchanged.
- `installedRoot` gives the enabled canonical root for each host. The Claude path changes at an
  update. One lookup on this machine took 357 ms for Claude and 699 ms for Codex.
- HTTP requests select only a host and an issue. They never supply an entrypoint path. Each found
  entrypoint must pass the existing read, regular-file, control-character, and containment checks.
- The POSIX and Windows pane lines keep their text except for the entrypoint path. The Windows
  PowerShell form of ADR-0034 stays; this machine cannot check that path.
- ADR-0028 permits open boards during updates. New board code still needs a board restart.

## Decision

At each Run or Resume press, the board finds the enabled copy of the session's host with
`installedRoot`, checks its `bin/celetis.ts`, and types the line from that copy. Run uses the
selected agent. Resume uses the host of the saved record, and its line still has no `--agent`.
The runner still reads the record and uses its exact session ID.

The start checks only the selected runtime. The board keeps no found copy between presses. A
Claude update needs no board restart for Run and Resume. A lookup, saved-record, or entrypoint
failure returns 409 with the first line of the error before tab creation or pane execution.
Read-only herdr status calls can precede that failure. The old removal 409 goes.

A press takes no `withPluginRead` lock. The runner of that press takes the lock and checks the
update policy and the pin, as ADR-0035, call 11 requires. Discovery does not reserve an install
for the lifetime of the board or of its pane.

## Alternatives considered

- Change Codex only. A Claude Run would still use the copy that started the board and could keep
  an old or removed path after an update. Both hosts need the same rule.
- Relax `codexSessionPin`. The runner's step text could then differ from the session's skills.
- Use one shared engine install for all hosts. It would be a third install with its own updater,
  and it would still need a revision check against two skill copies. ADR-0030 rejected a global
  installer. The two native installs remain the owners for now.

## Consequences

- The board line uses the same host copy that a maintainer finds for a manual start. The copy
  that started the board and the board's `--agent` no longer select the copy of a Run or Resume.
- A press adds one native lookup. An absent or ambiguous install stops the press before a tab
  opens. An update between lookup and execution can still stop the runner with its true cause.
- Removing the copy that started the board does not stop a later Run or Resume from finding the
  enabled copy. The board still runs the code loaded at its start, and removed page assets can
  require a reload or restart.
- The live Codex session remains the check of "After the landing" in the plan of #145.

## Reconsider when

- Both hosts can load one shared install.
- Celetis gets one engine install for all hosts.
- A lookup takes much longer than one second.
