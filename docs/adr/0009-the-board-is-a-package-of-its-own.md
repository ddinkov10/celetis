# The board is a package of its own, and a contract with a version is its input

Source: ddinkov10/fwrh_calculator ADR-0015. Each issue number of this record is an issue of that repository.

## Date

2026-10-12

## Related

- #430 (this change), #415 (the landing for each repository; the build of #430 started after #415
  was on `master`), #431 (the lane flow in `ddinkov10/agent-board`)
- #416 (a session card shows when the step of its session is done), #428 (a New session button),
  and #429 (Go brings the terminal of herdr to the front): features of the board. The build of #430
  transfers them to `ddinkov10/agent-board`. These are their numbers of this repository.
- ADR-0003 (`docs/adr/0003-a-local-web-board-starts-each-step-in-herdr.md`): superseded in three
  parts, below
- ADR-0004 (`docs/adr/0004-the-board-shows-what-each-agent-asks-and-unblocks-a-stuck-card.md`) and
  ADR-0005 (`docs/adr/0005-herdr-gives-the-session-state-and-ends-each-step.md`): Resume, Open
  shell, the session cards from herdr, and the trust rules for the ids stand. The board now starts
  Resume through the `resume` entry of the config, and the script of this repository runs the same
  `claude --resume '#<n> <step>'` command
- ADR-0007 (`docs/adr/0007-specify-is-a-step-of-the-runner.md`): `specify` is a step of the runner,
  and Run has one command; both stand
- ADR-0001 (`docs/adr/0001-agents-merge-lane-prs.md`): it records that the branch-protection API of
  GitHub answers 403 for this repository
- ADR-0008 (`docs/adr/0008-the-build-step-lands-the-change.md`), the record of #415: the flow with
  no `finish` step, and `landing.json` beside `gates.json`
- `scripts/agent-flow.sh`, `.claude/scripts/next-step.sh`, `.claude/agent-flow/board.json`,
  `docs/agents/agent-flow.md`, and the repository `ddinkov10/agent-board`

## Supersedes

From ADR-0003, "A local web board shows the sessions and starts each step in a herdr tab", three
parts:

- "The board is a local web page of this repository", with its start command
  `node .claude/agent-flow/board/server.mjs`. The board is a package of another repository.
- The home of the column rules, `.claude/agent-flow/board/place.mjs`, in "The rules have one home
  each". The rules for the columns are in the package, and they read a state of the data.
- The consequence that `place.mjs` reads five `stop` texts of the resolver (`STOPS`). No program
  reads a `stop` text.

The trust boundary of ADR-0003 and ADR-0005 stands, with the five new rules of the Decision. The
other parts of ADR-0003 stand, as ADR-0004, ADR-0005, and ADR-0007 changed them.

## Context

Until #430 the board lived in `.claude/agent-flow/board/` of this repository (ADR-0003). The
maintainer runs the agent flow in more than one repository on one machine, and wants the same board
in each repository with no change to its code. The board could not leave this repository, for three
causes:

- The server ran `scripts/agent-flow.sh` of its own checkout for the data and for Run, and it built
  `claude --resume '#<n> <step>'` for Resume.
- `place.mjs` read five `stop` texts of the resolver and held the step names. `view.mjs` held the
  lanes and the stages. The page named GitHub in fixed texts.
- A start was `node .claude/agent-flow/board/server.mjs`, so each repository needed a copy of the
  files.

The first second repository tracks its issues in Plane and opens no pull request. It has the same
four lanes, the same steps, and the same worktree and branch names
(`.claude/worktrees/<n>-<slug>`, `feat|fix|hotfix|chore/<n>-<slug>`). It has the skills only: no
script gives the next step of an issue, and no script starts a step.

## Constraints and evidence

The `specify` session of #430 read these facts on 2026-10-11, where a line gives no other date. The
spec on #430 gives the URL of each source.

npm:

- npm 11.19.1 is installed here, and `npm config get allow-git` prints `all`. npm 12.0.0 changed
  the default: "allow-git and allow-remote now default to none" (the release notes of npm 12.0.0).
- For `npx github:<owner>/<repo>`, npm 11.19.1 and npm 12.2.0 resolve the spec to a commit with
  `git ls-remote`, over https and then ssh. They download the tarball of that commit, and they run
  `git clone` when the download fails (`lib/git.js` of `npm/pacote`).
- For a git spec, npm runs an install step only when `package.json` has `preinstall`, `install`,
  `postinstall`, `prepack`, `prepare`, `build`, or `workspaces` (the same file).
