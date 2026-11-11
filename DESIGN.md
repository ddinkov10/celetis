---
name: Celetis Agent Board
description: A local control tower for the agent sessions and issues of one repository.
colors:
  beacon-orange: "#ff7a45"
  beacon-tint: "#ff7a45"
  current-blue: "#5ea2ff"
  go-green: "#3dd68c"
  fault-red: "#ff6170"
  caution-amber: "#f5b13d"
  tower-night: "#0d0d0f"
  console-grey: "#121215"
  card-slate: "#19191d"
  card-slate-hover: "#1d1d22"
  veil: "rgba(255, 255, 255, 0.05)"
  veil-strong: "rgba(255, 255, 255, 0.085)"
  hairline: "rgba(255, 255, 255, 0.07)"
  hairline-strong: "rgba(255, 255, 255, 0.13)"
  ink: "#ededf0"
  ink-muted: "#a6a6af"
  ink-faint: "#8d8d97"
  ink-on: "#111114"
  selection: "rgba(94, 162, 255, 0.3)"
  beacon-orange-light: "#a93a09"
  beacon-tint-light: "#f08a3c"
  current-blue-light: "#1d64e0"
  go-green-light: "#106934"
  fault-red-light: "#cf2637"
  caution-amber-light: "#8f5300"
  tower-day: "#f7f7f8"
  console-grey-light: "#efeff2"
  card-slate-light: "#ffffff"
  card-slate-hover-light: "#fcfcfd"
  veil-light: "rgba(0, 0, 0, 0.04)"
  veil-strong-light: "rgba(0, 0, 0, 0.07)"
  hairline-light: "rgba(0, 0, 0, 0.08)"
  hairline-strong-light: "rgba(0, 0, 0, 0.15)"
  ink-light: "#17171a"
  ink-muted-light: "#53535c"
  ink-faint-light: "#62626b"
  ink-on-light: "#ffffff"
  selection-light: "rgba(29, 100, 224, 0.16)"
typography:
  headline:
    fontFamily: "Geist, Segoe UI, system-ui, sans-serif"
    fontSize: "16.5px"
    fontWeight: 600
    lineHeight: 1.4
  title:
    fontFamily: "Geist, Segoe UI, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 600
    lineHeight: 1.38
    letterSpacing: "-0.012em"
  body:
    fontFamily: "Geist, Segoe UI, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Geist, Segoe UI, system-ui, sans-serif"
    fontSize: "12.5px"
    fontWeight: 500
    lineHeight: 1
  label-caps:
    fontFamily: "Geist, Segoe UI, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "0.07em"
  mono:
    fontFamily: "Geist Mono, ui-monospace, SFMono-Regular, Menlo, monospace"
    fontSize: "11.5px"
    fontWeight: 400
    lineHeight: 1
rounded:
  xs: "5px"
  sm: "6px"
  inner: "7px"
  md: "8px"
  capsule: "9px"
  lg: "12px"
  xl: "14px"
  surface: "16px"
  full: "50%"
