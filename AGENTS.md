# AGENTS.md

This repository is the plugin `celetis`, a general agent harness with Claude and Codex host
operations: skills (`skills/`), modules (`docs/procedures/`), runtime (`engine/`), maintenance
(`scripts/`), step text (`step-prompt.md`), and documents (`docs/`). It is also a
product project of its own plugin. `README.md` holds the wiring of a product project, the commands,
and the update rule. `docs/celetis-flow.md` holds the runner, and `docs/issue-tracker.md` holds the
labels, the state of an issue, and the branches.

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

## Verify gate

`scripts/verify.ts` is the verify gate and the only check of this repository. Its last line is
`verify: PASS`. CI runs it on Bun 1.4.4.

Add no test to the repository. The gate refuses a tracked test file (ADR-0029).

```sh
BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 bun --no-env-file --no-install --config=/dev/null --no-macros scripts/verify.ts
```

- Install the pinned tools into a private directory, then put its `bin` folder on `PATH`:

  ```sh
  bun --no-env-file --no-install --config=/dev/null --no-macros scripts/install-tools.ts /absolute/private-tools --claude
  ```

  `scripts/install-tools.ts` owns the pins. On Windows, omit `--claude`: the installer refuses it. The installer checks the official native actionlint hash.
  The gate resolves package and type paths from executable filesystem metadata. Checks install nothing.
- The gate reads `git ls-files -z`. Stage a new file before the gate. Give each new file type
  a check or an explicit role in `scripts/verify.ts`.
- Author each first-party program in TypeScript. Bun 1.4.4 or later runs commands.
  `scripts/build.ts` uses exactly Bun 1.4.4 to generate browser assets, native hook modules,
  and the help block of `README.md` from `engine/lib/help.ts`. `--check` compares bytes, and modes on macOS and Linux, without
  writes. The vendor parser stays unchanged; update it only as `engine/lib/vendor/README.md` says.
- Strict types have three environments: runtime commands and server modules;
  browser DOM modules; and the native hook API and its actual globals.

## General text

A session reads a skill, the step text, and each line that a script prints inside a product
project, not here. So the text of this repository is general:

- **It names a role, not a part of a product:** "the verify gate of the project", "the trunk", "the
  design document that `AGENTS.md` names". A product line has one of three homes. The first is the
  `AGENTS.md` of the product project, for a fact that more than one step needs. The second is a
  custom part of that project (`custom.<skill>` in `.celetis.yaml`), for an addition to one
  step. The third is no home, when a permission rule or the verify gate of that project holds the
  line already.
- **A path with no prefix is a path of the product project.** A skill, a module, and the step
  text cite a file of the plugin as `<plugin>/<path>`. The entry line of a skill binds `<plugin>`
  from the path of the loaded `SKILL.md`; on Claude Code, the `- plugin:` line of the entry block
  gives it. The step text takes `<plugin>` from the entry and compares it with the plugin root of
  its header. A relative Markdown link in a plugin file resolves relative to its containing file.
- **In a skill, a module, and the step text, an ADR number says its store:** "ADR-0008 of the
  plugin `celetis`". A product project has an ADR store of its own.

## Where agent text lives

Agent text has three layers:

| Layer | Home | Loads |
| --- | --- | --- |
| Entry | The facts block of the Claude Code hook, or `docs/procedures/entry.md` | At each skill invocation |
| Skill | `skills/<name>/SKILL.md` | When the skill is invoked |
| Module | `docs/procedures/<name>.md` | When a step of a skill names it |

One placement rule decides the home of each piece of agent text (ADR-0047):

1. **Shared procedure.** Text that two or more skills, or a skill and the step text, need is a
   module. The skills cite it at the step that uses it.
2. **Own procedure.** Text that one skill needs stays in that skill.
3. **Host-specific text** lives only in modules, under a `Claude Code` and a `Codex` part. A skill
   never names a host tool. The exception is the entry block of the hook, which carries the Claude
   Code part of the contract.
4. **Engine-enforced policy** is not restated. A skill names the command, and only the outcomes
   that the agent must act on (exit classes, printed lines).
5. **Product text** has two homes. `custom.<skill>` is an addition to that one skill and reaches
   only its invocation. A product fact that two or more skills need goes into the `AGENTS.md` of
   the product.
6. **Maintainer reference.** `docs/celetis-flow.md`, `docs/configuration.md`, `docs/capability.md`,
   `docs/issue-tracker.md`, `docs/hosts/`, and the ADRs are never read at entry. A skill or a
   module cites a named section of one when a step needs a definition; none cites `docs/hosts/`.

