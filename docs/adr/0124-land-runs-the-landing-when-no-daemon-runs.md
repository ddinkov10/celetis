# Land runs the landing when no daemon runs

## Date

2026-11-21

## Related

- [Issue #356](https://github.com/ddinkov10/celetis/issues/356): the spec (the body of the issue, `Spec: 2026-11-21`),
  with the prior art and the external facts.
- [ADR-0072](0072-one-master-daemon-runs-every-issue-run.md) and
  [ADR-0073](0073-the-runner-commands-are-clients-of-the-master-daemon.md): the daemon runs the runs, and the runner
  commands are its clients. ADR-0073 rejected "A fallback to the old runner when no daemon runs" because it kept two
  run paths. That fallback was for runs. This record keeps one landing implementation, `runLanding`, so it does not
  contradict ADR-0073. `run` and `queue` still need a daemon.
- [ADR-0079](0079-one-contract-module-declares-the-commands-and-the-exit-classes.md): the contract holds the help of `land`.
  Its exit classes do not change.
- `engine/land.ts` (`landDirectly`), `engine/lib/landing/landing.ts` (`lockedLanding`, `runLanding`),
  `engine/lib/landing/merge.ts`, `engine/lib/state/locks.ts` (`createLockOwner`).

## Supersedes

Only these clauses change. The records keep their historical text and evidence.

- [The master daemon runs each landing](0078-the-master-daemon-runs-each-landing.md), in part:
  - in "Decision", the sentence "`land` is a client of `POST /land`" as the only role of `land`: `land` is the client
    only when a daemon of its revision runs;
  - in "Decision", "The lock ref `land-<n>`": the owner record names the daemon PID, and the release happens "while the
    daemon lives". A direct landing names the `land` process as the session, and the release happens while that process
    lives;
  - in "Decision", "One at a time": it holds when a daemon runs;
  - in "Consequences", "The landing needs a running daemon of the same revision. With none, `land` exits 6.": with no
    daemon, `land` lands. A daemon of another revision still gives exit 3, and a daemon that does not answer exit 6. In
    the code of the base, `land` with no daemon exited 3, not 6;
  - in "Consequences", "A landing runs under the daemon PID, one at a time, and the owner of its lock is the daemon.",
    and "The landing gets the environment of the daemon, not of the shell of the client.": both hold only for a daemon
    landing.
- [One contract module declares the commands and the exit classes](0079-one-contract-module-declares-the-commands-and-the-exit-classes.md),
  in part: in "The rulings of the build", two clauses:
  - "`land` is a daemon client: it returns the class that the daemon decided for the landing, parsed at the socket, and
    the class of a refusal of the request (3 with no daemon or another revision, 6 with no answer)." With no daemon,
    `land` lands in its own process and returns the class of the landing. Another revision still gives 3, and no answer
    still gives 6. The declared classes of `land` do not change;
  - "Only the final landing record of `land` is marked as recorded by the daemon in the event record, so a landing has
    one entry." A direct landing records its own `land-exit` or `land-defect` event, and `land` marks its final record
    as recorded. A landing still has one entry, and the daemon does not write it.
  The sentence "The daemon clients declare the classes that the daemon answers" of the paragraph before stays true for
  `land` with a daemon.
- [A step stops only for an act outside the session](0063-a-step-stops-only-for-an-act-outside-the-session.md), in
  part: in "A main checkout behind the trunk", "a checkout off the trunk ... still exit 6". A checkout on another
  branch, or on a detached HEAD, lands. A dirty checkout on the trunk, and a checkout on the trunk with commits that
  the trunk lacks, still exit 6.
- [The build step lands the change](0008-the-build-step-lands-the-change.md), in part: in its landing decision, "With
  `merge`, the script refuses unless the main checkout is clean, on the trunk, and level with the trunk on `origin`".
  The check "on the trunk" goes: a checkout on another branch is not checked. The other checks of that sentence hold
  for a checkout on the trunk.

## Context

A cloud session can do the steps of an issue inline with the plugin, but `land` failed there with
`land: prerequisite: no daemon runs for this repository; start it: celetis daemon start`, and the daemon needs `hc` and
the Herdr app, which a cloud machine lacks. The maintainer wants a mix of cloud and local agents to land issues. A cloud
clone can also be on a branch other than the trunk, and the merge landing refused that state with exit 6.

## Constraints and evidence

- The base `land` exited 3 (`prerequisite`) with no daemon: `requireDaemon` of `engine/lib/daemon/client.ts` threw
  `no daemon runs for this repository; start it: celetis daemon start` with `exits.prerequisite`. ADR-0078 said exit 6.
- The base merge landing refused a main checkout off the trunk with exit 6:
  `the main checkout is on <branch or a detached HEAD>, not on <trunk>: <main>; switch it to <trunk> there, then land
  again`. The landing `pr` already prints `land: the main checkout did not move to origin/<trunk>; run git pull on
  <trunk> there` and leaves that checkout alone.
- `runLanding` works in the main checkout, takes an abort signal, and sets no process-global state (ADR-0078). So any
  process can run it.
- `holderFrom` in `engine/lib/state/locks.ts` counts a `daemon` identity as live only when its command line holds
  `daemon.ts`. A `land` process in that field would read as gone while it runs. A `session` identity is live by PID and
  start time.
- The base release warning is `land: warning: cannot release the lock <name>: <cause>; restart the daemon: celetis
  daemon stop, then celetis daemon start`. `lockedLanding` keeps it for both processes.
- The Verify report of [issue #356](https://github.com/ddinkov10/celetis/issues/356) holds the probe results of the
  direct landing on Windows. The POSIX behavior of a suite that traps SIGTERM was not observed.
- Prior art: with no usable daemon, the Nx client computes in its own process
  ([Nx](https://nx.dev/docs/reference/devkit/createProjectGraphAsync)), and `--no-daemon` of Gradle runs the build in
  the client ([Gradle](https://docs.gradle.org/current/userguide/gradle_daemon.html)). Before ADR-0078, `land` ran the
  landing in its own process.

## Decision

`land` reads `findDaemon` once and picks the process:

| `findDaemon` | Act |
|---|---|
| `runs`, same engine revision | Send `POST /land`, as before. |
| `runs`, another revision | Exit 3, `the daemon runs the engine at …`, as before. |
| `unknown` | Exit 6, as before. |
| `none` | Run the landing in the `land` process (the direct landing). |

- **One implementation.** `lockedLanding` takes the lock ref, calls `runLanding`, and releases the lock. The daemon and
  the direct landing both call it. A direct landing has no line of landings.
- **The lock owner.** A direct landing writes a `session` identity for the `land` process and no `daemon` identity, so
  the lock reads as held while the process lives, and as free after it ends.
- **The output and the environment.** The output of `runLanding` goes straight to the stdout and stderr of `land`, so the
  `land:` lines equal those of a daemon landing, except the line that waits for another landing. The landing, the suite,
  and each `git` and `gh` call get the environment of the shell of `land`.
- **The signals.** The first SIGHUP, SIGINT, or SIGTERM aborts the landing, and `land` exits 128+n. A second signal
  records the `land-exit` event and exits at once. A direct landing records one `land-exit` or `land-defect` event for a
  nonzero end, and none for exit 0.
- **A main checkout that is not on the trunk.** In the merge landing, a main checkout on another branch or on a detached
  HEAD gets no status check and no fast-forward. The landing prints the `pr` line
  `land: the main checkout did not move to origin/<trunk>; run git pull on <trunk> there` and exits 0. On the trunk, each
  check stays. The refusal `switch the main checkout off <branch> first` stays, because the landing deletes the lane
  branch.
- **The other commands.** `requireDaemon` is unchanged: `coordinator` and `queue` keep `no daemon runs …`.

## Constitution

Read: `CONSTITUTION.md`, amended 2026-11-12.

- Serves: 1 Intent to release: a change of a cloud session reaches the trunk.
- Serves: 3 Verified landing: the direct landing runs the same `runLanding`, so the suite runs on the tip that lands.
- Tension: 2 Autonomous steps: with no daemon, no line puts two landings in order, so a landing that collides with
  another fails at its trunk check and needs a new `land`. Goal 1 wins: the alternative is no landing at all.
- Hard limits and non-goals: none touched. The landing path stays `celetis --agent <host> land`.

## Alternatives considered

- **`land --no-daemon`.** The plugin text must then know where it runs, and the command differs between machines. The
  intent names one command. Rejected.
- **`land` starts a daemon.** The daemon needs `hc` and the Herdr app, and only the maintainer starts the daemon.
  Rejected.
- **A fallback with a second implementation.** ADR-0073 rejected a second path. The landing logic stays in `runLanding`.
- **A `daemon` identity for the `land` process.** `holderFrom` would read the process as gone and free the lock while the
  landing runs. Rejected.

## Consequences

- A cloud session lands an issue with the command that a local session uses, with the same lines, exit classes, and
  checks.
- On POSIX, a suite that traps SIGTERM can keep running after a second signal ends a direct landing, because the SIGKILL
  timer of the abort ends with the `land` process. This was not observed.
- A second signal leaves the ref `land-<n>`. It reads as free once the process ends. It records one `land-exit` event.
- The release warning of a direct landing names the restart of the daemon, because the line is the same for both
  processes.
- With no daemon, two landings are not in one line. The second ends at its trunk check with exit 4 or exit 6. This is
  also the only guard between two machines.
- A daemon landing and a direct landing of the same issue exclude each other through the lock ref: the second gets
  exit 3 with the holder.
- A local main checkout on another branch now lands with the line of the maintainer, where it refused before.

## Reconsider when

- A claim between machines or a serialization of landings across machines becomes a goal.
- A daemon runs on a cloud machine.
- A direct landing needs a line between landings on one machine.
