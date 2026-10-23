# Celetis updates require one chat approval

## Date

2026-10-23

## Related

- [Issue #98](https://github.com/ddinkov10/celetis/issues/98)
- [Updates](../../README.md#updates)
- [ADR-0014](0014-one-workflow-uses-explicit-host-operations.md)

## Supersedes

The automatic Celetis update policy of
[ADR-0012](0012-the-harness-is-the-plugin-celetis.md). Historical native observations and the
separate Superpowers update policy remain unchanged.

## Context

Package replacement can change files that a running consumer still reads. The maintainer chose
an exact update offer and a direct chat reply, then required full implementation with deterministic
checks while excluding live tests and changes to real installations.

## Decision

Check the selected installation and configured Git source without refresh once per human task.
Offer the exact host, source, installed revision, and target. Reuse task state in nested work.
Only a direct human user-channel reply permits one matching attempt; consume it before apply.
An internal action argument is no proof of who authorized it. No response, decline, stale identity,
refusal, failure, or interruption permits another attempt without a new decision.

Keep target-bound apply under the existing update supervisor and shared deadline. Recheck identity
and policy. The complete consumer lifetime, offering-session boundary, updater boundary, and
exclusion of racing starts are required before replacement. Current native operations cannot prove
all of them, so application refuses before mutation with the missing control and required action.
Consumer starts also refuse unknown higher Claude policy and unsafe Codex automatic refresh.
File-only false does not certify command-line, MDM, or server-managed policy.

## Evidence and limits

Claude Code 2.1.306 lacks a proved native exact-target update. Codex CLI 0.163.0 has a measured
session-only Git target selection, but refresh can replace live package resources. A local
marketplace can also refresh its plugin snapshot. Filtered standalone metadata is read-only for
installation data; app-server startup with plugins enabled can refresh before initialize.
Codex metadata binds one canonical home before any native process, and proves cache containment
and the native marketplace root-source chain before package reads. Read-only RPC uses the real
global plugins-disable control in that same home. That diagnostic override is no proof
of normal-session policy. Native marketplace requirements are absent from the public requirement
response, so its success does not certify policy coverage.

Claude owned settings disable Celetis background updates and preserve unrelated policy. Effective
settings precedence and native global records are inspected. File-only inspection cannot certify
MDM, server-managed, or command-line policy. Live successful cutover, all-consumer admission, and
real human-channel integration remain unverified. No native live test or real installation update
was run for this completion.

## Alternatives considered

- Automatic latest replacement violates the explicit decision and complete lifetime requirement.
- A manual-only updater omits the approved check, offer, and chat procedure.
- Leases, package copies, daemons, and invented host controls do not supply the missing native proof.

## Consequences

Users receive useful check results and exact supported-path refusals. The full interface remains
available without weakening the native safety requirements. A supported successful update requires
a fresh session and new enabled-package discovery; exact Resume keeps the saved host and ID.

## Reconsider when

A supported native control proves exact-target replacement and the complete lifetime boundary
for each required host, with separate real user-channel acceptance evidence.
