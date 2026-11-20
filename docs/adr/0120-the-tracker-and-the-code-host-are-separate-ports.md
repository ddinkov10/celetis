# The tracker and the code host are separate ports

## Date

2026-11-20

## Related

- [Issue #334](https://github.com/ddinkov10/celetis/issues/334): the spec (the body of the issue).
- [Issue #335](https://github.com/ddinkov10/celetis/issues/335): the local tracker. It adds the choice of an adapter and
  the follow-ups below.
- [Issue #11](https://github.com/ddinkov10/celetis/issues/11) and [issue #12](https://github.com/ddinkov10/celetis/issues/12):
  the other trackers that the ports make possible.
- [The issue key is a string that the tracker defines](0117-the-issue-key-is-a-string-that-the-tracker-defines.md): the
  key type that the new acts print.
- `engine/lib/tracker/tracker.ts` (`Tracker`, `TrackerError`, `Issue`), `engine/lib/code-host/code-host.ts` (`CodeHost`,
  `CodeHostError`, `bucket`, `runBucket`), `engine/lib/github/github.ts` (the client and `GitHubError`),
  `engine/lib/github/tracker.ts`, `engine/lib/github/code-host.ts`, `engine/lib/services/services.ts` (`services`),
  `engine/issue.ts` (the acts `view`, `list`, and `link`), and `plugins/celetis/references/procedures/entry.md`
  (the bullet **GitHub.**).

## Supersedes

Only these clauses change. The records keep their other text.

- [Every GitHub call of the engine goes through the tracker port](0082-every-github-call-goes-through-the-tracker-port.md),
  in part, in "Decision" and "Consequences":
  - The sentence "`engine/lib/tracker.ts` is the one place of the engine that runs `gh` for GitHub data". The one place
    is now the GitHub client and its two adapters, in `engine/lib/github/`.
  - The sentence that a port method turns a refused response into "the one port error `GitHubError`". Each port has its
    own error, `TrackerError` and `CodeHostError`; the adapter turns each `GitHubError` into the error of its port.
  - The sentence "`GitHub.api` returns `unknown`". The port types hold no `api`, `graphql`, or `list`.
  - The Consequence "The `gh` calls of the agent text (skills and modules) stay outside the port". The agent text reads and
    links issues through the acts of `issue`.
- [Each issue write of a session goes through the command issue](0108-each-issue-write-of-a-session-goes-through-the-command-issue.md),
  in part, in "Decision": the clause "`gh` stays for reads, for the sub-issue link of an epic child, and for the
  `feedback` writes to another repository". The acts `view`, `list`, and `link` replace the reads and the link of
  the product tracker. `gh` stays for the code host and for the writes to another repository.
- [The engine enforces the lifecycle and the landing](0036-the-engine-enforces-the-lifecycle-and-the-landing.md), in
  part, in "Decision", **One set of rules over the ordered timeline**: the place of the read, `engine/lib/tracker.ts`.
  The `Tracker` of `engine/lib/tracker/tracker.ts` reads the issue; its GitHub adapter reads the timeline. The rule
  of the clause (one paginated read of the whole timeline, only for an issue that has a comment) holds for `read`.
- [A workflow run with no check run is a check of the pr landing](0093-a-workflow-run-with-no-check-run-is-a-check-of-the-pr-landing.md),
  in part, in "Decision", item 1 **The port**: the place of `WorkflowRun`, `engine/lib/tracker.ts`. The type is
  in `engine/lib/code-host/code-host.ts`.

## Context

The skills of the plugin read issues with `gh issue view`, `gh issue list`, and `gh api`, and linked a child to its
epic with two `gh api` calls and the database ID of the child. These calls name GitHub in text that a product with
another tracker reads. The engine had one port for the tracker and the code host, and ADR-0082 made `gh` stay outside
it for the agent text. A second tracker (#11, #12, #335) needs a tracker port with no PR and no check in it, and an
agent text that names the tracker role.

## Constraints and evidence

- Each command keeps its printed lines and exit classes. Only the new acts add lines.
- `biome.jsonc` sets `noImportCycles` to `error`. An adapter must construct the error class of its port, so a port
  module cannot import the adapter and the adapter import the port at run time.
- The engine logs in through `gh`, and the lab checks run a fake `gh` first on `PATH` (`AGENTS.md`, "Host checks").
- `gh api` ignores the host of `GH_REPO`, so the `GH_HOST` pin of `setup status` stays.
- The repository keeps no tests (ADR-0029). The proof is the verify gate and the runs of the fixtures of #334.

## Decision

The engine has two ports. `Tracker` holds the issue reads and writes, the labels, and the epic snapshot. `CodeHost`
holds the repository, the PRs, the checks, and the workflow runs, with `bucket` and `runBucket`. The GitHub client
and its two adapters are the one place of the engine that runs `gh` for GitHub data. The agent text reads and links
issues with three new acts of `issue`: `view` (the JSON of the issue, or with `--latest` the body of the newest
comment with a given first line), `list` (the open issues with no PR), and `link` (a child as a sub-issue of an
epic). `gh` stays for the code host and for another repository.

- **D1. The composition.** The port modules give no constructor. `services(cwd, signal?, env?)` of
  `engine/lib/services/services.ts` builds one GitHub client and returns `{ tracker, codeHost }`. A caller that needs
  both ports shares one `stderr` buffer, so the order of the printed lines stays. A constructor in a port module would
  make a value import cycle.
- **D2. The tracker issue is neutral.** `Issue` has no `apiUrl` and no `parentUrl`. It has `parent: IssueKey | null`,
  which the adapter computes with the prefix rule of the old `parentKey`: a parent URL in another repository gives
  `null`. The resolver keys its epic map by the key and checks `parent.key === n` where it compared the API URL of
  the parent.
- **D3. `view` reads the whole timeline.** The port method `history(n)` reads the timeline also for an issue with no
  comment, so `view` shows each label change. `read(n)` keeps its rule (no timeline read with no comment), so the
  resolver keeps its call sequence.
- **D4. The project URL of the epic snapshot** stays a read inside the GitHub tracker adapter.
- **D5. The setup status** imports `loggedIn` of the GitHub client.
- **D6. `link` writes nothing on stdout** on success, as the other write acts. It prints the `gh` stderr like them.

Known limit of D2: `parent.key === n` does not refuse a parent read that answers from another repository with the
same number. The old check compared the API URLs and refused it. A parent URL in another repository already gives
`parent: null`, so the limit holds only for a same-repository answer with the same number.

Follow-ups for #335:

- The composition choice: `services` returns the GitHub adapters; #335 adds the choice of the adapter from the project.
- The repository pair of D4: the project URL of a child is a URL of the tracker; a tracker that is not GitHub needs
  its own read.
- The setup status of D5: `setup status` imports the GitHub client; a daemon with no `gh` needs it behind a port.

## Constitution

Read: `CONSTITUTION.md`, amended 2026-11-12.

- Serves: 1 Intent to release: a lane of a project with a tracker that is not GitHub can read and link its issues.
- Serves: 4 Product neutrality: the agent text names the tracker role and its acts, not the tool of one tracker.
- Hard limits and non-goals: none touched. `land` stays the one landing path; the code-host port keeps the checks
  of the `pr` landing.

## Alternatives considered

- **One port for both.** It keeps the one file, but a second tracker would implement PRs and checks that it has not.
- **A constructor in each port module.** It reads well, but it makes the value import cycle that `noImportCycles`
  refuses (D1).
- **Keep the `gh` reads in the agent text.** It changes no skill, but each product with another tracker must rewrite
  the text of each step.
- **A `view` that reads the timeline only for an issue with a comment.** It saves one request, but `view` then hides
  a label change of an issue with no comment, which the `gh api` timeline read showed.

## Consequences

- A new tracker implements one port with no PR and no check. A review of the GitHub data reads the files of
  `engine/lib/github/`.
- A `view` makes at least two more requests than `gh issue view`: the issue read, each timeline page, and each
  sub-issue page.
- `view --latest` selects the newest matching comment from any author, as the replaced `--jq` read did
  (https://github.com/ddinkov10/celetis/issues/334#issuecomment-7050386660, F1). `view` gives the `author` of each
  comment of its `history`, so a session can see who wrote the selected record.
- `view --latest` matches the exact first line of a comment, with its trailing white space removed. The plan anchor of the engine
  (`headed` in `engine/lib/workflow/workflow.ts`) matches a prefix. The acts always write the first line `## Plan`
  exactly, so both select the same comment of an act.
- `view` refuses a pull request with exit 3. The conflict step of `worktree` reads each issue that a trunk subject
  names, and it needs no read for a PR.
- The resolver keeps one limit (D2). The contract version 8 replaces version 7, which the engine no longer serves.

## Reconsider when

- #335 adds a second adapter and the shape of `Issue`, `history`, or `services` does not fit it.
- A caller needs a method that only one adapter can give.
