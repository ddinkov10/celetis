---
name: plan
description: Use when turning a finished feature spec into an implementation plan. Superset of superpowers:writing-plans. Not for the design/elicitation pass (specify) or executing the plan (implement).
---

**Host entry.** Before any step or response, including commentary or an announcement, bind `<plugin>` to the absolute prefix before `/skills/<name>/SKILL.md` in this loaded file's path. Read [the host operations](../../docs/hosts/entry.md) at `<plugin>/docs/hosts/entry.md` directly, before any product-path scan. The relative link starts in the absolute directory containing this SKILL.md. Complete its startup reads on each invocation, including a same-session handoff.

# plan

Superset of `superpowers:writing-plans` for project features. Delegates to it; adds project context + capability scores + a verify phase.

## Do this

1. Enter the issue's worktree: run `/usr/bin/env BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 '<bun>' '--no-env-file' '--no-install' '--config=/dev/null' '--no-macros' '<plugin>/bin/celetis.ts' '--agent' '<host>' 'worktree' '<n>'` with a 10-minute timeout and bind
   the exact path it prints using the host operations (reuse the binding when the session is already there). The
   script re-enters the issue's branch and brings it up to the trunk, or creates it when the
   issue has none; when it refuses, show the user its message and stop.
2. Read the spec from the issue (`gh issue view <n> --comments`): the body when it opens with `Spec:`, else the latest `## Root cause` comment — a bug's debugging report is its spec. In the session that wrote it, the local spec file or the report in context holds the same text. Then invoke `superpowers:writing-plans` using the host operations and follow it — it owns plan structure, file mapping, task right-sizing, bite-sized TDD steps, frequent commits.
3. Layer the project additions below.

## Additions

**Read the project context.** Read the `AGENTS.md` of each subsystem the spec touches, and consult `docs/adr/` for architectural decisions that bear on the change; factor them in.

**Scan lessons.** Scan `docs/lessons/INDEX.md` for lessons matching the spec; read matches in full. This closes the fresh-context handoff — a feature's plan runs clean (see `specify` Terminal), so the entry lane's lesson scan does not carry over.

**Check the external facts.** Read the `## External facts` section of the spec or the `## Root cause` report. Settle per `<plugin>/docs/docs-lookup.md` each library API a task calls that the section does not cover. Carry the merged section as the plan's `## External facts`; the published `## Plan` comment hands it to `implement`. Copy each fact line a task depends on into that task's text, because an implementer's brief carries only its own task.

**Save the plan to `docs/superpowers/plans/YYYY-MM-DD-<topic>.md`** (gitignored scratch; the Terminal step publishes it to the issue).

**Record in the plan header**, only if the session effort bias ≠ default 2:
```
Bias:         <n>
```

**Per task:**
- **Capability score.** Score the task on the six-dimension rubric (digit anchors: `<plugin>/docs/capability.md`) and emit the CAP line with the script — never hand-compute the tier:
  ```bash
  /usr/bin/env BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 '<bun>' '--no-env-file' '--no-install' '--config=/dev/null' '--no-macros' '<plugin>/bin/celetis.ts' '--agent' '<host>' 'capscore' J V B N S X          # add --bias 0|1 to lower a cheap task
  ```
  Put the emitted `CAP: J_ V_ B_ N_ S_ X_ = n [+bN] → model/effort` line in the task header. The user reviews the scores with the plan; `implement` reuses the digits and written bias, resolves the current host's model and effort, and re-scores only a task whose scope materially changed. An absent `+bN` means bias 0; the model label is a historical binding.

**Tasks are gated.** State in the plan — a per-task line or a Global Constraint — that each implementation task must pass the verify gate of the project before its review.

**Open the plan with `### Your steps`.** It is the first section of the plan, before the header of `superpowers:writing-plans`. The publish of Terminal writes the `## Plan` line above it, so the plan file starts with `### Your steps`. It names each human act of the lane that the plan can see, in two lists:
- **During the build**: each act that prepares an agent check (for example a scratch repository, an install, or a secret), and each precondition of the landing (for example an environment variable that the new code reads). An item names the act, the step that needs it (a Verify scenario, or Land), and its report: a line of the maintainer's comment whose first line is `## Human steps done`.
- **After the landing**: each check by hand on the built change. An item names its commands and its expected result.

A list with no item is one line: `**During the build.** None.` or `**After the landing.** None.` A list with items has this form:

```markdown
### Your steps

**During the build.** Do these now. The build does not wait for you until it needs them.

1. <the act>. Needed by: <Verify Vn, or Land>.
   Report: the line `<the line>` in your `## Human steps done` comment.

**After the landing.** Run these after `/celetis:implement #<n>` lands the change. A FAIL is a new
bug: run `/celetis:bug` with the result.

1. <the check>: <the commands>. Expected: <the result>.
```

**Sort each check by its kind, not by the abilities of one session.** A check by hand needs what only a person has: the person's own signed-in account or a second identity, the person's own machine or device, or the person's judgment of a live result. It goes to "After the landing", never to the Verify phase. Each other check is a Verify scenario, also when it needs an act of "During the build". When you are not sure, the check stays in the Verify phase: a wrong sort to Verify costs a wait, and a wrong sort to "After the landing" removes a gate.

**Add a final Verify phase — how the feature is proven on the project's own runtime.** The concrete shape is project-specific (on-device E2E for an app, a live browser flow for web, a script that exercises the service for a backend). State the scenario(s) and the below-the-UI oracle (probes/disk/logcat/HTTP) in this phase. An agent runs each scenario. A scenario that needs an act of "During the build" names that act. Only such a scenario can wait for the maintainer: with no report of the act, `implement` stops with `## Before landing`. The Verify phase names no run of the full suite: the full suite runs once, on the tree that lands (`implement`, Land step 3).

**Name the reference.** State the external, named behavior the fix is measured against — the platform's own native flow for the same action, a shipped sibling feature, a competitor's equivalent. The phase exits only when the fix is at least as good as that reference; never leave the bar as an adjective.

**Carry unverified premises as risks.** If the spec flagged any load-bearing claim as unverified (specify), the plan names it in a Global Constraint or the Verify phase as a decision point: the claim is checked on the runtime, and the fallback path is pre-decided so the plan does not depend on the claim being true.

**Keep TDD** as the per-task discipline.

## Terminal

The execution method is already supplied: `/celetis:implement #<n>` in a fresh context. Once the plan is written and self-reviewed, publish it in the same turn with `/usr/bin/env BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 '<bun>' '--no-env-file' '--no-install' '--config=/dev/null' '--no-macros' '<plugin>/bin/celetis.ts' '--agent' '<host>' 'issue' '<n>' 'plan' '<plan>'`: it posts the plan with `## Plan` as its first line, then adds `ready-for-agent`. Then tell the user that the plan is on the issue for their review, repeat the two lists of `### Your steps` verbatim, and then tell the user to run `/celetis:implement #<n>` in a fresh context.
