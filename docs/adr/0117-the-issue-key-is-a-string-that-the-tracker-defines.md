# The issue key is a string that the tracker defines

## Date

2026-11-20

## Related

- [Issue #333](https://github.com/ddinkov10/celetis/issues/333): the spec.
- [The plan of #333](https://github.com/ddinkov10/celetis/issues/333#issuecomment-7021012944).
- [Issue #11](https://github.com/ddinkov10/celetis/issues/11): decision 3 of that issue says that the tracker defines the issue key.
- [ADR-0070](0070-automatic-runtime-state-migration.md): the conversion of Celetis-owned runtime state. It is unchanged and is the mechanism of the schema bumps of the five records.
- `engine/lib/tracker/key.ts` (`IssueKey`, `parseKey`, `parseHandle`, `isKey`, `compareKeys`, `keySource`) and
  `engine/lib/tracker/grammar.ts` (`grammar`).
- ADR-0008 (line 131), ADR-0012 (line 536), ADR-0035 (the Run and Resume items, "the issue number"), and ADR-0087 (line 53)
  use the word "number" for the handle; no clause decides the digit or integer form. No clause of them is superseded.

## Supersedes

Only these clauses change. The records keep their historical text.

- [A local web board starts each step in Herdr](0003-a-local-web-board-starts-each-step-in-herdr.md), only the clause
  that the board accepts only digits as the number of an issue. The board accepts a string that `parseKey` accepts.
- [The board is a package of its own](0009-the-board-is-a-package-of-its-own.md), only the clause that the digits of the
  number are the one value of a command line. The value is the issue key.
- [The board is a part of the engine](0035-the-board-is-a-part-of-the-engine.md), only the clause that the issue digits
  go into a line. The issue key goes into a line.
- [A set-aside record keeps auto mode away from an issue](0109-a-set-aside-record-keeps-auto-mode-away-from-an-issue.md),
  only the clauses that the file holds one issue number per line and that a line that is not a positive integer has no
  effect. The file holds one issue key per line, and a line that is not an issue key has no effect.

## Context

The engine held the key of an issue as a JavaScript number. A tracker other than GitHub can give a key that is not a
number, for example a text key with letters. A number type fixes the engine to the numbering of one tracker, and it
loses a key that is not a safe integer.

## Constraints and evidence

- The key goes into branch names, folder names, tab names, command lines, file paths, lock names, and JSON files. A
  value of the key must be safe in each of them.
- Each stored record holds the key. A change of its type changes the schema of each such record (ADR-0070).
- The History cache and the event log are derived data and a log of history.
- The maintainer's rule: no compatibility layers and no old readers.

## Decision

1. **The key is an opaque string that the tracker defines.** The engine does not read a meaning from it. Only
   `engine/lib/tracker/key.ts` makes an `IssueKey`, with `parseKey`, `parseHandle`, `isKey`, and `compareKeys`.
   `keySource()` gives the pattern of the grammar for text that builds a regular expression.
2. **The envelope is `^[A-Za-z0-9](?:[A-Za-z0-9-]{0,62}[A-Za-z0-9])?$`.** It holds for each tracker. It keeps the key
   safe in a branch name, a path, a tab name, and a command line.
3. **The grammar of the tracker narrows the envelope.** `grammar()` of `engine/lib/tracker/grammar.ts` gives the
   pattern, the query pattern, the check, and the order. The GitHub grammar is `[1-9][0-9]*`, a safe-integer check, and
   numeric order. A key is valid when the envelope and the grammar both accept it. Keys sort with `compareKeys`.
4. **The files `key.ts` and `grammar.ts` are trust files of the board.** The page bundle imports them through a fixed
   set in `scripts/build.ts`, so the page and the engine parse a key by one rule.
5. **JSON holds the key as a JSON string.** A JSON number in a place of a key is refused. A board request with a key
   that is not valid gets 400 `the number of the issue is not an issue key`. This is the decision of the plan session of
   2026-11-19.
6. **The five records convert by ADR-0070.** The run record is schema 4, the queue schema 4, the saved session schema 3,
   the quota-recovery record schema 3, and the dispatch record schema 3. Each store converts each older schema at
   its access boundary and keeps the exact source bytes once. A number that the grammar refuses refuses the record intact.
7. **The History cache rebuilds once.** It is derived data. Its reader already skips a line that is not valid, and an
   old line with a number `issue` is not valid now. The stored `open-epics` value of the page reads as empty once, for the
   same reason.
8. **The event log has schema 2.** The new lines hold the key as a string. The older lines keep schema 1 and are not
   converted, because the log is a log of history.

## Alternatives considered

- **Keep the number and add a second field for other trackers.** Two fields for one thing, and each reader must choose.
  Rejected.
- **A key type with the meaning of GitHub in the engine.** It fixes the engine to one tracker again. Rejected.
- **Convert the old lines of the event log and the History cache.** It writes derived data and history again for no
  reader. Rejected.
- **A compatibility reader for old JSON with numbers.** The maintainer's rule forbids it. Rejected.

## Consequences

- A tracker can define its own key grammar in one file.
- An `## Epic accepted` comment that was published before this update holds a number `parent`, and the epic reader
  refuses it. An epic whose close failed in that window publishes one more `## Epic accepted` comment, and then it closes.
  This record adds no compatibility reader for it.
- The History cache rebuilds once, and the page reads `open-epics` as empty once.
- A command line with an issue key now refuses each string that the grammar refuses, with its usage line and its exit
  class of before (Requirement 1 of #333). `dispatch` read `012` as issue 12 before; now it prints
  `dispatch: usage: need a positive issue number` and exits 2. `run` and `worktree` had no safe-integer check and let
  `9007199254740993` through; now each prints its usage line and exits 2. `assist` and `coordinator` read `012` as
  issue 12 before, and `next-step` also took `0` and `012`; now each prints its usage line and exits 2.
- A script outside the engine that reads a JSON file of Celetis with a number key must read a string now.
- The page and the engine share two more files that both are trust files.

## Reconsider when

A second tracker is added, and its keys need a rule that the envelope or the `grammar()` interface cannot state.
