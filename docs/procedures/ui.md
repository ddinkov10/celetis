# UI Prototype

A UI prototype answers a look decision with **live variants**. Each variant is a complete option,
built on the real screen. The user uses each variant in each state, at each size of the platform
row, before the pick. The captures of the variants go on the issue and stay after the landing.

If the question is about logic or a state model, this is the wrong branch. Use `<plugin>/skills/prototype/LOGIC.md`.

## Contents

- **The look decision:** what a look decision and a state are, and which steps build variants.
- **The platform rows:** the live use, the switches, the sizes, and the capture of each kind.
- **Where the variants live:** the prototype checkout, and the two sub-shapes.
- **The procedure:** the ten steps, from the list of states to the cleanup.
- **Captures:** the tools check, the file, the look before the post, and the post.
- **A direct run:** a run of `/celetis:prototype` with no issue.
- **Anti-patterns:** the results that fail a prototype.

## The look decision

A look decision is each change to what a person sees on screen, or to how the screen behaves. It
includes a change whose look the issue already describes. A **state** is one condition of the
screen that shows differently, for example empty, loading, an error, many items, or an open dialog.
The **kind** is the platform of the product: web, mobile, desktop, or terminal.

- `specify` follows "The procedure" for each look decision.
- `bug` follows it only for a fix that chooses a look that no spec, design document, code, or
  issue text defines.
- A `bug` fix that restores a defined look, a regression too, builds no variants. Its evidence is
  the capture repro ("Captures").

## The platform rows

The platform row of a kind gives the live use, the switch of the variant and the state, the sizes
of the check, and the form of the capture.

| Kind | Live use | Variant and state switch | Sizes | Capture |
| --- | --- | --- | --- | --- |
| Web | The browser pane of the host, else the default browser | `?variant=<key>&state=<key>` and the floating bar | 1440×900 and 375×812 | A PNG screenshot from the browser tool of the host or from a script with a headless browser |
| Mobile | A simulator or an emulator | The launch arguments `--prototype-variant <key>` and `--prototype-state <key>`, or a debug menu of the product | A small phone near 375×667 points or 360×640 dp, and a large phone near 430×932 points or 412×915 dp | A screenshot of the simulator or the emulator |
| Desktop | The app window | The same launch arguments, or a debug menu of the app | The smallest window that the app allows (800×600 when it sets no minimum), and 1920×1080 | A window screenshot |
| Terminal | A terminal pane | `PROTOTYPE_VARIANT=<key>` and `PROTOTYPE_STATE=<key>`, or flags of the program | 80×24 and 160×48 (columns×rows) | A VHS tape: `Screenshot` writes a PNG of a still state, and `Output` writes a GIF of a moving one |

- A variant key is `A`, `B`, `C`, `D`, or `E`. A state key is a short kebab-case name from the
  list of states, for example `empty`, `loading`, `error`, `many-items`, or `open-dialog`.
- The `AGENTS.md` of the product names its kind and each difference from the default row, for
  example a tablet size, or a debug menu that the product already has. When the product uses a key
  of the bar on the page itself, `AGENTS.md` names the replacement key.
- When `AGENTS.md` names no kind, take the kind from the code, and show it in step 1.
- A product with two kinds, for example a web app and a mobile app, uses the row of the screen that
  the change touches.
- A mobile size is the simulator or emulator device that is closest to it.
- A VHS tape sets the terminal size with `Set Columns` and `Set Rows`. These two do not combine
  with `Set Width` or `Set Height`.
- The desktop row has no checked source. The first product of the desktop kind checks it and names
  each difference in its `AGENTS.md`.

## Where the variants live

The variants live in the prototype checkout: the branch `prototype/<n>-<slug>`, never the lane
branch (`<plugin>/docs/issue-tracker.md`, "Branches, PRs, merge"). The prototype uses live data
where the product can give it, as its `AGENTS.md` says. A state that the live data does not show
gets a fixture in the prototype.

- **Sub-shape A: an existing screen hosts the variants (preferred).** The variants render on the
  route, window, screen, or command that already exists. Its data, its parameters, and its auth
  stay; only the rendering changes. A new section, card, or step inside an existing screen is
  sub-shape A too. A variant next to the real header, the real navigation, and real data shows the
  problems that an empty screen hides.
