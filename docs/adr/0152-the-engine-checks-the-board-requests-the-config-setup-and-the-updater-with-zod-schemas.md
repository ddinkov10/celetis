# The engine checks the board requests, the config, setup, and the updater with Zod schemas

## Date

2026-11-28

## Related

- [Issue #352](https://github.com/ddinkov10/celetis/issues/352): the spec (the issue body) and the last child of epic [#341](https://github.com/ddinkov10/celetis/issues/341). "Call N" names a call of the session in the spec, and "decision 1" names its decision of the maintainer.
- [The plan of #352](https://github.com/ddinkov10/celetis/issues/352#issuecomment-7236593168): the tasks, the differential probe, and the rulings of the build that this record names. "The build" means the work of that plan.
- [ADR-0150](0150-the-engine-checks-its-records-on-disk-with-zod-schemas.md): its Decision 1 to 7 hold for this change. Its Decision 8 and three other clauses change, see "Supersedes".
- [ADR-0115](0115-the-engine-pins-its-packages-in-a-lockfile.md): its decision 7, "Later children of the epic add schemas on this layer", holds; this record is the last such child. One sentence of its Constraints changes, see "Supersedes".
- [ADR-0087](0087-the-board-reads-engine-state-through-one-read-model.md): [ADR-0150](0150-the-engine-checks-its-records-on-disk-with-zod-schemas.md) already replaces the three clauses of it that say "no package dependency". No clause of it needs a new item, because the sentence "so the field checks stay hand-written functions" is among those three, and the field checks of `engine/lib/state/fields.ts` stay hand-written functions. Its Decision 2 says that `requests.ts` has one parser for each POST body, and that stays true.
- [ADR-0147](0147-the-config-file-records-its-schema-number.md): the hook bundles `engine/lib/config/core.ts`, and `core.ts` has no `node:` import and no `Bun` global. Both hold after this change.
- [ADR-0146](0146-codex-support-stays-as-it-is-until-the-maintainer-resumes-it.md): the Codex parts moved with the same rule and no Codex host ran, see "Consequences".
- [ADR-0029](0029-the-repository-keeps-no-tests.md): the differential probe of this change lives outside the repository and adds no tracked test.

## Supersedes

Only these clauses change. The records keep their historical text and evidence.

- [The engine checks its records on disk with Zod schemas](0150-the-engine-checks-its-records-on-disk-with-zod-schemas.md), in part:
  - in "Decision", item 8, the words "and the board requests, config, setup status, and updater (#352) keep their code", and the words "the native hooks" of "The board page, the native hooks, and `scripts/` import no Zod." The board requests, the config, setup, and the updater use Zod schemas now, and the native hook bundles Zod through `core.ts`. The board page and `scripts/` still import no Zod directly, see "Decision", item 9.
  - in "Constraints and evidence", the names `engine/lib/config/core.ts` and `engine/hooks/` in the sentence that those modules reach no `zod` module. `engine/lib/state/fields.ts` and `engine/board/page/` still reach none through their runtime imports.
  - in "Consequences", the sentence "`engine/lib/coordinator/coordinator.ts` keeps its `object` and `exact` helpers for `actProblem`, a board request of #352.", and in the list of sites outside that change, the names `engine/lib/capability/binding.ts`, `engine/lib/release/release.ts`, `engine/lib/package/package.ts`, and `setup/status.ts`. The other sites of that list stay outside.
- [The engine pins its packages in a lockfile and checks the daemon protocol with Zod schemas](0115-the-engine-pins-its-packages-in-a-lockfile.md), in part: in "Constraints and evidence", the names `engine/lib/config/core.ts` and `engine/hooks/` in the sentence "`engine/lib/state/fields.ts`, `engine/lib/config/core.ts`, `engine/hooks/`, and `engine/board/page/` import no Zod."
- [The config read runs on Bun](0024-the-config-read-runs-on-bun.md), in part: in "Decision", "The reader", the words "and checks the schema as typed code". The reader checks the shape with a Zod schema in `core.ts`, and the rules between fields stay code after the parse. The sentence "The strict checks are typed code in one file, not jq programs in strings." in "Consequences" stays true: `core.ts` is one file of typed code.
- [The board page runs on React with a locked build](0123-the-board-page-runs-on-react-with-a-locked-build.md), in part: in "Supersedes", the sentence "The server files still import only `node:` modules and other files of the board, so that part stays true." The board server files `requests.ts`, `chat/chat.ts`, `chat/claude.ts`, `chat/codex.ts`, and `update/worker.ts` import `zod` now. The sentence "The running board reads no package" of its "Constraints and evidence" stays true of `board.js`: it holds no Zod code.

## Context

Child 5 of epic #341 is the last. The board server requests, the config read, the plugin metadata, setup, and the updater checked their external input by hand. Seven files had an own `object` helper, and each result type was written a second time. ADR-0115 and ADR-0150 moved the daemon protocol and the records on disk to Zod, where one schema gives the check and the type. This change moves the rest of the inventory of the epic. It has one open question that the maintainer decided: the native hook imports `core.ts`, so a Zod config check puts Zod into `entry.js`.

## Constraints and evidence

- The inventory of #352 has 16 rows. The spec lists the parsers, their unknown-key rule, and the outcome of an invalid input that must stay.
- The hook imports `engine/lib/config/core.ts`. `scripts/build.ts` bundles each package of `engine/bun.lock` into `entry.js`, so the build rule needs no change.
- The plan probe of the spec (decision 1, "Design probes"): a small schema bundled to 178,723 bytes with classic `zod` and to 42,285 bytes with `zod/mini`. The real schema is larger.
- `z.strictObject` refuses an own `__proto__` key. `z.looseObject`, `z.object`, and `z.record` drop it with no error (ADR-0150, and the spec, call 3). A free-key map must not drop it, because the base gives an outcome for it: `custom` refuses it by the skill-name rule, and `codexProfiles` accepts it and checks its value as a profile.
- Zod 4.6.7 treats a bare `z.unknown()` key of an object as required. A key that can be absent needs `.optional()`.
- Zod reports issues in the order of the shape, so an input with two faults can get another line than the base. The maintainer accepted this on 2026-11-26 for #349 and #350 and the spec repeats it (call 1).
- `engine/lib/config/schema.json` holds a digest of the config rules. AGENTS.md ("Verify gate") says that the digest covers `engine/lib/config/core.ts` and the value lists that it reads, so a config rule in another file would leave it.
- The base of the build is trunk commit `ecf20ea`. `entry.js` has 286030 bytes there.
- The build found that `engine/lib/contract/contract.ts` was in the hook bundle at the base already. Its new import of `engine/lib/state/schemas.ts` adds that file, `engine/lib/tracker/key.ts`, `engine/lib/tracker/grammar.ts`, and the regexes of `engine/lib/state/fields.ts` to the bundle (about 1,740 bytes). These files have no `node:` import and no `Bun` global.
- `engine/lib/plugin/metadata.ts` had no reader of `installed_plugins.json` or `known_marketplaces.json`. `engine/lib/update/updater.ts` reads them, so their schemas are there.

## Decision

1. **The parsers of the inventory check their input with Zod schemas.** The sites are listed in "Consequences". Each schema sits in the module that owns its input. A form that two feature folders need has one home, `engine/lib/state/schemas.ts`. The boolean guard `fits(schema, value)` and `named` are such forms. The path form `absolute` of `engine/lib/plugin/metadata.ts` is the exception: it needs `node:path`, and the native hook and the browser program of the board page reach `state/schemas.ts`, so that file imports no `node:` module.
2. **Each type is `z.output` of its schema, except the kept types.** Two kinds are kept. A type of a value that the code builds after the parse stays a hand type. A type of an offer or a part whose code goes on with the original value is a `kept` object of its schema (`engine/lib/update/offer.ts`), because a loose output holds more keys than the type names.
3. **Each invalid input keeps its outcome, and a one-fault input keeps its line.** This is Decision 2 of ADR-0150 for the whole inventory. An error class keeps its own fields (`status`, `field`, `schema`, `ioCode`, `code`), and each HTTP status and exit code stays. An input with two or more faults gets the line of one of its faults (call 1).
4. **A value that the code prints, writes, hashes, or forwards is the original value after the check.** `validateConfig` returns the frozen YAML value that `celetis config` prints. The update guards stay boolean on the original value. Setup and the updater edit the original text with `editJSON`. The chat readers pass the original `input` and `arguments` to `inputText` and `callSummary`. The worker forwards the original offer. A loose output drops an own `__proto__` key, so a check of a whole value (`isDeepStrictEqual`) runs on the original.
5. **Strict stays strict, and loose stays loose.** A row with an exact key set is a `z.strictObject`, and a row that passes extra keys today is a `z.looseObject`. The routes `/api/resume`, `/api/shell`, `/api/go`, and `/api/refresh` keep their gaps (call 2).
6. **A free-key map reads the entries of the parsed object.** `custom` and `codexProfiles` use `entries()` of `core.ts`, never `z.record`. A native record with a free-key `plugins` map is checked with `fits`, and the code goes on with the original value.
7. **The schema of `.celetis.yaml` stays in `engine/lib/config/core.ts`.** The accepted set did not change, so the digest in `engine/lib/config/schema.json` is written under `"schema": 1`, with no raise of `configSchema`. The YAML checks of the text and the nodes run first, as before. The rules between fields (for example, the tracker `local` needs the landing `merge`) stay code after the shape parse, in the order of the base.
8. **The native hook bundles Zod through `core.ts`.** The maintainer chose classic `zod` on 2026-11-28 (decision 1, answer "A"). `core.ts` has one new import, `zod`, and keeps no `node:` import and no `Bun` global. The code of `engine/hooks/entry.ts` does not change.
9. **The board page and `scripts/` import no Zod directly.** A page module imports the queue types with `import type` only, so `board.js` holds no Zod code. `scripts/verify.ts` and `scripts/build.ts` load Zod at run time through `core.ts`.
10. **The Codex profile has one home.** The strict form of `codexProfiles.<runtime>` and the loose form of the `--profile` file share `modelSlots` and `reviewerShape` of `core.ts`. The file form adds the `schema` and `runtime` keys. The model ID and the reviewer level rule are one definition.
11. **A cast becomes a check, and the check takes the line of the base where one exists.** This is call 5 with the ruling of the build (reading b): the stdout of the `--inspect` child and the reads of `updatePlugin` are checked. A check cannot reproduce the text of a JavaScript crash, and a `TypeError` is no refusal line of the code.
    - `pluginInspection` of `offer.ts` is the unrefined shape of the answer of the child. `pluginUpdate` is `pluginInspection` with the cross-field rule of the offer. The real `--inspect` output, also with a layer, must pass, so `inspectPlugin` and the two reads of `updatePlugin` use `pluginInspection`.
    - `inspectPlugin` gets one new line, `update: the <host> inspection printed an invalid answer`, with exit 6, the code of the part error of the base.
    - The `revalidate` read and the fresh read of `updatePlugin` reuse the lines of the base, also for a fresh value of `null`.
    - `record.source` of the Codex branch has no runtime check. Its type comes from `codexSource` of `metadata.ts`, and `codexPlugin` already refuses each record that does not fit.
12. **`engine/lib/update/offer.ts` and `engine/lib/update/types.ts` are trust files.** `offer.ts` holds the schemas of the prepared update, its parts, the check, and the result. `types.ts` holds `part` and `updateStage`, which the board stream checks use. Both join the trust lists of AGENTS.md ("The board") and of `engine/board/README.md` ("The trust boundary"). `updater.ts` re-exports only `UpdateCheck`, the one type that a file imports from it.
13. **The base quirks stay.** For example, the scope of a Claude entry and the `sourceType` of a Codex record pass when `String(value)` is a listed name, so a one-item array such as `["local"]` is accepted, as on the base. `manifestVersion` throws a `TypeError` for a manifest that is JSON but no object (call 4).

## Constitution

Read: `CONSTITUTION.md`, amended 2026-11-12.

- Serves: 1 Intent to release: fewer parser bugs in the board, the config read, setup, and the updater on the path of each change.
- Hard limits and non-goals: none touched. The update stays approved only by a person; this change moves only the checks of what the updater reads.

## Alternatives considered

- **A hand-written config check, with Zod for the rest (the approach of ESLint).** Rejected by the maintainer: the config would keep a second style of check, against "One definition". The hook would stay smaller.
- **Zod Mini in `core.ts`.** Rejected by the maintainer: only the size of the hook favors it, no measure shows a cost of the larger hook, and classic Zod keeps one API style in the engine.
- **A generic error format (`z.prettifyError`, or the 400 body of Fastify) in place of each refusal line.** Rejected: each refusal line stays (parent decision 6), so each schema has a map from its first issue to the line of the base.
- **`z.record` for the free-key maps.** Rejected: it drops an own `__proto__` key with no error, and the base gives an outcome for that key.

## Consequences

- The sites of this change are:
  - config: `engine/lib/config/core.ts` (`configShape`, `agentOrderRecord`, `agentOrderList`, and the types `Config`, `Gates`, `AgentOrder`), `engine/lib/capability/capability.ts` (the runtime allowlist), `engine/lib/capability/binding.ts` (the profile file), `engine/lib/agent/order.ts`
  - board requests: `engine/board/requests.ts` (which now holds `BoardRequest`), `engine/board/adapter.ts`, `engine/agents.ts`, `engine/lib/coordinator/coordinator.ts`
  - chat readers: `engine/board/chat/chat.ts`, `engine/board/chat/claude.ts`, `engine/board/chat/codex.ts`
  - update worker: `engine/board/update/worker.ts`, `engine/lib/update/offer.ts`, `engine/lib/update/types.ts`
  - plugin metadata and contract files: `engine/lib/plugin/metadata.ts`, `engine/lib/contract/contract.ts`
  - setup: `engine/lib/setup/wiring.ts`, `engine/lib/setup/status.ts`, `engine/setup.ts`
  - updater and its types: `engine/lib/update/updater.ts`, `engine/lib/release/release.ts`, `engine/lib/package/package.ts`, `engine/lib/package/registry.ts`
- The hook grew. `plugins/celetis/hooks/entry.js` had 286030 bytes at the base `ecf20ea`. It has 465378 bytes at the last build of this change, 179348 more (about 63%). This record gives the size and no load time of the hook.
- `setup`, `agents`, and the update worker load Zod where they loaded none before (spec, risk 3). ADR-0115 measured 11 to 13 ms for the import.
- Hand helpers remain where the spec leaves them out: `object` in `engine/board/chat/chat.ts` (the Markdown walk), `object` in `engine/lib/plugin/metadata.ts` (read by `engine/lib/plugin/policy.ts`), and `object` in `engine/lib/setup/wiring.ts` (used by `engine/setup.ts` to edit the original text). `engine/board/view.ts`, the page, `engine/board/perimeter.ts`, `engine/lib/setup/json-layout.ts`, `engine/lib/update/target.ts`, and `engine/lib/install/installation.ts` are out of the scope (spec, "Out of the scope").
- Inputs with two or more faults can get another line than the base. Example: a `.celetis.yaml` with the unknown field `foo` and the invalid tracker `x` gets `tracker: invalid value`, and the base gave `foo: unknown field`. Each one-fault line is the line of the base.
- 154 inputs of the updater probe change from a crash or a pass to a line (Decision 11). The engine child never prints such an input, and the real producer output passes.
  - The stdout `5`, `null`, or `"x"` of the `--inspect` child: the base threw a `TypeError` ("value is not an Object. (evaluating '"skipped" in value')"). The lane throws the new line with exit 6.
  - The stdout `[]`, `{"skipped":5}`, or `{"skipped":null}`, and an object of another form (a field absent or of another type, a `toRef` of another kind, an extra key or an own `__proto__` key in `toRef` or `user.path`): the base returned the value as a plugin update and a later step crashed or made a wrong offer. The lane throws the new line. The part error of `inspectUpdate` is that line in place of the crash text. The error line "update: fix the errors above; nothing changed" and the other parts stay.
  - A fresh read of `null` in `updatePlugin`: the base printed the block "update: fresh enabled installation validation failed" followed by a `TypeError` text, with exit 6. The lane prints the same block with the line "update: fresh installation does not match the approved source, ref, scope, or target", with exit 6.
- The strict `ref` of `pluginInspection` refuses an extra key in `toRef` of the stdout. The real producer prints `{kind, name}` only.
- Codex parts are not checked on a Codex host (ADR-0146). The Codex chat reader runs with a fake client. The Codex branch of `installation` in `updater.ts` has no probe case. The Codex marketplace list is probed with a fake `codex`. The Codex replies of `metadata.ts` are hand-made from the base reads, and `readBinding('codex', ...)` ran as a library call with a private `CODEX_HOME`.
- The trust boundary of `engine/board/README.md` holds. A value goes into an argv, a path, or a write only after the same check as before. The files `offer.ts` and `types.ts` join its lists (Decision 12).
- The documents outside the records state no claim that these parts check by hand, import no Zod, or that the hook bundles no package. This record changes no other document.

## Reconsider when

- Zod does not run in the Claude Code hook runtime, or the load time of the larger hook costs a session real time. The options are then Zod Mini in `core.ts` or a hand-written config check.
- A later Zod version changes the issue order for a one-fault input, or changes the result for an own `__proto__` key.
- An input of the inventory gets a disk or wire form that differs from its form in memory, so that it needs a codec.
- A check in `engine/lib/state/fields.ts` repeats a schema, so that the two homes of one rule must merge.
