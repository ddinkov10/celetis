# The lesson format

The format of a lesson file in `docs/lessons/` and of its catalog row in `docs/lessons/INDEX.md`.
`lesson` writes each lesson in it, and `lesson-review` makes each draft conform to it before a
promotion. Do not rename, reorder, or invent keys or sections.

## The frontmatter

These keys, in this order; omit an optional key entirely rather than leaving it blank:

```markdown
---
name: {slug}                       # required — equals the file name without .md
description: {one-line summary}     # required — drives relevance retrieval
tags: [{tag}, {tag}]                # required — from the Tag Vocabulary
date: {YYYY-MM-DD}                  # required — most recent meaningful update
status: active                      # required — active | pending-review | superseded
source: {origin}                    # optional — only on auto-captures
recurrences: {n}                    # optional — bump on each recurrence
---
```

## The body

This fixed heading set, exact casing, `##` level, in this order. Required sections are always
present; recommended ones are included when they add value. Do not invent alternative names.

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

## The catalog row

One row in `docs/lessons/INDEX.md` for each live lesson:

```markdown
| [{slug}]({slug}.md) | `{tag}` `{tag}` | {YYYY-MM-DD} | {one-line summary} |
```

Keep the summary tight — it is scanned, not read.

## The Tag Vocabulary

Tags are mandatory. Draw every tag from this controlled list, with the lesson tags that the
project's `AGENTS.md` names. Introduce a new tag only when nothing fits, and add it to the lesson
tags of `AGENTS.md` in the same change. Do not create synonyms or one-off tags. A project gives
its own subsystem and technology names in its `AGENTS.md`.

- Technology: `api` `auth` `database` `data-store` `networking` `bridge` `build` `gradle` `deploy` `platform` `webview` `ui` `test` `config`
- Nature: `false-positive` `false-negative` `refix` `recurring` `regression` `platform-quirk` `data-loss` `performance`
- Process: `process` `build` `e2e` `git` `triage` `release`
