---
name: doc-drift-sync
description: Run the daily doc-drift maintenance pass — keep the project living docs (AGENTS.md, docs/**, README/CLAUDE) truthful against current code. Auto-fix obvious, source-verified drift (stale file/symbol refs, broken .md links, dangling referenced files, source-line locators); flag judgment calls. Use when asked to sync/refresh/audit the docs against the code, or when invoked by the daily cron.
aliases: [/doc-drift-sync]
---

# Doc-Drift Sync

Keep the docs honest against the current code. Fix the obvious drift, flag the rest, never guess. A wrong edit is worse than a missed one.

## Rules
- **Verify, don't guess.** Every fix is backed by source you actually read. Can't confirm it? Flag it, don't edit.
- **Smallest edit that makes the doc true.** Cover what this pass's diff made stale or silent, at the smallest size that makes it true — don't restyle, and don't document what the diff never touched.
- **Docs stay big-picture.** No line numbers, no `search for x()` anchors. Keep the method/symbol name, drop the locator.

## Scope
- **Edit only:** `docs/**/*.md` (not `docs/superpowers/**`), every `AGENTS.md`, `README.md`, plus the project's own doc landmarks (set by the project; e.g. a per-subsystem `docs/`).
- **Source of truth:** the project source tree. For third-party library APIs check their docs — don't judge from memory.
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
The line is **confidence, not category**. Read source until you either know the one correct form or know you can't get there. Nothing is too big to fix if you are sure, and nothing is too small to flag if you are not.

**Fix and commit** — source-verified, one unambiguous form. Not a closed list; these are the common shapes:
- locator → strip it
- renamed/moved file or broken link with one clear target → repoint
- renamed symbol/flag, or changed signature → update the token
- behavior the code no longer has, or a change in this pass's diff the doc is silent about → say what the code now does, in the target's own form (see Writing prose into a doc)

**Flag** (leave the doc alone, list it in your closing summary) when reading source does not settle it: an ambiguous rename with more than one plausible target, a count you would have to guess at, a call about what the doc *should* cover rather than what is true, or anything you are less than sure of. Flag it too when the gap is real and you are certain but the diff never touched that code — being sure is what makes it fixable, being in the diff is what makes it yours this run. **When unsure, flag.** A wrong edit is worse than a missed one.

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
2. **Body** — one entry per doc you touched: what it claimed, and what the code actually does, pointing at code by the name a reader can grep for: a symbol, flag, method or file. Nothing else. Git already records the parent, the author and the date, and how you arrived at the edit is not part of the record.
3. **Trailer** — `Co-Authored-By: <helper>` with a recognizable identity from the project convention.

No drift → no commit, no churn. Never push.
