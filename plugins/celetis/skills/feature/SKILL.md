---
name: feature
description: Type-axis lane for a feature — new behavior that does not exist yet. Use when the human runs /celetis:feature, or when a request asks for capability the app lacks — as opposed to fixing existing behavior (/celetis:bug), a prod fire (/celetis:hotfix), or a zero-behavior-change edit (/celetis:chore).
---

**Celetis entry.** Before any step or response, including commentary or an announcement, bind `<plugin>` to the absolute prefix before `/skills/<name>/SKILL.md` in the path of this loaded file. Then read `<plugin>/docs/procedures/entry.md` whole, in one read, and follow it before any product-path scan. Do this on each invocation, including a same-session handoff.

# /celetis:feature — feature lane

Type-axis entry command for **new behavior**. Type declared at entry; if undeclared, the signal is
capability the project does not have yet (fixing existing behavior is `/celetis:bug`).

Hands off to the feature chain:
**`specify` → (clean context) → `plan` → `implement`.**

## The Iron Law

Apply `<plugin>/docs/procedures/lane-start.md`, "The Iron Law".

The chain continues past step 3 — no plan without the spec, no code without the plan. A
one-screen feature runs the same lane.

**Before step 1.** Check the wiring per `<plugin>/docs/procedures/lane-start.md`, "Before step 1".
Only the exit 0 of `setup status` starts step 1.

1. **Confirm classification.** New behavior → continue. Fixing existing behavior → `/celetis:bug` (or
   `/celetis:hotfix` if prod is on fire). Zero behavior change → `/celetis:chore`. Then start the
   issue per `<plugin>/docs/procedures/lane-start.md`, "Start the issue", with `feature` as `<lane>`.
   **Scope check (new behavior only):** run the scope check of `<plugin>/docs/procedures/epic.md`.
   An epic ends there: the epic definition (`celetis --agent <host> issue <n> epic <file>`, run by `<plugin>/docs/procedures/epic.md`) moves the line, so the sub-issues and the report
   come in its turn (`<plugin>/docs/procedures/stop.md`, "The act that moves the line"). One
   feature → continue to step 2.
2. **Worktree.** Enter the issue's worktree per `<plugin>/docs/procedures/worktree.md`.
3. **Invoke `celetis:specify #<n>`** and follow it — it drives the rest of the chain.
