---
{
  "schema": 1,
  "name": "compare-each-known-limit-with-the-spec-rule-that-it-narrows",
  "description": "Concerns and Minor grades were judged by reach: a controller deferred two anti-goal breaks, and an implementer and a reviewer kept two spec-rule breaks because only anti-goals and goals were compared",
  "tags": [
    "process",
    "false-negative",
    "regression"
  ],
  "date": "2026-11-09",
  "status": "active",
  "source": "Task 3 of ddinkov10/celetis#262 (commit d4800e7): the implementer report and the task review; coordinator regrade and fix 6cc32a8\n\nFinal review of ddinkov10/celetis#268",
  "incidents": [
    {
      "id": "a4226dc4-f583-4948-b764-c8706b97b41b",
      "date": "2026-11-09",
      "action": "The Task 3 implementer of #262 reported two behaviors as concerns and did not fix them: fileAt took any `git ls-tree --name-only` hit as a file, so a tree at the contract path of a target gave an error part (exit 6); and the final validation reused the check-time stop text `nothing changed` after parts changed.",
      "expected": "Spec of #262, \"celetis update\": \"A target revision with no contract file of the plugin, or with no served-set file of the program ... is a mismatch ... It is not an `error` part ... exits with the class `prerequisite`\"; and a stop after parts changed must not state that nothing changed.",
      "observed": "RED on d4800e7: case c3 `update` exit 6 with `fatal: git cat-file <rev>:plugins/celetis/contract.json: bad file`; case fb1 `completed: ['program']` with `...serves 2; nothing changed; set one compatible source and ref ...`. GREEN on 6cc32a8: c3 exit 3 with P2; fb1 without `nothing changed`.",
      "source": {
        "kind": "tool-output",
        "excerpt": "Task 3 report, fix round 1: 'c3 ... RED: update check exit 6, each plugin part error: update: cannot read plugins/celetis/contract.json ... bad file'; 'fb1 ... RED error ends with ... serves 2; nothing changed; set one compatible source ...'. Implementer: 'I graded each item by its reach ... and reported it as a concern. I did not compare it with the spec rule that it narrows.'",
        "reference": "https://github.com/ddinkov10/celetis/issues/262"
      },
      "inference": "Child report (inferred cause): each item was graded by its reach (a rare tree at the path; a message only) and kept as a concern, with no comparison to the spec rule that it narrows. The two read paths (disk EISDIR and Git ls-tree) had no shared rule for 'is a file'. The implementer brief did not carry plan-condition-must-not-narrow-a-spec-rule for the implementer's own concerns.",
      "diagnosis": [
        "unknown"
      ],
      "revision": "d4800e7"
    },
    {
      "id": "e7ef32cf-2f91-4d52-8cac-21ea485c6e72",
      "date": "2026-11-09",
      "action": "The Task 3 reviewer of #262 graded the same two items Minor 1 and Minor 2: 'Grade: compared with the anti-goals. Nothing changes, so there is no half update ... Goal 4 holds. The reach needs a commit with a folder named contract.json at the configured ref, so the grade is Minor.'",
      "expected": "The reviewer brief held plan-condition-must-not-narrow-a-spec-rule ('no form that the spec refuses passes as an accepted limit without a recorded maintainer decision') and grade-an-anti-goal-break-by-the-spec-not-by-reach. The spec design rule on a missing contract file is narrowed by exit 6, so the finding is a missed requirement (Important), whatever its reach.",
      "observed": "Both items came back as Minor with 'Approved'; the coordinator compared them with the quoted spec rule, regraded both Important, and the fix round reproduced each one (RED) and fixed it (GREEN).",
      "source": {
        "kind": "tool-output",
        "excerpt": "task-3-review.md Minor 1: 'Requirement: the spec says \"A target revision with no contract file ... is a mismatch ... It is not an error part ...\". A tree at that path is no file.' ... 'Grade: compared with the anti-goals ... so the grade is Minor.'",
        "reference": "https://github.com/ddinkov10/celetis/issues/262"
      },
      "inference": "Inferred: the reviewer applied grade-an-anti-goal-break-by-the-spec-not-by-reach, whose action compares a finding only with the anti-goals and goals; a spec design rule outside those lists was quoted and still graded by reach. plan-condition-must-not-narrow-a-spec-rule covers a review ruling, but the reviewer did not apply it to its own grade. Alternative: the reviewer read 'goals' to exclude design rules by intent.",
      "diagnosis": [
        "wrong-or-incomplete-rule",
        "not-followed"
      ],
      "revision": "d4800e7",
      "brief": ".superpowers/sdd/262/task-3-review-dispatch.md lists both lessons by path and digest; durable copy of the review ruling is in the Verify report of #262",
      "lesson": {
        "name": "grade-an-anti-goal-break-by-the-spec-not-by-reach",
        "revision": "81c126e912716290a13daf7d3d714a3e8c9ccbd4",
        "digest": "c64edbecc67b018b5ffedf3a000cb135b2830c03b8aea7a4af9fefe25bcc9b07"
      }
    },
    {
      "id": "e128ed40-c8f1-4d9e-9842-596c961059db",
      "date": "2026-11-09",
      "action": "In the task loop of #268, the controller accepted the Task 3 review (board agentCause maps every unsafe outcome, also I/O reasons, to the permissions line) and the Task 5 review (a tryFlock throw no longer maps to LessonError 6 'cannot acquire the lesson lock') as clean, and deferred both as Minor to the final review, because each path is rare.",
      "expected": "The spec of #268 lists as anti-goals 'a moved check that tests fewer states than its old copy' and 'a merged helper call that loses one of its effects'. A finding that a moved check accepts other states, or that a replaced helper call lost an effect, breaks an anti-goal, so the task fix loop handles it before close, whatever its reach.",
      "observed": "The final whole-branch review raised both again as findings against the anti-goals and the lessons keep-each-effect-of-a-removed-helper-call and a-moved-check-keeps-the-states-of-its-old-rule. A fault-injection probe showed the lost effect: 06b7536 printed 'lesson-store: <lock>: cannot acquire the lesson lock', 3ce9bb8 printed 'lesson-store: update: cannot acquire the plugin update lock (errno 22)', exit 6 on both. The one final fix wave (fcc75f5) restored both.",
      "source": {
        "kind": "tool-output",
        "excerpt": "06b7536: exit=6, stderr 'lesson-store: /tmp/celetis-501/lessons/<hash>.lock: cannot acquire the lesson lock'; 3ce9bb8: exit=6, stderr 'lesson-store: update: cannot acquire the plugin update lock (errno 22)'. Task 3 reviewer: 'maps every unsafe outcome to the permissions line ... unresolved risk ... plan-level' (Minor).",
        "reference": "https://github.com/ddinkov10/celetis/issues/268#issuecomment-6727974554"
      },
      "inference": "Inferred: the task reviewers graded by reach (rare race or errno path) and by the brief text, and the controller deferred Minor findings without checking them against the spec anti-goals. Alternative: the brief of Task 3 required the board mapping by kind, so part of the cause is a plan line that did not restate the old states. Uncertain which weighs more.",
      "diagnosis": [
        "not-followed"
      ],
      "revision": "3ce9bb8",
      "brief": ".superpowers/sdd/268/task-5-brief.md carried keep-each-effect-of-a-removed-helper-call; task-3-brief.md carried a-moved-check-keeps-the-states-of-its-old-rule",
      "lesson": {
        "name": "keep-each-effect-of-a-removed-helper-call",
        "revision": "46c687c",
        "digest": "8db46c0445bc5909d19e57be0dcea9bd4046a2653c2eaee983d6dabcf1428b2c"
      }
    }
  ],
  "recurrences": 2,
  "reviews": [
    {
      "id": "173d562a-19ea-4af7-9121-b5c3c656ab25",
      "requestDigest": "cc0b67e96e2632428064046df94902607fed050192ee3f1f4df1a93c8ae809ce",
      "date": "2026-11-09",
      "decision": "edit",
      "source": "agent review: lesson curation in the landing of #268; claude child opus/high\n\nEdit, then promote, under the reviewer rules. The incident is observed: the retained probe excerpt gives exit 6 with the lesson lock line on 06b7536 and the plugin update lock line on 3ce9bb8, the progress ledger of #268 records the Task 3 and Task 5 items as deferred Minor findings, and the final review findings anchor F1 and F2 in spec anti-goals, fixed by fcc75f5. The rule states applicability, action, and check. No active lesson states it: keep-each-effect-of-a-removed-helper-call and a-moved-check-keeps-the-states-of-its-old-rule state the technical rules, and plan-condition-must-not-narrow-a-spec-rule covers a changed spec rule, not the grade of a deferred finding. Edit 1: the upstream task loop says that Minor findings never enter the fix loop, so the action now grades an anti-goal break a missed requirement (Important by the review calibration) by a recorded ruling, keeps the existing round limit, and sends an uncertain comparison to a maintainer decision as an unresolved material risk; this keeps the rule consistent with the skill and the review-evidence module, and it widens no permission and weakens no check. Edit 2, an attributed correction of the body only: 06b7536 is an older trunk commit, an ancestor of the base 46c687c, not the base; the final review still graded both findings Minor, and a controller ruling (R3) sent them to the fix wave. The incident evidence stays unchanged.",
      "related": [
        "grade-an-anti-goal-break-by-the-spec-not-by-reach"
      ],
      "followUp": {
        "state": "not-needed",
        "detail": "Whether a finding breaks a spec anti-goal needs judgment, so no structural check is known; the ledger line that names the compared anti-goals stays the check of the rule."
      }
    },
    {
      "id": "3e7a92d0-5c14-4b6f-a8d3-e1f06b9c2475",
      "requestDigest": "c4bdd411a25f48ca8b024bcba8c28910123eab322cbd22b125e996df5ed04d23",
      "date": "2026-11-09",
      "decision": "supersede",
      "source": "agent review: lesson curation in the landing of #265; claude child opus/high\n\nSupersede under the reviewer rule for an active lesson whose rule new evidence shows is wrong or incomplete. Incident e7ef32cf of proposal c65e8fe2 has the diagnosis wrong-or-incomplete-rule for grade-an-anti-goal-break-by-the-spec-not-by-reach: the reviewer followed its action, which names only anti-goals and goals, and a narrowed design rule of the spec passed as Minor. The proposal itself asks to extend or merge that lesson. Two active rules for one grade decision would overlap, so one replacement holds both: it keeps the anti-goal and goal comparison, the controller ledger check, and the uncertain-risk branch of the old rule, and adds every spec rule of the same input, the implementer's own concerns, and the maintainer-decision exception. The replacement keeps all three incidents, the earlier review, and both source strings. plan-condition-must-not-narrow-a-spec-rule stays active and separate: it covers a plan, a brief, or a ruling that changes a spec rule.",
      "related": [
        "compare-each-known-limit-with-the-spec-rule-that-it-narrows",
        "grade-an-anti-goal-break-by-the-spec-not-by-reach"
      ],
      "followUp": {
        "state": "not-needed",
        "detail": "Both rules state that the comparison needs judgment; no structural check is proposed."
      }
    }
  ]
}
---
# Compare each known limit and each Minor grade with every spec rule that it can narrow

