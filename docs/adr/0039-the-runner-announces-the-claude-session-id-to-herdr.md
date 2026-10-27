# The runner announces the Claude session ID to herdr

## Date

2026-10-27

## Related

- [Issue #144](https://github.com/ddinkov10/celetis/issues/144): the `## Root cause` report and
  the plan.
- [Issue #35](https://github.com/ddinkov10/celetis/issues/35): the host-change states and the
  runner evidence. [Issue #36](https://github.com/ddinkov10/celetis/issues/36): runner evidence.
- [ADR-0005](0005-herdr-gives-the-session-state-and-ends-each-step.md): herdr gives the session
  state and the script ends each step through herdr.
- `runIssue` and `endWhenDone` in [engine/celetis-flow.ts](../../engine/celetis-flow.ts).

## Context

On 2026-10-27, runner evidence from #35 and #36 showed that two Claude steps of one runner in one
herdr pane lose the second session ID. herdr keeps the ID of the first step. The job waits for a
new ID, reaches its 60-second deadline, and leaves `session_id: null` in the record. The
`## Root cause` report of #144 identifies the herdr rules that cause this failure.

## Constraints and evidence

The report records three rules of herdr 0.9.3. A source check on 2026-10-27 confirms them:

1. A `herdr:claude` report can replace a held, different Claude ID only for `clear`, `resume`, or
   `compact`. A second `startup` report makes no change, but the API returns success.
   `session_report_allows_session_replacement` and `conflicting_same_owner_session_ref` hold the
   rule ([src/terminal/state.rs:1288-1365](https://github.com/herdrdev/herdr/blob/v0.9.3/src/terminal/state.rs#L1288-L1365)).
   `set_agent_session_ref_for_session_start` rejects the conflict
   ([lines 1569-1578](https://github.com/herdrdev/herdr/blob/v0.9.3/src/terminal/state.rs#L1569-L1578)).
2. herdr clears a held official ID after `process_exited`
   ([src/terminal/state.rs:437-537](https://github.com/herdrdev/herdr/blob/v0.9.3/src/terminal/state.rs#L437-L537)).
   Detection reports that exit only after the pane shell returns to the foreground
   ([src/pane.rs:424-453](https://github.com/herdrdev/herdr/blob/v0.9.3/src/pane.rs#L424-L453)).
   The runner keeps the foreground between steps. With an unchanged foreground group, herdr
   probes each five seconds ([line 375](https://github.com/herdrdev/herdr/blob/v0.9.3/src/pane.rs#L375)
   and [line 578](https://github.com/herdrdev/herdr/blob/v0.9.3/src/pane.rs#L578)).
3. `AppEvent::HookAgentReleased` makes no change for an official source such as `herdr:claude`
   ([src/app/actions.rs:1496-1512](https://github.com/herdrdev/herdr/blob/v0.9.3/src/app/actions.rs#L1496-L1512)).

The report records three scratch checks on 2026-10-27:

- A first `startup` report sets the ID. A second `startup` report with a different ID keeps the
  first ID. The expected replacement fails; the check exits 1.
- `herdr pane release-agent` with source `herdr:claude` exits 0, with and without `--seq`. The
  first ID stays, and the next `startup` report still makes no change.
- A `clear` report with a newer `seq` replaces the first ID. A later `startup` report of that
  same ID keeps it. All three checks pass; the check exits 0.

## Decision

The maintainer chose the announcement on 2026-10-27. For each Claude step in a herdr pane, the
runner creates a UUID and gives it to Claude with `--session-id`. After it reads `prior` and
before the session starts, it reports the UUID to the validated pane:

```text
herdr pane report-agent-session <pane> --source herdr:claude --agent claude --seq <wall-clock ns> --agent-session-id <uuid> --session-start-source clear
```

The sequence is a wall-clock nanosecond integer, `String(BigInt(Date.now()) * 1_000_000n)`.
Reading `prior` first keeps the new ID distinct from the previous ID that the job must reject.
herdr stays the source of the identity that the job reads. The job still verifies a saved turn
with the same ID before it saves the record.

The announcement applies only to managed Claude steps. A Codex step, Resume, and a run outside
herdr keep their current paths.

## Alternatives considered

- **Wait for herdr to see the exit.** It does not see the exit while the runner keeps the
  foreground. A longer wait cannot supply the new ID.
- **Use `herdr pane release-agent`.** herdr ignores a release from an official source.
- **Save the host ID and let the idle check accept the stale herdr ID.** herdr and the board
  would show the old ID. The idle check would have to accept a second state.
- **Make a new herdr tab for each step.** This needs a large change to the locks, the automatic
  mode, and the tabs.
- **Read `~/.claude/sessions/<pid>.json`.** The Claude Code documents do not define that file.

## Consequences

The runner writes an identity into herdr under the official source. It uses `clear` although the
real start source is `startup`. This depends on a herdr source rule that its documents do not
state. herdr, the board, and the verified session record show the same ID.

If herdr changes the `clear` replacement rule, the step fails with the existing message
`no saved turn with a verified identity after 60 seconds`. The saved-turn check and the
60-second deadline stay in place.

## Reconsider when

- herdr accepts a Claude `startup` report as a replacement.
- herdr stops accepting `clear` from a report.
- herdr honors a release from an official source.
- The runner stops keeping the foreground between steps.
- Claude Code removes `--session-id`.
