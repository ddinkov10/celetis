# celetis

`celetis` is a plugin for Claude Code: a general agent harness. It takes a request from free text
to a change on the trunk through one GitHub issue: the intent, the lane, the spec, the plan, the
build, and the landing. The issue is the state store: each result goes onto the issue, and each
hand-off reads the issue again.

The plugin holds:

- 18 skills: the lanes, the steps of a lane, the skills for review and memory, and the helpers
  ("The skills");
- the scripts: the runner, the resolver, the landing script, the worktree script, and the
  capability scorer ("The commands");
- the step text of the runner, `step-prompt.md`;
- the documents that the skills cite, in `docs/`.

There are two kinds of repository:

- The **plugin repository** is this one, `ddinkov10/celetis`. It is private, and it is also the
  marketplace `celetis` with one plugin, so the id of the plugin is `celetis@celetis`.
- A **product project** is a repository that uses the plugin. `ddinkov10/fwrh_calculator` is the
  first one. This repository is the second one: it runs its own lanes on its own landed plugin.

A product project holds no skill, no script, and no document of the harness, apart from one
launcher file. It holds only what is its own:

| Part | Place in the product project |
|---|---|
| The wiring | `.claude/settings.json`: the marketplace, the two enabled plugins, and the permission rules |
| The launcher | `scripts/celetis` |
| The config | `.claude/agent-flow/gates.json`, `landing.json`, and `board.json` |
| The worktree setup | `.claude/agent-flow/worktree-setup.sh` |
| The custom parts | `.claude/agent-flow/custom/<skill>.md`, one file for each skill that needs one |
| The product facts | `AGENTS.md` |
| The stores | `docs/adr/` and `docs/lessons/` |

No file of the plugin names a part of a product, apart from the records of `docs/adr/`. The plugin
names a role, for example "the verify gate of the project", and the product project names the
thing. A lane ends when the change is on the trunk, which is the default branch of the repository
on GitHub: the verify gate, the deployment, and each other part of a product stay in the product
project. The plugin has no `version`, no `bin/` folder, no hook, and no declared dependency, and it
gives no permission rule. ADR-0012 (`docs/adr/0012-the-harness-is-the-plugin-celetis.md`) holds the
reasons.

## Requirements

- macOS or Linux, with bash 3.2 or later. There is no native Windows runner. On a Windows host, a
  session by hand runs the scripts in Git Bash, and the lookup of the launcher there is not checked
  (ADR-0012).
- `claude`, `gh` (logged in), `jq`, and `git` 2.31 or later on `PATH`.
- Git credentials for GitHub that need no prompt, an ssh key or a credential helper for https: the
  plugin repository and the package of the board are private.
- The plugin `superpowers@superpowers-marketplace`: the lane skills call its `superpowers:*` skills.
- herdr 0.9 or later, for the step end of the runner and for the board. In another terminal the
  runner works too, but you leave each session with `/exit`.
- For the board: Node 22 from 22.18, or Node 24.2 or later, with `npx`, and a Chromium browser.

`docs/agent-flow.md` gives each requirement in full ("Requirements", and "The board").

## Wire a product project

### Each machine, one time

1. Add the marketplace, and install the plugin:

   ```bash
   claude plugin marketplace add ddinkov10/celetis
   claude plugin install celetis@celetis
   ```

   The install enables the plugin at the `user` scope, so each session of the machine loads it, in
   each folder. The launcher finds the plugin through the record of this install, so the two
   commands are necessary on each machine. It is not shown that the block of the project file
   (below) loads the plugin with no install. In the probe, a headless turn in a new repository
   whose project file held the marketplace and the two plugins loaded no plugin and added no
   marketplace. A headless turn shows no workspace trust dialog, so the probe does not show what
   an interactive session does after that dialog (ADR-0012, R1).
2. Add and install superpowers the same way: `docs/agent-flow.md`, "Requirements", gives its two
   commands.
