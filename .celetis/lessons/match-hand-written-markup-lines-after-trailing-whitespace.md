---
{
  "schema": 1,
  "name": "match-hand-written-markup-lines-after-trailing-whitespace",
  "description": "A parse of hand-written ADR Markdown matched the exact heading line, so a heading with trailing spaces silently dropped its replacement links",
  "tags": [
    "build",
    "false-negative"
  ],
  "date": "2026-11-08",
  "status": "active",
  "source": "Final review of ddinkov10/celetis#259",
  "incidents": [
    {
      "id": "105ebe69-9774-4ad8-a4bb-993fd474565a",
      "date": "2026-11-08",
      "action": "Task 1 of #259 parsed docs/adr/ records in adrIndex of scripts/build.ts with lines.indexOf('## Supersedes') after dropping only one trailing \\r of each line, as the plan said, and matched each link only as NNNN-<slug>.md).",
      "expected": "A heading or a link that a reader of the Markdown sees as the same structure gives the same index row, or the build refuses it; it never drops a replacement silently or refuses a valid link with a false message.",
      "observed": "The final reviewer wrote a record whose heading was '## Supersedes  ' (two trailing spaces) with a link to 0035: build exit 0, the 0081 row had an empty 'Replaces parts of' cell. A link '0035-…-engine.md#design' gave exit 1 with 'names 0035-the-board-is-a-part-of-the-engine.md in its Supersedes with no Markdown link to it'.",
      "source": {
        "kind": "tool-output",
        "excerpt": "FAIL P3-trailing exit 0 — problem: 0081 row Replaces parts of is not 0035; FAIL P3-anchor exit 1 — stderr: build: docs/adr/0081-a-new-record.md: a record after ADR-0080 names 0035-the-board-is-a-part-of-the-engine.md in its Supersedes with no Markdown link to it",
        "reference": "ddinkov10/celetis#259, commit 00ea7be"
      },
      "inference": "Inferred: the plan and the implementation took the input classes from the files of the current store, which have no trailing spaces and no anchor links, and did not ask which variants a Markdown reader treats as the same heading or link. Alternative: the plan's literal rule ('drop one trailing \\r') narrowed the check, and the implementer followed it without challenge.",
      "diagnosis": [
        "unknown"
      ],
      "revision": "3f02c0417082cd28fbaeb6a255faa55cf00d327e"
    }
  ],
  "recurrences": 0,
  "reviews": [
    {
      "id": "ec14f688-26e4-43bc-b9e7-39832070ef78",
      "requestDigest": "2d90086d96e75e60b2d11db28053a566f7fbf4843aa1bcdf5097059259d4edfe",
      "date": "2026-11-08",
      "decision": "approve",
      "source": "agent review: lesson curation in the landing of #259; claude child opus/high\n\nApprove (reviewer rules): the proposal has observed tool-output evidence that commit 00ea7be confirms, keeps the inferred cause apart from the facts, states applicability, action, and check, widens no permission and weakens no check, and no active or historical lesson states the same rule (verify-exception-matching-against-runtime-identities covers matcher exceptions for runtime URL spellings, not parses of hand-written markup).",
      "related": [
        "match-hand-written-markup-lines-after-trailing-whitespace"
      ],
      "followUp": {
        "state": "not-needed",
        "detail": "The rule depends on the format and stays text; no structural follow-up is proposed."
      }
    }
  ]
}
---
# Match hand-written markup lines after their trailing whitespace

## What happened

In #259, `adrIndex` of `scripts/build.ts` found the `## Supersedes` section of each ADR with an exact line match after it dropped one trailing `\r`, and matched a link only when `.md)` ended it. The final reviewer showed two cases in a throwaway clone: a heading `## Supersedes  ` with two trailing spaces made the build exit 0 with an empty row, so a replacement was lost with no error; and a link `0035-the-board-is-a-part-of-the-engine.md#design` was refused with a line that said that no link existed. The fix trims the end of each line and accepts an optional anchor (commit `00ea7be`).

## Root cause

Inferred, not proven: the parse rules came from the bytes of the current store, which has no trailing spaces and no anchor links, so the probe set had no case for a variant that a Markdown reader sees as the same heading or link. An alternative: the plan stated the narrow rule, and the implementer did not challenge it.

## Fix

Proposed prevention, not enforced: for each structural token of a hand-written text format (a heading, a title line, a link target), list the variants that the format's readers treat as the same token, such as trailing whitespace, line ends, and a fragment, and either accept each one or refuse it with a line that names the variant. Add one probe case for each variant. This rule stays text, because the set of variants depends on the format and needs judgment.

## Detection signature

A generated output with a missing entry and exit 0 after an edit that a human reader cannot see, or a refusal that says a reference is missing while the reference is present.

## Rule

Applies when a program parses hand-written markup (Markdown, YAML front matter, a text table) and a structural line or reference decides its output. Action: before the probe set is final, list the variants of each structural token that the readers of the format treat as equal (trailing whitespace, `\r\n`, a fragment or a query on a link); accept each variant, or refuse it with a line that names it; never drop the token silently. Check: one probe case for each listed variant gives the same output as the plain form, or the named refusal.
