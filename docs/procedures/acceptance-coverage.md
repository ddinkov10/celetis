# Acceptance coverage

Keep the mapping in the existing plan and its outcomes in the ordinary runtime report. These
are review and reporting instructions, not another requirements store or workflow stage.

## Mapping

Use the current approved feature specification as the source. For a bug, use the intended
behavior and acceptance outcomes established by its issue and latest `## Root cause` report,
including when neither has a literal `Done when` heading. A proposed fix supplies no requirement.
Ask the maintainer when acceptance meaning is missing or conflicting.

Add `## Acceptance coverage` to the plan, after its opening `### Your steps`, with this table:

| Approved criterion | Implementation work | Verification |
| --- | --- | --- |
| Quoted criterion or unambiguous phrase and source location | Named tasks or preserved behavior | Named Verify scenarios or existing permitted human checks |

Account for every approved criterion and every part of a compound criterion. Reuse task and
check names; no generated requirement IDs are required. Shared work and checks can serve several
rows, and a row can need several of each. Make each link specific enough to identify its work
and proof. For behavior already satisfied, name that behavior and its preservation verification
instead of inventing implementation work. Necessary setup or integration can support mapped
tasks without its own criterion; state its supporting purpose.

Keep an inapplicable criterion visible with its source and reason. Missing work, missing access,
or a difficult check is not inapplicability. Keep human preparation separate from a permitted
check after landing; preparation alone proves no criterion.

## Review

Compare the mapping with the current approved source, work, and checks in the existing review:

- Find each criterion or part without implementation or preservation coverage.
- Find missing checks and checks whose expected observations cannot establish the criterion.
- Find conflicting requirements or planned behavior.
- Find work with neither an approved purpose nor a necessary supporting role.

Correct omissions within approved scope before ready publication or affected build work.
When a conflict changes acceptance meaning, request a recorded maintainer decision. Keep that
work blocked until the source resolves it; neither a proposed implementation nor a repair brief
can silently weaken, remove, or invent an approved outcome. Use the caller's existing question
and stop handling. This check adds no reviewer or review round.

## Changes

Update affected references in the working plan when tasks split, checks change, or work changes.
Carry the affected coverage into the task or repair brief and its existing review or re-review,
including Verify and landing repairs. Compare changed scope against the same approved source.

A requirement change needs a recorded maintainer decision and an update to the authoritative
specification through the existing workflow before dependent work. In-scope mapping corrections
need no new plan publication; record each correction and its reason in the final runtime report
so it survives scratch cleanup. A true replan uses existing publication and starts a new build.

## Reporting

Before completion or landing, compare the mapping with the current approved source. Restore
missing rows or parts and correct stale references under "Changes"; an omitted criterion cannot
disappear from the report. For every criterion, give its source, named checks with their separate
results, evidence references, and outcome. Retain sourced inapplicability and correction reasons.

A criterion is PASS only when every required applicable check has valid passing evidence.
Keep each failed assertion FAIL, each prevented check BLOCKED with its cause, each unattempted
check unrun, and each check with missing or invalid target proof UNVERIFIED. Preserve mixed
results instead of collapsing them into PASS. A completed task, clean review, static gate, or
complete table cannot replace behavioral evidence.

Keep existing permitted after-landing checks pending until evidence exists. Apply the runtime
verification procedure's target confirmation, evidence lifetime, usage-limit exception, and
human-hold rules unchanged. Report its permission-to-land decision separately from incomplete
criterion outcomes; an exception supplies no PASS and creates no extra waiver or hold.

On built re-entry, refresh affected outcomes with renewed evidence and preserve valid unrelated
evidence. Do not rebuild completed tasks. A repeated refresh keeps the same requirements and
valid results without duplicate work. A no-plan lane keeps its existing reporting path; consume
a mapping when one exists without adding a plan stage.
