# The board

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
- **Gate:** the rule of a step that says who starts it. `me` is your press of Run, and `auto` is auto
  mode of the daemon. The board shows `auto` on such a step, and it starts no step by itself.
- **Daemon:** `engine/daemon.ts` of the engine. Its runs start the sessions of the steps and know how
  each one ended. Auto mode of the daemon starts each step with the gate `auto` by itself. The states
  `starting` and `stuck` come from the locks and the record of the daemon. The daemon serves the
  board in its own process, and the field `daemon` comes from its status (the item `Daemon`).
- **Trunk:** the default branch of the repository. The count of the changed lines of a session is
  against it (`origin/HEAD`). The board takes the main checkout as the checkout of the trunk: its
  files have the trust of the trunk, and the branch of an issue is in a lane worktree.

The board has two inputs:

- **The sessions** come from herdr-core (`hc`), which keeps the terminals in which the agents run.
  The Herdr app shows these terminals as tabs. A repository sets nothing for them.
- **The issues** come from one typed document that the board reads in the process of the daemon,
  with the resolver and the locks of the engine ("The data"). The page and the placement of the cards take
  the lanes, the steps, the stages, the reasons, and the tracker name from that document, and they
  hold none of their own.

The board is the folder `engine/board/` of the engine, and the
master daemon of the repository serves it in its own process (`celetis daemon start`). It is Bun
code with no dependency of its own.
The engine carries generated browser JavaScript. A product repository needs no build or install step.
It runs from the installed `celetis` engine, so the repository that it shows needs no file of the
board.

The board came from commit `95144d3` of its old repository
([ADR-0020](../../docs/adr/0020-the-board-is-a-part-of-the-plugin.md) of the plugin `celetis`).
[ADR-0035](../../docs/adr/0035-the-board-is-a-part-of-the-engine.md) of the plugin `celetis` gives
the reasons why it reads its data in its own process and starts fixed commands.
[ADR-0058](../../docs/adr/0058-herdr-core-hosts-the-agent-terminals.md) of the plugin `celetis`
gives the reasons why its sessions come from herdr-core and its tabs from the Herdr app.

**Requirements.**

