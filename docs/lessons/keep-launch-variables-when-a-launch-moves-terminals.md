---
{
  "schema": 1,
  "name": "keep-launch-variables-when-a-launch-moves-terminals",
  "description": "A Bun launch moved from a childEnv spawn into an hc terminal and lost the ADR-0024 variables",
  "tags": [
    "platform-quirk",
    "regression",
    "process"
  ],
  "date": "2026-11-05",
  "status": "active",
  "source": "Task 3 review of ddinkov10/celetis#232",
  "incidents": [
    {
      "id": "4f438dd2-d3f8-49d4-b72a-3f7de1cec581",
      "date": "2026-11-02",
      "action": "The plan of #232 gave the session barrier argv as [process.execPath, ...bunArgs(celetis-flow.ts, ['--session-start', ...])] for hc run, and the Task 3 implementer built it as given. The old barrier was a spawn child with env childEnv(...), which sets BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 and DO_NOT_TRACK=1.",
      "expected": "Each Bun launch of plugin code sets BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 and DO_NOT_TRACK=1 (ADR-0024 of the plugin celetis; engine/lib/program.ts:39 uses exec env ... bun ...).",
      "observed": "hc run gives an explicit command the environment of the hc server, then the login shell; neither sets the variables. The barrier wrote Bun transpiler cache files and had crash reports enabled.",
      "source": {
        "kind": "tool-output",
        "excerpt": "r1-env.sh on 73866ca: 'tab: files under HOME: 10' (Library/Caches/bun/@t@/*.pile); control with both variables: 'childenv: files under HOME: 0'. Fixed in a557af9 with an env prefix; rerun: 0 files.",
        "reference": "ddinkov10/celetis#232, Task 3 review of 73866ca, fix a557af9"
      },
      "inference": "Inferred: the plan moved the launch across a process boundary (spawn child to hc terminal) and kept only the argv, not the environment that the old spawn applied. Uncertain whether the plan author knew that hc run drops the caller environment; the spec's External facts state it.",
      "diagnosis": [
        "unknown"
      ],
      "revision": "73866ca"
    },
    {
      "id": "236-reentry-herdr-core-environment-20261105",
      "date": "2026-11-05",
      "action": "The native recovery probe started its lab with the normal environment, then set PATH, native fixture homes, and SHELL only in the runner. A second attempt changed only the runner shell.",
      "expected": "Both native interactive attempts use the controlled loopback provider through the retained native proxy.",
      "observed": "Both attempts bypassed the proxy, made zero loopback requests, and reached the real Claude weekly-limit dialog. hc get t2 showed argv[0] /bin/zsh despite the runner SHELL override. No Codex replacement began.",
      "source": {
        "kind": "tool-output",
        "excerpt": "nativeStarts:0; requests:[]; editedAt:null. hc get t2 argv begins [\"/bin/zsh\",\"-lic\"]. Runner: \"the exit request failed. No other agent starts.\"",
        "reference": "#236 re-entry on ae60ba8; docs/superpowers/verification/236-reentry-20261105/native-continuation-invalid-app-target/terminal.json and premise-check.md"
      },
      "inference": "The new-space branch asks the Herdr app to wrap raw argv. That app uses its own inherited shell and core environment, so changing only the runner cannot configure the first terminal. The exact earlier operator reasoning is unknown.",
      "diagnosis": [
        "unknown"
      ],
      "revision": "ae60ba8b15b8d60498eeeb7b13ea4b073265b4ab"
    }
  ],
  "recurrences": 1,
  "reviews": [
    {
      "id": "16ab5145-be94-4fce-b6b5-049bc72834c7",
      "requestDigest": "deea9dfa3b6b3a0af1e76ec4713a82f4489e6f64b40e6f0c580d5bbc09135752",
      "date": "2026-11-05",
      "decision": "edit",
      "source": "agent review: lesson curation in the landing of #44; claude child opus/high\n\nEdit, then approve, under the reviewer rules: the cache-file probe of #232 and the zero-proxy records of #236 establish two incidents of one omission, and the root cause is labeled as inference with its alternative. The edit widens only the applicability and the check of the rule so that they also cover the second incident, a temporary check that set variables only in the runner; the Fix already stated that case. The rule grants no permission and weakens no check. The structural follow-up stays proposed. No active or historical lesson states the same rule.",
      "related": [
        "keep-launch-variables-when-a-launch-moves-terminals"
      ],
      "followUp": {
        "state": "proposed",
        "detail": "Structural follow-up named in the Fix, which needs separate authorization: one helper that builds the Bun argv of plugin code with the ADR-0024 variables for every launcher, a verify-gate check that rejects a process.execPath argv given to openTab or startHidden without them, and a probe assertion of the expected native proxy start before a Herdr recovery wait."
      }
    }
  ]
}
---
# Carry the launch environment when a launch moves to another terminal

## What happened

In #232 the session barrier moved from a `spawn` child of the runner, with `env: childEnv(...)`, into the argv of `hc run`. The plan and the implementation kept the argv and dropped the environment. `hc run` gives an explicit command the environment of the hc server. The barrier ran without `BUN_RUNTIME_TRANSPILER_CACHE_PATH=0` and `DO_NOT_TRACK=1`, and a probe found 10 Bun cache files under a fresh HOME (0 with the variables). The task review caught it; a557af9 added an `env` prefix.

During #236 re-entry on 2026-11-05, two temporary native recovery probes repeated the environment omission. Each had zero proxy starts and loopback requests. The second actual terminal still began with /bin/zsh. These runs have no continuation PASS. A retained premise check identified the new-space app boundary before the next attempt.

## Root cause

Inference: the change treated a launch as its argv only. The variables lived in the spawn options, not in the argv, so a move to another launcher (hc, herdr-app, a login shell) dropped them. Alternative: the plan author assumed that the login shell sets them.

## Fix

Proposed prevention, not enforced: when a launch moves from a spawn with an `env` option to another launcher, list each variable that the old `env` set and carry it in the new form (`env K=V` in the argv, or the launcher's own option). A structural follow-up needs separate authorization: one helper that builds the Bun argv of plugin code with the ADR-0024 variables, used by every launcher, and a verify-gate check that rejects a `process.execPath` argv given to `openTab` or `startHidden` without it.

For temporary Herdr verification, configure the lab core and app at startup, then confirm the actual terminal argv and native proxy/provider records before accepting any behavioral evidence. Proposed structural follow-up: make the temporary probe assert its expected native proxy start before waiting for recovery, and fail on a provider mismatch. This follow-up needs separate authorization for any reusable repository helper; no permanent check was added.

## Detection signature

Bun cache files (`Library/Caches/bun/@t@/*.pile`) under the HOME of a server-like environment after a plugin launch; a launch argv that starts with `process.execPath` outside `spawn`/`run` with `childEnv`.

## Rule

Applies when a change or a temporary check starts plugin code or an agent through another process launcher (an hc terminal, a Herdr tab or app, a login shell, a scheduler). Action: carry every variable that the old launch or the caller set, in the argv or in the launcher's own configuration, and keep the ADR-0024 Bun variables; a variable set only in the caller does not reach a process that the launcher starts. Check: run the new launch under an `env -i` server-like environment and confirm the variables in the child and no Bun cache file; for a temporary check, read the actual terminal argv and the expected provider or proxy records before accepting its evidence.
