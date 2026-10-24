# Terminal-confirmed native plugin updates

## Date

2026-10-24

## Related

- [Updates](../../README.md#updates)
- [Prior update policy](0027-celetis-updates-require-one-chat-approval.md)

## Supersedes

The chat-only approval, identity arguments, consumer admission and stopped-client requirements
of ADR-0027. Its native source validation, target binding, updater serialization and cleanup
requirements remain.

## Context

The maintainer requested one update command without copied cache paths or commit hashes.
The maintainer explicitly selected confirmation in the terminal and updates with Codex and
Claude Code sessions left open. These choices replace the earlier full-consumer-lifetime policy.

## Constraints and evidence

The existing engine can discover its native home, enabled installation, configured source and
available full revision. Native Codex 0.164.0 cache installation replaces same-version roots and
removes previous version directories; it does not retain every old resource for active readers.
See [the versioned native source](https://github.com/openai/codex/blob/rust-v0.164.0/codex-rs/core-plugins/src/store.rs).
[Codex documentation](https://learn.chatgpt.com/docs/plugins) requires a new session to use newly
installed skills and tools. A live process is not evidence that its cache resources are immutable.

## Decision

Expose `scripts/celetis plugin-update` as a terminal operation. Discover and display the selected
host, native home, source and full revisions, then ask for confirmation with a default decline.
Only affirmative input from an interactive terminal permits one exact attempt. Keep `check`
read-only for agents; agents never supply terminal confirmation on a person's behalf.

Bundle the operator command in the standalone launcher so it can repair an obsolete installed
updater. Remove public `apply` arguments. Keep the confirmed identity in memory and revalidate
it under the updater mutex before native replacement. Preserve the total deadline, original
diagnostics, source restoration, fresh installed validation and owned-child cleanup.

Native identity discovery takes a short shared read lock and releases it before a foreground
starts. This prevents discovery from reading an installation during replacement without reserving
the updater mutex for the session's lifetime.

Remove native process scanning and consumer lifetime admission. Open sessions, runners, boards
and daemons are not stopped or killed. Native hosts manage replacement; Celetis does not add
package copies, a new installer, a waiting daemon or automatic retry.

## Alternatives considered

- Retaining chat approval and identity arguments keeps the manual work the maintainer rejected.
- Treating command invocation alone as approval omits the requested terminal confirmation.
- Requiring stopped sessions contradicts the explicit choice to keep them open.
- Preserving custom immutable package copies creates a second installation and lifetime system.
  It exceeds the requested native update command and cannot rebind arbitrary existing clients.

## Consequences

The operator enters one command and answers its prompt. No cache paths or hashes are copied.
Noninteractive input, decline and EOF leave the package unchanged. Concurrent updaters remain
serialized; running sessions do not reserve their mutex. Unrelated plugins and settings retain
their existing scope protections.

The previous guarantee that old package resources remain usable for the entire lifetime of a
running consumer is withdrawn. A native update can replace files that open work still needs.
Such a session or board may need a restart; a fresh session loads the updated plugin. Tests of
process survival do not prove immutable resources or automatic skill reload.

## Reconsider when

The hosts provide native immutable reader snapshots, or operators need stronger resource-lifetime
guarantees than the chosen native replacement behavior. Revisit the native commands if their
metadata or target-selection interfaces change; do not pin the CLI to an exact observed version.
