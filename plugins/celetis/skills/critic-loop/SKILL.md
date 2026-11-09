---
name: critic-loop
description: Standalone scored quality review of the current result — auto-detects a branch diff (vs merge-base) or the uncommitted working diff, scores it 0-10 across five perspectives, and iterates (fix + re-score) until the threshold. Use when the user runs /celetis:critic-loop or asks to score or critique the current work.
---

**Celetis entry.** Before any step or response, including commentary or an announcement, bind `<plugin>` to the absolute prefix before `/skills/<name>/SKILL.md` in the path of this loaded file. Then read `<plugin>/docs/procedures/entry.md` whole, in one read, and follow it before any product-path scan. Do this on each invocation, including a same-session handoff.

# /celetis:critic-loop — scored iterative critic loop

A standalone, score-driven quality loop over the current result. It does not touch the
`implement` chain; run it ad-hoc on a branch or the working tree.

## 1. Detect scope

Read the invocation input:

- empty → auto-detect: on the trunk or detached HEAD → **working** diff; any other branch → **branch** diff vs `git merge-base <trunk> HEAD`. The trunk is the default branch of the repository: `gh repo view --json defaultBranchRef --jq .defaultBranchRef.name`.
- a ref or sha → **branch** diff, base = the argument (`git diff <arg>...HEAD`).
- `working` / `--working` → **working** diff (staged + unstaged).

Build the review package once and write it to a file, never into your own context:
`git diff -U10 <base>...HEAD` for a branch diff, or `git diff --cached` plus `git diff` for a working
diff, with `git diff --stat` on top. Write it to `.superpowers/critic/<scope>-<head8>.diff`.

## 2. The rubric

Five perspectives, each scored 0-2, total 0-10. **Pass: total >= 8 AND zero accepted Critical AND
zero accepted Important**, subject to the evidence and material-risk disposition below.

| perspective | what it scores |
|---|---|
| Correctness | does what it is meant to; edge cases; error handling |
| Security | secrets, auth/crypto/permission semantics, plaintext leaks |
| Tests | real behavior (not mocks), edge cases covered, pristine output |
| Structure | YAGNI, DRY, one clear responsibility, no over-engineering |
| Contracts | the invariants of the touched subsystem, as its `AGENTS.md` states them |

For the Contracts lens, read the root `AGENTS.md` and the `AGENTS.md` of each subsystem the diff
touches, and name the files you read.

Every finding carries a severity and a `file:line`, names its perspective, and carries its evidence
category and record per `<plugin>/docs/procedures/review-evidence.md`.

## 3. Dispatch the critic

Dispatch a fresh reviewer per `<plugin>/docs/procedures/dispatch.md`, "One child", scored as a
review with `celetis --agent <host> capscore J V B N S X --reviewer --json`, per
`<plugin>/docs/procedures/capability-score.md`, "The rubric — six dimensions, each 0–2" and
"Scorecard format — MANDATORY". Its brief also holds the diff file, the review rubric of step 2,
and the Contracts-lens rule. Deliver the exact applicable principle paths with the diff to the
critic and each fixer, with instructions to read them.
Include `<plugin>/docs/procedures/review-evidence.md` and
`<plugin>/docs/principles/demonstrate-behavioral-defects.md` in those resolved references. Read the
module and apply "Reviewer" to the critic's brief, including each scoped re-review.
Resolve `<plugin>` to the absolute path bound by the entry. Take paths supplied with the affected
tasks; derive missing paths from the reviewed changes and revise them for the fix scope. Read
`<plugin>/docs/principles/test-behavior-not-implementation.md` and
`<plugin>/docs/principles/explain-the-number.md`. Apply each one whose `Applies when` holds for
the review and each finding, with its `Check`. The rubric score alone does not make
`explain-the-number.md` apply.
The critic returns the per-perspective scores, total, findings with severity, category and
evidence, and a verdict under the threshold and evidence contract. The critic never spawns
subagents and never fixes anything.

## 4. Iterate until threshold

Apply `<plugin>/docs/procedures/review-evidence.md`, "Receiving session" and "Repairs and
disposition", before accepting PASS or dispatching a fixer, and after each scoped re-review.
Use its stop for unresolved material risks, including a risk-only report with a high score.

- Accepted PASS → report the score and finding dispositions, then stop.
- First FAIL with accepted Critical or Important findings → dispatch a fresh **fixer** subagent
  per `<plugin>/docs/procedures/dispatch.md`, "One child", scored for the fix with
  `celetis --agent <host> capscore J V B N S X --json`, per
  `<plugin>/docs/procedures/capability-score.md`, "The rubric — six dimensions, each 0–2" and
  "Scorecard format — MANDATORY". Its brief also holds the accepted Critical and Important
  findings and evidence, the unresolved context outside the fix list, the diff path, and the exact
  applicable principle and review-evidence module paths for the fix. The fixer fixes, re-runs the
  covering tests, and commits.
- Resume the same critic for a scoped re-review: verdict each finding ADDRESSED or NOT ADDRESSED, re-score the five
  perspectives, flag new breakage. Newly accepted Critical or Important findings join the open list.
- Rounds 1-3 resume the same fixer; rounds 4-5 dispatch a fresh fixer on a more capable tier (resolve the original fix score with `--attempt 3` and its explicit bias); round 5
  still FAIL → stop, report the score and remaining findings, escalate to the user with the trail.

Never fix findings yourself in this session.
When the score fails without accepted Critical or Important findings, report the remaining gap and stop by
`<plugin>/docs/procedures/stop.md`, "The two modes"; invent no defect to start a fix round.

## Terminal

End with the final score (e.g. `8/10 — pass`) and the finding trail: each fix round with its
per-perspective deltas, evidence categories, and disposition reasons. Keep unresolved risks and
any sourced maintainer disposition visible. The commits stay on the branch; this command never
merges or pushes.
