---
name: lesson-review
description: Review and promote (or reject) lessons an automatic process queued in docs/lessons/_pending/. Auto-captured lessons never enter the live catalog directly — a human triages them here. Trigger phrases: "/celetis:lesson-review", "review pending lessons", "promote lessons", "triage the lesson queue".
---

**Host entry.** Before any step or answer, read [the host operations](../../docs/hosts/entry.md) relative to this loaded SKILL.md, including a same-session handoff.

# Review pending lessons

Human-in-the-loop gate between automatic lesson capture and the live catalog. Auto-captured
lessons land in `docs/lessons/_pending/` with `status: pending-review` and are NOT in
`INDEX.md`. This skill is the ONLY path that promotes a pending draft into the live catalog.
It is interactive — ask the reviewer per draft; never run it in an autonomous flow.

## Step 1: List the queue

Glob `docs/lessons/_pending/*.md`, EXCLUDING `QUEUE.md` and anything under
`_pending/_rejected/`. Cross-check against `docs/lessons/_pending/QUEUE.md`.

- Zero drafts → report "Lesson review queue is empty — nothing to promote." and stop.
- Otherwise list each draft: slug, `source`, `date`, one-line `description`.

## Step 2: Triage each draft (one at a time)

For each draft, read it in full and present slug, frontmatter, and body. Then ask with an
interactive question — options: **Approve**, **Edit & approve**, **Reject**, **Skip**.

Before asking, run the duplicate check: read `docs/lessons/INDEX.md` and scan for an
existing live lesson covering the same model. Note if the draft's body says "merge into existing
`[[{slug}]]`" — that means it is an UPDATE, not a new lesson.

### Approve

Two cases:

- **New lesson** (no live duplicate):
  1. Read the `/celetis:lesson` rules through the host entry as a reference — frontmatter keys, Tag Vocabulary, canonical body headings — including the optional `.claude/celetis-flow/custom/lesson.md` once on first use. Reuse that reference for later drafts. Fix anything non-conforming.
  2. Set `status: active`, remove the `source:` key (keep `date:` as today's date).
  3. `mv docs/lessons/_pending/{slug}.md docs/lessons/{slug}.md`.
  4. Add the catalog row to `docs/lessons/INDEX.md`.
  5. Remove the draft's row from `docs/lessons/_pending/QUEUE.md`.
- **Update to an existing live lesson** (duplicate found / `-update-` draft): do NOT add a new catalog row. Merge the draft into the live `{slug}.md` — append the new attempt(s), bump `recurrences`, refresh `date`, and note the repeat means the lesson has not become a mechanism. Then `rm` the pending draft and remove its `QUEUE.md` row.

Commit (scoped — stage only the lesson files touched):
```bash
git add docs/lessons/{slug}.md docs/lessons/INDEX.md
git commit -m "lessons: promote {slug} after review"
```

### Edit & approve

Revise the draft content first (tighten the rule, fix a wrong claim, adjust tags), then promote exactly as Approve.

### Reject

The draft is wrong, duplicate-without-value, or not worth keeping.
```bash
mkdir -p docs/lessons/_pending/_rejected
mv docs/lessons/_pending/{slug}.md docs/lessons/_pending/_rejected/{slug}.md
```
Remove its `QUEUE.md` row. No commit — both the draft and `QUEUE.md` are gitignored, so rejection leaves nothing trackable.

### Skip

Leave the draft in `_pending/` untouched. No commit.

## Step 3: Report

Summarize: promoted (with new INDEX rows), merged-into-existing, rejected, skipped, and how many drafts remain.

## Notes

- `_pending/` is gitignored, so its drafts are never tracked; promotion/rejection moves them with plain `mv`/`rm` (never `git mv`/`git rm`).
- Never auto-approve. Every promotion is an explicit reviewer decision.
- Keep commits scoped to `docs/lessons/**`.
- Promotion is the only write to `INDEX.md` for queued lessons; do not hand-add INDEX rows for pending drafts elsewhere.
