---
{
  "schema": 1,
  "name": "give-a-probe-a-private-home-before-a-case-unsets-a-home-variable",
  "description": "A runner probe case unset CLAUDE_CONFIG_DIR and CODEX_HOME, and a lab wrapper cleared CELETIS_HOME before an engine install, so each fell back to the real home; an install probe under a private HOME read the real home with os.userInfo().homedir, which Bun took from HOME",
  "tags": [
    "test",
    "config",
    "process",
    "e2e",
    "data-loss",
    "recurring",
    "platform-quirk"
  ],
  "date": "2026-11-09",
  "status": "active",
  "source": "The implement session of #348 on Claude Code, Task 3 implementer report (INC-348-T3-1), 2026-11-19\n\nVerify run 4 of #309, the incident report of the Verify child to its coordinator, 2026-11-13\n\nTask 2 report of ddinkov10/celetis#262 (commit b4f6ca4), from the implementer child; checked by the coordinator",
  "incidents": [
    {
      "id": "INC-348-T3-1",
      "date": "2026-11-19",
      "action": "The install probe of Task 3 of #348 set a private HOME under $TMPDIR/celetis-348/ and read the real home for its before/after record of the real installation with os.userInfo().homedir.",
      "expected": "The record of the real installation reads the home of the user database, which a private HOME does not change, so the before/after comparison can see a write to the real installation.",
      "observed": "Under a private HOME, Bun returned that HOME: `HOME=$S/probe-home bun -e 'console.log(require(\"os\").userInfo().homedir)'` printed the private path. The first RED run recorded the real installation as absent. No write targeted the real home; the comparison said unchanged. The implementer changed the probe to a user-database lookup and a refusal when it resolves under the scratch folder.",
      "source": {
        "kind": "tool-output",
        "excerpt": "HOME=<scratch>/probe-home bun -e 'console.log(require(\"os\").userInfo().homedir)' printed <scratch>/probe-home; t3-red.txt line 2 recorded the real installation as absent",
        "reference": "https://github.com/ddinkov10/celetis/issues/348"
      },
      "inference": "Uncertain cause: Bun 1.4.4 implements os.userInfo().homedir from HOME, unlike Node, which reads the passwd entry. Alternative: the behavior depends on the Bun version or the platform; only macOS with Bun 1.4.4 was observed.",
      "diagnosis": [
        "wrong-or-incomplete-rule"
      ],
      "revision": "2c90f90",
      "brief": "Task 3 lesson rule: \"record the real installation (for Celetis, current and the versions list) before, and compare it after\"; the rule names no source for the real home",
      "lesson": {
        "name": "give-a-probe-a-private-home-before-a-case-unsets-a-home-variable",
        "revision": "50cb5a1e7327b480fdbf16947d956e8244d42889",
        "digest": "f82b30425582a7cd15260f946b5ef648a7b1e8413eb3f0b0028a6bd972a4d167"
      }
    },
    {
      "id": "60867915-ea36-45b8-afb1-bd3f802d5e3c",
      "date": "2026-11-13",
      "action": "The Verify child set CELETIS_HOME in front of its lab env wrapper, which unsets CELETIS_*, and ran celetis install",
      "expected": "The install writes only <lab>/home; the real ~/.local/share/celetis stays unchanged",
      "observed": "The real current changed to 3d6363e…, a new real version folder appeared, and the prune ran on the real versions folder",
      "source": {
        "kind": "tool-output",
        "excerpt": "install: C:\\Users\\ddink\\.local\\bin\\celetis.cmd -> C:\\Users\\ddink\\.local\\share\\celetis\\versions\\3d6363e3dc1e26944e060feddf82122d0ef117fd\\engine\\celetis"
      },
      "inference": "The launcher cleared the variable and no read of the started process came before the write; the rule trigger names a case, not a launcher. Uncertain which cause dominates.",
      "diagnosis": [
        "not-followed",
        "wrong-or-incomplete-rule"
      ],
      "revision": "3d6363e3dc1e26944e060feddf82122d0ef117fd",
      "brief": ".superpowers/sdd/309/verify-brief-run4.md, Lesson rules: give-a-probe-a-private-home-before-a-case-unsets-a-home-variable",
      "lesson": {
        "name": "give-a-probe-a-private-home-before-a-case-unsets-a-home-variable",
        "revision": "3d6363e3dc1e26944e060feddf82122d0ef117fd",
        "digest": "7d34a38bbde9779fc5890782767958dc0d794383740de4b6a34d50c6dd68f45b"
      }
    },
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
  "recurrences": 2,
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
    },
    {
      "id": "201ad9f6-4949-46ce-909a-52a8ee91ed93",
      "requestDigest": "1d9c922c0cbf7f59bdb8dce326d25eeddd3e4eafee9f37be4af1171180a4d80e",
      "date": "2026-11-13",
      "decision": "merge",
      "source": "agent review: lesson curation in the landing of #309; claude child opus/high\n\nMerge under the reviewer rule for a proposal that states the rule of an active lesson. The proposal has observed evidence (the install line that names the real versions folder, and the changed real current). Its rule is the rule of give-a-probe-a-private-home-before-a-case-unsets-a-home-variable: a cleared home variable falls back to the real home, so read the resolved home before the first write and refuse when it is real. Its incident names that lesson and diagnoses its trigger as incomplete. Two active lessons would state one rule, so the active lesson survives: its trigger now also names a wrapper or a launcher that clears the variable, and its action and check take the installation-write read and the before and after record of the real installation from the proposal. Every incident and the earlier review stay; observed facts stay apart from inferred causes. The rule widens no permission and weakens no check. Correction of the new incident, as an attributed addendum: its diagnosis lists not-followed and wrong-or-incomplete-rule, but its own inference and body say that the evidence does not separate them; by the lesson format the supported diagnosis is unknown. The incident record stays unchanged.",
      "related": [
        "read-the-home-of-the-started-process-before-a-check-writes-an-installation",
        "give-a-probe-a-private-home-before-a-case-unsets-a-home-variable"
      ],
      "followUp": {
        "state": "proposed",
        "detail": "scripts/herdr-lab.ts gives each lab a private CELETIS_HOME and refuses an engine install whose target is outside the lab root. It needs separate authorization and a probe."
      }
    },
    {
      "id": "5dc89522-35ae-4c42-b2a1-087166726fdb",
      "requestDigest": "7d0b9be1da90db2619f6d857d62698b8ed6beb7aff4cb2c26615744a55fa0675",
      "date": "2026-11-20",
      "decision": "merge",
      "source": "agent review: lesson curation in the landing of #348; claude child opus/high\n\nMerge under the reviewer rule for a proposal that states the rule of an active lesson. The proposal has observed evidence: the retained excerpt shows that os.userInfo().homedir printed the private HOME under Bun, and the before record of the real installation was absent. Its incident names give-a-probe-a-private-home-before-a-case-unsets-a-home-variable as the examined lesson, cites its action \"record the real installation before, and compare it after\" as the brief, and diagnoses that rule as incomplete: the rule names no source for the real home. So the proposal states one part of the action of the active lesson, for the same kind of probe, and two active lessons would hold parts of one rule. The active lesson survives: its trigger also names a probe that gives its process a private HOME and must record or protect the real installation, and its fix, action, check, and detection signature take the source of the real home and the refusal of a real home under the scratch folder from the proposal. The tag platform-quirk of the proposal joins the tags. Every incident and every earlier review stay; observed facts stay apart from the inferred Bun cause and its uncertainty (only macOS with Bun 1.4.4 was observed). The rule widens no permission, weakens no check, and does not touch a run of a host CLI, which AGENTS.md, \"Host checks\", still governs.",
      "related": [
        "read-the-real-home-from-the-user-database-under-bun",
        "give-a-probe-a-private-home-before-a-case-unsets-a-home-variable"
      ],
      "followUp": {
        "state": "not-needed",
        "detail": "The structural follow-up of the proposal, the source of the real home in the rule of give-a-probe-a-private-home-before-a-case-unsets-a-home-variable, is this merge. The scripts/herdr-lab.ts follow-up of review 201ad9f6-4949-46ce-909a-52a8ee91ed93 stays proposed."
      }
    }
  ]
}
---
# Give a probe a private HOME before a case or a launcher unsets a home variable

