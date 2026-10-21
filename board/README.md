# agent-board

The agent board is one local web page for one git repository. It shows each live agent session of
the repository and each issue of its flow, and it starts a step of an issue with one press. No card
moves by hand.

**Terms.**

- **Flow:** the rules of a repository for the work on an issue: its lanes, the steps of each lane,
  and the commands that start a step. The data gives the lanes, the steps, the stages, and the
  gates to the board, and the config names the commands.
- **Lane:** one type of issue, for example `feature` or `bug`, with the list of its steps in order.
- **Step:** one part of the work on an issue, which one agent session does, for example `plan`.
- **Stage:** one column of Pipeline, the view of the page that shows each issue at its step. A stage
  holds steps of the lanes.
- **Gate:** the rule of a step that says who starts it. `me` is your press of Run, and `auto` is the
  automatic runner. The board shows `auto` on such a step, and it starts no step by itself.
- **Runner:** the program of the repository that starts the sessions of the steps and knows how
  each one ended. An automatic runner starts each step with the gate `auto` by itself. The states
  `starting` and `stuck` and the field `runner` come from a runner: a producer of a repository with
  no runner gives none of them.
- **Producer:** the script of the repository that prints the document of contract 1.
- **Trunk:** the default branch of the repository. The count of the changed lines of a session is
  against it (`origin/HEAD`). The board takes the main checkout as the checkout of the trunk: its
  files have the trust of the config, and the branch of an issue is in a lane worktree.

The board has two inputs, and it holds no step, no stage, and no tracker name of its own:

- **The sessions** come from herdr (`herdrdev/herdr`), the terminal program in whose panes the
  agents run. A repository sets nothing for them.
- **The issues** come from one JSON document with a version, contract 1. A command of the repository
  prints it. The config names that command. The board reads the config from
  `.claude/celetis-flow/board.json` or, with `--config-stdin`, from stdin.

The package is one Node program with no dependency, no build step, and no lifecycle script, so `npx`
runs it with no install step. No file of the board is in the repository that it shows. The package
has these five command forms:

| Form | Config source | Result |
|---|---|---|
| `agent-board` | The optional file `.claude/celetis-flow/board.json`. | Start the server. |
| `agent-board --config-stdin` | One JSON config from stdin. | Start the server after EOF. |
| `agent-board check` | The optional config file. | Run `data` and check its output. |
| `agent-board check --config-stdin` | One JSON config from stdin. | After EOF, run `data` and check its output. |
| `agent-board check --stdin` | No config. | Check one contract 1 document from stdin, in any folder. |

**Requirements.**

- macOS or Linux.
- Node 22 from 22.18, or Node 24.2 or later, with `npx`. On each other Node, for example Node 20 or
  Node 23, the entry prints `agent-board: Node 22.18, or Node 24.2 or later, is necessary` and
  exits 1.
- git 2.31 or later.
- git credentials for GitHub, because the repository of the package is private ("Start").
- herdr 0.9 or later on `PATH` and a herdr server that runs, for the session cards and for each
  button.
- The lane worktree of the issue `<n>` at `<main>/.claude/worktrees/<n>-<slug>`, where `<main>` is
  the main checkout. This layout has no setting: an agent in a worktree at another place has no
  card.
- A Chromium browser. The page is checked in Chromium browsers only.

The tools that the scripts of a config need are a requirement of that repository, not of the
package.

## Start

Run this command in the main checkout of the repository, and open the URL that it prints:

```bash
npx 'github:ddinkov10/agent-board#semver:^2'
```

The command resolves the newest tag of major version 2 and runs it.

A config can come from stdin. This example starts the board with session cards only:

```bash
printf '%s\n' '{}' | npx 'github:ddinkov10/agent-board#semver:^2' --config-stdin
```

The board waits for EOF before it uses the config or listens on a port. It reads the input once
and creates no config file. With `--config-stdin`, it does not inspect or read `board.json`; the
file's absence, contents, and permissions have no effect. The checkout rules below still apply.

- **The quotes are necessary.** `#` and `^` are glob characters in zsh with `EXTENDED_GLOB`.
- **Give `github:` in each form.** `npx agent-board`, with no `github:`, asks the public npm
  registry for a package with that name. This package is not there, and another package can take
  the name: do not run that command.

Three forms select the code:

| Command | What runs |
|---|---|
| `npx 'github:ddinkov10/agent-board#semver:^2'` | The newest tag of major version 2. |
| `npx github:ddinkov10/agent-board` | The head of the default branch. |
| `npx 'github:ddinkov10/agent-board#<commit>'` | One fixed commit. A tag can move, and a commit cannot. |

**The port** is `PORT` of the environment, else `port` of the config, else 4403. A `PORT` that is no
number, or that is `0`, counts as absent. The server listens on `127.0.0.1` only. Each repository
has the default port 4403, so a second board on one machine exits 1 at its start. Give it another
port, with `"port": 4404` in its `board.json` or with `PORT`:

```bash
PORT=4404 npx 'github:ddinkov10/agent-board#semver:^2'
```

**npm 12** refuses a git spec by default. The command is then:

```bash
npx --allow-git=root 'github:ddinkov10/agent-board#semver:^2'
```

One line `allow-git=root` in `~/.npmrc` does the same for each start. When npm 12 refuses the
command with that value, the second form is `allow-git=all`. The build of this package did not run
npm 12 ("Limits").

**The credentials.** The repository of the package is private, and npm gets its code with git. git
cannot ask for a password in that call. So the machine needs git credentials for GitHub that need
no prompt: an ssh key, or a credential helper for https.

**The first start** in a terminal asks `Ok to proceed?`. `npx --yes` answers it:

```bash
npx --yes 'github:ddinkov10/agent-board#semver:^2'
```

**The start prints** the main checkout, each command of the config, and the URL:

```text
agent-board: repository /Users/me/code/shop
agent-board: data    /Users/me/code/shop/scripts/flow.sh --board
agent-board: run     /Users/me/code/shop/scripts/flow.sh {n}
agent-board: resume  /Users/me/code/shop/scripts/flow.sh --resume {n}
agent-board: http://127.0.0.1:4403
```

A line `data`, `run`, or `resume` shows only for an entry that the config has, with the absolute
path of the file that the board starts. With no config, the start prints the first line and the last
line. Read these lines: they are the commands that a read and a press start.

**A start that fails** prints one line on stderr and nothing on stdout. The entry makes these
checks in this order:

