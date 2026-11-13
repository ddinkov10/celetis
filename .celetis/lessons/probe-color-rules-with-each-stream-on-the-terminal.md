---
{
  "schema": 1,
  "name": "probe-color-rules-with-each-stream-on-the-terminal",
  "description": "A no-color probe sent stderr to a file, so it missed that Bun console.error colors its text red on a terminal also with TERM=dumb",
  "tags": [
    "test",
    "platform-quirk",
    "false-negative"
  ],
  "date": "2026-11-13",
  "status": "active",
  "source": "The implement session of #313 on Claude Code, Verify V4 (celetis update with temporary installation data), 2026-11-13",
  "incidents": [
    {
      "id": "723e4ba2-d6ab-4a51-8e3a-7578bb4f8e70",
      "date": "2026-11-13",
      "action": "Task 1 of #313 wrote the failure block of celetis update with console.error and claimed in plugins/celetis/README.md, \"Updates\", that the command prints no color with NO_COLOR or TERM=dumb. Its state probe ran each case as script -q /dev/null sh -c '... 2>file', so stderr was never a terminal.",
      "expected": "No escape byte on stdout or stderr when TERM=dumb, also when stderr is the terminal (spec of #313, Required behavior, from clig.dev).",
      "observed": "With stderr on the pseudo-terminal, Bun 1.4.4 console.error wraps each line in ESC[0m ESC[31m ... ESC[0m with TERM=xterm-256color and with TERM=dumb; only NO_COLOR=1 removes it. process.stderr.write gives plain bytes.",
      "source": {
        "kind": "tool-output",
        "excerpt": "TERM=dumb script -q /dev/null bun -e 'console.error(\"err-line\"); process.stderr.write(\"raw-line\\n\")' | od -c -> 033 [ 0 m 033 [ 3 1 m e r r - l i n e 033 [ 0 m \\r \\n r a w - l i n e \\r \\n"
      },
      "inference": "Inferred cause: the probe copied the stream split of an earlier probe (stderr to a file to read it apart from stdout), and no case put stderr on the terminal, so the color rule was only checked for the stream that styleText controls. Uncertain: whether other engine commands that use console.error have the same gap.",
      "diagnosis": [
        "unknown"
      ],
      "revision": "032a5b2d26762df4841972a388a77c2c7057eac9"
    }
  ],
  "recurrences": 0,
  "reviews": [
    {
      "id": "638d89c3-6227-4f56-9647-9f1690cbf370",
      "requestDigest": "7dd0c344a3ed38f4787856f30deab6a97ffa9c4a2a68c73a55e0102e277c62fc",
      "date": "2026-11-13",
      "decision": "approve",
      "source": "agent review: lesson curation in the landing of #313; claude child opus/high\n\nApprove (reviewer rules): the proposal holds observed tool-output evidence of a real incident, states applicability, action, and check, keeps the inferred cause apart from the facts, and no active or historical lesson states the same rule or holds its incident. It widens no permission, weakens no check, and contradicts no skill, principle, or project instruction; the principle test-behavior-not-implementation agrees with it.",
      "related": [
        "probe-color-rules-with-each-stream-on-the-terminal"
      ],
      "followUp": {
        "state": "not-needed",
        "detail": "The rule stays text; the engine fix of #313 already writes the stderr of celetis update with process.stderr.write."
      }
    }
  ]
}
---
# Probe a color rule with each stream on the terminal

## What happened

Task 1 of #313 changed the output of `celetis update` and documented that it prints no color with `NO_COLOR` or `TERM=dumb`. The state probe ran each case in `script -q /dev/null` with `2>file`, so stderr was a file in every case. The probe passed. In Verify V4, a variant with stderr on the pseudo-terminal showed `ESC[0m ESC[31m ... ESC[0m` around the error lines with `TERM=dumb`. A direct run showed that Bun 1.4.4 `console.error` adds this wrapping on a terminal for any `TERM`, and only `NO_COLOR=1` removes it; `process.stderr.write` writes plain bytes.

## Root cause

Inferred: the probe separated stdout and stderr by sending stderr to a file, and no case put stderr on the terminal. So the check covered only the stream that `styleText` controls, not the color that the runtime adds to `console.error`. Uncertain: other commands that use `console.error` can have the same gap.

## Fix

Proposed: a color or no-color check runs each case once with stdout and stderr both on the terminal, and reads the bytes of each stream there (for example two runs, or one run that marks the streams). Write stderr text that must follow a color rule with `process.stderr.write`, not with `console.error`, under Bun. Not proven as structure: the rule stays text, because the choice of streams depends on the command under test.

## Detection signature

`ESC[0m ESC[31m` before an error line in a terminal transcript, with `TERM=dumb`.

## Rule

Applies when a check verifies a color, `NO_COLOR`, or `TERM=dumb` rule of a command, or when command code writes stderr that such a rule covers. Action: run at least one case of each rule with stdout and stderr both on the terminal, and check the bytes of each stream; under Bun, write rule-bound stderr with `process.stderr.write`, not `console.error`. Check: the evidence holds a case with stderr on the terminal for each rule, and a control with `console.error` on a terminal with `TERM=dumb` shows the escape bytes that the check rejects.
