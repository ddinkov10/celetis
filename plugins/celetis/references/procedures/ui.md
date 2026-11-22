# UI Prototype

A UI prototype answers a look decision on the real screen. `impeccable` gives the options of a
whole web or mobile screen and of a smaller web change, and the maintainer picks one on its page or
its overlay. Where `impeccable` has no variant source, the prototype builds **live variants** by
hand ("The two paths"). The user uses the result in each state, at each size of the platform row.
The captures go on the issue and stay after the landing.

If the question is about logic or a state model, this is the wrong branch. Use `<plugin>/skills/prototype/LOGIC.md`.

## Contents

- **The look decision:** what a look decision, a state, the list of states, and the design
  document are, and which steps follow the procedure.
- **The two paths:** the `impeccable` path and the hand-built path, by kind and size of change.
- **The platform rows:** the live use, the switches, the sizes, and the capture of each kind.
- **Where the variants live:** the prototype checkout, and the two sub-shapes.
- **The procedure:** the ten steps, from the list of states to the cleanup.
- **The whole app:** the inventory, the diagnosis, the skeleton, the record, the rollout, and a
  child of a whole-app epic.
- **Captures:** the tools check, the hide of the bar, the file, the look before the post, and the
  post.
- **A direct run:** a run of `/celetis:prototype` with no issue.
- **Anti-patterns:** the results that fail a prototype.

## The look decision

A look decision is each change to what a person sees on screen, or to how the screen behaves. It
includes a change whose look the issue already describes. A **state** is one condition of the
screen that shows differently, for example empty, loading, an error, many items, or an open dialog.
The **kind** is the platform of the product: web, mobile, desktop, or terminal. The **design
document** is `DESIGN.md` at the root of the product, when it exists. `impeccable` reads and writes
the same file.

The **list of states** of a look decision is short. It holds the **rest state** and each state
that the change adds or changes. The rest state is the screen as a person first sees it with
typical data. An added state is, for example, the new dialog that the change opens, or the new
menu. A state that the change does not touch is not on the list. This holds also when the screen
has that state (empty, loading, an error, a long name, a scrolled page). A change that restyles
a whole screen, or a component that each state of the screen shows, puts only the rest state on
the list. A change that is for one state puts that state on the list, next to the rest state.
This holds also when the change is only its look. The session takes the list from the issue and
the code. It asks the maintainer no question about the list. On the whole-app path, the inventory
of "The whole app" takes the place of the list of states.

- `specify` follows "The procedure" for each look decision.
- `bug` follows it when the maintainer answers that the fix needs a new look.
- A `bug` fix that restores a defined look, a regression too, builds no variants. Its evidence is
  the capture repro ("Captures").

## The two paths

| Kind | The whole app | A whole screen | A smaller change |
| --- | --- | --- | --- |
| Web | `impeccable`: the diagnosis and the structure round on the shell ("The whole app") | `impeccable`: the structure round | `impeccable`: `generate` |
| Mobile | One look decision for each screen | `impeccable`: the structure round | Hand-built |
| Desktop | One look decision for each screen | Hand-built | Hand-built |
| Terminal | One look decision for each screen | Hand-built | Hand-built |

- `<plugin>/references/procedures/design.md`, "A whole screen or a smaller change", puts a change in one
  of the columns.
- **The `impeccable` path** follows `<plugin>/references/procedures/design.md`: its check in step 1, and
  its pick in step 3. It has one variant, `A`: the locked card or the accepted variant. The
  maintainer picks it before the switches, the check, and the captures.
- **The hand-built path** builds 3 to 5 variants by hand in step 3. The user uses them, and picks
  one in step 8.

## The platform rows

The platform row of a kind gives the live use, the switch of the variant and the state, the sizes
of the check, and the form of the capture.

