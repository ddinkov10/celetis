---
{
  "schema": 1,
  "name": "read-the-diff-of-each-edit-before-the-commit-and-the-report",
  "description": "Document edits went wrong while the gate passed: an exact-string edit deleted a heading, and edits that a refused shell call never ran were reported or committed as done",
  "tags": [
    "process",
    "git",
    "regression",
    "false-positive"
  ],
  "date": "2026-11-09",
  "status": "active",
  "source": "Task 1 review of ddinkov10/celetis#262 (commit e832b37), reported by the implementer child and confirmed by the coordinator\n\nTask 4 of ddinkov10/celetis#265 (the board reference), task review and fix round 1, found by the task reviewer child and confirmed by the coordinator",
  "incidents": [
    {
      "id": "262-t1-agents-heading-removed-01",
      "date": "2026-11-09",
      "action": "Task 1 of #262 added one paragraph at the end of the section \"Verify gate\" of AGENTS.md with an exact-string Edit whose old_string ended with the next heading line `## General text` and whose new_string did not keep that line. The implementer checked the result with git status only and committed e832b37.",
      "expected": "The brief of Task 1, Step 11: add one paragraph to AGENTS.md, \"Verify gate\". Each other line of AGENTS.md stays.",
      "observed": "The heading `## General text` was gone and a double blank line remained; the verify gate printed verify: PASS on e832b37, and only the task review found the deletion.",
      "source": {
        "kind": "tool-output",
        "excerpt": "git show 81c126e:AGENTS.md | grep -n '^## ' -> 77:## General text; grep -n '^## ' AGENTS.md at e832b37 -> 45:## Verify gate, 103:## Where agent text lives (no General text). Review hunk @@ -67,21 +67,28 @@ removes the line. Fix d15d630 restored it at line 85.",
        "reference": "https://github.com/ddinkov10/celetis/issues/262"
      },
      "inference": "Inferred: the old_string spanned the neighbouring heading as an anchor, and the new_string did not carry it over; no diff of the document was read before the commit. Uncertain: whether a review of `git diff` would have been done with another tool. The gate checks no heading list of AGENTS.md, so no structural check caught it.",
      "diagnosis": [
        "unknown"
      ],
      "revision": "e832b37"
    },
    {
      "id": "029908d5-7f97-4b92-b7ae-ca3b7bf5dc40",
      "date": "2026-11-09",
      "action": "The Task 4 implementer of #265 wrote in its report (shorten commit 1ef7e18) that the takeover text that the board README keeps at engine/board/README.md:75-78 is one sentence with no link or code.",
      "expected": "A task report describes the committed text as the diff and the file show it.",
      "observed": "The task reviewer found at 1ef7e18 a sentence with two links to engine/README.md and a full restatement of the start order and of the takeover refusal of engine/README.md, \"The start\"; the coordinator confirmed lines 75-78.",
      "source": {
        "kind": "tool-output",
        "excerpt": "engine/board/README.md:75-78 at 1ef7e18: 'The daemon validates the main `.celetis.yaml` at its start, takes its lock `daemon`, and then opens the board, before it takes over its runs ([The master daemon](../README.md#the-master-daemon), \"The start\"). Until the takeover ends, the board serves the page and its reads, and the daemon refuses each request of the board ([The master daemon](../README.md#the-master-daemon), \"The start\").'",
        "reference": "https://github.com/ddinkov10/celetis/issues/265"
      },
      "inference": "Inferred: the implementer described its intended text, not the text that it committed. Uncertain: whether it read the file after the edit. Alternative: it read an older version of the section.",
      "diagnosis": [
        "unknown"
      ],
      "revision": "1ef7e18"
    },
    {
      "id": "c41ba953-b8c4-4a81-9a69-402ba39b5e48",
      "date": "2026-11-09",
      "action": "In fix round 1 of Task 4 of #265, the same implementer committed b7e90bb and reported findings K3 (two Limits bullets with one fact) and K4 (a bullet that repeats engine/README.md:592) as fixed: it wrote that it removed one sentence and that it cut the other bullet to its board-only part with a pointer.",
      "expected": "A fix report claims only the edits that the fix commit holds; each finding marked fixed has a hunk in the fix diff.",
      "observed": "git diff 1ef7e18..b7e90bb had no hunk in the Limits section of engine/board/README.md; at b7e90bb, line 1217 still ends 'reservation lives in the daemon process, and a stop of the daemon ends it.', line 1248 still holds 'Run/Resume ownership and warnings live only in the daemon process', and line 1251 still holds 'no daemon steers the sessions'. The scoped re-review returned K3 and K4 NOT ADDRESSED.",
      "source": {
        "kind": "tool-output",
        "excerpt": "git diff 1ef7e18..b7e90bb --stat: engine/board/README.md | 45 ++--- (21 insertions, 24 deletions), no Limits hunk; grep -n at b7e90bb: 1217:  reservation lives in the daemon process, and a stop of the daemon ends it. / 1248:- Run/Resume ownership and warnings live only in the daemon process. / 1251:- Between the stop of the old daemon and the takeover of its successor, no daemon steers the",
        "reference": "https://github.com/ddinkov10/celetis/issues/265"
      },
      "inference": "Inferred: the implementer wrote the fix report from its plan of the edits and did not compare it with the diff of its commit. Uncertain: whether the two edits failed silently (for example an exact-string replace that matched nothing) or were never made. The verify gate passed, because no check reads these sentences.",
      "diagnosis": [
        "unknown"
      ],
      "revision": "b7e90bb"
    },
    {
      "id": "INC-265-T6-1",
      "date": "2026-11-09",
      "action": "The Task 6 implementer of #265 built the new intro of plugins/celetis/docs/workflow.md in a scratch file; the command that appended the kept paragraph \"In this document, these names are files of the repository `celetis`\" was refused by the worktree guard, and the implementer committed the shortening without that paragraph.",
      "expected": "The brief of Task 6, Step 5: keep the paragraph that names the files of the repository `celetis`.",
      "observed": "The first shorten commit removed the paragraph (hunk `@@ -40,9 +39,0 @@` of `git diff a4aa0e6..HEAD`); the verify gate and every probe passed. The implementer found the hunk when it read the diff before its report, restored the paragraph from a4aa0e6 by a script, and amended the commit (final eec5885).",
      "source": {
        "kind": "tool-output",
        "excerpt": "Child report INC-265-T6-1: 'A command that appended the path-convention paragraph ... was refused by the worktree guard, and the intro file lacked the paragraph.' / 'the hunk @@ -40,9 +39,0 @@ of git diff a4aa0e6..HEAD ... I found it by reading the diff hunks before I wrote this report.'",
        "reference": "https://github.com/ddinkov10/celetis/issues/265"
      },
      "inference": "Reported by the child, with the same cause as incident c41ba953 (the child of Task 4 later reported that its edit shared one Bash call with `git add` and that the guard refused the whole call): a refused step of a command chain is read as done. Here the diff read before the report caught it, which supports the rule; the gate and the probes did not.",
      "diagnosis": [
        "unknown"
      ],
      "revision": "eec5885"
    }
  ],
  "recurrences": 3,
  "reviews": [
    {
      "id": "0c4f9ebd-d31f-466e-8edf-9b60dfa1247d",
      "requestDigest": "173d1fd1c7d9d3411e866b953a8bd55b3880f872c95f2e2b72b17194a2c87b7c",
      "date": "2026-11-09",
      "decision": "merge",
      "source": "agent review: lesson curation in the landing of #265; claude child opus/high\n\nMerge under the reviewer rule for proposals that state the same rule. Both pending proposals of this batch state one rule: read the diff of each edited document before the commit or the report and reconcile it with the intended change. Proposal 332f677c names proposal 089527f6 as related, and its incident INC-265-T6-1 is a removed kept paragraph, which is the detection signature of 089527f6. The survivor keeps all four incidents and both source strings; its rule is the union of both actions and checks. The inferred causes stay labeled as inference, apart from the observed diffs. The structural hunk check stays a proposed follow-up.",
      "related": [
        "read-the-diff-of-each-document-edit-before-the-commit",
        "check-each-claimed-edit-against-the-diff-before-the-report",
        "read-the-diff-of-each-edit-before-the-commit-and-the-report"
      ],
      "followUp": {
        "state": "proposed",
        "detail": "Structural follow-up from proposal 332f677c, which needs separate authorization: before the scoped re-review, the coordinator checks that each finding marked fixed names a file and line inside a hunk of the fix diff, and refuses the report when one does not."
      }
    }
  ]
}
---
# Read the diff of each edit before the commit and before the report

