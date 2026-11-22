# Issue tracker

Issues are the state store for every lane. The issue key `<n>` is the handle (`#<n>`) that carries work between commands and sessions; state lives in the issue and the repo, never in chat history. The `tracker` field of `.celetis.yaml` names the tracker: `github` (GitHub issues) or `local` ("The local tracker"). The tracker defines the issue key: for GitHub it is the number of the issue, for the local tracker the first 7 characters of the ID of the issue, and each command, file, and JSON value carries it as a string. `<n>` in this document stands for the key. The `gh` CLI infers the repo from the clone, and `{owner}/{repo}` in an API path fills itself in.

The state, headings, paths, and branches are shared by both hosts. `/celetis:<skill>` names the
shared skill. Skills run each `celetis` command with the explicit `--agent claude` or `--agent
codex` ([the entry](../references/procedures/entry.md), "The contract"). Human terminal and board commands can use
the project default. Changing hosts between steps retains the same issue and lane checkout; resume
always uses the host in the current session record.

In this document, these names are files of the repository `celetis`, also when a session reads the document inside a product project that has a `docs/` folder and an ADR store of its own: the three documents `docs/workflow.md`, `docs/issue-tracker.md`, and `docs/capability.md`, the two procedure modules `references/procedures/docs-lookup.md` and `references/procedures/prior-art.md`, and `step-prompt.md` of the plugin folder; a runtime `<name>.ts` of `engine/` or a program of `scripts/` that the text names by its file, which is a file of the repository `celetis`; and each ADR number, which is a record of `docs/adr/` of the repository and not of the product project. Each other path is a path of the product project, apart from a path that starts with `~/` or `/`.

## Conventions

The skills use these forms:

- **Create an issue**: `celetis --agent <host> issue create <file>`. The first line of the file
  is `# Intent: <title>`; the act takes the title from it, posts the whole file as the body, and
  sets `needs-triage`.
- **Read an issue**: `celetis --agent <host> issue <n> view` prints the JSON of the issue: `key`, `title`, `url`, `state`, `labels`, `body`, `parent`, `children`, and `history` (the ordered timeline; each comment has its `author`, `null` when the tracker gives no user). `view --latest '<heading>'` prints the body of the newest comment whose first line is the heading, and exits 3 when none matches. A pull request exits 3, and a read failure exits 6.
- **List issues**: `celetis --agent <host> issue list` prints the open issues with no pull request as a JSON array of `{ key, title, url, labels }`. `--state closed` lists the closed issues in place of the open issues, and `--label <label>` lists only the issues with that one label.
- **Link a sub-issue**: `celetis --agent <host> issue <epic> link <child>` makes the child a sub-issue of the epic; it writes nothing when the link exists.
- **Comment**: `celetis --agent <host> issue <n> comment <file>`, with one
  `--attach '<file>#<alt text>'` for each image or video.

