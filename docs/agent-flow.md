# The agent-flow runner

`scripts/agent-flow.sh` runs the agent flow from a Terminal tab. It asks the resolver for the next
step of an issue and starts that step in a new interactive `claude` session in its tab. In a herdr
pane, the script ends the session when the step is done, and it then starts the next step when its
gate is `auto`. The GitHub issue stays the state store (`docs/agents/issue-tracker.md`): every
result of a step goes to the issue. The board is a local web page that shows each agent session and
the next step of each issue, and its Run button starts the script for one issue in a new herdr tab.
The board is a package of its own, `ddinkov10/agent-board`: this repository holds its config and
the script that prints its data. ADR-0008 holds the reasons for the script, ADR-0009 holds the
reasons for the board, ADR-0011 holds the reasons why herdr, not a mod, gives the session state and
ends a step, and ADR-0013 holds the reasons why `specify` is a step of the script. ADR-0014 holds
the reasons why the build step lands the change, and ADR-0015 holds the reasons why the board is a
package of its own. ADR-0017 holds the reasons why a step session hands a stop to the issue.

## Requirements

- macOS or Linux, with bash 3.2 or later. There is no native Windows runner.
- `claude`, `gh` (logged in), `jq`, and `git` 2.31 or later on `PATH`. When one is missing, the
  script names it and exits 1.
- `master` of the main checkout is current. The script, the resolver, the gates, and the step text
  come from the checkout that holds the script: after a merge that changes one of them, run
  `git pull` in the main checkout.
- herdr 0.9 or later, for the step end: the script ends a session only in a herdr pane. In another
  terminal the script runs too, but you leave each session with `/exit`.
- The plugin `superpowers@superpowers-marketplace`: the lane skills call its `superpowers:*` skills.
  `.claude/settings.json` enables it. On each machine, do this once. Add the marketplace:
  `claude plugin marketplace add obra/superpowers-marketplace`. Install the plugin:
  `claude plugin install superpowers@superpowers-marketplace`. Turn on auto-update for the
  marketplace: add `"autoUpdate": true` beside `source` in the entry `superpowers-marketplace` of
  `extraKnownMarketplaces` in `~/.claude/settings.json`. Do this step last, and again after a later
  run of the add command: in Claude Code 2.1.296 that command writes the entry again with `source`
  only. An interactive session then updates the copy on disk to the latest release, at most 10
  minutes after its first message. That session keeps the version that it loaded, and the next
  session loads the new one: a release reaches the lanes one session late (ADR-0016).
- The board has more requirements: "The board" names them.

## Start the script

```bash
scripts/agent-flow.sh            # the automatic runner; it does not end
scripts/agent-flow.sh 373 374    # a start with numbers; it takes the issues in this order and ends
scripts/agent-flow.sh --board    # the data of the issues for the board, as one JSON document
scripts/agent-flow.sh --resume 373    # the session of a step with no progress, again
```

An argument is `<n>`, or `'#<n>'` in quotes. A shell can read an unquoted word that starts with `#`
as the start of a comment: the script then gets neither that word nor the words after it, and with
no number it starts the automatic runner. Each line of the script starts with `agent-flow: `, apart
from its usage line and the output of `--board`.

**A start with numbers** does this for each issue. It asks `.claude/scripts/next-step.sh <n>` and
starts the step of the `run` line, whatever its gate. When the session ends, it asks again and
starts each next step whose gate is `auto`. It ends the issue at a line that is not a `run` line, at
a `me` gate, or at the same `run` line again ("no progress"). With the default gates, each next
step is a `me` step, so a start with a number runs one step of that issue.

**The automatic runner** asks `.claude/scripts/next-step.sh --open` and takes the lowest open issue
whose line is a `run` line, whose step has the gate `auto`, whose step has no row in the record, and
whose lock is free. It does the same work on that issue, but it starts no `me` step, and then it
asks again. When no issue can start, when the issue started no session, or when the resolver cannot
read GitHub, it waits 60 seconds. It prints one line for the whole wait. While it waits,
`.claude/scripts/next-step.sh --open` shows the line of each open issue: a `stop` line gives the
cause, and a `run` line that does not start has a `me` gate, a row in the record, or the lock of
another script. To stop it, close its tab, or press ctrl+c while it waits. It reads open issues
only. With the default gates no step is `auto`, so the automatic runner starts nothing.

