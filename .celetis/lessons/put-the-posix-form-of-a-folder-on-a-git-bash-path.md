---
{
  "schema": 1,
  "name": "put-the-posix-form-of-a-folder-on-a-git-bash-path",
  "description": "A Windows probe in Git Bash put C:/... first on PATH, the drive colon split the entry, and the real program ran in place of the shim or fake: the installed engine in #358, and the real gh and hc in #359 after a brief without this rule",
  "tags": [
    "platform-quirk",
    "test",
    "process",
    "recurring"
  ],
  "date": "2026-11-22",
  "status": "active",
  "source": "The build of #359, Task 3: the report of the implementer child and the dispatch brief of the controller.\n\nThe implement session of #358 on Claude Code, Verify phase (verify-a and verify-c runs), 2026-11-22",
  "incidents": [
    {
      "id": "7f3c2a54-9b1e-4d6a-8c21-359003000001",
      "date": "2026-11-22",
      "action": "The controller briefed a child to serve the board with a fake gh first on PATH and carried no path-form rule. The child started the fixture boards with PATH=${FX}/bin:\"$PATH\", where FX is a C:/ path, in Git Bash.",
      "expected": "gh and hc resolve to the fakes, and no call of the check reaches the real GitHub CLI or the core of the maintainer.",
      "observed": "command -v gave /c/Program Files/GitHub CLI/gh and /c/Users/ddink/AppData/Local/Programs/herdr-core/hc, and calls.log did not exist after three probe rounds. With cygpath -u both resolve to fixture/bin, and calls.log records gh 4 and hc 18.",
      "source": {
        "kind": "tool-output",
        "excerpt": "command -v: /c/Program Files/GitHub CLI/gh; /c/Users/ddink/AppData/Local/Programs/herdr-core/hc; calls.log absent after three probe rounds",
        "reference": "issue #359, Task 3 report"
      },
      "inference": "Inferred: the drive colon splits the PATH entry in Git Bash, as the active lesson says. The calls of the three rounds have no log. The same flow with the fakes logged only gh api reads, plugin list reads, and hc ls, and no issue of the repository changed in that window, so a write is unlikely but not excluded for a branch that only a real answer reaches.",
      "diagnosis": [
        "not-retrieved"
      ],
      "revision": "37f7b2226a1fdf604b23210200aa1a89344e5139",
      "brief": "The Task 3 brief said: with a fake gh first on PATH. It did not carry the rule of put-the-posix-form-of-a-folder-on-a-git-bash-path.",
      "lesson": {
        "name": "put-the-posix-form-of-a-folder-on-a-git-bash-path",
        "revision": "37f7b2226a1fdf604b23210200aa1a89344e5139",
        "digest": "20fe18e005efaeb4bb2553ec4c765903925e6c66a9004961c9f6e596f1ff85a2"
      }
    },
    {
      "id": "ac4b8618-361c-44b3-b5f2-5e7a22751b54",
      "date": "2026-11-22",
      "action": "A Verify probe in Git Bash ran export PATH=C:/Users/.../verify-c/shim:$PATH, then celetis --agent claude dispatch next ... with a private TEMP.",
      "expected": "command -v celetis resolves to the scratch shim, so the checkout engine runs.",
      "observed": "command -v celetis printed /c/Users/ddink/.local/bin/celetis; the installed engine ran and wrote a dispatch record in the private TEMP. A sibling run (V9 control) showed the same: with C:/... on PATH the claude init event listed 61 tools with six dispatch_* (the installed engine), with /c/... it listed 55.",
      "source": {
        "kind": "tool-output",
        "excerpt": "command -v celetis -> /c/Users/ddink/.local/bin/celetis (C:/ form); init event 61 tools vs 55 with the /c/ form",
        "reference": "https://github.com/ddinkov10/celetis/issues/358"
      },
      "inference": "Git Bash splits PATH at each colon, so C:/x becomes the entries C and /x. Uncertain whether MSYS converts some C:/ entries; the two runs did not.",
      "diagnosis": [
        "unknown"
      ],
      "revision": "240961ab301d60d4f57370204284fc98e10fd872"
    }
  ],
  "recurrences": 1,
  "reviews": [
    {
      "id": "5818d1a6-95ea-4a92-b7d6-6220f1a56700",
      "requestDigest": "26a184a13bd6bd7b0f9c6ba58a5f706e31ea663d41647161ad387efc3c9b1916",
      "date": "2026-11-22",
      "decision": "approve",
      "source": "agent review: lesson curation in the landing of #358; claude child opus/high\n\nApprove under the reviewer rules. The proposal has observed tool output from two Verify runs of #358: with a C:/ folder first on PATH in Git Bash, command -v celetis printed the installed engine, and the init event listed 61 tools against 55 with the /c/ form. A reviewer probe in Git Bash on this machine reproduced it: a scratch shim folder in the C:/ form on PATH gave no match for the command, and its cygpath -u form resolved it. The rule states applicability, action, and check, widens no permission, weakens no check, and adds no network or credential act. The active lesson pass-a-slash-text-to-a-windows-lab-probe-through-a-file covers MSYS argument conversion, a different rule, so no merge applies. No live or historical lesson holds the incident.",
      "related": [
        "put-the-posix-form-of-a-folder-on-a-git-bash-path"
      ],
      "followUp": {
        "state": "not-needed",
        "detail": "The rule stays text: the shim and the probe are scratch files that no gate runs. This review changes lesson data only."
      }
    },
    {
      "id": "2d2bca71-0489-43ea-917c-28417dc15aee",
      "requestDigest": "a937f38e63e2da577bfd51101d90ddba0fb2cf3a78f0ccba3b566e104e2715da",
      "date": "2026-11-23",
      "decision": "merge",
      "source": "agent review: lesson curation in the landing of #359; claude child opus/high\n\nMerge under the reviewer rules. The active lesson put-the-posix-form-of-a-folder-on-a-git-bash-path states the same rule, and the incident of #359 is a new case of it that its own lesson field names. The survivor keeps both incidents and adds the part that the proposal adds: a brief that puts a fake on PATH carries the rule, and the child stops when command -v resolves outside the fixture folder. The inference on a possible write through the real gh stays uncertain.",
      "related": [
        "carry-the-path-form-rule-to-each-child-that-puts-a-fake-on-path",
        "put-the-posix-form-of-a-folder-on-a-git-bash-path"
      ],
      "followUp": {
        "state": "proposed",
        "detail": "A shared fixture helper can refuse to start when a fake resolves outside its folder. This needs separate authorization."
      }
    }
  ]
}
---
# Put the POSIX form of a folder on a Git Bash PATH

