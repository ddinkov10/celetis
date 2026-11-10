---
{
  "schema": 1,
  "name": "give-a-fixture-login-shell-the-job-control-of-the-real-tab-shell",
  "description": "A reused fixture shell ran the tab command with no job control, so hc reported the shell as the foreground and the board showed no card for the session",
  "tags": [
    "test",
    "false-negative",
    "platform-quirk"
  ],
  "date": "2026-11-10",
  "status": "active",
  "source": "The implementer of Task 2 of #252 (child t2-impl of the implement session on Claude Code), report of 2026-11-10",
  "incidents": [
    {
      "id": "8213DA77-DD4C-4D93-8F9E-C55718DAB92E",
      "date": "2026-11-10",
      "action": "The implementer reused the fixture shell of the retained #262 harness for the fixture S of #252. That shell ran the tab command of `-lic` as `exec /bin/sh -c \"$script\"`.",
      "expected": "A session tab of the fixture behaves as with a login zsh: the start barrier leads the foreground process group of the terminal (engine/README.md, \"The session tab\"), so the board shows the session card (probe case o12 of #252).",
      "observed": "`hc get` of the tab showed the fixture shell as the foreground, and the board gave no Coordinator card. With `/bin/sh -ic` (job control) the case passed.",
      "source": {
        "kind": "tool-output",
        "excerpt": "green1b.txt, o12: \"foreground\":{\"argv\":[\"/bin/sh\",\"-c\",…],\"name\":\"bash\"}; `hc get` showed the foreground `/bin/sh -c \"$@\" || exec \"$0\" -li …`",
        "reference": "https://github.com/ddinkov10/celetis/issues/252"
      },
      "inference": "Inferred cause, from the child report: the #262 harness never checked a board card of a tab with a link label and a barrier, so its shell did not need the foreground process group of a real login shell. Uncertain: the task brief carried the lesson check-retained-verification-fixtures-against-current-boundaries, and the report shows a topology comparison, but the report does not show whether that comparison ran before the first probe run or after case o12 failed. So the evidence does not tell an incomplete rule from an incomplete application.",
      "diagnosis": [
        "unknown"
      ],
      "revision": "b04b548",
      "brief": "task-2-lessons.md of the implement session carried the rule: \"Before reusing a retained verification probe, compare its fixture topology and side effects with the current project instructions and approved scenario.\"",
      "lesson": {
        "name": "check-retained-verification-fixtures-against-current-boundaries",
        "revision": "9cae923",
        "digest": "afab3339d2b5440c1e57d9bd8e6906a0b9d28211a83c6720dfe68f0ea58589d5"
      }
    }
  ],
  "recurrences": 0,
  "reviews": [
    {
      "id": "e55a41f8-b81d-4568-803d-bebe2eef5966",
      "requestDigest": "1eb80556e9b6e546b87b83bcfd0ba77d1c242957ae8687d6540fe7abb045d8f3",
      "date": "2026-11-10",
      "decision": "edit",
      "source": "agent review: lesson curation in the landing of #287; codex child host default/high\n\nEdit under the reviewer rules before approval. The retained hc output observes the fixture shell as foreground, and the child report observes a missing board card and a passing case after -ic. Preserve that incident verbatim, attribute the repaired-run claim, and label the process-group mechanism as inference because the excerpt does not show the repaired group. Replace the single foreground read with a bounded poll so the rule agrees with the active read-hc-foreground-until-it-settles lesson. No active lesson states the same shell job-control rule: check-retained-verification-fixtures-against-current-boundaries concerns reuse and permitted topology, while this rule applies to any fixture login shell used by a foreground-based check. It states applicability, action, and an observable positive-control check. It agrees with AGENTS.md, runtime-verification, verification-recipes, and test-behavior-not-implementation, and grants no real host change or additional permission. Structural reconciliation remains proposed.",
      "related": [
        "give-a-fixture-login-shell-the-job-control-of-the-real-tab-shell"
      ],
      "followUp": {
        "state": "proposed",
        "detail": "Compare a reused terminal fixture’s process group and job-control behavior with the real login shell in the fixture topology review. A shared fixture change or an instruction edit needs separate authorization."
      }
    }
  ]
}
---
# Give a fixture login shell the job control of the real tab shell

## What happened

The fixture S of #252 reused the fixture `SHELL` of the retained #262 harness. That shell ran the tab command of `-lic` as `exec /bin/sh -c "$script"`. In probe case o12, `hc get` of the coordinator tab reported the shell as the foreground (`"foreground":{"argv":["/bin/sh","-c",…]}`), and the board showed no Coordinator card. The child reported that the case passed after the fixture changed to `/bin/sh -ic` (Task 2 report, incident `8213DA77-DD4C-4D93-8F9E-C55718DAB92E`). The retained excerpt establishes the shell foreground on the failed run; it does not independently show the process group of the repaired run.

## Root cause

Inference: the #262 harness had no case that reads the foreground of a session tab, so its shell never needed job control. Inferred mechanism: the real interactive login shell gives the command a process group of its own, while the fixture did not provide the same job control. Unresolved: whether the existing lesson `check-retained-verification-fixtures-against-current-boundaries` was applied late or does not name this part of the topology.

## Fix

The #252 child reported changing the fixture shell to run the command with `-ic`. Proposed reconciliation, for a separate review: add the process group of the fixture login shell to the topology that `check-retained-verification-fixtures-against-current-boundaries` compares. No enforcement is proven. The rule stays text, because which facts of a shell a scenario reads needs judgment.

## Detection signature

`hc get` of a fixture tab shows the fixture shell, not the started program, as `foreground`; a board card or another foreground-based oracle is missing.

## Rule

Applies when a check starts a program in a terminal through a fixture `SHELL` that replaces the login shell of the user, and a scenario reads the foreground process, the process group, or a board card of that terminal. Action: make the fixture shell start the command as the real interactive shell does (with job control, so that the command leads the foreground process group), and check `foreground` of a fresh control tab before the first scenario. Because that read can lag a job change, poll until the expected program appears or a bounded limit passes, as in `read-hc-foreground-until-it-settles`. Check: the control tab of the fixture shows the started program, not the shell, as the foreground, and that answer is kept as evidence.

## Related lessons

[[check-retained-verification-fixtures-against-current-boundaries]]
[[read-hc-foreground-until-it-settles]]
