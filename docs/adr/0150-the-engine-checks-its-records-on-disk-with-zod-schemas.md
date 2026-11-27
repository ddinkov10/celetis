# The engine checks its records on disk with Zod schemas

## Date

2026-11-27

## Related

- [Issue #349](https://github.com/ddinkov10/celetis/issues/349): the spec and the plan of this change, a child of epic [#341](https://github.com/ddinkov10/celetis/issues/341). "Parent decision N" names a decision of the epic body.
- [The plan of #349](https://github.com/ddinkov10/celetis/issues/349#issuecomment-7200885292): the inventory of 18 parsers, the outcome rule, the differential probe, and the external facts that this record cites as "the plan probe".
- [ADR-0114](0114-the-engine-library-groups-its-files-into-feature-folders.md): each schema stays in the feature folder of its record.
- [ADR-0115](0115-the-engine-pins-its-packages-in-a-lockfile.md): its decision 7, "Later children of the epic add schemas on this layer", holds; this record is such a child. Its Related sentence changes, see "Supersedes".
- [ADR-0029](0029-the-repository-keeps-no-tests.md): the differential probe lives outside the repository and adds no tracked test.
- [ADR-0103](0103-a-run-of-the-daemon-is-an-explicit-state-machine.md) and [ADR-0110](0110-the-coordinator-chat-reads-the-session-record-of-the-host.md) name "no package dependency" for a state machine library and a protocol client. Those choices stay; this record adds neither.

## Supersedes

Only these clauses change. The records keep their historical text and evidence.

- [The board reads engine state through one read model](0087-the-board-reads-engine-state-through-one-read-model.md), in part: in "Context", "The project has no package dependency, so the field checks stay hand-written functions."; in "Alternatives considered", "A schema library. Rejected: the project has no package dependency."; in "Reconsider when", "A schema library enters the project, and the field module can become a set of schemas." The library entered with ADR-0115. The field checks of `engine/lib/state/fields.ts` stay hand-written functions. The records on disk use Zod schemas.
- [The engine pins its packages in a lockfile and checks the daemon protocol with Zod schemas](0115-the-engine-pins-its-packages-in-a-lockfile.md), in part: in "Related", "Only the daemon protocol parsers leave the premise, by this record." The parsers of the records on disk leave that premise too.

## Context

The engine checked its records on disk by hand. Each reader had private helpers that tested each field (for example `validFields`, `validateSession`, `pidOf`, `readOrder`), and each record had a TypeScript type written a second time. ADR-0115 moved the daemon protocol to Zod schemas, where one schema gives the check and the type. The records on disk are the next area. Each is read after a crash or a restart, and some are written by an older engine. A hand check can drift from its type, and a fault found late is a parser bug.

## Constraints and evidence

- The inventory has 18 parsers. Each reads a record on disk: the run, session, step-end, recovery, attempt, start-barrier, dispatch, and execution-report records, the lock owner, the setup record, the lesson files and journal, the coordinator record, the event and lifecycle logs, the trend files, the usage-limit record, the agent order, and the local tracker store. Each keeps its outcome for an invalid input: `null`, a skipped line, a fixed refusal line, a named reason, or an exit code.
- Zod 4.6.7 accepts only safe integers in `z.int()`. It counts string length in code points, but the bounds of the records count UTF-16 units, so each bound is a refinement on `.length` (ADR-0115).
- `z.strictObject` refuses a `__proto__` key from `JSON.parse` as `unrecognized_keys`. `z.looseObject`, `z.object`, and `z.record` leave that key out of the result with no error (the plan probe).
- Zod reports issues in the order of the shape, so a type issue can come before an unrecognized key. An input with two faults can therefore get a reason that differs from the trunk. The maintainer accepted this on 2026-11-26 (the plan, decision "B").
- `z.json()` refuses sparse arrays, non-finite numbers, and objects that are not plain, but it throws a `TypeError` on a cycle (the plan probe).
- The differential probe compares each parser with its base trunk. The base was first `af553fb6`. The trunk then changed the files of the inventory on purpose: the `schema` field of `.celetis.yaml` ([ADR-0147](0147-the-config-file-records-its-schema-number.md)), the usage code that moved to Zod ([issue #351](https://github.com/ddinkov10/celetis/issues/351)), and the local tracker snapshot ([issue #336](https://github.com/ddinkov10/celetis/issues/336)). The probe now uses trunk `17c7e940`. The probe is not tracked.
- The plan assumed that `engine/usage-hook.ts` imports no Zod. That no longer holds. It imports `engine/lib/host/claude/usage.ts`, which imports `zod` directly and imports `engine/lib/host/usage.ts`, which imports `zod` too. Since #351, `usageAttempt` of `engine/lib/host/usage.ts` is a Zod schema (`usageAttemptSchema.safeParse`). This record does not touch `usageAttempt` or the usage hook.
- The modules `engine/lib/state/fields.ts`, `engine/lib/config/core.ts`, `engine/hooks/`, and `engine/board/page/` reach no `zod` module through their runtime imports (checked on 2026-11-27 for this change).

## Decision

1. **One schema per record, in the folder of its feature.** Each schema sits in the module that owns its record. The record type is `z.output` of that schema, and `Readonly<z.output<...>>` where the hand type was `Readonly`. A form that two or more records share goes to `engine/lib/state/schemas.ts`: `count`, `code`, `bounded`, `filled`, `filledWithin`, `identity`, `identityFields`, `issueKey`, `uuidText`, `lowerUuid`, `digestText`, `revisionText`, `commitText`, and `members`.
2. **Each invalid input keeps its outcome.** A reader that returns `null` or skips a line uses `safeParse`. A reader that throws a fixed line throws it on a failed parse. A reader that names the fault maps the first Zod issue to the same reason text. For an input with one fault, the value, the `null` or skip, the refusal line, and the exit code are unchanged. For an input with two faults, the exit code is unchanged, and the reason names one real fault of the input. One change of value: a lock owner `pid` above 2^53 - 1 gives `null` for that identity, because `count` accepts only safe integers. The lock owner keeps its per-identity fallback to `null`.
3. **Strict stays strict, and loose stays loose.** A record with an exact key set is a `z.strictObject`, which refuses each unknown key, `__proto__` included. A record that passes extra keys today stays a `z.looseObject`, which leaves `__proto__` out of the result. The event log read keeps its check of an object with a string `id`.
4. **Rules between the fields of one record are refinements.** A rule against a value outside the record stays code after the parse, or is a schema made for that value. The folder guard of the coordinator record is such a schema, made for `startPrefix`. An ordered check of a named reason stays code where the order needs it.
5. **Writers check with the same schema.** A writer that checks its record before a write uses the schema of that record: the run record, the step-end record, and the dispatch record. A refusal of a writer keeps its text and exit code.
6. **The JSON-value walk stays.** The dispatch record keeps its `jsonValue` walk for a value in memory before a write, because `z.json()` throws on a cycle instead of refusing it.
7. **Old record versions keep their readers.** The reads and conversions of old versions stay, each with a Zod schema of its old shape. Their removal is a separate decision, and the rules of ADR-0070 and ADR-0102 hold.
8. **Out of this change.** The GitHub replies (#350), the host output and usage capture (#351), and the board requests, config, setup status, and updater (#352) keep their code. The board page, the native hooks, and `scripts/` import no Zod.

## Constitution

Read: `CONSTITUTION.md`, amended 2026-11-12.

- Serves: 1 Intent to release: each record that carries a run, session, lock, or landing gets one checked definition, for fewer parser bugs.
- Hard limits and non-goals: none touched.

## Alternatives considered

- **One module of all record schemas.** Rejected: it couples each feature folder to one file, against ADR-0114.
- **A generic `readRecord(schema, path)` in place of the readers.** Rejected: the readers differ in their outcome (`null`, a skipped line, a fixed refusal, a named reason, or exit 2, 3, or 6). One reader would need an option for each outcome.
- **A Zod codec for each record.** Rejected: a codec fits a record whose disk form differs from its form in memory. Each record here has one form, so a codec adds a layer and no check.
- **Hand checks for the records on disk, with Zod only for the daemon protocol.** Rejected: the records on disk have the same drift risk, and each record should have one checked definition.

## Consequences

- Each parser of the inventory checks its input with a schema, and its type is `z.output` of that schema. The sites are:
  - run record: `engine/lib/run/record.ts`
  - session record: `engine/lib/run/session.ts`
  - step-end record: `engine/lib/run/step-end.ts`
  - recovery record: `engine/lib/run/quota-recovery.ts`
  - start barrier: `engine/lib/run/activities.ts`
  - attempt record: `engine/lib/attempt/attempt.ts`
  - dispatch record and execution report: `engine/lib/capability/dispatch-record.ts`
  - lock owner: `engine/lib/state/locks.ts`
  - setup record: `engine/lib/setup/record.ts`
  - lesson files, queue, ignore, store, capture, and review inputs: `engine/lib/lesson/record.ts`
  - lesson journal: `engine/lib/lesson/store.ts`
  - coordinator record: `engine/lib/coordinator/coordinator.ts`
  - event and lifecycle logs: `engine/lib/state/lines.ts`
  - trend samples and cache: `engine/lib/board-read/trends.ts`, the new `engine/lib/board-read/trend-lines.ts`, and `engine/lib/board-read/types.ts`, which re-exports the `Sample` and `CacheLine` types of `trend-lines.ts`
  - usage-limit record: `engine/lib/agent/usage.ts`
  - agent order: `engine/lib/agent/order.ts`
  - local tracker store: `engine/lib/local/format.ts`
  - shared forms: `engine/lib/state/schemas.ts`. `engine/lib/queue/types.ts` exports the `run` schema that `engine/lib/run/record.ts` reads.
- The exceptions are these. `engine/lib/coordinator/coordinator.ts` keeps its `object` and `exact` helpers for `actProblem`, a board request of #352. The sites of the plan's scope list that are not in this change are `engine/lib/capability/binding.ts`, the capture files of `engine/lib/host/claude/usage.ts` and `engine/lib/host/codex/usage.ts`, `engine/lib/release/release.ts`, `engine/lib/package/package.ts`, `setup/status.ts`, the comment parsers of `workflow/hold.ts` and `landing/hold.ts`, and `usageAttempt` of `engine/lib/host/usage.ts`, which is already a Zod schema since #351 and is not changed here.
- Commands that loaded no Zod before, such as the lesson store and the dispatch command, now load it. ADR-0115 accepted this start cost.
- A wrong refinement in the coordinator record could let a folder outside `startPrefix` reach an `rm`. The probe corpus includes such folders. No row of the trust table in `engine/board/README.md` names a file that this change moves.
- Two-fault inputs can get a reason that differs from the trunk, as in Decision 2.

## Reconsider when

- A command that reads one record cannot pay the start cost of Zod.
- A record gets a disk form that differs from its form in memory, so that it needs a codec.
- A check in `engine/lib/state/fields.ts` repeats a schema, so that the two homes of one rule must merge.