**The form `--board`** is read-only: it takes no lock, writes no row in the record, and starts no
session. `--board` is its only argument. It prints contract 1, the JSON document that the board
reads: `contract`, `tracker`, `flow`, `noRun`, `runner`, and `issues`, with one row for each issue
that has a card. The rows come from `.claude/scripts/next-step.sh --json`, which makes 3 `gh`
calls. The resolver gives each row the state that it knows from GitHub and from the working trees:
`done`, `blocked` with `reason` and `act`, `ready`, or `dirty` with `path`. The `reason` is
`needs info`, `landing refused`, or `ready for your step` ("The board", rule 5). It also gives the
`noRun` text for a dirty main checkout. `--board` adds what the runner knows: `starting` for a lock
that a live script holds, `stuck` with its `act` for a row of the record, the `step`, `started`,
and `urgent` of each row, `runner`, `tracker`, and `flow` with the gate of each step. "The board"
gives the value of each field. When `gh` or `jq` fails, the form prints
`stop cannot read the issues from GitHub` and exits 1. The board is its reader: `data` of
`.claude/agent-flow/board.json` names this form.

**The form `--resume <n>`** opens the session of a step with no progress again. It reads the last
row of #<n> in the record and runs `claude --resume '#<n> <step>'` in the main checkout, with the
step of that row. With no row, it prints `agent-flow: #<n> has no step with no progress` and exits
1. It makes no `gh` call, takes no lock, and starts no job for the step end, so the session does
not end by itself: leave it with `/exit`. `resume` of `.claude/agent-flow/board.json` names this
form, so a Resume press on the board starts it.

The script asks for no confirmation. A start with the number of an issue whose next step is
`implement`, `chore`, or `hotfix` builds the change and lands it with `scripts/land.sh` when its
checks are green, with no more act of yours. With an `auto` gate on a step, the script continues
through that step by itself.

One lock for each issue and one lock for the automatic runner live in
`<git common dir>/agent-flow/`. A second script starts no session for an issue that another script
works on, and a second automatic runner exits 1. A lock holds the PID of its script, so a script
that was killed holds nothing. `scripts/land.sh` holds `land-<n>.lock` in that folder while it
lands #<n>. The file `no-progress` in that folder is the record: one row for each step that ended
with no progress. The automatic runner and the forms `--board` and `--resume` read it. A start with
the number of the issue does not read it, so it starts that step again.

## How a step runs

A session is one `claude` process in the foreground of the tab, in the main checkout. For
`run /plan #402`:

```bash
claude \
  --permission-mode auto \
  -n '#402 plan' \
  --append-system-prompt-file <checkout of the script>/.claude/agent-flow/step-prompt.md \
  '/plan #402'
```

The lane enters its own worktree with `scripts/worktree.sh` and `EnterWorktree`. The rules of
`.claude/settings.json` hold in auto mode. `.claude/agent-flow/step-prompt.md` is the step text: no
start of a step that a skill sends to a fresh context, when to ask, the limits on landing and
promotion, what a session does at a stop, and what it does with a Verify scenario that it cannot
run. A step session is a session that the runner starts with the step text. The exit status of
`claude` decides nothing: the resolver decides.

The session of `specify` is the one session with no step text, so it is no step session. For
`run /feature #402`:

```bash
claude --permission-mode auto -n '#402 specify' '/feature #402'
```

Rule 2 of the step text tells a session to publish with no wait for a review. `specify` publishes
the spec only after you approve the design, and nothing checks the design again after the publish.
So that session asks and waits as a session that you start by hand does (ADR-0013).

**The step end.** In a herdr pane (`HERDR_PANE_ID` is set), the script does two things before it
starts a session. It names its tab `#<n> <step>` with `herdr tab rename "$HERDR_TAB_ID"`, so the
board links the session to the issue. It also starts a job in the background that ends the session:

