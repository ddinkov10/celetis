# The daemon ends a Claude host with SIGTERM after a grace

## Date

2026-11-08

## Related

- [Issue #279](https://github.com/ddinkov10/celetis/issues/279): its `## Root cause` report, with
  the maintainer decisions "SIGTERM after grace" and "Both paths" of the bug session of 2026-11-08.
- [Issue #236](https://github.com/ddinkov10/celetis/issues/236): the usage-limit recovery and its
  proof that the attempt stopped.
- [ADR-0058](0058-herdr-core-hosts-the-agent-terminals.md): the step end sends the exit input
  with hc.
- [ADR-0062](0062-each-session-runs-in-a-tab-that-the-runner-steers.md): each session runs in a tab
  that the runner steers, under its start barrier.
- `engine/lib/process-identity.ts` (`terminateChild`), `engine/lib/run-engine.ts` (`endWhenDone`,
  `sessionExit`), `engine/lib/quota-recovery.ts` (`endOwnedAttempt`), `engine/lib/terminal.ts`
  (`exitGraceMs`).
- `docs/workflow.md` ("How a step runs", "Usage-limit recovery", "The event record").

## Context

The daemon ended a Claude step session only with the input `/exit`. When the session had running
background work (a background shell, a monitor, a subagent), Claude Code 2.1.319 did not exit. It
showed its dialog "Background work is running" and waited for a choice. The step end then waited
with no end, and the run kept the issue lock. The usage-limit recovery sent the same input, and its
result was `unverified`. `docs/workflow.md` defined that result: the job "does not repeat the
request or force-kill the host". The step text says that a step session ends by itself when its
step is done.

## Constraints and evidence

- Herdr lab runs of the #279 bug session: `hc send <t> /exit` exits 0 while the dialog shows, and
  the hc status stays `done`. SIGTERM to the host, also at the dialog, ends it with status 143 in
  under 1 s, stops its background shell and monitor processes, and the transcript ends with its
  `cost-state` line. Ctrl+D twice opens the same dialog.
- No environment variable of Claude Code skips the dialog.
- The start barrier handles only SIGINT and SIGBREAK. A SIGTERM to the barrier ends the barrier and
  leaves the host.
- On Windows, a signal to a process is a hard kill.
- Codex has no runtime evidence of its SIGTERM handling.

## Decision

When the Claude host still runs 10 seconds (`exitGraceMs`) after the start of a successful exit
request, the daemon sends SIGTERM once to the host process and waits for its exit again. The
grace counts from the start of the request, because `hc send` can return some seconds after the
delivery, while it waits for a turn to start. The target is
the one child of the start barrier, read with its PID and process start from one process table;
a failed read, no child, two or more children, or a changed process start gives no signal. The
step end writes the file `terminated` in the start folder before the signal, and the status 143
with that file is the requested exit: the step ends as after `/exit`, and the finished tab closes.
The usage-limit recovery sends the same signal inside its 20-second proof, and still needs the
barrier and every recorded process gone before another agent starts.

The daemon sends no SIGKILL, no second request, and no key to a dialog. A host that does not end
keeps the recovery line, and the session stays open. Codex and Windows keep the earlier behavior.

This follows the stop of Docker (`docker container stop`) and of a systemd unit: a soft request, a
grace period, then a signal. It omits their final SIGKILL, because Claude Code ends on SIGTERM and
closes its transcript.

## Alternatives considered

- **Answer the dialog by its text** (Enter on "Exit and stop tasks"): it ends the host in the lab,
  but it depends on the text and the option order of the dialog, and breaks at each change.
- **Answer the dialog first, then SIGTERM**: it adds the text dependence of the first option for no
  gain, because SIGTERM alone ends the host at the dialog.
- **A rule of the step text** that a session stops its own background work: it is soft. A session
  can miss it, and the run still waits with no end.
- **SIGKILL after the grace**: it ends the host with no transcript close and no stop of its
  background work by the host, and the maintainer decided against a forced kill.
- **SIGTERM to the start barrier**: the barrier ends and the host keeps running.
- **`hc kill` of the terminal**: it ends the terminal as a whole, not one process with a verified
  identity, and the barrier can then write no status that tells the run how the step ended.

## Consequences

- A Claude session with running background work ends about 10 seconds after the exit request, and
  the run goes on with no human act.
- A maintainer who picks "Stay" in the dialog within the grace still loses the session at 10
  seconds.
- The status 143 means the requested exit only with the file `terminated`; another 143 keeps its
  meaning, and the tab stays.
- The worktree dialog of Claude Code gets the same signal, with no runtime evidence of it. Linux has
  no runtime check yet.

## Reconsider when

- Claude Code offers a native exit that stops background work with no dialog.
- Claude Code no longer ends on SIGTERM, or no longer stops its background work on SIGTERM.
- Codex shows the same dialog problem, or gets runtime evidence of its SIGTERM handling.
- The start barrier stops running the host as its one direct child.
