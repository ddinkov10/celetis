# The GitHub tracker reads only the text of trusted authors

## Date

2026-11-26

## Related

- [Issue #393](https://github.com/ddinkov10/celetis/issues/393): the intent and the spec (the body of the issue,
  `Spec: 2026-11-25`), with the decision of the maintainer of 2026-11-25 that an issue that a stranger opens does
  not exist for Celetis, and the pick of approach A.
- [The tracker and the code host are separate ports](0120-the-tracker-and-the-code-host-are-separate-ports.md): the
  GitHub adapter of the tracker port is the boundary of this rule.
- [The plain comment act posts through REST](0139-the-plain-comment-act-posts-through-rest.md): the proxy of a
  Claude Code cloud session refuses GraphQL, so the rule needs no new call.
- [A held change lands only by its released content](0143-a-held-change-lands-only-by-its-released-content.md): a
  hold record counts only when the engine login wrote it. That rule stays, and it applies to the comments that
  this rule keeps.
- `plugins/celetis/docs/issue-tracker.md`, "Trusted authors", states the rule for the maintainer.

## Supersedes

- [The tracker and the code host are separate ports](0120-the-tracker-and-the-code-host-are-separate-ports.md), in
  part: in "Consequences", the sentence "`view --latest` selects the newest matching comment from any author, as the
  replaced `--jq` read did". With the GitHub tracker, it selects the newest matching comment of a trusted author.

## Context

Any GitHub user can open an issue or post a comment on a public repository. The engine gave that text to agents and
to its workflow state: `issue <n> view --latest '## Plan'` printed the newest matching comment of any author, the
resolver took the lifecycle headings and the `Effort:` marker of each comment, and `issue list`, the board, and the
resolver listed each open issue. So a stranger's `## Plan` comment moved an issue to `implement`, and the step read
that comment as its plan, with tool access on the machine of the maintainer.

A repository interaction limit (`collaborators_only`) blocked this. It lasts at most six months and must be set
again by hand, and GitHub has no other setting that stops a user from opening an issue on a public repository,
apart from turning issues off.

## Constraints and evidence

- The GitHub REST API gives `author_association` on an issue, on each item of the issue list and of the
  `sub_issues` list, and on each `commented` timeline event. A label event has none. The GraphQL fields
  `Issue.authorAssociation` and `IssueComment.authorAssociation` have the same values and spelling. The plan of
  #393 records these reads (https://github.com/ddinkov10/celetis/issues/393#issuecomment-7199072910, "External
  facts").
- The proxy of a Claude Code cloud session refuses GraphQL and the collaborator permission API, so a check through
  either fails each issue read there.
- GitHub lets only a user with triage access or higher change a label.

## Decision

1. **The rule.** An author is trusted when GitHub reports its association as `OWNER`, `MEMBER`, or
   `COLLABORATOR`. Each other value, a missing field, and `null` are not trusted. The trust of a text follows its
   author.
2. **One boundary.** `trusted()` of `engine/lib/github/tracker.ts` decides, and each parse point of a reading
   method of the GitHub adapter uses it. `read`, `history`, `timelines`, and `epic` leave out each comment of an
   untrusted author. `issues` and `children` leave out each issue of one. `issue`, `read`, and the parent read of
   `epic` refuse one. No port type gets a trust field, and no consumer checks the author. The history read of the
   board (`engine/lib/board-read/board-read.ts`) reads the title of each landed issue through GraphQL outside the
   port, so it uses the same `trusted()` and shows no issue of an untrusted author.
3. **The refusal is a missing issue.** The adapter throws the `TrackerError` of a missing issue (`notFound`,
   `refused`, and `missing` set to the key) and writes the line `#<n> was opened by <login>, who is not the owner,
   a member, or a collaborator of the repository; Celetis does not read it` into its stderr. So each caller keeps its
   handling of a missing issue, and the contract does not change. A queue action, which printed no stderr of its
   read, adds the line to its refusal.
4. **What stays.** Label events, the child snapshot of `epic` (it holds no text of a child, and the completion
   guard counts each child), the `comments` count, and `createIssue`, which does not refuse the issue that the
   engine wrote. The local tracker trusts each author, because each author of a local issue has push access to
   `origin`.

## Constitution

Read: `CONSTITUTION.md`, amended 2026-11-12.

- Serves: 1. Intent to release: only the intent of the maintainer moves a change toward release.
- Serves: 2. Autonomous steps: the daemon can run the steps of a public product with no interaction limit to renew.
- Hard limits and non-goals: none touched.

## Alternatives considered

1. **The author association (chosen).** It is the rule of the integrity filter of GitHub Agentic Workflows at its
   level `approved`. It needs no extra call, so it works in a cloud session. It is exact on a personal-account
   repository, where a collaborator has write access.
2. **The collaborator permission API.** Trust only `write`, `maintain`, or `admin`, as
   `anthropics/claude-code-action` does for its actor. It is exact everywhere, but it costs one call per author, and
   the proxy of a cloud session refuses the call, so each issue read fails there.
3. **A mix.** Trust `OWNER` at once and check `MEMBER` and `COLLABORATOR` with the permission API. A comment of a
   collaborator then blocks each read in a cloud session.
4. **A configured list of trusted logins.** A non-goal of the spec: it adds a configuration value that each project
   must keep current.

## Consequences

- An issue that a stranger opens has no card, no list entry, and no read, and each act on it stops as for a missing
  issue. A comment of a stranger reaches no agent and moves no line.
- An issue in a lane with a comment of a stranger loses that comment from each read, and a decision of the resolver
  that rested on it changes.
- The engine leaves out its own records when its `gh` login is not `OWNER`, `MEMBER`, or `COLLABORATOR`, for
  example with a GitHub App token, and the line of each issue stalls. The engine does not detect this.
- Known limits:
  - The rule does not see an edit. In an organization repository, a user with the Moderate role, who has no write
    access, can edit a trusted comment or a trusted issue body, and the REST API does not name the editor.
  - On an organization repository, `MEMBER` and `COLLABORATOR` can have read access only, and the rule trusts them.
  - It is not known whether GitHub computes `author_association` at read time, so the comments of a removed
    collaborator can keep counting. The association of a deleted user was not observed; each value outside the
    three is untrusted, so the rule is safe for both.
  - The text of the code host (PR bodies, PR comments, and review states) is not covered.

## Reconsider when

- GitHub changes the values or the meaning of the author association.
- A product project runs the engine with a bot or a GitHub App login.
- The code host gives an agent PR text.
