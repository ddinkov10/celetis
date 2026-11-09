# The gate checks cited sections and link fragments

## Date

2026-11-09

## Related

- [Issue #264](https://github.com/ddinkov10/celetis/issues/264): the spec of this change. It
  moves agent instructions out of the maintainer documents and cites their sections by name.
- [ADR-0029](0029-the-repository-keeps-no-tests.md): the repository keeps no tests. The probe of
  the check lives outside the repository.
- [ADR-0084](0084-the-agent-text-names-engine-outcomes.md): the agent text names engine outcomes.
  The agent text cites a maintainer document for a definition, so a citation must stay true.
- `AGENTS.md`, "Where agent text lives": the paragraph of `checkCitations` states the three rules.

## Context

`checkCitations` checked that the file of a `<plugin>/<path>` citation exists and that the file of
a relative link exists. It did not check the section that a citation names, nor the fragment of a
link. A renamed heading left each such reference true to the gate and false to the reader.

## Constraints and evidence

The numbers below are observed with a probe of 29 cases outside the repository, run against
`scripts/verify.ts` before and after the change.

- Before the change, 17 cases pass and 12 fail, as the design expects: the 12 cases are the new
  refusals. After the change, all 29 pass.
- The new rules refused 15 citations on the unchanged tree, in 11 files. Five citations named no
  heading or two headings: `design.md`, "The question"; `workflow.md`, "A landing"; `workflow.md`,
  "The step end"; and `diagnosis.md`, "The diagnosis" in `bug` and `hotfix`. Ten citations of a
  maintainer document in `docs/` had no name.
- After the corrections, the rules refuse nothing on the tree, and no existing link fragment
  fails.
- The limits are observed: a quoted phrase that does not follow `, ` right after the span is not
  read; the rules for names cover only the agent text; an HTML `id` is no fragment target; a
  setext heading counts and a heading in a fence does not.

## Decision

`checkCitations` reads three more rules.

- A name quoted after a `<plugin>/<path>.md` span must equal exactly one heading of that file.
- A citation of a document directly in `<plugin>/docs/` must carry such a name.
- The fragment of a relative link must be a GitHub heading slug of a tracked Markdown file in
  `plugins/celetis/`.

The gate parses headings with `Bun.markdown.render`, so setext headings and fences follow the
CommonMark rules, and it builds the slug by the rule of markdownlint MD051. This adds no package.

## Alternatives considered

- Use `remark-validate-links`. It checks links only, not the quoted names of a citation, and it
  adds a dependency tree to a gate that installs only pinned tools.
- Check the names only. This leaves the link fragments of the plugin documents unchecked, and the
  same heading rename breaks them.
- Cite a heading by an explicit anchor id. An HTML `id` is no target for GitHub and the host
  readers, and the citation form of the agent text stays a quoted name.

## Consequences

A heading rename in a cited document fails the gate until each citation follows. The maintainer
documents keep stable heading texts, and a repeated heading text cannot be cited by name. The
citation form needs a following `, "Name"`, so a name before the span is not read, and a
citation of a `docs/` document with the name before the span fails.

## Reconsider when

Bun changes the `heading` callback or the CommonMark parse of its markdown module, or the agent
text needs a citation form that quoted names do not express.
