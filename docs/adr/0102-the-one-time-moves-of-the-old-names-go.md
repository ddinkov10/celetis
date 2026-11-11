# The one-time moves of the old names go

## Date

2026-11-11

## Related

- [Issue #275](https://github.com/ddinkov10/celetis/issues/275): the spec (the body of the issue) and the
  [plan comment](https://github.com/ddinkov10/celetis/issues/275#issuecomment-6800292234). In this record, "Approaches"
  and "Prior art" name parts of the spec. The plan comment holds the list of what stays and the scenarios of the build.
- [Issue #141](https://github.com/ddinkov10/celetis/issues/141): the rename that ADR-0075 records, and the moves of
  its old names.
- [Issue #99](https://github.com/ddinkov10/celetis/issues/99): the cleanup of the old launcher `scripts/celetis`.
  [Issue #293](https://github.com/ddinkov10/celetis/issues/293) merged it into #275.
- [ADR-0070](0070-automatic-runtime-state-migration.md): the conversion rule for runtime records. Its conversions of
  the session record and of the queue record from schema 1 to schema 2 stay. The conversion of the run record from
  schema 2 to schema 3 (#290, ADR-0099) stays too.
- Records that hold an old name and stay unchanged:
  - [ADR-0017](0017-setup-writes-the-wiring-of-a-product-project.md), "A record holds the ownership": it names the
    record path of its time. The current path is the one that ADR-0075 gives.
  - [ADR-0018](0018-setup-proposes-and-tests-the-worktree-setup.md), "The marker means that a script ran": it names
    the marker of its time. Its marker rule stays: the marker is written only after a script that is not empty ran.
  - [ADR-0030](0030-the-installed-plugin-owns-the-entrypoint.md), "Existing launchers … need a reviewed manual
    cutover": [ADR-0031](0031-plugin-development-is-independent-of-adoption.md) already replaced its product-cutover
    prescriptions.
  - [ADR-0052](0052-setup-owns-required-configuration-and-host-wiring.md), "Old wiring is report-only … remaining
    callers", and [ADR-0061](0061-setup-owns-a-marked-instruction-block.md), "Old generic flow text outside the
    markers …": [ADR-0071](0071-setup-reconciles-recorded-owned-wiring.md) already replaced both.
  - The old names in the other records are names of their time (ADR-0075, "Consequences").
- `engine/lib/state.ts`, `engine/lib/worktree.ts`, `engine/lib/quota-recovery.ts`, `engine/lib/run-record.ts`,
  `engine/lib/setup-record.ts`, `engine/setup.ts`, and `plugins/celetis/docs/setup.md`, "Review old wiring".

## Supersedes

Only these clauses change. The accepted records keep their historical text and evidence.

- [The names of the workflow, the daemon, and a run](0075-the-names-of-the-workflow-the-daemon-and-a-run.md), in part:
  - In "Decision": "One move at the first access" and "The refusals", whole.
  - In "Decision", "The conversions": the conversion of the recovery record from schema 1; the conversion of the run
    records "with their stored paths under the new folder", and the refusal of a path outside both folders; "Setup
    moves the setup record at its next run"; and "the first read of the marker of a worktree renames the old marker".
    The archive rule for a converted record (the exact original bytes go to an immutable sibling archive) and "The
    queue and session records keep their schemas" stay.
  - In "Decision": "The update needs a quiet machine", whole.
  - In "Alternatives considered": the rejection of "Start empty under the new names", for a repository that has not
    moved.
  - In "Consequences": the bullets "One update needs a stopped daemon …", "A hook settings file …", and "The move code
    stays in the program until #275 removes it …".
- [Setup reconciles recorded owned wiring](0071-setup-reconciles-recorded-owned-wiring.md), in part:
  - In "Decision": "including a recorded launcher". A setup record that claims `scripts/celetis` is refused. The
    removal of a removed host's dedicated integration stays.
  - In "Decision": "and surviving tracked launcher callers", the sentence "Literal search cannot establish dynamic or
    external references.", and "caller or" in "An unresolved caller or collision prevents a current-wiring claim".
  - In "Consequences": "Surviving callers" in "Surviving callers and effective native policy remain explicit limits".
- [Setup edits JSON in place in the common layout](0098-setup-edits-json-in-place-in-the-common-layout.md), in part:
  - In "Decision", item 2: the condition "no record is at `.claude/celetis-flow/wiring.json`".

## Context

ADR-0075 renamed the workflow, the daemon, and a run, and it kept the state of the products of that time with
one-time moves: the state folder and the lock refs, the worktree marker, the setup record, and the schema-1 records
(issue #141). The cleanup of the old launcher `scripts/celetis` (ADR-0030, issue #99) left a similar check in setup:
a search of the tracked callers, and two warnings. ADR-0075 says that the move code stays until #275 removes it.

The maintainer decided on 2026-11-11 that the window of the move has ended: "every new product will make brand new
setup" (the `## Human steps done` comment of
[#275](https://github.com/ddinkov10/celetis/issues/275#issuecomment-6793448693)). So the moves serve only old
products. The code costs reading time, and the caller search warns on each setup run about each tracked file that only
mentions `scripts/celetis`. In this repository that is 12 ADRs and three current files (spec, "Problem").

## Constraints and evidence

- Prior art (spec, "Prior art"): Django 5.2 deletes a squashed migration in a second release, "once you are sure all
  instances of the codebase have applied the migrations you squashed". The Kubernetes deprecation policy keeps the
  decoding of persisted data for good. The maintainer's decision and principles choose the Django order (spec,
  "Approaches").
- This repository has moved. The assistance comment of 2026-11-07
  ([#275](https://github.com/ddinkov10/celetis/issues/275#issuecomment-6711685492)) reads its state: the new state
  folder and the new lock refs, a run record of schema 2, no schema-1 recovery record, and the tracked wiring
  `.claude/celetis/wiring.json`. It also names what keeps an old name: the marker of the worktree of #26, and the
  tracked old wiring on the branches of #127, #241, and #26, which come from the time before #141.
- The setup record of this repository holds no removed claim (spec, "Old records with removed scopes", read on
  2026-11-11).

## Decision

1. **These moves go.** The move of the state folder and the lock refs. The rename of the old worktree marker. The move
   of the setup record. The conversions of the recovery record and the run record from schema 1. The caller search of
   setup, the launcher check, the `.gitattributes` check, and the two scopes of the old launcher in the setup record
   (the whole file `scripts/celetis` and the `.gitattributes` line). The old flow lines, with their flow scope of the
   setup record, the flow check of the report of old wiring, and the lines of the setup document. The maintainer
   decided their removal on 2026-11-11 in the specify session.
2. **Old state is not read, or it meets a refusal that exists today.**
   - Not read: the old state folder, the old lock refs, the old marker, and the old record file. A repository with
     only the old names starts with empty state, and a worktree with only the old marker reads as not set up. A project
     with only the old record reads as a project with no record, and setup writes a new one.
   - The existing refusals: a schema-1 recovery record (`invalid or obsolete recovery record`), a schema-1 run record
     (`the record has another schema`), and a setup record with a removed claim (`unsupported whole-file claim` or
     `unsupported entry`). No new refusal is special to old state.
3. **These stay.** The conversion of the run record from schema 2 to schema 3 (#290). The conversions of the session
   record and of the queue record from schema 1 to schema 2 (ADR-0070). `retireLines` for each recorded entry that
   setup no longer owns. In the report of old wiring, the check of the `permissions.allow` entries of the entrypoint
   and the check of `enabledPlugins.celetis@celetis`, with the allow item form of `engine/lib/setup-record.ts`. The
   line `docs/lessons/_pending/` of the scope of the setup record in `.gitignore`.
4. **No new compatibility path.** There is no alias, no fallback read, and no refusal that is special to old state.

## Alternatives considered

- **Keep the readers of old stored data for good** (approach 2 of the spec; the Kubernetes pattern). It serves a
  product that skipped the update of #141. It conflicts with the decision of the maintainer that the window ended, and
  with the principle to remove obsolete paths.
- **Replace the moves with a special refusal of old state** (approach 3). It tells an old product what to do, but it is
  a new compatibility path that stays in the code, against the same principles.

## Consequences

- The code and the documents of the engine no longer describe a move. Each setup run no longer warns about a file that
  only mentions `scripts/celetis`.
- An old daemon that still runs is not seen, because it locks under the old refs. So it must end before the update.
  Nothing refuses a new daemon beside an old daemon, because they lock under different refs. Both can take one issue.
- A product that skipped the update of #141 loses its quota waits, queue, run records, agent order, and usage records.
  Its setup record or its worktree marker reads as missing.
- In this repository, the next `worktree` run for #26 runs the worktree setup again, because only the old marker is
  there. A merge of an old branch of #127, #241, or #26 brings the old record file back as an unowned file.
- A setup record with a removed claim refuses setup. Its owner repairs it by hand.

## Reconsider when

- A product must still move from the names before #141.
- The engine before this record still has the move, and a product needs it.
