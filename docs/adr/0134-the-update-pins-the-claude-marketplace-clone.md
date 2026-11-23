# The update pins the Claude marketplace clone

## Date

2026-11-23

## Related

- Issue: https://github.com/ddinkov10/celetis/issues/370
- [Celetis updates require one chat approval](0027-celetis-updates-require-one-chat-approval.md)
- [The plugin lives in plugins/celetis](0085-the-plugin-lives-in-plugins-celetis.md)
- [Versioned releases and a pin for each machine](0118-versioned-releases-and-a-pin-for-each-machine.md)
- `engine/lib/update/updater.ts`, `engine/lib/update/pending.ts`

## Context

Claude Code keeps two copies of a marketplace plugin: the install record, and the marketplace clone.
`celetis update` moved only the install record, through a private catalog bound to the approved
commit. The clone stayed at its old commit. A plugin reload loads the copy at the `HEAD` of the
clone, so a reload could run an old entry hook. That hook stopped on a `.celetis.yaml` that the
approved plugin accepts (`gates.feature: unknown field`).

## Constraints and evidence

Private-home probes on Claude Code 2.1.330, Windows 11, 2026-11-23:

- A new session with no reload loads the install record.
- The `reload_plugins` control request loads the copy at the `HEAD` of the clone, also a detached
  `HEAD`.
- `claude plugin update` refreshes a registered Git marketplace to its branch head before it
  installs.
- `claude plugin marketplace update` replaces a detached clone with a clone at the branch head.

A person confirms one exact commit, so no step of the update can install or load a newer commit
when the branch moves during the update.

## Decision

The update fetches the approved commit into the marketplace clone and checks it out detached, before
the native plugin update. The private SHA-bound catalog stays for the native update. A failed fetch
or checkout stops the update before the plugin moves.

The update check reads the `HEAD` of the clone. A clone at another commit is a pending part, so the
normal human confirmation offers its repair. The repair moves only the clone and runs no native
plugin update. The pin is the only tested option that keeps the approved commit on each load path
when the branch moves.

## Constitution

Read: `CONSTITUTION.md`, amended 2026-11-12.

- Serves: 2 Autonomous steps: a plugin reload no longer stops a session on a config format that the approved plugin accepts.
- Hard limits and non-goals: none touched.

## Alternatives considered

- **`claude plugin marketplace update`, then a check.** The command moves the clone to the branch
  head. A branch that moves during the update puts an unapproved commit on the reload path.
- **A pinned clone with a native `claude plugin update` and no private catalog.** With the clone
  pinned at one commit and the branch at a newer commit, the native update refreshed the clone and
  installed the newer commit.

## Consequences

- After a successful update, the install record and the clone are at one approved commit.
- The clone of a machine is detached at that commit until the next update.
- The update writes to a folder that Claude Code owns. A plugin reload loads the working tree of the
  clone, so each local change in the clone stops the check. `claude plugin marketplace update` keeps
  a local change when the clone is at the branch head, so the check names `git reset --hard` and
  `git clean -fd` for that clone. It never discards the change itself.
- The pin shows no credential or SSH host-key prompt. A source that needs a new login fails before
  the plugin moves.
- The first update after this change runs the old updater. The next check offers the repair.

## Reconsider when

- Claude Code can install a plugin and refresh its marketplace at one exact commit.
- A plugin reload stops reading the `HEAD` of the marketplace clone.