3. Last, turn on auto-update for superpowers. In `~/.claude/settings.json`, add
   `"autoUpdate": true` beside `source` in the entry `superpowers-marketplace` of
   `extraKnownMarketplaces`. Do this step last, and again after a later run of an add command: in
   Claude Code 2.1.296 that command writes the entry again with `source` only. The entry `celetis`
   needs no such step: the block of the project file holds the key for `celetis`, and Claude Code
   takes it from there in a trusted folder (ADR-0012, R2). "Updates" says what auto-update does.

The next parts are the files and the labels of one product project. Make each file in its main
checkout.

### `.claude/settings.json`

The file holds the marketplace, the two plugins, and two permission rules:

```json
{
  "permissions": {
    "allow": ["Bash(scripts/celetis land *)"],
    "deny": ["Bash(gh pr merge*)", "PowerShell(gh pr merge*)"]
  },
  "extraKnownMarketplaces": {
    "celetis": {
      "source": { "source": "github", "repo": "ddinkov10/celetis" },
      "autoUpdate": true
    }
  },
  "enabledPlugins": {
    "superpowers@superpowers-marketplace": true,
    "celetis@celetis": true
  }
}
```

The plugin gives no permission rule, so each product project holds these two. The `allow` rule lets
a build step run `scripts/celetis land` with no permission prompt. The `deny` rule leaves an agent
one landing path, that script: to merge by hand, use your own shell or GitHub. A rule matches the
text of a command, so the command has no `./` before it. A `Bash(...)` rule does not match the
PowerShell tool of a session on a Windows host, so a `deny` rule has the two forms. A project adds a
`deny` rule for each act of its own that only the maintainer does (`docs/agent-flow.md`, "Guards").

### The launcher

Copy `scripts/celetis` of the installed plugin to `scripts/celetis` of the project. The copy keeps
the execute bit, which the board needs to start the file:

```bash
mkdir -p scripts
cp "$(claude plugin list --json | jq -r '[.[] | select(.id == "celetis@celetis" and .scope == "user")][0].installPath')/scripts/celetis" scripts/celetis
```

The file is the same in each product project. `scripts/celetis <name> <arguments>` runs
`scripts/<name>.sh` of the installed plugin with those arguments ("The commands"), so a new script
of the plugin needs no new copy.

### The config, the worktree setup, and the custom parts

They are files of `.claude/agent-flow/`:

| File | What it holds | With no file |
|---|---|---|
| `landing.json` | The landing mechanism. `{"landing": "pr"}` is one PR back to the trunk, which `scripts/celetis land` squash-merges when each check is green. With `pr`, the landing needs one check or more that passes on the PR, so a project with no check uses `merge`. `{"landing": "merge"}` is one squash commit on the trunk, with no PR | `scripts/celetis land` names the two mechanisms and exits 2 |
| `gates.json` | The gate of each step, `me` or `auto`: `{"triage": "me", "specify": "me", "bug": "me", "chore": "me", "hotfix": "me", "plan": "me", "implement": "me"}` | Each step is `me`, unless the git config of the machine names it `auto` |
| `board.json` | The commands and the port of the board ("The agent board") | The board shows the session cards only |
| `worktree-setup.sh` | The setup of a new lane worktree, for example the install of the dependencies and the copy of the files that git ignores | A new worktree gets no setup |
| `custom/<skill>.md` | A custom part: an addition to the procedure of the skill `<skill>` | The skill ends with the text `(Bash completed with no output)` |

- **The config** is the three JSON files. Each reader takes them from the main checkout, also when
  a script starts in a lane worktree. After a merge that changes one of them, run `git pull` in the
  main checkout.
- **The gate of a step** comes from the git config of the machine
  (`git config agent-flow.gate.<step> auto`), then from `gates.json`, and else it is `me`. An `auto`
  step starts by itself. A `me` step starts only when you start it, with a number or with a Run
  press on the board.
- **With the landing `pr`,** keep the repository setting `squash_merge_commit_title` at
  `COMMIT_OR_PR_TITLE`: for a PR with one commit, GitHub then takes the subject of that commit and
  adds the PR number (`docs/issue-tracker.md`, "Branches, PRs, merge").
  `gh api 'repos/{owner}/{repo}' --jq .squash_merge_commit_title` prints the value.
