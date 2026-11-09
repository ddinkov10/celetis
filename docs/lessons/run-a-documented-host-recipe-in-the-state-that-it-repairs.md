---
{
  "schema": 1,
  "name": "run-a-documented-host-recipe-in-the-state-that-it-repairs",
  "description": "A README recovery recipe told the maintainer to run codex plugin marketplace add with a new ref, and Codex refuses that add when the marketplace already exists",
  "tags": [
    "process",
    "platform-quirk"
  ],
  "date": "2026-11-09",
  "status": "active",
  "source": "Final review and receiving-session probe of ddinkov10/celetis#262 (implement step, 2026-11-09)",
  "incidents": [
    {
      "id": "dbf4c8a7-dc4a-42fe-9e98-808c2bbb981e",
      "date": "2026-11-09",
      "action": "Task 3 of #262 wrote the recovery paragraph of plugins/celetis/README.md, \"Updates\", which the stop lines of celetis update name as their action: \"For Codex, the command is `codex plugin marketplace add <source> --ref <ref>`\". The command was not run against an installation that already has the marketplace. Task 4 carried the untested recipe as Item C to Verify, and the task reviews approved the text.",
      "expected": "A recipe that repairs an installed state gives commands that work in that state: the usual installation already has the marketplace celetis, so the Codex path must remove it first, as the Claude Code path of the same paragraph does.",
      "observed": "With a private CODEX_HOME and codex-cli 0.167.0, a second add of https://github.com/ddinkov10/celetis.git with another --ref exits 1; codex plugin marketplace remove celetis, then the add, succeeds, and the installed plugin stays enabled.",
      "source": {
        "kind": "tool-output",
        "excerpt": "$ codex plugin marketplace add https://github.com/ddinkov10/celetis.git --ref 7f47b48ad2c7b36bef3a6920a8ff22a97cb4d678 --json\nError: marketplace 'celetis' is already added from a different source; remove it before adding this source\nexit=1\n$ codex plugin marketplace remove celetis\nRemoved marketplace `celetis`.\n(after remove and add: config.toml keeps [plugins.\"celetis@celetis\"] enabled = true; ref = \"7f47b48ad2c7b36bef3a6920a8ff22a97cb4d678\")",
        "reference": "https://github.com/ddinkov10/celetis/issues/262"
      },
      "inference": "Inferred: the paragraph was written from the help text of the add command (`--ref <REF>  Git ref to fetch`), which says nothing about an existing name, and the builder ran no command because a real installation change is not permitted; a private host home makes the run safe. Uncertain: whether the builder knew that a private CODEX_HOME needs no file:// source (Codex refuses file:// marketplace sources, which the final reviewer met offline). Alternative: the Claude Code path was checked against documents, and the Codex path was assumed symmetric.",
      "diagnosis": [
        "unknown"
      ],
      "revision": "9db9c38"
    }
  ],
  "recurrences": 0,
  "reviews": [
    {
      "id": "6a1d3e52-7b0f-4c8e-9d21-3f5a8b4c6e07",
      "requestDigest": "41339cb67850f8015c6239c32e9b07889885a819a6937f34bb9ad5c53e00538c",
      "date": "2026-11-09",
      "decision": "edit",
      "source": "agent review: lesson curation in the landing of #265; claude child opus/high\n\nEdit under the reviewer rules against a rule that adds a network or credential act or contradicts project instructions. The proposed action ran each recipe command with a private host home, and the evidence shows that such a run of a Codex marketplace add needs a network Git source; a private CLAUDE_CONFIG_DIR or CODEX_HOME must also not become a separate signed-in installation (AGENTS.md, \"Host checks\"). The edit keeps the rule and its evidence, and limits the run to steps that the task already permits: no login, and only network access that the task's permissions allow. Otherwise the recipe is recorded as unchecked in the task report and the Verify items. No other rule rejects, merges, or replaces it; no active lesson states the same rule.",
      "related": [
        "run-a-documented-host-recipe-in-the-state-that-it-repairs"
      ],
      "followUp": {
        "state": "not-needed",
        "detail": "The proposal states that no structural check is suitable; the rule stays text."
      }
    }
  ]
}
---
# Run a documented host recipe in the state that it repairs

## What happened

In #262, the recovery paragraph of `plugins/celetis/README.md`, "Updates", is the action of the stop lines of `celetis update`. It said: "For Codex, the command is `codex plugin marketplace add <source> --ref <ref>`". No run of that command in an installation that already has the marketplace `celetis` existed; the build carried it as an open item (Item C) to Verify, and two task reviews approved the text. The final review flagged it as an unresolved risk. The receiving session then ran it with a private `CODEX_HOME` and codex-cli 0.167.0 against the real Git source: the second add with another `--ref` exits 1 with `Error: marketplace 'celetis' is already added from a different source; remove it before adding this source`. `codex plugin marketplace remove celetis` and the add then succeed, and the installed plugin stays enabled.

## Root cause

Inferred, not established: the text came from the help of the add command, which names `--ref` and says nothing about an existing name. A real installation change is not permitted, so no command ran; a private host home would have made the run safe. Uncertain: the final reviewer could not run it offline, because Codex refuses `file://` marketplace sources, so a check needs a network Git source.

## Fix

Proposed prevention, in text: before a document tells the maintainer to run a host command that changes installed state (a setup, recovery, or retarget recipe), run each command with a private host home in the state that the recipe starts from, and write only the observed result. The run uses the existing host CLI with temporary data, and it takes no step that the task does not already permit: no login, and no network access that the task's permissions do not allow. When the run cannot take place within those limits, the recipe stays unchecked, and the task report and the Verify items say so. A structural check is not suitable: the states and the commands differ for each recipe, and the run needs the network and the host's own CLI.

## Detection signature

A document gives a host command for a state change, and the task report or the evidence holds no run of it in the state that the document names (for example an existing marketplace, an installed plugin, or a pinned ref).

## Rule

Applies when a document, a stop line, or a recipe tells a person to run a host command that changes an installed state (add, remove, retarget, or reinstall a marketplace or a plugin). Action: run each command of the recipe with a private host home (for example a private `CODEX_HOME` or `CLAUDE_CONFIG_DIR`) that starts in the state the recipe targets, in the order the recipe gives, and write the commands and their order from that run. Run it only when no command needs a login and the task's permissions already allow each network access of the commands; otherwise write in the task report and in the Verify items that the recipe is unchecked. Check: the task report names the run, its host version, the start state, and the exit of each command, and the document text matches it; or the task report and the Verify items name the recipe as unchecked.

## Related lessons

[[probe-real-tool-semantics-behind-fakes]]
[[state-the-limits-of-a-check-from-a-probe-of-its-configuration]]
