# agent-board

The agent board is one local web page for one git repository. It shows each live agent session of
the repository and each issue of its flow, and it starts a step of an issue with one press. No card
moves by hand.

**Terms.**

- **Flow:** the rules of the work on an issue: its lanes and the steps of each lane. The document of
  each read gives the lanes, the steps, the stages, and the gates to the page ("The data").
- **Lane:** one type of issue, for example `feature` or `bug`, with the list of its steps in order.
- **Step:** one part of the work on an issue, which one agent session does, for example `plan`.
- **Stage:** one column of Pipeline, the view of the page that shows each issue at its step. A stage
  holds steps of the lanes.
- **Gate:** the rule of a step that says who starts it. `me` is your press of Run, and `auto` is the
  automatic runner. The board shows `auto` on such a step, and it starts no step by itself.
- **Runner:** `celetis-flow` of the plugin. It starts the sessions of the steps and knows how each
  one ended. The automatic runner starts each step with the gate `auto` by itself. The states
  `starting` and `stuck` and the field `runner` come from the locks and the record of the runner.
- **Trunk:** the default branch of the repository. The count of the changed lines of a session is
  against it (`origin/HEAD`). The board takes the main checkout as the checkout of the trunk: its
  files have the trust of the trunk, and the branch of an issue is in a lane worktree.

The board has two inputs:

- **The sessions** come from herdr (`herdrdev/herdr`), the terminal program in whose panes the
  agents run. A repository sets nothing for them.
- **The issues** come from one typed document that the board reads in its own process, with the
  resolver and the locks of the engine ("The data"). The page and the placement of the cards take
  the lanes, the steps, the stages, the reasons, and the tracker name from that document, and they
  hold none of their own.

The board is the folder `engine/board/` of the plugin `celetis`, a part of its engine, and
`celetis --agent <host> board` starts it. It is one Bun program with no dependency of its own. The
plugin carries generated browser JavaScript. A product repository needs no build or install step.
It runs from the installed `celetis` program, so the repository that it shows needs no file of the
board.

The board came from commit `95144d3` of its old repository
([ADR-0020](../../docs/adr/0020-the-board-is-a-part-of-the-plugin.md) of the plugin `celetis`).
[ADR-0035](../../docs/adr/0035-the-board-is-a-part-of-the-engine.md) of the plugin `celetis` gives
the reasons why it reads its data in its own process and types fixed command lines.

**Requirements.**

- macOS or Linux. On native Windows, the start and the data of the board before #102 are checked;
  the in-process read of #102, and Run, Resume, and Assist in a herdr tab, are not (`docs/celetis-flow.md`
  of the plugin `celetis`, "Acceptance status").
- Bun 1.4.4 or later. The entry prints `celetis: need Bun >=1.4.4 on PATH, found <version>` and
  exits 2 on an older Bun.
- git 2.31 or later.
- The installed `celetis` program for Run, Resume, Assist, and queue actions (the README of the plugin, "First install").
- herdr 0.9 or later on `PATH` and a herdr server that runs, for the session cards and for each
  button.
- `gh` on `PATH`, logged in, for the issue data.
- The lane worktree of the issue `<n>` at `<main>/.claude/worktrees/<n>-<slug>`, where `<main>` is
  the main checkout. This layout has no setting: an agent in a worktree at another place has no
  card.
- A Chromium browser. The page is checked in Chromium browsers only.

A Run and a Resume start the runner, so the requirements of the runner apply to them
(`docs/celetis-flow.md` of the plugin `celetis`, "Requirements").

## Start

Run `celetis --agent <host> board` in the main checkout of the repository, or in a subfolder of
it, and open the URL that it prints. The command takes no arguments. The README of the plugin, "The
agent board", gives this start.

The start validates the main `.celetis.yaml`, refuses a lane start, and checks the plugin update
policy of the selected host once. `--agent` selects the host of the board process only: its policy
check and, for Codex, its `CODEX_HOME`. The start records its own program revision and starts an independent update check after it listens. At each Run,
Resume, or Assist, the fixed adapter (`adapter.ts`) reads the installed `celetis` program and types its
command ("The line of a pane").

**The port** is `PORT` of the environment, else `board.port` of the main `.celetis.yaml`, else 4403.
A `PORT` that is no number, or that is `0`, counts as absent. The server listens on `127.0.0.1`
only. Each repository has the default port 4403, so a second board on one machine exits 1 at its
start. Give it another port in `board.port`, or with `PORT`, which overrides it:

```bash
PORT=4404 celetis --agent <host> board
```

**The start prints** the main checkout and the URL:

```text
agent-board: repository /Users/me/code/shop
agent-board: http://127.0.0.1:4403
```

**A start that fails** prints its cause on stderr and nothing on stdout. The entry makes these
checks in this order:

| Case | Line | Exit |
|---|---|---|
| Bun is older than 1.4.4 | `celetis: need Bun >=1.4.4 on PATH, found <version>` | 2 |
| An argument follows `board` | `usage: celetis --agent <host> board`, then `celetis: when a skill or a document gave this command, run celetis update` | 2 |
| The current folder is in no git checkout | `celetis: need a Git checkout` | 2 |
| The current folder is in a bare repository | the line of git, `fatal: this operation must be run in a work tree` | 128 |
| The main `.celetis.yaml` cannot be read or has an error | the diagnostic of the config reader, with the file and the field | 2 |
| The current checkout is not the main checkout: a lane worktree, or another linked worktree | `celetis-board: start the board in the main checkout: <main>` | 1 |
| The update policy of the selected host has a conflict, or an update still holds the installation after 2 minutes | the line of the check, for example `update: <path>: Celetis automatic updates are enabled or unknown; …` | 1 |
| The port is in use | `agent-board: cannot listen on 127.0.0.1:<port>: the port is in use` | 1 |
| The server cannot listen for another cause, for example `PORT=99999` | `agent-board: cannot listen on 127.0.0.1:<port>: <the message of Bun>` | 1 |

