# Constitution of Celetis

## What it is

Celetis is a software factory harness: the process and the runtime around coding agents that take
each change of a product through its lifecycle. Its aim is intent to release. Today a change goes
from intent to the trunk, and each product project does its own release.

## Who it serves

The maintainers of the product projects that use the plugin. Each of them owns the adoption and the
wiring of its project, and decides the goals, the hard limits, and the non-goals of its product. The
maintainer of this repository is one of them, because this repository is a product project of its
own plugin.

## Goals

The order is the priority: in a conflict, the higher goal wins.

1. **Intent to release.** Each change of a product moves from intent toward release, and Celetis
   runs that path. Why: this path is the aim of Celetis.
2. **Autonomous steps.** The daemon runs the phases of the SDLC as autonomous workflows. A hold
   stays only for an act outside the session, and a live question waits in the tab of the step.
   Why: a hold that needs no act outside the session costs an assist session and the attention of
   the maintainer (ADR-0063).
3. **Verified landing.** A change lands only when the checks of its project pass on the tip that
   lands. Why: a check result must belong to the tip that lands (ADR-0036).
4. **Product neutrality.** The plugin names roles, and each product project names its own parts.
   Why: Celetis fits different types of product.

## Hard limits

- **One landing path.** An agent lands a change only through `celetis --agent <host> land`, and only
  when the checks of the project pass on the tip that lands. Why: the landing checks the exact tip
  that it lands (ADR-0036).
- **No agent approval of an update.** An agent never confirms, clicks, scripts, or approves an
  update of a real installation. A person confirms the exact target, in a terminal or by a direct
  click on the board. Why: an agent must not approve a change to a live installation on behalf of a
  person (ADR-0048).

## Non-goals

- The checks of a product. The project supplies them, and the landing requires their pass.

## Amendments

- 2026-11-12: Adopted. Reason: each design decision of Celetis steers by one approved statement of
  its purpose, goals, and limits (#291).
