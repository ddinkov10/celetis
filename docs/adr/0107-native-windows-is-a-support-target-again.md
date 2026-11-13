# Native Windows is a support target again

## Date

2026-11-13

## Related

- [Issue #309](https://github.com/ddinkov10/celetis/issues/309): the spec (the body of the issue) and its comments. In this
  record, "probe 1" to "probe 6", "requirement 1" to "requirement 12", and "Approach A" name parts of that body.
- [Issue #4](https://github.com/ddinkov10/celetis/issues/4): the earlier Windows acceptance. It closed as not planned,
  superseded by #309 (https://github.com/ddinkov10/celetis/issues/4#issuecomment-6832051615).
- Two decisions of the maintainer on 2026-11-12, after the build found that each folder under `%TEMP%` inherits access for
  `BUILTIN\Users`:
  - https://github.com/ddinkov10/celetis/issues/309#issuecomment-6834927200: the socket folder gets a protected access
    list, and the private root keeps its inherited access list.
  - https://github.com/ddinkov10/celetis/issues/309#issuecomment-6835253300: the daemon holds the socket folder open, and
    each client checks the folder before it connects.
- [ADR-0034](0034-native-windows-uses-kernel32-and-spawned-children.md): the Windows primitives that this record extends
  (`engine/lib/windows.ts`, job objects).
- [ADR-0077](0077-the-master-daemon-hosts-the-board-and-restarts-as-a-successor.md) and
  [ADR-0080](0080-the-daemon-ends-a-claude-host-with-sigterm-after-a-grace.md): the successor restart and the exit grace,
  which now run on Windows.
- `engine/lib/windows.ts`, `engine/lib/daemon-start.ts`, `engine/lib/terminal.ts`, `engine/lib/quota-recovery.ts`,
  `engine/lib/process-identity.ts`, `engine/lib/usage-claude.ts`, `engine/daemon.ts`, and `scripts/herdr-lab.ts`.

## Supersedes

Only these clauses change. The accepted records keep their historical text and evidence. The other records that name
Windows state the evidence of their time and stay (see "Constraints and evidence").

- [herdr-core hosts the agent terminals](0058-herdr-core-hosts-the-agent-terminals.md), in part:
  - In "Context", the answer "the Windows paths stay, but the support target is macOS only".
  - In "Decision", the sentence "On Windows, the board passes the argv with no shell."
  - In "Consequences", the bullet "Unverified paths", whole.
- [A runner manages only the hc terminal that it leads](0059-a-runner-manages-only-the-hc-terminal-that-it-leads.md), in part:
  - In "Consequences", the bullet "On Windows a runner in an hc terminal stops …", whole, with "Windows is not a support
    target (ADR-0058)".
- [Each session runs in a tab that the runner steers](0062-each-session-runs-in-a-tab-that-the-runner-steers.md), in part:
  - In "Consequences", the sentence "On Windows a tab has no shell, and the paths are unverified."
- [Step agent preference is tracked policy](0069-step-agent-preference-is-tracked-policy.md), in part:
  - In "Consequences", the words "and each host on Windows" in "Codex and each host on Windows have no proved stop path".
- [One master daemon runs every issue run](0072-one-master-daemon-runs-every-issue-run.md), in part:
  - In "Constraints and evidence", the bullet "Windows is not a support target (ADR-0058, ADR-0062)."
  - In "Consequences", the bullet "No Windows: `--daemon` refuses there with exit 2."
- [The runner commands are clients of the master daemon](0073-the-runner-commands-are-clients-of-the-master-daemon.md), in part:
  - In "Consequences", the bullet "No Windows: each runner form refuses there with exit 2."
- [A library starts a celetis process through the program entry](0083-a-library-starts-a-celetis-process-through-the-program-entry.md), in part:
  - In "Consequences", the words "Only the state preparation runs there, because the daemon refuses Windows." The launcher
    that stays a parent of `daemon.ts` stays.
  - The next bullet of "Consequences" (the 30 s timeout of the `execFile` call of the preparation, "This is unverified")
    stays unchanged: it is evidence of its time, and this record does not verify it.
- [The check for a removed version folder reads the engine entry](0092-the-check-for-a-removed-version-folder-reads-the-engine-entry.md), in part:
  - In "Consequences", the sentence "No daemon runs on Windows."
- [A coordinator session steers the runs for the maintainer](0097-a-coordinator-session-steers-the-runs-for-the-maintainer.md), in part:
  - In "Consequences", the bullet "Native Windows has no daemon, so each form of `coordinator` exits 3 there, and no Windows
    check ran."
- [Native Windows uses kernel32 and spawned children](0034-native-windows-uses-kernel32-and-spawned-children.md), in part:
  - In "Decision", "Process identity": the sentence "An `OpenProcess` refusal reads as not running." The other clauses stay.
- [The daemon ends a Claude host with SIGTERM after a grace](0080-the-daemon-ends-a-claude-host-with-sigterm-after-a-grace.md), in part:
  - In "Decision", the words "and Windows" in "Codex and Windows keep the earlier behavior". Codex keeps it.

## Context

The maintainer runs Celetis on a native Windows 11 host. On that host, `celetis daemon start` printed
`daemon: Windows is not a support target` and exited 3. The same refusal blocked `run`, `queue`, `coordinator`, and `land`.
ADR-0058 and ADR-0062 made macOS the only support target, and ADR-0072 repeated it for the daemon. ADR-0062, ADR-0072,
ADR-0073, and ADR-0059 each listed "Windows becomes a support target" under "Reconsider when". The maintainer chose to make
Windows a support target again, in these words: "Everything that is supported on macOS it should be on windows too." So each
command form, each daemon behavior, and each maintenance script that macOS supports works on native Windows, with Claude
Code and with Codex.

## Constraints and evidence

The probes and facts below are in the body of #309.

- Bun 1.4.4 on Windows 11 serves and reaches an AF_UNIX socket. A `stat` of the socket file gives `EACCES` (probe 1).
- `hc run -- <argv>` on Windows passes each argument unchanged, and `--rm` removes the terminal after its exit. `hc get`
  gives the foreground argv of a program that starts with no shell (probes 2 and 3). So the claim of ADR-0058 that such a
  program has no foreground on Windows does not hold for hc 0.1.19.
- A named job that a process joins before it starts children holds each descendant: a grandchild, the child of a `.cmd`
  shim, and a detached child. A second handle, opened by name, reads the same member list (probe 5).
- Windows has no SIGTERM. `TerminateProcess` is a hard end, and the name of a job ends with its last handle.
- Each folder that the build made under `%TEMP%` on the build host inherited access for `BUILTIN\Users`.
- `OpenProcess` fails with access denied for a live process that the caller cannot open, also for a live owner of the
  daemon lock. The old read took that failure for an ended process.
- A Windows process cannot read the environment of another process, so the macOS environment sweep has no Windows form.
- Claude Code 2.1.322 runs a hook with `args` with no shell, and runs a hook with `command` only through Git Bash or
  PowerShell.
- The older records that name Windows state what was checked at their time: ADR-0035, ADR-0041, ADR-0066, ADR-0101, and
  others say "macOS only" or "Windows not checked" as evidence. This record changes none of those statements.

## Decision

Windows is a support target again, with macOS parity. The Windows paths and the macOS paths share one design, and macOS keeps
its behavior. This record adds no command, option, or configuration. The contract version does not change.

1. **The daemon.** The daemon keeps its AF_UNIX socket, at `%TEMP%\celetis\daemon\<hash>.sock`. One transport serves both
   platforms. The five refusals of Windows go.
2. **The start outside the terminal job.** On Windows, `daemon start` and the successor start the daemon with
   `CreateProcessW`, with a console that has no window (`CREATE_NO_WINDOW`; its console children share it, so none opens a window), a new process group, and the breakaway flag, so a daemon leaves the job of its terminal
   and runs after that terminal closes. When the job of the terminal does not allow breakaway (error 5), the start retries
   without the flag. After the start, `IsProcessInJob` of the new process for any job decides: when the process is in a
   job (a failed read counts as a job), `daemon start` prints `daemon: this terminal does not let the daemon leave its job;
   the daemon ends when this terminal closes` after its start line and exits 0. The read covers an outer job that the
   breakaway at the inner levels did not leave. The innermost job of a process that the entry starts always allows
   breakaway, so error 5 alone does not show the job.
3. **A job for each attempt (Approach A).** The start barrier of each session attempt creates the job
   `Local\celetis-attempt-<attempt ID>` (`Local\celetis-session-<folder name>` when the attempt ID is `-`) with no breakaway,
   and joins it before it starts the host. It holds the handle to its exit. A job name that exists already, or a failed
   create or join, gives status 6, and no host starts. The pattern is the process group of watchexec `process-wrap`
   (https://github.com/watchexec/process-wrap/blob/2f4bc393d8bd03b4b1c81fee2e13ce82dd42906e/src/windows.rs) on the
   documented job primitive.
4. **The job proof.** On Windows, the quota proof of `endOwnedAttempt` reads the member list of the job by name. The attempt
   is quiescent when the job holds no process other than the barrier. A job that cannot be opened or read, or a member that
   still runs at the deadline, gives `unverified` with a reason. Codex gives `unverified` on both platforms. The name of a
   job ends with its last handle, so after the barrier exits the job cannot be opened. For that path, the barrier reads
   the members of its job once at the exit of the host and writes the start file `job-empty` when the job holds no other
   process; the proof is `quiescent` when the barrier is gone and that file exists, else `unverified`. One blind spot
   gives `unverified` and is no proof: a process that a broker (the Task Scheduler, WMI, or COM) starts is outside the job.
5. **The forced end.** After the exit grace, the daemon ends only the host (the one child of the barrier, by its PID and
   creation time from one read) with `TerminateProcess` and the status of SIGTERM, 143. The barrier stays, sees the exit,
   and records it. `sessionExit` then maps 143 to `done` with the `terminated` mark, as on macOS.
6. **A failed read is not an end.** On Windows, an access-denied `OpenProcess` gives `unknown`, never `gone`. Only a process
   that does not exist, or one with another creation time, is `gone`. So a live owner of the daemon lock that the caller
   cannot open keeps its lock.
7. **The tab wrapper.** On Windows, the tab argv starts the Bun of the caller with `-e` and the wrapper `tabWrapper` of
   `engine/lib/terminal.ts`. The wrapper sets `BUN_RUNTIME_TRANSPILER_CACHE_PATH=0`, `DO_NOT_TRACK=1`, and the pairs of the
   tab (for the coordinator `CELETIS_COORDINATOR`), and starts the program with no shell. A program that exits 0 closes its
   tab (`hc run --rm`, as on macOS), except in a session tab of a run. A program that fails or cannot start leaves its output
   and the line `<program> exited <code>. Press Enter to close this tab.` until Enter. A session tab of a run holds that
   line after each exit, also after exit 0. The
   held tab reports the status `idle` of the app `celetis-hold`, which is no host, so it has no card, and a coordinator
   send into it is refused. The wrapper argv holds the pairs, so a process of the same user can read them while the tab is
   open. `readTerminal` removes them from the board read by the form of the wrapper, not its text, so a tab of an older
   engine keeps its card after an update. macOS keeps the login shell and `env`.
8. **The usage hook.** The Stop and StopFailure hooks of the Claude usage capture use the form with `command` and `args`,
   which runs with no shell. They run with and without Git Bash. The hook runs `git`, so `git` must be on the `PATH` of the
   Claude host.
9. **The socket folder.** On Windows, each start of the daemon holds the socket folder open with no `FILE_SHARE_DELETE` for
   the life of the daemon, sets a protected access list on it (the current user, SYSTEM, and the administrators, no inherited
   entry), and checks it. The daemon refuses to serve, with exit 3 or 6, when another user owns the folder or can reach it,
   also when the folder denies the current user access. `daemon start` makes the same check of a socket folder that exists
   before it spawns the daemon, so the refusal of requirement 10 is its own: exit 3 with the folder in the line. An early
   end of the daemon keeps the rule of macOS: `daemon start` exits 6 and names the log.
   Each client checks the owner and the access list of the folder before it connects. A race between that check and the
   connect stays when no daemon holds the folder: another user can plant a folder in that window. The private root
   `%TEMP%\celetis` keeps its inherited access list, so other users of the host can read or change the dispatch and lesson
   records there. The two decisions of the maintainer in "Related" set this.
10. **The lab.** `scripts/herdr-lab.ts up`, `run`, and `down` run on Windows. The root is `%TEMP%\<id>`, with the same
    protected access list as the socket folder, and the core state is in `%LOCALAPPDATA%\herdr-core\<id>`. The named job
    `Local\<id>` holds the lab processes, because Windows gives no read of the environment of another process. `up` joins
    the job before it starts the core and the window, and records the window process. A keeper process holds the job name
    until `down`. `down` ends the job, checks that it holds no process, and checks that the real core and window hold no lab
    text. The macOS `up` and `down` keep their behavior.

## Alternatives considered

- **A Toolhelp process table (approach B).** It keeps the macOS logic but cannot read the environment of another process, so
  the marker check goes. A process whose parent ended loses its parent link. The proof is weaker, with more code.
- **The engine in WSL or Git Bash (approach C).** It is not native Windows, so it does not meet the intent.
- **A named pipe for the daemon.** VS Code uses one. It adds a second transport with no gain, because probe 1 passed.
- **A protected access list on the whole root `%TEMP%\celetis`.** The maintainer chose the socket folder only, and kept the
  root as it is (the first decision in "Related").
- **A job with breakaway, or no job, for the host.** A host process that leaves the job is invisible to the proof. The job
  allows no breakaway.

## Consequences

- The design gives each command form and each daemon behavior of macOS a Windows form, for both hosts. The exceptions are
  the limits in this list and in decisions 4, 5, and 7: a hard end in place of SIGTERM and a held tab. The Verify evidence
  of #309 shows what runs. The `help` prose of `run`, `queue`, `coordinator`, and `daemon` loses its Windows refusals.
- A host on Windows is its native program on `PATH`. An npm `.cmd` or `.bat` shim is refused with exit 3 and a line that
  names the file, before any start: a `spawn` of a shim with no shell fails, and a shim that ran through `cmd.exe` would
  put `cmd.exe` in the place of the host, so the forced end of decision 5 would miss the host.
- On Windows, the quota proof reads the member list of the job, not the process table and the environment. A broker process
  can stay outside that list (decision 4), as the macOS proof has its own blind spots.
- The end after the grace is a hard end on Windows, because Windows has no SIGTERM.
- The limits of decisions 4 and 9 stay: the broker blind spot and the race of the socket folder check. The root `%TEMP%\celetis` is not private.
- The usage hook needs `git` on the `PATH` of the host. A host with no `git` on its `PATH` records no usage on Windows.
- The Verify evidence of #309 is the source of the acceptance status for Windows (`plugins/celetis/docs/workflow.md`,
  "Acceptance status"). Until that evidence exists, no Windows entry says PASS.
- The tab wrapper puts the variables of a tab in a readable argv. The coordinator token is readable by a process of the same
  user while the tab is open. The daemon has no other token, so this equals the rule of macOS: any process of the same user
  can send a request.
- One code string keeps macOS words and is outside this record: the retry line of `engine/lib/coordinator.ts` that names
  the login files of `$SHELL`.

## Reconsider when

- Windows gives a documented read of the command line or the environment of another process, so a proof does not need a job.
- Bun or Windows stops supporting AF_UNIX sockets on Windows, so the daemon needs a named pipe.
- Another user of the host must be kept from the dispatch and lesson records, so the root `%TEMP%\celetis` needs a protected
  access list.
- A host starts its work through a broker as a rule, so the blind spot of the job proof matters.