| Kind | Live use | Variant and state switch | Sizes | Capture |
| --- | --- | --- | --- | --- |
| Web | The browser pane of the host, else the default browser | `?variant=<key>&state=<key>` and the floating bar | 1440×900 and 375×812 | A PNG screenshot from the background browser (`<plugin>/references/procedures/browser.md`, "The two browsers") |
| Mobile | A simulator or an emulator | The launch arguments `--prototype-variant <key>` and `--prototype-state <key>`, or a debug menu of the product | A small phone near 375×667 points or 360×640 dp, and a large phone near 430×932 points or 412×915 dp | A screenshot of the simulator or the emulator |
| Desktop | The app window | The same launch arguments, or a debug menu of the app | The smallest window that the app allows (800×600 when it sets no minimum), and 1920×1080 | A window screenshot |
| Terminal | A terminal pane | `PROTOTYPE_VARIANT=<key>` and `PROTOTYPE_STATE=<key>`, or flags of the program | 80×24 and 160×48 (columns×rows) | A VHS tape: `Screenshot` writes a PNG of a still state, and `Output` writes a GIF of a moving one |

- A variant key is `A`, `B`, `C`, `D`, or `E`. A state key is a short kebab-case name from the
  list of states, for example `rest`, `open-dialog`, or `new-menu`.
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

From the lane worktree, `git worktree add -b prototype/<n>-<slug>
<main>/.claude/worktrees/prototype-<n>-<slug>` checks out the prototype (`<main>` is the main
checkout). Install there what the dev server of the project needs. A capture script is committed
with the variants; install a tool that such a script needs with no change to a tracked file.

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

Do the steps in this order. The build of the variants starts after step 2. On the whole-app path,
"The whole app" changes steps 1, 3, 4 to 7, and 9, and puts the diagnosis between step 1 and
step 2.

1. **The states and the row.** Take the kind and its row from `AGENTS.md` or the code, and the path
   from "The two paths". Then run the checks of `<plugin>/references/procedures/design.md`: "The check"
   and "Can the session ask" on the `impeccable` path, and "Can the session ask" on the hand-built
   path. A failed check is the stop that the file names. On the `impeccable` path, run `shape`
   only for its discovery questions and its brief. Skip its Phase 2, the direction or the concept
   choice of `<impeccable>/reference/new-work.md`: the structure round or `generate` of step 3
   gives the options. Take the list of states by "The look decision", from the code and the issue,
   on both paths. On the `impeccable` path, skip the states question of the discovery of `shape`,
   and do not take the list from the "States and ranges" part of its brief. Give each state a
   kebab-case key. Read `DESIGN.md` when it exists. Run the tools check of "Captures". Show the
   path, a whole screen or a smaller change on the `impeccable` path, the list of states, the
   kind, and the row to the user. Ask no question about the list of states. If anything else is
   unclear or the user must make a decision, ask about that point and wait for the answer.
   Otherwise, continue without a follow-up question.
2. **The research.** In `specify` or `bug`, add the guidelines of the platform to the
   `## Prior art` section that the step wrote (`<plugin>/references/procedures/prior-art.md`, "What to find"), with
   no second search for the same problem. For a look decision of a new problem, add its findings to the same
   section. For a look decision that adds or changes a UI component, follow
   `<plugin>/references/procedures/component-research.md`: its findings go to the same section, with no
   second search of a component that the section already covers. On the hand-built path, each
   variant follows a pattern that the research found, and keeps each line of
   `### Required behavior`. When the research found none, the variant says so and names the source
   of its idea. Step 2 is complete when its findings are in `## Prior art`: when a child agent does
   the research, wait until it returns. Then show the maintainer the models and the lines of
   `### Required behavior` in one short message, with no question.
