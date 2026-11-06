# The runner commands are clients of the master daemon

## Date

2026-11-06

## Related

- [Issue #248](https://github.com/ddinkov10/celetis/issues/248): its approved spec
  (`Spec: 2026-11-05`), the decisions of the maintainer, the calls of the session, and its plan.
- [Issue #240](https://github.com/ddinkov10/celetis/issues/240): the epic. #249 moves the board
  presses to direct requests, and #250 hosts the board, the update, and the landing.
- [ADR-0072](0072-one-master-daemon-runs-every-issue-run.md): one master daemon runs every issue
  run.
- `engine/celetis-flow.ts` (`main`), `engine/lib/daemon-client.ts` (`requireDaemon`, `askDaemon`),
  and `engine/daemon.ts` (`auto on|off`).
- `docs/celetis-flow.md` ("Start the script", "The answer"; "The continuous queue").

## Supersedes

One master daemon runs every issue run: its decision "The old runner stays beside the daemon"
until #248 and #249 move the callers.

## Context

ADR-0072 added one master daemon for each repository, but each form of `celetis celetis-flow`
still started a runner process of its own. So the daemon was not the sole owner of the work of the
repository. The board presses type the same forms into a hidden hc terminal, so a change of the
forms moves the board presses too. The maintainer wants the daemon as the one owner of every
issue run.

## Constraints and evidence

- The lock checks accept a runner only when its command line contains `celetis-flow.ts`, and the
  board identifies a press by the form that it types. So the command names stay.
- The status read of the daemon gives the program revision of the daemon. An older daemon does
  not know a newer request.
- A run, queue, or resume request of the daemon answers after the checks before the first session
  and after the first decision read (#248, Task 1). So the answer can carry the line and the exit
  code that the old runner printed for a refusal or an end there.
- A board press runs in a hidden hc terminal, with the environment of the hc server, not of the
  shell of the maintainer.
- The lab probe of #248, Task 3 (`/private/tmp/celetis-248-checks/cli.ts`): with no daemon, each
  runner form exited 3 and started no process, tab, or lock, and a refused Add left no queue
  record. With a daemon, each form exited 0 within 15 seconds with the run ID, the locks and the
  start barriers named the daemon PID, and each refusal had the line and the code of the base
  program.

## Decision

- **Each runner form sends one request and returns at once** (decision 1 of #248). `<n>`,
  `--resume`, `--retry`, a `--queue action` with a wake, and `--queue run` send one request to the
  daemon of the Git common folder of the current folder, wait at most 120 seconds, print the
  answer, and exit. An accept prints the run ID and the daemon PID and points at
  `celetis daemon status`; the command does not follow the run. The CLI parses, sends, and prints;
  the daemon decides.
- **With no daemon, a form refuses** (decision 2): it prints `celetis daemon start`, exits 3, and
  starts nothing. No command starts the daemon by itself.
- **The answer keeps the lines of today** (decision 5). A refusal or an end at the first decision
  prints the line of that cause and exits with its code, as the old runner did. A line with code 0
  goes to stdout, any other line to stderr.
- **The old runner path goes** (call 1). `main()` of `engine/celetis-flow.ts` keeps the parser,
  `--prepare-state`, `--session-start`, and `--daemon`. `celetis-flow` with no number prints the
  usage line; the automatic runner is `celetis daemon auto on|off`.
- **`--retry` is a request** (call 2). The daemon applies the rules of the Retry in its own process
  and writes the recovery record; the command prints the answer.
- **A queue action checks the daemon before its admission, only when it wakes** (calls 3 and 6).
  The CLI reads the queue first. An Add to an empty queue, a Continue, or a Retry needs a daemon,
  and with no daemon it refuses before it writes the queue record. A move, a remove, and an Add to
  a nonempty queue stay local. `--queue status` and `--queue admit` stay local file operations.
- **A daemon of another revision gets no request** (call 7). The command compares the revision of
  the daemon with its own, refuses with both revisions on a difference, and names
  `celetis daemon stop`, then `celetis daemon start`.

## Alternatives considered

- **A fallback to the old runner when no daemon runs.** It keeps two run paths and lets a CLI
  start own a run. The maintainer rejected it (decision 2).
- **An automatic start of the daemon, as Bazel and Gradle do.** The start of the daemon then
  happens inside some command, also inside a hidden terminal of a board press, and the daemon gets
  the environment of that caller. The start stays an explicit act of the maintainer.
- **A follow mode, as `docker attach` does.** The command would stay until the run ends, so
  Ctrl+C of the command would need a rule for the run. The maintainer picked the return at once
  (decision 1); the progress is in `celetis daemon status` and the log.
- **New command names, for example `celetis run <n>`.** The issue names the `celetis-flow` forms,
  the board types them, and the lock checks identify a runner by `celetis-flow.ts`.

## Consequences

- Only the daemon runs issue runs. The CLI owns no lock and no session.
- Until #249, a board press types the form in a hidden hc terminal, which now exits 0 at the
  accept, before the session appears. The card can show a short `failed` warning with the accepted
  line until the board sees the session.
- A run uses the environment of the daemon. Only the host selection (`--agent`, `CELETIS_AGENT`),
  `--effort`, and `--quiet` travel in the request; another variable of the shell of the command,
  for example `PATH`, `CLAUDE_CONFIG_DIR`, or `CODEX_HOME`, does not reach the run.
- A request with no answer, or with an answer that cannot be read, has an unknown outcome. The
  command exits 6 and does not send it again, because a second run request can start a second step.
- When the daemon stops between a queue admission and its wake, the queue keeps an unowned pending
  launch, which a deliberate Try again recovers.
- No command stops one run (decision 6 of #248). `celetis daemon stop` stops the daemon and
  detaches every run; Ctrl+C of a command stops no run.
- After `celetis update`, each runner form refuses until the maintainer restarts the daemon.
- No Windows: each runner form refuses there with exit 2.

## Reconsider when

- The board sends its presses to the daemon directly (#249), or the daemon hosts the board, the
  update, and the landing (#250), for example with an automatic restart after an update.
- A follow mode of a run is needed in the CLI.
- Windows becomes a support target.