- A git spec takes `#<commit-ish>` and `#semver:<range>`, and the default branch with neither.
  `npm exec` runs the one `bin` entry of a package, and it skips its prompt with `--yes` (the npm 11
  docs of `npm install` and `npm exec`).
- `npx` looks up the spec at each run, and it installs again when the resolved commit differs from
  the cached one (`libnpmexec` of `npm/cli`).
- `@npmcli/git` sets `GIT_ASKPASS=echo`, so git cannot ask for a password (`lib/opts.js` of
  `npm/git`).
- `engines` is advisory unless `engine-strict` is set (the npm 11 docs of `package.json`).
- `npx` reads `.npmrc` of the start folder (for example `node-options`, `script-shell`, and `git`),
  and it puts each `node_modules/.bin` of the start folder and of its parent folders first on
  `PATH`. The review of the trust boundary in the `specify` session found this.
- On the npm registry, `agentboard` 0.9.1 is taken, and `agent-board` has no package.

herdr 0.9.3 (installed):

- A plugin pane is a terminal command: "Runtime action registration and native non-terminal plugin
  UI are not part of plugin v1." `herdr plugin install <owner>/<repo>` is for the user, not for a
  repository, and version 1 has no `plugin update` (the plugin docs of herdr 0.9.3).
- `herdr api snapshot` carries `protocol` (22) and `version`. An agent row has `terminal_id`,
  `pane_id`, `tab_id`, `agent`, `agent_status`, `cwd`, and `foreground_cwd`, and a tab row has
  `tab_id` and `label` (a run of the command).
- The docs say that a JSON client "should ignore unknown fields". They give no deprecation policy,
  and 0.9.2 and 0.7.5 had breaking changes (the changelog of herdr 0.9.3).

GitHub:

- The branch-protection API of GitHub answers 403 for this repository, which is private on a
  personal plan (ADR-0001). `ddinkov10/agent-board` is a private repository of the same account, so
  this record takes it that GitHub protects no tag there.

The build of #430 gave these results for the seven risks of the spec:

- **R1 holds: `npx` runs a git spec of a private repository with no install step.** npm 11.19.1 ran
  `PORT=4512 npx --yes github:ddinkov10/agent-board` in a repository with no config, and the board
  started. So each doc names the `npx` command, and no `npm install -g` pair.
- **R4 holds: `npx` runs a package whose `package.json` has `"private": true`.** The key stays.
- **R5, a build session runs `git` and `gh` in a second repository: it holds in part.** A plain
  `git -C <folder>` command for the second repository ran in the build session. The permission
  classifier of the session denied the one command that makes the repository
  (`gh repo create … --push`), and the maintainer ran it in the session prompt.
- **R3 is not checked: on npm 12, `--allow-git=root` allows the spec of the command line.** This
  machine has npm 11.19.1. npm 12 refuses a git spec by default, and the README of the package
  gives `--allow-git=root` for it.
- **R6 is not checked by the build: the desktop app starts `npx` from the entry `board` of
  `.claude/launch.json`.** The maintainer starts the board from that entry after the landing.
- **R2 holds for the tag form: `#semver:^1` resolves the newest `v1.*` tag.** The build made the
  tag `v1.0.0`. Then `npx --yes 'github:ddinkov10/agent-board#semver:^1'` started the board at the
  commit of that tag, in a repository with a config and in a repository with no config.
- **R7 holds: `gh issue transfer` keeps the labels of an issue when the new repository has labels
  with those names.** `gh label clone` copied the labels of this repository to the new one. Then
  #416, #428, and #429 went there as its issues #1, #2, and #3, each one with its label.
- The workflow of the package ran the suite on Ubuntu with Node 22 and with Node 24, and the suite
  passed on each.
- The entry file of the package (`cli.mjs`) uses `git rev-parse --path-format=absolute`, which is
  new in git 2.31.0. So the package needs git 2.31 or later, where the spec names 2.30.
- Two records of `docs/adr/` had the number 0014 when the build wrote this record, so its number is
  0015. The spec on #430 names no number.

## Decision

The board is the package `ddinkov10/agent-board`. It reads the issues from one JSON document with a
version, contract 1, and it starts only the files that one config of the repository names. This
repository keeps the config and the producer of the document, and it holds no file of the board.

The maintainer made nine decisions in the `specify` session of 2026-10-11:

1. **The design is for a second repository with the same flow and no scripts.** The Plane
   repository has the four lanes and the steps of this repository, and no resolver or runner
   script.
