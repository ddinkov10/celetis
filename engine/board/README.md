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

- **The sessions** come from herdr-core (`hc`), which keeps the terminals in which the agents run.
  The Herdr app shows these terminals as tabs. A repository sets nothing for them.
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
the reasons why it reads its data in its own process and starts fixed commands.
[ADR-0058](../../docs/adr/0058-herdr-core-hosts-the-agent-terminals.md) of the plugin `celetis`
gives the reasons why its sessions come from herdr-core and its tabs from the Herdr app.

**Requirements.**

- macOS or Linux. On native Windows, the start and the data of the board before #102 are checked;
  the in-process read of #102, and Run, Resume, and Assist in a Herdr app tab, are not
  (`docs/celetis-flow.md` of the plugin `celetis`, "Acceptance status").
- Bun 1.4.4 or later. The entry prints `celetis: need Bun >=1.4.4 on PATH, found <version>` and
  exits 2 on an older Bun.
- git 2.31 or later.
- The installed `celetis` program for New intake, Run, Resume, Assist, Make visual, and queue actions (the README of the plugin, "First install").
- herdr-core 0.1.16, with `hc` on `PATH` and its server that runs, for the session cards and for
  each button.
- The Herdr app 0.1.11, with `herdr-app` on `PATH` and its window open, for New intake, Run,
  Resume, Assist, Make visual, Open shell, queue wakes, and Go.
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
check and, for Codex, its `CODEX_HOME`. The start records its own program revision and starts an independent update check after it listens. At each New intake, Run,
Resume, or Assist, the fixed adapter (`adapter.ts`) reads the installed `celetis` program and gives
its argv ("The argv of a press").

**The port** starts at `board.port` of the main `.celetis.yaml`, or 4403. With no effective
`PORT`, the board binds consecutive ports on `127.0.0.1` through 65535 and keeps the first
successful listener. Only `EADDRINUSE` advances the search. A free lower port is not considered.
Concurrent starts claim their ports with the actual listeners; there is no separate probe or
reservation. Shutdown cancels further attempts and closes the listener.

A nonzero `Number(PORT)` requests that exact port and disables the search. Zero or NaN,
including an empty or nonnumeric string, means no override. Invalid effective values keep Bun's
existing failure. Use an exact port when the origin must stay fixed:

```bash
PORT=4404 celetis --agent <host> board
```

**The start prints** the main checkout and the actual URL once, after a successful bind.
Failed candidates print no success lines. The printed URL is authoritative:

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
| The exact `PORT` is in use | `agent-board: cannot listen on 127.0.0.1:<port>: the port is in use` | 1 |
| Every automatic candidate is occupied | `agent-board: cannot listen on 127.0.0.1:<start>-65535: all ports are in use` | 1 |
| The server cannot listen for another cause, for example `PORT=99999` | `agent-board: cannot listen on 127.0.0.1:<port>: <the message of Bun>` | 1 |

