# Each issue write of a session goes through the command issue

## Date

2026-11-14

## Related

- [Issue #323](https://github.com/ddinkov10/celetis/issues/323): the spec (the body of the issue) and the plan in its
  comments. In this record, "the probe" names the section "Design probes" of that body.
- [Issue #193](https://github.com/ddinkov10/celetis/issues/193): the refresh hints. After a write through the engine,
  each running board reads that one issue within about 1 second.
- `engine/issue.ts`, `engine/lib/tracker.ts` (`createIssue`, `commentIssue`), `engine/lib/epic.ts`
  (`writeEpicDefinition`), `engine/lib/refresh-hints.ts`, `engine/lib/contract.ts`, and
  `plugins/celetis/references/procedures/entry.md` (the bullet **GitHub.**).

## Supersedes

Only these clauses change. The record keeps its other text.

- [The engine enforces the lifecycle and the landing](0036-the-engine-enforces-the-lifecycle-and-the-landing.md), in
  part, in "Decision", **The command `issue`**:
  - The sentence "The `## Intent` comment of `intake` and the `## External facts` comment of `chore` stay `gh` writes:
    the engine does not read them." These comments now go through `issue <n> comment`.
  - The clause "it refuses a file that starts with a `## ` line" holds for the acts that it lists, not for the new act
    `comment`. That act refuses only a first line that is a lifecycle heading or the effort marker.

## Context

The maintainer watches the board while sessions work, and asked that the board show a new issue
"instantly almost" after a session act. #193 added the refresh hint, but only the writes of the
engine leave one. The skills made many issue writes with a direct `gh` command: each new issue
(intake, capture, the lane start, the epic children) and each ordinary comment (`## Intent`,
`## Captured`, `## External facts`, runtime reports, stop records, assistance records, prototype
captures). The board showed these writes only at its next 5-minute full read.

## Constraints and evidence

- The maintainer: "the goal isn't to get rate limited". The timed full read stays, and each act
  that touches an issue also sends the signal.
- The probe: with `If-None-Match`, each conditional request for the issue list got
  `304 Not Modified`, and the rate-limit use rose the same in each idle period and each request
  period (5 rounds). Other clients of the account used about 4 requests each 10 s, so the probe
  cannot prove that a 304 costs nothing.
- GitHub drops the labels of a new issue silently for a user with no push access
  (`POST /repos/{owner}/{repo}/issues`, REST API 2026-03-10).
- `gh issue comment --attach` uploads an image or a video; one command takes at most 50 files
  (`gh` 2.103.3).
- The resolver reads a lifecycle comment by a prefix of its body, and an effort decision by its
  first line.

## Decision

Each issue write of a session in the repository of its checkout goes through an act of the
command `issue`, and the act writes the refresh hint. The engine does the write, so the write and
its signal cannot separate, and an agent cannot forget the signal. The board does not change.

- `issue create <file>` makes a new issue. The first line of the file is `# Intent: <title>`. The
  act sets `needs-triage` in the same request, and prints the URL of the new issue before any other
  write. A URL on stdout means that the issue exists, also on a nonzero exit, so a session never
  creates the issue a second time. When GitHub dropped the label, the act prints the URL and exits
  6. With no URL, the exit line says "no issue was written" only for a refusal of GitHub (an HTTP
  4xx answer). Each other failure, for example a 5xx answer or an answer that cannot be read, can
  come after GitHub made the issue, so its line says that the issue can exist.
- `issue <n> comment <file> [--attach <file>#<alt>]` posts an ordinary comment through
  `gh issue comment`, with the uploads. It refuses a file whose text, after leading white space,
  starts with a lifecycle heading or with `Effort:`, and names the act for that record. So the act
  is no second path for a lifecycle write.
- After a successful definition write, `issue <n> epic` writes a hint for each child, so each
  child card gets its epic group at once.
- `gh` stays for reads, for the sub-issue link of an epic child, and for the `feedback` writes to
  another repository.
- Contract 6 replaces contract 5, which is no longer served.

## Constitution

Read: `CONSTITUTION.md`, amended 2026-11-12.

- Serves: 2 Autonomous steps: the board shows the result of each session act within seconds, so the maintainer sees a
  new issue, a hold, or a record at once and spends no manual refresh on it.
- Serves: 4 Product neutrality: the acts name roles (an intent, a comment) and no part of a product.
- Hard limits and non-goals: none touched.

## Alternatives considered

- **A change poll.** The board sends one conditional request for the issue list each 2 s. It covers
  every writer, also the website. Rejected: it rests on free 304 answers, which the probe did not
  prove. If GitHub counts them, the poll costs about 1,800 requests per hour, next to a background
  use of about 1,400 per hour, under a limit of 5,000.
- **`celetis refresh <n>`** after each `gh` write. Rejected: twelve extra lines that an agent must
  not skip, and a new issue needs its number from the printed URL first.
- **A host hook** that reads each shell command for `gh issue …`. Rejected: a different hook on each
  host, a parse of command text, and no view of a write in a child process.
- **Webhooks or the Events API.** Rejected: a webhook needs a receiver that GitHub can reach, or
  admin rights for `gh webhook forward`; the Events API has a latency of 30 s to 6 h.

## Consequences

- A new issue, a comment, and an epic child show on a running board within seconds, with no new
  GitHub request: the only request is the existing targeted read of the hinted issue.
- An edit on the GitHub website or from a shell outside a session, and a `feedback` write, still
  wait for the 5-minute full read.
- An installed plugin of contract 5 stops at the contract check with this engine until its
  maintainer updates both.
- A crash between the create request and the printed URL can leave an issue that the session does
  not know. The rule of `intake` and `capture` to tell the number at once stays.
- A comment that starts with another `## ` heading, for example `## Intent`, still ends a current
  landing refusal in the reading of the resolver, as a direct `gh` comment did.

## Reconsider when

- GitHub documents that a conditional 304 request is free for every authenticated client and a
  change poll can cover the writes outside a session.
- A host gives a reliable hook for each issue write of a session, also in a child process.
- The board reads its data from a source that pushes changes.
