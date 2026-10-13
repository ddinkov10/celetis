# AGENTS.md

This repository is the Claude plugin `celetis`, a general agent harness: the skills (`skills/`), the
scripts (`scripts/`), the step text (`step-prompt.md`), and the documents (`docs/`). It is also a
product project of its own plugin. `README.md` holds the wiring of a product project, the commands,
and the update rule. `docs/agent-flow.md` holds the runner, and `docs/issue-tracker.md` holds the
labels, the state of an issue, and the branches.

## Verify gate

`scripts/verify.sh` is the verify gate of this repository. It passes when its last line is
`verify: PASS`.

```bash
AGENT_BOARD=<checkout of ddinkov10/agent-board>/cli.mjs scripts/verify.sh
```

- `docs/agent-flow.md`, "Check the harness", says what `AGENT_BOARD` does, and what the gate does
  with no such variable.
- `tests/text.test.sh` reads tracked files only. Run `git add` on a new file before the gate.
- Each script and each test also runs under bash 3.2, the `/bin/bash` of macOS. The proof for one
  test is `PATH="/bin:$PATH" /bin/bash tests/<name>.test.sh`.
- `tests/manual/step-prompt.test.sh` is hand-run: it is not in the gate, and it uses tokens. Run it
  after a change of `step-prompt.md`, of "Agent flow" below, or of a sentence that it quotes
  ("Traps").

## General text

A session reads a skill, the step text, and each line that a script prints inside a product
project, not here. So the text of this repository is general:

- **It names a role, not a part of a product:** "the verify gate of the project", "the trunk", "the
  design document that `AGENTS.md` names". A product line has one of three homes. The first is the
  `AGENTS.md` of the product project, for a fact that more than one step needs. The second is a
  custom part of that project (`.claude/agent-flow/custom/<skill>.md`), for an addition to one
  step. The third is no home, when a permission rule or the verify gate of that project holds the
  line already.
- **A path with no prefix is a path of the product project.** A `SKILL.md` cites a file of the
  plugin as `${CLAUDE_PLUGIN_ROOT}/<path>`, and the step text says "of the plugin `celetis`".
- **In a skill and in the step text, an ADR number says its store:** "ADR-0008 of the plugin
  `celetis`". A product project has an ADR store of its own.

`tests/text.test.sh` is the authority for the first rule, and it reads this file and `README.md`
too. It fails on a word of its list `words` in each file that is no record `docs/adr/NNNN-*.md`.
`tests/product-words.allow` allows a general use of such a word. One line of it,
`<path><tab><a part of the line>`, allows each hit of that path whose text holds the part, and a
line that allows no hit fails the test. The test knows only its list, and the rule holds for each
part of each product.

## Agent flow

The lanes of this repository are the skills of the plugin itself, on the issues of
`ddinkov10/celetis` (`README.md`, "The full loop"). The landing is `pr`
(`.claude/agent-flow/landing.json`): a build step ends with `scripts/celetis land <n> '<subject>'`,
which squash-merges the lane PR on `main` when each check of the workflow is green. The landing is
the last act of a change: this repository has no deployment, and a change on `main` is in use at
once ("Traps").

- A lane never skips a step.
- The maintainer starts the runner; an agent starts it only when its task says so, with a number,
  and in a terminal.
- A change of `skills/`, `step-prompt.md`, or `scripts/` changes the behavior of each product
  project, so its lane is `bug` or `feature`, not `chore`.

## External facts

For the lookup of `docs/docs-lookup.md`: the dependency of this repository is Claude Code.
`claude --version` prints its installed version, and its documents are
`https://code.claude.com/docs/en/<page>` (ADR-0012, "Constraints and evidence").

## Traps

Facts that no one file states. A line is here only when the code, a test, and the other documents
do not state its fact, and a line goes when its fact stops being true (ADR-0006).

- **A session here loads the installed plugin, not the files of the checkout.** Each
  `/celetis:<skill>`, the step text, and each `scripts/celetis <name>` come from the install folder,
  which holds a landed commit of `main`. So an edit changes no session until it lands and the plugin
  of the machine updates (`README.md`, "Updates"), and the tests are the proof of an edit: they run
  the files of the checkout. `claude --plugin-dir .` starts a session on the skills of the
  checkout: by the documents of Claude Code, such a plugin takes the place of the installed plugin
  with the same name. `scripts/celetis` runs the installed scripts in that session too, so run a
  script of the checkout as `scripts/<name>.sh`.
- **Each push to `main` reaches each product project at its next step.** The plugin has no version
  and no release step, and the runner updates the plugin of the machine before it starts a
  session. That session gets the new skills and the new step text. A runner process keeps the
  resolver and the launcher of its own version, so a change of `scripts/agent-flow.sh` or
  `scripts/next-step.sh` reaches a runner only at its next start. Claude Code removes the folder of
  an old version 14 days after an update, and a runner that is still open then cannot start its
  resolver (`docs/agent-flow.md`, "Limits").
- **A script file keeps its name.** `scripts/<name>.sh` is the sub-command `scripts/celetis <name>`,
  which the skills, the documents, and the files of each product project name: its `board.json`,
  and its `allow` rule `Bash(scripts/celetis land *)`. Two file names are also patterns of the
  process list. `scripts/next-step.sh` takes a landing as live only when the process of its lock
  has `land.sh` in its command line, and `scripts/agent-flow.sh` takes a lock as held only when its
  process has `agent-flow.sh` there. After a rename, a live lock looks stale: the runner ends a
  session while its landing runs, and two runners take one issue.
- **The act of a skill that moves the line of the issue is its last act.** In a herdr pane, the
  runner types `/exit` when the agent is idle and the resolver prints a new line for the issue
  (`end_when_done` in `scripts/agent-flow.sh`). A label, a comment with a heading that the resolver
  reads, a published spec, and a closed issue move the line. So each act of the skill after such an
  act is in the same turn.
- **An injected line that exits with an error aborts its skill.** Claude Code runs the last line of
  each `SKILL.md`, the line of the custom part, when it loads the skill. A line that exits with an
  error aborts the load, and the stderr of a line goes into the text of the skill (ADR-0012,
  "Constraints and evidence"). So the line ends with `2>/dev/null || true`: in a project with no
  custom part its `cat` fails, and the session still gets the skill, with no error text in it.
  `tests/text.test.sh` holds the exact line and allows no second one.
- **The hand-run test quotes the skills.** `tests/manual/step-prompt.test.sh` holds sentences of the
  skills as verbatim text, and no test of the gate compares a quote with its skill. Before you
  change a sentence of a skill, search that test for it. A change of a quoted sentence changes the
  quote in the same commit, and the hand-run test runs again.
- **The skills table and the commands table of `README.md` are written by hand.** A new skill, a
  removed skill, or a new sub-command of `scripts/` also changes the README, and no test fails when
  it does not.
- **The skills `writing-for-agents` and `prototype` are vendored** from `mattpocock/skills`
  (ddinkov10/fwrh_calculator#265).
