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

The board is the folder `engine/board/` of the plugin `celetis`, a part of its engine, and `BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 bun --no-env-file --no-install --config=/dev/null --no-macros <plugin>/bin/celetis.ts --agent <host> board` starts it. It
is one Bun program with no dependency of its own. The plugin carries generated browser
JavaScript. A product repository needs no build or install step. It runs from the plugin, so the
repository that it shows needs no file of the board.

The board came from commit `95144d3` of its old repository
([ADR-0020](../../docs/adr/0020-the-board-is-a-part-of-the-plugin.md) of the plugin `celetis`).
[ADR-0035](../../docs/adr/0035-the-board-is-a-part-of-the-engine.md) of the plugin `celetis` gives
the reasons why it reads its data in its own process and types two fixed command lines.

**Requirements.**

- macOS or Linux. On native Windows, the start and the data of the board before #102 are checked;
  the in-process read of #102, and Run and Resume in a herdr tab, are not (`docs/celetis-flow.md`
  of the plugin `celetis`, "Acceptance status").
- Bun 1.4.4 or later. The entry prints `celetis: need Bun >=1.4.4 on PATH, found <version>` and
  exits 2 on an older Bun.
- git 2.31 or later.
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

Run `BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 bun --no-env-file --no-install --config=/dev/null --no-macros <plugin>/bin/celetis.ts --agent <host> board` in the main checkout of the repository, or in a subfolder of it, and open
the URL that it prints. The command takes no arguments. The README of the plugin, "The agent
board", gives this start.

The start validates the main `.celetis.yaml`, refuses a lane start, and checks the plugin update
policy of the selected host once. `--agent` selects the host of the board process only: its policy
check and, for Codex, its `CODEX_HOME`. At the start, the fixed adapter (`adapter.ts`) checks only
the selected Bun (`process.execPath`): an executable regular file with no control character in its
path. Each Run and Resume finds the enabled copy of the session's host and checks its entrypoint
at the press ("The line of a pane").

**The port** is `PORT` of the environment, else `board.port` of the main `.celetis.yaml`, else 4403.
A `PORT` that is no number, or that is `0`, counts as absent. The server listens on `127.0.0.1`
only. Each repository has the default port 4403, so a second board on one machine exits 1 at its
start. Give it another port in `board.port`, or with `PORT`, which overrides it:

```bash
PORT=4404 BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 bun --no-env-file --no-install --config=/dev/null --no-macros <plugin>/bin/celetis.ts --agent <host> board
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
| An argument follows `board` | `usage: BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 bun --no-env-file --no-install --config=/dev/null --no-macros <plugin>/bin/celetis.ts --agent <host> board` | 2 |
| The current folder is in no git checkout | `celetis: need a Git checkout` | 2 |
| The current folder is in a bare repository | the line of git, `fatal: this operation must be run in a work tree` | 128 |
| The main `.celetis.yaml` cannot be read or has an error | the diagnostic of the config reader, with the file and the field | 2 |
| The current checkout is not the main checkout: a lane worktree, or another linked worktree | `celetis-board: start the board in the main checkout: <main>` | 1 |
| The update policy of the selected host has a conflict, or an update still holds the installation after 2 minutes | the line of the check, for example `plugin-update: <path>: Celetis automatic updates are enabled or unknown; …` | 1 |
| The selected Bun fails a check | `celetis-board: runtime does not exist: <path>`, `… is not a regular file: <path>`, `… is not executable: <path>`, or `celetis-board: runtime path has a control character` | 1 |
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

**Open work during updates.** Follow [Updates](../../README.md#updates) for the read-only check,
exact offer, and one affirmative response in an interactive terminal for one target-bound attempt.
Discovery releases its short read lock before foreground execution. Only updaters serialize on
the update mutex; sessions, runners, boards, and daemons may stay open.

The server reads page files on later requests. It runs the server code and the code of the issue
read that it loaded at its start. Native replacement can remove resources that open work still
needs, so a person may reload or restart affected work. Each Run and Resume finds the enabled
copy again. After a Claude update, the next press uses the new Claude copy with no board restart.
Start the board again for its new code. A fresh session loads changed skills; an open session
does not reload them automatically. A change of `board.port` also
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
`types.ts`) with `tracker`, `agents`, `defaultAgent`, `flow`, `noRun`, `runner`, and `issues`.
`docs/celetis-flow.md` of the plugin `celetis`, "The board", gives the value of each field and the
rule that gives each row its state.

Each module of the data path is a static import. So a read loads no file of the plugin, takes no
plugin read lock, and checks no update policy. The board checks the policy once, at its start. Each
Run and Resume starts a new runner process, which makes its own check.

One read runs at a time: a cause of a read during a read joins that read. A read has a limit of 60
seconds. The stop of the board also stops a read that runs. In each case, the `gh` process of that
read ends. When a read fails, the cards of the last good read stay, and the status bar shows
`cannot read:` with one line:

| Cause | Line |
|---|---|
| The main `.celetis.yaml` has an error | The first line of the diagnostic of the config reader |
| The resolver cannot read GitHub | The first line of the stderr of the resolver, else `cannot read the issues from GitHub` |
| The read does not end in 60 seconds | `the issue read did not end in 60 seconds` |
| Another failure | The first line of its message, else `the issue read failed` |

The next good read clears the line.

## The cards

The page has three columns, Needs you, Running, and Idle, a strip of human sessions above them, and
a Done list.

**The sessions.** A session is an agent that herdr found in a pane, whose folder is the main
checkout folder itself, or a lane worktree or a folder in it. That folder is the folder of its
foreground process, else the folder of its pane. An agent of another folder has no card, and this
includes a subfolder of the main checkout. The label of its herdr tab links a session to an issue:
`#<n> <step>` gives the issue `<n>` and the step, `#<n>` alone gives the issue only, and another
label gives no issue. The step word counts only when `flow.lanes` of the document names that step.
Run and Resume give each tab that label, and a tab that you name by hand links its session too. The
time of a session state is the time when the server first saw that state.

A session makes one card, from the state that herdr gives its agent. The main button of a session
card is Go. A session with no issue is a human session: a tab that you started yourself. It has no
card in a column: the strip Human sessions shows it with the same state ("The layout"). The table
gives the column of a session of an issue.

| herdr state | Column | State on the card |
|---|---|---|
| `working` | Running | `works` |
| `blocked`: herdr found an approval or a question dialog | Needs you | `waits for your answer` |
| `idle` or `done`: the agent is ready for the next prompt | Needs you | `turn ended` |
| `unknown`, or a state that the board does not know | Running | `state unknown` |

The state of a session wins over the state of its issue, and an issue with a session has no card of
its own. Two sessions of one issue make two cards. A session card shows the title, the type, the
link, and the pull request of the row of its issue. A human session, and a session whose issue has
no row, show the label of the tab as the title, with no link and no type.

**The issues.** Each row with no session makes one card, from its `state`:

| `state` | Column | State on the card | Act line | Main button |
|---|---|---|---|---|
| `done` | the Done list, with `closedAt` as its time | none | none | none |
| `starting` | Running | `Starting` | none | none |
| `dirty` | Needs you | `dirty tree` | `path` | Open shell |
| `stuck` | Needs you | `no progress` | `act` | Resume, and a quiet Run again |
| `blocked` | Needs you | `reason` | `act` | Open issue, when the row has a `url` |
| `ready` | Needs you when `started` or `urgent`, else Idle | none: the card shows `next <step>` | none | Run |

- A `ready` card shows `auto` when the `gate` of its step is `auto`. The title of Run is
  `Start the <step> step`, plus the `hint` of that step.
- With a `noRun` text, the page shows that text above the columns, and no card has Run or Resume. A
  card that would have Run shows it disabled, and a press repeats the text.
- The lane track of a card is the list of `flow.lanes` for its `type`. A card whose step is not in
  that list has no track.

**The order.** Needs you has the urgent cards first, then the dialogs, then the longest wait first.
Running has the newest first, Idle has the highest number first, and Done has the last close first.
Human sessions has the order of the tab labels, with numbers in numeric order, and two sessions with
one label in the order of their herdr agent ids.

