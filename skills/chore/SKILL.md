---
name: chore
description: Type-axis lane for a chore — a change with ZERO behavior change (dependency bump, rename, formatting, doc/config/comment fix, moving code without altering it). Use when the human runs /celetis:chore, or when a request is purely mechanical with no observable behavior delta — as opposed to a bug (behavior ≠ spec → /celetis:bug), new behavior (/celetis:feature), or a prod fire (/celetis:hotfix).
---

**Host entry.** Before any step or response, including commentary or an announcement, bind `<plugin>` to the absolute prefix before `/skills/<name>/SKILL.md` in this loaded file's path. Read [the host operations](../../docs/hosts/entry.md) at `<plugin>/docs/hosts/entry.md` directly, before any product-path scan. The relative link starts in the absolute directory containing this SKILL.md. Complete its startup reads on each invocation, including a same-session handoff.

# /celetis:chore — chore lane

Minimal type-axis lane for a **zero-behavior-change** edit: dep bump, rename, format, doc/config/
comment fix, code move.

## The Iron Law

```
NO STEP SKIPPED. NO STEP REORDERED. A BEHAVIOR DELTA VOIDS THE LANE.
```

Each step is the next one's precondition — no change without the branch, no commit without the
gates, no landing without the commit. Step 1's claim is what buys this lane its speed and its
commit-without-asking: the moment anything observable changes, mid-lane or not, the work belongs
in `/celetis:bug` or `/celetis:feature`. If you have not completed step N, you cannot start step N+1.

## Flow

1. **Confirm the zero-behavior-change claim.** Any behavior delta → redirect: misbehaviour → `/celetis:bug`,
   new behavior → `/celetis:feature`. Proceed only if nothing observable changes. Given free text instead of `#<n>`: create the issue first — `gh issue create --label chore --title "<one line>" --body-file <intent>` with the `/celetis:intake` template as the body — and continue with its number. Given `#<n>` whose issue carries `epic`: stop; an epic has no branch, and each child runs its own lane. Given any other `#<n>`: make `chore` its only lane label with `gh issue edit <n>` — `--add-label chore` when the issue lacks it, plus `--remove-label <name>` for each of `needs-triage`, `enhancement`, `bug`, `hotfix` that the issue carries — because `/usr/bin/env BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 '<bun>' '--no-env-file' '--no-install' '--config=/dev/null' '--no-macros' '<plugin>/bin/celetis.ts' '--agent' '<host>' 'worktree'` names the branch from the lane label.
2. **Worktree.** Run `/usr/bin/env BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 '<bun>' '--no-env-file' '--no-install' '--config=/dev/null' '--no-macros' '<plugin>/bin/celetis.ts' '--agent' '<host>' 'worktree' '<n>'` with a 10-minute timeout (a new worktree runs
   the worktree setup of the project) and bind the exact path it prints using the host operations. The script re-enters the
   issue's branch, or creates `chore/<n>-<slug>` from the title when the issue has none; when
   it refuses, show the user its message and stop. Every later step runs in that worktree; the
   main checkout never changes branch (Branches, PRs, merge in `<plugin>/docs/issue-tracker.md`).
   **Re-entry.** When the branch already holds the commit of the chore and the tree is clean, an
   earlier run built the change: read the latest `## Landing refused` comment, handle its cause as
   the re-entry rule of `<plugin>/skills/implement/SKILL.md` does, entering that reference through the host operations, and go to step 4, then step 6.
3. **Do the change.** Read the `AGENTS.md` of each subsystem the change touches, and consult
   `docs/adr/` for architectural decisions that bear on it. A dependency bump: read the changelog
   or release notes between the old and the new version per `<plugin>/docs/docs-lookup.md`, and
   post an issue comment whose first line is `## External facts`
   (`gh issue comment <n> --body-file <file>`) that names each breaking change that touches an
   API the repo uses, or states that none does.
4. **Gates.** Run the verify gate of the project. The full suite runs once, on the tree that lands:
   the CI of the lane PR with the landing `pr`, or Land step 3 of `implement`, which step 6
   follows, with the landing `merge`.
5. **Commit — don't ask.** Commit on the issue's branch WITHOUT confirmation: invoking this lane is the
   authorization — the "commit only when asked" default does NOT apply. Subject
   `<type>(<area>): <what>` — `<area>` is whatever a reader would recognise (the package or
   concern); `<type>` matches the change (`chore`, `build` for the build tooling,
   `docs`, `refactor` for a rename). Body: one line, what changed and from → to, ending with `#<n>`.
   Before step 6, confirm that the issue's branch holds this commit and that
   `git status --porcelain` in the lane prints nothing.
6. **Land.** Follow Land of `<plugin>/skills/implement/SKILL.md` (Tail step 5) from its step 2, with the commit subject of step 5 as the subject of `/usr/bin/env BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 '<bun>' '--no-env-file' '--no-install' '--config=/dev/null' '--no-macros' '<plugin>/bin/celetis.ts' '--agent' '<host>' 'land' '<n>' '<subject>'`. Enter that reference through the host operations on its first use, including optional `custom.implement` from the active checkout's `.celetis.yaml`; reuse the entry if step 2 already read it. Its custom text is an addition to `implement`. A fix for a refusal or for a failure of the full suite stays inside the zero-behavior-change claim, passes the verify gate of the project, and is committed before the next landing. The session makes each such fix itself: the task loop of Land step 4 is for a lane with a plan. Invoking this lane authorizes the commit and the landing.