1. The job waits until herdr finds the agent in the pane (`herdr agent get`), for 60 seconds at
   most.
2. It waits until the agent is ready for the next prompt:
   `herdr agent wait <pane> --until idle --until done`.
3. It runs `next-step.sh <n>` of its own checkout. The step is done when the new line differs from
   the line that started the session and is a `run` line or starts with `stop #<n> `. The job then
   types `/exit` with `herdr agent prompt <pane> /exit`, and it ends.
4. Else it waits until the agent works or shows a dialog again
   (`herdr agent wait <pane> --until working --until blocked`), and it goes back to step 2.

In each other case the session stays open: the same `run` line, the dirty-tree line, the line of a
landing that runs, the cannot-read line, and a resolver that fails. So a session whose agent waits
for an answer, waits for a background task, or left an uncommitted file stays open, and a session
that you start by hand never ends by itself. herdr ends a wait when its agent exits, so the job
ends with the session, and the script stops the job when `claude` ends. When a session does not end
and its agent waits for nothing, leave it with `/exit`: the script then asks the resolver again,
and it prints the reason or starts the next step. Outside herdr the script starts no job and makes
no `herdr` call.

**A stop.** A step session hands a stop that is not a question to the issue (rule 4 of the step
text). The reason is a comment: the comment that its skill posts for the stop
(`## Landing refused`, `## Before landing`), else a comment with `## Stopped` as its first line.
When the skill adds no label for the stop, the session then adds `ready-for-human` as its last act,
so the line becomes `stop #<n> is ready-for-human. …` and the job ends the session. A stop for which
the skill adds a label, such as the `needs-info` stop of `/triage`, stays as the skill says. A
question is not a stop: where a skill says to ask, rule 2 holds, and a session that asks for a
decision waits in its pane. A Verify scenario that the session cannot run is a `## Before landing`
stop (rule 5): the session does not land the change. It posts the comment, and then one command
removes `ready-for-agent`, which marks the change as built, and adds `ready-for-human`. A session
that ends before that command leaves `ready-for-agent`, so the next run builds and verifies the
change again. A `specify` session and a session that you start by hand have no step text: at such
a stop they show the message and stay open (ADR-0017).

After a stop with `ready-for-human`, do the act of the stop, remove the label, and start the step
again. A `## Stopped` or `## Before landing` comment names the act. For a refused landing of
`/implement` or `/chore`, fix a cause outside the change (for example, run the failed job again, or
land the chore for the advisory): the next run of the step fixes a cause that the change made,
lands the change, and does not build it again. For a Verify scenario, the act is a run of the
scenario. After a PASS, the next run of `/implement` lands the built change. After a FAIL, keep the
label: put the result on the issue, run `/plan #<n>` in a session of your own, and remove the
label when the new plan is on the issue. A Run press on a built issue with no label lands the
change. For a hotfix whose landing stopped, the checklist of step 7 of
`.claude/skills/hotfix/SKILL.md` holds your acts: you land with `scripts/land.sh` in your own
shell, and the step does not run again.

A `specify` session starts with the line `run /feature #<n>`. The paths of `specify` give three
lines that end it: `run /plan #<n>` (the spec is on the issue),
`stop #<n> is an epic. Each child runs its own flow.` (the scope check made the issue an epic), and
`stop #<n> is closed as wontfix.` (`specify` rejected the design). While you answer its questions,
the line stays the same, and the session stays open. A session that ends while the line is still
`run /feature #<n>`, as after a spike, is "no progress". A lane change in step 1 of `/feature` moves
the line too, for example to `run /bug #<n>`: the session ends at its next idle moment, and a Run
press starts that lane.