- **Sub-shape B: a new throwaway screen (last resort).** Use it only when no existing screen can
  host the thing. Follow the routing or navigation convention of the project, and put the word
  `prototype` in the path or the name.

The captures go in `docs/superpowers/captures/` of the prototype checkout. Git ignores that
folder, so no branch holds a capture.

## The procedure

Do the steps in this order. The build of the variants starts after step 2.

1. **The states and the row.** Take the list of states from the code and the issue, with a key for
   each state. Take the kind and its row from `AGENTS.md` or the code. Read the design document
   that `AGENTS.md` names, when it names one. Run the tools check of
   "Captures". Show the list of states, the kind, and the row to the user. If anything is unclear
   or the user must make a decision, ask about that point and wait for the answer. Otherwise,
   continue without a follow-up question. After an opt-out of the questions in `specify`, the list
   and the row are marked assumptions, and the step goes on with no wait.
2. **The research.** In `specify` or `bug`, add the guidelines of the platform to the
   `## Prior art` section that the step wrote (`<plugin>/docs/procedures/prior-art.md`, "What to find"), with
   no second search for the same problem. For a look decision of a new problem, add its findings to the same
   section. Each variant follows a pattern that the research found. When the research found none,
   the variant says so and names the source of its idea.
3. **The variants.** Build 3 variants by default, and 5 at most. More stop being different and
   become noise. Each variant is different in structure: its layout, its information hierarchy, or
   its primary action. Each variant has a key, a name, the pattern that it follows, and its
   trade-off, and it renders each state of the list. Use the component library and the styles of
   the project. Each variant keeps the rules of the design document, or its trade-off names the rule
   that it changes. Keep the data reads above the variants, so only the rendering changes.
4. **The switches.** The variant and the state switch as the row says. Each state of the list has
   one value of the state switch. The user sees the key, the name, the pattern, and the trade-off
   with the variant: in the bar on the web, in the debug menu or an overlay of the prototype for
   mobile and desktop, and in the hand-over for a terminal. On the web, the bar:
   - is a small fixed bar at the bottom center, high contrast, so that it is not part of the design;
   - shows the key, the name, the pattern, and the trade-off of the current variant, and a menu of
     the states;
   - has arrows that cycle the variant, and wrap around;
   - writes `?variant=` and `state=` through the router of the project, so that a reload or a
     shared URL shows the same view;
   - cycles the variant with `←` and `→` and the state with `[` and `]`, only when the focus is on
     the page itself or in the bar, and never in an `<input>`, a `<select>`, a `<textarea>`, or a
     `[contenteditable]`;
   - shows only outside a production build, for example behind
     `process.env.NODE_ENV !== 'production'`.
5. **The check.** Open each variant in each state at each size of the row. Check keyboard use: the
   focus order, a visible focus, and each action with keys. Check the rules of the design document
   too. Fix what the check finds.
6. **The live opening.** Start the prototype with one command, and open it as the row says. On the
   web, open the browser pane of the host when the session has one, else the default browser:
   `open <url>` on macOS, `xdg-open <url>` on Linux, `cmd /c start "" "<url>"` on Windows. Give
   the URL too. For a terminal program, give the command with its switch values.
7. **The captures.** Make one capture of each variant in each state at each size of the row, and
   post them on the issue as "Captures" says. Hide the bar or the overlay of step 4 for each
   capture: the alt text names the variant, and the record names its pattern and its trade-off.
8. **The hand-over.** Give the live opening, each variant with its key, name, pattern, and
   trade-off, and the link of each capture comment. Recommend one variant, and give the reason.
   Then ask for the pick. The best answer is often a merge, for example the header of B with the
   list of C. After an opt-out of the questions in `specify`, the recommended variant is a marked
   assumption, and the step asks nothing.
9. **The record.** Write the `## Prototype` section of the spec or of the root-cause report
   (`<plugin>/docs/issue-tracker.md`, "What lives on the issue"):
   - the question;
   - the kind and each difference from its default row;
   - the branch and the commit that step 10 pushes;
   - one line for each variant, with its pattern and its trade-off;
   - the link of each capture comment, and each capture with example data;
   - the recommendation and its reason;
   - the verdict and its reason.
10. **The cleanup.** Stop the prototype, commit the variants and any capture script, push the
    branch, and remove the checkout (`<plugin>/docs/issue-tracker.md`, "Branches, PRs, merge").
    The build of the lane folds the winner into the real code. It writes the winner again under the
    rules of production code.

