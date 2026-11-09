---
{
  "schema": 1,
  "name": "list-the-sites-before-a-document-claims-every-site",
  "description": "Universal claims went past their evidence: ADR-0081 claimed one exception where the code has two, and a #263 ruling scoped a two-file diff claim wider than its command",
  "tags": [
    "process",
    "refix",
    "git",
    "false-negative"
  ],
  "date": "2026-11-09",
  "status": "active",
  "source": "Task 6 review of ddinkov10/celetis#263\n\nFinal review of ddinkov10/celetis#256 and its scoped re-review",
  "incidents": [
    {
      "id": "82163bbd-dc02-4c81-8450-41f5c377f7fb",
      "date": "2026-11-09",
      "action": "The #263 build controller ran `git diff --stat 2a9e010 HEAD -- skills docs/procedures docs/principles step-prompt.md AGENTS.md scripts/verify.ts docs/workflow.md`, saw two files, and wrote the ruling 'plan base 2a9e010 vs HEAD d480bc1 differs only in docs/workflow.md and scripts/verify.ts' into the ledger, the shared task context, and the Task 6 brief. The Task 6 implementer copied it into docs/adr/0084-the-agent-text-names-engine-outcomes.md.",
      "expected": "A claim about the difference of two commits states the path scope of the command that produced it, for example 'no agent-text file differs', or rests on an unfiltered `git diff --name-only`.",
      "observed": "`git diff --name-only 2a9e010 d480bc1 | wc -l` printed 81; the same command limited to skills, docs/procedures, docs/principles, and step-prompt.md printed 0. The task reviewer graded the ADR sentence Important.",
      "source": {
        "kind": "tool-output",
        "excerpt": "git diff --name-only 2a9e010 d480bc1 | wc -l -> 81; ... -- skills docs/procedures docs/principles step-prompt.md | wc -l -> 0",
        "reference": "ddinkov10/celetis#263, Task 6 review of commit 208ecef"
      },
      "inference": "The controller read the path-limited diff as a whole-tree diff. The derived claim still held for its use (the check reads only agent-text files), so no count was wrong; only the scope of the sentence was. Alternative: the existing site-listing rule covers this, and the action did not apply its check.",
      "diagnosis": [
        "not-followed"
      ],
      "revision": "208ecef",
      "brief": ".superpowers/sdd/263/common.md, 'Controller rulings' (workspace of the #263 build)",
      "lesson": {
        "name": "list-the-sites-before-a-document-claims-every-site",
        "revision": "d480bc1",
        "digest": "2c10971efb1c5b6109a7abb9f9075d7dddd0f4c9d0f1d9eccd59c4b9f8abd343"
      }
    },
    {
      "id": "855161f3-8d7c-4a99-94c5-bbe14934c059",
      "date": "2026-11-08",
      "action": "Task 6 of #256 wrote ADR-0081 with 'A malformed response now ends on the failure path of its call (blocked, exit 6)' and 'A response that its parser refuses throws the one port error GitHubError'. The final-review fix (d4c8ad1) replaced them and added 'The one exception is engine/board/history.ts'.",
      "expected": "A sentence that states a property of every site, or names the one exception, matches the list of sites in the code and in the recorded results.",
      "observed": "Final review: the V8 results show exit 7, exit 5, a longer wait, a warning, a blocked row, and no board data, not exit 6 at each site; the parent refusals carry their own texts; board/history.ts:63 calls parseIssue outside a port method. Scoped re-review of d4c8ad1: GitHub.epic also passes plain Errors of parseEpicRepository (tracker.ts:411, rethrown by parsed) and parseEpicChildren (tracker.ts:447, outside parsed), so 'the one exception' is false.",
      "source": {
        "kind": "tool-output",
        "excerpt": "Minor 1: The exit class in ADR-0081 is too general ... Minor 4: One path does not give GitHubError for a refusal (board/history.ts:63). Re-review: The ADR claims one exception, and the code has two (GitHub.epic passes on refusals of the epic parsers as a plain Error).",
        "reference": "https://github.com/ddinkov10/celetis/issues/256"
      },
      "inference": "Inferred: each writer generalized from the sites it had in view (the landing reads; then the board history call) and did not enumerate the error paths of every method from the code. Alternative: the plan's Global Constraints said 'blocked in the landing and the worktree', which framed the first sentence.",
      "diagnosis": [
        "unknown"
      ],
      "revision": "d4c8ad1138dd47a82254de94f728647ce9de3cc5"
    }
  ],
  "recurrences": 1,
  "reviews": [
    {
      "id": "2a530405-b476-4943-bcc6-863be4f41ee1",
      "requestDigest": "04c576371729e79c309b4e1762cf02113fcf75f9f41a08676aee17310a6cc977",
      "date": "2026-11-08",
      "decision": "approve",
      "source": "agent review: lesson curation in the landing of #256; claude child opus/high\n\nApprove under the reviewer rules: the tool-output excerpts of the final review and its scoped re-review establish the incident, and the cited sites hold in the lane (engine/board/history.ts:63 calls parseIssue outside a port method; engine/lib/tracker.ts calls parseEpicRepository and parseEpicChildren in GitHub.epic). The root cause is labeled as inference with an alternative. The rule states applicability, action, and check, widens no permission, weakens no check, and contradicts no project instruction, skill, or principle. No live or historical lesson states the same rule: check-removed-terms-in-owned-document-sections covers removed terms, and declare-the-exit-classes-of-each-layer-that-runs-a-command covers the declared exit classes of a command, not a universal claim of a document.",
      "related": [
        "list-the-sites-before-a-document-claims-every-site"
      ],
      "followUp": {
        "state": "not-needed",
        "detail": "No structural follow-up is required by this decision; the rule stays text."
      }
    },
    {
      "id": "23d8082c-186e-448f-bd8b-5d7c5ce9d47d",
      "requestDigest": "062a152b19aca9f5e38b213d9c9cf64454b81cf85e676e80955e978cfca2f083",
      "date": "2026-11-09",
      "decision": "merge",
      "source": "agent review: lesson curation in the landing of #263; claude child opus/high\n\nMerge under the reviewer rules: the active lesson list-the-sites-before-a-document-claims-every-site states the same rule, a universal claim written from a list of every covered item, and the proposal names it as the lesson that its incident did not follow. The incident is observed: in the lane, `git diff --name-only 2a9e010 d480bc1 | wc -l` prints 81, the same diff limited to skills, docs/procedures, docs/principles, and step-prompt.md prints 0, and ADR-0084 now states the 81 files. A claim that two commits differ only in two files is a claim that no other path differs, so the active rule applies. The survivor keeps the active name and every incident and review, adds the incident, and names the scope of a diff command in the fix and the rule. The cause stays labeled as inference. The rule adds a check, weakens none, and contradicts no skill, principle, or instruction file.",
      "related": [
        "scope-a-diff-claim-to-the-paths-that-the-command-read",
        "list-the-sites-before-a-document-claims-every-site"
      ],
      "followUp": {
        "state": "not-needed",
        "detail": "The rule stays text: the scope of a claim needs judgment of its later use, and no gate reads rulings or briefs."
      }
    }
  ]
}
---
# List the sites, or the files of a diff, before a claim covers every one

