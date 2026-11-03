# The board serves each visual page in a sandbox

## Date

2026-11-03

## Related

- [Issue #235](https://github.com/ddinkov10/celetis/issues/235): the approved specification, its
  design probe, and its three approaches.
- [ADR-0003](0003-a-local-web-board-starts-each-step-in-herdr.md) and
  [ADR-0035](0035-the-board-is-a-part-of-the-engine.md): the loopback board and its trust boundary.
- `engine/board/server.ts` (`answer`), `engine/lib/visual.ts`, and `engine/board/README.md`,
  "The trust boundary".

## Context

Lanes land changes faster than the maintainer reads their code. The maintainer wants to see a
landed change as a `visual-explainer` diff review, made on request from a row of History. That
page is HTML that a model writes. The board origin holds the POST endpoints of Run, Resume,
Assist, intake, queue, and update, so model-written HTML must not run with the privileges of that
origin.

## Constraints and evidence

- The board page has a strict Content-Security-Policy and loads nothing from the network. A
  `visual-explainer` page loads CDN fonts and libraries and runs its own script.
- W3C CSP Level 3: the `sandbox` directive with no `allow-same-origin` gives the document an
  opaque origin. WHATWG Fetch: a request from an opaque origin sends `Origin: null`.
- The design probe of the issue (Chromium, 2026-11-03) served a real diff-review page with
  `sandbox allow-scripts allow-popups allow-popups-to-escape-sandbox`. The page rendered, and
  `self.origin` was `"null"`. A JSON `POST` reached the server only as an `OPTIONS` with
  `Origin: null`. A `GET` and a simple text `POST` reached the server with `Origin: null`, and the
  page could not read the response. `localStorage` threw `SecurityError`.
- The board already refuses a POST whose `Origin` is not its own page or whose content type is
  not JSON. It refused no `GET` and no `OPTIONS` by `Origin`.

## Decision

A visible tab of the default host, `#<n> visual`, makes the page in the main checkout at
`docs/superpowers/visuals/<sha>.html`. The board serves it at `GET /visual/<sha>` only when
`<sha>` is 40 lowercase hex digits and the path is a regular file, not a symbolic link. The
response has `Content-Security-Policy: sandbox allow-scripts allow-popups
allow-popups-to-escape-sandbox`, `X-Content-Type-Options: nosniff`, and no `allow-same-origin`.
The CSP of the board page does not change.

The server refuses with 403 each request whose `Origin` is exactly `null`, on every path and
method, before it reads a file or data. The board page never sends that value, so the refusal
affects only a sandboxed page or a `file://` page.

A link is the standard way to open a document from a web page, and the CSP sandbox is the
standard isolation for untrusted HTML. The route works the same on each OS and adds no program to
the server.

## Alternatives considered

- **An OS opener press** (approach 2): the server starts `open`, `xdg-open`, or the Windows opener
  on the file. No model-written HTML runs on the board origin, and the page keeps `localStorage`.
  It adds a program for each OS to the server, Windows quoting, and a control that is not a link.
- **A hidden headless run** (approach 3): the server starts the host in a hidden terminal. The
  maintainer has no place to see progress, answer a permission prompt, or read a failure, and
  each host needs headless permission flags.
- **A sandbox with `allow-same-origin`**: the page keeps `localStorage`, but it runs on the board
  origin and can send a JSON POST with the board `Origin`, so it can press Run.

## Consequences

The maintainer opens each later view of a visual from History with no OS program and no new
process in the server. A visual page has no `localStorage`; a page script that needs it can
break. A cors request or a POST of a sandboxed page has `Origin: null` and gets 403 before any
read. A navigation, a popup, and a no-cors GET (an image or a script) of the page have no
`Origin` and get the normal answer, which the page cannot read. No GET of the board is a press.
A `GET /api/board` can start the full read of the data, which the timer of the server also
starts. That read can update the queue record and start a queue wake that is due. A new GET with
another effect would be open to such a page. The `Origin: null` refusal also refuses a `file://`
page and any other client that sends that value.

## Reconsider when

- A visual page needs storage or another capability of a real origin.
- A browser sends a cors request or a POST of a sandboxed document with an `Origin` other than
  `null`, or with no `Origin`.
- A GET of the board gets an effect that the timed full read does not have.
- The board gets authentication, so the origin no longer guards the presses.
