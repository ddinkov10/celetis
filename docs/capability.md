# Capability gates (model+effort per task)

Second routing axis, beside **type** (the four `/celetis:bug` `/celetis:hotfix` `/celetis:feature`
`/celetis:chore` entry commands). At **every dispatch point** a scored rubric decides which model
tier and effort level executes the next task. Digit assignment is agentic (judgment — unavoidable);
digits→tier arithmetic is deterministic and lives in `celetis --agent <host> capscore` (the doc is the
spec; the script is the authority for the math — they must agree).

The sum is an allocation heuristic that combines difficulty and the consequence of a defect,
not a measurement of difficulty or a probability of success. [The approved design of #227](https://github.com/ddinkov10/celetis/issues/227)
records all seven change-or-retain decisions. The maintainer delegated research-based decisions;
the agent chose the rules, and the maintainer approved the written design. Historical score
frequencies do not establish model quality, optimal bands, or savings.

## The rubric — six dimensions, each 0–2

Score the actual delegated task after reading its scope and acceptance criteria. Separate work
already decided in the approved spec from decisions the worker still has to make. Score each
dimension once; do not increase a digit to force a desired tier.

| Dimension | 0 | 1 | 2 |
|---|---|---|---|
| **J** judgment | Exact transformation or prescribed action; no material choice remains. | Bounded implementation or editorial choices within an agreed design. | Material unresolved trade-offs, conflicting requirements, or architecture/policy decisions. |
| **V** verification gap | Executable checks cover the decisive acceptance outcomes. | Executable checks cover only part of the acceptance; substantive review is also needed. | The decisive outcome has no reliable executable oracle and depends on judgment. |
| **B** consequence of a defect | No product behavior, authority, or retained-data effect; for example a mechanically checked non-normative text correction. | A bounded, reversible effect in one behavior or component. | A shared behavioral rule, cross-workflow effect, data loss/corruption risk, or authority boundary with substantial consequences. |
| **N** novelty | Use an existing solution or exact pattern without a new mechanism. | Adapt an existing pattern to a materially different case. | Introduce a mechanism or design with no suitable project precedent. |
| **S** coupled scope | One local behavior/invariant, or an identical mechanical transformation at many locations. | Several interacting behaviors inside one established contract/subsystem. | Coordinated changes across contracts/subsystems, or a state model with several interacting invariants that must change together. |
| **X** security | No security-relevant semantics; ordinary content hashing alone belongs here. | Work beside an existing security boundary while preserving its established decisions. | Change authentication, authorization, secret handling, cryptographic security, or a trust/permission decision. |

B2 needs a named affected behavior and failure consequence. A shipped file, skill, or public
document is not enough. A skill changing permission or workflow policy can still be B2. J2 needs
the unresolved decision. N2 needs the missing precedent. S2 needs the coupled contracts or
invariants. X2 needs the security decision that changes.

V0 requires relevant behavioral checks. A static verify gate alone does not establish V0 for
agent behavior. A small diff does not establish low S, and a large mechanical diff does not
establish high S. Use no file-count or changed-line thresholds.

These contrasts apply regardless of the file type:

- An exact wording correction can be J0; unresolved policy design can be J2.
- A digest used only to detect stale content is X0; a signature or digest whose acceptance grants
  authority is not automatically X0.
- Eleven identical mechanical edits can be S0; one state machine with interacting invariants
  that must change together can be S2.
- Static checks can validate file structure; only checks of decisive behavioral outcomes support
  V0 for behavior changes.

Read the relevant source when scope evidence is missing. If it remains unavailable, state the
uncertainty and use the highest digit supported by a plausible, explicitly described in-scope
consequence. Do not invent a security concern, label unknown code harmless, or treat missing
tests as adequate verification. Normal task blocks stay separate from the arithmetic.

## Bands (sum 0–12)

`0–3 → haiku/low` · `4–6 → sonnet/medium` · `7–9 → opus/high` · `10–11 → opus/xhigh` · `12 → fable/max`

Model tiers (low→high): **haiku · sonnet · opus · fable**. Effort tiers (low→high): **low · medium ·
high · xhigh · max**.

Fable is reached only at Σ=12 or by attempt-3 escalation from opus. These bands remain an
intentional allocation policy under #227, not a vendor performance or pricing result. Changing
them requires outcome evidence; a concentration of scores in one band does not justify a target
percentage for cheaper models.

## Floors (beat the sum, never lower it)

- **X=2** → min **opus/high**
- **V=2** → min effort **high**

## Effort bias

`--bias N` (script flag) / `CAP_EFFORT_BIAS` (env fallback) raises **effort** by N tiers. **Model is
never biased.** **Default 0**. An empty environment value also uses 0. A newly selected nonzero
bias needs a task reason under "Scorecard format — MANDATORY".

`--bias` and `CAP_EFFORT_BIAS` accept safe integers from 0 through 9007199254740991.
The CLI bias takes precedence over the environment. `--attempt` accepts safe integers from 1
through 9007199254740991. Unsafe values fail before scoring, output, or optional profile lookup.
A non-string `reviewer.effort` is an error.

**Application order:** sum → band → floors → bias → escalation → clamp.

**Clamp (final invariant):** effort ceiling is **max**, EXCEPT a **fable** result caps at **xhigh**
unless Σ=12 — `fable/max` is **reserved for Σ=12**. Explicit bias and escalation can still raise
an opus result to max.

## Escalation (deterministic, gate-fail count within one task)

- attempt 2 → effort **+1 tier**
- attempt 3 → model **+1 tier**, effort **≥ high**
- attempt 4 → **STOP**, escalate to the user with the failure trail

In the task loop of `implement`, `dispatch` owns the attempt count and applies this escalation.
The count is session-scoped; a new session starts at attempt 1. Other consumers pass their attempt
to `capscore`. The clamp still applies to escalation output: escalation never mints `fable/max`
below Σ=12.

## Scorecard format — MANDATORY

Every dispatch prompt **and** every plan task header carries the emitted CAP line, immediately
followed by an authored `CAP reason:`:

```
CAP: J1 V1 B1 N1 S1 X0 = 5 → sonnet/medium
CAP reason: J1 covers a bounded option implementation. V1 reflects partial behavioral checks. B1 limits a defect to one reversible command behavior. N1 adapts the command's existing option pattern. S1 covers its interacting local options.
```

The reason names evidence for every nonzero digit, grouping related evidence where clear. Explain
a potentially misleading zero, such as X0 for a content digest that grants no authority. Include
the task reason for a newly selected nonzero bias; the emitted line shows it as `+bN` before the
arrow. The reason is prose, not a CLI argument, JSON property, dispatch-record field, or parser
input. It changes no byte of the emitted CAP line.

Published digits and explicit bias remain execution inputs. Reuse a supported existing reason,
or explain those unchanged inputs from available task evidence. Mark missing historical evidence
instead of inventing it. Re-score only changed scope; a new rubric or host does not reinterpret
old tasks. An absent `+bN` in a published line means bias 0.

For plan headers and children outside the task loop of `implement`, generate the line with
`capscore` (do not hand-compute the tier). The task loop takes its line from `dispatch`
([Dispatch records](#dispatch-records)).

```bash
celetis --agent <host> capscore J V B N S X [--attempt N] [--bias N]
```

## Who must score, when — the consumption rule

Score **before every dispatch of work to a model**, and put the resulting CAP line where that model
will read it:

- **Lane skills** (`bug|hotfix|chore|feature`) — score before any subagent dispatch; the CAP
  line goes in the dispatch prompt.
- **`implement`** task loop — reuse the task's digits and bias with `dispatch next`; send each
  returned dispatch's CAP line first. `dispatch` owns gate repairs, review fixes, and task closure
  on the subagent flow and for fixes after the final review ([Dispatch records](#dispatch-records)).
  On the inline flow, the session builds each task, so the plan's CAP lines are recommendations
  (**Plan headers**); its final reviewer uses `capscore --json`.
- **Other child spawns**, including `critic-loop` and the builder check of `specify` — resolve
  the host binding with `capscore --json` and include its CAP line in the prompt; the actual
  spawn applies the effort, and the model when `dispatch.model` is not null, through the actual
  spawn controls of the host ([the child dispatch](procedures/dispatch.md), "One child").
- **Plan headers** — print the CAP rec on session-executed tasks. Note: the **session model is the
  user's picker**; the rubric can only *recommend* there (max is auto-assignable for a spawn, a rec
  for the session). The user may override any rec. A runner or board start of a step session gets
  the effort level that the step before decided on the issue, else `high`, not a rubric band
  (`docs/celetis-flow.md`, "Start the script", "The effort level"); the rubric still only
  recommends the session model.

## Worked examples (explicit bias 0, attempt 1)

These specified task shapes illustrate the anchors, not model success. Each pair uses the
scorer with `--agent claude --bias 0`; each reason states the assumptions behind its digits.

**Exact text correction.** Apply a prescribed non-normative correction at eleven README locations.

```text
CAP: J0 V0 B0 N0 S0 X0 = 0 → haiku/low
CAP reason: The transformation is exact, checks cover every correction, and no behavior or retained data changes. Eleven identical edits are S0; publication adds no consequence by itself.
```

**Tiny helper.** Adapt a content-change digest helper within a fixed local contract.

```text
CAP: J1 V0 B1 N0 S0 X0 = 2 → haiku/low
CAP reason: J1 covers bounded implementation choices. B1 covers reversible content-change detection errors in one helper. Complete behavior checks support V0; an exact established pattern supports N0 and one contract supports S0. X0 applies because the digest grants no authority and handles no secret.
```

**Bounded command option.** Extend one established command with several interacting options.

```text
CAP: J1 V1 B1 N1 S1 X0 = 5 → sonnet/medium
CAP reason: J1 covers bounded implementation choices. V1 reflects partial behavioral checks. B1 limits a defect to a reversible command behavior. N1 adapts an existing option pattern to a different case. S1 covers interactions inside the command contract.
```

**Approved capture policy.** Apply a decided policy across workflow contracts, as in the
specified implementation shape of #189 Task 3, without rescoring its historical task.

```text
CAP: J1 V1 B2 N1 S2 X0 = 7 → opus/high
CAP reason: J1 covers bounded choices inside the approved policy. V1 reflects partial executable coverage. B2 covers missed capture across workflows. N1 adapts an existing capture pattern. S2 couples task and repair contracts. X0 preserves stop and authority decisions.
```

**Storage and recovery design.** Coordinate a new storage state model and recovery behavior.

```text
CAP: J2 V0 B2 N2 S2 X0 = 8 → opus/high
CAP reason: J2 covers unresolved storage/recovery trade-offs. B2 covers retained-data loss or corruption. N2 assumes no suitable project mechanism. S2 couples storage and recovery invariants. Complete executable outcome checks support V0; no authentication or trust decision changes, so X0.
```

**Permission decision.** Implement one prescribed permission rule within one local contract.

```text
CAP: J1 V0 B2 N0 S0 X2 = 5 → opus/high
CAP reason: J1 covers a bounded implementation choice. B2 covers an incorrect authority grant. X2 changes the permission decision. Complete checks support V0 and an existing mechanism supports N0. The local scope is S0, which does not remove the security floor.
```

**Judgment-based editorial choice.** Make a bounded editorial choice with a reversible effect.

```text
CAP: J1 V2 B1 N0 S0 X0 = 4 → sonnet/high
CAP reason: J1 covers bounded editorial choices. V2 applies because decisive acceptance depends on judgment without a reliable executable oracle. B1 limits a defect to one reversible behavior. The task uses an existing pattern and one local contract with no security semantics.
```

**Novel authority design.** Resolve coupled authority rules without a reliable executable oracle.

```text
CAP: J2 V2 B2 N2 S2 X2 = 12 → fable/max
CAP reason: J2 covers unresolved authority-policy trade-offs. V2 lacks a reliable oracle for the decisive outcome. B2 covers incorrect grants across workflows. N2 assumes no suitable project precedent. S2 couples permission and recovery contracts. X2 changes trust decisions.
```

## Outcome evidence procedure

The objective is the lowest total cost that meets the task's quality requirement, including
review and repairs. The anchors and equal-weight sum are not empirically calibrated. Lower
allocations may increase repairs, and reasons make subjective scores reviewable without removing
judgment. Use this manual procedure before claiming better quality or cost:

1. Select representative tasks, fixed input snapshots, and acceptance outcomes before trials.
   Separate mechanical edits, ordinary implementation, coupled state changes, and consequential
   instruction changes. Exclude fixtures and duplicate session continuations from independent
   task counts.
2. Compare the accepted configuration and a candidate on the same tasks in isolated trials.
   Hold the model fixed to compare effort, and hold effort fixed to compare models where
   supported. Use repeated trials; one success does not calibrate the policy.
3. Record model/runtime versions, loaded instructions, task/attempt identity, first-attempt
   acceptance, material review findings, repairs, elapsed time, and actual available usage.
   Count first-attempt acceptance separately from eventual acceptance. Include reviewer and
   repair usage in total task cost. Missing billing evidence stays unknown.
4. Report per-category results and failures, sample size, spread, exclusions, and uncertainty.
   A favorable aggregate cannot hide a new consequential failure. A score distribution or
   static gate PASS is not a quality comparison.

Use existing authenticated hosts and temporary programs outside the checkout. Retain decisive
evidence on the issue through the existing runtime verification process. This procedure adds no
benchmark command, tracked test, telemetry, or automatic outcome tuning. It requires no benchmark
campaign for #227 and makes no equal-quality or savings claim.

## Out of scope

Automatic outcome-based score tuning, reuse of fail counts across sessions, and a persistent
per-tier cost store remain out of scope.

## Dispatch records

The subagent task loop of `implement` takes each dispatch from `dispatch`. Fixes after the final
review use this loop on both flows. Inline tasks run in the session and their final reviewer
uses `capscore` (ADR-0040). `critic-loop` and the builder check of `specify` keep their own rules.
The private session record is `/tmp/celetis-<uid>/dispatch/<host>-<session>.json` on macOS and Linux,
or `<os.tmpdir()>/celetis/dispatch/<host>-<session>.json` on Windows. It uses private directories,
mode-0600 record and lock files, a lock, and atomic replacement. Its key is the host and
`CLAUDE_CODE_SESSION_ID` or `CODEX_SESSION_ID`. A new session starts at attempt 1. GitHub remains
workflow state; this file is local execution evidence. Record schema 2 stores host/session only
at the record root. An ordinary open converts a supported schema-1 record under the record lock,
checks each report against the record and active host/session, and retains all history and an
exact source archive before replacement. Invalid, unsupported, unmappable, unsafe, or unreadable records
refuse intact; a busy lock or failed persistence also refuses. See
[ADR-0070](adr/0070-automatic-runtime-state-migration.md). The CLI result envelope remains schema 1.

Run each act as `celetis --agent <host> dispatch <act>`, with the running host
([the child dispatch](procedures/dispatch.md), "The task loop"):

| Act and arguments | Result |
| --- | --- |
| `next <n> <task> implementer\|reviewer J V B N S X --bias N` | Issue the next action and resolved pair. |
| `report <dispatch-id> <report-file>` | Validate and save one immutable agent-reported execution. |
| `gate <n> <task> pass\|fail <gate> <report>` | Record the gate; pass issues the reviewer, fail issues a repair or stops. |
| `review <n> <task> findings\|blocked` | Record findings or an implementer's `BLOCKED`, then issue a fix or stop. |
| `close <n> <task>` | Close with current successful implementer, gate, and reviewer evidence. Initial `final` needs only its reviewer. |
| `show` | Print this session's record, or null when none exists. |

The task ID is its plan number, `final`, `verify-<k>`, or `land-<k>`. A deliberate new task needs
a new ID. Repeating the same task cannot reset its count. `next` takes published digits and
bias (`+bN`; absent means `--bias 0`); re-score only a changed scope. The reviewer uses the same
score with the engine's reviewer floors. Only `next`, `gate`, and `review` accept scoring flags
and resolve fresh bindings. In Codex profile mode, pass fresh active-surface evidence through
`--runtime-models`. `report`, `show`, and `close` validate configuration and saved records but
need no fresh runtime allowlist.

On `status: "ready"`, schema-1 JSON includes `line`, `pair`, `action`, `child`, and `dispatch`.
Send the CAP line first and unchanged. Apply the actual model and effort controls on an isolated
spawn; omit `model` when null. Follow `spawn`, same-child `resume`, or engine-authorized `replace`.
Keep the parent settings. A same-pair follow-up uses the recorded child. On Claude, its `to` is
the child's agent ID, or the `Agent` spawn name that the recorded report binds to that ID when no
other recorded `Agent` call used that name; the reported child stays the agent ID. A changed model, effort, or runtime issues `replace`,
because the observed follow-up tools cannot change the pair.
Replacement preserves the task, counters, saved work, and earlier execution and failure evidence.
Give the fresh child that saved context through [the child dispatch](procedures/dispatch.md).
After a saved gate failure that issued no repair, request `next` with the saved task digits and
bias. Do not replay the gate failure or reset the record.

After each native call, save its exact tool name, arguments, and complete result. Submit
`report <dispatch-id> <report-file>` before the next task act. The
[Claude Code](procedures/dispatch.md#claude-code) and [Codex](procedures/dispatch.md#codex)
examples show the report shape. Every saved execution has `provenance: "agent-reported"`. The
engine binds the report to the active host/session record and checks its settings, CAP line,
action, and worker identity against the issued action. It does not intercept the call or
independently prove that a consistent report is true. A mismatch after execution cannot undo a
worker. Independent native enforcement belongs to
[issue #151](https://github.com/ddinkov10/celetis/issues/151).

An execution report has exactly `call` and `outcome`. The command selects the host/session from
the host argument and validated environment; the agent supplies no copy. A non-null `call` has
`tool`, `arguments` (a JSON object), and `result` (any JSON value). Its outcome is one of:

- `{"result":"started","child":"worker-id","model":null,"effort":null}`. Both hosts require
  a nonempty usable child; the actual stable task name is valid. Keep native settings separate
  from requested arguments. Preserve a returned model ID verbatim; leave unavailable settings
  null. Requested effort is not proof of applied effort.
- `{"result":"failed","noWorkerStarted":true,"error":"<exact failure>"}`. Use this only when
  the tool failure establishes that no worker started. A matching accepted failure alone permits
  `next` to retry the issued action. The fresh dispatch names the voided ID and keeps its action,
  attempt, round, and resume child. Earlier evidence stays intact.
- `{"result":"incomplete","error":"<uncertain result>"}`. An uncertain error or successful
  response without usable identity stops dependent work. It cannot later become a retryable failure.
- `{"result":"unsupported","error":"<actual missing operation>"}` with `call: null`. Report
  an unavailable follow-up this way, then stop. Keep the recorded child.

`report` acknowledges a matching start or known failure with `status: "reported"`, `dispatch`,
and `result`; it issues no child. Mismatches, incomplete results, and unsupported operations save
their evidence first and return setup exit 5. An issued call with no report stops later task acts
and names `dispatch report <id> <report-file>`. Unknown/replayed IDs refuse with exit 3 without
changing evidence. A dispatch from another host/session is unknown in the active record and
returns exit 3 without changes. A missing or invalid host session returns setup exit 5.
Malformed reports return usage exit 2 without changes. No report can replace earlier execution
evidence. Calls outside the task loop need no report and are neither intercepted nor recorded.

Wait for real child completion before its gate or review result. The gate pass already issues
the reviewer. Report findings or `BLOCKED` through `review`; close after a clean current review.
A later implementer call or adverse gate/review result makes earlier evidence stale. Failed,
pending, mismatched, incomplete, or unsupported calls cannot close a normal or `final` task.

The engine owns attempts and fix rounds. Gate failures advance attempts; attempt 4 stops.
Rounds 1–3 retain the implementer when the effective pair is unchanged. A changed pair issues a
replacement. Rounds 4–5 and `BLOCKED` permit an engine-issued fresh implementer at the attempt-3
pair. A further adverse review is saved and stops all later acts for that task without round 6.
Report failures change neither count. Keep no parallel counters.

Exit 0 returns `ready`, `reported`, or `closed`, or prints `show`. Exit 2 is usage; exit 3 is a
refused act. Exit 4 is a terminal stop and exit 5 is a setup stop. Both carry a reason and trail
when available. Use the host approval procedure for sandbox blocks
([the entry](procedures/entry.md), "The contract"). In a step session, rule 4 of `step-prompt.md`
of the plugin `celetis` hands a stop to the issue ([the stop](procedures/stop.md)).

## Portable scores and host binding

The arithmetic produces a capability **rank 0–3** and a rubric effort. The four ranks correspond
in order to the Claude labels above; model names are a separate host binding. The sum, floors,
bias, escalation, and final clamp of the portable score are identical on each host. Portable
rank 3 below Σ=12 caps at xhigh. A host binding can raise the applied effort without changing
the portable score. On Codex with no profile, the binding names no model: each child keeps the
parent's model ("Codex model profiles").

Agent selection is `--agent claude|codex` > explicit `CELETIS_AGENT` > the first host in the local
ordered preference. Its missing-record order is `claude`, `codex`; outside a Git checkout,
control selection uses Claude. Scoring consults no usage-limit record. Explicit selection
needs no preference read; required YAML validation still applies. Without a new flag, Claude's existing human
CAP output is unchanged. When the selected host is Claude and `OPENCODE=1`, the existing opencode
mode still uses its current model: `--current-model provider/id` > `CAP_CURRENT_MODEL` > the
current-model database lookup. If none is found, its existing Claude-label fallback remains.
Codex uses its configured slots, or the parent model with no profile, even when `OPENCODE=1`.

`--json` returns one schema-1 object instead of the human line. It includes `digits` (`J`, `V`,
`B`, `N`, `S`, `X`), original `bias`, `attempt`, `sum`, portable `rank` and `effort`, `host`,
`status`, the human `line`, and `dispatch`:

```json
{
  "schema": 1,
  "digits": {"J": 1, "V": 0, "B": 2, "N": 1, "S": 1, "X": 0},
  "bias": 0,
  "attempt": 1,
  "sum": 5,
  "rank": 1,
  "effort": "medium",
  "host": "claude",
  "status": "ready",
  "dispatch": {"rank": 1, "model": "sonnet", "effort": "medium", "runtime": null, "reviewer": false},
  "line": "CAP: J1 V0 B2 N1 S1 X0 = 5 → sonnet/medium"
}
```

`dispatch` records the applied model and effort; its rank can rise for a reviewer. With
`--reviewer`, Claude and opencode have a rank-1/medium minimum, and Codex uses its profile's
minimum, or rank-1/medium with no profile. This raises the resolved rank and effort after
portable scoring, then reapplies the rank-3 clamp. Codex applies its retry floor after this step.
Portable `rank` and `effort` still describe the original score. The human line uses the applied
pair.

Attempt 4 or later returns `status: "stop"`, with `rank`, `effort`, `host`, and `dispatch` null.
It keeps the digits, bias, sum, attempt, and original STOP line. STOP is resolved before host
lookup, current-model detection, or profile validation. The caller must hand off the failure
trail without dispatching. JSON output requires `jq`; the human STOP line does not.

## Codex model profiles

The scorer selects one of two modes for Codex. The choice is deterministic:

- The **profile mode** applies when `--profile` or `CAP_MODEL_PROFILE` is set (an empty value
  too), or when the main checkout's `.celetis.yaml` has one or more `codexProfiles` entries. A
  `codexProfiles` entry for another runtime identity stops with "missing profile"; the scorer does
  not change to the parent-model mode.
- The **parent-model mode** applies with no explicit profile and no `codexProfiles` entry (the
  field is absent or `{}`). It still reads the main config: a failed Git lookup, a missing config,
  or an invalid config exits 2.

In the parent-model mode, each child keeps the parent's model, or the model that the Codex config
sets in `[agents].default_subagent_model` ([Codex dispatch](procedures/dispatch.md#codex)), and
gets the effort of its rank. The scorer names no model ID and reads no runtime file, not even a supplied
one. The applied effort follows the rules of a profile with four identical slots and a
rank-1/medium reviewer minimum. `dispatch.model` and `dispatch.runtime` are null, and the human
line shows `inherit`.
For the digits `1 0 2 1 1 0` and the default bias 0, the result holds:

```json
{"host": "codex", "status": "ready",
 "dispatch": {"rank": 1, "model": null, "effort": "medium", "runtime": null, "reviewer": false},
 "line": "CAP: J1 V0 B2 N1 S1 X0 = 5 → inherit/medium"}
```

For model tiers, supply a profile; the plugin bundles none. A profile has exactly four slots in
ascending capability order and a reviewer minimum. Repeated model IDs are allowed when the
surface offers fewer distinct capability families; the four portable ranks remain distinct.
Store the profile under `codexProfiles` in the main checkout's `.celetis.yaml`, keyed by the
active dispatch runtime identity. The scorer selects that identity and validates availability;
the profile owns the capability ordering. Refresh the runtime allowlist from the tool that will
create or resume the child before each dispatch, then supply its file path to the scorer.
Keep the current parent model; this setup controls children only.

Native cache replacement and same-child retry still need their separate CLI evidence.
Open sessions have no immutable-resource guarantee (ADR-0028). Desktop binding has separate optional acceptance under
[Acceptance status](celetis-flow.md#acceptance-status); the active-surface profile and tool checks
still apply to each requested desktop operation.

For attempts 2 and 3, the scorer resolves earlier attempts with the same digits, bias, profile,
runtime, and reviewer role. When consecutive attempts select the same model ID, the applied
effort cannot decrease. This floor uses the previous applied effort, including reviewer floors
and caps. It can retain max at rank 3 below Σ=12 when the same model already used max. Effort
can stay at its maximum. The parent-model mode is one model, so this same-model floor applies to
each retry. Different model IDs keep the ordered ranks and portable effort selection, with the
same reviewer rules. In the profile mode, the final applied pair must be supported by the runtime.

In the profile mode, pass `--runtime-models FILE` (or `CAP_RUNTIME_MODELS`) for the active
dispatch surface. Its JSON object has `schema: 1` and a nonempty `runtime` identity. Use a surface
and version or capability revision that identifies the actual dispatch environment. A repository
profile with placeholder IDs is:

```yaml
codexProfiles:
  dispatch-surface@capability-revision:
    slots: [small-model, standard-model, large-model, large-model]
    reviewer: {rank: 1, effort: medium}
```

For standalone or one-run scoring, `--profile FILE` overrides `CAP_MODEL_PROFILE`, which
overrides the main config profile. An explicitly supplied invalid or empty profile does not fall
back to the config or to the parent model. The explicit file has one JSON object with the same
`runtime` as the allowlist:

```json
{
  "schema": 1,
  "runtime": "dispatch-surface@capability-revision",
  "slots": ["small-model", "standard-model", "large-model", "large-model"],
  "reviewer": {"rank": 1, "effort": "medium"}
}
```

Each scoring invocation captures its explicit profile, runtime-evidence path, host inputs, bias,
and attempt before it creates an operation. Repository profiles come from that operation's
immutable main config, including a call from a lane or subfolder. Codex without an explicit
profile requires full main validation before deciding that no profile exists. Claude scoring
and explicit-profile scoring use the host projection only; explicit host selection needs no
YAML read for selection. If YAML selects the host, that source passes the shared structural
checks. A later invocation obtains fresh values; concurrent invocations share no profile state.

The runtime allowlist has this shape; its IDs and efforts must come from the active dispatch
controller's supported tools or model-list API:

```json
{
  "schema": 1,
  "runtime": "dispatch-surface@capability-revision",
  "models": [
    {"id": "small-model", "efforts": ["low", "medium", "high", "xhigh", "max"]},
    {"id": "standard-model", "efforts": ["low", "medium", "high", "xhigh", "max"]},
    {"id": "large-model", "efforts": ["low", "medium", "high", "xhigh", "max"]}
  ]
}
```

These placeholders are not usable defaults. Refresh the allowlist at dispatch from the same
surface that will create the child. CLI and desktop can expose different models and efforts;
a CLI catalog, a bundled catalog, or another surface's saved snapshot does not establish desktop
tool availability. The caller supplies this evidence explicitly; the scorer neither reads
undocumented caches nor silently substitutes a model. Claude names such as `sonnet` and `opus`
in a published CAP line are not Codex model IDs.

Every slot ID must exist in the allowlist, including slots unused by this score. Runtime IDs
must be unique; each lists its supported efforts. The reviewer rank is an integer 0–3, and its
minimum effort is one of low, medium, high, or xhigh. A max reviewer minimum is invalid because
max cannot be guaranteed below Σ=12. Its configured pair must be supported even for an
implementation dispatch. The final applied pair must also be supported. Extra runtime efforts
such as ultra do not extend the rubric. Missing files, malformed configuration, identity
mismatches, and unavailable model/effort pairs exit 2 with a setup action and no result.

With no profile, the scorer needs no runtime file:

```bash
celetis --agent codex capscore 1 0 2 1 1 0 --json
```

With a `codexProfiles` entry, supply the runtime allowlist:

```bash
celetis --agent codex capscore 1 0 2 1 1 0 --json \
  --runtime-models /path/to/active-models.json
```

Outside a configured repository, supply the explicit profile and runtime allowlist:

```bash
celetis --agent codex capscore 1 0 2 1 1 0 --json \
  --profile /path/to/profile.json --runtime-models /path/to/active-models.json
```

Existing plan CAP lines remain historical records. At dispatch, reuse their six digits and
written bias (`+bN`; an absent token means 0), plus the current task's attempt count. Do not
rescore the task because the host or rubric changed, and do not replace a written bias with a
current default or environment override. Record the new human line and `dispatch` pair in the
execution record. Apply "Scorecard format — MANDATORY" to the prompt's reason.

For a Codex child scored with `capscore`, apply `dispatch.model` and `dispatch.effort` explicitly
using the actual available spawn tool on an isolated child. With `dispatch.model: null`, send
no `model` field and set the effort. A tool that permits overrides only without inherited
history requires that isolated mode. If the tool cannot apply the pair, stop with a setup error.
For these other consumers, use the available follow-up tool for the same child to repair or
re-review: retain its identity and resolve the required pair again, including any gate-failure
escalation. If that tool cannot apply a changed pair to the same identity, stop for setup with
the failure trail. An unchanged pair may resume normally. Do not assume that another host's
`Agent` or message API exists, or spawn a replacement just to change effort when the actual
follow-up tool has no override. The scorer returns the binding; the dispatch controller owns
creation, identity, and execution records.

For the task loop of `implement`, use `dispatch` and its `pair` and `action` fields. Its agent-reported
child identity, pair-change replacement, and execution reports are defined in
[Dispatch records](#dispatch-records).
