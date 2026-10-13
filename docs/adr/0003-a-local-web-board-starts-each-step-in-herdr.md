# A local web board shows the sessions and starts each step in a herdr tab

## Date

2026-10-09

## Related

- #403 (this change), #401 (the epic; its decisions 7 and 8 bind), #402 (the loop script and the
  mod)
- ADR-0007 (`docs/adr/0007-agents-merge-lane-prs.md`); its decision on the merge path stands
- ADR-0008 (`docs/adr/0008-loop-script-and-mod-run-the-agent-flow.md`); the script, the gate rule,
  and the step-end rule of the mod stand
- `.claude/agent-flow/board/`, `.claude/agent-flow/mod/hooks/register.ts`,
  `docs/agents/agent-flow.md`

## Supersedes

One sentence of ADR-0008 (`0008-loop-script-and-mod-run-the-agent-flow`): "herdr-board and herdr go,
with no second launch path". herdr-board still goes. herdr stays: the board starts each step in a
herdr tab. The other parts of ADR-0008 stand.

## Context

After #402, `scripts/agent-flow.sh` runs the agent flow from a Terminal tab. Nothing shows in one
place which sessions run, which sessions wait for the maintainer, and which issue waits for a start;
ADR-0008 names that as a consequence. Issue #403 is child B of the epic #401. On 2026-10-07 the
maintainer approved a design that put the board in a mod pane in a Code tab of the desktop app. On
2026-10-08 the maintainer reversed that place and chose a web page, "to be more pretty". ADR-0008
lists "The board of #403 starts each step" under `Reconsider when`: that premise is now true, and
this record is the result.

## Constraints and evidence

- The live proof on #403 (the comment headed `## Live proof`) ran on Claude Code 2.1.294 and
  2.1.295 and on herdr 0.9.3, on 2026-10-08 and 2026-10-09. The walkthrough of Verify part C, on
  2026-10-09, ran on herdr 0.9.3 and Claude Code 2.1.296.
- R1: a session that got the mod from `CLAUDE_CODE_PLUGIN_DIRS` and from `--plugin-dir` ran one
  copy, the copy of `--plugin-dir`, and the same copy ran after `EnterWorktree`. A session with
  `CLAUDE_CODE_PLUGIN_DIRS` only ran the copy that the variable named.
- R2: from a process with no `HERDR_*` variable, `herdr tab create` made a tab in a named workspace
  with a label and a directory, the focus did not move, and `herdr pane run` ran a command in the
  pane of the tab. A `herdr` command that fails exits 1 and prints one JSON line on stderr.
- R3: the tab closed when the command in its pane ended with `exit`.
- The Go command: herdr 0.9.3 has no CLI command for the API method `pane.focus` (the CLI command
  `pane focus` needs `--direction`). `herdr agent focus <pane>` focused a pane in another tab.
- R4: a permission dialog and a question dialog each gave the status `waiting`. `working` came back
  when the tool call ended; the mod API has no event for the close of a permission dialog.
- R5: the timer of the reporter ran while a session was idle (`seenAt` moved with no key press).
- R6: the reporter wrote its file in the main checkout after `EnterWorktree`. After `/exit` the
  file was gone, and `git status --porcelain` printed nothing in each working tree.
- The setting loads the mod. `~/.claude/settings.json` had `CLAUDE_CODE_PLUGIN_DIRS` in its `env`
  block, with `~` in the path. Three terminal sessions that started after that change loaded the
  mod and had a card: one session that the maintainer started in a herdr pane, and the two sessions
  of the Run presses below.
- Run and Go, with the server in a herdr pane (its process had the `HERDR_*` variables): a Run press
  made the tab `#<n> <step>` in the workspace of the repository, and the focus did not move. A Go
  press focused the pane of the session.
- One real issue, #37, went through `triage` and then `specify`, with one Run press for each step
  and one herdr tab for each step. The triage session ended by itself (the step-end rule), its tab
  closed, and the card showed `starts` for 7 seconds and then the next step with Run. The `specify`
  session showed `waits for you` at a question, `works` after the answer, and its tab closed after
  `/exit`.
- With herdr stopped, `herdr workspace list` exits 1 with the message ``no herdr server is running
  at <socket>; run `herdr` to start or attach it``. The toast shows that message, and the card keeps
  Run.
- After the walkthrough, `git status --porcelain` printed nothing in the main checkout and in the
  lane worktree, and the folder `agent-flow` in the git common directory held no `.lock` file and
  no status file.
- R7, a session in a Code tab of the desktop app: not checked. No Code-tab session started after
  the setting was in place. The setting itself loaded the mod in terminal sessions (above).
- R8, the entry `board` of `.claude/launch.json`: not checked, and it cannot be before the merge.
  The desktop app reads `.claude/launch.json` of the main checkout, so a session in a lane worktree
  finds no entry `board` until the change is on `master` in the main checkout. A server that
  started in a terminal showed the page in the Browser pane of a Code tab. While that pane is
  hidden, the page does not ask the server.
- The answer of `herdr workspace create` has no live proof: the plan forbids that command in a
  proof.
