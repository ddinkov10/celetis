# A look decision bypasses the page CSP on its own browser tab

## Date

2026-11-08

## Related

- [Issue #277](https://github.com/ddinkov10/celetis/issues/277): handle the gaps of the UI proposal
  prototypes. Its first gap is the Content-Security-Policy of the product page.
- [ADR-0060](0060-impeccable-gives-the-options-of-web-and-mobile-look-decisions.md): `impeccable`
  gives the options, and a browser pick is a question in the terminal. The pick in the overlay of
  the Playwright window keeps that question.
- [ADR-0067](0067-component-research-binds-behavior-and-guides-looks.md): the maintainer installs
  the browser tool, and the plugin installs and configures no MCP server.
- [ADR-0047](0047-skills-load-shared-procedures-on-demand.md): host tool names only in the
  `Claude Code` and `Codex` parts of a module. The Playwright MCP server, which both hosts run,
  stands in the body.
- `docs/procedures/design.md`, "The page CSP", "The check", "Missing", "The pick", and "The design
  review"; `docs/procedures/ui.md`, "Captures"; `docs/procedures/component-research.md`, "A
  missing, busy, or failed tool".

## Context

A look decision puts code of `impeccable` into the product page: the overlay of `generate` loads
`live.js` from the helper at `http://localhost:8400`, connects to it, and mounts variants with
inline styles. The design review injects `detect.js` in Assessment B of `critique`. A product CSP
such as `script-src 'self'; style-src 'self'; connect-src 'self'` blocks each of these. The
maintainer said: "the session always has said that CDP is blocking something and it attemps some
workaround" (2026-11-07; the word in the sessions was CSP). Each session tried a workaround of its
own, and the text gave no rule.

## Constraints and evidence

- **The past sessions** (read on 2026-11-07 for the spec of #277). `detect-csp` of `impeccable`
  returned `{"shape": null, "signals": []}` for the board in `0d64a7c6`, `94028fd7`, and Codex
  `01a1a5ca`: it does not see a CSP that server code sends as a response header. The workarounds
  were a consent question "Apply it? [y/n]" (`94028fd7`, #250), a frozen static copy of the page
  (`0d64a7c6`, #235), a proxy that rewrote the CSP header (Codex `01a1a5ca`, #236),
  `Page.setBypassCSP` through `newCDPSession` in its own tab (`2e2c628d`, #204), variants by hand
  (Codex `01a1a156`, #191), and no overlay with CLI scans only (Codex `01a1abce`, #245). In #250
  the overlay worked only after three allowances in the CSP of the prototype checkout.
- **`impeccable` 4.8.0.** Live setup patches a CSP source that `detect-csp` finds, after a consent
  question, and asks for a manual edit of a CSP in middleware or a meta tag. It skips that section
  when `.impeccable/live/config.json` holds `cspChecked: true`. `live.md` says "Do not disable
  browser security or weaken production CSP to enable live mode."
- **The design probe of the spec** (2026-11-07, Claude Code 2.1.319, Playwright MCP
  `@latest --isolated`). After `Page.setBypassCSP {enabled: true}` through `newCDPSession` on one
  tab, an outside script and an inline style ran on a page with a strict header CSP, also after a
  reload that the page started and after a `browser_navigate` on the same tab. A new tab kept the
  CSP.
- **The probe of the build** (2026-11-08, Task 3 of #277; Claude Code 2.1.319, Codex CLI 0.166.0,
  `@playwright/mcp` 0.0.84, `impeccable` 4.8.0). On a fixture with the header CSP
  `default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self'`,
  this order connected the real overlay: a new blank tab, the call, `impeccable live
  --allow-missing-context` (with the whole config and `cspChecked: true` on `config_missing`),
  `browser_navigate`, then `live-generate --boot --wait-for-browser 60000`. It printed `ok: true`,
  a session id, and a `generate` event. A plain tab on the same URL showed the CSP refusal of
  `live.js`, and `live-server stop` left no `live.js` tag. With no `DESIGN.md`, `impeccable live`
  stops with `context_missing` unless it gets `--allow-missing-context`. Codex ran the call with
  its existing approval policy (`on-request`, `auto_review`) and asked nothing; its bypassed tab
  ran the outside script once, and its plain tab did not.
- **The premises of the build** (2026-11-08). The bypass also covers a page whose CSP is only in a
  `<meta http-equiv="Content-Security-Policy">` tag. A tab with no call signed in, and a later
  bypassed tab sent its cookie, so the tabs of the default context of `--isolated` share cookies.
- **The tool.** `browser_run_code_unsafe` of Playwright MCP is "RCE-equivalent": it runs code in
  the server process. Claude Code defers MCP tools until ToolSearch loads them; Codex calls them
  with no discovery step. `@playwright/mcp@latest` floats.

## Decision

The maintainer chose "#3 Playwright bypass" on 2026-11-07, after the design probe passed, and
"All UI browser steps" as its scope. `docs/procedures/design.md`, "The page CSP", holds the rules:

- **One way, with no source edit.** The `generate` pick and Assessment B of the design review load
  the product page in a new tab of the Playwright MCP server with `--isolated`. Before the page
  loads, one fixed call runs: `browser_run_code_unsafe` with
  `async (page) => { const cdp = await page.context().newCDPSession(page); await cdp.send('Page.setBypassCSP', { enabled: true }); }`.
  The pick always uses that tab, with or without a CSP on the page, so no session needs to detect
  a CSP.
- **No other way.** The session asks no CSP question, edits no CSP source, and builds no proxy, no
  frozen copy, and no hand-built variants because of the CSP. On `config_missing` it writes the
  whole live config with `cspChecked: true`, and skips only the CSP section of live setup. For its
  tab, this replaces the advice of `live.md` against a change of browser security.
- **The tab rules.** A bypassed tab opens only `http://127.0.0.1:<port>` and
  `http://localhost:<port>` pages of the checkout, and the session compares the origin after each
  navigation. A sign-in happens in a tab with no call, by the maintainer; the session never enters
  a credential. A Verify scenario, an after-fix capture, the `detect` scenario, a measurement of
  the component research, and Assessment A never get the call. The session closes each bypassed
  tab when its use ends. One agent at a time uses the server: Assessment B runs after Assessment
  A, and its brief cites these rules.
- **The check and the stops.** On the `generate` path, "The check" runs the call once on a blank
  tab, before any page or prototype checkout. Missing tools or a failed server give the stop with
  "install or repair the Playwright MCP server with `--isolated`"; a refused call gives the stop
  with "approve the call in the review of the host, or add a permission rule of the host for it",
  and the plugin recommends no allow rule. In the design review, a tool problem or a page off
  loopback is one line, `design: the page CSP blocks the in-page scan; <cause>.`, and the review
  goes on.
- **The captures** hide the bar through the `style` property of its element, which the CSP does not
  block, so a capture tab needs no call.

## Alternatives considered

- **#1, a CSP allowance in the prototype checkout** (the pattern of `impeccable` and Vercel). The
  session adds the allowances of #250 to the product CSP and removes them before the commit. The
  pick works in any browser. Each product needs a source edit in a header, a `<meta>` tag,
  middleware, or a config file; it overrides the consent question of `impeccable`; and the design
  review on the lane branch gets no in-page scan. Rejected.
- **#2, a browser command in the engine** (one Chromium for each session, a temporary profile, a
  CDP port on 127.0.0.1, a bypass on each tab). No source edit and no MCP server, but it adds a CDP
  client, a holder process, and the Chrome path of each OS to the engine: a slice of Puppeteer with
  no tests. Rejected.
- **A header proxy** (the pattern of Cypress). The page gets the origin of the proxy, so the Host
  and Origin checks and the cookies of a product can break. Rejected.
- **A frozen static copy** (#235). `generate` writes its variants into the source file of the
  element, which a copy does not serve. Rejected.

## Consequences

- The `generate` pick and the in-page scan work on a page with a header CSP or a `<meta>` CSP, with
  no question and no change that can reach production.
- A look decision on the `generate` path needs the Playwright MCP server with `--isolated`, headed,
  and the host reviews each `browser_run_code_unsafe` call. A Codex session with no Playwright tools
  now stops on that path, where it used `--open` of `generate.md` before. A stricter permission
  mode can ask the maintainer or refuse; a refusal is the stop.
- The maintainer picks in the Playwright window, not in the usual browser. No click of a person in
  that window was tested by the build; "After the landing" of the plan of #277 checks it.
- The CSP is off on the pick tab. A variant that needs inline styles works in the overlay. The
  accept moves its rules into the stylesheet, the build writes the variant again, and Verify sees
  the real CSP in a tab with no call.
- The shared cookies of the sign-in tab rest on the default browser context of `--isolated`
  (checked on the fixture, 2026-11-08). The text names no `isolatedContext`, so each tab opens in
  that context; a tab in a named context would share no cookies with it.
- A redirect of the product loads the foreign page in the bypassed tab before the session can
  compare the origin and close the tab. The profile is new and holds no credential, and the session
  injects nothing there, but the CSP of that page is off until the close. A guard in the call that
  aborts each navigation off loopback would close the gap, and it would change the fixed call.
- With the CSP off, a script that the page's own data carries runs in that tab, also with the
  cookies of a sign-in. It can also reach the helper, because the `live.js` URL holds its token.
  On loopback pages of the maintainer's own checkout, this risk is small; the CSP is a defense
  against it.
- One Playwright MCP server has one current tab for each call, and a sub-agent of Claude Code shares
  the server of its session (observed 2026-11-08). Two agents that use it at once can put the call
  on the tab of the other agent, so the text runs one agent at a time on it.
- `@playwright/mcp@latest` floats: a renamed tool makes the call fail, and the stop names the cause.
- The form of a refused call on Codex was not observed: the text treats each call that does not
  complete as the failure.

## Reconsider when

- Playwright MCP renames `browser_run_code_unsafe`, or gets a CSP option of its own (for example a
  `bypassCSP` context option that a session can set with no code call).
- `impeccable` loads its overlay and its scan with no script injection, or handles a header CSP
  itself.
- A host ships an isolated browser tool with a CSP bypass, or the Playwright MCP server stops
  sharing cookies between the tabs of its default context.
- A product needs its CSP to hold during the pick, for example a CSP that the variants must pass.
