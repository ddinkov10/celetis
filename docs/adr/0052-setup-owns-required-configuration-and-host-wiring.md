# Setup owns required configuration and host wiring

## Date

2026-10-29

## Related

- [ddinkov10/celetis#106](https://github.com/ddinkov10/celetis/issues/106): the reduced setup
  ownership boundary and its acceptance scenarios.
- [ADR-0017](0017-setup-writes-the-wiring-of-a-product-project.md): setup ownership and adoption.
- [ADR-0018](0018-setup-proposes-and-tests-the-worktree-setup.md): approved product additions,
  detached testing, and preparation markers.
- [ADR-0030](0030-the-installed-plugin-owns-the-entrypoint.md) and
  [ADR-0042](0042-one-celetis-program-for-both-hosts.md): the installed program and explicit host.
- [ADR-0047](0047-skills-load-shared-procedures-on-demand.md): procedure placement and entry.
- `Setup.plan` and `Setup.reportOldWiring` in `engine/setup.ts`; `README.md`, "Review old wiring".

## Supersedes

From ADR-0017, these clauses change:

- **Setup writes the host files:** authority to rewrite the whole Codex rules file, and the
  required project `enabledPlugins.celetis@celetis` entry. A differing rules file now stays
  unchanged, including when an old record claims it. Celetis enablement stays user-scoped.
- **A first run adopts each equal entry** and **Consequences:** the implication that adoption
  permits a later replacement or removal. Equality can establish a current ownership claim;
  historical ownership alone gives no authority to replace current content. The union of
  historical evidence stays intact.
- The setup-created instruction and store surface inherited from #41: the generic
  `## Celetis flow` section, `docs/adr/README.md`, `docs/adr/template.md`, and the empty
  `docs/lessons/INDEX.md`. Setup no longer creates them. The obsolete launcher attribute is also
  outside the current write set.

From ADR-0018, only **Three product parts of `write`**, and its analogy **as with the stores of
#41**, need clarification: setup no longer creates those stores. Its application setup, extra
ignores, baseline, detached testing, and marker decisions stay intact. ADR-0018 adds no requirement
to create generic instructions. Both historical records keep their text.

## Context

Required host integration and product procedures had one writer. This copied generic policy into
product instructions and created empty stores before a product had any records. Historical
ownership also looked like permission to replace content that a product could have changed.
The installed plugin already holds the generic procedures. Product instructions need only the
facts and choices of that product.

## Constraints and evidence

- #106 preserves `.celetis.yaml`, `custom.<skill>`, host selection, command names, setup operations,
  and the schema-1 record at `.claude/celetis-flow/wiring.json`.
- Disposable checks of the checkout entry show no generic procedure or executable copy, preserved
  differing rules, exact root and nested imports, stable committed repeats, and unchanged product
  additions. Source checks and native loading are separate evidence.
- Setup checks the planned project marketplace setting only. Generated policy, a no-change diff,
  and a policy-file decision cannot prove native loading or stronger effective update policy.
- The collision bar is zero replacement of differing content, a path-specific report, and no
  current-wiring claim while the conflict remains. Partial I/O writes require their exact diff.

## Decision

Setup owns only required configuration and host integration: selected host settings and imports,
the dedicated Codex restriction, required ignore and LF attribute lines, and its record. It makes
missing tracker labels. Approved application setup, extra ignores, and baseline text stay product
content outside ownership.

An absent dedicated rules file is created; an identical file is adopted without a content write;
a differing file is preserved with a manual action. Shared files receive missing required entries.
The one replacement is an unchanged, recorded canonical Celetis marketplace entry: setup sets its
`autoUpdate` to false. Differing or unowned existing marketplace entries stay unchanged.

Generic ADR guidance and templates stay in the plugin. A store writer creates a product directory
only with its first record. A live lesson or approved promotion creates its catalog on first use;
pending capture creates no live catalog. Grounding treats missing stores as no records and makes
no write. An unreadable or malformed existing store is an error.

The four removed generic product bullets retain these authorities:

| Removed product rule | Current authority |
| --- | --- |
| Lanes use plugin skills and this repository's issues. | The skill entry and invocation contract, plus the existing repository/tracker boundary; no generated repository identity sentence. |
| `landing` selects the mechanism and the build ends with `land`. | Existing `docs/procedures/landing.md` and engine enforcement. |
| A lane never skips a step. | Existing `engine/lib/workflow.ts` resolver and lane handoffs; do not duplicate engine policy in entry text. |
| Only the maintainer starts the runner unless an agent task expressly authorizes it. | Add this instruction once to `docs/procedures/entry.md`, `The contract`; include the number and terminal requirement. |

Product-specific flow instructions remain in product `AGENTS.md`. The entry contract delivers the
runner instruction, including its number and terminal requirements, on both host paths.

Old wiring is report-only. Preserved historical claims are evidence for owner review, not
automatic cleanup authority. For each removal, the owner reviews the old record, actual diff,
and remaining callers, then removes only reviewed content and its obsolete claims in the same
product change. Missing or ambiguous evidence authorizes no deletion. Existing generic ADRs need
independent owner review. Installation and update remain separate explicit operations.

## Alternatives considered

- **Keep generated procedures and empty stores.** This retains copies of plugin policy and
  makes setup responsible for product content before the product needs it.
- **Replace differing files named by an old record.** A historical claim cannot prove current
  content belongs to setup. Preservation gives the owner an exact diff to review.
- **Add migration or cleanup commands.** These add write authority beyond required integration.
  Bounded manual review can account for product additions and remaining callers.
- **Remove generic rules with their product copies.** Their entry, workflow, and landing
  authorities still apply. The ledger makes each final home explicit.

## Consequences

- Fresh setup creates less product content. First record writes create only the store paths they
  need. Existing product guidance, records, templates, and flow additions remain valid.
- A committed repeat is stable, but an unresolved warning remains unresolved even when no file
  changed. Reports keep the exact warning and manual action; they make no loaded-policy claim.
- Setup preserves historical claims until an owner reviews their removal. This can retain old
  warnings across runs, but avoids deletion based only on a former ownership record.
- Failed writes can leave partial files. The report names the failing path, status, changed-path
  diffs, and complete new files before recovery; it claims no success and makes no automatic push.

## Reconsider when

- A native host changes the required integration or exposes a verified effective-policy surface.
- A store needs an index before any record can be written or read safely.
- Observed owner review cannot distinguish obsolete wiring from current product additions.
