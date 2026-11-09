# Automation is required on CLI hosts only

## Date

2026-10-20

## Related

- [ddinkov10/celetis#53](https://github.com/ddinkov10/celetis/issues/53): the approved spec and
  [corrected Intent](https://github.com/ddinkov10/celetis/issues/53#issuecomment-6290267498).
- [ADR-0014](0014-one-workflow-uses-explicit-host-operations.md): shared workflow and host operations.
- [ADR-0015](0015-one-repository-yaml-config.md): shared YAML configuration and native entry.
- [Acceptance status](../../plugins/celetis/docs/workflow.md#acceptance-status),
  [live acceptance](../../tests/manual/live-acceptance.md), and
  [Codex native config entry](../../tests/manual/config-entry-codex.md).

## Supersedes

Only the desktop automation and release-gate scope of these clauses changes:

- ADR-0014, Decision: the desktop portion of "the full acceptance matrix" and "native desktop
  discovery" in the release requirements. Changed-pair same-child repair remains required on
  required CLI surfaces; desktop-only child controls become optional evidence.
- ADR-0014, Consequences: "must not claim full support or ship while those required checks"
  remains a gate for required CLI checks, without an optional desktop automation gate.
- ADR-0015, Supersedes: the inherited "incomplete acceptance" of ADR-0014 has the required CLI
  scope above. Its Constraints and evidence record, "Codex desktop isolated binding is BLOCKED",
  remains accurate and becomes optional evidence. Its "release requirements" and Consequences'
  "remaining host or live board acceptance gap" retain every applicable required CLI obligation.

The historical files keep their original text. Shared procedures, manifests, host operations,
permission rules, configuration storage, saved host and exact Resume, locks, capability semantics,
Codex opt-in status, and unresolved required CLI acceptance remain in force.

## Context

The corrected Intent keeps manual and inline Codex desktop invocation available but requires
automatic flows only for Claude Code and Codex TUI/CLI. The former acceptance policy required
every lane and helper on both Codex surfaces. A desktop-only limitation could therefore block
CLI development or acceptance even though the terminal runner already launches the selected CLI.

## Constraints and evidence

- The observed Codex CLI 0.162.1 interactive flow uses `codex --no-daemon`, as the shared session
  argument builder specifies. This change adds no runtime proof or new host operation.
- The desktop selector cannot bind the owned isolated package: BLOCKED. CLI typed skill input,
  shell fixtures, and quoted model tests do not prove desktop native entry or automation.
- Stable installed-resource lifetime and changed-pair same-child repair remain unresolved on
  required CLI surfaces. Codex remains opt-in while required CLI acceptance is incomplete.
- Existing versions, failures, commits, evidence links, scenario observations, and the 24-case
  native config matrix remain evidence for their recorded scope. Changed model inputs require
  fresh complete results on the affected required host.
- A missing tool, unavailable model/effort pair, or denied read still stops the particular
  requested operation under the existing host rules.

## Decision

Require automation for Claude Code and Codex TUI/CLI only. "Both hosts" in current acceptance
text means these two CLI hosts. Terminal runner and board actions continue to target those CLIs.
Use one shared workflow, skills, manifests, configuration, host adapters, lane order, context rules,
and handoffs. Add no desktop detection, refusal, separate lane, or support setting.

Keep the shared flows callable manually or inline in the Codex desktop app through the advertised
named skill and actual supported tools. Desktop automation is optional. Record each desktop
probe separately as PASS, FAIL, BLOCKED, or UNRUN. BLOCKED and UNRUN remain incomplete and cannot
become PASS without native evidence. They do not block CLI development, required CLI acceptance,
or a change that satisfies its required checks. Desktop success cannot close a required CLI gap.

## Alternatives considered

- Require full desktop automation: keeps one acceptance bar across surfaces, but makes CLI work
  depend on desktop selector and child controls that the intended automatic flows do not need.
- Remove desktop use: reduces the surface list, but rejects the approved manual and inline use
  and would add a refusal or split to shared procedures.
- Keep the shared workflow with optional desktop automation: preserves manual use and existing
  tool and permission checks while placing the required automation bar on the intended CLI hosts.

## Consequences

Desktop-only capability or evidence gaps no longer block otherwise complete required CLI checks.
Required CLI resource, repair, lane, runner, board, permission, and handoff checks retain their
observations and failure rules. Optional desktop results need separate records, and operation-local
setup stops still apply. The separate optional Claude desktop board preview keeps its existing
evidence and scope. This decision proves no new runtime success.

## Reconsider when

- The intended automatic workflow requires a native desktop operation that a CLI cannot supply.
- Native desktop selector or child controls gain capabilities that justify optional automation work.
- A shared workflow cannot preserve the required CLI or manual desktop operation's host and
  permission rules without a different architecture.
