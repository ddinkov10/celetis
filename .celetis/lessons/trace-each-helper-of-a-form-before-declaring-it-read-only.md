---
{
  "schema": 1,
  "name": "trace-each-helper-of-a-form-before-declaring-it-read-only",
  "description": "A read declaration of a command form follows each helper on its call path, including a fetch or a migration.",
  "tags": [
    "process",
    "false-positive"
  ],
  "date": "2026-11-21",
  "status": "active",
  "source": "implement of #357 (step session), lane feat/357-intent-a-set-of-mcp-tools-that",
  "incidents": [
    {
      "id": "c46adaf0-46ab-43c4-812f-8655e35b849c",
      "date": "2026-11-21",
      "action": "The plan of #357 declared the form `setup check` read-only (`readOnlyHint: true`) from its name and prose.",
      "expected": "Decision 3 of the plan counts a change of Git as a write, so a form whose call path changes Git declares `read: false`.",
      "observed": "The task review of 19ab461 found that `Setup.check` runs `checkTrunk`, which runs `git fetch -q origin <trunk>` (engine/setup.ts:374). The fix 2090bb1 changed the declaration to `changes`.",
      "source": {
        "kind": "tool-output",
        "excerpt": "engine/setup.ts:374: await this.live(['fetch', '-q', 'origin', this.trunk], `cannot fetch ${this.trunk} from origin`); reviewer probe: setup_check readOnly true",
        "reference": "https://github.com/ddinkov10/celetis/issues/357"
      },
      "inference": "Inferred: the plan session read the command names and the prose `writes`, not each helper of the call path. Uncertain: the plan transcript is not available; the same table marked `queue status` and `dispatch show` as writes from their code, so the session read some paths.",
      "diagnosis": [
        "unknown"
      ],
      "revision": "19ab461"
    }
  ],
  "recurrences": 0,
  "reviews": [
    {
      "id": "e557281e-874a-4cd2-ba17-a701e95e24d6",
      "requestDigest": "39d45a656927c0829a5244de83c39eae07675cebf9cb7bb9107339ea92c4654b",
      "date": "2026-11-21",
      "decision": "approve",
      "source": "agent review: lesson curation in the landing of #357; claude child opus/high\n\nApprove: observed tool-output evidence (engine/setup.ts:374 runs git fetch in checkTrunk; fix 2090bb1 changed the declaration of setup check to a write). The rule states applicability, action, and check; it narrows a read-only declaration and widens no permission, weakens no check, and contradicts no skill or principle. No live or historical lesson holds its incident or states the same rule: derive-plan-oracle-values-from-real-producers covers oracle values of checks, not a read or write declaration of a form. The body keeps the cause labelled as inferred and the prevention as proposed.",
      "related": [
        "trace-each-helper-of-a-form-before-declaring-it-read-only"
      ],
      "followUp": {
        "state": "proposed",
        "detail": "A Verify scenario that runs each read-declared form in a fixture and compares a digest of the checkout, its Git folder, and the state folder before and after. It needs separate authorization."
      }
    }
  ]
}
---
# Trace each helper of a form before declaring it read-only

## What happened

The plan of #357 gave each covered CLI form a read value for the MCP annotation `readOnlyHint`. It declared `setup check` read-only. The task review found that `setup check` runs `git fetch` through `checkTrunk` (`engine/setup.ts:374`). The plan's own decision 3 counts a change of Git as a write. The fix changed the declaration to a write.

## Root cause

Inferred: the read value came from the name of the form and its prose, not from each helper on its call path. A fetch changes the remote-tracking ref, `FETCH_HEAD`, and the object store, although the form changes no file of the checkout. Uncertain: no transcript of the plan session is available.

## Fix

Proposed prevention, not enforced: before a plan or a task declares a form read-only, list each helper that the form calls, and mark the form as a write when one helper can write by the declared write rule (a fetch, a migration of a record, a lock that is not transient). A structural follow-up needs separate authorization: a Verify scenario that runs each read-declared form in a fixture and compares a digest of the checkout, its Git folder, and the state folder before and after. The rule stays text, because the write rule of a project is a judgment that a generic check cannot know.

## Rule

Applies when a plan, a task, or a review declares a command form or a tool as read-only for a permission or annotation. Action: list each helper on the call path of the form, and check each one against the declared write rule, including network fetches, record migrations, and state files. Check: the declaration names, for each read-only form, the helpers that were checked, and a fixture run of the form leaves the checkout, its Git folder, and its state folder unchanged except for the declared exclusions.

## Related lessons

- [[derive-plan-oracle-values-from-real-producers]]
