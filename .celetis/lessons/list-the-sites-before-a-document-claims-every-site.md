---
{
  "schema": 1,
  "name": "list-the-sites-before-a-document-claims-every-site",
  "description": "Universal claims went past their evidence: ADR-0081 claimed one exception where the code has two, a #263 ruling scoped a two-file diff claim wider than its command, an ADR-0091 summary line dropped an exception of its own Decision, and a #304 controller brief gave four presses a timeout that only one has",
  "tags": [
    "process",
    "refix",
    "git",
    "false-negative",
    "recurring"
  ],
  "date": "2026-11-11",
  "status": "active",
  "source": "The implement session of ddinkov10/celetis#304 on Claude Code, task review of Task 3 (the decision record ADR-0099), 2026-11-11\n\nTask 4 review of ddinkov10/celetis#283 (commit 45fa8c9)\n\nTask 6 review of ddinkov10/celetis#263\n\nFinal review of ddinkov10/celetis#256 and its scoped re-review",
  "incidents": [
    {
      "id": "e539afe9-57b2-4486-a0b2-948bac15003e",
      "date": "2026-11-11",
      "action": "The controller turned a task-review risk of Task 1 (\"a slow-app New intake press can pass the page timeout\") into a consequence for the Task 3 brief, and wrote it for four presses: \"a board press with no space (New intake, Assist, Make visual, Open shell) takes about hc run + 10 s + 5 s, so it can pass the 10-second page timeout of the board\". The implementer copied the four presses into ADR-0099.",
      "expected": "Before the brief states that a set of sites has a property, list each site from the code and write the claim only for the sites that have it (here only New intake), as the carried rule list-the-sites-before-a-document-claims-every-site says for a brief.",
      "observed": "The Task 3 reviewer confirmed the timeout only for New intake. The controller then read engine/board/page/board.ts:153 (post('/api/intake', {}, 'New intake failed', { timeout: 10000 })), board.ts:326, :374, :936 (Assist, Open shell, Make visual call post with no options), and ui.ts:258-265 (a timer only when options is given).",
      "source": {
        "kind": "tool-output",
        "excerpt": "engine/board/page/board.ts:153:    const outcome = await post('/api/intake', {}, 'New intake failed', { timeout: 10000 }); ... ui.ts: const timeout = options ? setTimeout(() => controller?.abort(), options.timeout) : undefined;",
        "reference": "https://github.com/ddinkov10/celetis/issues/304"
      },
      "inference": "Inferred: the controller widened the reviewer's one-press finding to the four presses that share the open path, because they share openTab, without reading where the timeout lives (the page, not the open path). Alternative: the four-press list came from the plan's list of person tabs (Decision 8). Uncertain: whether the rule did not reach the controller as an actor, since the controller held the plan text with the rule but the rule names its actors as document authors.",
      "diagnosis": [
        "not-followed"
      ],
      "revision": "2922539",
      "brief": "task-3-additions.md, Rulings of the controller 3: \"A slow Herdr app: ... a board press with no space (New intake, Assist, Make visual, Open shell) takes about hc run + 10 s + 5 s, so it can pass the 10-second page timeout of the board\"",
      "lesson": {
        "name": "list-the-sites-before-a-document-claims-every-site",
        "revision": "3fe0a16",
        "digest": "de52cdd835b8f5592701046d84fcdfac2aff69d2db9f1926883566b509010ca5"
      }
    },
    {
      "id": "4bff6d49-f7f9-4b7c-8783-ff6c58d9d1d8",
      "date": "2026-11-10",
      "action": "Task 4 of #283 wrote in the Consequences of ADR-0091: \"One name names one thing in current text, and the whole engine is in `engine/`.\"",
      "expected": "A claim of \"whole\" holds for each site or names each exception, as the active lesson list-the-sites-before-a-document-claims-every-site requires; spec \"Done when\" 2 keeps DESIGN.md, PRODUCT.md, and .impeccable/ at the root.",
      "observed": "The task review found the claim broader than the record's own Decision 2 (line 58), which keeps DESIGN.md, PRODUCT.md, and more at the root; the fix commit dce0477 names those files.",
      "source": {
        "kind": "tool-output",
        "excerpt": "Consequences, first bullet: \"the whole engine is in `engine/`\". Decision 2 says `DESIGN.md`, `PRODUCT.md`, `.impeccable/` (the board design files) and `scripts/` stay at the root, and spec \"Done when\" 2 allows those exceptions. The claim is slightly broader than the record's own Decision 2.",
        "reference": "https://github.com/ddinkov10/celetis/issues/283"
      },
      "inference": "Inferred: a summary sentence restated the goal (one folder) and dropped the exception that the decision keeps. The brief carried the lesson, so the rule was retrieved and not followed. Uncertain whether a summary line in Consequences reads to an author as a claim that the rule covers.",
      "diagnosis": [
        "not-followed"
      ],
      "revision": "45fa8c9",
      "brief": "Task 4 brief of the #283 plan, \"Lesson rules\": list-the-sites-before-a-document-claims-every-site",
      "lesson": {
        "name": "list-the-sites-before-a-document-claims-every-site",
        "revision": "5cfd9da95d79b6c17ee35f3ece555b9281bd7c8b",
        "digest": "2d270c011dee83d3ccef3868a3cd82b00a7e7aef71e1488cb099ab5b8287f2e0"
      }
    },
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
  "recurrences": 3,
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
    },
    {
      "id": "c41f9e72-3a68-4b05-8d1e-7f2a6b0c93d4",
      "requestDigest": "541160c23f209fbeb52e387e22856451ff026103df1d5c02751981b5cfbae9ef",
      "date": "2026-11-10",
      "decision": "merge",
      "source": "agent review: lesson curation in the landing of #283; claude child opus/high\n\nMerge under the reviewer rules: the active lesson list-the-sites-before-a-document-claims-every-site states the same rule, a claim that covers every part written from a list of each part and its exceptions, and the proposal names it as the lesson that its incident did not follow and proposes this merge in its Fix. The incident is observed: at 45fa8c9, line 91 of ADR-0091 (the first Consequences bullet) said \"the whole engine is in `engine/`\", while Decision 2 at line 58 keeps `DESIGN.md` and `PRODUCT.md` at the root; in the lane, line 95 names `DESIGN.md`, `PRODUCT.md`, and `.impeccable/` as files that stay at the root. A claim that a component is whole in one folder is a claim that each part is there, so the active rule applies. The survivor keeps the active name and every incident and review, adds the incident, the tag recurring, and the #283 paragraphs, and names a summary line and a claim of a whole component in the fix and the rule. The cause stays labeled as inference with its uncertainty. The rule adds a check, weakens none, and contradicts no skill, principle, or instruction file. The proposal's own rule is not kept as a second active lesson, because it states a part of the survivor's rule.",
      "related": [
        "name-the-exceptions-of-a-whole-claim-in-a-decision-record",
        "list-the-sites-before-a-document-claims-every-site"
      ],
      "followUp": {
        "state": "not-needed",
        "detail": "The rule stays text: which exceptions a summary claim must name depends on the meaning of the decision, and no gate reads it."
      }
    },
    {
      "id": "92664de1-c4a6-4a40-91da-8c7f24b2f850",
      "requestDigest": "4e1309e5fd419bde16f8065d65fbaa3aab5e2047ed5927dfadc504228580fa99",
      "date": "2026-11-11",
      "decision": "merge",
      "source": "agent review: lesson curation in the landing of #290; claude child opus/high\n\nMerge under the reviewer rules: the proposal states the same rule as the active lesson list-the-sites-before-a-document-claims-every-site, whose applicability already names a brief and a ruling; the incident records that rule as carried and not followed, and the proposal itself names this merge as its follow-up. The survivor keeps all four incidents and names a brief that widens a review finding. Observed facts and inferred causes stay apart.",
      "related": [
        "check-each-site-of-a-claim-that-a-controller-brief-adds",
        "list-the-sites-before-a-document-claims-every-site"
      ],
      "followUp": {
        "state": "not-needed",
        "detail": "The rule stays text: which sites have a property needs a read of the code, which a gate cannot express for prose."
      }
    }
  ]
}
---
# List the sites, or the files of a diff, before a claim covers every one

