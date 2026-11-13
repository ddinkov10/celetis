---
{
  "schema": 1,
  "name": "name-an-evidence-folder-that-a-worktree-isolated-child-can-write",
  "description": "A fix brief named an evidence folder in the main checkout that the worktree-isolated child could not write",
  "tags": [
    "process",
    "git"
  ],
  "date": "2026-11-13",
  "status": "active",
  "source": "The implement session of #288 on Claude Code, the final-review fix wave, 2026-11-13",
  "incidents": [
    {
      "id": "cec71884-2a6e-4a2b-b229-c7f852972d62",
      "date": "2026-11-13",
      "action": "The coordinator session wrote a fix brief whose \"Done means\" names the evidence folder /Users/dinq/Dinq/PROJECTS/celetis/docs/superpowers/verification/288-final-fix/ in the main checkout, for a child that runs isolated in the lane worktree.",
      "expected": "The child writes all its evidence at the path that the brief names, and the evidence survives the removal of the lane worktree at the landing.",
      "observed": "The file tool of the child refused the main-checkout path; the child put the whole evidence in the ignored folder of the lane worktree, and only a partial cp copy reached the main checkout.",
      "source": {
        "kind": "tool-output",
        "excerpt": "This session is isolated in the worktree /Users/dinq/Dinq/PROJECTS/celetis/.claude/worktrees/288-manage-the-coordinator-from. Edit the worktree copy of this file instead of the shared-checkout path."
      },
      "inference": "The coordinator copied the evidence location of the plan (the main checkout) into the brief without checking that a worktree-isolated child can write there. Earlier children of the same build wrote there through the shell; whether the file tool refused them too is not known. Alternative: the isolation guard of the host changed during the session.",
      "diagnosis": [
        "unknown"
      ],
      "revision": "fe9856707ec6656a107da50ea7ace841fd6f1ad3"
    }
  ],
  "recurrences": 0,
  "reviews": [
    {
      "id": "040bba04-f42c-4398-8e13-ded8ab067660",
      "requestDigest": "8ca8e089487f95a613fb2b111abc491574e48aad95766153954b358ce41fa726",
      "date": "2026-11-13",
      "decision": "approve",
      "source": "agent review: lesson curation in the landing of #288; claude child opus/high\n\nApprove, under the reviewer rules: the proposal has observed evidence (the refusal line of the file tool of the worktree-isolated child), keeps the inferred cause apart from the facts, states applicability, action, and check, widens no permission, and agrees with the runtime-verification procedure (record the evidence path before execution and preserve it through cleanup). The active lesson give-browser-tool-output-files-a-path-outside-the-lane states a different rule (the path of a browser output file) and holds no incident of this proposal.",
      "related": [
        "name-an-evidence-folder-that-a-worktree-isolated-child-can-write"
      ],
      "followUp": {
        "state": "proposed",
        "detail": "The proposal names a structural follow-up that needs a separate authorization: the plan template of celetis:plan could name the evidence folder relative to the lane."
      }
    }
  ]
}
---
# Name an evidence folder that a worktree-isolated child can write

## What happened

In the implement session of #288, the coordinator wrote the fix brief of the final-review fix wave. Its "Done means" named the evidence folder `docs/superpowers/verification/288-final-fix/` of the main checkout. The child ran isolated in the lane worktree. Its file tool refused the main-checkout path with the line "This session is isolated in the worktree ... Edit the worktree copy of this file instead of the shared-checkout path." The child kept the whole evidence in the ignored copy of that folder in the lane, and only an early partial `cp` copy reached the main checkout. The lane worktree goes at the landing, so the evidence was at risk until the coordinator copied it out.

## Root cause

Inferred: the coordinator took the evidence location from the plan and did not check it against the write boundary of the child. Uncertain: earlier children of the same build wrote to the main checkout through the shell, and it is not known whether the file tool refused them too.

## Fix

Proposed prevention, not enforced: a brief for a worktree-isolated child names an evidence folder inside the lane that git ignores, and the coordinator copies it to the durable location before the lane worktree goes. A structural follow-up would need a separate authorization: the plan template of `celetis:plan` could name the evidence folder relative to the lane. The rule stays text, because the write boundary depends on the host and its isolation mode.

## Rule

Applies when a coordinator session writes a brief that names a folder for files that a child writes (evidence, probe output, screenshots), and the child runs isolated in a worktree. Action: name a folder inside the child's worktree that git ignores, or a scratch folder that the host lets the child write; before the worktree goes, copy that folder to the durable location and confirm the copy. Check: the child writes every evidence file at the named path with its normal tools, and after the landing the durable location holds the complete folder.

## Related lessons

[[give-browser-tool-output-files-a-path-outside-the-lane]]
