# The resolver and the updater are libraries, and no library imports a command

## Date

2026-11-08

## Related

- ddinkov10/celetis#255 (the resolver is a library, and the next-step command only calls it)
- `engine/lib/resolver.ts`, `engine/lib/resolver-types.ts`, `engine/lib/updater.ts`
- `engine/next-step.ts`, `engine/update.ts` (the command files, which keep their names)
- `scripts/verify.ts` (`checkImports`, the import rule of the gate)
- ddinkov10/celetis#258 (the board page modules move into `engine/board/page/`)
- ADR-0033, ADR-0035, ADR-0036 (the placement clauses that this record supersedes)
- ADR-0042 and ADR-0047 (they name `engine/update.ts` where their code lived; the code now lives in `engine/lib/updater.ts`)

ADR-0042 and ADR-0047 are not superseded. Each lists where the code of its decision lives, not a
placement decision. Their named code now lives in `engine/lib/updater.ts`: the update logic, and
`requireSameRevision`, which was in `engine/update.ts`.

## Supersedes

- "A typed boundary" of [ADR-0033](0033-one-workflow-definition-and-the-skip-rule.md), lines 124-126: it says
  "`engine/next-step.ts` keeps the GitHub collection, the boundary validation of each field that the
  resolver reads, the local observations, and the text format." The resolver now lives in
  `engine/lib/resolver.ts`. `engine/next-step.ts` only parses its input, calls the resolver, and prints.
- [ADR-0035](0035-the-board-is-a-part-of-the-engine.md), line 295: it says "`jsonRow`, `JsonRow`,
  `BoardRow`, and `nextBoard` stay in `engine/next-step.ts`." `nextBoard` now lives in
  `engine/lib/resolver.ts`. `jsonRow`, `JsonRow`, and `BoardRow` are removed. The one row type is
  `IssueRow` in `engine/lib/resolver-types.ts`.
- [ADR-0036](0036-the-engine-enforces-the-lifecycle-and-the-landing.md), lines 30-35: its amendment says
  "`engine/next-step.ts` keeps the GitHub collection, the boundary validation of each field that the
  resolver reads, the local observations, and the text format. The read of one issue and its timeline,
  and the validation of each field that it reads, are in `engine/lib/tracker.ts`. The text of each line
  (`describe`, `lineOf`) is in `engine/lib/lines.ts`. `engine/next-step.ts` keeps the local observations,
  the board rows (`jsonRow`), and its typed results." The board rows and the resolver are now in
  `engine/lib/resolver.ts`.

## Context

The resolver (`nextIssue`, `nextOpen`, `nextBoard`, and the row types) lived in the command file
`engine/next-step.ts`. Library modules and the board imported that command. The resolver also loaded
`engine/lib/quota-recovery.ts`, so each user loaded `terminal.ts` and `session.ts`. The board and the
daemon imported the command file `engine/update.ts`, which starts itself as a child. One issue row had
three types. The dependency direction was wrong: a command sat below the library.

## Constraints and evidence

- A command file keeps its basename. `AGENTS.md` ("Traps") says that a rename changes a lock owner.
- The gate has no import rule. A library could again import a command file without a failing check.
- Biome 2.5.15 `style/noRestrictedImports` matches the text of a specifier against gitignore-style
  groups. It does not resolve the specifier against the folder of the file. So one group cannot refuse
  `../next-step.ts` from `engine/lib/x.ts` and pass `../types.ts` from `engine/board/page/x.ts`: both
  are `../<file>`. The first version of this decision used one Biome group, `**/../*`. After the merge
  of #258, which moves the page modules into `engine/board/page/`, that group refused 11 legal imports,
  for example `../types.ts` in `engine/board/page/agent-picker.ts` line 2. A set of overrides, one for
  each folder depth, needs a new override for each new nested folder.
- The spec of #255 ("Risks") names the fallback: a check in `scripts/verify.ts` with the same scope,
  the same message, and no exception.

## Decision

1. `engine/lib/resolver.ts` holds the resolver. It builds the whole `IssueRow`, including the board
   state, so each state rule has one home. The row type has one producer, and `engine/board/data.ts`
   uses the rows as they are.
2. `engine/lib/resolver-types.ts` is node-free. It defines `IssueRow`, `Pull`, and `ParentEpic`. The
   browser environment compiles it.
3. `engine/lib/updater.ts` holds the update logic. It has its own child entry for `--inspect` and
   `--policy`, because the updater starts itself as its child. `engine/update.ts` keeps the command.
4. `checkImports` of `scripts/verify.ts` reads each tracked `.ts` file under `engine/lib/` and
   `engine/board/`, at each depth, with no exception. A small tokenizer skips comments, the text of
   strings and templates, and regular expressions. The check takes the string after `from` or
   `import`, and the string literal or plain template in `import(…)` and `require(…)`. So it reads
   static, type-only, side-effect, re-export (also `export type` and `export *`), dynamic, and inline
   type imports, and `require()`. It joins a relative specifier to the folder of the file, and refuses
   it when the result is a file directly in `engine/`, with or without `.ts`. Each refusal prints
   `<file>:<line>: A library or board module imports the library, not a command file of engine/ (ADR-0081).`,
   and the gate ends with `verify: FAIL`.

## Alternatives considered

- One Biome override with the group `**/../*`. It was the first version of this decision. It refuses
  legal imports from a nested folder, such as the page modules of `engine/board/page/`. Replaced.
- One Biome override for each folder depth. Each new nested folder needs a new override, and a missed
  override passes a command import or refuses a legal one. Rejected.
- The resolver builds part of the row and the board finishes it. Two homes for the state rule, and a
  `line` field that the browser does not read. Rejected.
- The board maps the resolver row to its own wire type. Two types for one issue row. Rejected.
- A separate worker file for the updater child. The updater would need the worker, and the worker would
  start it. Rejected for the extra file.

## Consequences

- A library or board module cannot import a top-level `engine/` file. The gate refuses it.
- The rule has limits, each shown by a probe of `checkImports`. It does not refuse an `import()` with a
  computed specifier, such as ``import(`../${name}.ts`)``. It reads only relative specifiers, so it does
  not refuse an absolute path such as `'/repo/engine/next-step.ts'`. It reads only `.ts` files, so it
  does not read the vendored `engine/lib/vendor/yaml.mjs`. A regular expression that follows `)`, or
  `}` on the same line, is read as a division, and a division after `++` or `--` is read as a regular
  expression. When the misread text holds a backtick, the check misses each later import of the file
  (probes ``if (ok) /`/.test(s);`` and ``const n = i++ / 2; const t = `a…`` before an import). The code has none of these forms. In the 79 files of the scope, the check finds
  each of the 472 relative specifiers after `from ` or `import(`, and skips one such text inside a
  template of `engine/lib/process.ts`.
- The updater is the first library module with a process entry. Another process entry in a library
  needs its own decision (#266).
- The internal `update --inspect` and `update --policy` forms leave the command. `update --inspect claude`
  now exits 2 with the usage line.

## Reconsider when

- Biome or TypeScript gets a stable rule or API that resolves a specifier against the folder of the
  file and covers the same forms. The tokenizer of `checkImports` can then go.
- A library module must start a command file by path (for example `lib/state-preparation.ts` starting
  `daemon.ts`). That is a different rule (#266).
- The updater child entry moves out of `engine/lib/updater.ts`.
