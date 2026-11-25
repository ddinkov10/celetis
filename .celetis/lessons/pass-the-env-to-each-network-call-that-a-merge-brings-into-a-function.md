---
{
  "schema": 1,
  "name": "pass-the-env-to-each-network-call-that-a-merge-brings-into-a-function",
  "description": "A trunk merge brought a network call into removeLane, and the resolution did not pass the unattended env to it",
  "tags": [
    "git",
    "false-negative",
    "regression",
    "process"
  ],
  "date": "2026-11-25",
  "status": "active",
  "source": "implement session of #381 (coordinator), claude",
  "incidents": [
    {
      "id": "381-merge-callee-env",
      "date": "2026-11-25",
      "action": "The controller resolved a trunk merge (bb39a5c) by joining the signature of removeLane: a new env parameter from the lane and a new return type from the trunk. The trunk version of removeLane had gained a network call, deleteRemoteBranches (git push --delete, ls-remote). The resolution did not pass env to it.",
      "expected": "Each Git network call that the Discard press reaches runs with the unattended environment: GIT_TERMINAL_PROMPT=0, GCM_INTERACTIVE=false, an empty GIT_ASKPASS, and SSH_ASKPASS_REQUIRE=never.",
      "observed": "Task 3 review, demonstrated: with a logging credential helper and askpass and a push URL that answers 401, the helper saw GCM_INTERACTIVE= twice and the askpass program ran.",
      "source": {
        "kind": "tool-output",
        "excerpt": "logging credential helper: GCM_INTERACTIVE= (twice); askpass program ran; push URL answered 401."
      },
      "inference": "Inferred, not established: a signature merge keeps each side whole, so the callee that only the trunk side added had no env at its call site. Uncertain: whether the controller held the rule text at the merge step, because the lesson was in the brief of Task 3 and not shown in the merge step. Alternative: the stored rule names code that \"runs a Git network command\" and does not name a merge that adds such a call to a function that takes env.",
      "diagnosis": [
        "not-followed"
      ],
      "revision": "bb39a5c, 441e55b",
      "brief": "The brief of Task 3 carried close-each-prompt-path-of-an-unattended-git-call (digest 74ef80b5...). Its Action: set GIT_TERMINAL_PROMPT=0, GCM_INTERACTIVE=false, an empty GIT_ASKPASS, and SSH_ASKPASS_REQUIRE=never; its Check uses a logging helper and askpass against a 401 server.",
      "lesson": {
        "name": "close-each-prompt-path-of-an-unattended-git-call",
        "revision": "2026-11-23",
        "digest": "74ef80b5dc5fd161443ea8095ce79376f57c4bdc680c828ee8f1497299790851"
      }
    }
  ],
  "recurrences": 0,
  "reviews": [
    {
      "id": "9920b629-a868-4c38-a409-b3b25b06e921",
      "requestDigest": "c55421e77e354ae407866dce5a9f7274fd6b436a8daa9450ab1aaa25ccd6240f",
      "date": "2026-11-25",
      "decision": "approve",
      "source": "agent review: lesson curation in the landing of #381; claude child opus/high\n\nApprove (reviewer rules): the proposal has observed tool-output evidence (a logging credential helper saw GCM_INTERACTIVE= twice, and the askpass program ran against a push URL that answered 401). Its rule states applicability (a merge or rebase resolution that joins a function that now takes a lane value, while the other side added a call in it), action (list each call of the other side in the merged body and pass the value to each call that needs it), and check (the credential probe runs against the merged function). The active lesson close-each-prompt-path-of-an-unattended-git-call states which variables an unattended Git call sets, and set-a-value-on-every-path-that-reaches-its-reader states a setter and reader rule; neither states this merge-resolution step, so this is not a duplicate. The rule agrees with \"A conflict with the trunk\" of the worktree procedure (keep the behavior of both sides). It widens no permission, weakens no check, and adds no network or credential act. No live or historical lesson holds its incident.",
      "related": [
        "pass-the-env-to-each-network-call-that-a-merge-brings-into-a-function"
      ],
      "followUp": {
        "state": "proposed",
        "detail": "Structural follow-up, which needs separate authorization: one shared unattended environment for each Git network call of the engine, with a check that rejects a call without it (also proposed by close-each-prompt-path-of-an-unattended-git-call)."
      }
    }
  ]
}
---
# Pass the env to each network call that a merge brings into a function

## What happened

In #381, the controller resolved a trunk merge (bb39a5c) by joining the signature of `removeLane`: the lane added an `env` parameter, and the trunk changed the return type. The trunk version of `removeLane` had also gained a network call, `deleteRemoteBranches` (`git push --delete`, `ls-remote`). The resolution did not pass `env` to it, so the unattended environment of the Discard press did not reach that push. The Task 3 review demonstrated it with a logging credential helper and askpass and a push URL that answers 401: the helper saw `GCM_INTERACTIVE=` twice, and the askpass program ran. Fix: 441e55b. The brief of Task 3 carried `close-each-prompt-path-of-an-unattended-git-call` (digest 74ef80b5...).

## Root cause

Observed: the brief carried the rule, and the merged code violated it. Recurrence diagnosis: not-followed. Inferred, not established: a signature merge keeps each side whole, so a callee that only the trunk side added had no `env` at its call site, and nobody read the body of the merged function for new network calls. Uncertain: whether the controller held the rule text at the merge step. Alternative: the rule names code that runs a Git network command, and a reader can miss that a merge adds such a call to a function that already takes `env`.

## Fix

Proposed, not enforced: after a merge that adds a parameter to a function, read the body of the merged function, list each call that the other side added, and pass the new parameter to each one that needs it. Proposed structural follow-up, which needs separate authorization: the shared unattended environment for each Git network call of the engine, which `close-each-prompt-path-of-an-unattended-git-call` already proposes, with a check that rejects a call without it. That check would have rejected `deleteRemoteBranches` with no env. Enforcement is not proven. The rule stays text for the merge step.

## Rule

Applies when a merge or a rebase resolution joins a function that now takes an environment, a context, or another value that the lane adds, and the other side added a call in that function. Action: list each call of the other side in the merged body, and pass the value to each call that needs it, in particular each Git network call that must run unattended. Check: the probe of the credential path (a logging helper and askpass, a 401 push URL) runs against the merged function, and the helper sees `GCM_INTERACTIVE=false` and no askpass runs.

## Related lessons

[[close-each-prompt-path-of-an-unattended-git-call]]
[[set-a-value-on-every-path-that-reaches-its-reader]]
