---
{
  "schema": 1,
  "name": "rule-on-the-host-trust-dialog-before-a-real-host-check-in-a-new-folder",
  "description": "A real-host Verify run in a new fixture folder had to answer the Codex trust dialog, which wrote the maintainer's Codex config",
  "tags": [
    "process",
    "config",
    "e2e"
  ],
  "date": "2026-11-13",
  "status": "active",
  "source": "The implement session of #288 on Claude Code, Verify V4 (a real Codex coordinator from the page), 2026-11-13",
  "incidents": [
    {
      "id": "5b0f2c41-6e1d-4b7a-9a8e-1c3d7f2e9a10",
      "date": "2026-11-13",
      "action": "The Verify brief of the coordinator ruled only on the Claude folder-trust dialog and told the child to use fixture-only configuration for the Codex dialogs; the child tried a project .codex/config.toml and a -c projects.<repo>.trust_level flag, then answered the Codex trust dialog with hc keys enter.",
      "expected": "A real-host check in a temporary fixture folder starts each host with fixture-only configuration, or the brief rules on each host trust dialog and its write before the run.",
      "observed": "codex-cli 0.167.0 showed 'Trust this folder? ... Your trust decision will be saved.' despite both fixture settings; the answer wrote [projects.\"<fixture>/fx/repo\"] trust_level = \"trusted\" into ~/.codex/config.toml lines 1226-1227, where 10 earlier temporary folders of Celetis checks already were (lines 302-329).",
      "source": {
        "kind": "tool-output",
        "excerpt": "Trust this folder? ... Your trust decision will be saved. / ~/.codex/config.toml lines 1226-1227: [projects.\"<S>/fx/repo\"] trust_level = \"trusted\""
      },
      "inference": "Codex reads folder trust only from its persisted config, so a new fixture folder always needs the dialog or a write of that file. Uncertain: codex debug prompt-input may not show project layers. Alternative: a CODEX_HOME copy for the check, if its sign-in can be reused.",
      "diagnosis": [
        "unknown"
      ],
      "revision": "fe9856707ec6656a107da50ea7ace841fd6f1ad3"
    }
  ],
  "recurrences": 0,
  "reviews": [
    {
      "id": "68d54ce4-1beb-4125-8161-5eedcdfff93f",
      "requestDigest": "714c065945cee2b237e5a9abd64e5204234b4a5a02cb7265e23fed6121df121a",
      "date": "2026-11-13",
      "decision": "edit",
      "source": "agent review: lesson curation in the landing of #288; claude child opus/high\n\nEdit, then approve, under the reviewer rules: the proposal has observed evidence (the Codex 0.167.0 trust dialog text and the added lines 1226-1227 of ~/.codex/config.toml), states applicability, action, and check, widens no permission, and adds a ruling and a report of a host config write before a real-host check. The active lesson select-yes-in-the-claude-trust-dialog states a different rule (which option to select in the Claude Code dialog). The edit marks the claim about the Claude trust entry of Task 1 as a statement of the proposal with no incident evidence, to keep observed facts apart.",
      "related": [
        "rule-on-the-host-trust-dialog-before-a-real-host-check-in-a-new-folder"
      ],
      "followUp": {
        "state": "proposed",
        "detail": "The proposal names a structural follow-up that needs a separate authorization: a lab helper of scripts/herdr-lab.ts that prepares a trusted fixture folder, or a reused fixture folder path."
      }
    }
  ]
}
---
# Rule on the host trust dialog before a real-host check in a new folder

## What happened

In Verify V4 of #288, a real Codex coordinator started in a new temporary fixture folder. The brief ruled on the Claude folder-trust dialog only. Codex 0.167.0 showed "Trust this folder? ... Your trust decision will be saved." with no hc status. A project `.codex/config.toml` and a `-c projects.<repo>.trust_level` flag did not skip it. The child answered it with `hc keys`, and Codex wrote a trust entry for the fixture folder into the maintainer's `~/.codex/config.toml` (lines 1226-1227); ten earlier temporary folders of Celetis checks were already there. The proposal also states that Task 1 of the same build wrote a Claude trust entry into `~/.claude.json` in the same way; no incident of this lesson holds evidence of that write.

## Root cause

Inferred: each host keeps folder trust only in its own persisted config, so a new fixture folder needs a dialog answer that writes the maintainer's config. The plan and the brief did not name that write. Uncertain: a separate host state home might avoid it if its sign-in can be reused.

## Fix

Proposed prevention, not enforced: before a real-host check in a new folder, the plan or the brief names each host trust dialog, rules on whether its answer may write the maintainer's host config, and the report lists each such write for the maintainer. A structural follow-up needs separate authorization: a lab helper of `scripts/herdr-lab.ts` that prepares a trusted fixture folder, or a reused fixture folder path. The rule stays text, because the trust storage differs by host and version.

## Rule

Applies when a check starts a real host (Claude Code, Codex) in a folder that the host has not trusted before. Action: before the run, name each trust dialog of each host and its persisted write; rule in the brief whether the check may answer it and write the maintainer's host config, or reuse an already trusted fixture folder; list each write in the report to the maintainer. Check: the report names each trust dialog that the run met, how it was answered, and each line it added to a host config of the maintainer.

## Related lessons

[[select-yes-in-the-claude-trust-dialog]]
