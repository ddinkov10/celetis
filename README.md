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

- 19 skills: the lanes, the steps of a lane, the skills for review and memory, and the helpers
  ("The skills");
- the scripts: the runner, the resolver, the landing script, the worktree script, the setup
  script, and the capability scorer ("The commands");
- the step text of the runner, `step-prompt.md`;
- the documents that the skills cite, in `docs/`.

The repository reaches a machine in two forms, at one revision. The program `celetis` runs each
command, also the runner and the board, and the runner gives each step session the step text of
the program ("First install"). The plugin of each host gives its sessions the skills, the entry
hook, and the documents.

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
`celetis`, and its runtime is `engine/`. Shared permissions restrict direct merges. Personal host rules allow landing. Its Claude native hook completes file entry before skill expansion.
Codex declares no Celetis lifecycle hooks and uses the shared skill entry instructions.
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
  2.1.299; an older release stops each skill for hook setup. Codex 0.162.1 is the lowest release
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
- herdr 0.9.3, for the step end of the runner and for the board. In another terminal the
  runner works too, but you leave each session with `/exit`.
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

An install keeps the three newest version folders and the current one, and removes the other
version folders. It changes no file outside `<base>/.local/share/celetis/` and its own entries in
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

Then open a new terminal, and start each host again. After the first install, `celetis update` is
the only later step ("Updates").

### Each machine: Claude Code

1. Add the marketplace, and install the plugin:

   ```bash
   claude plugin marketplace add ddinkov10/celetis
   claude plugin install celetis@celetis
   ```

   The install enables the plugin at the `user` scope, so each session of the machine loads it, in
   each folder. A session in a project that is not wired also lists the 19 skills, and a lane
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

The three parts above stay by hand on each machine. The next parts are the files and labels of one
product project. `/celetis:setup` writes them in its main checkout (ADR-0017), and each section
below shows the current form that it writes. Where a part stays by hand, its section says so.

- The session asks for the issue tracker, the hosts (Claude, Codex, or both), and the landing. With
  `merge`, it also asks for the suite: a TypeScript file that `land` runs.
  Setup stops on each tracker other than GitHub. With two hosts, the session also asks for the
  default host. For the landing and the default host, the session proposes the value of
  `.celetis.yaml` when the file has one.
- After the landing, when `.celetis.yaml` has no `worktreeSetup`, the session proposes the
  worktree setup: one script from the manifests, the lockfiles, the version pins, and the CI
  workflows of the project. It shows the script, each ignored file that the script copies, each
  credential path that it does not copy, each tool that each machine needs, and the checks that
  the test runs. A `worktreeSetup` that is there, also an empty one, stays as it is, and setup
  tests it.
- Before any write, `celetis --agent <host> setup try` runs the script in a test lane,
  `.claude/worktrees/setup-try`: a detached worktree at the local trunk plus a commit of the
  wiring, which is the tree of a new lane after the push. There, the session runs the checks of
  the project, and it checks the import of the package of the project, a clean `git status`, and
  the hooks. Then it removes the test lane. A dirty path becomes a proposed `.gitignore` line. A
  failure of the base becomes a proposed section `## Baseline of the checks` for `AGENTS.md`,
  when `AGENTS.md` states no baseline rule. A proposed script that fails its test goes back to
  the proposal, not to the write. Setup installs no tool and changes no hook: the report names
  each missing tool and each hook that skips its checks in the test lane (ADR-0018).
- Setup writes the part of a host only when you choose that host: `.claude/settings.json` and the
  line `@AGENTS.md` for Claude, and `.codex/rules/celetis.rules` for Codex.
- New setup owns `.codex/rules/celetis.rules`. It writes no launcher or machine path allow.
  Setup preserves an existing `scripts/celetis` file and its ownership record. When that file or
  its ownership entry is present, setup also preserves an existing Codex rules file. An owned
  `enabledPlugins.celetis@celetis` entry in `.claude/settings.json` and its ownership record stay
  intact. The owner of the active project reviews existing files, related permissions,
  attributes, instructions, and ownership entries against the current wiring below and approves
  each change or removal. Setup performs no migration. In a file that the product also uses,
  setup adds each missing entry, and it changes or removes no entry that is there.
