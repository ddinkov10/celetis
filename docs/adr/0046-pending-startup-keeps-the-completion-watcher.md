# Pending startup keeps the completion watcher

## Date

2026-10-28

## Related

- [Issue #150](https://github.com/ddinkov10/celetis/issues/150): the root cause, the maintainer's
  warning policy, and the implementation plan.
- `endWhenDone` and `runIssue` in [engine/celetis-flow.ts](../../engine/lib/run-engine.ts).
- `observeSession` and `verifySavedSession` in [engine/lib/session.ts](../../engine/lib/session.ts).

## Supersedes

[The runner announces the Claude session ID to herdr](0039-the-runner-announces-the-claude-session-id-to-herdr.md),
only its Consequences clause that retains a terminal 60-second startup deadline. The Claude ID
announcement and saved-turn verification remain in force.

## Context

A managed step can save its first user turn after 60 seconds. The old startup watcher stops at
that deadline while the foreground host stays open. A later valid turn then has no watcher to
observe the issue result and request the normal host exit. A slow first turn and a setup prompt
that needs a person are both pending states, not proof that startup failed.

## Constraints and evidence

The root-cause reproduction executes the checkout's actual watcher with a virtual clock. It
stops at 60,000 milliseconds before reading a saved identity. The real Claude persistence
verifier accepts a matching user row at 69.482 seconds. These checks show that a valid late turn
can outlive the old watcher; they establish no maximum native startup duration.

The runner already owns the foreground-exit promise, cancellation, and issue lock. The watcher
separately rejects invalid identity data. UUID, host, checkout, launch-time, and saved-turn
checks must remain intact. An announced identity alone cannot authorize completion or exact
Resume. The change applies to both hosts and adds no configuration or host API.

## Decision

The maintainer selected the warning policy on 2026-10-28. After 60 seconds of pending startup,
print one warning that names the issue and host, says `monitoring continues`, and directs the
person to check setup prompts in the pane. Continue the existing one-second verification loop.

The warning writes no terminal error marker and requests no restart. A later verified saved
turn enters the existing completion checks. Invalid identity data still ends the watcher.
Cancellation and foreground exit retain their existing cleanup paths. Foreground exit without
a verified saved turn still reports the final startup error.

## Alternatives considered

- Keep the terminal deadline. This loses completion monitoring for a valid late saved turn.
- Wait silently without a deadline. This keeps ownership with less code, but removes early help
  for setup prompts. The maintainer chose to keep that help.
- Increase the deadline or make it configurable. Another fixed duration cannot prove that
  persistence failed and adds a policy surface without resolving the lifetime error.
- Save the announced ID before persistence. This would weaken the trust checks and exact
  Resume requirement.

## Consequences

A late first turn can complete automatically without a runner restart. Pending startup can
remain pending until foreground exit or cancellation. The runner retains foreground ownership
and the issue lock while the host runs; the warning does not release either. A person may still
need to complete a setup prompt or exit the host. The warning cannot suppress a final error
when no saved turn verifies.

## Reconsider when

- A host provides an authoritative terminal startup-failure event.
- The runner no longer owns foreground lifetime and cancellation.
- Setup prompts no longer need a person, or the warning no longer gives useful help.
