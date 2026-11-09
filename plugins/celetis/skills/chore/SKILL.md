---
name: chore
description: Type-axis lane for a chore — a change with ZERO behavior change (dependency bump, rename, formatting, doc/config/comment fix, moving code without altering it). Use when the human runs /celetis:chore, or when a request is purely mechanical with no observable behavior delta — as opposed to a bug (behavior ≠ spec → /celetis:bug), new behavior (/celetis:feature), or a prod fire (/celetis:hotfix).
---

**Celetis entry.** Before any step or response, including commentary or an announcement, bind `<plugin>` to the absolute prefix before `/skills/<name>/SKILL.md` in the path of this loaded file. Then read `<plugin>/docs/procedures/entry.md` whole, in one read, and follow it before any product-path scan. Do this on each invocation, including a same-session handoff.

# /celetis:chore — chore lane

Minimal type-axis lane for a **zero-behavior-change** edit: dep bump, rename, format, doc/config/
comment fix, code move.

## The Iron Law

Apply `<plugin>/docs/procedures/lane-start.md`, "The Iron Law".

```
A BEHAVIOR DELTA VOIDS THE LANE.
```

No change without the branch, no commit without the gates, no landing without the commit. Step 1's
claim is what buys this lane its speed and its commit-without-asking: the moment anything
observable changes, mid-lane or not, the work belongs in `/celetis:bug` or `/celetis:feature`.

## Flow

**Before step 1.** Check the wiring per `<plugin>/docs/procedures/lane-start.md`, "Before step 1".
Only the exit 0 of `setup status` starts step 1.

1. **Confirm the zero-behavior-change claim.** Any behavior delta → redirect: misbehaviour → `/celetis:bug`,
   new behavior → `/celetis:feature`. Proceed only if nothing observable changes. Then start the
   issue per `<plugin>/docs/procedures/lane-start.md`, "Start the issue", with `chore` as `<lane>`.
2. **Worktree.** Enter the issue's worktree per `<plugin>/docs/procedures/worktree.md`.
   **Re-entry.** When the branch already holds the commit of the chore and the tree is clean, an
   earlier run built the change: run `celetis --agent <host> issue <n> state`.
   Apply `<plugin>/docs/procedures/behavior-documentation.md`, "Repairs and re-entry".
   With `refusal: current`, handle the latest `## Landing refused` comment by
   `<plugin>/docs/procedures/landing.md`, "Re-entry after a refusal", with the fix rule of step 6.
   Then go to step 4, then step 6.
   An `open:` line is an open human step: step 2 of the landing, which step 6 follows, handles it.
3. **Do the change.** Read the project context per `<plugin>/docs/procedures/project-context.md`.
   Read `<plugin>/docs/procedures/behavior-documentation.md` and apply "Assessment" and "Change
   work". Complete its session check and report before step 4 and the commit.
   Read each principle below. Apply each one whose `Applies when` holds for the edit and its
   checks, with its `Check`: `<plugin>/docs/principles/type-system-discipline.md` and
   `<plugin>/docs/principles/test-behavior-not-implementation.md`.
   A dependency bump: read the changelog or release notes between the old and the new version per
   `<plugin>/docs/procedures/docs-lookup.md`, and post an issue comment whose first line is `## External facts`
   (`gh issue comment <n> --body-file <file>`) that names each breaking change that touches an
   API the repo uses, or states that none does.
4. **Gates.** Run the verify gate of the project. The full suite runs once, on the tree that lands:
   the CI of the lane PR with the landing `pr`, or `land` at step 3 of the landing, which step 6
   follows, with the landing `merge`.
5. **Commit — don't ask.** Commit on the issue's branch WITHOUT confirmation: invoking this lane is the
   authorization — the "commit only when asked" default does NOT apply. Subject
   `<type>(<area>): <what>` — `<area>` is whatever a reader would recognise (the package or
   concern); `<type>` matches the change (`chore`, `build` for the build tooling,
   `docs`, `refactor` for a rename). Body: one line, what changed and from → to, ending with `#<n>`.
   Before step 6, confirm that the issue's branch holds this commit and that
   `git status --porcelain` in the lane prints nothing.
6. **Land.** Follow `<plugin>/docs/procedures/landing.md` from its step 2, with the commit subject of step 5 as the subject of `celetis --agent <host> land <n> '<subject>'`. A fix for a refusal or for a failure of the full suite stays inside the zero-behavior-change claim, passes the verify gate of the project, and is committed before the next landing. The session makes each such fix itself, as the fix rule of step 4 of the landing: the task loop of a build is for a lane with a plan. Invoking this lane authorizes the commit and the landing.
   Apply `<plugin>/docs/procedures/behavior-documentation.md`, "Repairs and re-entry", to each
   fix in the existing session check and report before its gate and commit.
