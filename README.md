# celetis

`celetis` is a general agent harness with required automation for Claude Code and Codex TUI/CLI.
The shared flows also allow manual or inline invocation in the Codex desktop app.
It takes a request from free text to a change on the trunk through one GitHub issue: the intent,
the lane, the spec, the plan, the
build, and the landing. The issue is the state store: each result goes onto the issue, and each
hand-off reads the issue again.

Codex remains opt-in while required CLI workflow acceptance is incomplete. Changed-pair same-child repair and final live workflows still need proof. Open sessions have
no immutable-resource or automatic skill-reload guarantee (ADR-0028). Desktop automation is optional and has separate evidence in
[Acceptance status](docs/celetis-flow.md#acceptance-status).

The repository holds:

- 29 skills: the lanes, the steps of a lane, the skills for review and memory, the engineering
  principles, and the helpers ("The skills");
- the scripts: the runner, the resolver, the landing script, the worktree script, the setup
  script, and the capability scorer ("The commands");
- the step text of the runner, `step-prompt.md`;
- the modules, in `docs/procedures/`: the shared procedures that a step of a skill reads when it
  comes ("The skills");
- the principles, in `docs/principles/`: the general engineering rules that a task reads when
  their applicability triggers match;
- the maintainer documents, in `docs/`.

The repository reaches a machine in two forms, at one revision. The program `celetis` runs each
command, also the runner and the board, and the runner gives each step session a facts header and
the step text of the program ("First install"). The plugin of each host gives its sessions the
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
| The record of setup | `.claude/celetis-flow/wiring.json` |
| The worktree setup | `worktreeSetup` in `.celetis.yaml` |
| The custom parts | `custom.<skill>` in `.celetis.yaml`, one string for each skill that needs one |
| The product facts | `AGENTS.md` |
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

- macOS or Linux for the runner. Native Windows is partly checked: the program installs from Git
  Bash and runs from Git Bash, PowerShell, and `cmd`, and its Windows checks are open. Before the
  program, a numbered runner start, the data of the board before #102, and the update lock passed
  their checks ([Acceptance status](docs/celetis-flow.md#acceptance-status)).
- The selected host CLI: Claude Code 2.1.299 or later, or Codex CLI 0.162.1 or later. The Claude
  entry hook reads the `skill.prompt` fields `source`, `pluginName`, and `path`, which came in
  2.1.299. On an older release, the hook makes no entry, and the session takes "Entry without the
  hook" of `docs/procedures/entry.md`, as on Codex. Codex 0.162.1 is the lowest release
  on which the install, the refresh, and the lookup of the plugin were checked; an older release
  is not supported. These versions are a floor, not proof of the full workflow
  ([Acceptance status](docs/celetis-flow.md#acceptance-status)).
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
  (`docs/procedures/design.md`, "The check").
- On macOS, herdr-core 0.1.16 (`hc`) and its server, for the step end of the runner and for the
  board, and the Herdr app 0.1.11 (`herdr-app`), for the tabs (ADR-0058). The host reports its
  status to herdr-core with OSC 7501 and needs no integration: Claude Code since 2.1.295, and Codex
  0.166.0. A host release that reports no status gets no step end and no session card. In another
  terminal the runner works too, but you leave each session with `/exit`.
- For the board: a Chromium browser.

`docs/celetis-flow.md` gives each requirement in full ("Requirements", and "The board").
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
  current version folder. An install replaces the link in one atomic step, so a runner or a board
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
`install: <bin> is not on PATH; add it as README.md, "First install", says`. An app that starts
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
   each folder. A session in a project that is not wired also lists the 28 skills, and a lane
   skill that starts there from free text makes a GitHub issue before it validates product setup.

   The user install is the only supported Claude install. A project install of `celetis@celetis`
   makes discovery refuse, with `Claude installation is ambiguous`. Setup writes no project
   enable of the plugin.

   The program finds the enabled plugin through native metadata (`celetis update check` and the
   check of the runner), so the two commands are necessary on each machine. It is not shown that
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
path. A local-path marketplace is unsuitable: `celetis update` and the check of the runner compare
Git revisions, and `plugin marketplace upgrade celetis` requires a Git source. With a local source,
no new runner step starts. `--ref main` selects the landed source, the branch of the program. For an unlanded check, use supported checkout loading with the existing host and authentication. These commands and result fields were checked
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
([ADR-0052](docs/adr/0052-setup-owns-required-configuration-and-host-wiring.md)). Its required set
is the selected host settings, instruction imports, the dedicated Codex restriction, required
configuration, ignore and attribute lines, and its record. It also makes missing tracker labels.
Product procedures and stores stay with their owner.

- The session asks for the issue tracker, the hosts (Claude, Codex, or both), and the landing. With
  `merge`, it also asks for the suite: a TypeScript file that `land` runs.
  Setup stops on each tracker other than GitHub. With two hosts, the session also asks for the
  default host. For the landing and the default host, the session proposes the value of
  `.celetis.yaml` when the file has one.
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
  `.codex/rules/celetis.rules`. It imports product instructions only when they exist or an approved
  baseline creates them. See [`AGENTS.md`](#agentsmd) for both relative import forms.
- Setup writes no launcher, shared entrypoint allow, project `celetis@celetis` enablement,
  generic flow section, ADR starter, or empty lesson catalog. It preserves differing Codex rules,
  copied launchers, old project enablement, and historical ownership claims. It reports old
  wiring for [owner review](#review-old-wiring); it performs no cleanup or migration. In shared
  files it adds missing required entries. The one replacement is an unchanged, recorded canonical
  Celetis marketplace entry, whose `autoUpdate` becomes false. A differing or unowned existing
  marketplace entry stays unchanged and can leave an unresolved policy warning.
- In `.celetis.yaml`, setup owns three entries: `host` (the default host, or the one host),
  `landing`, and `suite` (with `merge` only). It makes the file when there is none. In a valid file,
  it appends each missing required entry and keeps each byte of the product. When an entry has a value
  other than your answer, setup keeps that value and prints a warning. Change that field by hand
  when your answer is the intended value.
- Setup records each file and each entry that it owns in `.claude/celetis-flow/wiring.json`, so
  that a later run can tell them from the entries of the product. The schema stays 1. The record
  preserves the union of historical claims, including obsolete claims. A claim alone permits no
  replacement or removal of current content. Repeated committed runs preserve its bytes.
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

Setup adds the marketplace, Superpowers enablement, and the direct-merge denies. It adds no shared
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

Setup creates this file when it is absent and adopts an identical file without rewriting it:

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

A differing file stays unchanged, even when the old record lists it. Setup reports the required
direct-merge restriction and obsolete allows for [owner review](#review-old-wiring). That warning
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

`host` in `.celetis.yaml` selects the host of the human terminal and board commands. Setup writes
it with the default host that you choose, or with the one host. Setup does not change a `host`
that is there: to change the default host, edit `host` by hand. Check the host selection with an
explicit host:

```bash
celetis --agent codex root
```

Selection is `--agent claude|codex`, then `CELETIS_AGENT`, then `host` in the main checkout's
`.celetis.yaml`, then `claude`. An invalid value stops the command. Skills always pass their
actual host explicitly on each call, including landing. The selected host is exported to child scripts. Both installed
hosts can use one product project; their installations and configuration remain separate.

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

Complete the host's normal trust flow before a run. The runner reports startup dialogs and leaves
them for the human.

### The config, the worktree setup, and the custom parts

Operational settings and setup are fields of `.celetis.yaml` (`docs/configuration.md`).
Commands that need repository setup require this file and stop if it is missing or invalid.
`/celetis:setup` makes the file with `host`, `landing`, and, with `merge`, `suite` when there is
none. It adds a missing
`host` at the end of a valid file, or it stops when the file cannot take the line. After your yes,
it adds a missing `worktreeSetup` as a quoted file reference at the end of the file, for example
`worktreeSetup: "scripts/worktree-setup.ts"`; a new file holds `host`, `landing`, `suite` with
`merge`, and then the reference. The value must read back exactly and each other value must stay
the same. Else setup stops before any write, for example on a file with a `...` end marker: add
the field by hand first. `try` and `write --setup-file <path>` require the entry in local trunk
HEAD, with an unchanged index and working file. An existing different value, including `""`,
stays unchanged and prints `setup: warning: .celetis.yaml: worktreeSetup differs from the requested setup reference; setup leaves it`.
Change that field by hand when the approved reference is intended. Setup
changes no field that is there. Each other field stays by hand.

| Field or file | What it holds | When omitted |
|---|---|---|
| `landing` | Required `pr` or `merge`. `pr` squash-merges a PR when each check is green. `merge` creates one squash commit on the trunk, with no PR. A project with no PR check uses `merge` | The command exits 2 |
| `suite` | A relative path of a TypeScript file in the checkout. `land` runs it in the lane, with no argument, at the tip that it lands; exit status 0 is a pass. Required with `merge`, refused with `pr` | With `merge`, the command exits 2 |
| `gates` | A mapping from the seven step names to `me` or `auto` | Each omitted step is `me` |
| `worktreeSetup` | A root-relative `.ts` file reference, for example `"scripts/worktree-setup.ts"`, or exactly `""` | No setup |
| `board.port` | The board port ("The agent board") | 4403 |
| `codexProfiles.<runtime>` | Four ordered model slots and the reviewer minimum for that dispatch surface | Each Codex child keeps the parent's model |
| `custom.<skill>` | An addition to the skill procedure | No addition |

- **Operational settings** come from the main checkout, including when a command starts in a
  lane or subfolder. `celetis --agent <host> land` moves the trunk of the main checkout; after a merge by
  other means, or after its line `land: the main checkout did not move`, run `git pull` there.
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
  diagnostic lane; `worktree` and `setup lane` map setup failure to status 1. The command writes
  the marker only after a nonempty reference succeeded, including a zero-byte file. With exactly `""` or missing
  `worktreeSetup`, the command writes no marker. Each later entry reads the lane config again, so
  a reference that a merge of the trunk brings runs at the next entry. Source edits do not
  invalidate a marker. `celetis --agent <host> setup lane <path>` selects the main reference,
  clears the old marker before file validation, and runs the target lane file. Every entry still checks the lane
  config (`docs/celetis-flow.md`).
- **A custom part** is the parsed string `custom.<skill>` in `.celetis.yaml`: an addition to that
  one skill, which reaches only its own invocation. `chore` does not apply `custom.implement`, and
  `lesson-review` does not apply `custom.lesson`. A product fact that two or more skills need, for
  example a landing rule that both `implement` and `chore` follow, or the lesson tags of the
  project, goes into the `AGENTS.md` of the project ("`AGENTS.md`"). At entry, the skill reads the
  whole config once from the active checkout through the permission-checked file access of the host
  and applies only its own string (ADR-0013, ADR-0015, and ADR-0047). On Claude, the native entry
  hook makes that read, parses the file, and puts the string into its facts block. On Codex, the
  session follows "Entry without the hook" of `docs/procedures/entry.md`: with a shell it runs the
  config reader, else it reads the file with a dedicated reader. Entry runs no setup. A runner step
  starts in the main checkout; a later skill entered in a lane reads that lane's config. Each
  invocation is its own entry, also a same-session handoff and an invocation in a child agent.
  Missing checkout, config, or custom text gives no addition; an invalid, ambiguous, unreadable,
  or denied config stops entry. A denied read has no alternate path. The text is an addition: it
  cannot remove a rule of the general skill (ADR-0006). `custom.hotfix` holds the project's ship
  acts. Keep literal block text and parsed trailing newlines intact (`docs/configuration.md`).

`docs/celetis-flow.md` holds these parts in full ("Gates", and "The config and the custom parts").

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
- `docs/lessons/_pending/` holds the lesson drafts that wait for `lesson-review`.

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

Setup creates no generic flow section. Product instructions stay by hand, except for an approved
baseline section. With no product instructions and no approved baseline, setup creates no
`AGENTS.md`. The entry contract holds the runner-start rule. Lane handoffs and the workflow
resolver enforce the sequence; the landing procedure and engine enforce landing. These generic
rules need no generated copy in product instructions.

The plugin has no role for the deployment of a project. It is a product fact, so it also goes into
`AGENTS.md` when more than one step needs it: a lane ends when the change is on the trunk.

With Claude selected and product `AGENTS.md` present, setup adds the correct relative import to
each existing regular Claude instruction file: `@AGENTS.md` in root `CLAUDE.md`, and
`@../AGENTS.md` in `.claude/CLAUDE.md`. Imports resolve from the containing file
([Claude Code memory documentation](https://code.claude.com/docs/en/memory), latest documentation
read on 2026-10-29). Setup creates no Claude instruction file just for an import. A wrong existing
import stays unchanged and gets an exact manual action. Generated imports do not prove native
loading.

Setup preserves supported instruction links without a write through a link. A Claude instruction
file that links to `AGENTS.md` needs no import. When `AGENTS.md` links to a regular root or nested
Claude instruction file, an approved baseline goes into that real in-project file. Setup adds no
self-import. An unrelated instruction link stays unchanged and gets an owner-review warning.

### The stores

Setup creates no store, starter README, template, or empty catalog. Store writers create only the
paths that their first record needs:

- `record-architecture-decisions` reads generic guidance and the template from the plugin, plus
  product policy named by `AGENTS.md`. It creates `docs/adr/` with the first numbered record.
  Existing product ADR guidance and templates remain product content.
- An approved review by `lesson-review` creates `docs/lessons/` and its catalog when needed.
  The catalog has one row for each active lesson. Superseded records remain as history.
  A new catalog has this head:

  ```markdown
  # Lessons

  | Lesson | Tags | Date | Summary |
  |---|---|---|---|
  ```

- Capture creates only a pending proposal and queue row in the main checkout's
  `docs/lessons/_pending/`, also when the task runs in a linked worktree. It creates no live
  catalog. Rejected records stay in `_pending/_rejected/`. Grounding reads active lessons from
  the lane's own checkout with `lesson-store read active`. A plan copies each applicable active
  rule with its path and digest. Each task and repair boundary, including the final review and
  re-entry, refreshes those copies from the task checkout: changed rules replace old copies, and
  superseded or retired rules drop out. A missing lesson or a rule that conflicts with the
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
  Reads of the main checkout's lessons take the same lock. An incomplete
  `_pending/.transaction.json` blocks reads until `lesson-store recover` completes the recorded
  operation. Recovery refuses conflicting bytes. Old-format records need explicit review.
- `lesson-review` can promote, edit, merge, supersede, retire, or reject selected records. It
  shows the exact snapshot before approval; changed inputs require a new review. Each result
  keeps its origins, incident evidence, uncertainty, and review history. The command leaves the
  Git index unchanged. Review commits only approved lesson paths when project policy permits it.

An existing unreadable or malformed store is an error. Its failed read is not an absent store.
Existing records, catalogs, guidance, and templates stay unchanged unless the relevant writer or
owner explicitly changes them.

### Review old wiring

Setup reports old wiring but preserves its content and historical ownership. Review only the
active product checkout. Installation and update remain separate explicit operations.

1. Read `.claude/celetis-flow/wiring.json` and inspect the current file for every reported entry.
   For each proposed removal, show the old record, the actual diff, and the remaining callers.
   A historical claim records earlier intent; it gives no authority over current content. Missing
   or ambiguous evidence authorizes no deletion.
2. Review these candidates against the required forms above:

   - Copied `scripts/celetis` launchers and every caller in scripts, CI, instructions, permissions,
     and board configuration. Move an approved caller to the installed `celetis` program before
     removing the launcher. Keep product additions until their owner has reviewed them.
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
     entries. The terminal command remains `celetis --agent <host> board`.
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

3. The owner approves each exact removal and caller change. Remove only those reviewed entries
   and their obsolete ownership claims in the same product change. Keep product-specific flow
   instructions and every unreviewed entry. Remove an empty generic heading only when its whole
   section was reviewed. Existing generic ADR files stay unless their owner reviews them
   independently. Commit and review the complete diff together; run setup again only after the
   product tree meets its preflight requirements.

There is no cleanup command or automated rewrite. The optional local desktop configuration below
stays local product content. A `setup: no file changed` line describes only the diff. With any
unresolved wiring or policy warning, it establishes neither current wiring nor native policy
loading. Keep the exact warning and its manual action in the setup report.

### Optional: the board in Claude desktop

Use a personal, untracked `.claude/launch.json` in the main checkout. For a new file, put that
path in `.git/info/exclude`. If the project already tracks the file, keep its shared content and
use the terminal start. Add the example entry to the local file's `configurations` array.

Replace `<command>` with the absolute path of the program command: `<base>/.local/bin/celetis`, or
`<base>\.local\bin\celetis.cmd` on Windows ("First install"). Write it as JSON data, with no shell
quotes inside the value. Keep the resolved machine path local. The native preview port must match
`board.port` in `.celetis.yaml`:

```json
{
  "name": "board",
  "runtimeExecutable": "<command>",
  "runtimeArgs": ["--agent", "claude", "board"],
  "port": 4403
}
```

The program needs `bun` on the `PATH` of the desktop app: its entry sets the isolation of Bun.
The [desktop field contract](https://code.claude.com/docs/en/desktop#configuration-fields) keeps
the executable and the argument array separate. The historical marker-only
contract check covered those data boundaries; native desktop launch remains UNRUN
(`docs/celetis-flow.md`, "Limits"). The terminal start has separate acceptance evidence.

### The wiring on the trunk

The wiring must be on the trunk of `origin` before the first lane. A lane branch starts at the trunk
of `origin`, so a file that is not there is in no lane worktree: `.celetis.yaml`,
including a custom part and the worktree setup. A file that git does not track also makes the main
checkout dirty, and the resolver then stops each issue.

Setup stops before any write when the index holds a staged change, or when a current setup path
has an uncommitted change. Obsolete launchers and starter documents are outside the setup commit
set. Setup commits only its current eligible changed paths. An old ownership claim adds no path
to that set. After a failed write, the report shows the failing path, `git status --short`, the
diff of each changed setup path, and every new setup file in full. Partial writes stay for review;
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
[Acceptance status](docs/celetis-flow.md#acceptance-status).

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
  puts that tip on the trunk as one squash commit, with no PR.
- The other lanes are shorter. `/celetis:bug` finds the root cause, posts it as a `## Root cause`
  comment, and hands on to `plan`. `/celetis:chore` makes a change with no change of behavior: it
  verifies, commits, and lands in one session. `/celetis:hotfix` fixes broken production in one
  session, and it ends with the ship acts of the project. When its landing stops, it prints your
  checklist: remove `ready-for-human` first, because `land` refuses while the label is on, then
  run `land` in your own shell, then do the ship acts. A request that spans some independent
  features becomes an epic, and each child issue runs its own flow.

**Through the runner.** `celetis --agent <host> celetis-flow <n>` starts the next step of the issue in a
new interactive session, in the terminal tab where you start it. For each step, the runner:

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
   (`docs/celetis-flow.md`, "Start the script", "The effort level");
4. in an hc terminal of herdr-core, ends the session when the issue shows that the step is done.

The runner starts at an issue: write one with `/celetis:intake`, or open one on GitHub. Then, for
the feature `#12`:

```bash
celetis --agent <host> celetis-flow 12    # triage
celetis --agent <host> celetis-flow 12    # specify: the session asks, and it waits for your approval of the design
celetis --agent <host> celetis-flow 12    # plan
celetis --agent <host> celetis-flow 12    # implement: it builds, verifies, and lands
```

With each gate `me`, one start runs one step. With a gate `auto`, a start goes on through that step
by itself, and `celetis --agent <host> celetis-flow` with no number is the automatic runner: it runs each
`auto` step of each open issue. A Run press on the agent board is the same start, in a new herdr
tab.

The queue stays available as issues finish. Read its current identity before an action:

```sh
celetis --agent <host> celetis-flow --queue status
celetis --agent <host> celetis-flow --queue action '{"kind":"add","number":12,"step":"plan","expected":{"id":null,"revision":0,"current":null}}'
```

The example adds to missing storage; for an existing record use the ID, revision, and current
issue from status. Add starts an empty queue and appends otherwise. Move and remove affect only
waiting work. The host stays fixed while nonempty. Every later me gate requires Continue.
Retry recovers an interrupted launch or stopped step; a null step acknowledges terminal work
without authorizing another issue. Only fresh finished/wontfix decisions drain work. Read failures
retain accepted work. The same empty queue accepts more work without reset or reload.

The record remains at `<git common dir>/celetis-flow/queue.json`, now schema 2. Old batch forms
and compatibility readers are removed. See `docs/celetis-flow.md`, "The continuous queue", for
the action fields, locking, and manual recovery of an obsolete record. Preserve that file until
its runner and foreground exit and an explicitly authorized archive retains its unfinished order.

A step session follows the step text: it asks only for a decision that the issue does not hold, and
at a stop it puts the reason on the issue and adds `ready-for-human`. The `specify` session has no
step text: it waits for your approval of the design, as a session by hand does.

`docs/celetis-flow.md` holds the runner in full. `docs/issue-tracker.md` holds the labels, what
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
| | [`/celetis:lesson`](skills/lesson/SKILL.md) | Captures bounded evidence from corrections or failed repairs as pending proposals in the main checkout, including explicit save requests |
| | [`/celetis:lesson-review`](skills/lesson-review/SKILL.md) | Your exact review of pending drafts or maintenance of selected active lessons |
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
| | [`/celetis:accept-epic #<n>`](skills/accept-epic/SKILL.md) | Checks current parent acceptance and completes an epic when its evidence and children permit it. Only you can start it; it creates no lane or runner |
| | [`/celetis:assist #<n>`](skills/assist/SKILL.md) | Completes permitted work for the current block, records verified completion, and clears the hold. It asks for missing human contributions and leaves continuation to the normal runner |
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
no principle catalog. `docs/capability.md`, the rubric of the capability score, and the other
maintainer references keep their existing role. The `AGENTS.md` of this repository, "Where
agent text lives", gives the placement rule (ADR-0047 and ADR-0050).

Each principle is also a native skill. An ordinary engineering task can select it or invoke it
by name without an issue, a lane, or project configuration. The normal entry contract applies.
Each invocation reads its one canonical rule file.

`guide`, `setup`, `create-verification`, and `maintain-verification` are explicit-only on both
hosts. Claude reads `disable-model-invocation: true`;
Codex reads `policy.allow_implicit_invocation: false` in each skill's
`agents/openai.yaml`. Guide reads its custom part and gives advice; it starts no
workflow command. Setup runs `celetis --agent <host> setup` in the main checkout, and it enters no
lane worktree.

## The commands

A product project runs each command through the installed program `celetis` ("First install").
`celetis help` prints the commands that a person types:

<!-- scripts/build.ts writes this block from engine/lib/help.ts. Edit that file, then run scripts/build.ts. -->
```text
usage: celetis [--agent <host>] <command> [<argument>...]

  celetis update                                            Updates the program and the plugin of each host; asks once.
  celetis update check                                      Shows the installed and the available revision of each part.
  celetis board                                             Starts the board of the project in this checkout.
  celetis intake                                            Starts a fresh session that asks for your request before intake.
  celetis assist <n>                                        Starts fresh interactive assistance for an issue in the main checkout.
  celetis celetis-flow                                      Starts the automatic runner.
  celetis celetis-flow <n>                                  Starts the next step of one issue, then follows its auto gates.
  celetis celetis-flow <n> --effort <level>                 Starts the next step of one issue at another effort level, this start only.
  celetis celetis-flow --resume <n>                         Opens the session of a step with no progress again.
  celetis celetis-flow --queue action '<QueueAction JSON>'  Saves a queue action; starts its authorized wake in this foreground.
  celetis celetis-flow --queue status                       Reads the current queue and its allowed actions.
  celetis lesson-store read main|active                     Reads validated lessons; requires explicit --agent.
  celetis lesson-store capture FILE                         Saves a pending proposal; requires explicit --agent.
  celetis lesson-store preview FILE                         Prepares an exact lesson review; requires explicit --agent.
  celetis lesson-store apply SNAPSHOT DIGEST                Applies the reviewed snapshot; requires explicit --agent.
  celetis lesson-store recover                              Completes an interrupted lesson write; requires explicit --agent.
  celetis root                                              Prints the folder of the program.
  celetis --version                                         Prints the revision of the program.
  celetis help                                              Prints this list.

In a terminal, --agent claude|codex is optional. With no --agent, the program uses host in
.celetis.yaml, else claude.
The skills run the other commands. README.md, "The commands", in the folder that celetis root
prints, lists all of them.
```
<!-- The end of the block that scripts/build.ts writes. -->

Each skill call names its host with `--agent claude` or `--agent codex` before the sub-command, as
the table shows. In a terminal, a person can omit `--agent <host>` ("Agent selection and model
setup"):

| Command | What it does |
|---|---|
| `celetis --agent <host> lesson-store read main\|active` | Returns validated lesson records, exact file contents, digests, and the resolved checkout as JSON. `main` includes pending and rejected data. Rejected records appear in `history` with `status: pending-review`; they are not past guidance. `active` reads the task checkout and ignores its pending folder |
| `celetis --agent <host> lesson-store capture FILE` | Reads typed `{schema:1,candidate,expected,name,description,tags,date,source,incidents,body}` JSON and builds the pending record; `expected` is the pending SHA-256 or null for creation. An extension keeps the stored incidents and reviews. Saves pending evidence only. Equal incident replays are unchanged; stale updates are refused |
| `celetis --agent <host> lesson-store preview FILE` | Reads a review request and returns its exact before/after contents, watched digests, and snapshot digest without lesson writes. Select pending UUIDs and complete resulting documents as defined in [the lesson format](docs/procedures/lesson-format.md) |
| `celetis --agent <host> lesson-store apply SNAPSHOT DIGEST` | Recomputes the review and applies exactly the approved snapshot under the lock. Changed input or snapshot bytes are stale. Replaying the same review is unchanged; conflicting reuse of its ID is invalid. The digest identifies a version, not its reviewer |
| `celetis --agent <host> lesson-store recover` | Completes the one journal under the lesson lock. These commands require Git and an explicit host, but no issue, runner, or configuration file. They preserve the Git index. Exit status: 0 success, 2 invalid input/store, 3 stale or busy, 6 access/I/O/recovery block |
| `celetis --agent <host> celetis-flow <n> --effort <level>` | Starts the next step of the issue at `low`, `medium`, `high`, `xhigh`, or `max` instead of its decided or default level, for the first session of this start only. Each later step uses its own decision, and the flag writes no decision. It needs exactly one issue number; any other form exits 2 with the usage line |
| `celetis --agent <host> celetis-flow --queue admit '<QueueAction JSON>'` | Internal finite admission for the board. Persists one validated action and returns a strict QueueReceipt without waiting for a session |
| `celetis --agent <host> celetis-flow --queue run <id> <token>` | Internal foreground claim of a persisted wake. Refuses stale tokens and live owners, then follows the queue's gates |
| `celetis --agent <host> intake` | Starts a fresh interactive session in the main checkout. It asks “What would you like to work on?” and waits. After an answer, it enters `celetis:intake` with that request. It creates no issue before the answer and does not start the runner |
| `celetis --agent <host> assist <n>` | Starts fresh interactive assistance for the issue in the main checkout. It completes permitted work for the current block and uses `issue <n> assisted <file>` for verified completion and hold removal. It asks for missing human contributions, then reports the actual next step. It does not start or resume the runner or land |
| `celetis --agent <host> worktree <n>` | Makes the lane worktree and the branch of the issue, or enters the one that is there and brings it up to the trunk, and prints its path |
| `celetis --agent <host> worktree --remove <n>` | Removes the lane worktree and the branch of an issue that ended with no landing by the script. It refuses while the issue is open and its branch has no merged PR, so close the issue first |
| `celetis --agent <host> land <n> '<subject>'` | Lands the change of the issue by the `landing` field of `.celetis.yaml`. It is the one landing path of an agent. It refuses an issue that is not ready to land. Exit status: 0 landed, 1 internal error, 2 usage, 3 prerequisite, 4 repair, 5 checks, 6 blocked, 7 landed with a stopped cleanup (run it again), 128+n signal |
| `celetis --agent <host> issue <n> <act>` | Makes each workflow write that the engine reads: `route <lane>`, `effort <step> <level> <file>`, `epic <file>`, `complete-epic [file]`, `needs-info <file>`, `wontfix <file>`, `spec <file>`, `root-cause <file>`, `plan <file>`, `built`, `before-landing <file> [--during-the-build]`, `landing-refused <file>`, `stopped <file>`, `ready-for-human`, `assisted <file>`. The assistance act records an attributed `## Human steps done` report before removing present blocking labels; it adds no label and preserves build state. Lifecycle acts write the comment heading before label changes. Each act refuses unmet prerequisites. `state` writes nothing and prints lifecycle facts. `epic-state` writes nothing and prints the current declaration, child snapshot, history, and holds. Epic definition writes preserve the complete parent body; guarded completion publishes its accepted record before closing and leaves readiness labels unchanged. `docs/issue-tracker.md`, "Conventions", gives each act. Exit status: 0 done, 1 internal error, 2 usage, 3 prerequisite, 6 blocked |
| `celetis --agent <host> next-step <n> \| --open` | The resolver: the next step of one issue, or of each open issue |
| `celetis --agent <host> capscore J V B N S X` | Resolves the six digits. `--json` gives portable scores and the host pair. With a Codex profile, it selects the profile by live runtime identity and needs `--runtime-models`; with no Codex profile, `dispatch.model` is null |
| `celetis --agent <host> dispatch <act>` | Acts: `next`, `report <dispatch-id> <report-file>`, `gate`, `review`, `close`, `show`. The task loop applies each returned pair and reports exact native arguments/results. Evidence is agent-reported, not independently checked. Records: `/tmp/celetis-<uid>/dispatch/<host>-<session>.json` on macOS and Linux; `<os.tmpdir()>/celetis/dispatch/<host>-<session>.json` on Windows. Exits: 0 ready, reported, or closed (also `show`), 1 internal error, 2 usage, 3 refused, 4 stop, 5 setup |
| `celetis install` | Installs the revision of the clean checkout that it runs from as the program ("First install"); takes no arguments |
| `bun --no-env-file --no-install --config=/dev/null --no-macros scripts/build.ts [--check]` | Builds the delivery with exactly Bun 1.4.4, or compares generated bytes, and modes on macOS and Linux, without writes |
| `bun --no-env-file --no-install --config=/dev/null --no-macros scripts/verify.ts` | Runs this plugin repository's fast gate in its checkout |
| `bun --no-env-file --no-install --config=/dev/null --no-macros scripts/install-tools.ts DESTINATION [--claude]` | Installs pinned development tools into a private destination |
| `celetis --agent <host> setup check \| write ... \| try ... \| try --remove \| lane <path> \| push` | The deterministic part of `/celetis:setup`: the checks, the write of the wiring, the test lane (`try` makes it and runs the worktree setup there, and `try --remove` removes it), the run of the worktree setup in a lane that exists (`lane`), and the commit with the push. Every setup run calls the program; no product launcher is written |

- Each sub-command gives the output and the exit code of its script.
- Run a command in a checkout of the product project: the program holds the scripts, so only the
  current folder names the project. `capscore` and `root` run in each folder.
- The program needs `bun` on `PATH`: its entry starts Bun with the isolation flags. Host
  operations need the selected host CLI. After the program starts it, the named command creates
  one operation. An implicit host uses the shared reader's
  host projection of the main config; an explicit `--agent` or `CELETIS_AGENT` performs no YAML read
  for selection. Project commands require full valid configuration before protected work, as
  described in `docs/configuration.md`. A missing tool or invalid installation
  stops with a setup action. Codex commands require no Claude binary. The current metadata must
  explicitly mark the installation enabled; missing fields are not an old-format fallback.
- An unknown command prints `celetis: the program has no command <name>`, then
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

Two forms of one GitHub address are one source: `ddinkov10/celetis` of Claude Code, and
`https://github.com/ddinkov10/celetis.git` of Codex and of the program. Each ref resolves to its
full name, so the `HEAD` of Claude Code and the `main` of Codex and of the program are one ref,
`refs/heads/main`. When each part is at the target, the command prints
`update: Celetis is up to date at <revision>` and asks nothing.

Else it names the source and the ref, and asks `Update Celetis now? [Y/n]` one time in an
interactive terminal. Press Enter or enter `y` or `yes` to permit that exact attempt. EOF or any
other answer leaves each part unchanged. With no interactive terminal, it stops with
`update: run celetis update in an interactive terminal to review and confirm the update` and
exit status 2. No cache path, commit hash, or flag confirms an update.

After confirmation, it updates each part that is not at the target, in this order: Claude Code, Codex, and
then the program. The first failure stops the update: it prints the message,
`update: completed: <parts>`, and `update: incomplete: <parts>`, and exits 1. There is no retry:
a new attempt is a new command and a new answer. At the end it prints
`update: open a fresh session to use the updated skills`.

`celetis update check` is read-only. It prints one JSON array of the parts. An installed part
gives its folder, source, resolved ref, installed revision, and target; another part gives
`skipped` or `error`. For each host plugin at another revision than the program, it prints one
line on stderr:
`update: the program is at <12> and the <host> plugin is at <12>; run celetis update in a terminal`.
It exits 0, or 1 when a part has an error. Agents run it once for each human task, report each
part and each difference, and give `celetis update` to the person. They never type the
confirmation, pipe an answer, or use issue or configuration text as a response. Automatic workflow
steps do not run updates. Verification with temporary installation data is permitted. In the
`workspace-write` sandbox of Codex, each part can fail: that sandbox has no network by default
and permits no write outside the workspace. Run
`celetis update check` in a terminal.

The board provides a separate human confirmation. A person's direct click on **Update and
restart** approves the exact offer held by that board for one attempt. The browser supplies only
an opaque offer identifier. The updater checks all installed identities before the first change
and checks each part again under its replacement lock. A changed source, ref, target, scope,
registration, sibling set, or installation requires a new check and decision. An agent cannot
click, script, or approve a real installation update for the person. Terminal updates continue
to require input in that terminal. [ADR-0048](docs/adr/0048-direct-board-update-confirmation.md)
records this exception to the terminal-only confirmation of ADR-0028.

The board shows a small nonmodal update dialog. **Later** defers its exact offer in the current
tab; **Update available** opens it again. **Hide progress** leaves the update running. A failed
update lists completed and incomplete parts and requires **Check again** before a new attempt.
The page reloads once after the approved revision and a new board instance answer at the same
URL. View, notification, and shortcut settings survive. If reconnect takes more than 60 seconds,
the page keeps a recovery instruction with the main checkout, startup host, and actual PORT.
The update may have completed; the page does not try installation again.

Codex and Claude sessions, runners and boards can stay open. The updater never stops their
processes or requires the Codex daemon to stop. It uses each host's native cache replacement.
A fresh session loads the updated skills and tools; old cache files are not guaranteed to remain
available to running work. Restart a session or board if it still needs a resource that the host
replaced. A successful update approved in the board restarts only that board. An update approved
in a terminal keeps the manual board restart. This user-selected policy supersedes the
consumer-exit rule of ADR-0027; see ADR-0028.

A runner or a board that runs keeps the version folder of its program. Before each new step
session, the runner compares the revision of the plugin of the session's host with its own
revision. When they differ, it starts no session and prints
`celetis: the <host> plugin is at <12> and this program is at <12>; run celetis update, then start the runner again`.
`--resume` has no such check. So a host that updates its plugin by itself stops each new runner
step until `celetis update`. The check reads the Git source of the plugin, so an installation
whose marketplace source is not Git, such as a local Codex marketplace, cannot start a new runner
step. The board starts the command of the installed program at each press, so after
`celetis update` its next Run starts the new program.

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

Claude keeps its native installation scope. It writes a private catalog with the approved source
and exact target SHA, then temporarily registers that catalog and its matching inline source for
one native update. It restores the complete saved marketplace entry locally before it removes the
catalog and releases the lock, including after a native failure, timeout or interruption. User and
project settings stay unchanged. If restoration fails, the error includes the observed native state.
The updater keeps the catalog and reports its path if the registration still points to it or cannot
be read. Repair the native registration before removing that retained catalog or making a new attempt.
Codex uses command-only overrides
for the selected source and exact target. Its whole-marketplace operation refuses other configured
or listed plugins in the Celetis marketplace, including disabled or pending siblings. Other
marketplaces are unchanged. Both paths validate fresh enabled discovery and the full installed
revision. Product configuration, authentication and unrelated plugin policies remain unchanged.
Owned Claude wiring continues to disable Celetis background updates. A successful update starts
no workflow.

**The cutover from the release before #126.** That release ran each command through the long
entry form of the installed plugin. On each machine:

1. Run "First install".
2. Run `celetis update` in a terminal, and answer `y`. It moves each host plugin to the revision of
   the program. Do not run the update command of the old release.
3. In each product where you land, replace the old personal `land` rule, and an `issue` rule, with
   the rules of "Personal landing permission". Then start a fresh session.

Until the program is installed, the skills of the new release stop with the install message.

## The agent board

The board is `engine/board/` of the plugin, a part of its engine. It shows each agent session and
the next step of each issue, and starts a step with one press. A blocked issue has Open agent as
its main action in Now, Pipeline, details, the card menu, and search. Enter opens assistance;
Open issue remains a secondary action, and `o` still opens the issue. Start it in the main
checkout or one of its subfolders, then open the URL on its last line:

```bash
celetis --agent <host> board
PORT=4500 celetis --agent <host> board
```

The command takes no arguments. It validates the main checkout's `.celetis.yaml` and refuses a
lane start before it starts the board. The start prints two lines: the main checkout and the
URL. Each refresh reads the issue data in the board process,
with the resolver and the locks of the engine and a fresh operation of the main checkout. So a
change of `host` or `gates` in the main YAML shows at the next refresh. No config file is made.
Only `board.port` comes from YAML at the start; its default is 4403. `PORT` overrides it. This
repository uses 4404, so its board can run beside a board on 4403. Restart the board after a port
change. For an update, follow [Updates](#updates), including resource limits for open work,
and start the board again for its new code.

The `agents` entries of the data report executable availability for Claude and Codex. Sign-in,
trust, and enabled plugin discovery need their own checks. At each Run, Resume, or Open agent
press, the fixed adapter `engine/board/adapter.ts` reads the installed program. `<command>` is its command:
`<base>/.local/bin/celetis`, or `<base>\.local\bin\celetis.cmd` on Windows ("First install"). A
Run press starts this argv, with the selected agent, in a new quiet tab of the Herdr app:

```text
<command> --agent <agent> celetis-flow <n>
```

With no explicit choice, it uses `defaultAgent`: `CELETIS_AGENT`, then `host` in the main
YAML, then `claude`. Set the project default in that YAML field. A Run choice changes only that
start. The board's default-agent menu and command palette show `Default agent is read-only`.
They show the reason: `The main .celetis.yaml controls the default agent. Change host there.`
Unknown or unavailable Run choices return 409 and start no agent. A Resume press starts this argv
in a focused tab. The runner uses the host and the exact session ID of the saved record, even
after the YAML default changes:

```text
<command> celetis-flow --resume <n>
```

Open agent uses the current default agent without an agent choice. It opens and focuses a
`#<n> assist` tab in the main checkout, with this argv:

```text
<command> --agent <agent> assist <n>
```

Switch to the Herdr app window to use the session. Starting prevents another press; the detected
session then has Go. A failed start keeps a retry. After 30 seconds without detection, check the terminal
before starting again. An unavailable default agent or `noRun` disables Open agent with its cause.
The server reads the issue again and refuses assistance if it is no longer blocked or has a
live session.

Each item of an argv is one argument, and no shell reads it as a line. On macOS and Linux, the
tab starts the argv in a login shell of `$SHELL`; the tab closes when the program exits 0, and a
failed program leaves its message there. On Windows, the board passes the argv with no shell (not
checked). When the space of the repository does not exist in the Herdr app, the first press makes
it and shows it, also for a quiet Run. The app starts the first tab of that space through its own
login shell, so that tab keeps a shell after the step. Each later press is quiet. The program
supplies Bun and its isolation flags. Each press reads the program again, so after
`celetis update` the next press starts the new program with no board restart; new board code still
needs a restart. A missing or foreign program returns 409 before any terminal starts.
Read-only `hc` calls can precede that failure.

Queue opens a dedicated view with current work above Up next. The available-issue picker sits
beside waiting work on desktop and below it on a phone. Add saves and starts an empty queue;
waiting Up/Down/Remove edits save immediately, including during a run or stop. The count includes
only current and waiting work. The host stays fixed while nonempty. Continue and Try again follow
fresh engine permissions. Saved/starting is distinct from a verified running session. Accepted
order survives reload and board restart. Finished work leaves automatically. Back to board
restores Now/Pipeline; search and Go remain available.

History opens the latest 20 distinct landed issues in the existing nonmodal side panel. The
button sits between Search and Refresh and stays visible on a phone. The count, `d`, and search
use the same panel. History starts closed on each page load, keeps its state through refresh, and
closes card details. Escape or Close returns focus to History. Below 1100 px width or 701 px
height it is a drawer. Each row links the issue and its remote trunk commit, with commit time.
`View <trunk>` opens older history. History has no Run or Resume action.

History uses remote default-branch evidence for both `merge` and `pr` landings. A merged lane PR
must identify the issue; its PR number is not an issue number. Issue closure alone adds nothing,
and there is no 14-day closure window. The list covers recent landings; an absent issue can have
older evidence, and a later revert can undo a listed change. History shares the existing refresh
and timeout. A read error keeps the last good cards and history and shows the error; recovery
clears it. Loading and successful empty history have separate messages.

`docs/celetis-flow.md`, "The board", gives the data, the fixed argvs, and the card states.
[`engine/board/README.md`](engine/board/README.md) describes the page.
Open work may stay open. Required CLI workflow
acceptance remains open; optional desktop evidence is separate in
[Acceptance status](docs/celetis-flow.md#acceptance-status).

## Checks

Run the checks in a checkout of this repository. No check needs model credentials or tokens.

- **The verify gate** is `scripts/verify.ts`. It classifies every tracked path, runs Biome on
  authored TypeScript, JSON and CSS, checks strict runtime/browser/native types, runs native
  actionlint, validates YAML and the plugin, checks the citations of the skills, the procedure
  modules, the principles, and the step text (`checkCitations`), and compares generated bytes,
  and modes on macOS and Linux, without writes. It refuses a tracked test file. Generated
  JavaScript, unchanged vendor
  sources, and other file exemptions have exact paths and roles. A new unexplained path fails.
  Checks use bounded workers and install nothing. The last line is `verify: PASS`.
- **Build delivery** with exactly Bun 1.4.4. `scripts/build.ts` generates the program entry
  `celetis`, the browser modules, the native hook modules, and the help block of "The commands"
  from `engine/lib/help.ts`. `engine/hooks/entry.js` embeds `docs/procedures/entry.md`, so an edit
  of that Markdown file needs a run of `scripts/build.ts`. `scripts/build.ts --check` fails on
  changed bytes, or on changed modes on macOS and Linux, and writes nothing. Both modes fail when a
  command of the help list has no file `engine/<name>.ts`. Users run no build
  and install no package dependency; each machine installs the program one time ("First install").
- **The workflow** has one job, `test`, on Linux with Bun 1.4.4. It installs the pinned tools,
  then runs the verify gate.
- **The pin installer,** `scripts/install-tools.ts`, installs exact tool pins into private
  scratch and checks the actionlint archive hash; `AGENTS.md` gives its command.

```sh
BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 bun --no-env-file --no-install --config=/dev/null --no-macros scripts/build.ts
BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 bun --no-env-file --no-install --config=/dev/null --no-macros scripts/verify.ts
```

`docs/celetis-flow.md`, "Check the harness", holds the reasons behind the facts of the gate and the
workflow.
