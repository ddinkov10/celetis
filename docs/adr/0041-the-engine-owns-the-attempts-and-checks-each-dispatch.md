# The engine owns attempts and records agent-reported execution

## Date

2026-10-27

## Related

- [Issue #104 and its revised spec](https://github.com/ddinkov10/celetis/issues/104).
- [Revised plan](https://github.com/ddinkov10/celetis/issues/104#issuecomment-6447762840).
- [Independent native enforcement, #151](https://github.com/ddinkov10/celetis/issues/151).
- [ADR-0014](0014-one-workflow-uses-explicit-host-operations.md): retain the child; stop unsupported pair changes.
- [ADR-0016](0016-automation-is-required-on-cli-hosts-only.md): required CLI surfaces and their limits.
- [ADR-0019](0019-a-codex-child-with-no-profile-keeps-the-parent-model.md): omit the model in parent-model mode.
- [ADR-0029](0029-the-repository-keeps-no-tests.md): scratch checks stay outside the checkout.
- [ADR-0036](0036-the-engine-enforces-the-lifecycle-and-the-landing.md): GitHub remains workflow state.
- [ADR-0040](0040-the-planner-chooses-the-build-flow.md): retain the inline/subagent split.
- `engine/lib/capability.ts`, `engine/lib/dispatch-record.ts`, `engine/dispatch.ts`, and `skills/implement/SKILL.md`.

## Context

The hook-based build below centralized counters and task order, but the installed Codex could
not check its native spawn route. The maintainer revised #104 to separate engine bookkeeping
from independent native enforcement. The old build and its acceptance do not establish the
new report protocol. The new build starts from the completed scorer, storage, and task-order work.

## Decision

**One engine owns counters and report validation.** Keep the shared scorer's arithmetic and
`capscore` contract. `dispatch` owns attempts, review fix rounds, issued actions, pair resolution,
worker identities, and task order. Counts belong to a host session; a repeated task cannot reset
them. GitHub remains workflow state and `engine/lib/workflow.ts` remains pure.

**Execution is agent-reported.** After each engine-issued native call, the agent submits
`dispatch report <dispatch-id> <report-file>` with its host/session, exact tool arguments, raw
native result, and outcome. Every execution has `provenance: "agent-reported"`. The engine checks
the report against the issued action and stores it immutably. A disagreement stops for setup.
It cannot undo a worker that has started, intercept a native call, or prove a consistent false
report true. No synthetic allowed check or native event is retained. Independent enforcement
belongs to #151. Remove the dispatch-specific native handlers and Codex hook declaration;
preserve native entry, custom text, permission rules, and denied-read behavior.

Both hosts require a usable returned worker identity. A stable task name is sufficient when the
native follow-up takes that name. Requested settings remain separate from reported native
settings. Preserve concrete model IDs verbatim, and keep unavailable settings null. Never infer
applied effort from an argument or a concrete model from inheritance.

Only a matching explicit tool failure that establishes `noWorkerStarted: true` permits a retry.
The fresh dispatch preserves the failed evidence, action, attempt, round, and resume identity.
An uncertain error or missing identity is incomplete and cannot later become a retryable failure.
An unknown ID, replay, wrong session, or malformed report cannot replace earlier evidence.
Pending reports stop later task acts. A mismatch or unsupported-operation report stops dependent work.

**Native tools remain the agent's duty.** Use isolated child starts and actual model/effort
controls; omit a null Codex model. Keep the parent settings. Apply the issued CAP line first.
Same-pair repairs and scoped re-reviews retain the child with `SendMessage` on Claude or
`collaboration.followup_task` on Codex, when the active schema supports them. A missing operation
is reported with `call: null` and outcome `unsupported`; keep the child and stop. A changed pair
on a recorded child stops before issue because neither observed follow-up supports pair controls.
Calls outside the Celetis task loop need no report and are neither intercepted nor recorded.

**Task order needs fresh reports.** A normal reviewer requires a fresh gate pass after the latest
successfully reported implementer and every adverse result. Initial `final` needs no implementer.
Close requires current successful execution evidence and, after a fix, a fresh gate and reviewer.
Failed, unreported, incomplete, mismatched, or stale evidence cannot close work. Gate failures
advance attempts through 2 and 3; attempt 4 stops. Review rounds 1–3 retain the implementer/pair;
4–5 and `BLOCKED` permit engine-issued replacement at the attempt-3 pair. A further adverse review
is saved and stops the task without round 6. Report failures change neither counter.

The subagent loop and fixes after the final review use `dispatch` on both hosts. Inline tasks
and their final fix pass run in the session; their final reviewer uses `capscore`. `critic-loop`
and the builder check of `specify` keep their own rules. Keep the existing private record
storage, atomic writes, locks, and one strict shape. The unfinished hook shape has no migration.

## Current acceptance

The revised V3/V4 checks passed on 2026-10-27 at checkout commit
`20cfca70c19ddcc1107d33a15d28e47b9f987140`. Claude Code 2.1.311 used session
`111456dd-fe10-4cc6-81f0-a009f4c8540d`; codex-cli 0.164.0 used
`01a17e5d-1f5c-7e00-968b-e8e75bf05c94`. Each host closed the normal task and the stable-pair
task after real gate repair, review fix, and scoped re-review. Each changed-pair request stopped
with setup exit 5 before a resume or replacement. Every execution retains agent-reported provenance.

[Acceptance status](../../plugins/celetis/docs/workflow.md#acceptance-status) records the exact child identities,
native arguments/results/completion checks, evidence paths, scorer results, and source boundary.
The evidence root is `/tmp/celetis-104-report-check/`; `live/*-checked.json` retains the checked
identities and sessions. The historical hook-based V5 remains FAIL/STOP and is superseded by the
revised scope. Changed-pair follow-up and live Windows lock execution retain their limits.
These checkout results do not prove an installed-package update or independent native enforcement.

## Alternatives considered

- Keep native hook enforcement as a prerequisite: this blocks both-host bookkeeping on an unproved Codex route.
- Let the engine start headless workers: this replaces the native in-session children and exceeds this scope.
- Keep hook and report modes: this adds a second protocol without improving the revised guarantee.
- Accept warnings or substitute workers after mismatches: this loses identity and evidence. Stop instead.

## Consequences

The engine owns deterministic bookkeeping, while agents still own native calls and accurate reports.
A consistent false report can pass. The report provenance makes that limit explicit. Ordinary child
tools can use the same bookkeeping on both hosts without new hook trust. A new host session starts
a fresh count. Missing host capabilities remain explicit stops, not replacement permissions.

## Reconsider when

- A supported native interception route is proved for #151.
- A follow-up tool can apply the required changed pair to the same child.
- A host supplies additional trustworthy applied-setting evidence.

## Historical hook-based decision and evidence — 2026-10-27

The following records the earlier decision and results. The current decision above replaces its
hook prerequisite, null Codex identity allowance, and unconditional Codex resume stop.

### Context

The scorer resolved one pair, but prompt text owned the attempts, fix rounds, child identities,
and gate order. A CAP line showed the requested pair. It did not prove which arguments a spawn
tool received. A second task loop also counted fix rounds. These separate procedures could drift
and silently replace a child or omit an effort argument.

The maintainer chose approach B: one engine issues each dispatch and a thin host hook checks the
real call. The agent keeps the choice and applies the settings. The engine does not start a
worker or change its settings.

### Constraints and evidence

The arithmetic and its order stay: sum, band, floors, bias, escalation, clamp. `capscore` keeps its
public output and exits. Attempts belong to one host session. GitHub remains the workflow store,
and `engine/lib/workflow.ts` stays pure. The Claude adapter stays in the existing native module.

On 2026-10-27, the checkout at `9afc18d2a17ad014a823ea1e4a80802e412ef0cc` ran live checks with
Claude Code 2.1.311 and codex-cli 0.164.0, using the existing installations and authentication.
The scratch checkouts, prompts, stream transcripts, native Codex trace, and copied record JSON
are in `/tmp/celetis-104-check/live/`. `evidence.json` holds the checked values. The
[Acceptance status](../../plugins/celetis/docs/workflow.md#acceptance-status) keeps the exact refusal and exit lines.

- **V3 passed.** Claude loaded the checkout with `--plugin-dir` in auto mode. Its session
  `b79161a6-b7e1-4870-a630-4830a087a653` equals the shell session and record session. Agent calls
  with `model: "haiku"`, `effort: "low"` recorded children `a75c095040e4a37ec` and
  `a95cb69ec28e0d84f`, with reported model `claude-haiku-5-5`. The deliberate `effort: "high"`
  call was refused with `the spawn effort must be low`. The next request named and voided that
  dispatch. A spawn with no dispatch line started child `ab1b8c98e30123a9d` and left no entry.
  A checked SendMessage resumed `a75c095040e4a37ec` with outcome `started`. A message to that
  child with no dispatch line was refused with
  `` a message to a recorded child needs a dispatch line from `dispatch next` ``. Each started
  outcome has `effort: null`; the record does not infer applied effort from the argument.
- **Both V4 cases passed.** With no checkout handlers, Claude spawned `adb7155424fc95fa0` with
  `haiku` and `low`; the next command exited 5 and named the missing mod check. Codex's real
  `spawn_agent` call omitted `model`, set `reasoning_effort: "low"` and `fork_turns: "none"`,
  and returned `/root/runtime_check`. The native activity links it to child thread
  `01a17d70-081e-7962-bf6d-35f4e78e8171`. Its next command exited 5 and named hook trust and a
  fresh session. Both records retain `check: null` and `outcome: null`. The Codex command wrote
  its record under `/tmp/celetis-501/dispatch/` in `workspace-write` without an inner approval.
- **V5 later failed.** The trusted direct-spawn run on codex-cli 0.164.0 at `dda6d24` started `/root/runtime_check_a` in session `01a17e09-b7a1-70e3-8c04-d1802bfdd1f9`, but no hook ran. Its next act exited 5 with missing hook evidence. The code-mode probe in session `01a17e18-31ef-75f2-a39d-78f7356bce85` found no nested spawn tool. Evidence: issue comments [6446729138](https://github.com/ddinkov10/celetis/issues/104#issuecomment-6446729138) and [6446922098](https://github.com/ddinkov10/celetis/issues/104#issuecomment-6446922098), `/tmp/celetis-104-check/live/v5-codex.*`, and `replan-code-mode.*`. The revised spec supersedes the hook requirement; these results remain FAIL/STOP.

The first sandboxed Claude start returned `Not logged in · Please run /login`. The first
sandboxed Codex start returned
`Error: failed to initialize in-process app-server client: Operation not permitted (os error 1)`.
One approved retry of each same command used the existing authentication and completed. No login,
trust change, installed-package update, or bypass flag was used.

Task 3 checked real POSIX locks and a controlled FFI fixture of the production Windows helper.
The helper opens and checks the same handle before descriptor transfer. No live Windows DLL,
filesystem, reparse point, descriptor conversion, or `LockFileEx` execution was checked. The
fixture is not live Windows acceptance. Installed Codex hooks and the installed Claude mod also
remain the two checks of the plan's "After the landing" section.

### Decision

**One engine owns the counters and evidence.** Decisions 1 to 4 of the spec apply. The agent keeps
the choice of model and effort and applies them through the actual tools. The shared resolver
owns the arithmetic. The session record owns attempts, fix rounds, gate and review results,
dispatch IDs, real arguments, and child identities. A disagreement is a typed stop. The parent
model and effort stay unchanged.

**The task loop asks for each act.** On the subagent flow, the implementer, task reviewer, final
whole-branch reviewer, and final fix wave use `dispatch`. Verify and landing fixes use this loop
on both flows. Inline tasks run in the session, and their final reviewer uses `capscore` under
ADR-0040. `critic-loop` and the builder check of `specify` retain their own rules and `capscore`.
Plan tasks use their number; the subagent final review uses `final`; Verify and landing fixes
use `verify-<k>` and `land-<k>`. A new session starts at attempt 1. Repeating a task in the same
session cannot reset it.

A failed gate advances the attempt and stops at attempt 4. Fix rounds 1 to 3 resume the same
implementer with the same pair. Rounds 4 and 5, and a `BLOCKED` report, issue and record a fresh
implementer on the pair of attempt 3. An adverse review after round 5 is recorded and stops the
task without starting round 6. Its history makes every later task act stop, and validation
rejects a history that continues after it. A refused or failed tool call does not advance an
attempt or round.

**Each call has a checked identity.** Every spawn and every message to a recorded child gets a
new dispatch ID. The hooks read the actual call and return it unchanged when allowed. They refuse
an unknown or used ID, a wrong pair, an unapproved replacement, or a wrong resume target. An
unknown ID creates no fabricated dispatch. A replay preserves the original check and outcome;
it cannot erase the child identity or make a successful dispatch eligible for replacement.
Codex accepts the actual fork schema, `none` or `all`; `all` is a fork and malformed values
refuse. A call with no dispatch ID passes unchanged and leaves no entry, except that a message to
a recorded Claude child requires a new line.

A refused or failed issued dispatch can be voided by the next request for that role, which names
the old ID. An issued dispatch with no check, or an allowed call with no outcome, stops the next
act for setup. Thus an absent, untrusted, or failed hook cannot supply successful evidence.

A Claude spawn or replacement needs a nonempty child ID to supply success. An outcome without
that identity retains the host fields with `result: "incomplete"`; it is not retryable and every
later task act stops for setup. Later outcome events preserve this evidence. Leaving the outcome
null would let a later failure event make it retryable; marking it failed would permit a fresh
worker while the original may exist. This result value adds no field, schema migration, or
parent setting change. Validation rejects a saved Claude success without an identity and an
incomplete result on a Codex call or resume. A known name in incomplete evidence keeps the
no-ID message guard; it cannot provide a route to continue the possible worker. Unrelated
no-ID calls keep their existing behavior. The explicit Codex R2 fallback still accepts a null
child with its raw response, and every Codex resume still stops.

**A follow-up keeps the child.** A changed pair on a recorded child stops for setup: Claude's
SendMessage has no pair controls. Codex returns the explicit setup reason
`Codex has no follow-up tool that the dispatch hook checks` before issuing a resume. A desktop
collaboration tool does not establish CLI hook support (R7). These stops preserve ADR-0014 and
leave the changed-pair CLI acceptance of ADR-0016 open.

**Review and close need fresh evidence.** A reviewer needs a gate pass after the latest
implementer dispatch and adverse gate or review result. The first final reviewer needs no prior
implementer or gate. Close needs the recorded children and current gate/reviewer evidence; a
failed gate or findings/blocked report makes older evidence stale, even after a setup stop. A
closed task refuses another request; a deliberate new task uses a new ID.

**The record is local evidence.** POSIX stores it at
`/tmp/celetis-<uid>/dispatch/<host>-<session>.json`, in private user-owned directories with mode-0600
record and lock files. It uses a lock and atomic replacement. The POSIX path is fixed instead of
using `TMPDIR`: the Codex shell sandbox and hook process must select the same writable location
(R10). The Git common directory is outside a lane's writable sandbox. Windows uses the host's
temporary directory under `celetis/dispatch/`. Neither host reads another session's record, and
`dispatch` writes nothing to GitHub. A record failure stops the dependent act.

### Alternatives considered

- **A: the agent reports each dispatch.** Smaller and needs no hooks, but a wrong report can
  pass. It does not prove the actual tool arguments.
- **C: the engine starts each child through a CLI.** It removes the agent's choice and replaces
  the in-session child of the task loop with a headless process.
- **A hook sets the pair itself.** The maintainer deferred this layer. This change checks and
  records the call without changing it.
- **A warning for a mismatch, a lower pair, or a substitute child.** These let the procedure
  continue without the required settings or identity. The engine returns a stop instead.

### Consequences

The task loop has one owner for attempts and rounds. A CAP line is a key into checked evidence,
and each allowed call retains its original identity. Fresh gate and review evidence prevents a
close after a later failure. Standalone scoring keeps its current contract.

Both hosts need working hooks for this loop. Codex needs a human trust act. Unsupported
follow-ups stop the task even when other work can proceed. A new host session deliberately starts
a new count; it cannot recover another session's local record. Applied effort remains unknown
when the host does not report it. V5, installed-package checks, changed-pair repair, and live
Windows lock execution retain their stated evidence limits.

### Reconsider when

- A host supplies a follow-up tool that sets the required model and effort on the same child.
- Codex supplies a follow-up tool that its hooks observe.
- A host reports the applied effort of a child.
- Codex documents the child ID and call linkage in `PostToolUse`.
