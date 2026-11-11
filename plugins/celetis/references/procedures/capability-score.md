# The capability score

How a step scores a task for the model and the effort of the child that runs it: the rubric of the
six digits, the scorecard, who scores and when, and the worked examples. `plan`, `hotfix`,
`specify`, `critic-loop`, `implement`, and `dispatch.md` cite it. The bands, the floors, the bias,
the escalation, and the schemas stay in [capability.md](../../docs/capability.md).

## Contents

- **The rubric — six dimensions, each 0–2:** the table of the digits J, V, B, N, S, X and the
  rules of their evidence.
- **Scorecard format — MANDATORY:** the CAP line and the reason that follows it.
- **Who must score, when — the consumption rule:** the dispatches that need a score and where the
  CAP line goes.
- **Worked examples (explicit bias 0, attempt 1):** eight task shapes with their CAP lines.

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
(`<plugin>/references/procedures/dispatch.md`, "The task loop").

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
  on the subagent flow and for fixes after the final review (`<plugin>/references/procedures/dispatch.md`, "The task loop").
  On the inline flow, the session builds each task, so the plan's CAP lines are recommendations
  (**Plan headers**); its final reviewer uses `capscore --json`.
- **Other child spawns**, including `critic-loop` and the builder check of `specify` — resolve
  the host binding with `capscore --json` and include its CAP line in the prompt; the actual
  spawn applies the effort, and the model when `dispatch.model` is not null, through the actual
  spawn controls of the host (`<plugin>/references/procedures/dispatch.md`, "One child").
- **Plan headers** — print the CAP rec on session-executed tasks. Note: for a session that a person
  starts, the **session model is the person's choice**; the rubric can only *recommend* there (max is auto-assignable for a spawn, a rec
  for the session). The user may override any rec. A run or board start of a step session gets
  the pair of the start: the decision of the step before, a pin, or a change of one start, else
  `opus` and `medium` (`<plugin>/references/procedures/effort.md`), not a rubric band. So the CAP
  line of a task of an inline build recommends the session pair and does not set it.

## Worked examples (explicit bias 0, attempt 1)

These specified task shapes illustrate the anchors, not model success. Each pair uses the
scorer with `--agent claude --bias 0`; each reason states the assumptions behind its digits.

**Exact text correction.** Apply a prescribed non-normative correction at eleven README locations.

```text
CAP: J0 V0 B0 N0 S0 X0 = 0 → haiku/medium
CAP reason: The transformation is exact, checks cover every correction, and no behavior or retained data changes. Eleven identical edits are S0; publication adds no consequence by itself.
```

**Tiny helper.** Adapt a content-change digest helper within a fixed local contract.

```text
CAP: J1 V0 B1 N0 S0 X0 = 2 → haiku/medium
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
CAP: J1 V1 B2 N1 S2 X0 = 7 → opus/medium
CAP reason: J1 covers bounded choices inside the approved policy. V1 reflects partial executable coverage. B2 covers missed capture across workflows. N1 adapts an existing capture pattern. S2 couples task and repair contracts. X0 preserves stop and authority decisions.
```

**Storage and recovery design.** Coordinate a new storage state model and recovery behavior.

```text
CAP: J2 V0 B2 N2 S2 X0 = 8 → opus/medium
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
CAP: J2 V2 B2 N2 S2 X2 = 12 → fable/high
CAP reason: J2 covers unresolved authority-policy trade-offs. V2 lacks a reliable oracle for the decisive outcome. B2 covers incorrect grants across workflows. N2 assumes no suitable project precedent. S2 couples permission and recovery contracts. X2 changes trust decisions.
```
