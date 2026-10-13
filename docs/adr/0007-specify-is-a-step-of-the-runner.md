# specify is a step of the runner: Run has one command, and the script ends the session

Source: ddinkov10/fwrh_calculator ADR-0013. Each issue number of this record is an issue of that repository.

## Date

2026-10-11

## Related

- #414 (this change), #412 (the session that showed the gap)
- ADR-0002 (`docs/adr/0002-loop-script-and-mod-run-the-agent-flow.md`): the gate rule, the lock, the
  record, and the "no progress" rule stand
- ADR-0003 (`docs/adr/0003-a-local-web-board-starts-each-step-in-herdr.md`): the board, Run, Go, the
  tracked defaults of `me`, and the trust boundary stand
- ADR-0005 (`docs/adr/0005-herdr-gives-the-session-state-and-ends-each-step.md`): the step end
  stands, unchanged
- `scripts/agent-flow.sh`, `.claude/scripts/next-step.sh`, `.claude/agent-flow/gates.json`,
  `.claude/agent-flow/board/server.mjs`, `docs/agents/agent-flow.md`

## Supersedes

From ADR-0003, "A local web board shows the sessions and starts each step in a herdr tab": "a card
with the step `specify` runs `claude -n '#<n> specify' '/feature #<n>'` there". The other parts of
ADR-0003 stand.

## Context

On 2026-10-10 the `specify` session of #412 put the spec on the issue, and the resolver printed
`run /plan #412`. The card of #412 stayed in Needs you with the state `turn ended` until the
maintainer found the tab and typed `/exit`. No rule said that a `specify` session stays open. It
followed from four facts. The resolver printed a `stop` line for an `enhancement` with no spec. The
script starts only a `run` line. The step end is a job of the script (ADR-0005). So the board
started `claude` directly for a `specify` card (ADR-0003), with no script and no job.

## Constraints and evidence

- Claude Code 2.1.296: `claude --help` lists `--permission-mode <mode>`, `-n, --name <name>`, and
  `--append-system-prompt[-file]`.
- The documents of Claude Code (https://code.claude.com/docs/en/permission-modes, read on
  2026-10-11): from v2.1.283, auto mode is the starting permission mode of an interactive terminal
  session, and "Auto mode also nudges Claude to keep working without stopping for clarifying
  questions, though Claude still asks when your prompt or a skill explicitly relies on it."
- `~/.claude/settings.json` of the maintainer has `permissions.defaultMode: "auto"`, so
  `--permission-mode auto` changes nothing for a session on that machine.
- Rule 2 of `.claude/agent-flow/step-prompt.md` says "Never ask for a go-ahead or a review" and
  tells a session to publish a plan or a report with no wait. `specify` publishes the spec only
  after the maintainer approves the design, and nothing checks the design again after the publish.
- The `specify` sessions that Run started before this change had no step text. A session with no
  step text asked and waited in auto mode: the session of the #37 walk waited at a question
  (ADR-0003), and the `specify` session of #414 asked and waited (the spec of #414, "Risks").
- On 2026-10-10, `herdr api snapshot` gave the idle `specify` session of #412 the state `idle`.
- The tests of the script use stubs of `claude`, `gh`, and `herdr` (`scripts/agent-flow.test.sh`).
  ADR-0005 had no live proof of the step end.
- The live proof on #414 (the comment headed `## Live proof`), on 2026-10-11, with herdr 0.9.3 and
  Claude Code 2.1.296: a Run press on the throwaway feature #426 ran `scripts/agent-flow.sh 426` in
  a herdr tab. The session waited for the approval of the design. At most 12 seconds after the line
  became `run /plan #426`, the session had ended with no `/exit` of the maintainer, its tab was
  closed, and the card showed `next plan` with Run.

## Decision

`specify` is a step of the runner like each other step, and the board has one launch path.

- **The resolver prints a `run` line.** An open `enhancement` whose body does not open with `Spec:`
  resolves to `run /feature #<n>`, at the same place in the order. The line
  `stop #<n> has no spec.` goes.
- **The step of that line is `specify`.** `/feature` is the lane command, as `/bug` is. The board,
  the lane track, the tab labels, and the session names use the name `specify`, so the script gives
  that one command the step name `specify`, in one function (`step_of`).
- **`specify` has a normal gate.** `.claude/agent-flow/gates.json` holds `"specify": "me"`, and the
  gate rule of ADR-0002 holds for it. With the default, only a Run press or a start with a number
  starts it.
- **Its session gets no step text.** The command line is
  `claude --permission-mode auto -n '#<n> specify' '/feature #<n>'`. The session then asks and waits
  as a session that the maintainer starts by hand does.
- **The step end does not change.** The session starts with `run /feature #<n>`, and the job types
  `/exit` at the first idle moment after the line becomes `run /plan #<n>`,
  `stop #<n> is an epic. Each child runs its own flow.`, or `stop #<n> is closed as wontfix.`
- **A session that ends while the line is still `run /feature #<n>` is "no progress"**, as for each
  other step. A spike ends this way.
- **Run has one command.** `runStep` of the board server runs `scripts/agent-flow.sh <n>` for each
  card, and `--board` holds no special case for `specify`.
- **The skills keep the rule of the step end.** After each of the three acts of `specify` that move
  the line (the publish of the spec, the relabel to `epic`, the close as `wontfix`), each later act
  is in the same turn.

## Alternatives considered

- **The resolver keeps the `stop` line, and a start with a number starts `/feature` for it.** It is
  a smaller change. But the script then starts a session for a line that says `stop`, and `--board`
  keeps its special case.
- **The gate of `specify` is always `me`.** It keeps the automatic runner away from `specify`. But
  it is one more special rule, and an `auto` value is not dangerous: the session cannot approve its
  own design.
- **The session gets the step text, with an exception for the approval of the design.** Each step
  then has one command line. But the approval then depends on how the model reads two rules that
  conflict.
- **The resolver prints `run /specify #<n>`.** The step name is then the command name. But the
  session skips the lane command, and each other lane starts with its lane command.
- **The board ends the session.** ADR-0005 rejected it: the board does not run all the time.

## Consequences

- A `specify` session that Run or `scripts/agent-flow.sh <n>` starts in a herdr pane ends by itself
  after the spec is on the issue; after a Run press its tab closes, and the card shows `next plan`
  with Run.
- Each step goes through the script, with its lock, its gate, and its record.
- With `plan` as `auto` on a machine, the script goes on from `specify` to `/plan #<n>` in the same
  tab.
- With `specify` as `auto` on a machine, the automatic runner opens a design session for the lowest
  feature with no spec and waits there, one issue at a time.
- `/exit` goes into a pane that the maintainer uses. Text that the maintainer types at that moment
  goes into the same line. This is more probable than in a step that the maintainer does not attend.
- A turn that moves the line and then asks loses its later acts. The skills cover the three known
  acts; a new path of `specify` that moves the line must keep the rule.
- The session of `specify` has no step text, so the limits of that text (the merge path, no
  promotion) reach it only through `.claude/settings.json` and the skills.
- A session that the maintainer starts by hand, a Resume session, and a session outside herdr do
  not end by themselves.

## Reconsider when

- A step other than `specify` must wait for an approval of the maintainer. The step text then needs
  a rule for that wait, and the exception for `specify` can go.
- Claude Code changes the default permission mode, or auto mode stops asking where a skill relies
  on a question.
- `specify` gets a check of the design after the publish, so the approval before the publish is no
  longer the only gate.
- The step text gets a rule that a `specify` session must have.
- herdr changes `agent wait` or `agent prompt` (ADR-0005).
