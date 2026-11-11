# Agent browser checks run in a background browser, and only the pick opens a window

## Date

2026-11-11

## Related

- [Issue #305](https://github.com/ddinkov10/celetis/issues/305): its body holds the spec, with the
  decisions of the maintainer of 2026-11-11.
- [ADR-0080](0080-a-look-decision-bypasses-the-page-csp-on-its-own-browser-tab.md): the CSP-bypass
  call and the pick tab.
- [ADR-0067](0067-component-research-binds-behavior-and-guides-looks.md): the maintainer installs
  the browser tools, and the session uses only its own browser. That rule stays in force.
- [ADR-0047](0047-skills-load-shared-procedures-on-demand.md): a shared procedure is a module, and
  host tool names stand only in the `Claude Code` and `Codex` parts.
- `plugins/celetis/references/procedures/browser.md`, `design.md`, `ui.md`, and
  `component-research.md` in the same folder; `plugins/celetis/README.md`, "Requirements".

## Supersedes

- [Component research binds behavior and guides looks](0067-component-research-binds-behavior-and-guides-looks.md),
  in part: the clause of its decision "The maintainer installs the research tools (decision B)"
  that names "a browser tool that opens a browser of its own". The browser of the research is now
  the background browser of the module `browser.md`. Its other clauses stand. The clause "Only the
  session's own browser" stands too: its text moved to `browser.md`, "The session's own browser".
- [A look decision bypasses the page CSP on its own browser tab](0080-a-look-decision-bypasses-the-page-csp-on-its-own-browser-tab.md),
  in part: first, the one headed Playwright MCP server of "One way, with no source edit" and "The
  tab rules". The pick and its sign-in use the window browser, and Assessment B and the call of
  "The check" use the background browser. Second, the clause of "The check and the stops" that runs
  the call once on a blank tab of that one server on the `generate` path: it now runs on a blank
  tab of the background browser, and the window browser gets no call before the pick. Third, the
  stop text "install or repair the Playwright MCP server with `--isolated`": the setup action
  names the missing browser. Fourth, "One agent at a time uses the server": it holds for each
  server. The call itself, its fixed text, the loopback rule, and the refusal stop stand.

## Context

Each Playwright check of a session opened a visible Google Chrome window on the screen of the
maintainer. The maintainer said: "when playwright is used in google chrome to find a way do it's
work without focusing the browser to the screen, to work in background is ok. what i don't want is
jumping screens while testing" (2026-11-11). The README asked for one Playwright MCP server with
`--isolated` and no `--headless`, so a Verify scenario, a capture, the component research, and the
design review all used a headed browser. The pick of `generate` needs a window, because the
maintainer clicks "accept" in the overlay (ADR-0080).

## Constraints and evidence

- **A visible Playwright Chrome is a front app.** At 13:42 local time on 2026-11-11, `lsappinfo
  front` named Google Chrome `type="Foreground"`, `(in front)`, with the parent `npm exec
  @playwright/mcp@latest --isolated` of another session and no `--headless`. Not established:
  whether the window took the focus by itself or a person clicked it.
- **The server options of `@playwright/mcp` 0.0.85.** `--headless` is an option of the server, and
  no tool argument sets the mode of one call. `--background` acts only with `--extension`, which
  drives the person's own Chrome.
- **The design probe of the spec** (2026-11-11, macOS 26.4.1, Chrome 157.0.8103.50, `--isolated
  --headless`). 0 of 143 samples of `lsappinfo front` had a process of the server as the front
  app. Its Chrome had `type="BackgroundOnly"`. The readout gave `[1440, 900]` and `[375, 812]`, the
  CSP-bypass call returned `"ok"`, and no headless Chrome stayed after `browser_close`. Limits: one
  Mac, one Chrome version, one MCP version. Linux, Windows, and a visible server were not probed.
- **The prior art** is one pattern: Playwright Test, Cypress, and Puppeteer run headless by
  default, and a window shows only when a person watches or acts.
- **The tool names of two servers** (P1, 2026-11-11, Claude Code 2.1.322, Codex CLI 0.167.0, with
  servers that only that run added, both headless). On Claude Code a tool is
  `mcp__<server name>__<tool>` with the server name as configured. On Codex the model sees
  `mcp__<server name>__<tool>` with each `-` of the name as `_`, for example
  `mcp__playwright_window__browser_tabs`, and an `mcp_tool_call` item names the server as
  configured. Two configured servers of the package give two separate tool sets.
- **The recipe of the README** (four commands for each host: remove `playwright`, remove
  `playwright-window`, add `playwright` with `--isolated --headless`, add `playwright-window` with
  `--isolated`) ran in private homes in three start states on both hosts: no server, the old
  `playwright` entry, and both entries. Each run gave the same end state, and the real host
  configuration did not change.

## Decision

The maintainer chose approach A on 2026-11-11, and then "no window before the pick".

- **Two roles.** `plugins/celetis/references/procedures/browser.md` names them. The background
  browser shows no window and does each agent check. Its named form is a Playwright MCP server with
  `--isolated` and `--headless`; a script with a headless browser counts too for a capture, and a
  remote browser tool of the host for rung 3 of the component research. The window browser is a
  Playwright MCP server with `--isolated` and no `--headless`. It does only the `generate` pick and
  its sign-in. A tool that shows a window (the window browser, the browser pane of the host) does no
  agent check. A server with `--extension`, `--cdp-endpoint`, or `--shared-browser-context` is
  neither role.
- **The role comes from the arguments.** Before its first call, each actor (a session, and each
  child that makes browser calls) reads the configuration of each server that runs
  `@playwright/mcp`, with any server name, as the host part says. A server whose mode the arguments
  do not show has no role. The names `playwright` and `playwright-window` of the README are a
  recommendation only.
- **One table of acts**, with its outcome when the browser is missing, in "The acts" of
  `browser.md`. Five rows use the background browser: a Verify scenario, the captures and the
  check of step 5 of `ui.md`, rung 3 of the component research, the two assessments of the design
  review, and the CSP-bypass call of "The check". The sixth row, the pick and its sign-in, uses the
  window browser. Each row keeps the outcome that its caller had.
- **No fallback.** No row falls back to the other browser, also when its own browser is missing.
  The `detect` scenario runs its own headless browser and is not in the table. A host with only the
  old `playwright` entry gets the missing outcome of each background row.
- **The sign-in rule.** An act of the background browser never asks the maintainer to sign in and
  never enters a credential. On a page that asks for a sign-in it closes the tab and takes the
  outcome of its row, with the cause. The only sign-in is the one of the pick, in the window
  browser.
- **No window before the pick.** "The check" of `design.md` runs the CSP-bypass call once on a
  blank tab of the background browser, and only reads the role of the window browser. The first
  call to the window browser comes at the pick, after the line `design: a Chrome window opens now for the pick.` When the pick ends, the session closes the window browser with `browser_close`.
- **The home.** The roles, the read, the table, and the rules of the session's own browser live in
  `browser.md`. `plan`, `implement`, the step text, `ui.md`, `design.md`, and `component-research.md`
  cite it, and the README tells the maintainer how to add the two servers on each host.

## Alternatives considered

- **B, one headless server only.** The pick moves to the default browser of the maintainer. On a
  page with a CSP the overlay does not load there, so the pick fails where ADR-0080 made it work.
  Rejected.
- **C, one visible server with use rules** (one tab, no tab select). A visible Playwright Chrome
  was the front app, so it does not meet the goal of no jumping screens. Rejected.
- **`--extension --background`**, the state of the art. It drives the maintainer's own running
  Chrome, and ADR-0067 says that the person's own signed-in browser is never the session's.
  Rejected.
- **A check script with the Playwright library.** Each product would need a Playwright package, and
  the design review would lose the MCP tools that `impeccable` uses. Rejected.

## Consequences

- A session runs each agent browser check with no window, and a Chrome window opens only at the
  pick and its sign-in. This holds for each row of "The acts" of `browser.md` but the sixth; the
  `detect` scenario was headless before.
- Each host needs a second server entry. A host with only the old `playwright` entry (no
  `--headless`), which both hosts of the maintainer had, gets the missing outcome of each row of the
  background browser until the maintainer runs the README commands.
- A host can accept the call on the background browser and refuse it on the window browser, for
  example through a permission rule that names the server. Then the look decision stops at the
  pick, after the prototype checkout exists. The maintainer accepted this cost.
- Both servers run `@playwright/mcp@latest` through npx, and each npx cache can resolve another
  version. The call of "The check" on the background browser does not prove the version of the
  window browser. A failed call at the pick is the stop of `generate`.
- The background browser closes after one hour with no completed call and loses its tabs. An act
  that waits longer opens its page again, as "The session's own browser" of `browser.md` says. A
  wait of an hour was not probed; the text rests on the option text of `@playwright/mcp` 0.0.85.
- The window at the pick can come to the front at its start and at each tab select. The
  maintainer accepted a window at the pick. The line before the first call tells the maintainer.
- The design probe has the limits of its evidence: one Mac, Chrome 157, MCP 0.0.85, no Linux or
  Windows, and no visible server.
- P1 is settled: the `Claude Code` and `Codex` parts of `browser.md` name the tool form of two
  servers, as observed on Claude Code 2.1.322 and Codex CLI 0.167.0.
- Limit of the Verify check on Codex (P3). A Codex child reads `~/.codex/config.toml`, which a
  `-c` override of the run does not change. So the Verify check on Codex covers only the missing
  case, run with `-c mcp_servers.playwright.enabled=false` for the maintainer's server, in the
  scenario V3 of the plan of #305. The case with a background browser on Codex rests on the reading
  checks of the module and on the P1 run. The runtime report of the Verify phase on issue #305
  states the result.
- No check changed the host configuration of the maintainer: the recipe ran in private homes, and
  `claude mcp get playwright` and `codex mcp list --json` were equal before and after.

## Reconsider when

- A Playwright MCP option keeps a headed browser behind other windows, so that one server can do
  both roles.
- A host gives each session a background browser of its own, so that no server entry is needed.
- The hosts show the arguments of the session's own servers to the agent in a form other than
  `claude mcp get` and `codex mcp list --json`, or stop showing them.
- `@playwright/mcp` makes `--background` work with no `--extension`, or sets the headless mode of
  one call.
