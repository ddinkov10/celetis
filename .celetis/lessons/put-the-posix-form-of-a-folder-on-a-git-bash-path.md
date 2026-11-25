---
{
  "schema": 1,
  "name": "put-the-posix-form-of-a-folder-on-a-git-bash-path",
  "description": "A Windows probe in Git Bash put C:/... first on PATH, the drive colon split the entry, and the real program ran in place of the shim or fake: the installed engine in #358, the real gh and hc in #359 after a brief without this rule, and one real gh read in #368 before the command -v check",
  "tags": [
    "platform-quirk",
    "test",
    "process",
    "recurring"
  ],
  "date": "2026-11-22",
  "status": "active",
  "source": "The implement session of #368 on Claude Code, Verify phase, key check renewal child (verify-keys-report.md), 2026-11-25\n\nThe build of #359, Task 3: the report of the implementer child and the dispatch brief of the controller.\n\nThe implement session of #358 on Claude Code, Verify phase (verify-a and verify-c runs), 2026-11-22",
  "incidents": [
    {
      "id": "6b1f4e2a-3c8d-4f7a-9e51-368000000101",
      "date": "2026-11-25",
      "action": "The key check child of the Verify phase set PATH=\"${PX}/fixture-bin:$PATH\" with the probe folder in its C:/ form inside the quote marks, and ran gh api x before any check of command -v gh.",
      "expected": "gh resolves to the fixture fake before the first command of the check, and no call reaches the real GitHub CLI.",
      "observed": "One read gh api x (GET, 404) reached the real GitHub CLI before the boards started. The child then used PATH=/c/...:$PATH, confirmed command -v gh, and only then started the boards.",
      "source": {
        "kind": "tool-output",
        "excerpt": "A first command in this run, PATH=\"${PX}/fixture-bin:$PATH\" quoted inside the quote marks, put the real gh first: one read gh api x (GET, 404) reached the real GitHub CLI before the boards started. No write, no issue read.",
        "reference": "issue #368 runtime verification comment (key check section)"
      },
      "inference": "Inferred: the C:/ form split the PATH entry in Git Bash, as the active lesson says. The brief named the lesson file to read; the child read it or not is not shown. The read was a GET with a 404, so no write is likely.",
      "diagnosis": [
        "not-followed"
      ],
      "revision": "90a4a88",
      "brief": "The key check brief of #368 told the child to read .celetis/lessons/put-the-posix-form-of-a-folder-on-a-git-bash-path.md in the lane.",
      "lesson": {
        "name": "put-the-posix-form-of-a-folder-on-a-git-bash-path",
        "revision": "90a4a88",
        "digest": "be9cde5e964b31da2d28c4e8c28d6ef579055b7ddb914d5d5ef345342149c2ad"
      }
    },
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
  "recurrences": 2,
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
    },
    {
      "id": "f05cf597-1b13-4e79-9330-5bd9ac6bdf43",
      "requestDigest": "c76b05b2cea010b591ee1a24fc5a123f9ac8afb115d8b44fd132913972286662",
      "date": "2026-11-25",
      "decision": "merge",
      "source": "agent review: lesson curation in the landing of #368; claude child opus/high\n\nMerge under the reviewer rules. The active lesson put-the-posix-form-of-a-folder-on-a-git-bash-path states the same rule: write the /c/ form, and stop before the first request when command -v of a fake prints a path outside the fixture folder. The proposal confirm-each-fake-before-the-first-command-of-a-fixture-shell has a new incident of that rule, observed in tool output of the #368 Verify phase: one gh api read reached the real GitHub CLI before the check. The survivor keeps every incident, source, and prior review, adds the #368 case, and states that the check comes before the first command that a fake replaces, also a read. Whether the child read the lesson stays unknown, and the cause stays labeled as inference. It widens no permission, weakens no check, and adds no network or credential act.",
      "related": [
        "confirm-each-fake-before-the-first-command-of-a-fixture-shell",
        "put-the-posix-form-of-a-folder-on-a-git-bash-path"
      ],
      "followUp": {
        "state": "proposed",
        "detail": "A shared fixture start script that checks command -v of each fake and exits before any other command when a fake resolves outside its folder. This structural work needs separate authorization; this review changes lesson data only."
      }
    }
  ]
}
---
# Put the POSIX form of a folder on a Git Bash PATH

## What happened

Two Verify runs of #358 on Windows put a scratch `celetis` shim first on `PATH` in Git Bash with the form `C:/...`. In each run the installed engine ran in place of the shim: `command -v celetis` printed `/c/Users/ddink/.local/bin/celetis`, and a Claude Code init event listed 61 tools, six of them `dispatch_*`, against 55 with the `/c/...` form. Both runs found it and ran again.

In the build of #359, the controller briefed the Task 3 child to serve the board with a fake `gh` first on `PATH`. The brief did not carry this rule. The child used a `C:/` entry. For three probe rounds `command -v` resolved `gh` and `hc` to the real programs, and the fake call log did not exist. With `cygpath -u`, both resolved to the fixture folder, and the log recorded `gh` 4 times and `hc` 18 times. The calls of the three rounds have no log.

In the Verify phase of #368, the brief of the key check child named this lesson. The child set `PATH="${PX}/fixture-bin:$PATH"` with the probe folder in its `C:/` form, and ran `gh api x` before any `command -v gh`. That one read reached the real GitHub CLI (GET, 404). The child then used the `/c/` form, confirmed `command -v gh`, and only then started the boards.

## Root cause

Inference: Git Bash splits `PATH` at each colon, so the drive colon of `C:/x` breaks the entry. Uncertain whether MSYS converts some such entries.

In #359, inference: the rule existed but did not reach the child, because the lesson selection of the plan covered the UI rules of the task, and the controller added the fixture instruction at dispatch with no search for a fixture rule. Uncertain: a child with the rule could still skip its check. No issue of the repository changed in that window, so a write through the real `gh` is unlikely, but it is not excluded for a branch that only a real answer reaches.

In #368, inference: the child ran a command before the check that this rule requires. Not known: whether the child read the lesson before that command. The read was a GET with a 404, so a write is unlikely.

## Fix

Proposed, not enforced: write a folder on a Git Bash `PATH` in its POSIX form (`/c/...`, or `cygpath -u`), and check the resolved command before a run counts. The rule stays text, because the shim and the probe are scratch files.

Proposed after #359, not enforced: a brief that tells a child to put a fake or a shim on `PATH` carries this rule, and the child prints `command -v` of each fake before the first request. A structural follow-up is a shared fixture helper that refuses to start when a fake resolves outside its folder. It needs separate authorization.

## Rule

Applies when a check on Windows in Git Bash puts a folder on `PATH` so that a command resolves to a shim, a fake, or a fixture binary, and when a brief or a dispatch tells a child to do so. Action: write the folder in its POSIX form (`/c/...`, or the output of `cygpath -u`), never `C:/...` or `C:\...`. A brief carries this rule. Before the first command that a fake replaces, also a read, run `command -v` of each fake, and stop when it prints a path outside the fixture folder. Check: `command -v <command>` prints the shim path before the first command that the fake replaces, and the evidence shows no call of the real program, for a Claude Code run the init event shows the tool set of the intended engine, and a brief that puts a fake on `PATH` names this rule.
