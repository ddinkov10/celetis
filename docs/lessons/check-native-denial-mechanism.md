---
{
  "schema": 1,
  "name": "check-native-denial-mechanism",
  "description": "A native denial fixture used the wrong path anchor and then removed the tool instead of denying its call",
  "tags": [
    "test",
    "platform-quirk",
    "e2e"
  ],
  "date": "2026-11-03",
  "status": "active",
  "source": "Native Verify fixtures of ddinkov10/celetis#231",
  "incidents": [
    {
      "id": "celetis-231-native-denial-fixture-20261103",
      "date": "2026-11-03",
      "action": "The verification controller used Read(/private/tmp/...) as an absolute deny rule, then used bare Read to obtain a denied entry read.",
      "expected": "The native host keeps Read available but denies exactly the fixture configuration read.",
      "observed": "The first pattern did not match and feedback filed in the fake tracker. Bare Read removed the tool and entry stopped with no tool named Read. Current official permission docs state that absolute paths need // and bare deny names remove tools. A scoped Read(//private/tmp/...) then produced the intended permission denial and no feedback calls.",
      "source": {
        "kind": "tool-output",
        "excerpt": "First fixture: one fake issue created. Second: Celetis entry stopped: celetis: $.tool.call: no tool named \"Read\" in this session. Corrected: File is in a directory that is denied by your permission settings.",
        "reference": "https://code.claude.com/docs/en/permissions; #231 temporary native denial checks on Claude Code 2.1.317"
      },
      "inference": "The controller assumed shell absolute-path syntax and tool removal were equivalent to a native scoped permission denial. Official documentation and the observed native diagnostics reject that premise.",
      "diagnosis": [
        "unknown"
      ],
      "revision": "5af998f9a51744e547d81bc6923f8ae84e142823"
    }
  ],
  "recurrences": 0,
  "reviews": [
    {
      "id": "b6084ee5-e409-42b4-83eb-dd3581853e14",
      "requestDigest": "f64db77b2a6d86af2d8ebd0040547df745e902bb03cdbf2f12099bebaa695621",
      "date": "2026-11-05",
      "decision": "edit",
      "source": "agent review: lesson curation in the landing of #246; claude child opus/high\n\nEdit under the reviewer rules, then activate. The proposal has retained tool output: the unmatched single-slash pattern, the \"no tool named Read\" stop after a bare deny, and the intended denial diagnostic of the scoped double-slash pattern. The rule states applicability (a test of a native permission denial), action (keep the tool available and use the documented scoped rule), and check (evidence of the intended denied operation). It applies only to temporary fixtures, widens no permission, and adds no network or credential act. The edit labels the cause in the Root cause section as inferred and keeps it apart from the observed documents and diagnostics, and the Fix now says why the rule stays text. The incident evidence is unchanged. The related active lesson check-refusal-contract-across-earlier-guards states a different rule (which diagnostic a fixture can require), so no merge applies.",
      "related": [
        "check-native-denial-mechanism"
      ],
      "followUp": {
        "state": "not-needed",
        "detail": "The rule stays text for judgment at each matching task. This decision requires no structural follow-up."
      }
    }
  ]
}
---
# Check the exact native denial mechanism before a permission fixture

## What happened

In #231, a single-leading-slash Read pattern failed to deny the fixture config. A bare Read deny then removed the tool instead of exercising permission denial. The corrected double-leading-slash pattern produced the intended native denial and no feedback call.

## Root cause

Inferred: the fixture treated a shell absolute path as a Claude permission pattern, and tool removal as a denied tool call. Observed: the current permission documents and the native diagnostics show that these are distinct native behaviors.

## Fix

The temporary check now uses the documented scoped absolute path rule and requires the exact native denial diagnostic. Proposed prevention is to check current host help and permission documentation before choosing temporary denial controls. No persistent permission change or product enforcement is proposed. The rule stays text, because the denial syntax and its diagnostic depend on the host and its version.

## Rule

When testing a native permission denial, keep the required tool available and use the host's documented scoped rule. Require evidence of the intended denied operation; a missing tool or an unmatched rule does not prove that denial.

