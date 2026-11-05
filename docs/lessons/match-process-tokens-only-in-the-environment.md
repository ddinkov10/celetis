---
{
  "schema": 1,
  "name": "match-process-tokens-only-in-the-environment",
  "description": "A sweep matched its environment token in the whole ps eww text and signalled a process that named it only in its arguments",
  "tags": [
    "false-positive"
  ],
  "date": "2026-11-03",
  "status": "active",
  "source": "implement session of ddinkov10/celetis#233, final whole-branch review (finding I1)",
  "incidents": [
    {
      "id": "fb2bc4b1-f07f-4a20-b969-3ca2102affb9",
      "date": "2026-11-03",
      "action": "scripts/herdr-lab.ts matched the lab token (^|\\s)HC_SESSION=<id>(\\s|$) against the whole `ps eww` / `ps ewwax` text of a process in labProcesses and signal",
      "expected": "down signals only a process whose environment holds the exact token (spec of #233, The design section 1; anti-goal: never stop a process that the lab cannot prove is its own)",
      "observed": "On c0ef58d, `down celetis-lab-0f0f0a` with no root and one sentinel `bun -e 'setInterval(() => {}, 1e6)' -- HC_SESSION=celetis-lab-0f0f0a` (the token only in its arguments) printed a SIGTERM line for the sentinel and `herdr-lab: removed lab celetis-lab-0f0f0a`, exit 0",
      "source": {
        "kind": "tool-output",
        "excerpt": "--- L down celetis-lab-0f0f0a -> exit 0 / herdr-lab: SIGTERM 18185 /opt/homebrew/lib/node_modules/bun/bin/bun.exe -e setInterval(() => {}, 1e6) -- HC_SESSION=celetis-lab-0f0f0a / herdr-lab: removed lab celetis-lab-0f0f0a",
        "reference": "https://github.com/ddinkov10/celetis/issues/233#issuecomment-6606651110"
      },
      "inference": "The implementation treated the `ps eww` text as the environment; on macOS it is the arguments followed by the environment. The final reviewer reproduced it first with another sentinel; the session reran it. Not checked: whether some ps form prints the environment alone.",
      "diagnosis": [
        "unknown"
      ],
      "revision": "c0ef58d698990654559658d2ba1013f0be944c08"
    }
  ],
  "recurrences": 0,
  "reviews": [
    {
      "id": "f7214c28-4596-4a47-81ae-b1a87f515395",
      "requestDigest": "67f435935bfc77ba970fe73c718d567d20cca79cad1ddca753d93fcd61b4bf01",
      "date": "2026-11-05",
      "decision": "approve",
      "source": "agent review: lesson curation in the landing of #244; codex child host default/high\n\nApprove under the reviewer rules: the retained sentinel SIGTERM shows an ownership false positive when the token occurs only in arguments. The rule limits matching to the environment view, refuses inconsistent views, and checks both argument-only and actual-environment cases. It agrees with the input-boundary principle and the project lab boundary. It grants no new signal permission; further reuse stays proposed.",
      "related": [
        "match-process-tokens-only-in-the-environment"
      ],
      "followUp": {
        "state": "proposed",
        "detail": "A separate change can assess whether other process ownership checks need the same split. This review changes no sweep helper or permission."
      }
    }
  ]
}
---
# Match a process token only in the environment part of `ps eww`

## What happened

In #233, `down` of the Herdr lab proved that a process belonged to the lab by the token `HC_SESSION=<id>` in its `ps eww` text. A sentinel that named the token only in its arguments got SIGTERM, and `down` said `removed lab` for a lab that never existed. The final review found it; the fix is e7ddd25.

## Root cause

Inferred: `ps eww -o command=` prints the arguments, then the environment, so a regular expression on the whole text accepts a token in the arguments. Uncertain: other platforms can format the text differently.

## Fix

Applied in e7ddd25: `environmentOf` removes the arguments view (`ps -ww -o command=`) from the front of the `ps eww` text, and the token is matched only in the rest; a process whose two views disagree is not proven. Proposed, not enforced: every other ownership check by an environment token uses the same split. The rule stays text, because no shared sweep helper exists in the project.

## Detection signature

A signal line whose printed arguments contain the token, or a `removed` line for an id with no root.

## Rule

Applies when code proves that it owns a process by a token in its environment, read from `ps e` output. Action: strip the arguments view from the front of the text and match the token only in the rest; treat a mismatch of the two views as not proven. Check: a sentinel with the token only in its arguments survives, and a sentinel with the token in its environment is signalled.
