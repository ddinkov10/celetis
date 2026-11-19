# The attempt end ends each process of the attempt

## Date

2026-11-19

## Related

- [Issue #343](https://github.com/ddinkov10/celetis/issues/343): the spec (the body of the issue, `Spec: 2026-11-19`),
  with its observations, its external facts, its prior art, and the decisions of the maintainer of 2026-11-19.
  "Approach A" to "approach D" in this record name the approaches of that spec.
- [The plan of #343](https://github.com/ddinkov10/celetis/issues/343#issuecomment-7011931300): the stage constant, the
  member kinds, and the line of the signalled processes.
- [ADR-0067](0067-local-agent-priority-and-usage-recovery.md): before a retry, the daemon ends the owned session and
  establishes that it and its delegated work cannot still write. This record keeps that rule.
- [ADR-0106](0106-the-board-carries-the-acts-of-the-coordinator-session.md) cites the clause "The daemon sends no
  SIGKILL" of ADR-0080 for the end of a run session. Its point (no key into a run session) stays.
- `engine/lib/attempt-end.ts` (`endOwnedAttempt`, `recordMembers`, `stages`, `endedJob`), `requestStop` of
  `engine/lib/run-activities.ts`, `signalledLine` of `engine/lib/run-machine.ts`, and `Job` of `engine/lib/windows.ts`.
- `engine/README.md`, "A stop of a run", "Usage-limit recovery", and "A session that ended while no daemon ran".
- The lessons `.celetis/lessons/a-failed-process-read-is-not-an-exit.md` and
  `.celetis/lessons/return-the-safe-result-for-a-known-proof-blind-spot.md`.

## Supersedes

Only these clauses change. The accepted records keep their historical text and evidence. The step end of a session
keeps its rules: one SIGTERM to the host after the exit grace, and no SIGKILL.

- [The daemon ends a Claude host with SIGTERM after a grace](0080-the-daemon-ends-a-claude-host-with-sigterm-after-a-grace.md),
  in part:
  - In "Decision", the sentence "The usage-limit recovery sends the same signal inside its 20-second proof, and still
    needs the barrier and every recorded process gone before another agent starts." The recovery still sends that
    signal to the host, and still needs each member gone. After the signal, the daemon itself ends each member that
    still runs, in the stages of this record, so the proof is no longer 20 seconds.
  - In "Decision", the sentences "The daemon sends no SIGKILL, no second request, and no key to a dialog. A host that
    does not end keeps the recovery line, and the session stays open.", and "It omits their final SIGKILL", for the
    usage-limit recovery only. In a recovery and after a Stop, the daemon sends SIGKILL to each member that it can
    signal and that still runs. It sends no second request and no key to a dialog.
  - In "Alternatives considered", the rejection "SIGKILL after the grace", for the end of an attempt after a Stop or a
    usage refusal. It stays rejected for the step end.
- [Native Windows is a support target again](0107-native-windows-is-a-support-target-again.md), in part:
  - In "Decision", item 4, the words "or a member that still runs at the deadline, gives `unverified`". The daemon now
    ends the members of the job first. A member that still runs 5 seconds after that end gives `unverified`.
  - In "Decision", item 5, the words "the daemon ends only the host", for the usage-limit recovery. The host end after
    the exit grace stays. Then, after the grace of this record, the daemon also ends each other member of the job. The
    step end still ends only the host.

## Context

After a Stop from the board, the daemon often printed that it could not prove the end of the Claude session and its
delegated work, because processes of the attempt still ran (12 PIDs on #338). It kept the issue lock, and no other
agent started. The maintainer ended the processes by hand and restarted the daemon. A usage-limit recovery had the
same block: an `unverified` end starts no other agent. The proof found these processes, but the daemon only counted
them. It sent no signal to a process other than the host.

## Constraints and evidence

- On macOS 26.4.1, a step session of the daemon had these processes: the barrier, Claude, two `npm exec` processes,
  their two `node` MCP children, and `caffeinate`, all on the tab terminal. Only Claude and the two `node` processes
  showed the attempt marker in `ps eww`. The tool shells of Claude had their own process group and no terminal.
- Two processes with PPID 1 carried the markers of earlier attempts and ran days later: a `bun … serve.ts` prototype
  server and `opencode serve --service`, a shared background service. So real survivors exist, not only processes
  that are slow to exit.
- systemd, Docker, and Supervisor end a supervised program with SIGTERM, a grace, then SIGKILL. Supervisor signals
  the whole process group because a program can leave its children orphaned. Linux cgroup v2 and Win32 job objects end
  a whole container as a unit. The spec of #343 cites each source.
- macOS has no kernel container for a process tree, and no pidfd. The project has no Linux run of the proof.
- Win32 `TerminateJobObject` ends each process of a job. The documentation does not say whether a named job stays
  open by name while processes remain in it after its last handle closes. ADR-0107, item 4, states that the job
  cannot be opened then. That premise is not settled, and this record does not rest on it.
- Codex has no proved end path (`terminatesAfterGrace` is false).

## Decision

The maintainer picked approach A, for a Stop and for the usage-limit recovery (scope "both"), on 2026-11-19.

1. **Members.** A member is a process that the proof counts as a process of the attempt, recorded by PID and start
   time. Each member has one of two kinds. The daemon can signal a process of the barrier tree, a process with the
   attempt marker in its environment (not in its arguments), and a process on the tab terminal outside the tab shell
   tree while the tab is open. The daemon only counts a process on the recorded terminal that it first sees after the
   tab close, or on the path where the barrier was already gone, because that terminal name can belong to a new tab.
   The daemon process, the control child, the tab shell and its tree, the barrier (by PID and start), and PID 1 are
   never members.
2. **A shared service is a member.** The daemon ends each process that the proof finds, also a shared background
   service that the attempt started, such as `opencode serve --service`. No rule spares a process.
3. **Record first.** The daemon records the members while the barrier runs. For a Stop, this is before the tab close.
   On Windows, the daemon opens the job of the attempt by name before the tab close and holds the handle until the
   proof ends.
4. **The stages.** One stage constant of 5 seconds. The polite end stays: a Stop closes the tab, and a recovery sends
   `/exit` and one SIGTERM to the host 10 seconds after the request. A grace of 5 seconds starts at the earlier of the
   barrier end and the last polite act. Then the daemon sends SIGTERM to each member that it can signal and that still
   runs, SIGKILL 5 seconds later, and reads for at most 5 seconds more. A member that still runs then gives
   `unverified` with its PIDs. So a Stop takes at most about 15 seconds after the tab close, and a recovery about 25
   seconds after the request. When the barrier was gone at the start of the proof, the grace starts at the start of
   the proof, and the marked processes are the members that the daemon can signal.
5. **The guard.** Right before each signal, the daemon reads `processState(pid, start)` of the member. It signals
   only on `runs`. A failed read sends nothing and keeps the member as running. A changed start time is `gone`.
6. **Windows.** One job end replaces SIGTERM and SIGKILL. At the end of the grace, the daemon ends each member of the
   held job other than a live barrier with `TerminateProcess`, or the whole job with `TerminateJobObject` when the
   barrier has ended. It then reads for at most 5 seconds. A job that cannot be opened, a failed read, or a barrier
   that does not run at the start of a recovery ends no member and keeps the earlier result.
7. **The lines.** The outcome lines do not change. When the daemon signalled a member, it prints one more line first
   and records the event `attempt-signalled`. The line names the PID and the executable name of each member, not its
   arguments, so a secret in an argument does not reach the console or the event log. On Windows, the line names the
   PIDs only.

This is the practical choice: it follows the stop of systemd, Docker, and Supervisor on each platform, it uses the job
that Windows already has, and it adds no kernel container that macOS cannot give.

## Constitution

Read: `CONSTITUTION.md`, amended 2026-11-12.

- Serves: 2 Autonomous steps: a Stop or a recovery no longer holds the daemon for a manual process kill and a
  restart, which are acts outside the session.
- Serves: 1 Intent to release: a recovery continues the step on the next agent instead of a stop.
- Hard limits and non-goals: none touched.

## Alternatives considered

- **B. A kernel container for each attempt** (a cgroup on Linux, a kill-on-close job on Windows). Rejected: macOS,
  the main platform of the maintainer, has no such container, so macOS still needs approach A, and the project has no
  Linux run of the proof.
- **C. A kill of the process group of the barrier only** (Supervisor `killasgroup`). Rejected: the tool shells of
  Claude start their own group and session, so they escape.
- **D. A longer wait with no signal.** Rejected: it ends only the processes that are slow to exit, and the observed
  survivors ran for days.
- **A rule that spares a shared service.** Rejected by the maintainer: a Stop or a recovery ends every member, and the
  line names each one.

## Consequences

- A Stop or a usage-limit recovery of a Claude session ends with no manual process kill and no daemon restart in
  the common case. Only a case that the proof cannot see or cannot end keeps the `unverified` result and the lock.
- A member that ignores SIGTERM loses its unsaved work at SIGKILL. The lane worktree keeps each file that it wrote.
- Another session that uses a shared service loses it until the service starts again.
- Between the read of the state and the signal, a PID can pass to another process. The window is short, and the
  industry tools above accept the same window.
- A reused terminal name: a process of a new tab on the recorded terminal is counted, never signalled, so the result
  can be `unverified` and name PIDs of another tab.
- The blind spots stay: on macOS, a process that leaves the tree and the terminal and whose environment `ps` cannot
  show; on Windows, a process that a broker starts outside the job.
- Codex keeps a refused Stop and an `unverified` recovery. Native Windows and Linux have no runtime run of the stages
  yet (`plugins/celetis/docs/workflow.md`, "Acceptance status").

## Reconsider when

- macOS gives a kernel container for a process tree, or the project gets a Linux run of the proof (approach B).
- A host gets a proved end path for its delegated work, so the daemon needs no signal.
- A shared service of an attempt must survive a Stop or a recovery.
- The reused terminal name gives a wrong `unverified` result in practice.
- Codex gets runtime evidence of its end path.
