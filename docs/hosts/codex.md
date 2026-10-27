# Codex operations

Read through [Host entry](entry.md).

## Skills and custom text

Invoke skills through their advertised `SKILL.md` paths and follow them with the supplied input.
For `guide` advice, use this prompt with the actual skill name:
`Use the celetis:<name> skill for <input>. Complete its Host entry startup reads before any response, including commentary.`

Use the active checkout binding even when the tool process cwd differs. Locate its Git boundary
and read `.celetis.yaml` through available supported file access, including shell commands,
dedicated readers, or runtime file APIs. Inspect the active tool catalog and use its actual schema.
A dedicated reader is not required. The existing configuration reader is also supported.
Make a fresh whole-file request for each entry. A programmatic operation's validated values do
not complete this request. Optional absence gives no custom text; required runtime configuration
has a separate full-validation boundary. A denied request ends entry before any alternate read.
If no supported tool can locate or read the checkout, stop with the tool names, exact limitation,
and required file-access setup.

## Worktree, commands, and files

Bind command cwd and file paths to the exact checkout printed by `worktree`. A Codex app
worktree does not replace the lane. Keep `land` alive until its actual exit; it can take thirty
minutes. Retain the command session identifier to observe completion.

For a sandbox-blocked command, request one approved retry with the same command, arguments,
and cwd before reporting a setup stop. Use the tool's escalation mechanism for later calls
with the same access needs. A denied file read retains the Host entry stop rule.

Like `land`, `issue` needs network: it reads the issue from GitHub before any write. In a sandbox
with no network, it exits 6 with `issue: blocked: cannot read #<n> from GitHub`. That is a
sandbox block, not a GitHub that does not answer: request the approved retry first. The approved
retry is the path for `issue`. The personal `issue` rule of `<plugin>/README.md`, "Personal
landing permission", is optional: it skips the review of each call, so a session can post any
file that it can read on the issue. Add it only when Codex cannot ask for approval, for example
with the approval policy `never`.

`worktree` also needs network on each entry: it reads the trunk from GitHub and fetches it from
`origin`. In a sandbox with no network, request the approved retry first.

## Dispatch

In the task loop of `implement`, get the pair from `dispatch`. Set `pair.effort` as
`reasoning_effort`, and omit `model` when `pair.model` is null. With a nonempty `codexProfiles`
mapping or an explicit profile, pass fresh model and effort evidence from the active dispatch
tools through `--runtime-models` to each `capscore` call and each `dispatch` act that issues a
dispatch.
A refused pair is a setup stop; do not lower it or substitute another pair.

Inspect the active tool schema. Use `collaboration.spawn_agent` with `fork_turns: "none"` and
the issued CAP line first in `message`. Keep the parent settings. For `resume`, use the actual
`collaboration.followup_task` with `target` equal to the recorded child and the issued line
first in `message`. That follow-up has no model or effort controls. The engine stops a changed
pair before issuing a resume; an unchanged pair can use the same child.

After each call, run `dispatch report <dispatch-id> <report-file>` through the bound command.
The evidence is agent-reported. The engine validates the report; it does not intercept or
independently check the native call. No native interception or trust change is required. Calls outside
the task loop need no report. Save exact arguments and the complete native result. A returned
stable task name, such as `/root/worker`, is a usable identity. A spawn report has this shape:

```json
{
  "host": "codex", "session": "session-id",
  "call": {
    "tool": "collaboration.spawn_agent",
    "arguments": {"task_name": "worker", "message": "<issued CAP line>\nReply OK.", "reasoning_effort": "low", "fork_turns": "none"},
    "result": {"task_name": "/root/worker"}
  },
  "outcome": {"result": "started", "child": "/root/worker", "model": null, "effort": null}
}
```

For a same-pair resume, retain that identity and report the exact follow-up arguments and result:

```json
{
  "host": "codex", "session": "session-id",
  "call": {
    "tool": "collaboration.followup_task",
    "arguments": {"target": "/root/worker", "message": "<issued CAP line>\nContinue."},
    "result": {"task_name": "/root/worker"}
  },
  "outcome": {"result": "started", "child": "/root/worker", "model": null, "effort": null}
}
```

Replace the example values with the actual call and result. Keep native model IDs verbatim;
leave model and effort null when the host does not report them. Requested effort is not applied
effort evidence. Wait for the child's real completion before reporting a gate or review result.
If follow-up is absent, report `call: null` and `outcome: {"result":"unsupported","error":"<exact limitation>"}`,
then stop. Keep the recorded child. Missing identity or uncertain execution also stops dependent
work. If the sandbox blocks `dispatch`, use the approved retry above. Unrelated native hook
trust and permission rules keep their own scope.

## Session recovery

For exact recovery, give the human `codex resume --no-daemon <session-id>` from the main checkout,
or reopen that exact chat in the app. An unknown session ID is a setup gap. `guide` runs neither.