The engine finds the main checkout (`docs/configuration.md` of the plugin `celetis`, "Operation
values and freshness"). A start in a subfolder of the main checkout, or through a symbolic link to
it, finds the main checkout.

**Start the board in the main checkout only.** A `node_modules/.bin` folder of the start folder or
of its parent folders can be on `PATH`. In the main checkout, those are files of the trunk. A lane
worktree holds the files of a branch, which do not have the trust of the trunk. The entry refuses a
start in a checkout that is not the main checkout, and it removes each `node_modules/.bin` item
from `PATH` before it starts `git`, `gh`, `hc`, or `herdr-app`.

**Open work during updates.** The status bar keeps one update control after the agent selector.
**Check for updates** starts discovery in one press. **Checking…** retains focus and ignores
another press. **Up to date** reports that the installed program and registered plugins match
the configured target; it does not mean that an open board or agent session has reloaded new
code. Press **Up to date** for a fresh check. Progress and results use the polite status region,
without a success toast or current-result dialog. A check does not refresh issues or approve
installation. Only the separate **Update and restart** decision approves an offer.

The board checks at startup and every 10 minutes. Concurrent
checks share one worker, with a 120-second limit. These checks do not wait for issue or terminal
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
allow 60 seconds to reconnect. Queue actions persist independently of a full-board read; accepted order survives reload. The page reloads once only after the target revision
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
program again. After `celetis update`, the next press starts the command of the new program with no
board restart. After a terminal-started update, start the board again for its new code. A fresh
session loads changed skills; an open session does not reload them automatically. A change of `board.port` also
needs a board restart. A change of `host` or `gates` in the main `.celetis.yaml` shows at the next
read ("The data").

**Three values have no setting:**

- A lane worktree is `<main>/.claude/worktrees/<n>-<slug>`.
- The name of the space of the Herdr app is the folder name of the main checkout.
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

A full read collects all open issues and their timelines, and the open PRs and their check and
review results. A selected-issue read fetches each selected issue once and lists open PRs once.
It reads timelines and PR details only for those issues. Both paths use the same row rules.
The selected read replaces or removes only selected rows, sorts by issue number, and retains
other rows. Closed issues, PR objects, and missing issues have no active row. Only an explicit
404 from the initial issue request means missing; another request failure fails the batch.

Each module of the data path is a static import. So a read loads no file of the plugin, takes no
plugin read lock, and checks no update policy. The start checks the selected host's policy.
Independent update checks validate the native update policy. Each Run and Resume starts a new
runner process, which makes its own check. Assist checks the policy before it starts the native host.

One read runs at a time. Full requests join an active full read or queue one full read after an
active selected read. That full read takes priority over the next selected batch. Each read
consumes the targets pending at its start; later hints remain pending, including the same issue.
A failed full read restores its consumed targets; a failed selected read waits for another cause.
Before the first good document, targets cause only full reads. A read has a limit of 60 seconds.
The stop of the board also stops a read that runs. In each case, the `gh` process of that read ends. When a read fails, the cards and history of the last good read stay, and the status bar shows
`cannot read:` with one line:

| Cause | Line |
|---|---|
| The main `.celetis.yaml` has an error | The first line of the diagnostic of the config reader |
| The resolver cannot read GitHub | The first line of the stderr of the resolver, else `cannot read the issues from GitHub` |
| The read does not end in 60 seconds | `the issue read did not end in 60 seconds` |
| Another failure | The first line of its message, else `the issue read failed` |

A selected-read error takes display priority over a full-read error. A good selected read clears
only its own error; a good full read clears both. Selected reads do not change the last-full-read
time or the full-read evidence for the 30-second session detection period.

`Document.queue` and `Board.queue` use QueueView. A null record means no saved queue yet.
The view carries the schema-2 record, live owner, fresh next decision, error, and Add/Edit/Continue/Retry
permissions. A full read reconciles terminal members through the shared engine transition.
A selected read uses that transition only when a selected issue is in the current queue. It
retains the previous queue view otherwise. Remote row and History reads finish before this
transition. Existing live-owner checks and wake authorization still apply.
Its server-only `queueWake` carries a newly issued token once and is never a browser command.
Each placement reads local storage and ownership, requests the existing refresh after changes,
and disables recovery until the current decision is fresh. A failed full read disables queue
actions until a full read succeeds. A selected-read error alone does not disable them; all
queue-specific restrictions still apply. Failed reads preserve the last good list.

## Landed history

History sits between Search and Refresh. It opens the existing nonmodal panel and closes card
details. Card details close History. The default is closed on each page load; refresh keeps its
open state, scroll, and matching focused link. Escape or Close returns focus to History. The
landed count and the `d` shortcut open the same panel. Search finds landed issue numbers and titles.
History stays visible on a phone. Below 1100 px width or 701 px height the panel is a drawer;
below 720 px width it fills the viewport. Closing it restores the board width.

A full read, or a selected read that finds at least one closed issue, calls `history.ts` once.
Other selected reads retain History. `history.ts` reads the remote repository metadata and
captures the default branch head. It walks
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
Each row has one control on its right side. A row with no page has Make visual
(`Make the visual of #<n>`); a press sends only the issue number, and the button reads `Starting…`
(with `aria-busy`) while the press runs. While its `#<n> visual` tab is open, the row shows
`Making…` (a status with a turning icon, in Current Blue). A row with a page has the link
`Open visual` to `/visual/<sha>`, in a new browser tab. A refused press gives the toast
`Make visual failed` with the line of the server, and the row then shows its server state. The
focus stays on the control of its row through these states. Below 720 px the control is 44 px
high.

The list covers recent landings through both `merge` and `pr`. A closure alone proves no landing;
an open issue can appear in both active work and history. Absence from 20 entries proves nothing
about older landings. A later revert does not remove the earlier event. `View <trunk>` opens
older history for inspection.

## The cards

The page has three columns, Needs you, Running, and Idle, a strip of human sessions above them, and
a landed-history panel.

**The sessions.** A session is a live terminal of herdr-core with all of these facts:

- Its folder is the main checkout folder itself, or a lane worktree or a folder in it. That folder
  is the folder of its foreground process, else the start folder of the terminal. A terminal of
  another folder has no card, and this includes a subfolder of the main checkout.
- Its host reports a status (OSC 7501), and the `app` of that status names `claude` or `codex`.
  A terminal with no status has no card.
- Its foreground process is that host (the file name of its first item, with no `.exe`), or a
  process with an item of the file name `celetis-flow.ts` while the terminal has a link label. In
  a session tab of the runner, that process is the start barrier, the leader of the foreground
  process group (`docs/celetis-flow.md` of the plugin `celetis`, "How a step runs", "The session
  tab"). A shell whose host exited has no card, also when Codex left a `done` status in it.

The link label of the terminal, `celetis.link`, links a session to an issue: `#<n> <step>` gives
the issue `<n>` and the step, `#<n>` alone gives the issue only, and another label gives no issue.
The step word counts only when `flow.lanes` of the document names that step. The runner gives
each session tab, also a resume tab, the link label `#<n> <step>`. A press that opens a tab
(New intake, Assist, Make visual, and Open shell) sets the link label to the tab name. Assist uses
`#<n> assist`, and Make visual uses `#<n> visual`: each links the issue but gives no workflow step.
A tab that you rename by hand links no session. A session with no link label, for example a resume that
you start by hand, takes the name of its tab as its title: the part of the `where` label of
herdr-core after the first ` / `. With no tab name, its title is empty. The time of a session state
is the time when the server first saw that state; `idle`, `done`, and `error` count as one state.

A session makes one card, from the status that its host reports. The main button of a session
card is Go. A session with no issue is a human session: a tab that you started yourself. It has no
card in a column: the strip Human sessions shows it with the same state ("The layout"). The table
gives the column of a session of an issue.

| Status | Column | State on the card |
|---|---|---|
| `working` | Running | `works` |
| `blocked`: the host waits for an approval or an answer | Needs you | `waits for your answer` |
| `idle`, `done`, or `error`: a live runner checks or closes this turn | Running | `checks step` |
| `idle`, `done`, or `error`: the agent is ready for the next prompt | Needs you | `turn ended` |

Each board request, including a local request, reads the runner's private step-end record from
the common Git directory. Its PID, process start, terminal, and host must identify a live runner.
A retained verdict applies only to the recorded terminal and the hc `turn` of that terminal.
A later turn starts with no retained verdict, even when the board misses its working state.
Missing, invalid, unreadable, or stale evidence keeps the ordinary wait. A dialog always wins.
A resume session has no completion watcher. The runner keeps an exiting verdict
until the foreground exits, then removes it. This local read adds no GitHub request.
A board-approved update starts the new program automatically. After a terminal-started update,
start a new board process to load updated server code.

The state of a session wins over the state of its issue, and an issue with a session has no card of
its own. Two sessions of one issue make two cards. A session card shows the title, the type, the
link, and the pull request of the row of its issue. A human session, and a session whose issue has
no row, show the link label, else the tab name, as the title, with no link and no type.

**The issues.** Each row with no session makes one card, from its `state`:

| `state` | Column | State on the card | Act line | Main button |
|---|---|---|---|---|
| `starting` | Running | `Starting` | none | none |
| `dirty` | Needs you | `dirty tree` | `path` | Open shell |
| `stuck` | Needs you | `no progress` | `act` | Resume, and a quiet Run again |
| `blocked` | Needs you | `reason` | `act` | Open agent |
| `ready` | Needs you when `started` or `urgent`, else Idle | none: the card shows `next <step>` | none | Run |

- A `ready` card shows `auto` when the `gate` of its step is `auto`.
- A `ready` card shows the effort level of its step, the `effort` of its row, in a chip after
  `next <step>` and before `auto`. The chip is solid for a decision on the issue and dashed for the
  default. Its title and accessible name are `effort <level>, decided by <by>` or
  `effort <level>, default`, where `<by>` is the step before the started step in the lane of the
  issue (`docs/celetis-flow.md` of the plugin `celetis`, "The board").
- On a `ready` card, the accessible name of Run is `Run <step> at <level> (decided by <by>), #<n>` or
  `Run <step> at <level> (default), #<n>`. The title of Run is
  `Start the <step> step at <level>, decided by <by>` or `Start the <step> step at <level>, the default`,
  plus the `hint` of that step.
- Open agent uses the current default agent, with no agent choice. It is the main action in Now,
  Pipeline, details, the card menu, and search. Open issue remains secondary, and `o` opens the issue.
  An unavailable default agent disables Open agent with its cause.
- With a `noRun` text, the page shows that text above the columns and permits no Run, Resume, or Assist.
  A card that would have Run or Open agent shows it disabled with that text.
- The lane track of a card is the list of `flow.lanes` for its `type`. A card whose step is not in
  that list has no track.

**The order.** Needs you has the urgent cards first, then the dialogs, then the longest wait first.
Running has the newest first, and Idle has the highest number first. History follows remote trunk traversal order.
Human sessions has the order of their titles, with numbers in numeric order, and two sessions
with one title in the order of their terminal ids.

**During a press** of Run, Resume, or Assist, the page moves the card to Running at once. The card shows
`Starting` with a turning status icon while the board reads the program and starts the runner or
opens the tab. It keeps its
step, so Pipeline shows it at that step. Assist keeps a null step and remains in Not in a step.
While the request runs, no control of the page sends a second press for that issue. Run, Resume,
and Assist share one reservation in the server, from before the asynchronous eligibility read
until the runner or the tab starts, or the operation fails. A competing press from any browser client gets 409.
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
| Run | A hidden runner in the main checkout, with the Run argv. The runner opens a quiet session tab `#<n> <step>`. A `Run at <level>` entry adds the level to that argv. For the current issue of a queue paused at a `me` gate, use the queue Continue action below. |
| Resume | A hidden runner in the main checkout, with the Resume argv. The runner opens the session tab `#<n> <step>` with the focus. |
| A queue action | A persisted QueueView acknowledgement. Only a new wake starts a hidden runner in the main checkout, with the fixed queue run argv. For each step, the runner opens a quiet session tab `#<n> <step>` with that link label, so the session cards and Go stay. |
| New intake | A focused `Intake` tab in the main checkout. The current default host asks for the request, then enters `celetis:intake` with the answer. The button creates no issue and starts no runner. |
| Assist | A focused tab `#<n> assist` in the main checkout, with the Assist argv. |
| Make visual | A focused tab `#<n> visual` in the main checkout, with the Make visual argv, for a History row with no page. The command in the tab makes the page `docs/superpowers/visuals/<sha>.html` of the main checkout. |
| Open shell | A focused tab `#<n> shell` in the `path` of a `dirty` row, with no argv: herdr-core starts the shell of the machine. |
| Go | `herdr-app do pane.focus --terminal <id>`; then change to the Herdr app window. |

**The argv of a press.** At each press, the adapter reads the installed `celetis` program
(`readProgram` of `engine/lib/program.ts`). Its command is `<base>/.local/bin/celetis`, or
`<base>\.local\bin\celetis.cmd` on Windows, where `<base>` is `CELETIS_HOME` or the home folder.
The read refuses an entry that is not a file of the `celetis` program, so the command always
starts the program in its version folder. The command path has no control character. The adapter
keeps no program path between presses, so after `celetis update` the next press starts the new
program.

The adapter makes each argv from fixed items: the command of the program, then, for an independent
Run, `--agent`, the selected agent, and `celetis-flow`; for Resume, `celetis-flow` and `--resume`,
with no agent; for Assist, `--agent`, the current default agent, and `assist`; for Make visual,
`--agent`, the current default agent, `visual`, the number, and the full commit hash of the
History row of that number; or for New intake, `--agent`, the current default agent, and
`intake`, with no issue number. A `Run at <level>` entry
adds `--effort` and the level after the number. The Run argv ends with `--quiet`, so the runner
opens each session tab in the background.
Resume takes the host and the session from its saved record. The program supplies Bun and its
isolation flags. The number is its digits. Each item is one argument: no shell reads the argv as
a line, so an item cannot add a second command. For the issue 12 and the agent `claude`:

```text
<base>/.local/bin/celetis --agent claude celetis-flow 12 --quiet
<base>/.local/bin/celetis --agent claude celetis-flow 12 --effort xhigh --quiet
<base>/.local/bin/celetis celetis-flow --resume 12
<base>/.local/bin/celetis --agent claude assist 12
<base>/.local/bin/celetis --agent claude visual 12 <sha>
<base>/.local/bin/celetis --agent claude intake
```

On macOS and Linux, the new terminal starts the argv in a login shell of `$SHELL` (else `/bin/sh`),
with `hc run --rm`. Run, Resume, and a queue wake use the first start form, and New intake,
Assist, and Make visual use the second:

```text
<shell> -lic 'exec "$@"' <shell> <argv>
<shell> -lic '"$@" || exec "$0" -li' <shell> <argv>
```

The shell gets each item as one item of `"$@"`. In the first form, the program takes the place of
the shell, so no shell stays after it, and herdr-core removes the terminal when the program exits.
In the second form, a program that exits 0 closes the tab: herdr-core removes its terminal. A
program that fails leaves the tab open with its message and an interactive shell. On Windows,
`hc run` gets the argv with no shell, and a tab gets no `--rm`. On Windows, the start of the argv
is not checked.

Queue admission invokes the installed Program.entry as a finite Bun process with isolation flags.
The adapter validates its receipt. Only its wake starts a terminal, a hidden runner, with this
fixed argv:

```text
<command> --agent <host> celetis-flow --queue run <id> <token> --quiet
```

Add supplies the selected host. Other actions use the saved host. Retry with null step resolves
terminal work without authorizing a session. No batch Start or Reset command remains.

**The default agent is read-only.** The footer shows `defaultAgent` of the document, or
`No default agent` before the first good read. `defaultAgent` is the host that the engine selects
for a new step: `CELETIS_AGENT`, then `host` of the main `.celetis.yaml`, then `claude`. The
`--agent` of the board start does not set it. Its menu and the command palette show one unavailable
entry, `Default agent is read-only`. Activate it to see the reason:
`The main .celetis.yaml controls the default agent. Change host there.`
These controls send no request and change no configuration.

To use another available agent for one independent Run, use the card's agent choices. An independent
Run without a choice uses the current `defaultAgent`. Run on the current issue of a queue paused
at a `me` gate uses Continue with the saved queue host. An absent or null choice keeps that host;
an explicit different host is refused. A choice for one Run does not change the default. Resume sends
only the issue number, and the runner selects the saved session. Assist also sends only the issue
number. It reads the current default agent after a fresh issue read and offers no agent choice.

To start one step of a `ready` card at another effort level, use a `Run at <level>` entry of its
run menu ("The layout, the keys, and the errors"). An entry uses the current `defaultAgent`, as Run
does, and sends the level. The Run argv then has `--effort` and the level after the number, so the
runner starts that step at that level once (`docs/celetis-flow.md` of the plugin `celetis`, "Start
the script", "The effort level"). The entry writes no decision on the issue, and a later step uses
its own decision. The current issue of a queue paused at a `me` gate takes no level: the queue
starts its step at the decided level.

**New intake is independent of issue reads.** `POST /api/intake` accepts exactly `{}`. A non-object
or an extra field returns 400 before any terminal starts. Each press reads the main configuration
and resolves `CELETIS_AGENT`, then its `host`, then `claude`. It checks the host executable and the
current program before opening a focused `Intake` tab. A preflight failure returns 409; a failed
`hc` or `herdr-app` call returns 502. It neither waits for nor starts an issue read and does not use queue or issue
locks. One pending reservation per board process refuses concurrent intake requests with 409.
The reservation clears on success or failure, so a later deliberate press opens a fresh session.
Separate board processes share no reservation, and a lost response has no exactly-once guarantee.
Success confirms that the terminal started with the argv, not readiness of the native host. Startup
errors remain in that tab. The existing Human sessions strip observes the session without an
issue number or a new session store.

**The terminal calls** of Run, Resume, and a queue wake:

```text
hc ls --json
herdr-app ls
hc run --bg --json --no-parent --no-notify --rm --cwd <main checkout> --label 'celetis.runner=#<n>' -- <shell> -lic 'exec "$@"' <shell> <argv>
```

Before these calls, a Run or Resume press reads the sessions as a request that is not local does
("The reads"). The first two calls check that the hc server and the Herdr app answer, after a
check that `hc` and `herdr-app` are on the `PATH` of the board. When a check fails, the press gets
502 with the line of the check, for example
`the Herdr app does not answer: <cause>; open the Herdr app window, then start again`, and no
terminal starts. For a queue wake, that failure is a known failure before command dispatch.
The new terminal has no `herdr.space` label, so it has no tab: the runner is hidden. A queue wake
uses the label `celetis.runner=queue`. The board makes the label only from the digits of the issue
or the word `queue`. `--no-parent` keeps the runner alive when the board itself runs in an hc
terminal that ends. The runner then opens the session tab with the calls of
`docs/celetis-flow.md` of the plugin `celetis`, "How a step runs", "The session tab": a Run and a
queue wake pass `--quiet`, so the tab is quiet, and the tab of a Resume comes to the front.

A hidden runner stops by itself. With the default `me` gates, the runner of a Run press ends with
its one session. The board has no control that stops a hidden runner. To stop one, find its
terminal, then end it:

```text
hc ls --label 'celetis.runner=#<n>'
hc kill <t>
```

For the runner of a queue wake, use `hc ls --label celetis.runner=queue`. The stop of a runner does
not end a session whose start barrier it released (`docs/celetis-flow.md` of the plugin `celetis`,
"How a step runs", "A stop of the runner").

The terminal calls of New intake, Assist, Make visual, and Open shell, when the Herdr app has a
space with the name of the repository:

```text
herdr-app ls
hc run --bg --json --no-parent --no-notify --rm --cwd <folder> --label herdr.space=<space> --label 'celetis.link=<name>' -- <the start form of the argv>
herdr-app ls
herdr-app do tab.rename --id <tab> --name '<name>'
```

Before these calls, Assist and Open shell read the sessions as a request that is not local does
("The reads"). Make visual reads only the terminal list: `hc ls --json`, then
`hc get <id> --json` for each live terminal.
When `herdr-app ls` fails, for example because the Herdr app does not run, the press gets 502 with
the first line of the error, and no terminal starts. The space is the first local space whose name
is the folder name of the main checkout. The label `herdr.space` puts the new terminal in a new
tab of that space, and the current tab keeps the focus. The board then reads `herdr-app ls` again,
for up to 5 seconds, until the tab of the new terminal shows, and renames that tab. A tab that does
not show in that time keeps its name; the link label still links the session. A focused press
then runs `herdr-app do pane.focus --terminal <id>`. `--no-parent` keeps the session alive when the
board itself runs in an hc terminal that ends.

When no space has that name, the press makes it:
`herdr-app do space.new --name <folder name> --folder <folder> --tab <name> --argv <the argv as JSON>`
takes the place of `hc run` and the rename, and `hc label <id> celetis.link=<name>` labels the
terminal of the first tab. The Herdr app shows the new space at once. One board process finds or
makes the space and starts the terminal for one press at a time, so two presses at once make one
space. Each press keeps its folder, its focus, and its name in the two cases. Run, Resume, and a
queue wake open no tab: the table gives the label of the hidden runner, and the runner opens the
session tab.

| Press | Folder | Focus | Tab name and link label | Argv |
|---|---|---|---|---|
| Run | the main checkout | none: the session tab is quiet | none: a hidden runner, `celetis.runner=#<n>` | the Run argv |
| A queue wake | the main checkout | none: each session tab is quiet | none: a hidden runner, `celetis.runner=queue` | the queue run argv |
| Resume | the main checkout | the session tab | none: a hidden runner, `celetis.runner=#<n>` | the Resume argv |
| Assist | the main checkout | the new tab | `#<n> assist` | the Assist argv |
| Make visual | the main checkout | the new tab | `#<n> visual` | the Make visual argv |
| New intake | the main checkout | the new tab | `Intake` | the New intake argv |
| Open shell | the `path` of the row | the new tab | `#<n> shell` | none |

So an Open shell press with no space makes the space of the repository in the dirty lane
worktree, not in the main checkout.

**The reads.** While the page is in view, it asks the server each 5 seconds. While its tab is
hidden, it asks each 15 seconds with `?local=1`, so the tab title, the tab icon, and the
notifications stay true. The server checks local refresh hints each second, without overlapping
listings, even with no page open. At startup it first lists existing hints and seeds its seen
names, then starts a full read. New valid names select their issue numbers for the next batch.
Each board consumes hints independently. A missing folder is empty; a listing failure keeps
the prior seen names and pending targets without a diagnostic. Hints contain no issue data and
authorize no action.

A session card that disappears selects its known issue, including at a local request. A session
with no issue keeps the full-read cause only at a request that is not local. Other full-read
causes remain: the server timer; a nonlocal request more than 5 minutes after the last full-read
start; Run, Resume, or Assist; the end of the 30-second detection period; local queue changes;
and Refresh. Assist waits for an active read, then starts a fresh full read. It refuses a failed
fresh read even when the last good document still has the blocked issue.

The five-minute timer is measured from full-read starts. Selected reads do not postpone it.
A due or manual full read waits for an active selected read, then runs before later target
batches. This full read recovers direct GitHub edits that have no local hint. Requests can serve
the last good document while a selected read runs. The last-read timestamp changes only after
a successful full read. The stop of the board stops both timers and the active read.
The server also starts these read-only commands, with no shell:

- `hc ls --json`, at each request: the live terminals. Then `hc get <id> --json` for each live
  terminal, also one that reports no status: its status, its turn, its labels, its folders, and its
  foreground process;
- `hc read <id> --lines 0 --json`, at each request that is not local, for each session: the screen
  of its terminal;
- `git --no-optional-locks -C <folder> diff --shortstat --merge-base origin/HEAD`, at most once each
  15 seconds for each folder, for the lines that a session changed. The folder is the lane worktree
  of the issue (`.claude/worktrees/<n>-<slug>`), else the folder of the session.

Each request, also a local one, gives each History row its `visual` state. It checks up to 20 page
files `docs/superpowers/visuals/<sha>.html` of the main checkout with `lstat`, and it uses the
terminal list of that request. A page that is a regular file gives `ready`, also while its tab
stays open. Else a Make visual press of that number in this board process gives `starting`. Else
a live terminal with the link label `#<n> visual`, in the main checkout or in a lane worktree,
gives `making`. Else the state is `none`. A partial page, a symbolic link, and a terminal of
another folder give no state. When `hc ls` fails, the request has no tab fact, so a row with no
page and no press is `none`. A row moves to `ready` at the first read after the host renames its
page.

**The presses.** The page sends a press as a POST with a JSON body: `{"number": <n>}` to
`/api/run`, `/api/resume`, `/api/assist`, `/api/visual`, and `/api/shell`, `{"sessionId": "<id>"}` to `/api/go`, and `{}` to
`/api/refresh`. A Run body can also have `"agent": "<name>"` and `"effort": "<level>"`. Before any
read, the server refuses an `effort` that is not `low`, `medium`, `high`, `xhigh`, or `max` with 400
and `the effort is not one of low, medium, high, xhigh, max`. The server refuses a press with 409
and starts no terminal, unless each condition holds:

| Press | Conditions | Line of the refusal |
|---|---|---|
| `POST /api/run` | A fresh issue and queue read succeeds. The issue has a card of its own, with no session. Its row is `ready` or `stuck`. `noRun` is `null`. No press on that issue is active. A current paused queue issue has no `effort` in the body and also meets the Continue conditions below. | The read or queue cause; `The queue starts this step at the decided level` for an `effort` on a current paused queue issue; otherwise `#<n> has no step to start now`. |
| `POST /api/resume` | The issue has a card of its own, with no session. Its row is `stuck`. `noRun` is `null`. No press on that issue is active. | `#<n> has no session to resume now` |
| `POST /api/assist` | A fresh issue read succeeds. The issue has a card of its own, with no session. Its row is `blocked`, with `assist` true and `noRun` null. A current `hc` terminal list succeeds. The current default agent is available. No Run, Resume, or Assist press on that issue is active. | The current read, `noRun`, agent, session, or state cause; otherwise `#<n> has no blocked issue to assist now`. |
| `POST /api/visual` | The issue has a History row in the last good read. The page of its commit does not exist. No live terminal with the link label `#<n> visual` is in the main checkout or a lane worktree. No Make visual press of that number is in flight. The current default agent is available. | `#<n> has no row in History`; `#<n> already has a visual; use Open visual`; `the tab #<n> visual is still open`; `a Make visual press of #<n> is in flight`; otherwise the agent cause. |
| `POST /api/shell` | The issue has a card of its own, with no session. Its row is `dirty`. Its `path` is a lane worktree of the main checkout. | `#<n> has no dirty worktree` |

`POST /api/queue` accepts exactly `{"action": <QueueAction>, "agent": "claude" | "codex"}`
for Add and exactly `{"action": <QueueAction>}` otherwise. The shared engine validator enforces
the continuous-queue contract. Host, Origin, JSON, and the 1024-byte body limit stay in force.

The fixed adapter reads the installed Program and invokes its entry with Bun and isolation flags
for finite admission, bounded to 30 seconds. It parses the receipt as external input. The HTTP
response is the persisted QueueView; it does not await History or terminal creation. Only a newly
issued wake schedules a hidden runner with this fixed argv ("The terminal calls"):

```text
<command> --agent <host> celetis-flow --queue run <id> <token> --quiet
```

The browser supplies no executable or path.
A known failure before command dispatch invalidates only the matching unclaimed token and saves
recovery. An uncertain dispatch keeps pending intent and never launches it again automatically.
The runner performs token and live-ownership checks after terminal creation.

Run on the current paused issue uses Continue with the saved host and fresh displayed step.
An explicit conflicting host refuses. Waiting edits remain available during runs and stops.
The current runner never transfers explicit authorization to another issue.

`GET /api/queue` reads authoritative state without a full-board refresh. After a stale or lost
response, the browser reads state before another deliberate attempt. It merges acknowledged
and polled queue revisions and keeps the last good list on a failed read. Pending admission,
saved/starting, and verified running are separate states. Only existing session observations
prove running. The existing refresh carries a server-only `Document.queueWake` once; placement
never exposes or redispatches it. No second remote poller is added.

An Assist body must be an object with exactly one field, `number`. An extra field, including
`agent`, a prompt, or execution text, gives 400. The number must be a positive safe integer,
as a number or a digit string. Assist accepts every resolver reason whose card is `blocked`.
It opens assistance for the human action; it starts no workflow step. A 200 response means the
tab opened, not that the host resolved the block. A later CLI refusal can remain in that tab.

A Make visual body must be an object with exactly one field, `number`. An extra field, including
`sha` or `agent`, gives 400 with `making a visual takes only the issue number`. The number follows
the rule of Assist. The server takes the full commit hash only from the History row of that number
in the last good read. It makes no fresh read and checks no `noRun`. It checks in this order: the
press in flight, the row, the terminal list, the page, the tab, the agent, and the program. A
failed `hc ls` gives 502. Each Make visual press marks its number in the board process until it
ends, so a second press of that number gets 409. This mark is separate from the Run, Resume, and
Assist reservation. The tab check needs no state of the board, so it also holds after a start of
the server. A 200 response means that the tab opened, not that the page exists. A later refusal
of the command, for example a commit that is not on the remote trunk, stays in that tab.

These checks of Run, Resume, Assist, and Make visual also refuse with 409 before any terminal starts.
Read-only `hc` calls can precede the failure:

- **The program.** No installed program gives
  `the celetis program is not installed; run the first install of README.md, "First install"`. A
  read that fails gives the first line of its error, for example
  `celetis: <path> is not a file of the celetis program; move it away, then run the install again`
  or `celetis: CELETIS_HOME must be an absolute path: <value>`. A command path with a control
  character gives `the celetis program path has a control character`.
- **The saved session of Resume.** Resume refuses a missing or invalid saved record, or a record
  with no verified session ID, with the first line of its error.
- **The agent of Run, Assist, or Make visual.** An independent Run uses the choice, else `defaultAgent`.
  A queue continuation uses its saved host and refuses an explicit conflicting choice. Assist uses only
  `defaultAgent` from its fresh read. Make visual uses only `defaultAgent` of the last good read. The agent must be a name of lowercase
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
| 400 | The body is not JSON, the body has more than 1024 bytes, the issue number is not a positive safe integer in digits, the `effort` of Run is not one of the five levels, the queue request is invalid, or the body of Assist or Make visual is not an object or has an unexpected field. |
| 403 | The `Host`, the `Origin`, or the content type is not good, or the `Origin` is `null` ("The trust boundary"). |
| 404 | The path is not a path of the board, a `/visual/` path names no page, or Go names an id that is no session of the repository. |
| 409 | A condition of the table does not hold, the queue request is stale or unavailable, the read of the program fails, the fresh issue read of Assist fails, Resume has no valid saved session, the agent of Run, Assist, or Make visual is not good, the commit of Make visual is not 40 lowercase hex digits, or the request tries to change the default agent. |
| 502 | At Run or Resume, `hc` or `herdr-app` is not on the `PATH` of the board, or the hc server or the Herdr app does not answer: the line of that check. An `hc` or `herdr-app` call failed, also the terminal list of Make visual: the first line of its error. `hc gave no list of terminals`, `herdr gave no list of spaces`, `hc gave no terminal id`, and `herdr gave no terminal for the new space` are the lines for an answer with no list or with no safe id. |
| 500 | The server failed for another cause: the first line of the error, or `the server failed`. |

The update API is independent of issue and terminal reads. Each success returns
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

A Run press starts the runner of the `celetis` program in a hidden terminal of herdr-core. Twelve rules
hold for the server and the page:

1. The server listens on `127.0.0.1` only.
2. It refuses, with 403, a request whose `Host` is not `127.0.0.1:<port>` or `localhost:<port>`.
3. It refuses, with 403, a POST whose `Origin` is not `http://` and that `Host`, or whose content
   type is not `application/json`.
4. It refuses, with 403, each request whose `Origin` is `null`, on every path and method, before
   it reads a file or data. The board page never sends that value; a sandboxed page or a `file://`
   page sends it on a cors request and on a POST.
5. It accepts only digits, as a number or a string, as the number of an issue, only the terminal
   id of a session of the repository ("The cards") as the id of a session, and only `low`,
   `medium`, `high`, `xhigh`, or `max` as the effort level of a Run.
6. The page sends an issue number, a session id, a selected Run agent, a selected Run effort level, a strict queue action, or an opaque update offer
   ID, never a command or an installation path.
   New intake sends only an empty object. Resume, Assist, and Make visual take only the issue number. A default-agent request changes no configuration.
7. An id of an answer of `hc` or `herdr-app` (a terminal, a space, a tab) goes into a command only
   when it has letters, digits, `_`, `:`, `.`, and `-`, and does not start with `-` (`isSafeId` of
   `engine/lib/terminal.ts`). An id that is absent goes into no command.
8. The server starts `hc`, `herdr-app`, and `git` with no shell, and the issue read starts `gh`,
   `git`, and, on macOS and Linux, `ps` with no shell.
9. For issue and session data, it runs `git` only in the main checkout or in a lane worktree.
   The `git diff` of a session runs with `--no-optional-locks`, so it writes nothing. Update
   workers also validate the native plugin and program installations.
10. Open shell refuses a path that is not under `.claude/worktrees/` of the main checkout.
11. The server writes nothing in a product working tree. An approved update changes only the
    validated native plugin and program installations.
12. The page writes each text of the data, of a terminal screen, and of an error as text, never as HTML. Its
    Content-Security-Policy allows its own files (the page, its six scripts, its stylesheet, and
    its two fonts) and `data:` images (the tab icon) only. A visual page at `/visual/<sha>` is
    model-written HTML. The server sends it only when `<sha>` is 40 lowercase hex digits and
    `docs/superpowers/visuals/<sha>.html` of the main checkout is a regular file, not a symbolic
    link. Its response has `Content-Security-Policy: sandbox allow-scripts allow-popups
    allow-popups-to-escape-sandbox` and `X-Content-Type-Options: nosniff`, with no
    `allow-same-origin`. So the page has an opaque origin, and it cannot read a board response.
    Its cors requests and its POSTs have `Origin: null` and get 403 (rule 4). A navigation, a
    popup, and a no-cors GET (an image or a script) have no `Origin` and get the normal answer,
    which the page cannot read. No GET of the board is a press. A `GET /api/board` can start the
    full read of the data, which the timer of the server also starts. That read can update the
    queue record and start a queue wake that is due. ADR-0065 records this route.

Five rules hold for the start, the argvs, and the data:

1. **Each press reads the program.** Each press reads the installed `celetis` program. The read
   accepts only the own entry of the program in `<base>/.local/bin/`, which starts the program in
   its version folder, and the command path holds no control character. The page, the data, and a
   lane cannot supply a command path.
2. **A press starts a fixed argv.** Run, Resume, and queue wakes start the runner of the installed
   `celetis` program; New intake, Assist, and Make visual start their interactive commands ("The
   argv of a press"). On macOS and Linux, the login shell of the new terminal gets the argv as
   `"$@"`, so it reads no item as shell text. That program starts the first `bun` on the `PATH` of
   that login shell, through its `env -S` shebang, or through its shim on Windows. New intake,
   Assist, and Make visual start the selected native host. The server starts `hc`, `herdr-app`,
   and `git`, and the issue read starts `gh`, `git`, and, on macOS and Linux, `ps`. Update workers have the separate fixed update
   protocol above.
3. **Only validated values go into an argv.** The number is the digits of the issue. The agent of
   Run, Assist, or Make visual is a name of lowercase letters that `agents` of the document has. The effort level
   of Run is one of the five levels, and the adapter puts it after the number as `--effort` and the
   level. Assist gets
   that agent from its fresh read. The commit of Make visual is the full hash of the History row of
   that number in the last good read, and the adapter refuses a value that is not 40 lowercase hex
   digits. The page never sends it. New intake takes `claude` or `codex` from fresh main configuration
   and environment resolution. Resume takes no agent. Queue fields pass the shared exact-shape validator; its step is an engine-defined
   value, its ID is a UUID, its revision and issue numbers are positive safe integers, and its
   host is `claude` or `codex`. No title, reason, act, or data path goes into an argv. The label
   of a hidden runner holds only the digits of the issue or the word `queue`, one argument of
   `hc`, with no shell.
4. **The data comes from the engine, in the process of the board.** No other program gives the
   document. The lane keys and the step names come from the workflow definition of the engine,
   and the states come from the typed rows of the resolver and from the locks and the record of
   the runner. The page writes each text as text (rule 12), and the Content-Security-Policy stops
   a `javascript:` URL in the page.
5. **The start runs in the main checkout only, with a clean `PATH`.** The entry refuses a start in
   another checkout, and it removes each `node_modules/.bin` item from `PATH`, so a planted `git`,
   `gh`, `hc`, or `herdr-app` in such a folder does not run. "Start" gives the reason.

A Run press starts the runner in the repository of the board, and the runner follows the
`.celetis.yaml` of its main checkout. Do not start the board in a repository that you do not trust.

## The layout, the keys, and the errors

**The layout.** The page holds nothing of one repository: it uses neutral colours, follows the light
or dark theme of the OS, and shows the folder name of the main checkout in the header. It carries
its two fonts, Geist and Geist Mono, in `<plugin>/engine/board/fonts/` with their licence (`OFL.txt`, the
SIL Open Font License 1.1), so it loads nothing from the network.

- The header holds the folder name, the switch between Now and Pipeline, the count of each column
  and of landed issues, New intake, Search, Queue, History, and Refresh. The title of the browser tab is
  `(<n>) <folder> · Agent board` while `<n>` cards need you, and the tab icon has an orange dot
  then; it has a blue dot while an agent of an issue works and nothing needs you.
- New intake stays in the header in Now, Pipeline, and Queue, with its label visible on phones.
  Search becomes compact below 1600 px. During a request it reads `Opening…`, announces progress,
  and rejects further activation without moving keyboard focus. A known unavailable host shows
  its reason beside the unavailable control and in its title. Only a successful issue snapshot
  no more than 60 seconds old can disable the control for host availability; missing, failed,
  or older data permits a fresh endpoint check. Polls and the clock update this state even when
  cards do not change. Reconnect prevents launches until the board connects again.
- A successful intake request announces `Intake tab opened`. A rejected request shows
  `New intake failed` with the server cause. A server failure or lost response also states:
  `The launch outcome is unknown. Check Human sessions or herdr before pressing New intake again.`
  No launch retries automatically. The button becomes available for deliberate recovery, and
  completion never takes focus back from another control.
- The status bar keeps the Celetis update control after the agent selector, including on phones
  and while its nonmodal dialog is open. The same button shows **Check for updates**, **Checking…**,
  **Up to date**, **Update available**, **Update check failed**, **Update in progress**, or
  **Update needs attention**. The footer can wrap; its controls remain below the dialog. Checks
  keep the cards and other controls usable. Closing the dialog returns focus under the existing
  focus rules; a background close does not take focus from other board work.
- Human sessions is a strip between the header and the columns, in Now and in Pipeline. Each human
  session is one item: the agent mark, the title, the state with its age, and
  Go. A session with an empty title shows `A session` on its item and as the title of its details.
  A press on an item opens its details. The strip is hidden while no human session runs. A human
  session needs you only while its host reports `blocked`: then its item is orange, and
  the `need you` count in the header, the title of the browser tab, the dot of the tab icon, and
  Notify count it. A press on the `need you` count focuses that item first. The column Needs you
  and its count hold only issue work, so the header can count more than the column, and an empty
  Needs you reads `No issue needs you`. `turn ended` and `works` need nothing from you.
- Now shows the three columns. Needs you groups its cards by reason, in this order: Waits for your
  answer, Stuck (no progress, a dirty tree), Your input on the issue (the `blocked` cards), and
  Ready to run. The first two groups show full cards, and the last two show one row for each card,
  as Idle does. The label of a group stays in view while the column scrolls. When cards are below
  the fold, a line at the foot of the column names them, for example
  `3 more below: 1 input on the issue, 2 ready to run`; a press scrolls to the first of them.
- Queue preserves the saved Now/Pipeline choice. Current work appears above Up next. The picker
  sits beside waiting work on desktop and below it on a phone. Add persists immediately and starts
  an empty queue. Only waiting rows expose Up, Down, and Remove, including during runs and stops.
- The count includes current and waiting work only. Finished rows leave with the same update.
  Continue authorizes one displayed step; Try again recovers a permitted stop. The host stays
  fixed while nonempty. Accepted order survives reload and board restart, without a batch reset.
- Queue keeps pending admission, saved/starting, and verified running distinct. A stale press
  reads authoritative state and requires another press. Status uses the polite announcement region.
  Focus returns to a queue control only when that control owned focus; unrelated work keeps focus.
  The hidden board's card shortcuts do nothing while Queue is open.

- A card shows the type, the number, the title, the lane track, the state with its age, and its
  buttons. A working card shows the lines that it changed. A card whose row has `pr` shows the
  number, the CI result, and the review state. An act line that is a command or a path has a Copy
  button. The mark at the left of a session card identifies its host. Codex and Claude Code use
  the selected [agent icons](agent-icons.md); other hosts use their initial letter. The same marks
  appear in Human sessions and details. An issue card shows the icon of its type. The lane
  keys `bug`, `feature`, `chore`, and `hotfix` have an icon of their own, and a lane with another
  key gets the neutral icon. The main button of a card in Needs you is filled.
- A card in one row (Idle, the last two groups of Needs you, and Pipeline) has its title beside its
  buttons, and under both the number, the type, and the state. The title shows at most two lines,
  and a narrow card hides the type. The step name, the effort chip, and `auto` of a `ready` card stay
  whole; a card with no room for them in one line wraps them to a second line.
- The chevron beside Run opens the run menu: Run with each agent. On a `ready` card, a rule and
  `Run at low`, `Run at medium`, `Run at high`, `Run at xhigh`, and `Run at max` follow. The current
  level has a check mark and the suffix `(decided by <by>)` or `(default)`; the title of another level is
  `Start the <step> step at <level>, this start only`. With a `noRun` text, each level entry is
  disabled with that text; on the current issue of a queue paused at a `me` gate, with
  `The queue starts this step at the decided level`; else with the cause that disables Run. The `m`
  menu of the card lists the same entries after its actions. Search and the actions of the details
  have no level entries.
- The lane track at the right of a card shows where the issue is in its lane. The current step has
  the colour of the state, and it moves while an agent works.
- A press on a card, or `Space`, opens its details in place of Idle: for a session, the last 16
  lines of its terminal screen (with no empty line, rule, or box border), so you can read the dialog or the end
  of the answer; the lane steps, with `auto` on a step whose gate is `auto`; the pull request, the
  folder, and the lines changed; for a `ready` card, `Effort` (`<level> · decided by <by>` or
  `<level> · default`) and `Why` before `Updated`. `Why` is the reason of the decision, wrapped,
  `No reason given.` for a decision with no reason, or
  `No decision on the issue; the default applies.` for the default. A waiting session shows its
  lines at the top, beside Go, except a human session whose turn ended. `Esc` closes the details.
  Below 1100 px the details cover the right side of the page, and below 720 px the whole page.
- A card that changed since you last looked at the board has a dot, until you point at it or focus
  it. The board takes the cards as seen when its window loses the focus.
- The status bar shows when the board last read the data, with the name of the tracker (`Issues`
  before the first good read), whether herdr-core answers (the item `herdr`), and whether the
  automatic runner runs. It shows
  the keys of the focused card, the landed-issue count (a press opens History), the Notify switch,
  and the list of keys.
- Notify: the first press asks the browser for permission. Then each card that enters Needs you
  shows a system notification while the board is not in front: `#<n> waits for your answer`,
  `#<n> ended its turn`, `#<n> made no progress`, `#<n> has a dirty worktree`, `#<n> <reason>` for a
  `blocked` card, and `#<n> is ready to run <step>`, with the title of the issue. A human session
  that starts to wait for your answer shows `Human session "<label>" waits for your answer`, or
  `A human session waits for your answer` when its title is empty. A press on the
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
finds a human session whose title is `<n>`. `j` and `k` move to the next or the previous card,
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
  `Open shell failed`, `Refresh failed`, `Queue action failed`, `Make visual failed`) above the line of the server. After Go, Open shell, or
  Refresh, the card keeps its button. A failed Run, Resume, or Open agent ends its `Starting` card
  and permits a retry after the next read. This covers a herdr-core server or a Herdr app that does
  not run, an `hc` or a `herdr-app` that is not on `PATH`, and a press that the server refuses.
- The status bar shows `herdr down` when `hc ls` fails, with the error in its title.
  The board then shows no session card, and the issue cards stay.
- The status bar shows `cannot read:` with one line when the last read of the issues failed ("The
  data"). The cards of the last good read stay.
- The status bar shows `The board server does not answer` when a request of the page failed. A
  press at that time gives a toast with that text and `Start the board again in a terminal.`
- Queue disables execution controls during a request or an unavailable authoritative read. A failed
  press retains the accepted queue and shows the server reason. Recovery controls
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
  `bun`, `gh`, `hc`, and `herdr-app` on the `PATH` of that program. This is not checked. When such
  a start fails, start the board in a terminal.
- Issue reads check no plugin update policy. A conflict can show in the independent update
  check, or in the tab of the next New intake or Assist. The hidden runner of a Run or Resume
  shows it nowhere.

Of the sessions, herdr-core, and the Herdr app:

- A session outside herdr-core, for example in a desktop app or in another terminal program, has
  no card.
- An agent in a subfolder of the main checkout has no card, although the board starts in such a
  folder. The issue of its link label then keeps a card of its own, with Run.
- The state comes only from the status that the host reports (OSC 7501). A host that reports no
  status, for example Claude Code before 2.1.295, has no card. The card does not show the kind of a
  `blocked` status (`permission`, `question`, or `auth`).
- The card of a waiting session does not say what the agent asks: the details show the lines of its
  terminal screen. The board does not read the private files of an agent.
- The time of a session state starts when the server first sees that state. The server sees nothing
  while no page asks, and a start of the server starts each time again.
- A tab that you rename by hand links no session: only the link label `celetis.link` of its
  terminal links a session to an issue. The new name shows only as the title of a session with no
  link label.
- The board needs a herdr-core server that runs and an open Herdr app window. When `herdr-app ls`
  fails, a press of New intake, Run, Resume, Assist, Make visual, or Open shell gives a toast and
  starts no terminal. When `hc ls` fails, the status bar shows `herdr down`.
- A Go press focuses the pane of the session in the Herdr app (`pane.focus`). The board makes no
  call that brings the window to the front.
- The API of herdr-core and the commands of the Herdr app are previews (version 0.x). The board
  uses herdr-core 0.1.16 and the Herdr app 0.1.11; a later 0.x release can break it.
- Two repositories whose main checkout has the same folder name share one space of the Herdr app.
- The tab of a new terminal can show up to about 3 seconds after its start. The board waits 5
  seconds for it; after that time, the tab keeps the name that the Herdr app gives it.
- On macOS and Linux, the login shell is `$SHELL`, else `/bin/sh`. It must read the POSIX start
  forms `exec "$@"` and `"$@" || exec "$0" -li`; a `$SHELL` such as fish cannot read them, and the
  argv does not start.
- A hidden runner shows its lines nowhere, and herdr-core removes its terminal when it exits
  (`hc run --rm`). So a runner of a Run, Resume, or queue wake that stops before a session starts,
  for example at a `stop` line or at an error, leaves no message: start
  `celetis --agent <host> celetis-flow <n>` in a terminal to see it.
- On macOS and Linux, a New intake, Assist, or Make visual program that exits 0 closes its tab
  (`hc run --rm`).
  The first press that makes the space of the repository starts its argv through the start form
  of the Herdr app, `"$@"; exec "$0" -li`, so that one tab keeps a shell after its program ends.
- On Windows, `hc run` gets the argv with no shell, and the first item is `celetis.cmd`. Such a
  start, its tab, and the card of its session are not checked.
- A `#<n> visual` tab whose command fails keeps its message and a shell, and its History row shows
  **Making…** until you close the tab.
- A `#<n> visual` session of an issue that is still open takes the place of the card of that issue
  while it runs, because the state of a session wins ("The cards").

Of the cards and the page:

- The board does not show the `step` of a `blocked` row: such a card is in Not in a step of Pipeline
  and has no lane track.
- Before the first good read, Pipeline has no stage column: the strip Not in a step holds each
  session of an issue.
- Separate board server processes share no start reservation. Their concurrent presses can start
  two runners for one issue; the issue lock lets only one of them start a session. Two Make visual
  presses of one number in two board processes can open two tabs before either tab shows.
- A start of the server forgets the times of the Run, Resume, and Assist presses.
- The count of changed lines is against `origin/HEAD`. A clone with no `origin/HEAD` shows no count.
- A notification shows only while the page is open in a tab. A browser that throttles a hidden tab
  can delay it by up to a minute.
- The page has no login. Each program on the machine can ask the server.
- A visual page at `/visual/<sha>` has no `localStorage` under its sandbox: an access throws
  `SecurityError`, so a page script that needs storage can break.
- The lane icons are the one place where the page knows four names of a flow. They change no rule.
