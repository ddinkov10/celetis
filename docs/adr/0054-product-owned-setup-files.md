# Worktree setup references product-owned TypeScript files

## Date

2026-10-30

## Related

- [ddinkov10/celetis#107](https://github.com/ddinkov10/celetis/issues/107).
- [ADR-0032](0032-shared-configuration-operation-snapshots.md): configuration snapshots and
  checkout selection.
- [ADR-0052](0052-setup-owns-required-configuration-and-host-wiring.md): required wiring and
  preserved product ownership.
- `validateWorktreeSetup` in `engine/lib/config-core.ts`, `setupFile` and `runSetup` in
  `engine/lib/worktree.ts`, and `Setup.checkSetupSource` in `engine/setup.ts`.
- [mise file tasks](https://mise.jdx.dev/tasks/file-tasks.html#working-directory): normal file
  tasks use the project configuration root as cwd. This is a behavior reference, not a dependency.

## Supersedes

Only these inline-source and source-input clauses change:

- [ADR-0015](0015-one-repository-yaml-config.md): `worktreeSetup` stores program
  text and uses a multiline literal block. Instruction strings in `custom` keep that form.
- [ADR-0018](0018-setup-proposes-and-tests-the-worktree-setup.md): the proposed script is a
  scratch-file input; `--setup-file` reads its contents; setup appends them as a literal block;
  and an older lane can run source supplied by main. Proposal review, detached wiring tests,
  hooks, baseline, marker, and push approval remain.
- [ADR-0025](0025-the-toolchain-runs-on-typescript-and-bun.md): setup writes parsed TypeScript
  to a private temporary file before execution. The selected Bun, arguments, streams, statuses,
  signals, markers, and creation-based cleanup remain.
- ADR-0052's clarification that application setup remains intact: the approved product addition
  is now a file reference. Setup gains no authority over its source.

The historical records keep their text. All other clauses and later supersessions stand.

## Context

Inline program text loses the product file's identity. A temporary source file resolves sibling
imports from its temporary directory. It also makes Celetis a source writer when the product
needs normal, reviewed application files. Detached wiring tests need the committed source that
a new lane will receive, rather than uncommitted files copied from main.

## Constraints and evidence

- The field and command names stay `worktreeSetup` and `--setup-file`. Inline programs are
  rejected; there is no compatibility reader, conversion, source copy, or loader API.
- Main owns operational policy, the target lane owns executable source, and the active checkout
  owns only the selected custom instruction. Config reads and skill entry access no setup file.
- Disposable command checks use Bun 1.4.4 and local bare origins. They observe direct lane-file
  identity, sibling imports, root cwd after subfolder invocation, inherited streams, one main
  argument, failure statuses, markers, and source ownership. Native host acceptance is separate
  and retains its limits in `docs/celetis-flow.md`, "Acceptance status".
- Product setup is trusted code. Immediate path validation is not a file-swap transaction and
  does not restrict transitive imports. No product adoption is required to verify the plugin.

## Decision

Store one exact root-relative `.ts` file reference in `worktreeSetup`, for example
`"scripts/worktree-setup.ts"`. Omission or exactly `""` means no setup. Validate the reference
lexically at every full config boundary. Before execution, require a readable regular file
inside the canonical target checkout, with no final or ancestor symlink below its root and no
nested repository, submodule, or other worktree boundary. Run that file directly on the selected
isolated Bun with cwd at the target root and one absolute main-checkout argument. Preserve
normal imports and source identity. No execute bit or exported function is required.

The setup skill proposes the root-relative path and complete contents. The owner approves,
creates, and commits the entry and required helpers on local trunk in a separate product change
before the detached wiring test. A changed failed proposal requires a new source commit before
retry. `try` and `write` require the entry in local trunk HEAD with an unchanged index and working
file. Setup writes only the approved reference, ignores, and baseline within its existing write
and push approvals. It creates, copies, stages, owns, commits, and pushes no application source
to make testing possible. Existing references, including `""`, stay unchanged with a conflict
warning when applicable. An older lane with missing source requires owner preparation, with no
copy or automatic merge fallback.

Keep the existing marker. A successful nonempty reference, including a zero-byte file, marks
the lane. Source edits do not clear it. Explicit `setup lane` selects the main reference,
clears the marker before validation, and runs only the target lane's file. Failure cleanup stays
based on which worktree and branch the command created.

## Alternatives considered

- **An exported-function loader.** This could pass a typed context, but creates an application
  API, loader error rules, and a second execution model. Direct execution keeps normal Bun
  behavior, imports, arguments, streams, and exit statuses with less code.
- **Keep inline text or copy it to a temporary file.** This keeps source in configuration and
  breaks normal source identity and sibling resolution.
- **Copy uncommitted source into the detached lane.** This tests a tree that a new lane will not
  receive and gives wiring operations source-write authority.
- **Add a conversion or fallback.** This hides obsolete input and makes the contract ambiguous.
  Product owners change their configuration in a separate explicit operation.

## Consequences

Application setup uses normal product files and imports. Owners must commit source before
testing wiring and bring it into older lanes before an explicit rerun. Existing inline setup
must be replaced explicitly. Wiring ownership, historical claims, stage limits, conflict
preservation, partial-write reports, and push approval stay unchanged. No package is added.

## Reconsider when

- Direct Bun file execution can no longer preserve the required source, import, cwd, argument,
  stream, status, or signal behavior.
- The product requires an untrusted-code boundary or a file-swap transaction instead of a
  trusted checkout.
- A supported runtime requires an application loader API that direct execution cannot supply.
