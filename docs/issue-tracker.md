# Issue tracker: GitHub

Issues are the state store for every lane. The issue number `#<n>` is the handle that carries work between commands and sessions; state lives in the issue and the repo, never in chat history. Use the `gh` CLI for each operation apart from the workflow writes of "Conventions" — it infers the repo from the clone, and `{owner}/{repo}` in an API path fills itself in.

The state, headings, paths, and branches are shared by both hosts. `/celetis:<skill>` names the
shared skill; use the selected host's invocation. Skills run each `celetis` command with the
explicit `--agent claude` or `--agent codex` ([the entry](procedures/entry.md), "The
contract"). Human terminal and board commands can use the project default. Changing hosts between steps retains
the same issue and lane checkout; resume always uses the host in the current session record.

In this document, these names are files of the plugin `celetis`, also when a session reads the document inside a product project that has a `docs/` folder and an ADR store of its own: the five documents (`docs/celetis-flow.md`, `docs/issue-tracker.md`, `docs/capability.md`, `docs/procedures/docs-lookup.md`, `docs/procedures/prior-art.md`), `step-prompt.md`, a runtime `<name>.ts` of `engine/` or a program of `scripts/` that the text names by its file, and each ADR number, which is a record of `docs/adr/` in the folder of the plugin and not of the product project. Each other path is a path of the product project, apart from a path that starts with `~/` or `/`.

## Conventions

- **Create an issue**: `gh issue create --title "..." --body-file <file>` (or `--body "..."` with a heredoc).
- **Read an issue**: `gh issue view <n> --comments`; for structured output `--json number,title,body,labels,comments`.
- **List issues**: `gh issue list --state open --json number,title,labels --jq '.[] | "#\(.number)\t\([.labels[].name] | join(","))\t\(.title)"'`, filtered with `--label` and `--state`.
- **Comment**: `gh issue comment <n> --body-file <file>` / `--body "..."`.
- **Replace the body**: `gh issue edit <n> --body-file <file>`.
- **Labels**: `gh issue edit <n> --add-label "..."` / `--remove-label "..."`.
- **Close**: `gh issue close <n> --comment "..."`.

Use the `gh` forms above only for the writes that the engine does not read, for example the
`## Intent` and `## External facts` comments. Each workflow write that the engine reads goes
through `celetis --agent <host> issue <n> <act>`.
In this document, `issue <n> <act>` stands for that command. The command reads the issue once,
checks the prerequisite of the act with the rules of the resolver, and then writes. Epic acts
also use the protected current-state reads in "Epic completion and repair":

| Act | Prerequisite | Writes |
|---|---|---|
| `route <lane>` (`feature`, `bug`, `chore`, `hotfix`) | open; not an epic | the label of the lane; it removes the other lane labels and `needs-triage` |
| `epic <file>` | open feature or epic; valid declaration and current child references | the complete parent body, then adds `epic` and removes `enhancement` as needed; clears no hold |
| `epic-state` | readable parent and complete children | nothing; the JSON snapshot of "Epic acceptance submission" |
| `complete-epic [file]` | "Epic completion and repair" | an accepted record, then closes as completed; an already closed parent has no write |
| `needs-info <file>` | open | the file as a comment, then `needs-info` |
| `wontfix <file>` | open | the file as a comment, then `wontfix`, then the close as not planned |
| `spec <file>` | open; lane `feature` | the body: `Spec: YYYY-MM-DD` (the local date), a blank line, then the file |
| `root-cause <file>` | open; lane `bug` or `hotfix` | a `## Root cause` comment |
| `plan <file>` | open; a `feature` with a spec, or a `bug` with a `## Root cause` comment | a `## Plan` comment; then `ready-for-agent` with no human hold, else keeps `ready-for-human` and removes `ready-for-agent` |
| `built` | the resolver line is `implement` of a planned change | a `## Built` comment, then removes `ready-for-agent` when present |
| `before-landing <file> [--during-the-build]` | the resolver line is the step that lands the lane (`implement`, `chore`, `hotfix`) | a `## Before landing` comment with the marker of its kind ("Completing a human precondition"), then it adds `ready-for-human`, and removes `ready-for-agent` when it is on |
| `landing-refused <file>` | as `before-landing` | a `## Landing refused` comment |
| `stopped <file>` | open | a `## Stopped` comment, then adds `ready-for-human` and removes `ready-for-agent` when present |
| `ready-for-human` | open | adds or retains `ready-for-human`, then removes `ready-for-agent` when present |
| `assisted <file>` | open; has `needs-info`, `ready-for-human`, or a current open human precondition | a `## Human steps done` comment with assistance-agent attribution, then removes present `needs-info` and `ready-for-human`; adds no label |
| `state` | none | nothing |

- The command writes the heading of each lifecycle comment. Its `<file>` holds text with no heading: the
  command refuses a file whose first line that is not blank starts with `## `, and, for `spec`,
  one that starts with `Spec:`. `assisted` inserts `Reported by the assistance agent (` followed
  by the selected host in backticks and `).` before the supplied report text. The epic definition
  file instead holds the complete parent body, and a completion file holds strict JSON.
- Lifecycle acts post the comment first (ADR-0011). Then they add the labels in one call, remove each label in
  a call of its own, and last changes the body or closes the issue. It never replaces the whole set
  of labels, so a label that a person adds or removes at the same time stays as the person set it.
  A label that is already on, or already off, is no change, and a write with no change is not
  sent. The removal of a label that is already off on GitHub is no failure. Epic definition and
  completion writes follow their separate order in "Epic completion and repair".
- A successful `stopped`, `ready-for-human`, or `before-landing` act leaves only `ready-for-human`
  from the readiness pair. A partial failure can leave both labels; exit 6 names the repair and
  never reports success. The maintainer or verified assistance clears `ready-for-human`.
  `assisted` preserves unrelated labels, including a pre-existing `ready-for-agent`, and build
  state. A repeated act with no applicable block refuses with exit 3 before writing. After a
  partial write, read current state and keep the required human repair; do not blindly replay.
- `state` prints the facts that the engine reads, one per line: `lane:`, `line:` (the resolver
  line), `build:` (`none`, `planned`, `built`), `plan:` (the id of
  the current `## Plan` comment, or `none`), `open:` (the kind, the comment id, and the missing
  evidence of each open human step, or `none`), and `refusal:` (`current` or `none`).
- Exit status: 0 done, 1 internal error, 2 usage (bad arguments, or a file that the command
  refuses), 3 prerequisite (`issue: prerequisite: #<n> cannot <act>:` and the resolver line),
  6 blocked (GitHub does not answer, or a write failed). When a write after the first failed, the
  line gives the `gh` command that completes each write that is not done, except epic acts, which
  require current-state reconciliation and re-entry through acceptance. Until then, the
  resolver stops a `## Before landing` comment with no `ready-for-human` as an open human step, and
  a failed plan-label addition leaves an unfinished plan. Readiness writes do not record build
  completion ("Resolving an issue's state").

## Labels

The lane labels are `bug`, `enhancement`, `hotfix`, and `chore`, one for each lane. A routed issue
carries exactly one lane label, or `epic` in place of a lane label. The resolver stops an issue with
two or more lane labels until you keep one ("Resolving an issue's state"). The other labels mark
waits and gates.

| Label | Meaning | Set by | Cleared by |
|---|---|---|---|
| `needs-triage` | not yet classified | `/celetis:intake` | `/celetis:triage`, or a lane when it sets its lane label |
| `bug` | existing behavior misbehaves, production not on fire | `/celetis:triage` or `/celetis:bug` | the lane that reclassifies the issue (the row's own lane never clears it) |
| `enhancement` | new behavior — the feature lane | `/celetis:triage` or `/celetis:feature` | the lane that reclassifies the issue; `/celetis:feature`'s scope check when it makes the issue an epic (the one case where the row's own lane clears it) |
| `hotfix` | production broken, the fix ships now | `/celetis:triage` or `/celetis:hotfix` | the lane that reclassifies the issue (the row's own lane never clears it) |
| `chore` | zero-behavior-change edit | `/celetis:triage` or `/celetis:chore` | the lane that reclassifies the issue (the row's own lane never clears it) |
| `epic` | parent of several feature sub-issues | `/celetis:feature` scope check | — |
| `needs-info` | the report lacks what its lane needs; the questions are in a comment | `/celetis:triage` | the reporter's reply, then `/celetis:triage`, or assistance after verified completion |
| `ready-for-agent` | plan posted with no human hold; readiness only | `plan`, when no human hold remains | `built`, `before-landing`, `stopped`, `ready-for-human`, or `plan` under a human hold |
| `ready-for-human` | an assistance block (a landing precondition; a hotfix whose landing stopped; a step session that stopped). The card reads `landing refused` while a landing refusal is current, else `ready for your step` | `implement`, `/celetis:hotfix`, a step session at a stop (`step-prompt.md` of the plugin), or assistance restoring a missing strict removal event | the human, or assistance after verified completion |
| `wontfix` | not actioned; the reason is in a comment | `/celetis:triage`, `specify` | — |

## What lives on the issue

GitHub remains the durable handoff store. Historical issue specs, published plans, and decisions
record their change; later approvals update existing current project documentation through
[Current behavior documentation](procedures/behavior-documentation.md), without rewriting those
historical records. Local `docs/superpowers/` files remain scratch.

- **Runtime evidence** — an ordinary comment whose first line does not start with `## ` holds
  the tested source, actual target, both confirmation links, and scenario outcomes/oracles, or
  links a durable report. [Runtime verification](procedures/runtime-verification.md) defines
  the evidence and its lifetime. Publish it before `## Built` or `## Before landing`. It changes
  no resolver state, clears no refusal, and does not replace `## Human steps done`. Apply its
  [Usage-limit exception](procedures/runtime-verification.md#usage-limit-exception) before creating
  a new quota-only hold; its report keeps each incomplete host check BLOCKED. When the plan has an
  acceptance mapping, the report includes each criterion's outcome, separate check results, evidence,
  and mapping corrections under [Acceptance coverage](procedures/acceptance-coverage.md#reporting).
- **Intent** — `/celetis:intake` writes the intent template as the body of a new issue, or as a comment headed `## Intent` on an existing one. A reporter's body is never rewritten by intake.
- **Spec** — `specify` replaces the body with the design spec (`issue <n> spec <file>`); its first line is `Spec: YYYY-MM-DD`. The body is the current truth for the item.
- **Plan** — `plan` posts the implementation plan as a comment headed `## Plan` (`issue <n> plan <file>`). With no human hold, it adds `ready-for-agent`. With `ready-for-human`, it keeps the hold and removes the agent label when present. A new plan starts a new build. The plan header names the build flow with its `Execution:` line (`inline` or `subagent`), which `implement` follows. Its first section, `### Your steps`, lists the human acts of the lane in two lists: "During the build" (each act that the maintainer does while the build runs, the step that needs it, and its report) and "After the landing" (each check by hand on the built change; nothing in the lane waits for it). Its `## Acceptance coverage` table links approved criteria to work and verification under [Acceptance coverage](procedures/acceptance-coverage.md#mapping), without a second store or mandatory IDs. `implement` in a fresh context re-fetches the latest `## Plan` comment.
- **Human steps done** — a report of completed requested steps, not a claim of human authorship. The maintainer can post it, or assistance can use `issue <n> assisted <file>` after [Assisted completion](procedures/assisted-completion.md). The heading remains `## Human steps done`. The report names the current requests, completed acts, observed results, and each human answer with its source. For "During the build", it follows the latest plan and the applicable precondition comment. `implement` reads these reports and still requires the applicable removal and runtime evidence.
- **Root cause** — `/celetis:bug` and `/celetis:hotfix` post the debugging report as a comment headed `## Root cause` (`issue <n> root-cause <file>`).
- **Prototype** — a look decision ([ui.md](procedures/ui.md), "The look decision") is recorded as a `## Prototype` section inside the spec (the issue body) or the `## Root cause` report, edited in place when that is already posted. It holds the question; the kind and each difference from its default row; the `prototype/<n>-<slug>` branch with its commit; one line per variant, with its pattern and its trade-off; the link of each capture comment, and each capture with example data; the recommendation with its reason; and the verdict with its reason. The captures are comments with attachments whose first line is no `## ` heading, so the resolver does not read them. The capture repro and the after-fix capture of a visual bug take the same form ([ui.md](procedures/ui.md), "Captures").
- **Built** — a `## Built` or `## Before landing` comment after the latest `## Plan` comment records completion. The argument-free act `issue <n> built` posts `## Built`, then removes `ready-for-agent` when present. Readiness labels and their changes do not prove or erase completion. A plan without explicit completion remains unfinished, even when a readiness write failed. There is no compatibility reader for old label-removal completion.
- **Before landing** — a comment headed `## Before landing` names a human precondition that the plan did not name, an act of "During the build" with no report (its report form, and the scenarios that wait for it), or a Verify scenario that a step session could not run and that [Usage-limit exception](procedures/runtime-verification.md#usage-limit-exception) does not permit to remain incomplete; the issue carries `ready-for-human` until the required acts have completion evidence. `issue <n> before-landing <file>` posts it with `<!-- celetis-before-landing general -->` on its second line, or with `<!-- celetis-before-landing during-the-build -->` when `--during-the-build` follows the file, for a comment that names an act of "During the build" ("Completing a human precondition"). The comment also records the change as built. Then it adds `ready-for-human`, and removes `ready-for-agent` when it is on.
- **Landing refused** — a comment headed `## Landing refused` holds the output of `celetis --agent <host> land` at a stop (`issue <n> landing-refused <file>`); a step session then adds `ready-for-human` (`issue <n> ready-for-human`). The refusal is current while this comment is the last comment of the issue that starts with `## ` ("Resolving an issue's state").
- **Stopped** — a comment headed `## Stopped` holds the reason of a stop of a step session for which its skill posts no comment (a refusal of `celetis --agent <host> worktree`, the third failed gate of one task of `implement`, a blocked hotfix), and the act of the maintainer that lets the step go on; `issue <n> stopped <file>` posts it, adds `ready-for-human`, and removes `ready-for-agent` when present. The standalone `ready-for-human` act makes the same readiness change. These acts preserve the actual build state. After verified clearance of the hold, the lane resumes that state without requiring an agent label. `docs/celetis-flow.md`, "How a step runs", defines a step session.
- **External facts of a dependency bump** — `/celetis:chore` posts a comment headed `## External facts`.
- **Finished** — the issue is closed and does not carry `wontfix`.

Local `docs/superpowers/` files are scratch; a fresh session re-fetches from the issue. A product project ignores `docs/superpowers/` and `.claude/worktrees/` in its `.gitignore`: with no entry for `.claude/worktrees/`, a lane worktree makes the main checkout dirty, and the resolver prints the dirty-tree line for each issue.

## Branches, PRs, merge

The main checkout's `.celetis.yaml` owns repository setup (ADR-0015).

Trunk-based. Every issue is its own work item: one lane branch off the trunk, landed by `celetis --agent <host> land` with the `landing` field of the main checkout's `.celetis.yaml`: `pr` is one PR back to the trunk; `merge` is one squash commit on the trunk, with no PR. The trunk is the default branch of the repository on GitHub.

- Branch: `feat/<n>-<slug>` (feature), `fix/<n>-<slug>` (bug), `hotfix/<n>-<slug>`, `chore/<n>-<slug>`.
- Worktree: every command that works on the issue's branch (the four lanes, `specify`, `plan`, `implement`) runs `celetis --agent <host> worktree <n>` (`<n>` or `#<n>`) and binds the exact path it prints, by the host part of [the lane worktree](procedures/worktree.md). Every file, command, instruction read, and child brief then uses that lane path. The script re-enters the issue's local branch; else it checks out the head branch of the issue's open PR (`feat|fix|hotfix|chore/<n>-…`), tracking `origin`; else it creates `<prefix>/<n>-<slug>` off the freshly fetched trunk of `origin`, the prefix from the lane label and the slug from the title (lowercased, each run of other characters than `a-z0-9` turned into one `-`, trimmed of `-` at both ends, at most 30 characters cut at a `-` or hard-cut at 30 when the first word alone is longer, `issue` when empty). On each entry, it reads the name of the trunk from GitHub and fetches the trunk from `origin`; a read or a fetch that fails refuses the entry. Before the setup, it brings an existing branch up to that trunk: a fast-forward when the branch has no commit of its own, else a merge of the trunk with the subject `Merge origin/<trunk> into <branch> (#<n>)`. A branch that contains the trunk does not change. When the branch needs an update and its worktree has uncommitted changes, or when the merge fails, the script refuses and leaves the branch at its tip: commit the changes, or merge the trunk into the branch by hand, then run the step again. It checks the branch out in `.claude/worktrees/<n>-<slug>` and runs the worktree setup of the project (`docs/celetis-flow.md`, "The config and the custom parts"). It refuses an epic, an issue with no lane label (run `/celetis:triage #<n>`), an issue with more than one lane label, and an issue that two branches or two open PRs match. Every later step runs there, so the main checkout never changes branch and flows run side by side. `celetis --agent <host> land` removes the worktree, the lane branch, and the prototype branches after the landing. `celetis --agent <host> worktree --remove <n>` removes them in the two cases with no landing by the script. After a merge by hand: a PR of the branch is merged and the local tip is that PR's head. Without a merge: no PR of the branch is open or merged, the issue is closed or carries `epic`, and every local commit is on an `origin` remote-tracking branch other than the issue's prototype branches (push the branch when the script names it); `specify` runs it after it rejects a design or makes the issue an epic. The script refuses an open issue without `epic` whose branch has no merged PR. If a session-end prompt offers to remove the worktree, keep it; only `celetis --agent <host> land` and `celetis --agent <host> worktree --remove` remove a lane worktree.
- Prototype: a look decision's prototype lives on `prototype/<n>-<slug>`, never on the lane branch. It is not a lane branch: `celetis --agent <host> worktree` does not take it, it is never merged, and it never gets a PR. From the lane worktree, `git worktree add -b prototype/<n>-<slug> <main>/.claude/worktrees/prototype-<n>-<slug>` checks it out (`<main>` is the main checkout). Install there what the dev server of the project needs. A capture script is committed with the variants; install a tool that such a script needs with no change to a tracked file. The captures stay in `docs/superpowers/captures/` of that checkout, which Git ignores, so the branch holds no capture ([ui.md](procedures/ui.md), "Captures"). After the pick, stop its dev server, commit the variants, push the branch, and remove the checkout with `git worktree remove`. The branch stays until the lane is removed: `celetis --agent <host> land`, or `celetis --agent <host> worktree --remove <n>` (`specify` after a rejection or an epic), deletes it with any leftover checkout, locally and on `origin`.
- Every commit message references `#<n>`.
- Landing prerequisites: before each push, PR, re-run of a check, and merge, `celetis --agent <host> land` resolves the issue by "Resolving an issue's state" and refuses it unless the result is a `chore` or `hotfix` step, a **built** change, or **land by hand**. So it refuses a closed issue, an epic, no lane label or two, `needs-info` or `ready-for-human` on the issue, an open human step, and a `feature` or `bug` change that is not built. A change that is already on the trunk skips this check, so a second run completes its cleanup. The exit status names the result, and so does the first word after `land: `: 0 landed (also with a warning), 1 an internal error, 2 `usage`, 3 `prerequisite`, 4 `repair`, 5 `checks`, 6 `blocked`, 7 `cleanup` (the change is on the trunk and the cleanup stopped: run the script again), 128+n a signal. `docs/celetis-flow.md`, "A landing", gives the examples of each class.
- The PR body carries `Closes #<n>`. Merges are squash-only (`gh pr merge --squash`). The PR title is the squash subject of a PR with two or more commits, so it is a Conventional Commit `<type>(<area>): <what> (#<n>)`: `celetis --agent <host> land` refuses a subject that is no Conventional Commit subject, and it gives the subject, with `(#<n>)` after it, to the commit on the trunk (`merge`) and to the title of the PR that it opens (`pr`). A product project with the landing `pr` keeps the repository setting `squash_merge_commit_title` at `COMMIT_OR_PR_TITLE`: with that value, for a PR with one commit, GitHub takes the subject of that commit and adds the PR number, so that commit carries the Conventional Commit subject of the change. An agent lands a change only with `celetis --agent <host> land <n> '<subject>'`, which its build step runs (`/celetis:implement`, `/celetis:chore`). With `pr` it pushes the branch, opens the PR when none is open (title `<subject> (#<n>)`, body `Closes #<n>`), and squash-merges it at the commit that the checks ran on, only when every check passed or was skipped and at least one check passed (ADR-0001, ADR-0008). Each invocation waits for workflow completion before it accepts green checks, including when a dependent job has no check row yet. When each red check is a check of GitHub Actions that failed or timed out, it first re-runs the failed jobs of their workflow runs, once for each commit, and waits up to 15 more minutes (ADR-0023). The README gives the Claude and Codex permission rules for the permitted landing forms and direct-merge restriction. Their scope does not replace the script checks; the maintainer can still merge by hand.

## Epics

A request that spans several features becomes an **epic**: the parent carries `epic` in place of
a lane label and has one native sub-issue per feature. Each child uses its own lane. The parent
has no branch, plan, build, landing, or runner stage. Its current body defines acceptance.

After the last child lands, `land` can complete an independent parent in the active repository
through the shared guard. It validates the parent's full issue URL before completion. A parent
in another repository stays open; the command prints its canonical URL and directs explicit
acceptance from that repository's main checkout.
A combined or unresolved parent stays open; the next action is `/celetis:accept-epic #<parent>`.
The maintainer also uses that explicit skill after a last child closes by hand. Pending children
alone create no human hold. Parent acceptance cannot undo child landing or block its cleanup.

Agree scope through [The epic](procedures/epic.md). Inspect existing children before creating
or linking missing ones. The sub-issues API takes the child's database ID, not its issue number:

```bash
url=$(gh issue create --label enhancement --title "..." --body "...")
cid=$(gh api "repos/{owner}/{repo}/issues/${url##*/}" --jq .id)
gh api --method POST "repos/{owner}/{repo}/issues/<epic>/sub_issues" -F sub_issue_id="$cid"
```

- **List all children**: `gh api --paginate repos/{owner}/{repo}/issues/<epic>/sub_issues --jq '.[] | "\(.html_url) \(.state) \(.title)"'`.
- **Find a child's parent**: `gh api repos/{owner}/{repo}/issues/<n>/parent --jq .number` (404 when standalone). Read the parent's body before designing a child — its decisions bind.

Publish the complete preserved parent body with `issue <n> epic <file>` after the actual child
URLs are known. A later change to acceptance meaning requires a recorded maintainer decision.
Repair issues keep the failed parent criterion and evidence in their brief. Read and reuse an
existing linked repair issue on retries. Acceptance itself changes no retained product code.

## Epic acceptance declaration

The parent body contains exactly one top-level `## Epic acceptance` section. It ends at the next
top-level `## ` heading or end of body. The content is one `json` fence with only whitespace
outside it. CRLF is normalized to LF. Other body text remains human context and is preserved.
These complete sections are valid examples:

````markdown
## Epic acceptance

```json
{"mode":"independent","rationale":"The children have separate outcomes and no shared behavior."}
```
````

````markdown
## Epic acceptance

```json
{
  "mode": "combined",
  "scenarios": [{
    "name": "Imported data appears in search",
    "criterion": "Done when: imported records are searchable.",
    "children": ["https://github.com/owner/project/issues/11"],
    "setup": "Load the authorized sample records.",
    "preparation": "None.",
    "target": "The current project service and search client.",
    "expected": "Search returns the imported record.",
    "timing": "After the import and search children close.",
    "sourceToFiles": "Record the source revision and build artifact digest.",
    "filesToTarget": "Confirm that the service loads that artifact.",
    "oracle": "Read the stored record independently and compare its ID."
  }]
}
```
````

These are exact shapes, with no extension fields. Every string is nonblank and NUL-free. Use
`None.` for absent setup or human preparation. Combined scenarios and each contributing-child
list are nonempty. Names are unique descriptive names. `criterion` quotes or locates the approved
parent outcome; separate observations need separate scenarios. Child references are canonical
full issue URLs from the current child list. Unrelated independent children need no scenario.

Invalid objects include `{"mode":"independent"}` (missing rationale),
`{"mode":"combined","scenarios":[]}` (empty scenarios),
`{"mode":"independent","rationale":"Separate.","scenarios":[]}` (mixed fields), and
`{"mode":"independent","mode":"combined","rationale":"Separate."}` (duplicate key).
Duplicate nested keys, unknown fields, repeated scenario names, malformed child data, a missing
or repeated section, a missing closing fence, and prose inside the section are also invalid.
Parsing never skips a bad block to find a convenient valid one. Missing declarations stay
unresolved; there is no compatibility interpretation or automatic independent default.

## Epic acceptance submission

`issue <n> epic-state` is read-only JSON. Its fields are `repository` (canonical repository URL),
`parent` (number), `data` (current `state`, `labels`, `body`, and ordered `history`), `declaration`,
`children`, and `open` (unresolved human preconditions). A valid `declaration` has `kind: "valid"`,
`acceptance`, and `definitionHash`; otherwise it has `kind: "unresolved"` and `reason`.
The hash is SHA-256 of the exact normalized acceptance section. A changed hash requires coverage
review. Incomplete or malformed tracker data fails the read rather than returning a partial set.

Each sorted child has `url`, positive safe-integer `id` and `number`, `state` (`open` or `closed`),
`stateReason` (`completed`, `not_planned`, `duplicate`, `reopened`, or null), and `closedAt` (ISO
timestamp or null). Duplicate identities are refused. Reopening and closing a child changes its
terminal snapshot. Its state or reason supplies no behavioral PASS.

Independent completion uses `issue <n> complete-epic` without a file. Combined completion needs
one strict JSON file with exactly these fields:

```json
{
  "repository": "https://github.com/owner/project",
  "parent": 10,
  "definitionHash": "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
  "children": [{
    "url": "https://github.com/owner/project/issues/11",
    "id": 211,
    "number": 11,
    "state": "closed",
    "stateReason": "completed",
    "closedAt": "2026-10-31T10:00:00Z"
  }],
  "review": {"session": "current-acceptance-session", "at": "2026-10-31T11:00:00Z"},
  "targets": [{
    "name": "service",
    "source": {"checkout": "/project", "commit": "0123456789abcdef0123456789abcdef01234567", "dirty": false},
    "runtime": "Observed service process 1234 and its endpoint",
    "sourceToFiles": "https://github.com/owner/project/issues/10#issuecomment-900",
    "filesToTarget": "https://github.com/owner/project/issues/10#issuecomment-900"
  }],
  "results": [{
    "scenario": "Imported data appears in search",
    "result": "PASS",
    "target": "service",
    "observation": "Search returned sample record 42.",
    "oracle": "Independent store read found the same record ID and content.",
    "reports": [900]
  }]
}
```

The example identities are illustrative; copy the current repository, parent, hash, and exact
child snapshot from `epic-state`. `review` records this session's nonblank identity and current
ISO timestamp; it attests nothing. Target names are unique. `source.commit` is the full commit;
`dirty: true` additionally requires `snapshot`, a durable reference to the retained diff and
input manifest. `dirty: false` has no snapshot field. `runtime` identifies the actual target,
and the two loading fields reference durable evidence.

Results cover every declared scenario exactly once, with no extras. A PASS has exactly
`scenario`, `result`, `target`, `observation`, `oracle`, and nonempty `reports` (parent comment
IDs). Its target must exist. An approved inapplicable result instead has exactly `scenario`,
`result: "inapplicable"`, `rationale`, and `decision` (the maintainer-decision parent comment ID).
Diagnostic results have exactly `scenario`, `result` (`FAIL`, `BLOCKED`, `unrun`, or `UNVERIFIED`),
`reason`, and nonempty `reports`. None permits completion. Unknown fields and duplicate keys
are refused throughout. Referenced comments must exist in current parent history.

The session checks semantic coverage, evidence truth, actual loaded targets, and evidence
lifetime under [Runtime verification](procedures/runtime-verification.md). The engine checks
shape, coverage, references, and current issue inputs; shared credentials attest neither
authorship nor runtime truth. Publish the ordinary runtime report before submitting. Keep each
criterion part and each mixed result. A child closed as `not_planned` cannot remove a required
result. The usage-limit exception may permit child landing, but never incomplete parent closure.

## Epic completion and repair

An already closed parent returns its state without a write or new PASS. An open parent requires
`epic`, a valid declaration, nonempty complete children all closed, and no `needs-info`,
`ready-for-human`, or unresolved existing human precondition. Combined acceptance also needs a
current fully covered submission. Historical prose, a previous accepted record, and hold
clearance cannot substitute for that submission or current runtime review.

Definition and completion acts share a per-parent process lock in the local Git common
directory. They re-read under the lock. Completion reads again before protected writes and
before close; observed changes to the definition, children, holds, or evidence references refuse
stale completion. Different parents do not share one lock. Separate machines and direct GitHub
writes are outside this serialization boundary; no cross-machine atomic snapshot is claimed.

Definition publication writes the body, then adds `epic` and removes `enhancement` as needed.
Completion posts `## Epic accepted`, a readable summary, and one bounded `json` fence before
closing as `completed`. That fence contains the accepted submission, its `mode`, and stable
`completionId`. The independent record has no targets or results and explicitly requires no
combined runtime check. The identity binds repository, parent, definition, sorted children,
targets, results, and evidence references, excluding only review session and timestamp. Target
and scenario order and reference IDs are normalized. A matching parsed historical record
prevents a duplicate publication; a matching text marker does not.

Exit 2 names invalid input; exit 3 names unmet prerequisites; exit 6 names an access, lock, or
write failure. For a partial definition write, inspect the actual body and labels. For an
uncertain report or close, inspect current history and state before retrying. A published record
with an open parent is partial completion. Repair the specific access or write failure, retain
valid evidence, and re-enter explicit acceptance for fresh checks. Never bypass the guard with
a direct close, blindly repeat an uncertain comment, or claim that an unacknowledged write
failed to reach GitHub. Existing human-repair requirements remain binding.

Acceptance preserves holds and writes `stopped` for a decision, access need, or repair it cannot
resolve. It writes no `Built` or `Before landing`. Verified assistance can clear the block under
[Assisted completion](procedures/assisted-completion.md), then ends. The maintainer re-enters
`/celetis:accept-epic #<n>`; no parent runner starts.

## Completing a human precondition

A `## Before landing` comment belongs to the build it names. Before re-entry can land that
build, require a trusted completion report that its required acts and scenarios completed, or a
removal of `ready-for-human` after that comment; a comment of "During the build", and
a comment with no marker, need both (below). Check the current build and
comment; an older clearance does not clear a newer precondition. Label absence alone is not
completion evidence: a label write can fail.

The engine checks this evidence from the timeline of the issue,
`gh api --paginate 'repos/{owner}/{repo}/issues/<n>/timeline?per_page=100'` (`factsOf` in
`engine/lib/workflow.ts` of the plugin). "After" is a later position in the timeline, not a later
time. The current build starts at the latest `## Plan` comment; for a lane with no `plan` step
(`chore`, `hotfix`), it starts at the start of the issue. A `## Before landing` comment before that
start belongs to an older build. A report or a removal before the comment does not count. The
resolver stops an issue with an open human step ("Resolving an issue's state").

The second line of a `## Before landing` comment is a hidden marker of its kind:
`<!-- celetis-before-landing general -->` for a general precondition, and
`<!-- celetis-before-landing during-the-build -->` for a comment that names an act of "During the
build". A comment with no marker gets the strict rule of "During the build": a report and a removal.

The `unlabeled` event of the timeline identifies `actor`, `created_at`, and `label.name`
([GitHub event types](https://docs.github.com/en/rest/using-the-rest-api/issue-event-types)).
For a general precondition, a later removal of `ready-for-human` is the workflow's
completion signal, as a trusted completion report is. Assistance supplies completion writes only
after [Assisted completion](procedures/assisted-completion.md). Without the evidence that the kind of
the comment needs, keep the change built, restore the human label (`issue <n> ready-for-human`)
using the existing comment as its reason, and stop. No new approval is needed. Each
required scenario still needs PASS unless [Usage-limit exception](procedures/runtime-verification.md#usage-limit-exception)
permits its incomplete coverage. An unrun scenario has no PASS. The exception clears no existing hold
and changes none of its completion requirements.

Workflow clearance is separate from runtime proof. Before skipping a deferred runtime scenario,
apply [Runtime verification](procedures/runtime-verification.md), "Reports and deferred checks"
and "Evidence lifetime", even when the resolver reports `open: none`. Label removal supplies no
build identity or runtime PASS. A completion report must carry or reference the same proof
as an agent check. Missing or invalidated proof keeps the change built and restores its hold;
valid, unchanged proof can complete the scenario without repeating it. These are agent
obligations, not new engine parsing or clearance rules.

When a `## Before landing` comment of this build names an act of "During the build", the evidence
for that act is both: a `## Human steps done` comment after that comment that reports the act, and
a removal of `ready-for-human` after that comment. One or more such reports can
cover the acts that the comment names. The next run of `implement` then runs the scenarios that
waited for the acts, and lands when the runtime procedure permits continuation. For a precondition of the landing, no scenario runs. With
the reports and the removal, the next run lands. An act of "During the build" with no report that
no `## Before landing` comment of this build names stops the landing with a new such comment, also
after an earlier stop of this build. When a strict removal event is missing and the label is
absent, assistance restores the label before `assisted`; missing only the report needs no
restoration. Each `gh` call uses shared authentication, so authorship supplies no independent
attestation. The engine checks shape and timeline state; assistance checks report truth and
scope. A mixed block retains its holds until all affected requests have evidence. Ordinary lane
sessions cannot manufacture human contributions. Completion changes no build mark and permits
no assistance lane continuation or landing.

## Resolving an issue's state

`gh issue view <n> --json state,labels,body`, and the timeline of the issue
(`gh api --paginate 'repos/{owner}/{repo}/issues/<n>/timeline?per_page=100'`) for its comments and
label changes in order.

- **routed** — carries one lane label (`bug`, `enhancement`, `hotfix`, `chore`) or `epic`; unrouted, with neither → `/celetis:triage #<n>`.
- **several lanes** — two or more lane labels: no step starts until you keep one lane label.
- **waiting** — `needs-info` or `ready-for-human`.
- **landing refused** — `ready-for-human`, and a landing refusal is current: the last comment of the issue that starts with `## ` starts with `## Landing refused`. A later comment that starts with `## ` and not with `## Landing refused` (the result of a later step, for example `## Plan` or `## Before landing`) ends the refusal. A comment that does not start with `## ` does not end it. A second refusal is a new comment, and it is current.
- **specced** — the body opens with `Spec:`.
- **planned** — a `## Plan` comment with no later `## Built` or `## Before landing` comment, regardless of readiness labels. An unfinished stop and its clearance keep this state.
- **built** — a `## Built` or `## Before landing` comment after the latest `## Plan` comment; `/celetis:implement #<n>` lands the change and does not build it again. A new plan discards earlier completion for its build.
- **no build plan** — `build: none`; a stop or completion comment without a plan does not create one.
- **human step open** — a `## Before landing` comment of the current build with no completion evidence after it ("Completing a human precondition"). The absence of `ready-for-human` is no evidence.
- **land by hand** — a `hotfix` whose latest `## Landing refused` or `## Before landing` comment has a removal of `ready-for-human` after it: the maintainer lands the change in a shell of their own, and no hotfix step starts.
- **finished** — the issue is closed and does not carry `wontfix`.

`celetis --agent <host> next-step` encodes this resolution as one ordered list, first match wins: closed (`wontfix`, else finished), `needs-info`, `ready-for-human`, `epic`, two or more lane labels (`stop #<n> has several lane labels (<labels>). Keep one lane label and remove the others.`, with the labels in one line, separated by a space), unrouted (`/celetis:triage`), an `enhancement` without a spec (`/celetis:feature`, which runs `specify`), a `bug` without `## Root cause` (`/celetis:bug`), an open human step (`stop #<n> has an open human step. <act>`, with the act that names the missing evidence of the latest open `## Before landing` comment: the report and the removal, the report, or the removal), a `hotfix` to land by hand (`stop #<n> waits for a landing by hand. <act>`, with the `land` command), `chore`, `hotfix`, no `## Plan` comment (`/celetis:plan`), then `/celetis:implement` (planned or built). With a number it prints one line, `run <command>` or `stop <reason>`; with `--open` it prints one row for each open issue, lowest number first: the number, a tab, and that line. Both forms print the dirty-tree line for a dirty checkout. While `celetis --agent <host> land` lands the issue, both print `stop the landing of #<n> runs; wait until celetis --agent <host> land ends`. The form with a number prints it before any `gh` call; `--open` prints it in the row of the issue. The board reads its rows in its own process through the typed board read of the same resolver (`nextBoard` of `next-step.ts`): one row with a state for each open issue (an issue that resolves to `epic` or to a closed `wontfix` has no row), and the open PR of each with its CI result and review state, from these `gh api` calls: 2 paginated lists (open issues and open PRs), one paginated call for the timeline of each open issue that has a comment, and 3 calls for each open PR whose branch holds `/<number>-`. The form with a number reads the timeline of its issue only when the issue has a comment. The runner and the board (`docs/celetis-flow.md`) act on this resolution. A `blocked` row has the `reason` `needs info`, `landing refused`, `ready for your step`, `several lane labels`, `human step open`, or `land by hand`; a refused landing keeps the `stop` line and the `act` of `ready-for-human`. `engine/lib/workflow.ts` of the plugin is the one definition of the labels, the headings that the resolver reads, the lifecycle facts, and this order. A change to a label, a heading, or this order updates that definition in the same PR.


The board's History panel reads remote trunk commits separately within that same refresh. It
captures the default branch head and walks history pinned to it, until 20 distinct issue identities
or exhaustion. A direct Celetis squash resolves its issue suffix to an actual issue; an associated
merged lane PR must match the trunk, repository identities, commit merge SHA, and lane/body issue
number. A PR number is never substituted for its issue. A nonempty but unsupported PR association
has no suffix fallback. Ambiguous associations are omitted. Malformed data or a request failure
retains the last good document with an error. Closing an issue alone supplies no landing evidence.
This panel does not alter the resolver's finished-issue rule or issue state. Each row links the
issue and trunk commit, with commit time; the recent list has no closure window and can include
open issues. A later revert does not erase an earlier landing. `View <trunk>` opens older history.
