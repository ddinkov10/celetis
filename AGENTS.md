# AGENTS.md

Celetis is a software factory harness: the process and the runtime around coding agents that take
each change of a product through its lifecycle. The goal is intent to release. Today a change goes
from intent to the trunk, and each product project does its own release. Celetis has two modules.
The plugin `celetis` holds skills and instructions for inline use with any agent; today the hosts
are Claude Code and Codex. The engine has the command `celetis` and a daemon, which runs the
phases of the SDLC as autonomous workflows. The plugin names roles, and each product project names
its own parts, so Celetis fits different types of product.

This repository holds both modules. The plugin is the folder `plugins/celetis/`: skills
(`plugins/celetis/skills/`), procedure modules (`plugins/celetis/references/procedures/`), principles
(`plugins/celetis/references/principles/`), step text (`plugins/celetis/step-prompt.md`), and documents
(`plugins/celetis/docs/`). The engine is the folder `engine/`, with its entry `engine/celetis`. The
repository also holds maintenance (`scripts/`), the host documents (`docs/hosts/`), the explanation documents (`docs/explanation/`), and the
records (`docs/adr/`, `.celetis/lessons/`). It is also a product project of its own plugin.
`plugins/celetis/README.md` holds the install, the full loop, the skills, the commands, and the
update rule. `plugins/celetis/docs/setup.md` holds what setup writes.
`plugins/celetis/docs/workflow.md` holds the steps of a run as a session and a person meet them.
`engine/README.md` holds the daemon and the runs, `engine/board/README.md` holds the board, and
`scripts/README.md` holds the checks. `plugins/celetis/docs/issue-tracker.md` holds the labels, the
state of an issue, and the branches.

## Plugin development

Celetis development uses this repository's issue, checkout, and verification evidence. A change
can be designed, built, verified, and landed with no product adopters, including a breaking
change. Do not discover, enumerate, inspect, prepare, modify, or wait for other product
repositories, or require their commits, updates, readiness evidence, or approval. Each product
maintainer owns adoption and wiring; installation and update are separate explicit operations.
A missing host capability remains a limitation of the Celetis check; product adoption cannot
replace that evidence. Commands still require the active project's own configuration, issue
state, and permissions. [ADR-0031](docs/adr/0031-plugin-development-is-independent-of-adoption.md)
records this boundary and supersedes the historical coordination requirements.

## Host checks

Reuse the existing Claude Code and Codex CLI installations and their existing authentication.
Do not create separate signed-in installations or require another login for testing.
Use temporary test data with the existing hosts. If a check lacks access, report the specific
limitation and continue independent checks.

A check that uses the Herdr app or the hc core runs in a lab of `scripts/herdr-lab.ts`, never in
the maintainer's window or core. The lab runs on macOS and Windows. One lab serves one Verify run.
The setup runs `up` once and records the lab id. Each scenario runs its commands through
`run <id> <command>…`: the entry of the checkout, a board script, and each `hc` and `herdr-app`
read. The phase ends with `down <id>`. Run the script with the bun flags of the verify gate
command. Such a check needs no consent and no human act. A check of the daemon, a run, or the
board takes its issues from a fake `gh` first on `PATH`.
That `gh` answers `gh api` from local files, for a local fixture repository with no remote. So the
check needs no GitHub repository, no real issue, and no human step. The lab scenarios before the
landing are the whole Herdr proof of a change, so `### Your steps` lists no Herdr check, also not
after the landing. When `up` fails, its scenarios have no PASS and stay out of the maintainer's
window.

## Verify gate

`scripts/verify.ts` is the verify gate and the only check of this repository. Its last line is
`verify: PASS`. CI runs it on Bun 1.4.4.

Add no test to the repository. The gate refuses a tracked test file (ADR-0029).

```sh
BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 bun --no-env-file --no-install --config=/dev/null --no-macros scripts/verify.ts
```

- Install the locked packages of the engine into `engine/node_modules` first, in a checkout with
  no `engine/node_modules`, and again after a change of `engine/bun.lock`:

  ```sh
  bun --no-env-file --no-install --config=/dev/null --no-macros scripts/worktree-setup.ts "$PWD"
  ```

  A new lane worktree runs it as its worktree setup (`worktreeSetup` in `.celetis.yaml`). It
  comes before the tool install, because `scripts/install-tools.ts` imports the engine.
