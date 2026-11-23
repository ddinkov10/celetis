# The coordinator panel renders in React

## Date

2026-11-22

## Related

- [Issue #359](https://github.com/ddinkov10/celetis/issues/359): the spec and the plan of this change. Its "Calls of the session" and "Required behavior" sections bind this record.
- [Issue #342](https://github.com/ddinkov10/celetis/issues/342): the epic. Its body decides React 19, shadcn/ui on Base UI with Tailwind, and TanStack Query.
- [ADR-0123](0123-the-board-page-runs-on-react-with-a-locked-build.md): the page runs on React, each node has one owner, and the bundle guard accepts a locked package. This record keeps each of these rules.
- [ADR-0131](0131-the-operations-screen-renders-in-react.md): the Operations screen renders in React, and the panel sits in `#center`. This record renders the coordinator panel and the Chat button in that screen.
- [ADR-0110](0110-the-coordinator-chat-reads-the-session-record-of-the-host.md): its rejection of a chat library stays true. This record adds no chat library.

## Context

At revision `eb049cb`, the coordinator panel was imperative DOM code. `engine/board/page/coordinator.ts` (525 lines) kept the
state of the session in module variables and wrote the host markup in one `draw()`. It restored the focus by hand.
`engine/board/page/chat.ts` (295 lines) built the log with `el()`, compared each entry as JSON, and restored the focus by
`data-row` and `data-key`. The follow of the log was its own code: `atEnd` (line 111, a distance of less than 4 px), `isSelecting`
and `settle` (lines 116 to 125), and two `ResizeObserver`s (lines 452 to 458).

## Constraints and evidence

- At `eb049cb`, an upward scroll sets `follow` to false (`engine/board/page/coordinator.ts`, line 447), so the end of a hold
  after that scroll does not move the view. `settle` waits while the person holds a selection in the log (lines 116 to 122).
- The base page shows no new-text dot on the Chat button. Commit `31c31d0` (#330) replaced the `.co-new` element with the
  attribute `data-new`. `DESIGN.md`, "Chat button", still names the dot.
- The hook `use-stick-to-bottom` 1.1.6 (MIT, no dependency) counts a text selection only while the mouse button is down. A
  finished selection and a keyboard selection do not stop its follow. Its end zone is 70 px.
- The base end zone was 4 px (`engine/board/page/coordinator.ts`, line 111).

## Decision

1. **One store and pure rules.** `engine/board/page/coordinator/coordinator.ts` holds the state of the panel, and components read
   it with `useSyncExternalStore`. `rules.ts` holds the pure rules of the words, the marks, and the send block. The panel
   (`panel.tsx`), the log (`log.tsx`), the entries (`entries.tsx`), and the Chat button (`button.tsx`) render from them.
   `CoordinatorHost` and `PaneChatHost` leave `engine/board/page/app/hosts.tsx`. The files `engine/board/page/coordinator.ts`
   and `engine/board/page/chat.ts` are removed. The `[data-since]` loop of `board.ts` and the helpers `link` and `timed` of
   `ui.ts` are removed, because no user of them remained.
2. **The panel stays mounted.** `panel.tsx` renders `hidden={!isOpen}`, so the field keeps its text and the log keeps its scroll
   between two shows. `CoordinatorLog` is a `memo` component that reads only its own inputs, so a change of the field text
   does not render the log.
3. **The follow uses the hook.** The log uses `useStickToBottom` of `use-stick-to-bottom` 1.1.6, pinned exactly in
   `engine/package.json`, with `initial: 'instant'` and `resize: 'instant'`. Each `scrollToBottom` call passes `'instant'`,
   because with no argument the hook uses its spring. The end zone is the hook's 70 px, which the maintainer chose on
   2026-11-22. The log uses the hook, not its component, because the scroll element must keep the role, the tab stop, and
   the name of `#coordinator-log`.
4. **A held selection.** A `selectionchange` rule in `log.tsx` covers each selection that the hook does not count. A hold
   that starts at the end stops the follow. A scroll up during a held selection stops the follow, and it stays stopped
   after the hold ends, until the view returns to the end. The end of a hold moves the view to the end only when the log
   followed its end at the start of the hold, or the view came back to the end during the hold, and no upward scroll came
   after that. A downward scroll into the 70 px end zone counts as a return to the end. During a hold, a resize stops the
   follow, and a poll moves no scroll. A new session removes the held entries, so it ends the hold, and decision 5 gives
   the view after it.
5. **A toggle keeps the view.** A press that opens a run moves no scroll (`onToggle` in `log.tsx`). When the log followed
   its end and the view after the press is inside the 70 px end zone, the follow stays on, and the next growth of the log
   moves the view to the end. When the view is more than 70 px above the end, the follow stops, `Go to the end` shows, and
   a later poll does not move the view. The base ran `settle` on each resize (lines 452 to 455), so an opened run could
   move the view to the end. A new session keeps the follow of the base (`sessionId` effects in `log.tsx`): the log is at
   its end after the first read and follows when it followed its end before, also after a press that stopped the follow.
   After a scroll up it is at the top, `Go to the end` shows, and it does not follow, as at `eb049cb`, also for a
   second new session in a row.
6. **The new-text dot returns.** The Chat button renders the dot when its state holds unseen text (`button.tsx`), with the
   name ending in `, new text`. The item Chat of the bottom bar shows the state mark only, as `DESIGN.md` says.
7. **The head buttons are quiet.** The `quiet` variant of `engine/board/page/ui/button.tsx` serves the three head buttons of
   the panel (`panel.tsx`).
8. **The focus rule stays small.** One post-commit rule of the panel puts the focus on the field, else Start, else the log,
   when a render hides the focused node. The store commits each change with `flushSync`, so the rule runs after the commit.

## Constitution

Read: `CONSTITUTION.md`, amended 2026-11-12.

- Serves: 1 Intent to release: the maintainer steers the runs from the panel, and the panel keeps the conversation at its
  end. While the person reads above the end, the panel moves no view.
- Hard limits and non-goals: none touched.

## Alternatives considered

- **A chat library in the page.** Rejected, as [ADR-0110](0110-the-coordinator-chat-reads-the-session-record-of-the-host.md)
  rejects it. The Markdown of a chat renders as HTML, and the Content-Security-Policy stays as it is.
- **The hook's component instead of its hook.** Rejected. The component owns the scroll element, and the log keeps the role,
  the tab stop, and the name on its own element.
- **Keep the hand-written follow with the 4 px end zone.** Rejected. The hook keeps the same rules for a pin, a resize, and a
  selection while the mouse button is down, and it adds one locked package with no dependency. Decision 4 covers a
  finished and a keyboard selection.
- **Save and restore the focus at each poll.** Rejected. The keys keep each node across a poll, and one post-commit rule
  covers the cases that the base named.

## Consequences

- The coordinator panel and the Chat button have one owner for each node. The two base modules are removed.
- A held selection keeps the view where the person reads it. A scroll up stops the follow until the view returns to the
  end. The end of a hold moves the view only when the log followed its end at the start of the hold, or the view came back
  to the end during the hold, and no upward scroll came after that.
- A view up to 70 px above the end counts as at the end. `Go to the end` shows only above that zone.
- The page bundle gains one locked package.
- The queue section stays host markup until #360. ADR-0123 item 8 keeps its rule for that screen.

## Reconsider when

- The hook changes its selection rule or its end zone. The pin in `engine/package.json` then changes too.
- The queue section moves to React in #360, or the panel moves out of `#center`. Either needs the focus rule and the
  mounted panel of this record.
- A poll loses a focused node in a case that the post-commit rule does not name, and the maintainer decides a new rule.
