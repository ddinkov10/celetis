---
{
  "schema": 1,
  "name": "probe-each-key-name-that-an-issue-mapper-branches-on",
  "description": "A Zod issue mapper that special-cased the last path key schema also rewrote a map key named schema; the probe corpus had no such key",
  "tags": [
    "test",
    "false-negative",
    "regression"
  ],
  "date": "2026-11-27",
  "status": "active",
  "source": "The implement session of #349 on Claude Code, final whole-branch review, 2026-11-27",
  "incidents": [
    {
      "id": "256b3a44-20c4-45fc-8906-495775882077",
      "date": "2026-11-27",
      "action": "Task 8 of #349 mapped Zod issues of the lesson records to the old refusal lines with failure() in engine/lib/lesson/record.ts, which moved the path one level up whenever issue.path.at(-1) was the string schema, and the differential probe of items 11 and 12 passed with 0 differences.",
      "expected": "The path rule applies only to the literal failure of the record field schema, so a path-map key named schema in before, after, or watched of a review snapshot keeps its full path, as on the base.",
      "observed": "The final whole-branch review reproduced it against the base copy: base snapshot.before.schema: invalid lesson store path (exit 2); lane snapshot.before: invalid lesson store path (exit 2). The probe corpus held no map key named schema. After the fix (issue.code === invalid_value), five new probe cases failed first and then passed (3125 cases, 0 differences).",
      "source": {
        "kind": "tool-output",
        "excerpt": "base: snapshot.before.schema: invalid lesson store path; lane: snapshot.before: invalid lesson store path",
        "reference": "https://github.com/ddinkov10/celetis/issues/349#issuecomment-7228919219"
      },
      "inference": "Inferred: the corpus generator mutates values at the declared field paths, so a key name taken from file data never equals a key name that the mapper special-cases. Alternative: the brief of the task did not name the mapper branch as a case to probe.",
      "diagnosis": [
        "unknown"
      ],
      "revision": "28bdbbfa"
    }
  ],
  "recurrences": 0,
  "reviews": [
    {
      "id": "ffb0103f-4c3c-4969-a0e6-03cd1a7d392c",
      "requestDigest": "75c4ce514138119f32dbce75d038880df2a3f4761482f6908ee6340bddbbb2c6",
      "date": "2026-11-27",
      "decision": "approve",
      "source": "agent review: lesson curation in the landing of #349; claude child opus/high\n\nApprove (reviewer rules): the proposal has observed tool-output evidence (a base-versus-lane run gave snapshot.before.schema on the base and snapshot.before on the lane); the fix in engine/lib/lesson/record.ts now tests issue.code invalid_value with the last key. The rule states applicability, action, and check; it widens no permission, weakens no check or gate, adds no network or credential act, and agrees with the principle test-behavior-not-implementation and with AGENTS.md (the probe stays untracked). No live or historical lesson holds its incident. list-the-edge-values-of-each-field-before-a-schema-replaces-a-check covers edge values of converted fields, and refuse-at-the-parser-each-name-that-a-reader-branches-on covers file names in archives; neither states this rule, so no merge. The causes in the body stay labeled as inference.",
      "related": [
        "probe-each-key-name-that-an-issue-mapper-branches-on"
      ],
      "followUp": {
        "state": "proposed",
        "detail": "A shared probe corpus helper that adds, at each input-keyed map level, a key equal to each key name that a mapper or a reader compares. This structural work needs separate authorization; this review changes lesson data only."
      }
    }
  ]
}
---
# Probe each key name that an issue mapper branches on

## What happened

Task 8 of #349 replaced the hand checks of the lesson records with Zod schemas, and a mapper `failure()` turned the first Zod issue into the old refusal line. The mapper moved the path up one level when the last path key was `schema`, for the literal `need schema 1` failure. A review snapshot has path maps (`before`, `after`, `watched`) whose keys come from the file, so a map key named `schema` lost its last path part. The differential probe gave 0 differences, because no case had such a key. The final whole-branch review found it with a focused base-versus-lane run.

## Root cause

Inference: the mutation corpus varies values at declared field paths and adds an extra key and a `__proto__` key, but it does not add, at a map with keys from the file, a key equal to each key name that the mapper or a reader special-cases. Uncertain: the brief could also have named the branch.

## Fix

Proposed: when a mapper or a reader branches on a key name (`schema`, `kind`, `type`, `id`), add a probe case with that key name at each object whose keys come from the file, and limit the branch by the issue code or the path depth. Not enforced: the corpus generator of a probe is throwaway per lane, so the rule stays text; a structural follow-up would be a shared corpus helper that adds the branch key names to each map level.

## Rule

Applies when a change maps schema issues (or other parse errors) to refusal lines with a rule that branches on a key name or a path part, and the record has a map or an object whose keys come from the input. Action: list each key name that the mapper or the reader compares, and add a parity case with each such name as a key at each input-keyed map level; make the branch test the issue code or the exact path, not the last key alone. Check: the probe holds, for each listed key name, a case at each input-keyed map level, and a control run of the mapper without the code or path test shows a difference.

## Related lessons

[[list-the-edge-values-of-each-field-before-a-schema-replaces-a-check]]
[[refuse-at-the-parser-each-name-that-a-reader-branches-on]]
