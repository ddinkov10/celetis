# Direct board update confirmation

## Date

2026-10-29

## Related

- [Issue #164](https://github.com/ddinkov10/celetis/issues/164)
- [Updates](../../README.md#updates)
- [Terminal-confirmed native plugin updates](0028-terminal-confirmed-native-plugin-updates.md)

## Supersedes

The terminal-only approval requirement of ADR-0028 for an update that a person starts from the
board. Its terminal confirmation, source validation, exact target, update locks, cleanup, and
open-session policy remain in effect.

## Context

The person requested an update dialog on the board and one click to update and restart that
board. A second confirmation in a terminal would leave that request incomplete. The terminal
command must retain its existing confirmation rule.

## Constraints and evidence

The updater already discovers the program and native host plugins, validates their sources and
revisions, and replaces them under exclusive locks. Public check output omits native scope,
registration, and sibling identities. It cannot identify the complete installation that the
person approved. Native replacement can remove files that open sessions still need; keeping a
process alive does not reload its skills.

## Decision

A person's direct click on **Update and restart** approves one exact offer held by that board,
for one attempt. The browser sends only an opaque identifier. The board consumes that identifier
before it starts replacement. The shared updater compares the complete offer before any change,
checks each identity again under its existing lock, and validates the installed result. A changed
identity, lock conflict, or failure requires a new check and a new human decision.

After success, only the board that received the approval restarts with the approved installed
program. Agent sessions, runners, other boards, and the Codex daemon keep running. An update
approved in a separate terminal retains its manual board restart.

Agents cannot click, script, or approve a real installation update for a person. Terminal updates
still require a direct affirmative response in that terminal. Checks with temporary installation
data are permitted. Neither task text nor a configuration value supplies human approval.

## Alternatives considered

- Sending the person to a terminal preserves one approval path but adds the second action that
  the person rejected.
- Treating discovery or a scheduled check as approval removes the requested human decision.
- Accepting browser-supplied paths, sources, or revisions lets a request change the offered
  operation. A server-held offer keeps those identities outside the request.
- Restarting all consumers expands the decision beyond the board and conflicts with the
  existing open-session policy.

## Consequences

The board and terminal share discovery, replacement, locks, and failure handling. Each has its
own direct human confirmation. A partial failure reports completed and incomplete parts and
starts no retry, rollback, or restart. The server must retain each full offer until the person
uses or replaces it. The browser must prove that the restarted board serves the approved revision
before it reloads.

## Reconsider when

The board permits remote clients, the native hosts change their update identities or lock
requirements, or operators need updates without a direct human decision. Revisit the restart
contract if the board moves to a process manager that owns activation.
