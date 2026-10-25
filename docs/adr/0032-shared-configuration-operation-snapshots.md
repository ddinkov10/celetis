# Shared configuration parsing and operation snapshots

## Date

2026-10-25

## Related

- [Issue #100](https://github.com/ddinkov10/celetis/issues/100): approved spec and plan.
- [ADR-0024](0024-the-config-read-runs-on-bun.md): the strict reader and former host hint.
- [ADR-0013](0013-the-session-reads-custom-parts-with-file-tools.md) and
  [ADR-0015](0015-one-repository-yaml-config.md): native entry and checkout sources.
- [ADR-0029](0029-the-repository-keeps-no-tests.md),
  [ADR-0030](0030-the-installed-plugin-owns-the-entrypoint.md), and
  [ADR-0031](0031-plugin-development-is-independent-of-adoption.md).
- `engine/lib/config.ts`, `engine/lib/operation.ts`, `engine/launcher.ts`,
  `engine/celetis-flow.ts`, `engine/next-step.ts`, and `engine/land.ts`.

## Supersedes

Only these clauses of ADR-0024, "The config read runs on Bun", change. Accepted records retain
their historical text and evidence.

- Decision, "The host hint": implicit selection reads only `host` with `Bun.YAML.parse` before
  plugin discovery. Both projections now use the invoked package's strict parsed source.
- Decision, "The full check": the launcher performs a separate main-config read after plugin
  lookup for `worktree`, `celetis-flow`, `next-step`, `land`, and `board`. The named command now
  creates its operation after process replacement and reuses that source for full validation.
- "The intended differences", "The launcher": the native host parser's accepted forms and
  `invalid agent null` or mapping/sequence diagnostics. Shared source checks and host validation
  now determine these results; unrelated field validation remains a separate projection.
- Consequences: "The launcher has two parsers: `Bun.YAML` for the host hint and `yaml` for the
  full check." There is one programmatic interpretation.

The strict full reader's file-access, encoding, schema, literal-text, and diagnostic contracts
stand. ADR-0029's temporary-only TDD and gate policy, ADR-0030's installed package and process/lock
rules, and ADR-0031's independent-development boundary remain unchanged.

## Context

Host selection and commands interpreted the same YAML through different parsers. A file could
select a host and then fail differently at the full reader. Repeated prechecks and resolver
subprocesses could also observe different file versions within one operation. Long waits made
the reverse problem possible: old landing policy could authorize a later protected action.

The runtime needs stable internal values while still seeing changed policy at explicit public,
step, checkout, setup, board-refresh, and landing boundaries. Native skill entry has a separate
permission decision that a runtime value cannot replace.

## Constraints and evidence

- The landed strict reader and vendored `yaml` 2.9.1 already expose document and node metadata.
  The full-validation behavior of `b7d5261` is the reference; the vendor bundle stays unchanged.
- ADR-0030 places the entrypoint and engine in one package. The former need for an independent
  bootstrap parser no longer applies.
- Main owns policy, the active checkout owns native custom text, and the target lane owns setup.
  A subfolder cannot become another policy source.
- Locks identify real `land.ts` and `celetis-flow.ts` processes. Moving selection after initial
  process replacement preserves those names without reading config twice.
- Required runtime configuration and optional native absence have different contracts. Parser
  checks cannot establish native permission behavior; live CLI evidence remains separate.
- This repository keeps private checks outside the tree and uses its verify gate before landing.
  This record adds no stored test, installation update, or product-adoption prerequisite.

## Decision

Keep byte access, parsing, metadata checks, host/full validation, immutable typed results, and
diagnostic rendering together in `engine/lib/config.ts`. `readConfigSource` checks safe access
and unambiguous source structure once. `configHost` validates only optional `host`;
`validateConfig` checks the full schema from that same source. Thus `host: codex` can select
Codex without `landing`, while no partially validated object can authorize protected work.
Explicit host selection performs no YAML read for selection. Remove native-parser quirks.

Pass an explicit frozen `Operation` through internal handlers. It contains canonical main,
active, and common Git identities, original selection inputs, the selected host, and the required
deeply frozen configs. Read each distinct required checkout once; reuse one source and value
when main and active are equal. Resolve conditional validation mode once from the selected host.
Null config means that full projection was not required. No mutable global, environment
transport, persistent snapshot, or cwd change communicates these values.

Replace the initial process before configuration reads, then create the command's operation
after argument validation. Internal resolution uses `resolveNext` in-process. Separate public
commands and work that needs a new checkout or file obtain fresh values. Board refreshes and
new runner steps share one operation for their resolution and policy decisions. The runner keeps
the original selection inputs and captures each active session's host and exact ID separately.

Landing begins fresh and repeats policy and repository preflight after asynchronous work and
before protected actions. A changed mechanism stops the attempt and requires a new invocation.
Recheck the captured branch, tip, trunk, PR identity, and final-green state while retaining
SHA-bound merge requests and non-forced pushes. Stable internal values do not promise a
cross-checkout filesystem transaction or a remote transaction with GitHub.

Native entry still reads its whole optional active file through the host's permission-checked
tools for each invocation or first borrowed reference, applies only its custom string, and runs
no setup. A denied entry stops without a parser, cache, shell, or alternate-tool retry.

## Alternatives considered

- Keep `Bun.YAML` for bootstrap: preserves two interpretations after the packaging reason is gone.
- Fully validate during every host selection: prevents host-only operations from accepting a
  structurally valid host with unrelated missing or invalid fields.
- Re-read in every helper or resolver subprocess: permits mixed values inside one decision and
  adds process work without defining freshness.
- Cache globally or transport JSON through environment or disk: hides lifetime and allows one
  operation's state to affect another operation or permission boundary.
- Retain one snapshot for the whole runner or landing wait: misses changed step defaults or
  allows stale policy to authorize a protected action.
- Use a runtime snapshot for native entry: bypasses the host's current file-access decision.

## Consequences

Programmatic consumers share one schema and diagnostic path. Internal decisions use stable,
isolated values; new operations observe edits or fail on them. Bootstrap intentionally refuses
ambiguous forms that the native parser accepted and uses the strict reader's host diagnostics.

Callers must pass operation values and choose fresh boundaries explicitly. Landing performs
additional reads around waits. No transaction removes every race with Git or GitHub; existing
locks and captured-SHA protections remain necessary. Native interpretation still needs live
read and denial evidence on both required CLI hosts. A source or gate result alone closes none
of those native checks, and a source edit updates no installed package.

## Reconsider when

- A new command needs a configuration lifetime that these explicit boundaries cannot express.
- Repository operations acquire a real transactional API that changes the preflight contract.
- A required host provides deterministic native file access with equivalent permission,
  checkout, optional-absence, and invocation semantics.
- Parser metadata or package delivery changes enough to invalidate the shared-source premise.
