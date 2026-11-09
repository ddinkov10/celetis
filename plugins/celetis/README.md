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

The repository holds the plugin in `plugins/celetis/` and the program beside it. The plugin holds:

- 34 skills: the lanes, the steps of a lane, the skills for review and memory, the engineering
  principles, and the helpers ("The skills");
- the step text of a run, `step-prompt.md`;
- the modules, in `docs/procedures/`: the shared procedures that a step of a skill reads when it
  comes ("The skills");
- the principles, in `docs/principles/`: the general engineering rules that a task reads when
  their applicability triggers match;
- the maintainer documents, in `docs/`.

The program is the entry `celetis` and its runtime `engine/`, at the root of the repository: the
daemon and the run command, the resolver, the landing script, the worktree script, the setup
script, and the capability scorer ("The commands"). The maintenance scripts are in `scripts/`.

The repository reaches a machine in two forms, at one revision. The program `celetis` runs each
command, also the daemon and the board, and the daemon gives each step session a facts header and
the step text of the plugin. The plugin of each host gives its sessions the
skills, the procedure modules, the principles, the entry hook, and the documents.

There are two kinds of repository:

- The **plugin repository** is this one, `ddinkov10/celetis`. It is private, and it is also the
  marketplace `celetis` with one plugin, so the id of the plugin is `celetis@celetis`.
- A **product project** is any repository that uses the plugin. This repository also runs its
  own lanes on its own installed plugin and program.

A product project holds no Celetis launcher, runtime source, skill, or document of the harness. It holds only what is its own:

| Part | Place in the product project |
|---|---|
| The host wiring | Claude: `.claude/settings.json`. Codex: the installed plugins and trusted `.codex/config.toml` and `.codex/rules/` (below) |
| The config | `.celetis.yaml` |
| The record of setup | `.claude/celetis/wiring.json` |
| The worktree setup | `worktreeSetup` in `.celetis.yaml` |
| The custom parts | `custom.<skill>` in `.celetis.yaml`, one string for each skill that needs one |
| The product facts and Celetis entry pointer | `AGENTS.md` |
| The stores | `docs/adr/` and `docs/lessons/` |

