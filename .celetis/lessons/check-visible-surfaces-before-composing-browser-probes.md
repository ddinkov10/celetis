---
{
  "schema": 1,
  "name": "check-visible-surfaces-before-composing-browser-probes",
  "description": "Browser probes used surfaces that the state or the probe size hides: an Idle scroll check under a panel, and 375x812 setups through desktop-only buttons",
  "tags": [
    "ui",
    "test",
    "process",
    "recurring"
  ],
  "date": "2026-11-07",
  "status": "active",
  "source": "Final-review fix wave of ddinkov10/celetis#250, implement step session (child report to the coordinator)\n\nSelf-review of the implementation plan for ddinkov10/celetis#245",
  "incidents": [
    {
      "id": "7ba57b10-871b-4dfc-8e37-63934d7ac4cf",
      "date": "2026-11-07",
      "action": "The first full RED run of the fix-wave probe composed the 375x812 cases b1 and f1 from the desktop targets #history-count and #keys-open, with no check of the visible surfaces at that width.",
      "expected": "Each case sets up its state through a surface that is visible at that size (active lesson check-visible-surfaces-before-composing-browser-probes, named in the brief).",
      "observed": "375x812 b1: `automatic open, focus on #history-count: active=BODY` (the focus did not move, so the case repeated case a); f1: `TimeoutError: page.click: Timeout 30000ms exceeded.` A visibility read then gave [\"history-count\",false,0], [\"keys-open\",false,0], [\"board-more\",true,44].",
      "source": {
        "kind": "tool-output",
        "excerpt": "375x812 b1 active=BODY; f1 TimeoutError: page.click: Timeout 30000ms exceeded.; visibility [\"history-count\",false,0], [\"keys-open\",false,0], [\"board-more\",true,44]",
        "reference": "docs/superpowers/verification/250-final-fix/ of the lane feat/250-host-the-board-server-the; the fix report in the runtime report of #250"
      },
      "inference": "Reported by the child: it applied the rule to the panel and the dialog layering but not to the setup targets. The child corrected the cases (b1 through #board-more, f1 through the More board actions menu) and ran RED again before GREEN; the first run is not evidence.",
      "diagnosis": [
        "not-followed"
      ],
      "revision": "007e845",
      "brief": "The fix brief carried check-visible-surfaces-before-composing-browser-probes (sha256:4c990225...) by path and digest (.superpowers/sdd/250/final-fix-brief.md).",
      "lesson": {
        "name": "check-visible-surfaces-before-composing-browser-probes",
        "revision": "b1c4a621bcd19a32f8badacd3515a039e560d318",
        "digest": "4c990225aa2884dc42ed1159e371f5974f76694c76ad3ecd2e587591ff30f6b7"
      }
    },
    {
      "id": "issue-245-plan-draft-v2-hidden-idle-20261105",
      "date": "2026-11-05",
      "action": "Drafted one V2 browser sequence that opens details on an Idle card, focuses that card, and then expects its visible scroll offset to survive updates.",
      "expected": "The verification sequence must exercise reachable UI states and compare scroll and focus only when those controls are visible.",
      "observed": "Source inspection shows that openPanel adds has-panel, and the desktop has-panel rule sets the Idle column to display:none. The draft combined a visible-offset assertion with a hidden surface. Self-review corrected the draft before publication; no failed browser run is claimed.",
      "source": {
        "kind": "tool-output",
        "excerpt": "Draft V2: \"open details on a surviving Idle card, focus that card\". engine/board/board.ts:1158: document.body.classList.add('has-panel'); engine/board/board.css:527-529: body.has-panel .board[data-view=\"now\"] .col-idle { display: none; }.",
        "reference": "The #245 plan self-review in this session; source 40a31cb92ecce73591fc4c75321489240c5392fa"
      },
      "inference": "The draft appears to have combined individually useful checks without first tracing their layout interaction. The precise cause is not established. No runtime regression or recurring failure is inferred.",
      "diagnosis": [
        "unknown"
      ],
      "revision": "40a31cb92ecce73591fc4c75321489240c5392fa"
    }
  ],
  "recurrences": 1,
  "reviews": [
    {
      "id": "0a4abae9-7678-4ffa-99ad-46e6d872c897",
      "requestDigest": "c92f063e62deeeb9b30f21f5bd1c6bdb009acf86a8fe4f10632998d0d8ac1dd5",
      "date": "2026-11-05",
      "decision": "approve",
      "source": "agent review: lesson curation in the landing of #44; claude child opus/high\n\nApprove under the reviewer rules: the cited source lines establish that the draft combined a visible-offset assertion with a surface that the open panel hides, the proposal claims no failed run, the rule states applicability, action, and check, and the root cause is labeled as inference. The rule grants no permission and weakens no check. derive-fixture-state-from-real-producers covers fixture inputs, not the visibility of the asserted surface, so no active or historical lesson states the same rule.",
      "related": [
        "check-visible-surfaces-before-composing-browser-probes"
      ],
      "followUp": {
        "state": "not-needed",
        "detail": "No structural follow-up is required by this decision."
      }
    },
    {
      "id": "0ea93efa-ed99-4da7-a7e2-9b80df204f00",
      "requestDigest": "7eb3397997cac7471ae7e4834af05b13e11123e30008692346a869c6d182bc3e",
      "date": "2026-11-07",
      "decision": "merge",
      "source": "agent review: lesson curation in the landing of #250; claude child opus/high\n\nMerge under the reviewer rules: the active lesson check-visible-surfaces-before-composing-browser-probes states the same rule (trace which surface stays visible after each action in a probe that crosses a panel, a view, or a responsive transition), and the proposal names it as the lesson that its incident did not follow. The incident is observed: the final-fix report of #250 in the lane retains the 375x812 outputs \"active=BODY\" and \"TimeoutError: page.click: Timeout 30000ms exceeded.\" and the visibility read [\"history-count\",false,0], [\"keys-open\",false,0], [\"board-more\",true,44]. The child reported that it read the rule as limited to asserted surfaces, so the survivor keeps the active name and every incident and review, widens the applicability to each setup element and each probe size, and adds the check that a case with a hidden setup element fails. The cause stays labeled as the report of the child and as inference. The rule adds a check and weakens none.",
      "related": [
        "check-setup-targets-are-visible-at-each-probe-size",
        "check-visible-surfaces-before-composing-browser-probes"
      ],
      "followUp": {
        "state": "not-needed",
        "detail": "The rule stays text, because probes are temporary and outside the repository, and the visible surfaces depend on the screen and the size. This decision requires no structural follow-up."
      }
    }
  ]
}
---
# Check visible surfaces before composing browser probes

