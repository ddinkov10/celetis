# The plain comment act posts through REST

## Date

2026-11-24

## Related

- Issue: https://github.com/ddinkov10/celetis/issues/391
- The host record of the refused GraphQL: https://github.com/ddinkov10/celetis/issues/386
- [Land finishes when GitHub refuses a branch deletion](0137-land-finishes-when-github-refuses-a-branch-deletion.md), the earlier change for a Claude Code cloud session
- `engine/lib/github/tracker.ts` (`commentIssue`)

## Supersedes

- [Each issue write of a session goes through the command issue](0108-each-issue-write-of-a-session-goes-through-the-command-issue.md), in part: in "Decision", the clause "posts an ordinary comment through `gh issue comment`, with the uploads." With the GitHub tracker, it holds only for a comment with an upload. [A local tracker in the git-bug format](0126-a-local-tracker-in-the-git-bug-format.md) already replaced it for the local tracker.

## Context

The GitHub proxy of a Claude Code cloud session refuses GraphQL. The act `issue <n> comment <file>` ran `gh issue comment`, which uses GraphQL, so it exited 6 with `HTTP 403: GitHub GraphQL is not available from Claude Code sessions; use the REST API`, and nothing was posted. Each other issue write of the GitHub tracker already uses REST.

## Constraints and evidence

- With a fake `gh` that refuses `gh issue ...` and `gh api graphql` with that 403, the base act exited 6 and the call log held `["issue","comment","391","--body-file=..."]`.
- `POST /repos/{owner}/{repo}/issues/{n}/comments` takes a `body` and answers with a comment object that has `html_url`. The adapter already used it in `comment(n, text)`.
- `gh issue comment --attach` came in `gh` 2.99.0. GitHub documents no REST route for the upload that it does.

## Decision

The act posts through REST when it has no `--attach`: `POST issues/<n>/comments` with the file text as `body`. It prints the `html_url` of the comment and a line break, as `gh issue comment` printed the URL, and the request writes the refresh hint. With one or more `--attach`, the act keeps `gh issue comment --attach`. A failed post keeps the line `#<n>: the comment write failed`, which does not say that nothing was written, because a failed POST can come after GitHub made the comment.

## Constitution

Read: `CONSTITUTION.md`, amended 2026-11-12.

- Serves: 2. Autonomous steps: a step session in a Claude Code cloud session can post a plain comment with no hold.
- Hard limits and non-goals: none touched.

## Alternatives considered

- **REST for the upload too.** GitHub documents no REST route for it.
- **A GraphQL fallback.** The cloud proxy refuses GraphQL.
- **A flag that chooses the path.** The attachments already decide it, so a flag adds configuration with no use.

## Consequences

- A plain comment works in a cloud session. A comment with an upload still fails there, with the failure of `gh issue comment`.
- The act sends the file text as the body, as `--body-file` did.
- The check ran with a fake `gh`. The `{owner}/{repo}` placeholder of `gh api` was not checked against a real `gh`.

## Reconsider when

- The cloud proxy allows GraphQL, or GitHub documents a REST route for an upload.
