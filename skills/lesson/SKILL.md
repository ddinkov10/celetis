---
name: lesson
description: Capture a lesson learned from a correction, mistake, or incident so it is not repeated — stores each lesson as its own file under docs/lessons/ with a catalog row in docs/lessons/INDEX.md. Use after the user corrects an approach, after resolving an incident, or when a non-obvious technique is validated and worth keeping. Trigger phrases: "/celetis:lesson", "capture this lesson", "remember not to do this", "save this lesson", "log this incident".
---

# Capture lesson learned

Record a lesson from a correction, mistake, or incident so it is not repeated.

**Input:** $ARGUMENTS (brief description of what went wrong, or empty to analyze from conversation context).

## Storage model

- `docs/lessons/INDEX.md` — the catalog: one table row per lesson (link, tags, date, summary). Scanned to decide which lesson is relevant.
- `docs/lessons/{slug}.md` — one self-contained file per lesson. Read in full only when the catalog row indicates relevance.

## Automatic capture → review queue

A lesson captured by an automatic / non-interactive process must NOT land in the live catalog
directly. Decide the path by who triggered the capture:

- **Automatic capture** — invoked inside any autonomous / `bypassPermissions` / pipeline flow. Write the draft to `docs/lessons/_pending/{slug}.md` with `status: pending-review`, plus `source:` and `date:` frontmatter. Do NOT add an `INDEX.md` row and do NOT write under `docs/lessons/` directly. Append a row to `docs/lessons/_pending/QUEUE.md` (create it if absent). `_pending/` is gitignored, so the draft is never recalled until promoted.
- **Interactive capture** — a human typed `/celetis:lesson` (they are the reviewer). Write directly to `docs/lessons/{slug}.md` + an `INDEX.md` row.

## Process

### Step 1: Gather context

If `$ARGUMENTS` is empty, analyze the conversation for: the mistake, the correction, the root cause. If `$ARGUMENTS` is provided, use it as the start; ask only if a required detail is missing.

### Step 2: Check for duplicates

Read `docs/lessons/INDEX.md` (and `docs/lessons/_pending/QUEUE.md`). Scan Tags and Summary for:
- **Duplicate** — update the existing lesson instead of adding a new file; bump the `recurrences` key and note the lesson has not become a mechanism.
- **Related** — merge, or cross-link with `[[slug]]` references.

### Step 3: Write the lesson file

**3a.** Create `docs/lessons/{slug}.md` (or `_pending/{slug}.md` for automatic capture). The slug is a short kebab-case description of the model or problem, not an incident ID.

**Frontmatter** — these keys, in this order; omit an optional key entirely rather than leaving it blank:

```markdown
---
name: {slug}                       # required — equals the file name without .md
description: {one-line summary}     # required — drives relevance retrieval
tags: [{tag}, {tag}]                # required — from the Tag Vocabulary: the list below with the tags of the custom part of the project
date: {YYYY-MM-DD}                  # required — most recent meaningful update
status: active                      # required — active | pending-review | superseded
source: {origin}                    # optional — only on auto-captures
recurrences: {n}                    # optional — bump on each recurrence
---
```

**Body** — this fixed heading set, exact casing, `##` level, in this order. Required sections are always present; recommended ones are included when they add value. Do not invent alternative names.

```markdown
# {Title — a plain statement of the rule, not a retelling of the incident}

## What happened
Required. The concrete incident.

## Root cause
Required. The mechanism, not the symptom.

## Anti-pattern
Recommended. The wrong approach, as a code block where possible.

## Fix
Required. The correct approach. For a validated technique, this is the technique.

## Detection signature
Recommended. The observable signal: error text, symptom, marker.

## Rule
Required. One or two sentences, transferable beyond the incident.

## Related lessons
Recommended. `[[slug]]` links. Omit the heading if none.
```

**3b.** For interactive capture, add a row to `INDEX.md`:

```markdown
| [{slug}]({slug}.md) | `{tag}` `{tag}` | {YYYY-MM-DD} | {one-line summary} |
```

Keep the summary tight — it is scanned, not read.

### Step 4: Cross-reference

After saving, check if the lesson should become a mechanism: update a custom part (`.claude/agent-flow/custom/<skill>.md`), `AGENTS.md`, `docs/`, or a subsystem `AGENTS.md` of the project. A change of a skill of the plugin is an issue of `ddinkov10/celetis`. Report what was saved and suggest follow-ups.

## Guidelines

1. Be specific — include WHY and WHEN.
2. Include the anti-pattern alongside the fix.
3. Reference durable files only (skills, `AGENTS.md`), not ephemeral artifacts.
4. No duplicates — update the existing lesson.
5. Actionable — every lesson leads to a concrete rule or check.
6. Date everything (YYYY-MM-DD).
7. Self-contained — each file is readable without the catalog.
8. Tags are mandatory, drawn from the Tag Vocabulary: the list below with the tags of the custom part of the project.
9. Keep `INDEX.md` and the files in sync — one row per file, one file per row.
10. Follow the canonical frontmatter + heading set; do not rename, reorder, or invent sections.

## Tag vocabulary

Draw every tag from this controlled list, with the tags of the custom part `lesson.md` of the project (`.claude/agent-flow/custom/lesson.md`). Introduce a new tag only when nothing fits, and add it to that custom part in the same change. Do not create synonyms or one-off tags. A project gives its own subsystem and technology names in that custom part.

- Technology: `api` `auth` `database` `data-store` `networking` `bridge` `build` `gradle` `deploy` `platform` `webview` `ui` `test` `config`
- Nature: `false-positive` `false-negative` `refix` `recurring` `regression` `platform-quirk` `data-loss` `performance`
- Process: `process` `build` `e2e` `git` `triage` `release`

!`cat "$(git rev-parse --show-toplevel)/.claude/agent-flow/custom/lesson.md" 2>/dev/null || true`