## What happened

ADR-0081 of #256 first said that a malformed response ends as `blocked`, exit 6, and that every refusal throws `GitHubError` with `malformed GitHub data`. The recorded results showed other failure paths and other texts. The fix replaced both sentences and added "The one exception is `engine/board/history.ts`". The scoped re-review found a second path, `GitHub.epic`, that passes plain errors of the epic parsers. The final review allows one fix wave, so the false sentence stayed open.

During the #263 build, the controller compared the plan base 2a9e010 with the build base d480bc1 by a `git diff --stat` that named six paths. It saw two changed files and wrote that the commits differ "only in" those two files. The ruling went into the ledger, the shared task context, and the Task 6 brief, and the implementer copied it into ADR-0084. The task reviewer ran `git diff --name-only 2a9e010 d480bc1` and found 81 files; the agent-text paths had none.

In #283, the first Consequences bullet of ADR-0091 said "the whole engine is in `engine/`". Decision 2 of the same record keeps `DESIGN.md`, `PRODUCT.md`, and `.impeccable/`, the board design files, at the root. The task review found the summary claim broader than the Decision, and dce0477 named those files. The Task 4 brief carried this lesson.

In the implement session of #304, the task review of Task 1 recorded a risk: with a slow Herdr app, a New intake press with no space can pass the 10-second page timeout. The controller carried that risk into the brief of Task 3 for four presses (New intake, Assist, Make visual, Open shell), and the implementer wrote the four presses into ADR-0099. The task review of Task 3 confirmed the timeout only for New intake. The code sets a timeout only at `engine/board/page/board.ts:153`; Assist, Open shell, and Make visual call `post` with no options, and `post` sets a timer only with options (`engine/board/page/ui.ts`). The fix round corrected the record.

