---
{
  "schema": 1,
  "name": "run-a-project-config-tool-from-the-project-root",
  "description": "A Verify run of impeccable detect from a scratch folder missed the project ignores of .impeccable/config.json and reported their findings as a FAIL",
  "tags": [
    "config",
    "false-positive",
    "e2e"
  ],
  "date": "2026-11-15",
  "status": "active",
  "source": "The implement session of #326 on Claude Code, Verify phase V4, 2026-11-15",
  "incidents": [
    {
      "id": "24688292-3edb-490a-8e77-f98a7b5096af",
      "date": "2026-11-15",
      "action": "The Verify child ran `impeccable detect --json --viewport <W>x<H> http://127.0.0.1:4431/` with its working folder at the scratch folder of the run, not at the lane root, and reported V4 as FAIL.",
      "expected": "A tool that reads a project configuration (here `.impeccable/config.json` with its detector ignores) runs with its working folder at the root of the project checkout under test, so the result reflects the project's committed settings.",
      "observed": "Exit 2 at 1440x900 and 375x812 with `overused-font` (geist) and `nested-cards` findings, both of which the committed `.impeccable/config.json` ignores for http://127.0.0.1:*; the same command from the lane root gave exit 0 and `[]` at both sizes.",
      "source": {
        "kind": "tool-output",
        "excerpt": "First run: working folder ...scratchpad/326/verify (the scratchpad, NOT the lane): exit 2 at both sizes (overused-font geist, nested-cards on .empty-needs/.empty-running/.empty-idle). Second run: the same command with the working folder at the lane root: --viewport 1440x900 exit 0, JSON []; --viewport 375x812 exit 0, JSON [].",
        "reference": "https://github.com/ddinkov10/celetis/issues/326 (Runtime verification for #326, V4)"
      },
      "inference": "Tool output plus inference: detect resolves its project config from the working folder, and the Verify brief named the evidence folder but not the working folder of the scan. Alternative: detect could also take an explicit config path; not checked.",
      "diagnosis": [
        "not-retrieved"
      ],
      "revision": "5b770ecdd289285ebd98e66a02ab19503d3a7be0",
      "brief": "The Verify brief cited design.md, \"The detect scenario\", and named the scratch folder for scripts; it named no working folder for detect."
    }
  ],
  "recurrences": 0,
  "reviews": [
    {
      "id": "dfe724e1-3562-4d59-b064-2695de756cac",
      "requestDigest": "a0246320290b8efc983f8f33affa29b6ccdffb686f2c908d0e8591e6d0d50027",
      "date": "2026-11-15",
      "decision": "approve",
      "source": "agent review: lesson curation in the landing of #326; claude child opus/high\n\nApprove (reviewer rule: approve a proposal that no other rule rejects, merges, replaces, or skips). The evidence is observed tool output: the same detect command gave exit 2 from the scratch folder and exit 0 with [] from the lane root, at both sizes. No active or historical lesson holds this incident or this rule; resolve-observed-paths-against-producer-cwd covers relative paths of another process, not the working folder of a configured tool. The rule states applicability, action, and check, and adds no permission, network act, or credential act. It agrees with \"The check\" of the design procedure of the plugin, which runs the context verb from the root of the product. Correction of a prior claim: the incident diagnosis `not-retrieved` names no lesson that existed and was not retrieved; the evidence supports `unknown` or `wrong-or-incomplete-rule` (the brief named no working folder). The incident stays unchanged.",
      "related": [
        "run-a-project-config-tool-from-the-project-root"
      ],
      "followUp": {
        "state": "proposed",
        "detail": "Structural follow-up, not authorized here: \"The detect scenario\" of the design procedure of the plugin could state the root of the product as the working folder of detect, and a check could refuse recorded detect evidence from another folder."
      }
    }
  ]
}
---
# Run a tool that reads a project configuration from the project root

## What happened

In the Verify phase of #326, `impeccable detect` ran from the scratch folder of the run. It reported exit 2 with `overused-font` and `nested-cards` findings. The committed `.impeccable/config.json` of the lane ignores both findings for the local board URLs. The same command from the lane root gave exit 0 and no finding at both sizes.

## Root cause

Inference: `detect` reads `.impeccable/config.json` (and `DESIGN.md`) from its working folder. The brief named a scratch folder for the scripts and no working folder for the scan, so the child used the scratch folder. Unverified alternative: an explicit config option of the tool.

## Fix

Proposed prevention (text): a brief or a recipe that runs a project-configured tool names the project checkout as its working folder, and the report records that folder. A structural follow-up needs separate authorization: the design procedure's detect scenario could state the working folder in its command form; a check would reject a recorded V4 command whose folder is not the checkout under test.

## Detection signature

A detector or linter reports findings that the project's committed configuration ignores or disables.

## Rule

Applies when a check runs a tool that reads a configuration of the project (for example `impeccable detect`, a linter, a formatter) against a product checkout. Action: run the tool with its working folder at the root of the checkout under test, and record that folder with the command in the evidence. Check: the evidence names the working folder equal to the checkout root, and a finding that the committed configuration ignores does not appear in the result.

## Related lessons

[[verify-exception-matching-against-runtime-identities]]
[[state-the-limits-of-a-check-from-a-probe-of-its-configuration]]