## What happened

Two Verify runs of #358 on Windows put a scratch `celetis` shim first on `PATH` in Git Bash with the form `C:/...`. In each run the installed engine ran in place of the shim: `command -v celetis` printed `/c/Users/ddink/.local/bin/celetis`, and a Claude Code init event listed 61 tools, six of them `dispatch_*`, against 55 with the `/c/...` form. Both runs found it and ran again.

In the build of #359, the controller briefed the Task 3 child to serve the board with a fake `gh` first on `PATH`. The brief did not carry this rule. The child used a `C:/` entry. For three probe rounds `command -v` resolved `gh` and `hc` to the real programs, and the fake call log did not exist. With `cygpath -u`, both resolved to the fixture folder, and the log recorded `gh` 4 times and `hc` 18 times. The calls of the three rounds have no log.

## Root cause

Inference: Git Bash splits `PATH` at each colon, so the drive colon of `C:/x` breaks the entry. Uncertain whether MSYS converts some such entries.

In #359, inference: the rule existed but did not reach the child, because the lesson selection of the plan covered the UI rules of the task, and the controller added the fixture instruction at dispatch with no search for a fixture rule. Uncertain: a child with the rule could still skip its check. No issue of the repository changed in that window, so a write through the real `gh` is unlikely, but it is not excluded for a branch that only a real answer reaches.

## Fix

Proposed, not enforced: write a folder on a Git Bash `PATH` in its POSIX form (`/c/...`, or `cygpath -u`), and check the resolved command before a run counts. The rule stays text, because the shim and the probe are scratch files.

Proposed after #359, not enforced: a brief that tells a child to put a fake or a shim on `PATH` carries this rule, and the child prints `command -v` of each fake before the first request. A structural follow-up is a shared fixture helper that refuses to start when a fake resolves outside its folder. It needs separate authorization.

## Rule

Applies when a check on Windows in Git Bash puts a folder on `PATH` so that a command resolves to a shim, a fake, or a fixture binary, and when a brief or a dispatch tells a child to do so. Action: write the folder in its POSIX form (`/c/...`, or the output of `cygpath -u`), never `C:/...` or `C:\...`. A brief carries this rule, and requires the child to stop before the first request when `command -v` of a fake prints a path outside the fixture folder. Check: `command -v <command>` prints the shim path before the first counted run, for a Claude Code run the init event shows the tool set of the intended engine, and a brief that puts a fake on `PATH` names this rule.