- **The worktree setup.** `scripts/celetis worktree <n>` runs the file of the new worktree, in that
  worktree, as `bash .claude/agent-flow/worktree-setup.sh <main checkout>`, with stdout sent to
  stderr. So the file needs no execute bit, and it can print. When it exits with an error, the
  command removes the worktree and the branch that it made. A worktree gets its setup one time
  (`docs/agent-flow.md`, "The config and the custom parts").
- **A custom part** is read when Claude Code loads its skill, from the root of the checkout where
  the session is at that time. A step that the runner starts reads the custom part of the main
  checkout, and a skill that loads after `EnterWorktree` reads the custom part of the lane branch.
  The text is an addition: it cannot remove a rule of the general skill, and it is no domain skill
  (ADR-0006). Two skills name what their custom part holds: `hotfix.md` holds the ship acts of the
  project, and `lesson.md` holds its tags.

`docs/agent-flow.md` holds these parts in full ("Gates", and "The config and the custom parts").

### `.gitignore`

```
.claude/worktrees/
docs/superpowers/
.superpowers/
docs/lessons/_pending/
```

With no entry for `.claude/worktrees/`, a lane worktree makes the main checkout dirty, and the
resolver prints the dirty-tree line for each issue (`docs/issue-tracker.md`). The three other
folders are scratch of the skills, and a file that git does not ignore makes a tree dirty too:

- `docs/superpowers/` holds the drafts of the intents, the specs, and the plans;
- `.superpowers/` holds the review package of `critic-loop`;
- `docs/lessons/_pending/` holds the lesson drafts that wait for `lesson-review`.

### The labels

The flow uses the ten labels of `docs/issue-tracker.md`, "Labels". GitHub gives a new repository
three of them (`bug`, `enhancement`, and `wontfix`). Make the seven others:

```bash
gh label create needs-triage -d 'not yet classified'
gh label create hotfix -d 'production broken, the fix ships now'
gh label create chore -d 'zero-behavior-change edit'
gh label create epic -d 'parent of several feature sub-issues'
gh label create needs-info -d 'the report lacks what its lane needs; the questions are in a comment'
gh label create ready-for-agent -d 'plan posted; `/celetis:implement #<n>` can start'
gh label create ready-for-human -d 'a step only a human runs'
```

The commands have no `--force`, so a label that is there keeps its color and its description.

### `AGENTS.md`

The plugin names a role, and the `AGENTS.md` of the project names the thing. It names:

| What `AGENTS.md` names | Who reads it |
|---|---|
| **The verify gate:** the command that proves a change, and how to read its result | `plan`, `implement`, `chore`, `hotfix`, and `guide` say "the verify gate of the project", and `scripts/celetis land` names it in a refusal |
| **The architecture and the traps:** the shape of the project in the root file, and the traps of each subsystem in the `AGENTS.md` of its folder. They are the domain knowledge: the plugin has no domain skill (ADR-0006) | `specify`, `bug`, `hotfix`, `plan`, `chore`, and `critic-loop` |
| **The design document and the look decision,** in a project with a UI: the document that holds the design rules, and how a session builds the options of a look decision and hands them over, with the dev server of the project | `specify` and `bug`; the two items "Prototype" of `docs/issue-tracker.md`, in "What lives on the issue" and in "Branches, PRs, merge" |
| **The installed version of a dependency:** how a session reads it, and the documents that an installed package ships | `docs/docs-lookup.md`, which `specify`, `plan`, `bug`, `hotfix`, and `chore` cite |
| **The agent flow of the project:** what a session must know of the lanes there, for example that the lanes are the plugin `celetis`, the landing mechanism, and the acts that only the maintainer does | Each session, also a step session. So after each change of this part, run the hand-run test in the project ("Tests") |

The plugin has no role for the deployment of a project. It is a product fact, so it also goes into
`AGENTS.md` when more than one step needs it: a lane ends when the change is on the trunk.

Claude Code reads `AGENTS.md` at the start of a session only when the project and each folder above
it have no `CLAUDE.md`, `.claude/CLAUDE.md`, or `CLAUDE.local.md`. A project that keeps a
`CLAUDE.md` imports the file from it, with the line `@AGENTS.md` (the documents of Claude Code,
`https://code.claude.com/docs/en/memory`, read on 2026-10-13 for Claude Code 2.1.296).

