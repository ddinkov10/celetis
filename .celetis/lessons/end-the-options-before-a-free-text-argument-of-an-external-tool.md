---
{
  "schema": 1,
  "name": "end-the-options-before-a-free-text-argument-of-an-external-tool",
  "description": "A plan fixed the argv of hc send with the text as a bare positional, so a text that starts with - was parsed as an option and nothing was typed",
  "tags": [
    "process",
    "test",
    "false-negative"
  ],
  "date": "2026-11-10",
  "status": "active",
  "source": "The implement session of #252 on Claude Code, task review of Task 1 (the terminal layer), 2026-11-10",
  "incidents": [
    {
      "id": "a28ab66f-84b3-4b4a-9741-8df2e74c1560",
      "date": "2026-11-10",
      "action": "The plan of #252 fixed the argv of the new function sendText as ['send', <id>, <text>, '--json'] (Task 1, Interfaces and probe case t6), and the implementer built that argv. The plan-session probes and the task probe sent only texts that start with a letter or a bracket.",
      "expected": "sendText delivers each text as a value: hc types it, whatever its first character is, and a text can never act as an option of hc (the spec of #252: the send types the text of the file; anti-goal: the engine never uses --force of hc send).",
      "observed": "With the text as a bare positional, hc parses a text that starts with - as an option: the call exits 2, sendText returns 'unknown', and nothing is typed. The text --force is consumed as the flag itself.",
      "source": {
        "kind": "tool-output",
        "excerpt": "hc 0.1.20: `hc send t_nonexistent_zz '- item' --json` exits 2 with {\"error\":{\"hint\":\"see `hc --help`\",\"kind\":\"usage\",\"message\":\"unexpected argument '- ' found tip: to pass '- ' as a value, use '-- - '\"}}; `hc send t_nonexistent_zz '--force' --json` exits 2 with {\"error\":{\"hint\":\"see `hc --help`\",\"kind\":\"usage\",\"message\":\"the following required arguments were not provided: <TEXT>\"}}",
        "reference": "https://github.com/ddinkov10/celetis/issues/252"
      },
      "inference": "Inferred cause: the plan session copied the argv shape of its lab probes, whose texts all started with a header line in brackets, and no probe case gave the tool a value that starts with the option character. Alternative: the author knew that each engine text starts with a fixed header and judged the general case out of scope; the plan does not say so. Uncertain which.",
      "diagnosis": [
        "unknown"
      ],
      "revision": "af1b5ce"
    }
  ],
  "recurrences": 0,
  "reviews": [
    {
      "id": "b3bf865c-e13c-48f8-abd1-bfcdee0591c1",
      "requestDigest": "cdb2e6a2249770efa7b2ebbf4f24080e30c8d3ee6c6ed30e85c8e77b705a20a4",
      "date": "2026-11-10",
      "decision": "edit",
      "source": "agent review: lesson curation in the landing of #287; codex child host default/high\n\nEdit under the reviewer rules before approval. The retained hc usage errors are observed evidence of option interpretation. The body keeps copying and reliance on a header as uncertain causes. No active lesson states this free-text argv rule; probe-real-tool-semantics-behind-fakes concerns target selection in fakes. Clarify the check for tools without a -- marker: the old check demanded -- even in its unsupported-marker branch. Bound the option-like probe to already permitted temporary data with no real-resource effect, so it grants no dangerous option, network, or credential act. Preserve the incident verbatim and attribute the reported function enforcement. The revised rule states applicability, action, and check, agrees with boundary-discipline and test-behavior-not-implementation, and changes no gate or project instruction. Structural work stays proposed.",
      "related": [
        "end-the-options-before-a-free-text-argument-of-an-external-tool"
      ],
      "followUp": {
        "state": "proposed",
        "detail": "A separately authorized shared literal-value argument helper could prevent option parsing of free text. No helper or instruction change is part of this lesson review."
      }
    }
  ]
}
---
# End the options with -- before a free-text argument of an external tool

## What happened

The plan of #252 fixed the argv of `sendText` of `engine/lib/terminal.ts` as `['send', <id>, <text>, '--json']`, and probe case t6 asserted that argv. The implementer built it (commit `af1b5ce`). The task reviewer ran `hc send t_nonexistent_zz '- item' --json` on hc 0.1.20: exit 2, `unexpected argument '- ' found`. With the text `--force`, hc took the text as its flag: `the following required arguments were not provided: <TEXT>`. The implement session reproduced both exits. Each probe of the plan session and of the task had sent only texts that start with a letter or a bracket, so each probe passed.

## Root cause

Inference: the argv came from lab probes whose texts all start with a fixed header, and no case gave the tool a value that starts with the option character. Alternative, not excluded: the author relied on the fixed header of each engine text and left the general function unguarded without saying so.

## Anti-pattern

```ts
await call(exec, 'hc', ['send', id, text, '--json']);
```

## Fix

In #252 the argv became `['send', id, '--json', '--', text]`, and the probe got a case with the texts `- item` and `--force`. The proposal reports enforcement in that one function; this review does not establish broader enforcement. Proposed prevention for other calls stays text: whether an argument is free text needs judgment that a lint rule over argv arrays cannot make.

## Detection signature

A tool exits with a usage error such as `unexpected argument '-…' found`, or a required positional is reported missing, when the value starts with `-`.

## Rule

Applies when a plan or code passes text that a person, an agent, or a file supplies as an argument of an external command-line tool. Action: when the tool supports `--`, put each fixed option before that marker and the free text after it. Otherwise use the tool’s supported literal-value form, or refuse a value that starts with the option character when no such form exists. In an already permitted probe on temporary data, include a text that starts with `-` and a text equal to an option of the tool; choose a target for which a parsing mistake cannot change a real resource or add an unapproved act. Check: accepted texts produce the exact typed or stored bytes, and the recorded argv uses the supported literal-value form (`--` directly before the text when available); an unsupported leading-option value gets the required refusal with no side effect.
