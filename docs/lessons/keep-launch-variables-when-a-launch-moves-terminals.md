---
{
  "schema": 1,
  "name": "keep-launch-variables-when-a-launch-moves-terminals",
  "description": "A launch into an hc terminal lost the ADR-0024 variables, a lab start through open gave the app every shell value, and the login shell of a new Herdr space ran the real host in two lab checks",
  "tags": [
    "platform-quirk",
    "regression",
    "process",
    "platform",
    "test",
    "e2e",
    "recurring"
  ],
  "date": "2026-11-08",
  "status": "active",
  "source": "Verify phase of ddinkov10/celetis#276 (first V5 attempt), reported by the verification child\n\nTask 1 of ddinkov10/celetis#141 (implement session, child t1-impl); recorded by the coordinator\n\nFinal review of ddinkov10/celetis#271 (implement step, Claude Code)\n\nTask 3 review of ddinkov10/celetis#232",
  "incidents": [
    {
      "id": "541d7b6a-5351-43df-a1ff-78a4c7b9cc5c",
      "date": "2026-11-08",
      "action": "The #276 V5 probe ran `celetis --agent claude run 1` in lab celetis-lab-8a7546 with no Herdr space of the fixture repository, so the run's first session tab went through space.new and its login shell.",
      "expected": "Every session tab of a lab runs a synthetic host binary under the fixture bin; for a Herdr lab the space is made first, so no session tab goes through space.new.",
      "observed": "The login shell put ~/.local/bin before fx/bin, and the tab ran the real /Users/dinq/.local/bin/claude (PID 94597, CLAUDE_CONFIG_DIR = the fixture home, prompt /celetis:chore #1, --permission-mode auto) for a few seconds until the probe guard sent SIGKILL.",
      "source": {
        "kind": "tool-output",
        "excerpt": "v: FAIL: a real host binary runs in the lab: [{\"pid\":94597,\"args\":\"/Users/dinq/.local/bin/claude --session-id 0beea581-07db-402f-9c60-33060920de82 --settings /private/tmp/celetis-276-checks/fx/repo/.git/celetis/usage-captures/… --permission-mode auto --effort high -n #1 chore …",
        "reference": "docs/superpowers/verification/276-verify/V5-contaminated-1/run.out in the #276 lane; the #276 runtime report on the issue"
      },
      "inference": "Inferred: the probe author reused the run path of the daemon without the space-first step that the carried rule names; the guard caught it, so it held as a detection but not as prevention. Not known: whether the real binary made an API call in those seconds (no transcript under the fixture config folder; a later re-prepare may have overwritten one).",
      "diagnosis": [
        "not-followed"
      ],
      "revision": "90aa8bb000dc8ab155ff55506e60fe0ef9e23177",
      "brief": "The #276 Verify dispatch (.superpowers/sdd/276/verify-dispatch.md) cites the plan Verify phase, whose lesson rules carry keep-launch-variables-when-a-launch-moves-terminals sha256:195e3f54… (\"for a Herdr lab make the space first, so that no session tab goes through space.new\").",
      "lesson": {
        "name": "keep-launch-variables-when-a-launch-moves-terminals",
        "revision": "2fc548691a802b56b8be30acacb0ce82eae057d1",
        "digest": "195e3f542ec7db9c6e9f6e94c1dca75794707ab60047ce03caf8a97290a9f0ce"
      }
    },
    {
      "id": "288b1628-5e8c-41dd-b3ea-20eab96a2b80",
      "date": "2026-11-06",
      "action": "The Task 1 implementer reused the #248 lab fixture after a check of its Git remotes only, and ran the cli.ts probe and one debug run in lab celetis-lab-c00d86.",
      "expected": "Each session tab of the lab runs the synthetic host fx/bin/claude: the plan of #141 says that hosts are synthetic stand-ins and that no real Claude or Codex session runs.",
      "observed": "The first session tab of each new Herdr space ran /Users/dinq/.local/bin/claude (Claude Code 2.1.318), three times (base #1, lane #1, one debug run). Each had CLAUDE_CONFIG_DIR=fx/claude-home with no credentials, stopped at the onboarding screen, wrote only fixture files, fetched the public changelog, and ended at hc kill. No account session ran. The probe saw only a timeout for the session of #1.",
      "source": {
        "kind": "tool-output",
        "excerpt": "27834 27808 S+ ttys002 /Users/dinq/.local/bin/claude --session-id e93399c3-… -n #1 plan … under the barrier …/engine/daemon.ts --session-start …; a space.new terminal printed PATH=/opt/homebrew/opt/ruby/bin:/Users/dinq/.local/bin:…:/private/tmp/celetis-141-checks/fx/bin:… and which=/Users/dinq/.local/bin/claude; its shell was /bin/zsh -lic \"$@\"; exec \"$0\" -li … under the lab hc hold.",
        "reference": "ddinkov10/celetis#141 Task 1 report; lane evidence docs/superpowers/verification/141-t1/attempt-1/incident.txt"
      },
      "inference": "Inferred from the tool output: openTab makes the first tab of a missing space with herdr-app do space.new --argv; the lab app, started by scripts/herdr-lab.ts with only the lab keys, has SHELL=/bin/zsh and runs that argv through /bin/zsh -lic, and the login profile of the user puts ~/.local/bin before the fixture bin. Later tabs come from hc run with SHELL=fx/shell. The #248 probes have the same hazard; whether they started the real host is unknown. Whether scripts/herdr-lab.ts should give the app a fixture PATH is an open alternative.",
      "diagnosis": [
        "not-followed"
      ],
      "revision": "28439a99528bb53f75f29dd6c6123b2c423eb97a",
      "brief": "The Task 1 brief carried check-retained-verification-fixtures-against-current-boundaries (compare the fixture topology and side effects) and keep-launch-variables-when-a-launch-moves-terminals; the worker compared the remote topology but not the host binary of an app-made tab.",
      "lesson": {
        "name": "check-retained-verification-fixtures-against-current-boundaries",
        "revision": "28439a99528bb53f75f29dd6c6123b2c423eb97a",
        "digest": "afab3339d2b5440c1e57d9bd8e6906a0b9d28211a83c6720dfe68f0ea58589d5"
      }
    },
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
  "recurrences": 4,
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
    },
    {
      "id": "1d7049d0-70ff-497e-8c45-948c8c139f7f",
      "requestDigest": "0f120d8175fc62611e47b5b16ef77476cc6cf61fe7698d3803ab4a7c50b2edf3",
      "date": "2026-11-06",
      "decision": "merge",
      "source": "agent review: lesson curation in the landing of #274; claude child opus/high\n\nMerge, under the reviewer rules: the proposal states the rule of the active lesson keep-launch-variables-when-a-launch-moves-terminals for one more launcher case, and its incident recurs the #236 incident of that lesson: the first terminal of a new Herdr space runs through the /bin/zsh -lic of the app, so a lab check reached a real host. The retained ps and PATH output establishes the incident: three app-made tabs ran ~/.local/bin/claude, with no credentials and no account session. The brief carried this lesson (diagnosis not-followed). The survivor keeps the active name and every incident and review, adds the login-shell case to the action and the check (resolve each command to the intended binary, make the Herdr space first, and confirm the host binary of each session tab), and labels the cause as inference with its alternatives. The lane scripts/herdr-lab.ts gives the lab app PATH and no SHELL, which agrees with that inference. The rule finds lab processes only by the environment token of match-process-tokens-only-in-the-environment and ends only lab PIDs; it grants no permission, adds no network or credential act, and weakens no check. It applies only to a check whose plan uses synthetic hosts, so it agrees with Host checks of AGENTS.md. The structural follow-up stays proposed.",
      "related": [
        "check-the-host-binary-of-each-lab-session-tab",
        "keep-launch-variables-when-a-launch-moves-terminals"
      ],
      "followUp": {
        "state": "proposed",
        "detail": "Structural follow-up, which needs separate authorization: scripts/herdr-lab.ts gives the lab app a SHELL or PATH that keeps the fixture hosts first, and a lab check starts one app-made tab and asserts that command -v claude is under the fixture bin. The earlier proposed follow-ups of this lesson stay as they are."
      }
    },
    {
      "id": "1454d399-c6e4-46be-8bc1-c2a528bd3292",
      "requestDigest": "0f771e3230eef93fc4510fce2477b61af5e35cc4db59536752ec870d4b8f0efd",
      "date": "2026-11-08",
      "decision": "merge",
      "source": "agent review: lesson curation in the landing of #276; claude child opus/high\n\nMerge, under the reviewer rules: the proposal states the rule of the active lesson keep-launch-variables-when-a-launch-moves-terminals, whose action already says to make the Herdr space first so that no session tab goes through space.new, and whose check already says to confirm the host binary of each session tab. The Verify brief of #276 carried that lesson at digest 195e3f54, the digest of the live file, so the incident is a recurrence of a carried rule that was not followed (diagnosis not-followed). The retained ps line (PID 94597 ran /Users/dinq/.local/bin/claude in the lab) establishes it. The survivor keeps the active name and every incident and review, adds the #276 facts apart from the inferred cause and the unknown API call, and makes the space-first step name the time of the step: before the first launch of the check, also for a run that a probe starts. The proposed check of a control without the space-first step is not taken, because that control would start the real host on purpose. The rule grants no permission, adds no network or credential act, weakens no check, and agrees with Host checks of AGENTS.md. The structural follow-up stays proposed.",
      "related": [
        "create-the-herdr-lab-space-before-any-session-tab",
        "keep-launch-variables-when-a-launch-moves-terminals"
      ],
      "followUp": {
        "state": "proposed",
        "detail": "Structural follow-up, which needs separate authorization: scripts/herdr-lab.ts up (or the fixture harness) creates the Herdr space of the fixture repository with a seed tab that runs no shell profile, and a check starts a run right after up and asserts that its session tab runs a host binary under the fixture bin. The earlier proposed follow-ups of this lesson stay as they are."
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

In Task 1 of #141 on 2026-11-06, a reused lab fixture of #248 started the real Claude Code binary three times. The first session tab of each new Herdr space ran `~/.local/bin/claude` in place of the synthetic host of the fixture. The tab ran under `/bin/zsh -lic`, and a `space.new` terminal printed a `PATH` with `~/.local/bin` before the fixture `bin`. Each process had the fixture config folder with no credentials, stopped at the onboarding screen, wrote only fixture files, and fetched the public changelog. No account session ran. The probe reported only a session timeout. The task brief carried this lesson; the worker compared the Git remotes of the fixture, not the host binary of an app-made tab.

In the Verify phase of #276 on 2026-11-08, the first V5 probe ran `celetis --agent claude run 1` in lab celetis-lab-8a7546 with no Herdr space of the fixture repository. The first session tab went through `space.new` and a login shell that put `~/.local/bin` before the fixture `bin`, and it ran the real `/Users/dinq/.local/bin/claude` (PID 94597, with the fixture `CLAUDE_CONFIG_DIR` and the prompt `/celetis:chore #1`) for a few seconds, until the probe guard sent SIGKILL. The Verify brief carried this lesson with its space-first rule. The repeat made the space `repo` first with a seed tab, and its guard saw no real host in 21 samples.

## Root cause

Inference: each change took the environment of the started process to be the environment of the caller, or the argv alone. A launcher has its own environment semantics. `hc run` gives an explicit command the environment of the hc server, so a variable set only in the caller does not arrive. The Herdr app wraps raw argv with its own inherited shell and core environment. macOS `open` passes its own environment to the app that it starts, in addition to the `--env` values (inferred from #271; uncertain for other macOS versions). Alternatives: in #232 the plan author assumed that the login shell sets the variables; in #271 the spec probe could not see the leak, because the keys that it looked for were absent from the environment of `open` too.

In #141, inferred from the tool output: `openTab` makes the first tab of a missing space with `herdr-app do space.new --argv`, and the lab app runs that argv through `/bin/zsh -lic`. The login profile of the user then puts `~/.local/bin` before the fixture `bin`, so a login shell inside a launcher changed the environment that the launcher had set, and the command name `claude` resolved to the real host. Later tabs come from `hc run` with the fixture shell, so they got the fake host. Uncertain: whether the #248 runs started the real host too, and whether `scripts/herdr-lab.ts` should give the lab app a fixture `SHELL` or `PATH`.

In #276, inferred: the probe author reused the run path of the daemon without the space-first step that this rule names, although the brief carried it. The guard detected the real host only after it started, so the guard held as detection but not as prevention. Not known: whether the real binary made an API call in those seconds; no transcript was found under the fixture config folder, and a later re-prepare can have overwritten one.

## Fix

Proposed prevention, not enforced: when a launch moves from a spawn with an `env` option to another launcher, list each variable that the old `env` set and carry it in the new form (`env K=V` in the argv, or the launcher's own option). When code limits the environment of the started process, give the launcher itself only the values that the started process may get, as c0d6806 does for `open`. A structural follow-up needs separate authorization: one helper that builds the Bun argv of plugin code with the ADR-0024 variables, used by every launcher, and a verify-gate check that rejects a `process.execPath` argv given to `openTab` or `startHidden` without it.

For temporary Herdr verification, configure the lab core and app at startup, then confirm the actual terminal argv and native proxy/provider records before accepting any behavioral evidence. Proposed structural follow-up: make the temporary probe assert its expected native proxy start before waiting for recovery, and fail on a provider mismatch. This follow-up needs separate authorization for any reusable repository helper; no permanent check was added.

For a lab check with synthetic hosts, proposed in #141 and not enforced: make the Herdr space first with a `/bin/sleep` tab, so that no session tab goes through `space.new`, and fail the probe at once when a lab process runs a real `claude` or `codex` binary. Find lab processes only by the lab token in the environment part of `ps eww`, never by the binary name, and end only lab tabs and recorded fake-host PIDs. A structural follow-up needs separate authorization: `scripts/herdr-lab.ts` could give the lab app a `SHELL` or `PATH` that keeps the fixture hosts first, with a check that starts one app-made tab and asserts that `command -v claude` is under the fixture `bin`.

The #276 recurrence shows that the text rule and the guard do not prevent the first launch. A structural follow-up, proposed in #276, needs separate authorization: `scripts/herdr-lab.ts up` (or the fixture harness) creates the Herdr space of the fixture repository with a seed tab that runs no shell profile, so that no probe can reach `space.new` for a session tab, and a check starts a run right after `up` and confirms that its tab runs a host binary under the fixture `bin`. No enforcement is proven.

The rule stays text, because each launcher has its own environment semantics.

## Detection signature

Bun cache files (`Library/Caches/bun/@t@/*.pile`) under the HOME of a server-like environment after a plugin launch; a launch argv that starts with `process.execPath` outside `spawn`/`run` with `childEnv`; a value of the calling shell, for example a token, in `ps eww` of a process that a launcher started; a session tab of a synthetic-host lab whose process runs a host binary outside the fixture `bin`, for example `~/.local/bin/claude`, or a lab session that ends only with a timeout.

## Rule

Applies when a change or a temporary check starts plugin code, an agent, or an app through another process launcher (an hc terminal, a Herdr tab or app, `open`, launchd, a login shell, a scheduler). Action: set the environment of the started process explicitly, and do not assume what the launcher passes on. Carry every variable that the old launch or the caller set and that the process needs, in the argv or in the launcher's own configuration, and keep the ADR-0024 Bun variables: some launchers (hc, the Herdr app) do not pass on a variable set only in the caller. When code limits that environment, also give the launcher itself only the allowed values: some launchers (`open`) pass their own environment on to the started process. A login shell inside a launcher (for example the first tab of a new Herdr space) can change that environment again from the profile of the user, for example the order of `PATH`: make each launch path resolve each command to the intended binary, and for a Herdr lab create the space of the target repository with a seed tab before the first launch of the check, also before a run or a session that a probe starts through the daemon or `celetis run`, so that no session tab goes through `space.new`. Check: read the environment in the started process, not in the caller. Run the new launch under an `env -i` server-like environment and confirm the variables in the child and no Bun cache file. When the environment is limited, export a sentinel value in the calling shell, start the process, and confirm in `ps eww` of the started process that the sentinel is absent. For a temporary check, read the actual terminal argv and the expected provider or proxy records before accepting its evidence. For a check with synthetic hosts, confirm for each session tab that its process runs a host binary under the fixture `bin`, and fail the check at once when a lab process, found only by the lab token in its environment, runs a host binary outside the fixture.

## Related lessons

[[probe-real-tool-semantics-behind-fakes]] [[check-retained-verification-fixtures-against-current-boundaries]] [[match-process-tokens-only-in-the-environment]]
