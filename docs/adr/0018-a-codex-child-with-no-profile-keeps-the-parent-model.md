# A Codex child with no profile keeps the parent model

## Date

2026-10-21

## Related

- ddinkov10/celetis#61: the spec of this change, with the decisions of the maintainer.
- ddinkov10/celetis#55, finding F4: both hosts can start a child with no profile.
- ADR-0014: the explicit host operations, with the profile clause that this record changes.
  ADR-0015: one repository YAML config, with no bundled Codex profile. ADR-0016: the Codex CLI is
  the required surface.
- `scripts/capscore.sh`, `docs/capability.md` ("Codex model profiles"), and `docs/hosts/codex.md`
  ("Dispatch").

## Supersedes

From ADR-0014, "One workflow uses explicit host operations", one clause of its Decision: "map them
through a profile validated against the active surface's actual models and efforts. Ship no Codex
model defaults". The clause changes for a project with no Codex profile only: each child of such a
project keeps the parent's model. A project with a profile keeps the clause. No Claude alias is
substituted. This record changes no other part of ADR-0014.

ADR-0015, "One repository YAML file owns Celetis setup", does not change. Its clause "no Codex
profile is bundled" stays true. Its rejected alternative "Bundle model defaults" stays rejected:
the default names no model ID.

## Context

Before this change, Codex child work needed a four-slot profile under `codexProfiles.<runtime>` in
`.celetis.yaml`. Each scorer call also needed a runtime model file (`--runtime-models`). The plugin
bundles no profile, and `/celetis:setup` writes none. So the first Codex child work in a newly
wired project stopped for setup: the scorer exited 2 with no profile and no runtime file. On
Claude Code, a newly wired project needs no model setup for its first child.

## Constraints and evidence

- The decisions of the maintainer (spec of #61): the capability scoring does not change (#55,
  decision 6). With no Codex profile, a Codex child keeps the parent's model and gets the effort of
  its rank (#55, F4). `codexProfiles` stays an option for model tiers. The design targets the
  Codex CLI.
- Codex CLI 0.162.1: a child gets its model and effort from the explicit spawn value, then from
  `[agents].default_subagent_model` and `default_subagent_reasoning_effort`, then from the parent.
  With none configured, the child inherits the parent's model and effort
  ([subagents](https://learn.chatgpt.com/docs/agent-configuration/subagents.md)).
- Codex CLI 0.162.1: with no requested model and no configured default, the child config keeps
  the model of the invoking step. Codex checks a requested effort against the supported levels of
  that model. An unsupported effort returns an error to the parent
  ([`child_config.rs`](https://github.com/openai/codex/blob/rust-v0.162.1/codex-rs/core/src/agent/child_config.rs)).
- Codex CLI 0.162.1: the v1 tool `multi_agent_v1.spawn_agent` takes `model` and
  `reasoning_effort`
  ([`spawn.rs`](https://github.com/openai/codex/blob/rust-v0.162.1/codex-rs/core/src/tools/handlers/multi_agents/spawn.rs)).
  The v2 tool `collaboration.spawn_agent` also takes an optional `model` and `reasoning_effort`,
  and it calls the same `prepare_agent_spawn_config`
  ([`multi_agents_v2/spawn.rs`](https://github.com/openai/codex/blob/rust-v0.162.1/codex-rs/core/src/tools/handlers/multi_agents_v2/spawn.rs)).
  So an omitted model resolves the same way in both tool sets (`docs/hosts/codex.md`,
  "Dispatch").
- Codex CLI 0.162.1: `codex debug models` lists account-specific model IDs with no size order. On
  the machine of the maintainer, it lists 9 models, each with the efforts `low` to `max`. So only a
  profile can give the order of the model tiers.
- The live Codex CLI check of the Verify phase of this change is recorded on #61.

## Decision

**The scorer selects one of two modes for Codex.** The choice is deterministic:

| Mode | When | Runtime file |
|---|---|---|
| Profile | `--profile` or `CAP_MODEL_PROFILE` is set (an empty value too), or the main checkout's `.celetis.yaml` has one or more `codexProfiles` entries | Required |
| Parent model | No explicit profile, and the main config has no `codexProfiles` entry (field absent or `{}`) | Not read |

The profile mode keeps each current check and stop. A profile for another runtime identity still
stops with "missing profile". So a project that chose model tiers never changes to the parent model
with no notice. With no explicit profile, the scorer still reads the main config: a failed Git
lookup, a missing config, or an invalid config exits 2. So the scorer never takes an error for "no
profile".

**The parent-model result.** The portable score (`sum`, `rank`, `effort`) does not change. The
applied effort uses the rules of a profile with four identical slots and the reviewer minimum
`{rank: 1, effort: medium}`:

- `--reviewer` raises the rank to 1 and the effort to `medium` at minimum, as on Claude.
- At rank 3 below Σ=12, the effort stops at `xhigh`.
- Attempt 3 raises the rank, but the model stays. The effort is `high` at minimum.
- The same-model retry floor applies: attempt 2 or 3 never gets a lower effort than the attempt
  before it. So attempt 3 can keep `max` from attempt 2.

`dispatch.model` and `dispatch.runtime` are `null`: the scorer names no model ID. The human line
shows `inherit`, the word that Claude Code uses for the model of the parent.

**The dispatch.** The dispatcher reads `codexProfiles` of the main config before the call, so it
knows the mode. It refreshes and passes a runtime file only in the profile mode. When
`dispatch.model` is `null`, the spawn call sends no `model` field and sets `reasoning_effort` to
`dispatch.effort`. Codex checks the effort against the model of the child. A refused effort is a
setup stop: the dispatcher does not lower the effort or try another value. The skills do not
change, because the Codex host document defines how a null model applies.

## Alternatives considered

- **Keep the stop.** Each newly wired project then needs a profile and a runtime file before its
  first Codex child work.
- **`/celetis:setup` writes a profile.** Codex gives no size order of its models, so setup cannot
  order the four slots.
- **Bundle model IDs.** ADR-0015 rejected bundled model defaults: the plugin cannot know the models
  of an account.
- **Read the model ID of the parent with a new flag.** Codex resolves an omitted model itself, so
  the flag adds an input that the dispatch does not need.
- **Fall back to the parent model when a configured profile misses the runtime.** That is a silent
  change of the model tiers in a project that chose its tiers.

## Consequences

- A newly wired project needs no model setup for its Codex child work.
- With no profile, each child runs on the session model. So the cost and the capability of each
  child follow that model. When the user sets `[agents].default_subagent_model`, each child gets
  that model.
- The effort still follows the score.
- A profile stays the way to get model tiers on Codex.
- A child model that does not support the scored effort stops the dispatch for setup.

## Reconsider when

- Codex gives a size order of its models.
- Codex changes the resolution of an omitted model.
- Parent models often refuse the scored effort.
- `/celetis:setup` can make a profile.
