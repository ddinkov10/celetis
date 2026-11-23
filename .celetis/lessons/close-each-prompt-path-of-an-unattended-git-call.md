---
{
  "schema": 1,
  "name": "close-each-prompt-path-of-an-unattended-git-call",
  "description": "GIT_TERMINAL_PROMPT=0 stops only one prompt path of a Git network call, and a session environment can hide the others from a probe",
  "tags": [
    "git",
    "false-negative",
    "platform-quirk",
    "test"
  ],
  "date": "2026-11-23",
  "status": "active",
  "source": "Security review, final review, and Verify of #370, implement session, 2026-11-23",
  "incidents": [
    {
      "id": "79b9d6bf-a390-4ecf-8809-cb919496f326",
      "date": "2026-11-23",
      "action": "The clone pin of #370 set only GIT_TERMINAL_PROMPT=0 for its fetch, and the first probe of the credential path ran with the environment of the agent session.",
      "expected": "The fetch fails with no credential or host-key prompt, and a probe shows the environment of a normal terminal.",
      "observed": "The session held GCM_INTERACTIVE=never, which hid the Git Credential Manager path until the probe removed it. With that value removed, the helper ran with no GCM_INTERACTIVE. An inherited GIT_ASKPASS received the username and password questions. A real local sshd sent the unknown host-key question to SSH_ASKPASS.",
      "source": {
        "kind": "tool-output",
        "excerpt": "session GCM_INTERACTIVE=[never] user=[] machine=[]; FAIL V4-4 the helper may not prompt: GCM_INTERACTIVE=; ASKPASS Username for 'http://127.0.0.1:PORT'; FAIL V4-8 ssh shows no askpass prompt: ASKPASS The authenticity of host '[127.0.0.1]:51269' can't be established.",
        "reference": "https://github.com/ddinkov10/celetis/issues/370"
      },
      "inference": "Inferred cause: Git, Git Credential Manager, and OpenSSH each have a separate prompt control, and the plan named only the control of Git. The agent session supplies one of the other controls, so a probe that inherits it passes for the wrong reason.",
      "diagnosis": [
        "unknown"
      ],
      "revision": "b53c74c23570c0a2fde4aea01e87f498eaa7101f"
    }
  ],
  "recurrences": 0,
  "reviews": [
    {
      "id": "f329651a-a676-4768-ab3e-42fe34da4621",
      "requestDigest": "d084668f2fd4f4ea536603346251a7b6453c3c991ff69062113a9c10c57b2b18",
      "date": "2026-11-23",
      "decision": "edit",
      "source": "agent review: lesson curation in the landing of #370; claude child opus/high\n\nReviewer rule: edit before approval, to keep observed facts apart from claims. The evidence is observed, no live lesson states this rule, and the rule weakens no gate. The edit adds one limit: the incident observed the askpass path of OpenSSH only, and the OpenSSH manual names BatchMode as the control of host key confirmation.",
      "related": [
        "close-each-prompt-path-of-an-unattended-git-call"
      ],
      "followUp": {
        "state": "proposed",
        "detail": "Give each unattended Git network call of the engine one shared environment, with a check that rejects a call without it. Decide and test the terminal prompt of OpenSSH for that environment (BatchMode=yes), including a user core.sshCommand. Not authorized in this curation."
      }
    }
  ]
}
---
# Close each prompt path of an unattended Git call

## What happened

The clone pin of #370 set only `GIT_TERMINAL_PROMPT=0`. The agent session held `GCM_INTERACTIVE=never`, so the first probe of the credential path passed that control by inheritance. With the value removed, the credential helper had no `GCM_INTERACTIVE`. An inherited `GIT_ASKPASS` received the username and password questions, and a real local `sshd` sent the unknown host-key question to `SSH_ASKPASS`.

## Root cause

Inference: Git, Git Credential Manager, and OpenSSH each have a separate prompt control, and the plan named only the control of Git. A probe that inherits the session environment can pass for the wrong reason.

## Fix

The pin in `engine/lib/update/updater.ts` now sets `GIT_TERMINAL_PROMPT=0`, `GCM_INTERACTIVE=false`, `GIT_ASKPASS=` (empty), and `SSH_ASKPASS_REQUIRE=never`. Scenarios V4-4 and V4-8 of #370 observed each path. A proposed structural follow-up, not authorized here, is one shared environment for each unattended Git network call of the engine, with a check that rejects a call without it. The other calls of the engine still set only `GIT_TERMINAL_PROMPT=0`.

Limit of the evidence: the scenarios observed the askpass path of OpenSSH. The OpenSSH manual says that `SSH_ASKPASS_REQUIRE=never` stops the use of an askpass program, and that `BatchMode=yes` disables password prompts and host key confirmation. The pin does not set `BatchMode`, and the incident record names no run with a controlling terminal. So this lesson does not establish that the terminal prompt of OpenSSH is closed.

## Rule

Applies when code runs a Git network command with no person to answer it, or a check claims that such a command shows no prompt. Action: set `GIT_TERMINAL_PROMPT=0`, `GCM_INTERACTIVE=false`, an empty `GIT_ASKPASS`, and `SSH_ASKPASS_REQUIRE=never`. When the command can run with a controlling terminal and an SSH remote, also disable the terminal prompt of OpenSSH (`BatchMode=yes`), or report that path as open. In the probe, remove each of these variables that the session supplies before the run. Check: with a logging credential helper, a logging `GIT_ASKPASS`, and a logging `SSH_ASKPASS` with `DISPLAY` set, against an HTTP server that answers 401 and an SSH server with an unknown host key, the command fails, the helper sees `GCM_INTERACTIVE=false`, and neither askpass program runs. A probe with no controlling terminal does not check the terminal prompt of OpenSSH, so its report names that limit.
