# Each session runs in a tab that the runner steers

## Date

2026-11-02

## Related

- [Issue #232](https://github.com/ddinkov10/celetis/issues/232): its approved spec
  (`Spec: 2026-11-02`), the answers of the maintainer, and its plan.
- [Issue #230](https://github.com/ddinkov10/celetis/issues/230): the incident. A Codex `plan`
  session ended cleanly, and the `implement` session that the runner started next in the same
  terminal failed at once.
- [ADR-0058](0058-herdr-core-hosts-the-agent-terminals.md): herdr-core and the Herdr app host the
  agent terminals.
- [ADR-0059](0059-a-runner-manages-only-the-hc-terminal-that-it-leads.md): the runner manages only
  the hc terminal that it leads.
- [ADR-0046](0046-pending-startup-keeps-the-completion-watcher.md): the pending-startup watcher and
  the saved-turn verification stay.
- `startSession` and `waitingSession` of `engine/celetis-flow.ts`, `engine/lib/terminal.ts`, and
  `engine/lib/locks.ts`.
- `docs/celetis-flow.md` ("Requirements", "Start the script", "How a step runs", "Sessions",
  "Limits").

## Supersedes

- From ADR-0058, "herdr-core hosts the agent terminals":
  - The Decision "The host stays the child of the runner, in the terminal of the runner (approach
    1A)", all of it. The other Decisions stay: hc gives the status and the turn, the runner
    supplies the identity, `engine/lib/terminal.ts` owns each call, and the safe-id rule.
  - The rejection of "1B: a child terminal for each step" in "Alternatives considered".
  - The Consequence "The stale `done`".
  - From the Decision "The session rule uses the foreground and the link label", the runner
    clauses: the clause "or a runner with `--resume`", and the rule that a terminal whose
    step-end record of a live runner names another host has no card.
  - From the Decision "Quiet tabs come from `hc run --bg` with `herdr.space` and a rename (approach
    3)", the start of the Run, Queue, and Resume argv in a tab by the board. The tab form stays for
    each session tab and for the other presses of the board.
- ADR-0059, "A runner manages only the hc terminal that it leads", all of it. The runner no longer
  manages a terminal of its own, and it reads no `HC_TERMINAL_ID`.

## Context

In #230, the runner hosted each step session as its own child in the terminal of the runner, so
the sessions of one start shared one terminal. The `plan` session (Codex) ended cleanly, and the
`implement` session that came next in the same terminal failed at once with
`the session ended before a saved turn had a verified identity`. The output showed a stray
`^[[99;5u` (Ctrl+C in the kitty keyboard encoding) after the Codex exit keys. The maintainer asked
to make the transition from one step to the next "less error prone".

The answers of the maintainer in the design of #232:

- "every session every step in a brand new terminal tab", for both hosts and for each start.
- "B": the runner behind a board press has no tab; the person sees only the session tab.
- "A for now, 2 is gonna be the extension later": one runner for each start, as today. A master
  daemon for each repository comes later.
- "background as today": a board Run tab and a board Queue tab stay quiet. A typed start and a
  Resume show their tab in front.
- The build approach was the choice of the designer: "which one is better and cleaner".

## Constraints and evidence

The facts held on macOS on 2026-11-02 with herdr-core 0.1.16, the Herdr app 0.1.11, Claude Code
2.1.316, and Codex CLI 0.166.0.

