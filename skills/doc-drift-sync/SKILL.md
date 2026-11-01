---
name: doc-drift-sync
description: Use when asked to sync, refresh, or audit current project documents against intended behavior and source, or when the daily doc-drift maintenance pass runs.
---

**Celetis entry.** Before any step or response, including commentary or an announcement, bind `<plugin>` to the absolute prefix before `/skills/<name>/SKILL.md` in the path of this loaded file. Then read `<plugin>/docs/procedures/entry.md` whole, in one read, and follow it before any product-path scan. Do this on each invocation, including a same-session handoff.

# Doc-Drift Sync

Keep current docs aligned with approved intent. Read
`<plugin>/docs/procedures/behavior-documentation.md` and apply "Assessment" and "Standalone
drift" to this pass. Fix supported drift and report unresolved discrepancies.

## Rules
- **Verify, don't guess.** Read the evidence that the shared assessment requires. Can't confirm it? Flag it, don't edit.
- **Smallest edit that makes the doc true.** Cover what this pass's diff made stale or silent, at the smallest size that makes it true — don't restyle, and don't document what the diff never touched.
- **Docs stay big-picture.** No line numbers, no `search for x()` anchors. Keep the method/symbol name, drop the locator.

## Scope
- **Edit only:** current `docs/**/*.md` (not `docs/superpowers/**` or historical decision records), every `AGENTS.md`, `README.md`, plus the project's own doc landmarks (set by the project; e.g. a per-subsystem `docs/`).
- **Evidence:** use the shared assessment for behavioral claims and source for mechanical facts. For third-party library APIs check their docs — don't judge from memory.
- **Blocked files:** anything the project marks blocked (secrets, generated config, credentials). Never read or reference them.

## What drift looks like
A doc token that no longer matches code:
- a file / class / method / field / flag / constant renamed, moved, or deleted
- a changed method signature
- a broken `.md` link, or a referenced file that doesn't exist
- a source locator (line number or `search for` anchor)
- a count that's badly off (>25%)
- prose describing behavior the code no longer has

## How to run
1. **See what changed.** Find your last pass with `git log --grep="docs(drift):" -1`, then `git diff` from it to HEAD (none found → last 14 days). Note renamed/deleted files and added/removed symbols.
2. **Cheap scan — every in-scope doc:**
   - every relative `.md` link resolves on disk
   - every referenced filename — in a link, a path, or plain backtick prose — exists. Resolve relative to the doc first (shorthand inside an ASCII tree is fine). One basename match elsewhere = a rename to repoint; no match = dangling → flag.
   - every source locator → strip it, keep the symbol name
3. **Deep check** the docs that name a changed symbol/file: grep current source. If the symbol is gone, find out why from git (`git log -S` / `--follow`) before acting.

## Fix or flag
Use the shared assessment to separate mechanical drift, approved behavioral corrections, and
implementation defects. Confidence about source behavior alone does not settle a behavioral claim.

**Fix and commit** — supported by the required evidence, with one unambiguous form:
- locator → strip it
- renamed/moved file or broken link with one clear target → repoint
- renamed symbol/flag, or changed signature → update the token
- an approved behavioral change in this pass's diff makes current prose stale or incomplete → update the affected section through the shared assessment, in the target's own form (see Writing prose into a doc)

**Flag** unresolved discrepancies from the shared assessment in the closing summary, leaving
disputed prose unchanged. Also flag an ambiguous rename, a count you would have to guess at, or
a gap outside this pass's diff. Continue independent safe corrections within the scan boundary.

## Writing prose into a doc
Applies the moment an edit adds or reshapes a sentence, bullet, or section — not to a bare token swap. Read the target before you write a word.

1. **Measure the neighbors.** The bullets in the same list, or the two sections either side. Note the longest sibling in words, fragment vs sentence, terminal periods or not, nesting, and which emphasis devices the section uses (`>` callouts, **bold** labels, headings).
2. **Reuse the file's own idiom.** If the file already documents the same *kind* of thing — a flag choosing between two classes, an enum, a rule — your edit takes that exact form, wherever in the file that example sits. Copy the shape, don't invent one. This outranks step 3: when the file's idiom for this kind of thing and the immediate neighbors disagree, follow the idiom.
3. **Stay inside the local envelope.** Length, punctuation and emphasis match what the section already does. A section whose bullets are 8-word fragments with no periods gets an 8-word fragment with no period.

**The contract: a reader cannot tell which lines you added.**

Important content is not a license to escalate form — a production-breaking constraint gets the same register as its neighbors. A rule or rationale goes where the file already keeps rules, not into a component or API listing. If the reason already lives in a comment at the code site, leave it there; a second copy is a second thing to drift.

## Commit
One local commit, in-scope docs only, in three parts:

1. **Subject** — `docs(drift): <what you did>`, using any accurate verb (sync, correct, strip, document).
2. **Body** — one entry per doc you touched: the corrected claim and its evidence under "Standalone drift" of the shared procedure. Name source by a symbol, flag, method, or file a reader can find; behavioral entries also cite the supporting approved intent.
3. **Trailer** — `Co-Authored-By: <helper>` with a recognizable identity from the project convention.

No drift → no commit, no churn. Never push.
