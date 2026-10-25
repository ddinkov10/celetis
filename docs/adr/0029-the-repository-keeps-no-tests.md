# The repository keeps no tests, and the verify gate is its only check

## Date

2026-10-25

## Related

- ddinkov10/celetis#119: the spec of this change, with the decisions of the maintainer.
- ADR-0022: the verify gate is a fast check, and the full suite runs before the landing.
  ADR-0025: the toolchain runs on TypeScript and Bun. This record changes parts of these two
  records and of ADR-0009, ADR-0011, ADR-0012, ADR-0013, ADR-0014, ADR-0016, ADR-0020, ADR-0023,
  ADR-0024, and ADR-0026 (Supersedes).
- `classify` in `scripts/verify.ts`, `toolPins` in `scripts/install-tools.ts`,
  `.github/workflows/test.yml`, `AGENTS.md`, "Verify gate", and Land step 3 of
  `skills/implement/SKILL.md`.

## Supersedes

Each part below names a test, a fixture, the full suite, the text rules, or a hand-run test of this
repository as current. This change removes them, so the part does not hold now.

From ADR-0009, "The board is a package of its own, and a contract with a version is its input":

- In "Decisions of the plan": "`fixtures/` holds the example document and the fixture scripts."
  `board/` has no `fixtures/` folder now. The rest of the flat layout stands.
- In its Consequences: "`bash scripts/agent-flow.test.sh` gives each `--board` document of its stub
  world to the checker, so the test fails when the producer leaves the contract."
  `agent-board check` stays the contract check of a producer.

From ADR-0011, "A step session hands a stop to the issue: a comment, then `ready-for-human`", the
item of its Decision "The step text has a test, `.claude/agent-flow/step-prompt.test.sh`." The step
text has no test now.

From ADR-0012, "The harness is the Claude plugin `celetis`, and each product project wires it in":

- In its Supersedes: "The test of the step text stays hand-run."
- In its Supersedes, the home of a path in a copy: "Each test `<name>.test.sh` is in `tests/`." and
  "and its test is `tests/manual/step-prompt.test.sh`". A test that a copy (ADR-0001 to ADR-0011)
  names has no home now.
- In its Decision: the words "and its CI runs the script tests on Linux"; the item "The test of the
  step text is a hand-run test."; the words "and its tests" of "The plugin also holds the scripts,
  the step text, the documents, and its tests."; "`tests/text.test.sh` is the authority" with the
  rest of its sentence; "The same test fails on an ADR reference that names no record of
  `docs/adr/` and has no such prefix."; and the two calls of the plan "Tests are in `tests/`." and
  "The text test has two more checks than the spec names". The rule of the general text stands in
  `AGENTS.md`, "General text", and no check enforces it now (Consequences).
- In its Consequences: "The tests run the files of the checkout."

From ADR-0013, "The session reads custom parts with file tools", in its Consequences: "so the live
test checks actual file reads and the selected checkout. The text gate checks that every skill
carries the read rule and no shell injection. Live tests use tokens and stay outside the repository
gate." Each skill keeps the read rule, and no check proves it now.

From ADR-0014, "One workflow uses explicit host operations", in its Consequences: the words "and
protocol fixtures" of "The local gate can check package structure and protocol fixtures without
model access." The gate still checks the package structure with `claude plugin validate .`.

From ADR-0016, "Automation is required on CLI hosts only", in its Related: the links
`[live acceptance](../../tests/manual/live-acceptance.md)` and
`[Codex native config entry](../../tests/manual/config-entry-codex.md)` as the current procedures.
Both procedures are gone. "Acceptance status" in `docs/celetis-flow.md` keeps the observed results.

From ADR-0020, "The board is a part of the plugin":

- In "Calls of the plan": "The font licence gets an allow line, not an edit.
  `tests/product-words.allow` has the line `board/fonts/OFL.txt<TAB>used to promote, endorse`."
  The licence stays unchanged, and it has a role in `scripts/verify.ts`.
- In its Consequences: "CI checks contract 1 against the board. The flow test gives each `--board`
  document to `board/cli.mjs check --stdin` of the same checkout." Contract 1 and the board
  command `check` stay. No check of this repository gives a document to `check` now.

From ADR-0022, "The verify gate is a fast check, and the full suite runs before the landing", for
this repository only:

- Decision 1: "Markdown keeps only the text rules." The gate sorts each Markdown file and each
  `skills/*/agents/openai.yaml` into the role `text`, and that role runs no check now.
- Decision 2: "The full suite runs once per issue, before the merge." This repository has no full
  suite.
- The table row "Each tracked file | the text rules, `tests/text.test.sh`".
- In "The pins in one file": "`tests/lib/tools.txt` holds one line for each tool:
  `<command> <version> <installer> <package>`." and "CI installs each package from that file." The
  pins are data in `scripts/install-tools.ts` now, and `toolPins` gives them to the gate and to the
  installer.
