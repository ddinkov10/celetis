# AGENTS.md

This repository is the plugin `celetis`, a general agent harness with Claude and Codex host
operations: skills (`skills/`), scripts (`scripts/`), step text (`step-prompt.md`), and documents
(`docs/`). It is also a
product project of its own plugin. `README.md` holds the wiring of a product project, the commands,
and the update rule. `docs/celetis-flow.md` holds the runner, and `docs/issue-tracker.md` holds the
labels, the state of an issue, and the branches.

## Verify gate

`scripts/verify.sh` is the verify gate of this repository, the fast deterministic check. It passes
when its last line is `verify: PASS`. `tests/suite.sh` is the full suite. It passes when its last
line is `suite: PASS`. CI runs the gate and then the suite under bash 5 and under bash 3.2.57.

```bash
scripts/verify.sh
tests/suite.sh
```

- The pinned tools of the gate are the lines of `tests/lib/tools.txt`. On macOS, run
  `brew install shellcheck shfmt actionlint`. On Linux, run the first line below, then put
  `<dir>/bin` on `PATH`: a Python with the PEP 668 marker refuses `--user`. On Windows, run the
  first line with `py -m pip install --user` in place of `python3 -m pip install --target <dir>`.
  On each machine, run the second line.

  ```bash
  awk '$3 == "pip" { print $4 }' tests/lib/tools.txt | xargs python3 -m pip install --target <dir>
  awk '$3 == "npm" { print $4 }' tests/lib/tools.txt | xargs npm install --global
  ```
- The gate checks `.celetis.yaml` with the config reader, so it needs Bun 1.4.2 or later on
  `PATH`, as the reader does.
- A new file type gets a row or an exemption in `scripts/verify.sh`.
- The gate takes its file list from `git ls-files`. Run `git add` on a new file before the gate.
- The suite runs `(cd board && node --test)`, so it needs Node 22.18, or Node 24.2 or later.
- The tests run the config reader, so the suite also needs Bun 1.4.2 or later on `PATH`.
- Each Bash file, a script or a test, also runs under bash 3.2, the `/bin/bash` of macOS. The
  suite runs each test as `PATH="/bin:$PATH" /bin/bash <test>`, so each inner `bash` reaches
  `/bin/bash` too.
- A TypeScript file of `scripts/lib/` runs on Bun 1.4.2 or later. `scripts/lib/vendor/` holds
  vendored code: update it only as its `README.md` says.
- Each test passes in 30 s or less alone (#81). A test with many independent cases runs them with
  `tests/lib/pool.sh`. The suite runs the tests at the same time, so a test keeps its scratch state
  private and writes nothing in the checkout.
- `tests/manual/step-prompt.test.sh` is hand-run: it is not in the gate or the suite, and it uses
  tokens. Run it after a change of `step-prompt.md`, of "Celetis flow" below, or of a sentence that
  it quotes ("Traps").

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

`tests/text.test.sh` is the authority for the first rule, and it reads this file and `README.md`
too. It fails on a word of its list `words` in each file that is no record `docs/adr/NNNN-*.md`.
`tests/product-words.allow` allows a general use of such a word. One line of it,
`<path><tab><a part of the line>`, allows each hit of that path whose text holds the part, and a
line that allows no hit fails the test. The test knows only its list, and the rule holds for each
part of each product.

## Celetis flow

The lanes of this repository are the skills of the plugin itself, on the issues of
`ddinkov10/celetis` (`README.md`, "The full loop"). The landing is `pr`
(`landing` in `.celetis.yaml`): a build step ends with
`scripts/celetis land <n> '<subject>'`, which squash-merges the lane PR on `main` when each check of
the workflow is green. The landing is the last act of a change: this repository has no deployment,
and a change on `main` is in use at once ("Traps").

- A lane never skips a step.
- The maintainer starts the runner; an agent starts it only when its task says so, with a number,
  and in a terminal.
- A change of `skills/`, `step-prompt.md`, or `scripts/` changes the behavior of each product
  project, so its lane is `bug` or `feature`, not `chore`.

## The board

`board/` is the board of the plugin (ADR-0020). For a change there, follow these two rules:

- Keep the trust boundaries of `board/server.mjs` and `board/config.mjs`.
- Check a UI change in Chromium at desktop width and at 375×812.

## External facts

For the lookup of `docs/docs-lookup.md`, read `claude --version` or `codex --version` for the
selected host. Claude's documents are `https://code.claude.com/docs/en/<page>`; Codex's are
`https://learn.chatgpt.com/docs/`. Check the current CLI help and active tool schema before
using a host operation. `docs/celetis-flow.md`, "Acceptance status", separates observed versions
from open runtime checks (ADR-0014).

## Traps

Facts that no one file states. A line is here only when the code, a test, and the other documents
do not state its fact, and a line goes when its fact stops being true (ADR-0006).

- **A normal session here reads the installed plugin.** Editing the checkout does not replace
  either host's installed skills or scripts. The tests read checkout files. Claude's
  `--plugin-dir .` can load checkout skills, but `scripts/celetis` still resolves the selected
  host's installation. Run a checkout script as `scripts/<name>.sh`. Test an unlanded Codex package
  only in an isolated test installation; its launcher must still resolve that installation.
- **Each push to `main` reaches each product project at its next step.** The plugin has no version
  and no release step, and the runner updates the plugin of the machine before it starts a
  session. A failed update stops the step. A successful start uses the refreshed package.
  A Claude runner keeps the resolver and launcher paths of its started version, so a change of
  `scripts/celetis-flow.sh` or `scripts/next-step.sh` reaches it at its next start. Claude Code removes the folder of
  an old version 14 days after an update, and a runner that is still open then cannot start its
  resolver. Codex's different resource limits are in `docs/celetis-flow.md`, "Acceptance status".
- **A script file keeps its name.** `scripts/<name>.sh` is the sub-command
  `scripts/celetis <name>`, which the skills, the documents, and the files of each product project
  name: its board commands, and its `allow` rule `Bash(scripts/celetis land *)`. Two file names are
  also patterns of the process list. `scripts/next-step.sh` takes a landing as live only when the
  process of its lock has `land.sh` in its command line, and `scripts/celetis-flow.sh` takes a lock
  as held only when its process has `celetis-flow.sh` there. After a rename, a live lock looks
  stale: the runner ends a session while its landing runs, and two runners take one issue.
- **The act of a skill that moves the line of the issue is its last act.** In a herdr pane, the
  runner types `/exit` when the agent is idle and the resolver prints a new line for the issue
  (`end_when_done` in `scripts/celetis-flow.sh`). A label, a comment with a heading that the
  resolver reads, a published spec, and a closed issue move the line. So each act of the skill after
  such an act is in the same turn.
- **The hand-run test quotes the skills.** `tests/manual/step-prompt.test.sh` holds sentences of the
  skills as verbatim text, and no test of the gate or the suite compares a quote with its skill.
  Before you change a sentence of a skill, search that test for it. A change of a quoted sentence
  changes the quote in the same commit, and the hand-run test runs again.
- **The skills table and the commands table of `README.md` are written by hand.** A new skill, a
  removed skill, or a new sub-command of `scripts/` also changes the README, and no test fails when
  it does not.
- **The skills `writing-for-agents` and `prototype` are vendored** from `mattpocock/skills`
  (ddinkov10/fwrh_calculator#265).
