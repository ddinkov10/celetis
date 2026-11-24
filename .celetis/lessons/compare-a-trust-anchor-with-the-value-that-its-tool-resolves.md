---
{
  "schema": 1,
  "name": "compare-a-trust-anchor-with-the-value-that-its-tool-resolves",
  "description": "A tag check trusted git ls-remote for a fixed source URL, and a Git config rewrite redirected the read to another repository",
  "tags": [
    "git",
    "config",
    "release"
  ],
  "date": "2026-11-23",
  "status": "superseded",
  "source": "The implement session of #251 on Claude Code, Task 1, a controller ruling on the report of the implementer, 2026-11-23",
  "incidents": [
    {
      "id": "de1fa477-dab1-4c6c-a1a4-d2b88d45834c",
      "date": "2026-11-23",
      "action": "Commit 53655bb called resolveRef(releaseSource, ...) with no check of the URL that Git uses, and the probe reached its fixture through insteadOf.",
      "expected": "The global constraint of the #251 plan says of the fixed source: \"No environment value or stamp field can change it\".",
      "observed": "GIT_CONFIG_* and a repository config in cwd redirected the tag read to another repository, and checkReleaseTag accepted its tag.",
      "source": {
        "kind": "tool-output",
        "excerpt": "FAIL rewrite: insteadOf through GIT_CONFIG_*: no refusal"
      },
      "inference": "Inferred: the implementer treated Git config as the authority of the user and did not test it as an input that changes the fixed value. A fixture route through insteadOf can have made that reading attractive.",
      "diagnosis": [
        "unknown"
      ],
      "revision": "53655bbd5cd455004ff4868c3f7f640bbc7b87e0"
    }
  ],
  "recurrences": 0,
  "reviews": [
    {
      "id": "14145d21-465e-4916-bc77-6954fa2c0374",
      "requestDigest": "51318eb3ed7971af39216fe096b62604d5349ab6023f45cf3da785fe8df80b11",
      "date": "2026-11-23",
      "decision": "approve",
      "source": "agent review: lesson curation in the landing of #385; claude child opus/high\n\nApprove: the incident holds observed tool output, the rule states applicability, action, and check, no active lesson states it, and no reviewer rule rejects it. The manual of git-ls-remote states that --get-url expands url.<base>.insteadOf and does not talk to the remote.",
      "related": [
        "compare-a-trust-anchor-with-the-value-that-its-tool-resolves"
      ],
      "followUp": {
        "state": "not-needed",
        "detail": "The rule stays text, because which constants are trust anchors is a judgment of each design."
      }
    },
    {
      "id": "a6e467b7-8eb1-4127-868e-8b1b0a5e9035",
      "requestDigest": "5e463bf11b6bf126a3da68f415b5fffefcdbff6017aea3d0146c3e1252c3036e",
      "date": "2026-11-24",
      "decision": "supersede",
      "source": "agent review: lesson curation in the landing of #251; claude child opus/high\n\nSupersede under the reviewer rules: new evidence shows that the rule of the active lesson compare-a-trust-anchor-with-the-value-that-its-tool-resolves is wrong, and two incompatible rules must not stay active. The proposal holds observed tool output: a probe of the resolved-URL guard of de580bd (the action of the old rule) accepted remote.<source>.vcs and ran a helper, and a probe on a9cbbd1 accepted a system insteadOf from a user-owned system file. Its rule states applicability, action, and check, widens no permission, weakens no check or gate, adds no network or credential act, and agrees with the principle boundary-discipline of the plugin celetis. The read of the lane (unattended of engine/lib/process/git.ts) sets GIT_DIR, GIT_CONFIG_GLOBAL, and GIT_CONFIG_SYSTEM to the null device, sets GIT_CONFIG_NOSYSTEM, and drops the other GIT_ variables, as the Fix says. No live or historical lesson holds its incidents. Edits: the replacement keeps the incident and review of the old lesson, its What happened and Root cause name the first incident and its inferred cause, the description covers the three incidents, and the Fix states the replacement in place of the proposed reconciliation.",
      "related": [
        "give-a-read-of-a-trust-anchor-no-config-source-of-its-tool",
        "compare-a-trust-anchor-with-the-value-that-its-tool-resolves"
      ],
      "followUp": {
        "state": "not-needed",
        "detail": "The rule stays text, because which constants are trust anchors is a judgment of each design."
      }
    }
  ],
  "replacement": "give-a-read-of-a-trust-anchor-no-config-source-of-its-tool",
  "reason": "Replaced by give-a-read-of-a-trust-anchor-no-config-source-of-its-tool: the #251 incident 653eac5d shows that remote.<source>.vcs passed the check of the resolved URL that this rule prescribes, started another helper, and forged the tag proof. The replacement keeps this incident and its review, and removes each config source of the tool from the read."
}
---
# Compare a trust anchor with the value that its tool resolves

## What happened

Commit 53655bb of #251 added `checkReleaseTag`. It passed the fixed public source to `git ls-remote` and trusted the tag that the command printed. A probe reached its fixture repository through `url.<base>.insteadOf`. A controller ruling then applied the global constraint of the plan, "No environment value or stamp field can change it". With the check absent, `GIT_CONFIG_*` and a repository config in the working directory each redirected the tag read to another repository, and `checkReleaseTag` accepted its tag.

## Root cause

Inferred, not proven: the implementer read Git config as the authority of the user and did not test it as an input that changes the fixed value. The wish for a simple route to a fixture source can have made that reading attractive.

## Fix

Proposed prevention: read the value that the tool resolved (for Git, `git ls-remote --get-url -- <url>`) and refuse a difference before the trusted read. The check in #251 is one such guard. No general enforcement exists, so the rule stays text: which constants are trust anchors is a judgment of each design.

## Detection signature

A probe reaches its fixture through a config rewrite of a value that the design calls fixed.

## Rule

Applies when code treats a constant as a trust anchor (a source URL, a registry, a key) and passes it to a tool that can rewrite it through its own config or environment. Action: read the value that the tool resolved and compare it with the constant before the trusted read, and refuse a difference; give a probe its fixture through a patched copy of the constant, not through the rewrite. Check: a probe gives the tool each config form that rewrites the value (environment, repository, and user config), and each is refused before the trusted read.

## Related lessons

[[guard-a-parsed-input-with-the-parser-of-its-consumer]]
