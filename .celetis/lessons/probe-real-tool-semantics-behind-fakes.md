---
{
  "schema": 1,
  "name": "probe-real-tool-semantics-behind-fakes",
  "description": "Fakes of gh hid how the real tool chooses a target: the GH_REPO host, which gh api ignores, and {owner}/{repo} placeholders, which gh resolves from GH_REPO",
  "tags": [
    "test",
    "false-positive",
    "false-negative",
    "api",
    "recurring"
  ],
  "date": "2026-11-08",
  "status": "active",
  "source": "Task 1 review of ddinkov10/celetis#256 (the check harness of the tracker port)\n\nFinal review of ddinkov10/celetis#44 (implement step, Claude Code)",
  "incidents": [
    {
      "id": "a44a3490-0eb9-4a59-abc2-f2f574c6c470",
      "date": "2026-11-08",
      "action": "Task 1 of #256 built a fake gh for base-against-lane pairs. Its key strips repos/<x>/<y>/ and keeps {owner} and {repo} literally (fake-gh.ts:57); it logs GH_HOST and GH_REPO but picks no answer by them. The task report did not list placeholder resolution or the GH_REPO target choice as unverified.",
      "expected": "Before the fake encodes how gh treats an input that changes the target (GH_REPO, the {owner}/{repo} placeholders), probe the real tool once read-only and make the fake treat it the same way, or name the behavior as unverified and do not count the fake as proof of it.",
      "observed": "The task reviewer's probe: the endpoint repos/o/r/pulls?head=acme:b got 'fake gh: no answer'; the literal {owner} endpoint was answered; the same call with GH_REPO=acme/widgets was answered and the log kept {owner}. The real probe of fix round 1: GH_REPO=cli/cli gh api 'repos/{owner}/{repo}' --jq .full_name printed cli/cli (exit 0), so real gh resolves the placeholders from GH_REPO.",
      "source": {
        "kind": "tool-output",
        "excerpt": "Important 1: fake-gh.ts keeps {owner} and {repo} literally in the key and the log, and it ignores GH_REPO and GH_HOST when it picks an answer ... The report neither probes this nor lists it as unverified. Real probe: GH_REPO=cli/cli gh api 'repos/{owner}/{repo}' --jq .full_name -> cli/cli",
        "reference": "https://github.com/ddinkov10/celetis/issues/256"
      },
      "inference": "Inferred: the implementer applied the rule only to the inputs that the retained #276 fake already modelled (the failure shape, the slurp pages), and did not list the other target inputs of the endpoint text. Alternative: the rule's examples (an environment value or a flag) did not make the placeholders look like a target input. The fix of round 1 added a compare part with (method, endpoint, GH_HOST, GH_REPO) of each call, which made a target change visible.",
      "diagnosis": [
        "not-followed"
      ],
      "revision": "adfa9bb59d55682dca331c02134b386111bff99f",
      "brief": "The Task 1 brief of #256 carried docs/lessons/probe-real-tool-semantics-behind-fakes.md sha256:c10b9faa14f92e289ecb09fc39a8ba08777497218d07469631920d4d34e2660e with its full Rule.",
      "lesson": {
        "name": "probe-real-tool-semantics-behind-fakes",
        "revision": "adfa9bb59d55682dca331c02134b386111bff99f",
        "digest": "c10b9faa14f92e289ecb09fc39a8ba08777497218d07469631920d4d34e2660e"
      }
    },
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
  "recurrences": 1,
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
    },
    {
      "id": "41e78a0f-a719-4e8b-b97a-ed3deeac6d85",
      "requestDigest": "efc14afe6c23253aaf635bf54eeb1c00267496515b719f942836879dd2beed37",
      "date": "2026-11-08",
      "decision": "merge",
      "source": "agent review: lesson curation in the landing of #256; claude child opus/high\n\nMerge under the reviewer rules: the active lesson probe-real-tool-semantics-behind-fakes states the same rule (probe the real tool for each input that chooses a target before a fake encodes it), and the #256 incident records that its brief carried that rule (not-followed). The proposal adds no incompatible rule; the survivor names placeholders in the call text, the working directory, and the compare of each target input of each call. The proposal rule asked for a real probe with no permission limit; the survivor keeps the active limit that makes no network or credential act that the task does not already permit, so the rule widens no permission. Both incidents stay; the root causes stay labeled as inference.",
      "related": [
        "compare-the-target-inputs-of-each-fake-tool-call",
        "probe-real-tool-semantics-behind-fakes"
      ],
      "followUp": {
        "state": "proposed",
        "detail": "A fake tool of a check logs each target input of each call, and its pair runner compares those inputs by default. This needs separate authorization."
      }
    }
  ]
}
---
# Probe the real tool for each input that chooses the target of a faked call

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

