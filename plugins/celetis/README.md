# celetis

`celetis` is a general agent harness with required automation for Claude Code and Codex TUI/CLI.
The shared flows also allow manual or inline invocation in the Codex desktop app.
It takes a request from free text to a change on the trunk through one GitHub issue: the intent,
the lane, the spec, the plan, the
build, and the landing. The issue is the state store: each result goes onto the issue, and each
hand-off reads the issue again.

Codex remains opt-in while required CLI workflow acceptance is incomplete. Changed-pair same-child repair and final live workflows still need proof. Open sessions have
no immutable-resource or automatic skill-reload guarantee (ADR-0028). Desktop automation is optional and has separate evidence in
[Acceptance status](docs/workflow.md#acceptance-status).

The repository holds the plugin in `plugins/celetis/` and the engine beside it, and it reaches a
machine in two forms:

- The plugin of each host gives its sessions the 34 skills ("The skills"), the procedure modules,
  the principles, the entry hook, and the documents. The step text of a run is `step-prompt.md`.
- The engine is the folder `engine/`, with its entry `engine/celetis` ("The commands"). It runs
  each command, also the daemon and the board, and the daemon gives each step session a facts
  header and the step text. The maintenance scripts are in `scripts/`.

The plugin declares the contract version that it needs, and the engine declares the contract
versions that it serves; a step session starts when the engine serves that version.

There are two kinds of repository:

- The **plugin repository** is this one, `ddinkov10/celetis`. It is private, and it is also the
  marketplace `celetis` with one plugin, so the id of the plugin is `celetis@celetis`.
- A **product project** is any repository that uses the plugin. This repository also runs its
  own lanes on its own installed plugin and engine.

A product project holds no Celetis launcher, runtime source, skill, or document of the harness. It holds only what is its own:

| Part | Place in the product project |
|---|---|
| The host wiring | Claude: `.claude/settings.json`. Codex: the installed plugins and trusted `.codex/config.toml` and `.codex/rules/` ([setup document](docs/setup.md)) |
| The config | `.celetis.yaml` |
| The record of setup | `.claude/celetis/wiring.json` |
| The worktree setup | `worktreeSetup` in `.celetis.yaml` |
| The custom parts | `custom.<skill>` in `.celetis.yaml`, one string for each skill that needs one |
| The product facts and Celetis entry pointer | `AGENTS.md` |
| The stores | `docs/adr/`, the decision records that the product owns, and `.celetis/lessons/`, the lesson store that the engine manages ([setup document](docs/setup.md#the-stores)) |

No file of the plugin names a part of a product, apart from the records of `docs/adr/`. The plugin
names a role, for example "the verify gate of the project", and the product project names the
thing. A lane ends when the change is on the trunk, which is the default branch of the repository
on GitHub: the verify gate, the deployment, and each other part of a product stay in the product
project. The plugin has no `version` or declared dependency. Shared permissions restrict direct
merges. Personal host rules allow landing. Native skill entry still reads its whole active file
through the host's permission controls and applies only that skill's custom text.

Each skill starts with one entry line. `references/procedures/entry.md` gives the entry on each host
(ADR-0047, ADR-0050). ADR-0042 owns the engine, its install, and its update.

The documents:

- [Setup document](docs/setup.md): what `/celetis:setup` writes, owns, preserves, and reports.
- [Workflow document](docs/workflow.md): what a person and a session meet in a run.
- [Configuration document](docs/configuration.md): `.celetis.yaml`, the agent order, and the
  operation values.
- [Engine document](https://github.com/ddinkov10/celetis/blob/main/engine/README.md): the daemon,
  the runs, the queue, and the event record.
- [Board document](https://github.com/ddinkov10/celetis/blob/main/engine/board/README.md): the
  agent board.
- [Scripts document](https://github.com/ddinkov10/celetis/blob/main/scripts/README.md): the verify
  gate and the maintenance scripts.

## Requirements

- macOS or Linux for the daemon. Native Windows has no daemon: it does not start there, and
  each form of `run` and `queue` that sends a request exits 3, and each form of `coordinator` exits 3
  too. The engine installs from Git Bash and
  runs from Git Bash, PowerShell, and `cmd`, and its Windows checks are open. Before the engine,
  the data of the board before #102 and the update lock passed their checks
  ([Acceptance status](docs/workflow.md#acceptance-status)).
- The selected host CLI: Claude Code 2.1.299 or later, or Codex CLI 0.162.1 or later. The Claude
  entry hook reads the `skill.prompt` fields `source`, `pluginName`, and `path`, which came in
  2.1.299. On an older release, the hook makes no entry, and the session takes "Entry without the
  hook" of `references/procedures/entry.md`, as on Codex. Codex 0.162.1 is the lowest release
  on which the install, the refresh, and the lookup of the plugin were checked; an older release
  is not supported. These versions are a floor, not proof of the full workflow
  ([Acceptance status](docs/workflow.md#acceptance-status)).
- `gh` (logged in), Bun 1.4.4 or later, `git` 2.31 or later, and the engine `celetis`
  ("First install") on `PATH`. No jq or Perl runtime is needed. On macOS and Linux, the engine starts Bun through `env -S`. The
  `env` of macOS and of GNU coreutils 8.30 or later has `-S`; the `env` of busybox does not.
- Git credentials for GitHub that need no prompt for an https URL: a credential helper, or a
  `url.<ssh>.insteadOf` rule and an ssh key. The plugin repository is private, and the first
  install and `celetis update` read it through its https URL.
- Superpowers, installed and enabled on the selected host: the lanes call its `superpowers:*` skills.
- The scripts use only the REST API of GitHub (`gh api`), so they also work where a proxy refuses
  GraphQL, as in a Claude Code cloud session.
- The trunk of the main checkout is current. The trunk is the default branch of the repository on
  GitHub. The config comes from the main checkout of the product project, and so does the custom
  part of a step that the script starts (`docs/configuration.md`, "Fields and defaults"):
  after each landing, `celetis --agent <host> land` moves the trunk of the main checkout. With the
  landing `merge`, it also fast-forwards a clean main checkout on the trunk that is only behind
  `origin/<trunk>` before it lands. A checkout with uncommitted changes, off the trunk, or with
  commits that `origin/<trunk>` does not have is a refusal with exit 6 that names that work. After a
  merge by other means, or after the `land` line that says that the main checkout did not move,
  run `git pull` in the main checkout.
- For Codex children with model tiers, the profile and current runtime allowlist from
  `docs/capability.md`. With no profile, each Codex child keeps the parent's model.
  The actual dispatch surface must support the resolved model and effort on isolated starts
  and same-pair follow-up. In the task loop, `dispatch` returns the action `replace` when the
  effective pair of a child changes ([Dispatch records](docs/capability.md#dispatch-records)). CLI and
  desktop capabilities can differ.
- For a look decision and a visual bug: `gh` 2.99.0 or later on github.com, and the capture tool of
  the platform row (`references/procedures/ui.md`, "Captures"). A look decision on the `impeccable` path
  (a whole web or mobile screen, or a smaller web change) also needs the `impeccable` skill and a
  `PRODUCT.md` of the product. The session checks for both. It never installs `impeccable`, which
  is no plugin dependency, and you run `/impeccable init` once for the product
  (`references/procedures/design.md`, "The check"). A look decision on the `generate` path also needs
  the window browser, and the host reviews its `browser_run_code_unsafe` call
  (`references/procedures/design.md`, "The page CSP"). Each browser check (a Verify scenario of a web
  UI, the captures, the component research, the design review) needs the background browser. Both
  browsers are Playwright MCP servers, and the plugin installs and configures neither
  (`references/procedures/browser.md`, "The two browsers"). The server `playwright` is the
  background browser, with `--isolated` and `--headless`. The server `playwright-window` is the
  window browser, with `--isolated` and no `--headless`. Each machine adds them as
  "Each machine: Claude Code" and "Each machine: Codex only" say.
- For the research of a UI component, optional tools that you install: a code-search tool (for
  example the grep.app MCP server), a web fetch or scrape tool, and the background browser. The
  session uses each one that it has and records a limit for each missing one
  (`references/procedures/component-research.md`).
- On macOS, herdr-core 0.1.19 (`hc`) with its running server, and the open window of the Herdr app
  0.1.15 (`herdr-app`), for each run and for the board: each session runs in a tab
  of the Herdr app (ADR-0058, ADR-0062). The host reports its status to herdr-core with OSC 7501
  and needs no integration: Claude Code since 2.1.295, and Codex 0.166.0. A host release that
  reports no status gets no step end and no session card.
- For the board: a Chromium browser.

[The engine document](https://github.com/ddinkov10/celetis/blob/main/engine/README.md#requirements)
gives the requirements of the engine, and
[the board document](https://github.com/ddinkov10/celetis/blob/main/engine/board/README.md)
gives the requirements of the board.
The [configuration document](docs/configuration.md) gives the repository schema and the
commands that install Bun.

## Wire a product project

### First install

Install the engine `celetis` one time on each machine. Run this command in a normal terminal, or
in Git Bash on Windows:

```sh
celetis_tmp="$(mktemp -d)" &&
  git clone --quiet https://github.com/ddinkov10/celetis.git "$celetis_tmp/celetis" &&
  BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 bun --no-env-file --no-install --config=/dev/null --no-macros "$celetis_tmp/celetis/engine/celetis" install &&
  rm -rf "$celetis_tmp"
```

`celetis install` installs the revision of the clean checkout that it runs from, here the trunk of
`ddinkov10/celetis`. The checkout must be on a branch, with no uncommitted changes; a linked
worktree is also a checkout. The URL of the clone is the source of the engine, and the branch of
the checkout is its ref: `celetis update` moves the engine to the head of that branch of that
source. `<base>` is `CELETIS_HOME` when that variable is not empty, else the
home folder; set it for each process that runs `celetis`. The engine refuses a `CELETIS_HOME` that
is not an absolute path, and the install then exits 2. The install makes these entries:

- `<base>/.local/share/celetis/versions/<revision>/` is a Git clone of the source of the checkout,
  on its branch, at that full revision. The install refuses a version folder that holds another
  engine.
- On macOS and Linux, `<base>/.local/bin/celetis` is a symbolic link to the file `engine/celetis`
  of the current version folder. An install replaces the link in one atomic step, so the daemon or a board
  that runs keeps its own version folder.
- On Windows, `<base>/.local/bin/` holds two shims of fixed text: `celetis` for Git Bash, and
  `celetis.cmd` for PowerShell and `cmd`. Both read the current revision from
  `<base>/.local/share/celetis/current`. An install writes only `current`, so a shim that runs
  never reads changed text. A partial set of these three entries reads as no engine, and the
  next install writes the absent entries.

An install keeps the three newest version folders, the current one, and the installed version
that runs that install. It removes the other version folders. It changes no file outside
`<base>/.local/share/celetis/` and its own entries in
`<base>/.local/bin/`. When `<base>/.local/bin/celetis`, or `celetis.cmd` on Windows, is there and
is not an entry of the engine, the install refuses and changes nothing. Move that entry away, then run the install again.
An install that stopped partway leaves a staging folder in `versions/`, or the renamed folder of a
version folder that it began to remove. The name of each starts with a dot, and the next install
removes each. When it cannot remove one, that install fails before it changes the engine: remove
the folder that the error names, then run the install again.

`celetis --version` prints the full revision of the engine.

`~/.local/bin` (`<base>/.local/bin`) must be on `PATH` in a terminal, in the Bash tool of Claude
Code, and in Codex. When it is not, the install says so and names the folder. An app that starts
from the desktop reads the `PATH` of the login shell or the user `Path`, so add the folder there
too:

- zsh: add `export PATH="$HOME/.local/bin:$PATH"` to `~/.zprofile` and to `~/.zshrc`.
- bash: add the same line to `~/.bash_profile` and to `~/.bashrc`.
- Windows: in PowerShell, run
  `[Environment]::SetEnvironmentVariable('Path', "$env:USERPROFILE\.local\bin;" + [Environment]::GetEnvironmentVariable('Path', 'User'), 'User')`.

Then open a new terminal, and start each host again. After the first install, use `celetis update`
or the board's update control ("Updates").

### Each machine: Claude Code

1. Add the marketplace, and install the plugin:

   ```bash
   claude plugin marketplace add ddinkov10/celetis
   claude plugin install celetis@celetis
   ```

   The install enables the plugin at the `user` scope, so each session of the machine loads it, in
   each folder. A session in a project that is not wired also lists the 34 skills. Before its
   first step, each lane skill (`feature`, `bug`, `chore`, `hotfix`) runs
   `celetis --agent <host> setup status`. When the wiring is incomplete, the lane shows each gap
   and `Run /celetis:setup in the main checkout: <path>`, and stops before any issue, label,
   branch, or worktree change.

   The user install is the only supported Claude install. A project install of `celetis@celetis`
   makes discovery refuse, with an error that says the Claude installation is ambiguous. Setup writes no project
   enable of the plugin.

   The engine finds the enabled plugin through native metadata (`celetis update check` and the
   check of the daemon), so the two commands are necessary on each machine. It is not shown that
   the block of the project file ([Claude permissions](docs/setup.md#claude-permissions-claudesettingsjson)) loads the plugin with no install. In the probe, a
   headless turn in a new repository whose project
   file held the marketplace and the two plugins loaded no plugin and added no marketplace. A
   headless turn shows no workspace trust dialog, so the probe does not show what an interactive
   session does after that dialog (ADR-0012, R1).
2. Add and install Superpowers:

   ```bash
   claude plugin marketplace add obra/superpowers-marketplace
   claude plugin install superpowers@superpowers-marketplace
   ```
3. Add the two browsers. The two `remove` commands delete an entry that the machine already has,
   also the old `playwright` entry with no `--headless`. A `remove` command exits 1 with
   `No MCP server named` when its entry is absent, and the next command still runs.

   ```bash
   claude mcp remove -s user playwright
   claude mcp remove -s user playwright-window
   claude mcp add -s user playwright -- npx @playwright/mcp@latest --isolated --headless
   claude mcp add -s user playwright-window -- npx @playwright/mcp@latest --isolated
   ```

   A run on a machine with both entries leaves the same two entries. The commands change only the
   `user` scope.
4. Last, turn on auto-update for superpowers. In `~/.claude/settings.json`, add
   `"autoUpdate": true` beside `source` in the entry `superpowers-marketplace` of
   `extraKnownMarketplaces`. Do this step last, and again after a later run of an add command: in
   Claude Code 2.1.296 that command writes the entry again with `source` only. The entry `celetis`
   uses `"autoUpdate": false` in the project file. See [Updates](#updates) before changing an
   installed Celetis package. The Superpowers setting stays independent.

### Each machine: Codex only

Use a signed-in Codex CLI and Git credentials that can read this private repository without a
prompt. Claude is not required. Add the Git source, then install the plugin:

```bash
codex plugin marketplace add ddinkov10/celetis --ref main
codex plugin add celetis@celetis --json
```

The engine finds the enabled installation through `skills/list`; it does not calculate a cache
path. A local-path marketplace is unsuitable for `celetis update`: it reads the contract file of the
plugin from a Git source, and `plugin marketplace upgrade celetis` requires a Git source. The check
of a new step reads no Git source, so a step can start with a local source ("Updates"). `--ref main` selects the landed source, the branch of the engine. For an unlanded check, use supported checkout loading with the existing host and authentication. These commands and result fields were checked
on Codex 0.162.1. See the [Codex CLI reference](https://learn.chatgpt.com/docs/cli/reference).

Install Superpowers from its Git marketplace:

```bash
codex plugin marketplace add obra/superpowers-marketplace
codex plugin add superpowers@superpowers-marketplace --json
```

This installed Superpowers 7.0.0 on Codex 0.162.1. The Superpowers README also gives a catalog
route: search for Superpowers in Codex's `/plugins` screen or the desktop Plugins page. Start a
new chat and check that both plugins' skills are available. A missing required skill stops its lane.

Codex saves user plugin choices in its configuration. A trusted product project can explicitly
enable celetis in `.codex/config.toml`:

```toml
[plugins."celetis@celetis"]
enabled = true

[plugins."superpowers@superpowers-marketplace"]
enabled = true
```

The [plugin configuration documentation](https://developers.openai.com/plugins/build/plugins)
describes project trust and enablement. Install each host's plugins separately. A Claude install
does not provide the Codex installation.

Add the two browsers. The two `remove` commands delete an entry that the machine already has, also
the old `playwright` entry with no `--headless`, and exit 0 when it is absent. A run on a machine
with no entry, the old entry, or both entries leaves the same two entries.

```bash
codex mcp remove playwright
codex mcp remove playwright-window
codex mcp add playwright -- npx -y @playwright/mcp@latest --isolated --headless
codex mcp add playwright-window -- npx -y @playwright/mcp@latest --isolated
```

### Personal landing permission

A build step ends with `celetis --agent <host> land <n> '<subject>'`. On each machine that lands,
give each host one personal allow rule for `land`. The rule names the engine, the host, and the
sub-command, so one rule serves each issue and each subject:

- Claude Code: add `Bash(celetis --agent claude land *)` to `permissions.allow` of the untracked
  `.claude/settings.local.json` of the product. With the PowerShell tool on Windows, also add
  `PowerShell(celetis --agent claude land *)`. Keep the other fields of the file.
- Codex: put `prefix_rule(pattern=["celetis", "--agent", "codex", "land"], decision="allow")` in
  `~/.codex/rules/celetis-land.rules`. Keep the other rules.

No rule changes after an update: an update changes the version folder behind the engine, not
its name. The rules pin no Bun: the entry of the engine finds `bun` on `PATH`, as `land` finds
`git` and `gh`. The shared rules of the product keep the direct-merge restriction.

The rule of `issue` is optional. The path for `issue` is the review of the host: in the checks of
#103, Claude in auto mode ran it with no rule, and a Codex sandbox block of `issue` goes through
the approval procedure of `references/procedures/entry.md`, "The contract", "Codex". The risk of the
rule: an allow rule skips the review of the host for each `issue` call, and each act with a file
posts the text of a path that the session names, so a session can post any file that it can read
(for example a token file) on the issue. Text from an issue can steer a session. Add the rule only when the host cannot run
`issue` through its review, for example Codex with the approval policy `never`. Its forms are
`Bash(celetis --agent claude issue *)` and
`prefix_rule(pattern=["celetis", "--agent", "codex", "issue"], decision="allow")`, in the files of
the rules of `land`.

A Claude rule matches the whole command text, and `*` stands for any text. Each command of a
compound command must match a rule of its own. Codex compares argument lists. It splits a shell
script into commands only when each word is plain or quoted
([Codex rules](https://learn.chatgpt.com/docs/agent-configuration/rules)). A leading assignment, a
quoted first word, or a substitution outside single quotes keeps the whole script in one shell
argument, and the rule does not match it. A single quote in the subject, or in the file of an act,
becomes `'\''` and stops the split, so that call needs approval. Both rules match the bare name
`celetis`: a call through a path, such as `~/.local/bin/celetis`, matches no rule and needs
approval. Codex runs a command that an `allow` rule matches outside the sandbox. The
`workspace-write` sandbox has no network access by default: there `gh` cannot reach GitHub, and
`issue` exits 6 before any write, unless its rule matches or an approval lets it run outside the
sandbox.

Before you rely on a rule, check that it permits `land` of its host, and that it refuses another
sub-command, the other host, and direct merge. This command shows the decision of a Codex rule. It
compares the argument list as given, so it does not show the shell split:

```sh
codex execpolicy check --rules ~/.codex/rules/celetis-land.rules celetis --agent codex land 1 'feat(x): y'
```

### Wire the project

The parts above stay by hand on each machine. Then run `/celetis:setup` in the main checkout of
the product project. The [setup document](docs/setup.md) gives what setup writes, owns,
preserves, and reports, and the review of old wiring. The
[configuration document](docs/configuration.md) gives the fields of `.celetis.yaml`.

## The full loop

One request goes from free text to a change on the trunk. The example is a feature, the lane that
has each step.

**In a session by hand.** Start the selected host in the main checkout of the product project.
In a terminal, start Codex with `codex --no-daemon` so its hooks use the current pane's environment.
The table uses Claude's `/celetis:<skill> <input>` form. In Codex CLI or a desktop chat, use the
advertised skill name: `Use the celetis:<skill> skill for <input>. Complete its Celetis entry before any response, including commentary.`, or select that skill in the
host's skill selector. Native desktop selector acceptance is optional under
[Acceptance status](docs/workflow.md#acceptance-status).

| You type | The session | It leaves on the issue |
|---|---|---|
| `/celetis:intake <the request>` | writes the intent in your words, and asks "proceed?" | a new issue `#<n>` with the intent and the label `needs-triage` |
| `/celetis:triage #<n>` | picks the lane and the model and the effort level of its first step, and asks whether to go on | an `Effort: specify <model> <level>` comment with its reason, and the lane label, here `enhancement` |
| `/celetis:feature #<n>` | makes the lane worktree and runs `specify`: the design, in a conversation with you, then the model and the effort level of `plan` | an `Effort: plan <model> <level>` comment, and the spec that you approved, as the body of the issue |
| `/celetis:plan #<n>`, in a new session | writes the plan: your steps (the human acts of the lane), the build flow, tasks with a capability score, and a Verify phase; then it picks the model and the effort level of `implement` | an `Effort: implement <model> <level>` comment; a `## Plan` comment; `ready-for-agent` unless `ready-for-human` holds the issue, in which case the human hold stays and the agent label is removed |
| `/celetis:implement #<n>`, in a new session | builds the tasks in the flow that the `Execution:` line of the plan names (`inline`: the session builds each task and runs the verify gate of the project, then one review of the branch; `subagent`: an implementer, the verify gate of the project, and a review for each task), runs the Verify phase, and lands the change with `celetis --agent <host> land` | the change on the trunk, and a closed issue |

- Change work includes affected current documentation in its existing tasks and reviews before
  completion. [Current behavior documentation](references/procedures/behavior-documentation.md) also
  covers repairs and drift maintenance, while preserving historical change records on GitHub.
- The plan and runtime checks use [Runtime verification](references/procedures/runtime-verification.md)
  to identify the tested source and confirm the actual running target before a runtime PASS.
  Its [Usage-limit exception](references/procedures/runtime-verification.md#usage-limit-exception) can
  permit landing with one host verified; the other host's quota-blocked coverage stays incomplete.
- Projects can reuse [verification recipes](references/procedures/verification-recipes.md) through an
  optional `AGENTS.md` pointer. A small feature map links documented flows and their existing
  tools; it does not promise complete coverage. Prefer an existing document, or
  `docs/verification.md` when the project chooses and permits a new one. Without a pointer or
  relevant recipe, planning and verification continue normally, with no new setup or landing
  requirement. Plans still define change-specific acceptance and current evidence. Optional
  retention belongs before final review; knowledge first found afterward stays in the runtime
  report. Reuse adds no scenario run, and past success supplies no current PASS.
- Explicit `/celetis:create-verification` creates recipes for up to three core flows, or your
  requested scope, and requires at least one real flow with current PASS evidence. It reuses the
  existing home and preserves other coverage. It edits documentation in the active checkout,
  requires no issue, and creates no lane or delivery steps. It retains a local report and links
  it in the reply; an explicit issue-bound request uses issue reporting. Normal changes keep
  their relevant-only reuse and optional retention.
- Explicit `/celetis:maintain-verification` reviews and exercises every existing map entry. It
  corrects source-confirmed documentation drift and reports defects or capability gaps without
  changing product behavior. A failed, blocked, or unverified mapped flow keeps maintenance
  incomplete. With no map, it recommends creation. It uses the same documentation-only delivery
  and retained-report rules as creation.
- On a yes, `intake` hands on to `triage`, and `triage` hands on to the lane, so the first three
  rows can be one session. `plan` and `implement` each start in a fresh context, and each one reads
  the issue again.
- A chat that already decided the work runs `/celetis:capture <#n or the request>` in that chat.
  The record goes on the issue as a `## Captured` comment, and the current step reads it as your
  answers and still runs each of its checks. A captured plan is converted by `/celetis:plan #<n>`
  in a fresh context; on a `bug` issue, `bug` hands on to `plan` in the same session.
- When you know the type, start the lane directly, with a number or with free text:
  `/celetis:bug the export stops on a report with no rows`.
- A lane and each step after it work in the lane worktree of the issue,
  `.claude/worktrees/<n>-<slug>`, on the branch of the issue. `intake` and `triage` enter no
  worktree. Claude binds the returned path with its worktree tools. Codex binds every command,
  read, edit, and child brief to that exact path and reads its `AGENTS.md` files. A shell `cd`
  alone does not bind later file tools. An app-created detached checkout does not replace the
  lane checkout. Both hosts return to the main checkout for landing.
- The landing puts the change on the trunk by the `landing` field of `.celetis.yaml`. With `pr`,
  `celetis --agent <host> land <n> '<subject>'` waits for the checks, squash-merges the PR, and
  removes the worktree and the branch. With `merge`, it runs the `suite` file in the lane and puts
  the tip on the trunk as one squash commit, with no PR. The daemon runs one landing at a time, and
  a second `land` waits for its turn. `docs/issue-tracker.md`, "Branches, PRs, merge", and
  `references/procedures/landing.md` give the steps.
- The other lanes are shorter. `/celetis:bug` finds the root cause, posts it as a `## Root cause`
  comment, and hands on to `plan`. `/celetis:chore` makes a change with no change of behavior: it
  verifies, commits, and lands in one session. `/celetis:hotfix` fixes broken production in one
  session, and it ends with the ship acts of the project. When its landing stops, it prints your
  checklist: remove `ready-for-human` first, because `land` refuses while the label is on, then
  run `land` in your own shell, then do the ship acts. A request that spans some independent
  features becomes an epic, and each child issue runs its own flow.

**Through the daemon.** The daemon of the repository runs the steps. Start it once with
`celetis daemon start`. Then `celetis --agent <host> run <n>` sends one request to it and
returns at once; the daemon starts the next step of the issue in a new interactive session, in a
new tab of the Herdr app. An accepted start prints its accepted line, and a refusal prints the
line of the daemon; read the progress with `celetis daemon status`. For each step, the run of the
daemon:

1. asks the resolver for the next step: `celetis --agent <host> next-step <n>` prints a `run` line with
   the command of the step, for example `run /celetis:plan #<n>`, or a `stop` line with the reason;
2. checks that the version folder of its engine still has its entry `engine/celetis`, and that the
   engine serves the contract version that the plugin of the session's host needs ("Updates");
3. starts the selected interactive CLI in the main checkout with the host's skill prompt, a
   facts header (the issue, the step, the host, the main checkout, the plugin folder, and the
   landing mechanism), the step text, and the model and the effort level of the step
   ([The start of a step](https://github.com/ddinkov10/celetis/blob/main/engine/README.md#the-start-of-a-step), "The model and the effort level").
   [The daemon](https://github.com/ddinkov10/celetis/blob/main/docs/hosts/claude-code.md#the-daemon)
   of the Claude Code document and
   [The daemon and `developer_instructions`](https://github.com/ddinkov10/celetis/blob/main/docs/hosts/codex.md#the-daemon-and-developer_instructions)
   of the Codex document give the arguments of each host;
4. opens each session in a new tab of the Herdr app, and ends it when the issue shows that the
   step is done;
5. with the default choice, selects the first eligible host of the effective order of the step at
   each session start: the preferred agent of the step in `agents`, when the local order includes
   it, then the other hosts of the local order
   ([Agent selection and model setup](docs/configuration.md#agent-selection-and-model-setup)). After a
   confirmed usage refusal, it ends only its own session and waits until no process of the
   session's tree or with its attempt marker runs. It then starts the same step on
   the next eligible host with the dirty lane kept. When it cannot prove that stop, as for Codex,
   or a background task still runs, no other agent starts. When all
   hosts are limited, it waits for the earliest supplied reset, or for
   `celetis run retry <n> <wait id>`
   ([Usage-limit recovery](https://github.com/ddinkov10/celetis/blob/main/engine/README.md#usage-limit-recovery)).

The daemon works at an issue: write one with `/celetis:intake`, or open one on GitHub. Then, for
the feature `#12`:

```bash
celetis --agent <host> run 12    # triage
celetis --agent <host> run 12    # specify: the session asks, and it waits for your approval of the design
celetis --agent <host> run 12    # plan
celetis --agent <host> run 12    # implement: it builds, verifies, and lands
```

With each gate `manual`, one start runs one step. Each command returns at the answer of the daemon, so
read `celetis daemon status` before the next start. With a gate `auto`, a start goes on through
that step by itself, and `celetis --agent <host> daemon auto on` turns on auto mode of the
daemon: it runs each `auto` step of each open issue whose lane `autoLanes` of `.celetis.yaml`
names, where the name `triage` stands for an issue with no lane, or of each open issue when the
file has no `autoLanes` (`docs/workflow.md`, "Gates"). A Run press on the agent board sends the
same request to the daemon. The daemon opens each session tab of a run in the background, also for
a start from a terminal.

A run lives in the daemon, with its tabs, its lines, and its exit code: read them in
`celetis daemon status` (the `line` of its row) and in
`<git common dir>/celetis/daemon/daemon.log`. It uses the environment of the daemon from its
start. `--agent` and `CELETIS_AGENT` travel in the request; a variable that you export only in the
shell of the command does not reach the run. [Start the script](docs/workflow.md#start-the-script)
says what stops a run.

The queue stays available as issues finish. Read its current identity before an action:

```sh
celetis --agent <host> queue status
celetis --agent <host> queue action '{"kind":"add","number":12,"step":"plan","expected":{"id":null,"revision":0,"current":null}}'
```

The example adds to missing storage; for an existing record use the ID, revision, and current
issue from status. [The continuous queue](https://github.com/ddinkov10/celetis/blob/main/engine/README.md#the-continuous-queue)
gives the actions, the record, and its conversion.

A step session follows the step text: it asks only for a decision that the issue does not hold, and
at a stop it puts the reason on the issue and adds `ready-for-human`. The `specify` session has no
step text: it waits for your approval of the design, as a session by hand does.

[The engine document](https://github.com/ddinkov10/celetis/blob/main/engine/README.md) holds the
daemon and the runs in full. `docs/issue-tracker.md` holds the labels, what
lives on the issue, the branches, and the order of the resolver.

## The skills

The table uses `/celetis:<skill>` as the shared skill notation and the Claude invocation.
On Codex, explicitly name or select the advertised `celetis:<skill>` as described above.

| Group | Skill | What it does |
|---|---|---|
| **Lanes** | [`/celetis:intake`](skills/intake/SKILL.md) | Writes the intent of a raw request onto an issue. It classifies nothing |
| | [`/celetis:triage`](skills/triage/SKILL.md) | Picks the lane of an issue whose type is not known, and sets the lane label |
| | [`/celetis:feature`](skills/feature/SKILL.md) | The lane for new behavior: the scope check that can make an epic, the worktree, and then `specify` |
| | [`/celetis:bug`](skills/bug/SKILL.md) | The lane for existing behavior that is wrong: the root cause with `superpowers:systematic-debugging`, the `## Root cause` report, and then `plan` |
| | [`/celetis:hotfix`](skills/hotfix/SKILL.md) | The lane for broken production: the root cause, a plan of one task, `implement`, and the ship checklist |
| | [`/celetis:chore`](skills/chore/SKILL.md) | The lane for a change with no change of behavior: the change, the verify gate, the commit, and the landing |
| **Steps** | [`/celetis:specify`](skills/specify/SKILL.md) | The design step. It adds the project context, prior-art research, and bounded probes for critical design unknowns to `superpowers:brainstorming`, and the spec that you approve becomes the body of the issue |
| | [`/celetis:plan`](skills/plan/SKILL.md) | The plan step. It adds the choice of the build flow, a capability score for each task, a design-review task for a web or mobile UI change, and a Verify phase to `superpowers:writing-plans`, and it posts the plan on the issue |
| | [`/celetis:implement`](skills/implement/SKILL.md) | The build step. It runs the plan with `superpowers:executing-plans` or `superpowers:subagent-driven-development`, as the `Execution:` line of the plan says, and adds the verify gate at the end of each task, the Verify phase, and the landing |
| **Review and memory** | [`/celetis:critic-loop`](skills/critic-loop/SKILL.md) | Scores the current diff from 0 to 10 across five perspectives, and fixes and scores again until the diff passes |
| | [`/celetis:polishing-code-comments`](skills/polishing-code-comments/SKILL.md) | A pass that removes and tightens the comments of a diff or a file |
| | [`/celetis:lesson`](skills/lesson/SKILL.md) | Captures bounded evidence from corrections or failed repairs as pending proposals in the main checkout, including explicit save requests. An agent reviewer curates them at each landing |
| | [`/celetis:lesson-review`](skills/lesson-review/SKILL.md) | Your optional review of pending drafts, or your audit, edit, supersession, or retirement of selected active lessons, with your approval of the exact change |
| | [`/celetis:record-architecture-decisions`](skills/record-architecture-decisions/SKILL.md) | Reads and writes the records of `docs/adr/` |
| | [`/celetis:doc-drift-sync`](skills/doc-drift-sync/SKILL.md) | Corrects mechanical drift from source and behavioral drift from approved intent; reports implementation defects and uncertain evidence |
| **Principles** | [`/celetis:attack-the-premise`](skills/attack-the-premise/SKILL.md) | Checks a shared premise after two fixes fail |
| | [`/celetis:encode-lessons-in-structure`](skills/encode-lessons-in-structure/SKILL.md) | Uses structural prevention when a mistake or corrective instruction repeats |
| | [`/celetis:make-operations-idempotent`](skills/make-operations-idempotent/SKILL.md) | Checks duplicate runs and recovery for operations that change persistent state |
| | [`/celetis:separate-before-serializing-shared-state`](skills/separate-before-serializing-shared-state/SKILL.md) | Separates write targets or checks required synchronization for concurrent writers |
| | [`/celetis:explain-the-number`](skills/explain-the-number/SKILL.md) | Checks the evidence for measured performance or quality results |
| | [`/celetis:boundary-discipline`](skills/boundary-discipline/SKILL.md) | Checks trust boundaries when external input or validation changes |
| | [`/celetis:model-the-domain`](skills/model-the-domain/SKILL.md) | Clarifies state combinations, branches, and repeated shape rules |
| | [`/celetis:type-system-discipline`](skills/type-system-discipline/SKILL.md) | Uses types and compiler checks to prevent identified errors |
| | [`/celetis:test-behavior-not-implementation`](skills/test-behavior-not-implementation/SKILL.md) | Checks required behavior through observable results |
| **Helpers** | [`/celetis:prototype`](skills/prototype/SKILL.md) | Builds throwaway code that answers a design question: a logic demo in one HTML file, or the live prototype of a look decision, with a capture of each variant in each state on the issue. The options of a whole web or mobile screen and of a smaller web change come from `impeccable` |
| | [`/celetis:feedback`](skills/feedback/SKILL.md) | Files safe conversation evidence as an Intent in `github.com/ddinkov10/celetis` with `needs-triage`. Only you can start it; it files directly and supports corrections in the same session |
| | [`/celetis:capture`](skills/capture/SKILL.md) | Records a design, a root cause, or a plan that a chat decided as a `## Captured` comment, and hands on to the current step. Only you can start it |
| | [`/celetis:accept-epic #<n>`](skills/accept-epic/SKILL.md) | Checks current parent acceptance and completes an epic when its evidence and children permit it. Only you can start it; it creates no lane or run |
| | [`/celetis:assist #<n>`](skills/assist/SKILL.md) | Completes permitted work for the current block, records verified completion, and clears the hold. It asks for missing human contributions and leaves continuation to the normal run |
| | [`/celetis:coordinate`](skills/coordinate/SKILL.md) | The coordinator session that `celetis coordinator` opens: it reports each run, answers a routine question of a run inside the delegation line, and brings each product decision, consent, and host approval to you. Only that command starts it |
| | [`/celetis:writing-for-agents`](skills/writing-for-agents/SKILL.md) | The reference for a document that an agent reads: a skill, or an `AGENTS.md` |
| | [`/celetis:create-verification`](skills/create-verification/SKILL.md) | Creates project-owned recipes and proves at least one core flow. Only you can start it |
| | [`/celetis:maintain-verification`](skills/maintain-verification/SKILL.md) | Reviews and exercises the whole existing verification map. Only you can start it |
| | [`/celetis:guide`](skills/guide/SKILL.md) | Says which command fits a goal. Only you can start it |
| | [`/celetis:setup`](skills/setup/SKILL.md) | Proposes and tests the worktree setup of a product project, writes the wiring in its main checkout, and commits and pushes the wiring after your yes. Only you can start it |

A skill holds only its own steps and judgment. A shared procedure is a module in
`references/procedures/`, for example the entry (`entry.md`), the
lane worktree (`worktree.md`), the child dispatch (`dispatch.md`), the landing (`landing.md`), and
the lookup of the external facts (`docs-lookup.md`). A module is a plain Markdown file, not a skill: a
step of a skill names it, and the session reads it whole when the step comes. The Claude Code and
Codex lines of an operation are in its module.

A general engineering principle has one canonical file in `references/principles/`, regardless of
caller count. Each file has `Applies when`, `Rule`, and `Check` sections. Skills and workflow
steps cite the file when the task meets its trigger, rather than copy the rule. A principle
stands alone, holds no workflow or host procedure, and has no minimum citer count. Entry loads
no principle catalog. `docs/capability.md` and the other
maintainer documents keep their existing role. The rubric of the capability score is the
procedure module `references/procedures/capability-score.md`. The `AGENTS.md` of this repository, "Where
agent text lives", gives the placement rule (ADR-0047 and ADR-0050).

Each principle is also a native skill. An ordinary engineering task can select it or invoke it
by name without an issue, a lane, or project configuration. The normal entry contract applies.
Each invocation reads its one canonical rule file.

`capture`, `coordinate`, `feedback`, `guide`, `setup`, `create-verification`, and `maintain-verification` are explicit-only on both
hosts. Claude reads `disable-model-invocation: true`;
Codex reads `policy.allow_implicit_invocation: false` in each skill's
`agents/openai.yaml`. Guide reads its custom part and gives advice; it starts no
workflow command. Setup runs `celetis --agent <host> setup` in the main checkout, and it enters no
lane worktree.

Feedback uses the fixed Celetis tracker, while intake uses the product tracker. An explicit
feedback request files without another go-ahead and returns the verified URL; it starts no lane.
Later corrections in the same session update that report, preserving external body edits and
closed issues through correction comments. Failed or uncertain writes retain a sanitized draft
for reconciliation instead of blindly creating another issue.

## The commands

A product project runs each command through the installed engine `celetis` ("First install").
`celetis help` prints the commands that a person types:

<!-- scripts/build.ts writes this block from engine/lib/contract.ts. Edit that file, then run scripts/build.ts. -->
```text
usage: celetis [--agent <host>] <command> [<argument>...]

  celetis update                              Updates the engine and the plugin of each host; asks once.
  celetis update check                        Shows the installed and the available revision of each part.
  celetis setup status                        Reports each part of the required wiring that this checkout lacks; writes nothing.
  celetis agents read                         Reads the local ordered agent preference and its version.
  celetis agents replace '<JSON>'             Replaces the local order using order and expectedVersion.
  celetis intake                              Starts a fresh session that asks for your request before intake.
  celetis assist <n>                          Starts fresh interactive assistance for an issue in the main checkout.
  celetis visual <n> <sha>                    Starts a fresh session that makes the visual of a landed commit.
  celetis run <n>                             Asks the daemon to start the next step of one issue and follow its auto gates; returns at once.
  celetis run <n> --effort <level>            Asks the daemon to start the next step of one issue at another effort level, for its first session only.
  celetis run <n> --model <model>             Asks the daemon to start the next step of one issue on another model, for its first session only.
  celetis run resume <n>                      Asks the daemon to open the session of a step with no progress again.
  celetis run retry <n> <wait-id>             Asks the daemon to wake the quota waiter of an issue for one attempt cycle.
  celetis queue action '<QueueAction JSON>'   Saves a queue action; asks the daemon to run its authorized wake.
  celetis queue status                        Reads the current queue and its allowed actions.
  celetis daemon start                        Starts the master daemon of this repository, detached, waits until it answers, and prints the board URL.
  celetis daemon status                       Shows the daemon, the board URL, its auto mode, and its runs.
  celetis daemon stop                         Stops the daemon and waits until its process ends.
  celetis daemon auto on|off                  Turns auto mode of the daemon on or off, and prints its state.
  celetis coordinator                         Opens the coordinator session of the daemon in a tab, or brings its tab to the front.
  celetis lesson-store read main|active       Reads validated lessons; requires explicit --agent.
  celetis lesson-store capture FILE           Saves a pending proposal; requires explicit --agent.
  celetis lesson-store preview FILE           Prepares an exact lesson review; requires explicit --agent.
  celetis lesson-store apply SNAPSHOT DIGEST  Applies a reviewed snapshot and commits it in a linked checkout; requires explicit --agent.
  celetis lesson-store recover                Completes or rolls back an interrupted lesson write; requires explicit --agent.
  celetis root                                Prints the version folder that holds the running engine.
  celetis --version                           Prints the revision of the engine.
  celetis help                                Prints this list.

In a terminal, --agent claude|codex|opencode is optional. CELETIS_AGENT is an explicit choice too.
With neither, the local agent order applies; its initial order is claude, codex.
The skills run the other commands. plugins/celetis/README.md, "The commands", in the folder that celetis root
prints, lists all of them.
```
<!-- The end of the block that scripts/build.ts writes. -->

Each skill call names its host with `--agent claude` or `--agent codex` before the sub-command, as
the table shows. In a terminal, a person can omit `--agent <host>` ("Agent selection and model
setup"):

<!-- scripts/build.ts writes the command table from engine/lib/contract.ts. Edit that file, then run scripts/build.ts. -->
| Command | What it does |
|---|---|
| `celetis --agent <host> lesson-store read main\|active` | Returns validated lesson records, exact file contents, digests, and the resolved checkout as JSON. `main` returns the live files of the checkout that runs it with the pending and rejected data of the main checkout, and `root` names the main checkout. Rejected records appear in `history` with `status: pending-review`; they are not past guidance. `active` reads the live files of the task checkout and ignores its pending folder. A leftover `.celetis/lessons/INDEX.md` fails both reads. Exit status: 0 done, 1 internal, 2 usage, 3 prerequisite, 6 blocked |
| `celetis --agent <host> lesson-store capture FILE` | Reads typed `{schema:1,candidate,expected,name,description,tags,date,source,incidents,body}` JSON and builds the pending record; `expected` is the pending SHA-256 or null for creation. An extension keeps the stored incidents and reviews. Validates the store of `read main` and saves pending evidence in the main checkout only. Equal incident replays are unchanged; stale updates are refused. Exit status: 0 done, 1 internal, 2 usage, 3 prerequisite, 6 blocked |
| `celetis --agent <host> lesson-store preview FILE` | Reads a review request and returns its exact before/after contents of the store of `read main`, watched digests, and snapshot digest without lesson writes. Select pending UUIDs and complete resulting documents as defined in [the lesson format](references/procedures/lesson-format.md). Exit status: 0 done, 1 internal, 2 usage, 3 prerequisite, 6 blocked |
| `celetis --agent <host> lesson-store apply SNAPSHOT DIGEST` | Recomputes the review and applies exactly the approved snapshot under the lock. Changed input or snapshot bytes are stale. Replaying the same review is unchanged; conflicting reuse of its ID is invalid. The digest identifies a version, not its reviewer. In a linked checkout, a live change needs a clean checkout on a branch and becomes one local commit `docs(lessons): <decision> <names>` with a `Lesson-Transaction` trailer, made with the project's hooks; the proposals leave the queue only after that commit. When Git fails but the lesson commit exists, the apply completes. When the lane is still at its old HEAD, the apply restores the before bytes of the live paths, also a hook rewrite, and their index entries, and exits 6. When HEAD moved without the commit, the journal stays (exit 6), and the line names the repair: `git -C <lane> reset --soft <recorded HEAD>`, then `recover`. Exit status: 0 done, 1 internal, 2 usage, 3 prerequisite, 6 blocked |
| `celetis --agent <host> lesson-store recover` | Completes or rolls back the one journal under the lesson lock, from any checkout of the repository. A lane journal completes when its lesson commit exists and rolls back when the lane is still at the recorded HEAD; a lane HEAD that moved without the commit blocks it until `git -C <lane> reset --soft <recorded HEAD>`. These commands require Git and an explicit host, but no issue, run, or configuration file. Only a lane apply and its recovery change the Git index. It exits 2 for invalid input or store, 3 when the input is stale or a lock is busy, and 6 for an access, I/O, or recovery block. Exit status: 0 done, 1 internal, 2 usage, 3 prerequisite, 6 blocked |
| `celetis --agent <host> run <n> \| run resume <n> \| run retry <n> <wait-id>` | Each form sends one request to the master daemon of the repository of the current folder and returns at its answer. `run <n>` starts the next step of the issue, `run resume <n>` opens the saved session of a step with no progress again, and `run retry <n> <wait-id>` wakes the quota waiter of the issue for one attempt cycle. Each session tab of a run, also of `run resume` and of `run retry`, opens in the background: the focus of the Herdr app does not move. An accepted start prints `run: #<n>: accepted as run <run id> of the daemon PID <pid>; read its progress: celetis daemon status`, and an accepted Retry prints `run: #<n>: Retry requested; the waiting run starts one bounded attempt cycle`; both exit 0. A refusal prints the line of the daemon, on stdout for code 0 and on stderr otherwise, and exits with its code: 3 for a busy issue lock, 6 for a failed GitHub read of the issue, 0 for each other end before the first session. With no daemon, it exits 3 and starts nothing. It exits 3 when the daemon runs another revision of the engine or an update removed this engine version, and 6 when the daemon does not answer or the outcome is unknown. On Windows it exits 3 with `run: Windows is not a support target`. Any other form exits 2 with the usage line. Exit status: 0 done, 1 internal, 2 usage, 3 prerequisite, 6 blocked |
| `celetis --agent <host> run <n> --effort <level> [--model <model>] \| run <n> --model <model> [--effort <level>]` | Asks the daemon to start the next step of the issue with `--effort` at `low`, `medium`, `high`, `xhigh`, or `max`, with `--model` on `haiku`, `sonnet`, `opus`, or `fable`, or with both, in either order. Each flag replaces the decided, pinned, or default value of the first session of this start only, and the request carries it. Each later step uses its own pair, and neither flag writes a decision. It needs exactly one issue number; any other form exits 2 with the usage line. Exit status: 0 done, 1 internal, 2 usage, 3 prerequisite, 6 blocked |
| `celetis --agent <host> queue action '<QueueAction JSON>' \| queue status` | `status` prints the view of the queue as JSON. `action` saves one validated action and prints the view; when the action gives a wake, it then sends that wake to the master daemon and prints the answer as `run` does, with the prefix `queue:`. An Add to an empty queue, a Continue, and a Retry exit 3 with no daemon and save nothing. Each session tab of the wake opens in the background. It exits 2 for another form, an agent that differs from the agent choice of the queue, or a queue record that is not valid, 3 for a refused action (for example a stale `expected`), and 6 when GitHub or the queue record cannot be read. Exit status: 0 done, 1 internal, 2 usage, 3 prerequisite, 6 blocked |
| `celetis --agent <host> daemon start \| daemon status \| daemon stop \| daemon auto on\|off` | Starts, reads, and stops the master daemon of the repository of the current folder (`engine/README.md`, "The master daemon"); `auto on\|off` turns auto mode of the daemon on or off and prints `daemon: auto mode <state>`. For `start`, `status`, and `stop` the optional `--agent` selects nothing; for `auto` it selects the host of the auto steps. `start` spawns the daemon detached, which serves the board (`engine/board/README.md`), and exits 0 when it answers, or when a daemon already runs; it then prints `daemon: board http://127.0.0.1:<port>`, except for a daemon of another revision. It exits 3 when `gh`, `hc`, or the Herdr app is missing, and 6 when the hc server or the Herdr app does not answer, or when the daemon ends or stays silent for 30 seconds, for example when its board port cannot open. `status` prints the daemon, the board URL, its auto mode, and one line per run; it exits 3 when no daemon runs or the daemon runs another revision of the engine. `stop` exits 0 when the process ended or no daemon runs. `auto` exits 0 with the state, 3 when no daemon runs or the daemon runs another revision of the engine, the code of a refusal, or 6 when the outcome is unknown. Each form exits 6 when a daemon is known but its process or socket does not answer; `stop` exits 6 too when the process stays for 60 seconds. Windows exits 3, and any other form exits 2. Exit status: 0 done, 1 internal, 2 usage, 3 prerequisite, 6 blocked |
| `celetis --agent <host> coordinator \| coordinator status \| coordinator read <n> \| coordinator send <n> <file> --as maintainer\|coordinator` | Each form sends one request to the master daemon of the repository of the current folder and returns at its answer. `coordinator` opens one interactive session with the skill `coordinate` in a tab `Coordinator`, or brings the tab of the live session to the front; `--agent` selects the host of a new session as `assist` does. `coordinator status` prints the status object of the daemon as one JSON line; each run row holds `attention`, the state that needs a decision (`dialog`, `turn-ended`, or `quota-wait`) or null. `coordinator read <n>` prints the screen and 200 history lines of the live session of the run of issue <n> on stdout and exits 0; when hc gave only the visible screen, it also prints `coordinator: #<n>: hc gave only the visible screen` on stderr, with ` (the session is <why>)` after it when hc gave a reason. It exits 3 with `coordinator: #<n> has no live run session` when the run has no live session, and 6 with `coordinator: cannot read the screen of the tab <tab>` when the read fails. `coordinator send <n> <file> --as maintainer\|coordinator` asks the daemon to type one message into the session of the live run of issue <n>: a header line with the authority and the time, then the text of the file with one final newline removed; it prints `coordinator: sent to #<n> as <authority>` and exits 0. It sends only from the coordinator session (`CELETIS_COORDINATOR`). It exits 2 when the file cannot be read, is not valid UTF-8, or holds an empty text, a text of more than 4096 characters, or a control character other than a newline or a tab; 3 when the caller is not the coordinator session, the issue has no live run with a released session, the run starts, waits for a usage limit, ends, or gets its exit request, or the session shows a dialog; and 6 when the hc status cannot be read or the outcome of the send is unknown. An open prints `coordinator: opened the coordinator session of the daemon PID <pid> in the tab Coordinator`, and an open while the session runs prints `coordinator: a coordinator session runs; its tab Coordinator is at the front`; both exit 0. A refusal prints the line of the daemon on stderr and exits with its code: 3 when the plugin of the host needs a contract version that this engine does not serve or has no coordinator skill, and 6 when the process of the session cannot be read, its tab cannot come to the front, or the start barrier of a new tab does not report. With no daemon, it exits 3 and starts nothing. It exits 3 when the daemon runs another revision of the engine, and 6 when the daemon does not answer or the outcome is unknown. On Windows it exits 3 with `coordinator: Windows is not a support target`. Any other form exits 2 with the usage line. `engine/README.md`, "The coordinator session", gives the rules. Exit status: 0 done, 1 internal, 2 usage, 3 prerequisite, 6 blocked |
| `celetis --agent <host> intake` | Starts a fresh interactive session in the main checkout. It asks “What would you like to work on?” and waits. After an answer, it enters `celetis:intake` with that request. It creates no issue before the answer and does not start a run. Before the start, it checks that this engine serves the contract version that the plugin of the selected host needs, and it exits 3 with the line of that check when it does not. Exit status: 1 internal, 2 usage, 3 prerequisite, 6 blocked, or the exit code of the host session |
| `celetis --agent <host> assist <n>` | Starts fresh interactive assistance for the issue in the main checkout. It completes permitted work for the current block and uses `issue <n> assisted <file>` for verified completion and hold removal. It asks for missing human contributions, then reports the actual next step. It does not start or resume a run or land. Before the start, it checks that this engine serves the contract version that the plugin of the selected host needs, and it exits 3 with the line of that check when it does not. Exit status: 1 internal, 2 usage, 3 prerequisite, 6 blocked, or the exit code of the host session |
| `celetis --agent <host> visual <n> <sha>` | Starts a fresh interactive session in the main checkout that makes the `visual-explainer` diff review of the landed commit `<sha>` of the issue `<n>`. It fetches the trunk from `origin` and refuses a commit that is not on it, and a commit whose page exists. The host writes `docs/superpowers/visuals/<sha>.html` and opens it, changes no other file, and makes no commit. A host with no `visual-explainer` skill says so in the tab and writes no file. The board's Make visual starts this command. Exit status: 1 internal, 2 usage, 3 prerequisite, 6 blocked, or the exit code of the host session |
| `celetis --agent <host> worktree <n>` | Makes the lane worktree and the branch of the issue, or enters the one that is there and brings it up to the trunk, and prints its path. Exit status: 0 done, 1 internal, 2 usage, 3 prerequisite, 4 repair, 6 blocked |
| `celetis --agent <host> worktree --remove <n>` | Removes the lane worktree and the branch of an issue that ended with no landing by the script. It refuses while the issue is open and its branch has no merged PR, so close the issue first. Exit status: 0 done, 1 internal, 2 usage, 3 prerequisite, 4 repair, 6 blocked |
| `celetis --agent <host> land <n> '<subject>'` | Lands the change of the issue by the `landing` field of `.celetis.yaml`. It is the one landing path of an agent. The master daemon of the repository runs the landing, and `land` prints its output and exits with its status; with no daemon, or a daemon of another revision, it exits 3, when the daemon does not answer 6, and for another refusal of the request by the daemon it exits with the code of that refusal. It refuses an issue that is not ready to land. It exits 7 when the change landed and its cleanup stopped; run it again. Exit status: 0 done, 1 internal, 2 usage, 3 prerequisite, 4 repair, 5 checks, 6 blocked, 7 cleanup, 128+n signal |
| `celetis --agent <host> issue <n> route feature\|bug\|chore\|hotfix \| issue <n> effort <step> <model> <level> <file> \| issue <n> epic <file> \| issue <n> epic-state \| issue <n> complete-epic [file] \| issue <n> needs-info <file> \| issue <n> wontfix <file> \| issue <n> spec <file> \| issue <n> root-cause <file> \| issue <n> plan <file> \| issue <n> built \| issue <n> before-landing <file> [--during-the-build] \| issue <n> landing-refused <file> \| issue <n> stopped <file> \| issue <n> ready-for-human \| issue <n> assisted <file> \| issue <n> state` | Makes each workflow write that the engine reads: `route feature\|bug\|chore\|hotfix`, `effort <step> <model> <level> <file>`, `epic <file>`, `complete-epic [file]`, `needs-info <file>`, `wontfix <file>`, `spec <file>`, `root-cause <file>`, `plan <file>`, `built`, `before-landing <file> [--during-the-build]`, `landing-refused <file>`, `stopped <file>`, `ready-for-human`, `assisted <file>`. The assistance act records an attributed `## Human steps done` report before removing present blocking labels; it adds no label and preserves build state. Lifecycle acts write the comment heading before label changes. Each act refuses unmet prerequisites. `state` writes nothing and prints lifecycle facts. `epic-state` writes nothing and prints the current declaration, child snapshot, history, and holds. Epic definition writes preserve the complete parent body; guarded completion publishes its accepted record before closing and leaves readiness labels unchanged. `docs/issue-tracker.md`, "Conventions", gives each act. Exit status: 0 done, 1 internal, 2 usage, 3 prerequisite, 6 blocked |
| `celetis --agent <host> next-step <n> \| next-step --open` | The resolver: the next step of one issue, or of each open issue. Exit status: 0 done, 1 internal, 2 usage, 3 prerequisite, 6 blocked |
| `celetis --agent <host> events [--after <id>]` | Prints each kept entry of the event record of the user as one JSON line, oldest first; `--after <id>` prints only the entries after that entry. `engine/README.md`, "The event record", gives the record. It exits 2 for a relative `CELETIS_HOME`, 3 when the record lock is busy, and 6 for an unsafe folder or lock file. Exit status: 0 done, 1 internal, 2 usage, 3 prerequisite, 6 blocked |
| `celetis --agent <host> config <checkout> <plugin>` | The reader of `.celetis.yaml` for the agent. It first checks that `<plugin>` is a Celetis plugin: a folder whose `.claude-plugin/plugin.json` has `"name": "celetis"`. It then validates the whole file of `<checkout>`, and checks each `custom` key against `<plugin>/skills/<key>/SKILL.md`, a regular file with no symbolic link. It prints the configuration as one compact JSON line. `--agent` selects nothing. It exits 2 for another form, a folder that is not a Celetis plugin, or a missing or invalid file; the line names the field or the plugin folder. Exit status: 0 done, 1 internal, 2 usage, 3 prerequisite, 6 blocked |
| `celetis --agent <host> capscore J V B N S X [--json] [--bias N] [--attempt N] [--reviewer] [--profile FILE] [--runtime-models FILE]` | Resolves the six digits. `--json` gives the score of the selected host and the host pair. With a Codex profile, it selects the profile by live runtime identity and needs `--runtime-models`; with no Codex profile, `dispatch.model` is null. Exit status: 0 done, 1 internal, 2 usage, 3 prerequisite, 6 blocked |
| `celetis --agent <host> dispatch next <n> <task> implementer\|reviewer J V B N S X --bias N [--profile FILE] [--runtime-models FILE] \| dispatch report <dispatch-id> <report-file> \| dispatch gate <n> <task> pass\|fail <gate> <report> [--profile FILE] [--runtime-models FILE] \| dispatch review <n> <task> findings\|blocked [--profile FILE] [--runtime-models FILE] \| dispatch close <n> <task> \| dispatch show` | Acts: `next`, `report`, `gate`, `review`, `close`, `show`. The task loop applies each returned pair and reports exact native arguments/results. Evidence is agent-reported, not independently checked. Records: `/tmp/celetis-<uid>/dispatch/<host>-<session>.json` on macOS and Linux; `<os.tmpdir()>/celetis/dispatch/<host>-<session>.json` on Windows. It exits 0 for a ready, reported, or closed result (also `show`), 2 for bad usage or an invalid `.celetis.yaml`, 3 for a refusal or a busy dispatch lock, 6 for a setup failure, and 8 when the engine stops the task. Exit status: 0 done, 1 internal, 2 usage, 3 prerequisite, 6 blocked, 8 stop |
| `celetis install` | Installs the revision of the clean checkout that it runs from as the engine ("First install"); takes no arguments. Exit status: 0 done, 1 internal, 2 usage, 3 prerequisite, 6 blocked |
| `celetis --agent <host> setup check \| setup write --hosts claude\|codex\|claude,codex\|codex,claude --landing pr\|merge [--suite <file>] [--setup-file <file>] [--ignore <line>] [--baseline-file <file>] \| setup try --hosts claude\|codex\|claude,codex\|codex,claude --landing pr\|merge [--suite <file>] [--setup-file <file>] [--ignore <line>] [--baseline-file <file>] \| setup try --remove \| setup lane <path> \| setup push` | The deterministic part of `/celetis:setup`: validated saved answers from `check`, bounded owned refresh and removal in `write`, the test lane (`try` makes it and runs the worktree setup there, and `try --remove` removes it), the run of the worktree setup in a lane that exists (`lane`), and the commit of planned paths, including deletions, with the push. Every setup run calls the engine; no product launcher is written. Exit status: 0 done, 1 internal, 2 usage, 3 prerequisite, 6 blocked, or the exit code of the worktree setup script |
| `celetis --agent <host> setup status` | Reports the required wiring of the active checkout for the selected host, also from a subfolder or a lane worktree: `origin`, `.celetis.yaml` and its configured files, the Celetis block, the Claude imports and settings or the Codex restriction, the ignore and attribute lines, the record of setup, and the workflow labels. It writes nothing, runs no product file, and fetches nothing. An incomplete report ends with `Run /celetis:setup in the main checkout: <path>`. It exits 0 when the wiring is complete, 3 when it is missing, invalid, or different, and 6 when an observation is blocked. Exit status: 0 done, 1 internal, 2 usage, 3 prerequisite, 6 blocked |
| `celetis agents read \| agents replace '<JSON>'` | Reads the local ordered preference, or replaces it with exactly `order` and `expectedVersion`. It shares the Git common directory across worktrees and requires no YAML. It exits 2 for a replacement that is not JSON or not a valid order, and for an `agents.json` that does not validate. It exits 3 for a stale-edit conflict, and returns the latest order; a busy write lock also exits 3, with no JSON. It exits 6 for an unsafe or unreadable record. Repeating the current order succeeds. Exit status: 0 done, 1 internal, 2 usage, 3 prerequisite, 6 blocked |
| `celetis update \| update check` | Updates the engine and the plugin of each host, and asks once in an interactive terminal. `check` is read-only: it prints one JSON array of the parts. `plugins/celetis/README.md`, "Updates", gives the steps. Any other form exits 2 with the usage line. Exit status: 0 done, 1 internal, 2 usage, 3 prerequisite, 6 blocked |
| `celetis root` | Prints the version folder that holds the running engine. It takes no argument and runs in each folder. Exit status: 0 done, 1 internal, 2 usage, 3 prerequisite, 6 blocked |
<!-- The end of the command table that scripts/build.ts writes. -->

Each command gives the exit code of its class. The `Exit status:` list of a row names the classes that the command declares; the table of the classes follows:

<!-- scripts/build.ts writes the exit-class table from engine/lib/contract.ts. Edit that file, then run scripts/build.ts. -->
| Code | Class | Meaning |
|---|---|---|
| 0 | done | The act completed, or it had no change to make. |
| 1 | internal | An unexpected failure, for example an uncaught error; the message names it. |
| 2 | usage | Bad arguments, or an input file or value that the command refuses. |
| 3 | prerequisite | The current state does not permit the act: an unmet prerequisite, a busy lock, stale input, no daemon, or missing wiring. |
| 4 | repair | The session repairs the lane, then runs the command again: a conflict with the trunk, or a branch or a checkout that moved. |
| 5 | checks | A check of the change is not green. |
| 6 | blocked | A system outside the command failed or did not answer (GitHub, git, the host, the file system, access); a write can be partial. |
| 7 | cleanup | The change landed, and its cleanup stopped. |
| 8 | stop | The engine stops the task; the session escalates. |
| 128+n | signal | The signal n ended the command. |
<!-- The end of the exit-class table that scripts/build.ts writes. -->

These programs are not commands of the engine. Each gives its own exit codes:

| Program | What it does |
|---|---|
| `bun --no-env-file --no-install --config=/dev/null --no-macros engine/usage-hook.ts <capture-directory> <attempt-id>` | Internal Claude usage callback. Reads one native event from stdin and records a bound observation in the private attempt folder. Session arguments select it; it changes no installed setting. Unsupported or mismatched events give no decisive observation. Exits: 0 handled, 1 invalid input or unavailable capture |
| `bun --no-env-file --no-install --config=/dev/null --no-macros scripts/build.ts [--check]` | Builds the delivery with exactly Bun 1.4.4, or compares generated bytes, and modes on macOS and Linux, without writes |
| `bun --no-env-file --no-install --config=/dev/null --no-macros scripts/verify.ts` | Runs this plugin repository's fast gate in its checkout |
| `bun --no-env-file --no-install --config=/dev/null --no-macros scripts/install-tools.ts DESTINATION [--claude]` | Installs pinned development tools into a private destination |
| `bun --no-env-file --no-install --config=/dev/null --no-macros scripts/herdr-lab.ts up \| run <id> <command>... \| down <id>` | macOS only. `up` makes a lab, a private hc core and a second Herdr app window on temporary data under `/tmp/<id>`, and prints the id, then one JSON line. It opens that window behind the app in front, and passes it only the lab keys, `PATH`, and the telemetry opt-out of the shell. `run` runs one command in the lab environment. `down` stops only the processes of that lab, checks that the real core and window hold no lab text, and deletes the lab. Exit status of `up` and `down`: 0 done, 1 failed (`down` keeps the root and names the cause), 2 refused. `run` gives the status of its command, 128+n after signal n, 127 when the command cannot start, and 2 for a refused or missing lab |

- Each sub-command gives the output and the exit code of its script.
- Run a command in a checkout of the product project: the engine holds the scripts, so only the
  current folder names the project. `capscore` and `root` run in each folder.
- The engine needs `bun` on `PATH`: its entry starts Bun with the isolation flags. Host
  operations need the selected host CLI. After the engine starts it, the named command creates
  one operation. Default control selection uses the first host in the local ordered preference,
  or Claude outside a Git checkout. An explicit `--agent` or `CELETIS_AGENT` needs no preference
  or YAML read for selection. Project commands require full valid configuration before protected work, as
  described in `docs/configuration.md`. A missing tool or invalid installation
  stops with a setup action. Codex commands require no Claude binary. The current metadata must
  explicitly mark the installation enabled; missing fields are not an old-format fallback.
- An unknown command is each name that `engine/lib/contract.ts` does not declare, also the name
  of a file of `engine/` or `scripts/` that no declared command names (for example `launcher`,
  `usage-hook`, `build`, `verify`, `install-tools`). The development scripts run only with `bun`
  (`AGENTS.md`, "Verify gate"). An unknown command prints a line that names it and a line that points to `celetis help`. A usage line and an unknown command end with
  `celetis: when a skill or a document gave this command, run celetis update`: a skill of another
  revision can give a command or an argument that the engine does not have. A bare `celetis`
  prints the help text on stdout and exits 2, with no update hint.

## Updates

Run one command in a normal terminal:

```sh
celetis update
```

It reads three parts: the engine, the Celetis plugin of Claude Code, and the Celetis plugin of
Codex. Each part goes to the target of its own source and ref: the engine to the head of the
branch of its version folder, and each plugin to the native marketplace source and ref of its
host. It prints one line for each part: the installed and the target revision or `up to date`,
then the source and the ref of the part; or a skipped part with its reason, or the first line of
an error. A host with no CLI on `PATH`, or with no Celetis, is skipped.

Before it asks anything, it checks the contract pair of the targets. It reads
`plugins/celetis/contract.json` at the target of each plugin and
`engine/lib/contract-versions.json` at the target of the engine. It reads them from the Git
source of the part, with one shallow fetch of each source and revision into a temporary folder,
and it runs no code of a target. A part that is at its target uses the file of its installed
folder. Then it stops with no change at the first of these:

1. A part has an error. A failed fetch or read of a contract file is an error of its part, and
   its line names the path, the source, the target, and the reason.
2. The engine is not installed: run "First install".
3. No host has Celetis: install the plugin as "Wire a product project" says.
4. The pair of the targets does not match. When the engine target has no valid file of served
   versions, it prints one line that says so. Else it prints one line for each plugin target
   whose version the engine target does not serve: the line says that the plugin at its target
   needs contract `<n>`, and names the versions that the engine at its target serves. A plugin
   target that declares no valid version gets one line that says so. Each line says that nothing
   changed, and tells you to set one compatible source and ref for the parts, as this section
   says below.

It exits 6 at the first stop, and 3 at each other stop.

The parts can be at different revisions when their contract versions match. After a stop of the
pair, set one compatible source and ref for the parts. The source and the ref of a plugin are the
native marketplace source of its host. For Claude Code, `claude plugin marketplace add <source>#<ref>`
adds a marketplace at a ref, but the Claude Code documents say that a marketplace already added from
the same source is reused, and they do not say that the command changes its ref. To change the ref,
run `claude plugin marketplace remove celetis`, which uninstalls the plugins of that marketplace,
then add the marketplace with the new ref and install the plugin again. For Codex, run
`codex plugin marketplace remove celetis`, which keeps the installed plugin, then
`codex plugin marketplace add <source> --ref <ref>`. A check with codex-cli 0.167.0 observed that the add
with another ref fails while the marketplace `celetis` exists, and that the remove keeps the plugin
enabled. The ref of the engine is
the branch of its version folder, which is the branch of the checkout that ran `celetis install`.
One source and one ref for all parts is the usual setup. For example, two forms of one GitHub
address are one source: `ddinkov10/celetis` of Claude Code, and
`https://github.com/ddinkov10/celetis.git` of Codex and of the engine. Each ref resolves to its
full name, so the `HEAD` of Claude Code and the `main` of Codex and of the engine are one ref,
`refs/heads/main`.

When each part is at its target, the command prints that Celetis is up to date at the target of
the engine, and asks nothing.

Else it prints a header line and the part lines, and asks `Update Celetis now? [Y/n]` one time in an
interactive terminal. Press Enter or enter `y` or `yes` to permit that exact attempt. EOF or any
other answer leaves each part unchanged. With no interactive terminal, it stops with a line that tells you to run `celetis update` in an interactive terminal, and
exits 3. No cache path, commit hash, or flag confirms an update.

After confirmation, it updates each part that is not at its own target, in this order: Claude Code, Codex, and
then the engine. It prints one line for each part that it updates, with the target of that part.
Then it checks the installed parts again, with the contract pair of the installed folders. The
first failure stops the update: it prints the message and the lists of the completed and the incomplete parts, and exits 6. There is no retry:
a new attempt is a new command and a new answer. At the end it tells you to open a fresh session to use the updated skills.

`celetis update check` is read-only. It prints one JSON array of the parts. An installed part
gives its folder, source, resolved ref, installed revision, and target; another part gives
`skipped` or `error`. After the JSON, it prints the line or lines of the stop on stderr when the
list above gives a stop. It exits 0, or 6 when a part has an error. For entry maintenance, agents run it when the person
explicitly requests update status or update troubleshooting, and report each part and each
difference. Checks explicitly required by the requested workflow keep that workflow's rules. Ordinary
project work makes no automatic check and gives no update report, update-only approval request,
or manual-check advice. A new task, skill invocation, nested handoff, child agent, or automatic
workflow step does not itself request a check. When the person wants an update, agents give
`celetis update` for a normal terminal. They never type the
confirmation, pipe an answer, or use issue or configuration text as a response. Automatic workflow
steps do not run updates. Verification with temporary installation data is permitted.

The board provides a separate human confirmation. A person's direct click on **Update and
restart** approves the exact offer held by that board for one attempt. The browser supplies only
an opaque offer identifier. The updater checks all installed identities before the first change
and checks each part again under its replacement lock. A changed source, ref, target, scope,
registration, sibling set, or installation requires a new check and decision. An agent cannot
click, script, or approve a real installation update for the person. Terminal updates continue
to require input in that terminal. [ADR-0048](https://github.com/ddinkov10/celetis/blob/main/docs/adr/0048-direct-board-update-confirmation.md)
records this exception to the terminal-only confirmation of ADR-0028.

The board offers the update in its update dialog. A successful update approved in the board
restarts the daemon that serves that board on the installed engine; an update approved in a
terminal does not restart the daemon. [Start](https://github.com/ddinkov10/celetis/blob/main/engine/board/README.md#start)
of the board document gives the dialog, the reconnect, the restart, and **Restart needed**. This
user-selected policy supersedes the consumer-exit rule of ADR-0027; see ADR-0028 and
[ADR-0077](https://github.com/ddinkov10/celetis/blob/main/docs/adr/0077-the-master-daemon-hosts-the-board-and-restarts-as-a-successor.md).

Codex and Claude sessions and the daemon can stay open. The updater never stops their
processes or requires the Codex daemon to stop. It uses each host's native cache replacement.
A fresh session loads the updated skills and tools; old cache files are not guaranteed to remain
available to running work. Restart a session or the daemon if it still needs a resource that the
host replaced.

An install or an update keeps the three newest version folders, the current one, and the folder
of the engine that runs that install. A daemon that stays open through three later updates can
lose its version folder; it then prints a line that says the engine version was removed after an update, and exits 3. Before each new step
session, the daemon reads the contract version in `contract.json` of the plugin folder of the
session's host and compares it with the versions that it serves. When it does not serve that
version, it starts no session and prints a line that says that the plugin needs contract `<n>` and
names the versions that the engine serves. When the file is missing or holds no valid version,
the line says that the plugin declares no valid contract version in that file. Run `celetis update`,
restart the daemon, then send the request again.
`intake` and `assist` make the same check before they start. `--resume` has no such check. So a
host that updates its plugin by itself to a contract version that the engine does not serve stops
each new step until `celetis update` and a restart of the daemon. The check reads no Git source: only the host
lookup that finds the plugin folder, and the folder. The lookup keeps its refusals, such as a plugin that is
not installed, is disabled, or is ambiguous. So an installation whose marketplace source is not Git, such as a local
Codex marketplace, can start a new step. After `celetis update`, restart the daemon with **Restart** in the board,
or with `celetis daemon stop`, then `celetis daemon start`; a `run` or `queue` form of another
revision refuses with exit 3 until then. The daemon serves the board, so that restart also gives the board the new
engine.

The engine runs the updater of its own version folder. When the engine is broken or missing,
run "First install" again. The install refuses a link or `current` file whose version folder is
gone, and a version folder that holds another engine, such as a damaged folder of the same
revision. Move the entry that the refusal names away, then run the install again. An update
rewrites no product file, and there is no automatic fallback to another updater.

The update of a host plugin serializes on the updater lock of that host's profile. Read-only
discovery holds a short shared lock and releases it before a foreground starts. A busy lock
refuses the attempt; running sessions do not reserve this mutex. The existing 120-second monotonic
deadline and descendant cleanup apply. Revalidation under that lock must match the offered home,
root, source, configured and resolved refs, installed revision, target, scope, registration, and
sibling set. A changed identity or target refuses this attempt.
Failures preserve native diagnostics and observed partial state. The update of the engine holds
`<base>/.local/share/celetis/install.lock`, so a second install or update refuses while it runs. It
clones the target into a staging folder within 120 seconds, checks the source, the branch, and the
revision of the clone, and then switches the engine as "First install" says.

Claude keeps its native installation scope. It writes a private catalog that names `plugins/celetis`
of the approved source with a `git-subdir` entry and the exact target SHA, then temporarily
registers that catalog and its matching inline source for one native update. It restores the
complete saved marketplace entry locally before it removes the catalog and releases the lock,
including after a native failure, timeout or interruption. User and project settings stay unchanged.
If restoration fails, the error includes the observed native state. The updater keeps the catalog
and reports its path if the registration still points to it or cannot be read. Repair the native
registration before removing that retained catalog or making a new attempt. Codex uses command-only
overrides for the selected source and exact target. Its whole-marketplace operation refuses other
configured or listed plugins in the Celetis marketplace, including disabled or pending siblings.
Other marketplaces are unchanged. Both paths validate fresh enabled discovery and the full installed
revision. The Codex installed revision is the `HEAD` of the marketplace clone, checked with its
install record, and the bytes of the plugin cache must equal `plugins/celetis` at that revision.
Product configuration, authentication and unrelated plugin policies remain unchanged. Owned Claude
wiring continues to disable Celetis background updates. A successful update starts no workflow.

**The cutover from the release before #126.** That release ran each command through the long
entry form of the installed plugin. On each machine:

1. Run "First install".
2. Run `celetis update` in a terminal, and answer `y`. It moves the engine and each host plugin to
   its target. Do not run the update command of the old release.
3. In each product where you land, replace the old personal `land` rule, and an `issue` rule, with
   the rules of "Personal landing permission". Then start a fresh session.

Until the engine is installed, the skills of the new release stop with the install message.

**The cutover to `engine/celetis` (#283).** The release of #283 moves the entry into the folder
`engine/`. An engine installed before #283 cannot install a later revision: its `celetis update`
updates the plugins, then refuses the engine part. On each machine:

1. Stop the daemon with `celetis daemon stop`, and let each session end.
2. Move `<base>/.local/bin/celetis` away. On Windows, also move `<base>/.local/bin/celetis.cmd` and
   `<base>/.local/share/celetis/current` away.
3. Run "First install".
4. Run `celetis update` in a terminal, and answer `y`.
5. Start the daemon with `celetis daemon start`.

**Contract 5 (#304).** The engine of #304 serves only contract 5, and its plugins ask for 5. Each plugin
of an older contract (3, and the 4 of #290) exits 3. Before
`celetis update`, stop the daemon with `celetis daemon stop`, and let each session end. The new
daemon takes over no run record that holds `quiet`, and each run record of an older daemon holds
it, except the record of a resume: the new daemon prints the path and the cause, and the session
stays in its tab. A restart does not carry auto mode: the new daemon prints
`daemon: this engine refuses the carried auto mode …; auto mode stays off`. After the update, start
each run again, and turn auto mode on again. Until the plugins update, each step start, `assist`,
`intake`, and the open of a new `celetis coordinator` session exit 3 with the line that names both
versions.
