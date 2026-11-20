# The skill document writes the documents that the readers need

## Date

2026-11-19

## Related

- [Issue #354](https://github.com/ddinkov10/celetis/issues/354): the spec (the body of the issue,
  `Spec: 2026-11-19`) and the plan.
- [Issue #355](https://github.com/ddinkov10/celetis/issues/355): the follow-up that publishes the
  documents as a web page.
- [ADR-0089](0089-each-component-keeps-its-reference-beside-it.md): the homes of the reference
  documents of this repository stay as they are. The explanation documents are a new kind, with a
  home of their own.
- [ADR-0095](0095-the-shared-agent-text-lives-in-references.md): a file that only one skill reads
  lives in the folder of that skill, so the type rules live in `plugins/celetis/skills/document/`.
- `plugins/celetis/skills/document/SKILL.md` and `plugins/celetis/skills/document/types.md`.

## Context

Before this record, Celetis only kept existing documents true: each lane applies
`plugins/celetis/references/procedures/behavior-documentation.md`, and `doc-drift-sync` repairs
drift. No part of Celetis decided which documents a product needs, and no part wrote a document
from nothing. This repository had reference text for a maintainer or an agent, and no document
that explains how Celetis works to a person who wants to understand it. The maintainer asked for
"what the big products use to do that so it's clean concise and working" (2026-11-19).

## Constraints and evidence

- Diátaxis sorts documents into four types by the need of the reader: tutorial, how-to guide,
  reference, and explanation (https://diataxis.fr/). Its pages show no license line.
- The `diataxis` skill of joshuadavidthomas/agent-skills at `516dee7` is MIT, but its
  `references/` text derives from diataxis.fr under CC BY-SA 4.0, and this repository has no
  license file to state that share-alike license next to a copy
  (https://github.com/joshuadavidthomas/agent-skills/blob/516dee7a422b90937b2958d11c03694154ab9c09/diataxis/README.md).
- The design probe of the spec: `codex plugin add diataxis@joshthomas-agent-skills` installed the
  whole repository root, about 30 skill folders, on Codex.
- DeepWiki plans an explicit set of pages, each with a purpose. Google Code Wiki regenerates its
  pages after each change. The `ARCHITECTURE.md` convention and arc42 lean give the outline of an
  overview, and the C4 model gives the zoom levels of its diagrams. The spec, "Prior art", names
  each source.
- GitHub renders a fenced code block with the identifier `mermaid` as a diagram
  (https://docs.github.com/en/get-started/writing-on-github/working-with-advanced-formatting/creating-diagrams).
- A large repository can exceed one session: this repository has about 15,400 lines of documents
  outside the records, and a large engine.

## Decision

1. **The skill.** The plugin has the skill `document`. Only a person starts it:
   `disable-model-invocation: true` on Claude Code, and `policy.allow_implicit_invocation: false`
   in `agents/openai.yaml` on Codex. It writes many files, so no agent starts it from its
   description.
2. **The types.** The skill writes the four Diátaxis types, and it chooses each type by the need of
   a reader that the run names: understand gives explanation, learn by doing gives a tutorial, do a
   task gives a how-to guide, and look up a fact gives reference. A type gets a document only when
   a reader of the run needs it.
3. **Our own text.** The rules of the types live in `plugins/celetis/skills/document/types.md`, in
   our own words, with links to diataxis.fr. The file copies no text of diataxis.fr or of the
   `diataxis` skill. Beside the rules of each type, it states the rules of the skill for that type,
   for example that each step of a tutorial or a how-to guide runs once before it is written.
4. **The set and its approval.** The skill reads the project, proposes one table of documents,
   each with a type, a title, a path, a reader, a question, and its sources, and writes nothing
   before the maintainer's yes. An approved spec or plan that holds the set is the approval.
5. **The homes.** By default, a document goes into `docs/explanation/`, `docs/tutorials/`,
   `docs/how-to/`, or `docs/reference/`, and a folder exists only when it holds a document. An
   existing home of the same kind wins, and so does a home that the project names. The overview of
   the product is `docs/explanation/overview.md`, with five parts: the problem, the codemap, the
   invariants, the boundaries, and the cross-cutting concerns.
6. **One child for each document.** The session reads the project by its layout, and a child agent
   writes each document from the sources of its row. Each child writes only its own file; only the
   session edits the root `README.md` and makes the commit.
7. **One local commit.** The skill adds a list of the documents to the root `README.md`, and makes
   one local commit `docs: <what>` with a path list. It does not push, and it runs no verify gate:
   in a lane, the landing runs the verify gate of the project on the whole lane.
8. **No regeneration.** The skill writes each document once. A second run proposes only the gaps.
   The lanes and `doc-drift-sync` keep the documents true, because they cover `docs/**/*.md`.

## Constitution

Read: `CONSTITUTION.md`, amended 2026-11-12.

- Serves: 4 Product neutrality: the skill names roles (the readers, the types, the homes), and
  each product project names its own readers, homes, and style.
- Hard limits and non-goals: none touched.

## Alternatives considered

- **A. A hosted wiki tool (DeepWiki or Google Code Wiki).** It needs no work in Celetis, but it
  puts the documents on a website outside the repository, Celetis gains no capability, and a
  private repository needs a paid account.
- **B. A copy of the `diataxis` skill in the plugin.** It covers the four types, but it has no
  procedure to read a repository, to decide a set, or to tie each claim to a source, and its
  reference text carries CC BY-SA 4.0 with no license file here to state it.
- **B2. Our procedure, with the `diataxis` skill as a required plugin.** It needs no copy, but each
  product project must install a third-party plugin on each host, its description starts it for
  any document work, it installs about 30 unrelated skills on Codex, and the agent must join two
  texts. The maintainer asked which approach gives better results; the session answered C, by
  judgment with no measurement, and the maintainer chose C on 2026-11-19.
- **Regeneration after each change, as Code Wiki does.** A full rewrite discards the text that the
  maintainer approved, and it conflicts with the smallest edits of the lanes and `doc-drift-sync`.

## Consequences

- A product project gets the documents that its named readers need, with a source for each claim.
- The type rules are our own text, so they do not get the updates of diataxis.fr. A change of
  Diátaxis needs an edit of `types.md`.
- The quality of a document has no executable check: only a reader decides whether it explains its
  topic. The approval of the set and the review of the written documents stay human acts.
- A document that the lanes and `doc-drift-sync` do not touch can go stale where its facts change.
  The overview states only facts that change rarely, to keep this small.

## Reconsider when

- The lanes or `doc-drift-sync` stop covering `docs/**/*.md`.
- A host gives a supported way to depend on another plugin with no unrelated skills, and the
  `diataxis` skill gets a license that this repository can carry.
- The maintainers want the documents on a web page (#355) in a form that needs other homes.
