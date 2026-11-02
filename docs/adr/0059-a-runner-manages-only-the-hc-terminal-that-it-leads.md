# A runner manages only the hc terminal that it leads

## Date

2026-11-02

## Related

- [Issue #228](https://github.com/ddinkov10/celetis/issues/228): its `## Root cause` report, the
  two answers of the maintainer, and its plan.
- [Issue #225](https://github.com/ddinkov10/celetis/issues/225): the closed issue of the runtime
  checks, whose decision is a stop.
- [ADR-0058](0058-herdr-core-hosts-the-agent-terminals.md): the step end in an hc terminal stays,
  except the sentence below.
- `ownTerminal` of `engine/lib/terminal.ts`, and its call in `engine/celetis-flow.ts`.
- `docs/celetis-flow.md` ("The step end", "Limits").

## Supersedes

- From ADR-0058, "herdr-core hosts the agent terminals", the Decision sentence "The runner manages
  the step end when `HC_TERMINAL_ID` holds a safe ID and `hc` is on `PATH`." The other clauses of
  that Decision stay.

## Context

hc gives `HC_TERMINAL_ID` to each process that descends from the program of a terminal, and the
runner passes its whole environment to the host of the step. So a runner that the agent of a step
session starts from its shell tool, for example for a runtime check of a runner change, read the
address of the outer terminal and became managed. It then labeled, renamed, waited on, and read
the terminal of the outer session, and it could send `/exit` to it while its agent worked.

The inherited value is correct: hc uses it as the caller identity of the terminals and the sends
of the agent. The wrong premise was in Celetis: "the terminal that `HC_TERMINAL_ID` names is the
terminal of this runner".

## Constraints and evidence

The checks ran on macOS on 2026-11-02 with herdr-core 0.1.16.

- `foreground.pid` of `hc get` is "The foreground process group's leader" (`hc schema`). POSIX
  makes the foreground process group the owner of the input of a terminal (`tcgetpgrp`).
- The red repro of #228: a process that the foreground leader of a terminal spawns in its own
  process group with no controlling terminal (the shape of the Bash tool of Claude Code) got the
  same `HC_TERMINAL_ID`, passed the old check, and replaced the `celetis.link` label of that
  terminal.
- A board start and the first tab of the Herdr app run the program with `zsh -lic`, so job control
  makes it the foreground leader. On macOS and Linux the launcher replaces itself with the runner
  through `execve`, so the runner keeps the PID of that job. On Windows the launcher spawns the
  runner as a child.
- A program that `hc run` starts with no shell has a foreground on macOS whose `pid` is the root
  PID. The ADR-0058 constraint "has no `foreground` in `hc get`" did not hold there.
- `hc get` of a finished terminal has no `foreground`. `hc get` of an unknown terminal exits 3 with
  `no terminal "<id>"`.
- `hc get` reports the previous foreground for a moment after a new job takes the terminal. In the
  build of #228, a probe in a board-shaped start read the PID of an exited `ssh-add` of the login
  files for about 450 ms, then its own PID.
- Claude Code 2.1.316 runs each Bash tool command in its own process group with no controlling
  terminal. Codex 0.166.0 passes the whole environment to its commands by default; whether it uses
  a process group of its own is not checked.

## Decision

- **The runner takes `HC_TERMINAL_ID` as a hint and confirms it.** After the checks of a safe ID
  and of `hc` on `PATH`, `ownTerminal` reads `hc get <id>`. The runner is managed only when
  `foreground.pid` equals its own PID. It reads again every 250 ms for up to 5 seconds, because
  hc reports the new foreground late.
- **A runner that does not lead the terminal stops** before it reads an issue, with exit 1 and
  `celetis-flow: this runner does not lead hc terminal <id>; start it in a terminal of its own, for
  example with hc run --bg`. A terminal with no foreground gives the same stop. The maintainer
  chose a stop, not an unmanaged run, on 2026-11-02.
- **A failed read stops** before the runner reads an issue, with exit 1 and
  `celetis-flow: cannot read hc terminal <id>: <cause>`. The cause is the error of hc, or
  `hc gave no terminal` when its answer names no terminal with that ID.
- In `--queue run`, each stop line becomes the queue error, like the existing stop lines.
- With no `HC_TERMINAL_ID`, the runner stays unmanaged, as before. `--resume` reads no terminal.

The PID match, not a process-group match, is the test: a nested process can never have the PID of
the live leader, whatever process group its host gives it.

## Alternatives considered

- **Remove `HC_TERMINAL_ID` from the environment of the host.** hc uses the value as the caller
  identity, so the terminals and the sends of the agent lose their parent. Rejected.
- **A process-group match.** It also accepts a runner under a wrapper that does not exec. But it
  accepts a nested runner when a host runs its commands in its own process group, and that is not
  checked for Codex. Rejected.
- **A `CELETIS_*` marker in the environment of the host.** It misses a host that a person starts in
  an hc terminal, outside a runner. Rejected.
- **Run unmanaged when the runner does not lead.** The maintainer chose the stop, so that a wrong
  start shows at once. Rejected.

## Consequences

- A runner that a step session starts from its shell tool cannot change, wait on, or end the
  terminal of that session. A check of a runner change starts it in a terminal of its own, for
  example with `hc run --bg`.
- Each start of a managed runner makes one or more `hc get` calls more. A runner that does not lead
  its terminal stops after about 5 seconds.
- On Windows a runner in an hc terminal stops with the "does not lead" line, because the launcher
  spawns it as a child. Windows is not a support target (ADR-0058).
- A start through a shell with no job control, for example `sh -c` with two commands, or through a
  wrapper that does not exec, makes the runner stop with the same line.

## Reconsider when

- hc gives a call that tells the caller whether it owns its terminal.
- hc reports the foreground at once after a new job takes the terminal.
- Windows becomes a support target.
- The program entry stops replacing itself with the runner through `execve`.
