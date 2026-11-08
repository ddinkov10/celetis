# A library starts a Celetis process through the program entry

## Date

2026-11-08

## Related

- [Issue #266](https://github.com/ddinkov10/celetis/issues/266): its "Starting a daemon form",
  "Approaches", "Anti-goals", and "Risks" sections.
- [Issue #195](https://github.com/ddinkov10/celetis/issues/195): finding F9 of its review.
- [ADR-0070](0070-automatic-runtime-state-migration.md): the state preparation of an unowned caller
  runs in a finite internal process of the same revision, which owns the locks of the conversion.
- [ADR-0034](0034-native-windows-uses-kernel32-and-spawned-children.md): on Windows the launcher
  spawns its consumer and stays its parent.
- [ADR-0079](0079-one-contract-module-declares-the-commands-and-the-exit-classes.md): the contract
  module declares the internal `daemon` forms and their exit classes.
- `engine/lib/daemon-start.ts` (`DaemonForm`, `daemonArgv`), `engine/lib/state-preparation.ts`,
  `engine/lib/daemon-server.ts` (`startSuccessor`), `engine/lib/run-engine.ts` (`startSession`),
  `engine/launcher.ts`, `engine/lib/locks.ts`.

## Supersedes

- [Each session runs in a tab that the runner steers](0062-each-session-runs-in-a-tab-that-the-runner-steers.md):
  only the command of the tab, which named the command file of the start barrier. The barrier,
  its records, and the identity check stay.
- [The master daemon hosts the board and restarts as a successor](0077-the-master-daemon-hosts-the-board-and-restarts-as-a-successor.md):
  only the command of the successor spawn, which named `engine/daemon.ts` of the installed
  program. The restart claim, the takeover, and the environment of the successor stay.

## Context

Three library modules started the command file `engine/daemon.ts` by its path: the state
preparation of an unowned caller (`--prepare-state`), the successor of an approved restart
(`--daemon --after`), and the start barrier of a session tab (`--session-start`). Each start then
depended on the file layout of `engine/`, outside the contract of the program. Finding F9 of #195
proposed an in-process call for the state preparation instead.

## Constraints and evidence

- A lock owner is live only when the command line of its process holds `daemon.ts`
  (`engine/lib/locks.ts`). The `queue` command runs as `engine/queue.ts`, so a preparation in its
  process would record an owner that each other process reads as stale.
- `engine/lib/contract.ts` already declares the four internal forms:
  `daemon --prepare-state queue`, `daemon --prepare-state session <n>`, `daemon --daemon`, and
  `daemon --session-start <dir> <daemon-pid> <host> <attempt> <recovery> <host-args>`.
- On macOS and Linux the launcher replaces its process with `bun <root>/engine/daemon.ts …`
  (`execve`), so the PID stays and its command line then holds `daemon.ts`. The launcher records an
  event only when it exits itself, so a replaced start adds no `launcher` entry.
- The launcher exits 1, 2, 3, or 6 before the replace. The declared classes of each of the three
  forms hold these codes.
- `bun <root>/celetis daemon --prepare-state bad` and `bun <root>/engine/daemon.ts
  --prepare-state bad` both exit 2 with `state preparation: invalid internal request`; the
  median time was 46 ms against 23 ms over 7 runs (Bun 1.4.4, plan session of #266).
- The probes of #266 Task 4 on macOS: the spy entry of each start received exactly the declared
  form; a schema-1 queue and a schema-1 session converted to the same bytes and archives as the
  base program; a refused conversion gave the same exit, stderr, files, and event entries; the
  successor of an approved restart and a session tab ran `daemon.ts` under the PID that the entry
  started. The hc foreground of a session tab shows `daemon.ts` only when the login shell of the
  tab gives the command its own process group (job control); the probe shell needed `zsh -f -i`.

## Decision

A library module starts each Celetis process that has a form in `engine/lib/contract.ts`, the
three `daemon` starts, only through the program entry `<root>/celetis` and that form.
`daemonArgv(root, form)` of `engine/lib/daemon-start.ts` gives `process.execPath` with the Bun
flags, the entry, `daemon`, and the form; the type `DaemonForm` admits only the declared `daemon`
forms.

- The state preparation uses the root of the revision that runs the caller, so the preparation
  runs the same code that reads the state, also during an update. Its outcomes stay: no output and
  exit 0 resolve; each other result is `blocked` with the stderr text. At a nonzero exit or a
  signal of its child it drains the pipes for a short time and then closes them, so a descendant
  that inherits them (on Windows the `daemon.ts` child of the launcher) cannot hold the call.
- The successor of a restart starts through the entry of the installed program of the new
  revision.
- The session tab runs the entry form through the login shell of `$SHELL`, with the ADR-0024 Bun
  variables.

No library module joins `engine/` with a command file name for one of these three starts.
`daemonScript` stays for the identity checks.

The starts of Celetis code with no declared form stay as they are: the update worker of
`engine/board/updates.ts`, the `--inspect` and `--policy` child of `engine/lib/updater.ts`, the
Claude Stop hook that `engine/lib/usage-claude.ts` installs, and the `bun --eval` executor of the
Codex client. A new form for them is not part of this decision.

## Alternatives considered

- **Inject the preparer.** `readQueue` and `readSession` would take a preparation function from
  each caller. Each caller must then know and pass it, and the successor and the session tab still
  name `daemon.ts`, so the dependency on the file layout stays for two of the three starts.
- **Delete the schema migration.** This removes `--prepare-state`, but it takes back the automatic
  conversion that ADR-0070 decided, and the other two starts stay.
- **An in-process call** (the F9 proposal). The lock owner of the preparation would then be the
  caller process, whose command line does not hold `daemon.ts`, so other processes read the owner
  as stale and can take a lock that is in use.

## Consequences

- Each start goes through the launcher: about 23 ms more per start, and the Bun floor check and
  the command map of the launcher apply to it.
- Until the launcher replaces its process, the command line holds `celetis`, not `daemon.ts`. No
  identity is recorded in that window: `daemon.ts` creates the lock owner, and the start barrier
  records its own identity after the replace. A board read in that window shows no session for
  the tab.
- The board finds a session tab by the foreground process group of the tab. With a login shell
  that has job control, the barrier leads that group and its command holds `daemon.ts` after the
  replace. A shell with no job control keeps itself as the leader, and its words hold the entry
  form, so the board shows no session for that tab. Before this decision, the words of such a
  shell held `daemon.ts` by chance.
- On Windows the launcher stays a parent of `daemon.ts`, so each start has one more process. Only
  the state preparation runs there, because the daemon refuses Windows.
- On Windows the 30 s timeout of the `execFile` call of the preparation ends only the launcher.
  Its `daemon.ts` child keeps running and holds the locks of the conversion until it ends. The
  conversion replaces the record atomically, so no data is lost, but a hung `daemon.ts` must be
  ended by hand. This is unverified: the build of #266 had no Windows machine.
- A rename or a move of a command file no longer reaches these three starts; the launcher maps the
  command name to its file.

## Reconsider when

- The lock identity stops depending on the command line of the owner process (F11,
  [issue #268](https://github.com/ddinkov10/celetis/issues/268)): an in-process preparation then
  becomes possible.
- The launcher stops replacing its process on macOS or Linux, or the contract stops declaring the
  internal `daemon` forms.
- The board stops reading the foreground of a tab to find a session.
