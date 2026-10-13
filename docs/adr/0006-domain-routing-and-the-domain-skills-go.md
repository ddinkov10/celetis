# Domain routing and the domain skills go, and their trap facts live in the AGENTS.md files

## Date

2026-10-11

## Related

- #419: the issue, with the evaluation that is the evidence below
- `docs/research/domain-skill-routing.md`: the research note on the routing layer. Its verdict was
  to make the router smaller and keep it. This decision goes further than that verdict, on the
  evidence of the evaluation, which the note asked for in its step 6 ("Measure")
- Root `AGENTS.md` (*Traps*), `backend/api/AGENTS.md`, `backend/src/AGENTS.md`,
  `frontend/AGENTS.md`: the new home of the trap facts
- `.claude/skills/{bug,hotfix,chore,specify,plan,implement,critic-loop}/SKILL.md`: the steps that
  read `routing.md` or named a domain skill
- #420: a bug candidate that only a domain skill recorded

## Context

Each lane step sent a change to one of 13 domain buckets. `bug`, `hotfix`, `specify`, `plan`,
`chore`, and `critic-loop` read `.claude/skills/routing.md` (about 12k tokens for each read). `plan`
wrote the bucket into the plan as `Bucket:`, and `implement` told each implementer to invoke the
skill of that bucket and each reviewer to apply its `## Review pass`. `/bootstrap-routing` made the
table, and `skill-pair-drift-sync` was a second drift pass for the table and the 13 skills.

The maintainer asked for the removal of this layer in #419, after an evaluation in four
repositories.

## Constraints and evidence

From the evaluation that #419 records. Each task ran with and without the domain knowledge, and a
result is the number of runs that passed.

- **This repository, a new `eyes_closed` Rejection Reason:** the `quality-gate` skill 3/3, a
  path-scoped rule 3/3. Without `routing.md`, the agent invoked the skill from its description in
  3/3 runs.
- **An Expo application, designed tasks:** a coupling that the code shows, 3/3 against 3/3. A fact
  that only the history holds (a feature that was shipped and reverted), 0/3 without against 3/3
  with.
- **A public repository of one 4,581-line file, held-out replay:** rules made from the history
  before a cutoff, then 6 later real bug fixes, each scored by its own tests: 8/12 against 8/12.
  All five rules matched the one file, so path scoping selected nothing.
- **A clean-architecture repository with nested `AGENTS.md` files, held-out replay:** 3 later
  fixes, 4/9 against 6/9. The full difference came from one task, where one rule line named the
  quantity helper of that repository.
- **Total:** no measured gain on 12 of 14 tasks. The two gains came from one history fact and one
  helper name. One line in an instruction file carries each.
- **Cost:** about equal for each run.
- **Risk:** one generated rule stated the behavior of a drift gate before its fix as an invariant
  and as a review check. The agents fixed the code, and no agent updated the rule.

From the work on #419 in this repository:

- Most trap lines of the 13 skills repeated a comment in the code, a test, `DESIGN.md`,
  `PRODUCT.md`, `CONTEXT.md`, an ADR, a research note, the runbook, or the regression README.
  24 lines and 1 clause stated a fact that no file held; they moved.
- One trap was false: `fwhr-domain` said that the README lists the Alternative and Averaged
  methods. #285 removed them from the README, and the skill kept the line.
- One skill recorded a defect as a contract note: `analysis-logs` said that `METRICS_RE` does not
  accept the `capture=` field of the current success line. The defect is real, and it had no issue
  (#420 now holds it).
- Claude Code loads the root `AGENTS.md` at the start of a session and each subsystem `AGENTS.md`
  when it reads a file in that folder, so a trap line there needs no router and no skill call.

## Decision

- **No step routes a change to a domain.** `routing.md`, `/bootstrap-routing`,
  `skill-pair-drift-sync`, and the 13 domain skills go. A step that read the table now reads the
  root `AGENTS.md` and the `AGENTS.md` of each subsystem that the change touches. `docs/adr/` and
  `docs/lessons/INDEX.md` stay in the steps that read them.
- **A plan has no `Bucket:` line**, and `implement` adds no skill call to a dispatch. The area of a
  commit subject is the package or the concern.
- **A trap fact lives in an `AGENTS.md` file.** The root file holds the couplings that cross
  subsystems, the engine trap, and the build and harness traps, under *Traps*. Each subsystem file
  holds the traps of its folder. A line is there only when the code, a test, and the other docs do
  not state its fact, and a line goes when its fact stops being true.
- **The rule for a dependency bump moves to `/chore`:** the changelog lookup and the
  `## External facts` section of the PR body.
- **`doc-drift-sync` is the one drift pass.** Each `AGENTS.md` was already in its scope.

The `quality-gate` pilot rule, its lint test, and `docs/agents/domain-rules.md`, which #419 also
names, are on no branch of the repository, so this change removes no such file.

## Alternatives considered

- **Keep the layer.** It costs about 12k tokens at each step that reads the table, 15 skill
  descriptions in each session, and a second drift pass, and the evaluation measured no gain from
  it.
- **Make `routing.md` smaller and keep the skills** (the verdict of the research note). This cuts
  the cost of the table. But the evaluation measured the domain knowledge itself, not only the
  table, and found no gain on 12 of 14 tasks.
- **Keep the skills with no router**, selected by their descriptions. The agent did select the
  skill in 3/3 runs. But the skill gave the same result as no skill, and each skill still needs the
  drift pass.
- **Path-scoped rules** (`.claude/rules/` with `paths:`). They gave the same result as the skill
  in this repository, and in a repository of one file they selected nothing.
- **A generator that makes domain rules for each repository.** A generated rule stated a defect as
  an invariant, and no agent corrected it. #419 lists the generator as "Not now".

## Consequences

- A lane step no longer reads about 12k tokens of table, and 15 skill descriptions leave the skill
  list of each session. One drift pass stays.
- The root `AGENTS.md` grows by 12 trap lines, and each session loads them.
- A reviewer has no `## Review pass` list for a domain. The gate, the tests, and the review steps
  of `implement` stay.
- The procedures of a domain (regenerate the baseline, add a corpus image, promote, add a route)
  have one home each: the regression README, the runbook, `DESIGN.md`, and the ADRs.
- A trap line can become false, as a skill line did. The rule above limits the number of lines,
  and `doc-drift-sync` checks them against the code.
- A plan that an issue already holds can still carry a `Bucket:` line. `implement` does not read
  that line.
- `docs/research/domain-skill-routing.md` describes the layer as it was on its date.

## Reconsider when

- A measured replay on this repository shows a gain from domain knowledge that one line of an
  `AGENTS.md` file cannot carry.
- An agent breaks a coupling that a *Traps* line states, more than one time: the lines are then not
  read, or not at the correct time.
- The *Traps* section of the root `AGENTS.md` grows past about 30 lines.
- Claude Code stops loading a subsystem `AGENTS.md` when it reads a file in that folder.
- The repository gets a subsystem whose rules are not in the code, a test, or a doc (for example
  the payment flow of ADR-0001).