- Install the pinned tools into a private directory, then put its `bin` folder on `PATH`:

  ```sh
  bun --no-env-file --no-install --config=/dev/null --no-macros scripts/install-tools.ts /absolute/private-tools --claude
  ```

  `scripts/install-tools.ts` owns the pins. On Windows, omit `--claude`: the installer refuses it. The installer checks the official native actionlint hash.
  The gate resolves package and type paths from executable filesystem metadata. Checks install nothing.
  The `merge` landing runs the gate as its suite in the master daemon, with the environment of
  the shell of `celetis daemon start`, so start the daemon from a shell with that `bin` folder on
  `PATH`.
- The gate reads `git ls-files -z`. Stage a new file before the gate. Give each new file type
  a check or an explicit role in `scripts/verify.ts`.
- Author each first-party program in TypeScript. Bun 1.4.4 or later runs commands.
  `scripts/build.ts` uses exactly Bun 1.4.4 to generate browser assets, native hook modules,
  the generated blocks of `plugins/celetis/README.md` and `plugins/celetis/docs/issue-tracker.md` from `engine/lib/contract/contract.ts`,
  and `docs/adr/index.md` from the records of `docs/adr/`. `--check` compares bytes, and modes on macOS and Linux, without
  writes.
- The packages of the engine are the exact pins of `engine/package.json`, locked in
  `engine/bun.lock`. To change a pin, edit `engine/package.json`, run `bun install --ignore-scripts`
  in `engine/`, and commit both files.
- Strict types have three environments: runtime commands and server modules;
  browser DOM modules; and the native hook API and its actual globals.

The gate refuses a tree whose plugin (`plugins/celetis/contract.json`) needs a contract version that the
engine does not serve (`engine/lib/contract/versions.json`). It also refuses a change of the declarations
of `engine/lib/contract/contract.ts` that keeps the digest of the newest served version. The fix is a new version:
add the printed digest to `engine/lib/contract/versions.json`. At each raise, the maintainer chooses
whether the old version stays served (the old plugin text still runs with the new engine) or goes (it
cannot). Raise `plugins/celetis/contract.json` too when the plugin text needs the new version. The
digest covers no prose field (`description`, `help`, `meaning`, `prerequisite`, `writes`).
[ADR-0090](docs/adr/0090-a-contract-version-replaces-the-same-revision-rule.md) records the rule and the known gaps of the digest.

## General text

A session reads a skill, the step text, and each line that a script prints inside a product
project, not here. So the text of this repository is general:

- **It names a role, not a part of a product:** "the verify gate of the project", "the trunk". A
  product line has one of three homes. The first is the `AGENTS.md` of the product project, for a
  fact that more than one step needs. The second is a custom part of that project
  (`custom.<skill>` in `.celetis.yaml`), for an addition to one step. The third is no home, when a
  permission rule or the verify gate of that project holds the line already.
- **A path with no prefix is a path of the product project.** A skill, a module, a principle,
  and the step text cite a file of the plugin as `<plugin>/<path>`. The entry line of a skill binds
  `<plugin>` from the path of the loaded `SKILL.md`; on Claude Code, the `- plugin:` line of the
  entry block gives it. The step text takes `<plugin>` from the entry and compares it with the
  plugin root of its header. A relative Markdown link in a plugin file resolves relative to its
  containing file. In this repository, `<plugin>/<path>` is the file `plugins/celetis/<path>`.
- **In a skill, a module, a principle, and the step text, an ADR number says its store:**
  "ADR-0008 of the plugin `celetis`". A product project has an ADR store of its own.

## Where agent text lives

Agent text has four layers:

| Layer | Home | Loads |
| --- | --- | --- |
| Entry | The facts block of the Claude Code hook, or `plugins/celetis/references/procedures/entry.md` | At each skill invocation |
| Skill | `plugins/celetis/skills/<name>/SKILL.md` | When the skill is invoked |
| Procedure module | `plugins/celetis/references/procedures/<name>.md` | When a step of a skill names it |
| Principle | `plugins/celetis/references/principles/<name>.md` | When a step cites it, or when its wrapper skill is invoked |

The folders of `plugins/celetis/` follow one layout rule (ADR-0095). `references/` holds the agent
text that more than one caller can load: the procedure modules and the principles. A file that only
one skill reads lives in the folder of that skill, for example the ADR guide and the ADR template
in `plugins/celetis/skills/record-architecture-decisions/`. `docs/` holds only documents that
people read.

One placement rule decides the home of each piece of agent text (ADR-0047, with the principle
exception in [ADR-0050](docs/adr/0050-standalone-engineering-principles-have-canonical-rules.md)):

