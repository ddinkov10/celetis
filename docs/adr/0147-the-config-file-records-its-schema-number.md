# The config file records its schema number

## Date

2026-11-26

## Related

- [Issue #379](https://github.com/ddinkov10/celetis/issues/379): the spec (the body of the issue, `Spec: 2026-11-26`), and the
  [plan comment](https://github.com/ddinkov10/celetis/issues/379#issuecomment-7200949100). In this record, "R1", "R2", and
  "R3" name parts of "Design" of the spec, and "Task N" names a task of the plan.
- [ADR-0015](0015-one-repository-yaml-config.md): its Decision lists the root fields of the schema at its date. `schema`
  is now a required root field. The list stays a list of its date, and the rule "Reject invalid supplied config rather
  than substitute defaults" stays.
- [ADR-0090](0090-a-contract-version-replaces-the-same-revision-rule.md): the manner of the digest. The gate of this
  record follows it. Each clause of that record stays, also its known gap for the JSON of `celetis config`: the contract
  digest still covers no config field (Decision 6).
- [ADR-0024](0024-the-config-read-runs-on-bun.md) and [ADR-0047](0047-skills-load-shared-procedures-on-demand.md): the
  forms `celetis: <file>: <field>: <message>` and `Celetis entry stopped: <path> <field>: <message>`. A schema line is
  such a line with the field `schema`, so both forms stay. The sentence of ADR-0047 "a changed stat or no result stops
  the entry" also stays true for the config. At a stop on a newer `schema`, the hook reuses the cached newer-schema result
  when the native `Read` of `.celetis.yaml` gives `file_unchanged`, and the check of Decision 4 adds to it and runs again
  at each entry.
- [ADR-0127](0127-the-gates-are-keyed-by-lane.md) and [ADR-0134](0134-the-update-pins-the-claude-marketplace-clone.md):
  the two records of a reader that refused `gates.feature` as `unknown field`. Their text is history and stays.
- [ADR-0031](0031-plugin-development-is-independent-of-adoption.md): each product maintainer owns adoption, so this
  record names no step of a product project.
- [ADR-0066](0066-one-shared-event-record-with-a-lock.md): the event record. This change keeps its format.

## Supersedes

Only these clauses change. The accepted records keep their historical text and evidence.

- [ADR-0017](0017-setup-writes-the-wiring-of-a-product-project.md), in "Setup writes the current config":
  - "Setup owns two entries in it, `host` and `landing`": setup writes `schema`, `tracker`, `landing`, and, with the
    landing `merge`, `suite`. The entry of `schema` in the record is `{"path": ["schema"]}`.
  - "A new file holds `host` before `landing`.": a new file holds `schema` first, then `tracker`, `landing`, and `suite`
    with `merge`.
- [ADR-0018](0018-setup-proposes-and-tests-the-worktree-setup.md), in "Decision": "A new `.celetis.yaml` holds `host`,
  `landing`, and then the block." A new file holds `schema` first, then `tracker`, `landing`, and `suite` with `merge`,
  and then the reference.
- [ADR-0047](0047-skills-load-shared-procedures-on-demand.md), in "Entry is a facts block": "makes its permission-checked
  `Read` of the Git boundary and of `.celetis.yaml`". At a stop on a newer `schema`, the hook also reads the install
  record of Claude Code and `config-schema.json` of an installed copy.
- [ADR-0126](0126-a-local-tracker-in-the-git-bug-format.md), in "Consequences", the bullet on `setup status`: the line
  "no file; setup writes tracker, landing, and suite with merge" now reads `no file; setup writes schema, tracker,
  landing, and suite with merge`.

## Context

A reader of `.celetis.yaml` knew only its own accepted set of fields. A file that a newer engine accepted, for example
one with `gates.feature` (ADR-0127), gave an older reader the line `<field>: unknown field`. That line is ambiguous: it
can be a typo or an old install. On 2026-11-23, one `celetis:intake` entry stopped with `gates.feature: unknown field`,
and the work went on only after `/reload-plugins`. The spec infers that the session had loaded an older plugin copy than the installed one.
The entry hook bundles `engine/lib/config/core.ts`, so each plugin copy refuses the fields that a newer schema adds, and
Claude Code changes the plugin set of a running session only at its start or at `/reload-plugins`.

The board repeated a failed check. `schedule` of `engine/board/update/updates.ts` started an automatic update check each
600000 ms. Each failed `update --inspect` child of a check wrote one refusal event, so an unchanged failure wrote events
each 10 minutes while the board ran. The board also hid the cause: it showed one fallback line, and not the line and the
act of each failed part.

## Constraints and evidence

- The native hook API gives the hook only `plugin.root` and the native reads (`engine/hooks/native-host.d.ts`): no
  environment, and no `realpath`. The hook stays inside its read budget and uses its permission-checked reads.
- `engine/lib/config/core.ts` has no `node:` import and no `Bun` global, because the hook bundles it.
- Claude Code loads the plugin set of a running session at its start or at the last `/reload-plugins`, and
  `installed_plugins.json` records each install with its `scope`, `installPath`, and `version`
  (https://code.claude.com/docs/en/plugins/loading.md).
- Prior art, read on 2026-11-26. Terraform `required_version`, Cargo `rust-version`, and `engines` of Claude Code plugins:
  an older tool gets an error up front that names the version that it needs, and takes no action
  (https://developer.hashicorp.com/terraform/language/block/terraform,
  https://doc.rust-lang.org/cargo/reference/rust-version.html, https://code.claude.com/docs/en/plugins-reference).
  VS Code `abstractUpdateService`: a scheduled check that fails schedules no further automatic check, and the next check
  comes from a new trigger
  (https://raw.githubusercontent.com/microsoft/vscode/main/src/vs/platform/update/electron-main/abstractUpdateService.ts).
- The record of the Windows machine, 2026-11-04 to 2026-11-23, had 234 refusals of `update` in 594 events. The counts are
  rough, because the record is unfiltered and holds test runs and old versions. The causes of the Codex cache mismatch
  and of the failures of `claude plugin list --json` on that machine are not known, and this record does not fix them.
- When this record was written, it was not known whether a native `Read` of a file outside the project runs with no
  prompt. The hook gives the act of an old reader and says that it could not check when a read is denied, prompts, or
  fails.
- The maintainer picked the two approaches in the session of 2026-11-26: stop the automatic board check after a failure
  (1A), and a schema number in the file (2B).

## Decision

1. **The schema number.** `configSchema` of `engine/lib/config/core.ts` is one integer, M. Its first value is 1. The
   hook bundle carries it, and `scripts/build.ts` writes it to `plugins/celetis/config-schema.json` as
   `{ "schema": M }`, a plain file that the hook reads with no run of code. `.celetis.yaml` has a required root field
   `schema`: the schema number that the file was written for (N). The value must be a plain decimal integer from 1 to
   2^53 - 1. A quoted, float, `-0`, leading-zero, hexadecimal, or empty value gives `schema: need an integer`. A value out
   of range gives `schema: integer is out of range`. There is no default, no conversion of an older file, and no read of a
   file with no `schema`. A missing `schema` gives `schema: required field; add "schema: M" as a root field`.
2. **The read order and the two outcomes.** `validateConfig` reads `schema` before each other check, so a newer file never
   gets an `unknown field` line, also when it has another field error. The reader has two outcomes.
   - N above M: the reader refuses with one line,
     `schema: the file has schema N, and <reader> reads schema M; <act>`, and runs no other check.
   - N not above M: the reader validates with the rules of M, and a field error is a real error of the file. When N is
     below M, the line adds `; the file has schema N, and <reader> reads schema M` and names
     `plugins/celetis/docs/configuration.md`, "Schema versions", where the row of N says how to change the file.
3. **The act of each reader.** The reader is `the engine <first 12 characters of its revision>`, or
   `the engine at <engine root>` when the revision cannot be read.

   | Reader | Act in the line |
   | --- | --- |
   | An engine command (`config`, `worktree`, `setup`, `land`, and the others) | `run celetis update` |
   | The daemon | `run celetis update, then restart the daemon` |
   | `config` with `--agent codex` | `run celetis update, then start a new Codex session` |
   | The entry hook of Claude Code | by the check of item 4 |

   `setup status` reports a newer file as `invalid` with the schema line, and adds no hand repair.
4. **The stale-session check of the hook.** The hook names the plugin copy that it loaded: `the plugin copy <plugin.root>`.
   Only at a stop on a newer `schema`, when `plugin.root` has the form `<config>/plugins/cache/<marketplace>/<plugin>/<version>`,
   it reads `<config>/plugins/installed_plugins.json` and `config-schema.json` of an installed copy, each with its own
   permission-checked `Read`. A record of `celetis@celetis` applies when its `scope` is `user` or its `projectPath` is the
   checkout. The paths compare with `/` separators and no final slash.
   - A record that names the loaded root: the session already runs the installed copy, so the copy is too old:
     `run celetis update, then /reload-plugins`.
   - A record that names another copy: `run /reload-plugins, or start a new session` when that copy reads the schema of
     the file or a newer one, else the update act. A copy with no `config-schema.json` is older than this record.
   - A root that is no copy of the plugin cache, a missing or malformed install record, no applicable record, a malformed
     `config-schema.json`, and a denied or failed read: the update act, then
     `the installed copy could not be checked: <cause>`. A missing `config-schema.json` of another copy is no such case: it
     gives the plain update act.
   `config-schema.json` holds exactly `{ "schema": <n> }`, and the check reads an older copy only in that form. So a
   later change of its form gives older sessions the act "could not be checked". This is the chosen limit: no reader of
   an older form.

   The entry stops in each case. The check runs again at each such entry, because the installed copy can change between
   two entries. Codex has no such check: its cache path does not change between versions.
5. **Setup owns `schema`.** `setup write` writes M into a new file, and refreshes `schema` in an existing valid
   file as it does for `tracker` and `landing`. It leaves a differing value that it does not own, with a warning. It
   keeps each field that it does not own. A file with no `schema` is invalid, and setup reads no invalid file: the act
   is to add the line by hand. This repository's `.celetis.yaml` has `schema: 1`.
6. **The gate.** `engine/lib/config/schema.json` holds `{ "schema": M, "digest": "<hex>" }`. The digest is the SHA-256 of
   the source text of `engine/lib/config/core.ts` and the value lists that it reads (`hosts`, `levels`, `models`,
   `reviewerLevels`, `autoLaneNames`, `steps`, and the steps of each lane). The gate refuses a record that is not valid, a
   record whose number is not `configSchema`, and a digest that differs. When a digest differs, the line says how to
   decide: when the accepted set changed, raise `configSchema`, add its row to "Schema versions", and set `schema` in
   `.celetis.yaml`; else write the printed digest under the same number. The gate also refuses the `.celetis.yaml` of
   this repository when it validates and its `schema` is not M. The digest has one known gap and one cost. The gate
   cannot tell a refactor of `core.ts` from a change of the accepted set, so each edit of that file, also a comment or
   `bunFloor`, needs a new digest, and the author decides at each digest whether the number goes up. A change in another
   module that `core.ts` imports, outside the listed value lists, passes with no digest change. The contract digest of
   ADR-0090 still covers no config field, so a change of the JSON of `celetis config` (it now holds `schema`) passes
   `checkContractVersion` with no raise of the contract version. The config digest is a separate gate: it forces a write
   of `engine/lib/config/schema.json` and never a raise of the contract version.
7. **The one-time refusal.** An engine and a plugin copy from before this record read no `schema`. Each refuses a file
   with the field with `schema: unknown field`, once, until `celetis update`. This record adds no compatibility layer to
   avoid it. The landing of this change runs the installed engine, so after the push the installed engine refuses the
   `.celetis.yaml` of the main checkout until `celetis update` and a restart of the daemon.
8. **The board after a failed check.** A check that fails, also a manual one, schedules no automatic check. `check` of
   `engine/board/update/updates.ts` clears the pending timer when it starts, and `schedule` runs only after a result
   that is not `check-failed`. A start of the board runs one check. A press of **Check** or **Check again** runs one
   check. A check that does not fail sets the 10-minute timer again (600000 ms). A failed check shows one line for each
   failed part, `<part>: <the first line of its error>`, as text with `white-space: pre-line`, from the `parts` of the
   worker result. A failure with no part line shows `checked.error`, and a worker that ends with no result keeps its
   generic line. Each check that runs still writes its events, so an unchanged failure writes events once for each manual
   check. The trust rules of the board stay, and `engine/lib/update/updater.ts` and `engine/board/update/worker.ts` do not change.
9. **The other automatic producers of the refusals.** The plan found, in the source at `af553fb6`, no other producer that
   retries an unchanged failure on its own. The auto loop of the daemon (`engine/lib/run/engine.ts`) ends at a
   `HostError` of `createOperation` and at a run that ends with a code other than `done`, and it skips an issue whose
   line is recorded. `codexSessionPin` and `requireContract` run only at a start that a person or the auto loop makes. The
   installed-engine watch of the board (`watchInstalled`, each 5 seconds) catches each error and writes no event. No change
   of the event record is part of this decision.

## Constitution

Read: `CONSTITUTION.md`, amended 2026-11-12.

- Serves: 2 Autonomous steps: a stop for a skew names the one act, so it costs no assist session to diagnose, and the board
  no longer fills the record with one unchanged failure.
- Serves: 4 Product neutrality: the schema number and its rules hold for each product project, with no product name.
- Hard limits and non-goals: none touched. The board still runs no update without a direct click of a person.

## Alternatives considered

- **2A, a better message only.** It adds no field, but an unknown field with a current session stays ambiguous (a typo or
  an old install), so the line must name two acts. The schema number gives one act for each skew.
- **A default for a file with no `schema`.** It would hide the first skew. The maintainer rule allows no default and no
  compatibility layer, so the file must name its number.
- **The version of the installed copy from the code of that copy.** The native hook API has no run of another copy and no
  `realpath`. A plain file of the copy gives the number with one permission-checked `Read`.
- **The stale-session check at each entry.** It spends the read budget of a normal entry. It runs only at a stop.
- **1B, merging repeated events in the event record (journald).** It covers each command, but it changes the record format
  and the output of `celetis events` (ADR-0066). Rejected for now. The producers of item 9 do not retry, so a change of
  the record is not needed.
- **A fixed number of retries of the board check.** A transient failure, for example no network, is the usual cause, and a
  person can press **Check** at once. A bounded retry adds state and keeps the repeat.

## Consequences

- Each skew of the engine, the plugin, and the file gives one line that names the part and one act. The board names each
  failed part of a check, and an unchanged failure stops repeating.
- Each project must add `schema: 1` by hand to its `.celetis.yaml`, because the reader refuses a file with no `schema`
  before any setup run. Each product maintainer owns that step (ADR-0031). An engine and a plugin copy that are older than
  this record refuse the new file once (item 7).
- The hook reads two more files at a newer-schema stop. A denied, prompted, or failed read, a `--plugin-dir` session
  that has no install record, and a path form that was not observed (the Windows forms of `installPath` and of
  `plugin.root`) give the update act with "could not be checked", and no wrong act. A copy that the check cannot compare
  stays a stop of the entry.
- Each edit of `engine/lib/config/core.ts` needs a digest and a decision about the number (item 6).
- A failed check, also a transient one, stops the automatic board check until a press of **Check** or a start of the
  board. An offer that appears after such a failure shows only after a press.
- The causes of the Windows failures stay open. When `codex plugin marketplace upgrade celetis` does not clear the Codex
  cache line on that machine, the check itself is wrong there, and a separate `bug` issue must fix it.

## Reconsider when

- A schema change needs more than the two outcomes, for example an automatic conversion of an older file.
- The native hook API gives the environment, `realpath`, or the version of an installed plugin, so that the read of the
  install record is not needed.
- A host enforces a version range for a plugin at load, as `engines` does, so that the file and the host can agree with no
  stale-session check.
- A failed board check that heals by itself costs more than the repeat of its events.
