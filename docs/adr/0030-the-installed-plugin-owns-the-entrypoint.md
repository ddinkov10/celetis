# The installed plugin owns the entrypoint

## Date

2026-10-24

## Related

- Issue #99.
- `bin/celetis.ts`, `engine/launcher.ts`, `engine/board/adapter.ts`, and `engine/plugin-update.ts`.
- ADR-0025, ADR-0026, and ADR-0028.

## Supersedes

Only these clauses change. Historical records and their evidence stay unchanged.

- ADR-0012: the product launcher and rejection of a plugin `bin/` entrypoint. In "The wiring",
  the product `.claude/settings.json` no longer enables `celetis@celetis`; it still enables
  `superpowers@superpowers-marketplace`.
- ADR-0014: commands invoke a launcher in the product checkout.
- ADR-0015: products copy the changed launcher during manual setup replacement.
- ADR-0017: setup owns and rewrites a product launcher and its associated allows and attributes.
  In "Setup writes the host files", setup no longer owns `enabledPlugins.celetis@celetis`. "A
  project cannot decline the block" and "A block that the maintainer removes comes back at the
  next run" now apply only to `extraKnownMarketplaces.celetis` and
  `enabledPlugins.superpowers@superpowers-marketplace`.
- ADR-0020: board files live at the package root and the Celetis adapter sends its command lists
  through generic stdin. The generic board boundary stays project-only.
- ADR-0024: the copied-launcher assumptions in the Bun config-reader delivery and cutover.
- ADR-0025: the standalone launcher build target and copied executable requirement. TypeScript,
  isolated Bun execution, and deterministic browser/native generation stay.
- ADR-0028: only the standalone-bundled operator command for obsolete-updater repair. Terminal
  confirmation, updater-only serialization, open sessions, and all other update checks stay.

## Context

A copied launcher can keep old behavior after the installed plugin changes. Each product then
needs a second delivery step. Runtime source and product configuration have distinct owners.
The installed package can supply the full command path without a product file.

## Constraints and evidence

Both hosts expose enabled package identity through supported native metadata. Task 1 of #99
proved one applicable canonical root, hostile argument paths, personal landing bindings, and
Claude loading of `../engine/hooks/entry.js`. Codex declares empty hooks. Codex splits a shell
script into argument lists only when each word is plain or quoted; a leading assignment, a
quoted first word, or an unquoted substitution keeps the whole script as one argument. So each
agent command starts with an unquoted `/usr/bin/env`, which makes the isolation assignments
plain arguments. On 2026-10-25, live Codex CLI 0.164.0 turns with temporary `forbidden` rules
split that form: one prefix that ends at `land` matched two issues and a hostile subject. The
same commands with a quoted first word did not split. `codex execpolicy check` matched that
prefix to no `root`, other script, other host, or inserted option. A machine path is not a
portable shared allow. Claude wildcards can span spaces. Claude does not strip `env`, so its
rule is the literal prefix with a final ` *`. The Claude package path holds the version, so
each Claude update needs a new binding; the Codex package path does not change.

Claude discovery accepts one enabled canonical root for a project. A project install can hold a
version other than the user install. On 2026-10-25, three products had the user root
`c8e681a7dc02` and a project root on another version. Discovery refuses that case as ambiguous.

ADR-0028 permits open consumers. Native replacement can remove resources that they still need.
It proves neither immutable resources nor automatic live skill reload. Existing process basenames,
argument boundaries, exact Resume, isolation, and updater safety remain required.

## Decision

Deliver the thin source entrypoint `bin/celetis.ts` and its local runtime under `engine/`. Keep
runtime basenames, separate board and hook modules, and maintenance programs under `scripts/`.
Ordinary dispatch uses the invoked package. Native lookup remains in operations that need it.
Build only browser and native-hook delivery. Users need no installation build.

Skills bind the package that supplied their loaded file and explicitly select their host.
Terminals discover one enabled canonical root, then keep the quoted absolute entrypoint in a
shell variable. Updates require rediscovery; a Claude update also requires personal permission
rebinding. Shared rules keep direct merge restrictions. Personal rules bind the tested command
form and selected path up to `land`, so one rule serves each issue and subject.

The Celetis board adapter constructs fixed command arrays in-process. It validates the package
entrypoint and selected Bun. Generic stdin keeps its project-only executable boundary. HTTP
requests select only host and issue; they supply no command path.

New setup owns no launcher. Existing launchers, related instructions, rules, attributes, and
ownership entries need a reviewed manual cutover. Preserve differing or unowned files and
truthful ownership until the owner approves that cutover. Preserve config and session bytes.

Each product keeps only the Claude user install. Setup writes and owns no project
`enabledPlugins.celetis@celetis`. A product with an owned entry gets a manual cutover: setup
preserves the entry and its ownership record and reports the cutover.

An identifiable installation with an obsolete updater can use an explicitly selected, clean,
reviewed source checkout outside the product and lanes. Verify its source and full revision
before executing its `bin/celetis.ts` from the product directory. That entrypoint imports its own
updater. Native metadata still defines the enabled target and exact offer. Pre-update identity checks use
the canonical manifest and skill identity; they read no old runtime path. Fresh post-update checks
require the new entrypoint and engine. One direct terminal
response permits one attempt. Fresh validation uses loaded code and never executes replaced
updater code. A null offer or same-revision corruption requires a separate native repair review.

## Alternatives considered

- Keep the product copy: preserves two independent delivery paths and the stale-code failure.
- Add a forwarding stub or global installer: adds a second path and ownership without removing
  the product dependency.
- Permit arbitrary absolute board commands: breaks the generic project trust boundary.
- Use shared wildcard landing allows: does not bind a safe portable native command.
- Bind the exact `/bin/zsh -lc` landing script on Codex: needs a new rule for each issue and
  subject.
- Automatically fall back to another updater: executes code that the person did not select.
- Keep consumers alive through a private resource copy: adds lifetime control that ADR-0028
  explicitly removed.

## Consequences

One package owns command code. Products keep only their configuration and wiring. A full path
cutover is atomic because partial callers cannot serve a fresh product. Maintainers must review
product changes and select a recovery source before each product's next use of Celetis, then
complete its cutover and rebind personal Claude rules after a native update. Product readiness
and cutover are not conditions of the plugin landing. Open work may need a voluntary restart when a replaced resource is needed. Fresh sessions load
new skills. The native results above are historical evidence. The repository keeps only the
verify gate under ADR-0029; it has no test fixtures or manual harnesses.

## Reconsider when

A required host gains a portable safe command binding or changes its shell-script split, rule
matching, native plugin discovery, module loading, or replacement semantics; or Bun source
delivery stops meeting the supported process and isolation contract.