## What happened

Four incidents in two builds. In Task 1 of #262, a task added one paragraph at the end of the section "Verify gate" of `AGENTS.md`. The exact-string edit used the next heading line, `## General text`, as the end of its old text, and the new text did not keep that line. The implementer checked only `git status`, and committed. The task review found that the heading was gone and that a double blank line remained. The fix restored the heading.

In Task 4 of #265, the implementer described a kept sentence of `engine/board/README.md` as "one sentence with no link or code", but the committed text had two links and a full restatement. In fix round 1, the same implementer reported two findings as fixed, but the fix commit had no hunk for them: the three bullets were unchanged. It later reported the cause: the edit shared one shell call with `git add`, the worktree guard refused the whole call, and it committed and reported from its plan. In Task 6 of the same build, another implementer's append of a kept paragraph was refused by the same guard; the first shorten commit dropped the paragraph, and the implementer found the hunk only because it read the diff before its report.

The verify gate passed each time. A review found the first three; the diff read found the fourth.

## Root cause

Inferred, not observed by the coordinator: in #262, the old text of the edit included a neighbouring line as an anchor, and the new text dropped it; in #265, a refused step of a command chain was read as done, so a report or a commit described the planned text, not the committed text. In each case no diff of the edited file was read before the commit or the report. Uncertain: whether the first #265 incident (the wrong description of a kept sentence) has the same cause, and whether another diff tool would have shown the #262 deletion to its implementer. No gate reads these sentences or the heading list of `AGENTS.md`, so only a review or a diff read compares the result with the intended change.