spacing:
  hair: "2px"
  xs: "4px"
  sm: "6px"
  md: "8px"
  md-plus: "10px"
  lg: "12px"
  column-gap: "14px"
  xl: "16px"
  gutter-min: "20px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.ink-on}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "0 11px"
    height: "28px"
  button-ghost:
    backgroundColor: "{colors.veil}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "0 11px"
    height: "28px"
  button-ghost-hover:
    backgroundColor: "{colors.veil-strong}"
  button-icon:
    backgroundColor: "transparent"
    textColor: "{colors.ink-faint}"
    rounded: "{rounded.inner}"
    size: "26px"
  button-icon-hover:
    backgroundColor: "{colors.veil-strong}"
    textColor: "{colors.ink}"
  view-switch:
    backgroundColor: "{colors.veil}"
    rounded: "{rounded.capsule}"
    padding: "2px"
    height: "30px"
  view-switch-active:
    backgroundColor: "{colors.card-slate}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.inner}"
    height: "24px"
  count-chip:
    backgroundColor: "transparent"
    textColor: "{colors.ink-muted}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "0 10px"
    height: "28px"
  count-chip-hot:
    backgroundColor: "color-mix(in srgb, #ff7a45 10%, transparent)"
    textColor: "{colors.ink}"
  search-field:
    backgroundColor: "{colors.veil}"
    textColor: "{colors.ink-faint}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "0 5px 0 10px"
    height: "30px"
    width: "250px"
  tag:
    backgroundColor: "{colors.veil}"
    textColor: "{colors.ink-muted}"
    rounded: "{rounded.sm}"
    padding: "0 8px 0 6px"
    height: "22px"
  gate-auto:
    backgroundColor: "color-mix(in srgb, #3dd68c 13%, transparent)"
    textColor: "{colors.go-green}"
    rounded: "{rounded.xs}"
    padding: "0 6px"
    height: "18px"
  effort-chip:
    backgroundColor: "transparent"
    textColor: "{colors.ink-muted}"
    rounded: "{rounded.capsule}"
    padding: "0 6px"
    height: "18px"
  column:
    backgroundColor: "{colors.console-grey}"
    rounded: "{rounded.surface}"
  card:
    backgroundColor: "{colors.card-slate}"
    textColor: "{colors.ink-muted}"
    rounded: "{rounded.lg}"
    padding: "12px 14px"
  card-hover:
    backgroundColor: "{colors.card-slate-hover}"
  card-waits:
    backgroundColor: "color-mix(in srgb, #ff7a45 6%, #19191d)"
  palette:
    backgroundColor: "{colors.card-slate}"
    textColor: "{colors.ink-muted}"
    rounded: "{rounded.xl}"
    width: "min(640px, calc(100vw - 32px))"
  toast:
    backgroundColor: "{colors.card-slate}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.lg}"
    padding: "10px 8px 10px 12px"
---

# Design System: Celetis Agent Board

## Overview

**Creative North Star: "The Control Tower"**

The board is a watch post over many agents at once. From one seat, the maintainer sees every
session and every issue of one repository, and the one thing that needs them stands out from the
rest. The tower is quiet at rest: the surface is near-neutral grey and the furniture recedes. Color
appears as a state signal or in the selected agent icons. Each state signal has one meaning.

The mood is calm, precise, and utilitarian. The density is high but ordered: small type (13px
body), tight controls (28px), and a strict three-column field. The page must read at a glance after
hours of use, so it uses no decorative graphics. It is never a marketing dashboard: no decorative
gradients, no charts, no hero graphics. The board shows nothing of one product. Only the folder
name of the checkout appears in the header, so the same look fits any repository.

The board follows the light or dark theme of the OS. Dark is the base definition, and light
redefines every color token. It loads nothing from the network and carries its own two fonts.

**Key Characteristics:**

- Neutral grey surfaces in three tonal layers: page, column, card.
- Five state colors, each with one meaning, used only for state.
- Fixed vendor colors in Codex and Claude Code icons identify the agent, not its state.
- Hairline borders and translucent fills instead of heavy shadows.
- Geist for words and Geist Mono for numbers, paths, and identifiers.
- Small, dense, keyboard-first controls with a visible focus ring.
- Motion only for state: the beacon pulse, the working flow, and card moves. All of it stops for
  reduced motion.

## Colors

The palette is a near-neutral grey scale with five signal colors that carry state, never
decoration.

### Primary

- **Beacon Orange** (`beacon-orange`): the color of "needs you". It marks the Needs you column
  glyph, the `need you` count, a waiting card's border and pulse, the current lane segment of a
  waiting or blocked card, and the orange dot of the tab icon. `beacon-tint` is the lighter
  partner that tints the backgrounds of waiting cards and act lines. Light theme: `beacon-orange-light`
  for text and marks, `beacon-tint-light` for tints.

### Secondary

- **Current Blue** (`current-blue`): the color of work in progress and of focus. It marks a working
  card's status, the moving flow in its lane segment, the spinner of a starting card, the blue tab
  dot, the focus ring, the text caret, and the selection tint. Light theme: `current-blue-light`.

### Tertiary

- **Go Green** (`go-green`): ready and passed. It marks the `auto` gate, passing checks, approved
  reviews, and the landed-history dot. Light theme: `go-green-light`.