- The item "The full suite of this repository", which names `tests/suite.sh`.
- In "The CI legs": the words "and the step "Full suite"" of "Each leg installs the pinned tools,
  then runs the step "Verify gate" and the step "Full suite"."

The roles of a product project in ADR-0022 stay: "Two kinds of check", "The role keeps its name",
and "The `merge` rule".

From ADR-0023, "A landing re-runs a failed check of GitHub Actions once before it refuses", in its
Consequences: "This repository sets `fail-fast: false`." The workflow has one job and no matrix
now.

From ADR-0024, "The config read runs on Bun":

- In its Decision: "The test `bun_floor_agrees` keeps them equal", "The test
  `read_writes_no_cache_file` guards this.", and "The test `bun_sends_no_crash_report` guards
  this." The code keeps each rule, and no test guards it.
- In its Consequences: "For each valid case of `tests/config.test.sh`, the test checks that both
  give the same `host`." and the words "and `tests/suite.sh`" of "and then a run of
  `scripts/verify.sh` and `tests/suite.sh`." An update of `yaml` ends with a run of the verify gate
  only (`scripts/lib/vendor/README.md`).

From ADR-0025, "The toolchain runs on TypeScript and Bun":

- In its Supersedes: "The fast gate and full suite remain separate. The full suite still runs on the
  final tree before landing." For this repository, the gate is the only check, and it runs on the
  final tree before the landing.
- In its Decision: the words "test, fixture generator, manual program" of its first sentence, and
  the words "and repository test processes" of "Bun 1.4.2 or later runs command and repository test
  processes."
- In its Decision: the words "text contracts" of the checks of the fast gate.
- In its Decision: the paragraph from "The suite discovers all automatic TypeScript test entries" to
  "plus the actual process/lock subset on Linux and macOS." CI runs only the gate, on Linux with
  Bun 1.4.2.
- In its Consequences: the words "and explicit non-executed baseline assertion/caller data". The
  data files `tests/fixtures/toolchain-cases.json` and `tests/fixtures/toolchain-callers.json` are
  gone.

From ADR-0026, "The board resolves executables with libc":

- In its Constraints and evidence: "`board/realpath.test.ts` keeps that real filesystem and process
  check." and "the Linux/macOS CI process subset owns execution of the same producer regression on
  both operating systems."
- In its Consequences: "Real 0111, symlink and error cases run in the Linux/macOS process subset
  and the full suite." No check runs these cases now.

The Related lists of ADR-0011, ADR-0012, ADR-0013, ADR-0017, ADR-0018, ADR-0022, ADR-0023, ADR-0025,
and ADR-0026 name test files. No such file is in the tree now. In older records, the tests of the
Context, the Constraints and evidence, and the Alternatives considered are the proof of their time.
Except for the clauses expressly listed above, that text is history, and this record changes none
of it. This record changes no other part of these records.

## Context

The maintainer said: "remove all the tests and leave only, verify gate. also add in the
instructions to not write any tests." The reason is speed. The maintainer confirmed that this
follows the same need as ADR-0022, where the maintainer said: "every issue implementation and
verification takes too much time this is fast moving project i cant allow that".

The maintainer kept the method apart from the files: "Test Driven Development should be kept, just
i don't need test in the repo. these are separate things."

## Constraints and evidence

- The trunk at `4bc3cbc` tracked 82 files under `tests/`, and 17 test files in `board/`: 12 files
  `board/*.test.ts`, `board/test-support.ts`, and the 4 files of `board/fixtures/`.
- The full suite `tests/suite.ts` ran before each landing (ADR-0022). The token tests
  `tests/manual/step-prompt.ts` and `tests/manual/custom-part.ts` ran by hand.
- The gate depended on `tests/`: its job `text` ran `tests/text.test.ts`, and it read the pins from
  `tests/lib/tools.txt`.
- The workflow had the job `test`, with the steps "Verify gate" and "Full suite", and the job
  `processes`, which ran `tests/suite.ts --process` on `ubuntu-24.04` and `macos-14`.
- Three modes of the shipped code served only tests: `--test` of `scripts/capscore.ts`, `--outdir`
  of `scripts/build.ts`, and the native observer target of `scripts/build.ts`.
- With the landing `merge`, Land step 3 of `implement` runs "the full suite of the project in the
  lane (`AGENTS.md` names it; with no such line, the verify gate is the full suite)".
  `scripts/land.ts` runs no suite: its `check_suite` names are GitHub check suites.
- `tsconfig.runtime.json` includes each `**/*.ts` file on disk, tracked or not.
- `scripts/build.ts --check`, a job of the gate, needs exactly Bun 1.4.2.