### The stores

- `docs/adr/`, with a `README.md` and a `template.md`: the skill `record-architecture-decisions`
  reads the two files and writes each record as `NNNN-short-title.md`, and the lanes read the
  records. The model for the two files is `docs/adr/README.md` and `docs/adr/template.md` of the
  plugin.
- `docs/lessons/INDEX.md`: the catalog of the lessons, with one table row for each lesson. The
  lanes scan it, and the skill `lesson` adds a row to it. A new catalog has this head:

  ```markdown
  # Lessons

  | Lesson | Tags | Date | Summary |
  |---|---|---|---|
  ```

### Optional: the board in the desktop app

A product project can hold an entry `board` in its `.claude/launch.json` that starts the command of
the board with `--yes`. A session in a Code tab of the desktop app can then show the page in the
Browser pane. This start is not checked (`docs/agent-flow.md`, "The board", and "Limits"). The
entry of the first product project is the example. It is one item of the list `configurations` of
that file, and its `port` is the port of `board.json`:

```json
{
  "name": "board",
  "runtimeExecutable": "npx",
  "runtimeArgs": ["--yes", "github:ddinkov10/agent-board#semver:^1"],
  "port": 4403
}
```

### Commit the wiring on the trunk

Commit these files on the trunk and push them, by hand, before the first lane. A lane branch starts
at the trunk of `origin`, so a file that is not there is in no lane worktree: the launcher, the
worktree setup file, or a custom part. A file that git does not track also makes the main checkout
dirty, and the resolver then stops each issue.

## The full loop

One request goes from free text to a change on the trunk. The example is a feature, the lane that
has each step.

**In a session by hand.** Start `claude` in the main checkout of the product project.

| You type | The session | It leaves on the issue |
|---|---|---|
| `/celetis:intake <the request>` | writes the intent in your words, and asks "proceed?" | a new issue `#<n>` with the intent and the label `needs-triage` |
| `/celetis:triage #<n>` | picks the lane, and asks whether to go on | the lane label, here `enhancement` |
| `/celetis:feature #<n>` | makes the lane worktree and runs `specify`: the design, in a conversation with you | the spec that you approved, as the body of the issue |
| `/celetis:plan #<n>`, in a new session | writes the plan: tasks with a capability score, and a Verify phase | a `## Plan` comment and the label `ready-for-agent` |
| `/celetis:implement #<n>`, in a new session | builds each task (an implementer, the verify gate of the project, a review), runs the Verify phase, and lands the change with `scripts/celetis land` | the change on the trunk, and a closed issue |

- On a yes, `intake` hands on to `triage`, and `triage` hands on to the lane, so the first three
  rows can be one session. `plan` and `implement` each start in a fresh context, and each one reads
  the issue again.
- When you know the type, start the lane directly, with a number or with free text:
  `/celetis:bug the export stops on a report with no rows`.
- A lane and each step after it work in the lane worktree of the issue,
  `.claude/worktrees/<n>-<slug>`, on the branch of the issue. `intake` and `triage` enter no
  worktree. The main checkout never changes branch, so two flows run side by side.
- The landing puts the change on the trunk by the mechanism of `landing.json`. With `pr`,
  `scripts/celetis land <n> '<subject>'` pushes the branch, opens the PR, waits up to 15 minutes
  for the checks, and squash-merges when each check is green. It then removes the worktree and the
  branch.
- The other lanes are shorter. `/celetis:bug` finds the root cause, posts it as a `## Root cause`
  comment, and hands on to `plan`. `/celetis:chore` makes a change with no change of behavior: it
  verifies, commits, and lands in one session. `/celetis:hotfix` fixes broken production in one
  session, and it ends with the ship acts of the project. A request that spans some independent
  features becomes an epic, and each child issue runs its own flow.

