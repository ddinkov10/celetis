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
    padding: "0 8px"
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
    width: "200px"
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
- Motion only for state: the beacon pulse, the working flow, and card moves. The one motion that
  is not a state is the fan of the agent order icons on hover and focus. All of it stops for
  reduced motion.

## Colors

The palette is a near-neutral grey scale with five signal colors that carry state, never
decoration.

### Primary

- **Beacon Orange** (`beacon-orange`): the color of "needs you". It marks the Needs you column
  glyph, the `need you` count, a waiting card's border and pulse, the current lane segment of a
  waiting or blocked card, the dot and the words of a human session at an unseen ended turn, and the
  orange dot of the tab icon. `beacon-tint` is the lighter
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
- **Card Slate** (`card-slate`): cards, the search palette, menus, the agent order list, toasts,
  and the active view tab.
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
Claude Code keeps its transparency. Add no tile background, border, or shadow. The one exception
is the agent order, where each icon sits on an 18px disc with a ring of the pill color. The icons
identify the agent only; state indicators and card treatments keep their existing meanings.

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

The sizes are set in `rem` on a 16px base, so the text follows the default font size of the browser.
The `px` values in this section are the sizes at that default.

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
- **Coordinator panel:** the right part of the work area at `minmax(0, 1.2fr)` beside the board at
  `minmax(340px, 0.8fr)`; in Now only Needs you stays beside it.
- **Pipeline:** one column for each stage of the flow, with horizontal scroll when needed.
- **Rhythm:** gaps of 6, 8, 10, and 14px. Cards stack with a 10px gap; parts inside a card with 8px.

Responsive steps:

- Below 1700px the search field collapses to its icon (without the key hint from 1280px), and
  Refresh keeps only its icon (its name stays), so the header row holds the widest state words of
  the control Coordinator. The header gap is 10px, and the folder name stops at 12ch with an
  ellipsis. The header still wraps to two rows from 1280px to 1380px, and at 1440px with a folder
  name of 17 or more characters. The maintainer accepted this compaction of the header parts (the
  search, Refresh, the 8px padding of a count chip, the folder name) and the remaining wrap on
  2026-11-13 (#288).
- Below 1100px Needs you takes the left half, Running and Idle share the right half, and the page
  scrolls as one document with a sticky header. The details and the coordinator panel (at most
  680px wide, with Float) cover the right side, and the control Coordinator hides its state words
  except `waits for your answer`. At a height of 700px or less the coordinator panel also covers
  the right side.
- At a height of 700px or less the page also scrolls as one document.
- Below 720px the columns stack, the details and the coordinator panel cover the whole page, and
  touch targets grow to 44px.
- Cards use container queries: below 360px card width the foot stacks and the agent name hides.

## Elevation & Depth

Depth comes from tonal layering, not from shadows. The page (Tower Night), the column (Console
Grey), and the card (Card Slate) are three steps of the same grey, each with a hairline border.
Shadows are small and have two jobs only.

### Shadow Vocabulary

- **Raise** (dark: `0 1px 0 rgba(255,255,255,0.035) inset, 0 1px 2px rgba(0,0,0,0.25)`): cards and
  the active view tab. It gives a surface a faint top edge, not a lift.
- **Float** (dark: `0 16px 40px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.08)`): only for
  layers above the page: the search palette, toasts, menus, and dialogs, the update dialog too.

### Named Rules

**The Two Shadows Rule.** A surface in the page uses Raise or nothing. Only a layer that floats
above the page uses Float. No other shadow exists.

**The Ring Not Glow Rule.** Selection and focus are rings: a 2px Current Blue outline with a 2px
offset for focus, and a 1px Ink Faint ring for the selected card. Never use a colored glow.

**The No Blur Rule.** The side panels and the header have no backdrop blur. Only the backdrop of a
modal dialog blurs the page, at 2px.

## Shapes

Corners are gently rounded and nest: an inner shape is smaller than its container. Surfaces use 16px
(columns, the details panel, the queue, the keys dialog), cards, toasts, and the update dialog 12px,
the palette 14px, controls 8px, the view switch 9px around 7px tabs, tags 6px, and small marks 5px.
Dots are full circles. Borders are always 1px hairlines. The start label draws each default value
with a dashed outline.

**The Nesting Rule.** A child radius is never larger than its parent radius. A 7px tab sits in a 9px
track; a 12px card sits in a 16px column.

## Components

### Buttons

Compact, quiet, and exact. A button reads as a tool, not as an invitation.

- **Shape:** gently rounded (8px), 28px high, 0 11px padding, Label type, 13px icon.
- **Primary:** an Ink fill with Ink On text. It is the main button of a card in Needs you. Hover
  lowers the opacity to 0.88.
- **Ghost:** a Veil fill, a hairline border, and Ink text. Hover moves to Veil Strong and the strong
  hairline. Each header button, New intake included, is a ghost button: the header has no Ink-filled
  button, because the Ink fill stays for the main button of a card.
- **Icon:** a 26px square with a 7px radius, transparent, Ink Faint; hover adds Veil Strong and Ink.
- **Head act:** the act button in a card head before More (Set aside, Stop). It is a 26px icon button
  with a 7px radius, Ink Faint, and a 13px icon. On hover and on keyboard focus it takes a Veil
  Strong fill, a hairline, and Ink, and its label (12px, 500) slides open in 0.2s. With no hover the
  label always shows, and with reduced motion it does not move. While the act waits, the button
  shows its busy label (`Setting aside`, `Stopping`) at 0.7 opacity with `cursor: not-allowed`.
- **States:** press scales to 0.97 in 0.1s. Busy shows a spinning icon and 0.7 opacity. Disabled
  is 0.42 opacity with `cursor: not-allowed`, and keeps its accessible reason.

### Chips

- **Count chip:** a 28px chip in the header with a 6px state dot and a bold Ink count. Only the
  `need you` chip has an outline; the chips `running`, `idle`, and `landed` have no outline and no
  fill. The `hot` variant of `need you`, used while something needs you, is 32px high and tints its
  fill and border with Beacon Orange.
- **Tag:** a 22px chip with a Veil fill for PR, checks, and review state. Check and review tags take
  an 8% tint and a 28–30% border of their state color.
- **Status pill:** a 24px minimum pill that wraps its text. The text is the state color mixed with
  Ink (30% Ink for blue and red, 20% for orange and amber) on the same tint, 4.5:1 in both themes.
- **Set-aside pill:** the status of a set-aside card. It has a 1px dashed strong hairline, a 999px
  radius, no fill, and 1px 7px 1px 5px padding. It holds a 12px pause icon, the text `set aside` in
  Ink at 600, and the step in Geist Mono.
- **Gate:** an 18px label. `auto` is Go Green on a 13% green tint. While auto mode is off or stopping, it reads `auto off` in Ink Muted text with a 1px dashed strong hairline and no fill. `manual` shows no gate label. In a narrow Pipeline card the step, the start label, and the gate wrap to the next line instead of clipping.
- **Start label:** an 18px Geist Mono capsule of two segments, the model and then the level. The
  model segment has the stronger fill. A pinned value has a pin icon, and a default value has a
  dashed outline in the text color, with no fill.

### Cards / Containers

- **Corner Style:** 12px.
- **Background:** Card Slate; Card Slate Hover on hover.
- **Shadow Strategy:** Raise (see Elevation & Depth).
- **Border:** a 1px hairline; the strong hairline on hover.
- **Internal Padding:** 12px 14px, with an 8px gap between rows.
- **More below:** the button at the foot of Needs you. It is full width and 34px high, with a Card
  Slate fill, a 1px strong hairline, an 8px radius, Raise, and Ink Muted text at 500, 12.5px. Hover
  moves to Ink text and a 60% Ink Faint border.
- **Waiting card:** a 55% Beacon Orange border, a 6% orange tint, and a slow pulse of the tint
  (3s). This card is the beacon of the tower.
- **Compact card:** a one-row variant for Idle, Pipeline, and the last two groups of Needs you. In
  Pipeline, the main button keeps its label, and a card that needs you has a 3px Beacon Orange inside
  left edge.
- **Start line:** one 12px line at full width under the meta of a compact card, and after the title of
  a full card. A slow start shows the progress line in Ink Muted after 5s; a failed start shows
  `Last start failed:` and its cause in Fault Red.
- **Human session item:** a 28px item in the Human sessions strip, a slim band of about 36px
  (2px block padding, 6px gap, an 11px label). At an ended turn that you have not seen, the item
  carries the quiet mark: the dot is Beacon Orange in place of Ink Muted, the state words
  `your turn` are Beacon Orange, and the title takes weight 600, with no tint, no border change, and
  no pulse. On a narrow width the state words shorten with an ellipsis before the title does. A seen ended turn keeps the Ink Muted dot and `turn ended`. A dialog item keeps its
  55% Beacon Orange border and its tint.
- **Epic group row:** a full-width button with a Veil fill, a 1px hairline, and a 12px radius; hover
  moves to Veil Strong and the strong hairline. It holds a 16px chevron (right closed, 90° down open,
  0.15s), the number in Geist Mono, the title that wraps in full, and the count. Open children sit
  beside a 1px strong left hairline, indented 12px. It uses no signal color.
- **History row:** an issue number in Geist Mono and Ink Faint, the title, the short commit and its
  time in Ink Faint, and one 28px icon control (44px on a phone) that holds the visual action in all
  its states; it names itself by `aria-label` and `title`. The open `History` button keeps a Veil
  Strong fill and a strong hairline.
- **Column:** Console Grey, a hairline border, a 16px radius, and a 46px head with a state glyph and
  a count.

### Inputs / Fields

- **Search field:** a 30px Veil field with a hairline border and an 8px radius in the header. It
  opens the palette.
- **Palette:** a 640px Card Slate dialog with a 14px radius and Float. Its input row is 52px high
  with 14.5px text and no visible outline; the caret is Current Blue.
- **Focus:** a 2px Current Blue outline with a 2px offset on every focusable element.

### Navigation

- **View switch:** a 30px Veil track with a 1px hairline, a 9px radius, and 24px tabs. The active
  tab is Card Slate with Raise and Ink text; an inactive tab is Ink Faint and turns Ink on hover. On
  a phone the tabs are 44px high with text labels and no icons, and the active tab also has a 2px
  Ink bottom edge.
- **Segmented control:** a group of buttons for one fixed choice, as the queue agent. The track is
  Veil with a 9px radius and 2px padding. A segment is 26px high (44px on a phone) with a 7px
  radius and 12.5px Ink Muted text; the pressed segment is Card Slate with Raise and Ink text and
  has `aria-pressed="true"`. A disabled segment is dimmed and keeps `aria-disabled="true"`.
- **Status bar:** 34px, 12px Ink Faint text, a top hairline. On a phone it has two rows: the read
  item (tracker name and state words) alone on the first row, and the other items, with the update
  control, on the second. Each item shows its words; only the daemon item hides.
- **Menu rows:** the run menu shows the icon of each agent in place of the run icon, and the agent
  that the card details name has a `Default` tag after its label: Ink Muted on Veil Strong, 11px,
  outside the label that can be cut. Level rows keep the run icon, and the current level the check.
  Each agent icon is 16px.
- **Menu:** on a phone it keeps 12px from each screen edge, wraps its labels, has rows of 44px or
  more, and shows no key hints. A coarse pointer shows no key hints at any width.
- **Update control:** a 24px status bar button (44px on a phone) whose label names the update
  state. Only **Update available** and **Restart needed**, the states that need you, take the
  accent: Beacon Orange text on a 10% Beacon Tint fill (13% on hover). Each other state is Ink
  Faint, as the other status bar buttons.
- **Agent order:** the status bar pill is a capsule 24px high (44px on a phone) with `0 8px`
  padding, a Veil fill, a 1px strong hairline, and Veil Strong on hover and while open. It stacks
  18px icon discs with a ring of the pill color; hover and keyboard focus fan the icons out. The
  list is Card Slate with Float and a 12px radius, and its rows show 18px discs. An excluded row
  keeps full opacity: a grayscale icon, the name in Ink Muted, and a 12px Ink Faint detail. The
  `First` badge is a Veil Strong fill with Ink Muted text, not a color.

- **Coordinator control:** a ghost header button after New intake: the message icon, the label
  `Coordinator`, a 7px state mark, and the state words in Ink Muted. The mark changes its shape
  with the state: an empty Ink Faint ring for no session, a Current Blue ring while it starts, a
  Current Blue dot while it works, an Ink Muted dot at an ended turn, and a Beacon Orange diamond
  while the host shows a dialog; then the button also takes a 10% Beacon Tint fill and a 45% Beacon
  Orange border, and the words turn Ink. A second 7px Ink dot with a soft ring marks an ended turn
  that the panel did not show. After a failed read the mark drops to 0.55 opacity and the words turn Ink Faint.
  Open, the button has Veil Strong and the strong hairline.

### Coordinator panel

A conversation column in a Console Grey side panel with a 1px strong hairline border and a 16px
radius, as the details panel.

- **Head:** 48px minimum, the title in Title type, the host in 11.5px Geist Mono Ink Faint, the
  state pill with its age, and text-style acts (Interrupt, End session, Go) and Close at the right.
  The pill is Current Blue on a 12% tint while it starts or works and Beacon Orange on a 12% tint
  for a dialog; its text takes the mix of the Status pill.
- **Lines:** the line of a failed read or an ended session sits under the head on Veil at 12.5px,
  and the log dims to 0.7. The line of the visible screen is 12px Ink Faint above the log, with a hairline under it.
- **Log:** Geist Mono at 12.5px on 1.7, Ink, in a column of at most 104ch with at least 20px of
  side padding, the white space of the terminal kept and long lines wrapped. `Go to the end` is a
  ghost button on Card Slate with Raise, centred 10px above the bottom edge.
- **Shell:** one raised shell at the foot, aligned to the 104ch column: Card Slate, the strong
  hairline, a 12px radius, and Raise. It holds the key row, the field (44px to 168px, no border,
  growing with its text), the hint (12px Ink Faint, Fault Red for an error), and Send (primary).
  The focus ring goes around the shell only while the field has the focus; an invalid field turns
  the border to 55% Fault Red.
- **Key row:** a 6% Beacon Tint band at the top of the shell with a 35% Beacon Orange bottom
  hairline. Each key is a key cap: 28px high, at least 32px wide, Veil, the strong hairline with a
  2px bottom edge, an 8px radius, and 12px Geist Mono. On a phone the keys fill four equal columns.
- **Phone:** below 720px the panel covers the page with no border and no radius, and each button,
  key, and icon button is 44px.

### Lane Track (signature)

A row of 14px × 6px segments with a 3px radius at the right of each card. Done steps are solid Ink
Faint; later steps are a 1px Ink Faint outline with no fill. The current step is 20px wide and takes
the state color: Ink when idle, a moving Current Blue flow (1.6s) while the agent works, Beacon
Orange when it waits or is blocked, Fault Red for no progress, and Caution Amber for a dirty tree.
A run that starts shows the current step as a 1.5px Current Blue outline. Each mark is at least 3:1
against the card in both themes, and the track keeps its `Step n of m` name.

### Update dialog

The update dialog is a short card: a nonmodal layer above the right end of the status bar, with
Float, Card Slate, a 1px hairline border, a 12px radius, 18px 18px 16px padding, and a width of
272px (at most the viewport less 24px). It says only what happens and the action: no revision
list and no note.

- **Title:** 14px at 600, Ink. One line below it is 12.5px Ink Faint at line height 1.5.
- **Lines of a state:** the busy line in Current Blue during a check, an update, or a restart; the
  error line in Fault Red and the recovery line in Ink Muted after a failure.
- **Actions:** a column of full-width buttons, 34px high, the Primary button first and a
  transparent secondary button with a hairline border (Ink Muted, Veil and Ink on hover) under it.
- **Phone:** below 720px the dialog keeps a 12px right inset, and the buttons are 44px high.

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
- **Do** stop all animation and transition under `prefers-reduced-motion: reduce`. The fan of the
  agent order, the one motion that is not a state, then moves with no transition.
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
