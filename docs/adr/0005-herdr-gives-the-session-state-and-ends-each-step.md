# herdr gives the state of each session and ends each step, and the mod goes

Source: ddinkov10/fwrh_calculator ADR-0011. Each issue number of this record is an issue of that repository.

## Date

2026-10-10

## Related

- ADR-0002 (`docs/adr/0002-loop-script-and-mod-run-the-agent-flow.md`): the script, the gate rule,
  the lock, the record, and the step-end rule stand; only the home of the step-end rule changes
- ADR-0003 (`docs/adr/0003-a-local-web-board-starts-each-step-in-herdr.md`): the board, Run, Go, the
  gates, the rules of one home each, and the rest of the trust boundary stand
- ADR-0004 (`docs/adr/0004-the-board-shows-what-each-agent-asks-and-unblocks-a-stuck-card.md`):
  Resume, Open shell, the reads of a hidden tab, the notifications, the pull request data, the
  hotfix-first order, the detail panel, the search, and Pipeline stand
- `scripts/agent-flow.sh`, `.claude/agent-flow/board/`, `docs/agents/agent-flow.md`

## Supersedes

- From ADR-0002, "A loop script in a Terminal tab runs the agent flow, and a mod ends each step
  session": the mod as the home of the step-end rule, `--plugin-dir`, and the variables
  `AGENT_FLOW_ISSUE` and `AGENT_FLOW_LINE`.
- From ADR-0003, "A local web board starts each step in herdr": "The state of a session comes from
  the reporter of the mod only", "The mod loads at user level", and the trust rule "only the
  `sessionId` of a status file as the id of a session".
- From ADR-0004, "The board shows what each agent asks and does, and unblocks a stuck card": the
  fields `waitFor`, `ask`, `activity`, and `cwd` of the status file, the `no signal` rule, the check of
  herdr each 60 seconds, and `AGENT_FLOW_ISSUE` in the command of Resume.

## Context

On 2026-10-10 the maintainer asked if the mod is necessary, and how to make the harness less
complex. The mod `.claude/agent-flow/mod` did two jobs: the step-end rule, which typed `/exit` when
the issue showed that the step was done, and the reporter, which kept one status file for each
session for the board. It had about 530 lines with its tests. It needed the line
`CLAUDE_CODE_PLUGIN_DIRS` in `~/.claude/settings.json` of the maintainer, `--plugin-dir` in the
script, and the mod API of Claude Code, which is early access. Its type check failed until Claude
Code wrote its type files. The board already needed herdr for Run and Go. The maintainer wants the
harness to move to other repositories with no change, and herdr knows more agents than Claude Code.
The maintainer said that herdr supports the work and approved the migration.

## Constraints and evidence

From the documents and the source of herdr 0.9.3 (`herdrdev/herdr` at `2563803`, 2026-10-08):

- herdr gives each agent one of five states: `idle`, `working`, `blocked` (herdr found an approval
  or a question dialog), `done` (idle, and nobody looked at the pane yet), and `unknown`. The state of
  Claude Code comes from the screen rules of herdr. The Claude Code integration reports only the id
  of the session.
- `herdr api snapshot` gives the tabs (`tab_id`, `label`) and the agents (`terminal_id`, `pane_id`,
  `tab_id`, `agent`, `agent_status`, `cwd`, `foreground_cwd`) in one JSON document.
- `herdr agent wait <target> --until <state>...` returns when the agent has one of the states, at
  once when it has one now, and ends with `agent_not_running` when the agent exits.
- `herdr agent prompt <target> <text>` types the text and Enter, and it refuses an agent that shows
  a dialog (`agent_blocked`).
- `herdr agent read <pane> --source visible` reads the screen and does not scroll it. A read of
  `recent` with more lines than the screen can scroll an idle full-screen agent.
- herdr gives no time of a change of state: `state_change_seq` is a counter.
- Each process in a herdr pane has `HERDR_PANE_ID` and `HERDR_TAB_ID`.
- No live herdr ran in the session that made this change. The tests use stubs of the `herdr`
  commands above.

## Decision

