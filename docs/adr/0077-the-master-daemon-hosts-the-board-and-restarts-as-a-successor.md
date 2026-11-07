# The master daemon hosts the board and restarts as a successor

## Date

2026-11-07

## Related

- [Issue #250](https://github.com/ddinkov10/celetis/issues/250): its approved spec
  (`Spec: 2026-11-07`), decisions 3, 5, and 6 of the maintainer, design probes 1 and 2, and
  "The restart".
- [The decision of the maintainer of 2026-11-07](https://github.com/ddinkov10/celetis/issues/250#issuecomment-6708237891):
  a stop after the restart claim cancels the successor.
- [The decision of the maintainer of 2026-11-07](https://github.com/ddinkov10/celetis/issues/250#issuecomment-6712021880):
  after a restart, the carried auto mode takes one issue at a time.
- [The decision of the maintainer of 2026-11-07](https://github.com/ddinkov10/celetis/issues/250#issuecomment-6712255577):
  a failed taken-over auto run stops the carried auto mode.
- [Epic #240](https://github.com/ddinkov10/celetis/issues/240): one master daemon controls all the
  operations.
- [ADR-0072](0072-one-master-daemon-runs-every-issue-run.md): the stop that detaches each run, and
  the takeover by lock adoption.
- [ADR-0076](0076-the-board-presses-are-requests-of-the-master-daemon.md): the board presses are
  requests of the daemon.
- `engine/lib/daemon-server.ts` (`runDaemon`, `serve`, the restart claim, the successor start),
  `engine/board/start.ts` (`BoardStart`, `relaunch`), `engine/board/updates.ts` (`createUpdates`),
  `engine/lib/program.ts` (`installedProgram`), `engine/daemon.ts` (`--daemon`).
- `docs/workflow.md` ("The master daemon": "The start", "The stop", "The takeover", "The
  restart"; "The board"); `engine/board/README.md` ("Start", "Open work during updates");
  `README.md` ("Updates").

## Supersedes

Only these parts change. The accepted records keep their historical text and evidence.

- ADR-0048, "Direct board update confirmation", in part: "After success, only the board that
  received the approval restarts with the approved installed program", and "other boards" among
  the processes that keep running. The approval and the validation of the installed target stay;
  the daemon that serves the board restarts.
- ADR-0035, "The board is a part of the engine", in part: the board as a long-lived process of its
  own, with its own start, its own policy check, and its own data code. The board runs in the
  daemon process.
- ADR-0064, "The board selects the first free port", in part: the board as a process of its own,
  and the rule that an update restart supplies the actual port as an exact `PORT`, "so a
  collision fails visibly instead of moving the origin". The successor tries that port first and
  then searches from `board.port`.
- ADR-0072, "One master daemon runs every issue run", for a restart only: "The automatic runner is
  off at each start". A normal start and a start after a crash keep auto mode off.

## Context

After ADR-0072, ADR-0073, and ADR-0076, one daemon ran every issue run and took every board press,
but the board server and its update check still ran as a separate `celetis --agent <host> board`
process. An approved **Update and restart** replaced only that board process in place
(`execConsumer`), so the daemon kept the old program, and each `run` and `queue` form refused its
revision until the maintainer stopped and started the daemon. The epic wants one process per
repository for the board, the update check, and every run.

## Constraints and evidence

- Probe 1 of the spec (macOS 26.4.1): a process that calls `execve` keeps its PID and the process
  start that `ps -o lstart=` reads (`before pid=88445 start=Sat Nov  7 01:48:27 2026`, the same
  after). `LockOwner.adopt` returns `held` while the recorded daemon `{pid, start}` runs, so a
  daemon that execs into the new program sees each detached run as held by a live daemon and ends
  it. The Linux part is inference from POSIX `execve`.
- Probe 2 of the spec (Bun 1.4.4): one process serves `Bun.serve({ unix })` and a `node:http`
  server at the same time, so the board server runs in the daemon unchanged.
- The stop of ADR-0072 detaches each run and keeps its run record and its owner records, and the
  takeover of a later daemon adopts them. A restart that uses them adds no new path for the runs.
- The maintainer picked approach A (the successor) and the carry of auto mode over a restart
  (decisions 5 and 6). No maintained socket-handoff library exists for Bun.

## Decision

**The daemon hosts the board and the update check.** `serve` opens the board after it takes the
lock `daemon` and before the takeover. The board gets an in-process dispatcher in place of the
socket client, and the update controller runs in the daemon with its worker child process.
`celetis board` goes.

**An approved update restarts the daemon as a successor process.** After an `ok` apply, a daemon
whose program folder is the version folder of its revision drains the 202 answer, validates the
installed target (`installedProgram`), and claims the restart: it prints
`daemon: restarts on the program at <12>` and stops as `daemon stop` does. A claim after a stop
began changes nothing. After `serve` returned and released `daemon`, the old process spawns one
detached `engine/daemon.ts --daemon --after <pid> <start>` of the installed program, in the main
checkout, with its own environment, `HC_SCOPE` removed, `PORT` set to the actual board port, and
stdout and stderr appended to the daemon log; then it exits 0. The successor waits until
`{pid, start}` of the old daemon reads a definite `gone`, at most 60 seconds, and then starts as a
normal daemon and takes over the runs. A daemon of a checkout never restarts: its update view
becomes `updated`.

**A stop after the claim cancels the successor** (the decision of the maintainer of 2026-11-07). A
`POST /stop`, a signal, or a fatal stop that reaches the old daemon after the claim and before its
exit clears the recorded successor: the old daemon prints
`daemon: the stop cancels the restart; no successor starts` and exits with the code of that stop,
and no daemon runs. The stop request gets the accepted answer, so `celetis daemon stop` ends as a
normal stop. A stop that comes after the old daemon closed its socket or exited does not reach it,
and the successor still starts.

**Auto mode carries over a restart.** When auto mode is `on` at the claim, the successor gets
`--auto {"selection":…,"quiet":…}` of the loop and makes that `POST /auto` with `on: true` after
its identity file. A refusal goes to the log once, and auto mode stays off. The new loop takes its
first issue only after each auto run that the successor took over ends, so auto mode takes one
issue at a time across a restart (the decision of the maintainer of 2026-11-07). When one of those
runs ends with a nonzero code, the loop ends and auto mode is `off`, as after an issue run of the
loop itself (the second decision of the maintainer of 2026-11-07). An auto on after a normal start
does not wait.

**The successor argument list is a contract between two program versions.** The old program writes
it, and the installed program reads it. A list of another shape exits 2 before the wait, because a
successor that cannot read `--after` cannot wait safely. A `--auto` value that the new program
refuses gives the safe result of a refused auto on: the successor waits, serves with auto mode off,
and prints `daemon: this program refuses the carried auto mode <value>; auto mode stays off`. So a
later change of `POST /auto` never leaves a repository with no daemon after a restart.

Approach A reuses the stop and the takeover with no new state, gives the successor a new
`{pid, start}` that the adoption accepts, and keeps one daemon at a time: the successor takes no
lock while the old process can live.

## Alternatives considered

- **Exec in place** (the old board restart; the monitor of Syncthing). Rejected by probe 1: the
  new program keeps `{pid, start}`, and the takeover ends each run.
- **A parent supervisor process** (Syncthing, Ollama). It also restarts after a crash, but it adds
  a second long-lived process for each repository, needs a decision on the oracle "one daemon",
  changes `daemon stop`, and needs each identity check to tell the monitor and the daemon apart.
  The crash restart was not asked for, and a supervisor can be added later on top of approach A.
- **A socket handoff** (Cloudflare tableflip, Envoy hot restart). It removes only the gap of the
  port bind: the adoption needs the old daemon gone first, so the sessions get the same gap. No
  maintained library exists for Bun.
- **A board child process of the daemon.** It fails the epic oracle that no separate board process
  exists.

## Consequences

- One process per repository serves the board, the update check, and every run. The board has no
  `off`, `no answer`, or `restart` state of its daemon.
- A board-approved update restarts the daemon, keeps each live session in its tab, and gives its
  run to the successor. Between the stop and the takeover, no daemon steers the sessions and the
  page waits; the page reloads once when the new revision answers at the same URL.
- A successor that finds the old port in use serves another port, so the page cannot reconnect at
  its URL and shows its timeout; `celetis daemon status` prints the new URL. A failed spawn or a
  successor that times out leaves no daemon; the recovery line names `celetis daemon status` and
  `celetis daemon start`.
- After a restart with auto mode on, the status says `on` at once, and the next issue of auto mode
  starts only after the auto run that the successor took over ends with code 0. A nonzero end of
  that run turns auto mode off, as without a restart.
- A board request in flight longer than the 5-second drain of the stop loses its connection, as
  at a `daemon stop`.
- A stop in the short gap after the spawn, before the successor writes its identity file, finds no
  daemon (`daemon: no daemon runs for this repository`), and the successor still starts.
- A terminal `celetis update` does not restart the daemon. The board shows **Restart needed**, and
  **Restart** restarts the daemon in the same way; `celetis daemon stop`, then
  `celetis daemon start`, stays the terminal restart.

## Reconsider when

- Linux keeps no new `{pid, start}` for a new process, or a platform reuses a PID with the same
  start, so the wait or the adoption cannot tell the successor from the old daemon.
- A crash restart is requested: a parent supervisor then has a reason that it lacked here.
- Bun gets a maintained listen-socket handoff and the takeover can run while the old daemon lives.
- The gap of a restart becomes a problem for the sessions or the page.
- The epic oracle accepts a separate board process again.
- The successor argument list needs another shape: an older program then starts a successor that
  exits 2, so the new reader must accept the old shape first.