**During a press** of Run or Resume, the page moves the card to Running at once. The card shows
`Starting` with a turning status icon while the board finds the copy and opens the tab. It keeps its
step, so Pipeline shows it at that step. While the request runs, no control of the page sends a
second press for that issue, and the server refuses a second press with 409. After the operation
succeeds, the card stays `Starting` for 30 seconds, or until a row with the state `starting` or a
session of the issue shows. A session wins at each time: its card shows its state and Go. The page
uses no read that started before the request ended, and an older read never replaces a newer one.

When the 30 seconds end, the next request that is not local reads the issues again. With no session
and no `starting` row, the card goes back to its row with the text
`Session not detected. Check the terminal before starting again.` The board does not
stop a process or start a step again. The text stays until a session or a `starting` row shows,
the step of the row changes, the row leaves the states `ready` and `stuck`, or a new press starts.
A press that fails ends the `Starting` card at once, and the next read gives the card its buttons.

## The commands of the board

| Press or read | What the server does |
|---|---|
| The data of the issues | The read of "The data", in its own process, with a limit of 60 seconds. |
| Run | A new herdr tab in the main checkout with the label `#<n> <step>` and no focus. In its pane: the Run line. |
| Resume | The same tab with the focus. In its pane: the Resume line. |
| Open shell | A herdr tab with the focus in the `path` of a `dirty` row, with the label `#<n> shell` and no command. |
| Go | `herdr agent focus <pane>`; then change to the terminal window. |

**The line of a pane.** At each press, the adapter finds the enabled copy of the session's host:
the selected agent for Run, or the host of the saved record for Resume. It checks that
`<copy>/bin/celetis.ts` is a readable regular file, with no control character in its path, and
that its canonical path is outside the main checkout and each lane worktree. It keeps no copy
path between presses (ADR-0039 of the plugin `celetis`).

The adapter makes each line from fixed parts: `/usr/bin/env`, the two
isolation assignments, the selected Bun, its four isolation flags, and the canonical entrypoint.
Run adds `--agent`, the selected agent, and `celetis-flow`. Resume adds `celetis-flow` and
`--resume`, with no agent: the runner takes the host and the session from its saved record. Each
item is in single quotes, and the digits of the number and ` && exit` end the line. The shell of
the pane reads each item as one word, so an item cannot add a second command. For the issue 12 and
the agent `claude`:

```text
'/usr/bin/env' 'BUN_RUNTIME_TRANSPILER_CACHE_PATH=0' 'DO_NOT_TRACK=1' '<bun>' '--no-env-file' '--no-install' '--config=/dev/null' '--no-macros' '<copy>/bin/celetis.ts' '--agent' 'claude' 'celetis-flow' 12 && exit
'/usr/bin/env' 'BUN_RUNTIME_TRANSPILER_CACHE_PATH=0' 'DO_NOT_TRACK=1' '<bun>' '--no-env-file' '--no-install' '--config=/dev/null' '--no-macros' '<copy>/bin/celetis.ts' 'celetis-flow' '--resume' 12 && exit
```

`&& exit` closes the tab when the command ends with no error. A command that fails leaves the tab
open with its message.

On Windows, the default pane shell of herdr is Windows PowerShell 5.1. There the line sets the two
isolation variables with `$env:` in place of `/usr/bin/env`, starts the selected Bun with `&`,
doubles `'` and each of U+2018 to U+201B in a quoted item, and ends with `; if ($?) { exit }` in
place of ` && exit`, with the same result. Its null device is `os.devNull`: `--config=\\.\nul`.

**The default agent is read-only.** The footer shows `defaultAgent` of the document, or
`No default agent` before the first good read. `defaultAgent` is the host that the engine selects
for a new step: `CELETIS_AGENT`, then `host` of the main `.celetis.yaml`, then `claude`. The
`--agent` of the board start does not set it. Its menu and the command palette show one unavailable
entry, `Default agent is read-only`. Activate it to see the reason:
`The main .celetis.yaml controls the default agent. Change host there.`
These controls send no request and change no configuration.

