# Step agent preference is tracked policy

## Date

2026-11-05

## Related

- [Issue #246](https://github.com/ddinkov10/celetis/issues/246), approved specification and plan.
- [ADR-0067](0067-local-agent-priority-and-usage-recovery.md): the local order and usage
  recovery. This record relates to it and replaces no part of it.

## Context

The runner selects the agent of each step from one local order. A maintainer wants different
agents for different steps, for example `specify` and `plan` on Claude and `implement` on Codex.
An explicit `--agent` for each start was the only way, and a queue or an unattended runner cannot
give one per step.

## Constraints and evidence

- The maintainer chose an agent per step, not a model; a limited preferred agent falls back to
  the next agent of the local order with no wait; and the preference lives in the configuration
  file, with no board or other UI control (specification of #246, 2026-11-05).
- The local order of ADR-0067 records facts of one machine or person: which agents are installed
  and signed in, and their priority. A tracked file cannot know those facts.
- `selectAgent`, the usage-limit recovery, and the exhaustion wait already take an ordered list of
  hosts. One computed order reuses all of them unchanged.
- Codex has no proved path to stop a session (`endOwnedAttempt` returns `unverified`). In the plan
  session of 2026-11-05 the maintainer decided to keep that rule: a Codex refusal stops with no
  other agent, also when the preference started Codex.

## Decision

Add an optional top-level `agents` mapping to `.celetis.yaml`, from a runner step to `claude` or
`codex`. Read it from the main checkout, as `gates` is, and validate it at the configuration
boundary. It is tracked repository policy: it applies on each machine and changes through a commit.

At each new step start with the default choice, compute the effective order of that step from the
fresh local order and the fresh main config. A preferred agent that the local order includes comes
first, then the other agents of the local order. With no preference, or when the local order
excludes the preferred agent, the effective order is the local order. The local exclusion wins,
because it records a fact of the machine that the tracked preference cannot know.

Pass the effective order to the unchanged selection, recovery, and wait. Explicit choices and
Resume keep their agent and ignore the preference. Intake, Assist, Make visual, control
operations, and the board admission check keep the local order. A preferred agent that this
machine cannot start stops at its preflight and tries no other agent, as ADR-0067 requires for
setup errors; the remedy is a local exclusion.

## Alternatives considered

- A per-step ordered list, such as `implement: [codex, claude]`. It can express both fall back and
  wait, but the maintainer chose fall back, and a second order must stay in step with the local
  order and its exclusions.
- A `steps:` block that holds the gate and the agent of each step. It changes the existing `gates`
  field for no gain in behavior.
- The step preference in the local `agents.json`. It keeps all agent choice personal, but the
  maintainer asked for the configuration file, and a local record does not travel with the
  repository.
- A tracked preference that wins over a local exclusion. It starts an agent that this machine
  excludes, so a missing or unwanted agent stops every start of that step.

## Consequences

A repository can name the agent of each step once, for every machine and every runner mode that
uses the default choice. A machine that cannot run the preferred agent excludes it locally; the
other agents then take the step. A tracked preference can name an agent that a machine cannot
start, and that start stops at preflight until the person excludes it. The board admits a default
Run on the local order, so its admission can accept a start that the runner preflight then stops.
Usage-limit recovery continues a step on another agent only in the Claude direction on macOS and
Linux, while Codex and each host on Windows have no proved stop path.

## Reconsider when

- The runner gets a proved termination path for Codex: a Codex refusal can then continue the step
  on Claude, and this record's statement of the kept Codex rule becomes stale.
- A step needs a model choice or a per-step fallback list, not one preferred agent.
- A board control for the step preference is wanted, or the board admission must read it.
- A third host joins `claude` and `codex`.