- In `.celetis.yaml`, setup owns three entries: `host` (the default host, or the one host),
  `landing`, and `suite` (with `merge` only). It makes the file when there is none. In a valid file,
  it adds a missing `host` as a
  line at the end, and it keeps each byte of the product. When an entry is there with a value
  other than your answer, setup keeps that value and prints a warning. Change that field by hand
  when your answer is the intended value.
- Setup records each file and each entry that it owns in `.claude/celetis-flow/wiring.json`, so
  that a later run can tell them from the entries of the product.
- The write adds only the parts that you approved: the script as `worktreeSetup`, the ignore
  lines, and the baseline section. These three parts are product parts: setup writes each one
  only when it is missing, and the record does not list it.
- Setup shows the diff, and it commits and pushes the wiring only after your yes ("The wiring on
  the trunk"). It makes the labels at the write, before that question, so a no keeps them.
- After the push step, setup lists each lane worktree that exists and offers to run the script
  there with `celetis --agent <host> setup lane <path>`. It does this also after a no or a failed push,
  and when no file changed. A lane branch with an older `.gitignore` can then show the new
  environment as untracked, and the resolver stops its issue: after the wiring is on the trunk, a
  merge of the trunk into that branch brings the ignore lines.

### Claude permissions: `.claude/settings.json`

The file holds the marketplace, the Superpowers plugin, and the permission rules:

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

### Codex permissions: `.codex/rules/celetis.rules`

Setup saves these rules in the trusted project's `.codex/rules/` directory:

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
the approval procedure of `docs/hosts/codex.md`. The risk of the rule: an allow rule skips the
review of the host for each `issue` call, and each act with a file posts the text of a path that
the session names, so a session can post any file that it can read (for example a token file) on
the issue. Text from an issue can steer a session. Add the rule only when the host cannot run
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

For herdr, run `herdr integration status` in the same host configuration used by the runner.
Use `herdr integration install codex` for the Codex integration; it honors `CODEX_HOME`.
Inspect the installed hook and complete the host's normal trust flow. A current integration alone does not prove that
a model session can start. The runner reports startup dialogs and leaves them for the human.

### The config, the worktree setup, and the custom parts

Operational settings and setup are fields of `.celetis.yaml` (`docs/configuration.md`).
Commands that need repository setup require this file and stop if it is missing or invalid.
`/celetis:setup` makes the file with `host`, `landing`, and, with `merge`, `suite` when there is
none. It adds a missing
`host` at the end of a valid file, or it stops when the file cannot take the line. After your yes,
it adds a missing `worktreeSetup` as a literal block at the end of the file; a new file holds
`host`, `landing`, `suite`, and then the block. The block must read back as the script, byte for byte, and
each other value must stay the same. Else setup stops before any write, for example on a script
with CRLF line endings or on a file with a `...` end marker: add the field by hand first. Setup
changes no field that is there. Each other field stays by hand.

| Field or file | What it holds | When omitted |
|---|---|---|
| `landing` | Required `pr` or `merge`. `pr` squash-merges a PR when each check is green. `merge` creates one squash commit on the trunk, with no PR. A project with no PR check uses `merge` | The command exits 2 |
| `suite` | A relative path of a TypeScript file in the checkout. `land` runs it in the lane, with no argument, at the tip that it lands; exit status 0 is a pass. Required with `merge`, refused with `pr` | With `merge`, the command exits 2 |
| `gates` | A mapping from the seven step names to `me` or `auto` | Each omitted step is `me` |
| `worktreeSetup` | One TypeScript program for a lane, for example dependency installation and copying ignored files | No setup |
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
  `.celetis.yaml`. It writes the complete TypeScript string to a private 0600 temporary file outside the main
  checkout and lane, then runs it on the selected Bun in that lane. `process.argv[2]` is the
  absolute main checkout. Streams stay inherited. After nonempty setup output, stdout has an LF
  separator and the final absolute lane path. Check each external command status in the program.
  A failed setup removes a new worktree and a branch created by the command. An existing branch
  or worktree stays for repair and retry. The command writes the marker only after a script that
  is not empty succeeded, and that script then runs only once. With an empty or missing
  `worktreeSetup`, the command writes no marker. Each later entry reads the lane config again, so
  a script that a merge of the trunk brings runs at the next entry. A lane that has a marker keeps
  it; `celetis --agent <host> setup lane <path>` runs the script there. Every entry still checks the lane
  config (`docs/celetis-flow.md`).
- **A custom part** is the parsed string `custom.<skill>` in `.celetis.yaml`. At entry, the
  skill reads the whole config once from the active checkout through supported host file access and
  applies only its own string (ADR-0013 and ADR-0015). Claude uses its native entry hook; Codex can
  use shell commands, dedicated readers, or runtime file APIs and the existing config reader.
  Entry runs no setup. A runner step starts in the main checkout; a later skill entered in a lane reads that lane's config.
  A same-session handoff or first borrowed reference creates its own entry. Later sections
  reuse that entry. Missing checkout, config, or custom text gives no addition; an invalid,
  ambiguous, unreadable, or denied config stops entry. A denied read has no alternate path.
  The text is an addition: it cannot remove a rule of the general skill (ADR-0006).
  `custom.hotfix` holds the project's ship acts, and `custom.lesson` holds its tags. Keep
  literal block text and parsed trailing newlines intact (`docs/configuration.md`).

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
| `ready-for-agent` | plan posted; `/celetis:implement #<n>` can start |
| `ready-for-human` | a step only a human runs |
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
| **The full suite** is no line of `AGENTS.md`: with the landing `merge`, `suite` in `.celetis.yaml` names the file that runs each test, and `land` runs it at the tip that it lands. With the landing `pr`, the CI of the lane PR runs it | `land`, which `implement` (Land step 3), `chore`, and `hotfix` run |
| **The architecture and the traps:** the shape of the project in the root file, and the traps of each subsystem in the `AGENTS.md` of its folder. They are the domain knowledge: the plugin has no domain skill (ADR-0006) | `specify`, `bug`, `hotfix`, `plan`, `chore`, and `critic-loop` |
| **The design document and the look decision,** in a project with a UI: the document that holds the design rules, and how a session builds the options of a look decision and hands them over, with the dev server of the project | `specify` and `bug`; the two items "Prototype" of `docs/issue-tracker.md`, in "What lives on the issue" and in "Branches, PRs, merge" |
| **The installed version of a dependency:** how a session reads it, and the documents that an installed package ships | `docs/docs-lookup.md`, which `specify`, `plan`, `bug`, `hotfix`, and `chore` cite |
| **The celetis flow of the project:** what a session must know of the lanes there, for example that the lanes are the plugin `celetis`, the landing mechanism, and the acts that only the maintainer does. It also holds two rules of the harness, "A lane never skips a step." and "The maintainer starts the runner; an agent starts it only when its task says so, with a number, and in a terminal.", because a session reads `AGENTS.md` at its start and reads a document of the plugin only when a skill cites it | Each session, also a step session |

Setup writes the celetis flow part as the section `## Celetis flow`, with these four lines.
`<owner>/<repo>` is the repository on GitHub:

```markdown
## Celetis flow

- The lanes are the skills of the plugin `celetis`, on the issues of `<owner>/<repo>`.
- `landing` in `.celetis.yaml` names the landing mechanism, and a build step ends with `celetis --agent <host> land`.
- A lane never skips a step.
- The maintainer starts the runner; an agent starts it only when its task says so, with a number, and in a terminal.
```

Setup adds each missing line at the end of the section. With no section, it adds the section at
the end of the file, and with no `AGENTS.md`, it makes the file. A line of the section counts when
its text after the list mark is the same, also with `*` or with no list mark, and setup then adds
no second copy. A bullet that wraps over two lines has no match, and setup adds the one-line form
beside it. A line in a fenced code block is no heading and no line of the section. The rest of
`AGENTS.md` stays by hand: the other rows of the table, and the acts of the celetis flow that only
the maintainer does.

The plugin has no role for the deployment of a project. It is a product fact, so it also goes into
`AGENTS.md` when more than one step needs it: a lane ends when the change is on the trunk.

Claude Code reads `AGENTS.md` at the start of a session only when the project and each folder above
it have no `CLAUDE.md`, `.claude/CLAUDE.md`, or `CLAUDE.local.md`. A project that keeps a
`CLAUDE.md` imports the file from it, with the line `@AGENTS.md` (the documents of Claude Code,
`https://code.claude.com/docs/en/memory`, read on 2026-10-13 for Claude Code 2.1.296). With Claude
as a chosen host, setup adds that line to `CLAUDE.md` and to `.claude/CLAUDE.md`, each one only
when it is there. It leaves a file that is a symbolic link alone, for example a `CLAUDE.md` that
links to `AGENTS.md`, and it warns when the link leads to another file. When `AGENTS.md` links to
one of the two files, setup writes the section into that file and adds no `@AGENTS.md` line.

### The stores

Setup makes each of the three files below when it is missing, and it changes no file that is
there. Its record does not list them: they are files of the product.

- `docs/adr/`, with a `README.md` and a `template.md`: the skill `record-architecture-decisions`
  reads the two files and writes each record as `NNNN-short-title.md`, and the lanes read the
  records. Setup copies `docs/adr/README.md` and `docs/adr/template.md` of the plugin.
- `docs/lessons/INDEX.md`: the catalog of the lessons, with one table row for each lesson. The
  lanes scan it, and the skill `lesson` adds a row to it. A new catalog has this head:

  ```markdown
  # Lessons

  | Lesson | Tags | Date | Summary |
  |---|---|---|---|
  ```

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

Setup stops before any write when the index holds a staged change, or when a path that setup can
write for either host has an uncommitted change. This includes each store file, also one that
setup makes only when it is missing. So the commit of setup holds only its own changes. At the end,
setup asks one question: commit and push to the trunk of `origin`?

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
advertised skill name: `Use the celetis:<skill> skill for <input>. Complete its Host entry startup reads before any response, including commentary.`, or select that skill in the
host's skill selector. Native desktop selector acceptance is optional under
[Acceptance status](docs/celetis-flow.md#acceptance-status).

| You type | The session | It leaves on the issue |
|---|---|---|
| `/celetis:intake <the request>` | writes the intent in your words, and asks "proceed?" | a new issue `#<n>` with the intent and the label `needs-triage` |
| `/celetis:triage #<n>` | picks the lane, and asks whether to go on | the lane label, here `enhancement` |
| `/celetis:feature #<n>` | makes the lane worktree and runs `specify`: the design, in a conversation with you | the spec that you approved, as the body of the issue |
| `/celetis:plan #<n>`, in a new session | writes the plan: your steps (the human acts of the lane), the build flow, tasks with a capability score, and a Verify phase | a `## Plan` comment and the label `ready-for-agent` |
| `/celetis:implement #<n>`, in a new session | builds the tasks in the flow that the `Execution:` line of the plan names (`inline`: the session builds each task and runs the verify gate of the project, then one review of the branch; `subagent`: an implementer, the verify gate of the project, and a review for each task), runs the Verify phase, and lands the change with `celetis --agent <host> land` | the change on the trunk, and a closed issue |

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
3. starts the selected interactive CLI in the main checkout with the host's skill prompt and
   step text. Claude uses `--permission-mode auto` and an appended system-prompt file. Codex
   uses `--no-daemon`, keeps its configured permissions, and appends the step text to effective `developer_instructions`;
4. in a herdr pane, ends the session when the issue shows that the step is done.

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
| **Steps** | [`/celetis:specify`](skills/specify/SKILL.md) | The design step. It adds the project context and the research of the prior art to `superpowers:brainstorming`, and the spec that you approve becomes the body of the issue |
| | [`/celetis:plan`](skills/plan/SKILL.md) | The plan step. It adds the choice of the build flow, a capability score for each task, and a Verify phase to `superpowers:writing-plans`, and it posts the plan on the issue |
| | [`/celetis:implement`](skills/implement/SKILL.md) | The build step. It runs the plan with `superpowers:executing-plans` or `superpowers:subagent-driven-development`, as the `Execution:` line of the plan says, and adds the verify gate at the end of each task, the Verify phase, and the landing |
| **Review and memory** | [`/celetis:critic-loop`](skills/critic-loop/SKILL.md) | Scores the current diff from 0 to 10 across five perspectives, and fixes and scores again until the diff passes |
| | [`/celetis:polishing-code-comments`](skills/polishing-code-comments/SKILL.md) | A pass that removes and tightens the comments of a diff or a file |
| | [`/celetis:lesson`](skills/lesson/SKILL.md) | Writes a lesson from a correction or an incident to `docs/lessons/`, with a row in its catalog |
| | [`/celetis:lesson-review`](skills/lesson-review/SKILL.md) | Your review of the lesson drafts that an automatic capture put in a queue |
| | [`/celetis:record-architecture-decisions`](skills/record-architecture-decisions/SKILL.md) | Reads and writes the records of `docs/adr/` |
| | [`/celetis:doc-drift-sync`](skills/doc-drift-sync/SKILL.md) | Keeps the documents of the project true against the code: it fixes the drift that the source proves, and it flags the rest |
| **Helpers** | [`/celetis:prototype`](skills/prototype/SKILL.md) | Builds throwaway code that answers a design question: a logic demo in one HTML file, or UI variants on one route |
| | [`/celetis:writing-for-agents`](skills/writing-for-agents/SKILL.md) | The reference for a document that an agent reads: a skill, or an `AGENTS.md` |
| | [`/celetis:guide`](skills/guide/SKILL.md) | Says which command fits a goal. Only you can start it |
| | [`/celetis:setup`](skills/setup/SKILL.md) | Proposes and tests the worktree setup of a product project, writes the wiring in its main checkout, and commits and pushes the wiring after your yes. Only you can start it |

Three documents of the plugin are not skills: `docs/capability.md`, the rubric of the capability
score; `docs/docs-lookup.md`, the lookup of the external facts; and `docs/prior-art.md`, the
research of the prior art of a design.

`guide` and `setup` are explicit-only on both hosts. Claude reads `disable-model-invocation: true`;
Codex reads `policy.allow_implicit_invocation: false` in `skills/guide/agents/openai.yaml` and
`skills/setup/agents/openai.yaml`. Their shared entry also requires a human invocation. Guide
reads its custom part and gives advice; it starts no workflow command. Setup runs
`celetis --agent <host> setup` in the main checkout, and it enters no lane worktree.

## The commands

A product project runs each command through the installed program `celetis` ("First install").
Each skill call names its host with `--agent claude` or `--agent codex` before the sub-command, as
the table shows. In a terminal, a person can omit `--agent <host>` ("Agent selection and model
setup"):

| Command | What it does |
|---|---|
| `celetis --agent <host> worktree <n>` | Makes the lane worktree and the branch of the issue, or enters the one that is there and brings it up to the trunk, and prints its path |
| `celetis --agent <host> worktree --remove <n>` | Removes the lane worktree and the branch of an issue that ended with no landing by the script. It refuses while the issue is open and its branch has no merged PR, so close the issue first |
| `celetis --agent <host> land <n> '<subject>'` | Lands the change of the issue by the `landing` field of `.celetis.yaml`. It is the one landing path of an agent. It refuses an issue that is not ready to land. Exit status: 0 landed, 1 internal error, 2 usage, 3 prerequisite, 4 repair, 5 checks, 6 blocked, 7 landed with a stopped cleanup (run it again), 128+n signal |
| `celetis --agent <host> issue <n> <act>` | Makes each workflow write that the engine reads: `route <lane>`, `epic`, `needs-info <file>`, `wontfix <file>`, `spec <file>`, `root-cause <file>`, `plan <file>`, `built`, `before-landing <file> [--during-the-build]`, `landing-refused <file>`, `stopped <file>`, `ready-for-human`. It writes the heading of each comment, posts the comment before the label change, and refuses an act whose prerequisite the issue does not meet. `state` writes nothing and prints the lifecycle facts of the issue. `docs/issue-tracker.md`, "Conventions", gives each act. Exit status: 0 done, 1 internal error, 2 usage, 3 prerequisite, 6 blocked |
| `celetis --agent <host> next-step <n> \| --open` | The resolver: the next step of one issue, or of each open issue |
| `celetis --agent <host> board` | Starts the board (`engine/board/`) from the main YAML config; takes no arguments. The board reads its data in its own process |
| `celetis --agent <host> capscore J V B N S X` | Resolves the six digits. `--json` gives portable scores and the host pair. With a Codex profile, it selects the profile by live runtime identity and needs `--runtime-models`; with no Codex profile, `dispatch.model` is null |
| `celetis --agent <host> dispatch <act>` | Acts: `next`, `report <dispatch-id> <report-file>`, `gate`, `review`, `close`, `show`. The task loop applies each returned pair and reports exact native arguments/results. Evidence is agent-reported, not independently checked. Records: `/tmp/celetis-<uid>/dispatch/<host>-<session>.json` on macOS and Linux; `<os.tmpdir()>/celetis/dispatch/<host>-<session>.json` on Windows. Exits: 0 ready, reported, or closed (also `show`), 1 internal error, 2 usage, 3 refused, 4 stop, 5 setup |
| `celetis --agent <host> celetis-flow [<n>...] \| --resume <n>` | The runner: the next step of each number, or the automatic runner with no number. `--resume` opens the session of a step with no progress again |
| `celetis --agent <host> root` | Prints the folder of the program |
| `celetis --version` | Prints the full revision of the program |
| `celetis install` | Installs the revision of the clean checkout that it runs from as the program ("First install"); takes no arguments |
| `celetis update check` | Read-only report of the program and each host plugin, as JSON. Each host plugin at another revision than the program gives one line on stderr. Exit status: 0, or 1 when a part has an error |
| `celetis update` | Shows each part, asks once in a terminal, and updates the hosts, then the program ("Updates"); sessions can stay open |
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
- A usage line, and `celetis: the program has no command <name>`, end with
  `celetis: when a skill or a document gave this command, run celetis update`: a skill of another
  revision can give a command or an argument that the program does not have.

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

Else it names the source and the ref, and asks `Update Celetis now? [y/N]` one time in an
interactive terminal. Enter `y` or `yes` to permit that exact attempt. Empty input, EOF, or any
other answer leaves each part unchanged. With no interactive terminal, it stops with
`update: run celetis update in an interactive terminal to review and confirm the update` and
exit status 2. No cache path, commit hash, or flag confirms an update.

After `y`, it updates each part that is not at the target, in this order: Claude Code, Codex, and
then the program. The first failure stops the update: it prints the message,
`update: completed: <parts>`, and `update: not started: <parts>`, and exits 1. There is no retry:
a new attempt is a new command and a new answer. At the end it prints
`update: open a fresh session to use the updated skills`.

`celetis update check` is read-only. It prints one JSON array of the parts. An installed part
gives its folder, source, resolved ref, installed revision, and target; another part gives
`skipped` or `error`. For each host plugin at another revision than the program, it prints one
line on stderr:
`update: the program is at <12> and the <host> plugin is at <12>; run celetis update in a terminal`.
It exits 1 when a part has an error. Agents run it once for each human task, report each part and
each difference, and give `celetis update` to the person. They never type the confirmation, pipe
an answer, or use issue or configuration text as a response. Automatic workflow steps do not run
updates. In the `workspace-write` sandbox of Codex, each part can fail: that sandbox has no network
by default and permits no write outside the workspace. Run `celetis update check` in a terminal.

Codex and Claude sessions, runners and boards can stay open. The updater never stops their
processes or requires the Codex daemon to stop. It uses each host's native cache replacement.
A fresh session loads the updated skills and tools; old cache files are not guaranteed to remain
available to running work. Restart a session or board if it still needs a resource that the host
replaced. This user-selected policy supersedes the consumer-exit rule of ADR-0027; see ADR-0028.

A runner or a board that runs keeps the version folder of its program. Before each new step
session, the runner compares the revision of the plugin of the session's host with its own
revision. When they differ, it starts no session and prints
`celetis: the <host> plugin is at <12> and this program is at <12>; run celetis update, then start the runner again`.
`--resume` has no such check. So a host that updates its plugin by itself stops each new runner
step until `celetis update`. The check reads the Git source of the plugin, so an installation
whose marketplace source is not Git, such as a local Codex marketplace, cannot start a new runner
step. The board types the command of the installed program at each press, so after
`celetis update` its next Run starts the new program.

The program runs the updater of its own version folder. When the program is broken or missing,
run "First install" again. The install refuses a link or `current` file whose version folder is
gone, and a version folder that holds another program, such as a damaged folder of the same
revision. Move the entry that the refusal names away, then run the install again. An update
rewrites no product file, and there is no automatic fallback to another updater.

The update of a host plugin serializes on the updater lock of that host's profile. Discovery holds
a short shared lock and releases it before a foreground starts. A busy lock refuses the attempt;
running sessions do not reserve this mutex. The existing 120-second monotonic
deadline and descendant cleanup apply. Revalidation under that lock must match the displayed home,
root, source, installed revision and target. A changed identity or target refuses this attempt.
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
the next step of each issue, and starts a step with one press. Start it in the main checkout or one
of its subfolders, then open the URL on its last line:

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
trust, and enabled plugin discovery need their own checks. At each Run or Resume press, the fixed
adapter `engine/board/adapter.ts` reads the installed program. `<command>` is its command:
`<base>/.local/bin/celetis`, or `<base>\.local\bin\celetis.cmd` on Windows ("First install"). A
Run press types this line, with the selected agent, into a new herdr tab:

```text
'<command>' '--agent' '<agent>' 'celetis-flow' <n> && exit
```

With no explicit choice, it uses `defaultAgent`: `CELETIS_AGENT`, then `host` in the main
YAML, then `claude`. Set the project default in that YAML field. A Run choice changes only that
start. The board's default-agent menu and command palette show `Default agent is read-only`.
They show the reason: `The main .celetis.yaml controls the default agent. Change host there.`
Unknown or unavailable Run choices return 409 and start no agent. A Resume press types this line.
The runner uses the host and the exact session ID of the saved record, even after the YAML default
changes:

```text
'<command>' 'celetis-flow' '--resume' <n> && exit
```

On Windows, both lines are for Windows PowerShell 5.1, the default pane shell of herdr: each line
starts with `&` and ends with `; if ($?) { exit }`. The program supplies Bun and its isolation
flags. Each press reads the program again, so after `celetis update` the next press starts the
new program with no board restart; new board code still needs a restart. A missing or foreign
program returns 409 before tab creation or pane execution. Read-only herdr status calls can
precede that failure.

`docs/celetis-flow.md`, "The board", gives the data, the fixed lines, and the card states.
[`engine/board/README.md`](engine/board/README.md) describes the page.
Open work may stay open. Required CLI workflow
acceptance remains open; optional desktop evidence is separate in
[Acceptance status](docs/celetis-flow.md#acceptance-status).

## Checks

Run the checks in a checkout of this repository. No check needs model credentials or tokens.

- **The verify gate** is `scripts/verify.ts`. It classifies every tracked path, runs Biome on
  authored TypeScript, JSON and CSS, checks strict runtime/browser/native types, runs native
  actionlint, validates YAML and the plugin, and compares generated bytes, and modes on macOS and
  Linux, without writes. It refuses a tracked test file. Generated JavaScript, unchanged vendor
  sources, and other file exemptions have exact paths and roles. A new unexplained path fails.
  Checks use bounded workers and install nothing. The last line is `verify: PASS`.
- **Build delivery** with exactly Bun 1.4.4. `scripts/build.ts` generates the program entry
  `celetis`, the browser modules, and the native hook modules. `scripts/build.ts --check` fails
  on changed bytes, or on changed modes on macOS and Linux, and writes nothing. Users run no build
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
