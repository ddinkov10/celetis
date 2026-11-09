---
name: intake
description: Use when a raw request arrives with no intent written — a pasted ticket, a one-line ask, a crash link, or any request that has not been intent-ified. Also use when the user says "just fix it" or "don't write a document" — these are signals the request has not passed through intake. Not when the issue already carries an intent or a lane label, or the user runs a typed lane directly (/celetis:bug, /celetis:hotfix, /celetis:feature, /celetis:chore).
---

**Celetis entry.** Before any step or response, including commentary or an announcement, bind `<plugin>` to the absolute prefix before `/skills/<name>/SKILL.md` in the path of this loaded file. Then read `<plugin>/docs/procedures/entry.md` whole, in one read, and follow it before any product-path scan. Do this on each invocation, including a same-session handoff.

# /celetis:intake — intent front door

Raw-idea entry point that sits before `/celetis:triage`. Two jobs: write the intent, then ask
"proceed?" and hand to `/celetis:triage`. Never classifies type, never gates, never writes a spec,
never writes code.

**Where it writes:** the issue. Draft the template in `docs/superpowers/intents/YYYY-MM-DD-<slug>-intent.md` (gitignored scratch), then post it:
free text → `gh issue create --label needs-triage --title "<Intent title>" --body-file <intent>`;
an existing `#<n>` → `gh issue comment <n> --body-file <intent>` with `## Intent` as its first
line — never rewrite the reporter's body.

## Contract

```
Reads:   raw request (chat, pasted text, crash link) or an existing issue #<n>
Writes:  the intent onto the issue (a new issue's body, or a `## Intent` comment)
Stops:   when the human rejects the proposal; in a step session, after the intent
Never:   classify type, gate, write a spec, write code
```

## Step 1 — intent-ify

Fill the template of `<plugin>/docs/procedures/intent.md` from the source, with its per-type
rules.

## Step 2 — handoff question

Read the intent back. Ask "proceed?". On no, stop. On yes, invoke `/celetis:triage #<n>`. Triage owns the type decision — intake never classifies.

In a step session, ask nothing: stop after the intent is on the issue, and leave triage to the daemon, which starts it in a fresh session.

## Rules

Intake fires BEFORE any other action on a raw request. These rules are absolute:

- **The intent is mandatory.** A raw request without an intent on its issue is incomplete. Write it.
- **A ticket is a source, not the intent.** A Jira ticket, crash log, or feedback email is
  input to the template — not a substitute for it. Write it anyway.
- **"Just fix it" does not bypass intake.** The user can skip further process steps, but the
  intent artifact must exist. Write it anyway.
- **Do not classify type.** The intent template has no type field. Classification lives in
  triage. Intake never labels bug/feature/chore/hotfix.
- **Do not design solutions.** `Problem` is in the user's words. `Done when` is an outcome,
  not an implementation. No architecture, no code path, no library choice.
- **Fill `Repro` completely.** The intent is the reproduction source of truth. Copy every
  replication input from the source into `Repro` — site URL, script URL, username, password,
  steps — verbatim.
- **Stop at "proceed?".** After writing the intent, do nothing else. Ask the question. Wait. In a step session, stop after the intent (Step 2).

## Red Flags — STOP

- "The ticket already says everything" — it doesn't. The template distills who/problem/done-when.
- "The user said don't write a document" — the intent is not a document. It's a routing artifact.
- "This type is obvious" — intake doesn't care about type. Triage does.
- "I can just ask a clarifying question first" — intent-ify first, then ask.
- "The user gave almost nothing — I need more context first" — write what you have. Mark gaps explicitly. Then ask.

All of these mean: write the intent first.

## Common Rationalizations

| Excuse | Reality |
|--------|---------|
| "The raw ticket is detailed enough" | A ticket is not distilled. The intent template forces who/problem/done-when. |
| "User said don't write docs, just fix it" | The intent is a routing artifact, not user-facing docs. It enables the chain. |
| "I can classify and intent-ify in one step" | Merging steps drops the persistent artifact. Triage needs the issue. |
| "It's a waste of time for a simple bug" | "Bug" is a type classification. Intake doesn't classify — it writes the intent. |
| "I'll write it after I understand the problem" | Understanding happens through intent-ification, not before it. |
| "This is a hotfix, skip the process" | A hotfix is the most dangerous time to skip the artifact. The intent survives pressure. |
| "The request is too vague to intent-ify" | Write what the user said. Mark gaps explicitly. A partial intent is better than no intent. |
| "I know what they mean, I'll fill in the details" | Never paraphrase or extrapolate. Quote the user's words. If they didn't say it, don't write it. |
