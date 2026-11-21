---
name: maintain-verification
description: Check every mapped verification flow against source and live behavior
disable-model-invocation: true
---

**Celetis entry.** Before any step or response, including commentary or an announcement, bind `<plugin>` to the absolute prefix before `/skills/<name>/SKILL.md` in the path of this loaded file. Then read `<plugin>/references/procedures/entry.md` whole, in one read, and follow it before any product-path scan. Do this on each invocation, including a same-session handoff.

# Maintain verification recipes

1. **Resolve the map.**
   - Read the project's instructions and
     `<plugin>/references/procedures/verification-recipes.md`.
   - Apply "Recipe content" and "Explicit operations" to the existing pointer and document
     home.
   - With no map, report the missing target and recommend explicit
     `/celetis:create-verification`; create no map.
   - Declare the entries present at the start as this run's coverage boundary.
2. **Review every entry.**
   - Check index links and each mapped flow against current source and intended behavior.
   - Repair source-confirmed instruction drift and broken links.
   - Remove an entry only when source and requirements establish that it is obsolete, and
     record why.
   - A failing or unreachable flow is not obsolete.
   - Report unmapped surfaces as coverage gaps for a later explicit creation request; keep
     them outside this live pass.
3. **Exercise the whole remaining map.**
   - Read `<plugin>/references/procedures/runtime-verification.md` and apply
     "Confirming a target", "Evidence lifetime", and "Reports and deferred checks".
   - Record the absolute report destination before execution.
   - One coordinator executes every remaining mapped flow, including entries with no source
     drift.
   - Reuse a confirmed target only while its identity and state remain valid.
   - Recover a failed or uncertain target before dependent checks, within the authorization
     and ownership rules of "Explicit operations".
   - Compare final instructions with the execution record under "Recipe content"; changed
     executable instructions need renewed affected live evidence.
4. **Classify gaps and preserve corrections.**
   - A working flow that the available tools cannot drive is a capability gap.
   - Behavior that violates the intended result is a product defect.
   - Report both without changing product code or weakening expected results.
   - Ambiguous behavior stays unresolved; ask for the missing decision.
   - Keep unavailable prerequisites BLOCKED and unknown targets UNVERIFIED.
   - Continue independent checks and retain useful documentation corrections when another
     flow cannot pass.
5. **Account for the whole run.**
   - The report gives every initial entry its source review and live result, or its
     supported removal reason.
   - Account for owned cleanup.
   - Confirm that the report and failure evidence remain readable.
   - Report **complete/no edits** when every remaining flow has a current valid PASS and no
     correction was needed, or **complete/corrections** when all pass after documentation
     repairs.
   - Any FAIL, BLOCKED, or UNVERIFIED mapped flow makes the result **incomplete**, even
     after a successful source review.
   - A mapped flow on a host that the project does not use is inapplicable by
     `<plugin>/references/procedures/runtime-verification.md`, "Used hosts". It needs no PASS for
     a complete result, keeps its entry, and the report shows it with its source and reason.
   - Save the report by the runtime procedure and link it in the final reply, with the
     changed document paths and unresolved gaps.
