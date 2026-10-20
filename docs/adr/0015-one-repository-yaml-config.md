# One repository YAML file owns Celetis setup

## Date

2026-10-19

## Related

- ddinkov10/celetis#32: the approved single-config spec and implementation plan.
- ADR-0009, ADR-0012, ADR-0013, and ADR-0014: the clauses replaced below.
- `scripts/celetis`: `celetis_config_main` and `celetis_config_read`.
- `scripts/board.sh`, `docs/configuration.md`, and `docs/hosts/entry.md`.
- agent-board v2.2.1: tag object `87ac68cdbfb8dc81d8ead968ae832f375534c3db`,
  commit `2014361f365e03e18169ed75d602b729e25e03bb`.

## Supersedes

Only these storage and default-source clauses change:

- ADR-0009, Decision 5 and its file-start instructions: the separate repository board config.
- ADR-0012, "The config", "The worktree setup", and "A custom part": the separate JSON files,
  external setup/custom files, and Git gate defaults. Its packaging, launcher, native settings,
  checkout sources, setup marker, records, and update model stand.
- ADR-0013: the custom-file path and the whole custom file as the selected addition. Its native
  file access, optional entry, permission controls, and stop on a denied read stand.
- ADR-0014: `.claude/celetis-flow/` as config storage and project Git settings as defaults.
  Its shared procedures, host operations, saved-record `host`, exact Resume, locks, capability
  semantics, opt-in status, and incomplete acceptance remain.

The historical records keep their text. This unmerged record is a branch proposal.

## Context

A maintainer had to coordinate JSON files, Git settings, a Bash setup file, custom Markdown
files, and model profiles for one repository. The approved design selects one YAML file and
manual replacement. Literal strings can hold scripts and instructions without JSON escapes or
one process for each line. Both hosts must use the same repository setup while keeping their
native configuration and permissions.

## Constraints and evidence

- Shell readers require Mike Farah yq `>=4.54.1,<5` and `jq`. Installation examples and CI pin
  v4.54.1. The reader rejects invalid YAML, lossy YAML features, and schema errors before work.
- Shell conversion makes no JSON config file. Native skill entry uses supported file tools and
  interprets the documented schema; it has no shell parser or config cache.
- Main owns operational settings, a new lane owns its setup, and the active checkout owns each
  skill addition. One regular, readable file is selected; files are not combined.
- Released agent-board v2.2.1 passed its independent stdin-config contract and source gate
  (322 tests). The tag supports generic JSON input, executable validation, selected-agent Run,
  unprefixed Resume, and explicit refusal of producer-default changes. This prerequisite is separate from adapter and real UI acceptance.
- Codex desktop isolated binding is BLOCKED. Managed Claude setup and complete child bootstrap
  are UNRUN. Stable resource lifetime, changed-pair same-child controls, and full live workflows
  remain release requirements. A CLI or quoted result does not prove desktop behavior.

## Decision

Store Celetis-owned repository setup in `.celetis.yaml` at the checkout root. The schema owns
`host`, `landing`, `gates`, `board`, `worktreeSetup`, `custom`, and `codexProfiles`. Omitted gates
use `me`; no Codex profile is bundled. Use literal blocks for multiline scripts and instructions,
with their parsed newlines intact. Reject invalid supplied config rather than substitute defaults.

Keep `--agent` above `CELETIS_AGENT`, above main YAML `host`, above `claude`. Old project Git
settings have no effect. Keep YAML and saved-record keys named `host`. Resume selects the saved
host and exact session ID and rejects an explicit conflict.

Native entry reads the whole active file once for each skill invocation or first borrowed
reference, then applies only `custom.<skill>`. Handoffs create a new entry. No checkout or config
means no optional addition; an invalid, ambiguous, unreadable, symlink, or denied config stops it.
Entering a skill never executes setup.

`scripts/celetis board` validates the main config, refuses a lane start, and supplies the fixed
data, Run, and Resume argument lists to the exact released board through stdin. Only its port
comes from YAML, below inherited `PORT`. The separate board package keeps its command/path
validator and contract 1; it does not know YAML or Celetis field names.

Replace old setup manually. Copy the changed standalone launcher, account for every old value
and instruction, keep native host files and runtime state, and stop old runners before cutover.
The maintainer coordinates other repositories before the plugin lands. Add no fallback, automatic
migration, settings generator, or dependency installer.

## Alternatives considered

- Keep the separate files and Git defaults: fewer parser changes, but the maintainer still has
  several sources to coordinate and host-specific storage for shared setup.
- Put script and instruction strings in one JSON file: uses the existing parser, but multiline
  text requires escaping and makes review harder.
- Generate a board JSON file or retain old readers: avoids the board release dependency, but
  creates another source and hides incomplete manual replacement.
- Parse config with a new native hook service or shell at entry: gives deterministic parsing,
  but adds a runtime and permission dependency to native no-shell entry.
- Bundle model defaults: makes a new install easier, but cannot establish the active dispatch
  surface's supported models and efforts.

## Consequences

One file owns setup and preserves the existing checkout and session rules. Shell consumers gain
a pinned parser requirement. Native entry still needs observed complete file reads and correct
interpretation; deterministic parser checks do not replace that proof.

The cutover breaks old setup until each repository is prepared. Each plugin landing reaches
other projects on refresh, so their preparation and stopped old runners are a human gate.
This storage decision does not close any remaining host or live board acceptance gap.

## Reconsider when

- A required repository setting cannot fit this schema without external Celetis setup files.
- Native file-only entry cannot interpret a required valid config consistently.
- A supported host mechanism supplies deterministic file-only config access with the same
  checkout, invocation, and permission semantics.
- The released board stops accepting the generic stdin object or preserving its path guards.
- The parser or plugin update model changes the manual cutover requirements.