## What happened

The Task 2 runner probe of #262 gave its cases private `CLAUDE_CONFIG_DIR` and `CODEX_HOME` folders. Two cases unset both variables, to check that the new check leaves an unset variable unset. The probe process kept the real `HOME`. In the first run, those two cases read the real `~/.claude` and `~/.codex` homes and opened the existing `celetis-update.lock` files there. The lock files and the safety values did not change. The implementer then made the probe run itself again with a private `HOME`, and refuse to run otherwise.

In Verify run 4 of #309 (2026-11-13, HEAD 3d6363e, scenario V9), the Verify child needed an install into a lab home. It ran `CELETIS_HOME='<lab>\home' bash vl.sh labenv bun … engine/celetis --agent claude install`. Its own lab env wrapper `labenv` (copied from run 3) unsets every `CELETIS_*` variable before it starts the command, so the install ran with no `CELETIS_HOME`. The engine fell back to the real home. The install printed `install: C:\Users\ddink\.local\bin\celetis.cmd -> C:\Users\ddink\.local\share\celetis\versions\3d6363e3dc1e26944e060feddf82122d0ef117fd\engine\celetis`. The maintainer's real `current` changed from `c3e19fbc…` to `3d6363e…`, a new real version folder appeared, and the install prune ran on the real `versions` folder. The child restored `current` about 30 seconds later and removed the new folder. A fourth, older version folder may have been pruned; no list from before the install exists.