1. **General principle.** A general engineering rule has one canonical file in
   `plugins/celetis/references/principles/`, regardless of caller count. It has `Applies when`, `Rule`,
   and `Check` sections. A skill or a workflow step cites the file at the step where it can apply.
   The agent applies it when its `Applies when` holds, and the caller restates no trigger. The
   rule body stays in the file.
2. **Shared procedure.** Text that two or more skills, or a skill and the step text, need is a
   module. The skills cite it at the step that uses it.
3. **Own procedure.** Text that one skill needs stays in that skill: in its `SKILL.md`, or in a
   file of its folder that only that skill reads.
4. **Host-specific text** lives only in modules, under a `Claude Code` and a `Codex` part. Skills
   and principles never name a host tool. The exception is the entry block of the hook, which
   carries the Claude Code part of the contract.
5. **Engine-enforced policy** is not restated. A skill names the command, and only the outcomes
   that the agent must act on (exit classes, printed lines).
6. **Product text** has two homes. `custom.<skill>` is an addition to that one skill and reaches
   only its invocation. A product fact that two or more skills need goes into the `AGENTS.md` of
   the product.
7. **Maintainer document.** `plugins/celetis/docs/workflow.md`,
   `plugins/celetis/docs/setup.md`, `plugins/celetis/docs/configuration.md`,
   `plugins/celetis/docs/capability.md`, `plugins/celetis/docs/issue-tracker.md`, `docs/hosts/`, and the
   ADRs are never read at entry. A skill or a module cites a named section of one when a step needs a
   definition. Skills, modules, and principles never cite `docs/hosts/`. `engine/README.md`,
   `engine/board/README.md`, and `scripts/README.md` are maintainer documents of the engine that no
   agent text cites, because the installed plugin has no `engine/` and no `scripts/`.

A module is self-contained: it cites another module only for a branch that some runs take. No
skill reads another skill's `SKILL.md`. A module stays short enough to read whole in one native
read, with a target of under 100 lines; a longer module starts with a `## Contents` list of its
sections. A principle stands alone and has no minimum citer count. It holds no workflow or host
procedure, and entry does not load a principle catalog.

`checkCitations` in `scripts/verify.ts` checks the skills, the procedure modules, the principles,
and the step text: each `<plugin>/<path>` citation names the tracked file `plugins/celetis/<path>`,
each relative link of a Markdown file in `plugins/celetis/` names a tracked file in that folder,
each procedure module has two or more citers among the skills and the step text (a citing module
does not count), each `SKILL.md` holds the entry line of `plugins/celetis/references/procedures/entry.md`
once, and no skill, module, or principle cites `docs/hosts/`. The gate refuses a TypeScript file
in `plugins/celetis/`: the TypeScript source stays in `engine/` and `scripts/`.