| Case | Line | Exit |
|---|---|---|
| The Node is not 22 from 22.18, and not 24.2 or later | `agent-board: Node 22.18, or Node 24.2 or later, is necessary` | 1 |
| The arguments are not one of the five forms above, in that exact order | `usage: agent-board [--config-stdin \| check [--config-stdin \| --stdin]]` | 2 |
| The current folder is in no git checkout | `agent-board: the current folder is not in a git checkout` | 1 |
| The git directory is not the folder `.git` of its parent: a bare repository, a submodule, or the folder `.git` itself | `agent-board: the git directory is not the folder .git of a checkout (a bare repository or a submodule)` | 1 |
| The current checkout is not the main checkout: a lane worktree, or another linked worktree | `agent-board: start the board in the main checkout: <main>` | 1 |
| The file config has an error ("The config") | `agent-board: .claude/celetis-flow/board.json: <message>` | 1 |
| Config stdin cannot be read, or its config has an error | `agent-board: config stdin: <message>` | 1 |
| The port is in use | `agent-board: cannot listen on 127.0.0.1:<port>: the port is in use` | 1 |
| The server cannot listen for another cause, for example `PORT=99999` | `agent-board: cannot listen on 127.0.0.1:<port>: <the message of Node>` | 1 |

Rows 3 to 5 are the three start rules. The main checkout is the parent folder of the git common
directory of the current folder (`git rev-parse --path-format=absolute --git-common-dir`). A start
in a subfolder of the main checkout, or through a symbolic link to it, finds the main checkout.
Both config sources use these rules before they read the config. `check --stdin` reads issue
data, so it skips the checkout and config checks.

**Start the board in the main checkout only.** `npx` reads `.npmrc` of the start folder (for
example `node-options`, `script-shell`, and `git`), and it puts each `node_modules/.bin` folder of
the start folder and of its parent folders first on `PATH`. In the main checkout, those are files of
the trunk, with the trust of the config. A lane worktree holds the files of a branch, which do not
have that trust. The entry refuses a start in a checkout that is not the main checkout, and it
removes each `node_modules/.bin` item from `PATH` before the server starts `herdr` or `git`. But the
refusal comes after npm read the `.npmrc`: do not run the `npx` command in a lane worktree.

**A new start is necessary** to change the config, and for a new release of the package.
The server reads its selected config source once, at its start. A change of `board.json` after
startup has no effect, including when stdin supplied the config. Stop the server with `Ctrl C`
and run the command again, with new stdin if that is the source. At each start, `npx` resolves
the spec again, and it gets the code again when the commit that
it resolved is not the commit of its copy in `~/.npm/_npx`. So a new start of the pinned command
runs the newest tag of major version 2.

**After a new release, start each running board again.** A server keeps the server code that it
loaded, but it reads each file of the page at each request from the copy of `npx`, and `npx` keeps
one copy of the pinned spec for all the repositories of the machine. So when a start of the pinned
command gets a new release, in this repository or in another one, and also for `check`, each board
that still runs serves the new page with the old server code until its next start.

## Two modes

| The config has | The board shows |
|---|---|
| no `data` entry, including an absent file in file mode | The session cards only: the state, the pane lines, the changed lines, and Go. |
| `data` | The session cards and the issue cards. |
| `data` and `run` | Also Run, on each card that can start a step. |
| `data` and `resume` | Also Resume, on each card with no progress. |

With no `data`, the status bar says `no issue data: set "data" in .claude/celetis-flow/board.json`,
a session has no step, and Pipeline has no stage column. `run` and `resume` have an effect only
with `data`, because Run and Resume are buttons of an issue card.

In file mode, a repository with no config file gets a board at once: start the command, and name
a herdr tab `#<n>` to link its session to the issue `<n>`.

## The config

The config is one JSON object. The default source is `.claude/celetis-flow/board.json` of the
main checkout. `--config-stdin` selects stdin as the only source, with the same keys and command
rules. It does not merge with the file or fall back to it, and it writes no generated file.
Ordinary whitespace can surround the object. The complete input must end before validation,
producer execution, or server startup begins.

```json
{
  "data": ["scripts/flow.sh", "--board"],
  "run": ["scripts/flow.sh", "{n}"],
  "resume": ["scripts/flow.sh", "--resume", "{n}"],
  "port": 4403
}
```

| Key | Value | What it names |
|---|---|---|
| `data` | a list of strings with one item or more | The command that prints the document of contract 1 on stdout. |
| `run` | a list of strings with one item or more, with `{n}` and optional `{agent}` | The command that starts the next step of the issue `{n}`. Run types it into a new herdr pane. |
| `resume` | a list of strings with one item or more, with `{n}` | The command that opens the session of the step of the issue `{n}` again. Resume types it into a new herdr pane. |
| `port` | an integer from 1024 to 65535 | The port of the server when `PORT` is not set. |

- Each key is optional. A file that is absent is no error in file mode. `{}` is a good config in
  both modes: the board starts with the session cards only. Empty or whitespace-only stdin is
  not JSON.
- The first item of a list is a path relative to the main checkout. After the board resolves each
  symbolic link, the path must be a regular file that the user can execute, inside the main checkout
  and outside `<main>/.claude/worktrees/`. The board keeps the absolute path that it resolved, and
  it starts that path.
- In file mode, the same rule holds for `board.json` itself: after the board resolves each symbolic
  link, it is a regular file inside the main checkout and outside `<main>/.claude/worktrees/`.
- In `run` and `resume`, an item that is exactly `{n}` stands for the number of the issue. Each of
  the two lists has that item one time or more, after its first item. In `run` only, an item that
  is exactly `{agent}` stands for the selected Run agent. These are complete items: `x{n}` and
  `--agent={agent}` are refused. `resume` permits only `{n}`. `data` has no placeholder: an item
  of `data` with `{` or `}` is refused.
- No item, and no path that the board resolved, holds a control character (U+0000 to U+001F, and
  U+007F). herdr types the line of Run and Resume into a pane, and a control character is a key
  there.
- An item is one argument of the command. The board starts the `data` list with no shell, and it
  puts each item of the `run` and the `resume` line in single quotes ("The commands of the board").
  So no variable, no `~`, and no pattern of an item is expanded.
- The server reads the selected config source once, at its start, from the main checkout only.
  A new config needs a new start. A producer remains free to print new issue data on each read.

