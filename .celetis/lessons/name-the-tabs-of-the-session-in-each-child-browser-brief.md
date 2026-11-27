---
{
  "schema": 1,
  "name": "name-the-tabs-of-the-session-in-each-child-browser-brief",
  "description": "Design-review children judged a tab of their own session as not the session's, because the brief did not list the current tabs, and the reviews read no page",
  "tags": [
    "process",
    "ui",
    "test",
    "recurring"
  ],
  "date": "2026-11-14",
  "status": "active",
  "source": "The implement session of #336 on Claude Code, Task 8 design review, 2026-11-25\n\nThe implement session of #321 on Claude Code, Task 5 (the design review) and its task review, 2026-11-14",
  "incidents": [
    {
      "id": "d97908a5-1e6e-46d4-b3f6-2cc635e5e048",
      "date": "2026-11-25",
      "action": "The Task 8 implementer wrote the brief of critique Assessment A with the claim that the background browser held one about:blank tab, while its own probe tab was still on the fixture board page.",
      "expected": "The tab list of the brief equals the tabs of the browser at the dispatch (lesson name-the-tabs-of-the-session-in-each-child-browser-brief).",
      "observed": "Assessment A found one tab with URL http://127.0.0.1:4813/#issue=e50d0f7&tab=conversation, treated it as not the session's, and returned a source-only review: \"The brief says the tab list holds one about:blank tab. It held one different tab.\" The implementer reset the tab and ran A again.",
      "source": {
        "kind": "tool-output",
        "excerpt": "The brief says the tab list holds one about:blank tab. It held one different tab.",
        "reference": "https://github.com/ddinkov10/celetis/issues/336"
      },
      "inference": "Implementer report: it did not list the tabs before it wrote the brief. The rule was in its task brief, so the label is not-followed; an alternative is that the rule does not say to list the tabs again after the coordinator's own probe.",
      "diagnosis": [
        "not-followed"
      ],
      "revision": "4aabed0",
      "brief": ".superpowers/sdd/336/task-8-brief.md of the lane (Lesson rules of Task 8 carry the lesson with its digest)",
      "lesson": {
        "name": "name-the-tabs-of-the-session-in-each-child-browser-brief",
        "revision": "4aabed0",
        "digest": "968e46f90338156867f73934e6964227858cad21fa7c19a66f1429f114bc1f0c"
      }
    },
    {
      "id": "11636c11-a4bf-4a52-beb3-9ef186a00393",
      "date": "2026-11-14",
      "action": "The Task 5 implementer and its critique Assessment A listed the tabs of the background browser `playwright`, found one tab at http://127.0.0.1:4621/ that they had not opened, applied browser.md \"The session's own browser\" (\"A browser that shows a page that the session did not open ... is not the session's\"), made no further browser call, and completed the design review degraded: no state read in a browser, no screenshots, no probe reruns.",
      "expected": "The tab was the lane fixture board, opened by earlier child agents of the same coordinating session (Tasks 1-3 and their reviews); the browser was the session's, and the review should have read the states of the brief in a new tab.",
      "observed": "Task review: \"the browser is not the session's\" was the wrong call. The only tab is this lane's fixture board, and the reviewer opened a second tab on it with no busy message. The coordinator listed the tabs: only the fixture board page.",
      "source": {
        "kind": "tool-output",
        "excerpt": "browser_tabs list: - 0: (current) [(8) fixture · Agent board](http://127.0.0.1:4621/). Child: 'I made no browser call in this task, so I did not open tab 0 ... I make no further call to it'. Reviewer: 'browser_tabs new on http://127.0.0.1:4621/ opened tab 1 with no busy message, and tab 0 is the lab fixture board.'",
        "reference": "https://github.com/ddinkov10/celetis/issues/321"
      },
      "inference": "Inferred: browser.md defines ownership by \"the session\", and a child agent read \"the session\" as itself, not as the coordinating session and its children; the dispatch brief did not name which tabs the session already held. Alternative: the earlier children left their tabs open, which a rule to close each tab at the end of a task would also have prevented.",
      "diagnosis": [
        "unknown"
      ],
      "revision": "1660473"
    }
  ],
  "recurrences": 1,
  "reviews": [
    {
      "id": "6b3e7fd3-fc10-4696-ac73-b81036ebe5a0",
      "requestDigest": "12eafb49ebf70fd5c7439281028ae708fa7d36462558fc327029dad9e24e8f37",
      "date": "2026-11-14",
      "decision": "approve",
      "source": "agent review: lesson curation in the landing of #323; claude child opus/high\n\nApprove (reviewer rules): the proposal has observed tool-output evidence (the tab list, the child line, and the reviewer line of #321); its rule states applicability, action, and check; it widens no permission and skips no check, because a child that meets an unlisted page still stops as browser.md says; it agrees with browser.md, \"The role of a server\", where each child of a session reads the browser for that session; no live or historical lesson holds its incident or states its rule (give-each-agent-rule-a-check-where-its-actor-reads covers the cited rules and exits of a brief, not the tabs of the session). The body keeps the observed facts apart from the inferred cause.",
      "related": [
        "name-the-tabs-of-the-session-in-each-child-browser-brief"
      ],
      "followUp": {
        "state": "proposed",
        "detail": "An owner line in browser.md that counts the tabs opened by the children of one coordinating session as the session's, or a brief field that lists them. This structural work needs separate authorization; this review changes lesson data only."
      }
    },
    {
      "id": "183be5a4-b2b2-4ffb-8f1c-5eded0a0fd68",
      "requestDigest": "a44ea011b9dfcd4992c889dccaf3b04e61864dace4d23deea9bd2add3eb76a59",
      "date": "2026-11-26",
      "decision": "merge",
      "source": "agent review: lesson curation in the landing of #336; claude child opus/high\n\nMerge (reviewer rules): the proposal states the same rule as the active lesson name-the-tabs-of-the-session-in-each-child-browser-brief, and its incident cites that lesson as the expected behavior. Its evidence is observed tool output of #336 (the child line that the brief named one about:blank tab while another tab was open). The survivor keeps both incidents and the prior review, and extends the rule to a tab list taken right before each brief, also after the coordinator's own browser acts. It widens no permission and skips no check: a child that meets an unlisted page still stops as browser.md, \"The session's own browser\", says. The #336 cause stays the implementer's report, with its alternative.",
      "related": [
        "list-the-tabs-before-each-child-browser-brief",
        "name-the-tabs-of-the-session-in-each-child-browser-brief"
      ],
      "followUp": {
        "state": "proposed",
        "detail": "An owner line in browser.md, or a brief field, that holds the tab list taken right before each child browser brief, also after the coordinator's own browser acts. This structural work needs separate authorization; this review changes lesson data only."
      }
    }
  ]
}
---
# List the current tabs of the session in each child browser brief

