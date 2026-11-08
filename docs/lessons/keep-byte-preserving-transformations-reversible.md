---
{
  "schema": 1,
  "name": "keep-byte-preserving-transformations-reversible",
  "description": "Lossy UTF-8 decoding changed bytes that had to survive: outside a managed instruction block, and in suite output whose plan fixed utf8 pipes",
  "tags": [
    "test",
    "data-loss",
    "process",
    "recurring"
  ],
  "date": "2026-11-08",
  "status": "active",
  "source": "Implementer concern and controller reproduction of ddinkov10/celetis#276, Task 1\n\nFinal review and coordinator reproduction of ddinkov10/celetis#230",
  "incidents": [
    {
      "id": "f84c947c-bcc1-48ad-a108-908e1a3c13b4",
      "date": "2026-11-08",
      "action": "The #276 plan (issue comment 6713230817) fixed the Task 1 interface of streamBun as: it sets both pipes to utf8 and writes each chunk with process.stdout.write; the same task carried keep-byte-preserving-transformations-reversible.",
      "expected": "The suite bytes reach stdout and stderr of land unchanged, also bytes that a UTF-8 decoder cannot reproduce, because the spec says the client output is byte for byte the output of land today.",
      "observed": "At 6ee5211 a suite that writes 66 ff 0a gave land stdout 66 ef bf bd 0a; the base land at 2fc5486 (runBun, inherited stdio) gave 66 ff 0a.",
      "source": {
        "kind": "tool-output",
        "excerpt": "observation j-invalid: base stdout starts 66ff0a6c616e643a, lane stdout starts 66efbfbd0a6c616e, equal false; controller rerun: status 0 stdout 66efbfbd0a",
        "reference": "ddinkov10/celetis#276 Task 1 report, Concern 1"
      },
      "inference": "Inferred: the plan stream cases checked only valid UTF-8 (a split emoji and e-acute), so the interface value was not checked against the carried rule. Uncertain: the plan session transcript is not available.",
      "diagnosis": [
        "not-followed"
      ],
      "revision": "6ee5211285c37e4109f573592d42198b27d5b7a8",
      "brief": "Plan of #276 (comment 6713230817), Task 1 Interfaces: streamBun sets both pipes to utf8; Task 1 Lesson rules: keep-byte-preserving-transformations-reversible sha256:9c7d6045...",
      "lesson": {
        "name": "keep-byte-preserving-transformations-reversible",
        "revision": "2fc548691a802b56b8be30acacb0ce82eae057d1",
        "digest": "9c7d60453f9038b3610c38742c1e8d44fbb150d3c791347aaf5bb9276522c29c"
      }
    },
    {
      "id": "issue-230-review-1d7459c-outside-bytes",
      "date": "2026-11-02",
      "action": "Implemented an unconditional byte-preserving instruction update with lossy UTF-8 file decoding and string rewriting.",
      "expected": "Approved criteria 2 and 3 require every original byte outside the managed range to survive append and refresh.",
      "observed": "Append and refresh both exited 0 while prefix 2320436166e90a became 2320436166efbfbd0a; refresh suffix 53756666697820ff0a became 53756666697820efbfbd0a.",
      "source": {
        "kind": "tool-output",
        "excerpt": "append: exit 0; expectedPrefixHex=2320436166e90a; observedPrefixHex=2320436166efbfbd0a; sameBytes=false. refresh: exit 0; expectedSuffixHex=53756666697820ff0a; observedSuffixHex=53756666697820efbfbd0a; sameBytes=false.",
        "reference": "#230 final-review.md and coordinator review-reproduction.log"
      },
      "inference": "Lossy decoding is supported by source and execution. Why implementation and checks omitted non-UTF-8 input is unknown. BOM and valid multibyte UTF-8 cases did not prove arbitrary-byte preservation.",
      "diagnosis": [
        "unknown"
      ],
      "revision": "1d7459c7df01dc82854642c4c50cae40fe380d44"
    }
  ],
  "recurrences": 1,
  "reviews": [
    {
      "id": "4e769549-f0cb-4378-9687-749beaf29bec",
      "requestDigest": "e67a93f8beb8fa64387250d15f9628a963e3bf485a6a7b0ba4db937a12b9aad2",
      "date": "2026-11-05",
      "decision": "approve",
      "source": "agent review: lesson curation in the landing of #236; codex child host default/high\n\nApprove under the reviewer rules: the retained byte comparison establishes data loss, the account distinguishes evidence from uncertain causes, and the rule gives applicability, a reversible transformation, and a byte comparison check. It agrees with the data-preservation and behavioral-check principles.",
      "related": [
        "keep-byte-preserving-transformations-reversible"
      ],
      "followUp": {
        "state": "not-needed",
        "detail": "The byte ownership contract needs task-specific judgment. This decision adds no structural follow-up."
      }
    },
    {
      "id": "9d01fa7f-1731-4ccd-b16e-dd780a04bb27",
      "requestDigest": "df12fb1d7b0e822fd69e4f6592a399dab10ee09abddc42e6157467d55be03588",
      "date": "2026-11-08",
      "decision": "merge",
      "source": "agent review: lesson curation in the landing of #276; claude child opus/high\n\nMerge, under the reviewer rules: the incident is a recurrence of the active lesson keep-byte-preserving-transformations-reversible. The plan of #276 carried that lesson at digest 9c7d6045, the digest of the live file, into the same task whose interface fixed utf8 pipes, and the retained bytes (66 ff 0a became 66 ef bf bd 0a at 6ee5211, against 66 ff 0a of the base) show the loss that its rule names (diagnosis not-followed). The probe case that the proposal asks for, an input that a text decoder cannot reproduce, is the check of that rule, so the proposal states the same rule for one more path. The survivor keeps the active name and every incident and review, adds the #276 facts apart from the inferred cause, and widens only the applicability: output that a process forwards, and a plan or brief that fixes an interface value of a byte-preserving path. The general plan-review listing for each carried rule is not taken into the rule: it is the structural follow-up of the proposal, a change of the plan step that needs separate authorization, so it stays proposed. The rule grants no permission, adds no network or credential act, weakens no check, and contradicts no project instruction, skill, or principle; it agrees with docs/procedures/task-lessons.md, which carries each matched rule into its task.",
      "related": [
        "check-planned-interfaces-against-carried-lessons",
        "keep-byte-preserving-transformations-reversible"
      ],
      "followUp": {
        "state": "proposed",
        "detail": "Structural follow-up named in the proposal, which needs separate authorization: the plan review of celetis:plan lists, for each carried lesson rule, the interface values of the task that the rule constrains, with the probe case that would reject the mistake."
      }
    }
  ]
}
---
# Keep byte-preserving transformations reversible