## Root cause

Inferred, not proven: each writer generalized from the sites in view and did not list every call site or error path from the code before writing a universal claim. Alternative: the plan text framed the first claim.

In #263, inferred: the controller read a path-limited diff as a whole-tree diff. The claim was used only to say that line numbers of agent text are leads, which stays true, so no result was wrong; the sentence was wider than its evidence. The incident names this lesson as not followed.

In #283, inferred: a summary sentence restated the goal (one folder) and dropped the exception that the Decision keeps. The rule reached the author and was not followed. Uncertain whether an author reads a summary line in Consequences as a claim that this rule covers.

In #304, inferred, not proven: the four presses share the open path of `openTab`, so the controller assumed that they share the page timeout too, and did not list the sites of the timeout. Alternative: the controller took the list from the plan's list of tabs that a person opens. The rule was in the plan that the controller read; uncertain whether the controller read its own brief as a document that the rule covers.

## Fix

Proposed, needs no structural change: before a document states a property of every site, or names the only exception, list the sites from the code (for example a grep of the callers or of each method's error path) and the recorded results, and write the claim from that list. For a claim about the files that two commits differ in, run `git diff --name-only` with no path filter, or write the claim with the path scope of the command. A summary line (a Consequences bullet, a status line) that says a component is whole, complete, or in one place is such a claim too: compare it with each exception that the same text or its source keeps. A controller that turns a review finding into a brief claim names only the sites that the finding or a read of the code shows. This stays text: which sites a claim covers needs judgment that no gate can check.

## Rule

Applies when a document, an ADR, a ruling, a brief, or a report states that every site, call, path, or file has a property, that a component is whole, complete, or in one place, names the one exception, or states which files two commits differ in; a summary line such as a Consequences bullet counts, and so does a brief or a ruling that carries a review finding or a plan fact to more sites than its source names. Action: list each site from the code and the recorded results before writing the sentence, and write the claim so that it holds for each listed site, or name each exception, and name each site that is not checked; for a summary line, compare the claim with each exception that the same text or its source keeps; for a diff, take the file list from a diff with no path filter, or write the claim with the same path scope as the command (for example "no agent-text file differs"). Check: a reader can map each site of the list to the sentence, no exception of the same text or its source contradicts the sentence, and a grep of the sites, or the command of the claim rerun with the scope that the sentence states, finds none that the sentence does not cover.
