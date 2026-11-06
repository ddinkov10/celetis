---
name: capture
description: Record the design, root cause, or plan that this chat decided on an issue, and continue its lane
argument-hint: "[#<n> or the request]"
disable-model-invocation: true
---

**Celetis entry.** Before any step or response, including commentary or an announcement, bind `<plugin>` to the absolute prefix before `/skills/<name>/SKILL.md` in the path of this loaded file. Then read `<plugin>/docs/procedures/entry.md` whole, in one read, and follow it before any product-path scan. Do this on each invocation, including a same-session handoff.

# capture

Only the person's explicit request starts this skill. That request asks to run the skill by its
name, `celetis:capture`: for example `/celetis:capture #<n>`, or the start prompt of the entry
contract. The person's selection of this skill in the skill selector of the host is also that
request. A question about the skill is not that request. A read of this file and an earlier
mention of the skill in the chat are not that request either.

When no such request started this skill, do no act of the capture: show no `## Captured` record,
save no record file, and post no `## Captured` comment. This skill does not direct the other
requests of the person: do them as usual. A message can ask about this skill. It can also ask for
the job of this skill in other words: for example, to record the decided work on an issue, or to
keep it for a later session. To such a message, also tell the person what the capture does, and
give the start of the host: `/celetis:capture <#n or the request>`, or the start prompt of the
entry contract with `celetis:capture`. A message that puts the work in another place, for example
a file, a document, or a memory, is not such a message.

The capture records the work that this chat decided as one `## Captured` comment on an issue, then
hands on to the current step of the issue. That step reads the record as the person's answers and
still runs each of its checks. The capture writes text only: it never replaces or edits a body, a
published spec, a `## Root cause`, or a `## Plan`, and it moves no code, branch, or uncommitted
change. Input: `#<n>`, or the request in free text.

## Do this

1. **Check the issue.** For `#<n>`, run `celetis --agent <host> issue <n> state` first. A nonzero
   exit ends the capture: post nothing, and show its output. Else its `line:` line selects the
   row of the states table below. A refused row ends the capture: post nothing, and show the line
   with the reason of its row. `refusal: current` also ends the capture: post nothing, and show
   the line and the current landing refusal, because a new `## ` comment after
   `## Landing refused` would end that refusal. Free text has no issue yet; it gets one at step 4,
   on the `run /celetis:triage` row.
2. **Find the decided work.** Read this conversation and sort what it holds into the three parts
   of the record, per `<plugin>/docs/procedures/capture.md`, "The record". For `#<n>`, read the
   issue with `gh issue view <n> --json body,comments`, and carry into the new record each line
   of the newest earlier `## Captured` comment that this chat did not change, so that the newest
   record is always complete. With no decided work, stop and write nothing: name
   `/celetis:intake` for a new request, or the lane for a known type.
3. **Confirm the record.** Show the whole record and ask whether it is what the person decided.
   On a correction, correct the record and show it again. Post nothing before the person's yes.
   This yes is about the faithfulness of the record only; the approval of a written spec still
   comes in its own step.
4. **Get the issue.**
   - Free text: do the intake job. Fill `<plugin>/docs/procedures/intent.md` from the request in
     the person's words, save it as `docs/superpowers/intents/YYYY-MM-DD-<slug>-intent.md`, and
     create the issue with `gh issue create --label needs-triage --title "<Intent title>"
     --body-file <intent>`. Tell the person the issue number at once: a retry after an
     interruption uses that `#<n>` and creates no second issue.
   - `#<n>` on the `run /celetis:triage` row with no intent (no `## Intent` comment, and a body
     that does not start with `# Intent:`): fill the intent as above, and post it first with
     `gh issue comment <n> --body-file <intent>`, with `## Intent` as its first line.
   - Run no `setup status`: the lane that the capture hands on to runs it before its first issue
     write.
5. **Post the record.** When the input is `#<n>`, run `celetis --agent <host> issue <n> state`
   again just before the post. When its `line:` or `refusal:` line differs from step 1, post nothing, show
   both, and start again at step 1. Save the record as
   `docs/superpowers/captures/YYYY-MM-DD-<n>-record.md`, with `## Captured` as its first line, and
   post it with `gh issue comment <n> --body-file <record>`.
6. **Hand on** by the states table. For free text, first read the intent back and ask
   "proceed?"; on no, stop, and the issue keeps its intent and its record. Invoke a lane skill as
   the entry contract says, with `#<n>`.

## The states table

The `line:` line of `celetis --agent <host> issue <n> state` selects the row. A free-text issue
starts in the first row.

| Line | Capture | Hand-on |
|---|---|---|
| `run /celetis:triage #<n>` | post the record | invoke `celetis:triage #<n>`; it asks, then hands on to the lane |
| `run /celetis:feature #<n>` | post the record | invoke `celetis:feature #<n>` |
| `run /celetis:bug #<n>` | post the record | invoke `celetis:bug #<n>`; it hands on to `plan` in the same session |
| `run /celetis:plan #<n>` | post the record; then name each `### Decided` line that the published spec or root cause contradicts, and say that the published text stays and binds | none: tell the person to run `/celetis:plan #<n>` in a fresh context |
| `run /celetis:chore #<n>`, `run /celetis:hotfix #<n>` | refuse: the capture serves the feature and bug lanes | none |
| `run /celetis:implement #<n>`, each `stop` line | refuse: nothing is ahead, or the issue waits | none |

When `triage` later routes the issue to `chore` or `hotfix`, the record stays on the issue as a
source comment, and those lanes do not read it.
