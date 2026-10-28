---
name: lesson
description: Capture a lesson learned from a correction, mistake, or incident so it is not repeated — stores each lesson as its own file under docs/lessons/ with a catalog row in docs/lessons/INDEX.md. Use after the user corrects an approach, after resolving an incident, or when a non-obvious technique is validated and worth keeping. Trigger phrases: "/celetis:lesson", "capture this lesson", "remember not to do this", "save this lesson", "log this incident".
---

**Celetis entry.** Before any step or response, including commentary or an announcement, bind `<plugin>` to the absolute prefix before `/skills/<name>/SKILL.md` in the path of this loaded file. Then read `<plugin>/docs/procedures/entry.md` whole, in one read, and follow it before any product-path scan. Do this on each invocation, including a same-session handoff.

# Capture lesson learned

Record a lesson from a correction, mistake, or incident so it is not repeated.

**Input:** the invocation input (brief description of what went wrong, or empty to analyze from conversation context).

## Storage model

- `docs/lessons/INDEX.md` — the catalog: one table row per lesson (link, tags, date, summary). Scanned to decide which lesson is relevant.
- `docs/lessons/{slug}.md` — one self-contained file per lesson. Read in full only when the catalog row indicates relevance.

## Automatic capture → review queue

A lesson captured by an automatic / non-interactive process must NOT land in the live catalog
directly. Decide the path by who triggered the capture:

- **Automatic capture** — invoked inside any autonomous or pipeline flow. Write the draft to `docs/lessons/_pending/{slug}.md` with `status: pending-review`, plus `source:` and `date:` frontmatter. Do NOT add an `INDEX.md` row and do NOT write under `docs/lessons/` directly. Append a row to `docs/lessons/_pending/QUEUE.md` (create it if absent). `_pending/` is gitignored, so the draft is never recalled until promoted.
- **Interactive capture** — a human typed `/celetis:lesson` (they are the reviewer). Write directly to `docs/lessons/{slug}.md` + an `INDEX.md` row.

## Process

### Step 1: Gather context

If the invocation input is empty, analyze the conversation for: the mistake, the correction, the root cause. If the invocation input is provided, use it as the start; ask only if a required detail is missing.

### Step 2: Check for duplicates

Read `docs/lessons/INDEX.md` (and `docs/lessons/_pending/QUEUE.md`). Scan Tags and Summary for:
- **Duplicate** — update the existing lesson instead of adding a new file; bump the `recurrences` key and note the lesson has not become a mechanism.
- **Related** — merge, or cross-link with `[[slug]]` references.

### Step 3: Write the lesson file

Read `<plugin>/docs/procedures/lesson-format.md`, and follow it: the frontmatter keys, the body headings, the catalog row, and the Tag Vocabulary.

**3a.** Create `docs/lessons/{slug}.md` (or `_pending/{slug}.md` for automatic capture). The slug is a short kebab-case description of the model or problem, not an incident ID. Write its frontmatter and its body in the lesson format.

**3b.** For interactive capture, add its catalog row to `INDEX.md`.

### Step 4: Cross-reference

After saving, check if the lesson should become a mechanism: update `custom.<skill>` in `.celetis.yaml`, `AGENTS.md`, `docs/`, or a subsystem `AGENTS.md` of the project. A change of a skill of the plugin is an issue of `ddinkov10/celetis`. Report what was saved and suggest follow-ups.

## Guidelines

1. Be specific — include WHY and WHEN.
2. Include the anti-pattern alongside the fix.
3. Reference durable files only (skills, `AGENTS.md`), not ephemeral artifacts.
4. No duplicates — update the existing lesson.
5. Actionable — every lesson leads to a concrete rule or check.
6. Date everything (YYYY-MM-DD).
7. Self-contained — each file is readable without the catalog.
8. Keep `INDEX.md` and the files in sync — one row per file, one file per row.
