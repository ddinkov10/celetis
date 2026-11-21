# The board page runs on React with a locked build

## Date

2026-11-21

## Related

- [Issue #344](https://github.com/ddinkov10/celetis/issues/344): the spec and the plan of this change. Its
  "Approaches", "The design", and "Calls of the session" sections bind this record.
- [Issue #342](https://github.com/ddinkov10/celetis/issues/342): the epic. Its body decides React 19, shadcn/ui
  on Base UI with Tailwind, and TanStack Query for the board.
- [Issue #348](https://github.com/ddinkov10/celetis/issues/348) and [ADR-0115](0115-the-engine-pins-its-packages-in-a-lockfile.md):
  the manifest, the lockfile, and the install of the packages. This record builds on them.
- [ADR-0119](0119-the-gate-tools-come-from-the-lockfile-of-the-engine.md): its decision 2 has the two install kinds,
  and its decision 3 has the gate check of `devDependencies`. This record adds the page pins to `devDependencies`,
  so the development install of ADR-0119 installs them, and the user install does not. Both decisions stay true.
- [ADR-0025](0025-the-toolchain-runs-on-typescript-and-bun.md): "Plugin users install no package dependency and
  run no build" stays true. The generated bundles are committed, and the plugin users run no build.
- [ADR-0065](0065-the-board-serves-each-visual-page-in-a-sandbox.md) and
  [ADR-0080](0080-a-look-decision-bypasses-the-page-csp-on-its-own-browser-tab.md): the page Content-Security-Policy
  stays as it is. The new rules of this record keep it.
- [ADR-0110](0110-the-coordinator-chat-reads-the-session-record-of-the-host.md): its rejection of a chat library names
  "the board DOM ... need no dependency". That premise is no longer true for the board page. The rejection stays
  for its other reasons: the Markdown of a chat renders as HTML, and the Content-Security-Policy.
- [ADR-0087](0087-the-board-reads-engine-state-through-one-read-model.md) and
  [ADR-0103](0103-a-run-of-the-daemon-is-an-explicit-state-machine.md): their "no package dependency" premises were
  replaced for the engine by ADR-0115. Their choices stay.

## Supersedes

- [A local web board shows the sessions and starts each step in a herdr tab](0003-a-local-web-board-starts-each-step-in-herdr.md),
  in part: in "Decision", the page of "a Node server with no dependency and no build step"; in "Alternatives",
  the rejection of "a React app with a build step". The route alternative stays rejected.
- [The board is a part of the plugin](0020-the-board-is-a-part-of-the-plugin.md), in part: the clause "The board has
  no dependency. Its files import only `node:` modules and other files of the board." The board page now imports
  the packages of `engine/bun.lock`, and `board.js` bundles them. The server files still import only `node:`
  modules and other files of the board, so that part stays true. Their current file is `engine/board/perimeter.ts`,
  which imports `node:child_process` and `node:http`. The name `board/server.mjs` in ADR-0020 is historical.
- [The resolver and the updater are libraries, and no library imports a command](0081-the-resolver-and-the-updater-are-libraries-and-no-library-imports-a-command.md),
  in part: in "Decision", item 4, the file scope of `checkImports`. It reads each tracked `.ts` and `.tsx` file
  under `engine/lib/` and `engine/board/`.
- [The engine library groups its files into feature folders](0114-the-engine-library-groups-its-files-into-feature-folders.md),
  in part: in "Decision", item 1.5, the sentence "The rule covers `.ts` files only." The rule covers `.ts` and
  `.tsx` files.

## Context

The board page is imperative DOM code: 15 modules of 6,085 lines, and 4,781 lines of a hand-written stylesheet
(issue #344, "Problem"). ADR-0003 and ADR-0020 kept the page with no package and no build step. The epic moves
the page to React. ADR-0020 names "The board needs a dependency or a build step" as a reason to reconsider. This
change meets that reason.

The stack came from the epic body and from the specify session of 2026-11-19 (issue #344, "Approaches" and "Calls
of the session"). The maintainer picked the design with one React root that owns the frame and host components for
the screens that are not ported yet. The alternative of several roots is in "Alternatives considered".

## Constraints and evidence

- The packages are exact pins of `engine/package.json`, locked in `engine/bun.lock` by ADR-0115. The development
  packages are React 19.3.1 and react-dom 19.3.1 with their types 19.3.0, `@base-ui/react` 1.9.0,
  `@tanstack/react-query` 5.106.1, the shadcn CLI 4.23.0 (style `base-nova`), `@tailwindcss/cli` and `tailwindcss`
  4.3.5, `tw-animate-css` 1.4.0, `class-variance-authority` 0.7.1, and `cn` 0.5.2. The plan pinned releases at least
  14 days old (issue #344, "Calls of the session", item 3).
- Biome 2.5.15 is the pinned formatter and linter. Its configuration `biome.jsonc` now reads the Tailwind directives
  of CSS.
- The page code bundles React and the other packages into `engine/board/board.js` at build time. The running
  board reads no package. The server still serves the files of its own folder, so `engine/board/perimeter.ts` does not change.
- The Tailwind CLI is the pinned devDependency. The standalone Tailwind binary has no Windows arm64 build, and
  the research did not run it (issue #344, "Calls of the session", item 4).
- The packages of the page can write a `<style>` element at load. The issue body measured this for Base UI
  without its provider, and for the other packages it rejects (issue #344, "External facts"). `CSPProvider
  disableStyleElements` at the root of `engine/board/page/app/app.tsx` turns the Base UI case off.

## Decision

1. **The stack.** The page uses React 19 and TanStack Query 5. The copied shadcn components use Base UI and
   Tailwind 4. The page code is TypeScript with JSX (`.tsx`). The components are first-party files in
   `engine/board/page/ui/`, and they are page modules, so they are trust files.
2. **The page packages are development packages.** The pins of the page are in `devDependencies` of
   `engine/package.json`, so the development install of ADR-0119 installs them. The user install of ADR-0119 does
   not install them, because the running board reads only the generated bundles.
3. **The bundle step.** `pageArtifacts` of `scripts/build.ts` runs `Bun.build` on `engine/board/page/main.tsx`
   with `jsx: { development: false }`, the `production` condition, and `NODE_ENV` set to `"production"`. The output
   is `engine/board/board.js`.
4. **The bundle guard.** A bundle input must be a file of `engine/board/`, an issue key file of the tracker, or a
   file of a package that `engine/bun.lock` holds, nested packages too. Any other input refuses the build.
5. **The CSS step.** The locked Tailwind CLI reads `engine/board/page/app.css` and writes
   `engine/board/board.css`. The input imports the Tailwind theme and utilities with `source(none)`, the
   packages `tw-animate-css` and `shadcn/tailwind.css`, and the old rules as `@import "./board.css" layer(board)`.
   The utilities import has `source(none)`, and `@source "./"` names the page sources. The layers are
   `theme, base, board, components, utilities`. Preflight is off: the input does not import Tailwind's base file.
   The issue body measured that the old rules must sit in a layer below `utilities` (issue #344, "External facts"). The hand-written rules are in `engine/board/page/board.css`. `.gitattributes` marks
   `board.css` as generated.
6. **The CSS guard.** The guard refuses each path that the compile of Tailwind reads when the path is neither in
   `engine/board/` nor in a locked package. The maintainer decided this rule on issue #344
   (https://github.com/ddinkov10/celetis/issues/344#issuecomment-7060263068). `styleRefusals` of
   `scripts/build.ts` runs before the CSS step:
   - It runs `compile` of `@tailwindcss/node` on `app.css`. The CLI runs the same compile.
   - The `customJsResolver` hook refuses each `@plugin` and each `@config`.
   - The `customCssResolver` hook checks each `@import` and `@reference` id. An absolute path, a URL, an escape,
     or a brace pattern is refused. A relative id must end in `.css`. A bare id must name a package that
     `engine/bun.lock` holds, with no `..` segment.
   - The `onDependency` hook checks the real path of each stylesheet that the compile reads. The path must be in
     `engine/board/` or in a package that `engine/bun.lock` holds.
   - Each base and pattern prefix of the `sources` and the `root` of the compile must stay in `engine/board/`,
     with no `..` segment, no absolute path, no escape, and no brace pattern.
   - An `@import` that the output of the compile still holds, such as a `url()` path, is refused.
   - The CLI runs with `--cwd engine/board`, so a scan with no `source()` stays in `engine/board/`.

   Tailwind drops a repeated `@tailwind utilities` rule, so the compile does not read its source. The guard
   accepts such a repeat, and the repeat has no effect on the output.
7. **The CSP rules.**
   - Base UI runs under `CSPProvider disableStyleElements`.
   - No package of the page writes a `<style>` element.
   - No code calls `setAttribute('style', …)`. No check of the gate refuses either form. The review of each change
     holds this rule.
   - Each update of a page package or of Tailwind runs the CSP probe of issue #344, "Done when", item 6: the
     browser reports 0 CSP violations in each state of the board.
8. **The page model.**
   - `engine/board/page/main.tsx` renders one React root into `<body>` with `flushSync`, then starts `engine/board/page/board.ts`.
   - Each screen that is not ported yet is a host component. It renders the markup of `index.html` once, has no
     props, and never renders again. The old module fills and changes that markup.
   - Each node has one owner. A node that old code writes is host markup. A node that React renders gets its
     content from React only.
   - The shell state and the browser settings are in one store (`engine/board/page/store.ts`), read with
     `useSyncExternalStore`.
   - The board read is one TanStack Query, the key `['board']`. `engine/board/page/board.ts` reads the same query through a
     `QueryObserver`.
   - The open state of the More menu is a shell input of the store. `engine/board/page/board.ts` creates `#panel` at start. These
     are the two decisions of the plan session of 2026-11-20.
9. **No copies.** The packages come from the lockfile. No copy of a package goes into the board, and the gate adds
   no checksum check of copied files.
10. **Biome.** The rule `noDangerouslySetInnerHtml` is an error for `engine/board/**`. It refuses the React prop
    (rule 12 of the trust boundary).

### The limits of the checks

- The bundle guard refuses a bundle input from outside its allowed set. The guard probe of #344 (Task 2 of the
  plan, 26 cases after its fix round) gives exit 1 for cases a2, b, and b2. Case a2 is a page that imports a
  browser-safe file of `engine/lib/`. Cases b and b2 are unlocked packages, one of them nested. Cases b3 and b4
  give exit 0: a locked nested package and a locked package.
- The CSS guard refuses `@plugin` and `@config` (probe cases c3 and c4 of #344). It also refuses them when a
  comment splits the name, as in `@plu/**/gin` (cases j1 and j2 of the guard probe of Task 9 of the plan).
- The CSS guard refuses a source path that is outside `engine/board/` or absolute (cases c2, c6, c10, c14, c15, and
  c18), a brace pattern (case c12), and a pattern with a `..` segment after a glob, as in `./**/../..` (cases f3a
  and f3b). It refuses a source name that a comment splits (cases j3 and j4).
- The CSS guard refuses an `@import` or an `@reference` of a file outside `engine/board/` (cases c1, c8, c9, and
  c11), a `url()` path (case c7), and an unlocked bare `@import` (case c5).
- The CSS guard accepts a locked bare `@import` with `@source not inline(...)` (case c13), and a `source("./")`
  option (case c17).
- The CSS guard accepts a second `@tailwind utilities source("../../../outside")` after the utilities import
  (case c16). Tailwind drops that rule, and no class from outside `engine/board/` gets into the output. The same
  line before the utilities import is the rule that Tailwind uses, and the guard refuses it (case c16b).
- In check mode, a stale `board.css` gives exit 1 (case e).
- The Biome rule refuses the `dangerouslySetInnerHTML` prop inside `engine/board/`. A probe of this change (issue
  #344) put the prop in a `.tsx` file under `engine/board/page/app/`, and Biome reported one error. The same prop in
  `scripts/` gave no error. The rule is set for `engine/board/**` only.
- The Biome rule does not refuse an assignment to the `innerHTML` property. The same probe (issue #344) assigned
  `el.innerHTML` in a `.ts` file under `engine/board/page/`, and Biome reported no error.
- A workflow run of this change built a probe input on `ubuntu-24.04`, `windows-2025`, and `macos-15`
  (https://github.com/ddinkov10/celetis/actions/runs/44808570946). The CSS output had the SHA-256
  `55d51685c271ca9bc887dedde845b90562c79042421bdbc4dadbc5b0b7d265bf` and the JS output had the SHA-256
  `5b2030a7fe5533524329371428d02a687bb50c871e4fd48a797419ec594736ac` on each of the three platforms. That run
  wrote the CSS to a file. It did not build the final `app.css`, and it did not read the CSS from the standard
  output of the CLI, as `pageArtifacts` does now. The Verify scenario V2 on the final tip checks the final input
  through `pageArtifacts` on the same three platforms. Its report on issue #344 is the source for that check.

The durable source of each guard probe and each Biome probe above is the Verify report on issue #344 (V1), at
https://github.com/ddinkov10/celetis/issues/344. That report reruns the guard cases (the probes of Task 2 and Task 9
of the plan) and the Biome cases on the final tip, before the landing.

## Constitution

Read: `CONSTITUTION.md`, amended 2026-11-12.

- Serves: 1 Intent to release: the board is the view of the path from intent to the trunk, and a declarative
  page lets the agents of the next children change it with fewer update bugs.
- Serves: 3 Verified landing: the frozen lockfile fixes the package bytes, and the gate checks the generated
  stylesheet, the types of the `.tsx` code, and the HTML rule on the tip that lands.
- Hard limits and non-goals: none touched.

## Alternatives considered

- **Several roots on the static page (islands).** One root renders each part of the frame, and a store carries the
  shell state. Rejected: the area switch toggles sections that no root owns, the roots must merge later, and the
  board read would move in a later child, so two parts of this change would be rebuilt (issue #344, "Approaches", B).
- **A React app with a build step, or a route of the product frontend.** ADR-0003 rejected it for a harness tool.
  This record replaces the first half of that rejection. The route stays rejected, because it puts the harness
  inside the product code.
- **Sonner, next-themes, or vaul.** Each writes a `<style>` element or an inline script at load, with no opt-out
  (issue #344, "External facts"). The page CSP refuses that.
- **`bun-plugin-tailwind`.** It hides the CSS inputs from the metafile, so the bundle guard cannot read them (issue
  #344, "External facts").
- **The standalone Tailwind binary.** It has no Windows arm64 build (issue #344, "Calls of the session", item 4).
- **Copies of the packages in the board folder.** Rejected by ADR-0115 (parent decision 3) and by issue #344,
  "Calls of the session", item 10.
- **`lucide-react`, `cmdk`, `recharts`, and similar packages.** Rejected: the components use the board's own icons,
  and no other package is needed.

## Consequences

- The page is a React tree. Each later child replaces one host component with a React screen, and no child
  rebuilds the frame or the read.
- A checkout needs the development install before a build or a gate run. The worktree setup runs it for each lane.
- `engine/board/board.js` and `engine/board/board.css` are generated and committed. Each edit of a page module or a
  page stylesheet needs a run of `scripts/build.ts`, and the build needs Bun 1.4.4.
- Each update of a page package or of Tailwind needs the CSP probe. The probe is a browser run, not a script of the
  repository.
- Plugin users run no build and install no package. Their board is the same bytes that the build writes.
- The bytes of a probe build were equal on Linux, Windows, and macOS. The bytes of the final build on Linux and
  Windows are open until the Verify scenario V2 compares them with the committed files. A difference there fails
  V2.

## Reconsider when

- A page package needs a lifecycle script, a runtime fetch, or a `<style>` element that no setting turns off.
- The Tailwind CLI has no build for a platform that the project supports.
- The board needs server-side rendering, or a second React root that owns part of the frame.
- The bundle or the CSS guard refuses a valid input that the project needs.
