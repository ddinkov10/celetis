---
name: specify
description: Use when starting design on a project feature, before any plan or code exists. Superset of superpowers:brainstorming. Not for writing the implementation plan (plan) or executing one (implement).
---

**Host entry.** Before any step or response, including commentary or an announcement, bind `<plugin>` to the absolute prefix before `/skills/<name>/SKILL.md` in this loaded file's path. Read [the host operations](../../docs/hosts/entry.md) at `<plugin>/docs/hosts/entry.md` directly, before any product-path scan. The relative link starts in the absolute directory containing this SKILL.md. Complete its startup reads on each invocation, including a same-session handoff.

# specify

Superset of `superpowers:brainstorming` for feature design. It does NOT reimplement brainstorming — it delegates to it and adds project context.

## The build rule

`specify` is the first step of the chain `specify` → `plan` → `implement`. Its product is the written spec, and `implement` is the only step that builds. Every request gets the written spec, whatever its size: the size sets only the length of the spec. The exceptions are the three ends with no spec, each under its rule below: a spike comment, an epic, and `wontfix`. The one approval of the session is the user's approval of that written text, because `plan` reads that same text.

Where the upstream skill tells the session to build, or to do the request, the session writes the spec. The session builds nothing that stays: no product code, no scaffolding, no dependency install, and no implementation skill. The only builds are throwaway, each under its addition below: a spike, and the prototype of a look decision.

## Do this

1. Enter the issue's worktree: run `celetis --agent <host> worktree <n>` with a 10-minute timeout and bind the exact path it prints using the host operations (reuse the binding when the session is already there, as it is when `/celetis:feature` hands over). When the script refuses, show the user its message and stop.
2. Read before the first message, with no offer to the user: the issue, the grounding documents below, and the code that the request touches. The issue: `gh issue view <n> --comments` — the body and any `## Intent` comment are the request. An epic's child also reads its parent's body, whose decisions bind the design (`gh api repos/{owner}/{repo}/issues/<n>/parent --jq .body`; 404 when standalone). What the issue holds is known: the first question goes to the first gap. The session also makes each later read or lookup with no offer.
3. Invoke `superpowers:brainstorming` using the host operations and follow it under the build rule — it owns intent discovery, the conversation, and the builder check.
4. Layer the project additions below.

## Additions

1. **An opt-out skips the questions only.** When the user opts out of the questions, ask none: write the spec from the issue and the repository, and mark each guess as an assumption. After an opt-out, each open point of the builder check becomes a marked assumption too. The hand-over lists the assumptions, and the approval of the written spec stays.
2. **The builder check reads every written spec.** Run the upstream builder check before the hand-over of the spec to the user, whatever the length of the spec. Score its dispatch with `celetis --agent <host> capscore` — the digits are for the check, the read of one document, not for the feature (`<plugin>/docs/capability.md`). Add `--reviewer --json`, apply both resolved dispatch fields through the host operations, and make `line` the first line of the isolated child brief. Include the exact checkout and relevant project instructions. Keep the reviewer identity for a scoped re-check. The upstream skill owns the rest of the check.
3. **A spike is throwaway.** A request that is only a feasibility question ends with its answer: post the recommendation as an issue comment and stop; the issue stays unspecced until a design is approved. A spike inside a design conversation brings its result back to the conversation, and the session continues to the spec. In both cases the lane worktree holds no spike file when the session ends.
4. **A design that spans several independent features is an epic.** Run `/celetis:feature`'s scope check on the issue in place of the upstream one-at-a-time brainstorm of several independent projects. Remove the lane worktree (Terminal) in the turn of the relabel, before the report of the children, and stop after the report.
5. **Write a design spec, not an implementation plan.** The spec captures the `Who` / `Problem` / `Done when` / design shape / open risks, not step-by-step edits. `plan` turns that spec into code-level tasks.
6. **Flag unverified premises as risks.** Does the design rest on an assumption that neither the code nor a lookup per `<plugin>/docs/docs-lookup.md` could verify (a platform default, a vendor behavior, a library contract)? Name it as a load-bearing risk in the spec. `plan` decides how to unblock it — on-device check, a spike, a fallback path — so the plan never depends on an unverified claim being true.
7. **Build the options for a look decision.** When a question is how the app's own UI should look (layout, hierarchy, placement, what a surface shows) and the issue, the design document that `AGENTS.md` names, and the answers so far leave it open, it is a look decision (`AGENTS.md` of the project): build its options with `celetis:prototype` and hand them over before asking, in place of the upstream Visual Companion. Record the pick as the spec's `## Prototype` section (`<plugin>/docs/issue-tracker.md`). The Visual Companion stays available for diagrams and other visuals that are not the app's own UI.

The grounding documents of step 2:

- `AGENTS.md` — project architecture.
- the `AGENTS.md` of the subsystem(s) the feature likely touches.
- `docs/adr/` — architectural decisions that bear on the feature; factor them in.
- Scan `docs/lessons/INDEX.md` for lessons matching this change; read matches in full.
- `<plugin>/docs/docs-lookup.md` — settle the external facts the design rests on, and carry them in the spec's `## External facts` section.

**Save the spec to `docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md`** (gitignored scratch, so the upstream commit step has nothing to commit). After the user approves the written spec, **publish it as the issue body** with `celetis --agent <host> issue <n> spec <spec>`: the command puts `Spec: YYYY-MM-DD` on its first line, so the spec file has no `Spec:` line. The publish records that approval: the runner's resolver, `celetis --agent <host> next-step`, sends an issue whose body opens with `Spec:` to `/celetis:plan`, and nothing checks the design again. The issue body is the durable spec; `plan` in a fresh context reads it from there.

## Terminal

Do NOT auto-invoke `writing-plans`. Tell the user to run `/celetis:plan #<n>` in a fresh context (their flow: specify → clean context → plan).

A design `specify` rejects: write the reason to a file, run `celetis --agent <host> issue <n> wontfix <file>` (it posts the reason, adds `wontfix`, and closes the issue), remove the lane worktree, stop.

**Remove the lane worktree** when the issue ends here, closed as `wontfix` or relabelled `epic`: return to the main checkout using the host operations, keeping the lane, then run `celetis --agent <host> worktree --remove <n>`. It deletes the worktree, the lane branch, and the issue's `prototype/<n>-*` branches. The script refuses → show the user its message and keep the worktree.

**One turn after the line moves.** Three acts move the issue's line in the runner's resolver (`celetis --agent <host> next-step`): the publish of the spec, the relabel to `epic`, and the close as `wontfix`. A session that the runner started ends at its first idle moment after such an act (`<plugin>/docs/celetis-flow.md`, "The step end"). So get each answer from the user before the act, and do each later act in the same turn as the act: after the publish, the Terminal message; after the relabel, the sub-issues, the removal of the lane worktree, and then the report; after the close, the removal of the lane worktree.
