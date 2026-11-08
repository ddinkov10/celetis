# The master daemon runs each landing

## Date

2026-11-08

## Related

- [Issue #276](https://github.com/ddinkov10/celetis/issues/276): its approved spec
  (`Spec: 2026-11-07`), "Design probes" (probe 1), "Approaches", "One landing at a time", "The
  lock of a landing", and "A stop of the client or of the daemon".
- [Epic #240](https://github.com/ddinkov10/celetis/issues/240): one master daemon controls all the
  operations.
- [ADR-0072](0072-one-master-daemon-runs-every-issue-run.md): the daemon, the status, and the stop.
- [ADR-0073](0073-the-runner-commands-are-clients-of-the-master-daemon.md): a request carries
  only the host selection, and the client never sends a request again by itself.
- [ADR-0077](0077-the-master-daemon-hosts-the-board-and-restarts-as-a-successor.md): the stop path
  and the restart.
- `engine/lib/daemon-landing.ts` (`createLandings`), `engine/lib/landing.ts` (`runLanding`),
  `engine/land.ts` (the client), `engine/lib/daemon-server.ts` (`respond`, `status`),
  `engine/daemon.ts` (`status`), `engine/lib/daemon-types.ts` (`LandingRow`).
- `docs/workflow.md` ("The master daemon", "A landing"); `docs/procedures/landing.md`.

## Supersedes

Only these parts change. The accepted records keep their historical text and evidence.

- ADR-0072, "One master daemon runs every issue run", in part: the part of #250 that hosts the
  landing. The landing runs in the daemon process, with the lock ref `land-<n>`.
- The separate `land-<n>.lock` file of `docs/workflow.md`: a file with the PID of a `land` process,
  accepted by the resolver only when the command line of that PID held `land.ts`. Nothing reads or
  writes it now.

## Context

After ADR-0072, ADR-0073, and ADR-0076, one daemon ran every issue run, but `celetis land` was a
process of its own. It ran for minutes, and its lock was a file with its PID. Nothing serialized
two landings: both fast-forwarded the main checkout, and the second failed late, after its suite,
with `land: repair: the head of <trunk> changed; …`. The epic wants a landing under the daemon PID,
and one landing at a time for each repository.

## Constraints and evidence

- Probe 1 of the spec (Bun 1.4.4, macOS): a quiet stream closes after 10 seconds, also after
  `server.timeout(req, 0)`; an empty line each 5 seconds keeps it open; a client abort fires
  `request.signal` on the server.
- The `land` command keeps its form, its `land:` lines, and its exit classes: the skills and
  `docs/procedures/landing.md` read them, and the client output equals the output of `land` before
  the change, byte for byte.
- A script file keeps its name (`AGENTS.md`, "Traps"): `engine/land.ts` stays the entry of `land`,
  and `engine/daemon.ts` stays the daemon, so `lockHolder` accepts the daemon as the owner.
- A landing must not write process-global state of the daemon: it works in the main checkout, takes
  an abort signal, and sets no signal handler, folder, or exit code.

## Decision

The daemon runs each landing in the daemon process, as a module (`runLanding`), and `land` is a
client of `POST /land`.

- **A streamed answer.** The daemon answers at once with 200 and NDJSON: `out` and `err` records in
  write order, an empty heartbeat line each 5 seconds, and one last `code` record. The client
  prints the records and exits with the code. This is the pattern of the Bazel server and of the
  Docker `/build` stream.
- **One at a time.** The daemon keeps one line of landings in the order of their requests. A
  request behind another writes `land: #<n> waits for the landing of #<m> in the daemon PID <pid>`
  and then only the heartbeat. A waiting landing takes no lock and does no Git or GitHub act, so the
  second landing reads the trunk after the first moved it and fails at its start, not after its
  suite. `celetis daemon status` shows each landing of the line.
- **The lock ref `land-<n>`.** At its turn, a landing takes the lock ref with an owner whose record
  names the daemon PID, and it releases the ref in a `finally` at its end, also after an abort,
  while the daemon lives. The resolver reads the landing from this ref.
- **The abort.** A client that goes away aborts its landing, as in Bazel and Gradle. A stop of the
  daemon aborts the running landing and waits for its end before it closes the socket, as Buck2
  `kill` does; the client gets 143. The abort sends SIGTERM to the suite and SIGKILL 10 seconds
  later, so a suite that handles SIGTERM cannot hold the stop past the 60 seconds of
  `celetis daemon stop` and of the restart. A waiting landing ends at once with
  `land: blocked: the daemon stops; start it again, then run celetis --agent <host> land <n> again`
  and the status 6.

## Alternatives considered

- **B: a child process of the daemon.** The daemon starts `land.ts` and pipes its output. It is a
  separate land process with its own PID, so it fails the aim of the issue and the epic oracle.
  Rejected.
- **C: an answer at once, then a poll.** The session needs the output and the status, so the client
  would poll the status and read the log, with a second protocol. Rejected.
- **A refusal of the second landing** (Gradle, Bazel with `--noblock_for_lock`). It ends the second
  session with exit 6 and a stop for a cause that goes away in minutes. Rejected.
- **A preemption** (Buck2, opt-in). It can stop a landing between its push and its cleanup.
  Rejected.
- **A stop that waits until the landing ends** (Bazel `shutdown`). With the landing `pr` it can
  take about 30 minutes, past the 60 seconds of `celetis daemon stop`. Rejected.

## Consequences

- A landing runs under the daemon PID, one at a time, and the owner of its lock is the daemon.
- The landing needs a running daemon of the same revision. With none, `land` exits 6.
- The landing gets the environment of the daemon, not of the shell of the client.
- A client that stops reading its stream for about 10 seconds while output is unread makes the
  socket server time out its request, which aborts the landing as a lost client does. A new `land`
  completes it.
- A `land` process of the old program that runs during an update writes only its old file, which
  the new resolver does not read. The risk stays recorded.
- The landing runs on macOS and Linux only.

## Reconsider when

- The daemon stops being one process for each repository, or a landing needs a process of its own
  again.
- Bun keeps a quiet stream open without a heartbeat, or a landing needs more than one at a time
  (for example a speculative parallel gate for many landings each hour).
- A client needs a Cancel request apart from a broken stream.
