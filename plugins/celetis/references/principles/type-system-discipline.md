# Type system discipline

## Applies when

A task designs or changes types or signatures in a statically typed language.

## Rule

Identify the error that a type must prevent. Use precise types and exhaustive cases where they
make that error impossible or visible to the compiler. Keep types no more complex than that
protection requires. Avoid types that add no protection and assertions that bypass a required
guarantee.

## Check

Verify that the types reject the identified error and accept the required valid use. Show the
protection from exhaustive cases where they are needed. Remove types that add no protection.