To use another available agent for one Run, use the card's agent choices. A Run without a choice
uses the current `defaultAgent`. A choice for one Run does not change that default. Resume sends
only the issue number, and the runner selects the saved session.

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
first tab of the new workspace. A Run or a Resume line then runs in the first pane of that
workspace. Each press keeps its folder, its focus, and its label in the two cases:

| Press | Folder (`--cwd`) | Focus | Label | Calls | Calls with no workspace |
|---|---|---|---|---|---|
| Run | the main checkout | none: `--no-focus` | `#<n> <step>` | `workspace list`, `tab create`, `pane run` | `workspace list`, `workspace create`, `tab rename`, `pane run` |
| Resume | the main checkout | the new tab | `#<n> <step>` | the same three, with the Resume line | the same four, with the Resume line |
| Open shell | the `path` of the row | the new tab | `#<n> shell` | `workspace list`, `tab create` | `workspace list`, `workspace create`, `tab rename` |

So an Open shell press with no workspace makes three calls, and it makes the workspace of the
repository in the dirty lane worktree, not in the main checkout.

**The reads.** While the page is in view, it asks the server each 5 seconds. While its tab is
hidden, it asks each 15 seconds with `?local=1`, so the tab title, the tab icon, and the
notifications stay true. The server reads the issue data for five causes only: the timer of the
server; the last read started more than 60 seconds before a request that is not local; a session
that had a card at the last request has no card at this one (not at a local request); a press of Run
or Resume; and a press of Refresh. The timer checks when the server starts to listen, and then 5
minutes after the start of the last read, for each cause. When the last read started 5 minutes ago
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
`/api/run`, `/api/resume`, and `/api/shell`, `{"sessionId": "<id>"}` to `/api/go`, and `{}` to
`/api/refresh`. A Run body can also have `"agent": "<name>"`. The server refuses a press with 409
and opens no tab, unless each condition holds:

| Press | Conditions | Line of the refusal |
|---|---|---|
| `POST /api/run` | The issue has a card of its own, with no session. Its row is `ready` or `stuck`. `noRun` is `null`. No press on that issue is active. | `#<n> has no step to start now` |
| `POST /api/resume` | The issue has a card of its own, with no session. Its row is `stuck`. `noRun` is `null`. No press on that issue is active. | `#<n> has no session to resume now` |
| `POST /api/shell` | The issue has a card of its own, with no session. Its row is `dirty`. Its `path` is a lane worktree of the main checkout. | `#<n> has no dirty worktree` |

These checks of Run and Resume also refuse with 409 before tab creation or pane execution.
Read-only `herdr` status calls can precede the failure:

- **The copy of the host.** A lookup failure gives the first line of the error, for example
  `celetis: Codex has no enabled celetis@celetis installation; install and enable the plugin in Codex`
  or `celetis: Claude installation is ambiguous; keep one enabled Celetis root for this project`.
  Resume also refuses a missing or invalid saved record, or a record with no verified session ID,
  with the first line of its error.
- **The found entrypoint.** A failed check gives `package entrypoint does not exist: <path>`,
  `… is not a regular file: <path>`, `… is not readable: <path>`, `… path has a control character`,
  `… is inside the main checkout`, or `… is inside a lane worktree`.
- **The agent of Run.** The agent is the choice, else `defaultAgent`. It must be a name of lowercase
  letters that `agents` of the last document has. A choice that is not gives
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
| 400 | The body is not JSON, the body has more than 1024 characters, or the number of the issue is not digits. |
| 403 | The `Host`, the `Origin`, or the content type is not good ("The trust boundary"). |
| 404 | The path is not a path of the board, or Go names a session that is no herdr agent of the repository. |
| 409 | A condition of the table does not hold, the host copy lookup or entrypoint check fails, Resume has no valid saved session, the agent of a Run is not good, the agent of a Go press has no safe pane id, or the request tries to change the default agent. |
| 502 | A `herdr` call failed: the first line of its error. `herdr gave no id for the workspace`, `herdr gave no id for the new tab`, and `herdr gave no pane for the new tab` are the lines for an answer of herdr with an id that is not safe. |
| 500 | The server failed for another cause: the first line of the error, or `the server failed`. |

## The trust boundary