**Through the runner.** `scripts/celetis agent-flow <n>` starts the next step of the issue in a new
interactive session, in the terminal tab where you start it. For each step, the runner:

1. asks the resolver for the next step: `scripts/celetis next-step <n>` prints a `run` line with
   the command of the step, for example `run /celetis:plan #<n>`, or a `stop` line with the reason;
2. brings the plugin of the machine to the head of `main` ("Updates");
3. starts `claude` in the main checkout with `--permission-mode auto`, the session name
   `#<n> <step>`, the step text of the plugin, and the command of the `run` line as the first
   prompt;
4. in a herdr pane, ends the session when the issue shows that the step is done.

The runner starts at an issue: write one with `/celetis:intake`, or open one on GitHub. Then, for
the feature `#12`:

```bash
scripts/celetis agent-flow 12    # triage
scripts/celetis agent-flow 12    # specify: the session asks, and it waits for your approval of the design
scripts/celetis agent-flow 12    # plan
scripts/celetis agent-flow 12    # implement: it builds, verifies, and lands
```

With each gate `me`, one start runs one step. With a gate `auto`, a start goes on through that step
by itself, and `scripts/celetis agent-flow` with no number is the automatic runner: it runs each
`auto` step of each open issue. A Run press on the agent board is the same start, in a new herdr
tab.

A step session follows the step text: it asks only for a decision that the issue does not hold, and
at a stop it puts the reason on the issue and adds `ready-for-human`. The `specify` session has no
step text: it waits for your approval of the design, as a session by hand does.

`docs/agent-flow.md` holds the runner in full. `docs/issue-tracker.md` holds the labels, what lives
on the issue, the branches, and the order of the resolver.

## The skills

In a session, a skill of the plugin is `/celetis:<skill>`. A skill of the project keeps its short
name.

| Group | Skill | What it does |
|---|---|---|
| **Lanes** | [`/celetis:intake`](skills/intake/SKILL.md) | Writes the intent of a raw request onto an issue. It classifies nothing |
| | [`/celetis:triage`](skills/triage/SKILL.md) | Picks the lane of an issue whose type is not known, and sets the lane label |
| | [`/celetis:feature`](skills/feature/SKILL.md) | The lane for new behavior: the scope check that can make an epic, the worktree, and then `specify` |
| | [`/celetis:bug`](skills/bug/SKILL.md) | The lane for existing behavior that is wrong: the root cause with `superpowers:systematic-debugging`, the `## Root cause` report, and then `plan` |
| | [`/celetis:hotfix`](skills/hotfix/SKILL.md) | The lane for broken production: the root cause, a plan of one task, `implement`, and the ship checklist |
| | [`/celetis:chore`](skills/chore/SKILL.md) | The lane for a change with no change of behavior: the change, the verify gate, the commit, and the landing |
| **Steps** | [`/celetis:specify`](skills/specify/SKILL.md) | The design step. It adds the project context to `superpowers:brainstorming`, and the spec that you approve becomes the body of the issue |
| | [`/celetis:plan`](skills/plan/SKILL.md) | The plan step. It adds a capability score for each task and a Verify phase to `superpowers:writing-plans`, and it posts the plan on the issue |
| | [`/celetis:implement`](skills/implement/SKILL.md) | The build step. It adds the verify gate before each review, the Verify phase, and the landing to `superpowers:subagent-driven-development` |
| **Review and memory** | [`/celetis:critic-loop`](skills/critic-loop/SKILL.md) | Scores the current diff from 0 to 10 across five perspectives, and fixes and scores again until the diff passes |
| | [`/celetis:polishing-code-comments`](skills/polishing-code-comments/SKILL.md) | A pass that removes and tightens the comments of a diff or a file |
| | [`/celetis:lesson`](skills/lesson/SKILL.md) | Writes a lesson from a correction or an incident to `docs/lessons/`, with a row in its catalog |
| | [`/celetis:lesson-review`](skills/lesson-review/SKILL.md) | Your review of the lesson drafts that an automatic capture put in a queue |
| | [`/celetis:record-architecture-decisions`](skills/record-architecture-decisions/SKILL.md) | Reads and writes the records of `docs/adr/` |
| | [`/celetis:doc-drift-sync`](skills/doc-drift-sync/SKILL.md) | Keeps the documents of the project true against the code: it fixes the drift that the source proves, and it flags the rest |
| **Helpers** | [`/celetis:prototype`](skills/prototype/SKILL.md) | Builds throwaway code that answers a design question: a logic demo in one HTML file, or UI variants on one route |
| | [`/celetis:writing-for-agents`](skills/writing-for-agents/SKILL.md) | The reference for a document that an agent reads: a skill, or an `AGENTS.md` |
| | [`/celetis:guide`](skills/guide/SKILL.md) | Says which command fits a goal. Only you can start it |