**A `run` or a `resume` command** gets the number of the issue in place of `{n}`. `run` also gets
the selected agent in each exact `{agent}` item when the config has one. Neither command gets
a step, so it finds the step of that issue itself. The board types the command into the first pane
of a new herdr tab, whose folder is the main checkout and whose label is `#<n> <step>`. ` && exit`
follows the command, so the tab closes when the command exits 0. A `run` command must start the
session of the step of that issue in that pane, and a `resume` command must open that session again
there: the label of the tab links the session to the issue. Without `{agent}`, the `run` command
names the agent itself. Resume has no `{agent}` substitution and no added host prefix.

**The default agent belongs to the producer.** The footer shows the producer's `defaultAgent`,
or `No default agent` when it supplies none. Its menu and the command palette show one unavailable
entry, `Default agent is read-only`. Activate it to see the reason:
`The producer controls the default agent. Change it in the producer configuration.`
These controls send no request and change no configuration.

To use another available agent for one Run, use the card's agent choices. With `{agent}` in the
run command, a Run without a choice uses the current producer default. A choice for one Run
does not change that default. Resume still sends only the issue number to the configured resume
command, which selects the saved session.

**The refusals.** For each error of the config, the start fails with one line,
`agent-board: .claude/celetis-flow/board.json: <message>` in file mode, or
`agent-board: config stdin: <message>` in stdin mode, and exit 1. The two config-based `check`
forms use the same rules. The line names the first error only, with no stack trace.

| Message | Cause |
|---|---|
| `the file is not JSON` / `the input is not JSON` | The selected config text is not JSON. |
| `the file is not a JSON object` / `the input is not a JSON object` | The JSON is a list, a string, a boolean, a number, or `null`. |
| `the file is not a regular file` | `board.json` is a folder, or a symbolic link to no file. |
| `the file resolves to a place outside the main checkout` | `board.json` is a symbolic link to a file outside the main checkout. |
| `the file resolves into a lane worktree` | `board.json` is a symbolic link to a file under `<main>/.claude/worktrees/`. |
| `"<key>" is not a key of the config` | The config has a key that is not `data`, `run`, `resume`, or `port`. |
| `"<key>" is not a list of strings with one item or more` | `data`, `run`, or `resume` is no list, is an empty list, or has an item that is no string. |
| `"<key>": the first item is an absolute path` | The first item starts at the root, for example `/bin/sh`. |
| `"<key>": the first item has a ".." part` | The first item has a part `..`, for example `scripts/../../x`. |
| `"<key>": an item or a path has a control character` | An item, or the path that the board resolved, holds U+0000 to U+001F, or U+007F. |
| `"data": an item has "{" or "}"` | An item of `data` holds a brace. |
| `"<key>": an item has "{" or "}" and is not {n}` | A brace item is not exactly `{n}`, or `{agent}` in `run` only; for example `{step}` or `x{n}`. |
| `"<key>" has no {n} item` | `run` or `resume` has no item `{n}` after its first item. |
| `"<key>": <first item> does not exist` | The path of the first item names no file. |
| `"<key>": <first item> resolves to a place outside the main checkout` | The first item is a symbolic link to a file outside the main checkout. |
| `"<key>": <first item> resolves into a lane worktree` | The first item is a file under `<main>/.claude/worktrees/`, or a symbolic link to one. |
| `"<key>": <first item> is not a regular file` | The first item is a folder. |
| `"<key>": <first item> is not executable` | The user cannot execute the file. |
| `"port" is not an integer from 1024 to 65535` | `port` is outside the range, is no integer, or is a string. |
| the message of the system, for example `EACCES: permission denied, open '<path>'` | The selected config source cannot be read. |

A board refuses a key that it does not know, so a later setting cannot be a silent change.

**Three values have no setting** in version 2:

- A lane worktree is `<main>/.claude/worktrees/<n>-<slug>`.
- The herdr workspace label is the folder name of the main checkout.
- The changed lines of a session come from
  `git --no-optional-locks -C <folder> diff --shortstat --merge-base origin/HEAD`.

## Contract 1

The input is one JSON document that the `data` command prints on stdout, with exit 0. A producer is
the script that prints it: it reads the tracker of the repository and gives each issue one state.
The board owns six states, the columns, the groups, and the order. The data owns each other word:
the lanes, the steps, the stages, the reasons, and the name of the tracker.

The board checks each document before it uses it. With a document that fails the check, or an exit
that is not 0, the cards of the last good read stay. The status bar then shows `cannot read:` and
the first cause: the place and the rule of the first failure, or the first line of stderr, else of
stdout, else `the data command exited <code>`. stdout holds the document only: a text line before
the JSON gives `cannot read: the data is not JSON`.

**The document**

| Field | Type | Meaning |
|---|---|---|
| `contract` | integer, required | The version of the contract: `1`. |
| `tracker` | string with one character or more, required | The name of the tracker in the texts of the page: `GitHub`, `Plane`. |
| `flow.lanes` | object, required | Each lane key with the list of its steps, in order. A list has one step or more, and it has a step one time only. |
| `flow.stages` | array, required | The columns of Pipeline in order. Each item is `{"name": <string>, "steps": [<step>, …]}`. A step is in the stages one time at most. |
| `flow.steps` | object | A step name with `gate` (`"me"` or `"auto"`) and `hint`, one sentence that the title of Run adds. Each part is optional. |
| `noRun` | string with one character or more, or null | The reason why no step can start now. The page shows it above the columns, and no card has Run or Resume. |
| `runner` | boolean or null | `true` while an automatic runner of the repository runs. `null`, or no field, hides the item of the status bar. |
| `issues` | array, required | One row for each issue that has a card. An issue that gets no card has no row. |

**A row of `issues`**

