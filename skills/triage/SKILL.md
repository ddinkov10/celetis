---
name: triage
description: Type-axis front door for a cold, unclassified idea whose TYPE (/celetis:bug · /celetis:hotfix · /celetis:feature · /celetis:chore) is not yet known. Use when the human runs /celetis:triage, or when a request's type is unclear and must be resolved before a lane starts. Resolves type only; the lane it hands to owns requirements, branching and gates. If the type is already known, invoke the lane directly (/celetis:bug …) and skip triage.
---

**Celetis entry.** Before any step or response, including commentary or an announcement, bind `<plugin>` to the absolute prefix before `/skills/<name>/SKILL.md` in the path of this loaded file. Then read `<plugin>/docs/procedures/entry.md` whole, in one read, and follow it before any product-path scan. Do this on each invocation, including a same-session handoff.

# /celetis:triage — type-axis front door

Cold-idea entry point to the type-axis lane system. One job, three parts: **pick the type lane**
(`/celetis:bug` · `/celetis:hotfix` · `/celetis:feature` · `/celetis:chore`), **write a clean one-line description**, and **ask
whether to continue**. Nothing more — triage never starts a flow on its own.

Only for when the type is unknown. If you already know the type, invoke the lane directly
(`/celetis:bug …`).

## Scope

Triage resolves TYPE only. The lane it hands to owns requirements (`specify`), branching, and gates.

## Input

`#<n>` — an issue. Free text with no issue → run `/celetis:intake` first; it creates the issue and hands
back here. Read `gh issue view <n> --comments` and classify from the intent's `Problem` and
`Done when` plus the reporter's text. An issue that already carries a lane label (`bug`,
`enhancement`, `hotfix`, `chore`, `epic`) is routed: name its lane and stop. Labels and states:
`<plugin>/docs/issue-tracker.md`.

## Classification contract — the ordered decision tree

Criteria are taken verbatim from the lanes' own descriptions. Apply
them **in order** — cheapest, most distinctive test first — and stop at the first that fires:

1. **Mechanical, zero-behavior edit?** (rename, format, doc, config, comment, dep bump, code move —
   no stated fix, no behavior intent) → **`/celetis:chore`**.
2. Else **behavior exists today but is wrong?** (fix / broken / wrong / crash / regression / ≠ spec):
   - **production broken AND must ship now?** → **`/celetis:hotfix`**.
   - otherwise → **`/celetis:bug`** — only if a knowable correct state exists (a spec, or prior behavior
     that regressed). No spec and no prior-correct state → **`/celetis:feature`**.
3. Else **new capability or large rewrite?** (add / support / let / new / modernize / migrate / port /
   refactor) → **`/celetis:feature`**.

Three splitter questions resolve every ambiguity:

- *Does this behavior exist today, or is it new?* — separates bug/hotfix from feature.
- *Is production broken and must this ship now?* — separates hotfix from bug.
- *Is this a mechanical edit, or does it change behavior or architecture?* — separates chore from the rest.

**Rewrite trap:** "modernize / migrate / port / rewrite to X" preserves user-visible behavior but is a
large architectural change, not a mechanical edit. It is **`/celetis:feature`**, never `/celetis:chore`.

**Perf trap:** "slow / sluggish / performance / scrolls slowly" is not itself a bug signal — slowness
is either a regression (`/celetis:bug`) or never-was-fast (`/celetis:feature`). With no stated regression and no stated
new-perf goal, ask the existence splitter; do not silently default to `/celetis:bug`.

## Few-shot classifier

Clean mappings — classify silently, ask nothing:

| Idea | Lane |
|------|------|
| "The app crashes when opening a report with no rows" | bug |
| "The retry uses `<` instead of `<=`, so the last item never retries" | bug |
| "Prod: every login returns 500 since the 3pm deploy — ship a fix now" | hotfix |
| "Add a dark-mode toggle to settings" | feature |
| "Let users export a report as PDF" | feature |
| "Bump the HTTP client from 4.11 to 4.12" | chore |
| "Rename `FooManager` to `ProfileStore` across the module" | chore |
| "Modernize the app to a Kotlin-based stack" | feature |

