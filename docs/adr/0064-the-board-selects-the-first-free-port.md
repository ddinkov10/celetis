# The board selects the first free port

## Date

2026-11-03

## Related

- [Issue #76](https://github.com/ddinkov10/celetis/issues/76): the approved specification and plan.
- [ADR-0035](0035-the-board-is-a-part-of-the-engine.md): the board's configuration and startup.
- `engine/board/start.ts` and `engine/board/restart.ts`.

## Supersedes

Only the fixed startup-port behavior of ADR-0035, "The board is a part of the engine".
The main-checkout configuration, loopback boundary, and fixed adapter remain in force.

## Context

An occupied configured port prevented a second board from starting. The maintainer requested
the first free port, starting at the project's configured port. Update restart has a different
need: the browser must reconnect to the same origin after the old listener closes.

## Constraints and evidence

The approved specification keeps `board.port`, its default of 4403, and the existing numeric
interpretation of `PORT`. It requires consecutive actual binds through 65535, with no separate
probe that releases a candidate before startup. The temporary Bun 1.4.4 checks reproduced the
old first-collision failure and exercised retries, exact overrides, shutdown, concurrent
selection, and the real restart boundary with temporary installation data. These macOS checks
do not establish behavior on other platforms.

## Decision

Automatic startup tries consecutive loopback ports from the configured start and retains the
first successful listener. Only an address-in-use failure permits another candidate. An
effective `PORT` remains an exact request. Update restart supplies the actual listening port
through that same existing override, so a collision fails visibly instead of moving the origin.

The operating system's bind owns the shared-port decision. The board keeps no registry or
selected-port setting. One startup lifecycle owns readiness and cancellation across retries.

## Alternatives considered

- An operating-system-assigned port avoids a search but ignores the approved configured start.
- Searching from `PORT` too would let update restart move the browser's origin. It would need
  another exact-port mechanism to preserve reconnection.
- Probing and releasing a port leaves a race before the actual listener binds it.

## Consequences

Boards can start beside occupied ports without a configuration edit. The printed URL is the
source of truth; a later normal start can use another port. Saved URLs and browser preferences
can therefore refer to another origin. The search is finite and remains interruptible.
Update restart can still lose its exact port after teardown; it retains the visible failure
and recovery command with that actual port.

## Reconsider when

- The board must retain a stable origin across ordinary starts.
- Update restart no longer relies on reconnecting the existing browser to the same origin.
- The board supports interfaces beyond its explicit loopback listener.
