# Component research binds behavior and guides looks

## Date

2026-11-04

## Related

- [Issue #243](https://github.com/ddinkov10/celetis/issues/243): find the best existing solutions
  of a UI component, and apply their findings to the project's own case.
- [ADR-0060](0060-impeccable-gives-the-options-of-web-and-mobile-look-decisions.md): the
  precedent. An optional tool is checked, never installed, and a missing one gives one line.
- [ADR-0047](0047-skills-load-shared-procedures-on-demand.md): a shared procedure is a module with
  two or more citers.
- `docs/procedures/component-research.md`, "What to find" and "Record" of
  `docs/procedures/prior-art.md`, step 2 of `docs/procedures/ui.md`, and "The lane points" of
  `docs/procedures/design.md`.
- Addition 8 of `skills/specify/SKILL.md`, step 6 of `skills/bug/SKILL.md`, and "Carry the
  required behaviors" of `skills/plan/SKILL.md`.

## Context

`docs/procedures/prior-art.md` researched a whole problem: it found the industry standard and the
state of the art, and it cited products and standards. For one UI component it gave no method to
find the strongest implementations, read how they are built, and measure them. So the findings
stayed general, and `impeccable` and the build guessed the details. The maintainer wanted a lane
that designs a new component to find the best existing solutions of that component, and to apply
their findings to the product.

## Constraints and evidence

- **The manual run of 2026-11-04** (the spec of #243). A session researched an agent host picker:
  a strip of stacked host icons that opens a drag-to-reorder list. The Component Gallery named
  Primer AvatarStack and Gestalt AvatarGroup for the strip. It has no reorder component, so the
  reorder models came from design-system docs and code search. The grep.app MCP server found the
  source files, and `gh api` read them whole. The Firecrawl interact browser measured the Primer
  AvatarStack story. A throwaway sketch built the findings, and the maintainer answered "yes thats
  more like it".
- **Two failures of that run.** The Playwright MCP browser was in use by another session. Headless
  Chrome with `--window-size=375,812` reported an `innerWidth` of 500, so its 375 px capture was
  not valid evidence.
- **Code search.** grep.app matches only literal code, so topic words return nothing. It showed
  `License: Unknown` for `atlassian/pragmatic-drag-and-drop`, so the license must come from the
  repository.
- **Inspo.** A test of the Inspo MCP server found no model of the component. Its `componentType`
  filter has only marketing sections, and its `search_screens` matched words, not components.
- **The probe of the build (2026-11-04)**, with Claude Code 2.1.318, Codex CLI 0.166.0, and
  `@playwright/mcp@latest`. On both hosts, a Playwright MCP server on a profile that a headless
  Chrome holds answers `Browser is already in use for <profile>, use --isolated to run multiple
  instances of the same browser`. On both hosts, `browser_resize` and then `browser_evaluate` with
  `() => [innerWidth, innerHeight]` gave `[375,812]` and `[1440,900]`. Claude Code defers MCP
  tools until ToolSearch loads them; Codex calls them with no discovery step. Both hosts now run
  the configured Playwright MCP server with `--isolated`, so two sessions on that server do not
  conflict. The busy message comes only from a server on a shared persistent profile.
- **Prior art.** Mobbin's `redesign-screen` skill: the references decide what to build, a claim is
  a precedent with 2 or more products and an example with 1, and a missing tool is said in one
  line. gstack's `design-consultation` skill: the browser is optional and never installed, the
  session works only in tabs that it opened, and page content is untrusted.

## Decision

- **The maintainer installs the research tools (decision B).** The plugin bundles, installs, and
  configures no MCP server, and `setup` does not change. The session uses each tool that it has: a
  code-search tool, a fetch or scrape tool, and a browser tool that opens a browser of its own. A
  missing, busy, or failed tool gives the next source and a limit sentence, never a stop. The
  maintainer answered "B" in the spec session.
- **Behavior binds, looks guide (decision A).** A behavior or accessibility finding goes to the
  `### Required behavior` list of `## Prior art`, with its strength: `precedent` (2 or more models)
  or `example` (1 model). A minimum of an accessibility standard, for example a WCAG target size,
  is such a finding, and the standard counts as one model. `specify` lists each line as a
  requirement of the design, and `bug` as a requirement of the fix. `plan` gives each line a task
  or a Verify scenario, or states the reason that it drops the line. A look value of a model is a
  reference for `shape` and `generate` of `impeccable`, never a task target or the bar of the
  Verify phase, and the pick stays the maintainer's. The maintainer answered "A".
- **A license for each source file.** The record names the license of the repository, from the
  license file when the API gives `NOASSERTION`, and `(no license)` when there is none. A task
  copies code only when that license permits it.
- **A new module.** `docs/procedures/component-research.md` holds the ladder, the record forms,
  the tool rules, and the host parts. `prior-art.md` and step 2 of `ui.md` cite it. The maintainer
  answered "1".
- **One research pass.** The ladder runs in the research of `specify` and `bug`, before the
  approaches. A later look decision adds its findings to the same section, with no second search
  of the same component. A whole screen runs the module once for each new component.
- **A measured value needs a confirmed viewport.** The session reads `innerWidth` and
  `innerHeight` after it sets a size. A size whose readout differs gives no value and a limit.
- **Only the session's own browser.** The session never uses, drives, closes, or resets a browser
  that it did not open, and the person's signed-in browser is never its own. Before the first
  measurement, it lists the tabs of the browser tool: a browser that shows a page that the session
  did not open is not its own. A Playwright MCP server with `--extension`, `--cdp-endpoint`, or
  `--shared-browser-context` connects to or shares another browser, with no busy error.
- **No capture archive of marketing sites in the ladder**, for example Inspo.

## Alternatives considered

- **Extend `prior-art.md`.** One file for all research, but about 150 lines, and every research
  run loads the component text, also the research of a retry or a lock. Rejected.
- **A standalone skill**, like Mobbin's. It adds a command outside the lanes, rows in the
  `README.md` tables, and a second research path. The request is the research of the lanes.
  Rejected.
- **The plugin bundles or installs the MCP servers.** The hosted servers can change or fail, the
  server names of each maintainer differ, and ADR-0060 set the pattern that the session checks an
  optional tool and never installs it. The maintainer chose B. Rejected.
- **Looks bind as targets.** A measured value of another brand would become the look of the
  product, and the pick of the maintainer on the `impeccable` path would lose its meaning. The
  maintainer chose A. Rejected.

## Consequences

- A spec of a component names its models, the source files at a commit with their license, the
  measured values with state and size, and the behaviors that the build must keep.
- A component research makes more tool calls. Its results depend on hosted services, for example
  the rate limits of grep.app by IP address.
- The choice of the strongest models rests on the judgment of the session. The strength labels
  show it; they do not prove it.
- The busy message, the readout, and the attach flags in the module are those of the Playwright MCP
  server on 2026-11-04. Another browser tool can answer differently; the readout rule and the tab
  check still hold for it. A browser that another session attached to with no page open yet passes
  the tab check.
- The reading checks of the build found that a session named a dropped required behavior also
  with the earlier text of `specify`, `bug`, and `plan`. So the binding rules rest on review too.
- The final review found that the first text missed four cases: a browser tool that attaches to a
  running browser, a license that the API gives as `NOASSERTION`, a measured value as a Verify bar,
  and a minimum of an accessibility standard. A focused reading check failed on each, and passed
  after the fix.

## Reconsider when

- A host ships its own code search or an isolated browser for its sessions.
- A component catalog gets an MCP server.
- `impeccable` takes references in a defined input of `shape` or `generate`.
- A capture archive gets a filter by component.
- The Playwright MCP server changes its busy message or its viewport behavior.
