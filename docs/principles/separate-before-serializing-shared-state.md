# Separate before serializing shared state

## Applies when

Concurrent actors can write the same target.

## Rule

Identify the targets that each actor writes. Give independent work separate targets when
possible. When actors must share a target, state why separation cannot meet the requirement.
Use enforced synchronization to protect the shared writes and the state they depend on.

Use temporary data or another safe check under the project's rules to check concurrent writes.

## Check

List the write targets and show which are separate. For each required shared target, record the
reason for sharing and identify the enforced synchronization that protects it.