Task 1 of ddinkov10/celetis#256 built a fake `gh` for base-against-lane pairs. The fake keyed each
answer on the endpoint text with `{owner}` and `{repo}` unresolved, and chose no answer by
`GH_REPO` or `GH_HOST`; it only logged them. The pair runner compared the writes and the exit,
stdout, and stderr, not the target of each call. The task brief carried this lesson with its full
Rule. The task review showed that a target change could fail as "no answer" or pass unseen. A
read-only real probe (`GH_REPO=cli/cli gh api 'repos/{owner}/{repo}' --jq .full_name` gave
`cli/cli`) showed that real `gh` resolves the placeholders from `GH_REPO`.

## Root cause

#44, inferred: the ruling took the external behavior from the documented `[HOST/]OWNER/REPO` form
of `GH_REPO` and did not probe the real tool. The fake encoded the assumed behavior, so no driver
check could find the wrong assumption. Uncertain: whether `gh` documents that `gh api` ignores
the host part for its placeholders.

#256, inferred, not proven: the implementer applied this rule only to the behaviors that the reused
fake already modelled, and did not list every input of a call that chooses its target. The endpoint
placeholders did not read as an "environment value or flag" input. Alternative: the reused fake set
the scope of the probe.

## Fix

Proposed prevention, not proven enforcement: list each input that chooses the target of a faked
call, including placeholders in the call text. Before a fake encodes how the real tool treats such
an input, run the real tool once with a read-only call that changes only that input, within the
acts that the task already permits; otherwise record the behavior as unverified. Compare each
target input of each call between the two sides of the check.

The repair of Task 1 of #256 added a compare part with the ordered tuples (method, endpoint,
`GH_HOST`, `GH_REPO`) of each call of a non-daemon scenario, and a control that showed a
difference for a changed `GH_REPO`. Proposed structural follow-up, which needs separate
authorization: a fake tool of a check logs each target input of each call, and its pair runner
compares them by default. This remains partly a text rule: which inputs choose a target is a
judgment about each tool.

## Detection signature

A fake that records or ignores an environment value or flag that the code under test sets to
control the real tool, or that keys its answers on call text with unresolved placeholders, with no
real-tool probe of that input in the evidence.

## Rule

Applies when a check replaces an external tool with a fake, and the code under test depends on how
the real tool chooses the target of a call. Action: list every input that chooses the target of a
call: environment values, placeholders in the call text, the working directory, and flags. Before
the fake encodes the behavior of such an input, run the real tool once with a read-only call where
only that input changes the target, and make the fake treat the input the same way. When that call
needs a network or credential act that the task does not already permit, do not make it: record
the behavior as an unverified assumption, and do not count the fake check as proof of it. Compare
each listed input of each call between the two sides of the check. Check: the check report lists
each target input with its probe result or the label unverified, the fake gives the same result as
the real tool for each probed input, and a control with one changed target input shows a
difference.

## Related lessons

[[derive-fixture-state-from-real-producers]]
[[list-every-producer-of-an-oracle-record]]
