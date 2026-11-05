---
{
  "schema": 1,
  "name": "verify-exception-matching-against-runtime-identities",
  "description": "A URL-scoped detector exception missed the browser's trailing-slash root URL",
  "tags": [
    "config",
    "test",
    "process"
  ],
  "date": "2026-11-03",
  "status": "active",
  "source": "Runtime verification of ddinkov10/celetis#191",
  "incidents": [
    {
      "id": "191-v4-root-slash-20261103",
      "date": "2026-11-03",
      "action": "Committed three detector exception patterns as http://127.0.0.1:* after URL scans without a trailing slash passed.",
      "expected": "The documented Board exceptions apply to the same root page when the browser reports its canonical trailing-slash URL, while excluding unrelated paths.",
      "observed": "The URL scans returned 0, but the exact-page CDP scan at http://127.0.0.1:4491/ returned 2 and repeated the same font, type hierarchy and nested-card findings.",
      "source": {
        "kind": "tool-output",
        "excerpt": "detect-confirmed.ts: records [{width:1440,result:2,resources:8}]; detector findings file http://127.0.0.1:4491/; config files pattern http://127.0.0.1:*; earlier URL scans at http://127.0.0.1:4491 exited 0.",
        "reference": "#191, .playwright-mcp/191/detect-confirmed-red.json and detect-confirmed.ts"
      },
      "inference": "Inferred: the file glob does not consume a slash, and the URL scan and CDP scan use different root spellings. The runtime evidence establishes the mismatch; the detector's internal matcher was not inspected.",
      "diagnosis": [
        "unknown"
      ],
      "revision": "9376804df0f2953cd4f731231fce596a3d7f14d5"
    }
  ],
  "recurrences": 0,
  "reviews": [
    {
      "id": "40929a5f-40c2-4270-ad53-6c2175066017",
      "requestDigest": "00681247e0896a59cbbe724f7cea6393047da222f7a177aca026c1c9444e0c44",
      "date": "2026-11-05",
      "decision": "approve",
      "source": "agent review: lesson curation in the landing of #246; claude child opus/high\n\nApprove under the reviewer rules. The proposal has retained tool output: the URL scans without a trailing slash exited 0, and the CDP scan of the trailing-slash root URL returned the same findings. The rule states applicability (an exception with a path or URL pattern), action (check the exact runtime identity through the actual matcher, and keep unrelated paths outside), and check. It makes a check stricter, widens no permission, and agrees with the principle test-behavior-not-implementation. No live or historical lesson states this rule or holds its incident. The body keeps the inferred matcher cause apart from the observed mismatch.",
      "related": [
        "verify-exception-matching-against-runtime-identities"
      ],
      "followUp": {
        "state": "not-needed",
        "detail": "The rule stays text for judgment at each matching task. This decision requires no structural follow-up."
      }
    }
  ]
}
---
# Verify exception matching against runtime identities

## What happened

In #191, three justified Board detector exceptions matched a manually supplied root URL without a slash. Both viewport scans passed. A supplemental CDP scan checked the browser's actual root URL with a trailing slash and returned the same primary findings. Its eight loaded browser resources matched the reviewed source, so this was not a stale-target result.

## Root cause

The evidence supports a mismatch between two equivalent root URL spellings. The likely cause is path-segment glob matching, but the detector's internal matcher was not inspected. The original check covered only the supplied URL spelling.

## Fix

The proposed correction adds the explicit root-with-slash pattern while keeping the original root pattern. Verify both forms through the real detector and keep unrelated paths outside the exception. Proposed prevention remains a text rule because the accepted identity and permitted scope depend on each consuming tool. No harness enforcement change is proposed here.

## Rule

When an exception uses a path or URL pattern, check the exact identity produced by each required runtime consumer. Verify accepted equivalent forms through the actual matcher and confirm that unrelated paths remain outside the exception. A passing check of a manually supplied spelling does not establish coverage of the runtime spelling.