- **Fault Red** (`fault-red`): failure. It marks `no progress`, failing checks, and danger pills.
  Light theme: `fault-red-light`.
- **Caution Amber** (`caution-amber`): a dirty worktree and requested changes. Light theme:
  `caution-amber-light`.

### Neutral

- **Tower Night** (`tower-night`): the page background. Light theme: **Tower Day** (`tower-day`).
- **Console Grey** (`console-grey`): columns, the details panel, and sticky group labels.
- **Card Slate** (`card-slate`): cards, the search palette, toasts, and the active view tab.
  `card-slate-hover` is its hover step.
- **Veil** (`veil`, `veil-strong`): translucent fills for ghost buttons, tags, the search field, and
  hover states.
- **Hairline** (`hairline`, `hairline-strong`): 1px borders. The strong step is for hover, the
  details panel, and scrollbars.
- **Ink** (`ink`): titles, the brand, and the primary button fill. **Ink Muted** (`ink-muted`) is the
  body text color. **Ink Faint** (`ink-faint`) is for metadata, labels, and idle icons. **Ink On**
  (`ink-on`) is text on an Ink fill.

### Named Rules

**The One Meaning Rule.** Each signal color has one meaning: orange needs you, blue works, green is
ready or passed, red failed, amber is a dirty tree. Never use a signal color for decoration or
emphasis. The selected Codex and Claude Code icons are the only vendor-color exception: retain
their original colors and proportions at 18×18 px in both themes. Codex keeps its white background;
Claude Code keeps its transparency. Add no tile background, border, or shadow. The icons identify
the agent only; state indicators and card treatments keep their existing meanings.

**The Ink Action Rule.** The primary button is filled with Ink, not with a signal color. A filled
button means "the main action of this card", not a state.

**The Tint Not Fill Rule.** A state reaches a surface only as a `color-mix` tint (6–13% for
backgrounds, 22–55% for borders) over the neutral layer. Never fill a card or chip with a solid
signal color.

## Typography

**Body Font:** Geist (with Segoe UI, system-ui, sans-serif)
**Label/Mono Font:** Geist Mono (with ui-monospace, SFMono-Regular, Menlo, monospace)

**Character:** Geist is a neutral, engineered sans that stays legible at 11–14px. Geist Mono marks
anything a machine wrote: issue numbers, PR numbers, SHAs, paths, commands, effort levels, and line
deltas.

### Hierarchy

- **Headline** (600, 16.5px, 1.4): the title in the details panel. It is the largest text in normal
  use.
- **Title** (600, 14px, 1.38, -0.012em): card titles, clamped to two lines. The brand name uses the
  same size and weight at line height 1.
- **Body** (400, 13px, 1.5): the base text of the page, toasts, and act lines (12px).
- **Label** (500, 12.5px, 1): buttons, the view switch, count chips, and the search field.
- **Label Caps** (600, 11px, 0.07em, uppercase): group labels in Needs you, such as "Waits for your
  answer".
- **Mono** (400, 11.5px, 1): the card head (number, type, and agent) and code act lines.

### Named Rules

**The Machine Text Rule.** Text that a machine wrote, or that a person copies (a number, a path, a
command), is set in Geist Mono. Text written for a person to read is set in Geist.

**The Four Weights Rule.** Use 400 for reading, 500 for controls, and 600 for titles and labels.
Do not add a weight above 600 for emphasis; use Ink color instead.

## Layout

The page is one full-height application frame: a header (56px minimum), an optional Human sessions
strip, the work area, and a 34px status bar. The page itself does not scroll on a desktop; each
column scrolls inside itself, with a soft fade mask at its top and bottom edges.

- **Gutter:** `max(20px, calc((100% - 1640px) / 2))`. The content caps at 1640px and centers.
- **Now:** three columns with a 14px gap. Needs you is the widest (`minmax(380px, 1.3fr)`), then
  Running (`1fr`) and Idle (`0.95fr`). When nothing needs you, the three columns are equal.
- **Details:** the panel opens at the right at `clamp(360px, 32vw, 452px)` and replaces Idle.
- **Pipeline:** one column for each stage of the flow, with horizontal scroll when needed.
- **Rhythm:** gaps of 6, 8, 10, and 14px. Cards stack with a 10px gap; parts inside a card with 8px.