A Run press starts the runner of the plugin in a herdr pane. Eleven rules hold for the server and
the page:

1. The server listens on `127.0.0.1` only.
2. It refuses, with 403, a request whose `Host` is not `127.0.0.1:<port>` or `localhost:<port>`.
3. It refuses, with 403, a POST whose `Origin` is not `http://` and that `Host`, or whose content
   type is not `application/json`.
4. It accepts only digits, as a number or a string, as the number of an issue, and only the terminal
   id of a herdr agent of the repository as the id of a session.
5. The page sends an issue number, a session id, or a selected Run agent, never a command.
   Resume takes only the issue number. A default-agent request changes no configuration.
6. An id of the answer of herdr (a workspace, a tab, a pane) goes into a `herdr` command only when
   it has letters, digits, `_`, `:`, `.`, and `-`, and does not start with `-`. An id that is absent
   goes into no command.
7. The server starts `herdr` and `git` with no shell, and the issue read starts `gh`, `git`, and,
   on macOS and Linux, `ps` with no shell.
8. It runs `git` only in the main checkout or in a lane worktree. The `git diff` of a session runs
   with `--no-optional-locks`, so it writes nothing.
9. Open shell refuses a path that is not under `.claude/worktrees/` of the main checkout.
10. The server writes nothing in a working tree.
11. The page writes each text of the data, of a pane, and of an error as text, never as HTML. Its
    Content-Security-Policy allows its own files (the page, its five scripts, its stylesheet, and
    its two fonts) and `data:` images (the tab icon) only.

Five rules hold for the start, the lines, and the data:

1. **The start checks only the runtime; each press checks its entrypoint.** The selected Bun is
   an executable regular file. Each press finds the enabled copy of its session's host. Its
   entrypoint is a readable regular file, with its canonical path outside the main checkout and
   each lane worktree. Neither path holds a control character. The page, the data, and a lane
   cannot supply a command path.
2. **A press types one of two fixed lines.** Run and Resume start the runner of the enabled
   copy of the session's host with the selected Bun ("The line of a pane"). The server starts
   `herdr` and `git`, and the issue read starts `gh`, `git`, and, on macOS and Linux, `ps`. Native
   host discovery starts `claude` or `codex` with no shell. No other program starts.
3. **Only validated values go into a line.** The number is the digits of the issue. The agent of
   Run is a name of lowercase letters that `agents` of the last document has. Resume takes no
   agent. No title, no reason, no act, no path of the data, and no step goes into the line of a
   pane. A step name goes into one argument of `herdr`, the tab label, with no shell and with
   lowercase letters only.
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
  and of Done, the search, and Refresh. The title of the browser tab is
  `(<n>) <folder> · Agent board` while `<n>` cards need you, and the tab icon has an orange dot
  then; it has a blue dot while an agent of an issue works and nothing needs you.
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
  the keys of the focused card, the count of Done (a press opens the list of the issues that the
  data gives as done), the Notify switch, and the list of keys.
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
  `The board server does not answer. The cards show the last good read.`
- A card that changes its column moves to its new place. The page shows no motion when the OS asks
  for reduced motion.
- Below 1100 px Needs you takes the left half and Running and Idle share the right half, and the
  page scrolls as one document; it also scrolls as one document at a height of 700 px or less. Below
  720 px the columns stack.
- The page keeps three choices in the storage of the browser: the view, the Notify switch, and the
  switch of the single-key shortcuts. A board on another port has its own choices.

**The keys.** `⌘K` (`Ctrl K` off macOS) or `/` opens the search: it lists the issue work that needs
you first, then the running cards, the steps that can start, the human sessions (a waiting one
too), the Done issues, and the commands of the board. `#<n>` jumps to an issue, and `<n>` alone also
finds a human session whose tab label is `<n>`. `j` and `k` move to the next or the previous card,
`h` and `l` to the column on the left or the right; `Enter` presses the main button of the card,
`Space` opens its details, `m` opens all its actions, `o` opens the issue, and `c` copies the
command or the path of the card. `v` changes between Now and Pipeline, `d` shows or hides Done, `r`
reads the issues again, and `?` shows the list. The list has a switch that turns the single-key
shortcuts off; the keys of a focused card always work, and the arrow keys move from a focused card
as `h`, `j`, `k`, and `l` do. After a Run or Resume press, the focus stays on the card of the
issue in Running. A press in the details keeps the focus in the details: on the same button, or on
Close when that button goes.

