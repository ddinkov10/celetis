# Setup reconciles recorded owned wiring

## Date

2026-11-05

## Related

- [#46](https://github.com/ddinkov10/celetis/issues/46): the approved saved-answer and owned-refresh contract.
- [ADR-0052](0052-setup-owns-required-configuration-and-host-wiring.md): required integration scope.
- [ADR-0031](0031-plugin-development-is-independent-of-adoption.md): independent product adoption.
- [ADR-0061](0061-setup-owns-a-marked-instruction-block.md): marker authority and byte preservation.
- [ADR-0054](0054-product-owned-setup-files.md): product-owned application setup source.
- `Setup.plan` in `engine/setup.ts`, `engine/lib/setup-record.ts`, and `skills/setup/SKILL.md`.

## Supersedes

Supersedes: **Setup owns required configuration and host wiring** (ADR-0052), only these clauses:

- In **Supersedes**, “A differing rules file now stays unchanged, including when an old record
  claims it”, “historical ownership alone gives no authority to replace current content”, and
  “The union of historical evidence stays intact”. A validated owned key or dedicated file now
  permits bounded replacement and removal, including manual edits inside that scope.
- In **Constraints and evidence**, “zero replacement of differing content” applies only to
  differing unowned content.
- In **Decision**, “a differing file is preserved with a manual action”, “The one replacement
  is an unchanged, recorded canonical Celetis marketplace entry”, and “Differing or unowned
  existing marketplace entries stay unchanged” now distinguish owned from unowned scopes.
- In **Decision**, the paragraph starting “Old wiring is report-only”, including its preserved
  historical claims and owner-only removal rule, is replaced by recorded-scope reconciliation.
- In **Consequences**, “Setup preserves historical claims until an owner reviews their removal”
  is replaced by a record of resulting ownership with retired claims removed.

Supersedes: **Plugin development is independent of adoption** (ADR-0031), only the **Decision**
clause “Setup preserves existing files, entries, and ownership for that project's owner to review
against the current wiring”. Its independent development and product adoption boundary stays.

Supersedes: **Setup owns a marked instruction block** (ADR-0061), only “Historical ownership
still grants no additional replacement or removal authority” in **Supersedes**, “preserves
historical claims” and “Old generic flow text outside the markers stays unchanged and retains
its manual-review warning” in **Decision**, and the owner-review cleanup alternative as the sole
cleanup mechanism. Its exact marker text, validation, byte preservation, regular destinations
and supported instruction links stay unchanged. All historical records retain their text.

## Context

Setup records ownership but previously retained obsolete claims and wiring. It also asked for
saved answers again. The maintainer approved removal of obsolete owned entries and the written
#46 scope rule, including replacement of manual edits inside owned keys and dedicated files.
That authority must be explicit because schema 1 holds no last-written baseline value.

## Constraints and evidence

- The approved specification chooses desired-state reconciliation, with saved-answer reuse as
  in Copier and scoped apply as in chezmoi. These are pattern references, not dependencies or
  evidence of measured superiority.
- The schema-1 record stays at `.claude/celetis-flow/wiring.json`. A finite path and descriptor
  validator bounds its authority; arbitrary record paths cannot become filesystem authority.
- `check` exposes validated saved answers. `try` and `write` retain explicit options and share
  one plan. Native resource loading and observed questions need separate runtime evidence;
  source text and generated policy cannot supply it.
- Current valid configuration remains required. There is no old-config reader, migration
  command, template history, hash store, version pin or additional persistent state file.

## Decision

Setup resolves saved tracker and ordered hosts once through `check`, and uses current validated
landing and suite without confirmation. It asks for missing answers and explicit changes only.
Invalid present answers refuse. Both setup operations receive the same resolved explicit options.
Selected host order initializes an absent local preference only during `write`; existing valid
preferences stay unchanged even after selection changes.

A valid recorded scope owns its current content. The finite surface permits dedicated whole
files, exact object keys, exact array items, complete physical lines, and the established marker
pair. A recorded key includes its manually edited value; a whole-file claim includes manual
edits in that file. Shared-file content outside those scopes stays product-owned. Equal unowned
requirements can be adopted; differing unowned values stay unchanged with exact warnings and
no new claim. Markers retain their independent bounded authority.

The planner refreshes current requirements and removes obsolete owned scopes, including a
recorded launcher and a removed host's dedicated integration. Shared requirements still needed
by a selected host stay. The resulting record retains current claims only. Unchanged committed
repeats skip equal writes. Product source, worktree setup references, extra ignores, baseline,
custom parts, existing ADR guidance and populated stores stay outside removal authority.

Before content or label writes, validate the whole plan and every affected destination,
including deletions. Apply changes sequentially and write the resulting record after content
changes succeed. A later I/O failure reports its path and actual partial diff, claims no success
and makes no automatic push. The owner repairs or restores partial changes before retry under
the existing dirty-path guard.

Show every changed or deleted path, complete diff, new file and JSON formatting change before
one final commit-and-push question. No separate cleanup question is added. Stage only planned
wiring paths. Report exact unresolved warnings and surviving tracked launcher callers; change no
unowned caller. Literal search cannot establish dynamic or external references. An unresolved
caller or collision prevents a current-wiring claim; no diff establishes native policy loading.

## Alternatives considered

- Keep report-only cleanup and historical claims: does not meet the approved removal behavior.
- Add template history and three-way merging: needs a baseline and conflict model beyond the
  required finite wiring scope.
- Ask for each owned overwrite or removal: repeats a decision the approved scope rule already
  makes. The complete diff and existing final question expose the actual resulting change.
- Treat every matching phrase as owned: cannot protect product additions or bound record input.

## Consequences

Repeated setup can refresh owned wiring without repeated answer questions or manual retirement
of owned entries. Manual edits inside owned keys or files are deliberately replaced or removed;
maintainers must keep product content outside those scopes. Differing unowned values still need
owner action. Surviving callers and effective native policy remain explicit limits.

Sequential writes can leave partial changes; this decision adds no transactional filesystem or
concurrent setup guarantee. ADR-0054's committed source checks and preference synchronization,
ADR-0061's marker contract, and independent product adoption remain intact. No product adopter
or installation update is a prerequisite for Celetis development or verification.

## Reconsider when

- Required wiring can no longer be expressed safely by the finite scope table.
- Maintainers require preservation of manual edits inside owned scopes through a baseline and
  merge contract instead of the approved replacement authority.
- A host changes native resource loading or effective-policy evidence enough to alter setup's
  verification boundary.