- A program that `hc run` starts with an explicit command gets the environment of the hc server,
  not of the caller. `hc run` with no command starts a login shell on macOS (probe 4 of #182).
- A terminal has `pid`, `state` (`live` or `finished`), `exit_code`, and `foreground`, which is
  null after the terminal finishes. `foreground.pid` is the leader of the foreground process group
  (`hc schema`).
- `hc kill <t>` returns at once with the finished terminal, and `hc rm <t>` then removes it (probe
  terminal `t58`).
- `hc send <t> /exit` from another hc terminal, and with no `HC_TERMINAL_ID`, both put a plain
  `/exit` into a plain program (`cat`). The manual of hc shows tagged reports such as
  `<hc from="t7 review">…</hc>` for agents, and a send from inside the target terminal gets no tag
  (probe terminal `t58`; ADR-0058, probe 6).
- `herdr-app do tab.new` shows each tab at once. `hc run --bg` with `herdr.space=<id>` gives a quiet
  tab, and `herdr-app do pane.focus` brings a tab to the front (ADR-0058, probe 3).
- The Herdr app starts the argv of the first tab of a new space through a login shell,
  `"$@"; exec "$0" -li`, so that tab keeps a shell after its program.
- After its exit, Codex keeps `done` on a live terminal for more than 45 seconds.
- The lock check accepts a runner only when its command line holds `celetis-flow.ts` (`AGENTS.md`,
  "Traps"). A lock owner record names a runner and a session by PID and process start.
- The cause of the #230 failure is not confirmed. The stray key sequence points to the shared
  terminal.

## Decision

- **One runner steers a sibling tab for each session (approach 1 of the spec).** The runner stays
  one process for each start and never hosts a session. For each step session and each exact
  resume, it opens a new hc terminal with a tab in the space of the repository: `openTab` of
  `engine/lib/terminal.ts`, with `hc run --bg --no-parent --no-notify`, the labels
  `herdr.space=<id>` and `celetis.link=#<n> <step>`, and the tab name `#<n> <step>`. A file lock in
  the Git common folder serializes the lookup and the creation of the space across processes. The
  tab runs the start barrier, `celetis-flow.ts --session-start`, through a login shell of `$SHELL`
  that keeps a shell after the barrier exits. The step end, the identity, the no-progress and skip
  checks, the effort, and the queue keep their rules, and each `hc` call of the step end names the
  session terminal.
- **The start barrier reports through the private start folder.** Each file has one writer: the
  barrier writes `pid` (its PID and process start) and `status` (the exit status of the host), and
  the runner writes `go`. The runner accepts the `pid` record only when that process runs, has that
  start, and runs `celetis-flow.ts`. The barrier then is the session PID of the issue lock. The
  barrier starts the host as its child, waits for it, and writes the status before it exits. The
  exit of the barrier is the one sign that the session ended; a missing or invalid status is
  unknown and counts as a failure.
- **The environment of a session.** The session gets the login environment of its tab. The barrier
  sets `CELETIS_AGENT`, removes `CLAUDE_CODE_EFFORT_LEVEL` for Claude, sets the resolved
  `CODEX_HOME` for Codex, and applies `childEnv`. The runner reads no `HC_TERMINAL_ID` and changes
  no label, tab, or input of its own terminal.
- **One rule closes a tab.** The runner closes a session tab (`hc kill`, then `hc rm`) only after a
  normal end: status 0 and, for a step, a verified saved turn. Each other end leaves the tab open
  with the last screen of the host and a shell: a nonzero or unknown status, no verified identity,
  and a stopped runner. A tab whose barrier the runner never released closes.
- **The deferred close.** A tab of a normal end closes after the next session tab of the same start
  is open, or when the runner ends. So the space of the repository has a tab while the next session
  starts, also between two issue runs of one start (a queue or the automatic runner).
- **The lock rule.** A runner that stops (SIGINT, SIGTERM, or SIGHUP) stops its watcher, removes
  the step-end record, and exits. It does not end a session whose barrier it released, and it does
  not release a lock ref whose owner record names a live session, so the issue lock stays until
  that session exits.
- **`--quiet`.** The option opens each session tab in the background. The board passes it for Run
  and Queue. `--resume` ignores it, and each other session tab comes to the front.
- **The setup check.** Each start of the runner (a number, the automatic runner, `--queue run`, and
  `--resume`) checks `hc`, the hc server, `herdr-app`, and the window of the Herdr app before it
  reads an issue. A failed check stops with exit 1 and a line that names the setup action. No
  session runs in the terminal of the runner, and the managed and unmanaged modes become one mode.
- **The hidden board runner.** A Run, Queue, or Resume press of the board starts the runner in an
  hc terminal with no `herdr.space` label (`startHidden`), so it has no tab. The label
  `celetis.runner` names its issue, or `queue`, and `hc kill` stops it.

This is the practical choice: it is the pattern of the herdr-core orchestrator and of the agent
team tools, and the issue lock, the no-progress and skip state, the queue, and the automatic
runner stay in one process. A later master daemon can take the same steering role.

## Alternatives considered

- **Approach 2: a relay of one-step runners.** Each tab holds a short runner that hosts one session
  as its child and opens the tab of the next step before it exits. The locks, the barrier, and the
  signals do not change. But the issue lock must pass from one process to the next with no gap, the
  last-step state of the no-progress and skip checks must pass through a file, the automatic runner
  cannot relay, and a typed start needs a special case for its first session. Each step change adds
  a hand-off, the kind of transition that #232 wants to make less error prone. Rejected.
- **The master daemon now.** One long-lived process for each repository that drives every issue.
  The maintainer deferred it. Rejected for now.
- **A visible tab for a board-started runner.** The maintainer chose a headless runner ("B").
  Rejected.
- **`herdr-app do tab.new` for each session.** It shows each tab at once, so a quiet Run or Queue
  is not possible. `hc run` with `pane.focus` gives quiet and front tabs. Rejected.

## Consequences

- No session shares a terminal with the runner or with an earlier session, so the stale `done` of
  a former host and the stray input of #230 cannot reach the next session. If Codex fails at
  startup for another cause, the tab stays open with its screen as evidence.
- The host is no longer a child of the runner. The runner sees the session only through the
  barrier identity, the `status` file, and the hc terminal of the tab.
- **The environment of a typed start changes.** A variable that a person exports only in the shell
  of a typed runner does not reach the session. When `CLAUDE_CONFIG_DIR` or `CODEX_HOME` of the
  runner differs from that of the session, the runner looks for the saved turn in the wrong place,
  warns after 60 seconds, and the session does not end by itself.
- **The `<hc>` tag premise.** The exit input of Claude now comes from the runner in another
  terminal, with no `HC_TERMINAL_ID` in the environment of that call. The Verify phase of #232
  showed that Claude Code 2.1.316 gets a plain `/exit` this way: its prompt history recorded
  `/exit`, its transcript had no `<hc` text and no new user turn, and the host exited about 2
  seconds after the runner sent the input. A later hc release that tags this input breaks the exit.
- **The empty space.** The Herdr app 0.1.11 removes a space when its last tab closes (observed in
  the Verify phase of #232). The next session makes the space again with `herdr-app do space.new`,
  and the app shows it and gives it the focus, also for a `--quiet` start. The deferred close keeps
  a tab of the space open from one session to the next in one start.
- **Open tabs.** A long automatic runner opens one tab for each session. Each failed or orphaned
  tab stays until the person closes it.
- **The focus outside the Herdr app.** For a typed runner in another terminal program, whether
  `pane.focus` brings the window of the Herdr app to the front is not checked.
- **A hidden runner leaves no message.** A board-started runner that stops before any session shows
  its line nowhere, and its hidden terminal goes at its exit.
- **Shells and platforms.** The tab form needs a POSIX login shell of `$SHELL`; a fish or nu
  `$SHELL` is not checked. On Windows a tab has no shell, and the paths are unverified.
- **The space name.** The space of a repository has the name of the folder of its main checkout
  (`basename(main)`), as before. So two repositories with the same folder name share one space.
- **Preview APIs.** `hc` and `herdr-app` are 0.x, so a later release can break a call. The one
  module `engine/lib/terminal.ts` is the place to change.
- Each start needs `hc`, its server, and the open window of the Herdr app. There is no fallback to
  a session in the terminal of the runner.

## Reconsider when

- A master daemon for each repository comes.
- hc gives a quiet `tab.new`, or the Herdr app gives a `tab.new` that does not show the tab.
- hc changes the tags of a send from another terminal.
- Windows becomes a support target.
