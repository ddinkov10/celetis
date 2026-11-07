# The board presses are requests of the master daemon

## Date

2026-11-07

## Related

- [Issue #249](https://github.com/ddinkov10/celetis/issues/249): its approved spec
  (`Spec: 2026-11-07`) and the decisions of the maintainer.
- [Issue #195](https://github.com/ddinkov10/celetis/issues/195), decision F14: each board write of
  the queue record goes through one path, the daemon.
- [ADR-0073](0073-the-runner-commands-are-clients-of-the-master-daemon.md): the commands are
  clients of the daemon; a request that starts a run is never sent again.
- `engine/board/adapter.ts` (`run`, `resume`, `retryQuota`, `queue`, `reconcileQueue`, `daemon`),
  `engine/lib/daemon-client.ts` (`askDaemon`, `askQueue`), `engine/lib/daemon-server.ts`
  (`POST /queue/action`, `POST /queue/reconcile`).
- `docs/workflow.md` ("The board", "The master daemon", "The requests");
  `engine/board/README.md` ("The presses", "The trust boundary").

## Supersedes

ADR-0073, in part: the consequence "Until #249, a board press types the form in a hidden hc
terminal …", and the local internal form `--queue admit` of its decision.

## Context

After ADR-0073 the daemon owned every run, but the board still typed `run` and `queue wake` forms
into hidden hc terminals, read the screen of the terminal to find the result, and started the CLI
as a child process for Retry and for the queue admission. An accepted request exits 0 before a
session exists, so a card could show a false `failed` warning. The board also wrote the queue
record in three places, which F14 of #195 forbids.

## Constraints and evidence

- The board server and the fixed adapter stay the only trust boundaries of the board; the board
  sends only fixed request fields.
- A request that starts a run is never sent again (ADR-0073). Only the reconcile request is safe to
  repeat, because `updateQueue` checks the revision.
- Every wake needs the claim of the daemon, so the daemon can start the queue run in the request
  that admits the action.
- The page of a press waits at least as long as the daemon: the request limit is 120 seconds, Run
  and Resume have no page timeout, and Retry and a queue action wait 150 seconds.

## Decision

The board is a client of the daemon (approach A of the spec). The adapter sends Run, Resume, Retry,
and each queue action as one request over the daemon socket, and the board read sends the reconcile
request. Two new daemon requests carry the queue writes: `POST /queue/action` admits the action
and, for a wake, starts the queue run in the same request; `POST /queue/reconcile` reconciles on a
board read. No board code writes the queue record. The card feedback of a press comes from the
answer and from the run in `GET /status`, not from a terminal screen. A refusal shows the line of
the daemon, and an unknown outcome shows its line and is never sent again.

The hidden-terminal path (`startHidden`, `PRESS_LABEL`, `dispatchWake`, the board call of
`failQueueLaunch`, the event `queue-launch`) and the CLI forms `queue admit` and `queue wake` are
removed. `queue action` stays for the CLI.

## Alternatives considered

- **B. The board starts the CLI as a child process, with no terminal.** The board would parse
  printed text again and start a process for each press, and the queue writes would still need the
  new daemon requests. Rejected.
- **C. A, with a watch stream of the daemon state.** The board already reads on a fixed cycle, a
  stream adds a long-lived connection and a route, and #250 moves the board into the daemon.
  Rejected for now.

## Consequences

- One request path from the board to the daemon; one write path of the queue record.
- A board needs a running daemon of its own revision for each press; with no daemon, a press shows
  the refusal line. After `celetis update`, the maintainer restarts the daemon.
- Every queue action of the board needs a daemon, also a move and a remove.
- A stop of the daemon during a queue action (503) leaves the pending launch, which a deliberate
  Try again recovers.

## Reconsider when

- #250 hosts the board in the daemon, so the socket request is no longer needed.
- A watch stream of the daemon state is worth its connection.