- Claude Code hooks: no hook event of the settings is a timer, and `Stop` does not fire when the
  user interrupts a turn (https://code.claude.com/docs/en/hooks).
- A mod loads from `CLAUDE_CODE_PLUGIN_DIRS` in the process environment or in the `env` block of
  `~/.claude/settings.json`, never from the settings of a project.

## Decision

The board is a local web page of this repository. `node .claude/agent-flow/board/server.mjs`, a Node
server with no dependency and no build step, serves one static page on `127.0.0.1`. The page shows
each live session and each issue in four columns: Needs you, Running, Idle, and Done. No card moves
by hand.

- **Run** starts the next step of an issue. The server calls the `herdr` CLI: it makes a new tab in
  the herdr workspace of the repository, with no focus, and runs `scripts/agent-flow.sh <n>` in the
  pane of that tab; a card with the step `specify` runs `claude -n '#<n> specify' '/feature #<n>'`
  there. Each press makes its own tab, and the tab closes when the command ends with no error.
- **Go** focuses the herdr pane of a live session with `herdr agent focus <pane id>`.
- **The state of a session comes from the reporter of the mod only.** Each session that loads the
  mod `.claude/agent-flow/mod` keeps one status file in `<git common dir>/agent-flow/sessions/`.
- **The mod loads at user level.** `CLAUDE_CODE_PLUGIN_DIRS` in the `env` block of
  `~/.claude/settings.json` names the mod of the main checkout, so each session on the machine loads
  that one copy. The script still gives the same mod with `--plugin-dir`.
- **Each gate is `me` in the tracked defaults** (`.claude/agent-flow/gates.json`), so one Run press
  starts one step. `auto` is a git config value on one machine. This changes decision 5 of #402 for
  the repository; the gate rule of ADR-0008 does not change.
- **The rules have one home each.** The script holds the rules for the gate, the lock, and the
  record, and gives them to the server as `scripts/agent-flow.sh --board`. The pure function `place`
  (`.claude/agent-flow/board/place.mjs`) holds the rules for the columns. The server and the mod
  hold none of the gate, lock, and record rules.

A Run press starts a session in auto mode, so the trust boundary of the server is part of the
decision:

- The server listens on `127.0.0.1` only.
- It refuses, with 403, a request whose `Host` is not `127.0.0.1:<port>` or `localhost:<port>`.
- It refuses, with 403, a POST whose `Origin` is not `http://` and that `Host`, or whose content
  type is not `application/json`. A page of another site then cannot start a step.
- It accepts only digits as the number of an issue, and only the `sessionId` of a status file as the
  id of a session.
- It builds each command line from its own data: the page sends a number or an id, never a command.
- It starts `herdr` and the script with no shell.
- The page has a Content-Security-Policy that allows its own files and the two hosts of Google
  Fonts only, and it writes each text of an issue or a session as text, never as HTML.
- The server writes nothing in a working tree.

## Alternatives considered

- **The board is a mod pane in a Code tab.** The maintainer approved that design on 2026-10-07 and
  reversed it on 2026-10-08, for the look.
- **The board is a GitHub Projects board, or an existing agent kanban product** such as Vibe Kanban
  or Agent Orchestrator. A GitHub Projects board shows issues only: no session, no Run, and no Go.
  Each product brings its own task store and its own runner, and the issue is the state store here.
- **The page is a React app with a build step, or a route of the product frontend.** The app adds a
  package, a lockfile, a build step, and dependency audits for a harness tool. The route puts the
  harness inside the product code.
- **The Terminal tool starts each step.** Decision 7 of #401 binds: a Run press starts each step in
  herdr, with no call of the Terminal tool. ADR-0008 holds the reasons against that tool: each call
  can ask for an approval, and each step leaves a tab.
- **`herdr agent list` gives the state of a session.** The `specify` session recommended it. The
  maintainer chose the reporter only, as in the reference design, over `herdr agent list` only and
  over the two together.
- **Classic hooks in `.claude/settings.json` are the reporter.** They load for the project with no
  machine setting. But they have no timer for the `seenAt` of a status file, and `Stop` does not
  fire when the maintainer interrupts a turn.
- **The mod loads at project level**, from `.claude/skills/agent-flow/`. It then loads with no
  machine setting, but a session in a lane worktree runs the copy of its own branch.

## Consequences

- One page shows the sessions and the next step of each issue, and one press starts a step.
- The board needs Node, herdr, and a herdr server that runs. The script itself still runs in each
  terminal with no herdr.
- A session that does not load the mod has no card. This holds for a machine without the setting.
  The setting loaded the mod in terminal sessions; no session in a Code tab started after it (R7).
- The setting names one path, so the repository must have the same path on each machine
  that shares `~/.claude/settings.json`.
- The page has no login. Each program on the machine can ask the server.
- A start of the server forgets the times of the Run presses.
- With each gate as `me`, the automatic runner starts nothing, and the board has no control for it.
- `place.mjs` reads five `stop` texts of the resolver (`STOPS`). A change of one of them in
  `.claude/scripts/next-step.sh` also changes `place.mjs`; a test of the board fails when the two
  differ.
- The reporter depends on the mod API, which is early access. The engine skips a hook that fails,
  and a status file can then be missing.

## Reconsider when

- A gate becomes `auto` in the tracked defaults. The board then needs a control for the automatic
  runner.
- The maintainer leaves herdr.
- Claude Code gets a supported list of the live sessions with their state.
- The mod API changes so that the reporter cannot write its file.
- The board must work on a second machine or for a second person.
