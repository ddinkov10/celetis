# Celetis updates are manual

## Date

2026-10-23

## Related

- [Issue #98](https://github.com/ddinkov10/celetis/issues/98)
- [Updates](../../README.md#updates)
- [ADR-0014](0014-one-workflow-uses-explicit-host-operations.md)

## Supersedes

The automatic Celetis update policy of
[ADR-0012](0012-the-harness-is-the-plugin-celetis.md). Its native observations remain evidence.
The separate Superpowers policy is unchanged.

## Context

An update can replace package files while another session still reads them. A shared updater
lock orders updates but does not protect all consumers. The user approved removing automatic
Celetis updates without further live tests.

## Constraints and evidence

Recorded Codex refresh replaced a file at an advertised path. Native host resource lifetime
remains unverified. This change uses deterministic tests with stubbed hosts and changes no real
installation. CLI invocation is no proof of a human response.

## Decision

Keep the installed package through runner starts and later steps. Disable background updates
only in owned Claude Celetis settings. Retain the explicit manual updater and its lock,
deadline, diagnostics, and descendant cleanup. The current procedure is in README, "Updates".

## Alternatives considered

- Keep automatic updates: package replacement can affect other consumers.
- Add package leases, copies, or host changes: these exceed the approved scope and lack native proof.

## Consequences

The maintainer must decide when to update and finish consumers before replacement. Native Codex
refresh remains outside this policy. No release, pin, or authenticated approval mechanism is added.

## Reconsider when

A supported native host contract can keep active package resources stable through replacement,
and live evidence proves it on each required surface.
