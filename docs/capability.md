# Capability gates (model+effort per task)

Second routing axis, beside **type** (the four `/celetis:bug` `/celetis:hotfix` `/celetis:feature`
`/celetis:chore` entry commands). At **every dispatch point** a scored rubric decides which model
tier and effort level executes the next task. Digit assignment is agentic (judgment — unavoidable);
digits→tier arithmetic is deterministic and lives in `scripts/celetis capscore` (the doc is the
spec; the script is the authority for the math — they must agree).

## The rubric — six dimensions, each 0–2

| dim | 0 | 1 | 2 |
|---|---|---|---|
| **J** judgment-density | mechanical / scripted | standard code, some choices | design / wording / architecture |
| **V** verifiability *(inverted)* | deterministic gate catches failure (verify, tests) | partial coverage | only human review catches it |
| **B** blast-radius | throwaway / scratch | local tooling, gitignored | shipped code or durable steering surface (skills, CLAUDE.md, published) |
| **N** novelty | copy existing pattern | adapt existing pattern | new design |
| **S** scope-size | 1 file | 2–5 files / 1 subsystem | >5 files or multi-subsystem |
| **X** security-sensitivity | none | touches auth/crypto-adjacent code, semantics unchanged | changes auth/crypto/permission semantics |

## Bands (sum 0–12)

`0–3 → haiku/low` · `4–6 → sonnet/medium` · `7–9 → opus/high` · `10–11 → opus/xhigh` · `12 → fable/max`

Model tiers (low→high): **haiku · sonnet · opus · fable**. Effort tiers (low→high): **low · medium ·
high · xhigh · max**.

Fable is reached only at Σ=12 or by attempt-3 escalation from opus: Opus 5.5 covers 7–11 at
$4/$20 per MTok against Fable 5.1's $10/$50. Revisit the 10–11 band when either model changes.

## Floors (beat the sum, never lower it)

- **X=2** → min **opus/high**
- **V=2** → min effort **high**

## Effort bias

`--bias N` (script flag) / `CAP_EFFORT_BIAS` (env fallback) raises **effort** by N tiers. **Model is
never biased.** **Default 2** — lower per-dispatch with `--bias 0|1` when cost matters.

**Application order:** sum → band → floors → bias → escalation → clamp.

**Clamp (final invariant):** effort ceiling is **max**, EXCEPT a **fable** result caps at **xhigh**
unless Σ=12 — `fable/max` is **reserved for Σ=12**. `opus/max` is the routine 7–11 result
(opus/high or opus/xhigh + default b2) and is unaffected.

## Escalation (deterministic, gate-fail count within one task)

- attempt 2 → effort **+1 tier**
- attempt 3 → model **+1 tier**, effort **≥ high**
- attempt 4 → **STOP**, escalate to the user with the failure trail

Attempt count is session-scoped — no cross-session persistence. The clamp still applies to escalation
output: escalation never mints `fable/max` below Σ=12.

## Scorecard format — MANDATORY

Every dispatch prompt **and** every plan task header carries one line:

```
CAP: J1 V0 B1 N1 S1 X0 = 4 → sonnet/medium
```

Non-zero bias shows a `+bN` token before the arrow:

```
CAP: J1 V2 B2 N1 S1 X0 = 7 +b2 → opus/max
```

Generate it with the script (do not hand-compute the tier):

```bash
scripts/celetis capscore J V B N S X [--attempt N] [--bias N]
```

## Who must score, when — the consumption rule

Score **before every dispatch of work to a model**, and put the resulting CAP line where that model
will read it:

- **Lane skills** (`bug|hotfix|chore|feature`) — score before any subagent dispatch; the CAP
  line goes in the dispatch prompt.
- **`implement`** per-task dispatch — CAP line per task.
- **Ad-hoc child spawns** — every child for repo work resolves its host binding and includes a CAP
  line in its prompt; the actual spawn applies the effort, and the model when `dispatch.model` is
  not null, through [host operations](hosts/entry.md).
- **Plan headers** — print the CAP rec on session-executed tasks. Note: the **session model is the
  user's picker**; the rubric can only *recommend* there (max is auto-assignable for a spawn, a rec
  for the session). The user may override any rec.

## Worked examples (seed calibration, default bias 2)

- verify-gates plan: `CAP: J1 V0 B1 N1 S1 X0 = 4 +b2 → sonnet/xhigh` (base band sonnet/medium)
- type-lanes plan: `CAP: J2 V2 B2 N1 S1 X0 = 8 +b2 → opus/max` (base band opus/high)