Responsive steps:

- Below 1600px the search field collapses to its icon.
- Below 1100px Needs you takes the left half, Running and Idle share the right half, and the page
  scrolls as one document with a sticky header. The details cover the right side.
- At a height of 700px or less the page also scrolls as one document.
- Below 720px the columns stack, the details cover the whole page, and touch targets grow to 44px.
- Cards use container queries: below 360px card width the foot stacks and the agent name hides.

## Elevation & Depth

Depth comes from tonal layering, not from shadows. The page (Tower Night), the column (Console
Grey), and the card (Card Slate) are three steps of the same grey, each with a hairline border.
Shadows are small and have two jobs only.

### Shadow Vocabulary

- **Raise** (dark: `0 1px 0 rgba(255,255,255,0.035) inset, 0 1px 2px rgba(0,0,0,0.25)`): cards and
  the active view tab. It gives a surface a faint top edge, not a lift.
- **Float** (dark: `0 16px 40px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.08)`): only for
  layers above the page: the search palette, toasts, menus, and dialogs. The update dialog is the
  exception: it is Flat, with no shadow ("Update dialog").

### Named Rules

**The Two Shadows Rule.** A surface in the page uses Raise or nothing. Only a layer that floats
above the page uses Float. No other shadow exists.

**The Ring Not Glow Rule.** Selection and focus are rings: a 2px Current Blue outline with a 2px
offset for focus, and a 1px Ink Faint ring for the selected card. Never use a colored glow.

## Shapes

Corners are gently rounded and nest: an inner shape is smaller than its container. Surfaces use
16px (columns, the details panel), cards and toasts 12px, the palette 14px, the update dialog
10px, controls 8px, the view
switch 9px around 7px tabs, tags 6px, and small marks 5px. Dots are full circles. Borders are always
1px hairlines. The start label draws each default value with a dashed outline.

**The Nesting Rule.** A child radius is never larger than its parent radius. A 7px tab sits in a 9px
track; a 12px card sits in a 16px column.

## Components

### Buttons

Compact, quiet, and exact. A button reads as a tool, not as an invitation.

- **Shape:** gently rounded (8px), 28px high, 0 11px padding, Label type, 13px icon.
- **Primary:** an Ink fill with Ink On text. It is the main button of a card in Needs you. Hover
  lowers the opacity to 0.88.
- **Ghost:** a Veil fill, a hairline border, and Ink text. Hover moves to Veil Strong and the strong
  hairline.
- **Icon:** a 26px square with a 7px radius, transparent, Ink Faint; hover adds Veil Strong and Ink.
- **States:** press scales to 0.97 in 0.1s. Busy shows a spinning icon and 0.7 opacity. Disabled
  is 0.42 opacity with `cursor: not-allowed`, and keeps its accessible reason.

### Chips

- **Count chip:** a 28px outlined chip in the header with a 6px state dot and a bold Ink count. The
  `hot` variant, used while something needs you, tints its fill and border with Beacon Orange.
- **Tag:** a 22px chip with a Veil fill for PR, checks, and review state. Check and review tags take
  an 8% tint and a 28–30% border of their state color.
- **Gate:** an 18px label. `auto` is Go Green on a 13% green tint; `manual` shows no gate label.
- **Start label:** an 18px Geist Mono capsule of two segments, the model and then the level. The
  model segment has the stronger fill. A pinned value has a pin icon, and a default value has a
  dashed outline in the text color, with no fill.

### Cards / Containers

- **Corner Style:** 12px.
- **Background:** Card Slate; Card Slate Hover on hover.
- **Shadow Strategy:** Raise (see Elevation & Depth).
- **Border:** a 1px hairline; the strong hairline on hover.
- **Internal Padding:** 12px 14px, with an 8px gap between rows.
- **Waiting card:** a 55% Beacon Orange border, a 6% orange tint, and a slow pulse of the tint
  (3s). This card is the beacon of the tower.
