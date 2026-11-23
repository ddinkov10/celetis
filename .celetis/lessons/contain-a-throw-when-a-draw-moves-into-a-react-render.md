---
{
  "schema": 1,
  "name": "contain-a-throw-when-a-draw-moves-into-a-react-render",
  "description": "Byte-copied draw code moved into a React render, so a throw on one read value removed the whole board where the old page kept it",
  "tags": [
    "ui",
    "regression",
    "process"
  ],
  "date": "2026-11-22",
  "status": "active",
  "source": "The implement session of issue #360, the security review of Task 9 and its reproduction",
  "incidents": [
    {
      "id": "issue-360-task-9-render-throw",
      "date": "2026-11-22",
      "action": "Moved resetText and the rows of the agent order by byte copy from an imperative draw into a React render, with no error boundary at the root",
      "expected": "A value that makes one view throw leaves the rest of the board usable, as on the old page",
      "observed": "With a usage resetAt of 8.7e15 ms the new page threw \"Invalid time value\" in the render and showed no board, also after a reload. The old page kept its body text of 1138 characters.",
      "source": {
        "kind": "tool-output",
        "excerpt": "head-usage: areaControl false, bodyText 0, errors [\"Invalid time value\"]; base-usage: areaControl true, bodyText 1138"
      },
      "inference": "A throw in an imperative draw stops that draw, and a throw in a React render with no boundary unmounts the root. The parity probes used valid values, so they could not see it. An alternative is that the plan should have named an error boundary. The evidence does not separate these causes.",
      "diagnosis": [
        "unknown"
      ],
      "revision": "f0f2b4b"
    }
  ],
  "recurrences": 0,
  "reviews": [
    {
      "id": "c7259f9b-012c-4c15-8124-7552a4c2c51b",
      "requestDigest": "08046f3a85f81f53573d35bbb84a604cf7f2f9ab9a4c3e6809f1a1e51bc74f63",
      "date": "2026-11-23",
      "decision": "edit",
      "source": "agent review: lesson curation in the landing of #360; claude child opus/high\n\nReviewer rule Edit: the proposal has observed evidence and a rule with applicability, action, and check, and no active lesson states the same rule. The text said to add a probe, and project instructions refuse a tracked test, so the edit says an untracked probe. The edit adds the tags ui and regression from the vocabulary. The facts and the inferred cause stay separate and unchanged.",
      "related": [
        "contain-a-throw-when-a-draw-moves-into-a-react-render"
      ],
      "followUp": {
        "state": "proposed",
        "detail": "One shared error boundary for each ported surface of the board needs a separately authorized change."
      }
    }
  ]
}
---
# Contain a throw when a draw moves into a React render

## What happened

The change of #360 moved the rules of the agent order by byte copy from an imperative draw into a React render. A usage reset time outside the JavaScript date range made `toISOString()` throw during the render. The root had no error boundary, so the whole board disappeared, also after a reload. The old page kept the board, because the same throw only stopped one draw. The parity probes used valid values and did not see it. A security review named the sink, and a browser run on both pages showed the difference.

## Root cause

Inferred: a throw in an imperative draw stops that draw, while a throw in a React render with no boundary unmounts the root. A byte compare proves that a moved body is equal, and it says nothing about the effect of a throw in the new place. An alternative cause is a plan that did not name a boundary. The evidence does not separate these causes.

## Fix

The lane added one small error boundary around each new view, which keeps the root node of the view and retries at the next changed snapshot. Proposed prevention, not enforced: when a plan moves draw code into a render, it names the containment of a throw and runs an untracked probe with a read value that makes the moved code throw. A structural follow-up that needs separate authorization: one shared boundary for each ported surface of the board.

## Detection signature

A blank page with `Invalid time value` or another render error, on a board page that has no error boundary

## Rule

Applies when a change moves imperative draw code into a React render. Action: list each moved call that can throw on a read value, keep a throw inside the view with an error boundary or a checked value, and run an untracked probe that feeds such a value. Check: on the old page and on the new page, the probe feeds the value, the rest of the board stays usable on both, and a later valid read restores the view.

## Related lessons

[[move-code-by-byte-copy-and-compare-each-moved-body]]
