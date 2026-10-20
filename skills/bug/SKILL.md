---
name: bug
description: Type-axis lane for a bug fix — an existing behavior that ≠ intended/spec (wrong output, crash, regression) with production NOT on fire. Use when the human runs /celetis:bug, or when a request describes something that already works misbehaving — as opposed to new behavior (/celetis:feature), a prod-broken ship-now fire (/celetis:hotfix), or a zero-behavior-change edit like a dep bump / rename / doc-config fix (/celetis:chore).
---

**Host entry.** Before any step or response, including commentary or an announcement, bind `<plugin>` to the absolute prefix before `/skills/<name>/SKILL.md` in this loaded file's path. Read [the host operations](../../docs/hosts/entry.md) at `<plugin>/docs/hosts/entry.md` directly, before any product-path scan. The relative link starts in the absolute directory containing this SKILL.md. Complete its startup reads on each invocation, including a same-session handoff.

# /celetis:bug — bug-fix lane

Type-axis entry command for fixing existing behavior that ≠ spec, prod not on fire. Type declared
at entry; if undeclared, the signal is **behavior ≠ spec** (new capability is `/celetis:feature`).

Hands off to the fix chain:
**explore → `superpowers:systematic-debugging` → `plan` (debugging report = spec) → (fresh context) → `implement`.**

## The Iron Law

```
NO STEP SKIPPED. NO STEP REORDERED.
```

Each step is the next one's precondition — no debugging without exploring, no fix without the
root cause, no plan without the report. Perceived simplicity waives nothing: a one-character diff runs the same lane. If you have not completed step N, you cannot
start step N+1.

1. **Confirm classification.** Existing behavior misbehaves → continue. New behavior → `/celetis:feature`;
   prod broken + ship-now → `/celetis:hotfix`; zero behavior change → `/celetis:chore`. Given free text instead of `#<n>`: create the issue first — `gh issue create --label bug --title "<one line>" --body-file <intent>` with the `/celetis:intake` template as the body — and continue with its number. Given `#<n>` whose issue carries `epic`: stop; an epic has no branch, and each child runs its own lane. Given any other `#<n>`: make `bug` its only lane label with `gh issue edit <n>` — `--add-label bug` when the issue lacks it, plus `--remove-label <name>` for each of `needs-triage`, `enhancement`, `hotfix`, `chore` that the issue carries — because `scripts/celetis worktree` names the branch from the lane label.
2. **Worktree.** Run `scripts/celetis worktree <n>` with a 10-minute timeout (a new worktree runs
   the worktree setup of the project) and bind the exact path it prints using the host operations. The script re-enters the
   issue's branch, or creates `fix/<n>-<slug>` from the title when the issue has none; when
   it refuses, show the user its message and stop. Every later step runs in that worktree; the
   main checkout never changes branch (Branches, PRs, merge in `<plugin>/docs/issue-tracker.md`).
3. **Explore project context.** Explore files, docs, recent commits. Also read:
   - `AGENTS.md` — project architecture.
   - the `AGENTS.md` of the subsystem(s) the bug touches.
   - Scan `docs/lessons/INDEX.md` for lessons matching this change; read matches in full.
   - `docs/adr/` — architectural decisions that bear on the bug; factor them in.

   Surface that subsystem's traps as **constraints on the fix early** so the fix can't violate
   them.
4. **Invoke `superpowers:systematic-debugging`** — MANDATORY, no self-granted exemptions; the red
   repro is the spec's repro. A hypothesis that rests on library, platform, or vendor behavior is
   checked per `<plugin>/docs/docs-lookup.md` before the report names it the root cause.
5. **Write a states table in the report.** For every value the fix guards or depends on, list each
   distinct state and name the code that writes it (file:line) — both the producer of the absent
   state AND the writer of the consulted value (a flag or field), not its default initializer. A
   field's default is not a writer. If "absent" and a writer-set value come from different code,
   they are distinct states.
6. **Resolve alone, or escalate.** Read the states table before fixing. If the fix merges two states
   that step 5 shows have different writers (for example, treating "absent" as "false"), or the
   spec does not define behavior for every listed state, STOP and ask the user — present the states
   and the decision as concrete options. For a look decision (`AGENTS.md` of the project), the options
   are `celetis:prototype` variants: build them and hand them over, then ask for the pick, and record it
   as the report's `## Prototype` section (`<plugin>/docs/issue-tracker.md`). Do not ship a guessed
   default. Proceed autonomously to step 7 only when every state is spec-defined and the fix is
   self-contained.
7. **Post the report, then invoke `celetis:plan #<n>`.** `gh issue comment <n> --body-file <report>` with
   `## Root cause` as its first line; the report is the spec (root cause + red repro + intended
   behavior + step 3's traps + its `## External facts` section) and `plan` drives the
   rest of the chain.
