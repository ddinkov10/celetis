# The Operations screen renders in React

## Date

2026-11-22

## Related

- [Issue #346](https://github.com/ddinkov10/celetis/issues/346): the spec and the plan of this change. Its "Decisions of
  the plan session" hold the two decisions of this record. "Decision 1" and "Decision 2" below name them.
- [The plan session comment of #346](https://github.com/ddinkov10/celetis/issues/346#issuecomment-7063436400): the source
  of decisions 1 and 2 of the plan session.
- [The maintainer's ruling of 2026-11-21 on #346](https://github.com/ddinkov10/celetis/issues/346#issuecomment-7067167962):
  the narrowing of the card move animation (decision 4 below).
- [The maintainer's ruling of 2026-11-22 on #346](https://github.com/ddinkov10/celetis/issues/346#issuecomment-7077076915):
  the kept focus cases of the old page (decision 5 below).
- [ADR-0123](0123-the-board-page-runs-on-react-with-a-locked-build.md): the page runs on React, and each node has one
  owner. This record keeps that rule and renders the Operations screen in React.

## Supersedes

Only these clauses change. The records keep their historical text and evidence.

- [The board page runs on React with a locked build](0123-the-board-page-runs-on-react-with-a-locked-build.md), in part:
  in "Decision", item 8, the sentence "`engine/board/page/board.ts` creates `#panel` at start." The details panel is now
  rendered by React in `#center`. The rest of item 8 stays: the one React root, the host components of the screens that
  are not ported yet, the one owner of each node, and the shell store.
- [The engine library groups its files into feature folders](0114-the-engine-library-groups-its-files-into-feature-folders.md),
  in part: in "Decision", item 2, "`stop-dialog.ts` and `update-dialog.ts` of the page stay". The file `stop-dialog.ts` is
  removed, and its Stop dialog is `engine/board/page/operations/stop.tsx`. `update-dialog.ts` stays.

## Context

The board page had one module per part of the page. The Operations screen (the tabs, the details panel, the cards, the
columns, the card menus, the Stop dialog, and the keys) was built by hand in `engine/board/page/board.ts`, with direct
DOM writes, and with a focus rule that saved and restored nodes by hand. Issue #346 moves that screen to React with the
shadcn components on Base UI, as the epic of ADR-0123 asks. This record states the shape of the new screen and the
rules that the old code must keep.

## Constraints and evidence

The base of the lane is `3570dc13781b10d8cc775d2f10b2d8b0f2b7f74c`. Each fact below was read in that base or in the lane
HEAD, as cited.

- In the base, `engine/board/page/board.ts` created the node `#panel` at start (lines 97 to 102). Its function `drawShell`
  moved the node with `moveTo` into `#area-operations` in the wide Pipeline or into `#center` otherwise (lines 1177 to 1204). Its
  `render` animated a reorder with `document.startViewTransition` (lines 1727 and 1728). Its one `keydown` listener on
  `document` closed the details with Escape (lines 2205 to 2220). The Stop dialog was the old Stop dialog module of the
  base, and the old panel module of the base built the panel sections.
- In the lane HEAD, `engine/board/page/board.ts` keeps its one `keydown` listener on `document` (line 563). After its
  guards and the update rule, the listener calls `handleKey` of `engine/board/page/operations/keys.ts` (line 586). The
  Escape rule of the details is in `pressOf` of that file (lines 96 to 99). The old panel module, the old Stop dialog
  module, and `drawShell` are gone from the page.
- Old code in `engine/board/page/board.ts`, `home.ts`, `palette.ts`, `coordinator.ts`, and `queue.ts` finds a React node by
  its `data-key`, reads it, and focuses it. It writes no content, attribute, or class on such a node. The
  function `tick` of `board.ts` writes text only on the nodes that have `data-since`. The React time nodes of the
  Operations screen have no `data-since` (`engine/board/page/operations/parts.tsx`, line 48), so `tick` does not write them.
- The shell state and the screen state are in stores. `engine/board/page/operations/state.ts` reads the screen state with
  `useScreen`, a `useSyncExternalStore` hook (line 376). The store holds the accepted read, the client state, and the shell
  actions. `engine/board/page/operations/cards.ts` builds the read model with `project`, `indexCards`, and `layoutOf`, and it
  reads no DOM. `engine/board/page/operations/actions.ts` holds the one action model of the cards, the details, the card
  menus, and the palette.
- The card menus use the shadcn `DropdownMenu` on Base UI with `modal={false}` (`engine/board/page/operations/card.tsx`,
  line 413). The Stop dialog uses the shadcn `AlertDialog` (`engine/board/page/operations/stop.tsx`). The tabs use the
  shadcn `Tabs` (`engine/board/page/ui/tabs.tsx`). The Agents and Pipeline panel is a keyed `div role="tabpanel"`, not a
  Base UI `Tabs.Panel`, because the exit frame of a Base UI panel holds a second `#tp-board` and drops the focus.
- Each card of the screen is a `ViewTransition` named by its card key (`engine/board/page/operations/views.tsx`, line 465).
  The document root has the view transition name `root` (`views.tsx`, line 38). React names a `ViewTransition` only while it
  is inside the viewport.

## Decision

1. **The screen folder.** The Operations screen is the folder `engine/board/page/operations/`. Its files are:
   - `state.ts`: the store `screen` and the hook `useScreen`.
   - `cards.ts`: the pure read model. It reads no DOM.
   - `actions.ts`: the one action model of the cards, the details, the card menus, and the palette.
   - `keys.ts`: `handleKey`, the key handler of the screen.
   - `operations.tsx`, `views.tsx`, `card.tsx`, `panel.tsx`, `history.tsx`, `stop.tsx`, and `parts.tsx`: the React views.

   The React views read the store and render. The store and the actions write the state.
2. **Old code only finds and focuses.** The old modules find a React node by its `data-key` inside the board view, read it,
   and call `.focus()` on it. They write no content, attribute, or class on it, and they call no `.click()` on it. The
   `keydown` listener of `engine/board/page/board.ts` stays the only listener of the page on `document`. It calls
   `handleKey` at the point of the old Escape rule of the details, after the same guards as before.
3. **One place for the details panel (decision 1 of the plan session).** The details panel has one place in the DOM, in
   `#center`, at each width. In the wide Pipeline (720 px and wider, tab Pipeline), the grid places the panel in the right
   column. So Tab reaches the panel before the pipeline cards in that one state. Before this change, Tab reached the
   pipeline cards first. The maintainer accepted this order in the plan session of 2026-11-21.
4. **The card move animation.** The screen keeps the shown read in React state (`views.tsx`). A read with a changed layout key
   of the same view is applied inside `startTransition`, when the page is visible and the motion is not reduced. A press
   changes only the launches, so it never animates. Each card is a `ViewTransition` named by its card key. A card that moves
   to another column animates only when both ends of the move are in the viewport. An open card menu moves with its card.
   A read that removes the card of the open menu commits at once, so that the rescue of item 5 reads the focus inside the
   menu. The one-second clock of `operations/state.ts` emits without `flushSync`, because React skips a held move that a
   `flushSync` render interrupts. All other cases equal the base. The maintainer accepted this narrowing on 2026-11-21
   (see Related). The first way of the plan, `useDeferredValue`, did not animate, and it was replaced.
5. **The focus rescue (decision 2 of the plan session).** When the node that holds the focus unmounts because a poll moved its
   card, the screen focuses, after the commit, the same control of the card with the same key. The control is found by its
   accessible name. If there is no such control, the screen focuses that card. If there is no card, it focuses the epic row
   of its closed group. If there is no epic row, it focuses the stop of the old column. The hook `useRescue` of `views.tsx`
   does this, and its function `targetOf` picks the target for each kind of held node. The maintainer chose this rule in
   the plan session of 2026-11-21. On 2026-11-22 the maintainer kept these focus cases of the old page as a part of this
   decision (see Related):
   - `useKeptFocus` of `operations/parts.tsx`: the details panel and History focus the same control again when a render
     removes the focused one.
   - The `tail`, `pill`, `epic`, and `menu` kinds of `useRescue`: a focused tail of Needs you, a Human-session pill, an epic
     row, and an item of an open card menu.
   - The rescue of `setShell` (`operations/state.ts`): a shell change that hides the focused node focuses the tab or the
     work area.
   - Another tab closes the epic group of the focused card: the focus goes to the epic row.
   - The palette entry "Collapse all epic groups" hides the focused card: the focus goes to the epic row.

   No other case saves or restores the focus by hand. A pick of a card menu runs its act after Base UI refocuses the
   clicked item, and a closing menu gives up the focus while another menu is open, so that the act or the new menu keeps
   it. A read leaves the scroll of the board, of each Pipeline column, and of History: `useKeptScroll` of
   `operations/parts.tsx` sets `scrollTop` back after a commit with new content, because Chrome scroll anchoring would
   move it, and the old redraw did not. A scroller between its `scroll` and `scrollend` events keeps its own position, so
   a smooth scroll that a read interrupts reaches its target. Scroll anchoring stays on for a layout shift that no read
   causes, as the collapse of the "more below" tail of Needs you.
6. **The menus, tabs, and dialog.** The card menus, the tabs, and the Stop dialog are the shadcn components on Base UI, in
   `engine/board/page/ui/`. The Base UI runs under `CSPProvider disableStyleElements`, so no `<style>` element is written.
7. **The panel sits in `#center`.** The component `Panel` of `operations.tsx` renders inside `#center`. `board.ts` creates no
   `#panel` node. The other screens that are not ported yet keep the host rule of ADR-0123 item 8.

## Constitution

Read: `CONSTITUTION.md`, amended 2026-11-12.

- Serves: 1 Intent to release: the board shows the path from intent to the trunk, and the React screen keeps that view with
  fewer update bugs.
- Serves: 3 Verified landing: the rule that each node has one owner, and the gate of the page bundle, keep the screen checkable
  on the tip that lands.
- Hard limits and non-goals: none touched.

## Alternatives considered

- **Use `useDeferredValue` for the card move animation.** Rejected. It failed in Task 6 of the build. The screen uses
  `startTransition` with the shown read in React state.
- **Use a Base UI `Tabs.Panel` for the Agents and Pipeline panel.** Rejected. The exit frame of a Base UI panel holds a second
  `#tp-board` and drops the focus. The panel is a keyed `div role="tabpanel"`.
- **Save and restore the focus at each poll.** Rejected. Decision 5 keeps one narrow rule and the named cases of the old page,
  and the maintainer chose them.

## Consequences

- The Operations screen has one owner for each node. The old module finds and focuses a node, and it writes nothing on it.
- Tab order changes in the wide Pipeline (decision 3). The plan session accepted it.
- The card move animation covers only the moves with both ends in view (decision 4). A move to a column that is out of view
  does not animate.
- The two Supersedes items change the panel placement of ADR-0123 and the file list of ADR-0114. Each other clause of both
  records stays true.
- A change to a React view can move the focus of a poll. Such a change must keep decision 5, and it must keep the rule of
  one owner for each node.

## Reconsider when

- A later change needs the panel in more than one place in the DOM, or Tab order in the wide Pipeline must match the base.
- Base UI or React changes how a `ViewTransition` is named, or how it is placed in the viewport, so that a move out of view
  animates or the decided narrowing no longer holds.
- The focus of a poll loses a node in a case that decision 5 does not name, and the maintainer decides a new rule.
