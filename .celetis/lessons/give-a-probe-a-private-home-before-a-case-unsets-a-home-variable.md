---
{
  "schema": 1,
  "name": "give-a-probe-a-private-home-before-a-case-unsets-a-home-variable",
  "description": "A runner probe case unset CLAUDE_CONFIG_DIR and CODEX_HOME, and the code under test fell back to the real ~/.claude and ~/.codex",
  "tags": [
    "test",
    "config",
    "process"
  ],
  "date": "2026-11-09",
  "status": "active",
  "source": "Task 2 report of ddinkov10/celetis#262 (commit b4f6ca4), from the implementer child; checked by the coordinator",
  "incidents": [
    {
      "id": "262-t2-probe-real-home-01",
      "date": "2026-11-09",
      "action": "The Task 2 runner probe of #262 set private CLAUDE_CONFIG_DIR and CODEX_HOME for its cases, and two cases unset them to check that requireContract leaves an unset variable unset. The probe process kept the real HOME.",
      "expected": "Global Constraint of the plan of #262: each runner probe uses a private CELETIS_HOME, HOME, CLAUDE_CONFIG_DIR, and CODEX_HOME under the scratch folder; the real installation is never read or locked.",
      "observed": "In the first probe run the two unset cases read the real ~/.claude and ~/.codex homes and opened the existing empty celetis-update.lock files there (withPluginRead opens the lock with mode a+ and takes a shared flock). The coordinator saw both lock files at size 0 with their Oct 15 mtime, and the safety values (installed_plugins.json SHA-256, the ~/.local/bin/celetis target) unchanged.",
      "source": {
        "kind": "tool-output",
        "excerpt": "Task 2 report: 'First probe run (before a private HOME was fixed at launch) let two \"unset env\" cases read the real ~/.claude and ~/.codex homes and open the existing empty celetis-update.lock files there'. engine/lib/homes.ts:9-10: claude: process.env.CLAUDE_CONFIG_DIR || join(homedir(), '.claude'); codex: process.env.CODEX_HOME ?? join(homedir(), '.codex').",
        "reference": "https://github.com/ddinkov10/celetis/issues/262"
      },
      "inference": "Inferred: the probe treated the two home variables as the whole isolation, but configHome falls back to homedir() when a variable is unset, so an unset case reaches the real home. Uncertain: whether other reads of the real Codex home (config, records) also ran in those cases; no write was observed.",
      "diagnosis": [
        "unknown"
      ],
      "revision": "b4f6ca4"
    }
  ],
  "recurrences": 0,
  "reviews": [
    {
      "id": "b8e4c1f9-2d6a-4a37-8e5b-7c90f13d2a64",
      "requestDigest": "23fe0cf44bd99f6603f8aee23afa6834d7b842fd864b3c02281f8e37e8d9506a",
      "date": "2026-11-09",
      "decision": "edit",
      "source": "agent review: lesson curation in the landing of #265; claude child opus/high\n\nEdit under the reviewer rule against a rule that contradicts project instructions. The proposed rule gives any probe or check a private HOME; for a run of a signed-in host CLI, a private HOME would drop the existing authentication, which AGENTS.md, \"Host checks\", requires each check to reuse. The edit scopes the rule to probes of program code and sends a host run to \"Host checks\". The evidence, the inferred cause, and its uncertainty stay unchanged. No active lesson states the same rule.",
      "related": [
        "give-a-probe-a-private-home-before-a-case-unsets-a-home-variable"
      ],
      "followUp": {
        "state": "not-needed",
        "detail": "The proposal proposes no structural check; which variables a code path falls back to needs a read of that code."
      }
    }
  ]
}
---
# Give a probe a private HOME before a case unsets a home variable

## What happened

The Task 2 runner probe of #262 gave its cases private `CLAUDE_CONFIG_DIR` and `CODEX_HOME` folders. Two cases unset both variables, to check that the new check leaves an unset variable unset. The probe process kept the real `HOME`. In the first run, those two cases read the real `~/.claude` and `~/.codex` homes and opened the existing `celetis-update.lock` files there. The lock files and the safety values did not change. The implementer then made the probe run itself again with a private `HOME`, and refuse to run otherwise.

## Root cause

Inferred: the probe treated the two home variables as the whole isolation. `configHome` of `engine/lib/homes.ts` falls back to `homedir()` when a variable is unset, so an unset case reaches the real home. Uncertain: which other reads of the real Codex home ran in those cases. No write was observed.

## Fix

Proposed prevention, as text: a probe that unsets or clears a home variable first runs with a private `HOME` (and `USERPROFILE` on Windows), so each fallback of the code under test also lands in temporary data. A probe can also refuse to start when `HOME` is the real home. No structural check is proposed: which variables a code path falls back to needs a read of that code. A run of a signed-in host CLI is outside this fix: `AGENTS.md`, "Host checks", makes such a run reuse the existing installation and its authentication.

## Detection signature

A probe case with an unset `CLAUDE_CONFIG_DIR`, `CODEX_HOME`, or `CELETIS_HOME` while `HOME` is the real home; access times or open handles on files under the real `~/.claude` or `~/.codex` during a probe.

## Rule

Applies when a probe or a check of program code must use temporary installation data and one of its cases unsets, clears, or omits a variable that selects a home or a config folder. It does not apply to a run of a host CLI that needs the existing authentication of the host; such a run follows `AGENTS.md`, "Host checks". Action: read the fallback of each such variable in the code under test, and give the probe process a private `HOME` (and each other fallback source) before the first case; refuse to run when the fallback resolves to the real home. Check: in each case with an unset variable, the resolved home of the code under test is under the scratch folder, and a control that keeps the real `HOME` is refused before its first read.