3. **The variants.** Start only when step 2 is complete: no variant, no baseline element, and no
   `generate` round comes before it. Use the component library and the styles of the project, and
   keep the data reads above the variants, so only the rendering changes.
   - **A whole screen on the `impeccable` path.** Run the structure round and its pick by
     `<plugin>/references/procedures/design.md`, "The pick". The locked card is the one variant, `A`.
     Build its structure on the real screen, in each state of the list.
   - **A smaller web change.** The prototype shows the real screen. When the change adds an
     element, its first rendering is the target of `generate`: it follows the strongest found model
     and keeps each line of `### Required behavior`. Run `generate` on the element and its pick by
     "The pick" of the same file. The accepted variant is the one variant, `A`.
     The overlay is the only review channel before the accept: make no capture before it.
   - **The hand-built path.** Build 3 variants by default, and 5 at most. More stop being
     different and become noise. Each variant is different in structure: its layout, its
     information hierarchy, or its primary action. Each variant has a key, a name, the pattern that
     it follows, and its trade-off, and it renders each state of the list. Each variant keeps the
     rules of `DESIGN.md`, or its trade-off names the rule that it changes.
4. **The switches.** The variant and the state switch as the row says. Each state of the list has
   one value of the state switch. The user sees the key, the name, the pattern, and the trade-off
   with the variant: in the bar on the web, in the debug menu or an overlay of the prototype for
   mobile and desktop, and in the hand-over for a terminal. On the `impeccable` path, the one
   variant shows its source in place of the pattern and the trade-off: the locked card, or the
   `generate` action. The web bar then has no variant arrows, and `←` and `→` do not cycle a
   variant. On the web, the bar:
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
   focus order, a visible focus, and each action with keys. Check the rules of `DESIGN.md` too. Fix
   what the check finds. On the web, the check runs in the background browser
   (`<plugin>/references/procedures/browser.md`, "The two browsers"). A page that asks for a sign-in
   follows `<plugin>/references/procedures/browser.md`, "A page behind a sign-in".
6. **The live opening.** Start the prototype with one command, and open it as the row says. On the
   web, open the browser pane of the host when the session has one, else the default browser:
   `open <url>` on macOS, `xdg-open <url>` on Linux, `cmd /c start "" "<url>"` on Windows. Give
   the URL too. For a terminal program, give the command with its switch values.
7. **The captures.** Make one capture of each variant in each state at each size of the row, and
   post them on the issue as "Captures" says. Hide the bar or the overlay of step 4 for each
   capture, on the web as "Captures" says: the alt text names the variant, and the record of step 9
   describes it. On the web, the captures run in the background browser
   (`<plugin>/references/procedures/browser.md`, "The two browsers"). A page that asks for a sign-in
   follows `<plugin>/references/procedures/browser.md`, "A page behind a sign-in".
8. **The hand-over.** Give the live opening and the link of each capture comment.
   - On the `impeccable` path, the lock or the accept of step 3 is the pick. Give the locked card
     or the accepted variant, and ask for no second pick.
   - On the hand-built path, give each variant with its key, name, pattern, and trade-off.
     Recommend one variant, and give the reason. Then ask for the pick, and wait for the answer.
     The best answer is often a merge, for example the header of B with the list of C.
9. **The record.** Write the `## Prototype` section of the spec or of the root-cause report
   (`<plugin>/docs/issue-tracker.md`, "What lives on the issue"):
   - the question and the path;
   - the kind and each difference from its default row;
   - the list of states, with the key of each state;
   - the branch and the commit that step 10 pushes;
   - on the hand-built path, one line for each variant, with its pattern and its trade-off, and
     the recommendation and its reason;
   - for the structure round, each dealt card with its name, its `kind`, and one line, and the
     locked card;
   - for `generate`, the accepted variant and each tuning of `generate`;
   - the link of each capture comment, and each capture with example data;
   - the verdict and its reason. On the `impeccable` path, the verdict is the lock or the accept of
     the maintainer.
10. **The cleanup.** Stop the prototype, commit the variants and any capture script with a
    message that references `#<n>`, push the branch, and remove the checkout with
    `git worktree remove` (`<plugin>/docs/issue-tracker.md`, "Branches, PRs, merge").
    Commit no file that the look decision wrote under `.impeccable/`. Before the removal of the
    checkout, remove each such untracked file, so that `git status --porcelain` shows none of
    them. The build of the lane folds the chosen variant into the real code. It writes the variant
    again under the rules of production code.

## The whole app

