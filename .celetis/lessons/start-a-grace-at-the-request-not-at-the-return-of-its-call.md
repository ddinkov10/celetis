---
{
  "schema": 1,
  "name": "start-a-grace-at-the-request-not-at-the-return-of-its-call",
  "description": "A 10-second exit grace started after hc send returned, and hc send waits about 5 s for a turn start, so the SIGTERM came 15 s after the /exit",
  "tags": [
    "api",
    "platform-quirk",
    "process"
  ],
  "date": "2026-11-08",
  "status": "active",
  "source": "Task 1 of ddinkov10/celetis#279 (implement session), lab case (a) of stepend-probe.ts in lab celetis-lab-ecdd12",
  "incidents": [
    {
      "id": "b29b9891-eece-4e7c-8e71-b3c3192bb7a2",
      "date": "2026-11-08",
      "action": "The step end of engine/lib/run-engine.ts started the exitGraceMs timer of the SIGTERM escalation after `await requestExit(...)` returned, as the old 10-second diagnostic timer did.",
      "expected": "The decision of #279: SIGTERM when the Claude host still runs 10 seconds after the exit request; lab case (a) expects one SIGTERM 10.0 to 11.5 s after the host reads /exit.",
      "observed": "The host read /exit at 15:53:07.829Z; the daemon logged `daemon: #1 claude did not exit within 10 seconds; the daemon sent SIGTERM to its host process (PID 10795).` at 15:53:22.886Z, 15.1 s later. A lab probe of hc 0.1.18: `hc send <t> /exit --json` to a reader with an idle OSC 7501 status took 5215 ms and printed {\"started\":false,\"status\":\"idle\",\"turn\":0}; to a plain reader it took 1003 ms.",
      "source": {
        "kind": "tool-output",
        "excerpt": "{\"name\":\"idle reporter\",\"text\":\"/exit\",\"code\":0,\"ms\":5215,\"out\":\"{\\\"started\\\":false,\\\"status\\\":\\\"idle\\\",\\\"turn\\\":0}\"}; daemon log 15:53:22.886Z exit-signal after the /exit input at 15:53:07.829Z",
        "reference": "docs/superpowers/verification/279-task1/green-wt/a.observed.json of the lane of #279 (ignored folder)"
      },
      "inference": "Tool output: hc send waits for a turn start of a status-reporting program (`waits for a person to pause`, help text) and returns about 5 s later when no turn starts, as at the Claude exit dialog. Inferred: the plan text `At exitGraceMs after a successful request` and the External fact `hc send exits 0 when the host opens the dialog` did not name that wait, and the implementation copied the timer start of the old diagnostic. Uncertain: the wait length of hc for the real Claude host is not measured here.",
      "diagnosis": [
        "unknown"
      ],
      "revision": "86802b11e051963fc513429c14a0080ebb3c32e6"
    }
  ],
  "recurrences": 0,
  "reviews": [
    {
      "id": "9d0b8d8f-27fc-408d-8ff2-2c73870e1354",
      "requestDigest": "db4f85eecc87a7df00c4811f71a629e838028f20e0d308679830d156560744ab",
      "date": "2026-11-08",
      "decision": "approve",
      "source": "agent review: lesson curation in the landing of #277; claude child opus/high\n\nApprove under the reviewer rules: the incident is observed. Its retained tool output gives the daemon log line of the SIGTERM at 15:53:22.886Z, 15.1 s after the host read /exit at 15:53:07.829Z, and a lab probe of hc 0.1.18 in which `hc send <t> /exit --json` took 5215 ms to an idle OSC 7501 reporter, with {\"started\":false,\"status\":\"idle\",\"turn\":0}, and 1003 ms to a plain reader. The strings of the installed herdr-core 0.1.18 binary (read as a file, not run) hold the help line \"Paste text into a terminal and press Enter (waits for a person to pause)\" and the send result field \"Whether it went `working` within a few seconds; null when it doesn't\", which agree with the wait that the Root cause states as tool output. The body labels the cause of the late timer as inference, and it names the unmeasured wait of the real Claude host as uncertain. The rule states applicability, action, and check, and agrees with the decision of #279 that the incident quotes: SIGTERM when the host still runs 10 seconds after the exit request. It adds a check, weakens none, widens no permission, adds no network or credential act, and contradicts no project instruction, skill, or principle; a probe of hc in this repository runs in a lab of scripts/herdr-lab.ts by AGENTS.md, \"Host checks\". No active or historical lesson states this rule: probe-real-tool-semantics-behind-fakes covers a fake of an external tool, end-a-piped-child-at-its-exit the end event of a child, and read-hc-foreground-until-it-settles a stale foreground read, not the start of a grace period.",
      "related": [
        "start-a-grace-at-the-request-not-at-the-return-of-its-call"
      ],
      "followUp": {
        "state": "not-needed",
        "detail": "The proposal names no structural follow-up: which call can wait after it delivers its request is a judgment about each tool, so the rule stays text. Lab case (a) of #279 already measures the act from the time when the host reads /exit."
      }
    }
  ]
}
---
# Start a grace at the request, not at the return of its call

## What happened

In #279 the daemon must send SIGTERM to a Claude host that still runs 10 seconds after its `/exit` request. The first build started the 10-second timer after `requestExit` returned. Lab case (a) showed the SIGTERM 15.1 s after the host read `/exit`. A probe showed that `hc send <t> /exit --json` to a program with an idle OSC 7501 status returns after about 5.2 s (`"started":false`), and after about 1 s to a plain reader.

## Root cause

Tool output: `hc send` waits for a turn start of a status-reporting program before it returns. Inference: the timer start followed the old diagnostic timer, and neither the plan step nor its external fact named the wait of the call. The wait length for the real Claude host is unmeasured.

## Anti-pattern

```ts
if (!(await requestExit(terminal, host))) return;
setTimeout(escalate, graceMs);
```

## Fix

Take the time before the request call, and schedule the grace for the rest of the period after a successful return. Proposed prevention only: a lab case that measures the act from the observed input time, not from the return of the call. The rule stays text, because which call can block is a judgment of each tool.

## Detection signature

A timed act comes later than its grace by about the duration of the request call (here 5 s).

## Rule

Applies when code starts a grace, a timeout, or a deadline for an act that a request call begins, and the call can wait after it delivers the request (for example `hc send` to a status-reporting program). Action: measure the period from the start of the request, not from the return of the call; keep the act conditional on a successful call. Check: a probe records the time when the target receives the request and the time of the act, and the act lies within the period plus a small margin, also when the call blocks for several seconds.

## Related lessons

[[probe-real-tool-semantics-behind-fakes]]