## Decision

**The decisions of the maintainer** (spec of #119):

1. Remove every test. The verify gate is the only check of this repository. The reason is speed.
2. The rule "add no test" applies only to agents in this repository.
3. TDD stays as the method in the skills. Only the repository keeps no test.
4. `AGENTS.md` gets no TDD text.
5. The text rules go with the tests.
6. Of the shipped code, only the three test-only modes go. Exports and parameters that only tests
   use stay.
7. No last run of the hand-run step test.

**No test in the tree.** The repository tracks no test file, no test fixture, no test helper, and
no hand-run test program or procedure. Git history keeps them. No archive stays in the tree, and no
option turns them on again.

**The gate refuses a tracked test file.** `classify` in `scripts/verify.ts` fails on a path whose
file name ends in `.test`, `_test`, `.spec`, or `_spec` before a JavaScript or TypeScript
extension. Its line is
`verify: test file: <path>: this repository keeps no tests (AGENTS.md, "Verify gate")`. These are
the four suffixes that `tests/suite.ts` found.

**The checks of the gate.** `scripts/verify.ts` sorts each tracked path, refuses a prohibited
program, checks the hash of the vendored parser, and runs Biome, actionlint, the config read, the
three `tsc` runs, `scripts/build.ts --check`, and `claude plugin validate .`. Its last line stays
`verify: PASS`. The pins are data in `scripts/install-tools.ts`.

**CI.** `.github/workflows/test.yml` has one job, `test`. It checks out the tree, sets up Bun 1.4.2,
installs the pinned tools, and runs the gate. The workflow keeps the name `test`.

**TDD stays a method.** `plan`, `implement`, and `superpowers:subagent-driven-development` keep TDD
for each task. An agent here still writes a test while it works, and it commits no test.
`AGENTS.md`, "Verify gate", holds the rule "Add no test to the repository."

**For this repository only.** Product projects keep their own tests and their own full suite. The
product roles "the verify gate" and "the full suite" stay: the rows "The verify gate" and "The full
suite" of `README.md`, "`AGENTS.md`", and Land step 3 of `implement`. This record does not replace
them. The `AGENTS.md` of this repository names no full suite, so Land step 3 runs the verify gate
here, and no skill text changes for the landing.

## Alternatives considered

- **Two lanes.** The first lane makes the gate independent of `tests/`, and the second deletes the
  tests and changes the documents. The diffs are smaller. Rejected: the first lane alone gives no
  value, and the refusal of a tracked test file cannot land until the second lane.
- **Keep the files and stop running them.** Rejected: the maintainer wants no tests in the
  repository.
- **Move the text rules into gate code.** Rejected: the maintainer decided that these checks go with
  the tests.
- **Remove each export and parameter that only tests use**, for example `register` in
  `hooks/entry.ts`, or `exec` and `now` of `createBoard` in `board/server.ts`. Rejected by the
  maintainer: a removal edits shipped code, in part the trust boundary of the board, with no test
  left to show a break.

## Consequences

- A task and a landing of this repository wait for one fast check, the gate.
- **No automatic check of behavior.** A regression in `scripts/` (the runner, the locks, the
  resolver, the landing) or in the board passes the gate. The next plugin update delivers it to each
  product project. The maintainer accepted this for speed.
- **No check of the skill text.** The text rules guarded the general-text rule, the host-entry line,
  the bundled links, and the Claude permission rule that blocks a direct merge. Now only review
  finds a broken link or a product word in a skill. The skills also lose the hand-run step test.
- **Product projects lose a tool.** Each product project used the hand-run step test of the plugin
  after a change of the celetis-flow part of its `AGENTS.md`. Step 13 of `setup` ("The hand-run
  test") and the `README.md` row "The celetis flow of the project" stop pointing to it, and no
  replacement exists.
- **A scratch test in the checkout enters the type check.** `tsconfig.runtime.json` includes each
  `**/*.ts` file on disk, so an untracked scratch test in a lane can fail the job `tsc runtime`. The
  refusal sees only tracked files. The agent chooses where it keeps a scratch test.
- **Old records keep links to removed files.** ADR-0016 links `tests/manual/live-acceptance.md` and
  `tests/manual/config-entry-codex.md`. A landed record is not rewritten, so these links stay
  broken. Supersedes names them.
- **CI proves the tree only after the landing.** With the landing `merge`, no landing waits for CI.
  The workflow runs on the push to `main`, so a failure of the gate on the CI runner shows after the
  landing. The local gate on Bun 1.4.2 with the pinned tools is the proof before the landing.
- The trap "The hand-run test quotes the skills" of `AGENTS.md` ends, because
  `tests/manual/step-cases.ts` is gone.

## Reconsider when

- A regression in `scripts/` reaches a product project, and a test would have caught it.