Two documents of the plugin are not skills: `docs/capability.md`, the rubric of the capability
score, and `docs/docs-lookup.md`, the lookup of the external facts.

## The commands

A product project runs each script of the plugin as a sub-command of the launcher. A session, you
in a terminal, and the board use the same form:

| Command | What it does |
|---|---|
| `scripts/celetis worktree <n>` | Makes the lane worktree and the branch of the issue, or enters the one that is there, and prints its path |
| `scripts/celetis worktree --remove <n>` | Removes the lane worktree and the branch of an issue that ended with no landing by the script |
| `scripts/celetis land <n> '<subject>'` | Lands the change of the issue by the mechanism of `landing.json`. It is the one landing path of an agent |
| `scripts/celetis next-step <n> \| --open \| --json` | The resolver: the next step of one issue, of each open issue, or the rows for the board |
| `scripts/celetis capscore J V B N S X` | Prints the CAP line of a task: its model and its effort, from six digits of the rubric |
| `scripts/celetis agent-flow [<n>...] \| --board \| --resume <n>` | The runner: the next step of each number, or the automatic runner with no number. `--board` prints the data of the board, and `--resume` opens the session of a step with no progress again |
| `scripts/celetis root` | Prints the install folder of the plugin. The runner uses it after an update |

- The form has no `./`: the `allow` rule matches the text of the command.
- Each sub-command gives the output and the exit code of its script.
- Run a command in a checkout of the product project: the plugin holds the scripts, so only the
  current folder names the project. `capscore` and `root` run in each folder.
- With no installed plugin, the launcher prints one line with the two install commands and exits 1.

## Updates

The plugin has no `version`, so each commit on `main` of this repository is a new version, with no
release step.

- **A step of the runner.** Before the runner starts the session of a step, it runs two commands,
  in this order:

  ```bash
  claude plugin marketplace update celetis
  claude plugin update celetis@celetis --scope user
  ```

  They bring the plugin of the machine to the head of `main`. So a change that lands here reaches
  the next step of each product project, with no act by hand. When one of the commands fails, the
  runner prints `agent-flow: the plugin update failed; the session starts on the installed version`
  and starts the session. After a successful update, the session gets the skills and the step text
  of the new version (`docs/agent-flow.md`, "How a step runs").
- **A session by hand** gets no update from the runner. The block of the project file turns
  auto-update on for the marketplace `celetis` ("Wire a product project"). An interactive session
  then updates the copy on disk at most 10 minutes after its first message. That session keeps the
  version that it loaded, and the next session loads the new one: a change reaches a session by
  hand one session late (ADR-0010, and ADR-0012, R2). The two commands bring a change at once.
- **By hand, at once:** the same two commands. The second command alone can miss a commit: it makes
  no fetch for about 30 seconds after a refresh of the marketplace. The update with no `--scope`,
  `claude plugin update celetis@celetis`, moves only the `project` record of a checkout that has
  one, and a new session does not get the new version.

A bad change reaches each product project at once. The gate and the workflow of this repository are
the guard, and a revert on `main` is the way back. ADR-0012 holds two limits:

- It is not shown which record an interactive session in a trusted checkout loads when that
  checkout has a `project` record that is behind the `user` record.