Each issue write in the repository of the checkout goes through an act
([the entry](../references/procedures/entry.md#the-contract), **Tracker.**), so each write leaves
the refresh hint that a running board reads. The acts `view`, `list`, and `link` serve the reads
and the sub-issue link; `gh` serves the code host and the writes to another repository. In this document, `issue <n> <act>` stands for
`celetis --agent <host> issue <n> <act>`, and `issue create <file>` for
`celetis --agent <host> issue create <file>`, which takes no issue key. The command reads the issue
once, checks the prerequisite of the act with the rules of the resolver, and then writes. Epic acts
also use the protected current-state reads in "Epic completion and repair":

<!-- scripts/build.ts writes the act table from engine/lib/contract/contract.ts. Edit that file, then run scripts/build.ts. -->
| Act | Prerequisite | Writes |
|---|---|---|
| `route feature\|bug\|chore\|hotfix` | open; not an epic | the label of the lane; it removes the other lane labels and `needs-triage` |
| `effort <step> <model> <level> <file>` | open | an `Effort: <step> <model> <level>` comment ("What lives on the issue", "Effort"); no label change |
| `create <file>` | none; it takes no issue key | a new issue with the title from the first line `# Intent: <title>`, the whole file as its body, and `needs-triage`; it prints the URL of the new issue first |
| `comment <file> [--attach <file>#<alt>]` | an issue, open or closed; not a pull request | the file as a comment, with each `--attach` file uploaded (the flag repeats, at most 50 times); it refuses a first line that is a lifecycle heading or the effort marker |
| `view [--latest <heading>]` | an issue, open or closed; not a pull request | nothing; the JSON of the issue, or with `--latest` the body of the newest comment whose first line is the heading |
| `list [--state open\|closed] [--label <label>]` | none; it takes no issue key | nothing; the JSON list of the issues in the state (`open` when no `--state`), not pull requests, with `--label` only those with that label |
| `sync` | the local tracker | the local issues: it pulls them from origin, merges them, and pushes them |
| `link <child>` | two open issues, not pull requests; the child has no other parent | the sub-issue link, then the refresh hint of each issue; no write when the link exists |
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
<!-- The end of the act table that scripts/build.ts writes. -->

- The command writes the heading of each lifecycle comment. Its `<file>` holds text with no heading: the
  command refuses a file whose first line that is not blank starts with `## `, and, for `spec`,
  one that starts with `Spec:`. For `effort`, it also refuses a file with no text. `comment`
  instead refuses an empty file, and a file whose text, after leading white space, starts with a
  lifecycle heading or with `Effort:`; the refusal names the act for that record. Other headings,
  for example `## Intent`, `## Captured`, and `## External facts`, pass. `issue create` prints the
  URL of the new issue before any other write: a URL on stdout means that the issue exists, also
  when GitHub dropped `needs-triage` and the act exits 6. `assisted`
  inserts `Reported by the assistance agent (` followed by the selected host in backticks and
  `).` before the supplied report text. The epic definition file instead holds the complete parent
  body, and a completion file holds strict JSON.
- Lifecycle acts post the comment first (ADR-0011). Then they add the labels in one call, remove each label in
  a call of its own, and last changes the body or closes the issue. It never replaces the whole set
  of labels, so a label that a person adds or removes at the same time stays as the person set it.
  A label that is already on, or already off, is no change, and a write with no change is not
  sent. The removal of a label that is already off on the tracker is no failure. Epic definition and
  completion writes follow their separate order in "Epic completion and repair".
- A successful `stopped`, `ready-for-human`, or `before-landing` act leaves only `ready-for-human`
  from the readiness pair. A partial failure can leave both labels; exit 6 names the repair and
  never reports success. The maintainer or verified assistance clears `ready-for-human`.
  `assisted` preserves unrelated labels, including a pre-existing `ready-for-agent`, and build
  state. A repeated act with no applicable block refuses with exit 3 before writing.
- `state` prints the facts that the engine reads, one per line: `lane:`, `line:` (the resolver
  line), `build:` (`none`, `planned`, `built`), `plan:` (the id of
  the current `## Plan` comment, or `none`), `open:` (the kind, the comment id, and the missing
  evidence of each open human step, or `none`), and `refusal:` (`current` or `none`).
- Exit status: 0 done, 1 internal error, 2 usage (bad arguments, or a file that the command
  refuses), 3 prerequisite (a line that names the refused act, and the resolver line),
  6 blocked (the tracker does not answer, or a write failed). When a write after the first failed, the
  line gives the `gh` command that completes each write that is not done, except epic acts, which
  require current-state reconciliation and re-entry through acceptance. Until then, the
  resolver stops a `## Before landing` comment with no `ready-for-human` as an open human step, and
  a failed plan-label addition leaves an unfinished plan. Readiness writes do not record build
  completion ("Resolving an issue's state").

## The local tracker

With `tracker: local`, each issue is a git-bug entity in the main checkout: the ref
`refs/bugs/<ID>`, with bug format version 4. Each author is an identity under
`refs/identities/<ID>`, with identity format version 2. The engine reads and writes these refs with
git plumbing, so the project needs no git-bug program.

- **The key.** The key of a local issue is the first 7 characters of its 64-character ID. A new
  issue gets an ID whose first 7 characters no other local issue has. A key that matches two or
  more local issues, for example after issues come from another machine, is refused:
  `#<key> matches several local issues: <full IDs>`.
- **The URLs.** The URL of an issue is `local:<key>`. The URL of a comment is
  `local:<key>#<operation ID>`; `comment` prints it. In an epic snapshot and its acceptance record,
  the repository is `local`, a child URL is `local:<key>`, and the `id` of a child is its full ID.
- **The author.** The author of each write is the identity that the git config entry
  `git-bug.identity` of the main checkout names. With no entry, it is the local identity whose
  email is `git config user.email`. With no such identity, the engine makes one from `user.name` and
  `user.email`, and sets `git-bug.identity`.

The engine reads each concept of an issue from the git-bug data:

| Concept | git-bug data |
|---|---|
| title | create `title`, then the last set-title operation |
| body | create `message`, then the last edit-comment operation that targets the create |
| state | open; then the last set-status operation (1 open, 2 closed) |
| labels | the set of the label-change operations |
| comment | an add-comment operation; its `id` in `history` is the operation ID |
| label event | each name of `added` or `removed` of a label-change operation, in order |
| `at` | the `timestamp` of the operation, as an ISO time |
| author | the `name` of the identity of the pack, else its `email` |
| parent | the metadata key `celetis-parent` on the create operation, set by a set-metadata operation; the first write wins |
| children | each local issue whose `celetis-parent` is the ID of the epic, in creation-clock order |
| close as not planned | the set-status operation with the inline metadata key `celetis-state-reason: not_planned`; a close with no key is completed |
| `updatedAt`, `closedAt` | the `timestamp` of the last operation, and of the last close |
| pull request | never |

The order of `history` is the replay order of the format: packs by edit clock, ties by pack ID,
and operations in pack order.

- **Writes.** Each write adds one commit on the tip of the issue and moves its ref once with
  `git update-ref <ref> <new> <old>`. When the ref moved in between, the write makes its commit again
  on the new tip, at most 5 times. `create` writes two commits, the create operation and then the
  label change of `needs-triage`, and moves the new ref once, so a failed create writes no ref.
  A new clock follows the highest clock of the local issues up to 2^52; a higher clock, which only
  a forged entity can hold, is not followed, so it cannot stop the writes of the other issues.
  A label that is already on or already off, an equal body, a close of a closed issue, and a link
  that exists write nothing. The format has no label registry: the labels of the tracker are the
  labels of the contract, and a label create writes nothing. Each `--attach <file>#<alt>` file is a
  blob in the `extra/` tree of the pack and in `files` of the operation, and the comment gets the
  line `![<alt>](<blob hash>)`. `git cat-file blob <blob hash>` prints the file.
- **Refusals.** The refs can come from other machines, so the engine checks each entity before it
  uses it: the version, one root, the clocks, the ID of the ref, unique operation IDs, the field
  types, and a known author identity with no public key. A read of one issue whose entity fails a
  check is refused with `refs/bugs/<ID>: <rule>`. A list skips the entity and prints
  `issue: warning: refs/bugs/<ID> is not a valid local issue: <rule>; it is skipped`. An epic
  snapshot is refused when an entity fails a check, because that entity can be a child. No write
  goes on an entity that fails a check. When `refs/config/config` exists, or `git config user.email`
  is not set, each write is refused before it writes, with a line that names the fix.
- **A failed write.** A failed ref move says `nothing was written` only when the ref is still at
  its old value. When the engine cannot read the ref after the failure, the line says that the ref
  can hold the write: read the issue before you write again.
- **Sync.** The local issues travel with `origin`. A pull fetches
  `+refs/bugs/*:refs/remotes/origin/bugs/*` and `+refs/identities/*:refs/remotes/origin/identities/*`,
  moves each fetched identity forward when the local one is behind it, and merges each fetched issue:
  a missing or older local ref moves to the fetched tip, and two diverged histories get a merge
  commit with two parents and an empty `ops` pack. A fetched entity that fails a check, a fetched
  history that git cannot read (the rule `the history cannot be read`), an identity
  that diverged, and an issue with another root are not merged, with the line
  `<command>: warning: <ref> of origin is not merged: <rule>`. One git read of the store holds at
  most 2147483647 bytes of output, the string bound of Bun: a fetched history above it is not merged,
  and when the local histories together pass it, each read and write of the local tracker fails.
  The recovery removes the forged issue everywhere, because a pull merges the remote-tracking ref
  again and a clone that still holds the ref pushes it back: run
  `git update-ref -d refs/bugs/<ID>` in `origin`, and in each clone, before its next sync, run
  `git update-ref -d refs/bugs/<ID>` and `git update-ref -d refs/remotes/origin/bugs/<ID>`.
  Each issue that a pull changes gets its refresh hint. A push sends `refs/bugs/*:refs/bugs/*` and `refs/identities/*:refs/identities/*`,
  with no `+`, no `--force`, no `--prune`, and no `--mirror`; when `origin` refuses a ref, the push
  pulls once and pushes once more.
  - Each write act of `issue` (also `create`, `comment`, `link`, `epic`, and `complete-epic`) and
    the whole landing of `land` pull once at their start and push once at their end, when a local
    ref changed. When `origin` cannot be reached, the write stays in the local refs, the command
    keeps its exit code, and it prints one line:
    `<command>: the local issues are not in sync with origin: <git line>; run celetis --agent <host> issue sync later`.
  - `worktree` pulls at its start, and the auto loop of the daemon pulls before a pass of the
    resolver, at most once in each 60 seconds. The read acts (`view`, `list`, `state`, and
    `epic-state`) do not sync.
  - `issue sync` pulls, then pushes. It exits 6 when `origin` cannot be reached, with the git line.
    With the GitHub tracker it writes nothing and exits 3.

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
[Current behavior documentation](../references/procedures/behavior-documentation.md), without rewriting those
historical records. Local `docs/superpowers/` files remain scratch.

- **Runtime evidence** — an ordinary comment whose first line does not start with `## ` holds the
  tested source, actual target, both confirmation links, and scenario outcomes/oracles, or links a
  durable report. [Runtime verification](../references/procedures/runtime-verification.md) defines the evidence
  and its lifetime. It changes no resolver state, clears no refusal, and does not replace `## Human
  steps done`. The [Usage-limit exception](../references/procedures/runtime-verification.md#usage-limit-exception)
  is the rule of a quota hold. When the plan has an acceptance mapping, the report includes each
  criterion's outcome, separate check results, evidence, and mapping corrections under [Acceptance
  coverage](../references/procedures/acceptance-coverage.md#reporting).
- **Intent** — `/celetis:intake` writes the intent template as the body of a new issue, or as a comment headed `## Intent` on an existing one. A reporter's body is never rewritten by intake.
- **Captured** — `/celetis:capture` posts the work that a chat decided as a comment headed `## Captured`, with the parts `### Decided`, `### Plan`, and `### Open` ([The capture record](../references/procedures/capture.md)). It is a source, like an intent, and it changes no resolver state. It is posted only while the issue decides a Run of `triage`, `specify`, `bug`, or `plan` and `issue <n> state` prints `refusal: none`, so it never ends a current `## Landing refused`. `specify`, `bug`, and `plan` read the newest one as the person's answers and still run each of their checks; a published spec, root cause, or plan binds over it.
- **Effort** — the step before records the model and the effort level of the next step with `issue <n> effort <step> <model> <level> <file>`: a comment whose first line is `Effort: <step> <model> <level>`, then an empty line, then the reason from the file. `<model>` is `haiku`, `sonnet`, `opus`, or `fable`, and `<level>` is `low`, `medium`, `high`, `xhigh`, or `max`. `triage` decides the first lane step (`specify`, `bug`, `chore`, or `hotfix`), `specify` and `bug` decide `plan` (a `bug` session normally writes the plan in the same turn, so the decision of `bug` applies only to a `plan` step that starts in a new session), and `plan` decides `implement`. Nothing decides `triage`: the act refuses it, and the read ignores a `triage` comment. The act needs no lane label, because `triage` decides before it routes the issue. For a `run` line, the resolver reads the newest comment whose first line, with its trailing white space removed, has this form for the step of that line, so the newest decision for a step replaces each earlier one. Its decider is the step before in the current lane, or `triage` for the first step of the lane, so a `plan` decision keeps its pair after a change between `bug` and `feature`. A first line with another form (more text, another letter case, a model that is not one of the four, or a level that is not one of the five) is not a decision, and a comment for another step has no effect. A first line in the old form `Effort: <step> <level>` is no decision either, so it does not hide an older decision in the new form. The start pair is the decision, else the default `opus` and `medium`; a `sessions` pin of the config replaces a value of both, and a change of one start replaces a value of all three ([the engine document](https://github.com/ddinkov10/celetis/blob/main/engine/README.md#the-start-of-a-step), "The start of a step"). The first line is not a `## ` heading, so the heading reads of the resolver ignore the comment.
- **Spec** — `specify` replaces the body with the design spec (`issue <n> spec <file>`); its first line is `Spec: YYYY-MM-DD`. The body is the current truth for the item.
- **Plan** — `plan` posts the implementation plan as a comment headed `## Plan` (`issue <n> plan <file>`). With no human hold, it adds `ready-for-agent`. With `ready-for-human`, it keeps the hold and removes the agent label when present. A new plan starts a new build. The plan header names the build flow with its `Execution:` line (`inline` or `subagent`), which `implement` follows. Its first section, `### Your steps`, lists the human acts of the lane in three lists: "Answers before the build" (each consent that the plan step asked before the publish, the step that needs it, the answer, and its source), "During the build" (each act outside the session that the maintainer does while the build runs, the step that needs it, and its report) and "After the landing" (each check by hand on the built change; nothing in the lane waits for it). Its `## Acceptance coverage` table links approved criteria to work and verification under [Acceptance coverage](../references/procedures/acceptance-coverage.md#mapping), without a second store or mandatory IDs. `implement` in a fresh context re-fetches the latest `## Plan` comment.
- **Human steps done** — a report of completed requested steps, not a claim of human authorship. The maintainer can post it, or assistance can use `issue <n> assisted <file>` after [Assisted completion](../references/procedures/assisted-completion.md). The heading remains `## Human steps done`. The report names the current requests, completed acts, observed results, and each human answer with its source. For "During the build", it follows the latest plan and the applicable precondition comment. `implement` reads these reports and still requires the applicable removal and runtime evidence.
- **Root cause** — `/celetis:bug` and `/celetis:hotfix` post the debugging report as a comment headed `## Root cause` (`issue <n> root-cause <file>`).
- **Prototype** — a look decision ([ui.md](../references/procedures/ui.md), "The look decision") is recorded as a `## Prototype` section inside the spec (the issue body) or the `## Root cause` report, edited in place when that is already posted. It holds the question and the path; the kind and each difference from its default row; the `prototype/<n>-<slug>` branch with its commit; on the hand-built path, one line per variant, with its pattern and its trade-off, and the recommendation with its reason; on the `impeccable` path, the dealt cards (name, `kind`, one line each) and the locked card, or the accepted variant and each `generate` tuning; the link of each capture comment, and each capture with example data; and the verdict with its reason, which on the `impeccable` path is the lock or the accept of the maintainer. The captures are comments with attachments whose first line is no `## ` heading, so the resolver does not read them. The capture repro and the after-fix capture of a visual bug take the same form ([ui.md](../references/procedures/ui.md), "Captures"). On the whole-app path, the record also holds the full text of the locked card and each key of the inventory that the prototype covered, and the body of a whole-app epic holds it for the children ([ui.md](../references/procedures/ui.md#the-whole-app), "The whole app").
- **Diagnosis** — the diagnosis of a whole-app revision ([ui.md](../references/procedures/ui.md#the-whole-app), "The whole app") is a comment whose first line is `Diagnosis: the layout of the whole app`, with `part <i> of <k>` at the end when the captures need more than one comment. It holds the commit of the app, the inventory, and the findings, with the captures as attachments. Its first line is no `## ` heading, so the resolver does not read it. The spec (the issue body), or the body of the epic parent, holds a `## Diagnosis` section before `## Prior art`: the link of each diagnosis comment, the inventory with its keys, and the number of findings of each grade.
- **Constitution** — when the product project has a `CONSTITUTION.md`, the spec (the issue body), the plan, and the `## Root cause` report can hold a `## Constitution` section ([The constitution check](../references/procedures/constitution.md)). It is a section inside the document, not a comment, so the resolver does not read it.
- **Built** — a `## Built` or `## Before landing` comment after the latest `## Plan` comment records completion. The argument-free act `issue <n> built` posts `## Built`, then removes `ready-for-agent` when present. Readiness labels and their changes do not prove or erase completion. A plan without explicit completion remains unfinished, even when a readiness write failed. There is no compatibility reader for old label-removal completion.
- **Before landing** — a comment headed `## Before landing` names a human precondition that the plan did not name, an act of "During the build" with no report (its report form, and the scenarios that wait for it), or a Verify scenario that a step session could not run and that [Usage-limit exception](../references/procedures/runtime-verification.md#usage-limit-exception) does not permit to remain incomplete; the issue carries `ready-for-human` until the required acts have completion evidence. `issue <n> before-landing <file>` posts it with `<!-- celetis-before-landing general -->` on its second line, or with `<!-- celetis-before-landing during-the-build -->` when `--during-the-build` follows the file, for a comment that names an act of "During the build" ("Completing a human precondition"). The comment also records the change as built. Then it adds `ready-for-human`, and removes `ready-for-agent` when it is on.
- **Landing refused** — a comment headed `## Landing refused` holds the output of `celetis --agent <host> land` at a stop (`issue <n> landing-refused <file>`); a step session then adds `ready-for-human` (`issue <n> ready-for-human`). The refusal is current while this comment is the last comment of the issue that starts with `## ` ("Resolving an issue's state").
- **Stopped** — a comment headed `## Stopped` holds the reason of a stop of a step session for which its skill posts no comment (a refusal of `celetis --agent <host> worktree`, the third failed gate of one task of `implement`, a blocked hotfix), and each act outside the session that lets the step go on ([The check before a stop](../references/procedures/stop.md#the-check-before-a-stop)); `issue <n> stopped <file>` posts it, adds `ready-for-human`, and removes `ready-for-agent` when present. The standalone `ready-for-human` act makes the same readiness change. These acts preserve the actual build state. After verified clearance of the hold, the lane resumes that state without requiring an agent label. `docs/workflow.md`, "How a step runs", defines a step session.
- **External facts of a dependency bump** — `/celetis:chore` posts a comment headed `## External facts`.
- **Security review** — the security-review task of a plan posts one comment headed `## Security review` (`issue <n> comment <file>`) when it has a `needs_validation` finding or a `confirmed` finding from before the change ([security.md](../references/procedures/security.md), "The findings"). The resolver reads no heading of it, but as each comment that starts with `## `, it ends a current `## Landing refused` ("Resolving an issue's state").
- **Finished** — the issue is closed and does not carry `wontfix`.

Local `docs/superpowers/` files are scratch; a fresh session re-fetches from the issue. A product project ignores `docs/superpowers/` and `.claude/worktrees/` in its `.gitignore`: with no entry for `.claude/worktrees/`, a lane worktree makes the main checkout dirty, and the resolver prints the dirty-tree line for each issue.

## Branches, PRs, merge

The main checkout's `.celetis.yaml` owns repository setup (ADR-0015).

Trunk-based. Every issue is its own work item: one lane branch off the trunk, landed by `celetis --agent <host> land` with the `landing` field of the main checkout's `.celetis.yaml`: `pr` is one PR back to the trunk; `merge` is one squash commit on the trunk, with no PR. The trunk is the default branch of `origin`, read from the code host of the landing (GitHub with `pr`, `git ls-remote --symref origin HEAD` with `merge`).

- Branch: `feat/<n>-<slug>` (feature), `bugfix/<n>-<slug>` (bug), `hotfix/<n>-<slug>`, `chore/<n>-<slug>`.
- Worktree: every command that works on the issue's branch (the four lanes, `specify`, `plan`, `implement`) runs `celetis --agent <host> worktree <n>` (`<n>` or `#<n>`) and binds the exact path it prints, by the host part of [the lane worktree](../references/procedures/worktree.md). The script re-enters the issue's local branch; else it checks out the head branch of the issue's open PR (`feat|bugfix|hotfix|chore/<n>-…`), tracking `origin`; else it creates `<prefix>/<n>-<slug>` off the freshly fetched trunk of `origin`, the prefix from the lane label and the slug from the title (lowercased, each run of other characters than `a-z0-9` turned into one `-`, trimmed of `-` at both ends, at most 30 characters cut at a `-` or hard-cut at 30 when the first word alone is longer, `issue` when empty). On each entry, it reads the name of the trunk from the code host of the landing (GitHub with `pr`, `git ls-remote --symref origin HEAD` with `merge`) and fetches the trunk from `origin`; a read or a fetch that fails refuses the entry. Before the setup, it brings an existing branch up to that trunk: a fast-forward when the branch has no commit of its own, else a merge of the trunk with the subject `Merge origin/<trunk> into <branch> (#<n>)`. A branch that contains the trunk does not change. When the branch needs an update and its worktree has uncommitted changes, the script refuses and leaves the branch at its tip: commit the changes first. When the merge stops on a conflict, the script aborts the merge, keeps the lane checkout (also one that this run created), prints its path, and exits 4, with the branch at its tip, a clean tree, and no merge in progress ([A conflict with the trunk](../references/procedures/worktree.md#a-conflict-with-the-trunk)). When the merge fails for another cause, the script refuses with exit 6 and removes a checkout and a branch that this run created: merge the trunk into the branch by hand, then run the step again. It checks the branch out in `.claude/worktrees/<n>-<slug>` and runs the worktree setup of the project (`docs/configuration.md`, "Setup file and instruction text"). It refuses an epic, an issue with no lane label (run `/celetis:triage #<n>`), an issue with more than one lane label, and an issue that two branches or two open PRs match. Every later step runs there, so the main checkout never changes branch and flows run side by side. `celetis --agent <host> land` removes the worktree, the lane branch, and the prototype branches after the landing. `celetis --agent <host> worktree --remove <n>` removes them in the two cases with no landing by the script. After a merge by hand: a PR of the branch is merged and the local tip is that PR's head. Without a merge: no PR of the branch is open or merged, the issue is closed or carries `epic`, and every local commit is on an `origin` remote-tracking branch other than the issue's prototype branches (push the branch when the script names it); `specify` runs it after it rejects a design or makes the issue an epic. The script refuses an open issue without `epic` whose branch has no merged PR. Only `celetis --agent <host> land` and `celetis --agent <host> worktree --remove` remove a lane worktree.
- Prototype: a look decision's prototype lives on `prototype/<n>-<slug>`, never on the lane branch. It is not a lane branch: `celetis --agent <host> worktree` does not take it, it is never merged, and it never gets a PR. Its checkout and variants: [ui.md](../references/procedures/ui.md), "Where the variants live". The captures stay in `docs/superpowers/captures/` of that checkout, which Git ignores, so the branch holds no capture ([ui.md](../references/procedures/ui.md), "Captures"). The branch stays until the lane is removed: `celetis --agent <host> land`, or `celetis --agent <host> worktree --remove <n>` (`specify` after a rejection or an epic), deletes it with any leftover checkout, locally and on `origin`.
- Landing prerequisites: before each push, PR, re-run of a check, and merge, `celetis --agent <host> land` resolves the issue by "Resolving an issue's state" and refuses it unless the result is a `chore` or `hotfix` step, a **built** change, or **land by hand**. So it refuses a closed issue, an epic, no lane label or two, `needs-info` or `ready-for-human` on the issue, an open human step, and a `feature` or `bug` change that is not built. A change that is already on the trunk skips this check, so a second run completes its cleanup. The exit status names the result, and so does the first word of the `land` line after its prefix: 0 landed (also with a warning), 1 an internal error, 2 `usage`, 3 `prerequisite`, 4 `repair`, 5 `checks`, 6 `blocked`, 7 `cleanup`, 128+n a signal. `docs/workflow.md`, "A landing", gives the examples of each class.
- The PR body carries `Closes #<n>`. Merges are squash-only (`gh pr merge --squash`). The PR title is the squash subject of a PR with two or more commits, so it is a Conventional Commit `<type>(<area>): <what> (#<n>)`: `celetis --agent <host> land` refuses a subject that is no Conventional Commit subject, and it gives the subject, with `(#<n>)` after it, to the commit on the trunk (`merge`) and to the title of the PR that it opens (`pr`). A product project with the landing `pr` keeps the repository setting `squash_merge_commit_title` at `COMMIT_OR_PR_TITLE`: with that value, for a PR with one commit, GitHub takes the subject of that commit and adds the PR number, so that commit carries the Conventional Commit subject of the change. `gh api 'repos/{owner}/{repo}' --jq .squash_merge_commit_title` prints the value. The build step (`/celetis:implement`, `/celetis:chore`) lands a change with `celetis --agent <host> land <n> '<subject>'`. With `pr` it pushes the branch, opens the PR when none is open (title `<subject> (#<n>)`, body `Closes #<n>`), and squash-merges it at the commit that the checks ran on, only when every check passed or was skipped and at least one check passed (ADR-0001, ADR-0008). Each invocation waits for workflow completion before it accepts green checks, including when a dependent job has no check row yet. When each red check is a check of GitHub Actions that failed or timed out, it first re-runs the failed jobs of their workflow runs, once for each commit, and waits up to 15 more minutes (ADR-0023). A workflow run of the PR head that failed to start, or that ended not green with no check run, is a red check with no re-run: the landing refuses the PR (ADR-0093). The README, "Personal landing permission", gives the allow rules of the landing forms, and `docs/setup.md`, "Claude permissions: `.claude/settings.json`" and "Codex permissions: `.codex/rules/celetis.rules`", give the direct-merge restriction. Their scope does not replace the script checks; the maintainer can still merge by hand.

## Epics

A request that spans several features becomes an **epic**: the parent carries `epic` in place of
a lane label and has one native sub-issue per feature. Each child uses its own lane. The parent
has no branch, plan, build, landing, or run stage. Its current body defines acceptance.

After the last child lands, `land` can complete an independent parent in the active repository
through the shared guard. It validates the parent's full issue URL before completion. A parent
in another repository stays open; the command prints its canonical URL and directs explicit
acceptance from that repository's main checkout.
A combined or unresolved parent stays open; the next action is `/celetis:accept-epic #<parent>`.
The maintainer also uses that explicit skill after a last child closes by hand. Pending children
alone create no human hold. Parent acceptance cannot undo child landing or block its cleanup.

The sub-issues API takes the child's database ID, not its issue number.
[The epic](../references/procedures/epic.md#the-children) holds the recipe that creates and links a child, and
the forms that list the children and find a child's parent.

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

These are exact shapes, with no extension fields. Every string is nonblank and NUL-free. An absent
setup or human preparation is `None.` Combined scenarios and each contributing-child
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
`parent` (the issue key, as a JSON string), `data` (current `state`, `labels`, `body`, and ordered `history`), `declaration`,
`children`, and `open` (unresolved human preconditions). A valid `declaration` has `kind: "valid"`,
`acceptance`, and `definitionHash`; otherwise it has `kind: "unresolved"` and `reason`.
The hash is SHA-256 of the exact normalized acceptance section. A changed hash requires coverage
review. Incomplete or malformed tracker data fails the read rather than returning a partial set.

Each sorted child has `url`, `id` (the child ID of the tracker, as a JSON string), `number` (the issue key, as a JSON string),
`state` (`open` or `closed`),
`stateReason` (`completed`, `not_planned`, `duplicate`, `reopened`, or null), and `closedAt` (ISO
timestamp or null). Duplicate identities are refused. Reopening and closing a child changes its
terminal snapshot. Its state or reason supplies no behavioral PASS.

Independent completion uses `issue <n> complete-epic` without a file. Combined completion needs
one strict JSON file with exactly these fields:

```json
{
  "repository": "https://github.com/owner/project",
  "parent": "10",
  "definitionHash": "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
  "children": [{
    "url": "https://github.com/owner/project/issues/11",
    "id": "211",
    "number": "11",
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
    "reports": ["900"]
  }]
}
```

The example identities are illustrative. `review` records this session's nonblank identity and
current ISO timestamp; it attests nothing. Target names are unique. `source.commit` is the full
commit; `dirty: true` additionally requires `snapshot`, a durable reference to the retained diff
and input manifest. `dirty: false` has no snapshot field. `runtime` identifies the actual target,
and the two loading fields reference durable evidence.

Results cover every declared scenario exactly once, with no extras. A PASS has exactly
`scenario`, `result`, `target`, `observation`, `oracle`, and nonempty `reports` (parent comment
IDs, as JSON strings). Its target must exist. An approved inapplicable result instead has exactly `scenario`,
`result: "inapplicable"`, `rationale`, and `decision` (the maintainer-decision parent comment ID, as a JSON string).
Diagnostic results have exactly `scenario`, `result` (`FAIL`, `BLOCKED`, `unrun`, or `UNVERIFIED`),
`reason`, and nonempty `reports`. None permits completion. Unknown fields and duplicate keys
are refused throughout. Referenced comments must exist in current parent history.

The engine checks shape, coverage, references, and current issue inputs; shared credentials
attest neither authorship nor runtime truth.

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

Exit 2 names invalid input; exit 3 names unmet prerequisites or a busy completion lock; exit 6 names
an access or write failure. A published record with an open parent is partial completion.
[The epic](../references/procedures/epic.md#a-partial-write) holds the repair steps.

Acceptance preserves holds and writes `stopped` for a decision, access need, or repair it cannot
resolve. It writes no `Built` or `Before landing`. Verified assistance can clear the block under
[Assisted completion](../references/procedures/assisted-completion.md), then ends. The maintainer re-enters
`/celetis:accept-epic #<n>`; no parent run starts.

## Completing a human precondition

A `## Before landing` comment belongs to the build it names. Before re-entry can land that
build, require a trusted completion report that its required acts and scenarios completed, or a
removal of `ready-for-human` after that comment; a comment of "During the build", and
a comment with no marker, need both (below). The engine counts only a report or a removal after the
comment of the current build (below). Label absence alone is not completion evidence: a label write
can fail.

The engine checks this evidence from the timeline of the issue, which the tracker port reads
with `history` (the `history` of `issue <n> view`; `factsOf` in
`engine/lib/workflow/workflow.ts` of the engine). "After" is a later position in the timeline, not a later
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
completion signal, as a trusted completion report is.

Workflow clearance is separate from runtime proof: label removal supplies no build identity or
runtime PASS. The agent duties are in [Runtime verification](../references/procedures/runtime-verification.md),
"Reports and deferred checks", [Assisted completion](../references/procedures/assisted-completion.md), and
[the landing step](../references/procedures/landing.md), "Step 2: the human precondition".

When a `## Before landing` comment of this build names an act of "During the build", the evidence
for that act is both: a `## Human steps done` comment after that comment that reports the act, and
a removal of `ready-for-human` after that comment. One or more such reports can
cover the acts that the comment names. The next run of `implement` then runs the scenarios that
waited for the acts, and lands when the runtime procedure permits continuation. For a precondition of the landing, no scenario runs. With
the reports and the removal, the next run lands. Each `gh` call uses shared authentication, so
authorship supplies no independent attestation. The engine checks shape and timeline state.

## Resolving an issue's state

`issue <n> view` reads `state`, `labels`, and `body`, and its `history` (the timeline of the issue)
holds the comments and the label changes in order.

- **routed** — carries one lane label (`bug`, `enhancement`, `hotfix`, `chore`) or `epic`; unrouted, with neither → `/celetis:triage #<n>`.
- **several lanes** — two or more lane labels: no step starts until you keep one lane label.
- **waiting** — `needs-info` or `ready-for-human`.
- **landing refused** — `ready-for-human`, and a landing refusal is current: the last comment of the issue that starts with `## ` starts with `## Landing refused`. A later comment that starts with `## ` and not with `## Landing refused` (the result of a later step, for example `## Plan` or `## Before landing`) ends the refusal. A comment that does not start with `## ` does not end it. A second refusal is a new comment, and it is current.
- **specced** — the body opens with `Spec:`.
- **planned** — a `## Plan` comment with no later `## Built` or `## Before landing` comment, regardless of readiness labels. An unfinished stop and its clearance keep this state.
- **built** — a `## Built` or `## Before landing` comment after the latest `## Plan` comment; `/celetis:implement #<n>` lands the change and does not build it again. A new plan discards earlier completion for its build.
- **no build plan** — the `build:` fact of `state` is `none`; a stop or completion comment without a plan does not create one.
- **human step open** — a `## Before landing` comment of the current build with no completion evidence after it ("Completing a human precondition"). The absence of `ready-for-human` is no evidence.
- **land by hand** — a `hotfix` whose latest `## Landing refused` or `## Before landing` comment has a removal of `ready-for-human` after it: the maintainer lands the change in a shell of their own, and no hotfix step starts.
- **finished** — the issue is closed and does not carry `wontfix`.

`celetis --agent <host> next-step` encodes this resolution as one ordered list, first match wins: closed (`wontfix`, else finished), `needs-info`, `ready-for-human`, `epic`, two or more lane labels (a stop that lists the labels in one line, separated by a space, and tells you to keep one lane label), unrouted (`/celetis:triage`), an `enhancement` without a spec (`/celetis:feature`, which runs `specify`), a `bug` without `## Root cause` (`/celetis:bug`), an open human step (a stop that names the open human step, with the act that names the missing evidence of the latest open `## Before landing` comment: the report and the removal, the report, or the removal), a `hotfix` to land by hand (a stop that says the landing waits for your hand, with the `land` command), `chore`, `hotfix`, no `## Plan` comment (`/celetis:plan`), then `/celetis:implement` (planned or built). With a number it prints one line, `run <command>` or `stop <reason>`; with `--open` it prints one row for each open issue, lowest number first: the number, a tab, and that line. Both forms print the dirty-tree line for a dirty checkout. While `celetis --agent <host> land` lands the issue, both print a stop that tells you to wait until `land` ends. The form with a number prints it before any `gh` call; `--open` prints it in the row of the issue. The board reads its rows in its own process through the typed board read of the same resolver (`nextBoard` of `engine/lib/resolver/resolver.ts`): one row with a state for each open issue (an issue that resolves to `epic` or to a closed `wontfix` has no row), and the open PR of each with its CI result and review state, from these `gh api` calls for a full collection: 2 paginated lists (open issues and open PRs), one paginated call for the timeline of each open issue that has a comment, and 3 calls for each open PR whose branch holds `/<number>-`. The form with a number reads the timeline of its issue only when the issue has a comment. The daemon ([the engine document](https://github.com/ddinkov10/celetis/blob/main/engine/README.md)) and the board ([the board document](https://github.com/ddinkov10/celetis/blob/main/engine/board/README.md)) act on this resolution. A `blocked` row has the `reason` `needs info`, `landing refused`, `ready for your step`, `several lane labels`, `human step open`, or `land by hand`; a refused landing keeps the `stop` line and the `act` of `ready-for-human`. `engine/lib/contract/contract.ts` of the engine defines the labels and the headings that the resolver reads, and `engine/lib/workflow/workflow.ts` defines the lifecycle facts and this order. A change to a label, a heading, or this order updates that definition in the same PR.


A selected board collection reads each selected issue and its timeline, lists open PRs once,
and fetches check and review details only for matching issue branches. It uses the full
collection's row rules and keeps unrelated rows. Closed issues, PR objects, and an explicit 404
from the initial issue request remove a selected row. A failed timeline, permission request,
or malformed response fails the batch. A selected issue in the current queue permits the
existing queue reconciliation, including its queued-issue reads and live-owner checks.

The board's History panel reads remote trunk commits during a full read, or once when a
selected batch finds a closed issue. Other selected reads retain History. It
captures the default branch head and walks history pinned to it, until 20 distinct issue identities
or exhaustion. A direct Celetis squash resolves its issue suffix to an actual issue; an associated
merged lane PR must match the trunk, repository identities, commit merge SHA, and lane/body issue
number. A PR number is never substituted for its issue. A nonempty but unsupported PR association
has no suffix fallback. Ambiguous associations are omitted. Malformed data or a request failure
retains the last good document with an error. Closing an issue alone supplies no landing evidence.
This panel does not alter the resolver's finished-issue rule or issue state. Each row links the
issue and trunk commit, with commit time; the recent list has no closure window and can include
open issues. A later revert does not erase an earlier landing. `View <trunk>` opens older history.
