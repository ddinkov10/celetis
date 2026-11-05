---
{
  "schema": 1,
  "name": "keep-byte-preserving-transformations-reversible",
  "description": "Lossy text decoding changed product bytes outside a managed instruction block",
  "tags": [
    "test",
    "data-loss",
    "process"
  ],
  "date": "2026-11-02",
  "status": "active",
  "source": "Final review and coordinator reproduction of ddinkov10/celetis#230",
  "incidents": [
    {
      "id": "issue-230-review-1d7459c-outside-bytes",
      "date": "2026-11-02",
      "action": "Implemented an unconditional byte-preserving instruction update with lossy UTF-8 file decoding and string rewriting.",
      "expected": "Approved criteria 2 and 3 require every original byte outside the managed range to survive append and refresh.",
      "observed": "Append and refresh both exited 0 while prefix 2320436166e90a became 2320436166efbfbd0a; refresh suffix 53756666697820ff0a became 53756666697820efbfbd0a.",
      "source": {
        "kind": "tool-output",
        "excerpt": "append: exit 0; expectedPrefixHex=2320436166e90a; observedPrefixHex=2320436166efbfbd0a; sameBytes=false. refresh: exit 0; expectedSuffixHex=53756666697820ff0a; observedSuffixHex=53756666697820efbfbd0a; sameBytes=false.",
        "reference": "#230 final-review.md and coordinator review-reproduction.log"
      },
      "inference": "Lossy decoding is supported by source and execution. Why implementation and checks omitted non-UTF-8 input is unknown. BOM and valid multibyte UTF-8 cases did not prove arbitrary-byte preservation.",
      "diagnosis": [
        "unknown"
      ],
      "revision": "1d7459c7df01dc82854642c4c50cae40fe380d44"
    }
  ],
  "recurrences": 0,
  "reviews": [
    {
      "id": "4e769549-f0cb-4378-9687-749beaf29bec",
      "requestDigest": "e67a93f8beb8fa64387250d15f9628a963e3bf485a6a7b0ba4db937a12b9aad2",
      "date": "2026-11-05",
      "decision": "approve",
      "source": "agent review: lesson curation in the landing of #236; codex child host default/high\n\nApprove under the reviewer rules: the retained byte comparison establishes data loss, the account distinguishes evidence from uncertain causes, and the rule gives applicability, a reversible transformation, and a byte comparison check. It agrees with the data-preservation and behavioral-check principles.",
      "related": [
        "keep-byte-preserving-transformations-reversible"
      ],
      "followUp": {
        "state": "not-needed",
        "detail": "The byte ownership contract needs task-specific judgment. This decision adds no structural follow-up."
      }
    }
  ]
}
---
# Keep byte-preserving transformations reversible

## What happened

The #230 implementation promised exact preservation outside a managed instruction block but read and wrote the file as UTF-8 text. The final reviewer and coordinator reproduced successful writes that replaced outside bytes 0xe9 and 0xff with UTF-8 efbfbd. Valid UTF-8 and BOM fixtures had passed.

## Root cause

UTF-8 decoding loses invalid byte sequences. Slicing the decoded string cannot restore them. The reason the original checks omitted these inputs is unknown.

## Fix

The repair retains instruction bytes in a Buffer, uses a reversible one-byte representation for ASCII marker matching, and compares bytes before writing. Temporary cases cover append, refresh, baseline addition, a supported link, and stable repeats. Proposed prevention remains a text rule because the ownership contract determines which bytes must survive; no repository-wide enforcement is added.

## Rule

When approved behavior requires exact preservation outside a managed range, keep the representation reversible through read, transform, comparison, and write. Include an input that a text decoder cannot reproduce unchanged. Compare bytes at the public operation boundary.
