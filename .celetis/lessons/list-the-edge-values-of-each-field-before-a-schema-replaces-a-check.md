---
{
  "schema": 1,
  "name": "list-the-edge-values-of-each-field-before-a-schema-replaces-a-check",
  "description": "A Zod conversion of the GitHub parsers of #350 refused inputs that the hand-written checks accepted: an absent key read by z.unknown(), and a non-finite comments count read by z.number()",
  "tags": [
    "api",
    "test",
    "regression",
    "refix"
  ],
  "date": "2026-11-26",
  "status": "active",
  "source": "The implement session of #350 on Claude Code (subagent flow): the Task 2 review and the final whole-branch review, 2026-11-26",
  "incidents": [
    {
      "id": "1f0507aa-1763-4c96-9597-f6490406a9ae",
      "date": "2026-11-26",
      "action": "Task 2 of #350 replaced the hand-written checks of engine/lib/github/tracker.ts with Zod schemas and typed the lazily read keys as z.unknown() (author_association, user of the trust filter, the repository reply of project(), the association keys of the REST and GraphQL timeline entries). Its parity probe had 127 tracker cases with wrong values but none with a deleted key.",
      "expected": "Each input that the base accepts stays accepted with the same output (spec Done when 3): the base reads user only for an untrusted item, treats an absent association as untrusted, and lets the thrown line of the repository form pass through.",
      "observed": "zod 4.6.7: z.object({a: z.unknown()}).safeParse({}) gives success false with {\"code\":\"invalid_type\",\"expected\":\"nonoptional\",\"path\":[\"a\"]}. Eight one-key-deleted cases gave base ok or a specific line, lane \"malformed GitHub data\"; for example rev-issue-no-user (trusted issue): base ok, lane TrackerError malformed GitHub data.",
      "source": {
        "kind": "tool-output",
        "excerpt": "z.object({a:z.unknown()}).safeParse({}) => success:false, issue {\"code\":\"invalid_type\",\"expected\":\"nonoptional\",\"path\":[\"a\"]}; rev-issue-no-association: base TrackerError \"#350 was opened by ddinkov10, who is not the owner, ... Celetis does not read it\", lane TrackerError malformed GitHub data",
        "reference": "https://github.com/ddinkov10/celetis/issues/350"
      },
      "inference": "Inferred: the implementer took z.unknown() to accept anything, also an absent key, as the hand-written record()[key] read did. Fixed with z.unknown().optional() and 12 absent-key cases (RED 9 differ, GREEN 0).",
      "diagnosis": [
        "unknown"
      ],
      "revision": "d32bafac325012cac7cb72f8dbfeb7a97f15584c"
    },
    {
      "id": "2014b44c-8e85-4fe7-9d7c-e1690190cd17",
      "date": "2026-11-26",
      "action": "The tracker schema of #350 typed comments as z.number(), where the base parseIssue accepted any typeof \"number\". No probe case tested a non-finite number.",
      "expected": "Spec Requirement 1 of #350: \"a number stays any number (comments)\", and no input that the current code accepts is refused.",
      "observed": "The final reviewer ran parseIssue on a valid issue with comments JSON.parse(\"1e999\"): base returns the issue (comments Infinity), lane throws \"malformed GitHub data\"; z.number().safeParse(Infinity).success === false.",
      "source": {
        "kind": "tool-output",
        "excerpt": "base: {\"key\":\"5\",...,\"comments\":null,...} lane: \"ERR malformed GitHub data\"; numberInf: false",
        "reference": "https://github.com/ddinkov10/celetis/issues/350"
      },
      "inference": "Inferred: same cause class as the absent key: the schema type was chosen by the name of the base check (a number), not by the set of values that the base check accepts. Fixed with z.custom<number>((value) => typeof value === \"number\") and 10 cases with +-1e999 (RED 8 differ, GREEN 0).",
      "diagnosis": [
        "unknown"
      ],
      "revision": "fa711f5ea241cd6305b72331f57d4599b4f4c061"
    }
  ],
  "recurrences": 1,
  "reviews": [
    {
      "id": "001f8e45-9d2b-4e28-8a84-2756d6f29b05",
      "requestDigest": "5cfdb359fd30d1220f767d0c8554fedfb68033f719b30e1f83ffb74e5c5d82b5",
      "date": "2026-11-26",
      "decision": "approve",
      "source": "agent review: lesson curation in the landing of #350; claude child opus/high\n\nApprove under the reviewer rules. Both incidents have observed tool-output evidence from the parity probes and reviews of #350 (z.object({a: z.unknown()}).safeParse({}) fails with expected nonoptional; z.number() refuses Infinity, which the base typeof check accepted). The rule states applicability, action, and check; it adds parity cases and a control run, widens no permission, weakens no check or gate, and adds no network or credential act. It agrees with the principles boundary-discipline, preserve-intended-behavior, test-behavior-not-implementation, and type-system-discipline of the plugin celetis, and adds no tracked test. No live or historical lesson holds its incidents or states its rule; probe-real-tool-semantics-behind-fakes and derive-plan-oracle-values-from-real-producers are related, not the same rule. The body labels the cause as inferred and names the alternative.",
      "related": [
        "list-the-edge-values-of-each-field-before-a-schema-replaces-a-check"
      ],
      "followUp": {
        "state": "proposed",
        "detail": "A generated edge-value case family of the parity probe harness (absent key, own undefined, null, non-finite number, array, own __proto__) for each converted field. This structural work needs separate authorization; this review changes lesson data only."
      }
    }
  ]
}
---
# List the edge values of each field before a schema replaces a check