After the first good read, the page writes the name of the tracker in its texts:
`Open the issue on <tracker>` and `Read <tracker> again`. Before that read, and in the list of keys,
the texts are `Open the issue` and `Read the issues again`.

**The errors.**

- When a press fails, a toast names the press (`Go failed`, `Run failed`, `Resume failed`,
  `Open shell failed`, `Refresh failed`) above the line of the server. After Go, Open shell, or
  Refresh, the card keeps its button. A failed Run or Resume ends its `Starting` card. This covers a herdr server that does not run, a `herdr` that is not on `PATH`, and a press
  that the server refuses.
- The status bar shows `herdr down` when `herdr api snapshot` fails, with the error in its title.
  The board then shows no session card, and the issue cards stay.
- The status bar shows `cannot read:` with one line when the last read of the issues failed ("The
  data"). The cards of the last good read stay.
- The status bar shows `The board server does not answer` when a request of the page failed. A
  press at that time gives a toast with that text and `Start the board again in a terminal.`
- The `noRun` text, the message of a server that does not answer, and each toast are alerts for a
  screen reader.

## Versions

- **The board has no version of its own.** A plugin update gives a new board at its next start
  ("Start").
- **The document has no version.** The board and the engine are one package, and the compiler
  checks the `Document` type between them.

Browser sources are `board.ts`, `view.ts`, `ui.ts`, `panel.ts`, and `palette.ts`. The pinned Bun
1.4.4 build program, `<plugin>/scripts/build.ts`, generates their existing `.js` and `.mjs` URLs.
It compiles every target before it writes any output. Plugin users run no build.

## Limits

Of the distribution:

- A start from a program with no terminal, for example a launch entry of a desktop app, needs
  `bun`, `gh`, and `herdr` on the `PATH` of that program. This is not checked. When such a start
  fails, start the board in a terminal.
- The board checks the plugin update policy at its start only. A conflict that starts while the
  board runs shows in the pane of the next Run or Resume, not on the status bar.

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
- The board needs a herdr server that runs. A press of Run, Resume, or Open shell without one gives
  a toast, and the status bar shows `herdr down`.
- A Go press focuses the pane inside herdr. It does not bring the terminal window to the front.
- herdr states no compatibility policy for its CLI, and minor releases had breaking changes. The
  board was checked against herdr 0.9.3 (protocol 22).
- Two repositories whose main checkout has the same folder name share one herdr workspace label.
- The shell of a herdr pane is sh, bash, or zsh, or Windows PowerShell on Windows: the board quotes
  each item of a pane line for those shells. In a fish pane, an item that ends in `\` does not
  close its quote. Windows PowerShell 5.1 drops an empty item, and it passes an item with `"`, or
  with a space and a trailing `\`, wrongly. A `.cmd` or `.bat` first item parses `&`, `^`, and `%`
  again. The two fixed lines have none of these Windows forms.
- `&& exit`, or `; if ($?) { exit }` on Windows, closes the tab of a command that exits 0. A runner
  that prints a message and exits 0 thus leaves no message: start `celetis-flow <n>` in a terminal
  to see it.

Of the cards and the page:

- The board does not show the `step` of a `blocked` row: such a card is in Not in a step of Pipeline
  and has no lane track.
- Before the first good read, Pipeline has no stage column: the strip Not in a step holds each
  session of an issue.
- Two presses on one issue through two controls can make two tabs when the `git diff` of a session
  folder is slower than the start of a session. One press at a time is safe.
- A start of the server forgets the times of the Run and Resume presses.
- The count of changed lines is against `origin/HEAD`. A clone with no `origin/HEAD` shows no count.
- A notification shows only while the page is open in a tab. A browser that throttles a hidden tab
  can delay it by up to a minute.
- The page has no login. Each program on the machine can ask the server.
- The lane icons are the one place where the page knows four names of a flow. They change no rule.