The whole-app path is the look decision of a change that revises the shell of a web app, or the
arrangement of its screens as a whole: the navigation, the regions, and the layout of each
screen. The visual world of `DESIGN.md` (the color, the type, and the components) stays. A change
of the visual world is a redesign, and it does not take this path. A change inside one screen
takes the column of a whole screen or of a smaller change. The session takes the path from the
issue and the code, and shows it in step 1. "The procedure" applies, with the changes of this
section.

**The inventory.** In step 1, the inventory takes the place of the list of states. Take it from
the code and `AGENTS.md`, and ask the maintainer no question about it.

- A **screen** is each route or top-level view of the app.
- A **structural state** of a screen is its rest state, and each state that changes the
  arrangement of the screen: an open panel, a drawer, a dialog, a menu, or a second pane.
- Each screen gets a kebab-case key. Each structural state gets the key `<screen>-<state>`, for
  example `list-rest` or `list-open-drawer`.
- The sizes are the sizes of the web row of "The platform rows".

Step 1 shows the inventory, with the number of its screens, its states, and its captures, in
place of the list of states.

**The diagnosis.** It comes after step 1 and before step 2. It changes no file of the product: a
fixture stays in the prototype checkout ("Where the variants live"). From the `layout` command of
`impeccable`, it runs only `<impeccable>/reference/layout.md`, "Two isolated assessments", and
not its spatial thesis or its "Apply". The fixes come from the skeleton and the build.

1. **The captures.** Make one capture of each structural state of the inventory at each size, of
   the product as it runs today, by "Captures". The live data and the fixtures follow "Where the
   variants live".
2. **The layout assessment.** For each screen, answer each question of part 1 of "Two isolated
   assessments" with rendered or source evidence. Answer one more question for the app as a
   whole: do the shared regions (the navigation, the header, the panels) keep one place and one
   behavior on each screen and at each size?
3. **The mechanical scan.** After the assessment, run
   `<impeccable>/scripts/impeccable detect --json --scope layout --viewport <W>x<H> <url>` once
   for each screen at each size. Keep its output out of the assessment. A screen with no URL of
   its own gets no URL scan: run
   `<impeccable>/scripts/impeccable detect --json --scope layout <files>` once on the source
   files of its view, and name the screen in the post. A scan that exits 1 did not scan its
   target: name that screen and size in the post. A clean scan is no proof of a good structure.
4. **The findings.** Write one line for each finding:
   `- <grade> · <key> · <size> · <question or rule> · <evidence>`. The grade is `breaks` (a task
   or a size does not work), `drifts` (two screens solve one need differently), or `minor`.
5. **The post.** Write the body to a file. Its first line is the diagnosis line of "Captures",
   "The post". The body holds the commit of the app that the captures show, the inventory with
   its keys, and the findings. Post the captures as attachments, as "The post" says. Keep the
   URL of each comment.
6. **The hand-over.** In one short message with no question, show the maintainer the number of
   findings of each grade, the three most important findings, and the link of each diagnosis
   comment. Then go on to step 2.

**A new entry.** On a new entry of the step, reuse the newest complete diagnosis of the issue
(each part from 1 to k) when no commit after its commit changes a file of the app. Else make a
new diagnosis. A new entry posts no second copy of a complete diagnosis.

**The skeleton.**

- Step 2 adds the canonical layouts of the platform and its guidelines to `## Prior art`, as for
  each look decision.
- Step 3 runs the structure round on the shell, by
  `<plugin>/references/procedures/design.md`, "The pick". The findings of the diagnosis go to the
  round as constraints, next to the lines of `### Required behavior`. The locked card is the one
  variant, `A`. Build its structure on the real app: on each screen, in each structural state of
  the inventory.
- In steps 4 to 7, the state switch has one value for each key of the inventory, and the check
  and the captures cover each key at each size. A capture of the prototype is
  `A-<key>-<size>.png`.
- In step 9, the `## Prototype` section also holds the full text of the locked card (its thesis,
  each line of its `materials`, and its `viewport`), and each key that the prototype covered.
