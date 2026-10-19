---
name: implement
description: Use when executing a written plan for a feature in the current session. Superset of superpowers:subagent-driven-development. Not for writing the plan (plan) or the design pass (specify).
---

**Host entry.** Before any step or response, including commentary or an announcement, bind `<plugin>` to the absolute prefix before `/skills/<name>/SKILL.md` in this loaded file's path. Read [the host operations](../../docs/hosts/entry.md) at `<plugin>/docs/hosts/entry.md` directly, before any product-path scan. The relative link starts in the absolute directory containing this SKILL.md. Complete its startup reads on each invocation, including a same-session handoff.

# implement

Superset of `superpowers:subagent-driven-development` for project plans. Delegates to it; sets the capability tier of every dispatch + gates each task and a final verify phase.

## Do this

1. Enter the issue's worktree: run `scripts/celetis worktree <n>` with a 10-minute timeout and bind the exact path it prints using the host operations (reuse the binding when the session is already there). The script re-enters the issue's branch, or creates it when the issue has none; when it refuses, show the user its message and stop. Then fetch the plan into `docs/superpowers/plans/<n>.md`. A hotfix's micro-plan is already there, written by its lane. Every other lane's plan is the latest `## Plan` comment on the issue, which a local file from the `plan` session can lag: `mkdir -p docs/superpowers/plans && gh issue view <n> --json comments --jq '[.comments[] | select(.body | startswith("## Plan"))][-1].body' > docs/superpowers/plans/<n>.md`.

   **Re-entry**, for each lane but a hotfix (its micro-plan is a local file): read `gh issue view <n> --json labels,comments`. A `## Plan` comment with no `ready-for-agent` label means that an earlier run built the change. Do not build again: run no task of the plan, skip the Tail steps 1 to 4, and read the latest `## Landing refused` comment. When the change made the cause that the comment names, fix it as Land, step 4, says. When the cause is outside the change and the trunk now holds its fix, fetch the trunk from `origin`, merge it into the branch, and run the verify gate of the project, so that the checks run on a new head. Then go to Land, step 2. A new `/celetis:plan` run adds `ready-for-agent` again, so a new plan is built.
2. Invoke `superpowers:subagent-driven-development` using the host operations and follow it — it owns the per-task implementer and review loop, which findings you fix or rule on, and the final whole-branch review. Land (Tail step 5) takes the place of its last step, the skill that finishes the development branch: do not invoke that skill.
3. Layer the project additions below.

## Additions

**Capability tier — every dispatch.** Each task carries a `CAP: … → model/effort` line (plan scored it). Resolve its binding with `scripts/celetis capscore J V B N S X --bias BIAS --attempt N --json` through the host operations (`<plugin>/docs/capability.md`):
- Reuse the published six digits and bias (`+bN`; absent means `--bias 0`). Published model labels are history. Re-score only a task whose scope materially changed; changing hosts does not change its score.
- Apply both `dispatch.model` and `dispatch.effort` with the host's actual controls; put `line` FIRST in the child prompt and record the pair and child identity. Keep the parent model. A CAP line alone does not configure a child.
- The **task reviewer uses the implementer's score and attempt with `--reviewer`**, applying the host's reviewer minimum. No separate task-review score; the scorer owns its floors and clamp.
- Each child receives the exact lane path, relevant project instructions, its task and constraints, and required skill/custom text through the host operations. Retain the same implementer for repairs and the same reviewer for scoped re-review. If the required pair cannot be applied to that identity, stop for setup with the failure trail.

**Comment policy — append to every implementer prompt (verbatim):**
> Comments: default none; one line only for a constraint the code can't show; never narrate what the next line does or why the change is correct. Style source: the `celetis:polishing-code-comments` skill.

**Commit subject — append to every implementer prompt (verbatim):**
> Commit subject: `<type>(<area>): <what>` — `<area>` is whatever a reader would recognise: the package or concern the task touched (`lib` alone if nothing is clearer). `<type>` is `feat` for new behavior, else `fix`/`refactor`/`test`. Body: what changed and why, naming a symbol a reader can grep, and referencing `#<n>`.