2. **The data owns the lanes, the steps, the stages, and the stop reasons.** The document of the
   producer carries them (`flow.lanes`, `flow.stages`, `flow.steps`, `reason`, and `act`). Each
   issue has one explicit state from a list of six that the board owns: `ready`, `starting`,
   `stuck`, `dirty`, `blocked`, and `done`. The code of the board holds no step, no stage, no `stop`
   text, and no tracker name.
3. **A repository starts the board with `npx github:<owner>/<repo>`, and a release is a git tag.**
   The package has no dependency, no build step, and no lifecycle script, so `npx` runs it with no
   install step.
4. **The repository is `ddinkov10/agent-board`.** The board has that name in its log line and in
   its browser storage keys.
5. **The config is `.claude/agent-flow/board.json`**, a file of its own beside `gates.json` and
   `landing.json`.
6. **The config names scripts of the repository.** Each of `data`, `run`, and `resume` is an
   argument list whose first item is a file inside the main checkout, and `{n}` is the one
   placeholder. The board knows no agent CLI.
7. **The work is one lane with three parts: change in place, lift, switch.** #430 stays one issue
   with one plan and one PR here. Part 1 changed the board in `.claude/agent-flow/board/`. Part 2
   moved the history of that folder into the new repository with `git subtree split`. Part 3
   removed the folder here.
8. **The build session makes the private repository, pushes to it, and tags `v1.0.0`.** The
   approval of the spec is the approval of those acts. R5 above gives the one act that the
   maintainer did.
9. **The lane flow in `agent-board` is a second issue, #431.** The build transfers #416, #428, and
   #429 to `ddinkov10/agent-board`. A board change is a session by hand there until #431 lands.

**Calls of the session.** The maintainer approved the other design sections of the spec without a
read, so each of these is a choice of the `specify` session:

- The new repository is private, and `package.json` has `"private": true` and
  `"license": "UNLICENSED"`.
- The documented command is `npx 'github:ddinkov10/agent-board#semver:^1'`: it pins the major
  version, and it is written in quotes. A release that stops reading a contract version is a new
  major version, so a repository that pins `^1` keeps a board that reads its data.
- With no `board.json`, or with no `data` entry, the board shows the session cards only.
- The config has a fourth key, `port`.
- The config has no version: the board refuses a key that it does not know, so a config for a newer
  board fails at its start.
- The server reads the config once, at its start, and the start prints each command.
- This repository adds the form `scripts/agent-flow.sh --resume <n>`, and `resume` of the config
  names it. The board builds no `claude` command.
- The contract has `noRun`, `started`, `urgent`, `tracker`, and `flow.steps.<step>.hint` in place
  of `mainDirty`, the step sets of `place.mjs`, the test for `hotfix`, the word GitHub, and the
  special title of Run.
- A URL of the data is a link only when it starts with `https://` or `http://`.
- The contract version is the integer `contract`. It increases only for a change that an old board
  cannot read: a field that goes or gets another name, a new required field, a new state, or a new
  meaning.
- The contract has no JSON Schema file. The tables of the README are its text, and
  `agent-board check` is its one executable form.
- The page of the board moves from `docs/agents/agent-flow.md` to the README of the package.
- The tests of this repository start the checker through the variable `AGENT_BOARD`, else through
  the pinned `npx` command.
- The board starts in the main checkout only, and the entry file of the package removes each
  `node_modules/.bin` item from `PATH`. This changes one sentence of a design section that the
  maintainer read and approved: "a start in a lane worktree gives the same board".
- The config refuses a control character, a file that is not executable, and a `board.json` that
  resolves into a lane worktree.
- A `step` can be outside the lane of its `type`, and a session whose issue has no row shows the
  label of its tab.

**Decisions of the plan.** The plan of #430 made these decisions on the code:

- **The layout of the package is flat.** Each file of the board stays at the root, so the history
  of each file holds. `fixtures/` holds the example document and the fixture scripts. No folder
  has the name `test`: Node runs each `.mjs` file of such a folder as a test.
- **The card states.** `starts`, `dirty-tree`, and `no-progress` keep their names in the page. One
  state, `blocked`, takes the place of `needs-info` and `ready-for-human`: its label is `reason`,
  its icon is `person`, and its tone is `needs`.
- **A row of `next-step.sh --json` keeps `line` and has no `step`.** `--board` adds `step` with
  `step_of`, the one home of the rule that `/feature` gives `specify`, and it removes `line`.
- **The lanes and the stages live in `scripts/agent-flow.sh`** as one jq literal, `FLOW`. The step
  list of the gates comes from it.
