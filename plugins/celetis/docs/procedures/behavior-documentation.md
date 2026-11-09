# Current behavior documentation

## Assessment

Read and apply `<plugin>/docs/principles/preserve-intended-behavior.md`. Locate the smallest
affected sections in existing current project documents. Use the active change's approved spec
or accepted lane intent and applicable decisions. For historical drift, follow relevant document
references and scoped Git history to the associated issues and decisions, including explicit
later supersession. Keep the lookup bounded to the affected behavior.

Compare the intended behavior, source or runtime behavior, and document claim separately:

- If implementation matches intent and the document is stale or incomplete, update that section.
- If the document contradicts established intent, correct it against that approval and check the
  resulting claim against implementation. Retain any implementation defect in the report.
- If implementation violates intent, fix it only within the lane's authorized scope; otherwise
  report it through the existing defect or stop path.
- If evidence is missing, inaccessible, ambiguous, or conflicting, leave disputed behavioral
  prose unchanged. Report the exact difference, evidence found, and missing decision or access.

Leave correct text untouched. A no-impact assessment needs at most a short reason in the
existing work record. When no suitable existing home exists, report the scoped gap there;
create no store or document solely for checklist compliance.

## Change work

During planning, put affected document sections and supporting evidence into the existing task
that owns the behavior. Apply this assessment to a hotfix micro-plan and a chore without adding
a feature-spec step.

Before completion, make the smallest required edit in the document's existing style. Include
the assessment, evidence, and edits in the existing task and final review; a chore uses its
existing session check and report before gates and commit. Documentation joins the lane's
commits and checks, with no standalone drift invocation, extra drift commit, or separate ledger.

A relevant unresolved discrepancy prevents an unqualified completion claim. Use the caller's
existing question, stop, and review handling. Report an unrelated pre-existing discrepancy
without expanding the change or blocking independent safe work.

## Standalone drift

Apply the assessment within the drift skill's scan boundary. Source-backed mechanical repairs
need no historical approval lookup when the behavioral claim stays unchanged. For a behavioral
correction, retain both approval and source evidence. Report implementation defects; this pass
edits no product code. Leave disputed prose unchanged while making independent safe corrections.
Exclude historical records and scratch specs or plans from edits.

Use the existing drift report and local docs-only commit. For each behavioral commit entry,
name the supporting approved intent and the source evidence; a mechanical entry needs only
its source evidence. Keep the skill's no-push rule.

## Repairs and re-entry

Reassess only behavior affected by a repair or later change, including gate repairs, final-review
fixes, Verify fixes, and landing fixes. Carry the affected sections, evidence, and unresolved
discrepancies into the existing repair brief and review; the chore session carries them in its
existing check and report. Keep the existing review counts and dispatch controls.

On re-entry, retain valid prior edits and assessments. Check changed behavior and any unresolved
relevant discrepancy before completion or landing, including when the build is already marked
built. Repeating a completed assessment creates no duplicate document, ledger, or drift commit.