A module is self-contained: it cites another module only for a branch that some runs take. No
skill reads another skill's `SKILL.md`. A module stays short enough to read whole in one native
read, with a target of under 100 lines; a longer module starts with a `## Contents` list of its
sections. `checkCitations` in `scripts/verify.ts` checks the skills, the modules, and the step
text: each `<plugin>/<path>` citation and each relative link names a tracked file, each module
has two or more citers, each `SKILL.md` holds the entry line of `docs/procedures/entry.md` once,
and no skill or module cites `docs/hosts/`.

## Celetis flow

The lanes of this repository are the skills of the plugin itself, on the issues of
`ddinkov10/celetis` (`README.md`, "The full loop"). The landing is `merge`
(`landing` in `.celetis.yaml`): a build step runs the verify gate locally, then ends
with `celetis --agent <host> land <n> '<subject>'`, which runs `suite` (`scripts/verify.ts`) on the commit that it lands and puts one squash commit on `main` without a PR.
The landing is the last act of a change: this repository has no deployment.
For installation changes, follow `README.md`, "Updates".

- A lane never skips a step.
- The maintainer starts the runner; an agent starts it only when its task says so, with a number,
  and in a terminal.
- A change of `skills/`, `step-prompt.md`, the program entry `celetis`, `engine/`, or `scripts/` changes the behavior of each product
  project, so its lane is `bug` or `feature`, not `chore`.
- The lanes are the skills of the plugin `celetis`, on the issues of `ddinkov10/celetis`.
- `landing` in `.celetis.yaml` names the landing mechanism, and a build step ends with `celetis --agent <host> land`.
- The maintainer starts the runner; an agent starts it only when its task says so, with a number, and in a terminal.

## The board

`engine/board/` is the board of the plugin (ADR-0020). For a change there, follow these two rules:

- Keep the trust boundaries of `engine/board/server.ts` and the fixed adapter `engine/board/adapter.ts`.
- Check a UI change in Chromium at desktop width and at 375×812.

A look decision of the board uses these three facts:

- The kind is web, with the default row of `prototype` (`docs/procedures/ui.md`, "The platform
  rows").
- The design document is `engine/board/README.md`, "The layout, the keys, and the errors".
- A prototype board with live data starts in the prototype checkout. A throwaway script there calls
  `startBoard` of `engine/board/start.ts` with the main checkout, a port other than 4404, and an
  adapter whose `run` and `resume` reject. The server reads its page files from its own folder
  (`HERE` in `engine/board/server.ts`), so the variants show with the live issues and sessions.
  After an edit of a page module, `scripts/build.ts` writes its browser files in that checkout.

## External facts

For the lookup of `docs/procedures/docs-lookup.md`, read `claude --version` or `codex --version` for the
selected host. Claude's documents are `https://code.claude.com/docs/en/<page>`; Codex's are
`https://learn.chatgpt.com/docs/`. Check the current CLI help and active tool schema before
using a host operation. `docs/celetis-flow.md`, "Acceptance status", separates observed versions
from open runtime checks (ADR-0014).

## Traps

Facts that no one file states. A line is here only when the code and the other documents
do not state its fact, and a line goes when its fact stops being true (ADR-0006).

- **A normal session here reads the installed plugin and runs the installed program.** Editing
  the checkout replaces neither. A `--plugin-dir .` session reads the checkout's skills with the
  installed program, so a check of a changed command runs the checkout's entry by its path:
  `"$PWD/celetis" --agent claude <command>`. Record checks of the checkout and checks of the
  installed program separately.
- **A script file keeps its name.** `engine/<name>.ts` keeps the same sub-command basename.
  Skills, product instructions, board commands, and personal landing rules refer to that command.
  On macOS and Linux, two basenames also identify lock owners. Through `processRunsScript`,
  `engine/next-step.ts` accepts a live landing only when its process command line contains
  `land.ts`, and `engine/lib/locks.ts` accepts a runner only when it contains `celetis-flow.ts`.
  A rename makes a live owner look stale. The runner can then end a session during landing, or
  two runners can take one issue. On Windows, owners match by PID and creation time instead
  (ADR-0034).
- **The skills table and the commands table of `README.md` are written by hand.** A new skill, a
  removed skill, or a new sub-command of `engine/` also changes the README, and no check fails when
  it does not. `scripts/build.ts` writes only the block of the commands that a person types. A new
  command that a person types goes into `engine/lib/help.ts`.
- **The skill `writing-for-agents` is vendored** from `mattpocock/skills`
  (ddinkov10/fwrh_calculator#265).
