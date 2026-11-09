# Boundary discipline

## Applies when

A task accepts external input or changes validation.

## Rule

Identify each trust boundary and the point that parses or validates its input. State the
guarantees that hold after that point. Preserve those guarantees and the handling of invalid
input, including error results and partial changes caused by validation failures.

Remove an internal check only when the boundary still guarantees the condition it checked.
Use temporary data or another safe check under the project's rules for validation failures.

## Check

Identify each trust boundary and its parse or validation point. Show that valid input keeps its
guarantees and invalid input gets the required error handling without unintended partial
changes. For each removed internal check, show why its guarantee still holds.
