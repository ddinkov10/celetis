# The board shows what each agent asks and does, and unblocks a stuck card

## Date

2026-10-10

## Related

- ADR-0009 (`docs/adr/0009-a-local-web-board-starts-each-step-in-herdr.md`); its board, its rules
  of one home each, and its trust boundary stand, and this record adds to them
- ADR-0008 (`docs/adr/0008-loop-script-and-mod-run-the-agent-flow.md`); the script, the gate rule,
  the record, and the step-end rule stand
- `.claude/agent-flow/board/`, `.claude/agent-flow/mod/hooks/register.ts`,
  `scripts/agent-flow.sh`, `.claude/scripts/next-step.sh`, `docs/agents/agent-flow.md`

## Context

A design critique of the board (two independent reviews and a detector run, 2026-10-10) scored it
27/40 and found four problems that paint cannot fix. The tab title and icon stopped updating while
the tab was hidden, so the first glance of the maintainer showed an old count. A waiting card said
"waits for you" but not what the agent asked, so each answer cost a switch to the terminal. The
filled button of a card with no progress was Run, which starts again the step that made no
progress, and a card with a dirty tree had no button. A card at `finish` did not show why it made no
progress. The maintainer accepted eleven upgrades and said that the system design may change.

## Constraints and evidence

- The reporter of the mod already ran at each permission dialog, question dialog, end of a turn,
  and tool call (the mod API gives the tool name and input of each). It wrote only the state.
- `next-step.sh --json` already asked `gh pr list` for the open pull requests, to print
  `run /finish`. The same call can also return the checks and the review decision.
- herdr has a proven command to make a tab with a folder and to run a command in a pane (ADR-0009,
  R2). No command to read the screen of a pane was tested.
- A browser throttles the timers of a hidden tab to about one each minute after 5 minutes. That is
  enough for a tab title and a notification.
- `git diff` reads only when it has `--no-optional-locks`. Without it, git can refresh and write the
  index of a working tree.

## Decision

- **The status file says what a waiting agent asks and what each agent does.** The reporter adds
  `waitFor` (`permission`, `question`, or `turn`), `ask` (the tool and its target, the first
  question, or the last line of the answer, cut to 140 characters), `activity` (the last 5 tool
  calls), and `cwd`. It writes at the start of each tool call too. The file stays in the git common
  folder, which git does not track, and the reporter removes it at the end of the session.
- **`--board` carries the pull request, the gates, and the runner.** Each row has `pr` (the number,
  the URL, the draft state, the CI result, and the review state) from the same 3 `gh` calls. The
  document has `gates` and `runner`. The script keeps the rules for the gate, the lock, and the
  record; the server and the page only show them.
- **The server reads two more things, both read-only.** `herdr agent list` at most each 60 seconds,
  for the state of herdr in the status bar. `git --no-optional-locks diff --shortstat --merge-base
  origin/HEAD` at most each 15 seconds in the folder of a live session, only when that folder is the
  main checkout or a lane worktree.
- **A stuck card has its own remedy.** A card with no progress leads with Resume:
  `AGENT_FLOW_ISSUE=<n> claude --resume '#<n> <step>'` in a new herdr tab, the act line it already
  showed. Run again stays as a quiet button. A card with a dirty tree leads with Open shell: a herdr
  tab whose folder is the dirty lane worktree. The server builds both from its own data, and it
  refuses a path that is not under `.claude/worktrees/` of the main checkout.
- **The page keeps reading while its tab is hidden**, each 15 seconds, with `?local=1`: the server
  then reads the status files only and makes no `gh` call. A Notify switch shows a system
  notification for each card that enters Needs you while the board is not in front.
- **A hotfix with a next step is in Needs you**, first, and a permission request comes before the
  other waits. A session that has not written for 60 seconds shows `no signal`.
- **The page grows a detail panel, a search, a card menu, a status bar, and a second view.** The
  panel replaces Idle while it is open. Pipeline shows the issues by lane step; Now, the view that
  leads with Needs you, stays the default.

## Alternatives considered

- **A terminal preview of each session in the board.** Octomux and Claude Squad show one. It needs
  a herdr command to read a pane that nobody tested, and it would show the whole screen where one
  line (`ask`, the last tool call) answers the question.
- **Keep Run as the filled button of a card with no progress.** It starts the same step again with
  no fix, so it repeats the failure; the docs already named Resume (the act line) as the first act.
- **Stop all reads while the tab is hidden.** It saves a few local reads but breaks the tab title,
  the tab icon, and the notifications, which are the first thing the maintainer looks at.
- **Read the full transcript of a session from the server.** It puts a second reader on the private
  files of Claude Code; the reporter already has the event at the moment it happens.
- **Make Pipeline the main view.** ADR-0009 and the design direction lead with what needs the
  maintainer; equal columns by step make a waiting agent look like any other card.

## Consequences

- The maintainer can answer most waits, and see why a step is stuck, without a switch to the
  terminal.
- A status file holds short parts of the messages and the commands of an agent. It is local, it is
  in a folder that git does not track, and the one-day rule and the end of a session remove it.
- The reporter writes the file at each tool call, more often than before, and it adds two `$` calls
  before each tool call.
- The one `gh pr list` call returns more data (the check runs of each open pull request).
- The board can start two more kinds of herdr tab, so its trust boundary names two more commands.
- The server runs `git` in a lane worktree. It runs it only with `--no-optional-locks`, only in the
  main checkout or under `.claude/worktrees/`, and with no shell.
- A browser that blocks notifications shows `blocked` on the Notify switch, and the tab title still
  works.

## Reconsider when

- herdr gets a tested command to read the screen of a pane.
- The mod API stops giving the tool name and input at a permission dialog, or the answer at the end
  of a turn.
- `gh pr list` with `statusCheckRollup` is too slow or too large for the number of open pull
  requests.
- The maintainer wants the status files to hold no text of a session.
- A second person or a second machine uses the board.
