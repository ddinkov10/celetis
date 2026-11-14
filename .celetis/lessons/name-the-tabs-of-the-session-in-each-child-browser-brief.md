---
{
  "schema": 1,
  "name": "name-the-tabs-of-the-session-in-each-child-browser-brief",
  "description": "A design-review child judged the fixture board tab that sibling children of the same session opened as not the session's, and the review read no page",
  "tags": [
    "process",
    "ui",
    "test"
  ],
  "date": "2026-11-14",
  "status": "active",
  "source": "The implement session of #321 on Claude Code, Task 5 (the design review) and its task review, 2026-11-14",
  "incidents": [
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
  "recurrences": 0,
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
    }
  ]
}
---
# Name the tabs of the session in each child browser brief

## What happened

In #321, Tasks 1-3 of a subagent build and their reviews used the background browser `playwright` on the lane fixture board at http://127.0.0.1:4621/ and left a tab on it. The Task 5 implementer and its critique Assessment A listed the tabs, saw that tab, and treated it as a page that the session did not open (browser.md, "The session's own browser"). They made no browser call, and the design review read no state of its brief. The task reviewer opened a new tab on the same browser with no busy message and judged the call wrong; the coordinator confirmed that the only tab was the fixture board.

## Root cause

Inferred: a child read "the session" of browser.md as itself rather than as the coordinating session and all of its children. The brief did not list the tabs that the session already held. Leftover tabs of earlier children made the case possible.

## Fix

Proposed (text): when a coordinator gives a browser act to a child, the brief lists the tabs that earlier children of the session opened (by URL) and states that they are the session's; each child closes the tabs it opened before it returns. No structural enforcement exists: tab ownership is not recorded by the browser server, so the rule stays text. A structural follow-up could add an owner line to browser.md for child agents (needs separate authorization).

## Rule

Applies when a coordinating session gives a browser act to a child agent and earlier children of the same session used that browser. Action: in the brief, name each tab that the session's children opened (its URL and purpose) and state that those tabs are the session's; tell each child to close the tabs it opened before it returns. Check: before the child's first browser call, the coordinator lists the tabs, the brief names each listed page, and a child that meets an unlisted page still stops as browser.md says.

## Related lessons

[[check-visible-surfaces-before-composing-browser-probes]]
[[give-browser-tool-output-files-a-path-outside-the-lane]]
