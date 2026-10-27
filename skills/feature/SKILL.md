---
name: feature
description: Type-axis lane for a feature — new behavior that does not exist yet. Use when the human runs /celetis:feature, or when a request asks for capability the app lacks — as opposed to fixing existing behavior (/celetis:bug), a prod fire (/celetis:hotfix), or a zero-behavior-change edit (/celetis:chore).
---

**Host entry.** Before any step or response, including commentary or an announcement, bind `<plugin>` to the absolute prefix before `/skills/<name>/SKILL.md` in this loaded file's path. Read [the host operations](../../docs/hosts/entry.md) at `<plugin>/docs/hosts/entry.md` directly, before any product-path scan. The relative link starts in the absolute directory containing this SKILL.md. Complete its startup reads on each invocation, including a same-session handoff.

# /celetis:feature — feature lane

Type-axis entry command for **new behavior**. Type declared at entry; if undeclared, the signal is
capability the project does not have yet (fixing existing behavior is `/celetis:bug`).

Hands off to the feature chain:
**`specify` → (clean context) → `plan` → `implement`.**

## The Iron Law

```
NO STEP SKIPPED. NO STEP REORDERED.
```

Each step is the next one's precondition, and the chain continues past step 3 — no plan without
the spec, no code without the plan. Perceived simplicity waives nothing: a one-screen feature runs
the same lane. If you have not completed step N, you cannot start step N+1.

1. **Confirm classification.** New behavior → continue. Fixing existing behavior → `/celetis:bug` (or
   `/celetis:hotfix` if prod is on fire). Zero behavior change → `/celetis:chore`. Given free text instead of `#<n>`: create the issue first — `gh issue create --label enhancement --title "<one line>" --body-file <intent>` with the `/celetis:intake` template as the body — and continue with its number. Given `#<n>` whose issue carries `epic`: stop; an epic has no branch, and each child runs its own lane. Given any other `#<n>`: make `enhancement` its only lane label with `celetis --agent <host> issue <n> route feature` — it adds `enhancement` when the issue lacks it, and removes each of `needs-triage`, `bug`, `hotfix`, `chore` that the issue carries — because `celetis --agent <host> worktree` names the branch from the lane label.
   **Scope check (new behavior only):** does the idea span MULTIPLE independent features (an epic,
   too big for one specify→plan→implement pass)? → agree the list of children with the user, then
   make it an epic, with `epic` as its only lane label:
   `celetis --agent <host> issue <n> epic`,
   which adds `epic` and removes `enhancement`. Then create one
   sub-issue per feature with the Epics recipe in `<plugin>/docs/issue-tracker.md` (label
   `enhancement`, a one-line intent each), report the children, and stop. Do the relabel, the
   sub-issues, and the report in one turn: the relabel moves the issue's line in the runner's
   resolver (`celetis --agent <host> next-step`), and a session that the runner started ends at its
   first idle moment after that (`<plugin>/docs/celetis-flow.md`, "The step end"). Each child runs its
   own `/celetis:feature #<child>`. One feature → continue to step 2.
2. **Worktree.** Run `celetis --agent <host> worktree <n>` with a 10-minute timeout (a new worktree runs
   the worktree setup of the project) and bind the exact path it prints using the host operations. The script re-enters the
   issue's branch and brings it up to the trunk, or creates `feat/<n>-<slug>` from the title
   when the issue has none; when it refuses, show the user its message and stop. Every later
   step runs in that worktree; the
   main checkout never changes branch (Branches, PRs, merge in `<plugin>/docs/issue-tracker.md`).
3. **Invoke `celetis:specify #<n>`** and follow it — it drives the rest of the chain.