- **herdr gives the state of each session.** The server of the board runs `herdr api snapshot` at
  each request. A session is a herdr agent whose folder (the folder of its foreground process, else
  the folder of its pane) is the main checkout or a lane worktree. The label of its tab,
  `#<n> <step>`, links it to the issue. `working` goes to Running as `works`; `blocked` goes to Needs
  you as `waits for your answer`; `idle` and `done` go to Needs you as `turn ended`; `unknown` goes to
  Running as `state unknown`. The time of a state is the time when the server first saw it.
- **The pane shows what the agent asks.** At each request that is not local, the server reads the
  screen of each session with `herdr agent read <pane> --source visible`. The detail panel shows the
  last 16 lines with no empty line, rule, or box border. A card shows the state only.
- **The script ends each step through herdr.** In a herdr pane, the script names its tab
  `#<n> <step>` and starts a job in the background. At each `idle` or `done` of the agent, the job
  runs `next-step.sh <n>`. When the new line differs from the line that started the session and is a
  `run` line or starts with `stop #<n> `, the job types `/exit` with `herdr agent prompt`. This is the
  step-end rule of ADR-0002 in a new home. Outside herdr, no session ends by itself.
- **The mod goes**, with the status files, `--plugin-dir`, `AGENT_FLOW_ISSUE`, `AGENT_FLOW_LINE`,
  and the setting `CLAUDE_CODE_PLUGIN_DIRS`. Resume runs `claude --resume '#<n> <step>'` in a tab with
  the label `#<n> <step>`, and Run names the first tab of a new workspace with that label.
- **The trust boundary changes in two places.** The id of a session is the terminal id of a herdr
  agent of the repository. A pane id goes into a `herdr` command only when it has letters, digits,
  `_`, `:`, `.`, and `-`, and does not start with `-`.

## Alternatives considered

- **Keep the mod.** It works, and its data is exact: the tool and the command of a permission dialog,
  and the last 5 tool calls. But it needs a user setting and an early-access API, and it knows
  Claude Code only.
- **Classic hooks in `.claude/settings.json` write the status files.** They need no user setting.
  But a hook cannot end an interactive session, so the step end still needs herdr or a kill. They
  know Claude Code only, and the harness rule says that `.claude/settings.json` holds no hook.
- **`claude agents --json` gives the state.** It knows Claude Code only, and its documents say that
  an interactive session in another terminal can be missing from the list. Nobody tested it here.
- **The Agent SDK, or `claude -p` with JSON streams, and the server owns the sessions.** It is a
  large rewrite. The SDK documents point to an API key, not the subscription, and the SDK is about
  250 MiB. The answers move from the terminal into the board.
- **The board ends a step.** The board does not run all the time, and the script must end a step
  without it.
- **Pane tokens (`herdr pane report-metadata --token`) link a session to its issue.** The maintainer
  does not see them, and a restart of the herdr server loses them. A tab label shows in herdr and
  stays.
- **The server finds the question of a dialog in the screen and the card quotes it.** Each agent, and
  each release of an agent, draws its dialogs in a different way, and the input box and the footer at
  the bottom of an idle screen hide the answer. The panel shows the lines of the pane in its place.

## Consequences

- About 530 lines of mod and tests and one user setting go. The board and the step end work for each
  agent that herdr knows, so the harness can move to another repository with no plugin.
- The script needs herdr for the step end, and the board needs herdr for the session cards. In
  another terminal the maintainer leaves each session with `/exit`.
- A waiting card does not quote the ask, and the panel does not list the last tool calls. The panel
  shows the last lines of the pane.
- The state of Claude Code depends on the screen rules of herdr. A new dialog of Claude Code can show
  as `works` or `state unknown` until herdr updates its rules.
- The time of a state is near, not exact: the server sees a state only at a request, and a start of
  the server starts each time again.
- The server starts one `herdr agent read` for each session at each request while the page is in
  view, each 5 seconds.
- The maintainer removes `CLAUDE_CODE_PLUGIN_DIRS` from `~/.claude/settings.json`. An agent does not
  edit that file.

## Reconsider when

- `herdr api snapshot` stops giving the tab label, `agent_status`, or `foreground_cwd`, or herdr
  changes `agent wait`, `agent prompt`, or `agent read`.
- herdr gives the question of a dialog (the tool and the command), or the time of a change of state.
- The maintainer leaves herdr, or runs steps outside herdr often.
- Claude Code gives a supported way for a hook to end an interactive session, or `claude agents
  --json` lists the interactive sessions of other terminals.
- A step must end an agent whose exit command is not `/exit`.
