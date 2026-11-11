# The browser

The two browsers of a session, the read that gives a Playwright MCP server its role, the browser of
each act, and the rules of the session's own browser. `plan` and `implement` cite it at a browser
scenario of the Verify phase, the step text cites it for a sign-in, and the UI procedure, the
component research, and the design procedure cite it where they open a page.

## Contents

- **The two browsers:** the background browser, the window browser, and the tools that are
  neither.
- **The role of a server:** the read before the first call, and the role from the arguments.
- **The acts:** the browser of each act, its outcome when that browser is missing, and the setup
  actions.
- **A page behind a sign-in:** the outcome of each act of the background browser.
- **The session's own browser:** the tab list, the busy message, the attach flags, and the idle
  close.
- **Claude Code** and **Codex:** the read, the tool names, and the browsers that no act uses.

## The two browsers

Each browser is a browser of the session's own ("The session's own browser").

- **The background browser** shows no window on the screen of the maintainer. It does each agent
  check: each act of "The acts" but the `generate` pick and its sign-in. Its named form is a
  Playwright MCP server with `--isolated` and `--headless`. Two other tools count when they show no
  window: a script with a headless browser, for a capture of
  `<plugin>/references/procedures/ui.md`, "Captures", and a remote browser tool of the host, which
  runs its browser on another machine, for rung 3 of
  `<plugin>/references/procedures/component-research.md`, "The ladder". The CSP-bypass call of
  `<plugin>/references/procedures/design.md`, "The page CSP", and the design review need the named
  form, because they use `browser_run_code_unsafe` and the other tools of the Playwright MCP server.
- **The window browser** is a Playwright MCP server with `--isolated` and no `--headless`. It shows
  a window. It does only the `generate` pick of `<plugin>/references/procedures/design.md`, "The
  pick", and the sign-in for that pick ("A page behind a sign-in").

A tool that shows a window does no agent check: a Playwright MCP server with no `--headless`, and
the browser pane of the host. A server with `--extension`, `--cdp-endpoint`, or
`--shared-browser-context` is neither browser.

## The role of a server

Before an agent makes its first call to a Playwright MCP server, it reads the configuration of each
configured server that runs `@playwright/mcp`, with any server name, as the part of the host says.
The read starts no browser. The role of each server comes from its arguments:

- A server whose mode the arguments do not show has no role, and the agent does not use it: for
  example a mode in the environment of the server (`PLAYWRIGHT_MCP_HEADLESS`) or in a `--config`
  file.
- For each other server, `--headless` in the arguments makes the background browser, and no
  `--headless` makes the window browser.

When two servers have the same role, use one of them. Each actor reads the roles itself: a session,
and each child agent that makes browser calls. A brief that gives a browser act to a child cites
this file whole and names the row of the act in "The acts". The child makes no stop and no issue
act: it returns the outcome of its row, the cause, and the setup action or the page to the session
that gave it the act, and that session makes the stop or the report of the row.

The names `playwright` and `playwright-window` of `<plugin>/README.md`, "Requirements", are a
recommendation; the role comes only from the arguments. So a host with only an old `playwright`
entry with no `--headless` has a window browser and no background browser.

## The acts

A browser is missing when the read finds no server of its role. A busy or failed server gives the
same outcome.

| Act | Browser | When that browser is missing |
| --- | --- | --- |
| A Verify scenario in a browser, inline, in a step session, or in a child, also a browser check that the `AGENTS.md` of the product asks for | Background | The scenario cannot run and has no PASS: in a step session the stop of `<plugin>/references/procedures/stop.md`, "A Verify scenario that cannot run", else the report of the interactive session, with the setup action |
| The check of step 5 of `<plugin>/references/procedures/ui.md`, "The procedure", and a capture of its "Captures": the look capture, the capture repro, and the after-fix capture | Background | The tools check of "Captures" fails and stops the step with the setup action |
| Rung 3 of `<plugin>/references/procedures/component-research.md`, "The ladder" | Background | The next source of the rung, then a limit sentence |
| Assessment A and Assessment B of `<plugin>/references/procedures/design.md`, "The design review" | Background | The one line of `<plugin>/references/procedures/design.md`, "Missing", and the review goes on with the parts that need no Playwright browser |
| The CSP-bypass call of `<plugin>/references/procedures/design.md`, "The check", on the `generate` path | Background | The stop of `<plugin>/references/procedures/design.md`, "Missing" |
| The `generate` pick, and its sign-in | Window | At the check: the stop of `<plugin>/references/procedures/design.md`, "Missing". At the pick: the stop of `generate` in `<plugin>/references/procedures/design.md`, "The fallback of the pick" |