## Captures

A capture is a screenshot or a terminal recording of one variant in one state at one size. The
variants of step 7 use this section. The capture repro of a visual bug in `bug`, and the after-fix
capture of a Verify scenario of `plan`, use it too: one capture at the failing state and size, with
no variants.

**The tools check.** Run it before the build, and before the first capture of a repro:

- `gh --version` prints 2.99.0 or later. The `--attach` flag came in 2.99.0.
- `gh repo view --json url --jq .url` prints a URL that starts with `https://github.com/`. GitHub
  Enterprise Server does not support `--attach`.
- The capture tool of the row is there: the browser tool of the host or a script with a headless
  browser, the simulator or the emulator, the app, or VHS.

A failed check stops the step before the build. The stop names the update of `gh` or the setup of
the tool. There is no fallback: the captures go only on the issue. In a step session, hand the
stop to the issue by `<plugin>/docs/procedures/stop.md`, "A stop in a step session".

**The file.** Name a capture `<variant>-<state>-<size>.png`, or `.gif`, for example
`B-empty-375x812.png`. Put it in `docs/superpowers/captures/` of the checkout that took it. Its
alt text is `<variant key> <variant name>, <state>, <size>`, for example
`B Sidebar list, empty, 375×812`.

**Look before the post.** Read each capture. When a capture shows a secret, a token, or data that
the issue must not hold, give that state example data and make the capture again. The record names
each capture with example data. A capture on the issue of a public repository is public.

**The post.** Write the body to a file. Its first line is one of these plain lines:

- `Captures: <the question>` for the variants, with `part <i> of <k>` at the end when the captures
  need more than one comment;
- `Capture repro: <state>, <size>` for the repro of a visual bug;
- `After-fix capture: <state>, <size>` for the capture of a Verify scenario.

The first line is never a `## ` heading. The resolver reads each comment that starts with `## `,
and such a comment ends a current landing refusal (`<plugin>/docs/issue-tracker.md`, "Resolving an
issue's state"). Post with one `--attach` for each capture:

```sh
gh issue comment <n> --attach '<file>#<alt text>' --body-file <body file>
```

One comment holds at most 50 files, and each image is at most 10 MB. More captures go into more
comments, each with its own first line: 5 variants × 6 states × 2 sizes are 60 captures, so two
comments. `gh` prints the URL of each comment. Keep it for the hand-over and the record.

## A direct run

A run of `/celetis:prototype` with no issue does steps 1 to 6, the captures of step 7, and step 8.

- The tools check checks only the capture tool.
- The research of step 2 follows `<plugin>/docs/procedures/prior-art.md`. Its findings go in the hand-over.
- The prototype checkout is `<main>/.claude/worktrees/prototype-<slug>` on the branch
  `prototype/<slug>`. `<main>` is the main checkout.
- Commit the variants on `prototype/<slug>` before the hand-over.
- The captures stay in `docs/superpowers/captures/` of that checkout. The hand-over gives their
  paths. The run posts nothing and writes no record.
- The hand-over gives the two removal commands, to run after the user stops the prototype:
  `git worktree remove <path>` and `git branch -D prototype/<slug>`.

## Anti-patterns

- **Variants that differ only in colour or copy.** That's a tweak, not a prototype. Real variants disagree about structure.
- **Sharing too much code between variants.** A shared `<Header>` is fine; a shared `<Layout>` defeats the point. Each variant should be free to throw out the layout.
- **Wiring variants to real mutations.** Read-only prototypes are fine. If a variant needs to mutate, point it at a stub: the question is "what should this look like", not "does the backend work".
- **Promoting the prototype directly to production.** The variant code was written under prototype constraints (no tests, minimal error handling). Rewrite it properly when you fold it in.
- **A text or ASCII list of options as the hand-over.** The hand-over is the live variants and their captures.
- **Variants before the list of states or before the research.** Step 1 and step 2 come first.
- **A question for the pick before the user could use the variants.** The pick comes after the live opening and the captures.
- **A capture on a branch.** The captures go on the issue as attachments.
- **A capture that shows a secret.** That state gets example data.
- **A capture comment with a `## ` first line.** Its first line is one of the plain lines of "Captures".
