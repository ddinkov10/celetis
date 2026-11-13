---
{
  "schema": 1,
  "name": "read-a-host-screen-for-an-update-prompt-before-each-key",
  "description": "A real-host check reads the screen before each key, and skips a host update prompt by name",
  "tags": [
    "process",
    "e2e",
    "platform-quirk"
  ],
  "date": "2026-11-13",
  "status": "active",
  "source": "Verify run 3 of #309, the report of the Verify child to its coordinator, 2026-11-13",
  "incidents": [
    {
      "id": "4e5f5cd3-b87d-4770-b319-a36736228869",
      "date": "2026-11-13",
      "action": "The Verify child sent /exit and Enter to a resumed Codex session that showed an update prompt",
      "expected": "No real installation update without the approval of the maintainer; the check skips the prompt",
      "observed": "The screen showed \"Codex CLI 0.169.0 installed successfully.\"; codex --version changed from 0.166.0 to 0.169.0",
      "source": {
        "kind": "tool-output",
        "excerpt": "the Codex resume session (run resume 2, tab t9) showed an update prompt with no hc status; my \"/exit\" + Enter selected its default, and the screen then showed \"Codex CLI 0.169.0 installed successfully.\""
      },
      "inference": "The child sent keys without a screen read; hc gives no status for the prompt. Uncertain when Codex shows the prompt.",
      "diagnosis": [
        "not-retrieved"
      ],
      "revision": "27c5f8cb48a5e7c6d61e002603b7176e5381af87",
      "brief": ".superpowers/sdd/309/verify-brief-run3.md names the trust dialog lessons and no update prompt rule"
    }
  ],
  "recurrences": 0,
  "reviews": [
    {
      "id": "c829f53b-1496-4076-a7ad-231387f6fc9f",
      "requestDigest": "5ae721db8ea247b9c509a0adea00599fabf79e072f1abca268f9109652317f7c",
      "date": "2026-11-13",
      "decision": "edit",
      "source": "agent review: lesson curation in the landing of #309; claude child opus/high\n\nEdit, then approve, under the reviewer rules: the proposal has observed evidence (the screen line \"Codex CLI 0.169.0 installed successfully.\" and codex --version from 0.166.0 to 0.169.0), states applicability, action, and check, widens no permission, weakens no check, and agrees with the entry contract of the plugin that an agent never approves a real installation update. No active or historical lesson states the same rule; the trust-dialog lessons cover another prompt. The edit makes the action consistent: the old text said to select the skip option and also never to send Enter, but a menu choice needs a confirmation; it now confirms only while the skip option is selected, and sends no key when no skip option shows. The edit adds a Root cause fact: no active lesson named host update prompts at the time of the run. Correction of the incident, as an attributed addendum: its diagnosis not-retrieved is not supported by its evidence, because no rule about host update prompts existed to retrieve; the supported diagnosis is unknown. The incident record stays unchanged.",
      "related": [
        "read-a-host-screen-for-an-update-prompt-before-each-key"
      ],
      "followUp": {
        "state": "proposed",
        "detail": "Start the hosts of a lab with their update check off (a configuration value or an environment value of each host, when one exists), so that the update prompt cannot show. It needs separate authorization and a probe for each host and version."
      }
    }
  ]
}
---
# Read a host screen for an update prompt before each key of a real-host check

## What happened

In Verify run 3 of #309 (lab celetis-lab-b11f0c, scenario V2, 2026-11-13), the Verify child resumed a Codex session (`run resume 2`, tab t9). The screen showed an update prompt of Codex, and hc reported no status for it. The child sent `/exit` and Enter to end the session. Enter selected the default of the prompt, and the screen then showed "Codex CLI 0.169.0 installed successfully." `codex --version` changed from codex-cli 0.166.0 at the start of the run to codex-cli 0.169.0. The maintainer had not approved an update. The entry contract of the plugin says that an agent never approves a real installation update.

## Root cause

Inferred from the child report: the child sent its keys from a plan of the session flow and did not read the screen first, so it did not see the update prompt. hc reports no status for that prompt, so a check that reads only the hc status cannot see it either. Uncertain: whether Codex shows this prompt only on a resume, or at each start after a new release. The brief ruled on the trust dialogs only, not on update prompts. No active lesson named host update prompts at the time of the run.

## Fix

Proposed prevention, not enforced: the brief of a real-host check names the update prompt of each host, and the check reads the screen before each key or text that it sends to a host session. When the screen shows an update prompt or another choice that changes an installation, the check selects the option that skips it, by its name, and records the screen. A structural follow-up needs separate authorization: start the hosts of a lab with their update check off (for example a configuration value or an environment value of each host, when the host has one), so the prompt cannot show. The rule stays text until that is checked for each host and version.

## Rule

Applies when a check sends keys or text to a real host session (Claude Code, Codex). Action: read the screen before each send. When the screen shows an update prompt or another choice that changes an installation, move the selection to the option that skips it, read the screen again, and confirm only while that option is selected; never send Enter or a default answer while another option is selected. When the screen shows no skip option, send no key to that session and report the screen. Check: the report names each update prompt that the run met and the option that was selected, and `claude --version` and `codex --version` are the same at the start and at the end of the run.

## Related lessons

[[rule-on-the-host-trust-dialog-before-a-real-host-check-in-a-new-folder]] [[select-yes-in-the-claude-trust-dialog]]
