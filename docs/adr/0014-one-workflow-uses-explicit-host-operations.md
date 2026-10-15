# One workflow uses explicit host operations

## Date

2026-10-15

## Related

- [ddinkov10/celetis#21](https://github.com/ddinkov10/celetis/issues/21): full Codex workflow support.
- ADR-0005: herdr session state. ADR-0008: the guarded landing path.
- ADR-0009: the separate board and contract 1. ADR-0010: Superpowers remains a dependency.
- ADR-0012: the installed plugin and product wiring. ADR-0013: explicit custom-file reads.
- `scripts/celetis`, `scripts/lib/host.sh`, `scripts/lib/session.sh`,
  `scripts/plugin-update.pl`, and `docs/hosts/`.

## Supersedes

The Claude-only clauses of ADR-0012 are extended as follows:

- Installation and lookup select the active host. Claude keeps its install records; Codex uses
  its enabled skill metadata. Each host installs its own celetis and Superpowers packages.
- A manual skill writes an explicit host prefix before every launcher sub-command. Human terminal
  and board calls retain the current bare form, which selects the project default.
- Product permissions use the host's actual rule mechanism. The landing script remains the
  required agent path, with its existing deterministic checks.
- The runner refreshes only the selected host. One bounded Perl supervisor owns update, lookup,
  serialization, and cleanup. A failed update stops the step.

ADR-0013's required custom-file read and denied-read stop stand. Claude keeps native `Read`.
Codex uses a supported file-access operation exposed by its active session. A restricted probe
that rejects an operation does not prove that the provider lacks file access.

Historical records retain their original text. The issue state, lane paths, landing mechanisms,
Superpowers procedure, and board contract stay shared.

## Context

The maintainer needs to use Claude Code, Codex CLI, and Codex desktop on the same product project
and switch hosts between steps. A second procedure tree would permit the lane rules to drift.
Host names and cache paths cannot reliably select an installed package or a saved session.

## Constraints and evidence

- The existing manifests install on Codex. No separate package or generated skill copy is needed.
  Codex 0.162.1 installed celetis from a private Git ref and refreshed it with the normal
  marketplace commands. A local-path source cannot serve the runner's Git upgrade command.
- Codex 0.162.1 provides `skills/list`, effective `config/read`, `thread/read`, and
  `thread/turns/list`. The production adapter uses these APIs without a discovery model turn.
  The current CLI has `execpolicy check`, and no plugin-validation command. Its policy checker
  allowed the three documented landing prefixes and denied the direct merge prefix.
- Claude Code 2.1.299 supplied the current saved user-turn fields. Its final model suites stopped
  on the account quota. Version 2.1.300 was later observed; no final live parity result is inferred.
- Superpowers 7.0.0 installed through its Git marketplace on Codex. herdr 0.9.3 reports the current
  Claude v10 and Codex v8 integrations. Installation alone does not prove trusted startup.
- agent-board 2.0.0 at tag commit `e36283b` reads the current config path and contract 1. Its
  contract checker and some live actions passed. Full Run, no-progress, and exact Resume remain
  incomplete. A newer local board checkout is not the released dependency.
- Bash 3.2.57, Perl 5.34.1, and Node 26.11.1 are the observed local runtimes. Shell fixtures and
  the final local gate use Bash 3.2; live model checks stay separate from deterministic CI.
- A Codex refresh changed an installed skill's sibling file in place while an existing app-server
  still advertised that path. No supported per-session package pin is proved. Update serialization
  alone does not satisfy stable active resources.

Official references checked on 2026-10-15:
[Codex CLI](https://learn.chatgpt.com/docs/cli/reference),
[plugin packaging](https://developers.openai.com/plugins/build/plugins), and
[command rules](https://learn.chatgpt.com/docs/agent-configuration/rules).
`docs/celetis-flow.md`, "Acceptance status", records current proof and limits. These observations
do not certify a minimum version for full workflow parity.

## Decision

Keep one set of 18 skills, one step text, the current manifests, all public script filenames,
and `.claude/celetis-flow/`. One host entry owns installed references, invocation, custom text,
checkout binding, and dispatch operations. The resolver's output stays the common state contract.

Select a new step by explicit `--host`, environment, project Git setting, then Claude. Reject
invalid selection or metadata. Record the exact host, issue, step, main checkout, and verified
session ID in one current schema. Resume uses that record and the shared issue lock, without
refresh or an automatic watcher. Git compare-and-set locks recognize a live runner or registered
foreground after owner loss. Owner release waits for the foreground's actual exit; a submitted
exit prompt is not process completion.

Keep capability digits portable. At dispatch, map them through a profile validated against the
active surface's actual models and efforts. Ship no Codex model defaults and substitute no Claude
alias. Repairs retain child identity; unsupported changed-pair controls are a setup stop.

Codex remains opt-in until the full acceptance matrix passes. Stable active resources, native
desktop discovery, changed-pair same-child repair, final model suites, and live workflow/board
checks remain release requirements. A supported resource solution or an explicit spec change
must resolve the resource gap. No alternate transport is approved by this record.

## Alternatives considered

- Duplicate the workflows for Codex: each later rule would need two edits and two drift checks.
- Guess installation cache paths: enabled state and installation identity would remain unchecked.
- Reuse a session name for resume: labels can repeat and do not establish saved identity.
- Add old-format readers or migration: the current contract requires strict metadata and records.
- Copy a package or hold only a refresh lock: neither binds all later reads of an active session.
- Treat installation or a text-only turn as full acceptance: neither exercises native tools,
  trust, foreground lifecycle, or landing.

## Consequences

Both hosts share product state and the guarded shell operations. Host-specific failures stop at
their boundary with a setup action. The local gate can check package structure and protocol
fixtures without model access. Permission rules reduce command mistakes within each host's
scope; they do not create a complete sandbox around every possible merge route.

Live acceptance remains material work. The implementation must not claim full support or ship
while those required checks or stable resources remain unresolved.

## Reconsider when

- A host stops supporting the shared manifests or supplies an immutable installed-resource handle.
- The current API cannot identify an enabled package or a persisted exact session.
- Native desktop tools can apply changed model and effort to the same child identity.
- Live tests show that a shared procedure needs a different host operation or a stronger guard.
