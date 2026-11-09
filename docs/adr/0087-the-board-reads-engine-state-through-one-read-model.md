# The board reads engine state through one read model, and its server is split by concern

## Date

2026-11-09

## Related

- [Issue #269](https://github.com/ddinkov10/celetis/issues/269): the spec and the decisions Q1 (the scope of the
  field module) and Q2 (the gate check).
- [Issue #195](https://github.com/ddinkov10/celetis/issues/195), finding F14: the finding that the board server
  is one closure and reads the engine directly.
- [Issue #240](https://github.com/ddinkov10/celetis/issues/240): the rule to measure again before a child of the
  epic acts.
- [ADR-0065](0065-the-board-serves-each-visual-page-in-a-sandbox.md): the visual page route. Its clauses stay.
- [ADR-0076](0076-the-board-presses-are-requests-of-the-master-daemon.md) and
  [ADR-0077](0077-the-master-daemon-hosts-the-board-and-restarts-as-a-successor.md): the write path of the presses
  and the daemon that hosts the board. Their clauses stay.
- Files: `engine/lib/board-read.ts`, `engine/lib/board-read-types.ts`, `engine/lib/fields.ts`,
  `engine/board/perimeter.ts`, `engine/board/requests.ts`, `engine/board/reads.ts`, `engine/board/place.ts`,
  `engine/board/presses.ts`, `engine/board/README.md` ("The trust boundary"), and `scripts/verify.ts`
  (`checkImports`).
- Labels in this record: "Q1" and "Q2" name the decisions of the maintainer in the issue #269.

## Supersedes

Only these clauses change. The accepted records keep their historical text and evidence.

- [ADR-0035](0035-the-board-is-a-part-of-the-engine.md), "The data module of the board
  (`engine/board/data.ts`)" and "`readBoard(main, signal)` of `engine/board/data.ts`": the read of the issue
  document, of the history, and of the agent state lives in `engine/lib/board-read.ts`. `engine/board/data.ts`
  and `engine/board/history.ts` are gone.
- [ADR-0035](0035-the-board-is-a-part-of-the-engine.md), "`AGENTS.md`, "The board", now names
  `engine/board/server.ts` and the fixed adapter `engine/board/adapter.ts`": `engine/board/server.ts` is gone.
  The trust files are in `engine/board/README.md`, "The trust boundary".
- [ADR-0081](0081-the-resolver-and-the-updater-are-libraries-and-no-library-imports-a-command.md), decision 1,
  "`engine/board/data.ts` uses the rows as they are": the read model `engine/lib/board-read.ts` uses the rows
  as they are. The rest of decision 1 stays.
- [ADR-0082](0082-every-github-call-goes-through-the-tracker-port.md), "The one exception is
  `engine/board/history.ts`": the exception now lives in `engine/lib/board-read.ts`, which calls the exported
  `parseIssue` for the History read.

## Context

Before this change, the server modules of `engine/board/` imported 29 modules of `engine/lib/`, 24 of them with
value imports. The read side reached the resolver, the tracker, the workflow, the operation, the queue store, the
quota recovery, the agent order and usage, the step end, the state layout, Git, the visual pages, the refresh
hints, and the process identity. A change of the runner state often edited the board.

`engine/board/server.ts` had 1028 lines. `createBoard` was one closure that mixed the HTTP perimeter, the request
validation, the read schedule of the issue document, the placement of the cards, and the press controller. The
board also held copies of field checks that `engine/lib` held too: the order version, the UUID, the host, the
revision, the commit, and the issue number.

The prior art gives one pattern for each part. A port gives the application one conversation with each external
actor (Alistair Cockburn, hexagonal architecture). Syncthing and Jupyter Server run the perimeter checks before
any route, and a handler parses the request before a manager acts. "Parse, don't validate" parses input at the
boundary. The project has no package dependency, so the field checks stay hand-written functions.

## Decision

1. **The read port.** `engine/lib/board-read.ts` holds each read of runner and tracker state that the board
   makes: the issue document (`readBoard`, `readBoardTargets`), the agent state (`readAgentState`), the History
   read, the queue record and owner (`readQueueState`, `queueReadView`), the step ends (`readStepEnds`), the lane
   folder (`laneOf`), the lane root test (`isInside`), the `git diff --shortstat` of a session folder
   (`readDiff`, with the `exec` of `createBoard` as a parameter), the visual page test and read
   (`hasVisualPage`, `readVisualPage`), and the Git common directory and the refresh hints it re-exports. It is
   built on the resolver library. The types of the document move to the node-free
   `engine/lib/board-read-types.ts`, which `engine/board/types.ts` re-exports. The library does not import
   `engine/board/`.
2. **Five modules.** `server.ts` is replaced by `perimeter.ts` (the HTTP perimeter and `createBoard`),
   `requests.ts` (one parser for each POST body, which returns a typed `BoardRequest` or a 400 refusal),
   `reads.ts` (the cached issue document and its read schedule), `place.ts` (the placement of the cards, with
   `createPlacement`), and `presses.ts` (the press bookkeeping and each press). `createBoard` keeps its
   parameters. It wires the modules in this order: `createReads`, then `createPressBook`, then
   `createPlacement`, then `createPresses`. No module imports a module that imports it.
3. **The field module.** `engine/lib/fields.ts` is node-free and holds the patterns `uuid`, `orderVersion`,
   `revision`, and `commit`, and the checks `isHost`, `isCommit`, `isIssueNumber`, and `isIssueField`. Each copy
   in `engine/` with the same accept set and the same meaning imports it (Q1). A copy with another accept set or
   another meaning stays where it is.
4. **The trust files.** `engine/board/README.md`, "The trust boundary", maps each rule to the files that
   enforce it. `AGENTS.md` and `PRODUCT.md` name the same files.
5. **The check.** `checkImports` of `scripts/verify.ts` keeps the rule of ADR-0081. It also refuses, in
   `engine/board/{perimeter,requests,reads,place,presses,view,start}.ts`, each value import of
   `engine/lib/{resolver,tracker,operation,quota-recovery,agent-usage,step-end,refresh-hints,git,workflow}.ts`,
   with or without `.ts` in the specifier (Q2). The message is
   `<file>:<line>: A read-side board module reads engine state through engine/lib/board-read.ts, not engine/lib/<name>.ts (ADR-0087).`
   The check finds the statement of a specifier by walking back from the specifier to the nearest `import` or
   `export` word. A statement whose word after that keyword is `type`, and whose next word is not `from`, is
   type-only. For an `import('<module>')`, with or without `typeof` before it, the check asks
   `Bun.Transpiler` (`scanImports`, loader `ts`) whether the erased program of the file still imports the
   specifier dynamically. It refuses each `import(` of that specifier when the erased program does, and passes it
   when it does not. Every other import form that the tokenizer reads, `require(` too, is a value import.

## Alternatives considered

- **Put the reads into `resolver.ts`.** Rejected: the resolver resolves the next step of an issue, and the board
  also needs the history, the flow, the agent state, the step ends, the queue owner, and the lane folders.
- **Read the board state from the daemon status.** Rejected: the daemon serves the board in its own process
  (ADR-0077), so a status call adds a request shape and no isolation that a module does not give.
- **One module for each route.** Rejected: the routes share the press bookkeeping and the read schedule, so one
  state would spread over many files.
- **A field home inside `engine/board/` only.** Rejected: the same checks have copies in `engine/lib`, so a board
  home leaves two homes of one rule.
- **A schema library.** Rejected: the project has no package dependency.

## Consequences

**What improves.** The read side reads runner and tracker state through one module, and the gate refuses a
direct read. Each shared field check has one home. `createBoard` has five modules with one concern each, and each
rule of "The trust boundary" names its files.

**The limits of the check.** A probe ran `checkImports` on the tracked `.ts` files of the lane, with one file
replaced by the probe text. Each sentence below states the observed result.

- The check refuses `import { readStepEnd } from '../lib/step-end.ts';` in each of the seven modules
  `perimeter.ts`, `requests.ts`, `reads.ts`, `place.ts`, `presses.ts`, `view.ts`, and `start.ts` of
  `engine/board/`. The message names `engine/lib/step-end.ts`.
- The check refuses `import { x } from '../lib/<name>';` in `reads.ts` for each of the nine names, with no
  `.ts` in the specifier.
- The check passes `import type { StepEndRecord } from '../lib/step-end.ts';` in `presses.ts`, and
  `export type { Lane } from '../lib/workflow.ts';` in `presses.ts`.
- The check refuses `import { type StepEndRecord } from '../lib/step-end.ts';` in `presses.ts`. Bun 1.4.4
  `bun build --no-bundle` on `import { type X } from './m.ts';` gave the output `export const y = 1;`, with no
  import of `./m.ts`. So the check refuses a form that Bun removes from the output.
- The check refuses `import '../lib/git.ts';`, `export { commonDir } from '../lib/git';`,
  `const x = await import('../lib/tracker.ts');`, and `const x = require('../lib/workflow.ts');` in
  `presses.ts`.
- Bun 1.4.4 `scanImports` gave `[]` on each of these six type forms:
  - `export type X = typeof import('../lib/git.ts');`
  - `type Y = { a: typeof import('../lib/git.ts') };`
  - `let x: typeof import('../lib/git.ts') | null = null;`
  - `export type G = import('../lib/git.ts').Exec;`
  - `let g: import('../lib/step-end.ts').StepEndRecord | null = null;`
  - `type M = ReadonlyMap<number, import('../lib/step-end.ts').StepEndRecord>;`
- Bun 1.4.4 `scanImports` gave one `dynamic-import` of the specifier on each of these four forms:
  - `const t = typeof import('../lib/git.ts');`
  - `console.log(typeof import('../lib/git.ts'));`
  - `const m = import('../lib/git.ts');`
  - `await import('../lib/tracker.ts');`
- In `presses.ts`, the check passes each of the six forms that gave `[]`. It refuses each of the four forms that
  gave a `dynamic-import`.
- The check decides for each specifier of a file, not for each `import(`. A file with a type form of
  `'../lib/git.ts'` on line 1 and a kept `import(` of `'../lib/git.ts'` on line 2 gave an error on line 1 and an
  error on line 2, for each of these line 1 and line 2 pairs:
  - `type Y = { a: typeof import('../lib/git.ts') };` and `const t = typeof import('../lib/git.ts');`
  - `export type G = import('../lib/git.ts').Exec;` and `const m = import('../lib/git.ts');`
  - `type Y = { a: typeof import('../lib/git.ts') };` and `const m = import('../lib/git.ts');`

  So a type form is refused when the same file keeps an `import(` of the same specifier. When the kept `import(`
  names another specifier, the type form passes: `export type G = import('../lib/git.ts').Exec;` on line 1 and
  `const s = import('../lib/step-end.ts');` on line 2 gave one error, on line 2. A static value import does not
  make the check refuse a type form: `import { x } from '../lib/git.ts';` on line 1 and
  `export type G = import('../lib/git.ts').Exec;` on line 2 gave one error, on line 1.
- The check refuses a named list over four lines, `import {`, `a,`, `type B,`, `} from '../lib/resolver.ts';`,
  in `reads.ts`, and gives the line of the specifier (`engine/board/reads.ts:4:`). It passes a list over three
  lines that starts with `import type {` and names `'../lib/resolver.ts'`.
- The check passes `import { readQueue } from '../lib/queue.ts';` in `place.ts`, and
  `import { x } from '../lib/state.ts';`, `import { x } from '../lib/visual.ts';`, and
  `import { x } from '../lib/agent-order.ts';` in `reads.ts`. So a new read from `queue.ts`, `state.ts`,
  `visual.ts`, or `agent-order.ts` passes (Q2). These modules hold pure checks that the read side needs.
- The check passes `import { commonDir } from '../lib/git.ts';` in `engine/board/adapter.ts`, and
  `import { commonDir } from './git.ts';` in `engine/lib/board-read.ts`. The write port, the update side, and the
  library are outside the rule.
- The check gives no error for the lane tree as the lane holds it.
- The rule of ADR-0081 still refuses: `import { run } from '../daemon.ts';` in `reads.ts` gave one error, the
  message of ADR-0081.

**What gets harder.** A read-side module that needs a new read of engine state adds a function to
`engine/lib/board-read.ts`. The read side has no other path.

**Open.** The check reads a relative specifier of a module in the list above. It was not probed on a specifier
that is not relative.

## Reconsider when

- The read side needs a read of `queue.ts`, `state.ts`, `visual.ts`, or `agent-order.ts` that is not a pure check.
  Then the list of refused modules grows.
- The board gets a second server process, or the daemon stops hosting it (ADR-0077).
- A schema library enters the project, and the field module can become a set of schemas.
