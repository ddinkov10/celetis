---
name: plan
description: Use when turning a finished feature spec into an implementation plan. Superset of superpowers:writing-plans. Not for the design/elicitation pass (specify) or executing the plan (implement).
---

**Host entry.** Before any step or response, including commentary or an announcement, bind `<plugin>` to the absolute prefix before `/skills/<name>/SKILL.md` in this loaded file's path. Read [the host operations](../../docs/hosts/entry.md) at `<plugin>/docs/hosts/entry.md` directly, before any product-path scan. The relative link starts in the absolute directory containing this SKILL.md. Complete its startup reads on each invocation, including a same-session handoff.

# plan

Superset of `superpowers:writing-plans` for project features. Delegates to it; adds project context + capability scores + a verify phase.

## Do this

1. Enter the issue's worktree: run `scripts/celetis worktree <n>` with a 10-minute timeout and bind
   the exact path it prints using the host operations (reuse the binding when the session is already there). The
   script re-enters the issue's branch, or creates it when the issue has none; when it refuses,
   show the user its message and stop.
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
  scripts/celetis capscore J V B N S X          # add --bias 0|1 to lower a cheap task
  ```
  Put the emitted `CAP: J_ V_ B_ N_ S_ X_ = n [+bN] → model/effort` line in the task header. The user reviews the scores with the plan; `implement` reuses the digits and written bias, resolves the current host's model and effort, and re-scores only a task whose scope materially changed. An absent `+bN` means bias 0; the model label is a historical binding.

**Tasks are gated.** State in the plan — a per-task line or a Global Constraint — that each implementation task must pass the verify gate of the project before its review.

**Add a final Verify phase — how the feature is proven on the project's own runtime.** The concrete shape is project-specific (on-device E2E for an app, a live browser flow for web, a script that exercises the service for a backend). State the scenario(s) and the below-the-UI oracle (probes/disk/logcat/HTTP) in this phase.

**Name the reference.** State the external, named behavior the fix is measured against — the platform's own native flow for the same action, a shipped sibling feature, a competitor's equivalent. The phase exits only when the fix is at least as good as that reference; never leave the bar as an adjective.

**Carry unverified premises as risks.** If the spec flagged any load-bearing claim as unverified (specify), the plan names it in a Global Constraint or the Verify phase as a decision point: the claim is checked on the runtime, and the fallback path is pre-decided so the plan does not depend on the claim being true.

**Keep TDD** as the per-task discipline.

## Terminal

The execution method is already supplied: `/celetis:implement #<n>` in a fresh context. Once the plan is written and self-reviewed, publish it in the same turn: `gh issue comment <n> --body-file <plan>` with `## Plan` as its first line, then `gh issue edit <n> --add-label ready-for-agent`. Then tell the user the plan is on the issue for their review, and to run `/celetis:implement #<n>` in a fresh context.
