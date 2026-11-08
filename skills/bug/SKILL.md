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

**Before step 1.** Check the wiring per `<plugin>/docs/procedures/lane-start.md`, "Before step 1".
Only the exit 0 of `setup status` starts step 1.

1. **Confirm classification.** Existing behavior misbehaves → continue. New behavior → `/celetis:feature`;
   prod broken + ship-now → `/celetis:hotfix`; zero behavior change → `/celetis:chore`. Then
   start the issue per `<plugin>/docs/procedures/lane-start.md`, "Start the issue", with `bug` as
   `<lane>` and `bug` as `<label>`.
2. **Worktree.** Enter the issue's worktree per `<plugin>/docs/procedures/worktree.md`; a new
   branch is `fix/<n>-<slug>`.
3. **Explore project context.** Explore files, docs, recent commits, and read the project context
   per `<plugin>/docs/procedures/project-context.md`. Its traps are the constraints on the fix.
   Read the issue per `<plugin>/docs/procedures/capture.md`, "A step with a record": the newest
   `## Captured` comment holds the person's answers.
4. **Invoke `superpowers:systematic-debugging`** — MANDATORY, no self-granted exemptions; the red
   repro is the spec's repro. A captured root cause (step 3) is the first hypothesis, and the red
   repro and the causal chain decide it, as the module of step 3 says. During diagnosis, after a substantive correction, after two failed
   fixes of the same problem, and before an existing repair limit stops work, apply
   `<plugin>/docs/procedures/lesson-capture.md`. Reuse a checkpoint already handled in the turn.
   After two failed fixes that share a premise, read
   `<plugin>/docs/principles/attack-the-premise.md` before another already-permitted attempt;
   every existing attempt limit and stop still applies. When a hypothesis relies on a measured
   performance or quality result, read `<plugin>/docs/principles/explain-the-number.md`.
   A hypothesis that rests on library, platform, or vendor behavior is
   checked per `<plugin>/docs/procedures/docs-lookup.md` before the report names it the root cause. A bug that
   shows on screen gets a capture repro at the failing state and size, posted on the issue per
   `<plugin>/docs/procedures/ui.md`, "Captures", before the report.
5. **Write the report evidence.** Keep these checks together before the decision in step 6.

   **Causal chain — every report.** Include `## Causal chain`. Trace backward from the failing
   expression through the relevant bad state and its producer to a reachable user action, system
   event, lifecycle event, or race. Present the chain in causal order, with `file:line` evidence
   for every link. Explain how the affected flow reaches the trigger. Include a producer that
   fails to run or finish, and a missing wait, when relevant. Name the expected invariant and
   the earliest relevant violation that the project controls. The red repro must exercise this
   trigger. A failing expression alone does not establish the root cause.

   Check issue claims against source. A link that depends on library, platform, or vendor behavior
   cites its settled fact in `## External facts`. Mark unsettled links uncertain; they cannot
   establish the root cause. Use step 4's debugging and step 6's escalation rules for missing
   evidence. The chain is complete only when source evidence connects the reachable trigger to
   the violated invariant and identifies the project-controlled cause.

   **States table — every report.** For every value the fix guards or depends on, list each
   distinct state and name the code that writes it (file:line) — both the producer of the absent
   state AND the writer of the consulted value (a flag or field), not its default initializer. A
   field's default is not a writer. If "absent" and a writer-set value come from different code,
   they are distinct states.

   **Masking check — a guard leaves suspect state.** When the proposed fix guards the failure
   and leaves suspect state in place, include `## Masking check`. Null checks, early returns,
   catches, and default values are examples; the effect triggers the check, not the syntax.
   Answer both questions with `file:line` evidence:

   - Does a writer intentionally produce this state, with behavior defined by the spec, or does
     it violate an invariant? Cite the writer and the defined behavior. An initializer or a
     similar guard does not establish intentional absence.
   - Where can the state be used after the guard? Trace every reachable later consumer in the
     affected flow and the state's lifetime. Include other values the same producer leaves
     unset, and uses by callers or callbacks. Explain how each consumer gets valid state or
     becomes unreachable. A return from one function does not prove that another caller or
     callback cannot use the state.

   For an invariant violation, fix the causal origin or end the affected flow before any invalid
   use. A moved failure or silent substitution of wrong state fails the check. A guard for
   intentional absence can pass when the defined behavior and every later consumer support it.
   The check is complete only when every reachable later use is accounted for. Step 6's
   escalation rules still apply when state meaning or behavior needs a maintainer decision.
   A repair at the causal origin that leaves no suspect state needs no masking section; its
   causal chain and states table remain mandatory.
6. **Resolve alone, or escalate.** Read the causal chain, states table, and applicable masking
   check before fixing. Judge from this evidence whether the fix chooses new behavior: it adds a
   mechanism (for example a retry, a timer, a cache, a lock, or a queue), or it chooses behavior that the spec does not
   define. When it does, research the prior art per `<plugin>/docs/procedures/prior-art.md` before the
   decision below. When its `## Prior art` section has a `### Required behavior` list, the report
   lists each of its behaviors as a requirement of the fix, in its intended behavior. This trigger is wider than the escalation: a fix that adds a mechanism does the
   research also when the spec defines each state. A fix that restores behavior that the spec or
   the code already defines skips it. An escalation presents the found patterns among its options;
   a fix that resolves alone follows "The recommendation" of that document, or the report states
   the reason. If the fix merges two states
   that step 5 shows have different writers (for example, treating "absent" as "false"), or the
   spec does not define behavior for every listed state, STOP and ask the user — present the states
   and the decision as concrete options. Do not ship a guessed default.

   A bug that shows on screen asks the maintainer whether the fix needs a new look, unless a
   `### Decided` line of the record (step 3) answers it: that line is the maintainer's answer, and
   the session neither opens the screen for the question nor asks it. First check
   `<plugin>/docs/procedures/design.md`, "Can the session ask": a session that cannot ask stops
   there, before it opens the screen. Then open the failing screen live, by the row of its kind
   (`<plugin>/docs/procedures/ui.md`, "The platform rows"), give its URL or its command, and ask.
   The maintainer answers this question, also when each other state is defined and `DESIGN.md`,
   the spec, the code, or the issue text defines the look. An answer that the host gives by its
   own timeout is no answer: ask again, as the host part of `<plugin>/docs/procedures/design.md`
   says. After the answer, stop what the live opening started: a later prototype can need its
   port.
   - **Yes:** the fix makes a look decision (`<plugin>/docs/procedures/ui.md`, "The look
     decision"). Invoke `celetis:prototype`, and follow "The procedure" of that file through its
     cleanup (step 10). The record of step 9 is the report's `## Prototype` section
     (`<plugin>/docs/issue-tracker.md`).
   - **No:** the fix restores the defined look, a regression too, and builds no variants. The
     capture repro of step 4 is its evidence.

   Proceed autonomously to step 7 only when every state is spec-defined, the maintainer answered
   that the fix needs no new look or the bug does not show on screen, and the fix is
   self-contained.
7. **Decide the effort of `plan`, post the report, then invoke `celetis:plan #<n>`.** Record the
   effort level of `plan` per `<plugin>/docs/procedures/effort.md`. Then
   `celetis --agent <host> issue <n> root-cause <report>`
   posts the report with `## Root cause` as its first line, so the report file has no heading; the report is the spec (root cause + red repro + intended
   behavior + step 3's traps + its `## Causal chain` section + its states table + its `## Masking check`
   section when applicable + its `## External facts` section + its `## Prior art` section when
   step 6 did the research + the link of the capture repro when step 4 made one) and `plan` drives
   the rest of the chain.