## What happened

Two builds. In the task loop of #268, two task reviews reported a lost state or a lost effect as Minor: the board mapped every `unsafe` outcome (also I/O reasons) to the permissions line, and a `tryFlock` throw lost the lesson lock line. The controller closed both tasks and recorded both items as deferred Minor findings for the final review. The task briefs carried the lessons `a-moved-check-keeps-the-states-of-its-old-rule` and `keep-each-effect-of-a-removed-helper-call`. The final review raised both again and anchored each in a spec anti-goal; a controller ruling sent them to the one final fix wave, which restored them. A fault-injection probe showed the old lesson lock line on an older trunk commit (06b7536) and the plugin update lock line on the branch (3ce9bb8), with exit 6 on both.

In Task 3 of #262, the implementer named two behaviors as concerns and did not fix them. A tree at the contract path of a target gave an error part (exit 6), and the final validation said `nothing changed` after parts changed. The spec states that a target with no contract file is a mismatch with the class `prerequisite`, not an error part. The task reviewer quoted that spec rule, compared each item only with the anti-goals and goal 4, and graded both Minor by reach. The reviewer brief carried the lesson `grade-an-anti-goal-break-by-the-spec-not-by-reach`, whose action names only anti-goals and goals. The coordinator compared each item with the quoted rule, regraded both Important, and the fix round reproduced and fixed each one.