Ambiguous — ask the one splitter that resolves it:

| Idea | Why ambiguous | Splitter to ask |
|------|---------------|-----------------|
| "The X screen is slow" | regression (bug) vs. never-was-fast perf work (feature) | did it regress, or is this new perf work? |
| "Improve error handling in sync" | fixing a broken case (bug) vs. new resilience (feature) | is a specific case broken today, or is this new coverage? |
| "Fix the export crash and add CSV export" | multi-type | split → bug (crash) + feature (CSV) |

## Flow

1. **Read the issue.** `gh issue view <n> --comments`; classify from the intent's `Problem` and
   `Done when`. Then **classify silently** against the ordered tree when the idea is clear. A clear idea produces zero questions.
2. **Disambiguate only when genuinely ambiguous between types** — ask 1–2 targeted splitter
   questions, no more.
3. **Edge handling:**
   - **Multi-type idea** ("fix the export crash *and* add CSV export") → this issue keeps the
     load-bearing type; `/celetis:intake` opens one issue per remaining type; triage each.
   - **Unclear** — the report lacks what its lane needs (a repro for a bug, an outcome for a
     feature) → sort the questions by `<plugin>/docs/procedures/stop.md`, "The check before a
     stop". Ask the maintainer each question that an answer in words settles, and go on with the
     answer. Write only the questions that the maintainer cannot answer in the session to a file,
     run `celetis --agent <host> issue <n> needs-info <file>` (it posts the questions, then adds
     `needs-info`), stop.
   - **No-fit idea** → write why to a file, run `celetis --agent <host> issue <n> wontfix <file>`
     (it posts the reason, adds `wontfix`, and closes the issue), stop.
4. **Clean one-liner** — normalize the idea into the single-sentence description the lane consumes.
5. **Decide the effort, label, announce, ask to continue** — record the effort level of the
   lane's first step per `<plugin>/docs/procedures/effort.md`. Then apply the lane label and clear
   the triage one (`celetis --agent <host> issue <n> route <lane>`
   with the lane `feature`, `bug`, `chore`, or `hotfix`; the feature lane's label is
   `enhancement`), then state the pick and the one-liner (`→ /celetis:bug #<n>: <one-liner>`). Ask the
   human whether to proceed. On yes, invoke that lane with `#<n>` and follow it; the lane's step-1
   confirm is the redirect gate. On no, stop — the label already carries the verdict.
   In a step session, ask nothing here: stop after the label and the announcement, and leave the
   lane to the daemon, which starts it in a fresh session.

## Eval — self-check (read and judge, do not run)

Ten sample ideas → expected lane. Read each, apply the ordered tree above, confirm it lands where
expected. This exists so a change to the criteria can be sanity-checked against known-correct
classifications. These ideas are DISTINCT from the few-shot examples on purpose — they test the
criteria, not recall.

| # | Idea | Expected |
|---|------|----------|
| 1 | "Submitting the form twice uploads the record twice" | bug |
| 2 | "Checkout is failing for every customer in production right now — this needs to go out today, not next sprint." | hotfix |
| 3 | "Add biometric unlock as an alternative to the PIN screen" | feature |
| 4 | "Upgrade the app framework from 1.6.1 to 1.7.0" | chore |
| 5 | "Reformat a source file with the project formatter" | chore |
| 6 | "The completed-count on the dashboard is wrong in production — it's cosmetic and can wait for the normal release." | bug |
| 7 | "Let users attach a short video to an answer" | feature |
| 8 | "Move a helper from util/ to helpers/ with no code change" | chore |
| 9 | "Prod down: app crashes on launch for all users — hotfix" | hotfix |
| 10 | "The list scrolls slowly with 500+ items" | ambiguous → ask: did it regress (bug) or is this new perf work (feature)? |
| 11 | "Modernize the app to a Kotlin-based stack" | feature |
| 12 | "A timed-out token refresh leaves downstream sites mishandling a null token, and no spec defines null-token behavior" | feature — the correct behavior is undefined, must be designed |
