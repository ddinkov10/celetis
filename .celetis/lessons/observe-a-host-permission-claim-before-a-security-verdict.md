---
{
  "schema": 1,
  "name": "observe-a-host-permission-claim-before-a-security-verdict",
  "description": "A security review rejected two findings from document text: a risk named in a lane ADR as accepted, and a claim that a denial blocks the shell path, which a deny rule that hides the tool contradicts",
  "tags": [
    "process",
    "false-negative",
    "platform-quirk"
  ],
  "date": "2026-11-22",
  "status": "active",
  "source": "The implement session of #358 on Claude Code, Task 7 security review and its task review, 2026-11-22",
  "incidents": [
    {
      "id": "7c1e9b42-5d0a-4f6e-9a83-2b4d6e1f0c57",
      "date": "2026-11-22",
      "action": "The Task 7 security review of #358 rejected R1 (the land allow rule has no folder scope) as a documented and accepted risk, and R2 with \"the shell path is no way around a denial\", and then posted no ## Security review comment.",
      "expected": "A risk that the change adds or widens, and that no maintainer disposition accepts, gets needs_validation or confirmed by security.md; a claim about how the host treats a denial is observed on the host or stays needs_validation.",
      "observed": "Claude Code 2.1.330 with .claude/settings.json {\"permissions\":{\"deny\":[\"mcp__plugin_celetis_celetis__land\"]}}: the init event lists 60 celetis tools and no land tool, with plugin:celetis:celetis connected; the control lists 61 with land. The new entry text runs a form with no tool of that name as a shell command, so a tool deny rule does not stop the act and the agent sees no denial.",
      "source": {
        "kind": "tool-output",
        "excerpt": "deny: {n: 60, land: false, server plugin:celetis:celetis connected}; ctrl: {n: 61, land: true}",
        "reference": "https://github.com/ddinkov10/celetis/issues/358"
      },
      "inference": "Uncertain: the review reasoned from the documents and did not run a host probe of the tool list; it read the residual-risk line of the lane ADR-0129 as a maintainer acceptance. Alternative: the procedure security.md forbids running product code, and the reviewer may have read that as a ban on host probes too.",
      "diagnosis": [
        "unknown"
      ],
      "revision": "ddd624ae2f2e6244a264d4058119caecd0643db2"
    }
  ],
  "recurrences": 0,
  "reviews": [
    {
      "id": "cd1eb0f3-2db7-4eea-8e64-74fe91167226",
      "requestDigest": "24c3be0920ffc885f167d57fd8028c45ccde921494ebce62459e24950ba112b9",
      "date": "2026-11-22",
      "decision": "edit",
      "source": "agent review: lesson curation in the landing of #358; claude child opus/high\n\nEdit, then activate, under the reviewer rules. The proposal has observed tool output: with a deny rule of mcp__plugin_celetis_celetis__land, the init event of Claude Code 2.1.330 listed 60 celetis tools and no land tool, against 61 in the control. The rule states applicability, action, and check, widens no permission, and adds no network or credential act. The first text told the security review itself to observe the host with a scratch run; security.md forbids product code and server processes in that review, and a probe that loads the plugin starts its MCP server, so that part contradicted the procedure. The edit keeps needs_validation in the security review and moves the observation to the task review or the Verify phase, corrects the root-cause alternative accordingly (the incident inference stays unchanged), and links check-native-denial-mechanism, which states the related fact that a bare deny removes a tool. No live or historical lesson holds the incident or states this rule.",
      "related": [
        "observe-a-host-permission-claim-before-a-security-verdict"
      ],
      "followUp": {
        "state": "not-needed",
        "detail": "The rule stays text: the choice of the decisive host fact needs judgment at each review. This review changes lesson data only."
      }
    }
  ]
}
---

# Observe a host permission claim before a security verdict

## What happened

The Task 7 security review of #358 rejected two findings. It called the missing folder scope of the `land` allow rule "documented and accepted", from a residual-risk line of the lane ADR-0129, which no maintainer disposition covers. It also said that "the shell path is no way around a denial". The task review then observed on Claude Code 2.1.330 that a deny rule of `mcp__plugin_celetis_celetis__land` removes the tool from the tool list (60 tools against 61, the server connected). The new entry text runs a form with no tool of that name in the shell, so the deny rule hides the tool and the agent runs the act in Bash with no denial to stop it.

## Root cause

Inference, uncertain: the review reasoned from document text and ran no host probe of the permission behavior. It took a risk that the lane itself recorded as accepted. An alternative cause is that `security.md` forbids running product code, and a host probe that loads the plugin starts its server; that rule leaves `needs_validation`, not a rejection, for a fact that only a run can settle.

## Fix

Proposed, not enforced: the security review runs no product code (`security.md`), and a scratch host run that loads the plugin starts its server, a process of the product. So the security review gives a finding that depends on a host permission behavior `needs_validation` with that open fact, never `rejected` from document text. The task review or the Verify phase observes the behavior with a scratch host run (for Claude Code, the `init` event of `claude -p` with the rule in a scratch `.claude/settings.json`). A residual risk that a lane document records is no maintainer disposition. The rule stays text, because the choice of the decisive host fact needs judgment.

## Rule

Applies when a security review or its task review gives a verdict that depends on how a host applies a permission rule (allow, deny, ask, auto mode), or rejects a finding because a document of the same lane records the risk. Action: in the security review, give such a finding `needs_validation` with the exact open host fact, not `rejected` from document text; in the task review or the Verify phase, observe the host behavior with a scratch run that changes no real setting. Treat a risk as accepted only with an explicit maintainer disposition and its source. Check: each rejected permission finding names its host observation or a maintainer disposition, and a deny-rule case is checked against the tool list of the host, because a deny rule can remove a tool instead of denying its call.

## Related lessons

[[check-native-denial-mechanism]]
