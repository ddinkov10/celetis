# The child dispatch

How a step starts a child agent with the model and the effort that the engine resolves, and how
the task loop of a build takes each dispatch from the engine.

## Contents

- **One child:** the score, the pair, the CAP line, the identity, and the brief of each child.
- **The task loop:** the acts of `dispatch`, a ready dispatch, the execution report, the retry,
  and the exits.
- **Claude Code** and **Codex:** the spawn, the resume, the identity, and the report shapes of
  each host. Both parts above use them.

## One child

Each child that a step starts, in the task loop or outside it:

1. **The score.** Outside the task loop, score the child with
   `celetis --agent <host> capscore J V B N S X --json`, with the digits, the bias, and the attempt
   that the skill names (digit anchors: `<plugin>/docs/capability.md`). Add `--reviewer` for a
   review. Its `line` is the CAP line, and `dispatch.model` and `dispatch.effort` are the pair.
   The task loop takes the line and the pair from `dispatch` in place of a score
   ("The task loop"). Dispatch only on `status: "ready"`. A `stop` status dispatches no child:
   hand off the failure trail.
2. **The pair.** Inspect the active tool schema before each call. Apply the model and the effort
   of the pair through the host's actual spawn controls (the part of the host below). Omit the
   model when it is null. A CAP line alone does not set them. Keep the parent model and effort.
3. **The CAP line** goes first in the child prompt, unchanged.
4. **The identity.** Record the applied arguments and the child identity that the host returns.
   A repair or a scoped re-review keeps the same child, unless `dispatch` returns `replace` or the
   skill names a fresh child. Resume a kept child with the host's follow-up tool, which keeps the
   recorded pair. In the task loop, only a returned `replace` starts a fresh child in place of it.
   When the tool cannot apply the required pair to that identity, stop for setup with both pairs,
   the identity, the tool limitation, and the failure trail.
5. **The brief.** Give the isolated child the exact checkout, the relevant project instructions,
   its task and constraints, the required skills and custom text, the gate, and the return
   contract.
   For a correction, two failed fixes of the same problem, or a pre-stop incident, give the child
   the exact resolved path of `<plugin>/docs/procedures/lesson-capture.md` and require its read.
   The child returns the stable incident ID, action, expected/observed behavior, evidence and
   source, uncertain cause, and candidate suggestion. It writes no lesson. The coordinator
   applies that procedure once with the same ID and evidence, including a replayed report.

A missing identity or an uncertain result stops the work that depends on the child. A setup stop
needs the reported host setup before that work goes on: do not do that work in the main session.
A call outside the task loop needs no execution report, and the engine does not intercept or
record it.

## The task loop

The task loop of a build takes each dispatch from
`celetis --agent <host> dispatch <act and arguments>`: each child of the subagent flow, and each
fix after the final review. The acts and their arguments are:

| Act and arguments | When to use it |
| --- | --- |
| `next <n> <task> implementer\|reviewer J V B N S X --bias N` | For the first dispatch of a role, an answer to a child's question, a retry after an accepted report that no worker started, or recovery after a saved gate issued no repair. |
| `report <dispatch-id> <report-file>` | After each issued native call, before the next engine act. Use the execution report of the selected host. |
| `gate <n> <task> pass\|fail <gate> <report>` | After each implementer `DONE`, with the gate name and the report path. |
| `review <n> <task> findings` | After a task review reports spec ❌, a Critical finding, or an Important finding. |
| `review <n> <task> blocked` | After an implementer reports `BLOCKED`. |
| `close <n> <task>` | When the task review is clean. |

- For `next`, reuse the published six digits and bias (`+bN`; absent means `--bias 0`). Published
  model labels are history. Re-score only when the task scope changed. The task reviewer takes
  the digits and bias of its task; the engine applies the reviewer rules. Score each new task.
- Use the plan task number as `<task>`. Use `final` for the whole-branch review and its fix wave,
  `verify-<k>` for a fix after a Verify FAIL, and `land-<k>` for a fix of a landing refusal that
  the change caused. Use a new positive `<k>` for each new fix task; repairs of that task keep its
  ID.
- On `status: "ready"`, start the child by "One child" with the returned `line` and `pair`: apply
  `pair.model` and `pair.effort` with the host's actual spawn controls, and omit the model field
  when it is null. Follow `action`: `spawn` starts a child; `resume` sends to `child` with the
  host's follow-up tool; `replace` starts a fresh child in place of the prior child of that role.
  A resume retains the recorded pair. A changed model, effort, or runtime returns `replace`.
  Give the replacement the same checkout, saved work, task constraints, prior child and pair,
  failure reports, and current counters. Continue that task; keep its earlier evidence.