**A landing.** `scripts/land.sh` moves the line of the issue when it merges, and it then closes the
epic and removes the worktree. While it runs, `next-step.sh <n>` prints
`stop the landing of #<n> runs; wait until scripts/land.sh ends`. That line does not start with
`stop #<n> `, so the job does not end the session. herdr 0.9.3 reads an agent that waits for a
background command as `done`, then `idle` (read on a live herdr on 2026-10-11). So while the script
runs, for up to 15 minutes, the board shows the session in Needs you as `turn ended`: do not leave
that session. If a session ended during a landing, wait until `next-step.sh <n>` prints another
line, and then run `scripts/land.sh <n> '<subject>'` again from the main checkout: it completes the
landing. After the merge the issue is finished, so Run and `scripts/agent-flow.sh <n>` start
nothing, and no card shows the lane worktree and the branch that stay.
`scripts/worktree.sh --remove <n>` also removes them after the merge of the PR; it does not close
the epic.

## Gates

Each step has a gate. An `auto` step starts by itself. A `me` step starts only as the first step of
a start with numbers. The step is the command of the `run` line: `triage`, `bug`, `chore`, `hotfix`,
`plan`, or `implement`. One command has another step name: `run /feature #<n>`, the line of an
`enhancement` with no spec, is the step `specify`.

The defaults are in `.claude/agent-flow/gates.json`: each of the seven steps is `me`, so one Run
press on the board, or one start with a number, starts one step. The script reads the git config
value `agent-flow.gate.<step>` first, then the file. A step with neither is `me`, and only the value
`auto` is `auto`. With `specify` as `auto`, the script starts a design session by itself, and that
session waits for you at its first question.

```bash
git config agent-flow.gate.implement auto     # make one step auto on this machine
git config --unset agent-flow.gate.implement  # go back to the default
```

## The board

The board is the package `ddinkov10/agent-board`, in a private repository of its own. This
repository holds no file of the board: it holds the config of the board and the script that prints
its data. ADR-0015 holds the reasons for the package and for contract 1, the JSON document that the
board reads. ADR-0009 holds the reasons for the board, ADR-0010 holds the reasons for Resume, Open
shell, and the notifications, and ADR-0011 holds the reasons why the session cards come from herdr.
ADR-0009 names four columns: the rules of the four stay, and Done is a list that opens from the
status bar.

**Requirements.** Node 22 from 22.18, or Node 24.2 or later, with `npx`. `git` 2.31 or later, and
git credentials for GitHub (an ssh key, or a credential helper for https): the package is private,
and npm cannot ask for a password. herdr 0.9 or later on `PATH` and a herdr server that runs. A
Chromium browser. The config names the script, so the requirements of the script hold too.

**Start the board** in the main checkout. It prints the repository, each command of the config,
and its URL: open the URL.

```bash
npx 'github:ddinkov10/agent-board#semver:^1'    # the last line: agent-board: http://127.0.0.1:4403
PORT=4500 npx 'github:ddinkov10/agent-board#semver:^1'
```

- Start the board in the main checkout only, never in a lane worktree. `npx` reads the `.npmrc` of
  the folder where it starts, and it puts each `node_modules/.bin` of that folder and of its parent
  folders first on `PATH`, before the board runs. The board refuses a start in a lane worktree only
  after that read, so the refusal is no guard: it prints
  `agent-board: start the board in the main checkout: <path>` and exits 1.
- `#semver:^1` names the newest release of major version 1. The quotes are necessary: `#` and `^`
  are glob characters in zsh with `EXTENDED_GLOB`.
- The port is `PORT`, else `port` of the config, else 4403. When the port is in use, the board
  prints the cause and exits 1.
- The entry `board` of `.claude/launch.json` starts the same command, so a session in a Code tab of
  the desktop app can show the page in the Browser pane. That entry has `--yes`, which answers the
  install question of `npx`.

**The config** is `.claude/agent-flow/board.json`. The board reads it from the main checkout only,
once, at its start. Each of its first three keys is an argument list whose first item is a file of
the main checkout, and `{n}` stands for the number of the issue:

