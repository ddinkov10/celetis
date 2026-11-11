---
{
  "schema": 1,
  "name": "confirm-the-listener-of-a-retained-fixture-port",
  "description": "A reused #279 fixture kept board port 4531, which a daemon of another session held, so probe board reads reached that daemon",
  "tags": [
    "e2e",
    "networking",
    "process"
  ],
  "date": "2026-11-08",
  "status": "active",
  "source": "Task 4 of ddinkov10/celetis#266 (lab case (f) of starts-lab.ts)",
  "incidents": [
    {
      "id": "31f30abb-bdbb-4a02-a5ce-b58c642dd48d",
      "date": "2026-11-08",
      "action": "The Task 4 implementer of #266 reused the retained #279 fixture, whose harness.ts writes `board.port: 4531` into the fixture `.celetis.yaml`, and ran three debug tries of lab case (f) that sent `GET /api/board` to 127.0.0.1:4531.",
      "expected": "Each board request of a probe reaches only the daemon that the probe started; a probe never reads or writes the board of a daemon of another session.",
      "observed": "Port 4531 belonged to a daemon of another session (PID 58897, a worktree of #257). The probe daemon did not get that port, and the probe read the board of the other daemon (`lastBoard.daemon.pid` 58897, empty columns). Only GET requests went there; no POST was sent.",
      "source": {
        "kind": "tool-output",
        "excerpt": "lsof -nP -iTCP:4531 -sTCP:LISTEN: bun.exe 58897 ... TCP 127.0.0.1:4531 (LISTEN); probe record try-f4/f-base.in-host.json: lastBoard.daemon.pid 58897",
        "reference": "ddinkov10/celetis#266 Task 4 implementer report, section Incident"
      },
      "inference": "Reported by the child, cause inferred: the retained-fixture rule names the remote configuration and the side effects, and the child checked the remotes; it did not name a fixed listening port of the fixture, so the child did not check the listener. Uncertain: whether the daemon of the probe logged a failed bind that the probe ignored. Alternative: a fixture that asks for a free port at each run.",
      "diagnosis": [
        "wrong-or-incomplete-rule"
      ],
      "revision": "9949858",
      "brief": "Task 4 brief of #266 carried check-retained-verification-fixtures-against-current-boundaries (sha256 afab3339...): compare its fixture topology and side effects with the current project instructions; confirm the remote configuration with git remote -v.",
      "lesson": {
        "name": "check-retained-verification-fixtures-against-current-boundaries",
        "revision": "46c687c80d16334aba5871574a0dc34de14e7b4a",
        "digest": "afab3339d2b5440c1e57d9bd8e6906a0b9d28211a83c6720dfe68f0ea58589d5"
      }
    }
  ],
  "recurrences": 0,
  "reviews": [
    {
      "id": "e4465f97-7c81-4db5-aacc-aec0c0f6aee8",
      "requestDigest": "305c14be3638a4a22edc4778e7a61dbe6c61342fb223ca2e0c3cb87085da2821",
      "date": "2026-11-08",
      "decision": "approve",
      "source": "agent review: lesson curation in the landing of #255; claude child opus/high\n\nApprove under the reviewer rules: the tool output (lsof listener PID 58897 and the probe record lastBoard.daemon.pid 58897) establishes the incident, and the root cause is labeled as inference. The rule states applicability, action, and check, uses only a read-only listener query, grants no permission, adds no network or credential act, and weakens no check. It is not the rule of check-retained-verification-fixtures-against-current-boundaries: that rule compares a retained fixture with the current instructions and its remote configuration; this rule confirms the live listener of any fixed fixture port, so the two rules are compatible and stay separate.",
      "related": [
        "confirm-the-listener-of-a-retained-fixture-port"
      ],
      "followUp": {
        "state": "proposed",
        "detail": "Proposed in the incident, not authorized: scripts/herdr-lab.ts could give each lab a free board port. It needs a separate authorization and check."
      }
    }
  ]
}
---
# Confirm the listener of a retained fixture port

## What happened

Tool output: in Task 4 of #266, a probe reused the retained #279 fixture, which sets the board port 4531. A daemon of another session held that port. Three debug tries of a lab case sent `GET /api/board` to it and read that daemon's board (`daemon.pid` 58897). No POST went there. The child then moved the fixture to port 4583 and made the probe check the listener before each board request.

## Root cause

Inferred: the retained-fixture rule covers the remote configuration and side effects, but not a fixed listening port, so a reused fixture can address a process outside the check. Uncertain: whether a failed bind of the probe daemon was visible in its log.

## Fix

Proposed prevention, not proven enforcement: before each request to a fixed port of a fixture, confirm that the only listener on that port is a process of the probe (for example `lsof -nP -iTCP:<port> -sTCP:LISTEN` against the probe PID), and start a case only when the port is free. A structural follow-up needs separate authorization: the lab of `scripts/herdr-lab.ts` could give each lab a free board port. The port of a fixture depends on the check, so the rule stays text.

## Rule

Applies when a check reuses a fixture that names a fixed listening port (a board, a server, a proxy). Action: before the first request and before each write request, confirm that the only listener on that port is a process that the check started, and start the case only when the port is free. Check: the evidence shows the listener PID equal to the probe process for each request, and a control with another listener on the port stops the case before its first request.

## Related lessons

[[check-retained-verification-fixtures-against-current-boundaries]]
