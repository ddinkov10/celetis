# A step stops only for an act outside the session

## Date

2026-11-03

## Related

- [Issue #234](https://github.com/ddinkov10/celetis/issues/234): its approved spec
  (`Spec: 2026-11-03`), the decisions of the maintainer, and its plan.
- [ADR-0008](0008-the-build-step-lands-the-change.md): the build step lands the change.
- [ADR-0011](0011-a-step-session-hands-a-stop-to-the-issue.md): a step session hands a stop to the
  issue. This record changes a part of it (Supersedes).
- [ADR-0021](0021-the-plan-names-the-human-acts-of-a-lane.md): the plan names the human acts of a
  lane. This record changes a part of it (Supersedes).
- [ADR-0041](0041-the-engine-owns-the-attempts-and-checks-each-dispatch.md) and
  [ADR-0049](0049-the-engine-binds-dispatch-report-identity.md): the dispatch stops (exit 4 and 5)
  and their mismatch guard stay.
- [ADR-0055](0055-assistance-can-complete-verified-holds.md): assistance stays, and it sees fewer
  holds.
- [ADR-0062](0062-each-session-runs-in-a-tab-that-the-runner-steers.md): each session runs in a
  tab of its own, where it can wait for an answer.
- `docs/procedures/stop.md` ("The check before a stop", "A Verify scenario that cannot run",
  "Claude Code", "Codex"), rules 2 and 4 of `step-prompt.md`, `docs/procedures/worktree.md`
  ("A conflict with the trunk"), `docs/procedures/landing.md`, the skills `plan` and `implement`,
  `engine/worktree.ts`, and `engine/land.ts`.

## Supersedes

From ADR-0011, "A step session hands a stop to the issue: a comment, then `ready-for-human`", the
rejection of "A question in the pane" in "Alternatives considered", for a Verify scenario whose
guard refusal the maintainer can lift in the session. Such a scenario now asks a live question
that names the exact command. A scenario that needs an act outside the session keeps the hold of
ADR-0011.

From ADR-0021, "The plan names the human acts of a lane, and a check by hand runs after the
landing", the sentence "A guard refusal keeps the rules of ADR-0011." A guard refusal now follows
"A Verify scenario that cannot run" of `docs/procedures/stop.md`.

This record also amends ADR-0021: "During the build" lists only acts outside the session, and a
consent moves to a new first list of `### Your steps`, "Answers before the build". A preparation
of an agent check or a precondition of the landing stays in "During the build" only when it is an
act outside the session. The sort rule, the report, and "After the landing" of ADR-0021 stand.

From ADR-0040, "The planner chooses the build flow", the paragraph "An invalid line", for a hotfix
micro-plan: the session writes the fixed first line `Execution: inline — one task` itself and goes
on. The act is agent work by "The check before a stop" of `docs/procedures/stop.md`. An invalid
line of a plan from the issue keeps the stop of ADR-0040.

ADR-0011 names this case in its "Reconsider when": "A step session … asks at a stop." The rest of
each record stands.

## Context

Steps added `ready-for-human` for work that the agent could do itself, or for an answer of one
word. The maintainer then started an assist session, the assist asked "do you approve", the
maintainer said yes, and the hold cleared. Each such hold cost an assist session, a fresh step
session that read everything again, and the attention of the maintainer.

## Constraints and evidence

The 66 stop comments (`## Stopped`, `## Before landing`, `## Landing refused`) of
`ddinkov10/celetis` from 2026-10-14 to 2026-11-02, and the 17 `## Human steps done` reports, fall
into these groups (the spec of #234, "Evidence"):

| Group | Holds | What cleared them |
| --- | --- | --- |
| Agent work: a conflict with the trunk at the worktree entry | #104, #106, #140, #177, #189 | The assist agent merged and resolved the conflict (#177, #189) |
| Agent work: a clean main checkout behind `origin/main` | #100, #187, #188 | The assist agent only observed that the checkout was level |
| Agent work: the agent's own dispatch report error | #106, #147, #164, #166, #189 | "Clear the hold and start again"; the cause can no longer occur since ADR-0049 |
| Bare consent | #182, #232 | "Herdr window checks: allowed": the plan made a consent an act of "During the build" with a report line |
| A guard refusal | #185 | The auto-mode classifier refused a transfer to the hosts; the assist got "yes" |
| A pick | #189 | The maintainer picked one of three repair approaches in an assist session |
| A wait for another issue | #101, #102, #107 (twice) | The maintainer cleared the label after the dependency landed |
| An act outside the session | #85, #104, #124, #126, #164, #193, #232, and the host setup stops | Another machine, a Codex hook trust prompt, a `celetis update` confirmation, an SSH passphrase, an install on the maintainer's machine, a stale plugin cache |

Host facts, read on 2026-11-03:

- Claude Code 2.1.317: in auto mode, a blocked action is listed in the **Recently blocked** tab of
  `/permissions`, and the maintainer approves it there so that Claude may retry; the session keeps
  running. A message of the maintainer lifts a block only when it names the exact action; a
  general "yes" does not count. After 3 blocks in a row or 20 in total, auto mode pauses and asks.
  Source: https://code.claude.com/docs/en/auto-mode-config and
  https://code.claude.com/docs/en/permission-modes.
- Claude Code: the refusal of a `deny` rule says only that the permission has been denied. The
  maintainer cannot lift it in the session.
- Codex CLI 0.166.0: with the approval policy `on-request`, Codex asks for the approval itself.
  With `never`, no prompt can come. Source: https://learn.chatgpt.com/docs/agent-approvals-security.
- git 2.56.0: a `merge --no-ff` that stops on a conflict exits 1 and leaves unmerged paths
  (`git ls-files -u`); after `merge --abort` the tree is clean and no merge is in progress.

The prior art: a GitHub Actions job that waits for a required reviewer pauses and goes on after the
approval, and a rejection fails it, with no new run. The GitHub Copilot cloud agent merges the base
branch into its pull request, resolves the conflicts itself, and then requests a review of the
resolution. `git pull --ff-only` moves a branch only when it is behind.

## Decision

**The decisions of the maintainer** (the `specify` session of #234, 2026-11-03):

1. **The answer split.** An answer that the plan can see before the build is asked by the plan
   step before it publishes the plan. A quick answer during the build (a yes, a no, a pick) is a
   live question in the tab of the step, and the same session goes on after it. A hold stays only
   for an act outside the session. The maintainer accepted that a live question holds the queue
   until the answer.
2. **The merge stays in the step for now.** The agent resolves a conflict with the trunk itself.
   A merger skill or agent is a later enhancement.
3. **One rule in the stop module, plus targeted fixes** (approach 1 of the spec).

**The check before a stop.** `docs/procedures/stop.md` holds one check, and each place that makes a
hold or names an act of the maintainer cites it. Before a stop, the step sorts each act that the
stop would ask of the maintainer:

1. **Agent work.** The session can do the act within its host permissions, the approved spec, and
   the plan: it does it and goes on. Examples: a conflict with the trunk, a fix of an error of the
   session, a re-run, a wait for a resource of the session that frees itself.
2. **A live question.** An answer in words (a yes, a no, a pick, or a value that the maintainer
   knows) lets this session go on: the step asks in the session and waits (rule 2 of the step
   text). It records the answer and its source on the issue.
3. **A hold.** The act needs the maintainer outside the session (another machine or device, an
   account that the session does not have, a host trust or confirmation prompt, a secret, a change
   of the host settings, an install on the maintainer's machine, an explicit deferral), or no
   answer lets this session go on. The hold comment names only these acts.

An answer comes only from the maintainer in the session: silence is no yes, the step invents no
answer and no consent, and a question never asks for a go-ahead or a review of the step's own
result.

**Consents at plan time.** `plan` asks each consent that a Verify scenario or Land needs before it
publishes the plan: an act that disturbs the maintainer's live tools, changes an account or a
shared resource, or sends data to a service beyond the normal use of the session. It records each
answer and its source in "Answers before the build", the first list of `### Your steps`.
`implement` and the landing use that answer and do not ask again. "During the build" lists only
acts outside the session.

**A guard refusal.** A Verify scenario whose command a guard refuses keeps its first rule: one
safer form, and no other route. When the safer form also fails and the maintainer can lift the
guard in the session, the step asks a live question that names the exact command and how to
approve it, and after an approval it runs the command once more. A "no", a second refusal, or a
guard that the maintainer cannot lift in the session (a `deny` rule, the worktree guard after its
safer form) is the `## Before landing` hold of ADR-0011.

**A conflict with the trunk.** `celetis worktree <n>` exits 4 on a conflict with the trunk. It
keeps the lane checkout, leaves the branch at its tip with a clean tree and no merge in progress,
and prints the checkout path. The session merges `origin/<trunk>` there with the subject of the
entry, reads the other side so that it keeps the behavior of both, runs the entry again, and runs
the verify gate. After the final review, the merge is a `land-<k>` fix task with its task review.
Each other refusal of `worktree` keeps its status and its cleanup.

**A main checkout behind the trunk.** With the landing `merge`, `land` fast-forwards a clean main
checkout on the trunk whose `HEAD` is an ancestor of `origin/<trunk>`. A dirty checkout, a checkout
off the trunk, and a checkout with commits that the trunk lacks still exit 6, and the message names
that work.

**The host parts.** How the maintainer lifts a guard refusal in the session lives only in the
`Claude Code` and `Codex` parts of `docs/procedures/stop.md`. Claude Code: the **Recently blocked**
tab of `/permissions`, or a message that names the exact action. Codex: its own prompt with
`on-request`; with `never`, a guard refusal is a hold.

## Alternatives considered

- **A saved question that resumes later** (approach 2 of the spec). The step posts its question on
  the issue and ends, the queue goes on, and an answer on the board resumes the same saved session.
  It needs a new comment kind, a resolver state, an answer field on the board, and a runner path
  that resumes with the answer. Not chosen: the maintainer chose the live question in the tab
  (decision 1). It stays a later enhancement.
- **Engine-checked hold kinds** (approach 3 of the spec). `issue stopped` and `before-landing` would
  require a declared kind from a fixed list. Dropped: the engine can check only the label of a hold,
  not its truth, so it adds ceremony and no guard.

## Consequences

- A conflict with the trunk, a main checkout that is only behind the trunk, a consent that the plan
  can see, and a guard refusal that the maintainer can lift no longer make a hold. A hold comment
  names only acts outside the session.
- **The sort is judgment.** A step can still make a hold for agent work, or ask a live question for
  an act outside the session. The list of class 3 and its examples limit this; the engine cannot
  check it.
- **A live question holds the queue** until the maintainer answers (accepted, decision 1). If the
  maintainer is away, nothing else moves.
- **A general "yes" does not lift a Claude Code block.** The question names the exact action. A
  wrong answer form gives a second refusal and a hold.
- **A Codex session with the approval policy `never`** cannot show an approval prompt, so its guard
  refusals stay holds.
- **A merge can lose the intent of the other side.** The read of the other issues and the verify
  gate limit this. Before the final review, the final review covers the resolution; after it, the
  task review of the `land-<k>` fix covers it.
- **Recurring merges in parallel lanes** can repeat the same resolution work in each lane.
- The evidence for the text is headless turns, which stand for a live step session (the unverified
  premise of ADR-0011).

## Reconsider when

- A live question holds the queue for a long time.
- A merger skill or agent replaces the merge in the step session.
- A host lets the maintainer lift a `deny` rule in the session.
- The engine can check the kind of a hold.