| Key | Value | Use |
|---|---|---|
| `data` | `scripts/agent-flow.sh --board` | The board starts it, with no shell, for each read of the issues. |
| `run` | `scripts/agent-flow.sh {n}` | A Run press makes a herdr tab with the label `#<n> <step>` and types `'<main checkout>/scripts/agent-flow.sh' <n> && exit` in its pane. |
| `resume` | `scripts/agent-flow.sh --resume {n}` | A Resume press makes the same tab, with the focus, and types `'<main checkout>/scripts/agent-flow.sh' '--resume' <n> && exit`. |
| `port` | `4403` | The port, when `PORT` is not set. |

`&& exit` closes the tab when the script ends with no error, and a script that fails leaves the tab
open with its message. With the default gates, the script of a Run press starts one session and ends
when that session ends: the tab then closes, and the card shows the next step. A change of
`board.json` reaches the board only when the file is in the main checkout (a `git pull` after the
landing) and the board starts again. A change of the script needs no new start: the board starts
the script again for each read and each press.

**The data.** `scripts/agent-flow.sh --board` prints contract 1 ("Start the script"), with 3 `gh`
calls for each read. This repository puts these values in the fields of the document:

| Field | Value |
|---|---|
| `contract` | `1` |
| `tracker` | `GitHub` |
| `flow.lanes` | The four lanes: `feature` (triage, specify, plan, implement), `bug` (triage, bug, plan, implement), `chore` (triage, chore), and `hotfix` (triage, hotfix). |
| `flow.stages` | Triage, Define (specify, bug, chore, hotfix), Plan, and Implement. |
| `flow.steps.<step>.gate` | The gate of each of the seven steps, by the rule of "Gates". |
| `flow.steps.<step>.hint` | `It lands the change when the build is done.` for `implement`, `chore`, and `hotfix`. No other step has a hint. |
| `noRun` | `The main checkout is dirty: <path>. Commit or stash first.` while the main checkout is dirty, else `null`. |
| `runner` | `true` while a live automatic runner holds its lock. |
| `issues` | One row for each open issue and for each issue that closed in the last 14 days. An issue whose line of the resolver is the epic line or the `wontfix` line has no row. |

A row gets its `state` by the first rule that matches:

| # | The issue | `state` | Fields of that state |
|---|---|---|---|
| 1 | is closed | `done` | `closedAt` |
| 2 | has a lock that a live script holds | `starting` | |
| 3 | has a dirty lane worktree | `dirty` | `path`: the lane worktree |
| 4 | has a row in the record for its `run` line | `stuck` | `act`: `claude --resume "#<n> <step>"` |
| 5 | has `needs-info` or `ready-for-human` | `blocked` | `reason`: `needs info` for `needs-info`. For `ready-for-human`: `landing refused` while a landing refusal is current (`docs/agents/issue-tracker.md`, "Resolving an issue's state"), else `ready for your step`. `act`: the act that the `stop` line of the issue names |
| 6 | has a `run` line | `ready` | |

Each row also has `number`, `title`, `url`, `updatedAt`, `closedAt`, and these fields:

- `type`: `bug`, `feature` (the label `enhancement`), `chore`, or `hotfix`, from the first of those
  four labels that the issue has, in that order; else `null`.
- `step`: the step of the `run` line of the issue ("Gates"), else `null`.
- `started`: `true` when the step is `plan` or `implement`, because an earlier step of the lane ran.
- `urgent`: `true` for the type `hotfix`.
- `pr`: the open pull request whose branch name holds `/<n>-`, with its number, URL, draft state, CI
  result (`pass`, `fail`, `pending`, or `null`), and review state (`approved`, `changes`,
  `required`, or `null`); else `null`.

**Check the document** against the contract, in the main checkout:

```bash
scripts/agent-flow.sh --board | npx 'github:ddinkov10/agent-board#semver:^1' check --stdin
```

The checker prints `agent-board: contract 1, <count> issues, ok` and exits 0, or it prints one line
for each failure and exits 1.

**The page.** The README of `ddinkov10/agent-board` holds each part that is not of this
repository: the columns and the card of each state, the layout, the keys, the buttons Run, Resume,
Open shell, and Go, the errors, the tables of contract 1, the other forms of the command, the trust
boundary, and the limits of the page. Its URL is `https://github.com/ddinkov10/agent-board#readme`.
The repository is private, so the link opens only for an account that can read it.

