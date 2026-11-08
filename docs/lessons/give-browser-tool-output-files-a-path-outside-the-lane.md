---
{
  "schema": 1,
  "name": "give-browser-tool-output-files-a-path-outside-the-lane",
  "description": "A Playwright screenshot with a relative file name landed in the lane checkout root during a Verify run",
  "tags": [
    "e2e",
    "git",
    "process"
  ],
  "date": "2026-11-08",
  "status": "active",
  "source": "Verify phase of ddinkov10/celetis#255, part C (lab)",
  "incidents": [
    {
      "id": "ee594a27-ef19-4d8d-82e2-fb56d552ed9a",
      "date": "2026-11-08",
      "action": "A Verify child of #255 took a Playwright browser screenshot with a relative file name (c255-base-1440.png) while the session worked from the lane checkout.",
      "expected": "No file appears in the lane checkout: the lane must stay clean for the gate, the reviews, and `land`, which refuses a dirty lane worktree.",
      "observed": "`git status --porcelain` of the lane showed `?? c255-base-1440.png` in the lane root for about one minute until the child moved the file out; a `.playwright-mcp/` folder also appeared there and was removed. No lane check ran in that minute.",
      "source": {
        "kind": "tool-output",
        "excerpt": "?? c255-base-1440.png (lane root, f2cf38f)",
        "reference": "ddinkov10/celetis#255 Verify part C report"
      },
      "inference": "Reported by the child, cause inferred: the Playwright server resolves a relative screenshot path against the working folder of the session (the lane checkout) and refuses paths outside it. Uncertain: whether an absolute path in an allowed folder works on this host. Alternative: a session setting of the browser tool.",
      "diagnosis": [
        "unknown"
      ],
      "revision": "f2cf38f6a60110b2b9774c6cccde8b53821346db"
    }
  ],
  "recurrences": 0,
  "reviews": [
    {
      "id": "d5d5b8c4-8d1f-48cf-8fe4-398ab90dceaf",
      "requestDigest": "dc6466fc46188b6bbdaca89badfe44e850288ae1254bbca4494e9a86db220faa",
      "date": "2026-11-08",
      "decision": "approve",
      "source": "agent review: lesson curation in the landing of #255; claude child opus/high\n\nApprove under the reviewer rules: the lane status line (?? c255-base-1440.png in the lane root) establishes the incident, and the root cause is labeled as inference with its uncertainty. The rule states applicability, action, and check, grants no permission, adds no network or credential act, and weakens no check. It agrees with the project instructions: .gitignore of this repository ignores .playwright-mcp/, and the design procedure already removes the untracked .playwright-mcp/ output files. No active lesson states the same rule; write-browser-observations-once-after-all-reads covers the completion of an observation file, not its location.",
      "related": [
        "give-browser-tool-output-files-a-path-outside-the-lane"
      ],
      "followUp": {
        "state": "proposed",
        "detail": "Proposed in the incident, not authorized: the gate or land could name an untracked browser output file in its refusal line. It needs a separate authorization and check."
      }
    }
  ]
}
---
# Give browser tool output files a path outside the lane

## What happened

Tool output: in the Verify phase of #255, a child took a Playwright screenshot with a relative file name while its session worked from the lane checkout. The file and a `.playwright-mcp/` folder appeared in the lane root (`?? c255-base-1440.png`) for about one minute, until the child moved them out.

## Root cause

Inferred from the child's report: the browser tool resolves a relative output path against the session's working folder and refuses a path outside it. Uncertain: which absolute folders the tool allows on this host.

## Fix

Proposed prevention, not proven enforcement: a check that writes browser output files names each file so that it lands outside the lane, or in a folder that Git ignores, and moves it to the evidence folder after the read; it confirms `git status --porcelain` of the lane after each write. A structural follow-up needs separate authorization: the gate or `land` could name an untracked browser file in its refusal line. The right folder depends on the tool session, so the rule stays text.

## Rule

Applies when a check takes browser screenshots or other tool output files during lane work. Action: give each output file a path outside the lane or in an ignored folder, move it to the evidence folder, and check the lane status after each write. Check: `git status --porcelain` of the lane is empty after each browser write.

## Related lessons

[[write-browser-observations-once-after-all-reads]]
