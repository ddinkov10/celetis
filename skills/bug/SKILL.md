---
name: bug
description: Type-axis lane for a bug fix — an existing behavior that ≠ intended/spec (wrong output, crash, regression) with production NOT on fire. Use when the human runs /celetis:bug, or when a request describes something that already works misbehaving — as opposed to new behavior (/celetis:feature), a prod-broken ship-now fire (/celetis:hotfix), or a zero-behavior-change edit like a dep bump / rename / doc-config fix (/celetis:chore).
---

**Celetis entry.** Before any step or response, including commentary or an announcement, bind `<plugin>` to the absolute prefix before `/skills/<name>/SKILL.md` in the path of this loaded file. Then read `<plugin>/docs/procedures/entry.md` whole, in one read, and follow it before any product-path scan. Do this on each invocation, including a same-session handoff.

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
   prod broken + ship-now → `/celetis:hotfix`; zero behavior change → `/celetis:chore`. Then
   start the lane per `<plugin>/docs/procedures/lane-start.md`, with `bug` as `<lane>` and `bug`
   as `<label>`.
2. **Worktree.** Enter the issue's worktree per `<plugin>/docs/procedures/worktree.md`; a new
   branch is `fix/<n>-<slug>`.
3. **Explore project context.** Explore files, docs, recent commits, and read the project context
   per `<plugin>/docs/procedures/project-context.md`. Its traps are the constraints on the fix.
4. **Invoke `superpowers:systematic-debugging`** — MANDATORY, no self-granted exemptions; the red
   repro is the spec's repro. After two failed fixes that share a premise, read
   `<plugin>/docs/principles/attack-the-premise.md` before another already-permitted attempt;
   every existing attempt limit and stop still applies. When a hypothesis relies on a measured
   performance or quality result, read `<plugin>/docs/principles/explain-the-number.md`.
   A hypothesis that rests on library, platform, or vendor behavior is
   checked per `<plugin>/docs/procedures/docs-lookup.md` before the report names it the root cause. A bug that
   shows on screen gets a capture repro at the failing state and size, posted on the issue per
   `<plugin>/docs/procedures/ui.md`, "Captures", before the report.
5. **Write a states table in the report.** For every value the fix guards or depends on, list each
   distinct state and name the code that writes it (file:line) — both the producer of the absent
   state AND the writer of the consulted value (a flag or field), not its default initializer. A
   field's default is not a writer. If "absent" and a writer-set value come from different code,
   they are distinct states.
6. **Resolve alone, or escalate.** Read the states table before fixing. Judge from the root cause
   and the states table whether the fix chooses new behavior: it adds a mechanism (for example a
   retry, a timer, a cache, a lock, or a queue), or it chooses behavior that the spec does not
   define. When it does, research the prior art per `<plugin>/docs/procedures/prior-art.md` before the
   decision below. This trigger is wider than the escalation: a fix that adds a mechanism does the
   research also when the spec defines each state. A fix that restores behavior that the spec or
   the code already defines skips it. An escalation presents the found patterns among its options;
   a fix that resolves alone follows "The recommendation" of that document, or the report states
   the reason. If the fix merges two states
   that step 5 shows have different writers (for example, treating "absent" as "false"), or the
   spec does not define behavior for every listed state, STOP and ask the user — present the states
   and the decision as concrete options. A fix that chooses a look that no spec, design document,
   code, or issue text defines is a look decision (`<plugin>/docs/procedures/ui.md`, "The look
   decision"): invoke `celetis:prototype`, and follow "The procedure" of that file
   through its cleanup (step 10). The record of step 9 is the report's `## Prototype` section
   (`<plugin>/docs/issue-tracker.md`). Stop for the pick also when each other state is defined.
   A fix that restores a defined look, a regression too, builds no variants: its capture repro is
   the evidence. Do not ship a guessed default.
   Proceed autonomously to step 7 only when every state is spec-defined, the fix chooses no new
   look, and the fix is self-contained.
7. **Post the report, then invoke `celetis:plan #<n>`.** `celetis --agent <host> issue <n> root-cause <report>`
   posts the report with `## Root cause` as its first line, so the report file has no heading; the report is the spec (root cause + red repro + intended
   behavior + step 3's traps + its `## External facts` section + its `## Prior art` section when
   step 6 did the research + the link of the capture repro when step 4 made one) and `plan` drives
   the rest of the chain.