## What the script prints, and your act

| The script prints | The maintainer's act | Then |
|---|---|---|
| `stop … needs info` or `stop … ready-for-human` | do what the line says; for `ready-for-human`, the latest `## Stopped` or `## Before landing` comment names the act, and "How a step runs", **A stop**, gives the act after a refused landing. The card of an issue with a current landing refusal reads `landing refused`: its `## Landing refused` comment names the cause | the next step starts with a Run press or with `scripts/agent-flow.sh <n>`; the automatic runner starts it only when its gate is `auto` |
| `stop … is an epic` | none: each child is an open issue with its own flow | — |
| `stop … is finished` or `stop … is closed as wontfix` | none | — |
| `stop the working tree is dirty …` | commit or stash | as the first row |
| `stop the landing of #<n> runs …` | none: a session lands the issue | start the script again when the landing ended |
| `stop cannot read … from GitHub` | check `gh auth status` and the network | the automatic runner tries again by itself; press Refresh on the board |
| a `me` gate | a Run press on the card, or `scripts/agent-flow.sh <n>` | — |
| `no progress: /feature #<n>` | the session ended with no spec on the issue: open the session again, or read the comment of a spike | a Run press, or `scripts/agent-flow.sh <n>` |
| `no progress:` with another command | open the session again, or read the issue | a Run press, or `scripts/agent-flow.sh <n>` |

A Run press runs the script in a new herdr tab. A script that ends with no error closes its tab, so
read the state on the card of the issue: "The board" gives the state of each issue, and the README
of the package gives the card of each state.

`stop … is finished` means finished, not promoted. A promotion covers a batch of issues:
`/promote-preview` lists the batch, and `scripts/promote.sh` puts it live when you are ready.

## Guards

`.claude/settings.json` holds the permission rules for every Claude Code session in the repository,
started by the script or not:

- `deny`: a command that names `scripts/promote.sh`, a push to `production`, and `gh pr merge`.
  Promotion is the maintainer's act, and an agent has one landing path, the script below. To merge
  by hand, use your own shell or GitHub.
- `allow`: `scripts/land.sh`. A build step runs it with no permission prompt. With `pr` it merges
  only the open lane PR of the issue on the trunk, and only when every check is green; a lane PR
  with another base is a refusal. It cannot select the
  release-please PR, which only `scripts/promote.sh` merges (ADR-0007, ADR-0014).

The rules match the text of a command. They stop a slip; they are not a security boundary. The push
rules name a `git push` with a `:production` or `:refs/heads/production` refspec. Do not rely on
them for another spelling, such as `git push origin production` or `git -C <dir> push …`: the
guard there is the rule that an agent never pushes to `production`. The rules do not see a command
of the script, so the script never merges, pushes, or promotes.

## Sessions

The name of a session is `#<n> <step>`. From the main checkout, `claude --resume '#402 plan'` opens
the session of that step again, and `scripts/agent-flow.sh --resume 402` opens the session of the
step of #402 that has a row in the record. No job ends a session that you open again, so it stays
open until you leave it. In a herdr tab with the label `#402 plan`, its card on the board links to
#402. When a live session on the machine already has the name, Claude Code gives the new session a
variant of it.

## Limits

- A session that waits holds its script. Each Run press and each start with a number has its own
  tab, so another issue can run beside it.
- The runner sees only its own locks. While a script works on an issue, start each step of that
  issue through the script or the board, not by hand in a session of your own.
- With the default gates the automatic runner starts nothing. The board has no control for it:
  start it in a terminal, after you make a gate `auto` on the machine. With `triage` as `auto`, it
  classifies each new issue, and a splitter question of `/triage` holds it until you answer. With
  `specify` as `auto`, it opens a design session for the lowest feature with no spec, and that
  session holds it until the spec is on the issue or you leave the session.
- With a gate that is `auto` on a machine, the script of a Run press goes on with that step in the
  same tab. Between two sessions the card is in Running with `starts`.