- When an earlier gate failure was saved but no repair dispatch was issued, use `next` with that
  task's saved digits and bias. Do not report the same gate failure again or reset the record.
- Send each returned `ready` dispatch once. Save the exact tool name, arguments, and native result
  of the real call in an execution report, then run `report <dispatch-id> <report-file>` before
  the next engine act. Report only `call` and `outcome`; the engine binds the report to the active
  host/session record. Follow the report shapes of the host below. Each execution is
  agent-reported; the engine validates the report, not the native call. It cannot prevent an
  incorrect call or prove an internally consistent report true.
- An acknowledgment with `status: "reported"` issues no child. Wait for the child's real
  completion before its gate or review result. A gate pass already issues the reviewer; send that
  returned action once. Keep no second dispatch for it.
- Report `failed` with `noWorkerStarted: true` only when the tool failure establishes that no
  worker started; report an uncertain error or a missing identity as `incomplete`. To retry after
  an accepted `failed` report, run `next` again. A mismatch stays a setup stop. Keep all earlier
  evidence: a mismatch or an incomplete identity cannot authorize a substitute child. For a missing
  follow-up operation, report `call: null` with outcome `unsupported` and the exact limitation,
  then stop. Use the host's command approval procedure for a sandbox block.
- Exit 3: correct the act that the reason names. Exit 4 or 5: stop with the reason and trail. In a
  step session, use `<plugin>/docs/procedures/stop.md`, "A stop in a step session".
- These acts replace the round count, model choice, and "most capable model" procedure of
  `superpowers:subagent-driven-development`, and the breaker of its fix loop. Keep no attempt or
  round count of your own: the engine owns escalation and stops
  (`<plugin>/docs/capability.md`, "Dispatch records").

## Claude Code

Use `Agent` to spawn or replace a child. Apply the model and the effort of the pair through its
actual controls with a non-fork `subagent_type`. Use `SendMessage` to resume the recorded child;
it has no model or effort control. In the task loop, use the returned replacement for a changed
pair. Outside that loop, keep the setup stop of "One child". Put the CAP line first in the prompt
or the message. Keep the parent settings.

In the task loop, after the call, run
`celetis --agent claude dispatch report <dispatch-id> <report-file>`. The report is agent-reported
evidence. It records what the agent says it sent and received; the engine cannot independently
check the native call. Save the actual arguments and complete native result. Use the returned
`agentId` as `child`. Keep a native model ID verbatim when available; leave unreported model and
effort null. Never infer applied effort from the requested argument. A spawn report has this
shape:

```json
{
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
  "call": {
    "tool": "SendMessage",
    "arguments": {"to": "worker-id", "message": "<issued CAP line>\nContinue."},
    "result": {"success": true, "resumedAgentId": "worker-id"}
  },
  "outcome": {"result": "started", "child": "worker-id", "model": null, "effort": null}
}
```

These are report shapes, not fabricated execution evidence. Replace each value with the actual
call and result. If the active surface lacks the required follow-up, submit `call: null` with
`outcome: {"result":"unsupported","error":"<exact limitation>"}` and stop.

## Codex

Use `collaboration.spawn_agent` with `fork_turns: "none"` and the CAP line first in `message`.
Set the effort of the pair as `reasoning_effort`, and omit `model` when the model of the pair is
null. Keep the parent settings. For `resume`, use the actual `collaboration.followup_task` with
`target` equal to the recorded child and the CAP line first in `message`. That follow-up has no
model or effort controls. In the task loop, the engine returns a replacement for a changed pair;
an unchanged pair can use the same child. Outside that loop, keep the setup stop of "One child".
A returned stable task name, such as `/root/worker`, is a usable identity.

With a nonempty `codexProfiles` mapping or an explicit profile, pass fresh model and effort
evidence from the active dispatch tools through `--runtime-models` to each `capscore` call and
each `dispatch` act that issues a dispatch. A refused pair is a setup stop; do not lower it or
substitute another pair. If the sandbox blocks `dispatch`, request one approved retry with the
same command, arguments, and cwd before reporting a setup stop.

In the task loop, after each call, run
`celetis --agent codex dispatch report <dispatch-id> <report-file>`. The evidence is
agent-reported. The engine validates the report; it does not intercept or independently check the
native call. Save exact arguments and the complete native result. A spawn report has this shape:

```json
{
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
effort evidence. If follow-up is absent, report `call: null` and
`outcome: {"result":"unsupported","error":"<exact limitation>"}`, then stop. Keep the recorded
child.
