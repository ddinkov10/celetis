---
name: hotfix
description: Type-axis lane for a hotfix — production is broken and the fix must ship now. Use when the human runs /celetis:hotfix, or when a request is a prod-down / blocking-regression fire needing immediate ship — as opposed to a normal bug with no fire (/celetis:bug), new behavior (/celetis:feature), or a zero-behavior-change edit (/celetis:chore). Ends by printing a manual ship checklist for you to run.
---

**Host entry.** Read [the host operations](../../docs/hosts/entry.md) relative to this loaded SKILL.md before the procedure, including a same-session handoff.

# /celetis:hotfix — production hotfix lane

Production is broken; the fix ships now. Type declared at entry; if undeclared, the signal is
**prod-broken + ship-now** (a normal bug with no fire is `/celetis:bug`).

## The Iron Law

```
NO STEP SKIPPED. NO STEP REORDERED. THE FIRE IS NOT A WAIVER.
```

Each step is the next one's precondition — no debugging without exploring, no fix without the
root cause, no ship without the verify. If you have not completed step N, you cannot start step
N+1. Too little time for the lane → the change does not ship tonight.

1. **Confirm classification.** Fire needing ship-now → continue. No fire → `/celetis:bug`. New behavior →
   `/celetis:feature`. Zero behavior change → `/celetis:chore`. Given free text instead of `#<n>`: create the issue first — `gh issue create --label hotfix --title "<one line>" --body-file <intent>` with the `/celetis:intake` template as the body — and continue with its number. Given `#<n>` whose issue carries `epic`: stop; an epic has no branch, and each child runs its own lane. Given any other `#<n>`: make `hotfix` its only lane label with `gh issue edit <n>` — `--add-label hotfix` when the issue lacks it, plus `--remove-label <name>` for each of `needs-triage`, `enhancement`, `bug`, `chore` that the issue carries — because `scripts/celetis worktree` names the branch from the lane label.
2. **Worktree.** Run `scripts/celetis worktree <n>` with a 10-minute timeout (a new worktree runs
   the worktree setup of the project) and bind the exact path it prints using the host operations. The script re-enters the
   issue's branch, or creates `hotfix/<n>-<slug>` from the title when the issue has none; when
   it refuses, show the user its message and stop. Every later step runs in that worktree; the
   main checkout never changes branch (Branches, PRs, merge in `<plugin>/docs/issue-tracker.md`).
3. **Explore project context.** Explore files, docs, recent commits. Also read:
   - `AGENTS.md` — project architecture.
   - the `AGENTS.md` of the subsystem(s) the fire touches.
   - Scan `docs/lessons/INDEX.md` for lessons matching this change; read matches in full.
   - `docs/adr/` — architectural decisions that bear on the fire; factor them in.

   Surface that subsystem's traps as **constraints on the fix early** so the fix can't violate
   them.
4. **Invoke `superpowers:systematic-debugging`** — MANDATORY. The red repro is the micro-plan's
   Verify probe. A hypothesis that rests on library, platform, or vendor behavior is checked per
   `<plugin>/docs/docs-lookup.md` before the report names it the root cause. Post the report, with
   its `## External facts` section, as an issue comment with `## Root cause` as its first line.
5. **Author a one-task micro-plan in `docs/superpowers/plans/<n>.md`** (gitignored scratch; the
   fire's substitute for `plan`):
   - The task = the root-cause fix, with step 3's traps as its constraints.
   - Each library call the fix adds is checked per `<plugin>/docs/docs-lookup.md`; the facts go
     in the micro-plan's `## External facts` section.
   - CAP line via `scripts/celetis capscore J V B N S X` — never hand-computed.
   - Per-task gate line: the verify gate of the project (`AGENTS.md` names it) passes before the task's review.
   - Verify phase: the red repro re-run post-fix, plus one error branch of any newly-enabled
     path (widened allow-list / enum / dispatch literal / flag).
   Fix crosses subsystems or unrolls a chain → not shim-able: full `celetis:plan`, or the change
   does not ship tonight.
6. **Run `celetis:implement #<n>` on the micro-plan** — its Land step lands the fix as each lane does. A
   micro-plan is a local file, so the re-entry rule of `implement` does not apply to it. Window
   too small to verify → the change does not ship tonight: stop, report blocked.
7. **Terminal.** When the project has a custom part `hotfix.md`, its text at the end of this skill names the ship acts of the project. A project with no such part has no ship act.
   - The fix landed: print the acts of the maintainer, and stop.
     - [ ] Do the ship acts of the project.
   - The landing stopped with a `## Landing refused` comment: run `gh issue edit <n> --add-label ready-for-human`, print the checklist, and stop.
     - [ ] Fix the cause that the `## Landing refused` comment names.
     - [ ] Run `scripts/celetis land <n> '<subject>'` in your own shell.
     - [ ] Do the ship acts of the project.
     - [ ] Remove `ready-for-human`.
   - The landing stopped with a `## Before landing` comment, and `implement` added `ready-for-human`: print the checklist, and stop.
     - [ ] Do the act that the `## Before landing` comment names.
     - [ ] Run `scripts/celetis land <n> '<subject>'` in your own shell.
     - [ ] Do the ship acts of the project.
     - [ ] Remove `ready-for-human`.

!`cat "$(git rev-parse --show-toplevel)/.claude/celetis-flow/custom/hotfix.md" 2>/dev/null || true`
