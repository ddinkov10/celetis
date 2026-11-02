# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

The primary user is one maintainer who runs Celetis on a repository. They keep the agent board open
all day on a desktop, beside the Herdr app tabs where the agent sessions run. They watch several
sessions at once and act when a card needs them: they answer a waiting agent, start a step at a
`me` gate, recover a stuck step, or open a new intake.

The board is for one person and one repository at a time. Each product maintainer who adopts the
plugin runs their own board on their own repository.

## Product Purpose

Celetis is a general agent harness for Claude Code and Codex. It takes a request from free text to
a change on the trunk through one GitHub issue: the intent, the lane, the spec, the plan, the
build, and the landing. The issue is the state store: each result goes onto the issue, and each
hand-off reads the issue again.

The agent board (`engine/board/`) is the only visual surface. It shows each live agent session and
each issue of the flow of one repository, and it starts a step of an issue with one press. Success
means the maintainer sees at once what needs them, acts in one press, and never loses track of an
agent that waits.

## Positioning

- The GitHub issue is the single state store. No step keeps state that the next step cannot read
  from the issue.
- One copy of the skills and procedures serves both Claude Code and Codex.
- The plugin names roles, not parts of a product. A product project keeps its own facts in its
  `AGENTS.md` and `.celetis.yaml`.
- On the board, no card moves by hand. The flow and the runner place each card, and the board
  starts no step by itself.

## Operating Context

- The board is a local page that `celetis --agent <host> board` serves from the main checkout. The
  port comes from `PORT`, else `board.port` in `.celetis.yaml`, else 4403.
- Sessions come from herdr-core (`hc`). The Herdr app shows the agent terminals as tabs. Issues come
  from `gh`.
- The work is a set of lanes (`bug`, `feature`, `chore`, `hotfix`) with ordered steps. A gate says
  who starts a step: `me` (a press of Run) or `auto` (the automatic runner).
- The maintainer works mostly on macOS. The board is checked in Chromium browsers only.
- Each board UI change is checked at desktop width and at 375×812.

## Capabilities and Constraints

- The board has two views, Now (Needs you, Running, Idle) and Pipeline (one column for each stage),
  plus Queue, History, Search, and a details panel. `engine/board/README.md`, "The layout, the
  keys, and the errors", is the design document and the source of truth for behavior and copy.
- The board holds nothing of one repository: the lanes, steps, stages, and tracker name come from
  the data document. Only the folder name of the main checkout identifies the repository.
- The board loads nothing from the network. It carries its own fonts and has no dependency of its
  own.
- `engine/board/server.ts` and the fixed adapter `engine/board/adapter.ts` are trust boundaries.
  UI work must not widen them, including the Content-Security-Policy.
- Browser sources are TypeScript. `scripts/build.ts` generates the browser `.js` and `.mjs` files.
  Product repositories run no build.
- `scripts/verify.ts` is the only check of this repository. The repository adds no test file.
- Full keyboard use is part of the product: single-key shortcuts, `⌘K` search, and card focus
  rules.

## Brand Commitments

- The name is `celetis` in code and commands, and Celetis in prose.
- Text uses plain, literal, short sentences in the style of ASD-STE100 Simplified Technical
  English. UI copy states facts and causes: for example `No issue needs you` and
  `The board read failed. The cards and history show the last good read.`
- The board stays neutral so it fits any product repository. It follows the light or dark theme
  of the OS.

## Evidence on Hand

- `README.md`: the product, the requirements, the commands, and the update rule.
- `engine/board/README.md`: the full board specification, including the layout, keys, errors, and
  trust boundary.
- `docs/celetis-flow.md`: the runner, the board requirements, and the acceptance status of each
  host.
- `docs/adr/`: the architecture decisions, for example ADR-0020, ADR-0035, and ADR-0058 for the
  board.
- `engine/board/fonts/`: Geist and Geist Mono with `OFL.txt`.

The repository is private and has no deployment, public site, customers, testimonials, pricing, or
usage metrics. Future work must not invent them.

## Product Principles

- Show what needs the human first. An agent that waits must never go unseen.
- One press does one thing. Each press says what happened, and a failed press names its cause.
- Never hide the state. The last good read stays on screen when a read fails, with the cause.
- The board reflects the flow; it does not own it. The issue and the runner stay the authority.
- Stay general. Nothing on the board names a part of one product.

## Accessibility & Inclusion

- WCAG 2.2 AA is the required standard.
- Every action works from the keyboard, and focus never jumps away from the maintainer's work.
- A screen reader hears each card that enters Needs you, each start, each alert, and each toast.
- The page shows no motion when the OS asks for reduced motion.
