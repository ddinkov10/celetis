# The session reads custom parts with file tools

## Date

2026-10-14

## Related

- ddinkov10/celetis#18: the custom-part loader fails without Bash, with shell permission rules,
  and outside a Git checkout.
- ADR-0012, "Custom parts" and "Alternatives considered".
- `skills/*/SKILL.md`, `tests/text.test.sh`, `tests/manual/custom-part.test.sh`.

## Supersedes

From ADR-0012, "The harness is the Claude plugin `celetis`, and each product project wires it in":
the injected shell line of "Custom parts", its missing-file output, and the rule that a raw read
of another skill does not carry the custom-part loading procedure. The custom file paths and
their role as additions stand.

## Context

Each skill used a shell command to inject an optional project file before Claude received the
skill. A failure of that command could stop the whole skill even when no custom file existed.
The maintainer approved native file reads before work, with a stop when an existing custom file
cannot be read.

## Constraints and evidence

- Claude Code 2.1.299 is installed. The existing no-shell probe returned an empty answer before
  reaching the model. The repository gate passed before the change.
- Claude Code documents native reads of supporting files and permission checks on injected
  commands: https://code.claude.com/docs/en/skills (latest documentation).
- A deny rule overrides an injected command's `allowed-tools`. An ask result can stop skill
  loading outside auto mode. Shell error handling cannot resolve either permission check.
- ADR-0012 already names an instruction to read the custom file as an alternative.

## Decision

Each skill starts with a required instruction to read its custom part using `Read` before any
step or answer. The session uses file tools to locate the root of its current checkout, including
after a change into a worktree. The entire custom file adds to the common skill.

With no checkout or no custom file, work continues. When access needs approval, the session
requests it normally. Denied access or another read error stops work with a report of the block;
the session must not mistake denied access for an absent file.

## Alternatives considered

- Repair the injected command: this keeps a shell dependency and the permission check before
  skill loading.
- Add `allowed-tools`: this does not override ask or deny rules.
- Skip a custom file when access is denied: this can omit required project instructions.

## Consequences

The skill can load without Bash or Git commands. Shell permission rules no longer control its
custom-part read. The read now depends on the agent following the required first instruction,
so the live test checks actual file reads and the selected checkout. The text gate checks that
every skill carries the read rule and no shell injection. Live tests use tokens and stay outside
the repository gate.

## Reconsider when

- Claude Code provides optional file inclusion with current-checkout selection and normal file
  permissions at skill load.
- Live tests show that the agent skips the required read or selects the wrong checkout.