## Out of scope (v1)

Outcome ledger + threshold tuning (declined — revisit if tiers feel wrong in practice); cross-session
fail-count persistence; per-tier cost accounting.

## Portable scores and host binding

The arithmetic produces a capability **rank 0–3** and a rubric effort. The four ranks correspond
in order to the Claude labels above; model names are a separate host binding. The sum, floors,
bias, escalation, and final clamp of the portable score are identical on each host. Portable
rank 3 below Σ=12 caps at xhigh. A host binding can raise the applied effort without changing
the portable score. On Codex with no profile, the binding names no model: each child keeps the
parent's model ("Codex model profiles").

Agent selection is `--agent claude|codex` > `CELETIS_AGENT` > `host` in the main checkout's
`.celetis.yaml` > `claude`. The launcher exports its selected host. Without a new flag, Claude's existing human
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
  "bias": 2,
  "attempt": 1,
  "sum": 5,
  "rank": 1,
  "effort": "xhigh",
  "host": "claude",
  "status": "ready",
  "dispatch": {"rank": 1, "model": "sonnet", "effort": "xhigh", "runtime": null, "reviewer": false},
  "line": "CAP: J1 V0 B2 N1 S1 X0 = 5 +b2 → sonnet/xhigh"
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
sets in `[agents].default_subagent_model` ([Codex dispatch](hosts/codex.md#dispatch)), and gets the
effort of its rank. The scorer names no model ID and reads no runtime file, not even a supplied
one. The applied effort follows the rules of a profile with four identical slots and a
rank-1/medium reviewer minimum. `dispatch.model` and `dispatch.runtime` are null, and the human
line shows `inherit`.
For the digits `1 0 2 1 1 0` and the default bias 2, the result holds:

```json
{"host": "codex", "status": "ready",
 "dispatch": {"rank": 1, "model": null, "effort": "xhigh", "runtime": null, "reviewer": false},
 "line": "CAP: J1 V0 B2 N1 S1 X0 = 5 +b2 → inherit/xhigh"}
```

For model tiers, supply a profile; the plugin bundles none. A profile has exactly four slots in
ascending capability order and a reviewer minimum. Repeated model IDs are allowed when the
surface offers fewer distinct capability families; the four portable ranks remain distinct.
Store the profile under `codexProfiles` in the main checkout's `.celetis.yaml`, keyed by the
active dispatch runtime identity. The scorer selects that identity and validates availability;
the profile owns the capability ordering. Refresh the runtime allowlist from the tool that will
create or resume the child before each dispatch, then supply its file path to the scorer.
Keep the current parent model; this setup controls children only.

For an existing project, replace each repository-owned profile input as the
[manual cutover](configuration.md#replace-the-old-setup) specifies. Keep `slots` and `reviewer`
under the exact runtime key; refresh the allowlist before dispatch. ADR-0015 changes storage
only. Installed-resource lifetime and same-child retry limits on required CLI surfaces remain
open. Desktop binding has separate optional acceptance under
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
scripts/celetis --agent codex capscore 1 0 2 1 1 0 --json
```

With a `codexProfiles` entry, supply the runtime allowlist:

```bash
scripts/celetis --agent codex capscore 1 0 2 1 1 0 --json \
  --runtime-models /path/to/active-models.json
```

Outside a configured repository, supply the explicit profile and runtime allowlist:

```bash
scripts/celetis --agent codex capscore 1 0 2 1 1 0 --json \
  --profile /path/to/profile.json --runtime-models /path/to/active-models.json
```

Existing plan CAP lines remain historical records. At dispatch, reuse their six digits and
written bias (`+bN`; an absent token means 0), plus the current task's attempt count. Do not
rescore the task because the host changed, and do not replace a written zero bias with the
scorer's default 2. Record the new human line and `dispatch` pair in the execution record.

For a Codex child, apply `dispatch.model` and `dispatch.effort` explicitly using the actual
available spawn tool on an isolated child. With `dispatch.model: null`, send no `model` field and
set the effort. A tool that permits overrides only without inherited history requires that
isolated mode. If the tool cannot apply the pair, stop with a setup error.
Use the available follow-up tool for the same child to repair or re-review: retain its identity
and resolve the required pair again, including any gate-failure escalation. If that tool cannot
apply a changed pair to the same identity, stop for setup with the failure trail. An unchanged
pair may resume normally. Do not assume that another host's `Agent` or message API exists, or spawn a
replacement just to change effort when the actual follow-up tool has no override. The scorer
returns the binding; the dispatch controller owns creation, identity, and execution records.