| Field | Type | Meaning |
|---|---|---|
| `number` | integer from 1, required | The number of the issue. |
| `title` | string, required | The title of the issue. |
| `url` | string or null | The page of the issue. It must start with `https://` or `http://`. |
| `type` | a lane key, or null | `null` is an issue with no lane yet. |
| `state` | one of six, required | See "The six states". |
| `step` | a step name, or null | The step that is next, or that runs. Required for `ready` and `stuck`. |
| `started` | boolean | An earlier step of the lane ran. A `ready` issue then goes to Needs you. An absent field counts as `false`. |
| `urgent` | boolean | The card is first in Needs you, and a `ready` issue goes there. An absent field counts as `false`. |
| `updatedAt` | ISO 8601 time, required | The time of the last change of the issue. The card shows its age from this time. |
| `closedAt` | ISO 8601 time, or null | Required for `done`: the time of the card in the Done list. |
| `path` | absolute path, or null | Required for `dirty`: the path of the dirty lane worktree. Open shell opens only a path under `<main>/.claude/worktrees/`. |
| `reason` | string with one character or more, or null | Required for `blocked`: the short label of the card, for example `needs info`. |
| `act` | string or null | The act of the maintainer: a sentence for `blocked`, or a command to copy for `stuck`. |
| `pr` | object or null | `{"number", "url", "draft", "checks", "review"}`: `checks` is `"pass"`, `"fail"`, `"pending"`, or `null`, and `review` is `"approved"`, `"changes"`, `"required"`, or `null`. A repository with no pull request gives `null`. |

**The six states.** The board owns this list.

| `state` | Meaning | Field that the state needs |
|---|---|---|
| `ready` | The next step of the issue can start. | `step` |
| `starting` | A runner holds the issue, and its session does not show yet. | none |
| `stuck` | The last run of the step made no progress. | `step` |
| `dirty` | The lane worktree of the issue has changes that are not committed. | `path` |
| `blocked` | The issue waits for an act of the maintainer. | `reason` |
| `done` | The issue is finished. | `closedAt` |

**The other rules.**

- A field that is not required can be absent. An absent field is the same as `null`, and the same
  as `false` for `started` and `urgent`.
- A lane key and a step name have lowercase letters only (`^[a-z]+$`): they go into the tab label
  and into class names of the page.
- `type` is a key of `flow.lanes`. `step`, each step of `flow.stages`, and each key of `flow.steps`
  is a step of one lane or more. A `step` can be outside the lane of its `type`, and a step can be
  in two lanes.
- Each `number` is in one row only, and it is a safe integer.
- A time has the date, `T`, the time with seconds, and a zone: `Z`, or an offset in the form
  `±hh:mm` with the colon. `2026-10-11T20:00:00+02:00` passes. `2026-10-11T20:00:00+0200` fails, and
  `date +%z` prints the offset in that form with no colon. A fraction of the seconds is optional. A
  date alone, and a time with no zone or no seconds, fail too.
- In `pr`, `number` is an integer from 1 and `draft` is a boolean, and the two are required. `url`
  follows the rule of `url`.
- The producer selects the issues that it gives as `done`: the Done list shows each one.
- The board ignores a field that it does not know.

**An example**, with three issues:

```json
{
  "contract": 1,
  "tracker": "GitHub",
  "flow": {
    "lanes": {
      "feature": ["triage", "specify", "plan", "implement"],
      "bug": ["triage", "bug", "plan", "implement"],
      "chore": ["triage", "chore"],
      "hotfix": ["triage", "hotfix"]
    },
    "stages": [
      {"name": "Triage", "steps": ["triage"]},
      {"name": "Define", "steps": ["specify", "bug", "chore", "hotfix"]},
      {"name": "Plan", "steps": ["plan"]},
      {"name": "Implement", "steps": ["implement"]}
    ],
    "steps": {
      "triage": {"gate": "me"},
      "specify": {"gate": "me"},
      "bug": {"gate": "me"},
      "chore": {"gate": "me", "hint": "It lands the change when the build is done."},
      "hotfix": {"gate": "me", "hint": "It lands the change when the build is done."},
      "plan": {"gate": "me"},
      "implement": {"gate": "me", "hint": "It lands the change when the build is done."}
    }
  },
  "noRun": null,
  "runner": false,
  "issues": [
    {"number": 12, "title": "The cart keeps its items after a login",
     "url": "https://github.com/me/shop/issues/12", "type": "feature",
     "state": "ready", "step": "plan", "started": true,
     "updatedAt": "2026-10-11T18:00:00Z", "closedAt": null, "pr": null},
    {"number": 9, "title": "A price shows two currency signs",
     "url": "https://github.com/me/shop/issues/9", "type": "bug",
     "state": "blocked", "reason": "needs info",
     "act": "Answer the questions on the issue, then remove the label.",
     "updatedAt": "2026-10-10T09:00:00Z", "closedAt": null, "pr": null},
    {"number": 7, "title": "The search has a filter for the colour",
     "url": "https://github.com/me/shop/issues/7", "type": "feature",
     "state": "done", "updatedAt": "2026-10-11T15:00:00Z", "closedAt": "2026-10-11T15:00:00Z", "pr": null}
  ]
}
```

`fixtures/contract-1.json` of the package is a document of the same shape, and the tests of the
package use it. `fixtures/producer.sh` is the model of a producer: a file that the user can execute,
which prints one document on stdout and exits 0.

```sh
#!/bin/sh
cat "$(dirname "$0")/contract-1.json"
```

A producer of a repository reads its tracker in place of the file. Name it as `data` in the config,
and check its output with `agent-board check` ("`check`").

## The cards

The page has three columns, Needs you, Running, and Idle, and a Done list.

**The sessions.** A session is an agent that herdr found in a pane, whose folder is the main
checkout folder itself, or a lane worktree or a folder in it. That folder is the folder of its
foreground process, else the folder of its pane. An agent of another folder has no card, and this
includes a subfolder of the main checkout. The label of its herdr tab links a session to an issue:
`#<n> <step>` gives the issue `<n>` and the step, `#<n>` alone gives the issue only, and another
label gives no issue. The step word counts only when `flow.lanes` of the data names that step. Run
and Resume give each tab that label, and a tab that you name by hand links its session too. The time
of a session state is the time when the server first saw that state.

A session makes one card, from the state that herdr gives its agent. The main button of a session
card is Go.

| herdr state | Column | State on the card |
|---|---|---|
| `working` | Running | `works` |
| `blocked`: herdr found an approval or a question dialog | Needs you | `waits for your answer` |
| `idle` or `done`: the agent is ready for the next prompt | Needs you | `turn ended` |
| `unknown`, or a state that the board does not know | Running | `state unknown` |

The state of a session wins over the state of its issue, and an issue with a session has no card of
its own. Two sessions of one issue make two cards. A session card shows the title, the type, the
link, and the pull request of the row of its issue. A session with no issue, and a session whose
issue has no row, show the label of the tab as the title, with no link and no type.

**The issues.** Each row with no session makes one card, from its `state`:

| `state` | Column | State on the card | Act line | Main button |
|---|---|---|---|---|
| `done` | the Done list, with `closedAt` as its time | none | none | none |
| `starting` | Running | `starts` | none | none |
| `dirty` | Needs you | `dirty tree` | `path` | Open shell |
| `stuck` | Needs you | `no progress` | `act` | Resume when the config has `resume`, and a quiet Run again when it has `run` |
| `blocked` | Needs you | `reason` | `act` | Open issue, when the row has a `url` |
| `ready` | Needs you when `started` or `urgent`, else Idle | none: the card shows `next <step>` | none | Run when the config has `run` |

- A `ready` card shows `auto` when the `gate` of its step is `auto`. The title of Run is
  `Start the <step> step`, plus the `hint` of that step.
- With a `noRun` text, the page shows that text above the columns, and no card has Run or Resume. A
  card that would have Run shows it disabled, and a press repeats the text.
- The lane track of a card is the list of `flow.lanes` for its `type`. A card whose step is not in
  that list has no track.

**The order.** Needs you has the urgent cards first, then the dialogs, then the longest wait first.
Running has the newest first, Idle has the highest number first, and Done has the last close first.

**After a press** of Run or Resume, the card has no Run and no Resume for 30 seconds, or until a row
with the state `starting` or a session of the issue shows. So a second press does not open a second
tab for the same step. A press that fails ends that time at once, and the card keeps its button.

## `check`

`check` is the contract test of a producer. It uses the checker of the server, so a document that
passes `check` is a document that the board shows.

| Form | What it checks | Where it runs |
|---|---|---|
| `agent-board check` | The output of the `data` command of the config, which it starts as the server does: with no shell, in the main checkout, with a limit of 60 seconds. | In the main checkout only, with the start rules and the config rules of "Start". |
| `agent-board check --config-stdin` | The output of `data` from the JSON config on stdin. It waits for EOF, then uses the same producer and contract checks. | In the main checkout only, with the same checkout and command rules. It does not read `board.json`. |
| `agent-board check --stdin` | A contract 1 document from stdin. | In each folder, including outside Git. It reads no config. |

```bash
npx 'github:ddinkov10/agent-board#semver:^2' check
scripts/flow.sh --board | npx 'github:ddinkov10/agent-board#semver:^2' check --stdin
```

To supply a config with a producer command relative to the main checkout, run:

```bash
printf '%s\n' '{"data":["scripts/flow.sh","--board"]}' | npx 'github:ddinkov10/agent-board#semver:^2' check --config-stdin
```

Here stdin holds the config, and `scripts/flow.sh --board` prints the issue document. With
`check --stdin`, stdin holds that issue document directly. The two stdin flags cannot be combined,
and `--config-stdin` must follow `check` for a check. Both stdin forms read once and wait for EOF.

| Result | Output | Exit |
|---|---|---|
| The document passes | stdout: `agent-board: contract 1, <count> issues, ok` | 0 |
| The document fails | stderr: one line for each failure, `<place>: <rule>` | 1 |
| The input is not JSON | stderr: `the data is not JSON` | 1 |
| The document has another `contract` value | stderr, one line only: `the data has contract 2; this board reads contract 1` | 1 |
| Either config-based check: the config has no `data` | stderr: `agent-board: the config has no "data"` | 1 |
| Either config-based check: the `data` command exits with an error | stderr: `agent-board:` and the first line of its stderr, else of its stdout, else `the data command exited <code>` | 1 |
| Either config-based check: the `data` command does not end in 60 seconds | stderr: `agent-board: Command failed: <the data command and its items>` | 1 |
| Either config-based check: a start rule or the config fails | stderr: the source-specific line of "Start" | 1 |
| The arguments are not one of the five public forms | stderr: `usage: agent-board [--config-stdin \| check [--config-stdin \| --stdin]]` | 2 |

A failure line of a document has no prefix. Its place is the path of the value, and its rule is one
of these:

| Rule | The value at that place |
|---|---|
| `is not <a type>` | has the wrong type. The types are `a string`, `a string with one character or more`, `a boolean`, `an object`, `an array`, `an integer`, `an integer from 1`, `a name of lowercase letters only`, `a list of one step or more`, `an https:// or http:// URL`, `an absolute path`, `an ISO 8601 time`, `one of "me", "auto"`, `one of "pass", "fail", "pending"`, and `one of "approved", "changes", "required"`. The line ends in ` or null` for a field that can be absent. |
| `is required for state <state>` | is absent, and the `state` of the row needs it. |
| `"<value>" is not a state of contract 1` | is not one of the six states. |
| `"<value>" is not a lane of flow.lanes` | is a `type` that is no key of `flow.lanes`. |
| `"<value>" is not a step of any lane` | is a step that no lane has: a `step`, a step of `flow.stages`, or a key of `flow.steps`. |
| `"<value>" is in the lane two times` | is a step that the same lane has at an earlier place. |
| `"<value>" is in the stages two times` | is a step that the stages have at an earlier place. |
| `is the number of an earlier row` | is a `number` that an earlier row has. |

A document that is no object gives the one line `document: is not an object`. Example lines, each
from another document:

```text
tracker: is not a string with one character or more
flow.lanes.Bug: is not a name of lowercase letters only
flow.lanes.chore[1]: "triage" is in the lane two times
flow.stages[1].steps[0]: "triage" is in the stages two times
flow.steps.plan.gate: is not one of "me", "auto" or null
noRun: is not a string with one character or more or null
issues[0].state: "waiting" is not a state of contract 1
issues[0].step: is required for state ready
issues[0].url: is not an https:// or http:// URL or null
issues[1].number: is the number of an earlier row
issues[1].reason: is not a string with one character or more
```

## The commands of the board

| Press or read | What the server starts | From |
|---|---|---|
| The data of the issues | The `data` list, with no shell, in the main checkout, with a limit of 60 seconds. | the config |
| Run | A new herdr tab in the main checkout with the label `#<n> <step>` and no focus. In its pane: the `run` list as one line, then ` && exit`. | the config |
| Resume | The same tab with the focus. In its pane: the `resume` list as one line, then ` && exit`. | the config |
| Open shell | A herdr tab with the focus in the `path` of a `dirty` row, with the label `#<n> shell` and no command. | fixed |
| Go | `herdr agent focus <pane>`; then change to the terminal window. | fixed |

