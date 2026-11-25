---
{
  "schema": 1,
  "name": "check-the-object-that-a-git-read-resolves-not-the-name-it-gets",
  "description": "A size check of git cat-file -s read an annotated tag, while cat-file blob peeled the tag, so an 11 MiB blob passed a 10 MiB limit",
  "tags": [
    "git",
    "regression"
  ],
  "date": "2026-11-25",
  "status": "active",
  "source": "The implement session of #336 on Claude Code, task review of Task 4, 2026-11-25",
  "incidents": [
    {
      "id": "2b9f0c1e-6a4d-4f7e-9c3b-8d5e1a7f4c22",
      "date": "2026-11-25",
      "action": "fileOf of engine/lib/local/local.ts checked the size of an operation-named hash with `git cat-file -s <hash>` and then read the bytes with `git cat-file blob <hash>`.",
      "expected": "Only a blob object of at most 10 MiB that the operation names is read and embedded (README rule 12, ADR-0141 decision 2).",
      "observed": "A reviewer probe named an annotated tag on an 11 MiB PNG blob: `blob size 11534336 tag type tag tag size 130`, then `files [{...,\"bytes\":11534336}]` and one embedded image. After the fix dcfd5b5 (one `cat-file --batch-check` with %(objecttype), read only type blob) the probe gave bytes null.",
      "source": {
        "kind": "tool-output",
        "excerpt": "blob size 11534336 tag type tag tag size 130; files [{\"hash\":\"916ddb6e...\",\"bytes\":11534336}]",
        "reference": "https://github.com/ddinkov10/celetis/issues/336"
      },
      "inference": "Implementer report: it assumed that `cat-file -s` and `cat-file blob` name the same object, and did not check that `cat-file <type>` peels tags. Related to the active lesson guard-a-parsed-input-with-the-parser-of-its-consumer: the guard decided on another reading of the name than the consumer.",
      "diagnosis": [
        "unknown"
      ],
      "revision": "78cde9d"
    }
  ],
  "recurrences": 0,
  "reviews": [
    {
      "id": "603ef234-f378-48e1-a441-0f0f439d4518",
      "requestDigest": "41cbc98e4e5e013fceb9f6577aaed88c02b00318fe5411a2d8e3ed7e8f757691",
      "date": "2026-11-25",
      "decision": "approve",
      "source": "agent review: lesson curation in the landing of #388; claude child opus/high\n\nApprove under the reviewer rules. The incident has observed tool-output evidence: a reviewer probe named an annotated tag on an 11 MiB blob, the size check saw the 130-byte tag, and the read embedded the 11 MiB blob. The body keeps the implementer report and the inference apart from the facts. The rule states applicability, action, and check; it widens no permission, weakens no check or gate, adds no network or credential act, and agrees with the principle boundary-discipline of the plugin celetis. No live or historical lesson holds its incident. The active lesson guard-a-parsed-input-with-the-parser-of-its-consumer is related but states another rule (a guard against the parse forms of a consumer, not the object that two calls of one tool resolve), so no merge.",
      "related": [
        "check-the-object-that-a-git-read-resolves-not-the-name-it-gets"
      ],
      "followUp": {
        "state": "not-needed",
        "detail": "The rule stays text: which git forms peel a tag depends on each command, so no structural check covers the class. The fix dcfd5b5 of #336 already reads the type and the size in one batch-check."
      }
    }
  ]
}
---
# Check the object that a git read resolves, not the name that it gets

## What happened

In the build of #336, the issue read checked the size of each operation-named hash with `git cat-file -s` and then read it with `git cat-file blob`. A task reviewer probe named an annotated tag on an 11 MiB PNG blob: the size check saw the 130-byte tag, `cat-file blob` peeled the tag, and the board embedded the 11 MiB blob past its 10 MiB limit. The fix dcfd5b5 reads the type and the size of all hashes with one `cat-file --batch-check` and reads only objects of the type `blob`.

## Root cause

Implementer report: the check and the read were assumed to name the same object; `cat-file <type>` peels a tag to that type. Inferred: a guard that runs a different git form than the consumer can resolve another object.

## Fix

Proposed: make the check read the object type and size that the read takes (`%(objecttype) %(objectsize)` in one batch-check), and refuse each other type. This stays text: which git forms peel depends on each command.

## Rule

Applies when code checks an object of git by name (its size, its type, its existence) and a later git call reads that name. Action: check the type and the size of the exact object that the read takes, for example with one `cat-file --batch-check='%(objecttype) %(objectsize)'`, and read only that type. Check: a probe names a tag (and a tree) of an object that fails the check, and the read gives no bytes.

## Related lessons

[[guard-a-parsed-input-with-the-parser-of-its-consumer]]