The same check reads three more rules. First, when a code span `<plugin>/<path>.md` is followed by
`, "Name"` (more names follow as `, "Name"`, `and "Name"`, or `, and "Name"`), each name must equal
exactly one heading of that file; a name that matches no heading, or two headings, is an error. A
white-space run in a name or a heading counts as one space; inline code in a heading keeps its
backticks. A setext heading counts, and a heading inside a fence does not (P14, R3). A quoted phrase
that does not follow `, ` right after the span is not read (P15). Second, a citation of
`<plugin>/docs/<name>.md` (a maintainer document) with no quoted name after the span is an error.
Rules one and two cover only the agent text, not a document such as `workflow.md` (P16). Third, the
fragment of each relative link, also a link that starts with `#`, must be a GitHub heading slug of a
tracked Markdown file in `plugins/celetis/`; a repeated heading gets `-1`, `-2`, and an HTML `id` is
no target (R10). The labels in parentheses name cases of the probe in the plan of #264
(https://github.com/ddinkov10/celetis/issues/264#issuecomment-6737386356).

`checkContract` in `scripts/verify.ts` checks the same files against `engine/lib/contract/contract.ts`
(ADR-0079). Each code span or fenced line that starts with `celetis` must match a declared form.
Each exit code in prose must be a class of a command that its block names. The block is its
paragraph, heading, or table row, or its list item with its lead: the paragraph just before the
list, or the parent item of a nested list. A code span or a fenced line that starts with `celetis`
names its command, and so does a code span of two or more words that matches a declared form.
When the block names no command, a code span of another program (`otherPrograms`) in the block
skips the exit. Every other exit fails.

The same pass refuses a restated policy (ADR-0084), with a message that names the file and the line,
and tells the author to name the act and the outcome that the agent acts on. It has two forms. The first is a sentence with
one of the verbs `adds`, `added`, `removes`, `removed`, `keeps`, `kept`, `retains`, `retained`,
`restores`, `restored`, `clears`, or `cleared`, followed in the same sentence by a code span that
is a label of `labels` in `engine/lib/contract/contract.ts`. A cell, a paragraph of an item, and a code
block each end a sentence. The second is a code span or prose with a lane branch prefix of `lanes`
in `engine/lib/workflow/workflow.ts` (or a `|`-list of them) followed by `/<` or by `/` and a digit. Fenced
code lines are not checked. The probe of #263 observed the limits below, and ADR-0084 lists each
limit with its case. Other words pass: `It sets the label` with a label span gives no error (L1).
A true sentence in a third-person form is refused: `The maintainer removes` with a label span
gives an error (L2). A label outside a code span passes: `It then adds ready-for-human.` gives no
error (L3). A lane or a state name in a code span counts as a label, because `labels` holds `bug`,
`chore`, `hotfix`, `epic`, and `wontfix`: ``It removes the lane worktree, as `hotfix` does.``
gives an error (L6). A path segment or a ref that holds a lane prefix followed by `/` and
a digit or `/<` is refused: `docs/feat/12-x.md` and `origin/feat/12-x` give an error (B1, B6).

## Celetis workflow

The lanes of this repository are the skills of the plugin itself, on the issues of
`ddinkov10/celetis` (`plugins/celetis/README.md`, "The full loop"). The landing is `merge`
(`landing` in `.celetis.yaml`): a build step runs the verify gate locally, then ends
with `celetis --agent <host> land <n> '<subject>'`, which runs `suite` (`scripts/verify.ts`) on the commit that it lands and puts one squash commit on `main` without a PR.
The landing is the last act of a change: this repository has no deployment.
For installation changes, follow `plugins/celetis/README.md`, "Updates".

- The maintainer starts the daemon and turns auto mode on; an agent starts a run only when its task
  says so, with a number, and in a terminal.
- A change of `plugins/celetis/skills/`, `plugins/celetis/step-prompt.md`, `engine/`, or `scripts/` changes the behavior of each product
  project, so its lane is `bug` or `feature`, not `chore`.

## The board

`engine/board/` is the board of the engine (ADR-0020). For a change there, follow these two rules:

- Keep the trust boundaries of the trust files: `engine/board/perimeter.ts`,
  `engine/board/requests.ts`, `engine/board/presses.ts`, the fixed adapter `engine/board/adapter.ts`,
  `engine/board/coordinator.ts`, `engine/board/chat/chat.ts`, `engine/board/chat/claude.ts`,
  `engine/board/chat/codex.ts`, `engine/board/update/worker.ts`, `engine/board/start.ts`, the page
  modules of `engine/board/page/`, `engine/lib/board-read/board-read.ts`,
  `engine/lib/workflow/visual.ts`, `engine/lib/state/fields.ts`, `engine/lib/state/schemas.ts`,
  `engine/lib/host/names.ts`,
  `engine/lib/terminal/terminal.ts`, `engine/lib/workflow/effort.ts`, `engine/lib/process/process.ts`,
  `engine/lib/update/updater.ts`, `engine/lib/install/installation.ts`,
  `engine/lib/install/dependencies.ts`, `engine/lib/queue/queue.ts`, `engine/lib/queue/types.ts`,
  `engine/lib/coordinator/coordinator.ts`, `engine/lib/coordinator/types.ts`,
  `engine/lib/host/codex/app-server.ts`, `engine/lib/daemon/server.ts`, and
  `engine/lib/daemon/types.ts`.
  `engine/board/README.md`, "The trust boundary", maps each file to its rules.
- Check a UI change in Chromium at desktop width and at 375×812.

A look decision of the board uses these two facts:

- The kind is web, with the default row of `prototype` (`plugins/celetis/references/procedures/ui.md`, "The platform
  rows").
- A prototype board with live data starts in the prototype checkout. That checkout first runs the
  install command of "Verify gate", `scripts/worktree-setup.ts "$PWD"`. A throwaway script there calls
  `startBoard` of `engine/board/start.ts` with the main checkout, a port other than 4404, an
  adapter, and the context `{ env: process.env, revision, successor: false, versioned: false,
  restarting: () => false, restart: () => {} }`, and keeps its process alive. The
  adapter rejects each method except two: `status` answers a fixed status with auto mode off, and
  `coordinator` answers `null`. So the item `Daemon` shows `auto off`, the queue shows its read
  view, and the control Coordinator shows `no session`. The server reads its page files from its own folder
  (`HERE` in `engine/board/perimeter.ts`), so the variants show with the live issues and sessions.
  After an edit of a page module, `scripts/build.ts` writes `engine/board/board.js` in that checkout.

## The engine layout

Put a new file of the engine library or the board in a feature folder (ADR-0114):

- `engine/lib/` holds only feature folders. A file directly in `engine/lib/` goes
  into the folder of its feature.
- Name a folder by a noun of the engine (`daemon/`, `run/`, `host/`), never by the kind of code
  (`types/`, `utils/`). A folder nests one more level for a sub-feature or one peer of a set
  (`host/claude/`).
- The head file of a folder has the name of the folder (`queue/queue.ts`). The other files drop
  the prefix that the folder states (`queue/actions.ts`).
- Two `.ts` files of one folder of `engine/lib/` or `engine/board/`, at any depth, never share the
  part before the first hyphen (`x-a.ts` and `x-b.ts`, or `x.ts` and `x-a.ts`): give them a folder.
- Each import names the real file; the engine has no `index.ts` or `mod.ts`.

`checkLayout` of `scripts/verify.ts` refuses a file directly in `engine/lib/` and a pair of the
fourth rule. The other rules have no check.

## Decision records

`docs/adr/index.md` names, for each record of `docs/adr/`, the later records that replace parts of
it. A record after ADR-0080 names in its `## Supersedes` section only the records that it replaces in
part, each by a Markdown link to its file, for example
`[The board is a part of the engine](0035-the-board-is-a-part-of-the-engine.md)`. A mention for
context goes to `## Context` or `## Related`. `scripts/build.ts` writes the index, and refuses a repeated record number and a `## Supersedes`
section that it cannot resolve.

## External facts

For the lookup of `plugins/celetis/references/procedures/docs-lookup.md`, read `claude --version` or `codex --version` for the
selected host. Claude's documents are `https://code.claude.com/docs/en/<page>`; Codex's are
`https://learn.chatgpt.com/docs/`. Check the current CLI help and active tool schema before
using a host operation. `plugins/celetis/docs/workflow.md`, "Acceptance status", separates observed versions
from open runtime checks (ADR-0014).

## Traps

Facts that no one file states. A line is here only when the code and the other documents
do not state its fact, and a line goes when its fact stops being true (ADR-0006).

- **A normal session here reads the installed plugin and runs the installed engine.** Editing
  the checkout replaces neither. A `--plugin-dir plugins/celetis` session reads the checkout's skills with the
  installed engine, so a check of a changed command runs the checkout's entry by its path:
  `"$PWD/engine/celetis" --agent claude <command>`. Record checks of the checkout and checks of the
  installed engine separately.
- **A script file keeps its name.** `engine/<name>.ts` keeps the same sub-command basename.
  Skills, product instructions, board commands, and personal landing rules refer to that command.
  On macOS and Linux, one basename also identifies a lock owner: `engine/lib/state/locks.ts` accepts a
  daemon only when its process command line contains `daemon.ts`. A rename makes a live owner
  look stale. The daemon can then end a session during a landing, or two daemons can take one
  issue. On Windows, owners match by PID and creation time instead (ADR-0034).
- **The skills table of `plugins/celetis/README.md` is written by hand.** A new skill or a removed skill also changes
  the README, and no check fails when it does not. A new command, form, act, or exit class goes into
  `engine/lib/contract/contract.ts`; `scripts/build.ts` writes from it the help block, the command table, and
  the exit-class table of `plugins/celetis/README.md`, and the act table of
  `plugins/celetis/docs/issue-tracker.md`.
- **The skill `writing-for-agents` is vendored** from `mattpocock/skills`
  (ddinkov10/fwrh_calculator#265).

<!-- CELETIS:START -->
## Celetis

Use the installed `celetis` skills for changes in this project.
Follow an explicitly requested Celetis skill. For a new request with no
recorded intent or lane, start with `celetis:intake`. For an existing issue,
follow its current Celetis step.

Keep project-specific instructions outside this block. Celetis setup
refreshes the text between these markers.
<!-- CELETIS:END -->
