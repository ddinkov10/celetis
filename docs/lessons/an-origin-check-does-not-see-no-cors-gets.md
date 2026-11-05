---
{
  "schema": 1,
  "name": "an-origin-check-does-not-see-no-cors-gets",
  "description": "A plan said that an Origin: null refusal stops every request of a sandboxed page; a no-cors GET and a navigation send no Origin",
  "tags": [
    "networking",
    "platform-quirk"
  ],
  "date": "2026-11-03",
  "status": "active",
  "source": "implement session of ddinkov10/celetis#235, Task 2 review (commit 13451da)",
  "incidents": [
    {
      "id": "dd9ed022-c78e-4250-ac2a-2df909fa9c36",
      "date": "2026-11-03",
      "action": "The plan of #235, Task 2, Step 4, mandated the ADR-0065 sentence 'a sandboxed page can still send a GET or a simple POST, which gets 403', and the implementer wrote README rule 12 as 'each of its requests to the board has Origin: null (rule 4)'",
      "expected": "The trust-boundary documents state only what the Origin: null refusal stops: a cors-mode request and a request whose method is not GET or HEAD",
      "observed": "In Chromium, a page served under CSP sandbox without allow-same-origin sent <img> GETs and fetch no-cors GETs with no Origin header; the board served them and started an hc ls read. Only the cors fetch carried Origin: null and got 403",
      "source": {
        "kind": "tool-output",
        "excerpt": "REQ GET /api/board?img=1 origin=undefined dest=image mode=no-cors / REQ GET /api/board?nocors=1 origin=undefined dest=empty mode=no-cors / exec hc ls --json / REQ GET /api/board?cors=1 origin=\"null\" dest=empty mode=cors",
        "reference": "https://github.com/ddinkov10/celetis/issues/235"
      },
      "inference": "Inferred: the spec probe of #235 tested only a cors fetch GET and generalized it to every GET. Fetch appends Origin only for cors-mode requests and for methods other than GET and HEAD, so navigations, images, scripts, and no-cors fetches carry none. Uncertain whether other browsers differ for a sandboxed document.",
      "diagnosis": [
        "unknown"
      ],
      "revision": "13451da"
    }
  ],
  "recurrences": 0,
  "reviews": [
    {
      "id": "95b7ab6b-70a9-4e54-a638-a9652829ba15",
      "requestDigest": "9d6d2bb45c385d0f61003e0db59eaf832dda8cfc4695630cec87e0e2403384cc",
      "date": "2026-11-05",
      "decision": "approve",
      "source": "agent review: lesson curation in the landing of #246; claude child opus/high\n\nApprove under the reviewer rules. The proposal has retained tool output from a Chromium probe: the image GET and the no-cors fetch GET reached the board with no Origin header, and only the cors fetch carried Origin: null and got 403. The rule states applicability (a plan or document claim that an Origin check stops the requests of an untrusted page), action (name the request kinds that it stops), and check (a browser probe of each named request kind). It keeps the trust boundary of the board, widens no permission, and agrees with the principle boundary-discipline. The current trust-boundary text of engine/board/README.md (rule 12) already states that a navigation, a popup, and a no-cors GET carry no Origin. No live or historical lesson states this rule or holds its incident. The body labels the cause and the browser uncertainty as inferred.",
      "related": [
        "an-origin-check-does-not-see-no-cors-gets"
      ],
      "followUp": {
        "state": "not-needed",
        "detail": "The rule stays text for judgment at each matching task. This decision requires no structural follow-up."
      }
    }
  ]
}
---
# An Origin check sees only cors requests and unsafe methods

## What happened

The plan of #235 mandated a trust-boundary sentence: a sandboxed page can send a GET or a simple POST, and each gets 403 from the `Origin: null` refusal. The implementer wrote the same claim into the board design document. The task reviewer served a probe page under `sandbox allow-scripts allow-popups allow-popups-to-escape-sandbox` in Chromium. The `<img>` GETs and the `fetch(..., {mode: 'no-cors'})` GETs reached the server with no `Origin` header, and the server served them. Only the cors-mode `fetch` sent `Origin: null` and got 403. The controller ran the probe again on the same commit and saw the same log.

## Root cause

Inferred: the spec probe tested one cors-mode `fetch` GET and the plan generalized it to every GET. The Fetch standard appends `Origin` only for a cors-mode request and for a method other than GET and HEAD. A navigation, a popup, an image, a script, and a no-cors fetch send none. Uncertain: whether another browser sends `Origin` for one of these from a sandboxed document.

## Fix

Proposed: the documents now say which requests the refusal stops, and they say that no GET of the board changes state. No structural check enforces this; a document claim about browser behavior needs a probe, so the rule stays text.

## Rule

When a plan or a document claims that an `Origin` check stops the requests of an untrusted page, name the request kinds that it stops. Check the claim with a browser probe that sends a navigation, an image GET, a no-cors fetch GET, a cors fetch, and a simple POST, and record which of them carry `Origin`.
