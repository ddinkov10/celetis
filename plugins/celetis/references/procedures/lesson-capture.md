# Capture an incident proposal

Use this check after a substantive correction of an agent's prior action, after two failed
fixes of the same problem, or before an existing repair limit ends the task. An explicit save
request uses the same procedure. Use only the current task and its directly named evidence.

## One pass

1. **Qualify.** Identify the mistaken action or failed repair, the expected behavior, and the
   observed difference. A new requirement, harmless clarification, or tool error without useful
   incident evidence creates no proposal. If evidence is insufficient, report the missing part
   and continue the task; write no generic rule. A pre-stop incident can qualify before two fixes.
2. **Bound and identify.** Make one pass, at most one proposal per distinct incident and at most
   three proposals per turn. Report further incidents as deferred. Reuse a stable source event
   reference, or assign and retain a UUID when first recording the incident. Keep that ID in the
   task report across child reports, retries, and resumed work. A checkpoint already handled in
   this turn reuses its result; do not count a child report as another occurrence.
3. **Choose the writer.** A child returns the incident ID, action, expected/observed behavior,
   safe evidence excerpt and source, uncertain cause, and candidate suggestion to its coordinator.
   It makes no lesson write. The coordinator owns the task's write; a standalone chat owns its
   own. Preserve the ID and evidence verbatim when receiving a child report.
4. **Read the store.** Run `celetis --agent <host> lesson-store read main`. Use its resolved main
   path, contents, and digests to find the incident and related or conflicting guidance. An equal
   stored incident is already handled, including in rejected or historical records: report it
   unchanged. Read only relevant rule bodies from this result. A denied read is a block, not an
   empty store. An unavailable main checkout stays blocked; use no other queue.
5. **Prepare the proposal.** Read `<plugin>/references/procedures/lesson-format.md`. Retain the actual
   action, expected/observed behavior, date, relevant revision, and a concise safe evidence excerpt
   that survives its source log. Label user reports, tool output, and inferred causes separately.
   Keep uncertainty and alternatives. Exclude credentials, unrelated conversation, and whole
   transcripts. A temporary path alone is insufficient evidence. Use the recurrence diagnosis
   below when applicable. Record related rules and contradictions as proposed reconciliation;
   leave every active rule unchanged. An explicit save request also remains pending.
6. **Save once.** Write one JSON file outside the lesson store, as the format's "The capture
   input" defines: a retained candidate UUID, the typed fields, the incidents, and the complete
   Markdown body. The command builds the stored record and computes `status`, `recurrences`,
   and `reviews`. For a new proposal, `expected` is `null`. To add a new incident to a related
   pending proposal, reuse its candidate, name, and source, use that file's digest from the read
   as `expected`, and supply the complete current description, tags, date, and body. Then run
   `celetis --agent <host> lesson-store capture FILE`. Use no direct store writes.
   Exit 0 reports saved or unchanged. Exit 2 (invalid input/store), 3 (stale/busy), or 6
   (access/I/O/recovery) ends this pass: retain the command's path and cause, report blocked once,
   and resume independent work. Repair no capture input and make no second write in this turn.
   A later request can resolve the reported cause and retry with the same IDs.
7. **Resume.** Report saved/unchanged paths, deferred incident IDs, or the specific block or
   missing evidence briefly. Resume independent authorized work without a promotion question.
   Capture changes no attempt count and grants no repair, review, or workflow permission. Finish
   this check before a terminal act; it cannot delay an access stop or override an entry denial.

## Recurrence diagnosis

Compare the actual relevant rule version and its SHA-256 digest with the available task or
repair brief and the observed action. Retain that lesson's name, revision, digest, and relevant
brief excerpt or durable reference. Record only the supported labels:

| Label | Required evidence |
|---|---|
| `not-retrieved` | A complete task context shows that the applicable rule did not reach it |
| `not-followed` | The brief contains the rule and the action violates it |
| `wrong-or-incomplete-rule` | The action follows the rule, but its direction or coverage fails the case |
| `failed-structural-constraint` | An existing claimed enforcement mechanism accepts the recorded forbidden case |
| `unknown` | The evidence does not distinguish the causes; use alone |

A missing transcript alone yields `unknown`. Recurrence does not establish failed enforcement.
Read `<plugin>/references/principles/encode-lessons-in-structure.md`. Apply it when its `Applies when` holds for the proposal, with its `Check`. In the
proposal's Fix, record a proposed structural follow-up that needs separate authorization, its owner or
issue when known, and a check that would reject the recorded mistake. Mark enforcement proven
only with its actual evidence. When judgment makes a structural check unsuitable, state why the
rule remains text. Capture implements no follow-up and edits no instruction, skill, or principle.
