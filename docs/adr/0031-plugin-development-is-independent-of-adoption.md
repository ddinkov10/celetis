# Plugin development is independent of adoption

## Date

2026-10-25

## Related

- Issue #120: keep Celetis independent of product projects.
- [Repository instructions](../../AGENTS.md#plugin-development).
- [Current product wiring](../../plugins/celetis/README.md#wire-a-product-project),
  [source repair](../../plugins/celetis/README.md#explicit-source-repair), and
  [updates](../../plugins/celetis/README.md#updates).
- ADR-0015, ADR-0017, ADR-0025, ADR-0028, ADR-0029, and ADR-0030.

## Supersedes

Only these adoption and coordination clauses change. Historical records and their evidence
remain unchanged.

- ADR-0015, "One repository YAML file owns Celetis setup": the Decision requires coordination
  of other repositories before plugin landing; the Consequences make repository preparation
  and stopped old runners a human gate. Neither requirement applies to Celetis development.
  Its single-config contract remains.
- ADR-0025, "The toolchain runs on TypeScript and Bun": the Consequences require coordinated
  product preparation, approved setup, copied launchers, stopped processes, and a current-build
  readiness report before landing. These are no longer plugin development requirements.
  TypeScript, Bun isolation, and the current build contract remain.
- ADR-0017, "The setup command writes the wiring of a product project": the Supersedes and
  Consequences sections inherit ADR-0015's manual replacement. That inheritance creates no
  obligation for a Celetis development lane. Setup approval and active-project ownership
  protections remain.
- ADR-0030, "The installed plugin owns the entrypoint": the historical product-cutover
  prescriptions in the Decision and Consequences are replaced by the current local wiring
  guidance. They create no product action or evidence requirement for a Celetis development
  lane. The installed entrypoint, ownership preservation, native identity, explicit source
  repair, personal permission binding, and update controls remain.

## Context

Plugin development and product adoption have different owners. Earlier decisions coupled plugin
landing to preparation of product repositories. Active instructions also retained procedures
for converting older wiring and referred to a named product as a workflow model. A plugin
maintainer could therefore be directed to inspect or prepare repositories outside the issue.

The maintainer chose independent development: Celetis must be able to change its contracts and
land a breaking change even when no product has adopted it. Product owners decide when and how
to use those contracts.

## Constraints and evidence

- The issue #120 source audit at `b7d5261` found active-project inputs in `engine/land.ts` and
  `scripts/verify.ts`, with no runtime adoption registry or external-product prerequisite.
- `engine/setup.ts` preserves existing launcher files and owned Claude entries. Its two warning
  strings referred to obsolete README procedures; the preservation logic needs no change.
- `README.md`, `docs/configuration.md`, `docs/issue-tracker.md`, `docs/capability.md`, and
  `docs/celetis-flow.md` held the active procedure references. Shared skills already describe
  general active-project roles.
- The repository uses existing authenticated hosts with temporary project data. A missing host
  capability remains an uncompleted check. ADR-0029 keeps `scripts/verify.ts` as the only gate
  and prohibits tracked tests.
- ADR-0028 and ADR-0030 retain native installation scope and resource-lifetime limits. A source
  change neither updates an installation nor reloads an open session's skills.

## Decision

Celetis owns plugin source, public contracts, and verification evidence. Its issues can be
designed, built, verified, and landed using only this repository's issue and checkout, with zero
product adopters. A plugin lane does not discover, enumerate, inspect, prepare, modify, or wait
for other product repositories. It requires no product commit, update, readiness report, or
approval. The root instructions state this development boundary; shared skills stay general.

Each product maintainer owns adoption, wiring, and custom instructions. Installation and update
remain separate explicit operations under their existing identity, permission, and confirmation
controls. Current usage guidance describes the active project's contract without an old-layout
conversion procedure, a named consumer dependency, or a coordinated rollout process.

Runtime commands still require the active project's valid configuration, issue state, checkout,
and permissions. Setup preserves existing files, entries, and ownership for that project's
owner to review against the current wiring. Product adoption cannot replace missing Celetis
verification evidence or justify PASS for an uncompleted check. This repository can continue
to use its installed plugin for its own issues.

## Alternatives considered

- Coordinate rollout across product repositories before plugin landing: makes independent
  development depend on access, readiness evidence, and approval from unrelated owners.
- Preserve older contracts through compatibility readers, migrations, or fallbacks: adds
  obsolete paths and ongoing complexity instead of publishing one current contract.
- Track adopters or per-product readiness in a registry: creates a new state store and release
  approval process without helping verify the plugin's own change.
- Treat a real product's adoption as verification evidence: cannot establish a missing host
  capability or complete an unrun Celetis check.

## Consequences

Plugin lanes can finish independently, and product maintainers control their own adoption.
Current instructions and setup warnings point to local usage guidance. Historical decisions
retain their provenance while their superseded coordination clauses have an explicit boundary.

Breaking plugin changes can leave older product wiring unusable until its owner chooses to
prepare it. This risk is accepted; plugin development does not wait for that work. No version
isolation, compatibility mechanism, adoption registry, or release approval gate is added.
Shared native installations keep their current scope and resource-lifetime limits. Document
and reference mistakes remain review risks; explicit audits and the existing gate supply the
evidence for this change.

## Reconsider when

- Product owners explicitly require a coordinated release contract instead of independent
  adoption.
- A shared installation gains isolation or replacement semantics that change the ownership or
  resource-lifetime boundary.
- Plugin verification acquires a justified dependency that cannot be exercised with Celetis
  source and temporary project data under the existing authenticated hosts.
