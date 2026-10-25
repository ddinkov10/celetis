# AGENTS.md

This repository is the plugin `celetis`, a general agent harness with Claude and Codex host
operations: skills (`skills/`), scripts (`scripts/`), step text (`step-prompt.md`), and documents
(`docs/`). It is also a
product project of its own plugin. `README.md` holds the wiring of a product project, the commands,
and the update rule. `docs/celetis-flow.md` holds the runner, and `docs/issue-tracker.md` holds the
labels, the state of an issue, and the branches.

## Host checks

Reuse the existing Claude Code and Codex CLI installations and their existing authentication.
Do not create separate signed-in installations or require another login for testing.
Use temporary test data with the existing hosts. If a check lacks access, report the specific
limitation and continue independent checks.

## Verify gate

`scripts/verify.ts` is the verify gate and the only check of this repository. Its last line is
`verify: PASS`. CI runs it on Bun 1.4.2.

Add no test to the repository. The gate refuses a tracked test file (ADR-0029).

```sh
BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 bun --no-env-file --no-install --config=/dev/null --no-macros scripts/verify.ts
```

- Install the pinned tools into a private directory, then put its `bin` folder on `PATH`:

  ```sh
  bun --no-env-file --no-install --config=/dev/null --no-macros scripts/install-tools.ts /absolute/private-tools --claude
  ```

  `scripts/install-tools.ts` owns the pins. The installer checks the official native actionlint hash.
  The gate resolves package and type paths from executable filesystem metadata. Checks install nothing.
- The gate reads `git ls-files -z`. Stage a new file before the gate. Give each new file type
  a check or an explicit role in `scripts/verify.ts`.
- Author each first-party program in TypeScript. Bun 1.4.2 or later runs commands.
  `scripts/build.ts` uses exactly Bun 1.4.2 to generate the executable launcher, browser assets,
  and native hook modules. `--check` compares bytes and modes without writes. The vendor parser
  stays unchanged; update it only as `scripts/lib/vendor/README.md` says.
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
- **A path with no prefix is a path of the product project.** A `SKILL.md` cites a file of the
  plugin as `<plugin>/<path>`, resolved by the host entry from the loaded skill path; the host-entry
  link and bundled Markdown links resolve relative to their containing file. The step text says
  "of the plugin `celetis`".
- **In a skill and in the step text, an ADR number says its store:** "ADR-0008 of the plugin
  `celetis`". A product project has an ADR store of its own.

## Celetis flow

The lanes of this repository are the skills of the plugin itself, on the issues of
`ddinkov10/celetis` (`README.md`, "The full loop"). The landing is `merge`
(`landing` in `.celetis.yaml`): a build step runs the verify gate locally, then ends
with `scripts/celetis land <n> '<subject>'`, which puts one squash commit on `main` without a PR.
The landing is the last act of a change: this repository has no deployment.
For installation changes, follow `README.md`, "Updates".

- A lane never skips a step.
- The maintainer starts the runner; an agent starts it only when its task says so, with a number,
  and in a terminal.
- A change of `skills/`, `step-prompt.md`, or `scripts/` changes the behavior of each product
  project, so its lane is `bug` or `feature`, not `chore`.
- The lanes are the skills of the plugin `celetis`, on the issues of `ddinkov10/celetis`.
- `landing` in `.celetis.yaml` names the landing mechanism, and a build step ends with `scripts/celetis land`.
- The maintainer starts the runner; an agent starts it only when its task says so, with a number, and in a terminal.

## The board

`board/` is the board of the plugin (ADR-0020). For a change there, follow these two rules:

- Keep the trust boundaries of `board/server.ts` and `board/config.ts`.
- Check a UI change in Chromium at desktop width and at 375×812.

## External facts

For the lookup of `docs/docs-lookup.md`, read `claude --version` or `codex --version` for the
selected host. Claude's documents are `https://code.claude.com/docs/en/<page>`; Codex's are
`https://learn.chatgpt.com/docs/`. Check the current CLI help and active tool schema before
using a host operation. `docs/celetis-flow.md`, "Acceptance status", separates observed versions
from open runtime checks (ADR-0014).

## Traps

Facts that no one file states. A line is here only when the code and the other documents
do not state its fact, and a line goes when its fact stops being true (ADR-0006).

- **A normal session here reads the installed plugin.** Editing the checkout does not replace
  either host's installed skills or scripts. Claude's
  `--plugin-dir .` can load checkout skills, but `scripts/celetis` still resolves the selected
  host's installation. Run a checkout script with the isolated Bun flags shown above and `scripts/<name>.ts`.
  Record checks of the checkout and checks of the installed package separately.
- **A script file keeps its name.** `scripts/<name>.ts` is the sub-command
  `scripts/celetis <name>`, which the skills, the documents, and the files of each product project
  name: its board commands, and its `allow` rule `Bash(scripts/celetis land *)`. Two file names are
  also patterns of the process list. `scripts/next-step.ts` takes a landing as live only when the
  process of its lock has `land.ts` in its command line, and `scripts/celetis-flow.ts` takes a lock
  as held only when its process has `celetis-flow.ts` there. After a rename, a live lock looks
  stale: the runner ends a session while its landing runs, and two runners take one issue.
- **The act of a skill that moves the line of the issue is its last act.** In a herdr pane, the
  runner types `/exit` when the agent is idle and the resolver prints a new line for the issue
  (`endWhenDone` in `scripts/celetis-flow.ts`). A label, a comment with a heading that the
  resolver reads, a published spec, and a closed issue move the line. So each act of the skill after
  such an act is in the same turn.
- **The skills table and the commands table of `README.md` are written by hand.** A new skill, a
  removed skill, or a new sub-command of `scripts/` also changes the README, and no check fails when
  it does not.
- **The skills `writing-for-agents` and `prototype` are vendored** from `mattpocock/skills`
  (ddinkov10/fwrh_calculator#265).
