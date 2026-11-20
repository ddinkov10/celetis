---
{
  "schema": 1,
  "name": "print-the-folder-a-simulated-platform-command-makes",
  "description": "A probe of #348 simulated the shared Linux /tmp with TMPDIR on macOS, but macOS mktemp -d with no template ignored TMPDIR, so three RED runs were false negatives",
  "tags": [
    "test",
    "platform-quirk",
    "false-negative"
  ],
  "date": "2026-11-20",
  "status": "active",
  "source": "The implement session of #348 on Claude Code, Task 7 repair round 1 report (T7-R1-mktemp), 2026-11-20",
  "incidents": [
    {
      "id": "T7-R1-mktemp",
      "date": "2026-11-20",
      "action": "The RED probe of the Task 7 repair of #348 simulated the shared Linux /tmp by setting TMPDIR to a planted shared folder and running the README First install command with the macOS mktemp.",
      "expected": "The clone of the command goes into the simulated shared folder, so the RED run exercises the planted ancestor node_modules and workspace files.",
      "observed": "`TMPDIR=<shared>/ mktemp -d` on macOS printed `/var/folders/…/T/tmp.HkGWCzTIg1`: with no template, /usr/bin/mktemp ignored TMPDIR. Three RED runs therefore passed where the command was exposed. The fixer put GNU mktemp first on PATH, and the RED run then failed as expected.",
      "source": {
        "kind": "tool-output",
        "excerpt": "TMPDIR=<shared>/ mktemp -d printed /var/folders/…/T/tmp.HkGWCzTIg1; three RED runs gave false negatives",
        "reference": "https://github.com/ddinkov10/celetis/issues/348"
      },
      "inference": "Uncertain cause: macOS mktemp with no template uses the Darwin per-user temporary folder (confstr), not TMPDIR. Alternative: a version difference of the BSD mktemp; only macOS 26 was observed.",
      "diagnosis": [
        "unknown"
      ],
      "revision": "14c956a"
    }
  ],
  "recurrences": 0,
  "reviews": [
    {
      "id": "ec899cb1-5612-4d07-8fcb-eb8c9664c488",
      "requestDigest": "ec8b8f79f6f582ccc9d3b0e930d285c2acf31e9b2fddaecde1d9e09b8f797af0",
      "date": "2026-11-20",
      "decision": "approve",
      "source": "agent review: lesson curation in the landing of #348; claude child opus/high\n\nApprove under the reviewer rules. The incident is observed: the retained excerpt shows that `TMPDIR=<shared>/ mktemp -d` on macOS printed a folder in /var/folders/…/T/, and the review reproduced it on this machine (TMPDIR set to a scratch folder, /usr/bin/mktemp -d printed /var/folders/p2/…/T/tmp.gqsPQEQZE7). It is not a new requirement and not a bare tool error: the false RED passes are the incident. The rule states applicability (a probe that simulates a platform behavior on another platform), action (print the value of the simulated part through the same command before the first case, and stop when it differs), and check (the evidence shows that value inside the simulated location before the first RED run). No active or historical lesson states this rule: give-a-probe-a-private-home-before-a-case-unsets-a-home-variable and confirm-native-plugin-cache-after-source-pins check a home or a cache selection, not a simulated platform value. The rule widens no permission, weakens no check, and contradicts no project instruction, skill, or principle; it adds a check before a RED run. The text keeps the observed facts apart from the inferred cause, so no edit is needed.",
      "related": [
        "print-the-folder-a-simulated-platform-command-makes"
      ],
      "followUp": {
        "state": "not-needed",
        "detail": "The proposal proposes no structural check: each probe simulates a different part of a platform, so which value proves the simulation is a judgment of the probe."
      }
    }
  ]
}
---
# Print the folder that a simulated platform command makes

## What happened

A probe of #348 simulated the shared Linux `/tmp` on macOS by setting `TMPDIR` to a planted shared folder. The macOS `mktemp -d` with no template ignored `TMPDIR` and made a folder in the per-user `/var/folders/…/T/`. Three RED runs passed although the command under test was exposed. With GNU `mktemp` first on `PATH`, the RED run failed as expected.

## Root cause

Inference: on macOS, `mktemp` with no template uses the Darwin per-user temporary folder, not `TMPDIR`. The probe did not check that its simulation took effect before the first case.

## Fix

Proposed prevention (text): a probe that simulates the behavior of another platform first prints the value that the simulated part gives (for example the folder that `mktemp` makes) and refuses to go on when it differs from the simulated value. No structural follow-up is proposed: each probe simulates a different part, so the rule stays text.

## Detection signature

A RED case passes on a command that the review says is exposed, and the folder of the command is outside the simulated location.

## Rule

Applies when a probe simulates a platform behavior (a shared temporary folder, a home variable, a path separator) on another platform. Action: before the first case, print the value that the simulated part gives through the same command that the case runs, and stop when it is not the simulated value. Check: the evidence shows the printed value inside the simulated location before the first RED run.

## Related lessons

[[give-a-probe-a-private-home-before-a-case-unsets-a-home-variable]]
