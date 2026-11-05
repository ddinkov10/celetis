---
{
  "schema": 1,
  "name": "check-new-state-rules-against-existing-runner-folders",
  "description": "A new private-record check refused the 0755 runner state folder that existing repositories already have",
  "tags": [
    "data-store",
    "regression",
    "test"
  ],
  "date": "2026-11-04",
  "status": "active",
  "source": "implement session of ddinkov10/celetis#236, Task 4 implementer finding about Tasks 2-3 code",
  "incidents": [
    {
      "id": "e39523f9-1119-4d2b-85ef-4cd729845149",
      "date": "2026-11-04",
      "action": "Tasks 2 and 3 of #236 added readAgentOrder, readUsage, and beginUsageAttempt, which require the shared parent <common>/celetis-flow to be mode 0700; their probes used only fresh temporary repositories",
      "expected": "Default-choice operations and independent launches work in a repository whose runner already created celetis-flow with mkdir(state, { recursive: true }) (mode 0755)",
      "observed": "A probe with a 0755 celetis-flow folder printed the refusal; the real common directory of ddinkov10/celetis has drwxr-xr-x at .git/celetis-flow, so every default-choice createOperation and default Intake/Assist/visual start would throw there",
      "source": {
        "kind": "tool-output",
        "excerpt": "error: usage: /private/tmp/celetis-236-checks/modeprobe/celetis-flow: need a private directory owned by the current user (mode 0700) ... drwxr-xr-x /Users/dinq/Dinq/PROJECTS/celetis/.git/celetis-flow",
        "reference": "https://github.com/ddinkov10/celetis/issues/236"
      },
      "inference": "Inferred: the store checks reused the private-folder rule for a folder that they do not own, and the probes created that folder themselves, so they never met the state that existing runners leave. Uncertain whether the plan's reuse of privateFolderSync suggested the stricter rule. The Task 2 and Task 3 reviews also did not test a pre-existing folder.",
      "diagnosis": [
        "unknown"
      ],
      "revision": "16a108421e0ecb625f0f6fbd50a4a98f60431371"
    }
  ],
  "recurrences": 0,
  "reviews": [
    {
      "id": "e5357975-0516-427a-87e9-225153904e12",
      "requestDigest": "3b96503466296cdb130e8fe786d1587fc2f7c2de1a1636bc9d14f134b574ca7d",
      "date": "2026-11-05",
      "decision": "approve",
      "source": "agent review: lesson curation in the landing of #246; claude child opus/high\n\nApprove under the reviewer rules. The proposal has retained tool output: a probe with a 0755 celetis-flow folder printed the refusal \"need a private directory owned by the current user (mode 0700)\", and the real common directory has drwxr-xr-x at .git/celetis-flow. The rule states applicability (a new check on a file or folder that an existing component already creates), action (probe against that component's real output or an exact copy of its mode, owner, and type), and check (one probe case that starts from state of the existing code path and passes). It adds a probe case, weakens no check, and widens no agent permission; the code correction in the Fix keeps the owner and no-group-or-other-write conditions. It agrees with the principle test-behavior-not-implementation. No live or historical lesson states this rule or holds its incident. The body labels its cause and the uncertainty about the plan as inferred.",
      "related": [
        "check-new-state-rules-against-existing-runner-folders"
      ],
      "followUp": {
        "state": "not-needed",
        "detail": "The rule stays text for judgment at each matching task. This decision requires no structural follow-up."
      }
    }
  ]
}
---
# Test a new state check against the folders that existing installations already have

## What happened

Tasks 2 and 3 of #236 added local agent-order and usage records under `<common>/celetis-flow`. Their readers refuse that shared folder unless its mode is 0700. The existing runner creates the same folder with `mkdir(state, { recursive: true })`, which gives mode 0755. The Task 2 and Task 3 probes created fresh temporary repositories, so the folder was always 0700 there. The Task 4 implementer found the refusal with a 0755 probe. The real common directory of this repository has `drwxr-xr-x` at `.git/celetis-flow`.

## Root cause

Inferred: the new checks applied the rule for a private folder that a store owns to a shared parent that an older component creates. The probes made their own state from nothing, so no probe met the state that an existing installation already has. The reviews did not ask for that case. Uncertain: whether the plan's direction to reuse `privateFolderSync` led to the stricter rule.

## Fix

Proposed: accept a shared parent that is a real directory owned by the current user with no group or other write bits. Keep 0700 for the subfolders that a store owns and 0600 for its files. Add a probe case that starts from a folder made by the existing code path. This rule stays text, because which earlier state is relevant depends on the change; a structural check needs a fixture of real earlier state per store.

## Detection signature

`need a private directory owned by the current user (mode 0700)` for `<common>/celetis-flow` in a repository where the runner ran before.

## Rule

When a change adds a check on a file or folder that an existing component already creates, run its probe against that component's real output (or an exact copy of its mode, owner, and type), not only against state that the probe creates. Check: the probe has one case that starts from state made by the existing code path and passes.
