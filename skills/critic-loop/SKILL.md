---
name: critic-loop
description: Standalone scored quality review of the current result — auto-detects a branch diff (vs merge-base) or the uncommitted working diff, scores it 0-10 across five perspectives, and iterates (fix + re-score) until the threshold. Use when the user runs /celetis:critic-loop or asks to score or critique the current work.
---

# /celetis:critic-loop — scored iterative critic loop

A standalone, score-driven quality loop over the current result. It does not touch the
`implement` chain; run it ad-hoc on a branch or the working tree.

## 1. Detect scope

Read `$ARGUMENTS`:

- empty → auto-detect: on the trunk or detached HEAD → **working** diff; any other branch → **branch** diff vs `git merge-base <trunk> HEAD`. The trunk is the default branch of the repository: `gh repo view --json defaultBranchRef --jq .defaultBranchRef.name`.
- a ref or sha → **branch** diff, base = the argument (`git diff <arg>...HEAD`).
- `working` / `--working` → **working** diff (staged + unstaged).

Build the review package once and write it to a file, never into your own context:
`git diff -U10 <base>...HEAD` for a branch diff, or `git diff --cached` plus `git diff` for a working
diff, with `git diff --stat` on top. Write it to `.superpowers/critic/<scope>-<head8>.diff`.

## 2. The rubric

Five perspectives, each scored 0-2, total 0-10. **Pass: total >= 8 AND zero Critical AND zero Important.**

| perspective | what it scores |
|---|---|
| Correctness | does what it is meant to; edge cases; error handling |
| Security | secrets, auth/crypto/permission semantics, plaintext leaks |
| Tests | real behavior (not mocks), edge cases covered, pristine output |
| Structure | YAGNI, DRY, one clear responsibility, no over-engineering |
| Contracts | the touched subsystem's invariants — lifecycle, JS-to-native wire, persistence round-trip, i18n |

For the Contracts lens, read the root `AGENTS.md` and the `AGENTS.md` of each subsystem the diff
touches, and name the files you read.

Every finding carries a severity and a `file:line`, and names its perspective.

## 3. Dispatch the critic

Dispatch a fresh reviewer subagent (mid-to-high tier — set the model explicitly, an omitted model
inherits the session's most expensive one). Inputs: the diff file, the rubric above, the
Contracts-lens rule. The critic returns ONLY: a per-perspective score, the total, findings
(Critical/Important/Minor), and a PASS/FAIL verdict against the threshold. The critic never spawns
subagents and never fixes anything.

## 4. Iterate until threshold

- PASS → report the score and stop.
- FAIL → dispatch a fresh **fixer** subagent with the Critical and Important findings verbatim and
  the diff path. Score the fix with `scripts/celetis capscore J V B N S X` (`${CLAUDE_PLUGIN_ROOT}/docs/capability.md`)
  and put the CAP line first in the prompt. The fixer fixes, re-runs the covering tests, and commits.
- Re-score with a scoped re-review: verdict each finding ADDRESSED or NOT ADDRESSED, re-score the five
  perspectives, flag new breakage. New Critical or Important findings join the open list.
- Rounds 1-3 resume the same fixer; rounds 4-5 dispatch a fresh fixer on a more capable model; round 5
  still FAIL → stop, report the score and remaining findings, escalate to the user with the trail.

Never fix findings yourself in this session.

## Terminal

End with the final score (e.g. `8/10 — pass`) and the finding trail: each fix round with its
per-perspective deltas. The commits stay on the branch; this command never merges or pushes.

!`cat "$(git rev-parse --show-toplevel)/.claude/agent-flow/custom/critic-loop.md" 2>/dev/null || true`