The capture row applies at the tools check of `<plugin>/references/procedures/ui.md`, "Captures".
At the after-fix capture of a Verify scenario, a missing background browser gives the Verify row.

No row falls back to the other browser, also when its own browser is missing. The `detect` scenario
runs its own headless browser of `impeccable` and is not in the table.

The setup action of a missing background browser is: add a Playwright MCP server with `--isolated`
and `--headless`. The setup action of a missing window browser is: add a Playwright MCP server with
`--isolated` and no `--headless`.

## A page behind a sign-in

An act of the background browser never asks the maintainer to sign in and never enters a
credential. On a page that asks for a sign-in, it closes the tab and takes the outcome of its row of
"The acts" for a missing browser, with the cause "the page asks for a sign-in":

- The stop of a Verify scenario names the page and the cause in place of a setup action. A Verify
  scenario that needs the maintainer's own signed-in account is a check by hand, as the sort rule
  of `plan` says ("the person's own signed-in account" goes to "After the landing").
- A check or a capture of the prototype (steps 5 and 7 of `<plugin>/references/procedures/ui.md`,
  "The procedure") stops with the cause and the setup action: give the prototype example data or a
  route that needs no sign-in. The cookies of a sign-in in the window browser do not reach the
  background browser.
- Assessment A closes its tab and returns its result from the source, with the cause and the URL of
  the tab.
- Assessment B closes its tab and returns the URL, as `<plugin>/references/procedures/design.md`,
  "The design review", says.
- Rung 3 gives the next source and a limit sentence.

The only sign-in of the maintainer is the one of the pick, in the window browser, as
`<plugin>/references/procedures/design.md`, "The page CSP", says.

## The session's own browser

Use, drive, close, or reset only a browser that the session opened. Before the first page of an
act, list the tabs of the browser, for example with `browser_tabs` of the Playwright MCP server. A
browser that shows a page that the session did not open, or that another browser holds, is not the
session's: make no further call to that tool, and take the outcome of the row of the act. That
outcome names the cause "the browser is not the session's", with the page or the busy message, in
place of a setup action. The person's own signed-in browser is never the session's.

On a profile that another browser holds, the Playwright MCP server answers `Browser is already in
use for <profile>, use --isolated to run multiple instances of the same browser`. With
`--isolated`, it keeps its profile in memory. With `--extension` or `--cdp-endpoint`, it connects
to a running browser, and with `--shared-browser-context`, it shares its pages with other clients.
Neither is the session's.

The background browser closes after one hour with no completed call, and loses its tabs. The next
call starts a new browser. So an act that waits more than one hour between two calls lists the tabs
again and opens its page again.

## Claude Code

- **The read.** `claude mcp list` prints one line for each server of each scope,
  `<name>: <command> <args> - <status>`, also for a project server that waits for approval.
  `claude mcp get <name>` prints the `Args:` and the `Environment:` of one server: run it for each
  server that runs `@playwright/mcp`.
- **The tools.** The tools of a server are `mcp__<name>__<tool>`, for example
  `mcp__playwright-window__browser_navigate`. They are deferred: load them with ToolSearch before
  the first call.
- Claude in Chrome drives the person's own Chrome, so no act uses it.

## Codex

- **The read.** `codex mcp list --json` prints the `transport.args` and the `transport.env` of each
  server.
- **The tools.** The tools of a server are `mcp__<name>__<tool>`, with each `-` of the name as `_`,
  for example `mcp__playwright_window__browser_tabs`. They are in the session with no discovery
  step. An `mcp_tool_call` item names the server as configured, for example `playwright-window`.
- An `mcp_tool_call` of a Playwright MCP server that fails or does not complete is a busy or failed
  server: the act takes the outcome of its row of "The acts".
- The `chrome` plugin drives the person's own Chrome, so no act uses it.
