---
{
  "schema": 1,
  "name": "derive-a-release-identity-from-what-the-tool-ignores-and-what-the-encoding-drops",
  "description": "A release identity of git patch-id ignored line numbers and bytes after a NUL, so two different changes had one identity",
  "tags": [
    "git",
    "false-negative",
    "process",
    "release"
  ],
  "date": "2026-11-25",
  "status": "active",
  "source": "implement session of #381 (coordinator), claude",
  "incidents": [
    {
      "id": "381-patch-identity-line",
      "date": "2026-11-25",
      "action": "The approved spec fixed the release identity as `git patch-id --verbatim` of the net diff, and the plan gate compared only the patch-id.",
      "expected": "Two net diffs have one identity only when they are the same change: same content at the same place.",
      "observed": "git patch-id ignores line numbers. Task 2 review, demonstrated end to end: a file with three identical blocks; the approved commit edits block 1; after the release, a new commit makes the same edit in block 2; land gave {\"exit\":0,\"approvedLineAt\":13,\"cardLineAt\":5}. A second gap of the same identity: two contents that differ only after a NUL byte on a text line gave one id (controller probe, id a8d79d71e7).",
      "source": {
        "kind": "tool-output",
        "excerpt": "land -> {\"exit\":0,\"approvedLineAt\":13,\"cardLineAt\":5}; two contents that differ only after a NUL byte on a text line gave one id a8d79d71e7."
      },
      "inference": "Inferred, not established: the spec named the tool and the plan trusted its name as an identity, so nobody listed what the tool ignores. The NUL gap was found by a probe of the controller, not by the plan. Alternative: the spec author knew the limit and meant the patch-id as a lower bound.",
      "diagnosis": [
        "unknown"
      ],
      "revision": "97e54a5, 0a73367, ed14d41"
    }
  ],
  "recurrences": 0,
  "reviews": [
    {
      "id": "4506435c-6d9a-46ff-b2b1-c83c5ec01c17",
      "requestDigest": "8240618762443f4600f72d1bf1a0f8d007f6b3a6312fbaf31be81c0fea96ec67",
      "date": "2026-11-25",
      "decision": "approve",
      "source": "agent review: lesson curation in the landing of #381; claude child opus/high\n\nApprove (reviewer rules): the proposal has observed tool-output evidence (a land probe that gave exit 0 with approvedLineAt 13 and cardLineAt 5, and a controller probe in which two contents that differ only after a NUL byte gave one id). Its rule states applicability (a tool output used as the identity of a change or a record), action (list what the tool ignores and what the encoding drops, and give the gate a comparison or an injective encoding for each), and check (a probe pair for each listed aspect). It widens no permission, weakens no check, adds no network or credential act, and contradicts no project instruction, skill, or principle. No live or historical lesson holds its incident or states its rule. The body keeps the inferred cause and the alternative apart from the facts.",
      "related": [
        "derive-a-release-identity-from-what-the-tool-ignores-and-what-the-encoding-drops"
      ],
      "followUp": {
        "state": "proposed",
        "detail": "Structural follow-up, which needs separate authorization: a gate probe with two pairs for a change identity (the same edit at two places, and two contents that differ only after a NUL byte) that the gate must refuse."
      }
    }
  ]
}
---
# Derive a release identity from what the tool ignores and what the encoding drops

## What happened

In #381, the approved spec fixed the release identity as `git patch-id --verbatim` of the net diff, and the plan gate compared only that patch-id. `git patch-id` ignores line numbers. The Task 2 review demonstrated it end to end: a file with three identical blocks; the approved commit edits block 1; after the release, a new commit makes the same edit in block 2; `land` gave `{"exit":0,"approvedLineAt":13,"cardLineAt":5}`. A controller probe found a second gap of the same identity: two contents that differ only after a NUL byte on a text line gave one id (`a8d79d71e7`). Fixes: `carriesRelease` (same head or same clean merge tree) and an injective 0x00/0x01 encoding (97e54a5, 0a73367, ed14d41).

## Root cause

Inferred, not established: the spec and the plan used the name of the tool as the identity and did not list what the tool ignores (line numbers) or what its text encoding drops (bytes after a NUL). No active lesson applies, so no recurrence diagnosis is possible: unknown. Alternative: the spec author knew the limit and meant the patch-id as a lower bound; the approved spec does not say so.

## Fix

Proposed, not enforced: before a plan accepts a hash or a patch-id as the identity of a change, list the inputs that the tool ignores and the bytes that its encoding drops, and require the gate to compare each one, or to encode the identity with an injective form. A structural check that would reject this mistake is a gate probe with two pairs: the same edit at two places, and two contents that differ only after a NUL byte. This stays text: which aspects matter depends on the identity that the spec needs. Enforcement is not proven.

## Detection signature

A gate that returns exit 0 for a commit whose place differs from the approved one, with `approvedLineAt` and `cardLineAt` unequal.

## Rule

Applies when a spec or a plan uses the output of a tool (a hash, a patch-id, a digest) as the identity of a change or of a record. Action: list what the tool ignores (line numbers, context, whitespace modes, bytes after a NUL) and what the encoding that feeds it drops, and give the gate a comparison or an injective encoding for each. Check: a probe runs one pair for each listed aspect, and the gate refuses each pair that differs only in that aspect.
