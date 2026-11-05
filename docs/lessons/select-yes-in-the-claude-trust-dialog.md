---
{
  "schema": 1,
  "name": "select-yes-in-the-claude-trust-dialog",
  "description": "A Verify step accepted the Claude Code folder-trust dialog with Enter, which chose the default No, exit",
  "tags": [
    "platform-quirk",
    "e2e"
  ],
  "date": "2026-11-03",
  "status": "active",
  "source": "implement session of ddinkov10/celetis#233, Verify V2 attempt 1",
  "incidents": [
    {
      "id": "f3dddc30-a3b3-46e8-a3f8-9c09616414f8",
      "date": "2026-11-03",
      "action": "The plan of #233, V2, said to accept the folder-trust dialog of Claude with `hc keys T1 enter`, and the Verify script sent that key",
      "expected": "The host trusts the fixture folder and starts its session in the tab",
      "observed": "Claude Code 2.1.317 showed `❯ No, exit` above `Yes, I trust this folder`; Enter chose No, exit; the host quit, and the runner exited 1 with a startup message. `hc keys T1 down enter` in the next attempt chose Yes, and the host reached status claude-code",
      "source": {
        "kind": "tool-output",
        "excerpt": "❯ No, exit / Yes, I trust this folder / Enter to confirm · Esc to cancel ... celetis-flow: #1 claude startup: the session ended before a saved turn had a verified identity. Check the version, trust, and sign-in prompts in the tab #1 triage.",
        "reference": "https://github.com/ddinkov10/celetis/issues/233#issuecomment-6606651110"
      },
      "inference": "The plan assumed that Enter accepts the dialog; its default is the safe choice. Uncertain whether earlier Claude Code versions had another default; #232 accepted the trust through the dialog in a throwaway terminal and did not record the keys.",
      "diagnosis": [
        "unknown"
      ],
      "revision": "e7ddd2599bc9b3535fa77525958dd1b8e583e1b4"
    }
  ],
  "recurrences": 0,
  "reviews": [
    {
      "id": "2bc81ab1-eeca-431c-9e27-a4925b0c3e5d",
      "requestDigest": "d910bc94218084a7b534c6c1922522e8764a03513dba4bf1857beb5099de76eb",
      "date": "2026-11-05",
      "decision": "edit",
      "source": "agent review: lesson curation in the landing of #245; codex child host default/high\n\nEdit under the reviewer rules: the retained screen and failed Enter establish the incident, but one observed host version does not establish a fixed option order for every version. Scope the rule to an already authorized temporary fixture check, require inspection of the actual selected option, and preserve runtime target confirmation. Keep the original incident evidence and uncertainty unchanged. The edited rule grants no host-trust permission and preserves the project lab boundary and host-only confirmation limits. No new trust, authentication, or runtime check was performed for this review.",
      "related": [
        "select-yes-in-the-claude-trust-dialog"
      ],
      "followUp": {
        "state": "not-needed",
        "detail": "The current dialog selection and existing permission must be read for each authorized fixture check. No structural follow-up is required by this decision."
      }
    }
  ]
}
---
# Select "Yes, I trust this folder" explicitly in the Claude trust dialog

## What happened

In #233, Verify V2 started the checkout runner in a lab tab on a new fixture folder. Claude Code 2.1.317 showed its folder-trust dialog. The plan said to accept it with `hc keys T1 enter`. Enter chose the default `No, exit`, the host quit, and the runner stopped the step with its startup message.

## Root cause

Inferred: the plan treated Enter as acceptance. The observed dialog in Claude Code 2.1.317 put the safe choice first. Uncertain: whether the default differs in other versions.

## Fix

Applied in the Verify harness of #233: `hc keys T1 down enter`, after the screen showed `Yes, I trust this folder` below the selected `No, exit`. Proposed prevention: in an already authorized temporary fixture check, inspect the current dialog and select its explicit trust option before confirmation. This rule grants no permission to trust another folder or to change real host trust. It stays text because the current host dialog and the existing authorization require judgment.

## Detection signature

The tab shows the dialog, then a shell prompt, and the runner prints `the session ended before a saved turn had a verified identity`.

## Rule

Applies when an already authorized check uses a temporary fixture folder and must drive the Claude Code folder-trust dialog through keys. Action: inspect the current dialog and select `Yes, I trust this folder` explicitly before confirmation. Use `down` only when the observed selection and option order require it. Check: the screen no longer shows the dialog and `hc get` of the lab tab shows the status app `claude-code`. This check does not replace runtime target confirmation.
