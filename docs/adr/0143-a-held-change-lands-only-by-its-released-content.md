# A held change lands only by its released content

## Date

2026-11-25

## Related

- [Issue #381](https://github.com/ddinkov10/celetis/issues/381): the intent and the spec (the body of the issue,
  `Spec: 2026-11-23`), with the section "Design probes" and two maintainer decisions of 2026-11-25: issue comment
  7169756488 on the SSH command of a press, and issue comment 7170817717 on the author of a hold record.
- [Issue #380](https://github.com/ddinkov10/celetis/issues/380): the epic. Its `## Hold policy` section and its
  `## Captured` comment hold the decisions of the maintainer. #382, #383, and #384 build on this change.
- [The build step lands the change, by the mechanism that the repository names](0008-the-build-step-lands-the-change.md):
  `land` stays the one landing path. The Land press runs that landing, so no path to the trunk misses the hold.
- [The engine enforces the lifecycle and the landing](0036-the-engine-enforces-the-lifecycle-and-the-landing.md):
  `decide()` stays the one resolver and `land` still reads the issue again before each push. The hold adds the
  stops `held` and `released` and one gate at the start of `land`.
- [ADR-0029](0029-the-repository-keeps-no-tests.md): the build of this change added no tracked test.

## Supersedes

- [Each issue write of a session goes through the command issue](0108-each-issue-write-of-a-session-goes-through-the-command-issue.md),
  in part: in "Decision", **The command `issue`**, the sentence "It refuses a file whose text, after leading white
  space, starts with a lifecycle heading or with `Effort:`" and the matching sentence of its "Supersedes" section
  ("That act refuses only a first line that is a lifecycle heading or the effort marker"). `comment` also refuses
  `## Held` and `## Released`, because only the engine writes them.
- [One workflow definition and the skip rule](0033-one-workflow-definition-and-the-skip-rule.md), in part: in
  "Decision", **One definition**, the list item "the ten labels". The definition holds eleven labels, with
  `hold-landing`.

## Context

A finished build lands at once. The maintainer wants to try a built `feature` or `bug` change on its branch, and
to decide when it reaches the trunk. The hold must be sticky, it must land exactly the content that the maintainer
saw, and the landing must stay the normal landing with its suite. The maintainer asked for a project setting that
is off by default, a per-issue hold, and a Land and a Discard press on the card.

## Constraints and evidence

- `land` is the one path to the trunk ([ADR-0008](0008-the-build-step-lands-the-change.md)). Each caller reads
  exit 0 as "on the trunk", so a held change needs a class of its own: exit 9, `held`.
- A card press has no session. The daemon runs the landing for it, with the default host selection and the main
  checkout as `from`.
- Probe of #381 on git 2.56.0 (macOS), a patch ID of `git diff <merge-base> <tip> | git patch-id --verbatim`:
  - A trunk change in another file, then a clean merge: the same ID.
  - A trunk change in far lines of the same file, then a clean merge: the same ID.
  - A trunk change within the context lines, then a clean merge: another ID.
  - Two contents of one binary file: two IDs. A mode change alone: an ID that is not empty.
- `git patch-id` ignores the rest of a line after a NUL byte, so two diffs that differ only after a NUL gave one
  ID. The engine encodes 0x00 and 0x01 in the diff bytes before it runs `git patch-id --verbatim`. The encoding
  has no NUL and keeps the two inputs apart. The diff runs with fixed flags (no rename detection, no external diff,
  no textconv, `--full-index`, three lines of context) so a user setting cannot change the ID.
- `--verbatim` hashes the patch with no white-space strip and implies `--stable`. A git that refuses the flag
  ends the act as `blocked`, so nothing lands.
- `worktree --remove` refuses commits that no origin branch contains, so the Discard pushes the branch first.
- A push for a press must not wait for a prompt. A session `GIT_SSH_COMMAND` replaced `core.sshCommand` and
  `GIT_SSH` in a plan rule that set `GIT_SSH_COMMAND='ssh -o BatchMode=yes'` when the session set none (observed
  on git 2.56.0).
- GitHub lets each signed-in user comment on an issue of a public repository, unless the issue is locked or the
  repository sets an interaction limit, and that limit lasts at most six months. So the form of a comment does not
  show that the engine wrote it.

## Decision

The landing is the one enforcement point of the hold.

1. **The setting and the label.** `holdLanding: true` is an optional root field of `.celetis.yaml`. It is off by
   default, and the config refuses it with the landing `pr` until #384. `celetis --agent <host> issue <n> hold`
   and the board entry Hold landing hold one issue with the setting off. A hold is active on a `feature` or `bug`
   with the label `hold-landing`, with a history entry that added it, or with a `## Held` comment of the engine
   login (item 2). So a removal
   of the label by hand, and a later change of the setting, release nothing. A `chore` and a `hotfix` are never
   held, and `issue <n> route` to one of them exits 3 while a hold is active, and when the setting is on for a built
   `feature` or `bug`. The engine makes the label on demand, so `setup status` does not report it as missing.
2. **Two records.** `## Held` (`head`, `patch`, `subject`) is written by `land`. `## Released` (`head`,
   `patch`) is written only by the Land press. The `comment` act refuses both headings, and a record that does not
   parse counts as no record. A `## Held`, `## Released`, or `## Landing refused` comment counts for the hold only
   when its author is the login that the engine uses for the tracker. On GitHub that is the login of `gh api user`,
   read once per client and compared with the author of each comment on both read paths: the REST timeline, and
   the GraphQL timeline of the board read. On the local tracker it is the identity that the engine writes with. A
   comment of another author, or with no author, counts as no record: it makes no hold active, it is not the
   latest record, and it sets no subject. A failed read of the login ends `land` and each press as `blocked`, so
   nothing lands. This is the decision of the maintainer of 2026-11-25 (issue comment 7170817717). It is no proof
   of who pressed Land: an agent with the `gh` of the maintainer writes as that login.
3. **The identity of a release.** The patch ID is `git patch-id --verbatim` of the net diff from the merge base to
   the tip, in the encoding above. A release counts only when the patch ID matches and the tip carries the released
   content: the same head, or the same clean merge tree (`carriesRelease`). Any other content gives a new
   `## Held` and exit 9. A conflict with the trunk after a release, or a clean merge that changes the released
   patch, is exit 4 (`repair`) with no record. A held branch with no net change is `repair`, unless a commit on the
   trunk has the key of the issue in its subject.
4. **The landing.** `land` starts with the gate. With no valid release it writes the label and `## Held`, prints
   `land: #<n> is held; nothing landed`, and exits 9. It writes no second record for the same head and patch. With
   a valid release and a moved trunk, it merges the trunk into the lane worktree, and the suite runs on the merged tip.
   Before each push it reads the issue again and refuses a landing with no release for the content.
5. **The Land press.** The press sends the head and the patch of the card. The daemon takes the lock `land-<n>`,
   refuses a mismatch with the latest record and with the branch, writes `## Released`, and runs the normal landing
   with the subject of the latest `## Held`. A landing that ends with 4 or 5 gets `## Landing refused` and
   `ready-for-human`. Lesson curation runs when a round ends, in the session before `land`, and never after a
   release.
6. **The Discard press.** After a confirmation, the daemon pushes the lane branch to `origin`, closes the issue as
   `wontfix` with a comment that names the branch and its head, and removes the worktree. Each act can run again.
   These network calls of a press take no prompt: the `ls-remote` and the fetch of a Land press, and the push, the
   `ls-remote`, and the remote deletion of a Discard press. They use the session `GIT_SSH_COMMAND` unchanged. With
   none, they use the effective `core.sshCommand` of the main checkout with `-o BatchMode=yes` added, and an empty
   value counts as none. Else, with `GIT_SSH` set, the press sets no `GIT_SSH_COMMAND`, so git runs that program,
   and the press cannot add the option to it. Else they use `ssh -o BatchMode=yes`. This is the decision of the
   maintainer of 2026-11-25 (issue comment 7169756488).
7. **The contract.** The new exit class `held` and the label raise the contract version.

## Constitution

Read: `CONSTITUTION.md`, amended 2026-11-12.

- Serves: 1. Intent to release: the maintainer finishes a change over time, and it still ends on the trunk through one path.
- Serves: 3. Verified landing: the suite runs on the exact tip that lands, also after a clean trunk merge.
- Tension: 2. Autonomous steps: a held change waits for a person. The maintainer asked for this stop, and it is off by default, so each project that does not choose it keeps its autonomous path.
- Hard limits and non-goals: none touched.

## Alternatives considered

The spec of #381 names three places where the engine can enforce the hold.

1. **The landing is the one enforcement point (chosen).** `land` reads the setting and the label. The resolver reads
   only the issue. A setting that goes off later releases nothing, because the label and the record stay. Each path to
   the trunk goes through `land`.
2. **The resolver reads the setting.** `decide` would take the config at each call site. A change of the setting would
   release each held issue at once. This breaks the sticky rule.
3. **The build mark writes the label.** `issue <n> built` would add the label. A build that ends with a
   `## Before landing` comment has no build mark, so that build would land with no hold.

For the identity of a release, a hash of the raw tree diff would be stricter than the patch ID, but the maintainer
decided on the patch ID, and the probe shows that it survives a clean trunk merge and changes for a nearby edit. The
tip alone would void a release at each clean trunk merge. For the SSH command, a fixed `GIT_SSH_COMMAND` would
override `core.sshCommand` and `GIT_SSH`. For the author of a record, the interaction limit of GitHub ends after
six months at most, so it cannot replace the author rule.

## Consequences

- A project that turns the hold on has a stop at each `feature` and `bug` landing, and a card with Land and Discard.
- A long hold makes a trunk conflict more likely. The landing ends with `repair`, the press writes
  `## Landing refused`, and a new `## Held` needs a new press.
- The patch ID needs `git patch-id --verbatim`. The probe ran on git 2.56.0 only and tested no rename. The engine
  declares no git floor.
- A comment of another author is no hold record. After a change of the engine login, the earlier records do not
  count: the label keeps the hold active, the next `land` writes a new `## Held` and exits 9, and a release needs a
  new press.
- The landing that a Land press starts makes its own network calls with the environment of the daemon, as each
  landing in the daemon does.
- A press records a release but proves no identity of the person.

## Reconsider when

- A host or a git version changes `git patch-id`, or a rename or a mode change shows that the ID misses a change of
  content.
- #384 gives the landing `pr` a hold.
- The board has an identity for its maintainer, so a release can name who pressed Land.
