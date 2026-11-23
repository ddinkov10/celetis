---
{
  "schema": 1,
  "name": "refuse-at-the-parser-each-name-that-a-reader-branches-on",
  "description": "A package tar reader admitted a .git entry, and the engine revision reader then trusted it over the checked stamp",
  "tags": [
    "release",
    "config"
  ],
  "date": "2026-11-23",
  "status": "active",
  "source": "The implement session of #251 on Claude Code, Task 1, task review, 2026-11-23",
  "incidents": [
    {
      "id": "dfc72293-a8d1-4f11-987f-a84790e696c8",
      "date": "2026-11-23",
      "action": "readArchive accepted a .git entry, and engineRevision selects its source by the presence of a .git entry.",
      "expected": "The spec of #251, \"The identity\", makes the stamp the identity of a package folder.",
      "observed": "The stamp held aaaa..., and engineRevision returned bbbb... for a .git folder, a .GIT folder, and a .git file.",
      "source": {
        "kind": "tool-output",
        "excerpt": "A1 .git folder engineRevision: ACCEPTED \"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb\""
      },
      "inference": "Inferred: the archive rules were reviewed as path safety and not against the code that reads the unpacked folder.",
      "diagnosis": [
        "unknown"
      ],
      "revision": "de580bdc3d3765e4d32e21fafed7a7d81729987b"
    }
  ],
  "recurrences": 0,
  "reviews": [
    {
      "id": "027dc1ee-ec86-4d8e-a35e-1e97d74de609",
      "requestDigest": "6745337866f7be4605c6ae78d1c12cae140a3215c7bd82ad56099bb233e1f63f",
      "date": "2026-11-24",
      "decision": "approve",
      "source": "agent review: lesson curation in the landing of #371; claude child opus/high\n\nApprove (reviewer rules): the incident holds observed tool output; the rule states applicability, action, and check; it widens no permission, weakens no check, and adds no network or credential act; it agrees with the principle boundary-discipline of the plugin celetis. No live or historical lesson holds its incident or states its rule: guard-a-parsed-input-with-the-parser-of-its-consumer covers a guard before the parser of a consumer, and this rule covers names that a later reader of the admitted tree branches on. Commit 1bd95e1 of #251 holds the refusal of a .git segment after case folding, and engineRevision there branches on a .git entry.",
      "related": [
        "refuse-at-the-parser-each-name-that-a-reader-branches-on"
      ],
      "followUp": {
        "state": "not-needed",
        "detail": "The rule stays text, because the list of such readers depends on each design."
      }
    }
  ]
}
---
# Refuse at the parser each name that a reader of the unpacked tree branches on

## What happened

`readArchive` of #251 checked each path of a package for safety. `engineRevision` then chose its source by the presence of a `.git` entry in the unpacked folder. The task review passed a tarball with a valid stamp and a `.git` folder, a `.GIT` folder, and a `.git` file. The stamp held `aaaa…`, and `engineRevision` returned `bbbb…` for each form.

## Root cause

Inferred, not proven: the archive rules were reviewed as path safety and were not compared with the code that reads the unpacked folder.

## Fix

Proposed prevention: list the names that readers of the unpacked tree branch on, and refuse each at the parser. The reader in #251 refuses a `.git` segment at any depth after case folding. The rule stays text, because the list of such readers depends on each design.

## Detection signature

An identity read of an unpacked folder returns a value that the checked stamp does not hold.

## Rule

Applies when a parser admits an external archive or tree into a folder that later code reads. Action: list each file name whose presence changes the behavior of a reader of that folder, and refuse each such name at the parser, with case folding where the file system folds case. Check: a probe passes each listed name through the parser and the reader, and the identity that the reader returns equals the checked value or the parser refuses the entry.
