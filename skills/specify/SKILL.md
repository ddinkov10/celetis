---
name: specify
description: Use when starting design on a project feature, before any plan or code exists. Superset of superpowers:brainstorming. Not for writing the implementation plan (plan) or executing one (implement).
---

**Celetis entry.** Before any step or response, including commentary or an announcement, bind `<plugin>` to the absolute prefix before `/skills/<name>/SKILL.md` in the path of this loaded file. Then read `<plugin>/docs/procedures/entry.md` whole, in one read, and follow it before any product-path scan. Do this on each invocation, including a same-session handoff.

# specify

Superset of `superpowers:brainstorming` for feature design. It does NOT reimplement brainstorming — it delegates to it and adds project context.

## The build rule

`specify` is the first step of the chain `specify` → `plan` → `implement`. Its product is the written spec, and `implement` is the only step that builds. Every request gets the written spec, whatever its size: the size sets only the length of the spec. The exceptions are the three ends with no spec, each under its rule below: a spike comment, an epic, and `wontfix`. The one approval of the session is the user's approval of that written text, because `plan` reads that same text.

Where the upstream skill tells the session to build, or to do the request, the session writes the spec. The session builds nothing that stays: no product code, no scaffolding, no dependency install, and no implementation skill. The only builds are throwaway, each under its addition below: a spike, and the prototype of a look decision.

## Do this

1. Enter the issue's worktree per `<plugin>/docs/procedures/worktree.md` (the session is already there when `/celetis:feature` hands over).
2. Read before the first message, with no offer to the user: the issue, the grounding documents below, and the code that the request touches. The issue: `gh issue view <n> --comments` — the body and any `## Intent` comment are the request. An epic's child also reads its parent's body, whose decisions bind the design (`gh api repos/{owner}/{repo}/issues/<n>/parent --jq .body`; 404 when standalone). What the issue holds is known: the first question goes to the first gap. The session also makes each later read or lookup with no offer.
3. Invoke `superpowers:brainstorming` as the entry contract says, and follow it under the build rule — it owns intent discovery, the conversation, and the builder check.
4. Layer the project additions below.

## Additions

1. **An opt-out skips the questions only.** When the user opts out of the questions, ask none: write the spec from the issue and the repository, and mark each guess as an assumption. After an opt-out, each open point of the builder check becomes a marked assumption too. A look decision still gets its variants and its captures: its list of states, its platform row, and its recommended variant are marked assumptions (`<plugin>/docs/procedures/ui.md`, "The procedure"). The hand-over lists the assumptions, and the approval of the written spec covers them.
2. **The builder check reads every written spec.** Run the upstream builder check before the hand-over of the spec to the user, whatever the length of the spec. Dispatch its reviewer per `<plugin>/docs/procedures/dispatch.md`, "One child", scored as a review — the digits are for the check, the read of one document, not for the feature (`<plugin>/docs/capability.md`). Keep the reviewer identity for a scoped re-check. The upstream skill owns the rest of the check.
3. **A spike is throwaway.** A request that is only a feasibility question ends with its answer: post the recommendation as an issue comment and stop; the issue stays unspecced until a design is approved. A spike inside a design conversation brings its result back to the conversation, and the session continues to the spec. In both cases the lane worktree holds no spike file when the session ends.
4. **A design that spans several independent features is an epic.** Run the scope check of `<plugin>/docs/procedures/epic.md` on the issue in place of the upstream one-at-a-time brainstorm of several independent projects. Remove the lane worktree (Terminal) in the turn of the relabel, before the report of the children, and stop after the report.
5. **Write a design spec, not an implementation plan.** The spec captures the `Who` / `Problem` / `Done when` / design shape / open risks, not step-by-step edits. `plan` turns that spec into code-level tasks.
6. **Flag unverified premises as risks.** Does the design rest on an assumption that neither the code nor a lookup per `<plugin>/docs/procedures/docs-lookup.md` could verify (a platform default, a vendor behavior, a library contract)? Name it as a load-bearing risk in the spec. `plan` decides how to unblock it — on-device check, a spike, a fallback path — so the plan never depends on an unverified claim being true.
7. **Build the options for each look decision.** Each change to what a person sees on screen, or to how the screen behaves, is a look decision (`<plugin>/docs/procedures/ui.md`, "The look decision"), also when the issue already describes the look. Invoke `celetis:prototype` and follow "The procedure" of that file through its cleanup (step 10), in place of the upstream Visual Companion. The pick comes before the approaches: the look is what the user wants, and the approaches are how it gets built. The record of step 9 is the spec's `## Prototype` section (`<plugin>/docs/issue-tracker.md`). The Visual Companion stays available for diagrams and other visuals that are not the app's own UI.
8. **Research the prior art before the approaches.** After the session understands what the user wants, and before it lays out the approaches (the upstream "Lay out the approaches"), research the prior art per `<plugin>/docs/procedures/prior-art.md`. The research runs once for the whole design, with one problem sentence. A look decision that comes up later adds its findings, with the guidelines of the platform, to the same `## Prior art` section. Do it with no offer to the user, under the rule of step 2, in place of the upstream "Offer recon" for the web. An opt-out of the questions does not skip it. What the user saw elsewhere still counts; the research adds to it. The spec carries the `## Prior art` section before its Approaches part, and the approaches follow "The recommendation" of that document. A session that ends before the approaches (a spike answer, an epic, `wontfix`) does no research.
9. **Before choosing a design, read the applicable principles.** For external input or validation changes, read `<plugin>/docs/principles/boundary-discipline.md`. For unclear state combinations, growing branches, or repeated shape rules, read `<plugin>/docs/principles/model-the-domain.md`. When the choice relies on a measured performance or quality claim, read `<plugin>/docs/principles/explain-the-number.md`.

The grounding documents of step 2:

- the project context per `<plugin>/docs/procedures/project-context.md`, for the subsystems the feature likely touches.
- `<plugin>/docs/procedures/docs-lookup.md` — settle the external facts the design rests on, and carry them in the spec's `## External facts` section.

**Save the spec to `docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md`** (gitignored scratch, so the upstream commit step has nothing to commit). After the user approves the written spec, **publish it as the issue body** with `celetis --agent <host> issue <n> spec <spec>`: the command puts `Spec: YYYY-MM-DD` on its first line, so the spec file has no `Spec:` line. The publish records that approval: the runner's resolver, `celetis --agent <host> next-step`, sends an issue whose body opens with `Spec:` to `/celetis:plan`, and nothing checks the design again. The issue body is the durable spec; `plan` in a fresh context reads it from there.

## Terminal

Do NOT auto-invoke `writing-plans`. Tell the user to run `/celetis:plan #<n>` in a fresh context (their flow: specify → clean context → plan).

A design `specify` rejects: write the reason to a file, run `celetis --agent <host> issue <n> wontfix <file>` (it posts the reason, adds `wontfix`, and closes the issue), remove the lane worktree, stop.

**Remove the lane worktree** when the issue ends here, closed as `wontfix` or relabelled `epic`: `<plugin>/docs/procedures/worktree.md`, "The removal".

**Three acts move the line** of the issue (`<plugin>/docs/procedures/stop.md`, "The act that moves the line"): the publish of the spec, the relabel to `epic`, and the close as `wontfix`. Do the later acts of each in its turn: after the publish, the Terminal message; after the relabel, the sub-issues, the removal of the lane worktree, and then the report; after the close, the removal of the lane worktree.
