# The help list is the one source of the typed commands

## Date

2026-10-28

## Related

- [Issue #158](https://github.com/ddinkov10/celetis/issues/158): the spec (approaches A to C), the
  calls of the session, the plan, and its Verify phase.
- [ADR-0042](0042-one-celetis-program-for-both-hosts.md): one `celetis` program for both hosts.
  One clause changes ("Supersedes").
- `engine/lib/help.ts`, `engine/launcher.ts`, and `scripts/build.ts`.
- `README.md`, "The commands".

## Supersedes

Only this clause changes. The accepted records keep their historical text and evidence.

- ADR-0042, "One celetis program for both hosts", Decision, "The entry": "A usage line and an
  unknown command end with `celetis: when a skill or a document gave this command, run celetis
  update`." A usage line and an unknown command still end with the update hint. A bare `celetis`
  is no longer a usage line: it prints the help text on stdout, with no hint, and exits 2.

## Context

A person wanted to update the plugin and start the board, and could not find the commands from the
program. `celetis help` and `celetis --help` stopped with
`celetis: the program has no command help`. A bare `celetis` printed one generic usage line. The
only list of the commands was the hand-written table in `README.md`, "The commands".

## Constraints and evidence

- The skills give each command to an agent. The help is for a person at a terminal, so it lists
  only the commands that a person types.
- git keeps one file, `command-list.txt`, for `git help` and for the command lists of its
  documents. cobra makes the help and the Markdown documents from the definitions of the commands.
- The GNU Coding Standards say that `--help` prints on stdout, ignores the other arguments, and
  exits successfully. `git` with no command prints its usage and its common commands on stdout and
  exits 1 (git 2.56.0).
- `scripts/build.ts --check` already compares each generated output byte for byte, and the verify
  gate runs it.
- The launcher finds a command by its file `engine/<name>.ts`.

## Decision

**One help list.** `helpCommands` in `engine/lib/help.ts` holds the form and the summary of each
command that a person types. `helpText` is made from it and is the one text of the help. Nothing
reads `README.md` at run time.

**The launcher answers help.** `help`, `--help`, and `-h` print `helpText` on stdout and exit 0.
They ignore the words after them. A bare `celetis` prints the same text and exits 2, as `git` exits
nonzero, so a script still sees an error. The help text lists `celetis update`, and no skill or
document gives a bare `celetis`, so it has no update hint. An unknown command adds
`celetis: celetis help lists the commands` before the update hint.

**The build writes the README block and checks each name.** `scripts/build.ts` replaces the lines
between two fixed marker lines of `README.md` with a fenced `text` block of `helpText`. With
`--check`, a difference fails as for each other output. A missing or a second marker line fails
both modes. Both modes also fail when the name of a help entry, the word after `celetis`, is not a
launcher word (`help`, `--version`) and has no file `engine/<name>.ts`.

## Alternatives considered

- **A. A help list in the program only.** The README table stays hand-written and separate. It is
  the smallest change, but no check finds a difference between the two lists.
- **B. A help list in the program, checked by the verify gate.** The gate checks that each help
  command has an engine file and a README row. A renamed or removed command fails, but a new
  command that is only in the README passes. The session recommended B, because the project keeps
  `README.md` hand-written. The maintainer picked one source.
- **The README block alone, with no name check.** It keeps the two texts equal, but a help line can
  name a command that the program does not have. The maintainer chose a standing check in the
  build over a one-time check by hand.

## Consequences

- The help and the README list cannot differ with no failed check, and a renamed or removed
  command fails the build and the verify gate.
- The README is partly generated. A hand edit inside the block fails `scripts/build.ts --check`.
  The marker lines say that `scripts/build.ts` writes the block.
- The name check sees only the name. It does not find a wrong argument form, for example
  `--resume` renamed in `celetis-flow`.
- The rest of the commands table of `README.md` stays hand-written (`AGENTS.md`, "Traps").

## Reconsider when

- The program gets help for one command (`celetis help <command>` or `<command> --help`).
- The commands table of `README.md` is no longer written by hand.