- The spec says that the build updates only the layout parts of `DESIGN.md` (the shell, the
  regions, and the breakpoints), to describe the built skeleton. Its visual world stays.

**The record.** The spec, or the body of the epic parent, holds a `## Diagnosis` section before
`## Prior art`: the link of each diagnosis comment, the inventory with its keys, and the number
of findings of each grade (`<plugin>/docs/issue-tracker.md`, "What lives on the issue").

**The rollout.** After the lock, the look decision does steps 4 to 10. Then run the scope check
of `<plugin>/references/procedures/epic.md`, "A whole-app revision". The removal of the lane of
an epic deletes the prototype branch (`<plugin>/docs/issue-tracker.md`, "Branches, PRs, merge"), so
the children build from the text of the locked card and the capture comments of the parent.

**A child of a whole-app epic.** When the body of the parent holds a `## Prototype` record of a
whole-app skeleton, the child takes that skeleton as its look, by
`<plugin>/references/procedures/design.md`, "The pick". In that case, the look decision of the
child:

- runs step 1 with the part of the inventory on its own screens, and runs no diagnosis;
- builds the locked skeleton on its own screens in step 3, and makes their captures in step 7;
- writes, in step 9, a `## Prototype` section that links the record of the parent, names its
  screens and states, and links its own capture comments.

## Captures

A capture is a screenshot or a terminal recording of one variant in one state at one size. The
variants of step 7 use this section. The capture repro of a visual bug in `bug`, and the after-fix
capture of a Verify scenario of `plan`, use it too: one capture at the failing state and size, with
no variants. The diagnosis of "The whole app" uses it too: one capture of each key of its
inventory at each size, with no variants.

**The tools check.** Run it before the build, and before the first capture of a repro. Get the
`tracker` of the project from the reader CLI of the entry contract
(`<plugin>/references/procedures/entry.md`, "The contract"). The two `gh` lines hold only for the
tracker `github`. With the tracker `local`, the check is only the capture tool, because the engine
stores a capture as a blob: the check runs no `gh` and does not stop for a missing `gh`.

- With the tracker `github`: `gh --version` prints 2.99.0 or later. The `--attach` flag came in 2.99.0.
- With the tracker `github`: `gh repo view --json url --jq .url` prints a URL that starts with
  `https://github.com/`. GitHub Enterprise Server does not support `--attach`.
- With each tracker, the capture tool of the row is there: on the web the background browser
  (`<plugin>/references/procedures/browser.md`, "The two browsers" and "The role of a server"),
  else the simulator or the emulator, the app, or VHS.

A failed check stops the step before the build. The stop names the update of `gh` or the setup of
the tool. There is no fallback: the captures go only on the issue. In a step session, hand the
stop to the issue by `<plugin>/references/procedures/stop.md`, "A stop in a step session".

**The hide.** On the web, a capture hides the bar or the overlay of step 4 through the `style`
property of its element, for example `element.style.display = 'none'`, with no added style sheet:
the CSP of the page blocks an added style sheet, not the `style` property. The capture tab is a new
tab with no call of `<plugin>/references/procedures/design.md`, "The page CSP".

**The file.** Name a capture `<variant>-<state>-<size>.png`, or `.gif`, for example
`B-empty-375x812.png`. Put it in `docs/superpowers/captures/` of the checkout that took it. Its
alt text is `<variant key> <variant name>, <state>, <size>`, for example
`B Sidebar list, empty, 375×812`. A capture of the diagnosis has no variant: name it
`<key>-<size>.png`, for example `list-open-drawer-375x812.png`, with the alt text
`<key>, <size>`.

**Look before the post.** Read each capture. When a capture shows a secret, a token, or data that
the issue must not hold, give that state example data and make the capture again. The record names
each capture with example data. A capture on the issue of a public repository is public.

**The post.** Write the body to a file. Its first line is one of these plain lines:

- `Captures: <the question>` for the variants, with `part <i> of <k>` at the end when the captures
  need more than one comment;