## What happened

The first #245 Verify draft opened details on an Idle card, then expected to focus that card and retain its visible scroll offset. The source adds `has-panel` when details open, and desktop CSS hides Idle under that class. Self-review found the conflict before the plan was published. No failing browser run is claimed.

In the final-review fix wave of #250 on 2026-11-07, a browser probe checked Escape on the board's update dialog at 1440x900 and 375x812. Its first RED run set up two 375x812 cases through the status-bar buttons `#history-count` and `#keys-open`, which the board hides at that width. One case left the focus on the body and so repeated another case; the other timed out on the click (`TimeoutError: page.click: Timeout 30000ms exceeded.`). A visibility read then gave `["history-count",false,0]`, `["keys-open",false,0]`, and `["board-more",true,44]`. The child changed the two setups to the visible phone surfaces and ran RED again before GREEN; the first run is not evidence. The fix brief carried this lesson.

## Root cause

Inferred: the #245 draft combined useful cases without tracing their layout interaction. The exact reason is unknown. A hidden scroll container has no associated layout box; a zero read there does not establish that the visible scrolling case works.

In #250, observed: the setup targets of the desktop cases are hidden at the phone width. Reported by the child: it applied this lesson to the dialog and the panels, which the probe asserted on, but not to the elements that set up each case. Inferred: the rule text named scroll and focus assertions, not setup actions, so its scope read narrower than the failure.

## Fix

The #245 plan separates the visible Idle focus/offset case from the open-details preservation case. It closes details before exercising visible Idle scrolling and layout transitions. The root-cause states table now identifies the intentionally hidden body.

Proposed in #250 by the child, not enforced: a probe helper that refuses a setup action on an element whose `checkVisibility()` is false and fails the case with that reason, so a hidden setup target cannot pass for a test of another case. Probes are temporary and outside the repository, so this stays a probe practice. Proposed prevention remains a text rule because the applicable visibility transitions depend on the screen and the size; no structural enforcement is claimed or authorized.

## Rule

Applies when a browser probe acts on or asserts on page elements across a panel, a view, a responsive transition, or more than one size. Action: before each action, trace which surfaces are visible in that state and at that size, for each element that the setup or the assertion of the case uses; separate assertions that require incompatible states. Check: the case output names each setup element with its visibility at each size, a case with a hidden setup element fails instead of passing, and a scrolling surface has a layout box and overflow before its offset counts as evidence of the visible behavior.
