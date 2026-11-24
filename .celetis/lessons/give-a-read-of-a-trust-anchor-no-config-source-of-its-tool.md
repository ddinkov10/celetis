---
{
  "schema": 1,
  "name": "give-a-read-of-a-trust-anchor-no-config-source-of-its-tool",
  "description": "A fixed Git source of a tag check was redirected through Git config three times: by insteadOf with no guard, by remote.<url>.vcs past a resolved-URL guard, and by a user-owned system file",
  "tags": [
    "git",
    "config",
    "release",
    "refix"
  ],
  "date": "2026-11-24",
  "status": "active",
  "source": "The implement session of #251 on Claude Code, Task 1, task review of the first repair, 2026-11-23\n\nThe implement session of #251 on Claude Code, Task 1, a controller ruling on the report of the implementer, 2026-11-23",
  "incidents": [
    {
      "id": "653eac5d-c4c4-41ba-80d1-01767623ac8a",
      "date": "2026-11-23",
      "action": "The repair de580bd compared the output of git ls-remote --get-url with releaseSource and left the rest of the Git config active.",
      "expected": "The global constraint of the #251 plan says of the fixed source: \"No environment value or stamp field can change it\".",
      "observed": "A config key remote.<source>.vcs passed the guard, started another helper, and forged the tag proof.",
      "source": {
        "kind": "tool-output",
        "excerpt": "B1 remote.<source>.vcs=fixture: ACCEPTED, helper ran: true"
      },
      "inference": "Inferred: the guard read one resolved output of Git, and vcs selects the transport with no change to that output.",
      "diagnosis": [
        "unknown"
      ],
      "revision": "de580bdc3d3765e4d32e21fafed7a7d81729987b"
    },
    {
      "id": "b19f077f-2a47-4f6c-9972-4383525b4bce",
      "date": "2026-11-23",
      "action": "Commit 48f5e30 removed GIT_CONFIG_NOSYSTEM and GIT_CONFIG_SYSTEM from unattended, as a controller ruling said, on the premise that an administrator owns the system file.",
      "expected": "The spec of #251, \"The trust boundary\": refs/tags/v<version> is read from the fixed public source.",
      "observed": "P2 checkReleaseTag, system insteadOf: ACCEPTED on a9cbbd1; the system file /opt/homebrew/etc/gitconfig is owned by the current user.",
      "source": {
        "kind": "tool-output",
        "excerpt": "\"P2 checkReleaseTag, system insteadOf\": \"ACCEPTED\""
      },
      "inference": "Inferred: the premise on file ownership was not checked before the ruling, and the probe tested the hostile file only through inherited variables. Which carries more weight is not known.",
      "diagnosis": [
        "unknown"
      ],
      "revision": "a9cbbd12c1654ded5938c21b1d6d88d5f165aaa2"
    },
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
  "recurrences": 2,
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
  ]
}
---
# Give a read of a trust anchor no config source of its tool

## What happened

Commit 53655bb of #251 added `checkReleaseTag`, which passed the fixed public source to `git ls-remote`. A probe reached its fixture repository through `url.<base>.insteadOf`, and with no guard, `GIT_CONFIG_*` and a repository config in the working directory each redirected the tag read to another repository; `checkReleaseTag` accepted its tag. A controller ruling applied the plan constraint "No environment value or stamp field can change it". The first repair, de580bd, compared the output of `git ls-remote --get-url` with the constant. That repair is the rule of the lesson `compare-a-trust-anchor-with-the-value-that-its-tool-resolves`, which the landing of #385 curated from this session's first proposal, and which this lesson replaces.

The task review then showed that `remote.<source>.vcs` leaves the `--get-url` output unchanged, makes `ls-remote` start another helper, forges the tag, and runs a program from the working directory. The second repair, 1bd95e1, gave the read no Git config source, and 11 hostile routes then failed or stayed on the fixed source.

A third version, 48f5e30, followed a controller ruling that kept the default system Git config for the TLS settings of Git for Windows, on the premise that an administrator owns that file. On the Mac of the build, the system file is `/opt/homebrew/etc/gitconfig`, and the user owns it. A system `url.<base>.insteadOf` then redirected the read again, and 2a17917 removed the system file from the read.

## Root cause

Inferred, not proven: for 53655bb, the implementer read Git config as the authority of the user and did not test it as an input that changes the fixed value. For de580bd and 48f5e30, both versions treated Git config as a set of known rewrite keys. A tool with several config routes to one read has no single output that shows every route.

## Fix

Proposed prevention: run the trusted read with each config source of the tool removed, and pass a fixture through a patched copy of the constant. The read in #251 does this. No general enforcement exists, so the rule stays text: which constants are trust anchors is a judgment of each design. This rule replaces the rule of `compare-a-trust-anchor-with-the-value-that-its-tool-resolves`: its check of one resolved value did not see `remote.<source>.vcs`.

## Detection signature

A probe reaches its fixture through a config rewrite of a value that the design calls fixed, or a guard compares one resolved output of a tool that has other config routes.

## Rule

Applies when code treats a constant as a trust anchor (a source URL, a registry, a key) and passes it to a tool that reads its own config or environment. Action: run that read with each config source of the tool removed, also a system file, whose owner varies by install, and do not guard it by a check of one resolved value or a list of keys; give a probe its fixture through a patched copy of the constant. Check: a probe gives the tool each config route (environment, user, and repository config, a helper key, and a program on a search path that the config names), and each route leaves the read on the constant and runs no program.

## Related lessons

[[compare-a-trust-anchor-with-the-value-that-its-tool-resolves]]
[[guard-a-parsed-input-with-the-parser-of-its-consumer]]