**Gate each task before its review.** The base loop is implementer → task review; insert a deterministic gate between them:
1. Implementer returns DONE → run the verify gate of the project.
2. **Pass** → dispatch the task reviewer.
3. **Fail** → re-dispatch the *implementer* (not the reviewer) with the `GATE FAIL: <name>` + the report path + a re-resolved tier from `scripts/celetis capscore J V B N S X --bias BIAS --attempt N --json` through the host operations. The orchestrator owns N per task (session-scoped): attempt 2 → +1 effort · attempt 3 → +1 model · **attempt 4 → STOP, escalate to the user with the failure trail.**

**Tail — after every task is review-clean, in order:**
1. `celetis:polishing-code-comments` sweep over the full branch diff (once per branch).
2. Broad final whole-branch review (base skill's final review), scored as its own dispatch with `scripts/celetis capscore`: add `--reviewer` and apply the resolved host pair in place of the upstream "most capable model" (`<plugin>/docs/capability.md`).
3. A re-run of the verify gate of the project.
4. The **Verify phase** (below) — its PASS/FAIL is a hard gate.
5. **Land** — `scripts/celetis land` puts the change on the trunk by `landing` in `.celetis.yaml` (ADR-0008 of the plugin `celetis`). It is the one landing path of an agent.
   1. `gh issue edit <n> --remove-label ready-for-agent`. A `## Plan` comment with no `ready-for-agent` label is the mark that the change is built.
   2. **Human precondition.** When the change needs an act that only a human can do before it reaches the trunk, and the issue has no `## Before landing` comment for this build: post a comment whose first line is `## Before landing` and that names the act, then run `gh issue edit <n> --add-label ready-for-human`, and stop. The maintainer completes the act and clears the label. Before landing on re-entry, require a trusted human completion report or the maintainer's removal of `ready-for-human` after this build's `## Before landing` comment, from the issue event history (`<plugin>/docs/issue-tracker.md`, "Completing a human precondition"). An absent label is not completion evidence. Without that evidence, keep the change built, restore `ready-for-human` using the existing comment as the reason, and stop. With the evidence, continue to step 3.
   3. Return to the main checkout using the host operations, keeping the lane. Run `scripts/celetis land <n> '<type>(<area>): <what>'` there with the host's command spelling and background/session support, and go on when it ends: checks can take 15 minutes. Keep its session identifier and wait for the exit; a yield or timeout is not completion. The subject is the squash subject of the change, without the issue number: the script adds ` (#<n>)`. When the lane branch holds one commit, pass the subject of that commit: the squash commit can take the subject of that commit in place of the argument. Exit 0 ends the step: the change is on the trunk, and the worktree and the branch are gone. **A stop after the landing** (a `land:` line that says `run scripts/celetis land again`) is no refusal, and step 5 does not count it: the change is on the trunk, so do what the line says and run the script again; a second stop with the same line is a cause outside the change (step 5). **An error that the session caused** (exit 2 with the usage line, a run from inside the lane worktree, a lane worktree that is dirty) is no refusal either, and step 5 does not count it: correct it, and run the script again.
   4. **A refusal that the change caused** (exit 1 and a `land:` line, before the change is on the trunk): a check that fails on the diff, a conflict with the trunk, a branch that does not contain the trunk head. Enter the worktree again (`scripts/celetis worktree <n>`, then bind its exact path through the host operations), fix the cause through the task loop (implementer, the verify gate of the project, task review), commit, and go to step 3. The loop is the task loop of `superpowers:subagent-driven-development`, with the fix as its one task: a session that did not invoke that skill invokes it now, for its task loop only. Debug a red check with `superpowers:systematic-debugging`. Fix a conflict or a stale branch with a merge of the trunk into the branch.
   5. **The third refusal in one session, or a cause outside the change**: a check that fails on an advisory for a dependency that the change did not touch, no check that ran, checks that did not finish, GitHub that does not answer, a main checkout that is dirty or off the trunk. Write the output of the script to a file in the temporary directory from the host operations, post it as an issue comment with `## Landing refused` as its first line (`gh issue comment <n> --body-file <file>`), show the user the output, and stop. Do not pass the output as a quoted argument: a message of `gh` can hold a backtick, and the shell runs it inside double quotes.

**Verify phase — prove the plan's Verify scenarios on the project's own runtime.** Execute the plan's Verify phase per the project's runtime shape (on-device for an app, a browser flow for web, a script for a backend).

A FAIL loops back to a fix subagent (same CAP tier), not to Land. (The Tail above sequences this phase; its PASS is the hard gate before Land.)

**TDD stays** the implementer loop.
