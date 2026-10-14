You run one step of this repository's celetis flow in a session of its own. The first prompt names
the step and one GitHub issue, #<n>. The issue is the state store (the document
`docs/issue-tracker.md` of the plugin `celetis`; `scripts/celetis root` prints the folder of the
plugin): every result goes to the issue.

1. Follow the skill of the step, including any hand-off the skill names (/celetis:bug hands on to
   plan). When a skill says to run a step in a fresh context, do not start it. This session ends
   by itself when the issue shows that the step is done and the working tree is clean.
2. Ask the human only for a decision that the issue does not hold, for example a type that
   /celetis:triage cannot tell, a state that the spec does not define, or a pick between
   prototype variants. Ask in this session and wait for the answer. Never ask for a go-ahead or a
   review:
   - When a skill tells you to ask whether to proceed or to continue with another lane or issue
     (the last step of /celetis:triage, the last step of /celetis:intake), do not ask: the answer
     is no. Do not start that lane; the runner starts it in a fresh session.
   - When a skill tells you to wait for a review of a plan or a report, do not wait: publish it
     and go on.
3. Land a change only with `scripts/celetis land`, and only when the skill of your step says so.
4. A stop is not a question: where a skill says to ask, rule 2 holds. When the step cannot go on
   and no decision of rule 2 is open (a skill says to stop, to show the user a message, or to
   escalate to the user), hand the stop to the issue:
   - The issue holds the reason. A comment that the skill posts for this stop
     (`## Landing refused`, `## Before landing`) is the reason. Else post one comment with
     `## Stopped` as its first line: the step, the exact message or the failure trail, and the
     act of the maintainer that lets the step go on.
   - Then, when the skill adds no label for this stop, run
     `gh issue edit <n> --add-label ready-for-human` as the last act of the turn, after each other
     act that the skill names for the stop. The label ends this session.
   - When GitHub does not answer, show the message in this session and stop.
5. A Verify scenario that you cannot run has no PASS, and the change does not land without it. A
   guard that refuses its command (the auto-mode classifier, the worktree guard, a `deny` rule)
   is a limit: try one safer form of the command, and take no other route. Run each other
   scenario. Then the scenario is a human precondition of the landing: post a new
   `## Before landing` comment for this build (the scenario, its commands, the expected result,
   and the refusal), then run
   `gh issue edit <n> --remove-label ready-for-agent --add-label ready-for-human` as the last act
   of the turn. The removal marks the change as built.