- A Terminal tab and the script in it can end when the app starts again. Start the script again: a
  dead PID frees each lock, and the record stays.
- A session outside herdr, for example in a Code tab of the desktop app, has no card on the board,
  and the script does not end its step.
- The script ends a step from the state that herdr gives the agent, and herdr reads the state of
  Claude Code from its screen. A new release of Claude Code can need new rules of herdr
  (`herdr server update-agent-manifests`).
- The script types `/exit` into the pane of a step that is done. Text that you type in that pane at
  that moment goes into the same line. This is more probable in a `specify` session, because you
  work in its pane.
- The `herdr` commands of the script come from the documents and the source of herdr 0.9.3. The
  step end of the script was checked against a live herdr on 2026-10-11 (ADR-0013). Two parts of it
  are not checked: the end of a session after its `scripts/land.sh` run ends (ADR-0014), and the end
  of a session after it adds `ready-for-human` at a stop (ADR-0017). The shape of
  `statusCheckRollup` from `gh pr list` is not checked against a live GitHub.
- The script exits 0 at each `stop` line, at a `me` gate, and at "no progress", so `&& exit` closes
  the tab with the message of the script. A Run press whose session ends at once thus leaves no
  message: start `scripts/agent-flow.sh <n>` in a terminal to see it.
- A start of the board from the entry `board` of `.claude/launch.json` needs `npx`, `herdr`, and the
  tools of the script on the `PATH` of the desktop app, and the git credentials for GitHub in its
  environment. This is not checked: the desktop app reads `.claude/launch.json` of the main
  checkout, so the build of a lane cannot start the entry `board` of its branch. When that entry
  does not start the board, start the board in a terminal.

The README of the package holds the limits of the page.

## Check the harness

The tests of the script, the resolver, the step text, `scripts/land.sh`, and `scripts/worktree.sh`
are hand-run; `scripts/verify.sh` runs none of them. The tests of the board are in
`ddinkov10/agent-board`.

```bash
bash scripts/agent-flow.test.sh
bash .claude/scripts/next-step.test.sh
bash scripts/land.test.sh
bash scripts/worktree.test.sh
bash .claude/agent-flow/step-prompt.test.sh
```

`bash scripts/agent-flow.test.sh` gives each `--board` document of its stub world to the checker of
the package (`check --stdin`), so the test fails when the script leaves contract 1. `AGENT_BOARD`
names the entry file of a local checkout of the package:
`AGENT_BOARD=<checkout of agent-board>/cli.mjs bash scripts/agent-flow.test.sh`. With no
`AGENT_BOARD`, the test runs the pinned `npx` command, and it needs the network and the git
credentials for GitHub. The test starts `npx` in its temporary folder, so `npx` reads no `.npmrc`
and no `node_modules/.bin` of the checkout where the test starts: the test can run in a lane
worktree. For the document of the real issues, "The board" gives the `check` command.

Three of the four tests of a script start their script with the bash that runs the test.
`scripts/worktree.test.sh` starts its script with the `bash` that is first on `PATH`, and so does
each script that starts another script. So for the proof on bash 3.2, the `/bin/bash` of macOS, run
a test as `PATH="/bin:$PATH" /bin/bash <test>`.

`bash .claude/agent-flow/step-prompt.test.sh` checks the step text. It runs its fixed cases in
headless `claude -p` turns, so it needs a `claude` that is logged in, it uses tokens, and the
answer of a model can differ between runs. Each turn reads the instruction files of the checkout
(`AGENTS.md`), so run the test after each change of `.claude/agent-flow/step-prompt.md` and after
each change of the section "Agent flow" of `AGENTS.md`. The script sets
`CLAUDE_CODE_DISABLE_GIT_INSTRUCTIONS=1`, because the git status snapshot of a turn holds the branch
name and the last commit subjects, and these can state the behavior that a case asserts. A turn
with the step text starts with `--permission-mode auto`, as a step session does. On 2026-10-12 a
headless turn with that flag held no text on auto mode in its context, so the test does not show
how auto mode acts on a session (ADR-0017).
