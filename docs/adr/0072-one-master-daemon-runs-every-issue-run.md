# One master daemon runs every issue run

## Date

2026-11-05

## Related

- [Issue #247](https://github.com/ddinkov10/celetis/issues/247): its approved spec
  (`Spec: 2026-11-05`), the decisions of the maintainer, and its plan.
- [Issue #240](https://github.com/ddinkov10/celetis/issues/240): the epic. #248 moves the CLI
  starts to the daemon, #249 moves the board presses, and #250 hosts the board, the update, and the
  landing.
- [ADR-0062](0062-each-session-runs-in-a-tab-that-the-runner-steers.md): each session runs in a
  tab that the runner steers, with the start barrier and the close rule.
- [ADR-0029](0029-the-repository-keeps-no-tests.md): the runtime proof is a probe in a lab, not a
  tracked test.
- `engine/lib/daemon-server.ts`, `engine/lib/daemon-types.ts`, `engine/lib/run-engine.ts`, and the
  `--daemon` dispatch of `engine/celetis-flow.ts`.
- `docs/celetis-flow.md` ("The master daemon", "Limits").

## Context

Each start of `celetis-flow` is its own process. A numbered start, the automatic runner, a queue
wake, and a resume each run in a separate runner process. No process knows or steers all the work
of a repository. A runner that stops leaves its working sessions with no steering, and no later
process takes them over. The maintainer wants one owner of the whole cycle: "sessions opened by
the daemon has to be managed and steered by the daemon. He is the sole overseer of the full
end-to-end cycle of the factory."

## Constraints and evidence

- `engine/lib/locks.ts`, `engine/lib/step-end.ts`, and `engine/lib/quota-recovery.ts` accept a
  runner only when its command line contains `celetis-flow.ts`. A process with another script name
  looks like a stale owner, so a second owner can take its issue.
- A released start barrier does not depend on its runner: `waitingSession` reads the runner only
  before `go`. So a session in its tab continues while no runner or daemon runs (ADR-0062).
- On macOS (Darwin 25.4.0), `sun_path` of a Unix socket address is 104 bytes. A socket under the
  Git common folder of a deep checkout can be longer.
- Bun 1.4.4: `Bun.serve({ unix })` serves HTTP on a Unix socket, and `fetch(url, { unix })` sends a
  request on it. `server.stop()` waits for the requests in flight and removes the socket file. In a
  probe of #247, `server.stop(true)` directly after the answer of a stop request lost that answer
  (`ECONNRESET`).
- Bun 1.4.4: `AsyncLocalStorage.run` keeps its store across timers, child process events, and file
  reads, for concurrent stores. So one process can tag the output of each run.
- Windows is not a support target (ADR-0058, ADR-0062).
- The lab probes of #247, Task 3 (`/private/tmp/celetis-247-checks/daemon.ts`): three sessions of
  two hosts ran at the same time in one daemon PID. Each lock owner named the daemon PID. A stop
  kept each released session in its tab. A step-end record that could not be removed stopped the
  daemon with exit 1, and both sessions stayed live.

## Decision

- **One daemon for each Git common folder.** The daemon is the same script as the runner:
  `engine/celetis-flow.ts --daemon`. So every existing check of a runner identity accepts it, and
  the start barrier stays `celetis-flow.ts --session-start`. The daemon holds the lock ref
  `daemon`. A second daemon of the repository finds the holder and stops with exit 1. A linked
  worktree has the Git common folder of its main checkout, so it reaches the same daemon.
- **HTTP over a Unix socket in a private folder.** The socket is
  `/tmp/celetis-<uid>/daemon/<first 16 hex digits of sha256(common folder)>.sock`, in a 0700
  folder, so its path stays under 104 bytes. Only the same user can open the folder, and the
  daemon uses no token. The state folder `<git common dir>/celetis-flow/daemon/` (0700) holds the
  identity file `daemon.json` (0600), which a client reads to find the daemon.
- **One run engine.** Each request makes one run of `engine/lib/run-engine.ts` with its own lock
  owner, so the issue locks, the `queue` lock, and the `runner` lock keep one owner across the
  daemon, an old runner, and a second daemon. Each request carries its own host selection; the
  environment of the daemon never selects a host.
- **The old runner stays beside the daemon** until #248 and #249 move the callers. The current
  `celetis-flow` commands and the board presses do not change.
- **Sessions live outside the daemon.** A stop detaches each run: it ends the step-end watch and
  the usage watch, removes the step-end record, and keeps the released session, its tab, the owner
  record of its lock (the daemon and the session, for the adoption), the queue record, and the
  recovery record. The automatic runner is off at each start.
- **A run that ends leaves its locks to its live session.** The daemon outlives its runs, so a run
  that ends while its session lives replaces the daemon in each owner record that it holds with no
  runner. The lock is then free when the session ends, as after the exit of an old runner.
- **Takeover by lock adoption.** A later daemon takes over the runs and the live sessions of an
  earlier one with `LockOwner.adopt`, which replaces a definitely gone runner in an owner record
  and keeps its live session (#247, Tasks 5 and 6).

## Alternatives considered

- **A file inbox.** A client writes a request file, and the daemon polls the folder and writes a
  reply file and a status file. It matches the queue launch token and the Retry record and has no
  path limit. It gives no direct answer, needs a poll for each reply and a cleanup of stale request
  files, and is slower. Not picked.
- **The board model.** The daemon runs in a hidden hc terminal and serves TCP on 127.0.0.1 with a
  token file. The daemon then depends on the hc server, and a TCP port needs the trust checks of
  the board server. Not picked.
- **A daemon script with its own name** (for example `engine/daemon.ts` as the process). Each
  identity check of `locks.ts`, `step-end.ts`, and `quota-recovery.ts` would then see a stale owner,
  so the name `celetis-flow.ts` stays; `engine/daemon.ts` is only the typed sub-command.
- **A restart with no takeover** (OpenAI Symphony). The maintainer rejected it: a stop must not
  lose the steering of a working session (decision 2 of #247).

## Consequences

- One process owns every run of a repository. A defect of one run ends only that run, but a
  step-end record that can neither be removed nor emptied stops the whole daemon, because only the
  death of the named runner revokes that record. The released sessions stay in their tabs.
- A stop or a crash leaves the sessions with no steering until a new daemon takes them over. A
  session that ends its step in that gap waits idle.
- The environment of the daemon is the environment at its start. A later change of `PATH`,
  `CLAUDE_CONFIG_DIR`, or `CODEX_HOME` reaches it only at its next start.
- The output of all runs goes to one log, with a run tag on each line. The log has no rotation.
- Two run paths exist until #248 and #249 land: the old runner and the daemon share the engine and
  the locks.
- No Windows: `--daemon` refuses there with exit 2.

## Reconsider when

- The board or the CLI moves to the daemon (#248, #249), and the old runner path goes.
- Windows becomes a support target, so a Unix socket in `/tmp` is not available.
- A client of another user or of another machine must reach the daemon, so a folder mode is not
  enough access control.
- The lock identity checks stop using the script name `celetis-flow.ts`.
