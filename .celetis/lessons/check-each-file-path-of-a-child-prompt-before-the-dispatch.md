---
{
  "schema": 1,
  "name": "check-each-file-path-of-a-child-prompt-before-the-dispatch",
  "description": "A controller took the brief path from a helper line with a lazy regex that stopped at the drive colon, so five implementer and reviewer prompts named their brief and report as \"C\", and two task reviews ran with no brief",
  "tags": [
    "process"
  ],
  "date": "2026-11-28",
  "status": "active",
  "source": "The implement session of #352 on Claude Code, subagent task loop of Tasks 2 to 6, 2026-11-28",
  "incidents": [
    {
      "id": "6c1f4e0a-8d2b-4b7e-9a3c-2f5d7e8b1a94",
      "date": "2026-11-28",
      "action": "The controller script took the brief path from the task-brief output \"wrote C:/Users/.../task-N-brief.md: 139 lines\" with /wrote (.*?):/, and built the implementer and reviewer prompts of Tasks 2 to 6 from it, also the report path by a string replace.",
      "expected": "Each file path in a child prompt is the full absolute path, and the controller checks that the file exists (and has the expected name) before the dispatch.",
      "observed": "The prompts named the brief and the report as \"C\". Implementers found their briefs in the workspace by its naming convention. Transcripts show that the Task 4 reviewer read the report only, and the Task 5 and 6 reviewers read neither; the Task 6 reviewer wrote \"The dispatch gives both of them only as C\" and reviewed against the global constraints only.",
      "source": {
        "kind": "tool-output",
        "excerpt": "Task 6 review: \"I cannot check this against the request or the implementer's report. The dispatch gives both of them only as \\\"C\\\".\" Task 3 review: \"I could not see the task text itself, because \\\"What was requested\\\" arrived truncated.\""
      },
      "inference": "Tool output: the lazy regex stops at the first colon, which on Windows is the drive colon. Inferred: the controller did not read its own composed prompt before the first dispatch; a POSIX path would have hidden the defect. Alternative: the review package helper uses a different line format, and the controller reused a parser that fit only one of them.",
      "diagnosis": [
        "unknown"
      ],
      "revision": "ecf20ea"
    }
  ],
  "recurrences": 0,
  "reviews": [
    {
      "id": "7c936ea3-775a-4969-91db-73d97de8f378",
      "requestDigest": "2585b88eaa56571b9fb1cb8101caa0ae917c5185f3c3724b4c2fff4f207e0e45",
      "date": "2026-11-28",
      "decision": "approve",
      "source": "agent review: lesson curation in the landing of #352; claude child opus/high\n\nApprove (reviewer rules): the incident holds observed tool output (the Task 6 and Task 3 reviewer lines); the helper format is confirmed: scripts/task-brief of superpowers subagent-driven-development prints \"wrote ${out}: N lines\", and scripts/review-package prints \"wrote ${out}: N commit(s), N bytes\", so /wrote (.*?):/ stops at a Windows drive colon. The rule states applicability, action, and check; it widens no permission, weakens no check or gate, and adds no network or credential act; it agrees with give-each-agent-rule-a-check-where-its-actor-reads. No live or historical lesson holds its incident or states its rule: report-the-exact-arguments-of-a-dispatched-call covers the report of a call, and put-the-posix-form-of-a-folder-on-a-git-bash-path covers PATH entries. The body keeps the inferred cause apart from the observed regex fact.",
      "related": [
        "check-each-file-path-of-a-child-prompt-before-the-dispatch"
      ],
      "followUp": {
        "state": "proposed",
        "detail": "The task-brief and review-package helpers of superpowers:subagent-driven-development print the bare path on a line of its own, so that no controller parses a path out of the line. That work belongs to the superpowers skill and needs separate authorization; this review changes lesson data only."
      }
    }
  ]
}
---
# Check each file path of a child prompt before the dispatch

## What happened

In the implement session of #352, the controller script took the brief path from the line `wrote C:/Users/.../task-N-brief.md: 139 lines` with the regex `/wrote (.*?):/`. The lazy match stopped at the drive colon and gave `C`. The implementer and reviewer prompts of Tasks 2 to 6 named the brief and the report as `C`. The implementers found their briefs by the naming convention of the workspace. The transcripts show that the Task 4 reviewer read only the report, and that the Task 5 and Task 6 reviewers read neither file; the Task 6 reviewer said so and judged the diff against the global constraints only. The Task 3 reviewer said that the task text arrived truncated. The controller found the defect at the Task 6 review, re-ran that review with the paths, and gave the final review a spec check of Tasks 4 and 5 against their briefs.

## Root cause

Observed: the regex stops at the first colon, and a Windows absolute path has a colon after the drive letter. Inferred: the controller did not read its composed prompt, or check its paths, before the first dispatch. A POSIX path would have hidden the defect.

## Fix

Proposed prevention, not proven enforcement: before a dispatch, the controller checks that each file path in the prompt is absolute and names an existing file with the expected name, and it parses a helper line by its known suffix (`: <n> lines`, `: <n> commit(s)`), not by the first colon. A structural follow-up could make the brief and the review package helpers print the bare path on a line of its own, so that no parse is needed; it needs separate authorization and its owner is the superpowers skill, not this project. The check stays text here, because the controller composes prompts in ad-hoc scripts.

## Rule

Applies when a controller builds a child prompt that names a file path taken from tool output. Action: parse the path by the known format of the line (anchored on its suffix), and check before the dispatch that the path is absolute, ends with the expected file name, and exists. Check: the composed prompt of the first dispatch is read once, and each path in it resolves to the intended file.

## Related lessons

[[give-each-agent-rule-a-check-where-its-actor-reads]]
