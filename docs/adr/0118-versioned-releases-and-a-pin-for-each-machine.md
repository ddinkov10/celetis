# Versioned releases and a pin for each machine

## Date

2026-11-20

## Related

- [Issue #64](https://github.com/ddinkov10/celetis/issues/64): the spec (the body of the issue, `Spec: 2026-11-19`). It
  names "Risk 1" to "Risk 6" and the probe of "Design probes". The maintainer declared Celetis stable in
  [a comment of #64](https://github.com/ddinkov10/celetis/issues/64#issuecomment-7019994782).
- [The plan of #64](https://github.com/ddinkov10/celetis/issues/64#issuecomment-7021054536): the tasks, the verify
  scenarios, and the steps of the maintainer after the landing. "Task 3, Step 7" names a step of that plan.
- [ADR-0012](0012-the-harness-is-the-plugin-celetis.md), R9 "One version for each machine": it stays. A machine
  runs one release or the head of `main`, and a product project cannot stay on an older one. The rule "Each commit on
  `main` of `ddinkov10/celetis` is a new version" of "Versions and updates" also stays, for `main`.
- [ADR-0090](0090-a-contract-version-replaces-the-same-revision-rule.md): the contract pair check stays. It runs on the
  targets before each question, also for a move with `--to`. The contract of the plugin stays in
  `plugins/celetis/contract.json`, not in a manifest.
- [ADR-0027](0027-celetis-updates-require-one-chat-approval.md): "No persistent product pin is added" stays. The pin of
  this record is one for each machine, in the user settings, not one for each product.
- [ADR-0028](0028-terminal-confirmed-native-plugin-updates.md) stays. The SHA-bound update still restores the native
  marketplace record after each plugin update. The spec named the clause "User and project settings stay unchanged"
  for it, and no record holds that clause. The write of the `ref` member of the user entry (Decision 5) does not
  contradict ADR-0028.
- [ADR-0115](0115-the-engine-pins-its-packages-in-a-lockfile.md): the gate refuses a tree with no installed packages,
  so the release script installs the locked packages in its worktree before it runs the gate.
- [ADR-0031](0031-plugin-development-is-independent-of-adoption.md): the build changed this repository only.

## Supersedes

Only these clauses change. The records keep their historical text and evidence.

- [The harness is the Claude plugin `celetis`, and each product project wires it in](0012-the-harness-is-the-plugin-celetis.md),
  in part:
  - "Each landed change of the plugin reaches the product projects, with no release step.", and the matching words
    "the plugin has no version and no release step" in "Consequences".
  - In "Decision", "`.claude-plugin/plugin.json` has no `version`", and the words "no `version`" in "It has no
    `version`, no `bin/` folder, no hook, and no declared dependency". The commit of a release holds a `version`, and
    `main` holds none.
  - In "Alternatives considered", the rejection of "A version and a release step", and the matching item of
    "Reconsider when".
  - In "The wiring", "The `.claude/settings.json` of a product project holds the marketplace under
    `extraKnownMarketplaces`, with ... `"autoUpdate": true`", and in "Decision", the bullet "A session by hand",
    "The key of the project file turns it on (R2)". The project file holds no Celetis marketplace entry and no `autoUpdate` key.
- [Setup writes the wiring of a product project](0017-setup-writes-the-wiring-of-a-product-project.md), in part: in
  "Decision", "Setup writes the host files": the owned entries of `.claude/settings.json` no longer include
  `extraKnownMarketplaces.celetis`.
- [The installed plugin owns the entrypoint](0030-the-installed-plugin-owns-the-entrypoint.md), in part: in
  "Supersedes", the words of the ADR-0017 item "now apply only to `extraKnownMarketplaces.celetis` and
  `enabledPlugins.superpowers@superpowers-marketplace`". The two sentences now apply only to the Superpowers key.
- [One Celetis program for both hosts](0042-one-celetis-program-for-both-hosts.md), in part: in "Decision", "The
  entry", "`celetis --version` prints the revision of the program", and in "The layout", "a Git clone of the source of
  the program, on its branch, at that revision". A version folder is on a branch, or at a release tag.
- [Setup owns required configuration and host wiring](0052-setup-owns-required-configuration-and-host-wiring.md), in
  part: in "Decision", "The one replacement is an unchanged, recorded canonical Celetis marketplace entry: setup sets
  its `autoUpdate` to false. Differing or unowned existing marketplace entries stay unchanged." Setup writes no such
  entry.
- [Setup reconciles recorded owned wiring](0071-setup-reconciles-recorded-owned-wiring.md), in part: in "Supersedes",
  the item on the "Decision" of ADR-0052, whose words "The one replacement is an unchanged, recorded canonical Celetis
  marketplace entry" and "Differing or unowned existing marketplace entries stay unchanged" that record separates into
  owned and unowned scopes. The entry `extraKnownMarketplaces.celetis` is no required entry. A recorded entry is an
  obsolete owned scope, and the rule "removes obsolete owned scopes" of its "Decision" removes it.
- [A contract version replaces the same-revision rule](0090-a-contract-version-replaces-the-same-revision-rule.md), in
  part: in "Related", "The manifests still have no `version`", and in "Constraints and evidence", "No manifest field
  carries the version (ADR-0012)". Both hold for `main` only. In "The update", "Each part goes to the target of its
  own source and ref": the target of a part that follows a release is the newest release of its source.

## Context

Each part of Celetis followed the head of `main`. `celetis update` moved the engine and the plugin of each host to
the newest commit of `main`, so a machine could not stay on a known-good state. The maintainer declared Celetis stable
on 2026-11-19, which met the resume condition of #64, and chose one release for each machine, the first release
`v0.0.1`, and one command that moves a machine ("approach B" of the spec). ADR-0012 had rejected a version and a
release step for the first rounds of fast iteration. It named a bad change that reaches a product as the reason to
reconsider. The reason now is the stable use that the maintainer declared.

## Constraints and evidence

- On Claude Code a manifest `version` keeps users on a copy until the string changes (External facts of the spec). A
  `version` on `main` would stop a machine that follows `main`. So the version lives on the release commit only, and
  that commit is a child of a `main` commit that no branch merges.
- The probe of the spec (Claude Code 2.1.328, codex-cli 0.167.0, a fixture repository, macOS, 2026-11-19) found a path
  on each host that moves a ref and keeps the plugin installed. Claude: set the ref of the user entry, add the
  marketplace at the new ref, update the plugin. A second add with another ref, with no change of the user entry,
  failed with `Cannot add marketplace "probe64": its source doesn't match its extraKnownMarketplaces entry in user or
  managed settings`. A marketplace remove uninstalls the plugins of the marketplace. Codex: remove the marketplace,
  add it at the new ref, upgrade. A second add with another ref failed with `marketplace 'probe64' is already added
  from a different source`, and the remove kept the plugin enabled and its cache.
- Codex order (observed 2026-11-19, with a fixture of the build). After the remove and the add at the new ref, the
  marketplace clone is at the new ref and the cache folder is at the old version. The inspect of the updater then
  refuses with `the Codex plugin cache … does not match plugins/celetis at <revision>: .claude-plugin/plugin.json is
  changed; run codex plugin marketplace upgrade celetis, or reinstall the plugin`. With the ref moved first, a rerun
  after a failed upgrade, and a rerun after the printed repair add, stop on that line and cannot complete the move.
- Claude add rewrites the settings (observed 2026-11-19). The updater writes one line of the user settings, the `ref`
  member, and keeps the line ends and the other members. Then Claude Code 2.1.328 runs the add and writes the file
  again in its own layout. A file with a four-space indent, CRLF line ends, and an extra member came back with a
  two-space indent, LF line ends, `enabledPlugins` before `extraKnownMarketplaces`, and the same values.
- The other Claude path, an edit of `known_marketplaces.json` and `claude plugin marketplace update celetis`, kept the
  bytes of the user settings in an observation of the build (2026-11-19). It writes a native record by hand, which no
  probe of the spec approved.
- The user entry is a settings layer. The effective Claude source is the last layer that declares the marketplace
  `celetis`, so a committed project entry with no ref overrides the pin of the machine.
- The release script ran on a local fixture of this repository (2026-11-19 and 2026-11-20). The gate printed
  `verify: PASS` on the release tree. After the merge of #348, the first run of the gate on a release worktree failed
  with `verify: engine/node_modules/yaml is missing`, so the script installs the locked packages before it runs the gate.
- The probes ran on macOS 26 with Claude Code 2.1.328, codex-cli 0.167.0, and Git 2.56.0, in private homes. They used the
  `git` shape of the marketplace source, with a fixture URL that a temporary Git configuration mapped to a local
  repository.
- **Limits of the evidence.** Each limit is an observation of the build of #64 with temporary host data, on the date
  given. No runtime report of #64 exists when this record lands.
  - **Risk 1, the loaded copy after a Claude move.** A pinned fixture machine selected the folder `cache/celetis/celetis/0.0.2`
    in `claude plugin list --json`, with version `0.0.2` and the release commit in `installed_plugins.json` (2026-11-19). The
    files of that folder equalled `git archive v0.0.2 plugins/celetis`, apart from an empty `.in_use` folder that Claude Code
    made. No fresh interactive session that loads that copy ran. This stays open, and the plan has a step for the
    maintainer.
  - **Risk 3, a session start with a changed settings source.** A private interactive start of Claude Code 2.1.328 in a
    folder with a project entry with no ref showed the theme picker, then the sign-in screen, and waited 30 seconds there
    (2026-11-19). No trust dialog appeared. `known_marketplaces.json` and the catalog folder did not change. A signed-in
    start was not observed, so it is open whether a session fetches `main` into the catalog of a pinned machine. The
    updater names a catalog whose ref differs from the user entry, with its repair.
  - **Risk 2, the Codex window.** A wrapper that failed the add after the remove (2026-11-19) showed the printed add command,
    and that command and the next update completed the move. A failure of Codex itself between the two acts was not
    observed.
  - **The settings layers.** The managed-settings layer is not compared with the pin. A Claude part with a user entry takes
    its source and its ref from that entry, so an entry of the managed settings does not set them. A write by another process
    between the last read of the user settings and the `rename` was not injected.
  - **Source shapes.** The probes used the `git` shape of the marketplace source. The `github` shape of the real entry, with
    a `repo` and no `url`, was not run against a host.
  - **Windows and other hosts.** No Windows host was available in the build. The probes ran on one machine with one version of
    each CLI. A first release of the real repository, `celetis update --to v0.0.1` on a real machine, and the real
    `ddinkov10/celetis` source were not run, and the real installation did not change.

## Decision

1. **The release.** `scripts/release.ts <X.Y.Z>` makes a release. It is maintenance of this repository, not a command of
   the engine. The maintainer runs it in the main checkout. It refuses, and writes no ref, unless the argument is one
   `X.Y.Z`, the checkout is on `main`, clean, and at `origin/main`, and `vX.Y.Z` is greater than each release tag of
   `origin`. In a detached worktree it makes one commit `release: vX.Y.Z` on top of `main`. The commit adds `"version"` to
   the two plugin manifests. The script installs the locked packages there and runs the verify gate on that tree. Then it
   makes the annotated tag `vX.Y.Z` and pushes only that tag. `main` does not move. A failed push leaves the local tag, and
   the script prints the push command and does not retry. A release tag never moves.
2. **The ref of a part.** The engine, the Claude marketplace, and the Codex marketplace each follow one ref: a branch,
   or a release tag of the form `v<int>.<int>.<int>` with decimal parts and no leading zero. Each other tag is refused,
   with its part named. An absent ref and `HEAD` mean the default branch of the source, so an installation that exists
   reads as a branch with no migration. `engine/lib/release/release.ts` holds the kinds, and `engine/lib/update/target.ts`
   holds the target rule:

   | Ref of the part | Target of `celetis update` | Target of `celetis update --to <ref>` |
   | --- | --- | --- |
   | a branch | the head of that branch | the head of the branch, or the commit of the release tag |
   | a release tag | the commit of the newest release tag of the source | the head of the branch, or the commit of the release tag |

   "Newest" is the numeric order of the three numbers, and each part reads the tags of its own source. A move to an older
   release is allowed. A part that follows a release on a source with no release tag is an `error` part, and nothing
   changes. The contract pair check of the targets runs before each question.
3. **The engine at a tag.** A version folder at a release tag is a detached clone at the commit of the tag. It holds the
   local tag, and no second file records the tag. The engine reads its ref from that folder: a release only when the local
   tag peels to `HEAD` and the plugin manifest names the version. The identity check compares the peeled commit of the tag
   on the source where it compared the head of a branch. `celetis install` accepts a checkout on a branch or at a release
   tag, and refuses a detached checkout at another commit. `celetis --version` prints `<X.Y.Z> (<full revision>)` for a
   release, and the full revision for another commit. The engine reads its release from `plugins/celetis/.claude-plugin/plugin.json`
   of its own folder, so one tag versions the engine and the plugin.
4. **`celetis update --to <ref>`.** One ref for the three parts. A `<ref>` that starts with `-`, holds a control
   character, has the start of a release tag but not its form, or is no valid branch name, exits 2 before any read.
   On a source, `<ref>` names only the branch `refs/heads/<ref>` or the tag `refs/tags/<ref>`, and a release form names
   only the tag: `git ls-remote` also matches a longer ref that ends with the text, so the update compares the full name.
   The same rule reads a short ref of a marketplace source. A `<ref>` at the commit of the installed engine, when the
   engine follows another ref, is an `error` part of the engine: a version folder has the name of its revision and holds
   one ref, so the engine cannot move between two refs at one commit.
   Before the question, the update checks the ref on each source, reads each target, and runs the pair check. It stops
   with exit 3, and asks nothing, when the user settings hold no entry `celetis` while the Claude part must move its ref,
   or when a project or local layer conflicts with the pin (decision 6). The question needs an interactive terminal, as
   before. No agent confirms it, and the board offer has no `--to` control: the worker refuses an offer that carries a
   request.
5. **The moves.** Claude sets only the `ref` member of `extraKnownMarketplaces.celetis.source` in the user settings,
   under the updater lock, and refuses when the entry is missing, changed since the offer, or ambiguous JSON. Then it
   runs `claude plugin marketplace add --scope user --json -- <source>#<ref>`, and then the SHA-bound plugin update. The
   host rewrites the user settings in that add with the same values, and the documents say so. Codex updates to the
   SHA-bound target first, and then runs `codex plugin marketplace remove celetis` and
   `codex plugin marketplace add <source> --ref <ref>`. The engine installs the target, and its version folder holds the
   ref. The first failure stops the move. The report names the completed and the incomplete parts, and the current line
   of the failed part: its revision, its source, and its ref, or its `skipped` or `error` line. A failed marketplace
   add, for each host, prints the command that repairs it. A part that is at its target is skipped, so the same command
   again completes a move that stopped. A Claude part whose catalog ref differs from the ref of the
   user entry is an `error` part with the add command that repairs it.
6. **The settings of a product.** Setup writes no `extraKnownMarketplaces.celetis`. It removes an entry that its record
   owns, with the parent object when that object is then empty. It keeps an unrecorded entry and warns that the owner
   must review it. `setup status` reports a project or a local entry as a gap, with its path. The updater compares each
   project or local layer of the current folder with the pin after the move: the user source at the target ref. A layer
   with another source or ref is a stop that names the file. Two forms of one GitHub address are one source, and an
   absent ref equals the default branch. So a layer with the source of the user entry and no ref is no stop for
   `celetis update` on a machine that follows `main`. It is a stop for a machine that is pinned to a release, and for a
   move to a release.
7. **The setup record.** `.claude/celetis/wiring.json` gets the optional field `release`: `X.Y.Z` for a release, else the
   full revision of the engine that ran setup. The schema stays 1. A record with no field reads as before. An unchanged
   repeat on the same engine changes no byte.
8. **The contract.** The new form `update --to <ref>` raised the contract to 7. The maintainer answered "Drop 6" in the plan
   session, so `engine/lib/contract/versions.json` serves only 7, and `plugins/celetis/contract.json` declares 7.
   A plugin at contract 6 cannot pair with this engine.

## Constitution

Read: `CONSTITUTION.md`, amended 2026-11-12.

- Serves: 1 Intent to release: Celetis gets a release step, and a machine runs a known release of the harness.
- Serves: 3 Verified landing: a release is cut only from `main`, which passed the gate at each landing, and the release
  script runs the gate on the release tree.
- Hard limits and non-goals: none touched. The move keeps the terminal confirmation, and the board offer has no `--to`
  control. No agent approves an update.

## Alternatives considered

- **A. Native pins only.** The maintainer pins each part with its host command, and `celetis update` keeps each part at its
  tag. It is the smallest change, but it needs about six host commands for each move on each machine, and the host
  differences stay in the README. The maintainer picked approach B.
- **A release line for each product project.** The engine and the master daemon would select a release for each project,
  with two plugin channels for each host. The maintainer chose one release for each machine.
- **A `version` on `main`.** It is the pattern of Superpowers. On Claude it freezes a machine that follows `main` until the
  next bump.
- **A tag with no manifest `version`.** The hosts then show a commit version for a release, and the issue asks for a plugin
  version.
- **A remove and an install again to change a ref on Claude.** The remove uninstalls the plugin and deletes its data, and a
  failure in between leaves no plugin.
- **The ref of Codex moved before its upgrade, as the spec lists the acts.** The inspect then refuses the cache, and a
  rerun cannot complete the move (Constraints and evidence). The rule of the spec that the same command again completes
  a move decides the order.
- **An edit of `known_marketplaces.json` and `claude plugin marketplace update` for the Claude move.** It keeps the bytes
  of the user settings, and it writes a native record that no probe approved. The updater keeps the add of the spec.
- **A project entry that pins the ref for each product.** It overrides the pin of the machine.
- **The tag form `celetis--v<version>` of `claude plugin tag`.** It serves version ranges of plugin dependencies, and no
  plugin depends on Celetis.

## Consequences

- The maintainer cuts a release by hand, and each machine moves with one confirmed command. A pinned machine gets no landed
  change until the next release and a yes. A machine that follows `main`, such as one that works on this repository,
  keeps the target of `celetis update`, the head of `main`. It gains the catalog-ref stop, the layer stop for an
  explicit other ref, a question and an up-to-date line that name the target ref when it differs from the current ref,
  and contract 7 only.
- A product with an old committed `extraKnownMarketplaces.celetis` has a gap in `setup status`, and a pinned machine
  stops its update until setup removes the entry or the owner removes an unrecorded one.
- The updater, the installation, and the update worker of the board, which are trust files, changed. The security review
  of ADR-0111 is a task of the plan.
- One tag versions the engine, the Claude plugin, and the Codex plugin. A source that has no release tag gives an `error`
  part to each part that follows a release.
- The engine serves only contract 7, so a plugin that declares contract 6 cannot pair with it.
- Publication through a package manager, GitHub Release objects, and release notes stay with #251, which can build on
  these tags.

## Reconsider when

- A second maintainer or a second product needs a release line for each product project.
- Claude Code or Codex adds a native move of a marketplace ref, or changes how `marketplace add` and the user settings
  work, so that the host-specific moves can go.
- The signed-in session start of Claude Code fetches the project source into the catalog of a pinned machine (Risk 3).
- A Windows host shows that the release script, the moves, or the ref checks differ there.
- The managed-settings layer must take part in the pin check.
- A manifest `version` on `main` stops freezing a machine that follows `main`, so that the release commit is no longer
  needed.
