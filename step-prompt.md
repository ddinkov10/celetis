You run one step of this repository's celetis flow in a session of its own. The first prompt names
the step and one GitHub issue, #<n>. The issue is the state store (the document
`docs/issue-tracker.md` of the plugin `celetis`): every result goes to the issue.

Read `docs/hosts/entry.md` of the plugin `celetis` from the loaded skill's package before the
step. If its path is unavailable, `scripts/celetis --host claude root` or
`scripts/celetis --host codex root` prints the selected installation. Follow that host's invocation,
custom-part, worktree, command, and dispatch rules on every same-session handoff. Every launcher
command below includes `--host claude` or `--host codex` before its sub-command, matching this host.
Bind commands and file edits to the lane path; return to the main checkout for landing.

1. Follow the skill of the step, including any hand-off the skill names (/celetis:bug hands on to
   plan). When a skill says to run a step in a fresh context, do not start it. This session ends
   by itself when the issue shows that the step is done and the working tree is clean.
2. Ask the human only for a decision that the issue does not hold, for example a type that
   /celetis:triage cannot tell, a state that the spec does not define, a pick between
   prototype variants, or authorization for a destructive act that the plan did not authorize.
   An upstream "stop and ask" remains a question in this session: ask and wait for the answer.
   Never ask for a go-ahead or a review:
   - When a skill tells you to ask whether to proceed or to continue with another lane or issue
     (the last step of /celetis:triage, the last step of /celetis:intake), do not ask: the answer
     is no. Do not start that lane; the runner starts it in a fresh session.
   - When a skill tells you to wait for a review of a plan or a report, do not wait: publish it
     and go on.
3. Land a change only with `scripts/celetis --host claude land` or
   `scripts/celetis --host codex land`, matching this host,
   and only when the skill of your step says so.
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
   guard that refuses its command (the host's approval review, the auto-mode classifier, the
   worktree guard, a `deny` rule) is a limit: try one safer form of the command, and take no other route. Run each other
   scenario. Then the scenario is a human precondition of the landing: post a new
   `## Before landing` comment for this build (the scenario, its commands, the expected result,
   and the refusal), then run
   `gh issue edit <n> --remove-label ready-for-agent --add-label ready-for-human` as the last act
   of the turn. The removal marks the change as built.
   On a later run, keep the built change and follow the skill's re-entry rule. Require a
   trusted human completion report or the maintainer's label-removal event after the
   `## Before landing` comment for this build. An absent `ready-for-human` label is not completion
   evidence. Without evidence, restore that label as the last act, using the existing comment
   as the reason, and stop. With evidence, skip the old Verify phase and go to Land, step 2.
