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

Keep target-bound apply under exclusive host-profile admission and the existing update supervisor.
Normal Run, board, and exact Resume retain shared admission and perform no Celetis update.
Their Codex Git sessions bind the installed source revision with supported per-command overrides.
Known concrete conflicts remain errors; unknown native policy does not disable ordinary use.

After direct approval, the active offering native process exits and the human runs one concrete
approved command in an ordinary terminal. This is no queued updater or standing approval.
Claude selects the exact plugin-source SHA in a private settings marketplace and restores the
original native source with a second settings operation. Codex selects the exact Git ref through
one-command native overrides. Both validate the fresh enabled target and report partial state.
No persistent product pin is added. Neither arguments nor an environment value authenticate a user.

## Evidence and limits

Positive deterministic native-stub operations cover Run, board, exact Resume, target-bound apply,
subsequent check, source restoration, and failure state. The updater does not reopen replaced
control code for final validation. Narrow POSIX exec preserves PID and shared reader descriptors;
the parent-loss test checks protection through native foreground exit. Process inventory uses
profile identity and canonical package resources, with no environment values in diagnostics.

Stock native launches do not acquire Celetis admission, and native descendants may close inherited
FDs. Keep those clients stopped during cutover. The cooperating lock and process scan do not prove
universal native admission or complete stock-native reader lifetime. File policy reads also cannot
certify unseen managed settings. Live successful cutover and direct-human acceptance were waived
and remain unverified; no real installation was updated by these tests.

## Alternatives considered

- Automatic latest replacement violates the explicit decision and complete lifetime requirement.
- A manual-only updater omits the approved check, offer, and chat procedure.
- Leases, package copies, daemons, and invented host controls do not supply the missing native proof.

## Consequences

Users receive useful check results and exact supported-path refusals. The full interface remains
available without weakening the native safety requirements. A supported successful update requires
a fresh session and new enabled-package discovery; exact Resume keeps the saved host and ID.

## Reconsider when

Native clients supply universal admission and complete reader-lifetime controls, with separate
real user-channel acceptance evidence.
