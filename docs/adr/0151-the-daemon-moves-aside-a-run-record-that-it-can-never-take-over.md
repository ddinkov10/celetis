# The daemon moves aside a run record that it can never take over

## Date

2026-11-28

## Related

- [Issue #394](https://github.com/ddinkov10/celetis/issues/394): the spec of this change, with its approaches and its prior art.
- [The plan of #394](https://github.com/ddinkov10/celetis/issues/394#issuecomment-7229509581): the tasks, the probes, and the Verify scenarios.
- [ADR-0070](0070-automatic-runtime-state-migration.md): "Unsafe, invalid, unsupported, or unmappable data refuses intact" holds. The rename keeps the bytes and the mode of the record.
- [ADR-0126](0126-a-local-tracker-in-the-git-bug-format.md): a schema-4 run record still gets `the record has another schema`, with no conversion.
- [ADR-0102](0102-the-one-time-moves-of-the-old-names-go.md): the refusals of old state keep their reasons.
- [ADR-0075](0075-the-names-of-the-workflow-the-daemon-and-a-run.md): "the daemon takes over no run from that record" holds.
- [ADR-0141](0141-the-daemon-keeps-a-lifecycle-log-of-its-own.md): the lifecycle log gets the type `run.refused`.
- `engine/lib/run/record.ts` (`readRunRecords`), `engine/lib/run/refused.ts`, and the takeover loop of `serve` in `engine/lib/daemon/server.ts`.

## Supersedes

- [A run session tab never takes the focus](0101-a-run-session-tab-never-takes-the-focus.md), in part: in "Consequences", "The update", the clause "the file stays" of a run record that the new daemon refuses. A refused run record now moves to `daemon/refused/`. The other parts of that sentence hold: the daemon prints the path and the cause, and the session stays in its tab.

## Context

At each start, the master daemon reads each run record in `<git common dir>/celetis/daemon/runs/`. Before this change, it refused a record that this engine cannot take over, printed `daemon: cannot take over <path>: <reason>; its session stays in its tab`, and left the file in place. No engine of this or a later version can take over such a record, so the daemon refused the same file again at each start. On the maintainer's machine, two schema-4 records of 2026-11-22 (#335 and #363, both closed) gave 24 refusal lines in `daemon.log` by 2026-11-28. The line named no act that clears the record. The refusal of a quota wait of an older engine had the same defect: a new run gets a new run ID, so the old file stayed. The lifecycle log had no entry for a refusal.

## Constraints and evidence

- Node.js `fs.rename` overwrites an existing target, so a move must check for the target itself. Bun 1.4.4 runs `node:fs` with this contract.
- Windows refuses `:` in a file name, so an ISO time cannot be part of the target name as it is.
- Only the master daemon writes run records and `daemon/refused/`, and it holds the lock ref `daemon` during the takeover. So no other writer runs between the check of the target and the rename.
- A read of a record can fail for a cause that a person can repair (a file that another process holds open on Windows, or a storage fault that `engine/lib/state/migration.ts` refuses). After the repair, the same read can take the record over.
- `processState` of `engine/lib/process/identity.ts` gives `runs`, `gone`, or `unknown`. A failed read is never an end (the lesson `a-failed-process-read-is-not-an-exit` of this repository).
- On Windows 11, the conversion of a schema-3 run record fails at the rename of `commitMigration` with `EPERM` on the base of this change too. The build of #394 observed it on 2026-11-28: `EPERM: operation not permitted, rename '<dir>/.celetis-migrate-<id>.json.3.<random>.t' -> '<dir>/<id>.json'`. That read is now `unread`, so such a record stays in `runs/`.

## Decision

1. **Three results of a read.** `readRunRecords` gives `taken` (a valid schema-5 record, or a converted schema-2 or schema-3 record), `refused`, or `unread` for each file. `refused` is a definite refusal: the bytes were read, and this engine can never take the record over. Its causes are the reasons of before: `the record is not valid JSON`, `the record has another schema`, `the record is not a valid run record`, `the record ID differs from its file name`, and `the record keeps the quota wait of an older engine; start the run again`. `unread` is an error of the read of the file, of `readLocalRecord`, or of `commitMigration`. A file that goes away between the list and the read gives no result.
2. **The move of a definite refusal.** The daemon renames a refused file to `daemon/refused/<run ID>@<stamp>.json`, where `<stamp>` is the UTC time of the move in the form `20261128T101112.345Z`. The folder is private (0700), and the first move makes it. The rename keeps the bytes and the mode. An existing target is never overwritten: the record then stays in `runs/`, as for each other failure of the move, and the next start tries again. A record that a person moves back into `runs/` moves again under a new name.
3. **The state of the session from the barrier alone.** For a refused record, the daemon reads `session.barrier.pid`, `session.barrier.start`, and `session.tab` with schemas that do not depend on the record schema, then `processState`. The state is `gone`, `runs`, `unknown` (also when the read throws), or none when the record has no valid barrier. The state selects only the words of the line and the field of the entry. The move happens in each state, because this engine can take over the record in none of them.
4. **No move for an unread record.** An unread record stays in `runs/` with its bytes, and the next start reads it again.
5. **One line and one entry for each refusal.** The daemon prints one line to stderr (`daemon.log`) with the target and the state of the session, or the cause of a failed move, or the cause of a failed read. For a live session, the line names the one act that is left: `close the tab when its work is done`. The tab text comes from a file of an older engine, so each control character becomes a space and the text is cut at 4096 characters. The daemon also writes one lifecycle entry `run.refused` with `{reason, moved, session}`, the run ID of the file name, and the issue key of the record or `null`.

## Constitution

Read: `CONSTITUTION.md`, amended 2026-11-12.

- Serves: 2 Autonomous steps: the daemon clears a record that no act of a session can use, so the maintainer gives it no attention, except for a session that still runs.
- Hard limits and non-goals: none touched.

## Alternatives considered

- **A new command that the maintainer runs**, for example `celetis daemon forget <run id>` (the pattern of Moby, where `docker rm` clears a container in a bad state). Rejected: it needs a new form and a new contract version, and an act of the maintainer for each record, also when its session ended long ago.
- **A refusal line that names a manual act** ("inspect it, then remove it"), as the refusal of a recovery record does. Rejected: each record needs a removal by hand, and the line repeats until then.
- **A removal in place of the move.** Rejected: ADR-0070 keeps the bytes of refused data, and a person can need the record to repair a session.

## Consequences

- A definite refusal happens at one start for each record. Its line says where the record went and what the state of its session is, and `daemon events` holds one `run.refused` entry for it.
- The first start of this engine on the maintainer's machine moves the two schema-4 records of #335 and #363. Their `start.*` folders stay, because the move touches only the record file and `daemon/refused/`.
- A schema-2 or schema-3 record with a storage fault, or one whose conversion fails, repeats its "next start reads it again" line at each start until a person repairs the cause. On Windows 11 this includes each schema-3 record, because of the `EPERM` of `commitMigration` above.
- A record that a defect of a validator refuses also moves. Its bytes stay in `daemon/refused/`, so a person can move it back after a fix.
- Nothing removes the files of `daemon/refused/`. They stay for the maintainer, as a disposed journal file of journald stays for the administrator.

## Reconsider when

- A later engine can take over a record that this engine refuses, for example by a conversion of schema 4. Then a refusal is no longer definite for that schema, and a move would hide a record that the new engine could use.
- A second writer of run records can run beside the master daemon. Then the check of the target before the rename needs a lock or an exclusive create.
- The folder `daemon/refused/` grows to a size that matters. Then it needs a removal rule.