- `Capture repro: <state>, <size>` for the repro of a visual bug;
- `After-fix capture: <state>, <size>` for the capture of a Verify scenario;
- `Diagnosis: the layout of the whole app` for the diagnosis of "The whole app", with
  `part <i> of <k>` at the end when the captures need more than one comment.

The first line is never a `## ` heading. The resolver reads each comment that starts with `## `,
and such a comment ends a current landing refusal (`<plugin>/docs/issue-tracker.md`, "Resolving an
issue's state"). Post with one `--attach` for each capture:

```sh
celetis --agent <host> issue <n> comment <body file> --attach '<file>#<alt text>'
```

One comment holds at most 50 files, and each image is at most 10 MB. More captures go into more
comments, each with its own first line. The act prints the URL of each comment. Keep it for the
hand-over and the record.

## A direct run

A run of `/celetis:prototype` with no issue does steps 1 to 6, the captures of step 7, and step 8.
It takes the same two paths and the same stops. On the `impeccable` path, the check, `shape`, the
structure round or `generate`, and the pick as a terminal question follow
`<plugin>/references/procedures/design.md`.

- The tools check checks only the capture tool.
- The research of step 2 follows `<plugin>/references/procedures/prior-art.md`. Its findings go in the hand-over.
  They take the place of `## Prior art` in steps 2 and 3, and in the prompt of `generate`.
- The prototype checkout is `<main>/.claude/worktrees/prototype-<slug>` on the branch
  `prototype/<slug>`. `<main>` is the main checkout.
- Commit the variants on `prototype/<slug>` before the hand-over.
- The captures stay in `docs/superpowers/captures/` of that checkout. The hand-over gives their
  paths. The run posts nothing and writes no record.
- The hand-over gives the two removal commands, to run after the user stops the prototype:
  `git worktree remove <path>` and `git branch -D prototype/<slug>`.
- The whole-app path needs an issue: a direct run takes one look decision for each screen.

## Anti-patterns

- **Variants that differ only in colour or copy.** That's a tweak, not a prototype. Real variants disagree about structure.
- **Sharing too much code between variants.** A shared `<Header>` is fine; a shared `<Layout>` defeats the point. Each variant should be free to throw out the layout.
- **Wiring variants to real mutations.** Read-only prototypes are fine. If a variant needs to mutate, point it at a stub: the question is "what should this look like", not "does the backend work".
- **Promoting the prototype directly to production.** The variant code was written under prototype constraints (no tests, minimal error handling). Rewrite it properly when you fold it in.
- **A text or ASCII list of options as the hand-over, on the hand-built path.** The hand-over is the live variants and their captures. The terminal question of `<plugin>/references/procedures/design.md`, "The fallback of the pick", is no such list: it is the question channel of `impeccable`.
- **Variants before the list of states or before the research.** Step 1 and step 2 come first.
- **A list of states with a state that the change does not touch, or with no state that the change
  adds or changes.** The list is the rest state and each state that the change adds or changes
  ("The look decision"). The session asks no one to confirm it.
- **A direction question before the first variants.** The first `generate` round takes its direction from the research (`<plugin>/references/procedures/design.md`, "The pick").
- **A question for the pick before the user could use the variants, on the hand-built path.** The pick comes after the live opening and the captures.
- **A second pick after an `impeccable` lock or accept.** The lock or the accept is the pick.
- **A look that the session chose.** The maintainer picks each look. THE ROLL, a recommended variant, and an answer that the host gives by its own timeout are no pick.
- **A diagnosis that fixes.** The diagnosis changes no file of the product, and runs no "Apply" of the `layout` command ("The whole app").
- **A skeleton card that changes the visual world.** Each card of the whole app keeps the color, the type, and the components of `DESIGN.md`.
- **A question about the inventory.** The session takes the inventory from the code and `AGENTS.md` ("The whole app").
- **A capture on a branch.** The captures go on the issue as attachments.
- **A capture that shows a secret.** That state gets example data.
- **A capture comment with a `## ` first line.** Its first line is one of the plain lines of "Captures".