- **`--resume <n>` uses the last row of #<n> in the record of the steps with no progress**
  (`<git common dir>/agent-flow/no-progress`), with no `gh` call.
- **A document with another `contract` value drops the last good read.** Each other failure keeps
  it. The status bar shows `cannot read: the data has contract 2; this board reads contract 1`.
- **`AGENT_BOARD` holds the path of the entry file of the package.** The test runs
  `node "$AGENT_BOARD" check --stdin`.
- **`check` prints each failure on stderr** and the `ok` line on stdout. A usage error exits 2.
- **`data` takes no placeholder.** The config refuses an item of `data` that has `{` or `}`.

**Rules of the build.** The checker of the package is more strict than the tables of the spec. The
build added four rules by a ruling: the checker refuses an empty `noRun`, an empty `reason`, a step
that is two times in one lane, and a step that is two times in the stages. A rule that is too
strict can relax after the tag with no break, and a stricter rule after the tag refuses documents
that the board read before. The checker is also more strict for `tracker` (one character or more),
`path` (an absolute path on each row that has one), the parts of `pr` (`number` and `draft` are
required), and the form of a time (the time with seconds, and `Z` or `±hh:mm`). The README of the
package is the text of contract 1. A press of Open shell starts no read of the data: the causes of
a read are data older than 60 seconds, a session card that is gone, a press of Run or Resume, and
a press of Refresh.

**The producer of this repository.** `scripts/agent-flow.sh --board` prints contract 1, and the
rule of ADR-0003 holds: each rule has one home.

- The resolver (`.claude/scripts/next-step.sh --json`) keeps its 3 `gh` calls. It gives each row
  the state that it knows from the tracker and from the working trees: `done`, `blocked` with
  `reason` and `act`, `ready`, or `dirty` with `path`. It gives no row to an issue that resolves to
  an epic or to a closed `wontfix`. It gives the `noRun` text for a dirty main checkout.
- `--board` adds what the runner knows: `starting` for a lock that a live script holds, `stuck`
  with the `act` `claude --resume "#<n> <step>"` for a row of the record of the steps with no
  progress, `step`, `started` (`true` for `plan` and `implement`), `urgent` (`true` for the type
  `hotfix`), `runner`, `tracker`, and `flow` with the gate of each step.
- The first state that matches wins, in this order: `done`, `starting`, `dirty`, `stuck`,
  `blocked`, `ready`.
- The `stop` and `run` lines stay for the runner and for the maintainer.

**The trust boundary.** A Run press starts a session in auto mode, and a start of the board in a
repository runs the scripts that the config of that repository names. Each trust rule that the
board had before #430 holds with no change (ADR-0003, as ADR-0004 and ADR-0005 changed it). Five
rules are new:

- **The config comes from the main checkout only, once.** The page, the data, and a lane worktree
  cannot change what the server starts. `board.json` and each file that it names resolve to a place
  inside the main checkout and outside each lane worktree. The start prints each command.
- **The config names files, not commands.** An entry of the config starts a regular file of the
  main checkout that is not in a lane worktree. The server starts `herdr`, `git`, and those files,
  and no other program.
- **One value goes into a command line: the digits of the number.** No title, no reason, no act, no
  path of the data, and no step goes into the line of a pane, and no item of that line holds a
  control character. A step name goes into one argument of `herdr`, the tab label, with no shell
  and with letters only.
- **The server checks each document of the data.** It refuses a lane key or a step name that is not
  lowercase letters, a state that is not one of the six, and a URL that does not start with
  `https://` or `http://`.
- **The start runs in the main checkout only, with a clean `PATH`.** The entry file of the package
  refuses a start in another checkout, and it removes each `node_modules/.bin` item from `PATH`, so
  a planted `git` or `herdr` in such a folder does not run. The refusal comes after npm read the
  `.npmrc` of the start folder, so the rule for a person and for an agent is: do not run the `npx`
  command in a lane worktree. `scripts/agent-flow.test.sh` starts its `npx` command in a temporary
  folder for that reason.

## Alternatives considered

- **The board keeps `LANES`, `STAGES`, and `STOPS`.** Each flow change then needs a board release,
  and each repository must move at the same time.
- **The lanes are in the config file.** Two places must then agree on the step names.
- **A public package on the npm registry.** The `specify` session recommended it: it needs no setup
  on npm 12. But the source is then public, and it needs an npm account.
- **A copy of the board in each repository, with Copier.** Each copy can drift, and agents do not
  read the board.
