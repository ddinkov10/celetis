---
name: accept-epic
description: Check an epic's declared outcomes and complete the parent when current evidence permits it.
argument-hint: "#<issue number>"
disable-model-invocation: true
---

**Celetis entry.** Before any step or response, including commentary or an announcement, bind `<plugin>` to the absolute prefix before `/skills/<name>/SKILL.md` in the path of this loaded file. Then read `<plugin>/docs/procedures/entry.md` whole, in one read, and follow it before any product-path scan. Do this on each invocation, including a same-session handoff.

# /celetis:accept-epic — check the parent outcome

Input: `#<n>`. The maintainer starts this explicit session. An epic has no lane worktree, build,
or landing. This skill changes no retained product code and does not rebuild completed children.

## 1. Read the current scope

Resolve the project's main checkout with `git worktree list --porcelain` and bind issue commands
there. Keep its branch and existing changes. Read its applicable `AGENTS.md` files and the project
context needed for the combined behavior. Use session-owned scratch files for checks.

Read `<plugin>/docs/issue-tracker.md`, "Epics", "Epic acceptance declaration", and "Epic acceptance
submission". Run `celetis --agent <host> issue <n> epic-state`. Read the current parent body,
children, ordered history, evidence, and holds. Read linked child and repair issues when their
scope or evidence affects acceptance. Repeat these reads on each attempt; old reports are leads,
not current proof.

- **Closed:** report the observed state and end, with no new acceptance PASS.
- **Unresolved declaration:** read `<plugin>/docs/procedures/epic.md` and obtain a sourced scope
  decision. A question opt-out supplies no independent classification. Preserve the parent body
  and publish the agreed definition through `issue <n> epic <file>`, then read its current state.
- **Independent:** run `celetis --agent <host> issue <n> complete-epic` without runtime work. Report
  its actual result. Use step 3 for a remaining block.
- **Combined:** continue with step 2. Pending children alone require no human hold. Run available
  scenarios at their declared timing, including before child closure when permitted.

## 2. Prove the combined outcome

Read `<plugin>/docs/procedures/acceptance-coverage.md`, "Mapping", "Review", and "Reporting".
Use the approved parent criteria and current declaration as the source. Keep their coverage in
the ordinary runtime report; the parent needs no implementation plan. Retain every criterion
part, including obligations of a child closed as `not_planned`. Ask for a recorded maintainer
decision before changing acceptance meaning or declaring a criterion inapplicable.

Read `<plugin>/docs/procedures/verification-recipes.md` and the project's relevant existing
recipes. Read `<plugin>/docs/procedures/runtime-verification.md` and apply target confirmation,
evidence lifetime, and reporting. Identify a safe current target. A dirty checkout needs its
retained source snapshot; do not switch its branch or install a plugin to obtain proof. Unknown
loaded source stays UNVERIFIED with the exact missing link.

Run each available scenario and its independent oracle. Keep PASS, FAIL, BLOCKED, unrun, and
UNVERIFIED results separate. Continue checks independent of a failure or access block. Preserve
valid unrelated evidence; renew affected proof after a source change, restart, reload, or target
switch. Clearing a hold supplies no runtime evidence. The usage-limit exception can permit a
child landing only; a required BLOCKED parent check still prevents parent completion.

Publish the ordinary runtime report on the parent before completion. Keep criterion sources,
separate results, source and target identities, both loading links, oracle observations, durable
evidence references, cleanup, and remaining gaps together. Retain sourced inapplicability.

## 3. Resolve remaining work

Preserve existing holds. Direct their verified completion to assistance through
`<plugin>/docs/procedures/assisted-completion.md`; acceptance clears none. Assistance ends after
its own completion. The maintainer then re-enters this skill; no run starts for the parent.

For a repair, read existing linked repair issues first. Reuse the issue that covers the failed
criterion. If none exists, create and link a repair issue by the recipe of
`<plugin>/docs/procedures/epic.md`, "The children", with a brief naming the failed parent criterion
and its evidence. Keep repairs in existing child lanes. A retry reuses this work and does not alter
a completed child build.

When this session cannot resolve a required decision, access need, or repair, publish a
heading-free file naming that exact block and required contribution, then run
`celetis --agent <host> issue <n> stopped <file>` and end. A question remains open until answered;
record its unresolved block when the session must end. Write no `Built` or `Before landing` on
an epic. A pending child alone is a normal wait: report it without a hold.

## 4. Submit current acceptance

When every required applicable check has valid PASS evidence, re-read `epic-state`. Review
coverage against the current definition and child snapshot, then review evidence lifetime
immediately before submission. Renew only affected results. With a remaining hold or pending
child, retain the report and end with the actual wait.

Prepare the exact envelope of `<plugin>/docs/issue-tracker.md`, "Epic acceptance submission",
and copy the current repository, parent, hash, and exact child snapshot from `epic-state`. Add the
current review identity, targets, results, and published parent comment references. Run
`celetis --agent <host> issue <n> complete-epic <file>`. The engine checks shape and freshness;
this session checks evidence truth, semantic coverage, and current targets.

Exit 0 of `issue <n> complete-epic <file>` reports completion or an already closed parent; distinguish them. Exit 2 requires corrected
input. Exit 3 requires current prerequisite or coverage review. Exit 6 requires the entry's
approval procedure for access failures and the partial-write repair of
`<plugin>/docs/procedures/epic.md`, "A partial write". Re-read state before retrying; retain
valid evidence and never replay an uncertain write blindly. Report the confirmed outcome and end.
