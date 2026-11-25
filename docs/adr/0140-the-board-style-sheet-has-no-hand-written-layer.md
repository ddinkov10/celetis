# The board style sheet has no hand-written layer, and each class rule lives on its owner

## Date

2026-11-25

## Related

- [Issue #368](https://github.com/ddinkov10/celetis/issues/368): the spec and the plan of this change.
- [Issue #342](https://github.com/ddinkov10/celetis/issues/342): the epic that moves the board page to React,
  shadcn/ui, and Tailwind.
- [ADR-0065](0065-the-board-serves-each-visual-page-in-a-sandbox.md) and
  [ADR-0080](0080-a-look-decision-bypasses-the-page-csp-on-its-own-browser-tab.md): the page Content-Security-Policy
  stays as it is. The route map of `engine/board/perimeter.ts` only renames one path.
- [ADR-0020](0020-the-board-is-a-part-of-the-plugin.md), "Constraints and evidence": its list of served files names
  `board.css`. That text is evidence of the time, and it stays.

## Supersedes

- [The board page runs on React with a locked build](0123-the-board-page-runs-on-react-with-a-locked-build.md),
  in part: in "Decision", item 5, the output `engine/board/board.css`, the import
  `@import "./board.css" layer(board)`, the layers `theme, base, board, components, utilities`, the sentence "The
  hand-written rules are in `engine/board/page/board.css`.", and the sentence that `.gitattributes` marks
  `board.css` as generated. In "Consequences", the bullet that `engine/board/board.css` is generated and committed.
  The rest of item 5 stays: the Tailwind CLI, the input `engine/board/page/app.css`, the `source(none)` imports, and
  Preflight off. The cases of "The limits of the checks" that name `board.css` (case e) are probe evidence of the
  time, and they stay.

## Context

ADR-0123 kept the old stylesheet of 4,781 lines as `engine/board/page/board.css`, in a layer `board` below
`utilities`. The epic moved the screens to components that carry utilities, one family at a time. After the
screens moved, the file held rules that no component read, the tokens, the element rules, and the class rules of
components. Two places set the style of one node, and a reader had to know that each utility won over the layer
`board`.

## Constraints and evidence

- Each moved value is exact, and the look of the board does not change. A two-board probe (a base page and a lane
  page, in one browser) compared the computed style of each node, the pseudo-elements, the text, the attributes,
  the animations, the pixels, the CSP violations, and the requests in each state of the board, at 1440×900 and
  375×812, in both themes, under reduced motion and under `hover: none`. The only accepted differences are the two
  of the spec (issue #368, "Accepted differences").
- Each of the seven keyframes (`turn`, `breathe`, `attention`, `flow`, `rise`, `rise-in`, `panel-in`) has a user
  in a component, so no keyframe goes.
- The gate runs Biome with `--error-on-warnings`. The rule `complexity/noImportantStyles` warns on each
  `!important` declaration in `app.css`.
- The page CSP (`style-src 'self'`) allows no `<style>` element and no inline style. Utilities compile into the one
  generated style sheet, so they keep the CSP.

## Decision

1. **The CSS step has no layer `board`.** The layers are `theme, base, components, utilities`, the shadcn
   convention. `engine/board/page/board.css` goes.
2. **The tokens and the two `@font-face` rules stay outside a layer** in `engine/board/page/app.css`.
3. **The element rules go into `@layer base`**: the reset, `body`, the scrollbars, the view-transition rules, the
   reduced-motion rule, and the media rules of `--side` and `--dock`.
4. **The animations are theme variables.** Each of the seven keyframes is in `@theme`, and the ten
   `--animate-*` variables (`animate-turn`, `animate-flow`, and the others) give the utilities. A component names
   the utility, not a timing.
5. **Each class rule becomes the utilities of its owner component.** A marker class that a selector or a query
   reads stays with no rule of its own (`icon`, `i-*`, `card`, `col`, and the others). A class with no owner goes.
   Where a site utility and a moved value set one property, the site value wins, as it did over the layer
   `board`.
6. **Biome suppresses the three `!important` declarations of `app.css`**: `display: none !important` for the
   attribute `hidden`, and `animation` and `transition` of the reduced-motion rule. Each has a `biome-ignore`
   comment with its reason. The override of `biome.jsonc` for `page/board.css` goes with the file.
7. **The generated style sheet is `engine/board/app.css`.** It has the name of its input, `page/app.css`. The
   route `/app.css` of `engine/board/perimeter.ts` serves it, `index.html` links it, `generatedFiles` of
   `scripts/verify.ts` lists it, and `.gitattributes` marks it as generated. The path `/board.css` gets the 404
   `no such path` of each unknown path. The CSP and the other routes do not change.

## Constitution

Read: `CONSTITUTION.md`, amended 2026-11-12.

- Serves: 1 Intent to release: one place for the style of each node lets the next change of the board be smaller.
- Serves: 3 Verified landing: `build.ts --check` compares the generated `engine/board/app.css` with its bytes, and
  the gate runs Biome on its source `engine/board/page/app.css`.
- Hard limits and non-goals: none touched.

## Alternatives considered

- **Keep `board.css` for the class rules and move only the tokens.** Rejected: two places keep the style of one
  node, and the layer `board` stays as a rule that each reader must know.
- **Keep the name `board.css` for the output.** Rejected: the input is `app.css`, and the name `board.css` names a
  hand-written file that no longer exists.
- **Remove the three `!important` declarations.** Rejected: each one must win over a utility of a component, so the
  declaration is the behavior.

## Consequences

- A reader finds the style of a node in its component, and the global rules in one file.
- `cn` drops a custom font-size class such as `text-label` (epic #342, "Prototype"), so a moved font size is an
  arbitrary value.
- A GET of `/board.css` answers 404 `no such path` (`engine/board/perimeter.ts`), and the page links `/app.css`.

## Reconsider when

- Tailwind or Base UI needs a layer for a rule of the page that a utility cannot hold.
- A second style sheet is served by the board.
