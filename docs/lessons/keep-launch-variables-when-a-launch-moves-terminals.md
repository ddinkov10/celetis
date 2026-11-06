---
{
  "schema": 1,
  "name": "keep-launch-variables-when-a-launch-moves-terminals",
  "description": "A launch into an hc terminal lost the ADR-0024 variables, and a lab start through open gave the app every shell value, also a secret",
  "tags": [
    "platform-quirk",
    "regression",
    "process",
    "platform",
    "test"
  ],
  "date": "2026-11-06",
  "status": "active",
  "source": "Final review of ddinkov10/celetis#271 (implement step, Claude Code)\n\nTask 3 review of ddinkov10/celetis#232",
  "incidents": [
    {
      "id": "9d3a6c2e-1f4b-4a8d-b7e5-3c2f1a9d8e64",
      "date": "2026-11-06",
      "action": "Task 1 of #271 ran open -n -g --env <lab keys> -a Herdr.app through run() with the full labEnv as the environment of open.",
      "expected": "The spec of #271: no other shell value than the lab keys, PATH, and the telemetry opt-out reaches the lab app.",
      "observed": "With CELETIS_SECRET_TOKEN=s3cr3tvalue exported, ps eww of the lab app held CELETIS_SECRET_TOKEN, CLAUDE_CODE_MESSAGING_TOKEN, and the other shell values.",
      "source": {
        "kind": "tool-output",
        "excerpt": "probe.sh on 626eddf: 'secret-in-env: 1', app env keys '... CELETIS_SECRET_TOKEN CLAUDE_CODE_MESSAGING_TOKEN ... SSH_AUTH_SOCK ...'; after fix c0d6806: 'secret-in-env: 0'",
        "reference": "ddinkov10/celetis#271, runtime verification comment 6684702541"
      },
      "inference": "Inferred: macOS open passes its own environment to the launched app; the spec probe checked only keys that labEnv removes, which were absent from the caller too. Uncertain for other macOS versions.",
      "diagnosis": [
        "unknown"
      ],
      "revision": "626eddf"
    },
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
  "recurrences": 2,
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
    },
    {
      "id": "e33fbf23-bbb5-4163-850c-23d077c65eef",
      "requestDigest": "ea816276eb5cb3b7b8d6d24471e466ef598316c4b7e9a441f0363856385d732c",
      "date": "2026-11-06",
      "decision": "merge",
      "source": "agent review: lesson curation in the landing of #271; claude child opus/high\n\nMerge, under the reviewer rules: the proposal states the rule of the active lesson keep-launch-variables-when-a-launch-moves-terminals in the other direction, the environment of a process that another launcher starts, set explicitly and read in that process. Its evidence (ps eww of the lab app held a shell secret before c0d6806, and not after) also shows that the active clause \"a variable set only in the caller does not reach a process that the launcher starts\" is wrong for macOS open, so two separate active lessons would keep an incompatible claim. The survivor keeps the active name and every incident and review, names the launcher semantics per launcher, and labels the open behavior as an inference with its uncertainty. The rule grants no permission and weakens no check. The structural follow-up stays proposed.",
      "related": [
        "read-the-real-environment-of-a-launched-process",
        "keep-launch-variables-when-a-launch-moves-terminals"
      ],
      "followUp": {
        "state": "proposed",
        "detail": "Structural follow-up, which needs separate authorization: the earlier helper and verify-gate check for the ADR-0024 variables, and a lab check that starts each launcher of scripts/herdr-lab.ts with a sentinel in the calling shell and asserts that the started process lacks it."
      }
    }
  ]
}
---
# Set the environment of a process that another launcher starts, and read it in that process

## What happened

In #232 the session barrier moved from a `spawn` child of the runner, with `env: childEnv(...)`, into the argv of `hc run`. The plan and the implementation kept the argv and dropped the environment. `hc run` gives an explicit command the environment of the hc server. The barrier ran without `BUN_RUNTIME_TRANSPILER_CACHE_PATH=0` and `DO_NOT_TRACK=1`, and a probe found 10 Bun cache files under a fresh HOME (0 with the variables). The task review caught it; a557af9 added an `env` prefix.

