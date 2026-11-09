# The agent text names engine outcomes

## Date

2026-11-09

## Related

- [Issue #263](https://github.com/ddinkov10/celetis/issues/263): the spec of this change. Its
  "Approaches", "Design", and "Risks" sections hold the options and the limits.
- [Issue #195](https://github.com/ddinkov10/celetis/issues/195): finding F17 of its review, which
  found the copies of engine policy and the citer count.
- [Issue #264](https://github.com/ddinkov10/celetis/issues/264): finding F18. It moves the `gh`
  forms of the agent text later, so its edits meet this change.
- [ADR-0029](0029-the-repository-keeps-no-tests.md): the repository keeps no tests. The gate
  refuses a tracked test file, so the probe of the check lives outside the repository.
- [ADR-0079](0079-one-contract-module-declares-the-commands-and-the-exit-classes.md): the contract
  module. The restatement check is a pass of `checkContract`, the same pass that binds each exit.
- `AGENTS.md`, "Where agent text lives" and "Verify gate": the placement rules and the gate that
  this record applies.

## Supersedes

- [Skills load shared procedures on demand](0047-skills-load-shared-procedures-on-demand.md): only
  the count of citers of a module. A citing module no longer counts. A module still needs two
  citers, and the skills and the step text are the citers. The rest of the rule stays.
- [Standalone engineering principles have canonical rules](0050-standalone-engineering-principles-have-canonical-rules.md):
  only the wording that a workflow caller points to the principle file when the trigger applies.
  A step lists the file at each point where the principle can apply, and it restates no trigger.
  The canonical file and the host-reference restriction stay.

## Context

The agent text copied rules that the engine already enforces. Finding F17 of #195 listed the
copies. The lane table of `engine/lib/workflow.ts` was copied into the four lane skills, into `setup`, and
into procedure modules. The label effects of the `issue` acts were copied into eight files. One copy
was already wrong: `docs/procedures/landing.md` said that `before-landing` adds
`ready-for-human`, and the engine also removes `ready-for-agent`. Seven skills paraphrased the
`Applies when` line of the principles that they cite.

The gate did not stop these copies. The citer check of `checkCitations` counted a module as a
citer of a module. A module with one skill citer passed the gate.

## Constraints and evidence

The numbers below are observed. They come from the build base `d480bc1`. That commit differs from
the plan's base `2a9e010` in no file of the agent text (`skills/`, `docs/procedures/`,
`docs/principles/`, `step-prompt.md`). It differs in 81 files in all.

- The base holds 74 agent-text files: the skills, the procedure modules, the principles, the step
  text, and `docs/procedures/entry.md`.
- The restatement check of `checkContract`, run on the base files with the new rule, refuses 17
  lines at 16 sites in 12 files. The files are `landing.md`, `lane-start.md`, `stop.md`, and the
  skills `bug`, `chore`, `feature`, `hotfix`, `implement`, `plan`, `setup`, `specify`, and
  `triage`.
- The citer check of `checkCitations`, run on the same files with the new rule, refuses three
  modules with one skill citer each: `component-research.md`, `lesson-curation.md`, and
  `lesson-format.md`.
- The new check was probed with 29 cases. Against the gate before the change, 15 cases failed and
  14 passed, as the case design expected. Against the new gate, all 29 pass. The refused forms are
  the cases R1 to R12. The passed forms are the cases P1 to P10. The citer cases are C1 to C4.
- The probe of the build found three limits, by its cases L1, L2, and L3:
  - L1: `It sets the label` with a label span passes. The verb `sets` is not in the verb list.
  - L2: `The maintainer removes` with a label span is refused. A true sentence is refused.
  - L3: `It then adds ready-for-human.` passes. A label outside a code span is not checked.
- The probe of the final review has 39 cases: the 29 cases above and ten new cases, B1 to B6 and
  L4 to L7. Against `cc84c66`, two new cases failed: B3 and B4 (only the first form of a part was
  refused). Against the fix, all 39 pass.

The check finds only the declared forms. A copy in other words passes the check.

## Decision

The agent text names the command and only the outcome that the agent acts on. The engine does
the rest, so a sentence leaves the text when the engine does that act.

- Shared text moves into one module. A module has two or more skill citers, or a skill and the
  step text. A module that one skill needs stays in that skill.
- `checkCitations` counts only the skills and the step text as citers of a module.
- `checkContract` refuses a sentence that states the label effect of an act, and a lane branch
  form. The refusal uses the labels of `labels` and the prefixes of `lanes`. The check does not
  refuse an imperative or a noun form.
- A step lists the principle files that can apply at that step. The agent reads each listed file
  and applies each one whose `Applies when` holds. The trigger has one home, the principle file.

The gate holds the text true to the contract. The text does not need to repeat the contract.

## Alternatives considered

- Edit the text and change the citer count only. This removes the present copies. It adds no check
  against a new copy, so copies can return with no failed check. The issue found this pattern in
  F17.
- Generate the copies from the contract, as `scripts/build.ts` writes the README tables. The agent
  does not act on the tables. Generated text would also make the plugin text depend on the engine
  build.
- Keep the trigger in the wrapper skill description, read from the host listing. This needs two
  copies of each trigger. The step then depends on a host listing that Celetis does not control.

## Consequences

- A new copy in a declared form fails the gate, outside a fenced block and outside the limits
  below.
- The agent reads more text at a step. The cost is about 20 lines for each listed principle. The
  longest list today has six principles, about 120 lines.
- The check is a heuristic. It finds only its declared forms. A correct sentence in a
  third-person form must use other words. The probe observed these limits, each by its case:
  - L1, L2, and L3, as above.
  - P10: a declared form in a fenced block passes. Fenced code lines are not checked.
  - L4: ``It keeps e.g. `bug`.`` passes. The sentence ends at `e.g.`, before the label span.
  - L5: ``The kept `ready-for-human` label.`` is refused. The adjective `kept` counts as the verb.
  - L6: ``It removes the lane worktree, as `hotfix` does.`` is refused. A lane or a state name in
    a code span counts as a label, because `labels` holds `bug`, `chore`, `hotfix`, `epic`, and
    `wontfix`.
  - L7: ``(It adds a note.) See `epic`.`` is refused. A sentence does not end at `.)`.
  - B1, B2, and B6: a path segment or a ref that holds a lane prefix followed by `/` and a digit
    or `/<` is refused. `docs/feat/12-x.md`, `refs/heads/feat/12-x`, and `origin/feat/12-x` each
    give an error.
  - B3 and B4: each branch form of a part is refused. `Use feat/1-a or fix/2-b here.` and the span
    `feat/1-a fix/<n>-b` each give two errors.
  - B5: `A chore/2026 report.` is refused. A lane prefix with `/` and a digit is the declared form,
    also when the sentence names no branch.
- The change adds no README change, no command, and no exit class.

## Reconsider when

- A principle list at one step grows so that the read is too large. The remedy is to read only the
  `Applies when` section of each listed file.
- A copy of engine policy returns in a form that the check does not declare. Then add the form to
  the check in a new record.
- The lanes, the labels, or the acts of `engine/lib/workflow.ts` or `engine/lib/contract.ts` change
  their names or their form, so that the check no longer matches the declared forms.
