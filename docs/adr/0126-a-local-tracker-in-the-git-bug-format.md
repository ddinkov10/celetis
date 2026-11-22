# A local tracker in the git-bug format

## Date

2026-11-21

## Related

- [Issue #335](https://github.com/ddinkov10/celetis/issues/335): the spec (the body of the issue, `Spec: 2026-11-21`),
  with the prior art, the external facts, and the requirements. In this record, "My call N" names item N of its section
  "My calls".
- [Issue #11](https://github.com/ddinkov10/celetis/issues/11): the epic. Its decisions 1 to 5 and 7 bind this record:
  the local tracker is a choice next to GitHub, its issues reach other machines through `origin`, it uses custom refs
  and the published git-bug format, the tracker and the code host are separate ports, and a child records the ADR that
  reverses "GitHub stays the state store".
- [Issue #336](https://github.com/ddinkov10/celetis/issues/336): the board view of local issues. This change gives the
  board of a local project its cards only.
- [Issue #12](https://github.com/ddinkov10/celetis/issues/12): the next tracker. It is not part of this change.
- [The tracker and the code host are separate ports](0120-the-tracker-and-the-code-host-are-separate-ports.md): the two
  ports and the follow-ups that this record settles.
- [The issue key is a string that the tracker defines](0117-the-issue-key-is-a-string-that-the-tracker-defines.md): the
  key type and the grammar. This record adds the local grammar and keeps the rest of that record.
- [Each issue write of a session goes through the command issue](0108-each-issue-write-of-a-session-goes-through-the-command-issue.md):
  the acts of `issue` hold for both trackers. The entry rule that its "Related" section names as the bullet **GitHub.**
  is now the bullet **Tracker.** of `plugins/celetis/references/procedures/entry.md`.
- [ADR-0029](0029-the-repository-keeps-no-tests.md): the proof of this change is the verify gate and the runs of
  temporary fixtures, not tests.
- [ADR-0090](0090-a-contract-version-replaces-the-same-revision-rule.md) and
  [ADR-0079](0079-one-contract-module-declares-the-commands-and-the-exit-classes.md): the contract version and the
  contract module that declare the new act and flag.
- `engine/lib/local/local.ts`, `engine/lib/local/store.ts`, `engine/lib/local/format.ts`, `engine/lib/local/sync.ts`,
  `engine/lib/git-host/git-host.ts`, `engine/lib/services/services.ts`, `engine/lib/tracker/grammar.ts`,
  `engine/lib/tracker/tracker.ts`, `engine/launcher.ts`, `engine/lib/command/operation.ts`, `engine/issue.ts`,
  `engine/lib/landing/landing.ts`, `engine/setup.ts`, `engine/lib/setup/status.ts`,
  `engine/lib/board-read/board-read.ts`, `plugins/celetis/docs/issue-tracker.md` ("The local tracker"), and
  `engine/README.md` ("The tracker of a process").

## Supersedes

Only these clauses change. The records keep their historical text and evidence.

- [The engine enforces the lifecycle and the landing](0036-the-engine-enforces-the-lifecycle-and-the-landing.md), in
  part:
  - in "Constraints and evidence", the sentence "GitHub stays the state store. The issue excludes a workflow database and
    a local state store.": the state store is the issue of the tracker of the project, `github` or `local`. The issue
    still excludes a workflow database. The words "a local state store" go: with `local`, the issue is a git-bug entity
    in the refs of the repository;
  - in "Reconsider when", the line "The tracker gets a second store, or GitHub stops being the state store.": this
    record is that change.

  The position rule of that record holds for `local`: `history` is the replay order of the format, and "after" is a
  later position in that list.
- [One workflow definition and the skip rule](0033-one-workflow-definition-and-the-skip-rule.md), in part:
  - in "Constraints and evidence", "The GitHub issue is the state store (`docs/issue-tracker.md`).": the issue of the
    tracker of the project is the state store. The next two sentences hold for both trackers: the resolver reads a
    snapshot of the issue, and the local tracker gives no event that a state machine can use;
  - in "Alternatives considered", approach C, "GitHub is the state store and the resolver reads a snapshot, so no events
    drive a machine.": the same change of the first words;
  - in "Reconsider when", "or Celetis gets a second state store": the condition holds now. The decision stays.
- [Readiness is separate from build completion](0045-readiness-is-separate-from-build-completion.md), in part: in
  "Constraints and evidence", "GitHub remains the durable state store.", and in "Reconsider when", "GitHub stops being
  the workflow state store, or no longer supplies the ordered timeline." The tracker of the project is the durable
  state store. The first condition holds now. The second does not: `history` of the local tracker is ordered.
- [Epic completion requires declared acceptance](0056-epic-completion-requires-declared-acceptance.md), in part: in
  "Constraints and evidence", the sentence "GitHub remains the durable state store." The tracker of the project is the
  durable state store. A3 and A4 hold with `local`: the epic lock covers one common Git directory, and an edit from
  another machine arrives by sync.
- [The tracker and the code host are separate ports](0120-the-tracker-and-the-code-host-are-separate-ports.md), in
  part, in "Decision":
  - the sentence "`gh` stays for the code host and for another repository.": the engine runs `gh` for the GitHub
    tracker, for the `pr` landing, and for another repository (see "Decision", item 8);
  - **D1**: `services(cwd, signal?, env?)` and the one GitHub client. `services` takes the choice of the project,
    `{ tracker, landing }`, and builds the GitHub client only for an adapter that needs it;
  - **D4**: the project URL of the epic snapshot stays a read inside the GitHub adapter. It is the method
    `project()` of the `Tracker` port, and the forms of the repository and of a child URL are the `forms` of the port;
  - **D5**: `setup status` imports `loggedIn` of the GitHub client. The import runs only for the GitHub tracker;
  - the three "Follow-ups for #335": items 1, 7, and 8 of the "Decision" below do them (the composition choice, the form of
    a child URL, and the setup status).
- [The build step lands the change](0008-the-build-step-lands-the-change.md), in part:
  - in "Decision", "The trunk is the default branch that GitHub reports: the script holds no branch name.": with
    `merge`, the trunk is the branch that `HEAD` of `origin` names, read with `git ls-remote --symref origin HEAD`.
    With `pr`, GitHub reports it. The command still holds no branch name;
  - in "Reconsider when", "or another tracker than GitHub": the condition holds now.
- [The harness is the plugin celetis](0012-the-harness-is-the-plugin-celetis.md), in part:
  - in "Decision", "The worktree setup": "It reads that name with `gh repo view --json defaultBranchRef`, as the landing
    script does". `worktree` and `land` read the name from the code host of the project (see item 5);
  - in "Reconsider when", "A product project tracks its issues in a tracker that is not GitHub. The resolver, the landing
    script, and the worktree script call `gh`.": the condition holds now.
- [A step session hands a stop to the issue](0011-a-step-session-hands-a-stop-to-the-issue.md), in part: in "Decision",
  rule 4, "When GitHub does not answer, the session shows the message in its pane and stops." The rule holds when the
  tracker of the project does not answer.
- [Each issue write of a session goes through the command issue](0108-each-issue-write-of-a-session-goes-through-the-command-issue.md),
  in part, in "Decision":
  - the two sentences of `issue create` that name GitHub: "When GitHub dropped the label, the act prints the URL and
    exits 6." and "With no URL, the exit line says "no issue was written" only for a refusal of GitHub". They hold for
    the tracker of the project, and the line names it;
  - "`issue <n> comment <file> [--attach <file>#<alt>]` posts an ordinary comment through `gh issue comment`, with the
    uploads.": the act posts through the tracker, and the local tracker stores each upload as a blob (item 7).
- [The board is a part of the engine](0035-the-board-is-a-part-of-the-engine.md), in part: in "Decision", the fallback line
  of a failed read, "`cannot read the issues from GitHub`". The line names the tracker from the `name` of its port. The
  board document names the tracker from that `name` too.
- [The plugin owns the prototype skill](0044-the-plugin-owns-the-prototype-skill.md), in part: in "Consequences", "Each
  capture needs `gh` 2.99.0 or later on github.com, and the capture tool of the platform row." This holds for the tracker
  `github`. With `local`, the tools check is the capture tool only.

## Context

Each lane kept its state on a GitHub issue. After #334, the `Tracker` port had one adapter, and `services()` always built
it. The `merge` landing also read the default branch from GitHub, and `daemon start` and each run refused to start when
`gh` was not on `PATH`. So a project with no GitHub could not run a lane. The maintainer wants local issue tracking with
no GitHub (decision 1 of the epic #11), and ADR-0036 and ADR-0120 had named the reversal and its follow-ups.

## Constraints and evidence

- The format is binding (decision 3 of the epic). Each issue is a bug entity under `refs/bugs/<ID>` with bug format
  version 4, and each author is an identity under `refs/identities/<ID>` with identity format version 2. A reader checks
  the version, one root, the clocks, the ref name, and unique operation IDs. The spec of the format is pinned to a
  commit: [the DAG entity](https://github.com/git-bug/spec/blob/2d5f3e3f497a34cd7f35f1af605507a0a7173289/dag-entity.md),
  [the bug](https://github.com/git-bug/spec/blob/2d5f3e3f497a34cd7f35f1af605507a0a7173289/bug.md),
  [the identity](https://github.com/git-bug/spec/blob/2d5f3e3f497a34cd7f35f1af605507a0a7173289/identity.md), and
  [the IDs](https://github.com/git-bug/spec/blob/2d5f3e3f497a34cd7f35f1af605507a0a7173289/ids.md). An ID is the SHA-256
  of the stored bytes, and a client accepts a 7-character prefix that matches exactly one ID.
- The git-bug CLI prints no label-change order, writes no metadata, and attaches no files. So the engine writes the format
  itself with git plumbing, and the git-bug tools stay optional (decision 3 of the epic).
- A diverged bug history merges with a commit that has two parents and an empty `ops` pack. A push is fast-forward only.
  `git update-ref <ref> <new> <old>` changes a ref only when it still holds `<old>`, so a concurrent writer fails and
  can retry. `git ls-remote --symref origin HEAD` prints the branch that `HEAD` of the remote names. The sources are in
  the spec of #335, "Prior art" and "External facts".
- Two sync patterns exist: explicit push and pull (git-bug, Beads), and automatic sync around each write (Fossil
  `autosync`). The maintainer picked the second ("A" of the spec).
- The `merge` landing has one code-host read, the default branch. Its open-PR lists are empty.
- The engine before this change refused a `.celetis.yaml` that has the field `tracker`: `keysOnly` of
  `engine/lib/config/core.ts` on the base listed no such field and threw `unknown field`.
- The contract on the trunk was 10 when the lane started.
- `biome.jsonc` sets `noImportCycles`, so the composition stays in `engine/lib/services/services.ts` (D1 of ADR-0120).

## Decision

The project chooses its tracker, and the engine serves two adapters of the `Tracker` port: the GitHub adapter and a local
adapter that keeps each issue as a git-bug entity in the refs of the repository, synced with `origin`. Each item names
the calls of the spec that it holds. Items 6, 9, 10, and 11, and the mechanisms of items 4 and 5, are decisions of the
build.

1. **The choice (My calls 1, 2, 11).** `.celetis.yaml` has a required field `tracker`, `github` or `local`, and setup
   writes it. `tracker: local` with `landing: pr` is refused. This repository sets `tracker: github`.
   `services(choice, cwd, signal?, env?)` takes `{ tracker, landing }` and returns `{ tracker, codeHost }`: the GitHub or
   the local tracker, and the GitHub code host for `pr` or the git code host for `merge`. A command takes the choice from
   the main config, also in a lane worktree, so a lane branch cannot change the tracker of the project. Setup passes its
   resolved answers, because its config can be absent or old.
2. **The key and the URL (My calls 3, 4).** The key of a local issue is the first 7 characters of its 64-character ID.
   The local grammar is `[0-9a-f]{7}`, and there is no longer form. `issue create` makes a new nonce until no local bug has
   that prefix. A key that matches two or more local bugs after a sync is a refusal: the read prints
   `#<key> matches several local issues: <full IDs>` and exits 6. The URL of an issue is `local:<key>`, and the URL of a
   comment is `local:<key>#<operation ID>`. The key of an act is the part of the printed URL after the last `/`, or after
   `local:`.
3. **The adapter (My calls 6, 7, 9, 13).** The adapter reads and writes the format with git plumbing in the main
   checkout. One write is one or more commits on the current tip and one `git update-ref <ref> <new> <old>`; when the ref
   moved, the write reads the tip again and retries, at most 5 times. The parent link is the metadata key
   `celetis-parent` of the create operation. When `refs/config/config` exists, or `git config user.email` is not set, a
   write exits 3 before it writes. A file of `comment --attach` is a blob of the pack, named in the message by its hash.
   The refs come from other machines, so the reader checks each entity before it uses it: a read of one issue that fails
   a check exits 6, and a list skips the entity with one warning line.
4. **Sync (approach A).** The mechanism is the method `synced(command, work)` of the `Tracker` port. For the local
   tracker, it pulls once, runs `work`, and then pushes once when the set of local ref tips changed. A nested call runs
   its work only, so one command makes at most one pull and one push. When `origin` refuses a ref as non-fast-forward,
   the push pulls once and pushes once more. For the GitHub tracker, `synced` runs `work` only. The acts of `issue` that
   write (`create`, `comment`, `link`, `epic`, `complete-epic`, and each lifecycle act except `state`) and the whole of
   `land` run in `synced`. `worktree` and the auto loop of the daemon call `pull` only; the daemon pulls at most once in
   each 60 seconds (My call 8). The read acts (`view`, `list`, `state`, `epic-state`) do not sync. When `origin` cannot be reached,
   the write stays in the local refs, the command keeps its exit code, and it prints one line:
   `<command>: the local issues are not in sync with origin: <git line>; run celetis --agent <host> issue sync later`.
   The push has no `+`, no `--force`, no `--prune`, and no `--mirror`. The new act `issue sync` pulls and then pushes. It
   exits 0; 6 when `origin` cannot be reached; and 3 with the GitHub tracker, where it writes nothing, and when
   `refs/config/config` exists or `git config user.email` is not set.
5. **The code host follows the landing (My calls 5, 10).** `landing: merge` uses the git code host
   (`engine/lib/git-host/git-host.ts`), also with the GitHub tracker, so `worktree` and `land` read the default branch
   with `git ls-remote --symref origin HEAD`. Its `pulls()` gives `[]`. The `pr` landing keeps the GitHub code host. Each
   port has a `name`: `GitHub`, `the local tracker`, or `git`. A printed line that named GitHub as the tracker or the code
   host names the port now. A line of a GitHub project stays as it was, except the default-branch read of a `merge` project,
   which now says `git`: `cannot read the default branch from git`. `completeParent` of `land` reads the project of the
   tracker once, with `project()`, only when the landed issue has a parent and the landing is `merge`; with `pr` it uses
   the repository that the landing already read.
6. **The grammar of the process.** The key grammar follows the tracker (`useGrammar` of
   `engine/lib/tracker/grammar.ts`). The launcher `engine/launcher.ts` reads `tracker` of the main config and passes it
   to the command as `CELETIS_TRACKER`; `commandInput` of `engine/lib/command/operation.ts` calls `useGrammar` from it.
   With no checkout or no valid config the value is `github`, and the command reports the config itself. The daemon
   inherits the value from `daemon start`. The board page takes the grammar from the `grammar` field of each board
   document. Keys compare as text with `local`; the modules that order keys call `compareKeys`
   (`engine/lib/queue/set-aside.ts`, `engine/lib/resolver/resolver.ts`, `engine/lib/board-read/board-read.ts`,
   `engine/board/place.ts`, `engine/board/reads.ts`, and `engine/board/page/board.ts`), so the order of local keys is no
   order of age until #336 owns the view.
7. **The epic record (My call 12).** The record keeps one schema. The tracker gives the forms: `repository` is the GitHub URL
   or `local`, a child URL is the URL of the tracker (`local:<key>`), and a child `id`, each `reports` item, and the
   `decision` are JSON strings: the decimal database ID for GitHub and the 64-character ID for local. The `id` of a comment
   of `history` is a string too.
8. **No `gh` for a local project (My calls 14, 15).** `daemon start` and the start of a run check `gh` on `PATH` only
   when the project uses the GitHub tracker or the `pr` landing (`needsGh` of `engine/lib/services/services.ts`). A
   project with no valid config counts as GitHub for this check. `setup status` with `local` reads no GitHub host, no
   `gh` login, and no label, and needs only a remote `origin`. The board of a local project shows its cards through the
   ports and makes no History or delivery read: its History is empty, with the local trunk label and no network read, and
   a card has `url: null`, because the page accepts only `http` and `https` links. `plugins/celetis/references/procedures/ui.md`
   needs `gh` only for the GitHub tracker, and `plugins/celetis/skills/critic-loop/SKILL.md` reads the trunk with
   `git ls-remote`.
9. **Setup.** `setup write` takes `--tracker github|local`, writes `tracker` into `.celetis.yaml`, and records it in the
   wiring record as `answers.tracker`. The two must agree. With `local`, setup makes no label, because the format has no
   label registry. A fresh `setup check`, with no answer and no valid config, keeps the GitHub read first and reads the
   trunk with git when `gh` fails.
10. **The contract.** The new act `sync` and the new flag `--tracker` raise the contract to 11. `engine/lib/contract/versions.json`
    serves 11 only, and `plugins/celetis/contract.json` needs 11. The plugin text of contract 10 names no `sync` act, so
    the engine does not serve it.
11. **The agent text.** The entry rule **GitHub.** is now **Tracker.**: it names the `tracker` of the project, the form of
    the URL that `issue create` prints for each tracker, and the key at the end of it. `gh` stays for the code host of the
    project, where a step names it, and for another repository.

The local issues of a repository reach the other machines through `origin`, which can be any git host. A migration of the
issues of a project between the trackers is not part of this decision.

## Constitution

Read: `CONSTITUTION.md`, amended 2026-11-12.

- Serves: 1 Intent to release: a project with no GitHub can take a change from intent to the trunk.
- Serves: 2 Autonomous steps: the sync needs no human act, so a daemon on any machine acts on the current state of the
  issues.
- Serves: 4 Product neutrality: the tracker is a choice of the project.
- Hard limits and non-goals: none touched. `land` stays the one landing path, and the `merge` landing still runs the suite
  on the tip that it lands.

## Alternatives considered

- **Explicit sync only** (git-bug and Beads). Only `issue sync` would reach the network. With it, a daemon of another
  machine acts on old state until a person syncs, and each step must name a sync act. Rejected for goal 2.
- **A sync on a timer only.** A write can wait a whole period before it leaves the machine, and a read can see a state
  that is a period old. Rejected.
- **Issue files in the source tree, a database, or a format of Celetis.** The epic rejected them in favor of the published
  format. Rejected.
- **The git-bug CLI as the writer.** It lacks the label-change order, the metadata, and the attachments (see "Constraints
  and evidence"). Rejected.
- **The GitHub code host also for `merge` with the GitHub tracker.** It keeps two code hosts for one landing and a GitHub
  read that the landing does not need. Rejected.
- **A local tracker with the `pr` landing.** There is no pull request without a code host. Refused for now (My call 2).
- **A key with a longer form when two issues share a prefix.** The 7-character key is the human ID of the format. The
  read refuses an ambiguous key, and `issue create` prevents one on the local machine.

## Consequences

- A project with `tracker: local` and `landing: merge` runs a lane from intake to landing with no GitHub call: the
  tracker and the code host read no GitHub, and `gh` is not needed on `PATH`. The proof of this is the lab scenarios of
  the Verify phase of #335 (R8 to R10 of the spec).
- A machine must update the engine after this change lands. The engine before it refuses the field `tracker` with
  `unknown field`, and this repository now sets `tracker: github`. The plugin text of contract 10 does not run with the
  engine that serves 11.
- A GitHub project keeps each line, exit class, and JSON field of before, with these exceptions. I took them from the
  string literals of the diff of `engine/` against the base of the lane (8365fe7); each other literal that names GitHub
  now reads the `name` of its port, which is `GitHub` for the GitHub tracker and the `pr` landing.
  - A `merge` project: `land` and `worktree` print `cannot read the default branch from git` in place of `... from
    GitHub`; `setup check` prints that line in place of `origin is not a GitHub repository that gh can read`; and
    `setup status` prints `cannot read the git repository of origin` in place of `cannot read the GitHub repository of
    origin with gh`.
  - `setup status`, for each project: `answers.tracker is missing; run setup with the tracker of the project` in place of
    `... run setup with GitHub`, and, with no config file, `no file; setup writes tracker, landing, and suite with merge`
    in place of `... setup writes landing, and suite with merge`. It also reports a wiring record whose `answers.tracker`
    differs from `tracker` of the config.
  - A config with no `tracker` is refused, `setup write` and `setup try` need `--tracker`, and a wiring record with an
    unknown tracker gets `answers.tracker: need github or local` in place of `answers.tracker: only GitHub is supported
    now`.
  - The help text of `daemon` (the exit 3 for a missing `gh` holds for a project with the GitHub tracker, the `pr`
    landing, or no valid config) and of `issue` (the act `sync`) changes.
  - A comment `id` of `view` is a JSON string, and the child `id`, `reports`, and `decision` of an epic submission are JSON
    strings. A submission with numeric IDs is refused, and so is an `## Epic accepted` comment that an earlier engine
    published, because its child IDs are numbers. The maintainer's rule forbids a compatibility reader (as in ADR-0117).
- The plan comment ID is a string, so the run record is schema 5 (it was 4) and the quota-recovery record is schema 4 (it
  was 3): `authority` of `engine/lib/run/record.ts` and of `engine/lib/run/quota-recovery.ts` accepts `plan` only as a
  string. A conversion is possible (a number to its decimal string), but this record gives none. The reason is the
  maintainer's rule of no compatibility layers and no migrations, which is the "record why" of ADR-0070. A run record of
  schema 4 gets `the record has another schema`, and a recovery record of schema 3 gets `invalid or obsolete recovery
  record; inspect it, then remove it`. The older conversions stay (run records of schemas 2 and 3, recovery records of
  schema 2) and write the new schemas, but only for a record with `plan: null`. A record of an older schema with a
  numeric `plan` is refused: a run record with `the record is not a valid run record`, and a recovery record with the
  `invalid or obsolete recovery record` line above.
- Local keys order as text, not by age, until #336. The board of a local project has cards only, with no link, no History,
  and no delivery.
- A sync that finds two bugs with one 7-character prefix leaves each act on that key refused. The refusal names the full
  IDs, but no act takes a longer key, so a person resolves the clash outside the engine.
- A failed write after the first of an act that makes several writes prints the `gh` command that completes it, also for
  `local`, where that command does nothing useful (`engine/issue.ts`, `byHand`). This is a known limit of this change.
- A host that refuses or hides `refs/bugs/*` is an open check: the fixtures use a bare repository on disk. A push with
  `--mirror` or `--prune` from a clone with no such refs deletes them on the remote, and the engine never does it.
- A session reads state that another machine changed during its step only after its next sync, because the read acts do
  not sync.
- The `pr` landing keeps its checks and its records (ADR-0023, ADR-0093).

## Reconsider when

- A host that a project uses as `origin` refuses `refs/bugs/*` or `refs/identities/*`.
- The git-bug format changes its version, or a git-bug release reads an entity that the engine wrote and rejects it.
- Two bugs with one 7-character prefix occur often enough that the refusal of the key costs more than a longer form.
- A project needs the `pr` landing with the local tracker, or issues that move between the trackers.
- The board view of #336 needs an order of local keys by age.
