---
{
  "schema": 1,
  "name": "read-the-next-record-number-from-the-current-trunk",
  "description": "A plan named ADR-0121 for its new record, but ADR-0121 and ADR-0122 were already on the trunk when the plan was posted",
  "tags": [
    "process",
    "git"
  ],
  "date": "2026-11-21",
  "status": "active",
  "source": "The implement session of #356 on Claude Code, 2026-11-21",
  "incidents": [
    {
      "id": "b6a0d2c4-1f3e-4a57-8c9d-2e4f6a8b0c13",
      "date": "2026-11-21",
      "action": "The plan of #356 (Task 4) named the new record docs/adr/0121-land-runs-the-landing-when-no-daemon-runs.md.",
      "expected": "The new record takes the next free number of the record store of the current trunk.",
      "observed": "At the build, `ls docs/adr` on the lane at 45910e0 listed 0121-the-skill-ideate-finds-what-to-improve-in-a-product.md and 0122-the-documents-of-a-product-are-a-website-on-github-pages.md. git log: 0121 landed in ddfee1a at 2026-11-21T07:53Z and 0122 in 45910e0 at 10:52Z; the ## Plan comment was posted at 11:15Z. The controller ruled ADR-0123.",
      "source": {
        "kind": "tool-output",
        "excerpt": "ls docs/adr | tail -3 -> 0121-the-skill-ideate-finds-what-to-improve-in-a-product.md, 0122-the-documents-of-a-product-are-a-website-on-github-pages.md, index.md",
        "reference": "https://github.com/ddinkov10/celetis/issues/356"
      },
      "inference": "Inferred: the plan session read the record store of a checkout that was behind the trunk, or chose the number from memory. Not established which.",
      "diagnosis": [
        "unknown"
      ],
      "revision": "45910e091ca6d3f4a0b3164d05bca32956048fde"
    }
  ],
  "recurrences": 0,
  "reviews": [
    {
      "id": "26763954-d0a1-419c-a47a-17ec0577bc5d",
      "requestDigest": "16f2d7620358806649fbd3761b03173f06b5a70ef1b342c9421e5c58e9a31696",
      "date": "2026-11-21",
      "decision": "approve",
      "source": "agent review: lesson curation in the landing of #356; claude child opus/high\n\nApprove (reviewer rules): the proposal has observed tool-output evidence (ls docs/adr and git log on the lane at 45910e0 show ADR-0121 and ADR-0122 on the trunk before the plan comment that named ADR-0121); its rule states applicability, action, and check; it widens no permission, skips no check or gate, and adds no network or credential act (it reads a local ref); it agrees with step 2 of the Write part of the skill record-architecture-decisions (the next number after the highest existing record number) and names the store and the time of that read; no live or historical lesson holds its incident or states its rule. The body keeps the inferred cause apart from the facts.",
      "related": [
        "read-the-next-record-number-from-the-current-trunk"
      ],
      "followUp": {
        "state": "not-needed",
        "detail": "No structural follow-up is authorized in this curation."
      }
    }
  ]
}
---
# Read the next record number from the current trunk

## What happened

The plan of #356 named the new decision record ADR-0121 (Task 4). At the build, the lane at 45910e0 already held ADR-0121 (landed in ddfee1a, 2026-11-21T07:53Z) and ADR-0122 (landed in 45910e0, 10:52Z). The plan comment was posted at 11:15Z, after both. The controller ruled the number ADR-0123 before the task started (tool output of `ls docs/adr` and `git log`).

## Root cause

Inferred, not established: the plan session read the record store of a checkout behind the trunk, or chose the number without a read. Other lanes land records during the day, so a number chosen at plan time can also go stale before the build.

## Fix

Proposed prevention, not enforced: a plan that names a new record number reads it from `docs/adr/` of `origin/<trunk>` at plan time and says that the build confirms it; the build reads the store again before the record task. The gate refuses a repeated record number (`scripts/build.ts`), so a stale number fails late, at the build of the record. A structural follow-up could make the plan name the record by its title only, with the number taken at the build; it needs a separate decision.

## Rule

Applies when a plan or a brief names the number of a new decision record. Action: read the highest number of `docs/adr/` on `origin/<trunk>` right before you write the number, and in the build read it again before the record task; take the next free number. Check: the record file of the change has a number that no record of the current trunk has, and the plan or the brief names the trunk commit of its read.
