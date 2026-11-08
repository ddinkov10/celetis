# Every GitHub call of the engine goes through the tracker port

## Date

2026-11-08

## Related

- ddinkov10/celetis#256: the change that made `engine/lib/tracker.ts` the one GitHub path.
- ddinkov10/celetis#195 (finding F8): the finding that four engine modules called `gh` around the
  port.
- ADR-0023: the landing re-runs a failed check once. It keeps its own re-run policy on top of the
  shared bucket rule.
- ddinkov10/celetis#11 and ddinkov10/celetis#12: other trackers that the port makes possible.

## Context

`engine/lib/tracker.ts` was the GitHub port, but `lib/landing.ts`, `worktree.ts`, `setup.ts`, and
`lib/setup-status.ts` each ran `gh` with their own wrapper and cast `JSON.parse(...)` to a type
that nothing checked. The port itself had a cast that checked nothing. A pull request had three
domain shapes. The colour of a check had two rules, one on the board and one in the landing, and
they disagreed on `stale`, `startup_failure`, and unknown values. A malformed response could end
as a `TypeError` far from the call, and a board read failed for each open lane PR.

## Constraints and evidence

- The engine logs in through `gh`, and the lab checks run a fake `gh` first on `PATH`
  (`AGENTS.md`, "Host checks").
- `gh api` ignores the host of `GH_REPO`, so the port keeps the `env` parameter and the
  `GH_HOST` pin of `setup status`.
- The repository keeps no tests (ADR-0029). The proof is a pair run of the base program and the
  lane program against the same fake `gh`.
- Each command keeps its exit code, stdout, stderr lines, and GitHub writes. A wrapper that goes
  away leaves its effects (stderr timing, failure text, exit class) in the caller.

## Decision

`engine/lib/tracker.ts` is the one place of the engine that runs `gh` for GitHub data. It has one
method for each operation, and each method parses its response into a domain type before a caller
sees it. A port method turns a response that its parser refuses into the one port error
`GitHubError`. Its text is `malformed GitHub data`, or the refusal text of `parseParent` for the
parent read. The one exception is `engine/board/history.ts`, which calls the exported
`parseIssue` directly: there a refusal stays an `Error` with the text `malformed GitHub data`.
A caller catches that one class and builds its own message and exit class. No caller casts a port
result, and `GitHub.api` returns `unknown`.

One function, `bucket`, maps a check run or a commit status to one of the five buckets of
`gh pr checks`. The board and the landing both use it. This is the one red-check rule. The landing
keeps its re-run policy (ADR-0023) on top of it.

A malformed response now ends on the failure path of its call. For example, the reads of `land`
before the push, of `worktree`, and of `setup check` and `setup write` end as `blocked`, exit 6.
Before, it could end as a `TypeError` and exit 1. This is deliberate.

## Alternatives considered

- **A thin port.** One generic request and exported parsers. The diff is smaller, but the
  endpoints stay in four files and a caller can skip a parser, so "one place parses GitHub data"
  does not hold.
- **Octokit.** It replaces the `gh` login and the fake `gh` of the lab checks, adds a dependency,
  and its types check nothing at run time.

## Consequences

- A new GitHub operation is a new method and a new parser in one file. A review of GitHub data
  reads one file.
- The board and the landing cannot disagree on the colour of a check.
- A response that GitHub allows but a parser refuses (for example a field that the parser
  requires) turns a working read into a failure. The parsers require only the fields that a caller
  reads.
- The `gh` calls of the agent text (skills and modules) stay outside the port.

## Reconsider when

- A second tracker is added (#11, #12): the port may need a tracker-neutral interface and a
  second adapter.
- `gh` stops being the login of the engine.
