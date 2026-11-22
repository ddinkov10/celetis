---
{
  "schema": 1,
  "name": "put-the-posix-form-of-a-folder-on-a-git-bash-path",
  "description": "A Windows probe in Git Bash put C:/... first on PATH, the drive colon split the entry, and the installed engine ran in place of the checkout shim",
  "tags": [
    "platform-quirk",
    "test",
    "process",
    "recurring"
  ],
  "date": "2026-11-22",
  "status": "active",
  "source": "The implement session of #358 on Claude Code, Verify phase (verify-a and verify-c runs), 2026-11-22",
  "incidents": [
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
  "recurrences": 0,
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
    }
  ]
}
---
# Put the POSIX form of a folder on a Git Bash PATH

## What happened

Two Verify runs of #358 on Windows put a scratch `celetis` shim first on `PATH` in Git Bash with the form `C:/...`. In each run the installed engine ran in place of the shim: `command -v celetis` printed `/c/Users/ddink/.local/bin/celetis`, and a Claude Code init event listed 61 tools, six of them `dispatch_*`, against 55 with the `/c/...` form. Both runs found it and ran again.

## Root cause

Inference: Git Bash splits `PATH` at each colon, so the drive colon of `C:/x` breaks the entry. Uncertain whether MSYS converts some such entries.

## Fix

Proposed, not enforced: write a folder on a Git Bash `PATH` in its POSIX form (`/c/...`, or `cygpath -u`), and check the resolved command before a run counts. The rule stays text, because the shim and the probe are scratch files.

## Rule

Applies when a check on Windows in Git Bash puts a folder on `PATH` so that a command resolves to a shim or a fixture binary. Action: write the folder in its POSIX form (`/c/...`, or the output of `cygpath -u`), never `C:/...` or `C:\...`. Check: `command -v <command>` prints the shim path before the first counted run, and for a Claude Code run the init event shows the tool set of the intended engine.