In the install probe of Task 3 of #348 (2026-11-19, revision 2c90f90), the probe gave itself a private `HOME` under the scratch folder. It then read the real home for its before and after record of the real installation with `os.userInfo().homedir`. Under Bun 1.4.4 on macOS, that call returned the private `HOME`: `HOME=<scratch>/probe-home bun -e 'console.log(require("os").userInfo().homedir)'` printed `<scratch>/probe-home` (tool output). The first run recorded the real installation as absent, so the comparison could not see a write to it. No write reached the real home. The probe then read the home from the user database and refused a home under the scratch folder.

## Root cause

For #262: Inferred: the probe treated the two home variables as the whole isolation. `configHome` of `engine/lib/homes.ts` falls back to `homedir()` when a variable is unset, so an unset case reaches the real home. Uncertain: which other reads of the real Codex home ran in those cases. No write was observed.

For #309: Observed: the wrapper line `for key in $(env | grep -oE '^(CLAUDE[A-Z_]*|AI_AGENT|CELETIS_[A-Z_]*|CODEX_[A-Z_]*)=' | tr -d '='); do unset+=(-u "$key"); done` removed the deliberate value, and the child did not read `CELETIS_HOME` in the started process before the write. Inferred: the active rule `give-a-probe-a-private-home-before-a-case-unsets-a-home-variable` was in the brief, but its trigger names a case of the check that unsets a variable, not a launcher of the check that clears it; the child also did not apply its refusal when the fallback resolves to the real home. Both causes fit; the evidence does not separate them.

For #348: Inferred: Bun derives `os.userInfo().homedir` from `HOME`, unlike Node, which reads the passwd entry. Uncertain: only macOS with Bun 1.4.4 was observed, and the behavior can depend on the Bun version or the platform. Inferred: the rule required the before and after record of the real installation but named no source for the real home.

## Fix

Proposed prevention, as text: a probe that unsets or clears a home variable first runs with a private `HOME` (and `USERPROFILE` on Windows), so each fallback of the code under test also lands in temporary data. A probe can also refuse to start when `HOME` is the real home. Before each command that can install, update, or prune an engine, the check prints the home variable in a process started the same way, passes the value after each wrapper, and runs the command only when the value is under the lab root or the scratch folder; it records the real `current` and the `versions` list before and compares them after. It reads the real home for that record before it changes `HOME`, or from the user database (for example `dscl . -read /Users/<user> NFSHomeDirectory` on macOS, `getent passwd <user>` on Linux), never from `os.homedir()` or `os.userInfo().homedir` under the private `HOME`, and it refuses a real home that resolves under the scratch folder. For a probe case, no structural check is proposed: which variables a code path falls back to needs a read of that code. A structural follow-up needs separate authorization: `scripts/herdr-lab.ts` could give each lab a private `CELETIS_HOME` and refuse an engine install whose target is outside the lab root. The rule stays text until that is built and probed. A run of a signed-in host CLI is outside this fix: `AGENTS.md`, "Host checks", makes such a run reuse the existing installation and its authentication.

## Detection signature

A probe case with an unset `CLAUDE_CONFIG_DIR`, `CODEX_HOME`, or `CELETIS_HOME` while `HOME` is the real home; access times or open handles on files under the real `~/.claude` or `~/.codex` during a probe. An install line of a check that set a lab `CELETIS_HOME` and names the real `~/.local/share/celetis`; a wrapper that unsets `CELETIS_*` and gets the home value in front of it. A before record of the real installation that is absent or empty on a machine that has an installation, or a recorded real home under the scratch folder.

## Rule

Applies when a probe or a check of program code must use temporary installation data and one of its cases, or a wrapper or a launcher that starts its command, unsets, clears, or omits a variable that selects a home or a config folder, or when such a probe gives its process a private `HOME` and must record or protect the real installation. It does not apply to a run of a host CLI that needs the existing authentication of the host; such a run follows `AGENTS.md`, "Host checks". Action: read the fallback of each such variable in the code under test, and give the probe process a private `HOME` (and each other fallback source) before the first case; refuse to run when the fallback resolves to the real home. Before a command that writes an installation (an engine install, update, prune, or restart on new installation data), read the home variable in a process started the same way as that command, and run the command only when the resolved target is under the lab root or the scratch folder; record the real installation (for Celetis, `current` and the `versions` list) before, and compare it after. Read the real home for that record before the probe changes `HOME`, or from the user database, not from `os.homedir()` or `os.userInfo().homedir` under the private `HOME`, and refuse to run when it resolves under the scratch folder. Check: in each case with an unset variable, the resolved home of the code under test is under the scratch folder, and a control that keeps the real `HOME` is refused before its first read; the report shows the printed home of each installation write, the recorded real home outside the scratch folder, a before record that holds the real installation, and an unchanged real installation.

## Related lessons

[[keep-launch-variables-when-a-launch-moves-terminals]] [[check-retained-verification-fixtures-against-current-boundaries]]
