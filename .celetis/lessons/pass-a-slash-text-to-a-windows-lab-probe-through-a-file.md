---
{
  "schema": 1,
  "name": "pass-a-slash-text-to-a-windows-lab-probe-through-a-file",
  "description": "On Windows, Git Bash converts a bare argument that starts with / into a Windows path before hc gets it",
  "tags": [
    "platform-quirk",
    "e2e",
    "test",
    "refix"
  ],
  "date": "2026-11-22",
  "status": "active",
  "source": "implement session of #361, Verify V1 to V5 in a Windows lab of scripts/herdr-lab.ts",
  "incidents": [
    {
      "id": "3f851c30-0b4e-4b49-8a96-d8f2ef157e5d",
      "date": "2026-11-22",
      "action": "A lab probe ran `hc send t4 /exit` as a bare argument through Git Bash and `herdr-lab.ts run`.",
      "expected": "The host of the tab gets the text `/exit`.",
      "observed": "The host logged the submitted line `C:/Program Files/Git/exit`. Fix 1, `MSYS_NO_PATHCONV=1`, broke `--config=/dev/null` of the bun command. Fix 2, `MSYS2_ARG_CONV_EXCL=\"/exit\"`, worked for `/exit`, but `MSYS2_ARG_CONV_EXCL=\"/\"` for `hc keys ... /` broke the script path. A bun script that calls hc with the text worked.",
      "source": {
        "kind": "tool-output",
        "excerpt": "host byte log: submitted line `C:/Program Files/Git/exit`; fix 1: `EINVAL ... while reading config \"/dev/null\"`; fix 2 with `/`: `Module not found \"/c/Users/.../herdr-lab.ts\"`",
        "reference": "https://github.com/ddinkov10/celetis/issues/361"
      },
      "inference": "Reported by the child of the Verify run; cause inferred: MSYS path conversion of Git Bash rewrites each bare argument that starts with / before the Windows process starts. Uncertain: only the probe harness is affected; the sends of the engine pass no argument through Git Bash. Alternative: a per-call exclusion list can work, but it must also keep /dev/null and the script paths.",
      "diagnosis": [
        "unknown"
      ],
      "revision": "b274ca4b88b9b6b416ff49af628f4b77f67c59ea"
    }
  ],
  "recurrences": 0,
  "reviews": [
    {
      "id": "b741517f-ae6a-4b03-bb26-154067e92bf4",
      "requestDigest": "befb1a313ae82a1414ab2c7aabfb1a487cf58e11003b32349243f9daad1bce32",
      "date": "2026-11-22",
      "decision": "approve",
      "source": "agent review: lesson curation in the landing of #361; claude child opus/high\n\nApprove under the reviewer rules. The incident is observed tool output: the host byte log shows `C:/Program Files/Git/exit` for a sent `/exit`, and two failed repairs (`MSYS_NO_PATHCONV=1` broke `--config=/dev/null`; `MSYS2_ARG_CONV_EXCL=\"/\"` broke the script path) before a bun script worked. The rule states applicability, action, and check, and the record keeps the inferred MSYS cause apart from the facts. No live or historical lesson states a rule on Git Bash path conversion; give-a-probe-a-private-home-before-a-case-unsets-a-home-variable and keep-launch-variables-when-a-launch-moves-terminals cover variables of a Windows lab, not arguments. The rule widens no permission, weakens no check (its check adds the host byte log), and keeps the bun flags of the verify gate command that AGENTS.md requires.",
      "related": [
        "pass-a-slash-text-to-a-windows-lab-probe-through-a-file"
      ],
      "followUp": {
        "state": "not-needed",
        "detail": "The shape of a probe varies and no gate runs probe harnesses, so the rule stays text."
      }
    }
  ]
}
---
# Pass a text that starts with / to a Windows lab probe through a file or a script

## What happened

In the Verify run of #361 on Windows, a probe ran `hc send t4 /exit` through Git Bash and `herdr-lab.ts run`. The host got `C:/Program Files/Git/exit`. Turning path conversion off with `MSYS_NO_PATHCONV=1` broke `--config=/dev/null` of the bun command (`EINVAL`). An exclusion `MSYS2_ARG_CONV_EXCL="/exit"` worked for `/exit`, but the exclusion `/` for `hc keys ... /` broke the script path (`Module not found`). A bun script that calls hc with the text worked.

## Root cause

Inferred: Git Bash (MSYS) converts each bare argument that starts with `/` into a Windows path before it starts a Windows program. The probe needs both kinds of argument in one command line: POSIX paths that must convert (the script) or must stay (`/dev/null`, which bun reads itself), and host texts that must not convert. A global switch cannot serve both. Uncertain: the engine's own sends do not pass through Git Bash, so only probe harnesses are affected.

## Fix

Proposed prevention, not enforced: give each host text or key that starts with `/` to hc from a file or from a script (for example a bun script that calls `hc send` with the text), never as a bare argument of a Git Bash command. The rule stays text, because the shape of a probe varies and no gate runs probe harnesses.

## Detection signature

The host of a lab tab logs a Windows path such as `C:/Program Files/Git/<text>` where the probe sent `/<text>`.

## Rule

Applies when a check on Windows sends a host text or a key that starts with `/` through Git Bash, for example `hc send`, `hc keys`, or `herdr-lab.ts run`. Action: put the text in a file or pass it from a script that calls the command directly; do not use `MSYS_NO_PATHCONV` or `MSYS2_ARG_CONV_EXCL` as a global fix in a command line that also holds a path. Check: the host byte log of the tab shows the exact text that the probe sent, before the scenario result counts.