- **A herdr plugin.** A plugin pane is a terminal only, so the page needs a rewrite as a TUI.
- **The name `agent-flow-board`, or `herdr-agent-board`.** The board already has the name
  `agent-board` in its log line and in its browser storage keys.
- **A `board` section in a `flow.json`.** #415 makes no such file, so its spec and its plan would
  change first.
- **`agent-board.json` in the root of the repository.** The maintainer chose the file beside
  `gates.json` and `landing.json`.
- **Config entries that name a program from `PATH`, with a second placeholder `{step}`.** With
  files of the main checkout only, the server starts `herdr`, `git`, and those files, and no other
  program.
- **Fixed command lines in the board, with no command in the config.** The board then holds the
  script path and the `claude` command of one flow: the first cause of the Context.
- **All the work in the new repository first.** That repository has no lane flow and no gate.
- **An epic with three children.** The maintainer kept one issue, one plan, and one PR.
- **A stop in which the maintainer makes the empty repository, or also pushes and tags.** The
  maintainer chose that the build session does these acts.
- **`agent-board` gets the harness now.** The maintainer chose this first, and then moved the work
  to #431: the harness without the board is about 50 files, and 35 of them name parts of this
  product.
- **`npm install -g 'github:ddinkov10/agent-board#semver:^1'` once, and then `agent-board`.** This
  was the form of the spec for a failure of R1. R1 holds, so no doc names it.
- **A JSON Schema file for the contract.** Not now: the tables are the text of the contract, and
  `agent-board check` is its one executable form.
- **A setting for the worktree folder, the tab label, the workspace label, or the source of the
  sessions.** The two repositories have the same values, so a setting with one value is not
  necessary. The config refuses an unknown key, so a later setting cannot be a silent change.

## Consequences

- One command starts the board in a repository, and no file of the board is in that repository. A
  repository with no `board.json` gets the session cards. A repository that prints contract 1 gets
  the issue cards too, whatever its tracker, and with or without pull requests.
- A change of the lanes, the steps, the stages, a gate, or a stop reason of this repository is a
  change of `scripts/agent-flow.sh` or of the resolver only. It needs no release of the board.
- `agent-board check` is the contract test of a producer. `bash scripts/agent-flow.test.sh` gives
  each `--board` document of its stub world to the checker, so the test fails when the producer
  leaves the contract.
- The code of the board comes from GitHub at each start, and a Run press starts a session in auto
  mode. A tag that someone pushes to `ddinkov10/agent-board` reaches each repository at its next
  start, and a tag can move: GitHub protects no tag there (above). The guards are the private
  repository, the one maintainer who tags, and the commit form
  `npx 'github:ddinkov10/agent-board#<commit>'`.
- `npx` reads `.npmrc` of the start folder before the board runs. The board cannot guard that read:
  the rule "start in the main checkout" does.
- `npx` looks up the spec at each run, so each start asks GitHub and needs git credentials. A start
  with no network is not checked.
- `agent-board` has no package on the public npm registry. So `npx agent-board`, with no `github:`,
  runs the package of the person who takes that name. Each doc gives the `github:` form only.
- Until #431 lands, a board change has no lane flow: no spec step, no plan step, and no review of
  the harness. The tests and the workflow of the new repository are its gate.
- The history of the new repository holds the commits of the lane branch of part 1. `master` of
  this repository gets one squash commit, so the two histories differ for that part.
- herdr states no compatibility policy for its CLI, and minor releases had breaking changes. The
  board was checked against herdr 0.9.3 (protocol 22).
- The board in the Plane repository shows session cards only, and the maintainer names each tab by
  hand. Its issue cards wait for a producer, and that producer needs a resolver for Plane.
- The checker and the README are two forms of contract 1. `agent-board check` is the authority
  when they differ.
- The lane icons are the one place where the board knows four names of a flow: `bug`, `feature`,
  `chore`, and `hotfix`. A lane with another key gets the neutral icon.
- #417, #418, #422, and #394 name the board and stay here: each one has a part in the resolver, the
  runner, or the scripts.
- The spec on #430 differs from the code in these places, among others: the rules of the checker
  and the cause of a read above, the `{n}` item of `run` and `resume`, which comes after the first
  item, git 2.31, and the status text of another contract, which starts with `cannot read: `. This
  list is not complete: the README of the package holds the text that agrees with the code.

## Reconsider when

- A flow change needs a new state, or a new contract version.
- A second maintainer or a public user needs the package.
- npm stops the run of a git spec.
- herdr gets a plugin UI that is no terminal.
- A tag of `ddinkov10/agent-board` moves.
