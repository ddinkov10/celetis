---
name: polishing-code-comments
description: Use when polishing, tightening, or pruning existing code comments and inline docs — a comment-cleanup pass over a diff or file, or before finishing a branch. Not for adding missing comments or documentation coverage.
---

**Host entry.** Before any step or response, including commentary or an announcement, bind `<plugin>` to the absolute prefix before `/skills/<name>/SKILL.md` in this loaded file's path. Read [the host operations](../../docs/hosts/entry.md) at `<plugin>/docs/hosts/entry.md` directly, before any product-path scan. The relative link starts in the absolute directory containing this SKILL.md. Complete its startup reads on each invocation, including a same-session handoff.

# Polishing Code Comments

A review pass that **removes and tightens** existing comments. Bias to deletion. This is a pruning pass, not a coverage pass.

## Rules

1. **Default to no comment.** If the code is self-explanatory, delete the comment. A good name beats a comment.
2. **One line when it earns its place.** No multi-paragraph essays. No comment that restates the line below it.
3. **Why, not what.** Keep only comments that explain *why* — a non-obvious constraint, a workaround, a deliberate decision. Cut every "what" comment.
4. **Match surrounding density.** Mirror the file's existing comment idiom; don't import a heavier one.
5. **Kill noise:** commented-out code, JavaDoc/KDoc that just echoes the signature, ownerless `// TODO`, banner separators, changelog comments (git owns history).

## Pass

1. Scan the diff/file for every comment.
2. For each: does it explain *why*, and is it still true? Keep it (tightened to one line). Otherwise delete it.
3. Before deleting, confirm nothing load-bearing lived in the comment (a real caveat). If it did, keep it — one line.
4. Touch comments only. Leave logic, names, and formatting alone.

## Scope

The pass only deletes or tightens: comment count comes out the same or lower, and a terse comment
stays terse.
