# The engine library and the board group their files into feature folders

## Date

2026-11-19

## Related

- [Issue #340](https://github.com/ddinkov10/celetis/issues/340): the spec (the body of the issue, `Spec: 2026-11-19`),
  with the map of each move, the prior art, and the decisions of the maintainer of 2026-11-18. "The map" in this
  record is the map of that spec.
- [The plan of #340](https://github.com/ddinkov10/celetis/issues/340#issuecomment-7015663543): the two placements of
  files that landed after the spec, the byte probe, and the Verify scenarios.
- [ADR-0095](0095-the-shared-agent-text-lives-in-references.md): the folder layout rule of `plugins/celetis/`, moved
  by a script. This record applies the same method to code with imports.
- [ADR-0091](0091-the-engine-is-one-name-and-the-folder-engine.md), decision 4: an installation of the old layout gets
  no compatibility path. This record keeps that rule for the update across this change.
- `checkLayout` and `checkImports` of `scripts/verify.ts`, `servedContractsFile` of `engine/lib/contract/contract.ts`,
  and `AGENTS.md`, "The engine layout".
- The lessons `.celetis/lessons/move-code-by-byte-copy-and-compare-each-moved-body.md` and
  `.celetis/lessons/confirm-a-check-can-still-fail-after-its-input-moves.md`.
- Each record that names an old path only as the code site of a rule that stays keeps that path as history, with no
  clause superseded. Examples: the run modules of ADR-0103, the host adapters of ADR-0088, the program entry of
  ADR-0083, and the Windows module of ADR-0034.

## Supersedes

Only these clauses change. The records keep their historical text, and the lessons keep the old paths.

- [The board is a package of its own](0009-the-board-is-a-package-of-its-own.md), in part: the decision of the plan
  "The layout of the package is flat. Each file of the board stays at the root". The chat files and the update files
  of the board now have folders (`engine/board/chat/`, `engine/board/update/`), and the theme files of the page have
  `engine/board/page/theme/`. Each other board file stays at its path.
- [The board is a part of the plugin](0020-the-board-is-a-part-of-the-plugin.md), in part: in "Decision", the words
  "in the flat layout of ADR-0009".
- [The board is a part of the engine](0035-the-board-is-a-part-of-the-engine.md), in part: in "Supersedes", the words
  "the flat layout" of the parts that stay, and "The flat layout stays, now in `engine/board/`."
- [The resolver and the updater are libraries](0081-the-resolver-and-the-updater-are-libraries-and-no-library-imports-a-command.md),
  in part: the paths of decisions 1 to 3. The resolver is `engine/lib/resolver/resolver.ts`, its node-free types are
  `engine/lib/resolver/types.ts`, and the updater is `engine/lib/update/updater.ts`. Each is still a library, and
  decision 4 holds.
- [The board reads engine state through one read model](0087-the-board-reads-engine-state-through-one-read-model.md),
  in part: the paths of decisions 1, 3, and 5. The read port is `engine/lib/board-read/board-read.ts`, its node-free
  types are `engine/lib/board-read/types.ts`, and the field module is `engine/lib/state/fields.ts`. The check of
  decision 5 refuses a value import of `engine/lib/{resolver/resolver,tracker/tracker,command/operation,
  run/quota-recovery,agent/usage,run/step-end,tracker/refresh-hints,process/git,workflow/workflow}.ts`, and its
  message is `<file>:<line>: A read-side board module reads engine state through engine/lib/board-read/board-read.ts,
  not engine/lib/<folder>/<name>.ts (ADR-0087).` The rule of each decision holds.
- [A contract version replaces the same-revision rule](0090-a-contract-version-replaces-the-same-revision-rule.md), in
  part: in decision 1, the path `engine/lib/contract-versions.json`, the words "so neither path nor shape changes",
  and "A change of a path or a shape is a contract change", for this one move. The served versions are in
  `engine/lib/contract/versions.json`, with the same shape and the same versions. The contract version does not
  change. An engine from before the change cannot update across it (decision 4 below).

## Context

`engine/lib/` held 85 TypeScript files and one JSON file in one flat folder, and two more files landed while the spec
was written. Related files shared a hyphenated name prefix instead of a folder: `daemon-client.ts`,
`daemon-server.ts`, `daemon-types.ts`; `host-claude.ts`, `host-codex.ts`; `run-activities.ts`, `run-machine.ts`; and
more. `engine/board/` and `engine/board/page/` had three smaller groups of the same kind. The maintainer asked for
"proper folders not 'something-something' like now in flat folders", for the long term.

## Constraints and evidence

- The command scripts `engine/<command>.ts` keep their names: the contract maps each command to its file, and the
  lock owner check matches `daemon.ts` in a command line (`AGENTS.md`, "Traps").
- A running updater reads `servedContractsFile` at the target revision of the engine with `git ls-tree`. A missing
  path gives no served set, and `pairLines` of the updater then prints `update: the engine at <short target> declares
  no served contract versions; nothing changed; set one compatible source and ref for the parts
  (plugins/celetis/README.md, "Updates")`. `celetis update` then exits 3 before its question, and `update check`
  prints the line on stderr. `contractDigest` of `scripts/verify.ts` does not read the path, so the path needs no
  new contract version.
- A check of the build installed the engine at the base into a temporary `CELETIS_HOME` from a local source, then
  moved the branch of the source to the lane commit. At the lane commit, `git ls-tree` gives nothing for
  `engine/lib/contract-versions.json`, and the same blob at `engine/lib/contract/versions.json`. Claude Code
  2.1.328 refused the plugin install from that local source in a temporary configuration ("Invalid marketplace
  source format"), so the check had no host with Celetis. `update check` and `update` then stopped at the earlier
  stop `update: no host has Celetis installed; …`, the update exited 3, and the installation did not change. The
  served-version line is traced from the code, not observed. A first install from a clone at the lane commit
  exited 0, and `celetis --version` printed the lane commit.
- A probe of the build compared each moved file with its source after only the wiring edits: the relative
  specifiers, the repository path literals, the six `import.meta.dir` roots, the three other depth sites, the
  `engineState` set of `checkImports`, and the Biome format of the result. A changed byte in a body, in one copy of a
  repeated line, and in a one-line declaration each failed the probe.
- The first run of the import rewrite also changed the template text `from './launcher.ts'` in `engineEntry` of the
  process module, which is no import. The gate passed, and `scripts/build.ts` wrote an entry `engine/celetis` that
  could not start. So the rewrite changes only a specifier that names a tracked file.
- Biome sorts each import block, so the bundle of the native hook (`plugins/celetis/hooks/entry.js`) holds the same
  modules in another order. A top-level statement of each reordered module writes only values of its own module. `engine/board/board.js` and
  `engine/board/theme.js` keep their code.
- The include `"*.ts"` of `engine/board/page/tsconfig.json` reads no file of a subfolder (TypeScript 7.0.2, the pin),
  so the strict browser check needs `"**/*.ts"` for `theme/`.

## Decision

1. **The layout rule.**
   1. `engine/lib/` holds only feature folders and `vendor/`. No file sits directly in `engine/lib/`.
   2. A feature folder is named by a noun of the engine: its documents, its commands, or the old name prefix. No
      folder is named by the kind of code (`types/`, `utils/`, `helpers/`, `common/`, `shared/`).
   3. A folder nests at most one more level, for a sub-feature of two or more files, or for one member of a set of
      peers (`host/claude/`, `host/codex/`, `host/opencode/`).
   4. The head file of a folder has the name of the folder (`queue/queue.ts`). A moved file drops the prefix that its
      folder states; a file gets another new name only where this leaves a clash (`usage-types.ts` became
      `host/usage.ts`, and each host file became `host/<host>/adapter.ts`).
   5. No folder of `engine/lib/`, `engine/board/`, or `engine/board/page/`, at any depth, holds two `.ts` files that
      share a hyphenated first word (`x-a.ts` and `x-b.ts`), or `x.ts` and `x-a.ts`. The rule covers `.ts` files only.
   6. No barrel file (`index.ts`, `mod.ts`): each import names the real file.
2. **The map.** Each file moves by the map of #340, with two placements of the plan: `attempt-end.ts` goes to `run/`,
   and `trends.ts` goes to `board-read/`. `stop-dialog.ts` and `update-dialog.ts` of the page stay: they share a last
   word, and a `dialog/` folder is a folder by kind. The code in each file does not change, except its wiring.
3. **The check.** `checkLayout` of `scripts/verify.ts` refuses each tracked file directly in `engine/lib/` (rule 1),
   and each group of tracked `.ts` files in one folder of `engine/lib/` or `engine/board/`, outside
   `engine/lib/vendor/`, that breaks rule 5. Each line names the files, the rule, and this record. Rules 2, 3, 4, and
   6 have no check; `AGENTS.md`, "The engine layout", states them for a new file.
4. **The update across the change.** By the code of its updater, an engine from before this change stops
   `celetis update` with the served-version line, exit 3, and no change. One run of "First install" (`plugins/celetis/README.md`) crosses the change. The
   engine adds no compatibility path, as ADR-0091 decision 4 and the rule "do not preserve backward compatibility"
   say.

## Constitution

Read: `CONSTITUTION.md`, amended 2026-11-12.

- Hard limits and non-goals: none touched. No agent approves an update; the maintainer runs the first install.

## Alternatives considered

- **The head file is `mod.ts`** (the Deno style guide). Shorter paths, but the main file of each of about 30 folders
  loses its name in editor tabs, stack traces, and search results, and the pattern assumes an entry file that only
  re-exports, which the engine does not have.
- **The head file beside its folder** (Node.js `lib/internal/`, Rust modules). Fewer moves, but each module stays in
  two places, which is the problem of the request. Rust maps module paths to files, and Node.js keeps public paths
  stable; neither reason applies here.
- **The flat folder with name prefixes** (the TypeScript compiler). This is the old state, and the request rejects it.
- **Clean Architecture rings with an inward dependency check.** A new architecture, and each file needs a ring. The
  maintainer picked a tidy tree of features instead.
- **A split of the large files** (Clean Code inside the files, for example `run/activities.ts`). It changes code, so a
  byte comparison cannot prove it. It is a separate issue.
- **A compatibility copy of `contract-versions.json` at the old path.** An old engine could then update, but the
  maintainer's rule forbids a compatibility path, and the cost is one first install for each installation.

## Consequences

- A reader finds, moves, or reviews one feature as one folder. The head file of each folder is easy to find, and a
  short name such as `types.ts` or `adapter.ts` repeats in different folders, as in VS Code and Next.js.
- The gate keeps rules 1 and 5 true for later files. A legitimate later pair gets a folder: the rule has no
  exemption list.
- Each installed engine needs one first install. Until then, `celetis update` stops with no change.
- Paths are longer, and a lane in flight that edits a moved file gets a conflict at its worktree entry when Git does
  not carry the edit through its rename detection.
- The earlier records and the lessons name the old paths as history. A reader maps them to the new paths with the
  map of #340.

## Reconsider when

- A folder holds so many files that a reader cannot navigate it: split it again, by the same rule.
- The engine gets a public import path that other programs use, so that a moved path breaks a caller outside this
  repository.
- The updater learns to read the served versions from more than one path, or the served versions move into the
  contract digest.
