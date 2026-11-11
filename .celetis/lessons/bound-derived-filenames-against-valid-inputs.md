---
{
  "schema": 1,
  "name": "bound-derived-filenames-against-valid-inputs",
  "description": "A valid maximum dispatch session basename exceeded the filesystem limit after migration fields were appended",
  "tags": [
    "data-store",
    "test"
  ],
  "date": "2026-11-05",
  "status": "active",
  "source": "Task 1 self-review of ddinkov10/celetis#244; child /root/task1",
  "incidents": [
    {
      "id": "244-task1-name-max",
      "date": "2026-11-05",
      "action": "The migration helper appended a hexadecimal content digest, hexadecimal process start, PID, and UUID to a complete valid dispatch basename.",
      "expected": "Every valid supported dispatch basename can be migrated with the required archive and temporary identity fields.",
      "observed": "A basename of claude- followed by 128 s characters and .json failed with ENAMETOOLONG during archive temporary creation. Compact temporary encodings passed that same input without changing the final archive name.",
      "source": {
        "kind": "tool-output",
        "excerpt": "transaction-name-red.log: failed persistence from schema 1: ENAMETOOLONG: name too long, open '.../.celetis-migrate-claude-ssss...json.schema-1.<digest>.<pid>.<hex-start>.<uuid>.archive'. transaction-green-4.log: transaction: PASS.",
        "reference": "docs/superpowers/verification/244-20261105; Task 1 report"
      },
      "inference": "The derived filename exceeded the local filesystem component limit. The exact valid maximum input reproduced the failure. Other native filesystems were not exercised.",
      "diagnosis": [
        "unknown"
      ],
      "revision": "40a31cb92ecce73591fc4c75321489240c5392fa plus Task 1 working helper"
    }
  ],
  "recurrences": 0,
  "reviews": [
    {
      "id": "d923fa71-8350-41a9-9ea6-c3a178c18967",
      "requestDigest": "1f037d2f19a8e7c81748c9f3b6bf4de4e8f99cec3951162f81ec0a688ca63bd8",
      "date": "2026-11-05",
      "decision": "approve",
      "source": "agent review: lesson curation in the landing of #46; codex child host default/high\n\nApprove under the reviewer rules: the retained ENAMETOOLONG result and corrected same-input result establish a useful incident. The rule gives applicability, a complete derived-length check, and a real-filesystem check of the longest valid source name. It preserves required names and identity fields and agrees with boundary and retry-safety principles. The evidence is limited to the observed filesystem; no cross-platform result is inferred.",
      "related": [
        "bound-derived-filenames-against-valid-inputs"
      ],
      "followUp": {
        "state": "not-needed",
        "detail": "The check depends on the affected operation. No structural follow-up is required by this review."
      }
    }
  ]
}
---
# Bound derived filenames against valid source names

## What happened

The #244 helper built a migration temporary name from the complete target basename and required identity fields. Dispatch accepts a session ID with 128 characters. The corresponding valid dispatch basename caused `ENAMETOOLONG` when the helper appended its fields. The child reproduced the failure, then used compact encodings for the temporary identity fields. The same long basename passed. Final archive naming stayed unchanged.

## Root cause

The concatenated temporary name exceeded the local filesystem component limit. The source name was valid, so validating only the source basename did not protect the derived path. No behavior on other native filesystems is established.

## Fix

The temporary name now uses compact encodings while retaining its required identity components. Proposed prevention remains a scoped verification rule because the maximum valid source name and required suffix differ by store. No new configuration or generic filename abstraction is introduced.

## Rule

When code derives a filesystem component by adding fields to an accepted name, calculate the complete component length and exercise the longest valid input. Keep the exact required final name and retain all identity fields. Check that the real filesystem accepts the resulting path.
