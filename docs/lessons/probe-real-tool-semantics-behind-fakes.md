---
{
  "schema": 1,
  "name": "probe-real-tool-semantics-behind-fakes",
  "description": "A status check pinned gh with the host of GH_REPO, which gh api ignores, and a fake gh hid the error",
  "tags": [
    "test",
    "false-positive",
    "api"
  ],
  "date": "2026-11-05",
  "status": "active",
  "source": "Final review of ddinkov10/celetis#44 (implement step, Claude Code)",
  "incidents": [
    {
      "id": "5d0e6b2a-6f0c-4c39-9a51-3a8a0e8f4c21",
      "date": "2026-11-05",
      "action": "Task 1 of #44 pinned the gh tracker read of setup status to origin with GH_REPO=<host>/<owner>/<repo> and recorded a ruling that this selects the host; the fake gh of the status driver ignored the host of GH_REPO.",
      "expected": "The spec of #44: a readable GitHub repository at origin; an unsupported origin is reported, and an incomplete or unsupported project never gets readiness (exit 0).",
      "observed": "The real gh api read github.com/<owner>/<repo> for every GH_REPO host, so status gave exit 0 for a GitLab and a Bitbucket origin in a wired fixture.",
      "source": {
        "kind": "tool-output",
        "excerpt": "GH_REPO=nonexistent-host.invalid/ddinkov10/celetis => exit=0 ddinkov10/celetis; GH_REPO=gitlab.com/ddinkov10/celetis => exit=0 ddinkov10/celetis; GH_HOST=gitlab.com GH_REPO=ddinkov10/celetis => exit=1 gh: HTTP 410; reviewer probe: origin https://gitlab.com/ddinkov10/celetis.git -> 'setup: the required wiring is complete', status exit=0",
        "reference": "ddinkov10/celetis#44, final review of 3941887..2bea1a4; fix 61030d2"
      },
      "inference": "Inferred: the external behavior came from the documented GH_REPO format with no real-tool probe, and the fake encoded the assumption, so no driver check could reject it. Uncertain whether gh documents that gh api ignores the GH_REPO host.",
      "diagnosis": [
        "unknown"
      ],
      "revision": "96d98ddafccd1f27e05d601af6c0e141272024f1"
    }
  ],
  "recurrences": 0,
  "reviews": [
    {
      "id": "2d455fbb-28aa-4c23-ab54-5705ac57afb8",
      "requestDigest": "c43bef2b19d2c50c54344934de79d70c91d74bb7ec3f7fef95365f276c6ba43f",
      "date": "2026-11-05",
      "decision": "edit",
      "source": "agent review: lesson curation in the landing of #44; claude child opus/high\n\nEdit, then approve, under the reviewer rules: the real gh probe output and the reviewer status probe establish the incident, and the root cause is labeled as inference. The reviewer rules reject a rule that adds a network or credential act, and a real gh api call is both. So the edit keeps the real-tool probe only within the acts that the task already permits, and otherwise records the behavior as unverified instead of counting the fake as proof. The rule then grants no permission and weakens no check. derive-fixture-state-from-real-producers covers fixture inputs of a derived state, not the semantics of a faked external tool, so no active or historical lesson states the same rule.",
      "related": [
        "probe-real-tool-semantics-behind-fakes"
      ],
      "followUp": {
        "state": "not-needed",
        "detail": "No structural follow-up is required by this decision."
      }
    }
  ]
}
---
# Probe the real tool for each external behavior that a fake reproduces

## What happened

Task 1 of ddinkov10/celetis#44 added `celetis --agent <host> setup status`. Its tracker read set
`GH_REPO=<host>/<owner>/<repo>`, parsed from `origin`, and a ledger ruling said that this pins
the host. The fake `gh` of the temporary status driver recorded `GH_REPO` but did not use its
host, and 197 driver checks passed. The final review ran the real `gh` 2.103.3:
`GH_REPO=nonexistent-host.invalid/ddinkov10/celetis gh api 'repos/{owner}/{repo}'` returned
`ddinkov10/celetis` from github.com with exit 0. Status then gave exit 0, complete wiring, for a
GitLab and a Bitbucket origin. With `GH_HOST=gitlab.com` the same call went to gitlab.com
(HTTP 410). The fix (61030d2) resolves the host, checks it with `gh auth status --hostname`, and
sends `GH_HOST`.

## Root cause

Inferred: the ruling took the external behavior from the documented `[HOST/]OWNER/REPO` form of
`GH_REPO` and did not probe the real tool. The fake encoded the assumed behavior, so no driver
check could find the wrong assumption. Uncertain: whether `gh` documents that `gh api` ignores
the host part for its placeholders.

## Fix

Proposed prevention, not proven enforcement: before a fake encodes how an external tool treats an
input that the code sets to select a target, run the real tool once with a read-only call that
changes only that input, within the acts that the task already permits; otherwise record the
behavior as unverified. This remains a text rule: which inputs select a target is a
judgment about each tool.

## Detection signature

A fake that records or ignores an environment value or flag that the code under test sets to
control the real tool, with no real-tool probe of that value in the evidence.

## Rule

Applies when a check replaces an external tool with a fake, and the code under test depends on how
the real tool treats an input such as an environment value or a flag. Action: before the fake encodes
that behavior, run the real tool once with a read-only call where only that input changes the
target, and make the fake treat the input the same way. When that call needs a network or
credential act that the task does not already permit, do not make it: record the behavior as an
unverified assumption, and do not count the fake check as proof of it. Check: the real-tool probe
shows the changed target and the fake gives the same result for the same input, or the evidence
names the behavior as unverified.

## Related lessons

[[derive-fixture-state-from-real-producers]]
