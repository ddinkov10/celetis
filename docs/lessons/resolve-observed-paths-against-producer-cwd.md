---
{
  "schema": 1,
  "name": "resolve-observed-paths-against-producer-cwd",
  "description": "A cleanup oracle checked a relative native draft path from the coordinator working directory",
  "tags": [
    "test",
    "false-positive",
    "e2e"
  ],
  "date": "2026-11-03",
  "status": "active",
  "source": "Final review of ddinkov10/celetis#231",
  "incidents": [
    {
      "id": "celetis-231-relative-draft-oracle-20261103",
      "date": "2026-11-03",
      "action": "The initial core cleanup oracle called existsSync on the recorded relative draft path from the coordinator cwd, rather than the native command cwd.",
      "expected": "Cleanup evidence must check the actual draft file created by the native command.",
      "observed": "Claude recorded a relative docs/superpowers/intents path. The first oracle could report absence from the lane even if a draft remained in the fixture. The reviewer corrected the check to resolve each path against its recorded cwd; the corrected check confirmed both title and body drafts were removed.",
      "source": {
        "kind": "tool-output",
        "excerpt": "Initial oracle: !existsSync(c.draft). Corrected focused check: resolve(call.cwd, call.draft). Output: claude: one canonical create; retained body matches; forbidden sentinels absent; title/body drafts removed at resolved paths.",
        "reference": "#231 final whole-branch review at 5af998f9a51744e547d81bc6923f8ae84e142823"
      },
      "inference": "The check lost the producer cwd when consuming a logged path. The actual product cleanup succeeded, so the incident is a false-positive risk in the verification oracle, not demonstrated failed cleanup.",
      "diagnosis": [
        "unknown"
      ],
      "revision": "5af998f9a51744e547d81bc6923f8ae84e142823"
    }
  ],
  "recurrences": 0,
  "reviews": [
    {
      "id": "3cec6807-9aa2-4fac-a9f9-2e3938f47a27",
      "requestDigest": "48db4a396d243c22dcf451df764b0d2e1698f8051a51b058eccb109a4681e09c",
      "date": "2026-11-05",
      "decision": "approve",
      "source": "agent review: lesson curation in the landing of #246; claude child opus/high\n\nApprove under the reviewer rules. The proposal has retained tool output: the initial oracle !existsSync(c.draft) checked a relative draft path from the coordinator cwd, and the corrected check resolve(call.cwd, call.draft) found the actual drafts removed. The rule states applicability (a check that consumes a relative path from another process), action (resolve it against that process's recorded cwd), and check (a retained-file case that fails from the correct cwd). It makes a verification check stricter, widens no permission, and agrees with the principle test-behavior-not-implementation. No live or historical lesson states this rule or holds its incident. The body labels its cause as inferred and records that the product cleanup itself passed.",
      "related": [
        "resolve-observed-paths-against-producer-cwd"
      ],
      "followUp": {
        "state": "not-needed",
        "detail": "The rule stays text for judgment at each matching task. This decision requires no structural follow-up."
      }
    }
  ]
}
---
# Resolve observed paths against their producing process

## What happened

The #231 native Claude fixture recorded a relative draft path. The coordinator checked that path from the lane cwd, which could report a missing file at the wrong location. The final reviewer resolved the path against the command cwd and verified removal of the actual title and body drafts.

## Root cause

Inferred: the verification code retained the path string but omitted its cwd from the lookup. The native behavior itself passed the corrected check.

## Fix

The temporary oracle now resolves every observed draft path against its recorded producer cwd. Proposed prevention: treat a logged relative path and its cwd as one observation. A focused probe with a file that still exists in the producer cwd must fail the cleanup assertion. This is a verification rule; no product enforcement is added.

## Rule

When a check consumes a relative path from another process, resolve it against that process's recorded working directory. Check the actual file at the resolved path. Include a retained-file case that fails from the correct cwd even when the same relative path is absent from the verifier cwd.