## Anti-pattern

```text
old_string: "<last line of the section>\n\n## Next heading"
new_string: "<last line of the section>\n\n<new paragraph>\n"
```

```text
edit-command && git add <file>   # the guard refuses the whole call; the report says "fixed"
```

## Fix

Proposed prevention, as text: make each file edit in a call of its own, and treat a refused call as one that ran nothing. Before the commit of a change that edits a tracked document, read `git diff <base> -- <file>` and account for each removed line. Before a report claims a fix or describes committed text, read `git diff <fix base>..HEAD -- <file>` and name for each finding the hunk that holds its edit. The Task 6 incident of #265 shows that the diff read catches the mistake.

Proposed structural follow-up, which needs separate authorization: the coordinator checks before the scoped re-review that each finding marked fixed names a file and line inside a hunk of the fix diff, and refuses the report when one does not. The rest stays text: which removed lines are intended, and which hunk fixes which finding, need judgment, and the gate cannot tell an intended deletion of a heading from an unintended one.

## Detection signature

A document diff with a removed heading or other removed line that the task did not ask for; a double blank line where a heading was; a fix report that marks a finding fixed while `git diff <fix base>..HEAD` has no hunk at the cited lines; a re-review verdict NOT ADDRESSED for a finding that the report called fixed; a refused shell call before a commit.

## Rule

Applies when a task, a repair, or a fix edits a tracked document (Markdown, a skill, a module, an ADR, `AGENTS.md`), in particular with an exact-string replace whose old text includes a line outside the intended change or with a shell command; and when an implementer or a fixer reports a finding as fixed or describes text that it committed. Action: make each file edit in a call of its own, and treat a refused call as one that ran nothing. Before the commit, read `git diff <base> -- <file>` for each edited document, and confirm that each removed line is one that the task removes. Before the report, read the diff of the fix commit for each edited file, write for each finding the file and the line of the hunk that holds its edit, and describe committed text only from the file at the commit. Check: the task report names the diff command for each edited document; the diff shows no removed line that the task did not ask for; each finding marked fixed names a hunk that `git diff <fix base>..HEAD` shows; and each description of committed text matches `git show HEAD:<file>` at the cited lines.
