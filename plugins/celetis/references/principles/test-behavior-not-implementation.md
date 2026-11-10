# Test behavior, not implementation

## Applies when

A task designs, changes, or reviews a behavioral verification check.

## Rule

Derive the expected result from the requirement. Exercise the real behavior through its input
and observable result. Identify a change that breaks the required behavior and must make the
check fail. Keep the check independent of internal structure that can change while the caller
observes the same behavior.

Use verification probes, gates, or tests that the project permits. This rule does not authorize
a tracked test where the project prohibits one.

## Check

Show that a change which breaks the required behavior fails the check. An internal refactor
that preserves the caller-visible behavior must pass.