**The line of a pane.** The server makes the line from its own parts: the absolute path of the
first item, then each other item, each one in single quotes, with the digits of the number in place
of `{n}`. The shell of the pane reads each item as one word, so an item cannot add a second command.
For the config of "The config" and the issue 12:

```text
'/Users/me/code/shop/scripts/flow.sh' 12 && exit
'/Users/me/code/shop/scripts/flow.sh' '--resume' 12 && exit
```

`&& exit` closes the tab when the command ends with no error. A command that fails leaves the tab
open with its message.

**The herdr calls** of Run, when a workspace has the label of the repository:

```text
herdr workspace list
herdr tab create --workspace <id> --cwd <main checkout> --label '#<n> <step>' --no-focus
herdr pane run <pane> "'<main checkout>/scripts/flow.sh' <n> && exit"
```

The workspace is the first one whose label is the folder name of the main checkout. When none has
that label, the press makes it: `herdr workspace create --cwd <folder> --label <folder name>` takes
the place of `herdr tab create`, and one more call, `herdr tab rename <tab> <label>`, names the
first tab of the new workspace. A `run` or a `resume` line then runs in the first pane of that
workspace. Each press keeps its folder, its focus, and its label in the two cases:

| Press | Folder (`--cwd`) | Focus | Label | Calls | Calls with no workspace |
|---|---|---|---|---|---|
| Run | the main checkout | none: `--no-focus` | `#<n> <step>` | `workspace list`, `tab create`, `pane run` | `workspace list`, `workspace create`, `tab rename`, `pane run` |
| Resume | the main checkout | the new tab | `#<n> <step>` | the same three, with the line of `resume` | the same four, with the line of `resume` |
| Open shell | the `path` of the row | the new tab | `#<n> shell` | `workspace list`, `tab create` | `workspace list`, `workspace create`, `tab rename` |

So an Open shell press with no workspace makes three calls, and it makes the workspace of the
repository in the dirty lane worktree, not in the main checkout.

**The reads.** While the page is in view, it asks the server each 5 seconds. While its tab is
hidden, it asks each 15 seconds with `?local=1`, so the tab title, the tab icon, and the
notifications stay true. The server starts the `data` command for four causes only: no read started
yet, or the last read started more than 60 seconds before a request that is not local; a session
that had a card at the last request has no card at this one (not at a local request); a press of Run
or Resume; and a press of Refresh. With no request, the server starts no command. The server also
starts these read-only commands, with no shell:

- `herdr api snapshot`, at each request: the tabs and the agents of herdr in one call;
- `herdr agent read <pane> --source visible`, at each request that is not local, for each session:
  the screen of its pane;
- `git --no-optional-locks -C <folder> diff --shortstat --merge-base origin/HEAD`, at most once each
  15 seconds for each folder, for the lines that a session changed. The folder is the lane worktree
  of the issue (`.claude/worktrees/<n>-<slug>`), else the folder of the agent.

**The presses.** The page sends a press as a POST with a JSON body: `{"number": <n>}` to
`/api/run`, `/api/resume`, and `/api/shell`, `{"sessionId": "<id>"}` to `/api/go`, and `{}` to
`/api/refresh`. The server refuses a press with 409 and makes no `herdr` call, unless each condition
holds:

| Press | Conditions | Line of the refusal |
|---|---|---|
| `POST /api/run` | The config has `run`. The issue has a card of its own, with no session. Its row is `ready` or `stuck`. `noRun` is `null`. No press on that issue is active. | `#<n> has no step to start now` |
| `POST /api/resume` | The config has `resume`. The issue has a card of its own, with no session. Its row is `stuck`. `noRun` is `null`. No press on that issue is active. | `#<n> has no session to resume now` |
| `POST /api/shell` | The issue has a card of its own, with no session. Its row is `dirty`. Its `path` is a lane worktree of the main checkout. | `#<n> has no dirty worktree` |

`POST /api/agent` is unavailable. After the Host, Origin, JSON content-type, and body checks, it
returns HTTP 409 with
`{"error":"The producer controls the default agent. Change it in the producer configuration."}`.
This applies to every parsed JSON body, regardless of the requested agent or producer data.
The request writes no Git configuration or working-tree file and does not refresh the producer.

The answer to a press that the server did is 200 with `{"ok": true}`. Each other answer is
`{"error": "<one line>"}`, and the page shows the line in a toast:

| Status | Case |
|---|---|
| 400 | The body is not JSON, the body has more than 1024 characters, or the number of the issue is not digits. |
| 403 | The `Host`, the `Origin`, or the content type is not good ("The trust boundary"). |
| 404 | The path is not a path of the board, or Go names a session that is no herdr agent of the repository. |
| 409 | A condition of the table does not hold, the agent of a Go press has no safe pane id, or the request tries to change the default agent. |
| 502 | A `herdr` call failed: the first line of its error. `herdr gave no id for the workspace`, `herdr gave no id for the new tab`, and `herdr gave no pane for the new tab` are the lines for an answer of herdr with an id that is not safe. |
| 500 | The server failed for another cause: the first line of the error, or `the server failed`. |

## The trust boundary

A Run press starts a command of the repository in a herdr pane. Eleven rules hold for the server and
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
7. The server starts `herdr`, `git`, and the `data` command with no shell.
8. It runs `git` only in the main checkout or in a lane worktree, with `--no-optional-locks`, so git
   writes nothing.
9. Open shell refuses a path that is not under `.claude/worktrees/` of the main checkout.
10. The server writes nothing in a working tree.
11. The page writes each text of the data, of a pane, and of an error as text, never as HTML. Its
    Content-Security-Policy allows its own files (the page, its five scripts, its stylesheet, and
    its two fonts) and `data:` images (the tab icon) only.

Five rules hold for the config, the data, and the start:

1. **The server reads one selected config source once.** In file mode, it reads the optional
   `.claude/celetis-flow/board.json` in the main checkout; in `--config-stdin` mode, it reads the
   config supplied on stdin and never reads `board.json`. In file mode, `board.json` must resolve
   inside the main checkout and outside each lane worktree. Each executable path in either config
   must resolve to a regular file inside the main checkout and outside each lane worktree. The
   page, producer data, and lane cannot change the startup commands. The start prints each
   configured command.
2. **The config names files, not commands.** An entry starts a regular file of the main checkout
   that is not in a lane worktree. The server starts `herdr`, `git`, and those files, and no other
   program.
