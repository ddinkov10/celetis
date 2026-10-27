# Claude Code operations

Read through [Host entry](entry.md).

## Skills and custom text

Invoke skills with the Skill tool and pass the invocation input as arguments.

The native hook in `<plugin>/engine/hooks/entry.js` supplies startup reads and the current entry's
config result. Apply that entry before any response. Missing native entry data stops for
hook setup; do not replace the hook's reads with another access path.

Accept `file_unchanged` only after this entry's fresh request and a prior complete native Read
at the same path in the same agent loop. The prior content must remain available in context.
A seeded, partial, denied, or unavailable result stops entry.

## Worktree and commands

Enter the exact checkout printed by `worktree` with `EnterWorktree`, unless already there.
Before landing or removal, use `ExitWorktree` with keep and verify the main checkout.

Run `land` in background Bash with `run_in_background: true` and `timeout: 3600000`.
Wait for actual completion; the checks can take thirty minutes.

## Dispatch

In the task loop of `implement`, get each action and pair from `dispatch`. Inspect the active
tool schema before each call. Put the issued CAP line first in the prompt or message.
Use `Agent` to spawn or replace a child. Apply `pair.model` and `pair.effort` through its actual
controls with a non-fork `subagent_type`. Use `SendMessage` to resume the recorded child; it has
no model or effort control. A changed pair stops before a resume. Keep the parent settings.

After the call, run `celetis --agent claude dispatch report <dispatch-id> <report-file>`.
The report is agent-reported evidence. It records what the agent says it sent and received;
the engine cannot independently check the native call. Calls outside the task loop need no report.
Save the actual arguments and complete native result. Use the returned `agentId` as `child`.
Keep a native model ID verbatim when available; leave unreported model and effort null.
Never infer applied effort from the requested argument. A spawn report has this shape:

```json
{
  "host": "claude", "session": "session-id",
  "call": {
    "tool": "Agent",
    "arguments": {"prompt": "<issued CAP line>\nReply OK.", "model": "haiku", "effort": "low", "subagent_type": "general-purpose"},
    "result": {"agentId": "worker-id"}
  },
  "outcome": {"result": "started", "child": "worker-id", "model": null, "effort": null}
}
```

For a same-pair resume, retain that child and report `SendMessage` with the exact `to` and
`message` arguments, its full result, and the same `outcome.child`. For example:

```json
{
  "host": "claude", "session": "session-id",
  "call": {
    "tool": "SendMessage",
    "arguments": {"to": "worker-id", "message": "<issued CAP line>\nContinue."},
    "result": {"success": true, "resumedAgentId": "worker-id"}
  },
  "outcome": {"result": "started", "child": "worker-id", "model": null, "effort": null}
}
```

These are report shapes, not fabricated execution evidence. Replace each value with the actual
call and result. Wait for the child's real completion before reporting a gate or review result.
Missing identity or uncertain execution stops dependent work. If the active surface lacks the
required follow-up, submit `call: null` with `outcome: {"result":"unsupported","error":"<exact limitation>"}`
and stop. The native entry hook and its permission-checked reads remain required for skill entry.

## Session recovery

Give the human `claude --resume '#<n> <step>'` from the main checkout. `guide` runs nothing.