## What happened

Issue #350 replaced the hand-written checks of the GitHub replies with Zod 4.6.7 schemas under a parity rule: each input that the base accepts gives the same output. Two conversions refused base-accepted inputs. Task 2 typed lazily read keys as `z.unknown()`; Zod refuses an absent key of such a shape (`expected nonoptional`), so eight one-key-deleted replies changed from accepted (or a specific line) to `malformed GitHub data`. Later, `comments: z.number()` refused `Infinity` (`JSON.parse("1e999")`), which the base `typeof value === 'number'` check accepted. The probe had one-fault cases with wrong values only, so both passed it with `0 differ`; a task review and the final review found them.

## Root cause

Inferred, not proven: each schema type was chosen by the name of the base check ("unknown", "a number") and not by the value set that the base check accepts. The value set differs at the edges: an absent key against an own `undefined`, `null`, non-finite numbers, arrays, and an own `__proto__`. Alternative: the probe design listed wrong-value faults per field and no missing-value or edge-value faults, so it could not show the difference.

## Fix

Proposed prevention, not proven enforcement: before a schema replaces a check, write down for each field the base result for an absent key, an own `undefined`, `null`, a non-finite number, an array, and an own `__proto__`, and add one parity case for each edge that the base treats differently from the schema default. A structural check (a generated edge-value case family of the probe harness) needs separate authorization; the rule stays text because the edge set depends on the base check of each field.

## Detection signature

A parity probe with `0 differ` whose one-fault cases only change values; a schema field `z.unknown()` without `.optional()` where the base read the key lazily; `z.number()` where the base tested `typeof`.

## Rule

Applies when a change replaces a hand-written input check with a schema library check (Zod or another) and must keep the accepted inputs of the base. Action: for each converted field, read the base check and record its result for an absent key, an own `undefined`, `null`, a non-finite number, an array, and an own `__proto__`; choose the schema so that it gives the same result (for Zod 4: `.optional()` for a key that may be absent, a `typeof` custom check where the base accepted any number), and add a parity case for each edge. Check: the probe holds an absent-key case and the applicable edge-value cases for each converted field, and a control run against a schema without the edge handling shows a difference.

## Related lessons

[[probe-real-tool-semantics-behind-fakes]]
[[derive-plan-oracle-values-from-real-producers]]
