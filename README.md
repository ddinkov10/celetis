# celetis

`celetis` is a general agent harness with required automation for Claude Code and Codex TUI/CLI.
The shared flows also allow manual or inline invocation in the Codex desktop app.
It takes a request from free text to a change on the trunk through one GitHub issue: the intent,
the lane, the spec, the plan, the
build, and the landing. The issue is the state store: each result goes onto the issue, and each
hand-off reads the issue again.

Codex remains opt-in while required CLI workflow acceptance is incomplete. Stable installed
resources during a running step, changed-pair same-child repair, and final live workflows still
need proof. Desktop automation is optional and has separate evidence in
[Acceptance status](docs/celetis-flow.md#acceptance-status).

The plugin holds:

- 19 skills: the lanes, the steps of a lane, the skills for review and memory, and the helpers
  ("The skills");
- the scripts: the runner, the resolver, the landing script, the worktree script, the setup
  script, and the capability scorer ("The commands");
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
| The host wiring | Claude: `.claude/settings.json`. Codex: the installed plugins and trusted `.codex/config.toml` and `.codex/rules/` (below) |
| The launcher | `scripts/celetis` |
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
project. The plugin has no `version`, no `bin/` folder, and no declared dependency, and it gives
no permission rule. Its Claude native hook completes file entry before skill expansion.
ADR-0012 holds the original packaging decision; ADR-0014 extends it to both hosts without a
second copy of the procedures. ADR-0015 replaces their config storage clauses with one YAML file.
ADR-0016 limits required automation to the CLI hosts while keeping desktop invocation available.

## Requirements

- macOS or Linux, with bash 3.2 or later. There is no native Windows runner. On a Windows host, a
  session by hand runs the scripts in Git Bash, and the lookup of the launcher there passed on
  2026-10-14 (ADR-0012). Keep the clone path at 130 characters or less: a longer path goes past
  the 260 limit on Windows, and `scripts/celetis worktree <n>` then stops with `Filename too
  long`. `git config --global core.longpaths true` removes the limit.
- The selected host CLI: Claude Code 2.1.299 or later, or Codex CLI 0.162.1 or later. The Claude
  entry hook reads the `skill.prompt` fields `source`, `pluginName`, and `path`, which came in
  2.1.299; an older release stops each skill for hook setup. Codex 0.162.1 is the lowest release
  on which the install, the refresh, and the lookup of the plugin were checked; an older release
  is not supported. These versions are a floor, not proof of the full workflow
  ([Acceptance status](docs/celetis-flow.md#acceptance-status)).
- `gh` (logged in), `jq`, Mike Farah's `yq` `>=4.54.1,<5`, `git` 2.31 or later,
  and Perl 5.14 or later on `PATH`.
  The runner uses only the standard library of Perl.
- Git credentials for GitHub that need no prompt, an ssh key or a credential helper for https: the
  plugin repository is private.
- Superpowers, installed and enabled on the selected host: the lanes call its `superpowers:*` skills.
- herdr 0.9.3, for the step end of the runner and for the board. In another terminal the
  runner works too, but you leave each session with `/exit`.
- For the board: Node 22 from 22.18, or Node 24.2 or later, and a Chromium browser.

`docs/celetis-flow.md` gives each requirement in full ("Requirements", and "The board").
The [configuration reference](docs/configuration.md) gives the repository schema and the
`yq` v4.54.1 download commands for macOS and Linux.

## Wire a product project

### Each machine: Claude Code

1. Add the marketplace, and install the plugin:

   ```bash
   claude plugin marketplace add ddinkov10/celetis
   claude plugin install celetis@celetis
   ```

   The install enables the plugin at the `user` scope, so each session of the machine loads it, in
   each folder. A session in a project that is not wired also lists the 19 skills, and a lane
   skill that starts there from free text makes a GitHub issue before it finds no launcher. The
   documents of Claude Code give a way to limit this, which is not shown here:
   `"celetis@celetis": false` in `enabledPlugins` of `~/.claude/settings.json` turns the plugin
   off at the `user` scope, and the project file of a wired project turns it on.

   The launcher finds the plugin through the record of this install, so the two commands are
   necessary on each machine. It is not shown that the block of the project file (below) loads
   the plugin with no install. In the probe, a headless turn in a new repository whose project
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
   needs no such step: the block of the project file holds the key for `celetis`, and Claude Code
   takes it from there in a trusted folder (ADR-0012, R2). "Updates" says what auto-update does.

### Each machine: Codex only

Use a signed-in Codex CLI and Git credentials that can read this private repository without a
prompt. Claude is not required. Add the Git source, then install the plugin:

```bash
codex plugin marketplace add ddinkov10/celetis --ref main
codex plugin add celetis@celetis --json
```

The launcher discovers the enabled installation through `skills/list`; it does not calculate a cache
path. A local-path marketplace is unsuitable for the runner: `plugin marketplace upgrade celetis`
requires a Git source. `--ref main` selects the landed source. A test of an unlanded commit must use
its explicit Git ref in a separate test configuration. These commands and result fields were checked
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

The two parts above stay by hand on each machine. The next parts are the files and labels of one
product project. `/celetis:setup` writes them in its main checkout (ADR-0017), and each section
below shows the current form that it writes. Where a part stays by hand, its section says so.

- The session asks for the issue tracker, the hosts (Claude, Codex, or both), and the landing.
  Setup stops on each tracker other than GitHub. With two hosts, the session also asks for the
  default host. For the landing and the default host, the session proposes the value of
  `.celetis.yaml` when the file has one.
- After the landing, when `.celetis.yaml` has no `worktreeSetup`, the session proposes the
  worktree setup: one script from the manifests, the lockfiles, the version pins, and the CI
  workflows of the project. It shows the script, each ignored file that the script copies, each
  credential path that it does not copy, each tool that each machine needs, and the checks that
  the test runs. A `worktreeSetup` that is there, also an empty one, stays as it is, and setup
  tests it.
- Before any write, `scripts/celetis setup try` runs the script in a test lane,
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
- Setup owns the launcher and `.codex/rules/celetis.rules` whole, and it writes each one again at
  each run, whatever the file holds. In a file that the product also uses, setup adds each missing
  entry, and it changes or removes no entry that is there.
- In `.celetis.yaml`, setup owns two entries: `host` (the default host, or the one host) and
  `landing`. It makes the file when there is none. In a valid file, it adds a missing `host` as a
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
  there with `scripts/celetis setup lane <path>`. It does this also after a no or a failed push,
  and when no file changed. A lane branch with an older `.gitignore` can then show the new
  environment as untracked, and the resolver stops its issue: after the wiring is on the trunk, a
  merge of the trunk into that branch brings the ignore lines.

### Claude permissions: `.claude/settings.json`

The file holds the marketplace, the two plugins, and the permission rules:

```json
{
  "permissions": {
    "allow": [
      "Bash(scripts/celetis land *)",
      "Bash(scripts/celetis --agent claude land *)",
      "Bash(scripts/celetis --agent codex land *)"
    ],
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

The plugin gives no permission rule, so each product project holds these rules. The `allow` entries
cover the bare terminal command and both explicit host forms. Each manual skill uses its own
host prefix. The `deny` entries retain the direct-merge restriction: to merge by hand, use your
own shell or GitHub. A rule matches the text of a command, so the command has no `./` before it.
A `Bash(...)` rule does not match the
PowerShell tool of a session on a Windows host, so a `deny` rule has the two forms. A project adds a
`deny` rule for each act of its own that only the maintainer does (`docs/celetis-flow.md`,
"Guards"). The [Claude permission reference](https://code.claude.com/docs/en/permissions)
defines these command patterns and the deny-before-allow order.

### Codex permissions: `.codex/rules/celetis.rules`

Setup saves these rules in the trusted project's `.codex/rules/` directory:

```starlark
prefix_rule(
    pattern = ["scripts/celetis", "land"],
    decision = "allow",
)
prefix_rule(
    pattern = ["scripts/celetis", "--agent", ["claude", "codex"], "land"],
    decision = "allow",
)
prefix_rule(
    pattern = ["gh", "pr", "merge"],
    decision = "forbidden",
    justification = "Use scripts/celetis --agent codex land from the main checkout.",
)
```

Restart Codex after the write. Check the saved rules without executing a landing or merge:

```bash
codex execpolicy check --rules .codex/rules/celetis.rules -- scripts/celetis --agent codex land 7 'fix(example): repair output'
codex execpolicy check --rules .codex/rules/celetis.rules -- gh pr merge 7 --squash
```

The results must contain `decision: "allow"` and `decision: "forbidden"`, respectively. Also
check the bare landing form and the Claude prefix. Codex 0.162.1 passed these exact policy checks.
The [Codex rules documentation](https://learn.chatgpt.com/docs/agent-configuration/rules)
defines their scope: command requests outside the sandbox, with project rules loaded only from
a trusted configuration layer. These prefix rules do not inspect every command inside an allowed
script or forbid every spelling or API route to a merge. Keep the host's sandbox and approval
settings. Request required access to the main and lane checkouts through its normal controls.
The landing script's checks remain authoritative for the permitted landing path. A policy-file
check does not prove the active desktop session loaded that file.

### The launcher

Setup copies `scripts/celetis` of the installed plugin to `scripts/celetis` of the project. The
commit of setup gives the file the mode `100755`, the execute bit, which the board needs to start
the file. The file is the same in each product project. `scripts/celetis <name> <arguments>` runs
`scripts/<name>.sh` of the installed plugin with those arguments ("The commands"), so a new script
of the plugin needs no new copy.

### Agent selection and model setup

`host` in `.celetis.yaml` selects the host of the human terminal and board commands. Setup writes
it with the default host that you choose, or with the one host. Setup does not change a `host`
that is there: to change the default host, edit `host` by hand. Check the installed package with
an explicit host:

```bash
scripts/celetis --agent codex root
```

Selection is `--agent claude|codex`, then `CELETIS_AGENT`, then `host` in the main checkout's
`.celetis.yaml`, then `claude`. An invalid value stops the command. Skills always pass their
actual host explicitly on each call, including landing. The selected host is exported to child scripts. Both installed
hosts can use one product project; their installations and configuration remain separate.

`root` validates the enabled plugin and returns the installed package directory. Codex discovery
uses a short-lived app-server connection and `skills/list`, with no thread or model turn.
Missing, disabled, malformed, or ambiguous installation data stops lookup. Do not use a
marketplace source checkout in place of the returned installation.

With no profile, each Codex child keeps the parent's model and gets the effort of its rank. This
needs no setup. For model tiers, supply the four-slot profile and reviewer minimum in
`docs/capability.md`, "Codex model profiles". Obtain the model IDs and efforts from the active
dispatch surface. Store its profile under `codexProfiles` in the main config and pass the current
runtime allowlist to each scorer call. A CLI catalog does not establish desktop dispatch support.
A missing pair or a tool that cannot apply the required pair stops the dependent work.

For herdr, run `herdr integration status` in the same host configuration used by the runner.
Use `herdr integration install codex` for the Codex integration; it honors `CODEX_HOME`.
Inspect the installed hook and complete the host's normal trust flow. A current integration alone does not prove that
a model session can start. The runner reports startup dialogs and leaves them for the human.

### The config, the worktree setup, and the custom parts

Operational settings and setup are fields of `.celetis.yaml` (`docs/configuration.md`).
Commands that need repository setup require this file and stop if it is missing or invalid.
`/celetis:setup` makes the file with `host` and `landing` when there is none. It adds a missing
`host` at the end of a valid file, or it stops when the file cannot take the line. After your yes,
it adds a missing `worktreeSetup` as a literal block at the end of the file; a new file holds
`host`, `landing`, and then the block. The block must read back as the script, byte for byte, and
each other value must stay the same. Else setup stops before any write, for example on a script
with CRLF line endings or on a file with a `...` end marker: add the field by hand first. Setup
changes no field that is there. Each other field stays by hand.

| Field or file | What it holds | When omitted |
|---|---|---|
| `landing` | Required `pr` or `merge`. `pr` squash-merges a PR when each check is green. `merge` creates one squash commit on the trunk, with no PR. A project with no PR check uses `merge` | The command exits 2 |
| `gates` | A mapping from the seven step names to `me` or `auto` | Each omitted step is `me` |
| `worktreeSetup` | One Bash script for a lane, for example dependency installation and copying ignored files | No setup |
| `board.port` | The board port ("The agent board") | 4403 |
| `codexProfiles.<runtime>` | Four ordered model slots and the reviewer minimum for that dispatch surface | Each Codex child keeps the parent's model |
| `custom.<skill>` | An addition to the skill procedure | No addition |

- **Operational settings** come from the main checkout, including when a command starts in a
  lane or subfolder. `scripts/celetis land` moves the trunk of the main checkout; after a merge by
  other means, or after its line `land: the main checkout did not move`, run `git pull` there.
- **The gate of a step** comes from `gates.<step>`. An `auto` step starts by itself. A `me` step
  starts when you supply a number or press Run on the board. Old Git defaults have no effect.
- **With the landing `pr`,** keep the repository setting `squash_merge_commit_title` at
  `COMMIT_OR_PR_TITLE`: for a PR with one commit, GitHub then takes the subject of that commit and
  adds the PR number (`docs/issue-tracker.md`, "Branches, PRs, merge").
  `gh api 'repos/{owner}/{repo}' --jq .squash_merge_commit_title` prints the value.
- **The worktree setup.** `scripts/celetis worktree <n>` reads `worktreeSetup` from the lane's
  `.celetis.yaml`. It runs the complete string in one Bash process in that lane, with the main
  checkout as `$1` and inherited stdin. All output goes to stderr, so stdout holds one lane path.
  A failed setup removes a new worktree and a branch created by the command. An existing branch
  or worktree stays for repair and retry. The command writes the marker only after a script that
  is not empty succeeded, and that script then runs only once. With an empty or missing
  `worktreeSetup`, the command writes no marker. Each later entry reads the lane config again, so
  a script that a merge of the trunk brings runs at the next entry. A lane that has a marker keeps
  it; `scripts/celetis setup lane <path>` runs the script there. Every entry still checks the lane
  config (`docs/celetis-flow.md`).
- **A custom part** is the parsed string `custom.<skill>` in `.celetis.yaml`. At entry, the
  skill reads the whole config once from the active checkout through native file tools and
  applies only its own string (ADR-0013 and ADR-0015). No shell or parser runs during entry. A runner step
  starts in the main checkout; a later skill entered in a lane reads that lane's config.
  A same-session handoff or first borrowed reference creates its own entry. Later sections
  reuse that entry. Missing checkout, config, or custom text gives no addition; an invalid,
  ambiguous, unreadable, or denied config stops entry. A denied read has no alternate path.
  The text is an addition: it cannot remove a rule of the general skill (ADR-0006).
  `custom.hotfix` holds the project's ship acts, and `custom.lesson` holds its tags. Keep
  literal block text and parsed trailing newlines intact (`docs/configuration.md`).

`docs/celetis-flow.md` holds these parts in full ("Gates", and "The config and the custom parts").
Before updating an existing product project, complete the [manual cutover](docs/configuration.md#replace-the-old-setup).
It includes the changed standalone launcher and stopped old runners; plugin refresh alone does not prepare a project.

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
| **The verify gate:** the one fast deterministic check of a change (lint, format, syntax, and config checks, with no test run), and how to read its result | `plan`, `implement`, `chore`, `hotfix`, and `guide` say "the verify gate of the project", and `scripts/celetis land` names it in a refusal |
| **The full suite,** with the landing `merge` only: the command that runs each test. With no such line, the verify gate is the full suite | `implement` (Land step 3), and `chore` and `hotfix` through it |
| **The architecture and the traps:** the shape of the project in the root file, and the traps of each subsystem in the `AGENTS.md` of its folder. They are the domain knowledge: the plugin has no domain skill (ADR-0006) | `specify`, `bug`, `hotfix`, `plan`, `chore`, and `critic-loop` |
| **The design document and the look decision,** in a project with a UI: the document that holds the design rules, and how a session builds the options of a look decision and hands them over, with the dev server of the project | `specify` and `bug`; the two items "Prototype" of `docs/issue-tracker.md`, in "What lives on the issue" and in "Branches, PRs, merge" |
| **The installed version of a dependency:** how a session reads it, and the documents that an installed package ships | `docs/docs-lookup.md`, which `specify`, `plan`, `bug`, `hotfix`, and `chore` cite |
| **The celetis flow of the project:** what a session must know of the lanes there, for example that the lanes are the plugin `celetis`, the landing mechanism, and the acts that only the maintainer does. It also holds two rules of the harness, "A lane never skips a step." and "The maintainer starts the runner; an agent starts it only when its task says so, with a number, and in a terminal.", because a session reads `AGENTS.md` at its start and reads a document of the plugin only when a skill cites it | Each session, also a step session. So after each change of this part, run the hand-run test in the project ("Tests") |

Setup writes the celetis flow part as the section `## Celetis flow`, with these four lines.
`<owner>/<repo>` is the repository on GitHub:

```markdown
## Celetis flow

- The lanes are the skills of the plugin `celetis`, on the issues of `<owner>/<repo>`.
- `landing` in `.celetis.yaml` names the landing mechanism, and a build step ends with `scripts/celetis land`.
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

A product project can keep a native `board` entry in `.claude/launch.json`. The entry stays by
hand. Point it at the same launcher command. Its native preview port must match `board.port` in
`.celetis.yaml`:

```json
{
  "name": "board",
  "runtimeExecutable": "scripts/celetis",
  "runtimeArgs": ["board"],
  "port": 4403
}
```

This desktop launch remains UNRUN (`docs/celetis-flow.md`, "Limits"). The terminal start below
has a separate acceptance result.

### The wiring on the trunk

The wiring must be on the trunk of `origin` before the first lane. A lane branch starts at the trunk
of `origin`, so a file that is not there is in no lane worktree: the launcher, or `.celetis.yaml`,
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
in `.celetis.yaml`. The launcher and `.celetis.yaml` need LF line endings on each host. Setup adds
the lines `scripts/celetis text eol=lf` and `.celetis.yaml text eol=lf` to `.gitattributes`. When
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
| `/celetis:plan #<n>`, in a new session | writes the plan: your steps (the human acts of the lane), tasks with a capability score, and a Verify phase | a `## Plan` comment and the label `ready-for-agent` |
| `/celetis:implement #<n>`, in a new session | builds each task (an implementer, the verify gate of the project, a review), runs the Verify phase, and lands the change with `scripts/celetis land` | the change on the trunk, and a closed issue |

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
  `scripts/celetis land <n> '<subject>'` pushes the branch, opens the PR, waits up to 15 minutes
  for the checks, and squash-merges when each check is green. It then moves the trunk of the main
  checkout to the merge, and removes the worktree and the branch.
- The other lanes are shorter. `/celetis:bug` finds the root cause, posts it as a `## Root cause`
  comment, and hands on to `plan`. `/celetis:chore` makes a change with no change of behavior: it
  verifies, commits, and lands in one session. `/celetis:hotfix` fixes broken production in one
  session, and it ends with the ship acts of the project. A request that spans some independent
  features becomes an epic, and each child issue runs its own flow.

**Through the runner.** `scripts/celetis celetis-flow <n>` starts the next step of the issue in a
new interactive session, in the terminal tab where you start it. For each step, the runner:

1. asks the resolver for the next step: `scripts/celetis next-step <n>` prints a `run` line with
   the command of the step, for example `run /celetis:plan #<n>`, or a `stop` line with the reason;
2. brings the plugin of the machine to the head of `main` ("Updates");
3. starts the selected interactive CLI in the main checkout with the host's skill prompt and
   step text. Claude uses `--permission-mode auto` and an appended system-prompt file. Codex
   uses `--no-daemon`, keeps its configured permissions, and appends the step text to effective `developer_instructions`;
4. in a herdr pane, ends the session when the issue shows that the step is done.

The runner starts at an issue: write one with `/celetis:intake`, or open one on GitHub. Then, for
the feature `#12`:

```bash
scripts/celetis celetis-flow 12    # triage
scripts/celetis celetis-flow 12    # specify: the session asks, and it waits for your approval of the design
scripts/celetis celetis-flow 12    # plan
scripts/celetis celetis-flow 12    # implement: it builds, verifies, and lands
```

With each gate `me`, one start runs one step. With a gate `auto`, a start goes on through that step
by itself, and `scripts/celetis celetis-flow` with no number is the automatic runner: it runs each
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
| | [`/celetis:setup`](skills/setup/SKILL.md) | Proposes and tests the worktree setup of a product project, writes the wiring in its main checkout, and commits and pushes the wiring after your yes. Only you can start it |

Two documents of the plugin are not skills: `docs/capability.md`, the rubric of the capability
score, and `docs/docs-lookup.md`, the lookup of the external facts.

`guide` and `setup` are explicit-only on both hosts. Claude reads `disable-model-invocation: true`;
Codex reads `policy.allow_implicit_invocation: false` in `skills/guide/agents/openai.yaml` and
`skills/setup/agents/openai.yaml`. Their shared entry also requires a human invocation. Guide
reads its custom part and gives advice; it starts no workflow command. Setup runs the launcher of
the plugin in the main checkout, and it enters no lane worktree.

## The commands

A product project runs each script through the launcher. The table gives the human terminal
and board form. Every skill call adds `--agent claude` or `--agent codex` before the sub-command:

| Command | What it does |
|---|---|
| `scripts/celetis worktree <n>` | Makes the lane worktree and the branch of the issue, or enters the one that is there, and prints its path |
| `scripts/celetis worktree --remove <n>` | Removes the lane worktree and the branch of an issue that ended with no landing by the script. It refuses while the issue is open and its branch has no merged PR, so close the issue first |
| `scripts/celetis land <n> '<subject>'` | Lands the change of the issue by the `landing` field of `.celetis.yaml`. It is the one landing path of an agent |
| `scripts/celetis next-step <n> \| --open \| --json` | The resolver: the next step of one issue, of each open issue, or the rows for the board |
| `scripts/celetis board` | Starts the board of the plugin (`board/`) with `node`, from the main YAML config; takes no arguments |
| `scripts/celetis capscore J V B N S X` | Resolves the six digits. `--json` gives portable scores and the host pair. With a Codex profile, it selects the profile by live runtime identity and needs `--runtime-models`; with no Codex profile, `dispatch.model` is null |
| `scripts/celetis celetis-flow [<n>...] \| --board \| --resume <n>` | The runner: the next step of each number, or the automatic runner with no number. `--board` prints the data of the board, and `--resume` opens the session of a step with no progress again |
| `scripts/celetis root` | Prints the install folder of the plugin. The runner uses it after an update |
| `scripts/celetis setup check \| write ... \| try ... \| try --remove \| lane <path> \| push` | The deterministic part of `/celetis:setup`: the checks, the write of the wiring, the test lane (`try` makes it and runs the worktree setup there, and `try --remove` removes it), the run of the worktree setup in a lane that exists (`lane`), and the commit with the push. The first run in a project calls the launcher of the plugin, because the project has no launcher yet |

- The form has no `./`: the `allow` rule matches the text of the command.
- Each sub-command gives the output and the exit code of its script.
- Run a command in a checkout of the product project: the plugin holds the scripts, so only the
  current folder names the project. `capscore` and `root` run in each folder.
- The launcher needs the selected host CLI and `jq`. Project commands also need the parser
  and valid config described in `docs/configuration.md`. A missing tool or invalid installation
  stops with a setup action. Codex commands require no Claude binary. The current metadata must
  explicitly mark the installation enabled; missing fields are not an old-format fallback.

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
  the next step of each product project, with no act by hand. A Codex runner instead runs
  `codex plugin marketplace upgrade celetis`. The runner holds a file lock in the selected host's
  configuration directory while it updates the plugin and resolves its installed root. Runners
  in different product projects share that lock when they use the same host configuration.

  One 120-second deadline covers the lock wait, the update commands, and the installed-root lookup. A
  failed command stops the runner with its command, exit status, and output. A timeout names the
  operation that did not finish. The runner terminates the command and its descendants before it
  releases the lock; process cleanup can take one further second. No session starts on a failure
  or when the install folder has no step text. After a successful update, the session gets the
  skills and the step text of the new version (`docs/celetis-flow.md`, "How a step runs").
- **A Claude session by hand** gets no update from the runner. The block of the project file turns
  auto-update on for the marketplace `celetis` ("Wire a product project"). An interactive session
  then updates the copy on disk at most 10 minutes after its first message. That session keeps the
  version that it loaded, and the next session loads the new one: a change reaches a session by
  hand one session late (ADR-0010, and ADR-0012, R2). The two commands bring a change at once.
- **Claude by hand, at once:** the same two commands. The second command alone can miss a commit: it makes
  no fetch for about 30 seconds after a refresh of the marketplace. The update with no `--scope`,
  `claude plugin update celetis@celetis`, moves only the `project` record of a checkout that has
  one, and a new session does not get the new version.
- **Codex by hand:** run `codex plugin marketplace upgrade celetis`, then open a new chat.
  Refresh the separate Superpowers source with
  `codex plugin marketplace upgrade superpowers-marketplace` when using the Git setup above.
  The celetis runner updates only its selected host's celetis marketplace.

The update lock serializes cooperating runners; it does not pin a running session's files.
Codex 0.162.1 can replace an installed skill's sibling file in place during a refresh. A supported
way to keep all active resources stable is not yet proved. This is an open acceptance requirement,
not a successful parity result (ADR-0014).

A bad change reaches each product project at once, and a revert on `main` is the way back. The gate
and the workflow of this repository guard only a change that lands through `scripts/celetis land`.
A direct push to `main` reaches each product project at its next step, and the workflow runs after
the push. The repository has no branch protection, so each process that has the git credential of
the maintainer can push. When a bad version stops the runner before its update, the runner does not
get the revert by itself: revert on `main`, and then run the selected host's update commands by hand.

ADR-0012 holds the evidence for one fact and one limit of Claude updates:

- **The fact:** a session loads the version of the `user` record, also when its checkout has a
  `project` record that is behind (V5b). So the update before a step needs no third command.
- **The limit:** a runner that stays open for more than 14 days after an update can lose the
  folder of its version. The cure is a new start of the runner (`docs/celetis-flow.md`, "Limits").

## The agent board

The board is `board/` of the plugin. It shows each agent session and the
next step of each issue, and starts a step with one press. Start it in the main checkout or one
of its subfolders, then open the URL on its last line:

```bash
scripts/celetis board
PORT=4500 scripts/celetis board
```

The command takes no arguments. It validates the main checkout's `.celetis.yaml` and refuses a
lane start before it starts `node`. It sends the fixed command lists through stdin to
`node <plugin>/board/cli.mjs --config-stdin` in the main checkout, where `<plugin>` is the root
of the installed plugin (`scripts/celetis root`). No second config file is made. The board validates the input and its executable paths.
Only `board.port` comes from YAML; its default is 4403. `PORT` overrides it. This repository uses
4404, so its board can run beside a board on 4403. Restart the board after a port change.
After a plugin update, start each running board again.

The producer prints contract 1. Its `agents` entries report executable availability for Claude
and Codex. Sign-in, trust, and enabled plugin discovery need their own checks.
A Run press passes the selected `{agent}` through `scripts/celetis --agent <agent> celetis-flow
<n>`. With no explicit choice, it uses `defaultAgent`: `CELETIS_AGENT`, then `host` in the main
YAML, then `claude`. Set the project default in that YAML field. A Run choice changes only that
start. The board's default-agent menu and command palette show `Default agent is read-only`.
They show the reason: `The producer controls the default agent. Change it in the producer configuration.`
Unknown or unavailable Run choices return 409 and start no agent.
Resume uses `scripts/celetis celetis-flow --resume <n>` and the saved host and exact session ID,
even after the YAML default changes. Each command item is one argument; the board quotes it
before it sends the command to herdr.

Check issue data against contract 1 in the main checkout. `scripts/celetis root` prints
`<plugin>`:

```bash
scripts/celetis celetis-flow --board | node <plugin>/board/cli.mjs check --stdin
```

`docs/celetis-flow.md`, "The board", gives the fixed command lists and card states.
[`board/README.md`](board/README.md) describes the page.
Before the plugin cutover, the maintainer completes the [manual replacement](docs/configuration.md#replace-the-old-setup)
for each product project and stops its old sessions, runners, and boards. Required CLI workflow
acceptance remains open; optional desktop evidence is separate in
[Acceptance status](docs/celetis-flow.md#acceptance-status).

## Tests

Run the tests in a checkout of this repository.

Both `tests/native-entry.test.sh` and `tests/native-observer.test.sh` need Claude Code's
`claude plugin test` runtime. The workflow pins Claude Code 2.1.302 through its
[supported npm package](https://code.claude.com/docs/en/setup#install-with-npm).
This repository test runtime is required even when product operations select Codex.
The checks need no model credentials or tokens and start no model turn.

- **The verify gate** is `scripts/verify.sh`, the fast deterministic check of a change. It lints,
  formats, and parses each tracked file that has a row, and it runs no test but the text rules. It
  sorts each path of `git ls-files` into these rows, or into an exemption with its reason in the
  script. A path that it cannot sort fails the gate.
  - Each shell file: `shfmt`, ShellCheck, and `/bin/bash -n`.
  - Each JavaScript, TypeScript, JSON, and CSS file: Biome (format, lint, and import sort), and
    `node --check` on each `.js` and `.mjs` file.
  - Each TypeScript file on Bun in `scripts/`: `tsc` with `scripts/tsconfig.json`.
  - Each jq program: `jq -f <file> /dev/null`.
  - Each workflow: actionlint.
  - `.celetis.yaml`: the config reader `celetis_config_read`.
  - The Perl updater: `perl -c`.
  - The plugin manifest: `claude plugin validate .`, which starts no model turn.
  - Each tracked file: the text rules, `tests/text.test.sh`.

  The gate runs the checks at the same time, and it takes about 7 s on 4 cores. Its last line is
  `verify: PASS`. The lines of `tests/lib/tools.txt` pin its tools, and `AGENTS.md`, "Verify
  gate", gives their install. A missing tool fails the gate. A version that differs from its pin
  prints a warning. Product projects use their own gate, and a product project needs none of these
  tools.

  ```bash
  scripts/verify.sh
  ```
- **The full suite** is `tests/suite.sh`. It runs the board suite (`(cd board && node --test)`)
  and each `tests/*.test.sh` at the same time, then `scripts/capscore.sh --test`. Its last line is
  `suite: PASS`. The board suite needs Node 22.18, or Node 24.2 or later.

  ```bash
  tests/suite.sh
  ```
- **The workflow** `.github/workflows/test.yml` runs for each pull request and each push to
  `main`. It has one job with two legs on `ubuntu-24.04`, bash 5 and bash 3.2.57, and each leg is
  a check of its own. Each leg installs Node.js 22, the pinned Claude test runtime, Mike Farah yq,
  and the tools of `tests/lib/tools.txt`. Then it runs the step "Verify gate"
  (`scripts/verify.sh`) and the step "Full suite" (`tests/suite.sh`). The 3.2.57 leg builds bash
  3.2.57 from the GNU source with a pinned checksum, caches the build, and installs it as
  `/usr/bin/bash`, which is `/bin/bash` on the runner. The workflow does not skip the contract
  check of the `--board` documents or the board-to-launcher integration test.
- **The proof on bash 3.2.** The suite runs each test as `PATH="/bin:$PATH" /bin/bash <test>`, so
  each inner `bash` reaches `/bin/bash` too. The 3.2.57 leg of the workflow proves bash 3.2 on
  each pull request. On a Mac, this command proves Apple's bash 3.2, which is `/bin/bash` there:

  ```bash
  /bin/bash tests/suite.sh
  ```
- **The text test,** `tests/text.test.sh`, holds the rules of the general text. It fails on a word
  of its list of product words in a file that is no record of `docs/adr/`. It fails on an ADR
  number that names no record of `docs/adr/` and has no `ddinkov10/fwrh_calculator` before it. It
  fails on a skill that does not start with the common host entry, or that holds a shell injection.
  It checks the shared package names and root source, required installed files, bundled links,
  the Codex invocation policy of `guide` and `setup`, and the current Claude landing rules. Launcher
  tests check Codex namespace discovery and reject missing enabled fields and ambiguous roots. These
  are deterministic structure and protocol checks; there is no `codex plugin validate` command.
- **The hand-run test,** `tests/manual/step-prompt.test.sh`, checks the step text in headless
  turns on the selected host, `--agent claude` or `--agent codex`. It needs that host to be logged
  in, it uses tokens, and an answer can
  differ between two runs, so the gate and the workflow do not run it. Run it after each change of
  `step-prompt.md`, and in a product project after each change of the part of its `AGENTS.md` on
  the celetis flow. In a product project, start it in the main checkout:

  ```bash
  bash "$(scripts/celetis --agent codex root)/tests/manual/step-prompt.test.sh" --agent codex
  ```

  The test then reads the step text of the installed plugin, and it runs its turns in that
  checkout. Use `claude` in both places for Claude. A text-only turn does not prove native
  discovery, live tools, compaction, board actions, or landing.
- **The custom-part test,** `tests/manual/custom-part.test.sh`, loads an isolated copy of the
  checkout package through Claude's real `--plugin-dir` discovery. Its 24 cases check native
  YAML reads without Bash, shell permission rules, root/subfolder/linked checkout selection,
  absent config and custom values, invalid config, a denied read, same-session handoff, and
  borrowed rules. Each entry reads exactly one active config and applies only its target text.
  The retained artifacts include source hashes, exact paths, restrictions, streams, and exit
  statuses. Claude's native hook uses metadata and normal permission-checked `Read` before
  the model sees an entry. The owned passive observer records native API results and content
  hashes; it changes no permission or result. The test installs no tool. It uses tokens and stays outside the gate and the workflow:

  ```bash
  PATH="/bin:$PATH" /bin/bash tests/manual/custom-part.test.sh \
    --output-dir /absolute/evidence
  ```

  The required Codex CLI and optional desktop probes are in `tests/manual/config-entry-codex.md`.
  A missing supported file-only reader makes that operation BLOCKED. Shell reads and deterministic
  fixtures cannot prove native no-shell entry. `tests/manual/live-acceptance.md` tracks open surfaces.

`docs/celetis-flow.md`, "Check the harness", holds the reasons behind the facts of the gate, the
workflow, the proof on bash 3.2, and the hand-run test.
