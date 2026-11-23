---
{
  "schema": 1,
  "name": "tell-a-follow-hook-that-an-emptied-list-clamped-the-scroll",
  "description": "Two fixes of a new-session follow failed, because the follow hook read the clamp of an emptied list as the reader scrolling up",
  "tags": [
    "ui",
    "refix",
    "platform-quirk"
  ],
  "date": "2026-11-23",
  "status": "active",
  "source": "The build of #359, task verify-1: the report of the implementer.",
  "incidents": [
    {
      "id": "9a1801b6-0c35-4eb8-aca6-322cbc0442cb",
      "date": "2026-11-23",
      "action": "A fix bumped scrollAsks to call scrollToBottom on the empty list, and a second fix added an isAtEnd guard in onScroll.",
      "expected": "After a new session, the first read of the log is at its end and the log follows.",
      "observed": "The clamp scroll event of the emptied list, read about 1 ms later by use-stick-to-bottom 1.1.6, escaped the follow. The guard failed because the clamp event saw the list already refilled. Writing state.scrollTop to mark the clamp as programmatic worked.",
      "source": {
        "kind": "tool-output",
        "excerpt": "Bumping scrollAsks ... breaks the follow: the clamp scroll event, read 1 ms later by the hook, escapes it.",
        "reference": "issue #359, task verify-1 report"
      },
      "inference": "Inferred from the hook source and the probes. Other scroll libraries can differ.",
      "diagnosis": [
        "unknown"
      ],
      "revision": "3c26582981c402960b8305f969920cb20726a828"
    }
  ],
  "recurrences": 0,
  "reviews": [
    {
      "id": "7955ee55-6aba-412c-b645-a951fc5f24c8",
      "requestDigest": "029158e78dc96b2d7c1c6b9ad9a629310e215552ed93b99c487e6451d692d914",
      "date": "2026-11-23",
      "decision": "edit",
      "source": "agent review: lesson curation in the landing of #359; claude child opus/high\n\nEdit under the reviewer rules, because the text needs a correction. The proposal said to mark the clamp before the list shrinks. The code of the fix (engine/board/page/coordinator/log.tsx) reads state.scrollTop and writes it back in a layout effect after the commit that empties the list (resetChat in coordinator.ts). The source of use-stick-to-bottom 1.1.6 compares the scroll event with the stored ignoreScrollToTop, so a value stored before the shrink would not match the clamp. That last point is read from the source and not probed, and the document says so. The edit also limits the rule to a follow that must survive, as the fix does, and states its boundary to find-the-scroll-anchor-before-a-fix-of-a-scroll-that-a-redraw-moves: this write keeps the clamped position and repairs no position, so the two rules stay compatible.",
      "related": [
        "tell-a-follow-hook-that-an-emptied-list-clamped-the-scroll"
      ],
      "followUp": {
        "state": "not-needed",
        "detail": "The rule stays text, because it depends on the hook. This review changes lesson data only."
      }
    }
  ]
}
---
# Tell a follow hook that an emptied list clamped the scroll

## What happened

In #359, two fixes of the follow after a new session failed. The list emptied, the browser clamped `scrollTop`, and `use-stick-to-bottom` read the scroll event as the reader scrolling up, so it stopped the follow. The fix that held runs in a layout effect after the commit that empties the list: it reads the hook `state.scrollTop` and writes the same value back (`engine/board/page/coordinator/log.tsx`).

## Root cause

Inference: the hook tells its own scrolls from the reader's by a stored `scrollTop`, and a clamp changes the value with no call of the hook. Read from the source of `use-stick-to-bottom` 1.1.6 and not probed: a write before the list shrinks stores the old value, so the clamp event does not match it and still reads as an upward scroll.

## Fix

Proposed, not enforced: after the commit that shrinks or empties a list that a follow hook watches, and before its scroll event, read the public `state.scrollTop` and write the same value back. The read gets the clamped value, and the write marks it as programmatic. Then probe the next growth. The rule stays text, because it depends on the hook.

## Rule

Applies when code empties or shortens the content of a scroller that `use-stick-to-bottom` follows, and the follow must continue. Action: after the commit that changes the content and before its scroll event, read the hook `state.scrollTop` and write the same value back, and go to the end only after the next content. This write keeps the clamped position, so it is not a repair of a position that `find-the-scroll-anchor-before-a-fix-of-a-scroll-that-a-redraw-moves` covers. Check: a probe empties the list from each follow state, adds a long first read, and observes the expected gap and one more followed entry.

## Related lessons

[[find-the-scroll-anchor-before-a-fix-of-a-scroll-that-a-redraw-moves]]