- **Compact card:** a one-row variant for Idle, Pipeline, and the last two groups of Needs you.
- **Epic group row:** a full-width button with a Veil fill, a 1px hairline, and a 12px radius; hover
  moves to Veil Strong and the strong hairline. It holds a 16px chevron (right closed, 90° down open,
  0.15s), the number in Geist Mono, the title that wraps in full, and the count. Open children sit
  beside a 1px strong left hairline, indented 12px. It uses no signal color.
- **Column:** Console Grey, a hairline border, a 16px radius, and a 46px head with a state glyph and
  a count.

### Inputs / Fields

- **Search field:** a 30px Veil field with a hairline border and an 8px radius in the header. It
  opens the palette.
- **Palette:** a 640px Card Slate dialog with a 14px radius and Float. Its input row is 52px high
  with 14.5px text and no visible outline; the caret is Current Blue.
- **Focus:** a 2px Current Blue outline with a 2px offset on every focusable element.

### Navigation

- **View switch:** a 30px Veil track with a 9px radius and 24px tabs. The active tab is Card Slate
  with Raise and Ink text; an inactive tab is Ink Faint and turns Ink on hover.
- **Status bar:** 34px, 12px Ink Faint text, a top hairline. It wraps on a phone and keeps the
  update control.
- **Update control:** a 24px status bar button (44px on a phone) whose label names the update
  state. Only **Update available** and **Restart needed**, the states that need you, take the
  accent: Beacon Orange text on a 10% Beacon Tint fill (13% on hover). Each other state is Ink
  Faint, as the other status bar buttons.

### Lane Track (signature)

A row of 14px × 4px segments with a 2px radius at the right of each card. Done steps are Ink Faint
at 80%; later steps are Ink Faint at 28%. The current step is 20px wide and takes the state color:
Ink when idle, a moving Current Blue flow (1.6s) while the agent works, Beacon Orange when it waits
or is blocked, Fault Red for no progress, and Caution Amber for a dirty tree.

### Update dialog

The update dialog is Flat: a nonmodal layer above the right end of the status bar, with no
shadow, the Console Grey panel color, a 1px strong hairline border, a 10px radius, 16px padding,
and a width of 340px (at most the viewport less 24px).

- **Title:** 13px at 600, Ink. The description below it is 13px Ink Muted at line height 1.5.
- **Revisions:** label–value rows in a two-column grid: an Ink Faint label (12px) and an 11.5px
  Geist Mono value in Ink Muted, for example `Daemon` and `Installed`.
- **Action row:** under a hairline. The note sits at the left in 12px Ink Faint. A text-style
  secondary button (transparent, Ink Faint, Ink on hover) and a ghost main button (Veil fill, the
  strong hairline, Ink) sit at the right, each 28px high.
- **Phone:** below 720px the dialog keeps a 12px right inset, the note stacks above the buttons,
  and the two buttons share the row at 44px high.

### Toast

A Card Slate layer with Float, a 12px radius, and Body type, fixed 48px above the bottom center. It
rises in over 0.24s. It names the failed press above the server line.

## Do's and Don'ts

### Do:

- **Do** keep every surface neutral grey and reserve color for state and the selected agent icons,
  per the One Meaning Rule.
- **Do** tint a state onto a surface with `color-mix` (6–13% fill, 22–55% border).
- **Do** set numbers, SHAs, paths, commands, and effort levels in Geist Mono.
- **Do** define every new color for both themes: the dark base and the light variant.
- **Do** use the existing ease `cubic-bezier(0.2, 0.8, 0.2, 1)` for entrances and 0.15s for color
  and border transitions.
- **Do** stop all animation and transition under `prefers-reduced-motion: reduce`.
- **Do** check every change at desktop width and at 375×812 in Chromium.

### Don't:

- **Don't** add decorative gradients, charts, illustrations, or hero graphics. The board is not a
  marketing dashboard.
- **Don't** fill a button or a card with a solid signal color.
- **Don't** add a shadow other than Raise and Float.
- **Don't** load a font, an icon, or a script from the network.
- **Don't** show a repository product's brand, logo, or colors; only the folder name identifies
  the repository. The selected agent icons identify hosts, not the repository product.
- **Don't** use a colored glow for focus or selection; use a ring.