## What happened

In #321, Tasks 1-3 of a subagent build and their reviews used the background browser `playwright` on the lane fixture board at http://127.0.0.1:4621/ and left a tab on it. The Task 5 implementer and its critique Assessment A listed the tabs, saw that tab, and treated it as a page that the session did not open (browser.md, "The session's own browser"). They made no browser call, and the design review read no state of its brief. The task reviewer opened a new tab on the same browser with no busy message and judged the call wrong; the coordinator confirmed that the only tab was the fixture board.

In the Task 8 design review of #336, the task brief carried this lesson. The implementer wrote the brief of critique Assessment A and said that the background browser held one `about:blank` tab, while its own probe tab was still on the fixture board (http://127.0.0.1:4813/#issue=e50d0f7&tab=conversation). Assessment A found that tab, treated it as not the session's, and returned a review from the source only: "The brief says the tab list holds one about:blank tab. It held one different tab." The implementer reset the tab and ran Assessment A again.

## Root cause

Inferred for #321: a child read "the session" of browser.md as itself rather than as the coordinating session and all of its children. The brief did not list the tabs that the session already held. Leftover tabs of earlier children made the case possible.

For #336, the implementer reports that it did not list the tabs before it wrote the brief, although the lesson was in its task brief (diagnosis: not-followed). Alternative: the earlier rule named only the tabs of earlier children, and did not say that the coordinator's own probe tabs count or that the list is taken again right before each brief.

## Fix

Proposed (text): right before each child browser brief, the coordinator lists the tabs with the browser tool, also after its own browser acts, and copies each listed URL and its purpose into the brief, with the statement that those tabs are the session's. The coordinator closes or resets its own probe tabs before the dispatch, and each child closes the tabs it opened before it returns. No structural enforcement exists: tab ownership is not recorded by the browser server, and an agent writes the brief, so the rule stays text. A structural follow-up could add an owner line to browser.md for child agents (needs separate authorization).

## Rule

Applies when a coordinating session gives a browser act to a child agent after any browser act of the session: its own or one of an earlier child. Action: list the tabs with the browser tool right before the brief is written; in the brief, name each listed tab (its URL and purpose) and state that those tabs are the session's; close or reset the coordinator's own probe tabs before the dispatch, or list them too; tell each child to close the tabs it opened before it returns. Check: a tab list taken after the brief is written and before the dispatch equals the tab list of the brief, and a child that meets an unlisted page still stops as browser.md says.

## Related lessons

[[check-visible-surfaces-before-composing-browser-probes]]
[[give-browser-tool-output-files-a-path-outside-the-lane]]