No file of the plugin names a part of a product, apart from the records of `docs/adr/`. The plugin
names a role, for example "the verify gate of the project", and the product project names the
thing. A lane ends when the change is on the trunk, which is the default branch of the repository
on GitHub: the verify gate, the deployment, and each other part of a product stay in the product
project. The plugin has no `version` or declared dependency. The entry of the program is the file
`celetis`, and its runtime is `engine/`. Shared permissions restrict direct merges. Personal host rules allow landing.
Each skill starts with one entry line. On Claude Code, the native hook of the plugin replaces that
line with a short facts block: the host, the plugin folder, the checkout, the contract of the
entry, and the custom text of the skill. Codex declares no Celetis lifecycle hooks: its session
reads the entry module `docs/procedures/entry.md`. ADR-0047 records the entry and the modules.
ADR-0050 gives general engineering principles their own canonical rule files, regardless of
caller count.
ADR-0042 owns the program, its install, and its update. ADR-0012 holds the original packaging decision; ADR-0014 extends it to both hosts without a
second copy of the procedures. ADR-0015 replaces their config storage clauses with one YAML file.
ADR-0016 limits required automation to the CLI hosts while keeping desktop invocation available.
ADR-0032 records shared configuration parsing and immutable operation values. The
[configuration reference](docs/configuration.md#operation-values-and-freshness) names each fresh
read boundary. Native skill entry still reads its whole active file through the host's permission
controls and applies only that skill's custom text.

## Requirements

- macOS or Linux for the daemon. Native Windows has no daemon: it does not start there, and
  each form of `run` and `queue` that sends a request exits 3. The program installs from Git Bash and
  runs from Git Bash, PowerShell, and `cmd`, and its Windows checks are open. Before the program,
  the data of the board before #102 and the update lock passed their checks
  ([Acceptance status](docs/workflow.md#acceptance-status)).
- The selected host CLI: Claude Code 2.1.299 or later, or Codex CLI 0.162.1 or later. The Claude
  entry hook reads the `skill.prompt` fields `source`, `pluginName`, and `path`, which came in
  2.1.299. On an older release, the hook makes no entry, and the session takes "Entry without the
  hook" of `docs/procedures/entry.md`, as on Codex. Codex 0.162.1 is the lowest release
  on which the install, the refresh, and the lookup of the plugin were checked; an older release
  is not supported. These versions are a floor, not proof of the full workflow
  ([Acceptance status](docs/workflow.md#acceptance-status)).
- `gh` (logged in), Bun 1.4.4 or later, `git` 2.31 or later, and the program `celetis`
  ("First install") on `PATH`. On macOS and Linux, the program starts Bun through `env -S`. The
  `env` of macOS and of GNU coreutils 8.30 or later has `-S`; the `env` of busybox does not.
- Git credentials for GitHub that need no prompt for an https URL: a credential helper, or a
  `url.<ssh>.insteadOf` rule and an ssh key. The plugin repository is private, and the first
  install and `celetis update` read it through its https URL.
- Superpowers, installed and enabled on the selected host: the lanes call its `superpowers:*` skills.
- For a look decision and a visual bug: `gh` 2.99.0 or later on github.com, and the capture tool of
  the platform row (`docs/procedures/ui.md`, "Captures"). A look decision on the `impeccable` path
  (a whole web or mobile screen, or a smaller web change) also needs the `impeccable` skill and a
  `PRODUCT.md` of the product. The session checks for both. It never installs `impeccable`, which
  is no plugin dependency, and you run `/impeccable init` once for the product
  (`docs/procedures/design.md`, "The check"). A look decision on the `generate` path also needs
  the Playwright MCP server with `--isolated` and no `--headless`, and the host reviews its
  `browser_run_code_unsafe` call (`docs/procedures/design.md`, "The page CSP").
- For the research of a UI component, optional tools that you install: a code-search tool (for
  example the grep.app MCP server), a web fetch or scrape tool, and a browser tool that the session
  opens for itself (for example the Playwright MCP server with `--isolated`). The session uses each
  one that it has and records a limit for each missing one
  (`docs/procedures/component-research.md`).
- On macOS, herdr-core 0.1.16 (`hc`) with its running server, and the open window of the Herdr app
  0.1.11 (`herdr-app`), for each run and for the board: each session runs in a tab
  of the Herdr app (ADR-0058, ADR-0062). The host reports its status to herdr-core with OSC 7501
  and needs no integration: Claude Code since 2.1.295, and Codex 0.166.0. A host release that
  reports no status gets no step end and no session card.
- For the board: a Chromium browser.

`docs/workflow.md` gives each requirement in full ("Requirements", and "The board").
The [configuration reference](docs/configuration.md) gives the repository schema and the
commands that install Bun.

## Wire a product project

### First install

Install the program `celetis` one time on each machine. Run this command in a normal terminal, or
in Git Bash on Windows:

```sh
celetis_tmp="$(mktemp -d)" &&
  git clone --quiet https://github.com/ddinkov10/celetis.git "$celetis_tmp/celetis" &&
  BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 bun --no-env-file --no-install --config=/dev/null --no-macros "$celetis_tmp/celetis/celetis" install &&
  rm -rf "$celetis_tmp"
```

`celetis install` installs the revision of the clean checkout that it runs from, here the trunk of
`ddinkov10/celetis`. The checkout must be on a branch, with no uncommitted changes; a linked
worktree is also a checkout. The URL of the clone is the source of the program. `celetis update` requires
one source for the program and each host plugin, so keep this URL: an ssh URL of the same
repository is another source. `<base>` is `CELETIS_HOME` when that variable is not empty, else the
home folder; set it for each process that runs `celetis`. The program refuses a `CELETIS_HOME` that
is not an absolute path, with `celetis: CELETIS_HOME must be an absolute path: <value>`; the install
then exits 2. The install makes these entries:

- `<base>/.local/share/celetis/versions/<revision>/` is a Git clone of the source of the checkout,
  on its branch, at that full revision. The install refuses a version folder that holds another
  program.
- On macOS and Linux, `<base>/.local/bin/celetis` is a symbolic link to the file `celetis` of the
  current version folder. An install replaces the link in one atomic step, so the daemon or a board
  that runs keeps its own version folder.
- On Windows, `<base>/.local/bin/` holds two shims of fixed text: `celetis` for Git Bash, and
  `celetis.cmd` for PowerShell and `cmd`. Both read the current revision from
  `<base>/.local/share/celetis/current`. An install writes only `current`, so a shim that runs
  never reads changed text. A partial set of these three entries reads as no program, and the
  next install writes the absent entries.

An install keeps the three newest version folders, the current one, and the installed version
that runs that install. It removes the other version folders. It changes no file outside
`<base>/.local/share/celetis/` and its own entries in
`<base>/.local/bin/`. When `<base>/.local/bin/celetis`, or `celetis.cmd` on Windows, is there and
is not an entry of the program, the install refuses and changes nothing:
`celetis: <path> is not a file of the celetis program; move it away, then run the install again`.
An install that stopped partway leaves a staging folder in `versions/`, and the next install
removes it.

`celetis --version` prints the full revision of the program.

`~/.local/bin` (`<base>/.local/bin`) must be on `PATH` in a terminal, in the Bash tool of Claude
Code, and in Codex. When it is not, the install prints
`install: <bin> is not on PATH; add it as plugins/celetis/README.md, "First install", says`. An app that starts
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
   makes discovery refuse, with `Claude installation is ambiguous`. Setup writes no project
   enable of the plugin.

   The program finds the enabled plugin through native metadata (`celetis update check` and the
   check of the daemon), so the two commands are necessary on each machine. It is not shown that
   the block of the project file (below) loads the plugin with no install. In the probe, a
   headless turn in a new repository whose project
   file held the marketplace and the two plugins loaded no plugin and added no marketplace. A
   headless turn shows no workspace trust dialog, so the probe does not show what an interactive
   session does after that dialog (ADR-0012, R1).
2. Add and install Superpowers:

   ```bash
   claude plugin marketplace add obra/superpowers-marketplace
   claude plugin install superpowers@superpowers-marketplace
   ```
3. Last, turn on auto-update for superpowers. In `~/.claude/settings.json`, add
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

The program finds the enabled installation through `skills/list`; it does not calculate a cache
path. A local-path marketplace is unsuitable: `celetis update` and the check of the daemon compare
Git revisions, and `plugin marketplace upgrade celetis` requires a Git source. With a local source,
no new step starts. `--ref main` selects the landed source, the branch of the program. For an unlanded check, use supported checkout loading with the existing host and authentication. These commands and result fields were checked
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

The three parts above stay by hand on each machine. `/celetis:setup` writes required integration
and approved product additions in the main checkout of one product project
([ADR-0071](https://github.com/ddinkov10/celetis/blob/main/docs/adr/0071-setup-reconciles-recorded-owned-wiring.md)). Its required set
is the selected host settings, instruction imports, the dedicated Codex restriction, required
configuration, ignore and attribute lines, and its record. It also makes missing tracker labels.
Product procedures and stores stay with their owner.

`celetis --agent <host> setup status` reads that required set in the active checkout, for the
selected host only, and writes nothing. It reports each missing, invalid, different, or blocked
part with its path or label name. A line for content that setup preserves names the owner
repair; a new run of setup does not repair it. A permission failure is a blocked observation,
never a missing part. The tracker reads go to the repository of `origin` only: its host must be
`github.com` or a GitHub host that `gh` is logged in to, and an SSH host alias resolves by
`ssh -G`. Unlike `setup check`, status needs no main checkout on the trunk, fetches
nothing, and runs no product file. A pass proves only the file contents and the label names. It
does not prove that a host loads the policy, that the worktree setup works, or that the wiring is
on the remote trunk.

- The session runs `setup check` first and reuses its validated saved tracker and ordered hosts.
  It uses landing and, with `merge`, suite from the current valid `.celetis.yaml`. It asks only
  for an absent answer or a change explicitly requested in the invocation. An invalid present
  answer refuses; it is not treated as absent. Only GitHub is supported. Both `try` and `write`
  receive the same resolved selection and configuration options. The ordered `--hosts` value
  initializes an absent local preference only during `setup write`; an existing valid preference
  stays unchanged even after a host-selection change. `check` and `try` create no preference.
- After the landing, when `.celetis.yaml` has no `worktreeSetup`, the session proposes the
  worktree setup: a normal root-relative `.ts` file, such as `scripts/worktree-setup.ts`, from the
  manifests, lockfiles, version pins, and CI workflows of the project. It shows the path and
  complete script, each ignored file that the script copies, each
  credential path that it does not copy, each tool that each machine needs, and the checks that
  the test runs. A `worktreeSetup` that is there, also an empty one, stays as it is, and setup
  tests its referenced lane file. The product owner must approve, create, and commit the entry
  and required helpers on the local trunk in a separate product change before the wiring test.
  Missing or uncommitted source stops that test. Setup creates, copies, stages, owns, commits,
  and pushes no application source to make its test possible.
- Before any wiring write, `celetis --agent <host> setup try --setup-file <path>` takes the exact
  root-relative reference and runs the committed file in a test lane,
  `.claude/worktrees/setup-try`: a detached worktree at the local trunk plus a commit of the
  wiring, which is the tree of a new lane after the push. There, the session runs the checks of
  the project, and it checks the import of the package of the project, a clean `git status`, and
  the hooks. Then it removes the test lane. A dirty path becomes a proposed `.gitignore` line. A
  failure of the base becomes a proposed section `## Baseline of the checks` for `AGENTS.md`,
  when `AGENTS.md` states no baseline rule. A proposed script that fails its test goes back to
  the proposal; the owner commits each source repair before another detached test. Setup
  installs no tool and changes no hook: the report names
  each missing tool and each hook that skips its checks in the test lane (ADR-0018).
- Setup writes the part of a host only when you choose that host: required entries in
  `.claude/settings.json` and imports from existing Claude instruction files, or the dedicated
  `.codex/rules/celetis.rules`. Every host selection creates or refreshes the marked Celetis entry
  pointer in `AGENTS.md`. See [`AGENTS.md`](#agentsmd) for its ownership and both relative import forms.
- Setup writes no launcher, shared entrypoint allow, project `celetis@celetis` enablement,
  generic flow section, ADR starter, or empty lesson catalog. It refreshes current owned wiring
  and removes obsolete owned scopes, including a recorded dedicated launcher. A valid recorded
  object key owns its current value; a dedicated whole-file claim owns that file. Manual edits
  inside those scopes are replaced or removed. Shared files retain content outside owned scopes.
  Differing unowned settings and rules stay unchanged with exact path warnings and no new claim.
  Unrecorded old wiring and remaining product callers need [owner review](#review-old-wiring).
- In `.celetis.yaml`, setup owns required `landing` and `suite` (with `merge` only). It adds missing
  entries, refreshes recorded owned values and removes an obsolete owned suite for `pr`, while
  preserving unrelated bytes and values. A differing unowned value stays with an exact warning;
  an unowned suite that blocks `pr` refuses before writes. Invalid current configuration still
  needs owner repair; setup reads no old configuration format.
- The schema-1 record at `.claude/celetis/wiring.json` records the resulting owned files and
  entries and the resolved tracker and hosts. Setup validates its complete shape and finite
  wiring scope before using any claim. It drops retired claims rather than keeping their union.
  An unchanged committed repeat changes no bytes or modification times.
- The write adds only the parts that you approved: the file reference as `worktreeSetup`, the ignore
  lines, and the baseline section. These three parts are product parts: setup writes each one
  only when it is missing, and the record does not list it.
- Setup shows the diff, and it commits and pushes the wiring only after your yes ("The wiring on
  the trunk"). It makes the labels at the write, before that question, so a no keeps them.
- After the push step, setup lists each lane worktree that exists and offers to run the script
  there with `celetis --agent <host> setup lane <path>`. It does this also after a no or a failed push,
  and when no file changed. A lane branch with an older `.gitignore` can then show the new
  environment as untracked, and the resolver stops its issue: after the wiring is on the trunk, a
  merge of the trunk into that branch brings the ignore lines. Main selects the reference and
  the target lane supplies the source. If an older lane lacks the entry or a helper, setup
  reports the missing path and requires the owner to bring the committed source into that
  lane before retry. It copies no source and performs no automatic merge or fallback.

### Claude permissions: `.claude/settings.json`

Setup adds or refreshes owned marketplace settings, Superpowers enablement, and direct-merge denies.
It removes obsolete recorded host entries. It adds no shared
allow and no project Celetis enablement:

```json
{
  "permissions": {
    "deny": ["Bash(gh pr merge*)", "PowerShell(gh pr merge*)"]
  },
  "extraKnownMarketplaces": {
    "celetis": {
      "source": { "source": "github", "repo": "ddinkov10/celetis" },
      "autoUpdate": false
    }
  },
  "enabledPlugins": {
    "superpowers@superpowers-marketplace": true
  }
}
```

Shared rules keep the direct-merge restriction. The `land` allow is personal:
`Bash(celetis --agent claude land *)` in the untracked `.claude/settings.local.json` of each
person. An `issue` allow is optional, and it has a risk.
[Personal landing permission](#personal-landing-permission) gives the rules, the risk of the
`issue` allow, and their lifetime across an update.

The command checks only the planned project settings. The generated `autoUpdate: false` value
does not prove that a native session loaded it or that a stronger policy disables automatic
updates. Review each enabled or unknown policy warning and set the effective Celetis policy to
false by hand. Setup preserves unrelated JSON values; its serializer can change formatting,
including compact JSON, line endings, and the final newline. The setup report shows that diff.

### Codex permissions: `.codex/rules/celetis.rules`

Setup creates this file when absent, adopts an identical file without a content write, and
refreshes a file with a validated whole-file claim:

```starlark
prefix_rule(
    pattern = ["gh", "pr", "merge"],
    decision = "forbidden",
    justification = "Use celetis --agent codex land from the main checkout.",
)
```

This shared rule forbids direct merge. The personal rule of `land`, and the optional rule of
`issue`, name the program, the host, and their sub-command ("Personal landing permission").
Codex matches literal prefixes. A policy-file check does not prove that an active session loaded
the rule. Keep the host sandbox and approval settings.

A differing unowned file stays unchanged with the required direct-merge restriction and obsolete
allows reported for [owner review](#review-old-wiring). Removing Codex from the selected hosts
removes its recorded owned rules file; shared requirements of a remaining host stay. That warning
can accompany `setup: no file changed` and establishes no loaded-policy result. Project rule
loading also needs the native host's project trust.

### Personal landing permission

A build step ends with `celetis --agent <host> land <n> '<subject>'`. On each machine that lands,
give each host one personal allow rule for `land`. The rule names the program, the host, and the
sub-command, so one rule serves each issue and each subject:

- Claude Code: add `Bash(celetis --agent claude land *)` to `permissions.allow` of the untracked
  `.claude/settings.local.json` of the product. With the PowerShell tool on Windows, also add
  `PowerShell(celetis --agent claude land *)`. Keep the other fields of the file.
- Codex: put `prefix_rule(pattern=["celetis", "--agent", "codex", "land"], decision="allow")` in
  `~/.codex/rules/celetis-land.rules`. Keep the other rules.

No rule changes after an update: an update changes the version folder behind the program, not
its name. The rules pin no Bun: the entry of the program finds `bun` on `PATH`, as `land` finds
`git` and `gh`. The shared rules of the product keep the direct-merge restriction.

The rule of `issue` is optional. The path for `issue` is the review of the host: in the checks of
#103, Claude in auto mode ran it with no rule, and a Codex sandbox block of `issue` goes through
the approval procedure of `docs/procedures/entry.md`, "The contract", "Codex". The risk of the
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

### Agent selection and model setup

The local agent preference is an ordered, nonempty list of `claude` and `codex`. It lives at
`<Git common directory>/celetis/agents.json`, shared by all linked worktrees on this
machine. With no record, the order is `claude`, then `codex`. It changes no tracked file.
`setup write --hosts claude|codex|claude,codex|codex,claude` initializes an absent record and
preserves an existing valid order. YAML `host` and setup `--default` are refused; there is no
migration. Check selection with an explicit host:

```bash
celetis --agent codex root
```

Selection is an explicit `--agent claude|codex`, then an explicit `CELETIS_AGENT`, then, for a
step that a run starts, the preferred agent of that step, then the local order. Control
operations use the first host of the local order without a quota check; outside a Git checkout
they use Claude. The scripts of the verify gate (`scripts/verify.ts`, `scripts/build.ts`, and
`scripts/install-tools.ts`) take `--agent`, else `CELETIS_AGENT`, else Claude, and read no order.
Explicit control commands and `agents` work without reading the preference for
selection. Commands that require YAML still validate the whole file. Skills pass their actual
host explicitly, including landing. Exact Resume keeps its saved host and session ID.

The `agents` field of the main `.celetis.yaml` names a preferred agent for each step that a run starts, for
example `implement: codex`. It is tracked repository policy: it applies on each machine and
changes through a commit, at the next new step. A default start of that step tries the preferred
agent first, then the other agents of the local order. A blocked preferred agent gives the next
agent with no wait. A step with no entry uses the local order. A local exclusion wins: a preferred
agent that the local order excludes has no effect. When this machine cannot start the preferred
agent (not installed or not signed in), the start stops at its preflight and tries no other
agent; exclude that agent from the local order to continue with the others.

New Intake, Assist, and Make visual sessions use the first included host without an active
confirmed usage block. An explicit host remains pinned despite exclusion or a block.
`CELETIS_SESSION_AGENT` identifies the current native session; it does not select the next
host. A real incoming `CELETIS_AGENT` remains an explicit choice. The selected host still
runs its preflight; a missing executable or another setup error does not try a second host.

Usage records live separately at `<Git common directory>/celetis/limits/<host>.json`.
A passed provider reset permits a new attempt. It does not clear the recorded block.
An unknown observation keeps an existing block; a newer verified availability result can
clear it. If every included host is blocked, these independent launchers report the hosts
and known reset times without opening a session. A launched session keeps its native error
and recovery controls. Intake, Assist, and Make visual never transfer their conversation or
automatically start another host after exhaustion.

`celetis agents read` prints `{schema:1,order,version}`. To change the order, pass exactly
`order` and that `expectedVersion` to `celetis agents replace '<JSON>'`. A stale different edit
exits 3 with `{kind:"conflict",latest}`; an already-current edit succeeds. The version is a
digest of canonical content, not permission to write. Invalid or unsafe records fail without
replacement. Preserve the file and correct its reported cause before retrying. Both installed
hosts retain separate installations and configuration.

`root` prints the folder of the program: the version folder that runs the command.
`celetis update check` reports the enabled plugin of each host. Its Codex discovery uses a
short-lived app-server connection and `skills/list`, with no thread or model turn. A missing or
disabled installation is a `skipped` part; malformed or ambiguous installation data is an `error`
part.

With no profile, each Codex child keeps the parent's model and gets the effort of its rank. This
needs no setup. For model tiers, supply the four-slot profile and reviewer minimum in
`docs/capability.md`, "Codex model profiles". Obtain the model IDs and efforts from the active
dispatch surface. Store its profile under `codexProfiles` in the main config and pass the current
runtime allowlist to each `capscore` call and each `dispatch` act that issues a dispatch.
A CLI catalog does not establish desktop dispatch support.
A missing pair or a tool that cannot apply the required pair stops the dependent work.

Complete the host's normal trust flow before a run. The daemon reports startup dialogs and leaves
them for the human.

### The config, the worktree setup, and the custom parts

Operational settings and setup are fields of `.celetis.yaml` (`docs/configuration.md`).
Commands that need repository setup require this file and stop if it is missing or invalid.
`/celetis:setup` makes the file with `landing` and, with `merge`, `suite` when there is
none. In a valid file it adds missing required entries, refreshes recorded owned landing and suite
values, and removes an obsolete owned suite. It preserves unrelated bytes and values. After your yes,
it adds a missing `worktreeSetup` as a quoted file reference at the end of the file, for example
`worktreeSetup: "scripts/worktree-setup.ts"`; a new file holds `landing`, `suite` with
`merge`, and then the reference. The value must read back exactly and each other value must stay
the same outside the planned owned edits. If that validation fails, setup stops before any write;
repair the reported field by hand first. `try` and `write --setup-file <path>` require the entry in local trunk
HEAD, with an unchanged index and working file. An existing different value, including `""`,
stays unchanged and prints `setup: warning: .celetis.yaml: worktreeSetup differs from the requested setup reference; setup leaves it`.
Change that field by hand when the approved reference is intended. A differing unowned landing
or suite stays with its warning; each other field stays by hand.

| Field or file | What it holds | When omitted |
|---|---|---|
| `landing` | Required `pr` or `merge`. `pr` squash-merges a PR when each check is green. `merge` creates one squash commit on the trunk, with no PR. A project with no PR check uses `merge` | The command exits 2 |
| `suite` | A relative path of a TypeScript file in the checkout. `land` runs it in the lane, with no argument, at the tip that it lands; exit status 0 is a pass. Required with `merge`, refused with `pr` | With `merge`, the command exits 2 |
| `gates` | A mapping from the seven step names to `me` or `auto` | Each omitted step is `me` |
| `agents` | A mapping from the seven step names to `claude` or `codex`: the preferred agent of each step ("Agent selection and model setup") | Each omitted step uses the local order |
| `worktreeSetup` | A root-relative `.ts` file reference, for example `"scripts/worktree-setup.ts"`, or exactly `""` | No setup |
| `board.port` | The first port to try for the board ("The agent board") | 4403 |
| `codexProfiles.<runtime>` | Four ordered model slots and the reviewer minimum for that dispatch surface | Each Codex child keeps the parent's model |
| `custom.<skill>` | An addition to the skill procedure | No addition |

- **Operational settings** come from the main checkout, including when a command starts in a
  lane or subfolder. After each landing, `celetis --agent <host> land` moves the trunk of the main
  checkout. With the landing `merge`, it also fast-forwards a clean main checkout that is only behind
  `origin/<trunk>` before it lands. After a merge by other means, or after its line
  `land: the main checkout did not move`, run `git pull` there.
- **The gate of a step** comes from `gates.<step>`. An `auto` step starts by itself. A `me` step
  starts when you supply a number or press Run on the board. Old Git defaults have no effect.
- **With the landing `pr`,** keep the repository setting `squash_merge_commit_title` at
  `COMMIT_OR_PR_TITLE`: for a PR with one commit, GitHub then takes the subject of that commit and
  adds the PR number (`docs/issue-tracker.md`, "Branches, PRs, merge").
  `gh api 'repos/{owner}/{repo}' --jq .squash_merge_commit_title` prints the value.
- **The worktree setup.** `celetis --agent <host> worktree <n>` reads `worktreeSetup` from the lane's
  `.celetis.yaml`. The reference uses `/` separators and a case-sensitive `.ts` suffix. Celetis
  rejects absolute, rooted, drive, and UNC paths, backslashes, colons, empty/`.`/`..`/`.git`
  components, U+0000–U+001F, and U+007F. It preserves other accepted characters exactly, with
  no trim, expansion, splitting, or code interpretation. Omission or exactly `""` means no
  setup; null, whitespace-only values, inline code, and wrong types fail validation. Immediately
  before execution, the target must be a readable regular file inside the canonical lane.
  Final or ancestor symlinks below that root, special files, directories, outside targets,
  nested repositories, submodules, and other worktrees are refused before any setup child.
  The selected Bun runs that file directly with cwd at the lane root, also after a subfolder
  invocation. Its source identity and normal sibling imports stay intact; no execute bit or
  exported-function API is needed. Product environment/configuration, preloads, macros,
  automatic package installation, and transpiler cache stay disabled. Transitive imports have
  no added restrictions; this trusted-checkout contract is not a file-swap transaction.
  `process.argv[2]` is one absolute main-checkout argument. Streams stay inherited. Signals stop
  the owned child. After nonempty setup output, stdout has an LF
  separator and the final absolute lane path. Check each external command status in the program.
  A failed setup removes a new worktree and a branch created by the command. An existing branch
  or worktree stays for repair and retry. `setup try` returns the child status and retains its
  diagnostic lane; `worktree` and `setup lane` map setup failure to exit 6. The command writes
  the marker only after a nonempty reference succeeded, including a zero-byte file. With exactly `""` or missing
  `worktreeSetup`, the command writes no marker. Each later entry reads the lane config again, so
  a reference that a merge of the trunk brings runs at the next entry. Source edits do not
  invalidate a marker. `celetis --agent <host> setup lane <path>` selects the main reference,
  clears the old marker before file validation, and runs the target lane file. Every entry still checks the lane
  config (`docs/workflow.md`).
- **A custom part** is the parsed string `custom.<skill>` in `.celetis.yaml`: an addition to that
  one skill, which reaches only its own invocation. `chore` does not apply `custom.implement`, and
  `lesson-review` does not apply `custom.lesson`. A product fact that two or more skills need, for
  example a landing rule that both `implement` and `chore` follow, or the lesson tags of the
  project, goes into the `AGENTS.md` of the project ("`AGENTS.md`"). At entry, the skill reads the
  whole config once from the active checkout through the permission-checked file access of the host
  and applies only its own string (ADR-0013, ADR-0015, and ADR-0047). On Claude, the native entry
  hook makes that read, parses the file, and puts the string into its facts block. On Codex, the
  session follows "Entry without the hook" of `docs/procedures/entry.md`: with a shell it runs the
  reader CLI (`celetis --agent codex config <checkout> <plugin>`), else it reads the file with a
  dedicated reader. Entry runs no setup. A step of a run starts in the main checkout; a later
  skill entered in a lane reads that lane's config. Each
  invocation is its own entry, also a same-session handoff and an invocation in a child agent.
  Missing checkout, config, or custom text gives no addition; an invalid, ambiguous, unreadable,
  or denied config stops entry. A denied read has no alternate path. The text is an addition: it
  cannot remove a rule of the general skill (ADR-0006). `custom.hotfix` holds the project's ship
  acts. Keep literal block text and parsed trailing newlines intact (`docs/configuration.md`).

`docs/workflow.md` holds these parts in full ("Gates", and "The config and the custom parts").

### `.gitignore`

```
.claude/worktrees/
.claude/settings.local.json
docs/superpowers/
.superpowers/
docs/lessons/_pending/
```

With no entry for `.claude/worktrees/`, a lane worktree makes the main checkout dirty, and the
resolver prints the dirty-tree line for each issue (`docs/issue-tracker.md`).
`.claude/settings.local.json` holds the settings of one person for the project. The three other
folders are scratch of the skills, and a file that git does not ignore makes a tree dirty too:

- `docs/superpowers/` holds the drafts of the intents, the specs, and the plans;
- `.superpowers/` holds the review package of `critic-loop`;
- `docs/lessons/_pending/` holds the lesson drafts that wait for the agent curation of the next
  landing, or for `lesson-review`.

### The labels

The flow uses the ten labels of `docs/issue-tracker.md`, "Labels". Setup makes each label that the
repository does not have, with this description:

| Label | Description |
|---|---|
| `needs-triage` | not yet classified |
| `bug` | Something isn't working |
| `enhancement` | New feature or request |
| `hotfix` | production broken, the fix ships now |
| `chore` | zero-behavior-change edit |
| `epic` | parent of several feature sub-issues |
| `needs-info` | the report lacks what its lane needs; the questions are in a comment |
| `ready-for-agent` | plan posted; no human hold; build completion is recorded in comments |
| `ready-for-human` | a step needs assistance before continuation |
| `wontfix` | This will not be worked on |

GitHub gives a new repository three of them (`bug`, `enhancement`, and `wontfix`), and their
descriptions are the ones of GitHub. A label that is there keeps its color and its description.
Setup ignores the case of a name: when the repository has `Bug`, setup makes no `bug`, and it
prints a warning.

### `AGENTS.md`

The plugin names a role, and the `AGENTS.md` of the project names the thing. It names:

| What `AGENTS.md` names | Who reads it |
|---|---|
| **The verify gate:** the one fast deterministic check of a change (lint, format, syntax, and config checks, with no test run), and how to read its result | `plan`, `implement`, `chore`, `hotfix`, and `guide` say "the verify gate of the project", and `celetis --agent <host> land` names it in a refusal |
| **Optional verification instructions:** a short pointer to a project document's feature-map section or an existing index of documented user flows | `plan` and `implement` read the index and only relevant recipes (`docs/procedures/verification-recipes.md`) |
| **The full suite** is no line of `AGENTS.md`: with the landing `merge`, `suite` in `.celetis.yaml` names the file that runs each test, and `land` runs it at the tip that it lands. With the landing `pr`, the CI of the lane PR runs it | `land`, which `implement`, `chore`, and `hotfix` run (`docs/procedures/landing.md`, "Step 3: the landing") |
| **The architecture and the traps:** the shape of the project in the root file, and the traps of each subsystem in the `AGENTS.md` of its folder. They are the domain knowledge: the plugin has no domain skill (ADR-0006) | `specify`, `bug`, `hotfix`, `plan`, `chore`, and `critic-loop` |
| **The design document and the look decision,** in a project with a UI: the kind of the product and each difference from its default row in `docs/procedures/ui.md`, and how a session starts the product with live data for the variants. The design document is `DESIGN.md` at the root of the product, which `impeccable` and `prototype` share, so `AGENTS.md` does not name it. A look decision is each change to what a person sees on screen or to how the screen behaves | `prototype` (`docs/procedures/ui.md`), which `specify` and `bug` follow; the two items "Prototype" of `docs/issue-tracker.md`, in "What lives on the issue" and in "Branches, PRs, merge" |
| **The installed version of a dependency:** how a session reads it, and the documents that an installed package ships | `docs/procedures/docs-lookup.md`, which `specify`, `plan`, `bug`, `hotfix`, and `chore` cite |
| **The lesson tags:** the tags of the project, for example the names of its subsystems and technologies, that a lesson can carry beside the controlled list of the plugin. A new tag goes here in the same change as its lesson | `lesson` and `lesson-review` (`docs/procedures/lesson-format.md`, "The Tag Vocabulary") |
| **The product flow:** project-specific landing rules, deployment facts, and acts that only the maintainer does, when more than one step needs them | Each session, also a step session |

Setup creates a missing or empty `AGENTS.md` with one marked `## Celetis` block. It appends the
block to an unmarked file and refreshes an existing block. This short pointer directs a new
request with no recorded intent or lane to `celetis:intake`, honors an explicitly requested
Celetis skill, and follows the current step of an existing issue. It generates no project facts,
empty sections, or generic flow procedures. Product instructions stay by hand, except for an
approved baseline section (ADR-0061).

The delimiters are the exact, case-sensitive standalone lines `<!-- CELETIS:START -->` and
`<!-- CELETIS:END -->`. Inline mentions do not count. Complete delimiter lines are reserved even
inside Markdown examples, so show them inline when documenting them. A missing, duplicate, or
reversed delimiter refuses during planning, before project files or tracker labels change.

A valid pair authorizes replacement from the start marker through the end marker, even without
a wiring record. Edits inside the pair are replaced; put project instructions outside it. Setup
preserves every byte outside the pair, including the end marker's following newline. Replacement
uses the start marker's LF or CRLF convention. Appending uses the first existing line ending, or
LF when none exists, and adds only the separator needed for a blank line. New files end with one
LF. An unchanged block is not written again, so its modification time stays unchanged.

The schema-1 record stores `{ "start": "<!-- CELETIS:START -->", "end": "<!-- CELETIS:END -->" }`
under the actual instruction destination. Setup claims no whole instruction file, even on
creation. Retired claims are removed from the resulting record. An approved baseline is added
after the managed block transformation, outside its ownership; an existing baseline keeps its
collision warning. Complete recorded old flow lines can be removed outside the block; every
other byte stays unchanged. Product flow content and unrecorded old text remain for owner review.

The plugin has no role for the deployment of a project. It is a product fact, so it also goes into
`AGENTS.md` when more than one step needs it: a lane ends when the change is on the trunk.

With Claude selected, setup adds the correct relative import to
each existing regular Claude instruction file: `@AGENTS.md` in root `CLAUDE.md`, and
`@../AGENTS.md` in `.claude/CLAUDE.md`. Imports resolve from the containing file
([Claude Code memory documentation](https://code.claude.com/docs/en/memory), latest documentation
read on 2026-10-29). Setup creates no Claude instruction file just for an import. A wrong existing
unowned import stays unchanged and gets an exact manual action. Obsolete recorded imports are
removed. Codex-only setup adds no Claude import.
Direct native loading depends on the host's instruction precedence and settings. Generated files
and imports do not prove that a fresh host session loaded them.

Setup preserves supported instruction links without a write through a link. A Claude instruction
file that links to `AGENTS.md` needs no import. When `AGENTS.md` links to a regular root or nested
Claude instruction file, the block and any approved baseline go into that real in-project file.
The marker entry names that destination, and setup adds no self-import. An unrelated `AGENTS.md`
link refuses; an unrelated Claude instruction link stays unchanged with an owner-review warning.

### The stores

Setup creates no store, starter README, template, or empty catalog. Store writers create only the
paths that their first record needs:

- `record-architecture-decisions` reads generic guidance and the template from the plugin, plus
  product policy named by `AGENTS.md`. It creates `docs/adr/` with the first numbered record.
  Existing product ADR guidance and templates remain product content.
- A review that activates a lesson creates `docs/lessons/` when needed, in the checkout where
  the review runs. It writes no catalog: `lesson-store read` derives the active and history
  lists from the lesson files. Superseded records remain as history. A leftover
  `docs/lessons/INDEX.md` fails each lesson read, with its path, until you delete it.
- Capture creates only a pending proposal and queue row in the main checkout's
  `docs/lessons/_pending/`, also when the task runs in a linked worktree. Rejected records stay
  in `_pending/_rejected/`. Grounding reads active lessons from the lane's own checkout with
  `lesson-store read active`. A plan copies each applicable active rule with its path and digest.
  Each task and repair boundary, including the final review and re-entry, refreshes those copies
  from the task checkout: changed rules replace old copies, and superseded or retired rules drop
  out. A missing lesson or a rule that conflicts with the
  approved scope stops the task or repair for a decision. Missing stores cause no bootstrap
  write. The first mutation creates a local `_pending/.gitignore` before its journal, so an
  unconfigured Git repository also ignores pending data. Existing ignore content is preserved or
  reported as a conflict.
- Ordinary chats use native skill discovery for substantive corrections and repeated failed
  repairs. Workflow steps use the same bounded capture procedure at correction, repeated-fix,
  and pre-stop checkpoints. Explicit save requests also produce pending proposals. Each turn
  handles at most three proposals, with one per distinct incident; further incidents are deferred.
  Children report evidence to the coordinator, who owns the write. A blocked capture reports
  its cause once and leaves independent task work running. It grants no extra repair attempt.
- A recurrence retains the examined rule digest and available task evidence. Its diagnosis
  separates missing retrieval, a violated rule, incomplete guidance, failed enforcement, and
  unknown cause. Conflicts remain proposals for review. Structural follow-ups need separate
  authorization and proof; judgment-dependent rules state why they remain text.
- `lesson-store` serializes writes with a private lock file in the per-user temporary folder:
  `/tmp/celetis-<uid>/lessons/<digest>.lock`, or `celetis\lessons\<digest>.lock` in the temporary
  folder on Windows. The digest is the SHA-256 of the real path of the common Git directory.
  Each read in each checkout takes the same lock, so no read sees a write in progress. A lane
  apply holds the lock through the commit hooks of the project. `capture` waits up to 120 seconds
  for the lock, and each other command up to 10 seconds; then it exits 3 with `busy`. An
  incomplete `_pending/.transaction.json` of the main checkout blocks each read in each checkout
  until `lesson-store recover` completes or rolls back the recorded operation. A lane journal
  also records the lane and its HEAD: recovery completes it when the lesson commit exists, and
  rolls it back when the lane is still at that HEAD. When the lane HEAD moved without the lesson
  commit, recovery names the repair: `git -C <lane> reset --soft <recorded HEAD>`, then `recover`
  again. Recovery refuses conflicting bytes. Old-format records need explicit review.
- Each agent landing curates the queue first, in the lane: one fresh reviewer child decides at
  most the five oldest proposals by the reviewer rules of `docs/procedures/lesson-curation.md`,
  and its lesson commits land with the lane. No human approves these decisions. A curation
  failure keeps the decisions applied before it, leaves the other proposals pending, and the
  landing runs. `lesson-review` is your optional review: it can promote, edit, merge, supersede,
  retire, or reject selected records, and it shows the exact snapshot before your approval;
  changed inputs require a new review. Each result keeps its origins, incident evidence,
  uncertainty, and review history. In a linked checkout, `lesson-store apply` commits only the
  live lesson paths on the lane branch, before the proposals leave the queue. In the main
  checkout it leaves the Git index unchanged.

An existing unreadable or malformed store is an error. Its failed read is not an absent store.
Existing records, catalogs, guidance, and templates stay unchanged unless the relevant writer or
owner explicitly changes them.

### Review old wiring

Setup reconciles valid recorded scopes in the active product checkout. It refreshes current
owned requirements and removes obsolete owned entries, including edits within owned keys and
dedicated files. It preserves differing unowned values and old unrecorded wiring with exact
warnings. Installation and update remain separate explicit operations. The marked `## Celetis`
entry pointer retains its bounded marker authority, even without a record.

1. Review the complete setup diff, including deleted paths, new files and JSON formatting.
   The resulting record contains current ownership only. Setup reports surviving tracked callers
   of a removed launcher by path; it changes no product caller. Its literal search cannot find
   dynamic or external references. A remaining caller or unresolved wiring warning prevents a
   claim that the wiring is current.
2. Review these candidates against the required forms above:

   - Copied `scripts/celetis` launchers and every caller in scripts, CI, instructions, permissions,
     and board configuration. Move each approved remaining caller to the installed `celetis`
     program. A valid whole-file claim permits setup to remove the launcher; unrecorded launchers
     need owner review. Keep product additions until their owner has reviewed them.
   - Old `permissions.allow` entries for `scripts/celetis`, `./scripts/celetis`, or broad `celetis`
     calls in `.claude/settings.json`, and obsolete entrypoint allows in
     `.codex/rules/celetis.rules`. Keep the direct-merge restriction. Personal `land` and optional
     `issue` rules stay explicit and local.
   - The old `.gitattributes` line `scripts/celetis text eol=lf`. Keep
     `.celetis.yaml text eol=lf` and unrelated attributes.
   - Project `enabledPlugins.celetis@celetis` in `.claude/settings.json`. The supported Celetis
     installation is user-scoped. Keep Superpowers and other plugins, the required marketplace,
     and product settings. Review effective automatic-update policy separately.
   - Old generic board commands, including `scripts/celetis board` and its `./` form, in launch
     files or scripts. Keep product-specific board configuration, port choices, and local desktop
     entries. `celetis daemon start` serves the board and prints its URL.
   - The exact generic flow lines below. Read the repository identity from the recorded flow line,
     not from a current answer alone, and compare the current content. A matching phrase alone is
     insufficient evidence of ownership.

     ```markdown
     ## Celetis flow

     - The lanes are the skills of the plugin `celetis`, on the issues of `<owner>/<repo>`.
     - `landing` in `.celetis.yaml` names the landing mechanism, and a build step ends with `celetis --agent <host> land`.
     - A lane never skips a step.
     - The maintainer starts the runner; an agent starts it only when its task says so, with a number, and in a terminal.
     ```

3. The owner reviews unowned removals and caller changes in a separate product change. Keep
   product-specific flow instructions and every unreviewed unowned entry. Setup removes an old
   recorded generic heading only when no product content remains in its section. Existing generic
   ADR files and populated stores stay product content and need independent owner review. Commit
   repairs before another setup run so the tree meets its preflight requirements.

The existing `setup try` and `setup write` share the reconciliation plan; there is no separate
cleanup command. One final commit-and-push question covers all shown additions, replacements
and removals. A local desktop configuration stays product content.
A `setup: no file changed` line describes only the diff. With any unresolved wiring or policy
warning, it establishes neither current wiring nor native policy loading. Keep each exact warning
and its manual action in the report.

### The wiring on the trunk

The wiring must be on the trunk of `origin` before the first lane. A lane branch starts at the trunk
of `origin`, so a file that is not there is in no lane worktree: `.celetis.yaml`,
including a custom part and the worktree setup. A file that git does not track also makes the main
checkout dirty, and the resolver then stops each issue.

Setup stops before any write when the index holds a staged change, or when an affected setup path
has an uncommitted change, including a planned deletion. Validated obsolete owned paths, such as
the copied launcher, are in the plan and commit; starter documents stay product content. Setup
stages only validated planned wiring paths and excludes unrelated product changes. After a failed
write, the report shows the failing path, `git status --short`, the complete diff of each changed
or deleted setup path, and every new setup file in full. Partial writes need owner review and
a commit or restore before retry;
setup claims no success and makes no automatic push. After a successful write, setup asks one
question: commit and push to the trunk of `origin`?

- On a yes, setup commits the files that it changed, with the subject
  `chore(celetis): wire the project for the celetis lanes`, and it pushes the trunk. The push also
  carries each commit of the local trunk that is ahead of `origin`, and setup names them before it
  asks. When `origin` refuses the push, setup stops with the message of git, and the commit stays
  on the local trunk. A later run of setup pushes it after you fix the cause. When the trunk
  refuses direct pushes, push the setup commit to a branch, land it through a PR, and then run
  `git pull --rebase` on the local trunk. After a squash landing, a pull with a merge keeps the
  setup commit ahead of `origin`, and the next push is refused again.
- On a no, the files stay uncommitted in the main checkout, and the resolver stops each issue until
  you commit or drop them.

Commit each change that you make by hand on the trunk too, and push it: for example a custom part
in `.celetis.yaml`. The `.celetis.yaml` file needs LF line endings on each host. Setup adds
`.celetis.yaml text eol=lf` to `.gitattributes`. When
the index holds `.celetis.yaml` with CRLF line endings, setup stops before any write: convert the
file to LF and commit it first.

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
| `/celetis:triage #<n>` | picks the lane and the effort level of its first step, and asks whether to go on | an `Effort: specify <level>` comment with its reason, and the lane label, here `enhancement` |
| `/celetis:feature #<n>` | makes the lane worktree and runs `specify`: the design, in a conversation with you, then the effort level of `plan` | an `Effort: plan <level>` comment, and the spec that you approved, as the body of the issue |
| `/celetis:plan #<n>`, in a new session | writes the plan: your steps (the human acts of the lane), the build flow, tasks with a capability score, and a Verify phase; then it picks the effort level of `implement` | an `Effort: implement <level>` comment; a `## Plan` comment; `ready-for-agent` unless `ready-for-human` holds the issue, in which case the human hold stays and the agent label is removed |
| `/celetis:implement #<n>`, in a new session | builds the tasks in the flow that the `Execution:` line of the plan names (`inline`: the session builds each task and runs the verify gate of the project, then one review of the branch; `subagent`: an implementer, the verify gate of the project, and a review for each task), runs the Verify phase, and lands the change with `celetis --agent <host> land` | the change on the trunk, and a closed issue |

- Change work includes affected current documentation in its existing tasks and reviews before
  completion. [Current behavior documentation](docs/procedures/behavior-documentation.md) also
  covers repairs and drift maintenance, while preserving historical change records on GitHub.
- The plan and runtime checks use [Runtime verification](docs/procedures/runtime-verification.md)
  to identify the tested source and confirm the actual running target before a runtime PASS.
  Its [Usage-limit exception](docs/procedures/runtime-verification.md#usage-limit-exception) can
  permit landing with one host verified; the other host's quota-blocked coverage stays incomplete.
- Projects can reuse [verification recipes](docs/procedures/verification-recipes.md) through an
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
  `celetis --agent <host> land <n> '<subject>'` pushes the branch, opens the PR, waits up to 15 minutes
  for the checks. Each invocation waits for workflow completion before it accepts green checks,
  including when a dependent job has no check row yet. It squash-merges at the checked commit only
  when every check passed or was skipped and at least one check passed. Before the merge, when each
  red check is a GitHub Actions check that failed or timed out, the failed jobs of their workflow
  runs get one re-run for each commit, with up to 15 more minutes of wait. It then moves the trunk
  of the main checkout to the merge, and removes the worktree and the branch. With `merge`, it runs
  the `suite` file of `.celetis.yaml` in the lane, at the tip that it lands, and only on a pass it
  puts that tip on the trunk as one squash commit, with no PR. The daemon of the repository runs the
  landing, one landing at a time: a second `land` prints
  `land: #<n> waits for the landing of #<m> in the daemon PID <pid>` and waits for its turn, and
  `celetis daemon status` prints `daemon: landing #<n> runs|waits since <HH:MM:SS>` for each.
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
2. checks that the version folder of its program still has its files, and that the plugin of the
   session's host is at the revision of the program ("Updates");
3. starts the selected interactive CLI in the main checkout with the host's skill prompt, a
   facts header (the issue, the step, the host, the main checkout, the plugin folder, and the
   landing mechanism), and the step text. Claude uses `--permission-mode auto` and gets the header
   and the step text through `--append-system-prompt`. Codex uses `--no-daemon`, keeps its
   configured permissions, and appends the header and the step text to effective
   `developer_instructions`. Claude gets the effort level as `--effort <level>`, and Codex as
   `-c model_reasoning_effort="<level>"` after a clamp to the levels of its model. The level is the
   override of this start when there is one, else the decision of the step before, else `high`
   (`docs/workflow.md`, "Start the script", "The effort level");
4. opens each session in a new tab of the Herdr app, and ends it when the issue shows that the
   step is done;
5. with the default choice, selects the first eligible host of the effective order of the step at
   each session start: the preferred agent of the step in `agents`, when the local order includes
   it, then the other hosts of the local order ("Agent selection and model setup"). After a
   confirmed usage refusal, it ends only its own session and waits until no process of the
   session's tree or with its attempt marker runs. It then starts the same step on
   the next eligible host with the dirty lane kept. When it cannot prove that stop, as for Codex,
   or a background task still runs, no other agent starts. When all
   hosts are limited, it waits for the earliest supplied reset, or for
   `celetis run retry <n> <wait id>` (`docs/workflow.md`, "Usage-limit recovery").

The daemon works at an issue: write one with `/celetis:intake`, or open one on GitHub. Then, for
the feature `#12`:

```bash
celetis --agent <host> run 12    # triage
celetis --agent <host> run 12    # specify: the session asks, and it waits for your approval of the design
celetis --agent <host> run 12    # plan
celetis --agent <host> run 12    # implement: it builds, verifies, and lands
```

With each gate `me`, one start runs one step. Each command returns at the answer of the daemon, so
read `celetis daemon status` before the next start. With a gate `auto`, a start goes on through
that step by itself, and `celetis --agent <host> daemon auto on` turns on auto mode of the
daemon: it runs each `auto` step of each open issue. A Run press on the agent board sends the
same request to the daemon, and the daemon opens the session tab in the background.

A run lives in the daemon, with its tabs, its lines, and its exit code: read them in
`celetis daemon status` (the `line` of its row) and in
`<git common dir>/celetis/daemon/daemon.log`. It uses the environment of the daemon from its
start. `--agent` and `CELETIS_AGENT` travel in the request; a variable that you export only in the
shell of the command does not reach the run. Ctrl+C, a signal, or a closed terminal of the command
stops no run. `celetis daemon stop` stops the daemon and detaches every run; no command stops one
run.

The queue stays available as issues finish. Read its current identity before an action:

```sh
celetis --agent <host> queue status
celetis --agent <host> queue action '{"kind":"add","number":12,"step":"plan","expected":{"id":null,"revision":0,"current":null}}'
```

The example adds to missing storage; for an existing record use the ID, revision, and current
issue from status. Add starts an empty queue and appends otherwise. Move and remove affect only
waiting work. The agent choice stays fixed while nonempty. Every later me gate requires Continue.
Retry recovers an interrupted launch or stopped step; a null step acknowledges terminal work
without authorizing another issue. Only fresh finished/wontfix decisions drain work. Read failures
retain accepted work. The same empty queue accepts more work without reset or reload.

The record remains at `<git common dir>/celetis/queue.json`, now schema 3. Ordinary queue
access, including status and the board, converts valid schema-1 and schema-2 records under
execution ownership. The recovery record and the run records follow the same rule: a schema-1
record converts to schema 2 when a process reads it ("The move of the old names" of
`docs/workflow.md`). The conversion preserves the exact source bytes in a private sibling archive
before replacement. Unfinished work keeps its order and recorded host; conversion starts no work.
A live run or foreground causes refusal; retry after it exits. Invalid or unsupported records
stay intact. See `docs/workflow.md`, "The continuous queue", for the mappings and locks.
Old batch forms remain removed.

A step session follows the step text: it asks only for a decision that the issue does not hold, and
at a stop it puts the reason on the issue and adds `ready-for-human`. The `specify` session has no
step text: it waits for your approval of the design, as a session by hand does.

`docs/workflow.md` holds the daemon and the runs in full. `docs/issue-tracker.md` holds the labels, what
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
| | [`/celetis:writing-for-agents`](skills/writing-for-agents/SKILL.md) | The reference for a document that an agent reads: a skill, or an `AGENTS.md` |
| | [`/celetis:create-verification`](skills/create-verification/SKILL.md) | Creates project-owned recipes and proves at least one core flow. Only you can start it |
| | [`/celetis:maintain-verification`](skills/maintain-verification/SKILL.md) | Reviews and exercises the whole existing verification map. Only you can start it |
| | [`/celetis:guide`](skills/guide/SKILL.md) | Says which command fits a goal. Only you can start it |
| | [`/celetis:setup`](skills/setup/SKILL.md) | Proposes and tests the worktree setup of a product project, writes the wiring in its main checkout, and commits and pushes the wiring after your yes. Only you can start it |

A skill holds only its own steps and judgment. Each procedure that two or more skills, or a skill
and the step text, need is a module in `docs/procedures/`, for example the entry (`entry.md`), the
lane worktree (`worktree.md`), the child dispatch (`dispatch.md`), the landing (`landing.md`), and
the lookup of the external facts (`docs-lookup.md`). A module is a plain document, not a skill: a
step of a skill names it, and the session reads it whole when the step comes. The Claude Code and
Codex lines of an operation are in its module.

A general engineering principle has one canonical file in `docs/principles/`, regardless of
caller count. Each file has `Applies when`, `Rule`, and `Check` sections. Skills and workflow
steps cite the file when the task meets its trigger, rather than copy the rule. A principle
stands alone, holds no workflow or host procedure, and has no minimum citer count. Entry loads
no principle catalog. `docs/capability.md` and the other
maintainer references keep their existing role. The rubric of the capability score is the
procedure module `docs/procedures/capability-score.md`. The `AGENTS.md` of this repository, "Where
agent text lives", gives the placement rule (ADR-0047 and ADR-0050).

Each principle is also a native skill. An ordinary engineering task can select it or invoke it
by name without an issue, a lane, or project configuration. The normal entry contract applies.
Each invocation reads its one canonical rule file.

`capture`, `feedback`, `guide`, `setup`, `create-verification`, and `maintain-verification` are explicit-only on both
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

A product project runs each command through the installed program `celetis` ("First install").
`celetis help` prints the commands that a person types:

<!-- scripts/build.ts writes this block from engine/lib/contract.ts. Edit that file, then run scripts/build.ts. -->
```text
usage: celetis [--agent <host>] <command> [<argument>...]

  celetis update                              Updates the program and the plugin of each host; asks once.
  celetis update check                        Shows the installed and the available revision of each part.
  celetis setup status                        Reports each part of the required wiring that this checkout lacks; writes nothing.
  celetis agents read                         Reads the local ordered agent preference and its version.
  celetis agents replace '<JSON>'             Replaces the local order using order and expectedVersion.
  celetis intake                              Starts a fresh session that asks for your request before intake.
  celetis assist <n>                          Starts fresh interactive assistance for an issue in the main checkout.
  celetis visual <n> <sha>                    Starts a fresh session that makes the visual of a landed commit.
  celetis run <n>                             Asks the daemon to start the next step of one issue and follow its auto gates; returns at once.
  celetis run <n> --effort <level>            Asks the daemon to start the next step of one issue at another effort level, for its first session only.
  celetis run resume <n>                      Asks the daemon to open the session of a step with no progress again.
  celetis run retry <n> <wait-id>             Asks the daemon to wake the quota waiter of an issue for one attempt cycle.
  celetis queue action '<QueueAction JSON>'   Saves a queue action; asks the daemon to run its authorized wake.
  celetis queue status                        Reads the current queue and its allowed actions.
  celetis daemon start                        Starts the master daemon of this repository, detached, waits until it answers, and prints the board URL.
  celetis daemon status                       Shows the daemon, the board URL, its auto mode, and its runs.
  celetis daemon stop                         Stops the daemon and waits until its process ends.
  celetis daemon auto on|off                  Turns auto mode of the daemon on or off, and prints its state.
  celetis lesson-store read main|active       Reads validated lessons; requires explicit --agent.
  celetis lesson-store capture FILE           Saves a pending proposal; requires explicit --agent.
  celetis lesson-store preview FILE           Prepares an exact lesson review; requires explicit --agent.
  celetis lesson-store apply SNAPSHOT DIGEST  Applies a reviewed snapshot and commits it in a linked checkout; requires explicit --agent.
  celetis lesson-store recover                Completes or rolls back an interrupted lesson write; requires explicit --agent.
  celetis root                                Prints the folder of the program.
  celetis --version                           Prints the revision of the program.
  celetis help                                Prints this list.

In a terminal, --agent claude|codex is optional. CELETIS_AGENT is an explicit choice too.
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
| `celetis --agent <host> lesson-store read main\|active` | Returns validated lesson records, exact file contents, digests, and the resolved checkout as JSON. `main` returns the live files of the checkout that runs it with the pending and rejected data of the main checkout, and `root` names the main checkout. Rejected records appear in `history` with `status: pending-review`; they are not past guidance. `active` reads the live files of the task checkout and ignores its pending folder. A leftover `docs/lessons/INDEX.md` fails both reads. Exit status: 0 done, 1 internal, 2 usage, 3 prerequisite, 6 blocked |
| `celetis --agent <host> lesson-store capture FILE` | Reads typed `{schema:1,candidate,expected,name,description,tags,date,source,incidents,body}` JSON and builds the pending record; `expected` is the pending SHA-256 or null for creation. An extension keeps the stored incidents and reviews. Validates the store of `read main` and saves pending evidence in the main checkout only. Equal incident replays are unchanged; stale updates are refused. Exit status: 0 done, 1 internal, 2 usage, 3 prerequisite, 6 blocked |
| `celetis --agent <host> lesson-store preview FILE` | Reads a review request and returns its exact before/after contents of the store of `read main`, watched digests, and snapshot digest without lesson writes. Select pending UUIDs and complete resulting documents as defined in [the lesson format](docs/procedures/lesson-format.md). Exit status: 0 done, 1 internal, 2 usage, 3 prerequisite, 6 blocked |
| `celetis --agent <host> lesson-store apply SNAPSHOT DIGEST` | Recomputes the review and applies exactly the approved snapshot under the lock. Changed input or snapshot bytes are stale. Replaying the same review is unchanged; conflicting reuse of its ID is invalid. The digest identifies a version, not its reviewer. In a linked checkout, a live change needs a clean checkout on a branch and becomes one local commit `docs(lessons): <decision> <names>` with a `Lesson-Transaction` trailer, made with the project's hooks; the proposals leave the queue only after that commit. When Git fails but the lesson commit exists, the apply completes. When the lane is still at its old HEAD, the apply restores the before bytes of the live paths, also a hook rewrite, and their index entries, and exits 6. When HEAD moved without the commit, the journal stays (exit 6), and the line names the repair: `git -C <lane> reset --soft <recorded HEAD>`, then `recover`. Exit status: 0 done, 1 internal, 2 usage, 3 prerequisite, 6 blocked |
| `celetis --agent <host> lesson-store recover` | Completes or rolls back the one journal under the lesson lock, from any checkout of the repository. A lane journal completes when its lesson commit exists and rolls back when the lane is still at the recorded HEAD; a lane HEAD that moved without the commit blocks it until `git -C <lane> reset --soft <recorded HEAD>`. These commands require Git and an explicit host, but no issue, run, or configuration file. Only a lane apply and its recovery change the Git index. It exits 2 for invalid input or store, 3 when the input is stale or a lock is busy, and 6 for an access, I/O, or recovery block. Exit status: 0 done, 1 internal, 2 usage, 3 prerequisite, 6 blocked |
| `celetis --agent <host> run <n> [--quiet] \| run resume <n> \| run retry <n> <wait-id>` | Each form sends one request to the master daemon of the repository of the current folder and returns at its answer. `run <n>` starts the next step of the issue, `run resume <n>` opens the saved session of a step with no progress again, and `run retry <n> <wait-id>` wakes the quota waiter of the issue for one attempt cycle. `--quiet` opens each session tab of the start in the background; `run resume` ignores it. An accepted start prints `run: #<n>: accepted as run <run id> of the daemon PID <pid>; read its progress: celetis daemon status`, and an accepted Retry prints `run: #<n>: Retry requested; the waiting run starts one bounded attempt cycle`; both exit 0. A refusal prints the line of the daemon, on stdout for code 0 and on stderr otherwise, and exits with its code: 3 for a busy issue lock, 6 for a failed GitHub read of the issue, 0 for each other end before the first session. With no daemon, it exits 3 and starts nothing. It exits 3 when the daemon runs another revision of the program or an update removed this program version, and 6 when the daemon does not answer or the outcome is unknown. On Windows it exits 3 with `run: Windows is not a support target`. Any other form exits 2 with the usage line. Exit status: 0 done, 1 internal, 2 usage, 3 prerequisite, 6 blocked |
| `celetis --agent <host> run <n> --effort <level> [--quiet]` | Asks the daemon to start the next step of the issue at `low`, `medium`, `high`, `xhigh`, or `max` instead of its decided or default level; the request carries the level, for the first session of this start only. Each later step uses its own decision, and the flag writes no decision. It needs exactly one issue number; any other form exits 2 with the usage line. Exit status: 0 done, 1 internal, 2 usage, 3 prerequisite, 6 blocked |
| `celetis --agent <host> queue action '<QueueAction JSON>' [--quiet] \| queue status` | `status` prints the view of the queue as JSON. `action` saves one validated action and prints the view; when the action gives a wake, it then sends that wake to the master daemon and prints the answer as `run` does, with the prefix `queue:`. An Add to an empty queue, a Continue, and a Retry exit 3 with no daemon and save nothing. `--quiet` opens each session tab of the wake in the background. It exits 2 for another form, an agent that differs from the agent choice of the queue, or a queue record that is not valid, 3 for a refused action (for example a stale `expected`), and 6 when GitHub or the queue record cannot be read. Exit status: 0 done, 1 internal, 2 usage, 3 prerequisite, 6 blocked |
| `celetis --agent <host> daemon start \| daemon status \| daemon stop \| daemon auto on\|off` | Starts, reads, and stops the master daemon of the repository of the current folder (`docs/workflow.md`, "The master daemon"); `auto on\|off` turns auto mode of the daemon on or off and prints `daemon: auto mode <state>`. For `start`, `status`, and `stop` the optional `--agent` selects nothing; for `auto` it selects the host of the auto steps. `start` spawns the daemon detached, which serves the board ("The agent board"), and exits 0 when it answers, or when a daemon already runs; it then prints `daemon: board http://127.0.0.1:<port>`, except for a daemon of another revision. It exits 3 when `gh`, `hc`, or the Herdr app is missing, and 6 when the hc server or the Herdr app does not answer, or when the daemon ends or stays silent for 30 seconds, for example when its board port cannot open. `status` prints the daemon, the board URL, its auto mode, and one line per run; it exits 3 when no daemon runs or the daemon runs another revision of the program. `stop` exits 0 when the process ended or no daemon runs. `auto` exits 0 with the state, 3 when no daemon runs or the daemon runs another revision of the program, the code of a refusal, or 6 when the outcome is unknown. Each form exits 6 when a daemon is known but its process or socket does not answer; `stop` exits 6 too when the process stays for 60 seconds. Windows exits 3, and any other form exits 2. Exit status: 0 done, 1 internal, 2 usage, 3 prerequisite, 6 blocked |
| `celetis --agent <host> intake` | Starts a fresh interactive session in the main checkout. It asks “What would you like to work on?” and waits. After an answer, it enters `celetis:intake` with that request. It creates no issue before the answer and does not start a run. Before the start, it checks that the plugin of the selected host is at the revision of the program, and it exits 3 with the line of that check when it is not. Exit status: 1 internal, 2 usage, 3 prerequisite, 6 blocked, or the exit code of the host session |
| `celetis --agent <host> assist <n>` | Starts fresh interactive assistance for the issue in the main checkout. It completes permitted work for the current block and uses `issue <n> assisted <file>` for verified completion and hold removal. It asks for missing human contributions, then reports the actual next step. It does not start or resume a run or land. Before the start, it checks that the plugin of the selected host is at the revision of the program, and it exits 3 with the line of that check when it is not. Exit status: 1 internal, 2 usage, 3 prerequisite, 6 blocked, or the exit code of the host session |
| `celetis --agent <host> visual <n> <sha>` | Starts a fresh interactive session in the main checkout that makes the `visual-explainer` diff review of the landed commit `<sha>` of the issue `<n>`. It fetches the trunk from `origin` and refuses a commit that is not on it, and a commit whose page exists. The host writes `docs/superpowers/visuals/<sha>.html` and opens it, changes no other file, and makes no commit. A host with no `visual-explainer` skill says so in the tab and writes no file. The board's Make visual starts this command. Exit status: 1 internal, 2 usage, 3 prerequisite, 6 blocked, or the exit code of the host session |
| `celetis --agent <host> worktree <n>` | Makes the lane worktree and the branch of the issue, or enters the one that is there and brings it up to the trunk, and prints its path. Exit status: 0 done, 1 internal, 2 usage, 3 prerequisite, 4 repair, 6 blocked |
| `celetis --agent <host> worktree --remove <n>` | Removes the lane worktree and the branch of an issue that ended with no landing by the script. It refuses while the issue is open and its branch has no merged PR, so close the issue first. Exit status: 0 done, 1 internal, 2 usage, 3 prerequisite, 4 repair, 6 blocked |
| `celetis --agent <host> land <n> '<subject>'` | Lands the change of the issue by the `landing` field of `.celetis.yaml`. It is the one landing path of an agent. The master daemon of the repository runs the landing, and `land` prints its output and exits with its status; with no daemon, or a daemon of another revision, it exits 3, when the daemon does not answer 6, and for another refusal of the request by the daemon it exits with the code of that refusal. It refuses an issue that is not ready to land. It exits 7 when the change landed and its cleanup stopped; run it again. Exit status: 0 done, 1 internal, 2 usage, 3 prerequisite, 4 repair, 5 checks, 6 blocked, 7 cleanup, 128+n signal |
| `celetis --agent <host> issue <n> route feature\|bug\|chore\|hotfix \| issue <n> effort <step> <level> <file> \| issue <n> epic <file> \| issue <n> epic-state \| issue <n> complete-epic [file] \| issue <n> needs-info <file> \| issue <n> wontfix <file> \| issue <n> spec <file> \| issue <n> root-cause <file> \| issue <n> plan <file> \| issue <n> built \| issue <n> before-landing <file> [--during-the-build] \| issue <n> landing-refused <file> \| issue <n> stopped <file> \| issue <n> ready-for-human \| issue <n> assisted <file> \| issue <n> state` | Makes each workflow write that the engine reads: `route feature\|bug\|chore\|hotfix`, `effort <step> <level> <file>`, `epic <file>`, `complete-epic [file]`, `needs-info <file>`, `wontfix <file>`, `spec <file>`, `root-cause <file>`, `plan <file>`, `built`, `before-landing <file> [--during-the-build]`, `landing-refused <file>`, `stopped <file>`, `ready-for-human`, `assisted <file>`. The assistance act records an attributed `## Human steps done` report before removing present blocking labels; it adds no label and preserves build state. Lifecycle acts write the comment heading before label changes. Each act refuses unmet prerequisites. `state` writes nothing and prints lifecycle facts. `epic-state` writes nothing and prints the current declaration, child snapshot, history, and holds. Epic definition writes preserve the complete parent body; guarded completion publishes its accepted record before closing and leaves readiness labels unchanged. `docs/issue-tracker.md`, "Conventions", gives each act. Exit status: 0 done, 1 internal, 2 usage, 3 prerequisite, 6 blocked |
| `celetis --agent <host> next-step <n> \| next-step --open` | The resolver: the next step of one issue, or of each open issue. Exit status: 0 done, 1 internal, 2 usage, 3 prerequisite, 6 blocked |
| `celetis --agent <host> events [--after <id>]` | Prints each kept entry of the event record of the user as one JSON line, oldest first; `--after <id>` prints only the entries after that entry. `docs/workflow.md`, "The event record", gives the record. It exits 2 for a relative `CELETIS_HOME`, 3 when the record lock is busy, and 6 for an unsafe folder or lock file. Exit status: 0 done, 1 internal, 2 usage, 3 prerequisite, 6 blocked |
| `celetis --agent <host> config <checkout> <plugin>` | The reader of `.celetis.yaml` for the agent. It first checks that `<plugin>` is a Celetis plugin: a folder whose `.claude-plugin/plugin.json` has `"name": "celetis"`. It then validates the whole file of `<checkout>`, and checks each `custom` key against `<plugin>/skills/<key>/SKILL.md`, a regular file with no symbolic link. It prints the configuration as one compact JSON line. `--agent` selects nothing. It exits 2 for another form, a folder that is not a Celetis plugin, or a missing or invalid file; the line names the field or the plugin folder. Exit status: 0 done, 1 internal, 2 usage, 3 prerequisite, 6 blocked |
| `celetis --agent <host> capscore J V B N S X [--json] [--bias N] [--attempt N] [--reviewer] [--profile FILE] [--runtime-models FILE]` | Resolves the six digits. `--json` gives portable scores and the host pair. With a Codex profile, it selects the profile by live runtime identity and needs `--runtime-models`; with no Codex profile, `dispatch.model` is null. Exit status: 0 done, 1 internal, 2 usage, 3 prerequisite, 6 blocked |
| `celetis --agent <host> dispatch next <n> <task> implementer\|reviewer J V B N S X --bias N [--profile FILE] [--runtime-models FILE] \| dispatch report <dispatch-id> <report-file> \| dispatch gate <n> <task> pass\|fail <gate> <report> [--profile FILE] [--runtime-models FILE] \| dispatch review <n> <task> findings\|blocked [--profile FILE] [--runtime-models FILE] \| dispatch close <n> <task> \| dispatch show` | Acts: `next`, `report`, `gate`, `review`, `close`, `show`. The task loop applies each returned pair and reports exact native arguments/results. Evidence is agent-reported, not independently checked. Records: `/tmp/celetis-<uid>/dispatch/<host>-<session>.json` on macOS and Linux; `<os.tmpdir()>/celetis/dispatch/<host>-<session>.json` on Windows. It exits 0 for a ready, reported, or closed result (also `show`), 2 for bad usage or an invalid `.celetis.yaml`, 3 for a refusal or a busy dispatch lock, 6 for a setup failure, and 8 when the engine stops the task. Exit status: 0 done, 1 internal, 2 usage, 3 prerequisite, 6 blocked, 8 stop |
| `celetis install` | Installs the revision of the clean checkout that it runs from as the program ("First install"); takes no arguments. Exit status: 0 done, 1 internal, 2 usage, 3 prerequisite, 6 blocked |
| `celetis --agent <host> setup check \| setup write --hosts claude\|codex\|claude,codex\|codex,claude --landing pr\|merge [--suite <file>] [--setup-file <file>] [--ignore <line>] [--baseline-file <file>] \| setup try --hosts claude\|codex\|claude,codex\|codex,claude --landing pr\|merge [--suite <file>] [--setup-file <file>] [--ignore <line>] [--baseline-file <file>] \| setup try --remove \| setup lane <path> \| setup push` | The deterministic part of `/celetis:setup`: validated saved answers from `check`, bounded owned refresh and removal in `write`, the test lane (`try` makes it and runs the worktree setup there, and `try --remove` removes it), the run of the worktree setup in a lane that exists (`lane`), and the commit of planned paths, including deletions, with the push. Every setup run calls the program; no product launcher is written. Exit status: 0 done, 1 internal, 2 usage, 3 prerequisite, 6 blocked, or the exit code of the worktree setup script |
| `celetis --agent <host> setup status` | Reports the required wiring of the active checkout for the selected host, also from a subfolder or a lane worktree: `origin`, `.celetis.yaml` and its configured files, the Celetis block, the Claude imports and settings or the Codex restriction, the ignore and attribute lines, the record of setup, and the workflow labels. It writes nothing, runs no product file, and fetches nothing. An incomplete report ends with `Run /celetis:setup in the main checkout: <path>`. It exits 0 when the wiring is complete, 3 when it is missing, invalid, or different, and 6 when an observation is blocked. Exit status: 0 done, 1 internal, 2 usage, 3 prerequisite, 6 blocked |
| `celetis agents read \| agents replace '<JSON>'` | Reads the local ordered preference, or replaces it with exactly `order` and `expectedVersion`. It shares the Git common directory across worktrees and requires no YAML. It exits 2 for a replacement that is not JSON or not a valid order, and for an `agents.json` that does not validate. It exits 3 for a stale-edit conflict, and returns the latest order; a busy write lock also exits 3, with no JSON. It exits 6 for an unsafe or unreadable record. Repeating the current order succeeds. Exit status: 0 done, 1 internal, 2 usage, 3 prerequisite, 6 blocked |
| `celetis update \| update check` | Updates the program and the plugin of each host, and asks once in an interactive terminal. `check` is read-only: it prints one JSON array of the parts. `plugins/celetis/README.md`, "Updates", gives the steps. Any other form exits 2 with the usage line. Exit status: 0 done, 1 internal, 2 usage, 3 prerequisite, 6 blocked |
| `celetis root` | Prints the folder of the program. It takes no argument and runs in each folder. Exit status: 0 done, 1 internal, 2 usage, 3 prerequisite, 6 blocked |
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

These programs are not commands of the program `celetis`. Each gives its own exit codes:

| Program | What it does |
|---|---|
| `bun --no-env-file --no-install --config=/dev/null --no-macros engine/usage-hook.ts <capture-directory> <attempt-id>` | Internal Claude usage callback. Reads one native event from stdin and records a bound observation in the private attempt folder. Session arguments select it; it changes no installed setting. Unsupported or mismatched events give no decisive observation. Exits: 0 handled, 1 invalid input or unavailable capture |
| `bun --no-env-file --no-install --config=/dev/null --no-macros scripts/build.ts [--check]` | Builds the delivery with exactly Bun 1.4.4, or compares generated bytes, and modes on macOS and Linux, without writes |
| `bun --no-env-file --no-install --config=/dev/null --no-macros scripts/verify.ts` | Runs this plugin repository's fast gate in its checkout |
| `bun --no-env-file --no-install --config=/dev/null --no-macros scripts/install-tools.ts DESTINATION [--claude]` | Installs pinned development tools into a private destination |
| `bun --no-env-file --no-install --config=/dev/null --no-macros scripts/herdr-lab.ts up \| run <id> <command>... \| down <id>` | macOS only. `up` makes a lab, a private hc core and a second Herdr app window on temporary data under `/tmp/<id>`, and prints the id, then one JSON line. It opens that window behind the app in front, and passes it only the lab keys, `PATH`, and the telemetry opt-out of the shell. `run` runs one command in the lab environment. `down` stops only the processes of that lab, checks that the real core and window hold no lab text, and deletes the lab. Exit status of `up` and `down`: 0 done, 1 failed (`down` keeps the root and names the cause), 2 refused. `run` gives the status of its command, 128+n after signal n, 127 when the command cannot start, and 2 for a refused or missing lab |

- Each sub-command gives the output and the exit code of its script.
- Run a command in a checkout of the product project: the program holds the scripts, so only the
  current folder names the project. `capscore` and `root` run in each folder.
- The program needs `bun` on `PATH`: its entry starts Bun with the isolation flags. Host
  operations need the selected host CLI. After the program starts it, the named command creates
  one operation. Default control selection uses the first host in the local ordered preference,
  or Claude outside a Git checkout. An explicit `--agent` or `CELETIS_AGENT` needs no preference
  or YAML read for selection. Project commands require full valid configuration before protected work, as
  described in `docs/configuration.md`. A missing tool or invalid installation
  stops with a setup action. Codex commands require no Claude binary. The current metadata must
  explicitly mark the installation enabled; missing fields are not an old-format fallback.
- An unknown command is each name that `engine/lib/contract.ts` does not declare, also the name
  of a file of `engine/` or `scripts/` that no declared command names (for example `launcher`,
  `usage-hook`, `build`, `verify`, `install-tools`). The development scripts run only with `bun`
  (`AGENTS.md`, "Verify gate"). An unknown command prints
  `celetis: the program has no command <name>`, then
  `celetis: celetis help lists the commands`. A usage line and an unknown command end with
  `celetis: when a skill or a document gave this command, run celetis update`: a skill of another
  revision can give a command or an argument that the program does not have. A bare `celetis`
  prints the help text on stdout and exits 2, with no update hint.

## Updates

Run one command in a normal terminal:

```sh
celetis update
```

It reads three parts: the program, the Celetis plugin of Claude Code, and the Celetis plugin of
Codex. It prints one line for each part: the installed and the target revision, `up to date`,
`skipped: <reason>`, or `error: <first line>`. A host with no CLI on `PATH`, or with no Celetis,
is skipped. Then it stops with no change at the first of these:

1. A part has an error: `update: fix the errors above; nothing changed`.
2. The program is not installed: run "First install".
3. No host has Celetis: install the plugin as "Wire a product project" says.
4. The parts do not name one source, ref, and revision: it prints the source, the ref, and the
   target of each part.

It exits 6 at the first stop, and 3 at each other stop.

Two forms of one GitHub address are one source: `ddinkov10/celetis` of Claude Code, and
`https://github.com/ddinkov10/celetis.git` of Codex and of the program. Each ref resolves to its
full name, so the `HEAD` of Claude Code and the `main` of Codex and of the program are one ref,
`refs/heads/main`. When each part is at the target, the command prints
`update: Celetis is up to date at <revision>` and asks nothing.

Else it names the source and the ref, and asks `Update Celetis now? [Y/n]` one time in an
interactive terminal. Press Enter or enter `y` or `yes` to permit that exact attempt. EOF or any
other answer leaves each part unchanged. With no interactive terminal, it stops with
`update: run celetis update in an interactive terminal to review and confirm the update` and
exit status 3. No cache path, commit hash, or flag confirms an update.

After confirmation, it updates each part that is not at the target, in this order: Claude Code, Codex, and
then the program. The first failure stops the update: it prints the message,
`update: completed: <parts>`, and `update: incomplete: <parts>`, and exits 6. There is no retry:
a new attempt is a new command and a new answer. At the end it prints
`update: open a fresh session to use the updated skills`.

`celetis update check` is read-only. It prints one JSON array of the parts. An installed part
gives its folder, source, resolved ref, installed revision, and target; another part gives
`skipped` or `error`. For each host plugin at another revision than the program, it prints one
line on stderr:
`update: the program is at <12> and the <host> plugin is at <12>; run celetis update in a terminal`.
It exits 0, or 6 when a part has an error. For entry maintenance, agents run it when the person
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

The board shows a small nonmodal update dialog. **Later** defers its exact offer in the current
tab; **Update available** opens it again. **Hide progress** leaves the update running. A failed
update lists completed and incomplete parts and requires **Check again** before a new attempt.
The page reloads once after the new daemon answers with the approved revision at the same URL.
View, notification, and shortcut settings survive. If reconnect takes more than 60 seconds, the
page shows `From <main>, run celetis daemon status; when no daemon runs, run celetis daemon start`.
The update may have completed; the page does not try installation again.

Codex and Claude sessions and the daemon can stay open, except for the move of #141 below. The updater never stops their
processes or requires the Codex daemon to stop. It uses each host's native cache replacement.
A fresh session loads the updated skills and tools; old cache files are not guaranteed to remain
available to running work. Restart a session or the daemon if it still needs a resource that the
host replaced. A successful update approved in the board restarts the daemon that serves that
board: the daemon stops as `celetis daemon stop` does and starts one new process of the installed
program, which takes over the runs. The agent sessions keep running in their tabs. A
`celetis daemon stop` or a signal during that restart cancels the new process, so no daemon runs. A
daemon that runs from a checkout does not restart; the dialog shows `Update completed`. An update
approved in a terminal does not restart the daemon. After it, the board of a daemon that runs from
a version folder shows **Restart needed** within 10 seconds: the daemon runs another program than
the installed one. **Later** keeps **Restart needed** on the control. One click on **Restart** validates the installed program
and restarts the daemon on it in the same way. The terminal restart (`celetis daemon stop`, then
`celetis daemon start`) stays. A daemon that runs from a checkout never shows **Restart needed**.
This user-selected policy supersedes the
consumer-exit rule of ADR-0027; see ADR-0028 and
[ADR-0077](https://github.com/ddinkov10/celetis/blob/main/docs/adr/0077-the-master-daemon-hosts-the-board-and-restarts-as-a-successor.md).

An install or an update keeps the three newest version folders, the current one, and the folder
of the program that runs that install. A daemon that stays open through three later updates can
lose its version folder; it then prints
`daemon: the program version of this daemon was removed after an update; start the daemon again`
and exits 3. Before each new step
session, the daemon compares the revision of the plugin of the session's host with
its own revision. When they differ, it starts no session and prints
`celetis: the <host> plugin is at <12> and this program is at <12>; run celetis update, then start the daemon again`.
For the daemon, that means: run `celetis update`, restart the daemon, then send the request again.
`--resume` has no such check. So a host that updates its plugin by itself stops each new
step until `celetis update` and a restart of the daemon. The check reads the Git source of the
plugin, so an installation whose marketplace source is not Git, such as a local Codex marketplace,
cannot start a new step. After `celetis update`, restart the daemon with **Restart** in the board,
or with `celetis daemon stop`, then `celetis daemon start`; a `run` or `queue` form of another
revision refuses with exit 3 until then. The daemon serves the board, so that restart also gives the board the new
program.

**The move of #141.** The update that names the workflow, the daemon, and a run moves the state of
each repository from the old names to the new ones (`docs/workflow.md`, "The move of the old
names"). The move refuses while an old process holds the state, so before `celetis update`:

1. Run `celetis daemon stop` in each repository that has a daemon.
2. Let each session end: the step sessions, and the sessions of `celetis assist`, `intake`, and
   `visual`.
3. Close each board.

The first command after the update moves the state folder and the lock refs, and it converts the
records when a process reads them. The marker of a lane worktree moves at the next
`celetis --agent <host> worktree <n>` or `celetis --agent <host> setup lane <path>` for that
worktree. A refusal names the old owner (its PID and the issue or the lock) or both folders; end
the owner, or keep one folder by hand, then run the command again. `/celetis:setup` moves the setup record
`.claude/celetis-flow/wiring.json` to `.claude/celetis/wiring.json`.

The program runs the updater of its own version folder. When the program is broken or missing,
run "First install" again. The install refuses a link or `current` file whose version folder is
gone, and a version folder that holds another program, such as a damaged folder of the same
revision. Move the entry that the refusal names away, then run the install again. An update
rewrites no product file, and there is no automatic fallback to another updater.

The update of a host plugin serializes on the updater lock of that host's profile. Read-only
discovery holds a short shared lock and releases it before a foreground starts. A busy lock
refuses the attempt; running sessions do not reserve this mutex. The existing 120-second monotonic
deadline and descendant cleanup apply. Revalidation under that lock must match the offered home,
root, source, configured and resolved refs, installed revision, target, scope, registration, and
sibling set. A changed identity or target refuses this attempt.
Failures preserve native diagnostics and observed partial state. The update of the program holds
`<base>/.local/share/celetis/install.lock`, so a second install or update refuses while it runs. It
clones the target into a staging folder within 120 seconds, checks the source, the branch, and the
revision of the clone, and then switches the program as "First install" says.

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
2. Run `celetis update` in a terminal, and answer `y`. It moves each host plugin to the revision of
   the program. Do not run the update command of the old release.
3. In each product where you land, replace the old personal `land` rule, and an `issue` rule, with
   the rules of "Personal landing permission". Then start a fresh session.

Until the program is installed, the skills of the new release stop with the install message.

## The agent board

The board is `engine/board/` of the program, a part of its engine. It shows each agent session and
the next step of each issue, and starts a step with one press. A blocked issue has Open agent as
its main action in Now, Pipeline, details, the card menu, and search. Enter opens assistance;
Open issue remains a secondary action, and `o` still opens the issue. The master daemon of the
repository serves it: run `celetis daemon start` in a checkout of the repository, then open the URL
on its last line. `celetis daemon status` prints the URL again:

```text
daemon: board http://127.0.0.1:4403
```

With no daemon, nothing serves the board. The daemon validates the main checkout's
`.celetis.yaml` at its start, and it opens the board port before it takes over its runs. Until the
takeover ends, the board serves the page and its reads, and the daemon refuses each Run, Resume,
Retry, and queue action with `daemon: the daemon takes over its runs; send the request again after
its start`. The daemon log gets two lines: the main checkout and the URL. Each refresh reads the
issue data in the daemon process,
with the resolver and the locks of the engine and a fresh operation of the main checkout. So a
change of `gates` in the main YAML shows at the next refresh. The board checks local
change hints each second and reads the affected issues. A disappeared session also selects its
known issue. Full reads keep their five-minute schedule to recover direct GitHub edits, and a
queued full read takes priority after an active selected read. Selected reads retain the
last-full-read timestamp. No config file is made.
Only `board.port` comes from YAML at the start of the daemon; its default is 4403. Without an
effective `PORT` in the environment of the daemon, the board tries consecutive loopback ports from
that start through 65535 and keeps the first successful bind. This repository starts at 4404. A
nonzero `Number(PORT)` requests that exact port; zero or NaN means no override. Invalid effective
values retain Bun's error. An occupied exact port or an exhausted automatic range stops the start
of the daemon: `daemon start` exits 6, and the daemon log has the line of the board. Other bind
errors stop the search. The printed URL is authoritative. The listening port stays fixed until the
daemon stops. Restart the daemon (`celetis daemon stop`, then `celetis daemon start`) after a
configuration port change. For an update, follow [Updates](#updates), including resource limits
for open work. An update approved in the board restarts the daemon by itself; after a terminal
update, restart the daemon for the new board code.

The `agents` entries of the data report executable availability for Claude and Codex. Sign-in,
trust, and enabled plugin discovery need their own checks. A Run press is one request of the
daemon that serves the board: the fixed adapter `engine/board/adapter.ts` gives it to the request
dispatcher of the daemon in the same process, with the parser and the answers of a socket request.
The daemon opens the session tab, and `quiet` keeps that tab in the background:

```text
POST /run {"number":<n>,"selection":<selection>,"effort":<level>|null,"quiet":true}
```

A Run with no agent choice sends the selection `{}`, so the daemon selects from the effective
order of each step: its preferred agent when the local order includes it, then the local ordered
preference ("Agent selection and model setup"). The `CELETIS_AGENT` of the daemon does not pin
it. An explicit Run choice sends `{"explicit":"<agent>"}` and changes only
that start, also when that agent is limited. Unknown or unavailable Run choices return 409 and start
no agent. When every included agent is limited, a default Run is still accepted, and the run
waits. A Resume press sends `POST /resume {"number":<n>,"selection":{}}`, and the daemon opens the
session tab in front. The run uses the host and the exact session ID of the saved record, even
after the local order changes.

A refusal shows as the toast `Run failed` or `Resume failed` above the line of the daemon. The
card shows `Starting` while the request waits for the answer. After the answer, the card follows
the run of the press in the status of the daemon: it keeps `Starting` until the session appears,
and it shows the reason of a run that ends before a session.

At each Open agent press, the fixed adapter reads the installed program. `<command>` is its
command: `<base>/.local/bin/celetis`, or `<base>\.local\bin\celetis.cmd` on Windows ("First
install").

Open agent sends no agent choice. It opens and focuses a `#<n> assist` tab in the main checkout,
with this argv, and the command selects from the local order:

```text
<command> assist <n>
```

Switch to the Herdr app window to use the session. Starting prevents another press; the detected
session then has Go. A failed start keeps a retry. After 30 seconds without detection, check the terminal
before starting again. When the first available agent of the order is not on PATH, every included
agent is limited, or `noRun` is set, Open agent is disabled with its cause, and the server refuses
it with 409.
The server reads the issue again and refuses assistance if it is no longer blocked or has a
live session.

Make visual on a History row with no page sends no agent choice and follows the same rules. It
opens and focuses a `#<n> visual` tab in the main checkout, with this argv:

```text
<command> visual <n> <sha>
```

The page sends only the issue number; the server takes the full commit hash `<sha>` from the
History row of its last good read. The command in the tab makes the page
`docs/superpowers/visuals/<sha>.html` of the main checkout and opens it in the browser. The server
refuses a press for an issue with no History row, for a row whose page exists, while a live
`#<n> visual` tab exists, and while another Make visual press of that number runs. A failed
command leaves its message and a shell in the tab, and the row shows Making… until you close it.

Each item of an argv is one argument, and no shell reads it as a line. On macOS and Linux, a
login shell of `$SHELL` starts the argv. The tab of Open agent closes when the program exits 0,
and a failed program leaves its message there. On Windows, the board passes the argv with no shell
(not checked). When the space of the repository does not exist in the Herdr app, the first tab
that a run or a press opens makes it, and the app shows it, also for a quiet session tab. The
app starts the first tab of that space through its own login shell, so that tab keeps a shell
after its program. The program
supplies Bun and its isolation flags. Each press of Open agent or Make visual reads the program
again, so after `celetis update` the next such press uses the new program. A Run, Resume, Retry,
or queue action goes to the daemon, which runs its own program, and the board runs that program
too: after `celetis update`, a restart of the daemon loads the new program for the runs and the
board. A missing or foreign program returns 409 before any terminal starts.
Read-only `hc` calls can precede that failure.

Queue opens a dedicated view with current work above Up next. The available-issue picker sits
beside waiting work on desktop and below it on a phone. Add saves and starts an empty queue;
waiting Up/Down/Remove edits save immediately, including during a run or stop. The count includes
only current and waiting work. The Agent choice of Add is the default order or one host, and it
stays fixed while the queue is nonempty. Continue and Try again follow
fresh engine permissions. Saved/starting is distinct from a verified running session. Accepted
order survives reload and a restart of the daemon. Finished work leaves automatically. Back to board
restores Now/Pipeline; search and Go remain available.

The agent order sits in the footer. Its pill stacks the icons of the included agents in priority
order and spreads them on hover or focus. A press opens the list upward. Each row has a handle:
drag it, or press it for Move first, Move up, Move down, Move to bottom, and Exclude or Include.
Alt+Up and Alt+Down move the focused row. An excluded agent stays in the list for inclusion and for
explicit Run, and inclusion puts it last. The last included agent cannot be excluded. `First`
marks the first agent of the order; `In use` marks an agent that a live session uses. A row shows
a confirmed usage limit and its reset time, or `reset unknown`. Each change is one replacement of
the local order through `celetis agents replace`. A stale change returns the current order, which
the list shows; make the change again. A failed save restores the confirmed order and shows the
cause. While a run waits because every included agent is limited, its issue card shows
`waits for a usage limit`, and the list shows `Retry #<n>`: Retry sends that wait ID to
`celetis run retry <n> <wait id>` and starts no run. A card of a run that stopped during
such a wait shows a warning; Run starts the step again.

History opens the latest 20 distinct landed issues in the existing nonmodal side panel. The
button sits between Search and Refresh and stays visible on a phone. The count, `d`, and search
use the same panel. History starts closed on each page load, keeps its state through refresh, and
closes card details. Escape or Close returns focus to History. Below 1100 px width or 701 px
height it is a drawer. Each row links the issue and its remote trunk commit, with commit time.
`View <trunk>` opens older history. History has no Run or Resume action. A row with no page has
Make visual (Starting… while the press runs), or Making… while its `#<n> visual` tab is open. A row with a page has Open visual,
which opens the page in a new browser tab.

History uses remote default-branch evidence for both `merge` and `pr` landings. A merged lane PR
must identify the issue; its PR number is not an issue number. Issue closure alone adds nothing,
and there is no 14-day closure window. The list covers recent landings; an absent issue can have
older evidence, and a later revert can undo a listed change. History shares the existing refresh
and timeout. A read error keeps the last good cards and history and shows the error. A good
selected read clears only its own error; a good full read clears both error types. A full-read
error disables queue actions until a full read succeeds; a selected-read error alone does not.
Loading and successful empty history have separate messages.

`docs/workflow.md`, "The board", gives the data, the fixed argvs, and the card states.
[`engine/board/README.md`](https://github.com/ddinkov10/celetis/blob/main/engine/board/README.md) describes the page.
Open work may stay open. Required CLI workflow
acceptance remains open; optional desktop evidence is separate in
[Acceptance status](docs/workflow.md#acceptance-status).

## Checks

Run the checks in a checkout of this repository. No check needs model credentials or tokens.

- **The verify gate** is `scripts/verify.ts`. It classifies every tracked path, runs Biome on
  authored TypeScript, JSON and CSS, checks strict runtime/browser/native types, runs native
  actionlint, validates YAML, the plugin (`claude plugin validate plugins/celetis`), and the catalog
  (`claude plugin validate .`), checks the citations of the skills, the procedure modules, the
  principles, and the step text (`checkCitations`), checks each `celetis` form and each exit code of
  the same text against `engine/lib/contract.ts` (`checkContract`), refuses an import of a file
  directly in `engine/` from a module of `engine/lib/` or `engine/board/` (`checkImports`,
  ADR-0081), refuses a value import of a module that reads engine state in a read-side module of
  `engine/board/` (`checkImports`, ADR-0087), and compares generated bytes, and modes on macOS and
  Linux, without writes. It refuses a tracked test file and a tracked TypeScript file in
  `plugins/celetis/`. A `<plugin>/<path>`
  citation passes only when it names the tracked file `plugins/celetis/<path>`, and a relative link
  of a Markdown file in `plugins/celetis/` passes only when it names a tracked file in that folder.
  A quoted section name after a `<plugin>/<path>.md` span must equal exactly one heading of that
  file, a citation of `<plugin>/docs/<name>.md` needs such a name, and the fragment of a relative
  link must be a heading slug of its target.
  Generated JavaScript, unchanged vendor sources, and other file exemptions have exact paths and
  roles. A new unexplained path fails. Checks use bounded workers and install nothing. The last line
  is `verify: PASS`.
- **Build delivery** with exactly Bun 1.4.4. `scripts/build.ts` generates the program entry
  `celetis`, the browser bundle, the native hook modules, the help block, the command table, and the
  exit-class table of "The commands", and the act table of `plugins/celetis/docs/issue-tracker.md`,
  from `engine/lib/contract.ts`. `plugins/celetis/hooks/entry.js` embeds
  `plugins/celetis/docs/procedures/entry.md`, so an edit of that Markdown file needs a run of
  `scripts/build.ts`. `scripts/build.ts --check` fails on changed bytes, or on changed modes on
  macOS and Linux, and writes nothing. Both modes fail when a declared command has no file
  `engine/<name>.ts`, and when a file `engine/<name>.ts` other than `launcher.ts` and
  `usage-hook.ts` is no declared command. Both modes refuse an `entry.md` with a missing or renamed
  heading. `scripts/build.ts` also generates `docs/adr/index.md` from the `## Supersedes` sections
  of `docs/adr/`. Both modes refuse a repeated record number and a `## Supersedes` section that the
  build cannot resolve. Users run no build and install no package dependency; each machine installs
  the program one time ("First install").
- **The workflow** has one job, `test`, on Linux with Bun 1.4.4. It installs the pinned tools,
  then runs the verify gate.
- **The pin installer,** `scripts/install-tools.ts`, installs exact tool pins into private
  scratch and checks the actionlint archive hash; `AGENTS.md` gives its command.
- **The Herdr lab,** `scripts/herdr-lab.ts`, runs a runtime check that uses the Herdr app or the hc
  core away from the maintainer's window and core. It is not a check of the gate; `AGENTS.md`,
  "Host checks", gives its use.

```sh
BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 bun --no-env-file --no-install --config=/dev/null --no-macros scripts/build.ts
BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 bun --no-env-file --no-install --config=/dev/null --no-macros scripts/verify.ts
```

`docs/workflow.md`, "Check the harness", holds the reasons behind the facts of the gate and the
workflow.
