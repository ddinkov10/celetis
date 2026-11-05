---
{
  "schema": 1,
  "name": "check-forbidden-bytes-in-each-recorded-string-family",
  "description": "A shared record predicate omitted backslashes and accepted an unsafe legacy permission descriptor",
  "tags": [
    "config",
    "false-negative",
    "test"
  ],
  "date": "2026-11-05",
  "status": "active",
  "source": "Task 1 self-review in the implement session of ddinkov10/celetis#46",
  "incidents": [
    {
      "id": "celetis-46-record-backslash-predicate",
      "date": "2026-11-05",
      "action": "The Task 1 shared recorded-string predicate rejected control characters but did not reject a raw backslash in a legacy permission item.",
      "expected": "The approved authority table rejects backslashes in every recorded descriptor string before setup uses a claim.",
      "observed": "The retained incomplete parser accepted a permissions.allow descriptor containing Bash(celetis \\\\escape). The corrected shared predicate refused the same record.",
      "source": {
        "kind": "tool-output",
        "excerpt": "boundary-negative-control.ts asserted that the incomplete parser returned one allow entry and that the current parser threw /unsupported entry/. Output: Negative control: the initial control-character-only predicate accepts the forbidden backslash; the current shared predicate refuses it.",
        "reference": "#46 Task 1; temporary boundary-negative-control.ts and task1-boundary-negative.log"
      },
      "inference": "The child inferred incomplete forbidden-byte coverage in the shared predicate. The retained negative control establishes the acceptance and refusal; it does not establish why the omission occurred.",
      "diagnosis": [
        "unknown"
      ],
      "revision": "39418870ed3cfb25051fefd1d1133cb4439b2d70 plus Task 1 staged changes"
    }
  ],
  "recurrences": 0,
  "reviews": [
    {
      "id": "dc90ce92-0962-4fce-948c-35eaf2b9f937",
      "requestDigest": "0d6a45c22f4852bd9677319e4a99c11254b20d0ba528f59005f427298e8bf417",
      "date": "2026-11-05",
      "decision": "approve",
      "source": "agent review: lesson curation in the landing of #46; codex child host default/high\n\nApprove under the reviewer rules: the retained negative control establishes acceptance of a forbidden backslash by the incomplete parser and refusal by the corrected parser. The rule states applicability, a shared forbidden-byte rule, and checks of each accepted string family at the public boundary. It preserves invalid-input handling and strengthens coverage without widening permission. The cause of the omission remains unknown. It agrees with boundary discipline and behavioral verification. No live or historical lesson states this string-family coverage rule or holds its incident.",
      "related": [
        "check-forbidden-bytes-in-each-recorded-string-family"
      ],
      "followUp": {
        "state": "not-needed",
        "detail": "The accepted string families and forbidden byte classes depend on each record contract. This review authorizes no new enforcement or retained test."
      }
    }
  ]
}
---
# Check forbidden bytes in each recorded string family

## What happened

The Task 1 setup record validator rejected control characters but omitted backslashes from its shared recorded-string predicate. Self-review found that a legacy permissions.allow descriptor with a raw backslash passed. A retained negative control accepted the descriptor with the incomplete parser and confirmed refusal with the corrected parser.

## Root cause

The child inferred incomplete forbidden-byte coverage. The probe confirms the predicate difference but does not establish the cause of the omission.

## Fix

The task corrected the shared predicate and added a negative-control assertion. Proposed prevention: when a finite record table accepts variable string families, exercise each forbidden byte class through each such family. Keep the rule as text because the applicable strings and forbidden bytes depend on the record contract. This proposal adds no retained test or enforcement claim.

## Rule

When a record validator accepts variable string families under a finite authority table, apply one shared forbidden-byte rule and probe each forbidden byte class through every accepted family. Confirm refusal at the public parser or command boundary before the record grants authority.
