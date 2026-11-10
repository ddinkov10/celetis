# The check for a removed version folder reads the engine entry

## Date

2026-11-10

## Related

- [Issue #281](https://github.com/ddinkov10/celetis/issues/281): the spec (body of the issue), and the
  [plan comment](https://github.com/ddinkov10/celetis/issues/281#issuecomment-6774245635). In this record, "the
  states table" and "the commands table" name the two tables of Task 2, step 1, of that plan, and "the prune
  table" names the table of Task 1, step 1. "Approaches" and "Risks" name parts of the spec.
- [ADR-0035](0035-the-board-is-a-part-of-the-engine.md): before Run and Resume, the board checked "that the
  entrypoint still exists". That was an earlier check of one entry path, in another component and with another
  line. Later records replaced parts of ADR-0035, and this record replaces none.
- [ADR-0090](0090-a-contract-version-replaces-the-same-revision-rule.md): it left "the three module lists" out of
  the contract version and named #281 for them.
- The lessons that bind the decision:
  [a-failed-process-read-is-not-an-exit](../lessons/a-failed-process-read-is-not-an-exit.md),
  [a-moved-check-keeps-the-states-of-its-old-rule](../lessons/a-moved-check-keeps-the-states-of-its-old-rule.md),
  [confirm-a-check-can-still-fail-after-its-input-moves](../lessons/confirm-a-check-can-still-fail-after-its-input-moves.md),
  [keep-each-effect-of-a-removed-helper-call](../lessons/keep-each-effect-of-a-removed-helper-call.md), and
  [return-the-safe-result-for-a-known-proof-blind-spot](../lessons/return-the-safe-result-for-a-known-proof-blind-spot.md).

## Supersedes

Only this clause changes. The accepted record keeps its historical text and evidence.

- [ADR-0042](0042-one-celetis-program-for-both-hosts.md), "The layout": "removes the staging folder of a stopped
  install". An install removes each entry of `versions/` whose name starts with a dot. Such an entry is the staging
  folder of a stopped install, or the renamed folder of a version folder that a stopped install began to remove
  (Decision, point 3). The rule of which version folders an install keeps does not change.

## Context

A later install can remove the version folder of an engine that still runs: a daemon, a run of the daemon, or a
`run` or `queue` command that loads its modules late. At `3244a06`, three hand-kept lists of module paths detected
that state: `required` in `engine/lib/run-engine.ts` (55 paths), and the lists of `engine/queue.ts` (48 paths) and
`engine/run.ts` (47 paths). Each new module needed a new list entry, and no check compared the lists with the
modules. The spec gives the evidence that the lists were not complete: a read of the relative imports of the engine
gave 80 files, and 26 of them were not in `required`.

The lists had two more defects. Each failed read of a listed path counted as "gone", so one failed read could stop
a live daemon. A daemon of a checkout that lacked a listed module also stopped. And the prune of an install deleted
a version folder in place, so a stopped delete left a part of a version folder at its path.

## Constraints and evidence

- No declaration of `engine/lib/contract.ts` changes. The removed lines of the daemon, of `run`, and of `queue`
  stay byte for byte, with exit 3.
- `engine/lib/installation.ts` is a trust file of the board. Only its prune loop changes.
- The repository keeps no tests (ADR-0029). The plan comment holds the probe tables and their base results.
- POSIX.1-2024: `rename()` changes the name of a file, and it can fail with `EBUSY` when the directory is in use
  "and the implementation considers this an error"
  (https://pubs.opengroup.org/onlinepubs/9799919799/functions/rename.html).
- An inference of the spec, not a quoted fact: a rename of a folder changes one directory entry, so each path below
  the old name stops to resolve in one step. On macOS with Bun 1.4.4, the build observed it twice: row 3 of the
  states table, and the check `the entry of r2 does not resolve` of the prune table, while the renamed folder still
  held files.
- On macOS with Bun 1.4.4, `stat` of `node:fs/promises` gives `ENOENT` for an absent path, `ENOTDIR` when `engine`
  is a file, `EACCES` when `engine/` has mode 000, and `ELOOP` when the entry is a symbolic link to itself (the plan
  comment, "External facts").
- Prior art (the spec): the Gradle daemon polls one file and stops when it does not find its own entry there. The
  Bazel garbage collector renames a stale install base before it deletes the folder.

## Decision

1. **The identity.** The check for a removed version folder reads the entry of the engine,
   `<version folder>/engine/celetis`, once. `versionFolderGone(root)` of `engine/lib/version-folder.ts` holds the
   read. The module imports only `node:fs/promises` and `node:path`. No list of module paths stays in `engine/`
   for this check, also not a generated list.
2. **The result.** The result is "gone" only for a definite absence. Each other failed read stops nothing, and the
   next read decides.

   | The read of the entry | The result |
   | --- | --- |
   | A regular file | Not gone |
   | The error code `ENOENT` or `ENOTDIR` | Gone |
   | A path that is there and is not a regular file | Gone |
   | Each other error | Not gone |

   The read uses `stat`, not `lstat`. `stat` follows a symbolic link, so an entry that is a link to a regular file
   stays "not gone", as with the lists. For a link to itself, `stat` gives `ELOOP`, an error that is not an absence.
3. **The prune.** The prune loop of `installEngine` renames `versions/<revision>` to
   `versions/.<revision>.<uuid>`, and then deletes the renamed folder. A version folder is then complete or absent
   after each prune of this engine, also a stopped one, and the one-path read depends on that. The loop at the
   start of each install deletes each entry of `versions/` whose name starts with a dot. A rename that fails is an
   error of the install. No fallback deletes in place.
4. **The call sites.** Seven sites call the one function, and each keeps its act after a "gone" result, its line,
   and its exit 3:
   - `begin` of `engine/lib/run-engine.ts`: the step-end watcher (`endWhenDone`), the step loop, and the preflight
     of a step start. Each calls `removal()`, which calls `hooks.removed()`. The step loop and the preflight then
     end the run as `stopped` with the text of `removed`.
   - `autoLoop` of `engine/lib/run-engine.ts`: it calls `hooks.removed()` and ends.
   - `serve` of `engine/lib/daemon-server.ts`: the poll each 5 seconds stops the daemon with its removed line.
   - `main` of `engine/run.ts` and `main` of `engine/queue.ts`: each makes the read before its first `import()`
     call. A wrong form still gives the usage line and exit 2 before the removed line.

## Alternatives considered

- **A compare of the Git revision** (Approaches, 2). It starts one `git` process each 5 seconds in the daemon. It
  passes a folder that is deleted in part while its `.git` is complete. A daemon of a checkout would stop after
  each commit.
- **Git as the file list** (Approaches, 3). `git status` sees a folder that is deleted in part, with no change of
  the installer. It starts one process each 5 seconds in the daemon and one in each `run` and `queue`, and a
  daemon of a checkout needs a separate rule, because its tree is dirty by design.
- **The entry with no change of the prune.** A folder that a prune deletes in part can pass the check, also for
  all time after a stopped delete. The lists caught a part of these states, so this is a step back.
- **A list that `scripts/build.ts` generates, or the module registry of the runtime.** Each is a list of module
  paths, which the issue excludes.
- **A lock on a version folder in use** (the other part of the Bazel pattern). It changes which folders an install
  keeps. A separate issue can hold it.

## Consequences

- A new module needs no list entry.
- A daemon of a checkout does not stop when a module of the old lists is absent (rows 5 and 6 of the states table:
  "gone" on the base, "not gone" after the change).
- A read that fails with `EACCES` or `ELOOP` stops nothing (rows 8 and 9 of the states table, and the state
  "entry loop" of the commands table). The cost: a read that fails for all time gives no stop, and the next load or
  child start fails with its own error.
- **A prune by an engine older than this change deletes in place.** The code of the prune is the engine that runs
  the install. On `3244a06`, the probe of the prune table gave `prune: FAIL 4`: after a stopped delete,
  `versions/r2` stayed with its entry, and the next install removed `r3` and kept the part of `r2`. Such a folder
  passes the read. The maintainer accepted this limit with the pick of the approach (Risks, 1).
- **A delete that cannot end blocks each later install.** When the delete of a renamed folder fails and its cause
  stays, the folder `versions/.<revision>.<uuid>` stays. Each later install then fails in its start loop, before the
  clone and before the switch of the engine, until a person removes the folder. The engine that was current stays
  current, and the error names the folder. On `3244a06` in the same state, a later install switched the engine and
  kept the part of the old folder. The probe of the
  [final review record](https://github.com/ddinkov10/celetis/issues/281#issuecomment-6774848597) shows both
  results. The start loop had this property for a staging folder before this change.
- Damage by hand is not seen: a deleted module with the entry present reads as "not gone" (rows 5 to 7 of the
  states table). The lists saw it only for a listed path.
- The time between the check and the use stays, as before: a folder that goes after a read and before a load or a
  child start gives the error of that load or start (Risks, 2). No probe covers it.
- Windows is not verified. A rename of a folder can fail there when a process holds a file of the folder open. By
  the code of point 3, such a failure is an error of the install after the switch of the engine, and the old
  version folder stays whole. No daemon runs on Windows.
- The probes ran on macOS only.

## Reconsider when

- A release channel (#251) installs the engine in another form than a Git clone of a version folder.
- A rule keeps the version folder of a live daemon, for example a lock or a lease.