3. **Only validated substitutions go into command lines.** `{n}` is replaced with the digits of the
   issue number. For `Run` only, `{agent}` can be replaced with a validated agent name; `resume` and
   `data` do not accept `{agent}`. No title, no reason, no act, no path of the data, and no step goes
   into the line of a pane. No item of that line holds a control character. A step name goes into one
   argument of `herdr`, the tab label, with no shell and with lowercase letters only.
4. **The server checks each document of the data.** It refuses a lane key or a step name that is not
   lowercase letters, a state that is not one of the six, and a URL that does not start with
   `https://` or `http://`. The Content-Security-Policy stops a `javascript:` URL in the page, and
   the check stops it before the page.
5. **The start runs in the main checkout only, with a clean `PATH`.** The entry refuses a start in
   another checkout, and it removes each `node_modules/.bin` item from `PATH`, so a planted `git` or
   `herdr` in such a folder does not run. The refusal comes after npm read the `.npmrc` of the start
   folder: do not run the `npx` command in a lane worktree. "Start" gives the reason.

A start of the board in a repository runs the scripts that the config of that repository names. Do
not start the board in a repository that you do not trust.

## The layout, the keys, and the errors

**The layout.** The page holds nothing of one repository: it uses neutral colours, follows the light
or dark theme of the OS, and shows the folder name of the main checkout in the header. It carries
its two fonts, Geist and Geist Mono, in `fonts/` with their licence (`fonts/OFL.txt`, the SIL Open
Font License 1.1), so it loads nothing from the network.

- The header holds the folder name, the switch between Now and Pipeline, the count of each column
  and of Done, the search, and Refresh. The title of the browser tab is
  `(<n>) <folder> · Agent board` while `<n>` cards need you, and the tab icon has an orange dot
  then; it has a blue dot while an agent works and nothing needs you.
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
  folder, and the lines changed. A waiting session shows its lines at the top, beside Go. `Esc`
  closes the details. Below 1100 px the details cover the right side of the page, and below 720 px
  the whole page.
- A card that changed since you last looked at the board has a dot, until you point at it or focus
  it. The board takes the cards as seen when its window loses the focus.
- The status bar shows when the board last read the data, with the name of the tracker (`Issues`
  before the first good read), whether herdr runs, and whether the automatic runner runs. It shows
  the keys of the focused card, the count of Done (a press opens the list of the issues that the
  data gives as done), the Notify switch, and the list of keys.
- Notify: the first press asks the browser for permission. Then each card that enters Needs you
  shows a system notification while the board is not in front: `#<n> waits for your answer`,
  `#<n> ended its turn`, `#<n> made no progress`, `#<n> has a dirty worktree`, `#<n> <reason>` for a
  `blocked` card, and `#<n> is ready to run <step>`, with the title of the issue. A press on the
  notification opens the details of the card. A screen reader hears each card that enters Needs
  you.
- Pipeline has one column for each item of `flow.stages`, in order, and it shows each issue at its
  step. A strip at the top, Not in a step, holds the issues whose step is in no stage and the
  sessions with no issue.
- When a request of the page fails, the cards of the last good read stay, dimmed, under the message
  `The board server does not answer. The cards show the last good read.`
- A card that changes its column moves to its new place. The page shows no motion when the OS asks
  for reduced motion.
- Below 1100 px Needs you takes the left half and Running and Idle share the right half, and the
  page scrolls as one document; it also scrolls as one document at a height of 700 px or less. Below
  720 px the columns stack.
- The page keeps three choices in the storage of the browser: the view, the Notify switch, and the
  switch of the single-key shortcuts. A board on another port has its own choices.

**The keys.** `⌘K` (`Ctrl K` off macOS) or `/` opens the search: it lists what needs you first,
then the running cards, the steps that can start, the Done issues, and the commands of the board,
and `#<n>` jumps to an issue. `j` and `k` move to the next or the previous card, `h` and `l` to the
column on the left or the right; `Enter` presses the main button of the card, `Space` opens its
details, `m` opens all its actions, `o` opens the issue, and `c` copies the command or the path of
the card. `v` changes between Now and Pipeline, `d` shows or hides Done, `r` reads the issues again,
and `?` shows the list. The list has a switch that turns the single-key shortcuts off; the keys of a
focused card always work, and the arrow keys move from a focused card as `h`, `j`, `k`, and `l` do.
After a Run press the focus moves to the next card of Needs you.

After the first good read, the page writes the name of the tracker in its texts:
`Open the issue on <tracker>` and `Read <tracker> again`. Before that read, and in the list of keys,
the texts are `Open the issue` and `Read the issues again`.

**The errors.**

- When a press fails, a toast names the press (`Go failed`, `Run failed`, `Resume failed`,
  `Open shell failed`, `Refresh failed`) above the line of the server, and the card keeps its
  button. This covers a herdr server that does not run, a `herdr` that is not on `PATH`, and a press
  that the server refuses.
- The status bar shows `herdr down` when `herdr api snapshot` fails, with the error in its title.
  The board then shows no session card, and the issue cards stay.
- The status bar shows `cannot read:` with the first cause when the last read of the issues failed.
  The cards of the last good read stay.
- A document with another `contract` value is the one failure that drops the last good read: the
  board shows no issue card, the session cards stay, and the status bar shows
  `cannot read: the data has contract 2; this board reads contract 1`.
- The status bar shows `The board server does not answer` when a request of the page failed. A
  press at that time gives a toast with that text and `Start the board again in a terminal.`
- The `noRun` text, the message of a server that does not answer, and each toast are alerts for a
  screen reader.

## Versions

- **The package version** follows semver. A release is a tag `vX.Y.Z` on the default branch of
  `ddinkov10/agent-board`, and the `version` of `package.json` is equal to the tag. The maintainer
  of the package makes each tag.
- **A release names the contract versions that it reads**, now `1`. A release that stops reading a
  contract version is a new major version, so a repository that pins `^1` keeps a board that reads
  its data.
- **The contract version** is the integer `contract`. It increases only for a change that an old
  board cannot read: a field that goes or gets another name, a new required field, a new state, or a
  new meaning. A new optional field does not increase it.
- A document with another `contract` value gives no issue card ("The errors").
- **The config has no version.** A board refuses a key that it does not know, so a config for a
  newer board fails at the start with the name of the key.
- **A release that moves the config file is a new major version.** Version 2 reads
  `.claude/celetis-flow/board.json`.
