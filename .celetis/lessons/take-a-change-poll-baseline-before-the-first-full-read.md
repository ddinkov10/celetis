---
{
  "schema": 1,
  "name": "take-a-change-poll-baseline-before-the-first-full-read",
  "description": "A ref poll gated on the loaded board document took its first baseline after the first full read, so a write during that read never refreshed the board",
  "tags": [
    "regression",
    "ui",
    "git"
  ],
  "date": "2026-11-25",
  "status": "active",
  "source": "The implement session of #336 on Claude Code, task review of Task 3, 2026-11-25",
  "incidents": [
    {
      "id": "6a4b1f0e-3c2d-4e8a-9b51-336000000003",
      "date": "2026-11-25",
      "action": "The plan of #336 and the implementer of Task 3 gated the one-second ref poll of engine/board/reads.ts on board?.grammar === 'local' (the last loaded document), with the rule that the first good poll only records its baseline.",
      "expected": "Each write to refs/bugs/ after the board starts reaches the board within seconds (spec G3 of #336), also a write made while the first full board read runs.",
      "observed": "A reviewer probe with a 3000 ms first read and a write at 1000 ms printed: FAIL write during the first full read: full read saw value 1, polled 2, target reads []. The fix 0fa5912 gated the poll on the process grammar from the first tick, and the probe printed ok.",
      "source": {
        "kind": "tool-output",
        "excerpt": "FAIL write during the first full read: full read saw value 1, polled 2, target reads []",
        "reference": "https://github.com/ddinkov10/celetis/issues/336"
      },
      "inference": "Inferred: the baseline of a change detector must precede the snapshot that it refreshes; gating the detector on the snapshot itself puts the baseline after it. Uncertain whether other polls of the engine share this shape.",
      "diagnosis": [
        "unknown"
      ],
      "revision": "75b33f7"
    }
  ],
  "recurrences": 0,
  "reviews": [
    {
      "id": "002b8b69-843a-4d68-af77-adb1347371a9",
      "requestDigest": "a47860fe4046dd421a5bf817fc1eb4e392322f27d7ae0862916d5528293852ef",
      "date": "2026-11-25",
      "decision": "approve",
      "source": "agent review: lesson curation in the landing of #388; claude child opus/high\n\nApprove under the reviewer rules. The incident has observed tool-output evidence: a reviewer probe with a slow first read and a write during it printed `FAIL write during the first full read: full read saw value 1, polled 2, target reads []`, and the fix 0fa5912 made it print ok. The body labels the cause as inferred and names its uncertainty. The rule states applicability, action, and check; it widens no permission, weakens no check or gate, adds no network or credential act, and contradicts no project instruction, skill, or principle. No live or historical lesson holds its incident. The active lesson check-refresh-causes-before-first-document is related but states another rule (each existing refresh cause of a changed scheduler, not the baseline time of a new change poll), so no merge.",
      "related": [
        "take-a-change-poll-baseline-before-the-first-full-read"
      ],
      "followUp": {
        "state": "not-needed",
        "detail": "The rule stays text: which input exists before the first read is a judgment about each process, as the Fix section says. This review changes lesson data only."
      }
    }
  ]
}
---
# Take the baseline of a change poll before the first read that it refreshes

## What happened

The plan of #336 gated the new one-second ref poll of the board on the loaded board document, and the first good poll only recorded a baseline. A task reviewer probe made a write during the first full board read. The first poll then took a baseline that already held the write, and no target read followed (`FAIL write during the first full read: full read saw value 1, polled 2, target reads []`). The fix 0fa5912 started the poll at the first tick, gated on the process key grammar.

## Root cause

Inferred: a change detector whose start depends on the snapshot that it refreshes takes its baseline after that snapshot, so a change between the snapshot start and the baseline is lost. Uncertain: no other poll of the engine was checked for the same shape.

## Fix

Proposed: start a change poll before or at the start of the first read that it refreshes, and gate it on an input that exists before that read. This stays text, because which input exists early is a judgment about each process.

## Rule

Applies when a change adds a poll or a watcher whose first result is a baseline and whose later differences refresh a cached read. Action: take the baseline no later than the start of the first read of the cache, and gate the poll on a value that is set before that read, not on the read result. Check: a probe makes a write while the first read runs (a slow fake read) and observes a refresh of the written key after the read.
