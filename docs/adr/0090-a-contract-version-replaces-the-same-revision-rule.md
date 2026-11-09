# A contract version replaces the same-revision rule

## Date

2026-11-09

## Related

- [Issue #262](https://github.com/ddinkov10/celetis/issues/262): the spec (body of the issue), and the
  [plan comment](https://github.com/ddinkov10/celetis/issues/262#issuecomment-6743878789), which holds the plan
  with its "Decisions of the plan session". In this record, "Task N", "Decision N", "Risk N", and a probe case
  letter name parts of that plan.
- [Issue #195](https://github.com/ddinkov10/celetis/issues/195): finding F3, marked "take" on 2026-11-05.
- [Issue #251](https://github.com/ddinkov10/celetis/issues/251): release versions and the install path.
- [Issue #64](https://github.com/ddinkov10/celetis/issues/64): the registry.
- [Issue #281](https://github.com/ddinkov10/celetis/issues/281): the three module lists of the program.
- [ADR-0012](0012-the-harness-is-the-plugin-celetis.md): its manifest facts stay. The manifests still have no
  `version`.
- [ADR-0079](0079-one-contract-module-declares-the-commands-and-the-exit-classes.md): the contract module.

## Supersedes

Only these clauses change. The accepted records keep their historical text and evidence.

- [ADR-0042](0042-one-celetis-program-for-both-hosts.md):
  - In "Two deliveries of one repository", "in two forms at one revision". The two forms can be at different
    revisions when their contract versions match.
  - In "The update", the stop on parts that do not name one source, one ref, and one target revision, and the
    stderr line for a host plugin at another revision than the program.
  - "The runner check", the comparison of the installed revision of the plugin with the revision of the program.
- [ADR-0085](0085-the-plugin-lives-in-plugins-celetis.md):
  - Decision 4, "`codexSessionPin` uses this witness." The Codex session pin reads no Git witness. `celetis update`
    keeps the witness through `codexRevision`.
  - Decision 6, "`assist` and `intake` call `requireSameRevision` before they start the host, as a step does."
    `assist` and `intake` call `requireContract` before they start the host, as a step does.
  - "Consequences", "`assist` and `intake` refuse more often. A plugin at another revision stops them with the line
    of `requireSameRevision`, as it stops a step." `assist` and `intake` stop on the contract mismatch line of
    `requireContract`, as a step does.
- [ADR-0088](0088-one-adapter-for-each-host-holds-the-host-differences.md), decision 3: "its undo in
  `requireSameRevision`". After #262, `bindUpdateHome` runs only in the `--inspect` child of the updater, and
  nothing undoes it.

## Context

At `81c126e`, one rule held the program `celetis` and the plugin `celetis` of a host together: Git revision
equality. `requireSameRevision` refused a step session when the installed plugin was at another revision than the
program. Its three callers were the step start of `engine/lib/run-engine.ts`, `engine/assist.ts`, and
`engine/intake.ts`. It read the plugin through `installation()`, which needs a Git marketplace source and binds the
host home in `process.env`, so `requireSameRevision` also had to undo that binding (ADR-0088, decision 3).
`discoverUpdate` refused an update whose parts did not name one source, one ref, and one target revision. No
manifest has a `version`, and the repository has no tags.

So a change of skill text alone forced a program update, and the reverse. And #251 could not publish the plugin and
the program as two artifacts. A plugin from a source that is not Git could not start a step.

## Constraints and evidence

- No manifest field carries the version (ADR-0012). Claude Code pins a plugin to a string `version` until the string
  changes, and it computes its own version for the cache folder. Codex names its cache folder by the version
  (External facts of the spec).
- `plugins/celetis/` holds no TypeScript. `celetis update` runs no code of a target revision, so it needs data that
  `git cat-file blob` reads.
- CI checks out with depth 1, so the gate cannot compare a tree with its history.
- Prior art: HashiCorp go-plugin (`VersionedPlugins map[int]PluginSet`) accepts a plugin only when the integer of
  the plugin is in the set of the host, and fails with both versions. The marketplace of VS Code offers an
  extension only to hosts that match it.
- Risk 2 of the spec: a fetch of one commit by its SHA needs support of the Git server. The plan session fetched by
  revision from GitHub with temporary data and it worked. Another server gives an `error` part and no change.

## Decision

1. **Two files, fixed paths and shapes.** `plugins/celetis/contract.json` holds `{ "contract": 1 }`, the one integer
   that the plugin needs. `engine/lib/contract-versions.json` holds
   `{ "serves": [{ "contract": 1, "digest": "<64 lowercase hex>" }] }`, the versions that the program serves and
   the digest of each. A running updater at one revision reads both at another revision, so neither path nor shape
   changes, and neither file has a field for its own format version. A change of a path or a shape is a contract
   change. A plugin with no valid `contract.json`, or a program tree with no valid served set, is a mismatch.
   No default version exists.
2. **The check of the runner.** `requireContract` of `engine/lib/contract-check.ts` replaces
   `requireSameRevision` at the step start, `assist`, and `intake`. It finds the plugin folder with `installedRoot`
   of `engine/lib/plugin-metadata.ts`, reads `contract.json`, and accepts the plugin when the program serves its
   version. On a mismatch it starts no session, writes no session record, and exits 3 with one line that names the
   host, both versions, and `run celetis update, then start the daemon again`. An unreadable file exits 6. The
   check reads no Git source. It adds only the host lookup that finds the folder to the folder read, and that lookup
   keeps its refusals, such as a plugin that is not installed, is disabled, or is ambiguous. `run resume` has no
   check.
3. **The update.** Each part goes to the target of its own source and ref. Before the question and before the
   offer of the board, the update reads `contract.json` at the target of each plugin and the served set at the
   target of the program, each by one shallow fetch of the source and revision into a temporary folder and
   `git cat-file blob`. A part at its target uses the file of its installed folder. A plugin target whose version
   the program target does not serve, or a missing or invalid file, stops the update with no change (exit 3); a
   failed fetch makes the part an `error` part (exit 6). `update check` prints the stop lines on stderr after the
   JSON. The apply order (Claude Code, Codex, program) and the incomplete result stay. The final validation reads
   the served set from the installed program folder on disk, not from the module that the running updater
   imported. There is no rollback.
4. **The offer.** The offer keeps one `target`, the target of the program. Each part keeps its own target in
   `parts`. The validators of `engine/board/update-worker.ts` require that each plugin target is a full revision and
   that the offer target equals the target of the program part. The board looks the same.
5. **The gate.** The gate refuses a tree whose plugin needs a version that its program does not serve. It computes
   `contractDigest` of `scripts/verify.ts` from the declarations of `engine/lib/contract.ts` that a machine or the
   plugin text reads: the exit classes, the labels, the issue headings, the markers, the state keys, the dispatch
   statuses, the printed line forms, the step header (`stepHeader` moved from `engine/lib/session.ts` into the
   contract module for this), the commands with their forms and flags, the launcher forms, the acts, and the usage
   text. The prose fields (`description`, `help`, `meaning`, `prerequisite`, `writes`) are not in it. The digest of
   the newest served version must equal the computed one, else the gate prints the raise line with the new digest.
   The gate compares only within the tree. To pass with an unchanged version, a person must overwrite a recorded
   digest, and that edit shows in the diff. At each raise the maintainer chooses whether the old version stays
   served, so the plugin text of that version still runs, or goes.
6. **The program and the plugin can sit at different revisions** while their contract versions match. One source and
   one ref for all parts stays the usual setup. `plugins/celetis/README.md`, "Updates", says how to set one
   compatible source and ref after a stop.
7. **The runner check reads no Git source and no Git witness.** These reads leave the step start, and
   `celetis update` keeps them:
   - The Git source of the plugin. For Claude Code, that is the configured source of the policy files, which must be
     a Git source, the record of `installed_plugins.json`, and the registered source, which must equal the
     configured source. For Codex, it is the rule that the marketplace source is Git, and the effective source of
     `config/read`, which must equal the installed source.
   - The Git witness of the package: its revision, its clean state, and its remote. For Codex, the witness also
     includes the bytes of the cache, through `codexRevision`.

   Their refusals leave the step start: a source that is not Git, a registered source of Claude Code or an
   effective source of Codex that differs, and a package with local changes. The Codex host lookup still requires
   the source type `git` or `local`, and it still refuses a record whose source differs from the native marketplace
   list. The update-policy check of each start stays as before: `requireUpdatePolicy` reads the Claude policy
   files and refuses a policy conflict before a step, a resume, `assist`, or `intake` starts the host. The host
   lookup of `installedRoot` keeps its read of the native plugin list. For Codex, that lookup and the session pin
   also keep their reads of the marketplace list and the catalogs.

## Alternatives considered

- **B, a semver range of program versions** (VS Code). It needs release versions of the program, which are #251 and
  not now.
- **C, version negotiation** (the Model Context Protocol). Negotiation helps when both sides can adapt at run time.
  Skill text is written against one contract and cannot adapt, so C adds a protocol and changes no outcome.
- **The `version` field of a manifest.** On Claude Code it pins users to a copy until the string changes, and
  Codex names its cache folder by it (ADR-0012).
- **The `metadata` field of Claude Code.** Claude Code does not read it, and Codex would need a second copy of the
  declaration. One file serves both hosts, because both ship the plugin folder.

## Consequences

The program and the plugin move independently. An update never stops on a mismatch after it changed a part,
because it checks the pair of the targets first. After a failed apply, the runner check refuses a mismatched
pair. A plugin that the program does not serve stops each new step with a line that names both versions.

The limits below come from the gate-case probe of Task 1 of the plan, run on copies of the tree at the landing (a
case a to h, and the two reorder cases that Task 4 added). Each states the observed result only.

- A prose edit forces no raise. An edit of the `description` text of the entry `root` and of the `meaning` text
  of the exit class `done` of `engine/lib/contract.ts` passed the gate with no change of the served set (case d,
  and a full gate run of that copy gave `verify: PASS`).
- A reorder of two entries of `commands` forces no raise (the reorder case for `intake` and `assist`: no
  line), because the digest sorts the entries. A reorder of two entries of `labels` forces a raise (the reorder case
  for `bug` and `enhancement`: the raise line).
- The digest has known gaps (Decision 2 of the plan). A change in these places can pass the gate with no raise:
  the JSON of `celetis config`, whose shape is the config schema of `engine/lib/config-core.ts`, a type that the
  gate cannot digest; the JSON of `lesson-store`; and the lines that commands print outside
  `engine/lib/contract.ts` (for example the `worktree:` recovery line that
  `plugins/celetis/docs/procedures/worktree.md` names). The facts block of the hook is no gap: `scripts/build.ts`
  writes it into `plugins/celetis/hooks/entry.js`, so it ships with the plugin text, and it calls no program
  command. No runtime check covers these gaps.
- A plugin from a marketplace whose source is not Git, such as a local Codex marketplace, and a package with local
  changes, start a step. The runner no longer reads the Git source or the Git witness (Decision 7).
- The board dialog shows the target of the program for the offer. When only a plugin differs, the dialog shows the
  program target, which equals its installed revision, next to the plugin rows. A dialog that shows a target for
  each part waits for #251.
- A host that updates its plugin by itself to a version that the program does not serve stops each new step until
  `celetis update` and a restart of the daemon.

## Reconsider when

- #251 publishes release versions of the program and the plugin, so that a version range can replace the integer
  set.
- A host offers a manifest field that pins nothing and that both hosts read.
