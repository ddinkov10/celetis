# herdr-core hosts the agent terminals

## Date

2026-11-02

## Related

- [Issue #182](https://github.com/ddinkov10/celetis/issues/182): its approved spec, its design
  probes, and its plan.
- [ADR-0003](0003-a-local-web-board-starts-each-step-in-herdr.md): the board, Run, Go, and the
  trust boundary of the server stand.
- [ADR-0005](0005-herdr-gives-the-session-state-and-ends-each-step.md): the step-end rule, its home
  in the runner, the removal of the mod, and the screen lines of the detail panel stand.
- [ADR-0046](0046-pending-startup-keeps-the-completion-watcher.md): the pending-startup watcher and
  the saved-turn verification stay.
- `engine/lib/terminal.ts`, `endWhenDone` and `runIssue` of `engine/celetis-flow.ts`, `codexClaim`
  of `engine/lib/session.ts`, and `sessionsOf` of `engine/board/place.ts`.
- `docs/celetis-flow.md` ("The step end", "Sessions") and `engine/board/README.md` ("The sessions",
  "The terminal calls").

## Supersedes

- From ADR-0005, "herdr gives the state of each session and ends each step, and the mod goes": herdr
  as the source of the state (`herdr api snapshot`, `herdr agent wait`, `herdr agent prompt`, and
  `herdr agent read`), the five herdr states with `unknown`, the tab label as the link of a session
  to its issue, the herdr pane variables, and the herdr pane ID in the trust rule.
- ADR-0039, "The runner announces the Claude session ID to herdr", all of it. The runner still gives
  each managed Claude step a new ID with `--session-id`, but it reports that ID to no terminal
  program. So the Claude ID announcement that ADR-0046 keeps goes too; its saved-turn verification
  stays.
- From the other ADR-0039, "The board starts each step from the copy of its host": the Decision
  sentence "Read-only herdr status calls can precede that failure". The read-only calls that can
  come before the 409 of a Run or Resume press are now `hc ls`, `hc get`, and `hc read`. The other
  clauses stay.
- From ADR-0003, "A local web board shows the sessions and starts each step in a herdr tab": the
  herdr launch parts. These are the tab in the herdr workspace of the repository (`herdr tab create`
  and `herdr pane run`), `herdr agent focus` for Go, and the rule "It starts `herdr` and the script
  with no shell". The server now starts `hc`, `herdr-app`, and `git` with no shell.
- From ADR-0004, "The board shows what each agent asks and does, and unblocks a stuck card": in
  Decision, "A stuck card has its own remedy", the herdr tab of Resume and of Open shell; the
  Consequence "The board can start two more kinds of herdr tab"; and the Reconsider line "herdr gets
  a tested command to read the screen of a pane". Resume and Open shell now open a focused tab of
  the Herdr app in the space of the repository. `hc read` reads the screen of a terminal for the
  detail panel.
- From ADR-0035, "The board is a part of the engine", and from the board part of ADR-0034, "Native
  Windows uses kernel32 and spawned children": the typed line of a press. That line had each item in
  single quotes for the pane shell and ended with ` && exit`, and on Windows it had the Windows
  PowerShell 5.1 form. The fixed adapter now gives an argv, and no shell reads it as a line.
- From ADR-0042, "One celetis program for both hosts": in Decision, "The board line", the typed line
  of a Run or Resume press and its Windows form, and the same line in the Supersedes entries of
  that record; and the Consequence "The board line on the Mac of the maintainer is about 80
  characters, against about 250 before". The adapter still reads the installed program at each
  press, and the program still supplies Bun and the isolation. The adapter now gives an argv, and
  no shell reads it as a line.

## Context

The maintainer moved from the herdr TUI (herdr 0.9.3) to the Herdr app, whose terminals live in
herdr-core (`hc`). Celetis needed herdr for the step end of the runner, for the session cards and
the launches of the board, and for the identity of exact Resume. In the Herdr app, a step session
got no step end, the board did not see it, and a Run press opened its tab in the herdr TUI.

The maintainer asked to make herdr-core the host of the agents, and gave the build choices to the
designer: "use whatever is more cleaner in the long term as the plugin will soon support another
terminal runner." The other answers of the maintainer: a Run opens a new tab in the Herdr app
window; Run and Queue tabs stay quiet; the first press that makes the space of the repository
shows it once; the Windows paths stay, but the support target is macOS only.

## Constraints and evidence

The design probes of #182 ran on macOS on 2026-11-01 with herdr-core 0.1.16 and the Herdr app
0.1.11. The build added the last three facts of this list.

- `hc get <t>` gives the status of a terminal: the OSC 7501 root record of its program (`app`,
  `state`, `kind`, `msg`), else null. It also gives `turn`, which goes up each time the status
  leaves `working`, `status_ms`, the labels, and the foreground process with its `argv` and `cwd`.
  `hc ls --json` gives no labels, no foreground, and no `status.app`.
- `hc wait <t>` returns at once when the program does not work, and `--timeout` bounds it. A
  program that never reported counts as working until it exits. A process can wait on its own
  terminal (probe 2). `hc send` pastes text, presses Enter, and refuses a `blocked` program.
  `hc keys` presses named keys. A send from inside the target terminal gets no tag (probe 6).
- OSC 7501 revision 0.4 keeps `done` and `error` after the program exits. After its exit, Codex
  0.166.0 left `done` on a live terminal for more than 45 seconds; Claude Code cleared its status
  (probe 7).
- Claude Code reports OSC 7501 since 2.1.295 (`app: claude-code`), and Codex 0.166.0 reports it
  (`app: codex`). Neither host needs an integration. `ctrl+c ctrl+c` exits Codex with code 0
  (probe 1).
- `herdr-app do tab.new` shows the new tab at once. A terminal that `hc run --bg` starts with the
  label `herdr.space=<id>` gets a tab in that space within about 3 seconds, and the focus does not
  move. `herdr-app do tab.rename` names that tab with no change of focus (probe 3).
  `herdr-app do space.new` shows the new space at once, and the app starts its first tab through a
  login shell, `"$@"; exec "$0" -li`, so that tab keeps a shell after its program.
- A program that `hc run` starts gets the environment of the hc server, not of the caller (probe
  4). In probe 7, a non-interactive `sh` had no job control, so the foreground was `sh`, not the
  host.
- Codex 0.166.0 has no flag that sets the thread ID before the start. Its app-server `thread/list`
  filters by `cwd`, and each thread has `createdAt` and `preview`, the whole first user message.
  The newest threads of the main checkout had the exact runner prompts as `preview` (probe 5).
- The API of herdr-core is a preview (protocol generation 1, version 0.x) that only grows: a break
  needs a new protocol generation. The commands of the Herdr app are also 0.x.
- The issue locks, `registerSession`, and `processRunsScript` need the host as a child process of
  the runner, and the runner script keeps its name (`AGENTS.md`, "Traps").
- A program that `hc run` starts directly, with no shell, has no `foreground` in `hc get`.
- `hc` prints its error JSON on stderr, and `herdr-app` prints it on stdout.
- A hung `herdr-app` call held the `openTab` lock of the board when the board injected its own
  executor with no time limit, and each later press waited behind it.

## Decision

- **hc gives the status and the turn, and the Herdr app gives the tabs.** The status is what the
  host reports with OSC 7501, never the screen or the window title. The screen is read only to show
  it: the lines of the detail panel and the startup error. No `herdr` CLI call, herdr fallback, or
  second host path stays.
- **The host stays the child of the runner, in the terminal of the runner (approach 1A).** The
  runner manages the step end when `HC_TERMINAL_ID` holds a safe ID and `hc` is on `PATH`. It waits
  on its own terminal with `hc wait` and a timeout, which is only a check-in. It reads the current
  turn with `hc get` and sends the exit input there: `hc send <t> /exit` for Claude, and
  `hc keys <t> ctrl+c ctrl+c` for Codex. A turn is current only when its status `app` names the
  host of the step and `status_ms` is at or after the start of the step. The exit of the host
  process, not a status, shows that the host ended. At each step start the runner sets the link
  label `celetis.link` to `#<n> <step>` and renames its tab; at the host exit it removes the label.
- **The runner supplies the identity (approach 2A).** Claude gets a new `--session-id` for each
  managed step. For Codex, the runner takes the one thread of `thread/list` whose `cwd` is the main
  checkout, whose `createdAt` is at or after the start, and whose `preview` is the exact prompt of
  the step. The issue lock lets only one runner start that prompt for that issue. No hook, hook
  trust prompt, or setup step is added.
- **Quiet tabs come from `hc run --bg` with `herdr.space` and a rename (approach 3).** The board
  starts `hc run --bg --no-parent --no-notify` with `herdr.space=<id>` and the link label, waits up
  to 5 seconds for the tab, and renames it. A focused press then runs `herdr-app do pane.focus`.
  When the space of the repository is missing, the press makes it with `herdr-app do space.new`.
  The fixed adapter gives an argv. On macOS and Linux, the board starts it with `hc run --rm` in a
  login shell of `$SHELL` with `"$@" || exec "$0" -li`: the tab closes after an exit 0 and keeps a
  shell after a failure. On Windows, the board passes the argv with no shell.
- **One module, `engine/lib/terminal.ts`, owns each call to `hc` and `herdr-app`.** Its words are
  host-neutral: a terminal, a status, a turn, labels, a screen, and a tab in a space. It limits each
  call to 15 seconds, also for an executor that the board injects; `hc wait` has its own
  `--timeout`. It reads an error from stderr and from stdout. An ID from an answer of `hc` or
  `herdr-app` goes into a command only when it matches `/^[\w:.][\w:.-]*$/`. There is no runner
  setting and no registry: a second terminal runner adds its calls behind the same functions.
- **The session rule uses the foreground and the link label.** A board session is a live terminal
  of the repository whose status `app` names a known host. Its foreground is that host, a runner
  (`celetis-flow.ts`) with the link label, or a runner with `--resume`. When the step-end record of
  a live runner names that terminal and another host, the terminal has no card: its status is a
  stale one of a former host. Only the link label links a session to an issue. A session with no
  link label takes its tab name as its title, else `A session`.

This is the practical choice. The locks, the start barrier, and the landing ownership stay as they
are, and a second terminal runner needs only a status, a turn counter, input, labels, and tabs for
its own terminal.

## Alternatives considered

- **1B: a child terminal for each step.** This is the pattern of herdr-core: the parent starts each
  child with `hc run --bg` and steers it with `hc wait`, `hc send`, and `hc read`. It gives two tabs
  for each issue, and the host is no longer a child process of the runner. The locks,
  `registerSession`, the start barrier, and the signal handling then need a new design, with no
  gain that the person sees. Each terminal runner must also start child terminals. Rejected.
- **2B: a Codex `SessionStart` hook** writes `session_id` to a file that the runner names. This is
  the pattern of the herdr Codex integration, and it is exact for each process. It adds a hook to
  each Codex session, a hook trust prompt, and a setup step, and it reverses "no Celetis lifecycle
  hook" of `docs/hosts/codex.md`. Rejected.
- **`herdr-app do tab.new` for each tab.** The app shows each such tab at once, so Run and Queue
  cannot stay quiet. Rejected.
- **A dual-host fallback** keeps the herdr TUI path beside hc. It doubles each call, each check, and
  each document, and the maintainer no longer uses the herdr TUI. The spec of #182 names a
  dual-host path as an anti-goal. Rejected.

## Consequences

- The runner, the board, and exact Resume work in the Herdr app on macOS. The `herdr integration`
  setup goes: both hosts report their status with no integration.
- **The stale `done`.** Codex leaves `done` on a live terminal after its exit. The runner reads only
  a status that changed at or after the step start, and it removes the link label at the host exit.
  The board shows no card for a shell, and it holds out a terminal whose step-end record names
  another host. So between two steps, that terminal has no card. When the next step has another
  host, the terminal has no card until that host reports. The issue keeps its own card.
- **The `preview` match.** The Codex identity needs the whole first user message in `preview`. When
  Codex changes that, no thread matches: the runner warns after 60 seconds, and the session does not
  end by itself. A person who starts the exact runner prompt in the main checkout at the same moment
  makes two matches. The watcher then ends with the startup error
  `no single session identity can be saved`.
- **The shell of the first press.** The press that makes the space of the repository shows that
  space, also for a quiet Run or Queue. The Herdr app starts that first tab through its own start
  form, so the tab keeps a shell after the step, also after an exit 0.
- **Old hosts with no status.** A host that reports no OSC 7501 status, for example Claude Code
  before 2.1.295, gets no step end and no card.
- **Unverified paths.** The verification and support target is macOS. On Windows, `hc`, the Herdr
  app, and an argv with no shell are not checked. A program that `hc run` starts with no shell has
  no foreground, so a Windows board start can get no card. The login-shell wrapper needs a POSIX
  `$SHELL`, for example zsh on macOS; a fish or nu `$SHELL` is not checked.
- **A preview API.** The documents pin herdr-core 0.1.16 and the Herdr app 0.1.11. A later 0.x
  release can break a call; the one module is the place to change.
- The `openTab` lock is in one board process, so two board processes for one repository can each
  make the space.
- A tab that a person renames by hand no longer links its session; only the link label does.
- A host that runs through another program, for example a `node` wrapper, does not show its own
  name as the foreground, so its terminal has no card. This is not checked.
- The old herdr server can keep running on the machine; Celetis no longer calls it.

## Reconsider when

- A second terminal runner comes.
- hc starts a new protocol generation.
- Codex gets a flag that sets the thread ID before the start.
- The Herdr app gets a `tab.new` that does not show the tab.
- OSC 7501 changes the lifetime of its `done` or `error` record.
