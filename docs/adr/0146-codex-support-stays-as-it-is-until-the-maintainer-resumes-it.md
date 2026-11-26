# Codex support stays as it is until the maintainer resumes it

## Date

2026-11-26

## Related

- [Issue #395](https://github.com/ddinkov10/celetis/issues/395): the intent, and the decisions of the maintainer of
  2026-11-26 (the comment "Decisions of the maintainer, 2026-11-26").
- [Issue #21](https://github.com/ddinkov10/celetis/issues/21): the start of the Codex work when the maintainer resumes it.
- [One workflow uses explicit host operations](0014-one-workflow-uses-explicit-host-operations.md) and
  [A host states what it can run](0104-a-host-states-what-it-can-run.md): the shared workflow and the host
  adapters, which this record leaves in place.

## Supersedes

- [Automation is required on CLI hosts only](0016-automation-is-required-on-cli-hosts-only.md), in part: in "Decision",
  the rule that "both hosts" in current acceptance text means Claude Code and the Codex CLI. While Codex is deferred,
  no change needs a Codex result. The rule that desktop automation is optional stays.

## Context

The maintainer decided that continuous support of Codex is deferred. It stays as it is on this date, and the
maintainer resumes it at a later time. The maintainer has no access to Codex CLI, so no runtime check can run on it,
also on a machine that has the program `codex`. The open issues #21, #59, and #62 require a Codex result. Other open
issues, for example #351 and #379, name a Codex part. Without a record, a future issue session reads those issues and
plans Codex work or a Codex check that no one can run.

## Constraints and evidence

- No runtime check of a change can run on Codex. The program `codex` (codex-cli 0.167.0) is on the machine of the
  maintainer, but the maintainer has no access to Codex CLI.
- The verify gate type-checks the Codex code (`engine/lib/host/codex/`, `engine/board/chat/codex.ts`), so a change
  that breaks that code does not pass the gate.
- Shared code and shared procedure modules still carry Codex branches and Codex parts. A change to shared text can
  make a Codex part out of date without any check failing.

## Decision

Codex support stays as it is on 2026-11-26 until the maintainer resumes it.

1. The Codex code and the Codex parts of the modules stay as they are.
2. A change adds no Codex work and runs no Codex check. This covers a new Codex feature, a Codex fix, and a runtime
   check on Codex.
3. A change still passes the verify gate. The gate type-checks the Codex code, so that code continues to compile.
4. A Codex part of a module can become out of date. A report names each Codex part that it did not check, and does
   not say that the part passes.
5. The issues #21, #59, and #62 are deferred, because each one requires a Codex result. An issue that only names a
   Codex part, for example #351 and #379, continues, and its Codex part is out of scope.
6. When the maintainer resumes Codex, a new issue checks Codex again, with #21 as its start. That issue also
   supersedes this record.

The maintainer chose the narrow scope: only the issues that require a Codex result wait, so the work on shared code
does not stop for a host that no one can check.

## Constitution

Read: `CONSTITUTION.md`, amended 2026-11-12.

- Serves: 1. Intent to release: changes of the shared engine and plugin continue to the landing, and no change waits
  for a Codex check that cannot run.
- Serves: 2. Autonomous steps: a step session needs no human act for a Codex result.
- Tension: 3. Verified landing: a Codex part of a change is not checked at runtime, and only the gate type-checks it.
  The report of the change names each unchecked Codex part, so the landing claims nothing about Codex. Goal 1 is
  higher than goal 3.
- Hard limits and non-goals: none touched.

## Alternatives considered

- Defer each issue that names a Codex part: stops the work on shared code (#351, #379) for a host that the change only
  touches in part. Rejected by the maintainer.
- Remove the Codex code: loses a tested opt-in implementation that the maintainer plans to resume.
- Keep Codex checks required: no check can run, so no change can pass them.
- Keep the intent only in the issue #395: a future session reads the plugin and the code first, and does not find it.

## Consequences

- #21, #59, and #62 show as deferred on the board until the maintainer removes the deferral.
- A Codex part of a module can drift from the shared text, and a later Codex issue must find and repair that drift.
- A report of a change that touches shared text has one more line: the Codex parts that it did not check.

## Reconsider when

- The maintainer has access to Codex CLI, or decides to resume Codex support.
- A change cannot pass the gate because of the Codex code, so the Codex code needs a change.
