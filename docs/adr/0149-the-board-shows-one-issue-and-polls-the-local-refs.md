# The board shows one issue and polls the local refs

## Date

2026-11-25

## Related

- Issue: https://github.com/ddinkov10/celetis/issues/336 (the spec is its body)
- [The board serves each visual page in a sandbox](0065-the-board-serves-each-visual-page-in-a-sandbox.md), the `Origin: null` refusal and the page CSP
- [The board reads engine state through one read model](0087-the-board-reads-engine-state-through-one-read-model.md)
- [The tracker and the code host are separate ports](0120-the-tracker-and-the-code-host-are-separate-ports.md)
- [A local tracker in the git-bug format](0126-a-local-tracker-in-the-git-bug-format.md), the format of the operations and their blobs
- `engine/lib/board-read/board-read.ts` (`readIssueView`, `readRevisions`, `localHistory`, `localDelivery`), `engine/board/requests.ts` (`parseIssueQuery`), `engine/board/perimeter.ts`, `engine/board/reads.ts`, `engine/board/README.md` ("The data", "The trust boundary")

## Supersedes

- [A local tracker in the git-bug format](0126-a-local-tracker-in-the-git-bug-format.md), in part: in "Decision", item 8, the clause "The board of a local project shows its cards through the ports and makes no History or delivery read: its History is empty, with the local trunk label and no network read". A local project now reads its History and its delivery from the trunk log (decision 4). The rest of item 8 stays: no `gh` check for a local project, and `url: null` of a card.

## Context

The board of a local project showed its cards only, with an empty History and no delivery trends. A person could
not read the body and the comments of an issue on the board, and a write to a local issue reached the board only with the next full read of the issues. The panel of a
card needs one issue of either tracker, with its body, its comments, its label changes, and the images that a local
comment attaches. A local issue lives in `refs/bugs/<id>`, and a write by the engine, by the git-bug CLI, or by
`issue sync` moves a ref and writes no other file that the board reads.

## Constraints and evidence

- The page CSP allows `data:` images only (`img-src data:`), and it loads nothing from the network. A wider CSP or a
  new route that serves the files of the repository is an anti-goal of the spec.
- A local comment names each attached file by its blob hash in its `files` list, and the blob is a part of the pack
  (ADR-0126, decision 7). An operation that came by a sync can name a hash whose object the repository does not hold.
- With the reftable store, git keeps the refs in tables, so a ref has no file of its own that a file watch can watch.
- The board server already refuses a wrong `Host` and `Origin: null` on each path before it reads data (ADR-0065).
- In HeadlessChrome 158, a page of `localhost` sent requests to `127.0.0.1`: an image GET, a no-cors GET, a
  navigation, and the image GET and the no-cors GET of a sandboxed frame carried no `Origin`; a cors GET, a simple POST,
  and a form POST carried it. Each request carried `Sec-Fetch-Site: cross-site`, and a request of the page itself
  carried `same-origin`. Without a check, each GET of another page starts a read of its own: `gh` calls on the quota
  of the maintainer, or up to 32 MiB of blobs.
- A probe of the build (local and GitHub fixtures, the lane `createBoard`, a fake `gh`) gave the answer and the
  refusals that `engine/board/README.md`, "The data", states.

## Decision

1. **One issue on a GET route, through the tracker port.** `GET /api/issue?key=<key>` takes only a key that the grammar
   of the tracker accepts, else 400. A request whose `Sec-Fetch-Site` is there and is not `same-origin` gets 403
   before any read. `readIssueView` makes the tracker of the main `.celetis.yaml` and reads
   `issue`, `history`, and the new port method `files`. A key of no issue and a GitHub pull request give 404. The
   answer is the typed `IssueView`. So the page reads both trackers through one route and one port, and the read model
   stays the only reader of engine state (ADR-0087).
2. **Embedded images (approach 3a).** For a local issue, `files` reads only the blobs that the create, comment, and
   comment-edit operations of that issue name, each a full hash, with `git cat-file` in the main checkout. One
   `cat-file --batch-check` gives the type and the size of each object first, and `files` reads the bytes only of an
   object of the type `blob` of at most 10 MiB, while the blobs that it reads hold at most 32 MiB in total. So a tag
   that points to a larger blob is not followed, and one request holds at most 32 MiB of blob bytes. A blob that is not
   an image counts against that budget too, so a later image past it shows its alt text and its hash. The server
   embeds a blob as a `data:image/<type>;base64,` URL only when it starts with the signature of PNG, JPEG, GIF, or
   WebP, and while the images of one answer hold at most 32 MiB. A missing object, an object that is not a blob, a
   larger blob, a blob past the budget, and a blob of another type get no entry, so the page shows its alt text and
   its hash. The GitHub adapter gives no files: a GitHub
   image is a link of the body. The CSP stays byte for byte.
3. **A one-second ref poll (approach 1a).** For a local project, each tick of the one-second refresh-hint loop runs one
   fixed `git --no-optional-locks for-each-ref` of `refs/bugs/` in the main checkout. A changed, new, or gone ref
   selects its key for a target read. So a write of each writer reaches the page in about 7 seconds: at most 1 second
   to the poll, the target read, and at most 5 seconds of the page poll. The page poll stays 5 seconds, with no push
   channel.
4. **History and delivery from the trunk log.** For a local project, History and the delivery windows come from
   `git --no-optional-locks log` of `origin/<trunk>`, else of `HEAD`, in the main checkout. `subjectKey` takes the
   issue key from each commit subject, and the title and the creation time come from the local tracker. A key of no
   local issue gives no row. The read starts no `gh` and makes no network read. A History row of a local project has
   no issue link and no commit link (`url` and `commitUrl` are `null`).

## Constitution

Read: `CONSTITUTION.md`, amended 2026-11-12.

- Serves: 4. Product neutrality: a project with the local tracker gets the issue view and the live updates of the
  board through the same tracker port as a GitHub project.
- Hard limits and non-goals: none touched.

## Alternatives considered

- **`img-src 'self'` and a file route of the board.** It widens the CSP, and a route that serves blobs by hash can
  serve each object of the repository unless it checks the issue again on each request. The embed decides once, in the
  read of the issue.
- **No images.** A local screenshot is the main use of `--attach`, so the alt text alone loses the content.
- **A file watch of the refs.** The reftable store has no file for each ref, and a watch of the git folder fires for
  each write of git. The poll reads the refs of each store with one process each second.
- **A full read each second, or a `git` process for each issue.** The cost grows with the count of issues; the poll
  costs one process each second.
- **A push channel to the page.** It adds a server stream for a gain of at most 5 seconds over the page poll that the
  spec accepts.

## Consequences

- The page gets one issue of either tracker with no new CSP source. The route serves only the image blobs that the
  operations of the issue name, and no other blob or file of the repository.
- An answer can hold up to 32 MiB of image bytes, about 43 MiB as base64 in the JSON.
- A navigation, an image GET, and a no-cors GET of another page carry no `Origin`, and get 403 by their
  `Sec-Fetch-Site`. A browser that sends no `Sec-Fetch-Site` gets the JSON, which that page cannot read, and the
  read of that GET runs, so it can spend the `gh` quota. The route
  reads only, as each GET of the board does.
- A local project runs one `git` process each second while the board runs.
- The History of a local project shows only the landings whose commit subject names the key of a local issue.

## Reconsider when

- The page CSP must allow another image source, or the board serves files of the repository for another reason.
- git gives a ref change event that the board can wait for, or the count of local refs makes one
  `for-each-ref` each second costly.
- The tracker port gains a kind of history item other than a comment and a label change.
- A local project gets a code host with links for its issues and its commits.