During #236 re-entry on 2026-11-05, two temporary native recovery probes repeated the environment omission. Each had zero proxy starts and loopback requests. The second actual terminal still began with /bin/zsh. These runs have no continuation PASS. A retained premise check identified the new-space app boundary before the next attempt.

In #271 the effect was the opposite. Task 1 ran `open -n -g --env <lab keys> -a Herdr.app` with the full lab environment as the environment of `open`. The final review exported `CELETIS_SECRET_TOKEN=s3cr3tvalue`, ran `up`, and read `ps eww -p <appPid>`: the app held that secret, `CLAUDE_CODE_MESSAGING_TOKEN`, and every other value of the calling shell. The argv of `open` held no secret. The spec probe had checked only the keys that `labEnv` removes. After c0d6806, which spawns `open` with only the `appEnv` keys, the same probe gave `secret-in-env: 0`.

## Root cause

Inference: each change took the environment of the started process to be the environment of the caller, or the argv alone. A launcher has its own environment semantics. `hc run` gives an explicit command the environment of the hc server, so a variable set only in the caller does not arrive. The Herdr app wraps raw argv with its own inherited shell and core environment. macOS `open` passes its own environment to the app that it starts, in addition to the `--env` values (inferred from #271; uncertain for other macOS versions). Alternatives: in #232 the plan author assumed that the login shell sets the variables; in #271 the spec probe could not see the leak, because the keys that it looked for were absent from the environment of `open` too.

## Fix

Proposed prevention, not enforced: when a launch moves from a spawn with an `env` option to another launcher, list each variable that the old `env` set and carry it in the new form (`env K=V` in the argv, or the launcher's own option). When code limits the environment of the started process, give the launcher itself only the values that the started process may get, as c0d6806 does for `open`. A structural follow-up needs separate authorization: one helper that builds the Bun argv of plugin code with the ADR-0024 variables, used by every launcher, and a verify-gate check that rejects a `process.execPath` argv given to `openTab` or `startHidden` without it.

For temporary Herdr verification, configure the lab core and app at startup, then confirm the actual terminal argv and native proxy/provider records before accepting any behavioral evidence. Proposed structural follow-up: make the temporary probe assert its expected native proxy start before waiting for recovery, and fail on a provider mismatch. This follow-up needs separate authorization for any reusable repository helper; no permanent check was added.

The rule stays text, because each launcher has its own environment semantics.

## Detection signature

Bun cache files (`Library/Caches/bun/@t@/*.pile`) under the HOME of a server-like environment after a plugin launch; a launch argv that starts with `process.execPath` outside `spawn`/`run` with `childEnv`; a value of the calling shell, for example a token, in `ps eww` of a process that a launcher started.

## Rule

Applies when a change or a temporary check starts plugin code, an agent, or an app through another process launcher (an hc terminal, a Herdr tab or app, `open`, launchd, a login shell, a scheduler). Action: set the environment of the started process explicitly, and do not assume what the launcher passes on. Carry every variable that the old launch or the caller set and that the process needs, in the argv or in the launcher's own configuration, and keep the ADR-0024 Bun variables: some launchers (hc, the Herdr app) do not pass on a variable set only in the caller. When code limits that environment, also give the launcher itself only the allowed values: some launchers (`open`) pass their own environment on to the started process. Check: read the environment in the started process, not in the caller. Run the new launch under an `env -i` server-like environment and confirm the variables in the child and no Bun cache file. When the environment is limited, export a sentinel value in the calling shell, start the process, and confirm in `ps eww` of the started process that the sentinel is absent. For a temporary check, read the actual terminal argv and the expected provider or proxy records before accepting its evidence.

## Related lessons

[[probe-real-tool-semantics-behind-fakes]]