## What happened

The #230 implementation promised exact preservation outside a managed instruction block but read and wrote the file as UTF-8 text. The final reviewer and coordinator reproduced successful writes that replaced outside bytes 0xe9 and 0xff with UTF-8 efbfbd. Valid UTF-8 and BOM fixtures had passed.

In #276, the spec said that the client output of a landing is byte for byte the output of `land` today. The plan (issue comment 6713230817) fixed the Task 1 interface of `streamBun` as "it sets both pipes to `utf8`", and the same task carried this lesson. The implementer built the interface. At 6ee5211 a suite that writes `66 ff 0a` gave `land` stdout `66 ef bf bd 0a`, where the base `land` at 2fc5486 (inherited stdio) gave `66 ff 0a`. The stream cases of the plan held only valid UTF-8 (a split emoji, `é`). The controller reproduced it and ruled for the spec: `streamBun` forwards the raw chunks.

## Root cause

UTF-8 decoding loses invalid byte sequences. Slicing the decoded string cannot restore them. The reason the original checks omitted these inputs is unknown.

In #276, inferred: the plan fixed an interface value (the encoding of the pipes) and did not check it against the carried rule, so no case of the plan held an input that a decoder cannot reproduce. Uncertain: the plan session transcript is not available.

## Fix

The repair retains instruction bytes in a Buffer, uses a reversible one-byte representation for ASCII marker matching, and compares bytes before writing. Temporary cases cover append, refresh, baseline addition, a supported link, and stable repeats. Proposed prevention remains a text rule because the ownership contract determines which bytes must survive; no repository-wide enforcement is added.

In #276, the ruling of the build forwards the raw chunks, carries the bytes reversibly through the daemon stream, and adds a probe suite with invalid UTF-8 on each stream. A structural follow-up, proposed in #276, needs separate authorization: the plan review of `celetis:plan` lists, for each carried lesson rule, the interface values of the task that the rule constrains, with the probe case that would reject the mistake. No enforcement is proven.

## Rule

Applies when approved behavior requires exact preservation of bytes: outside a managed range, or in output that a process reads or forwards. It also applies when a plan or a brief carries this rule and fixes an interface value of that path, for example an encoding or a stdio mode. Action: keep the representation reversible through read, transform, comparison, and write; before a plan or brief is published, check each such interface value against this rule. Check: include an input that a text decoder cannot reproduce unchanged, and compare bytes at the public operation boundary.

## Related lessons

[[plan-condition-must-not-narrow-a-spec-rule]]