## Root cause

Inferred: in both builds the actors graded by reach (a rare race, errno path, or tree at a path; a message only). In #268, the controller accepted the grade without a check of the finding against the anti-goals of the spec. Alternative for #268: the Task 3 brief required the mapping by kind and did not restate the old states, so the plan also invited the gap. In #262, the implementer did not compare its own concerns with the spec, and the reviewer followed `grade-an-anti-goal-break-by-the-spec-not-by-reach`, so a design rule of the spec fell outside the comparison. `plan-condition-must-not-narrow-a-spec-rule` covers a review ruling, but it was not applied to the grade. Uncertain: whether the #262 reviewer read "goals" to exclude design rules by intent.

## Fix

Proposed prevention, as text, not enforced: an implementer concern, a reviewer grade, and a controller's acceptance of a deferred Minor finding each compare the item with each anti-goal and goal of the spec and with every spec rule that covers the same input or path (an exit class, a mismatch rule, a printed claim). An item that breaks or narrows one is a missed requirement, which the review calibration grades Important, so it enters the task fix loop under its existing round limit, unless a recorded maintainer decision accepts it. This stays text: which spec rule covers an input, and whether an item breaks it, need judgment.

## Detection signature

A concern or a Minor finding that quotes a spec rule or an anti-goal and then grades by reach ("rare", "only a message", "needs a commit with ..."); a deferred Minor finding of a ledger that names no spec rule.

## Rule

Applies when an implementer reports a concern or a known limit, or a task review or a controller grades a finding Minor or defers it, and the approved spec lists anti-goals or goals, or states a rule for the same input, path, exit class, or printed claim. Action: quote each such anti-goal, goal, and rule, and compare the behavior with it; when the behavior breaks or narrows one, fix it in the task, or record a ruling that grades it a missed requirement (Important) and send it through the task fix loop before close, whatever its reach, unless a recorded maintainer decision accepts it; when the comparison stays uncertain, carry it as an unresolved material risk for a maintainer decision. Check: each concern, each Minor finding, and each deferred finding of the ledger names the anti-goals, goals, and spec rules that it was compared with and the result, and none breaks or narrows one without a fix or a recorded decision.

## Related lessons

[[keep-each-effect-of-a-removed-helper-call]]
[[a-moved-check-keeps-the-states-of-its-old-rule]]
[[plan-condition-must-not-narrow-a-spec-rule]]
