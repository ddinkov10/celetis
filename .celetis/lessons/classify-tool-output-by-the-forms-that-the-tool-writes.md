---
{
  "schema": 1,
  "name": "classify-tool-output-by-the-forms-that-the-tool-writes",
  "description": "A 403 matcher skipped the remote-prefixed lines that it knew, so a remote ERR packet with the words HTTP 403 ended a landing with exit 0",
  "tags": [
    "git",
    "false-positive"
  ],
  "date": "2026-11-23",
  "status": "active",
  "source": "The implement session of #40 on Claude Code 2.1.330, final whole-branch review.",
  "incidents": [
    {
      "id": "c23d0af4-f896-424f-9488-e6ae5d1ea695",
      "date": "2026-11-23",
      "action": "The session classified a refused branch deletion by matching HTTP 403 in each stderr line except lines that start with remote: or !.",
      "expected": "Text that the remote controls does not count as a refusal by the proxy, so a remote error keeps exit 7.",
      "observed": "A local smart-HTTP origin sent an ERR packet. Git printed it as fatal: remote error: HTTP 403 text from the remote, and the helper returned the branch as refused.",
      "source": {
        "kind": "tool-output",
        "excerpt": "err raw push exit 128 \"fatal: remote error: HTTP 403 text from the remote\"; err helper returned [\"bugfix/1-x\"]",
        "reference": "https://github.com/ddinkov10/celetis/issues/40"
      },
      "inference": "Inferred: a list of excluded prefixes covers only the remote channels that the author knew. An allowlist of the lines that Git writes has no such gap. A server that embeds a line break in its error text can still imitate a line.",
      "diagnosis": [
        "unknown"
      ],
      "revision": "20f69824b086c2ee36fdbb1c513b19a044cece08"
    }
  ],
  "recurrences": 0,
  "reviews": [
    {
      "id": "afc8a071-fee0-4247-ab83-3caaad763e2a",
      "requestDigest": "1ef5e0448e4902ad736c10062ca8f435607d5c627492740056f2ff264431f436",
      "date": "2026-11-24",
      "decision": "approve",
      "source": "agent review: lesson curation in the landing of #347; claude child opus/high\n\nApprove (reviewer rules): the incident holds observed tool output (a local smart-HTTP origin sent an ERR packet, Git printed `fatal: remote error: HTTP 403 text from the remote`, and the helper returned the branch as refused). The rule states applicability, action, and check. It widens no permission, weakens no check or gate, and adds no network or credential act: the probe uses a local origin. It agrees with the principle boundary-discipline of the plugin celetis, because it treats the text of the remote as input across a trust boundary. No live or historical lesson holds its incident or states its rule: probe-real-tool-semantics-behind-fakes covers how a fake chooses a target, and guard-a-parsed-input-with-the-parser-of-its-consumer covers a guard before a consumer. The body keeps the cause as inference.",
      "related": [
        "classify-tool-output-by-the-forms-that-the-tool-writes"
      ],
      "followUp": {
        "state": "proposed",
        "detail": "A shared helper that classifies the output of an external tool by an allowlist of its own line forms could replace each prefix list. This structural work needs separate authorization; this review changes lesson data only."
      }
    }
  ]
}
---
# Classify tool output by the forms that the tool writes

## What happened

The helper of #40 treated a failed branch deletion as a proxy refusal when a stderr line held `HTTP 403`, except lines that start with `remote:` or `!`. The final review sent an `ERR` packet from a local origin. Git printed `fatal: remote error: HTTP 403 text from the remote`, and the helper accepted it.

## Root cause

Inference: the matcher excluded the remote channels that the author knew. Git has one more channel, the `ERR` packet. The cause was not tested beyond this case.

## Anti-pattern

```ts
lines.some((line) => !/^\s*(?:remote:|!)/.test(line) && /HTTP 403/.test(line));
```

## Fix

Proposed prevention: match only the exact line forms that the tool itself writes, and add a probe for each channel that carries remote text. This rule stays text, because the forms differ for each tool.

## Detection signature

A classifier of command output that lists the prefixes it ignores.

## Rule

Applies when code decides an outcome from the text output of an external tool, and a remote or another lower-trust party can put text into that output. Action: accept only the exact line forms that the tool itself writes, and list each channel that carries the text of the other party. Check: a probe sends the decisive words through each listed channel, and the outcome stays the failure.

## Related lessons

- [[probe-real-tool-semantics-behind-fakes]]
