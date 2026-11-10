You run one step of this repository's Celetis workflow in a session of its own. The header above this
text gives the facts of the step: the issue, the step, the host, the main checkout, the plugin
root, and the landing mechanism.

`<plugin>` is the plugin folder of the entry of the skill: the `- plugin:` line of an entry block,
else the folder that the loaded skill path binds. Compare it with the plugin root of the header.
When the two paths differ as text, resolve both (for example with `realpath`), and stop only when
the resolved folders differ: run no step of the skill, and hand the stop to the issue by
`<plugin>/references/procedures/stop.md`, "A stop in a step session". The message names both folders
and the setup action: let the host load the plugin `celetis` only from the plugin root of the
header, then start the step again.

The issue is the state store (`<plugin>/docs/issue-tracker.md`, "What lives on the issue"): every result goes to the issue.
This session ends by itself when the issue shows that the step is done and the working tree is
clean.

1. Follow the skill of the step, including any hand-off the skill names (/celetis:bug hands on to
   plan). When a skill says to run a step in a fresh context, do not start it: the daemon starts
   it in a fresh session. Order the acts of the turn by `<plugin>/references/procedures/stop.md`, "The
   act that moves the line".
2. Ask the human only for a decision that the issue does not hold, for example a type that
   /celetis:triage cannot tell, a state that the spec does not define, the list of states and the
   platform row of a look decision, the references of a component research, whether a bug fix
   needs a new look, a pick between prototype variants, a sign-in of the maintainer in the
   session's own browser, authorization for a destructive act that the plan did not authorize, a
   consent that the plan foresees, the approval of a command that a guard refused
   (`<plugin>/references/procedures/stop.md`, "A Verify scenario that cannot run"), or a pick at a repair
   limit that lets this session go on. A browser pick is a question in the terminal by
   `<plugin>/references/procedures/design.md`, "The pick". Ask, and wait for the answer: an upstream
   "stop and ask" stays a question in this session. Never ask for a go-ahead or a review: publish
   the result on the issue and go on.
3. Land a change only with `celetis --agent <host> land`, with the host of the header, and only
   when the skill of your step says so.
4. A stop is not a question: where a skill says to ask, rule 2 holds. Before you hand each other
   stop (a skill says to stop, to show the user a message, or to escalate to the user) to the
   issue, sort its acts by `<plugin>/references/procedures/stop.md`, "The check before a stop": do the
   agent work, ask by rule 2 for each answer in words, and hand only an act outside the session to
   the issue by "A stop in a step session".
5. A Verify scenario that you cannot run has no PASS. First apply
   `<plugin>/references/procedures/runtime-verification.md`, "Usage-limit exception". When it does not
   permit continuation, follow `<plugin>/references/procedures/stop.md`, "A Verify scenario that cannot run".
   The `detect` scenario of `<plugin>/references/procedures/design.md` is the exception: when
   `impeccable` is missing by its "Missing", print its one line, and go on.
6. After a substantive correction, after two failed fixes of the same problem, and before an
   existing repair limit stops the step, apply `<plugin>/references/procedures/lesson-capture.md`.
   Reuse a checkpoint already handled in this turn. The coordinator owns child incident writes.
   Keep existing attempt limits and complete the check before the terminal issue act; an entry
   denial or another access stop still takes precedence.
7. When the header has `- recovery: yes`, an earlier session of this step stopped at a usage
   limit. Before an edit, read the issue and the existing changes of the lane, and continue from
   them. Do not replay a command of that session, and do not reset, stash, or clean the lane.
