# Setup owns a marked instruction block

## Date

2026-11-02

## Related

- [#230](https://github.com/ddinkov10/celetis/issues/230): the approved instruction-block contract.
- [ADR-0052](0052-setup-owns-required-configuration-and-host-wiring.md): setup ownership and old-wiring review.
- [ADR-0054](0054-product-owned-setup-files.md): product ownership of application setup source.
- [ADR-0031](0031-plugin-development-is-independent-of-adoption.md): independent plugin development and product adoption.
- `managedInstructions` and `Setup.plan` in `engine/setup.ts`; `README.md`, "`AGENTS.md`".

## Supersedes

Supersedes: **Setup owns required configuration and host wiring** (ADR-0052), only where its
exclusion of generated instructions prohibits the short entry pointer approved in #230, and where
"The one replacement" excludes bounded replacement inside valid instruction markers. Its ban on
copied generic procedures and empty stores stays intact. Historical ownership still grants no
additional replacement or removal authority. The earlier ADR retains its text.

## Context

Setup could finish without an instruction file that directs a fresh agent to Celetis. The
maintainer requested Celetis instructions only, with a marked section that setup can add and
refresh while preserving product text. Creating the file only when absent would leave existing
projects without the pointer and prevent later refreshes.

## Constraints and evidence

- The approved specification fixes the complete pointer text and exact standalone delimiters.
  It permits no project facts, local paths, version values, or copied workflow procedures.
- Temporary checks invoke the candidate entry against real Git repositories with local origins.
  A bounded tracker adapter supplies repository and label reads; it proves no live tracker behavior.
- Generated file bytes establish the write contract, not native host loading. Fresh-session
  source evidence and routing checks remain separate runtime requirements on #230.
- Instruction destinations retain existing path and dirty-tree guards. Both setup operations
  use one planner, which validates markers before project-file or tracker-label writes.

## Decision

Setup maintains one Markdown comment block, bounded by the exact standalone lines
`<!-- CELETIS:START -->` and `<!-- CELETIS:END -->`. This follows the managed-block pattern used
by OpenWiki, Ansible, and conda, with stricter preservation of surrounding bytes. The fixed pointer
names the installed skills and their entry choice; those skills retain the workflow procedures.

One ordered pair authorizes replacement only within that range, including without a prior wiring
record. An absent pair permits append; an incomplete, repeated, or reversed pair refuses. Full
marker lines are reserved even inside Markdown fences. Inline mentions remain ordinary text.
The start marker selects the replacement newline convention. Appending uses the first existing
newline convention and adds only the blank-line separator. Equal content is not written again.

The schema-1 record identifies the marker pair under the actual regular instruction destination.
It makes no new whole-file claim and preserves historical claims. Approved baseline text follows
the block transformation and remains product-owned outside the block. Old generic flow text
outside the markers stays unchanged and retains its manual-review warning.

Claude imports remain limited to existing eligible instruction files. Supported instruction links
select their regular root or nested destination without a write through the link or a self-import.
Setup creates no Claude instruction file as a loading fallback and changes no user setting.
ADR-0054's application-source ownership and independent product adoption remain unchanged.

## Alternatives considered

- **Visible begin/end text.** Ansible and conda demonstrate the ownership model, but visible
  shell-style delimiters add noise to Markdown without improving the boundary.
- **Create only when absent.** This is smaller but does not meet the approved add-and-refresh
  behavior for existing files.
- **Copy procedures or clean up old sections.** This expands ownership beyond the requested
  pointer and risks product instructions. Existing owner review remains the cleanup mechanism.

## Consequences

- Every host selection gets the pointer. Maintainers keep product instructions outside its
  markers; edits inside them are deliberately replaced on the next setup run.
- Exact marker validation prevents ambiguous replacement. Outside bytes and unchanged-file
  modification times remain stable, including mixed LF/CRLF files and files with no final newline.
- Writes remain sequential, not a multi-file transaction. A later I/O failure can leave a partial
  diff. The owner reviews and repairs or restores it before retrying under the existing guards.
- Native loading depends on each host's instruction precedence and settings. An unavailable or
  unverified runtime check remains a named limitation, never proof supplied by generated bytes.

## Reconsider when

- The hosts change instruction discovery enough that the pointer or existing imports no longer load.
- The pointer needs project-specific values or workflow procedures instead of a fixed entry choice.
- Evidence shows that maintainers cannot preserve product text within this explicit marker boundary.