The engine finds the main checkout (`docs/configuration.md` of the plugin `celetis`, "Operation
values and freshness"). A start in a subfolder of the main checkout, or through a symbolic link to
it, finds the main checkout.

**Start the board in the main checkout only.** A `node_modules/.bin` folder of the start folder or
of its parent folders can be on `PATH`. In the main checkout, those are files of the trunk. A lane
worktree holds the files of a branch, which do not have the trust of the trunk. The entry refuses a
start in a checkout that is not the main checkout, and it removes each `node_modules/.bin` item
from `PATH` before it starts `git`, `gh`, or `herdr`.

**Open work during updates.** The status bar keeps one update control after the agent selector.
**Check for updates** starts discovery in one press. **Checking…** retains focus and ignores
another press. **Up to date** reports that the installed program and registered plugins match
the configured target; it does not mean that an open board or agent session has reloaded new
code. Press **Up to date** for a fresh check. Progress and results use the polite status region,
without a success toast or current-result dialog. A check does not refresh issues or approve
installation. Only the separate **Update and restart** decision approves an offer.

The board checks at startup and every 10 minutes. Concurrent
checks share one worker, with a 120-second limit. These checks do not wait for issue or herdr
reads. A direct board decision approves one exact offer for one attempt. The browser sends only
the offer ID; the controller keeps its complete identity. A stale offer, conflict, or failure needs
a new check and decision. The native update locks and validation also apply to this path.

The nonmodal update dialog sits at the bottom right and keeps the board usable. It shows each
installed revision and the common target. **Later** or Escape inside the dialog defers that exact
offer in this tab; **Update available** opens it again. A different offer opens a new dialog.
**Hide progress** hides the dialog without cancelling the update. **Update in progress** opens
it again. These choices survive a page reload in tab storage when the browser permits storage.
A background check failure shows a quiet **Update check failed** control. Open it for the error
and **Check again**. A failed update shows the completed and incomplete components and requires
**Check again** before another attempt. **Update needs attention** opens that recovery dialog
or the reconnect-timeout instructions. A refused check request or unreadable status also shows
**Update check failed** with explicit **Check again** recovery. An old current snapshot cannot
erase that request error, and the page never retries a check POST automatically.

The page reads update status every 5 seconds, or every second during update and reconnect,
including hidden tabs. These reads do no remote discovery. It retains the target and original
runtime instance before sending an approval. A lost response or a pending start restored after
reload starts status reconciliation and never sends another start. Only an `updating` response
with that target and original instance allows native progress without a reconnect deadline.
Other pending states, a restart, or the first disconnect after a start stop other polling and
allow 60 seconds to reconnect. Queue actions wait for a fresh board read; the tab keeps its draft
until reload. The page reloads once only after the target revision
and a different runtime instance answer at the same URL. Existing view, notification, and
shortcut choices remain in local storage. A timeout keeps the old page with the server-supplied
main-checkout, host, and actual PORT recovery instruction. **Check again** clears the pending
start and requests a fresh check and decision. The update may have completed; the page makes no
installation retry.

After a successful board-approved update, this board drains its finished worker and start response,
stops its reads, closes its listener and connections, and starts the approved installed program
at the same URL. It preserves the main checkout, startup host, native profile, environment, and
actual port. Other boards, runners, sessions, and daemons stay open. Activation validates the
installed target before and after teardown. A failed validation before teardown leaves this board
running with an error. A failure after teardown prints the cause and the recovery command,
`PORT=<actual> celetis --agent <host> board`, to run from the main checkout. It makes no retry.

Follow [Updates](../../README.md#updates) for a terminal-started update and its affirmative
terminal response. A terminal-started update keeps the board open and needs a manual board restart
for new board code. Discovery releases its short read lock before foreground execution. Only
updaters serialize on the update mutex; sessions, runners, boards, and daemons may stay open.

The server reads page files on later requests. It runs the server code and the code of the issue
read that it loaded at its start. Native replacement can remove resources that open work still
needs, so a person may reload or restart affected work. Each Run, Resume, and Assist reads the installed
program again. After `celetis update`, the next press types the command of the new program with no
board restart. After a terminal-started update, start the board again for its new code. A fresh
session loads changed skills; an open session does not reload them automatically. A change of `board.port` also
needs a board restart. A change of `host` or `gates` in the main `.celetis.yaml` shows at the next
read ("The data").

**Three values have no setting:**

- A lane worktree is `<main>/.claude/worktrees/<n>-<slug>`.
- The herdr workspace label is the folder name of the main checkout.
- The changed lines of a session come from
  `git --no-optional-locks -C <folder> diff --shortstat --merge-base origin/HEAD`.

## The data

The board reads its issue data in its own process (`data.ts`). Each read creates a fresh operation
of the main checkout, with `CELETIS_AGENT` and no explicit host. So each read validates the main
`.celetis.yaml` again, and it takes `gates` from it, and `host` when `CELETIS_AGENT` is not set.
The read then gets the typed rows of the resolver (`nextBoard` of
`engine/next-step.ts`), and the issue locks, the runner lock, and the record of the runner
(`engine/lib/locks.ts`, which the runner also uses). It builds one typed document (`Document` of
`types.ts`) with `tracker`, `agents`, `defaultAgent`, `flow`, `noRun`, `runner`, `issues`, `history`, and
`queue`.
`docs/celetis-flow.md` of the plugin `celetis`, "The board", gives the value of each field and the
rule that gives each row its state.

Each module of the data path is a static import. So a read loads no file of the plugin, takes no
plugin read lock, and checks no update policy. The start checks the selected host's policy.
Independent update checks validate the native update policy. Each Run and Resume starts a new
runner process, which makes its own check. Assist checks the policy before it starts the native host.

One read runs at a time: a cause of a read during a read joins that read. A read has a limit of 60
seconds. The stop of the board also stops a read that runs. In each case, the `gh` process of that
read ends. When a read fails, the cards and history of the last good read stay, and the status bar shows
`cannot read:` with one line:

| Cause | Line |
|---|---|
| The main `.celetis.yaml` has an error | The first line of the diagnostic of the config reader |
| The resolver cannot read GitHub | The first line of the stderr of the resolver, else `cannot read the issues from GitHub` |
| The read does not end in 60 seconds | `the issue read did not end in 60 seconds` |
| Another failure | The first line of its message, else `the issue read failed` |

The next good read clears the line.

`Document.queue` and the response's `Board.queue` use `QueueView` of
`engine/lib/queue-types.ts`. `queue: null` means that no initial read succeeded. A successful read
with `queue.record: null` means that no schedule was submitted. A submitted view holds the strict
local record, the live owner PID, the resolver's fresh `next`, an error, and the allowed Continue,
Try again, and Reset actions. `readBoard` calls `readQueueView` with the same fresh main operation
as the issue read. A freshly unreadable issue permits no queue action, including Reset.

Every placement, including `/api/board?local=1`, reads the local record and both the queue lock
and the current issue's `issue-<n>` lock. A changed ID or revision clears the old `next` and action
permissions and requests the existing coalesced workflow refresh. Ownership changes also request
that refresh. No second poller is added. A local queue read error disables queue actions while
the last good issue cards remain visible. An issue-read error or `noRun` also disables queue
actions.

## Landed history

History sits between Search and Refresh. It opens the existing nonmodal panel and closes card
details. Card details close History. The default is closed on each page load; refresh keeps its
open state, scroll, and matching focused link. Escape or Close returns focus to History. The
landed count and the `d` shortcut open the same panel. Search finds landed issue numbers and titles.
History stays visible on a phone. Below 1100 px width or 701 px height the panel is a drawer;
below 720 px width it fills the viewport. Closing it restores the board width.

`history.ts` reads the remote repository metadata and captures the default branch head. It walks
100-commit pages pinned to that SHA until it finds 20 distinct issues or exhausts history. It
keeps traversal order and each issue's newest occurrence, with no closure-time cutoff. A direct
Celetis Conventional Commit has an issue suffix. For a PR landing, the commit must match a merged
lane PR's merge SHA, base branch, and repository identities. The lane issue number must agree
with its `Closes #<n>` body reference. A nonempty PR association never falls back to the subject's
suffix. Ambiguous or unsupported associations are omitted; request and malformed-data failures
fail the entire read. Issue responses that represent PRs cannot become history entries.

`History` contains `trunk`, its history `url`, the captured full `head`, and `entries`. Each
`LandedIssue` contains `number`, issue `title` and `url`, full commit `sha`, `commitUrl`, and
`committedAt`. The snapshot's history is null until the first successful document. It shares the
existing refresh, abort signal, timeout, and last-good-document failure behavior with active work.
No extra poller or workflow state exists. Display links allow only absolute HTTP(S) URLs without
credentials or control characters. Titles and branch names remain text.

Rows expose issue and commit links, a short SHA with its full accessible identity, and commit
time with its full accessible timestamp. The time is neither issue-close nor push time. Before
the first result, History shows loading; an initial failure shows an error. Successful empty
history shows `No landed issues found on <trunk>.` A failed refresh retains the rows and shows
the read error; recovery clears it. History has no Run or Resume action.

The list covers recent landings through both `merge` and `pr`. A closure alone proves no landing;
an open issue can appear in both active work and history. Absence from 20 entries proves nothing
about older landings. A later revert does not remove the earlier event. `View <trunk>` opens
older history for inspection.

## The cards

The page has three columns, Needs you, Running, and Idle, a strip of human sessions above them, and
a landed-history panel.

**The sessions.** A session is an agent that herdr found in a pane, whose folder is the main
checkout folder itself, or a lane worktree or a folder in it. That folder is the folder of its
foreground process, else the folder of its pane. An agent of another folder has no card, and this
includes a subfolder of the main checkout. The label of its herdr tab links a session to an issue:
`#<n> <step>` gives the issue `<n>` and the step, `#<n>` alone gives the issue only, and another
label gives no issue. The step word counts only when `flow.lanes` of the document names that step.
Run and Resume give each tab that label. Assist uses `#<n> assist`, which links the issue but gives
no workflow step. A tab that you name by hand links its session too. The time of a session state
is the time when the server first saw that state.

A session makes one card, from the state that herdr gives its agent. The main button of a session
card is Go. A session with no issue is a human session: a tab that you started yourself. It has no
card in a column: the strip Human sessions shows it with the same state ("The layout"). The table
gives the column of a session of an issue.

| herdr state | Column | State on the card |
|---|---|---|
| `working` | Running | `works` |
| `blocked`: herdr found an approval or a question dialog | Needs you | `waits for your answer` |
| `idle` or `done`: a live runner checks or closes this turn | Running | `checks step` |
| `idle` or `done`: the agent is ready for the next prompt | Needs you | `turn ended` |
| `unknown`, or a state that the board does not know | Running | `state unknown` |

Each board request, including a local request, reads the runner's private step-end record from
the common Git directory. Its PID, process start, pane, and host must identify a live runner.
A retained verdict applies only to the recorded terminal, session UUID, and `state_change_seq`.
A later turn starts with no retained verdict, even when the board misses its working state.
Missing, invalid, unreadable, or stale evidence keeps the ordinary wait. A dialog always wins.
Resume and unmanaged sessions have no completion watcher. The runner keeps an exiting verdict
until the foreground exits, then removes it. This local read adds no GitHub request.
A board-approved update starts the new program automatically. After a terminal-started update,
start a new board process to load updated server code.

The state of a session wins over the state of its issue, and an issue with a session has no card of
its own. Two sessions of one issue make two cards. A session card shows the title, the type, the
link, and the pull request of the row of its issue. A human session, and a session whose issue has
no row, show the label of the tab as the title, with no link and no type.

**The issues.** Each row with no session makes one card, from its `state`:

| `state` | Column | State on the card | Act line | Main button |
|---|---|---|---|---|
| `starting` | Running | `Starting` | none | none |
| `dirty` | Needs you | `dirty tree` | `path` | Open shell |
| `stuck` | Needs you | `no progress` | `act` | Resume, and a quiet Run again |
| `blocked` | Needs you | `reason` | `act` | Open agent |
| `ready` | Needs you when `started` or `urgent`, else Idle | none: the card shows `next <step>` | none | Run |

- A `ready` card shows `auto` when the `gate` of its step is `auto`. The title of Run is
  `Start the <step> step`, plus the `hint` of that step.
- Open agent uses the current default agent, with no agent choice. It is the main action in Now,
  Pipeline, details, the card menu, and search. Open issue remains secondary, and `o` opens the issue.
  An unavailable default agent disables Open agent with its cause.
- With a `noRun` text, the page shows that text above the columns and permits no Run, Resume, or Assist.
  A card that would have Run or Open agent shows it disabled with that text.
- The lane track of a card is the list of `flow.lanes` for its `type`. A card whose step is not in
  that list has no track.

**The order.** Needs you has the urgent cards first, then the dialogs, then the longest wait first.
Running has the newest first, and Idle has the highest number first. History follows remote trunk traversal order.
Human sessions has the order of the tab labels, with numbers in numeric order, and two sessions with
one label in the order of their herdr agent ids.

**During a press** of Run, Resume, or Assist, the page moves the card to Running at once. The card shows
`Starting` with a turning status icon while the board reads the program and opens the tab. It keeps its
step, so Pipeline shows it at that step. Assist keeps a null step and remains in Not in a step.
While the request runs, no control of the page sends a second press for that issue. Run, Resume,
and Assist share one reservation in the server, from before the asynchronous eligibility read
until the tab opens or the operation fails. A competing press from any browser client gets 409.
After the operation succeeds, the card stays `Starting` for 30 seconds, or until a row with the state `starting` or a
session of the issue shows. A session wins at each time: its card shows its state and Go. The page
uses no read that started before the request ended, and an older read never replaces a newer one.

When the 30 seconds end, the next request that is not local reads the issues again. With no session
and no `starting` row, the card goes back to its row with the text
`Session not detected. Check the terminal before starting again.` The board does not
stop a process or start a step again. The text stays until a session or a `starting` row shows,
the step of the row changes, the row leaves the states `ready`, `stuck`, and `blocked`, or a new press starts.
A blocked row matches Assist feedback only with a null step.
A press that fails ends the `Starting` card at once, and the next read gives the card its buttons.

## The commands of the board

| Press or read | What the server does |
|---|---|
| The data of the issues | The read of "The data", in its own process, with a limit of 60 seconds. |
| Run | A new herdr tab in the main checkout with the label `#<n> <step>` and no focus. In its pane: the Run line. |
| Resume | The same tab with the focus. In its pane: the Resume line. |
| A queue action | A quiet main-checkout herdr tab labelled `Queue`. In its pane: one fixed queue line. The runner renames the tab `#<n> <step>` while a step runs, preserving the session cards and Go. |
| Assist | A focused herdr tab in the main checkout with the label `#<n> assist`. In its pane: the Assist line. |
| Open shell | A herdr tab with the focus in the `path` of a `dirty` row, with the label `#<n> shell` and no command. |
| Go | `herdr agent focus <pane>`; then change to the terminal window. |

**The line of a pane.** At each press, the adapter reads the installed `celetis` program
(`readProgram` of `engine/lib/program.ts`). Its command is `<base>/.local/bin/celetis`, or
`<base>\.local\bin\celetis.cmd` on Windows, where `<base>` is `CELETIS_HOME` or the home folder.
The read refuses an entry that is not a file of the `celetis` program, so the command always
starts the program in its version folder. The command path has no control character. The adapter
keeps no program path between presses, so after `celetis update` the next press starts the new
program.

The adapter makes each line from fixed parts: the command of the program, then, for Run,
`--agent`, the selected agent, and `celetis-flow`; for Resume, `celetis-flow` and `--resume`,
with no agent; or, for Assist, `--agent`, the current default agent, and `assist`.
Resume takes the host and the session from its saved record. The program supplies Bun and its
isolation flags. Each item is in single quotes, and the digits of the number
and ` && exit` end the line. The shell of the pane reads each item as one word, so an item cannot
add a second command. For the issue 12 and the agent `claude`:

```text
'<base>/.local/bin/celetis' '--agent' 'claude' 'celetis-flow' 12 && exit
'<base>/.local/bin/celetis' 'celetis-flow' '--resume' 12 && exit
'<base>/.local/bin/celetis' '--agent' 'claude' 'assist' 12 && exit
```

`&& exit` closes the tab when the command ends with no error. A command that fails leaves the tab
open with its message.

On Windows, the default pane shell of herdr is Windows PowerShell 5.1. There the line starts the
command with `&`, doubles `'` and each of U+2018 to U+201B in a quoted item, and ends with
`; if ($?) { exit }` in place of ` && exit`, with the same result:

```text
& '<base>\.local\bin\celetis.cmd' '--agent' 'claude' 'celetis-flow' 12; if ($?) { exit }
& '<base>\.local\bin\celetis.cmd' 'celetis-flow' '--resume' 12; if ($?) { exit }
& '<base>\.local\bin\celetis.cmd' '--agent' 'claude' 'assist' 12; if ($?) { exit }
```

Queue lines use the same program read and POSIX or PowerShell quoting. Only a parsed
`QueueAction` and the allowed host `claude` or `codex` can supply their values. Start supplies the
selected host; every later action takes the host from the stored record. The fixed POSIX forms
are:

```text
'<command>' '--agent' '<host>' 'celetis-flow' '--queue' 'start' '<step>' <n>... && exit
'<command>' '--agent' '<host>' 'celetis-flow' '--queue' 'continue' '<id>' <revision> '<step>' && exit
'<command>' '--agent' '<host>' 'celetis-flow' '--queue' 'retry' '<id>' <revision> '<step|none>' && exit
'<command>' '--agent' '<host>' 'celetis-flow' '--queue' 'reset' '<id>' <revision> && exit
```

`none` observes closure without authorizing a session. Reset needs no available host executable.
It still requires a valid configuration, a readable current issue, and no live owner.

**The default agent is read-only.** The footer shows `defaultAgent` of the document, or
`No default agent` before the first good read. `defaultAgent` is the host that the engine selects
for a new step: `CELETIS_AGENT`, then `host` of the main `.celetis.yaml`, then `claude`. The
`--agent` of the board start does not set it. Its menu and the command palette show one unavailable
entry, `Default agent is read-only`. Activate it to see the reason:
`The main .celetis.yaml controls the default agent. Change host there.`
These controls send no request and change no configuration.

To use another available agent for one Run, use the card's agent choices. A Run without a choice
uses the current `defaultAgent`. A choice for one Run does not change that default. Resume sends
only the issue number, and the runner selects the saved session. Assist also sends only the issue
number. It reads the current default agent after a fresh issue read and offers no agent choice.

**The herdr calls** of Run, when a workspace has the label of the repository:

```text
herdr workspace list
herdr tab create --workspace <id> --cwd <main checkout> --label '#<n> <step>' --no-focus
herdr pane run <pane> "<the Run line>"
```

Before these calls, the press reads the sessions as a request that is not local does ("The reads").
The workspace is the first one whose label is the folder name of the main checkout. When none has
that label, the press makes it: `herdr workspace create --cwd <folder> --label <folder name>` takes
the place of `herdr tab create`, and one more call, `herdr tab rename <tab> <label>`, names the
first tab of the new workspace. A Run, Resume, or Assist line then runs in the first pane of that
workspace. Each press keeps its folder, its focus, and its label in the two cases:

| Press | Folder (`--cwd`) | Focus | Label | Calls | Calls with no workspace |
|---|---|---|---|---|---|
| Run | the main checkout | none: `--no-focus` | `#<n> <step>` | `workspace list`, `tab create`, `pane run` | `workspace list`, `workspace create`, `tab rename`, `pane run` |
| Resume | the main checkout | the new tab | `#<n> <step>` | the same three, with the Resume line | the same four, with the Resume line |
| Assist | the main checkout | the new tab | `#<n> assist` | the same three, with the Assist line | the same four, with the Assist line |
| Open shell | the `path` of the row | the new tab | `#<n> shell` | `workspace list`, `tab create` | `workspace list`, `workspace create`, `tab rename` |

So an Open shell press with no workspace makes three calls, and it makes the workspace of the
repository in the dirty lane worktree, not in the main checkout.

**The reads.** While the page is in view, it asks the server each 5 seconds. While its tab is
hidden, it asks each 15 seconds with `?local=1`, so the tab title, the tab icon, and the
notifications stay true. The server reads the issue data for these causes: the timer of the
server; the last read started more than 60 seconds before a request that is not local; a session
that had a card at the last request has no card at this one (not at a local request); a press of Run
or Resume; a press of Assist; the end of the 30-second detection period; and a press of Refresh.
Assist first waits for a read that already runs, then starts a new read. It refuses a failed new
read, even when the last good document still has the blocked issue. The timer checks when the
server starts to listen, and then 5 minutes after the start of the last read, for each cause. When the last read started 5 minutes ago
or more, the timer starts a read. So with no page in view, the data is at most 5 minutes old, plus
the time of one read. While a page is in view, the 60-second rule reads first, and the timer reads
nothing. The stop of the board stops the timer. The server also starts these read-only commands,
with no shell:

- `herdr api snapshot`, at each request: the tabs and the agents of herdr in one call;
- `herdr agent read <pane> --source visible`, at each request that is not local, for each session:
  the screen of its pane;
- `git --no-optional-locks -C <folder> diff --shortstat --merge-base origin/HEAD`, at most once each
  15 seconds for each folder, for the lines that a session changed. The folder is the lane worktree
  of the issue (`.claude/worktrees/<n>-<slug>`), else the folder of the agent.

**The presses.** The page sends a press as a POST with a JSON body: `{"number": <n>}` to
`/api/run`, `/api/resume`, `/api/assist`, and `/api/shell`, `{"sessionId": "<id>"}` to `/api/go`, and `{}` to
`/api/refresh`. A Run body can also have `"agent": "<name>"`. The server refuses a press with 409
and opens no tab, unless each condition holds:

| Press | Conditions | Line of the refusal |
|---|---|---|
| `POST /api/run` | The issue has a card of its own, with no session. Its row is `ready` or `stuck`. `noRun` is `null`. No press on that issue is active. | `#<n> has no step to start now` |
| `POST /api/resume` | The issue has a card of its own, with no session. Its row is `stuck`. `noRun` is `null`. No press on that issue is active. | `#<n> has no session to resume now` |
| `POST /api/assist` | A fresh issue read succeeds. The issue has a card of its own, with no session. Its row is `blocked`, with `assist` true and `noRun` null. A current herdr snapshot succeeds. The current default agent is available. No Run, Resume, or Assist press on that issue is active. | The current read, `noRun`, agent, session, or state cause; otherwise `#<n> has no blocked issue to assist now`. |
| `POST /api/shell` | The issue has a card of its own, with no session. Its row is `dirty`. Its `path` is a lane worktree of the main checkout. | `#<n> has no dirty worktree` |

`POST /api/queue` accepts exactly `{"action": <QueueAction>, "agent": "claude" | "codex"}` for
Start, and exactly `{"action": <QueueAction>}` for Continue, Try again, or Reset. The shared
validator refuses extra fields, duplicate or non-positive issue numbers, unsafe integers,
unknown actions or steps, and malformed identities. The existing 1024-byte body limit also bounds
the submitted order; an order that cannot fit returns 400 with the body-size error. There is no
command, path, argument array, gate override, or editable submitted order in the request.

Each queue press refreshes workflow data and reads live ownership before tab creation. Start
requires all selected rows to be currently eligible and the first issue's fresh step to match
the press. Continue, Try again, and Reset require the stored ID and revision; Continue and Try
again also match their requested step to fresh `QueueView.next`. That step need not equal the
older persisted `record.current`: the new press authorizes the newly displayed step. An action
that can start a session requires its host executable to be available. A stale request returns
409 without a pane start; the next board read returns the new view.

One board process serializes queue presses. Separate board processes can both pass HTTP
preflight before either pane starts. The runner takes the queue lock and repeats the authoritative
record, step, and current-issue ownership checks after the asynchronous pane start, so at most
one runner owns the queue. Pending issues take no advance locks and are rechecked when reached;
the runner can record a pending issue that closes after submission without starting a session.

An Assist body must be an object with exactly one field, `number`. An extra field, including
`agent`, a prompt, or execution text, gives 400. The number must be a positive safe integer,
as a number or a digit string. Assist accepts every resolver reason whose card is `blocked`.
It opens assistance for the human action; it starts no workflow step. A 200 response means the
tab opened, not that the host resolved the block. A later CLI refusal can remain in that tab.

These checks of Run, Resume, and Assist also refuse with 409 before tab creation or pane execution.
Read-only `herdr` status calls can precede the failure:

- **The program.** No installed program gives
  `the celetis program is not installed; run the first install of README.md, "First install"`. A
  read that fails gives the first line of its error, for example
  `celetis: <path> is not a file of the celetis program; move it away, then run the install again`
  or `celetis: CELETIS_HOME must be an absolute path: <value>`. A command path with a control
  character gives `the celetis program path has a control character`.
- **The saved session of Resume.** Resume refuses a missing or invalid saved record, or a record
  with no verified session ID, with the first line of its error.
- **The agent of Run or Assist.** Run uses the choice, else `defaultAgent`. Assist uses only
  `defaultAgent` from its fresh read. The agent must be a name of lowercase
  letters that `agents` of the document has. A choice that is not gives
  `#<n> has no agent "<name>"`, and no choice with no `defaultAgent` gives
  `#<n> has no agent to run with`. An agent that is not available gives its `cause`, for example
  `celetis: codex is not on PATH`.

`POST /api/agent` is unavailable. After the Host, Origin, JSON content-type, and body checks, it
returns HTTP 409 with
`{"error":"The main .celetis.yaml controls the default agent. Change host there."}`.
This applies to every parsed JSON body, regardless of the requested agent.
The request writes no Git configuration or working-tree file and starts no read.

The answer to a press that the server did is 200 with `{"ok": true}`. Each other answer is
`{"error": "<one line>"}`, and the page shows the line in a toast:

| Status | Case |
|---|---|
| 400 | The body is not JSON, the body has more than 1024 bytes, the issue number is not a positive safe integer in digits, the queue request is invalid, or Assist has an unexpected body field. |
| 403 | The `Host`, the `Origin`, or the content type is not good ("The trust boundary"). |
| 404 | The path is not a path of the board, or Go names a session that is no herdr agent of the repository. |
| 409 | A condition of the table does not hold, the queue request is stale or unavailable, the read of the program fails, the fresh issue read of Assist fails, Resume has no valid saved session, the agent of Run or Assist is not good, the agent of a Go press has no safe pane id, or the request tries to change the default agent. |
| 502 | A `herdr` call failed: the first line of its error. `herdr gave no id for the workspace`, `herdr gave no id for the new tab`, and `herdr gave no pane for the new tab` are the lines for an answer of herdr with an id that is not safe. |
| 500 | The server failed for another cause: the first line of the error, or `the server failed`. |

The update API is independent of issue and herdr reads. Each success returns
`{runtime: {revision, instance}, update: <snapshot>}`. `revision` is the full revision of the
program that started this board. `instance` is a random ID for this startup.

| Request | Body | Result |
|---|---|---|
| `GET /api/update` | none | The current update snapshot and runtime. |
| `POST /api/update/check` | An empty object, `{}`. | Starts or joins a check and returns the current snapshot immediately. |
| `POST /api/update/start` | Exactly `{"offerId": "<opaque ID>"}`. | Consumes an available offer before mutation and returns 202 with the current snapshot. |

The POST routes use the same Host, Origin, JSON content-type, body limit, CSP, and JSON response
paths as other board actions. A non-object or unexpected field gives 400. An unavailable or
consumed offer gives 409. The start response finishes before this board closes for activation.

## The trust boundary

A Run press starts the runner of the `celetis` program in a herdr pane. Eleven rules hold for the
server and the page:

1. The server listens on `127.0.0.1` only.
2. It refuses, with 403, a request whose `Host` is not `127.0.0.1:<port>` or `localhost:<port>`.
3. It refuses, with 403, a POST whose `Origin` is not `http://` and that `Host`, or whose content
   type is not `application/json`.
4. It accepts only digits, as a number or a string, as the number of an issue, and only the terminal
   id of a herdr agent of the repository as the id of a session.
5. The page sends an issue number, a session id, a selected Run agent, a strict queue action, or an opaque update offer
   ID, never a command or an installation path.
   Resume and Assist take only the issue number. A default-agent request changes no configuration.
6. An id of the answer of herdr (a workspace, a tab, a pane) goes into a `herdr` command only when
   it has letters, digits, `_`, `:`, `.`, and `-`, and does not start with `-`. An id that is absent
   goes into no command.
7. The server starts `herdr` and `git` with no shell, and the issue read starts `gh`, `git`, and,
   on macOS and Linux, `ps` with no shell.
8. For issue and session data, it runs `git` only in the main checkout or in a lane worktree.
   The `git diff` of a session runs with `--no-optional-locks`, so it writes nothing. Update
   workers also validate the native plugin and program installations.
9. Open shell refuses a path that is not under `.claude/worktrees/` of the main checkout.
10. The server writes nothing in a product working tree. An approved update changes only the
    validated native plugin and program installations.
11. The page writes each text of the data, of a pane, and of an error as text, never as HTML. Its
    Content-Security-Policy allows its own files (the page, its six scripts, its stylesheet, and
    its two fonts) and `data:` images (the tab icon) only.

Five rules hold for the start, the lines, and the data:

1. **Each press reads the program.** Each press reads the installed `celetis` program. The read
   accepts only the own entry of the program in `<base>/.local/bin/`, which starts the program in
   its version folder, and the command path holds no control character. The page, the data, and a
   lane cannot supply a command path.
2. **A press types a fixed line.** Run, Resume, and queue actions start the runner of the installed
   `celetis` program; Assist starts its interactive assistance command ("The line of a pane").
   That program starts the first `bun` on the `PATH` of the pane shell, through its `env -S`
   shebang, or through its shim on Windows. Assist starts the selected native host. The server
   starts `herdr` and `git`, and the issue read starts `gh`, `git`, and, on macOS and Linux, `ps`.
   Update workers have the separate fixed update protocol above.
3. **Only validated values go into a line.** The number is the digits of the issue. The agent of
   Run or Assist is a name of lowercase letters that `agents` of the document has. Assist gets
   that agent from its fresh read. Resume takes no agent. Queue fields pass the shared exact-shape validator; its step is an engine-defined
   value, its ID is a UUID, its revision and issue numbers are positive safe integers, and its
   host is `claude` or `codex`. No title, reason, act, or data path goes into a pane line. The
   current step also goes into one argument of `herdr`, the tab label, with no shell.
4. **The data comes from the engine, in the process of the board.** No other program gives the
   document. The lane keys and the step names come from the workflow definition of the engine,
   and the states come from the typed rows of the resolver and from the locks and the record of
   the runner. The page writes each text as text (rule 11), and the Content-Security-Policy stops
   a `javascript:` URL in the page.
5. **The start runs in the main checkout only, with a clean `PATH`.** The entry refuses a start in
   another checkout, and it removes each `node_modules/.bin` item from `PATH`, so a planted `git`,
   `gh`, or `herdr` in such a folder does not run. "Start" gives the reason.

A Run press starts the runner in the repository of the board, and the runner follows the
`.celetis.yaml` of its main checkout. Do not start the board in a repository that you do not trust.

## The layout, the keys, and the errors

**The layout.** The page holds nothing of one repository: it uses neutral colours, follows the light
or dark theme of the OS, and shows the folder name of the main checkout in the header. It carries
its two fonts, Geist and Geist Mono, in `<plugin>/engine/board/fonts/` with their licence (`OFL.txt`, the
SIL Open Font License 1.1), so it loads nothing from the network.

- The header holds the folder name, the switch between Now and Pipeline, the count of each column
  and of landed issues, Search, Queue, History, and Refresh. The title of the browser tab is
  `(<n>) <folder> · Agent board` while `<n>` cards need you, and the tab icon has an orange dot
  then; it has a blue dot while an agent of an issue works and nothing needs you.
- The status bar keeps the Celetis update control after the agent selector, including on phones
  and while its nonmodal dialog is open. The same button shows **Check for updates**, **Checking…**,
  **Up to date**, **Update available**, **Update check failed**, **Update in progress**, or
  **Update needs attention**. The footer can wrap; its controls remain below the dialog. Checks
  keep the cards and other controls usable. Closing the dialog returns focus under the existing
  focus rules; a background close does not take focus from other board work.
- Human sessions is a strip between the header and the columns, in Now and in Pipeline. Each human
  session is one item: the letter of the agent, the label of the tab, the state with its age, and
  Go. A tab with an empty label shows `A session` on its item and as the title of its details. A
  press on an item opens its details. The strip is hidden while no human session runs. A human
  session needs you only while herdr finds a dialog in it (`blocked`): then its item is orange, and
  the `need you` count in the header, the title of the browser tab, the dot of the tab icon, and
  Notify count it. A press on the `need you` count focuses that item first. The column Needs you
  and its count hold only issue work, so the header can count more than the column, and an empty
  Needs you reads `No issue needs you`. `turn ended`, `works`, and `state unknown` need nothing
  from you.
- Now shows the three columns. Needs you groups its cards by reason, in this order: Waits for your
  answer, Stuck (no progress, a dirty tree), Your input on the issue (the `blocked` cards), and
  Ready to run. The first two groups show full cards, and the last two show one row for each card,
  as Idle does. The label of a group stays in view while the column scrolls. When cards are below
  the fold, a line at the foot of the column names them, for example
  `3 more below: 1 input on the issue, 2 ready to run`; a press scrolls to the first of them.
- Queue opens a dedicated view without changing the saved Now/Pipeline choice. Back to board
  restores that choice; search and the existing Go actions remain available. On desktop, available
  runnable issues sit beside the order. On a phone, the order comes first. Add selects each issue
  once. Native Up, Down, and Remove buttons arrange the tab-local draft without an HTTP action.
  Reload clears an unsubmitted draft. Start queue sends the displayed order and first step with
  the selected available agent. The agent and order stay fixed after submission.
- A submitted queue shows its current issue and step, later rows as Waiting, completed outcomes,
  owner, and stop reason. A me gate stops the whole queue; Continue queue authorizes the displayed
  waiting step. Try again appears for allowed recovery, and New queue appears only when reset is
  permitted. A stale press refreshes the decision and requires another press. Opening a pane does
  not itself prove that a runner exists. Submitted state survives reload and board restart.
- Queue row controls keep focus on an enabled control of the moved issue, a neighboring row after
  removal, or an available Add control. Polling restores the same control only when focus was in
  Queue. Start and Continue announce their result and focus the current action or heading. The
  hidden board's card shortcuts do nothing while Queue is open.
- A card shows the type, the number, the title, the lane track, the state with its age, and its
  buttons. A working card shows the lines that it changed. A card whose row has `pr` shows the
  number, the CI result, and the review state. An act line that is a command or a path has a Copy
  button. The tile at the left of a session card is the letter of the agent that herdr found
  (`claude`, `codex`, `opencode`, or another); an issue card shows the icon of its type. The lane
  keys `bug`, `feature`, `chore`, and `hotfix` have an icon of their own, and a lane with another
  key gets the neutral icon. The main button of a card in Needs you is filled.
- The lane track at the right of a card shows where the issue is in its lane. The current step has
  the colour of the state, and it moves while an agent works.
- A press on a card, or `Space`, opens its details in place of Idle: for a session, the last 16
  lines of its pane (with no empty line, rule, or box border), so you can read the dialog or the end
  of the answer; the lane steps, with `auto` on a step whose gate is `auto`; the pull request, the
  folder, and the lines changed. A waiting session shows its lines at the top, beside Go, except a
  human session whose turn ended. `Esc` closes the details. Below 1100 px the details cover the
  right side of the page, and below 720 px the whole page.
- A card that changed since you last looked at the board has a dot, until you point at it or focus
  it. The board takes the cards as seen when its window loses the focus.
- The status bar shows when the board last read the data, with the name of the tracker (`Issues`
  before the first good read), whether herdr runs, and whether the automatic runner runs. It shows
  the keys of the focused card, the landed-issue count (a press opens History), the Notify switch,
  and the list of keys.
- Notify: the first press asks the browser for permission. Then each card that enters Needs you
  shows a system notification while the board is not in front: `#<n> waits for your answer`,
  `#<n> ended its turn`, `#<n> made no progress`, `#<n> has a dirty worktree`, `#<n> <reason>` for a
  `blocked` card, and `#<n> is ready to run <step>`, with the title of the issue. A human session
  that starts to wait for your answer shows `Human session "<label>" waits for your answer`, or
  `A human session waits for your answer` when its tab has an empty label. A press on the
  notification opens the details of the card. A screen reader hears each card that enters Needs you,
  each card that starts, and the session or the warning that ends a start.
- Pipeline has one column for each item of `flow.stages`, in order, and it shows each issue at its
  step. A strip at the top, Not in a step, holds the issues whose step is in no stage.
- When a request of the page fails, the cards of the last good read stay, dimmed, under the message
  `The board read failed. The cards and history show the last good read.`
- A card that changes its column moves to its new place. The page shows no motion when the OS asks
  for reduced motion.
- Below 1100 px Needs you takes the left half and Running and Idle share the right half, and the
  page scrolls as one document; it also scrolls as one document at a height of 700 px or less. Below
  720 px the columns stack.
- The page keeps three choices in the storage of the browser: the view, the Notify switch, and the
  switch of the single-key shortcuts. A board on another port has its own choices.

**The keys.** `⌘K` (`Ctrl K` off macOS) or `/` opens the search: it lists the issue work that needs
you first, then the running cards, the steps that can start, the human sessions (a waiting one
too), the landed issues, and the commands of the board. `#<n>` jumps to an issue, and `<n>` alone also
finds a human session whose tab label is `<n>`. `j` and `k` move to the next or the previous card,
`h` and `l` to the column on the left or the right; `Enter` presses the main button of the card,
`Space` opens its details, `m` opens all its actions, `o` opens the issue, and `c` copies the
command or the path of the card. `v` changes between Now and Pipeline, `d` shows or hides History, `r`
reads the issues again, and `?` shows the list. The list has a switch that turns the single-key
shortcuts off; the keys of a focused card always work, and the arrow keys move from a focused card
as `h`, `j`, `k`, and `l` do. After a Run, Resume, or Open agent press, the focus stays on the card
of the issue in Running. A press in the details keeps the focus in the details: on the same button, or on
Close when that button goes.

After the first good read, the page writes the name of the tracker in its texts:
`Open the issue on <tracker>` and `Read <tracker> again`. Before that read, and in the list of keys,
the texts are `Open the issue` and `Read the issues again`.

**The errors.**

- When a press fails, a toast names the press (`Go failed`, `Run failed`, `Resume failed`, `Open agent failed`,
  `Open shell failed`, `Refresh failed`, `Queue action failed`) above the line of the server. After Go, Open shell, or
  Refresh, the card keeps its button. A failed Run, Resume, or Open agent ends its `Starting` card
  and permits a retry after the next read. This covers a herdr server that does not run, a `herdr`
  that is not on `PATH`, and a press that the server refuses.
- The status bar shows `herdr down` when `herdr api snapshot` fails, with the error in its title.
  The board then shows no session card, and the issue cards stay.
- The status bar shows `cannot read:` with one line when the last read of the issues failed ("The
  data"). The cards of the last good read stay.
- The status bar shows `The board server does not answer` when a request of the page failed. A
  press at that time gives a toast with that text and `Start the board again in a terminal.`
- Queue disables execution controls during a request or an unavailable authoritative read. A failed
  press retains the draft or submitted schedule and shows the server reason. Recovery controls
  follow the current engine action flags, including an interrupted runner.
- The `noRun` text, the message of a server that does not answer, and each toast are alerts for a
  screen reader.

## Versions

- **The board shares the program revision.** A board-approved update starts that installed
  revision automatically. A terminal-started `celetis update` needs a manual board restart
  ("Start"). Each startup has a distinct runtime instance.
- **The document has no version.** The board and the engine are one package, and the compiler
  checks the `Document` type between them.

Browser sources are `board.ts`, `view.ts`, `ui.ts`, `panel.ts`, `palette.ts`, `queue.ts`, and
`update-dialog.ts`. The pinned Bun 1.4.4 build program, `<plugin>/scripts/build.ts`, generates their existing `.js` and `.mjs` URLs.
It compiles every target before it writes any output. Plugin users run no build.

## Limits

Of the distribution:

- A start from a program with no terminal, for example a launch entry of a desktop app, needs
  `bun`, `gh`, and `herdr` on the `PATH` of that program. This is not checked. When such a start
  fails, start the board in a terminal.
- Issue reads check no plugin update policy. A conflict can show in the independent update
  check, or in the pane of the next Run, Resume, or Assist.

Of the sessions and herdr:

- A session outside herdr, for example in a desktop app, has no card.
- An agent in a subfolder of the main checkout has no card, although the board starts in such a
  folder. The issue of its tab then keeps a card of its own, with Run.
- herdr reads the state of Claude Code from its screen. A dialog that the rules of herdr do not know
  shows as `works` or `state unknown`, and a new release of Claude Code can need new rules of herdr
  (`herdr server update-agent-manifests`).
- The card of a waiting session does not say what the agent asks: the details show the lines of its
  pane. The board does not read the private files of an agent.
- The time of a session state starts when the server first sees that state. The server sees nothing
  while no page asks, and a start of the server starts each time again.
- Each agent in one tab links to the issue of the label of that tab.
- The board needs a herdr server that runs. A press of Run, Resume, Assist, or Open shell without one gives
  a toast, and the status bar shows `herdr down`.
- A Go press focuses the pane inside herdr. It does not bring the terminal window to the front.
- herdr states no compatibility policy for its CLI, and minor releases had breaking changes. The
  board was checked against herdr 0.9.3 (protocol 22).
- Two repositories whose main checkout has the same folder name share one herdr workspace label.
- The shell of a herdr pane is sh, bash, or zsh, or Windows PowerShell on Windows: the board quotes
  each item of a pane line for those shells. In a fish pane, an item that ends in `\` does not
  close its quote. Windows PowerShell 5.1 drops an empty item, and it passes an item with `"`, or
  with a space and a trailing `\`, wrongly. A `.cmd` or `.bat` first item parses `&`, `^`, and `%`
  again. On Windows the first item is `celetis.cmd`: the other items of the fixed lines have
  none of these forms, and a `<base>` path with `&`, `^`, or `%` is not checked.
- `&& exit`, or `; if ($?) { exit }` on Windows, closes the tab of a command that exits 0. A runner
  that prints a message and exits 0 thus leaves no message: start
  `celetis --agent <host> celetis-flow <n>` in a terminal to see it.

Of the cards and the page:

- The board does not show the `step` of a `blocked` row: such a card is in Not in a step of Pipeline
  and has no lane track.
- Before the first good read, Pipeline has no stage column: the strip Not in a step holds each
  session of an issue.
- Separate board server processes share no start reservation. Their concurrent presses can make
  two tabs for one issue.
- A start of the server forgets the times of the Run, Resume, and Assist presses.
- The count of changed lines is against `origin/HEAD`. A clone with no `origin/HEAD` shows no count.
- A notification shows only while the page is open in a tab. A browser that throttles a hidden tab
  can delay it by up to a minute.
- The page has no login. Each program on the machine can ask the server.
- The lane icons are the one place where the page knows four names of a flow. They change no rule.