- **A repository gets a new release** with a new start of the pinned command ("Start").
- The checker and this README are two forms of contract 1. `agent-board check` is the authority
  when they differ.

## Limits

Of the distribution:

- The code of the board comes from GitHub at each start, and a Run press starts a command of the
  repository. A tag that someone pushes to `ddinkov10/agent-board` reaches each repository at its
  next start, and a tag can move. The guards are the private repository, the one maintainer who
  tags, and the commit form `#<commit>`.
- `npx` reads `.npmrc` of the start folder before the board runs. The board cannot guard that read;
  the rule "start the board in the main checkout only" does.
- npm 12 is not checked: the build ran npm 11.19.1, where the default of `allow-git` is `all` and
  the flag `--allow-git=root` is accepted.
- A start with no network is not checked. The pinned command and the head form ask GitHub at each
  start; the commit form names one commit, which cannot move.
- The build saw `npx` get new code at a new start, with npm 11.19.1, for a git spec with no tag. The
  move of the pinned command from one tag to a newer tag is not checked.
- A board that runs reads the files of its page from the one copy of `npx` at each request. After a
  new release reaches that copy, the board serves the new page with the old server code until its
  next start ("Start").
- A start from a program with no terminal, for example a launch entry of a desktop app, needs
  `npx`, `herdr`, and the git credentials on the `PATH` and in the environment of that program. This
  is not checked. When such a start fails, start the board in a terminal.
- A Windows host has no support.

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
- The shell of a herdr pane is sh, bash, or zsh: the board quotes each item of a pane line for those
  shells. In a fish pane, an item that ends in `\` does not close its quote.
- `&& exit` closes the tab of a command that exits 0. A `run` command that prints a message and
  exits 0 thus leaves no message: start that command in a terminal to see it.

Of the cards and the page:

- The board does not show the `step` of a `blocked` row: such a card is in Not in a step of Pipeline
  and has no lane track.
- A `stuck` row with no `act` has no command to copy.
- With no data, Pipeline has no stage column: the strip Not in a step holds each session.
- Two presses on one issue through two controls can make two tabs when the `git diff` of a session
  folder is slower than the start of a session. One press at a time is safe.
- A start of the server forgets the times of the Run and Resume presses.
- When the `data` command does not end in 60 seconds, the status bar shows
  `cannot read: Command failed: …`, and `agent-board check` prints the same cause. The text does not
  name the limit.
- The count of changed lines is against `origin/HEAD`. A clone with no `origin/HEAD` shows no count.
- A notification shows only while the page is open in a tab. A browser that throttles a hidden tab
  can delay it by up to a minute.
- The page has no login. Each program on the machine can ask the server.
- The lane icons are the one place where the board knows four names of a flow. They change no rule.

## Tests

```bash
node --test
```

Run it in a checkout of the package. The package has no dependency, so the tests need no install
step. They need git 2.32 or later, and they start no real herdr: `fixtures/herdr` is a stub. One
test makes a git repository in a temporary folder with `fixtures/producer.sh`,
`fixtures/contract-1.json`, and `fixtures/run.sh`, starts the real entry there, and asks the server
over HTTP. The workflow `.github/workflows/test.yml` runs the suite on Node 22 and on Node 24, at
each push and each pull request.

To start the board from a checkout of the package, run `node <checkout>/cli.mjs` in the main
checkout of a repository.

## Development with Celetis

This repository uses the installed [Celetis plugin](https://github.com/ddinkov10/celetis) for its
issue workflow. `scripts/celetis` discovers the enabled host installation and runs its shared
commands. The repository holds no copy of the harness beyond that launcher.

Install Celetis and Superpowers for each host you use. Follow the plugin's machine setup for
[Claude Code and Codex](https://github.com/ddinkov10/celetis#wire-a-product-project).
The project enables both plugins through `.claude/settings.json` and `.codex/config.toml`.
The Codex settings use `superpowers@superpowers-dev`, from the Git marketplace `obra/superpowers`.
The Claude settings use `superpowers@superpowers-marketplace`. Install the matching host plugins.
Trust the checkout through the host's normal trust flow. Restart the host after changing its
project settings or permission rules.

`.celetis.yaml` in the main checkout holds the Celetis setup of this repository. Its `host: codex`
is the default host for terminal and board commands. It sets no gate, so all seven workflow gates
are manual. The plugin's `docs/configuration.md` gives each field. The launcher reads the file with
Mike Farah yq 4.54.1 or a later 4.x and `jq`, so both must be on `PATH`.

```bash
scripts/celetis root
scripts/celetis next-step --open
```

Each host needs its own enabled plugin installation. `--agent claude` or `CELETIS_AGENT=claude`
selects Claude Code for one command. Change `host` to change the default.

Start the board with this repository's GitHub issues from the main checkout:

```bash
scripts/celetis board
```

The launcher gives the data, Run, and Resume commands on stdin to the released board v2.2.1, on
port 4403. A start with no config, such as `npx 'github:ddinkov10/agent-board#semver:^2'` or
`node cli.mjs`, shows session cards only. To check the local checkout against the producer, and to
start it with issue cards but no Run or Resume:

```bash
scripts/celetis celetis-flow --board | node cli.mjs check --stdin
printf '%s\n' '{"data":["scripts/celetis","celetis-flow","--board"]}' | node cli.mjs --config-stdin
```

To run a step, use the appropriate installed Celetis skill for its issue. The maintainer starts the automatic runner.
The board's Run action starts only the selected issue's next step. Run and Resume need herdr
and the selected host CLI. The repository has no dependency installation or worktree setup step.

`AGENTS.md` gives the verify gate and project constraints. The host rules permit the Celetis
landing command and restrict direct `gh pr merge` calls. Landing uses a PR and waits for its CI
checks before the squash merge. The gate and landing configuration come from `.celetis.yaml` of
the main checkout.

The Codex model profile `codexProfiles.codex-desktop-collaboration` in `.celetis.yaml` targets
desktop collaboration. Before each child dispatch, refresh the runtime allowlist from the active
spawn tool, with the runtime `codex-desktop-collaboration`. Pass the allowlist file to
`scripts/celetis --agent codex capscore` with `--runtime-models`. A different dispatch surface
needs its own verified model binding. See the installed plugin's `docs/capability.md`.

The shared plugin documents the remaining limits of its Codex integration. Project configuration
does not prove that a new desktop session has loaded its rules or that interactive startup and
resume work. Verify those paths through the host's normal trust and terminal flow.