- A runner that stays open for more than 14 days after an update can lose the folder of its
  version. The cure is a new start of the runner (`docs/agent-flow.md`, "Limits").

## The agent board

The board is the package `ddinkov10/agent-board`: one local web page that shows each agent session
of a repository and the next step of each issue, and that starts a step with one press. Neither
the plugin nor a product project holds a file of the board.

Start it in the main checkout only, never in a lane worktree, and open the URL of its last line:

```bash
npx 'github:ddinkov10/agent-board#semver:^1'    # the last line: agent-board: http://127.0.0.1:<port>
```

The quotes are necessary. `npx --yes` answers the install question of the first start.

The config of the board is `.claude/agent-flow/board.json`. Its three entries name the launcher, so
the product project holds no other file for the board:

```json
{
  "data": ["scripts/celetis", "agent-flow", "--board"],
  "run": ["scripts/celetis", "agent-flow", "{n}"],
  "resume": ["scripts/celetis", "agent-flow", "--resume", "{n}"],
  "port": 4403
}
```

| Key | Use |
|---|---|
| `data` | The board starts it for each read of the issues. It prints contract 1, the JSON document that the board reads |
| `run` | A Run press types it in a new herdr tab. It starts the next step of the issue `{n}` |
| `resume` | A Resume press types it in a new herdr tab. It opens the session of a step with no progress again |
| `port` | The port, when `PORT` is not set. With no `port`, it is 4403 |

Two boards on one machine need two ports: the `board.json` of this repository has 4404. The board
reads its config one time, at its start, from the main checkout.

Check the data against the contract in the main checkout:

```bash
scripts/celetis agent-flow --board | npx 'github:ddinkov10/agent-board#semver:^1' check --stdin
```

`docs/agent-flow.md`, "The board", holds the requirements, the fields of the data, and the state of
each card. The README of the package holds the page:
`https://github.com/ddinkov10/agent-board#readme`.

## Tests

Run the tests in a checkout of this repository.

- **The gate** is `scripts/verify.sh`. It runs each `tests/*.test.sh`, then
  `scripts/capscore.sh --test` and `claude plugin validate .`, and its last line is `verify: PASS`.
  The six tests are for the runner, the resolver, the landing script, the worktree script, the
  launcher, and the text of the plugin.

  ```bash
  AGENT_BOARD=<checkout of agent-board>/cli.mjs scripts/verify.sh
  ```

  `AGENT_BOARD` names the entry file of a local checkout of the board package, for the contract
  check of the `--board` documents.
- **The workflow** `.github/workflows/test.yml` runs each `tests/*.test.sh` and
  `scripts/capscore.sh --test` on Linux, for each pull request and for each push to `main`. It sets
  `AGENT_FLOW_SKIP_BOARD_CHECK=1`, so it does not make that contract check: the gate on a machine
  does.
- **The proof on bash 3.2.** Each script and each test also runs under the `/bin/bash` of macOS:

  ```bash
  PATH="/bin:$PATH" /bin/bash tests/<name>.test.sh
  ```
- **The text test,** `tests/text.test.sh`, holds the rules of the general text. It fails on a word
  of its list of product words in a file that is no record of `docs/adr/`. It fails on an ADR
  number that names no record of `docs/adr/` and has no `ddinkov10/fwrh_calculator` before it. It
  fails on a skill that does not end with the line of its custom part.
- **The hand-run test,** `tests/manual/step-prompt.test.sh`, checks the step text in headless
  `claude -p` turns. It needs a `claude` that is logged in, it uses tokens, and an answer can
  differ between two runs, so the gate and the workflow do not run it. Run it after each change of
  `step-prompt.md`, and in a product project after each change of the part of its `AGENTS.md` on
  the agent flow. In a product project, start it in the main checkout:

  ```bash
  bash "$(scripts/celetis root)/tests/manual/step-prompt.test.sh"
  ```

  The test then reads the step text of the installed plugin, and it runs its turns in that
  checkout.

`docs/agent-flow.md`, "Check the harness", holds the tests in full, with the reason of each fact of
this part.