## What happened

ADR-0081 of #256 first said that a malformed response ends as `blocked`, exit 6, and that every refusal throws `GitHubError` with `malformed GitHub data`. The recorded results showed other failure paths and other texts. The fix replaced both sentences and added "The one exception is `engine/board/history.ts`". The scoped re-review found a second path, `GitHub.epic`, that passes plain errors of the epic parsers. The final review allows one fix wave, so the false sentence stayed open.

During the #263 build, the controller compared the plan base 2a9e010 with the build base d480bc1 by a `git diff --stat` that named six paths. It saw two changed files and wrote that the commits differ "only in" those two files. The ruling went into the ledger, the shared task context, and the Task 6 brief, and the implementer copied it into ADR-0084. The task reviewer ran `git diff --name-only 2a9e010 d480bc1` and found 81 files; the agent-text paths had none.

## Root cause

Inferred, not proven: each writer generalized from the sites in view and did not list every call site or error path from the code before writing a universal claim. Alternative: the plan text framed the first claim.

In #263, inferred: the controller read a path-limited diff as a whole-tree diff. The claim was used only to say that line numbers of agent text are leads, which stays true, so no result was wrong; the sentence was wider than its evidence. The incident names this lesson as not followed.

## Fix

Proposed, needs no structural change: before a document states a property of every site, or names the only exception, list the sites from the code (for example a grep of the callers or of each method's error path) and the recorded results, and write the claim from that list. For a claim about the files that two commits differ in, run `git diff --name-only` with no path filter, or write the claim with the path scope of the command. This stays text: which sites a claim covers needs judgment that no gate can check.

## Rule

Applies when a document, an ADR, a ruling, a brief, or a report states that every site, call, path, or file has a property, names the one exception, or states which files two commits differ in. Action: list each site from the code and the recorded results before writing the sentence, and write the claim so that it holds for each listed site, or name each exception; for a diff, take the file list from a diff with no path filter, or write the claim with the same path scope as the command (for example "no agent-text file differs"). Check: a reader can map each site of the list to the sentence, and a grep of the sites, or the command of the claim rerun with the scope that the sentence states, finds none that the sentence does not cover.
