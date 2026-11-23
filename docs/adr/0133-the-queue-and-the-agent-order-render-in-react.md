# The queue and the agent order render in React

## Date

2026-11-22

## Related

- [Issue #360](https://github.com/ddinkov10/celetis/issues/360): the spec of this change. It names the two stores, the focus rules, and the handle menu of the agent order.
- [ADR-0123](0123-the-board-page-runs-on-react-with-a-locked-build.md): the page runs on React, and each node has one owner. This record keeps that rule.
- [ADR-0131](0131-the-operations-screen-renders-in-react.md): the Operations screen renders in React. Its decision 5 holds one sentence that this record replaces.

## Supersedes

- [The Operations screen renders in React](0131-the-operations-screen-renders-in-react.md), in part: in "Decision", item 5, the sentence "No other case saves or restores the focus by hand."

## Context

The Queue tab and the agent order of Control were the imperative DOM parts of the board page for their two surfaces. The Queue tab rendered its children by hand, and the agent order replaced its children and held nodes that React did not own, inside a host that React did not update. This change moves both surfaces to React and to the shadcn components on Base UI. Each look, text, state, key, server request, and the page CSP stays as it was.

## Constraints and evidence

- The base of the lane is `eb049cb225f90427fc9a41e2137bdcf38d9b6e52`. The base Queue tab kept its panel mounted while closed.
- React sends no blur for a node that it removes. A focus-out listener therefore cannot read the focused control in the layout effect that runs after the commit.
- The parity of each look, text, key, request, and CSP was probed against the base page with the same fixtures. The probe files are not in the repository.

## Decision

1. **Two stores.** `engine/board/page/queue/state.ts` holds `queueStore` and `useQueue`. `engine/board/page/agents/state.ts` holds `agentStore` and `useAgents`. Each view reads its store with `useSyncExternalStore`. A store renders no node and tracks no focus. The one DOM act of the agent store is `focusFirst`, which focuses the first handle.
2. **Each view owns its focus rule.** The views are `engine/board/page/queue/queue.tsx` and `engine/board/page/agents/agents.tsx`. Each runs its rule in a layout effect after each commit. `useFocusedKey` of `engine/board/page/ui/focused-key.ts` records the key of the focused control on `focusin`. It keeps that key when React removes the focused node, and it clears the key when the focus moves out of the section.
   - The Queue tab: when the focus was in the section and its control is gone or has `aria-disabled="true"`, the focus goes to the control with the same key when it is enabled. Else it goes to the first enabled move or Add control. Else it goes to the heading. The focus does not scroll.
   - The agent order: the focus goes to the handle of the same agent, or to the Retry control of the same wait. Else it goes to the first handle.
3. **The handle menu.** The handle is a plain button with `data-handle`, not a `Menu.Trigger`, because the Base UI trigger opens on `mousedown` and a drag would open the menu. One shadcn `DropdownMenu` with `modal={false}` serves all handles. The store holds the host of the open menu (`menuFor`), and the menu is anchored at the handle of that host.
   - A click on a handle opens its menu, and a second click on the same handle closes it. A `pointerdown` capture listener on `window` records the open host before the outside-press close of Base UI. The click then closes the menu when the recorded host, or the open host, is the host of the handle.
   - The first item takes the focus when the menu opens. A press on another handle moves the menu, and the first item takes the focus again.
   - Tab and Shift+Tab close the menu and move the focus from the handle. The handler closes the menu, focuses the handle, and does not prevent the default action, so the browser continues the Tab from the handle.
   - An outside press keeps the focus on the control that was clicked. Esc, a pick, and a toggle return the focus to the handle.
4. **The first-party drag.** `engine/board/page/agents/drag.ts` holds `useHandleDrag`. It uses the pointer events of the handle, with pointer capture, and it adds no package. A press on the handle of an included agent starts a press. A move of 4 px starts the drag, closes the menu, and sets the one React state of a drag. Later moves write the top of the preview, and the top and the hidden state of the marker, through refs.
   - A press that does not reach 4 px is a click. A drag that ends or is cancelled sets a click flag, so that the click after it runs no act. A `pointerdown` capture listener on `window` resets the flag for each press inside the list, so a cancelled drag does not swallow the next click.
   - The maintainer kept the first-party drag on 2026-11-22, after a probe of `@dnd-kit/react`. See [issue #360](https://github.com/ddinkov10/celetis/issues/360).

## Constitution

Read: `CONSTITUTION.md`, amended 2026-11-12.

- Serves: 1 Intent to release: the board keeps its look and behavior while its surfaces move to React.
- Serves: 3 Verified landing: the gate checks the types of the `.tsx` code and the generated stylesheet on the tip that lands.
- Hard limits and non-goals: none touched.

## Alternatives considered

- **`@dnd-kit/react` in its default setup.** Rejected. Its preset writes a `<style>` element, and the page CSP reports 3 violations.
- **`@dnd-kit/react` without its style plugins.** Rejected. The page still needs its own preview, marker, and keyboard moves, and the package adds 8 locked packages before version 1.0.
- **Pragmatic drag and drop.** Rejected. It adds one package and three runtime dependencies for the same result.
- **A Base UI `Menu.Trigger` on the handle.** Rejected. The trigger opens on `mousedown`, so a drag would open the menu.
- **Ignore the outside-press close on the handle, so that the click alone toggles.** Rejected. In the probe, the menu did not toggle. The recorded host of the `pointerdown` capture listener does.

## Consequences

- The Queue panel has no `#queue` node while its tab is closed, because `keepMounted` is gone.
- The handle menu is the shadcn `DropdownMenu`. Its items, keys, and focus stay.
- The drag preview stays a clone of the row, as before.
- A change to a view must keep its focus rule in that view's layout effect, and it must keep one owner for each node (ADR-0123).

## Reconsider when

- A Base UI release changes how a trigger or an outside press opens or closes a menu. The plain handle and the toggle rule then need a new check.
- A drag package runs under the page CSP without a `<style>` element, and the maintainer asks to use it.