- macOS or Linux. The master daemon refuses Windows, so no board runs there
  ([The master daemon](../README.md#the-master-daemon)).
- Bun 1.4.4 or later. The entry exits 3 on an older Bun.
- git 2.31 or later.
- The installed `celetis` engine for New intake, Run, Resume, Assist, Make visual, and queue actions (the README of the plugin, "First install").
- herdr-core 0.1.16, with `hc` on `PATH` and its server that runs, for the session cards and for
  each button.
- The Herdr app 0.1.11, with `herdr-app` on `PATH` and its window open, for New intake, Run,
  Resume, Assist, Make visual, Open shell, and Go.
- `gh` on `PATH`, logged in, for the issue data. The board needs no GitHub credentials of its own.
  The read also needs `ps` on macOS and Linux.
- The lane worktree of the issue `<n>` at `<main>/.claude/worktrees/<n>-<slug>`, where `<main>` is
  the main checkout. This layout has no setting: an agent in a worktree at another place has no
  card.
- A Chromium browser. The page is checked in Chromium browsers only.

The master daemon serves the board, so the requirements of the daemon apply to it
([Requirements](../README.md#requirements), [The master daemon](../README.md#the-master-daemon)).

## Start

Run `celetis daemon start` in a checkout of the repository, and open the URL of its line
`daemon: board http://127.0.0.1:<port>`. `celetis daemon status` prints that line again. With no
daemon, nothing serves the board.

[The master daemon](../README.md#the-master-daemon), "The start", gives the order of the start
and the refusal of the requests of the board before the takeover. The board start
checks no update policy: each run checks the policy of its own host before it starts a session.
The board records the engine revision of the daemon and starts an independent update check after
it listens. At each New intake, Assist, or Make visual, the fixed adapter (`adapter.ts`) reads the
installed `celetis` engine and gives its argv ("The argv of a press").

**The port** starts at `board.port` of the main `.celetis.yaml`, or 4403. With no effective
`PORT` in the environment of the daemon, the board binds consecutive ports on `127.0.0.1` through
65535 and keeps the first successful listener. Only `EADDRINUSE` advances the search. A free lower
port is not considered. Exhaustion stops the start of the daemon with exit 6 and names the range in
the daemon log. Concurrent starts claim their ports with the actual listeners; there is no
separate probe or reservation. The stop of the daemon closes the listener, and the port stays fixed until then. A successor after a
restart ("Open work during updates") gets the actual port of the old daemon in `PORT`: it tries
that port first, and when it is in use, it searches from `board.port` as above.

A nonzero `Number(PORT)` requests that exact port and disables the search. Zero or NaN,
including an empty or nonnumeric string, means no override. An occupied exact port stops the start
of the daemon with the existing port-in-use error. Invalid effective values keep Bun's existing
failure, and other bind errors stop the start. Use an exact port when the origin must stay fixed:

```bash
PORT=4404 celetis daemon start
```

The daemon keeps that `PORT` for its board only, so no run or landing gets it.

**The start writes** the main checkout and the actual URL once to the daemon log, with the tag
`daemon`, after a successful bind. Failed candidates write no success lines. The URL of
`daemon start` and `daemon status` is authoritative.

**A start that fails** stops the daemon before its takeover: it releases its lock `daemon`, and
`daemon start` prints a line with the exit code of the daemon and the path of its log, and exits 6.
The daemon log has the cause:

| Case | Cause in the daemon log | Exit of the daemon |
|---|---|---|
| The main `.celetis.yaml` cannot be read or has an error | the diagnostic of the config reader, with the file and the field | 2 |
| The exact `PORT` of a start is in use (a successor searches instead) | a line that says the board cannot listen on that port because it is in use | 6 |
| Every automatic candidate is occupied | a line that says the board cannot listen on the range from the start port through 65535 because all its ports are in use | 6 |
| The server cannot listen for another cause, for example `PORT=99999` | a line that says the board cannot listen on that port, with the message of Bun | 6 |

[The master daemon](../README.md#the-master-daemon) gives each other refusal of
`daemon start` and of the start of the daemon.

**The board runs in the main checkout only.** A `node_modules/.bin` folder of the start folder or
of its parent folders can be on `PATH`. In the main checkout, those are files of the trunk. A lane
worktree holds the files of a branch, which do not have the trust of the trunk. `daemon start`
starts the daemon in the main checkout from each checkout of the repository, and it removes each
`node_modules/.bin` item from the `PATH` of the daemon, so the board starts `git`, `gh`, `hc`, or
`herdr-app` with no such item.

**Open work during updates.** The status bar keeps one update control after the agent order.
**Check for updates** starts discovery in one press. **Checking…** retains focus and ignores
another press. **Up to date** reports that the installed engine and registered plugins match
the configured target of each part; it does not mean that an open agent session has reloaded new code.
**Restart needed** (below) shows a daemon that runs another engine than the installed one. Press
**Up to date** for a fresh check. Progress and results use the polite status region,
without a success toast or current-result dialog. A check does not refresh issues or approve
installation. Only the separate **Update and restart** decision approves an offer.

The daemon checks at its start and every 10 minutes, in a worker child process. Concurrent
checks share one worker, with a 120-second limit. These checks do not wait for issue or terminal
reads. A direct board decision approves one exact offer for one attempt. The browser sends only
the offer ID; the controller keeps its complete identity. A stale offer, conflict, or failure needs
a new check and decision. The native update locks and validation also apply to this path.

The nonmodal update dialog sits at the bottom right and keeps the board usable. It shows each
installed revision and the target of the engine. **Later** or Escape defers that exact offer in this
tab; **Update available** opens it again. A different offer opens a new dialog.
**Hide progress** hides the dialog without cancelling the update. **Update in progress** opens
it again. These choices survive a page reload in tab storage when the browser permits storage.
A background check failure shows a quiet **Update check failed** control. Open it for the error
and **Check again**. A failed update shows the completed and incomplete components and requires
**Check again** before another attempt. After an approved update of a daemon that runs from a
checkout, the control and the dialog show **Update completed**: the update completed, and that
daemon does not restart; **Close** closes the dialog. **Update needs attention** opens that
recovery dialog or the reconnect-timeout instructions. A refused check request or unreadable status also shows
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
recovery line: it tells the person to run `celetis daemon status` from the main checkout, and
`celetis daemon start` when no daemon runs. **Check again** clears the pending
start and requests a fresh check and decision. The update may have completed; the page makes no
installation retry.

After a successful board-approved update, the daemon that serves the board restarts on the
approved installed engine. It drains the start response, then validates the installed target:
the link of the installed engine names the target, and the revision, source, and clean state of
its folder are those of the target. A failed validation leaves the daemon running, and the dialog
shows the failed update with the line of the validation. Else the daemon prints a line with the
first 12 characters of the target revision, stops as `celetis daemon stop` does, and starts one
successor process of the installed engine, which takes over the runs
([The master daemon](../README.md#the-master-daemon), "The restart"). The sessions stay in their tabs, and the
page reconnects at the same URL. A stop of the daemon (`celetis daemon stop` or a signal) during
the restart cancels the successor, so no daemon runs, and the page then shows the timeout. A daemon that runs from a checkout does not restart: the update
completes, and the dialog shows **Update completed**. A failed start of the successor prints its
line to the daemon log, and the page then shows the timeout with the recovery line. It makes no
retry.

Follow [Updates](../../plugins/celetis/README.md#updates) for a terminal-started update and its affirmative
terminal response. Discovery releases its short read lock before foreground execution.
Only updaters serialize on the update mutex; sessions and daemons may stay open.

**Restart needed.** A daemon that runs from a version folder of the installed engine reads the
installed engine at most once each 5 seconds. When the installed revision differs from the
revision of the daemon, and the last check result is **Up to date** or a failed check, the control
shows **Restart needed** within 10 seconds. A failed read keeps the last state. An update offer takes precedence,
because its update restarts the daemon too. A failed update keeps its state until **Check again**.
The dialog opens by itself one time for each installed revision in the tab, with no focus move. It
shows the revision of the daemon and the installed revision. **Later** or Escape closes the dialog
and keeps **Restart needed** on the control; nothing restarts the daemon before a click. A click on
**Restart** shows **Restarting…** at once and sends one restart request. The daemon validates the
installed engine as for an approved update. It answers with the revision that the new daemon
runs, then it restarts as above. The page waits for that revision of the answer, not for the
revision that it showed. It reloads once when that revision answers from a new runtime instance
at the same URL. After 60 seconds it shows **Restart needs attention**, a line that says the
daemon did not return, and the recovery line. A refused restart shows **Restart needs attention**, a
line that says the daemon did not restart, and the line of the refusal; the daemon keeps running, and **Check again** comes
before a new attempt. The page never sends a restart again by itself. A daemon that runs from a
checkout never shows **Restart needed**, and it refuses the restart request: a click never
replaces a checkout daemon with the installed engine. The terminal restart (`celetis daemon
stop`, then `celetis daemon start`) stays available.

The server reads page files on later requests. It runs the server code and the code of the issue
read that it loaded at its start. Native replacement can remove resources that open work still
needs, so a person may reload or restart affected work. Each Assist, Make visual, and New intake
press reads the installed engine again. After `celetis update`, the next such
press starts the command of the new engine with no restart. A Run, Resume, Retry, or queue
action goes to the daemon, which runs the engine of the board too, so a press never meets a
daemon of another revision. A fresh
session loads changed skills; an open session does not reload them automatically. A change of
`board.port` also needs a restart of the daemon. A change of `gates` in the main `.celetis.yaml`
shows at the next read ("The data").

**Three values have no setting:**

- A lane worktree is `<main>/.claude/worktrees/<n>-<slug>`.
- The name of the space of the Herdr app is the folder name of the main checkout.
- The changed lines of a session come from
  `git --no-optional-locks -C <folder> diff --shortstat --merge-base origin/HEAD`.

## The data

The board reads its issue data in the process of the daemon (`engine/lib/board-read.ts`). Each read
creates a fresh operation of the main checkout with no host selection, so the `CELETIS_AGENT` of the
daemon selects no host. So each read validates the main `.celetis.yaml` again, and it takes `gates`
from it. The read then gets the typed rows of the resolver (`nextBoard` of
`engine/lib/resolver.ts`). The resolver gives each row its whole state, `starting` and `stuck`
included, and reads for it the issue locks and the record of the daemon (`engine/lib/locks.ts`,
which the daemon also uses). It builds one typed document (`Document` of
`engine/lib/board-read-types.ts`) with the rows as `issues` and `noRun` of the resolver, and it adds
`tracker`, `agents`, `flow`, `history`, and `queue`. Each `GET /api/board` also reads the local
agent order, the usage records, and the usage-limit recovery records again (`readAgentState` of
`engine/lib/board-read.ts`), and its reply adds `picker` (the order, the usage blocks, the hosts of
live sessions, the live usage-limit waits, and a read error) and `next` (the decision of a new
default start). Each placement also reads the status object of the daemon once through the adapter,
in the process, and the reply adds `daemon`: `{pid, auto}`, with the PID of the daemon and its auto
mode (`on`, `off`, or `stopping`). These reads do not wait for GitHub.
The tables below give the value of each field and the rule that gives each row its state.

A full read collects all open issues and their timelines, and the open PRs and their check and
review results. A selected-issue read fetches each selected issue once and lists open PRs once.
It reads timelines and PR details only for those issues. It also reads once each distinct parent
of the open selected issues that is in the same repository, with `issues/<parent>` and no
timeline; a 404 of that read gives no epic. Both paths use the same row rules.
The selected read replaces or removes only selected rows, sorts by issue number, and retains
other rows. Closed issues, PR objects, and missing issues have no active row. Only an explicit
404 from the initial issue request means missing; another request failure fails the batch.

Each module of the data path is a static import. So a read loads no file of the plugin, takes no
plugin read lock, and checks no update policy. The board start checks no update policy either.
Independent update checks validate the native update policy. Each Run and Resume goes to the
daemon, whose run makes its own check. Assist checks the policy before it starts the native host.

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
| The resolver cannot read GitHub | The first line of the stderr of the resolver, else a line that says the issues cannot be read from GitHub |
| The read does not end in 60 seconds | A line that says the read did not end in 60 seconds |
| Another failure | The first line of its message, else a line that says the read failed |

A selected-read error takes display priority over a full-read error. A good selected read clears
only its own error; a good full read clears both. Selected reads do not change the last-full-read
time or the full-read evidence for the 30-second Assist detection period.

`Document.queue` and `Board.queue` use QueueView. A null record means no saved queue yet.
Queue access, including the first document, selected reads, local placement, and action preflight,
prepares valid schema-1/schema-2 storage through the same revision's finite daemon path.
Preparation holds queue and current-issue execution ownership before the write lock. It keeps
unfinished order and the recorded host, archives exact source bytes, and starts no work.
A live owner causes refusal; the next ordinary request can retry after it exits. Invalid or
unsupported storage remains an error, with no empty-success result or extra refresh loop.
The view carries the schema-3 record, live owner, fresh next decision, error, and Add/Edit/Continue/Retry
permissions. A full read sends the reconcile request `POST /queue/reconcile` to the master
daemon through the adapter. The daemon reconciles terminal members and starts a queue run that
is due, and the queue view of its answer is the queue of the document. The request has a limit of
30 seconds inside the 60 seconds of the read. With a refusal, for example during the takeover of
the start of the daemon, or with no answer in that limit, the read uses the read view
(`readQueueView`) and writes nothing; the next read sends the request again. A selected read sends that request only when a selected issue is in the
current queue. It retains the previous queue view otherwise. Remote row and History reads finish
before this request. Existing live-owner checks and wake authorization still apply in the daemon.
Each placement reads local storage and ownership, requests the existing refresh after changes,
and disables recovery until the current decision is fresh. A failed full read disables queue
actions until a full read succeeds. A selected-read error alone does not disable them; all
queue-specific restrictions still apply. Failed reads preserve the last good list.

The board puts these values in the fields of its document (`Document` of
`engine/lib/board-read-types.ts`):

| Field | Value |
|---|---|
| `tracker` | `GitHub` |
| `flow.lanes` | The four lanes: `feature` (triage, specify, plan, implement), `bug` (triage, bug, plan, implement), `chore` (triage, chore), and `hotfix` (triage, hotfix). |
| `flow.stages` | Triage, Define (specify, bug, chore, hotfix), Plan, and Implement. |
| `flow.steps.<step>.gate` | The gate of each of the seven steps, by the rule of "Gates". |
| `flow.steps.<step>.hint` | A hint that says the step lands the change when the build is done, for `implement`, `chore`, and `hotfix`. No other step has a hint. |
| `noRun` | A text that names the dirty path and tells to commit or stash first, while the main checkout is dirty, else `null`. |
| `daemon` | Read at each response, not in the refresh: `{pid, auto}` of the status object of the daemon that serves the board, with `auto` `on`, `off`, or `stopping`. |
| `agents` | Entries `claude` and `codex`. Each has `available: true` and `cause: null` when its executable is on the `PATH` of the board, else `available: false` and a `cause` that says the agent is not on `PATH`. This checks only executable presence: sign-in, trust, and plugin discovery need their own checks. |
| `history` | The remote trunk name, history URL, captured full head SHA, and up to 20 distinct landed issues. Each entry holds the issue number/title/URL and commit SHA/URL/committer time. |
| `queue` | A `QueueView` with the schema-3 record, live owner, resolver result, error, and Add/Edit/Continue/Retry permissions. A null record means no saved queue yet. |
| `issues` | One row for each open issue. An issue whose line of the resolver is the epic line or the `wontfix` line has no row. |

A row gets its `state` by the first rule that matches:

| # | The issue | `state` | Fields of that state |
|---|---|---|---|
| 2 | has a lock that a live script holds | `starting` | |
| 3 | has a dirty lane worktree | `dirty` | `path`: the lane worktree |
| 4 | has a row in the record for its `run` line: no progress, or a refused skip | `stuck` | `act`: `celetis --agent <host> run resume <n>` |
| 5 | has `needs-info` or `ready-for-human`, two or more lane labels, an open human step, or a hotfix to land by hand | `blocked` | `reason`, from the first match in the order of the resolver (`docs/issue-tracker.md`, "Resolving an issue's state"): `needs info` for `needs-info`; for `ready-for-human`, `landing refused` while a landing refusal is current, else `ready for your step`; `several lane labels` for two or more lane labels; `human step open` for a `## Before landing` comment with no completion evidence; `land by hand` for a hotfix whose stop is cleared. `act`: the act that the `stop` line of the issue names |
| 6 | has a `run` line | `ready` | |

`picker` holds the version of the local order beside `order`. Its `usage` is the confirmed usage
block of each host with its reason and reset time, and it is `null` once the reset time has
passed. Its `waits` holds `{number, waitId, nextResetAt}` for each issue whose live run waits
because every included agent is limited. `next` is `start` with its host, or `wait` with the blocks
and the earliest future reset, from the local order and with no step preference.

Each row also has `number`, `title`, `url`, `updatedAt` and these fields:

- `type`: the lane of the one lane label of the issue: `feature` (the label `enhancement`), `bug`,
  `chore`, or `hotfix`. It is `null` for an issue with no lane label, with two or more lane labels,
  or with `epic`, also in the row of an issue that stops.
- `step`: the step of the Run decision of the issue, the step of its `run` line ("Gates"), else
  `null`.
- `effort`: the effort level of that step, from the read of the resolver (`docs/issue-tracker.md`,
  "What lives on the issue", "Effort"): `level`, and `source` `decided` with `by` (the step before
  in the lane) and `reason`, or `source` `default` with the level `high`. It is `null` for a row
  whose line is not `run`.
- `started`: `true` when the step comes after the define step of its lane (`plan` or `implement`),
  because an earlier step of the lane ran.
- `urgent`: `true` for the type `hotfix`.
- `epic`: `{ number, title }` of the parent issue when the `parent_issue_url` of the issue is the API
  URL of an open issue of the same repository with the label `epic`, else `null`.
- `pr`: the open pull request whose branch name holds `/<n>-`, with its number, URL, draft state, CI
  result (`pass`, `fail`, `pending`, or `null`), and review state (`approved`, `changes`,
  `required`, or `null`); else `null`. The CI result comes from the buckets of `gh pr checks`: `null`
  when the commit has no check run and no status, else `fail` for a `fail` or `cancel` bucket, else
  `pending` for a `pending` bucket, else `pass`. So a `stale` check and a check with an unknown value
  are `pending`. For the review state, the last review of each reviewer that
  approves, requests changes, or is dismissed counts. The review state is `changes` when one of
  those reviews requests changes, else `approved` when one approves, else `required` when a
  requested reviewer or team has not answered, else `null`.

## Landed history

History sits between Search and Refresh. It opens the existing nonmodal panel and closes card
details. Card details close History. The default is closed on each page load; refresh keeps its
open state, scroll, and matching focused link. Escape or Close returns focus to History. The
landed count and the `d` shortcut open the same panel. Search finds landed issue numbers and titles.
History stays visible on a phone. Below 1100 px width or 701 px height the panel is a drawer;
below 720 px width it fills the viewport. Closing it restores the board width.

A full read, or a selected read that finds at least one closed issue, calls `readHistory` of
`engine/lib/board-read.ts` once. Other selected reads retain History. `readHistory` reads the remote
repository metadata and captures the default branch head. It walks
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
- Its foreground process is that host (the file name of its first item, with no `.exe`), Bun
  with the engine's launch arguments and its exact `engine/intake.ts`, `engine/assist.ts`, or
  `engine/visual.ts` entry, or a process with an item of the file name `daemon.ts` while
  the terminal has a link label. In
  a session tab of a run, that process is the start barrier, the leader of the foreground
  process group ([The session tab](../README.md#the-session-tab)). A shell whose host exited has no card, also when Codex left a `done` status in it.

The link label of the terminal, `celetis.link`, links a session to an issue: `#<n> <step>` gives
the issue `<n>` and the step, `#<n>` alone gives the issue only, and another label gives no issue.
The step word counts only when `flow.lanes` of the document names that step. The daemon gives
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
| `idle`, `done`, or `error`: a live daemon checks or closes this turn | Running | `checks step` |
| `idle`, `done`, or `error`: the agent is ready for the next prompt | Needs you | `turn ended` |

Each board request, including a local request, reads the private step-end record of the daemon from
the common Git directory. Its PID, process start, terminal, and host must identify a live daemon.
A retained verdict applies only to the recorded terminal and the hc `turn` of that terminal.
A later turn starts with no retained verdict, even when the board misses its working state.
Missing, invalid, unreadable, or stale evidence keeps the ordinary wait. A dialog always wins.
A resume session has no completion watcher. The daemon keeps an exiting verdict
until the foreground exits, then removes it. This local read adds no GitHub request.
A board-approved update restarts the daemon on the new engine by itself. After a
terminal-started update, restart the daemon to load updated server code.

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

A row whose live run waits because every included agent is limited makes a card in Needs you,
in the group `Paused by usage limits`, with the state `waits for a usage limit`. Its main button,
Agent order, opens the agent order, which has its Retry. A recovery record whose run no longer runs adds a warning
to the card of its row, and Run starts the step again.

- A `ready` card shows `auto` when the `gate` of its step is `auto`.
- A `ready` card shows the effort level of its step, the `effort` of its row, in a chip after
  `next <step>` and before `auto`. The chip is solid for a decision on the issue and dashed for the
  default. Its title and accessible name are `effort <level>, decided by <by>` or
  `effort <level>, default`, where `<by>` is the step before the started step in the lane of the
  issue ("The data").
- On a `ready` card, the accessible name of Run is `Run <step> at <level> (decided by <by>), #<n>` or
  `Run <step> at <level> (default), #<n>`. The title of Run is
  `Start the <step> step at <level>, decided by <by>` or `Start the <step> step at <level>, the default`,
  plus the `hint` of that step.
- Open agent sends no agent choice. It is the main action in Now, Pipeline, details, the card menu,
  and search. Open issue remains secondary, and `o` opens the issue. When the first eligible agent
  of the local order is not available, or every included agent is limited, Open agent is disabled
  with its cause.
- With a `noRun` text, the page shows that text above the columns and permits no Run, Resume, or Assist.
  A card that would have Run or Open agent shows it disabled with that text.
- The lane track of a card is the list of `flow.lanes` for its `type`. A card whose step is not in
  that list has no track.

**The order.** Needs you has the urgent cards first, then the dialogs, then the longest wait first.
Running has the newest first, and Idle has the highest number first. In Idle, and in each Pipeline stage for its Idle cards, the cards of one epic (`epic` of the card) take one group row at the place of their first card; Needs you, Running, and Not in a step never group. History follows remote trunk traversal order.
Human sessions has the order of their titles, with numbers in numeric order, and two sessions
with one title in the order of their terminal ids.

**During a press** of Run, Resume, or Assist, the page moves the card to Running at once. The card shows
`Starting` with a turning status icon while the board sends the request to the master daemon or
opens the tab. It keeps its
step, so Pipeline shows it at that step. Assist keeps a null step and remains in Not in a step.
While the request runs, no control of the page sends a second press for that issue. Run, Resume,
and Assist share one reservation in the server, from before the asynchronous eligibility read. The
reservation of Assist ends when its tab starts or the operation fails. The reservation of Run and
Resume ends at a session of the issue, at a `failed` feedback, or at a refusal. A competing press
from any browser client gets 409.

After the daemon accepts a Run or Resume, the board keeps the run ID of the answer and follows that
run at each placement. After the hc session list and the one daemon read of the placement, the
first case that applies gives the card:

| Case | Card | Reservation |
|---|---|---|
| The hc list has a session of the issue | The session card | Ends |
| The status of the daemon has no row with the run ID | `failed`: a line that names the daemon PID and the first 8 characters of the run ID, and says that the daemon has no such run | Ends |
| The row has a session (`session` is not null) | The feedback clears | Ends |
| The row has an `outcome` | `failed`: its reason, else the last `line` of the run, else a line that names the first 8 characters of the run ID and the exit code of a run that ended before a session. Each outcome counts, also `closed` or `gate` with code 0. | Ends |
| Else | `Starting`, with no warning | Stays |

Each `failed` feedback also selects a read of the issue, so a card whose last read showed the lock
of the run leaves `Starting` at that read. A daemon read that started before the answer does not
count for that press, nor a read that started before the last read that counted. The daemon keeps the
row of each run while it runs, and a new daemon process has no row of an old one, except a run that
it takes over with the same run ID.

A refusal of the daemon is 409 with its line: the page shows `Run failed` or `Resume failed`
above the line, the card ends `Starting`, and no reservation stays. A press has no unknown
outcome: the daemon answers each request of the board in its process, and it gives an error of its
own as a refusal with its line.
A session or a changed issue decision clears visible feedback, but the reservation stays until its
end. A newer explicit press cannot receive an older press's feedback. No automatic launch retry occurs.

Assist keeps its 30-second detection period. When it ends, the next nonlocal request reads the
issues again. Without a session, Assist shows a line that tells you to check the terminal before starting again. A blocked row matches Assist
feedback only with a null step. A session wins at each time: its card shows its state and Go.
The page uses no read that started before the request ended, and an older read never replaces a newer one.
A press that fails ends the `Starting` card at once, and the next read gives the card its buttons.

## The commands of the board

| Press or read | What the server does |
|---|---|
| The data of the issues | The read of "The data", in the process of the daemon, with a limit of 60 seconds. |
| Run | One request `POST /run` of the master daemon ("The requests of Run and Resume"). The daemon opens a quiet session tab `#<n> <step>`. A `Run at <level>` entry sends the level. For the current issue of a queue paused at a `me` gate, use the queue Continue action below. |
| Resume | One request `POST /resume` of the master daemon. The daemon checks the saved session and opens the session tab `#<n> <step>` with the focus. |
| A queue action | One request `POST /queue/action` of the master daemon ("The presses"), for every action. The answer is the persisted QueueView. For a new wake, the daemon starts the queue run in the same request; for each step it opens a quiet session tab `#<n> <step>` with that link label, so the session cards and Go stay. |
| Retry | One request `POST /retry` of the master daemon, with the issue number and the wait ID. It starts no run. |
| New intake | A focused `Intake` tab in the main checkout. The current default host asks for the request, then enters `celetis:intake` with the answer. The button creates no issue and starts no run. |
| Assist | A focused tab `#<n> assist` in the main checkout, with the Assist argv. |
| Make visual | A focused tab `#<n> visual` in the main checkout, with the Make visual argv, for a History row with no page. The command in the tab makes the page `docs/superpowers/visuals/<sha>.html` of the main checkout. |
| Open shell | A focused tab `#<n> shell` in the `path` of a `dirty` row, with no argv: herdr-core starts the shell of the machine. |
| Go | `herdr-app do pane.focus --terminal <id>`; then change to the Herdr app window. |

**The requests of Run and Resume.** The fixed adapter gives each press as one request to the
dispatcher of the master daemon that serves the board, in the same process, with only these fixed
fields. The dispatcher runs the parser and the answers of a socket request
([The master daemon](../README.md#the-master-daemon), "The requests"), and the adapter parses the answer
(`parseAnswer`):

```text
POST /run {"number":<n>,"selection":<selection>,"effort":<level>|null,"quiet":true}
POST /resume {"number":<n>,"selection":{}}
```

The selection is `{"explicit":"<host>"}` for an explicit agent choice of Run, else `{}`. The
board sends no `environment`, so the `CELETIS_AGENT` of the daemon selects no host. A `Run at
<level>` entry sends the level as `effort`. `quiet` opens each session tab in the background. The
daemon selects the saved session of Resume itself, and it checks `hc` and the Herdr app before
its answer. A refusal of the daemon gives 409 with its line, also before the end of the takeover
of its start. The page sends Run and Resume with no timeout, and the board server
keeps the request open until the answer. An accepted answer gives the run ID; an accepted answer
with no run ID gives 409 with a line that says the daemon sent no run ID. The board starts no `celetis`
command and no terminal for Run and Resume.

**The argv of a press.** At each press of New intake, Assist, or Make visual, and at each queue
wake, the adapter reads the installed `celetis` engine
(`readEngine` of `engine/lib/installation.ts`). Its command is `<base>/.local/bin/celetis`, or
`<base>\.local\bin\celetis.cmd` on Windows, where `<base>` is `CELETIS_HOME` or the home folder.
The read refuses an entry that is not the file `engine/celetis` of a version folder, so the
command always starts the engine in its version folder. The command path has no control
character. The adapter keeps no engine path between presses, so after `celetis update` the next
press starts the new engine.

The adapter makes each argv from fixed items: the command of the engine, then, for Assist,
`assist`; for Make visual, `visual`, the number, and the full commit hash of the History row of
that number; or for New intake, `intake`, with no issue number. These commands select from the
local order. The engine supplies Bun and its isolation flags. The number is its digits. Each
item is one argument: no shell reads the argv as a line, so an item cannot add a second command.
For the issue 12:

```text
<base>/.local/bin/celetis assist 12
<base>/.local/bin/celetis visual 12 <sha>
<base>/.local/bin/celetis intake
```

The adapter also runs one fixed control command with the engine entry, Bun and its isolation
flags, and a 30-second limit, with no `CELETIS_AGENT` in their environment:
`agents replace '<{"order", "expectedVersion"}>'` for the agent order. It parses its output as
external input.

On macOS and Linux, the new terminal starts the argv in a login shell of `$SHELL` (else `/bin/sh`),
with `hc run --rm`. New intake, Assist, and Make visual use this start form:

```text
<shell> -lic '"$@" || exec "$0" -li' <shell> <argv>
```

The shell gets each item as one item of `"$@"`. A program that exits 0 closes the tab: herdr-core removes its terminal. A
program that fails leaves the tab open with its message and an interactive shell. On Windows,
`hc run` gets the argv with no shell, and a tab gets no `--rm`. On Windows, the start of the argv
is not checked.

The adapter sends each queue action as `POST /queue/action` to the master daemon with the fixed
body `{action, selection, quiet: true}`, and waits at most 120 seconds. It parses the answer as
external input.

Add supplies the default order (`selection` `{}`) or one host (`{explicit: <host>}`). Other actions send `{}`, and the daemon uses the saved choice. Retry with null step resolves
terminal work without authorizing a session. No batch Start or Reset command remains.

**The agent order.** The footer shows the local agent order (`picker.order`) and edits it
("The layout, the keys, and the errors"). New default work uses the first included agent with no
confirmed usage block. The `CELETIS_AGENT` of the daemon selects no host for the board reads and
does not pin a default start. The command palette entry `Change the agent order`
opens the list.

To use another available agent for one independent Run, use the card's agent choices. An independent
Run without a choice sends no agent, and the daemon run selects from the effective order of each step:
the preferred agent of the step in `agents` when the local order includes it, then the local
order ([Agent selection and model setup](../../plugins/celetis/docs/configuration.md#agent-selection-and-model-setup)). Run on the current issue of a queue paused at a `me` gate uses Continue with the saved queue choice. An
absent or null choice keeps that choice. An explicit host is refused when the saved choice is
default or names another host.
A choice for one Run does not change the order. An explicit choice pins that start, also when
the agent is limited. Resume sends only the issue number, and the daemon run selects the host and
the exact ID of the saved record, also after the local order changes. Assist also sends only the issue number and offers no agent choice.

To start one step of a `ready` card at another effort level, use a `Run at <level>` entry of its
run menu ("The layout, the keys, and the errors"). An entry sends no agent, as Run does, and sends
the level. The request then has the level as `effort`, so the
daemon run starts that step at that level once
([The start of a step](../README.md#the-start-of-a-step), "The effort level"). The entry writes no decision on the issue, and a later step uses
its own decision. The current issue of a queue paused at a `me` gate takes no level: the queue
starts its step at the decided level.

**New intake is independent of issue reads.** `POST /api/intake` accepts exactly `{}`. A non-object
or an extra field returns 400 before any terminal starts. Each press reads the local order and the
usage records. It checks the executable of the first eligible host and the current engine before
opening a focused `Intake` tab, and its argv has no `--agent`. When every included host is limited,
it returns 409 with the blocks. A preflight failure returns 409; a failed
`hc` or `herdr-app` call returns 502. It neither waits for nor starts an issue read and does not use queue or issue
locks. One pending reservation in the daemon refuses concurrent intake requests with 409.
The reservation clears on success or failure, so a later deliberate press opens a fresh session.
A lost response has no exactly-once guarantee.
Success confirms that the terminal started with the argv, not readiness of the native host. Startup
errors remain in that tab. The existing Human sessions strip observes the session without an
issue number or a new session store.

The run of a press lives in the daemon: `celetis daemon status` shows it. With the default `me`
gates, the run of a Run press ends with its one session. The board has no control that stops a
run, and no command stops one.
`celetis daemon stop` stops the daemon and detaches every run, and a session whose start barrier
the daemon released stays open ([A stop of a run](../README.md#a-stop-of-a-run)).

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
space. Each press keeps its folder, its focus, and its name in the two cases. Run, Resume, Retry,
and a queue action open no tab and start no terminal: the daemon opens the session tab.

| Press | Folder | Focus | Tab name and link label | Argv |
|---|---|---|---|---|
| Run | none: a request to the daemon | none: the session tab is quiet | none | none: `POST /run` |
| A queue action | none: a request to the daemon | none: each session tab is quiet | none | none: `POST /queue/action` |
| Resume | none: a request to the daemon | the session tab | none | none: `POST /resume` |
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
start; Run, Resume, or Assist; the end of the 30-second Assist detection period; local queue changes;
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
`/api/refresh`. A Run body can also have `"agent": "<name>"` and `"effort": "<level>"`, and no other
field. A Retry of a usage-limit wait sends exactly `{"number": <n>, "waitId": "<uuid>"}` to
`/api/run`; the server checks only its shape, and the daemon refuses a stale or
finished wait or a run that no longer runs, which the server returns as 409 with the line of the daemon. Before any
read, the server refuses an `effort` that is not `low`, `medium`, `high`, `xhigh`, or `max` with 400
and a line that lists the five levels. The server refuses a press with 409,
sends no request, and starts no terminal, unless each condition holds:

| Press | Conditions | Cause of the refusal |
|---|---|---|
| `POST /api/run` | A fresh issue and queue read succeeds. The issue has a card of its own, with no session. Its row is `ready` or `stuck`. `noRun` is `null`. No press on that issue is active. A current paused queue issue has no `effort` in the body and also meets the Continue conditions below. | The read or queue cause; for an `effort` on a current paused queue issue, that the queue starts this step at the decided level; otherwise that the issue has no step to start now. |
| `POST /api/resume` | The issue has a card of its own, with no session. Its row is `stuck`. `noRun` is `null`. No press on that issue is active. | The issue has no session to resume now. |
| `POST /api/assist` | A fresh issue read succeeds. The issue has a card of its own, with no session. Its row is `blocked`, with `assist` true and `noRun` null. A current `hc` terminal list succeeds. A fresh read of the local order and the usage records gives a first eligible agent, and it is on `PATH`. No Run, Resume, or Assist press on that issue is active. | The current read, `noRun`, agent, session, or state cause; otherwise that the issue has no blocked state to assist now. |
| `POST /api/visual` | The issue has a History row in the last good read. The page of its commit does not exist. No live terminal with the link label `#<n> visual` is in the main checkout or a lane worktree. No Make visual press of that number is in flight. A fresh read of the local order and the usage records gives a first eligible agent, and it is on `PATH`. | The issue has no row in History; its visual exists already (use Open visual); its `visual` tab is still open; a Make visual press of the issue is in flight; otherwise the agent cause. |
| `POST /api/shell` | The issue has a card of its own, with no session. Its row is `dirty`. Its `path` is a lane worktree of the main checkout. | The issue has no dirty worktree. |

`POST /api/queue` accepts exactly `{"action": <QueueAction>}`, or for Add with one host
`{"action": <QueueAction>, "agent": "claude" | "codex"}`. An Add with no agent records the default
order. Another action uses the choice of the saved record. The shared engine validator enforces
the continuous-queue contract. Host, Origin, JSON, and the 1024-byte body limit stay in force.

The fixed adapter gives `POST /queue/action` `{action, selection, quiet: true}` to the dispatcher
of the daemon and parses the answer as external input (`parseQueueAnswer`). The HTTP response is the
persisted QueueView of the answer; it does not await History or a session. The board writes no
queue record. For a newly issued wake, the daemon starts the queue run in the same request. A
refusal returns 409 with its line, and the board never sends a queue action again; the page waits
up to 150 seconds for the response.

The browser supplies no executable or path. When the daemon refuses the wake of an admitted action,
it saves the failure in the queue record, and the queue panel shows it with Try again. A stop of
the daemon during the request leaves the pending launch, which Try again recovers.

Run on the current paused issue uses Continue with the saved agent choice and fresh displayed step.
An explicit conflicting host refuses. Waiting edits remain available during runs and stops.
The current run never transfers explicit authorization to another issue.

`GET /api/queue` reads authoritative state without a full-board refresh. After a stale or lost
response, the browser reads state before another deliberate attempt. It merges acknowledged
and polled queue revisions and keeps the last good list on a failed read. Pending admission,
saved/starting, and verified running are separate states. Only existing session observations
prove running. A refresh carries no wake: its reconcile request starts a due queue run in the
daemon. No second remote poller is added.

An Assist body must be an object with exactly one field, `number`. An extra field, including
`agent`, a prompt, or execution text, gives 400. The number must be a positive safe integer,
as a number or a digit string. Assist accepts every resolver reason whose card is `blocked`.
It opens assistance for the human action; it starts no workflow step. A 200 response means the
tab opened, not that the host resolved the block. A later CLI refusal can remain in that tab.

A Make visual body must be an object with exactly one field, `number`. An extra field, including
`sha` or `agent`, gives 400 with a line that says that making a visual takes only the issue number. The number follows
the rule of Assist. The server takes the full commit hash only from the History row of that number
in the last good read. It makes no fresh read and checks no `noRun`. It checks in this order: the
press in flight, the row, the terminal list, the page, the tab, the agent, and the engine. A
failed `hc ls` gives 502. Each Make visual press marks its number in the board process until it
ends, so a second press of that number gets 409. This mark is separate from the Run, Resume, and
Assist reservation. The tab check needs no state of the board, so it also holds after a start of
the server. A 200 response means that the tab opened, not that the page exists. A later refusal
of the command, for example a commit that is not on the remote trunk, stays in that tab.

These checks of Run, Resume, Assist, and Make visual also refuse with 409. Read-only `hc` calls
can precede the failure:

- **The engine** of Assist and Make visual, before any terminal starts. No installed engine gives a line
  that points to [First install](../../plugins/celetis/README.md#first-install). A read that fails
  gives the first line of its error, for example for an entry that is not a file of the `celetis`
  engine, or for a `CELETIS_HOME` that is not an absolute path. A command path with a control
  character gives a line that names it.
- **The saved session of Resume.** The daemon refuses a Resume with a missing or invalid saved
  record, or a record with no verified session ID, with the first line of its error.
- **The agent of Run, Assist, or Make visual.** An explicit Run choice must be `claude` or `codex`;
  another choice gives a line that names the issue and the unknown agent. A queue continuation uses its saved choice and
  refuses an explicit conflicting host. With no choice, the server reads the local order and the
  usage records again at the press; it never uses a host that the page showed. An agent that is not
  on `PATH` gives a line that names it, and no other host is tried. When every included
  agent is limited, Assist and Make visual refuse with the blocks; a default Run is accepted,
  and its run waits.

`POST /api/agent` replaces the local agent order. After the Host, Origin, JSON content-type, and
body checks, its body must be exactly `{"order": [...], "expectedVersion": "<64 hex>"}`, with a
nonempty, unique list of `claude` and `codex`; another shape, including a path, a command, or usage
data, gives 400 and starts nothing. The server then runs `agents replace` through the fixed
adapter. Success gives 200 with `{"order": <AgentOrder>}`; a replacement that is already saved gives
200 with the same version. A stale version gives 409 with `{"error": "<one line>", "latest":
<AgentOrder>}` and writes nothing. Another failure of the command gives 409 with its first line.
The order is in the Git common directory, so the request changes no working-tree file.

The answer to a press that the server did is 200 with `{"ok": true}`. Each other answer is
`{"error": "<one line>"}`, and the page shows the line in a toast:

| Status | Case |
|---|---|
| 400 | The body is not JSON, the body has more than 1024 bytes, the issue number is not a positive safe integer in digits, the `effort` of Run is not one of the five levels, a Run or Retry body has another field, the queue request is invalid, the order request has another shape, or the body of Assist or Make visual is not an object or has an unexpected field. |
| 403 | The `Host`, the `Origin`, or the content type is not good, or the `Origin` is `null` ("The trust boundary"). |
| 404 | The path is not a path of the board, a `/visual/` path names no page, or Go names an id that is no session of the repository. |
| 409 | A condition of the table does not hold, the queue request is stale or unavailable, the read of the engine fails, the fresh issue read of Assist fails, the daemon refuses Run or Resume (for example a Resume with no valid saved session), the agent of Run, Assist, or Make visual is not good, the commit of Make visual is not 40 lowercase hex digits, the order replacement is stale or fails, a Retry names no live wait, or a restart request finds no restart to do or an installed engine that fails its validation. |
| 503 | A restart request arrives during a stop or a restart of the daemon, with a line that tells the sender to start the daemon again, then send the request. |
| 502 | An `hc` or `herdr-app` call failed, also the terminal list of Make visual: the first line of its error. An answer with no list of terminals, no list of spaces, or no safe terminal id also gives 502. |
| 500 | The server failed for another cause: the first line of the error, or a line that says the server failed. |

Each 500 answer, each 502 answer, a failed queue launch, and a failed update or restart also add an entry to the event record of the user ([The event record](../README.md#the-event-record)).

The update API is independent of issue and terminal reads. Each success apart from the restart
returns `{runtime: {revision, instance}, update: <snapshot>}`. `revision` is the full revision of
the engine that started this board. `instance` is a random ID for this startup.

| Request | Body | Result |
|---|---|---|
| `GET /api/update` | none | The current update snapshot and runtime. |
| `POST /api/update/check` | An empty object, `{}`. | Starts or joins a check and returns the current snapshot immediately. |
| `POST /api/update/start` | Exactly `{"offerId": "<opaque ID>"}`. | Consumes an available offer before mutation and returns 202 with the current snapshot. |
| `POST /api/update/restart` | Exactly `{}`. | When the snapshot says `restart-needed`, validates the installed engine and returns 202 with `{runtime, target}`; `target` is the full revision that the new daemon runs. Then the daemon restarts. |

The POST routes use the same Host, Origin, JSON content-type, body limit, CSP, and JSON response
paths as other board actions. A non-object or unexpected field gives 400. An unavailable or
consumed offer gives 409. The restart reads the installed engine again before it answers. It
gives 409 with a line that tells the sender to check again in another phase, also for a daemon that
runs from a checkout, and 409 with the line of the validation when the installed engine fails
it; the daemon then keeps running. It gives 503 with the stop line during a stop or a restart, so
two restart requests start one restart. The start and the restart responses finish before this
board closes for activation.

**Retry of a usage-limit wait.** The daemon wakes the live run that owns that wait for one bounded
attempt cycle and starts no run. The board never sends a Retry again, and a repeated Retry of a
pending wake changes nothing.

## The trust boundary

A Run press is one request with fixed fields of the master daemon that serves the board, in its
process. Twelve rules hold for the server and the page:

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
6. The page sends an issue number, a session id, a selected Run agent, a selected Run effort level, a strict queue action, an
   agent order with the version that it read, a usage-limit wait ID, or an opaque update offer
   ID, never a command, an installation path, or a usage observation.
   New intake and **Restart** send only an empty object; the daemon reads the installed engine
   itself. Resume, Assist, and Make visual take only the issue number.
7. An id of an answer of `hc` or `herdr-app` (a terminal, a space, a tab) goes into a command only
   when it has letters, digits, `_`, `:`, `.`, and `-`, and does not start with `-` (`isSafeId` of
   `engine/lib/terminal.ts`). An id that is absent goes into no command.
8. The server starts `hc`, `herdr-app`, and `git` with no shell. The issue read starts `gh`,
   `git`, and, on macOS and Linux, `ps`, and the status read of a placement starts `ps`, each with
   no shell.
9. For issue and session data, it runs `git` only in the main checkout or in a lane worktree.
   The `git diff` of a session runs with `--no-optional-locks`, so it writes nothing. Update
   workers also validate the native plugin and engine installations.
10. Open shell refuses a path that is not under `.claude/worktrees/` of the main checkout.
11. The server writes nothing in a product working tree. An approved update changes only the
    validated native plugin and engine installations.
12. The page writes each text of the data, of a terminal screen, and of an error as text, never as HTML. Its
    Content-Security-Policy allows its own files (the page, its eight scripts, its stylesheet, and
    its two fonts) and `data:` images (the tab icon) only. A visual page at `/visual/<sha>` is
    model-written HTML. The server sends it only when `<sha>` is 40 lowercase hex digits and
    `docs/superpowers/visuals/<sha>.html` of the main checkout is a regular file, not a symbolic
    link. Its response has `Content-Security-Policy: sandbox allow-scripts allow-popups
    allow-popups-to-escape-sandbox` and `X-Content-Type-Options: nosniff`, with no
    `allow-same-origin`. So the page has an opaque origin, and it cannot read a board response.
    Its cors requests and its POSTs have `Origin: null` and get 403 (rule 4). A navigation, a
    popup, and a no-cors GET (an image or a script) have no `Origin` and get the normal answer,
    which the page cannot read. No GET of the board is a press. A `GET /api/board` can start the
    full read of the data, which the timer of the server also starts. That read sends the
    reconcile request to the master daemon, which can update the queue record and start a queue
    run that is due. ADR-0065 records this route.

Five rules hold for the start, the argvs, and the data:

1. **Each press that starts a command reads the engine.** Each press of New intake, Assist, or
   Make visual reads the installed `celetis` engine. The read
   accepts only the own entry of the engine in `<base>/.local/bin/`, which starts the engine in
   its version folder, and the command path holds no control character. The page, the data, and a
   lane cannot supply a command path.
2. **A press starts a fixed argv or sends a fixed request.** Run and Resume send the fixed fields
   of "The requests of Run and Resume", Retry sends `{number, waitId}`, and a queue action sends
   `{action, selection, quiet}`. New intake, Assist, and Make visual start their interactive commands ("The
   argv of a press"). On macOS and Linux, the login shell of the new terminal gets the argv as
   `"$@"`, so it reads no item as shell text. That engine starts the first `bun` on the `PATH` of
   that login shell, through its `env -S` shebang, or through its shim on Windows. New intake,
   Assist, and Make visual start the selected native host. The server starts `hc`, `herdr-app`,
   and `git`, and the issue read starts `gh`, `git`, and, on macOS and Linux, `ps`. Update workers have the separate fixed update
   protocol above.
3. **Only validated values go into an argv.** The number is the digits of the issue. The agent of
   an explicit Run is `claude` or `codex`. Default Run, New intake, Assist, and Make visual retain
   default mode; admission reads the current order and usage blocks. The effort level of Run is
   one of the five levels, and the adapter sends it as `effort` of the Run request.
   The commit of Make visual is the full hash of the History row of
   that number in the last good read, and the adapter refuses a value that is not 40 lowercase hex
   digits. The page never sends it. Resume takes no agent. Queue fields pass the shared exact-shape validator; its step is an engine-defined
   value, its ID is a UUID, its revision and issue numbers are positive safe integers, and its
   choice is default mode or an explicit `claude` or `codex`. No title, reason, act, or data path goes into an argv.
4. **The data comes from the engine, in the process of the daemon.** No other program gives the
   document. The adapter parses each answer of the dispatcher of the daemon (`parseAnswer`,
   `parseQueueAnswer`), also the queue view of its reconcile answer, as external input, as a client
   of the socket does; the status object comes from the daemon in the same process. The lane keys and the step
   names come from the workflow definition of the engine, and the states come from the typed rows
   of the resolver and from the locks and the record of the daemon. The page writes each text as text (rule 12), and the Content-Security-Policy stops
   a `javascript:` URL in the page.
5. **The board runs in the main checkout only, with a clean `PATH`.** `daemon start` starts the
   daemon in the main checkout from each checkout of the repository, and it removes each
   `node_modules/.bin` item from the `PATH` of the daemon, so a planted `git`, `gh`, `hc`, or
   `herdr-app` in such a folder does not run. "Start" gives the reason.

These files enforce the rules. They are the trust files of the board:

| Rule | Files that enforce it |
| --- | --- |
| 1 (listen on `127.0.0.1`) | `engine/board/start.ts` |
| 2, 3, 4 (the `Host`, the POST `Origin` and content type, `Origin: null` first) | `engine/board/perimeter.ts` |
| 5 (digits, a session of the repository, five levels) | `engine/board/requests.ts`, `engine/lib/fields.ts`, `engine/board/presses.ts` (Go), `engine/lib/effort.ts` (`isLevel`) |
| 6 (what the page sends) | `engine/board/requests.ts`, the page modules of `engine/board/page/` |
| 7 (`isSafeId`) | `engine/lib/terminal.ts` |
| 8 (no shell) | `engine/board/perimeter.ts` (`run`), `engine/lib/process.ts` (`run` of the issue and status reads) |
| 9 (`git` only in the repository, `--no-optional-locks`; update workers validate the installations) | `engine/lib/board-read.ts` (`isInside`, `readDiff`), `engine/board/update-worker.ts`, `engine/lib/updater.ts` |
| 10 (Open shell under `.claude/worktrees/`) | `engine/board/presses.ts`, `engine/lib/board-read.ts` (`isInside`) |
| 11 (no write in a product working tree) | No one file: each module of the board; the read model only reads |
| 12 (text as text, the Content-Security-Policies, the visual page) | `engine/board/perimeter.ts`, `engine/lib/fields.ts` (`isCommit`), `engine/lib/board-read.ts` (`readVisualPage`), `engine/lib/visual.ts` (`hasPage`), the page modules |
| Start rule 1 (the engine read) | `engine/board/adapter.ts`, `engine/lib/installation.ts` (`readEngine`) |
| Start rule 2 (fixed argvs and requests) | `engine/board/adapter.ts`, `engine/lib/terminal.ts` (`openTab`) |
| Start rule 3 (only validated values) | `engine/board/requests.ts`, `engine/lib/fields.ts`, `engine/lib/host-names.ts` (`isHost`), `engine/board/adapter.ts`, `engine/lib/queue.ts` (`parseQueueAction`) |
| Start rule 4 (the data comes from the engine) | `engine/lib/board-read.ts`, `engine/board/adapter.ts`, `engine/lib/daemon-types.ts` (`parseAnswer`, `parseQueueAnswer`) |
| Start rule 5 (a clean `PATH`) | `engine/lib/process.ts` (`childEnv`) |

A Run press types a run form in the repository of the board, and the daemon run follows the
`.celetis.yaml` of its main checkout. Do not start the daemon in a repository that you do not trust.

## The layout, the keys, and the errors

**The layout.** The page holds nothing of one repository: it uses neutral colours, follows the light
or dark theme of the OS, and shows the folder name of the main checkout in the header. It carries
its two fonts, Geist and Geist Mono, in `engine/board/fonts/` with their licence (`OFL.txt`, the
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
  `New intake failed` with the server cause. A server failure or lost response also states that the
  launch outcome is unknown, and tells the person to check Human sessions or herdr before a new
  press of New intake. No launch retries automatically. The button becomes available for deliberate recovery, and
  completion never takes focus back from another control.
- The footer holds the agent order after the item `Daemon`. Its pill stacks the icons of the
  included agents in priority order with a chevron; hover or focus spreads them. A press opens the
  list upward, inside the viewport. Each row has a drag handle, its rank, the icon, the name, a
  detail line, and `First` on the first included agent. The detail line shows `In use` for an agent
  of a live session, `Limit reached · resets <time>` or `reset unknown` with the reason, `Available`,
  or `Excluded from default work`. A drag shows the row under the pointer and an insertion line. A
  press of a handle without a drag opens its menu: Move first, Move up, Move down, Move to bottom,
  and Exclude from default work or Include in default work. The last included agent cannot be
  excluded; inclusion puts the agent last. On a handle, Up and Down move the focus, Alt+Up and
  Alt+Down move the agent, and Enter or Space opens the menu. Escape closes the menu, then the list,
  and returns the focus to the handle or the pill. A press outside closes the list.
- Each change is one replacement with the version that the list read, and the list shows the new
  order at once. During a save, the list takes no other change. A failed save restores the
  confirmed order and shows the cause. A stale change shows the current order and asks for the
  change again. A refresh that brings another order during a drag stops the drag. The focus stays
  on the handle of the same agent. While a run waits because every included agent is limited,
  the list names the issue, the cause, and its next reset or `No reset time is known`, with
  `Retry #<n>` for each waiting issue. When every included agent is limited and no run waits,
  the list says that new default work waits. A long wait list scrolls inside the picker, which
  stays above its pill and within the viewport. Changes and Retry results go to a polite live region.
  Below 720 px width, the pill, the handles, the menu items, and Retry are at least 44 px high, and
  the handles are 44 px wide.
- The status bar keeps the Celetis update control after the agent order, including on phones
  and while its nonmodal dialog is open. The same button shows **Check for updates**, **Checking…**,
  **Up to date**, **Update available**, **Restart needed**, **Update check failed**, **Update in
  progress**, **Restarting…**, **Update completed**, **Update needs attention**, or **Restart needs
  attention**. It uses the accent look only for **Update available** and **Restart needed**, the
  two states that need an action. Its accessible name and tooltip are `Celetis: <label>` in each
  state. Each state change goes to the polite status region, also when the label stays. Below
  720 px the button is 44 px high.
  The footer can wrap; its controls remain below the dialog. Checks
  keep the cards and other controls usable. A dialog that opens by itself does not move the focus:
  the focused element keeps it, and the polite status region gives the state. A press of the
  control opens the dialog and moves the focus to its title. Escape closes the open dialog also
  when the focus is outside it, but not in a form field. An open menu, Search, or the keyboard
  shortcuts close before the dialog, and the dialog closes before the card details or History.
  Escape, **Later**, **Close**, or **Hide progress** returns the focus to the control when the
  focus was in the dialog, and leaves it in place when it was not; a background close does not
  take focus from other board work.
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
  answer, Stuck (no progress, a dirty tree), Your input on the issue (the `blocked` cards), Paused by
  usage limits, and Ready to run. The first two groups show full cards, and the other groups show one row for each card,
  as Idle does. The label of a group stays in view while the column scrolls. When cards are below
  the fold, a line at the foot of the column names them, for example
  `3 more below: 1 input on the issue, 2 ready to run`; a press scrolls to the first of them.
  Idle keeps its current vertical position during a data refresh; the browser clamps it when the content shrinks.
  A group row in Idle holds a chevron, the epic number, the epic title, and the count of its cards.
  A press shows or hides the children, and a group starts closed.
- Queue preserves the saved Now/Pipeline choice. Current work appears above Up next. The picker
  sits beside waiting work on desktop and below it on a phone. Add persists immediately and starts
  an empty queue. Only waiting rows expose Up, Down, and Remove, including during runs and stops.
- The count includes current and waiting work only. Finished rows leave with the same update.
  Continue authorizes one displayed step; Try again recovers a permitted stop. The agent choice
  stays fixed while nonempty. A default choice uses the effective order of each new step: the
  preferred agent of the step in `agents` when the local order includes it, then the local order.
  Accepted order survives reload and a restart of the daemon, without a batch reset.
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
  a text that says the queue starts this step at the decided level; else with the cause that disables Run. The `m`
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
  it. The board takes the cards as seen when its window loses the focus. A closed group row shows
  the dot while one of its hidden cards has it.
- The status bar shows when the board last read the data, with the name of the tracker (`Issues`
  before the first good read), whether herdr-core answers (the item `herdr`), and the state of the
  master daemon (the item `Daemon`, hidden until the first data and below 720 px). It shows
  the keys of the focused card, the landed-issue count (a press opens History), the Notify switch,
  and the list of keys. The item `Daemon` shows `daemon` of each placement ("The data"):

  | Auto mode | Text | Tone | Title |
  |---|---|---|---|
  | on | `auto on` | ok | `The daemon PID <pid> runs. Auto mode starts each auto step.` |
  | off | `auto off` | off | `The daemon PID <pid> runs. Auto mode is off: auto steps wait.` |
  | stops | `auto stopping` | off | `The daemon PID <pid> runs. Auto mode stops after its current work.` |

  The board runs in its daemon, so the item has no state for a daemon that does not run, does not
  answer, or runs another program.
- Notify: the first press asks the browser for permission. Then each card that enters Needs you
  shows a system notification while the board is not in front: `#<n> waits for your answer`,
  `#<n> ended its turn`, `#<n> made no progress`, `#<n> has a dirty worktree`, `#<n> <reason>` for a
  `blocked` card, and `#<n> is ready to run <step>`, with the title of the issue. A human session
  that starts to wait for your answer shows `Human session "<label>" waits for your answer`, or
  `A human session waits for your answer` when its title is empty. A press on the
  notification opens the details of the card. A screen reader hears each card that enters Needs you,
  each card that starts, and the session or the warning that ends a start.
- Pipeline has one column for each item of `flow.stages`, in order, and it shows each issue at its
  step. A strip at the top, Not in a step, holds the issues whose step is in no stage. The Idle
  cards of a stage group in the same way: the row has the chevron, the number, the title, and the
  count, a press shows or hides the children, and a group starts closed.
- When a request of the page fails, the cards of the last good read stay, dimmed, under a message
  that says the board read failed and that the cards and history show the last good read.
- A card that changes its column moves to its new place. The page shows no motion when the OS asks
  for reduced motion.
- Below 1100 px Needs you takes the left half and Running and Idle share the right half, and the
  page scrolls as one document; it also scrolls as one document at a height of 700 px or less. Below
  720 px the columns stack.
- The page keeps four choices in the storage of the browser: the view, the Notify switch, the
  switch of the single-key shortcuts, and the open epic groups. The open epic groups follow a change
  in another tab of the same board. A board on another port has its own choices.

**The keys.** `⌘K` (`Ctrl K` off macOS) or `/` opens the search: it lists the issue work that needs
you first, then the running cards, the steps that can start, the human sessions (a waiting one
too), the landed issues, and the commands of the board. `#<n>` jumps to an issue, and `<n>` alone also
finds a human session whose title is `<n>`. `j` and `k` move to the next or the previous card,
`h` and `l` to the column on the left or the right; `Enter` presses the main button of the card,
`Space` opens its details, `m` opens all its actions, `o` opens the issue, and `c` copies the
command or the path of the card. `v` changes between Now and Pipeline, `d` shows or hides History, `r`
reads the issues again, and `?` shows the list. `j`, `k`, `h`, `l`, and the arrows stop at the row of an
epic group and skip the issues of a closed group; `Enter` and `Space` on a row show or hide its
issues. The search has `Expand all epic groups` and `Collapse all epic groups`. `#<n>` in the
search, a notification press, and the return from the details open the group of a hidden issue and
store that open. The list has a switch that turns the single-key shortcuts off; the keys of a
focused card or epic group always work, and the arrow keys move from a focused card or epic group
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
  not run, an `hc` or a `herdr-app` that is not on `PATH`, and a press that the server or the
  master daemon refuses. For Run and Resume, the daemon checks `hc` and the Herdr app, and the
  toast shows the line of its refusal.
- The status bar shows `herdr down` when `hc ls` fails, with the error in its title.
  The board then shows no session card, and the issue cards stay.
- The status bar shows `cannot read:` with one line when the last read of the issues failed ("The
  data"). The cards of the last good read stay.
- The status bar says that the board server does not answer when a request of the page failed. A
  press at that time gives a toast with that text and a line that tells the person to start the
  daemon again in a terminal with `celetis daemon start`.
- Queue disables execution controls during a request or an unavailable authoritative read. A failed
  press retains the accepted queue and shows the server reason. Recovery controls
  follow the current engine action flags, including an interrupted run.
- Agent-state read, order-save, and usage-limit Retry errors show a public cause without local
  filesystem paths. A stale order replacement still returns the latest validated order.
- The `noRun` text, the message of a server that does not answer, and each toast are alerts for a
  screen reader.

## Versions

- **The board shares the engine revision of its daemon.** A board-approved update restarts the
  daemon on that installed revision. A terminal-started `celetis update` needs a restart of the
  daemon ("Start"). Each start has a distinct runtime instance.
- **The document has no version.** The board and the engine are one package, and the compiler
  checks the `Document` type between them.

The browser sources are the files of `page/`. They also import `view.ts` and `types.ts`, which server code shares,
so those two stay free of the DOM. The pinned Bun 1.4.4 build program, `scripts/build.ts`, bundles `page/board.ts`
into `board.js`, and refuses a bundle input outside `engine/board/`.
It compiles every target before it writes any output. Plugin users run no build.

## Limits

Of the distribution:

- Issue reads check no plugin update policy. A conflict can show in the independent update
  check, or in the tab of the next New intake or Assist. A startup stop of the run of a Run or
  Resume shows in the existing card warning area, from the outcome of that run in the status of
  the daemon.
- The board follows the run of a Run or Resume only at a placement, so only while a page asks.

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
  fails, a press of New intake, Assist, Make visual, or Open shell gives a toast and starts no
  terminal, and the daemon refuses a Run or Resume with its line. When `hc ls` fails, the status bar shows `herdr down`.
- A Go press focuses the pane of the session in the Herdr app (`pane.focus`). The board makes no
  call that brings the window to the front.
- The API of herdr-core and the commands of the Herdr app are previews (version 0.x). The board
  uses herdr-core 0.1.16 and the Herdr app 0.1.11; a later 0.x release can break it.
- Two repositories whose main checkout has the same folder name share one space of the Herdr app.
- The tab of a new terminal can show up to about 3 seconds after its start. The board waits 5
  seconds for it; after that time, the tab keeps the name that the Herdr app gives it.
- On macOS and Linux, the login shell is `$SHELL`, else `/bin/sh`. It must read the POSIX start
  form `"$@" || exec "$0" -li`; a `$SHELL` such as fish cannot read them, and the
  argv does not start.
- Run/Resume ownership and warnings live only in the daemon process. A restart of the daemon does
  not recover them; the next daemon takes over the run. A queue action keeps its persisted
  queue-state authority.
- The board does not answer between the stop of the old daemon and the takeover of its successor
  ([The master daemon](../README.md#the-master-daemon), "The restart", gives the gap with no
  daemon). A successor that finds the old port in use serves another port: the page cannot
  reconnect at its URL and shows the timeout, and `celetis daemon status` prints the new URL.
- On macOS and Linux, a New intake, Assist, or Make visual program that exits 0 closes its tab
  (`hc run --rm`).
  The first press that makes the space of the repository starts its argv through the start form
  of the Herdr app, `"$@"; exec "$0" -li`, so that one tab keeps a shell after its program ends.
- On Windows, `hc run` gets the argv with no shell, and the first item is `celetis.cmd`. Such a
  start, its tab, and the card of its session are not checked. A program that `hc run` starts with
  no shell has no foreground in `hc get`, so its session can get no card.
- Two shapes of the REST reads of the board data (`nextBoard`) for each open PR are not checked
  against a live GitHub: a commit status list that is not empty, and a review list that is not
  empty.
- A `#<n> visual` tab whose command fails keeps its message and a shell, and its History row shows
  **Making…** until you close the tab.
- A `#<n> visual` session of an issue that is still open takes the place of the card of that issue
  while it runs, because the state of a session wins ("The cards").

Of the cards and the page:

- The board does not show the `step` of a `blocked` row: such a card is in Not in a step of Pipeline
  and has no lane track.
- Before the first good read, Pipeline has no stage column: the strip Not in a step holds each
  session of an issue.
- A start of the server forgets the times of the Run, Resume, and Assist presses.
- The count of changed lines is against `origin/HEAD`. A clone with no `origin/HEAD` shows no count.
- A notification shows only while the page is open in a tab. A browser that throttles a hidden tab
  can delay it by up to a minute.
- The page has no login. Each program on the machine can ask the server.
- A visual page at `/visual/<sha>` has no `localStorage` under its sandbox: an access throws
  `SecurityError`, so a page script that needs storage can break.
- The lane icons are the one place where the page knows four names of a flow. They change no rule.
- With a gate that is `auto` in the main YAML, the run of a Run press goes on with that step in a
  new tab. Between two sessions the card is in Running with `Starting`.
