# The last board surfaces render in React

## Date

2026-11-23

## Related

- [Issue #347](https://github.com/ddinkov10/celetis/issues/347): the spec of this change. It names the surfaces, the accepted differences, and the checks.
- [ADR-0029](0029-the-repository-keeps-no-tests.md): the probes of this change are not tracked.
- [ADR-0133](0133-the-queue-and-the-agent-order-render-in-react.md): the store and view pattern that this record continues.

## Supersedes

- [The board page runs on React with a locked build](0123-the-board-page-runs-on-react-with-a-locked-build.md), in part: in "Decision", item 8, the start of `engine/board/page/board.ts` in the first bullet, the bullet on host components, and the `QueryObserver` of `engine/board/page/board.ts`. The sentence on `#panel` was already replaced by ADR-0131. The other bullets of item 8 stay.
- [The Operations screen renders in React](0131-the-operations-screen-renders-in-react.md), in part: in "Decision", item 2, the sentence on the `keydown` listener of `engine/board/page/board.ts`. In its "Supersedes" section, "the host components of the screens that are not ported yet" and "`update-dialog.ts` stays" also go, because no host component and no such file remain. In "Decision", item 7, the sentence "The other screens that are not ported yet keep the host rule of ADR-0123 item 8." goes for the same reason.
- [The engine library groups its files into feature folders](0114-the-engine-library-groups-its-files-into-feature-folders.md), in part: in "Decision", item 2, the clause that `update-dialog.ts` of the page stays. ADR-0131 already replaced the part on `stop-dialog.ts`.
- [A run session tab never takes the focus](0101-a-run-session-tab-never-takes-the-focus.md), in part: in "Consequences", "A slow Herdr app", the path `engine/board/page/board.ts` of the `post('/api/intake', …)` call. The call is now in `engine/board/page/intake/intake.ts`. Its 10-second timeout and the accepted risk stay.
- [A local tracker in the git-bug format](0126-a-local-tracker-in-the-git-bug-format.md), in part: in "Decision", item 6, the entry `engine/board/page/board.ts` in the list of the modules that call `compareKeys`. That file is removed, and the base of this change already held no such call. The page calls `compareKeys` in `engine/board/page/operations/state.ts`. The other entries stay.

## Context

The palette, the shortcuts dialog, the toast, the phone More menu, the Update dialog, the live region, the global keys, and the start of the board read were the last parts of the board page outside React. They used the old modules `board.ts`, `palette.ts`, and `update-dialog.ts`, and the host markup of `app/hosts.tsx`. This change moves each surface to React, one at a time, and removes those modules. Each text, key, server request, and the page CSP stays, except for the accepted differences below.

## Constraints and evidence

- The packages are React 19.3.1 and `@base-ui/react` 1.9.0, at exact pins.
- In a probe of 2026-11-23, a store emit with `flushSync` inside a mount effect did not commit before it returned. The same emit in a microtask of that effect did commit.
- `Toast.Provider` subscribes in a `useEffect`, and React runs the effects of children first.
- Base UI closes a nonmodal dialog on each Esc that reaches `document`, also from a form field. On the old page, Esc in a field left the Update dialog open.
- The hidden alert of the Base UI toast reads the `description` field of the toast.
- The nonmodal Base UI portal sets `tabindex="-1"` on each dialog button when the focus leaves, and records the old value in `data-tabindex`. Only its focus guards restore that value, and the guards add a Tab stop.
- On the old page, `dispatchEvent` contained a throw of a `board-reconnect` or `board-connected` listener, and `textContent` coerced each value to text.
- Base UI pauses the toast timers on a window `blur`. The old timer ran on with the window in the background.
- Base UI returns the focus of a closed dialog to the first tabbable child of a prior `tabindex="-1"` element. The native dialog returned it to that element.
- A Base UI dialog is not in the top layer, so its order against the Update dialog (`z-[100]`) comes from `z-index`. On the old page the palette, the shortcuts dialog, and the More menu covered the Update dialog, and the Update dialog covered the Stop dialog, a card menu, the agent menu, and the toast.
- The parity of each surface was probed against the base page with the same fixtures. The probe files are not in the repository.

## Decision

1. **One root starts the page.** `engine/board/page/main.tsx` only renders `App` with `flushSync`. `App` calls `useGlobalKeys` of `engine/board/page/app/keys.ts`, and a mount effect runs `queueMicrotask(startRead)`. The microtask lets a store emit of the start commit before a listener reads the DOM. The child effects run first, so the toast manager has its subscriber before the first read.
2. **The start of the read.** `startRead` of `engine/board/page/read/read.ts` creates the `QueryObserver`, and calls `updateStore.handle` and `updateStore.start` first. It calls `observer.subscribe` last. So a reload with a pending update enters the reconnect state before the observer can send a board read.
3. **Stores and views.** `paletteStore` (`palette/state.ts`), `updateStore` (`update/state.ts`), `announcement` (`ui.ts`), the `moreOpen` input of `shellStore`, and the Base UI `toastManager` (`toast/toast.ts`) hold the state of these surfaces. A store renders no node and tracks no focus. A view owns its focus rule.
4. **The global keys.** The one first-party `keydown` listener on `document` is in `app/keys.ts`. It keeps the guard order of the old listener: a prevented event or a target in the Update dialog, the Ctrl/Cmd+K rule, the agent order, the modifiers, an open shortcuts dialog, an open palette, an open Stop dialog, a field, the More menu for Esc, the Update dialog for Esc, `handleKey`, then the plain keys.
5. **Esc and the Update dialog.** The dialog closes on a Base UI Esc only when the target is inside its popup. For another target, `onOpenChange` cancels the close, and the key handler applies its guards.
6. **The toast.** The toast renders on Base UI `Toast`. It gives Base UI a `description` with no backticks, because the hidden alert reads that field. The visible detail renders each backtick span as code. `toast/toast.ts` owns the 6-second timer of a success toast, and gives Base UI `timeout: 0`, so a window with no focus does not pause it (maintainer decision of 2026-11-24). A pointer over the region and a focus-visible element in it pause the timer. A close moves the focus only when the focus is inside the toast, and each close clears the origin. A replacement puts a focus that was inside the old toast on the Close control of the new toast.
7. **The palette.** The palette renders on Base UI `Dialog` and `Autocomplete`. Its `Search` remounts at each open, because a reopen during the close kept the old highlight. `ui/dialog.tsx` owns the focus return: when `open` turns false, it focuses the element that held the focus at the open, as the native close did, in a layout effect before any later press. The overlay and the popup get no pointer events while they close, so a press during the close reaches the page. The act of a palette row runs in `onOpenChangeComplete`. So the act of a palette row runs with the focus on the prior element, and an act that moves the focus keeps it. Its layer `z-[110]` keeps the palette and the shortcuts dialog above the Update dialog. The More menu uses the same layer. The Stop dialog, the card menus, and the agent menu stay under the Update dialog.
8. **The Tab order of the Update dialog.** The dialog hides the Base UI focus guards. `keepTabOrder` restores each `tabindex` from `data-tabindex` on blur. This depends on that attribute of the pinned Base UI 1.9.0.
9. **Two effects of the old update code stay.** `signal` of `update/state.ts` reports a throw of a handler and goes on, as `dispatchEvent` did. `text` coerces a value as `textContent` did.
10. **Seven accepted differences.**
    - The toast: a pointer over a toast pauses its timer, a swipe dismisses it, and F6 moves the focus to the toast region. The root has `role="alertdialog"` in a region named `Notifications`, and a hidden `role="alert"` node announces it.
    - The palette and the shortcuts dialog: the native `<dialog>` becomes the Base UI `Dialog`.
    - The More menu: the old popover becomes `DropdownMenu`.
    - Esc with the palette over the Stop dialog closes the palette and keeps the Stop dialog. The old page closed the Stop dialog under the palette (maintainer decision of 2026-11-24).
    - A render throw in the open palette closes the palette, and the page stays usable. The old page kept the palette open (maintainer decision of 2026-11-24).
    - With the palette over the shortcuts dialog, two Esc events in one browser task close only the palette. Real key presses close both (maintainer decision of 2026-11-24).
    - A resize from the phone width to the desktop width closes the More menu. The old page kept it open (maintainer decision of 2026-11-24).

## Constitution

Read: `CONSTITUTION.md`, amended 2026-11-12.

- Serves: 1 Intent to release: the board keeps its behavior while its last surfaces move to React.
- Serves: 3 Verified landing: the gate checks the types of the moved code and the generated page on the tip that lands.
- Hard limits and non-goals: none touched.

## Alternatives considered

- **Start the read directly in the mount effect.** Rejected. A store emit there does not commit before it returns, so a listener reads the old DOM.
- **Close the Update dialog on each Base UI Esc.** Rejected. Esc in a form field would close the dialog, and the old page left it open.
- **Keep the Base UI focus guards of the Update dialog.** Rejected. They add a Tab stop that the old page did not have.
- **Keep the native `<dialog>` for the palette and the shortcuts.** Rejected. The epic chose shadcn on Base UI, as the Stop dialog did in #346.

## Consequences

- The page has no host component and no `board.ts`, `palette.ts`, or `update-dialog.ts`.
- The helpers `$`, `el`, `icon`, and `iconButton` of `ui.ts` are gone.
- A change to the start must keep `observer.subscribe` after `updateStore.start`.
- No gate check detects a change of `data-tabindex` at an upgrade of Base UI.

## Reconsider when

- A Base UI release changes the focus guards, the `data-tabindex` attribute, the Esc close of a nonmodal dialog, the focus return of a dialog, or the pause of the toast timers.
- React commits a store emit inside a mount effect before the emit returns.
