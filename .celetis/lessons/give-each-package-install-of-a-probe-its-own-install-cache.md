---
{
  "schema": 1,
  "name": "give-each-package-install-of-a-probe-its-own-install-cache",
  "description": "A Verify probe ran its red and green bunx installs of celetis@0.0.2 with one BUN_INSTALL_CACHE_DIR, so the green run reused the base package and never asked the registry for the lane tarball",
  "tags": [
    "test",
    "process"
  ],
  "date": "2026-11-25",
  "status": "active",
  "source": "The implement session of #392 on Claude Code, Verify phase V1, 2026-11-25",
  "incidents": [
    {
      "id": "50d3f71b-4a30-47c0-bc48-7466b066b08e",
      "date": "2026-11-25",
      "action": "V1 of #392 ran `bunx celetis@0.0.2 install` first against a scratch registry that served the base package (the red case), then against the same registry serving the lane package, with the same BUN_INSTALL_CACHE_DIR for both runs; only the bunx cache folder of the temp directory was cleared between them.",
      "expected": "The green run fetches the package document and the lane tarball from the scratch registry and installs the lane engine.",
      "observed": "The green run exited 255 with the base error, the registry log showed one GET /zod and no GET /celetis and no tarball request, and the new .bunx shim still named the program BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 of the base package. A rerun with a new BUN_INSTALL_CACHE_DIR fetched /celetis and /celetis/-/lane-0.0.2.tgz and exited 0.",
      "source": {
        "kind": "tool-output",
        "excerpt": "error: interpreter executable \"BUN_RUNTIME_TRANSPILER_CACHE_PATH=0\" not found in %PATH% ... reg.log: GET /zod (no GET /celetis)"
      },
      "inference": "Inferred: the Bun install cache keeps the manifest and the extracted package of celetis@0.0.2 by name and version, and bunx reused them for a second package with the same name and version. Alternative: a manifest cache time-to-live alone; the observation does not separate the two.",
      "diagnosis": [
        "unknown"
      ],
      "revision": "3ba610e9e5dd87851dde4c2a384b1d565a9c4fa2"
    }
  ],
  "recurrences": 0,
  "reviews": [
    {
      "id": "38c2b8ae-59b7-4ff7-aa9e-01264a290b43",
      "requestDigest": "be72a550950fbe3ebe272b769dca16b3b847b7d74aca0b5fd9a45e25711c327c",
      "date": "2026-11-25",
      "decision": "edit",
      "source": "agent review: lesson curation in the landing of #392; claude child opus/high\n\nEdit under the reviewer rules (approve, edit first when the text needs a correction): the incident has observed tool output (one GET /zod, no tarball request, exit 255; a new cache folder fetched the lane tarball and exited 0), and the rule states applicability, action, and check. It widens no permission, weakens no gate, adds no network or credential act, and no active or historical lesson states the same rule ([[isolate-verification-barriers-per-attempt]] covers barrier files, not package caches). The edit corrects the Root cause only: it adds the alternative cause that the incident inference names (a time-to-live of the cached package document) and keeps the observed facts apart from the inferred cause.",
      "related": [
        "give-each-package-install-of-a-probe-its-own-install-cache"
      ],
      "followUp": {
        "state": "not-needed",
        "detail": "The rule stays text, because the install cache and the registry log are fixture choices of each probe. No structural change is proposed."
      }
    }
  ]
}
---
# Give each package install of a probe its own install cache

## What happened

In V1 of #392, a red bunx install of celetis@0.0.2 from a scratch registry (the base package) and a green install of the same name and version (the lane package) used one BUN_INSTALL_CACHE_DIR. The green run asked the registry for no package document and no tarball, installed the base package again, and exited 255 with the base error. A rerun with a new cache folder fetched the lane tarball and passed.

## Root cause

Inferred, not proven: the Bun install cache keys a package by its name and version, so two different tarballs with one name and version share one cache entry. Unresolved alternative: a time-to-live of the cached package document alone made the green run skip the registry; the observation does not separate the two causes. Observed: the probe cleared only the bunx folder of the temporary directory, not the install cache, and a new install cache folder made the green run fetch the lane tarball.

## Fix

Proposed prevention, not enforced: a probe that installs two packages with the same name and version gives each install its own BUN_INSTALL_CACHE_DIR (or npm cache folder) and checks the registry log for the tarball request of that install. The rule stays text, because the cache and the registry log are fixture choices of each probe.

## Detection signature

A green install of a fixture package shows the old behavior, and the registry log has no request for the tarball of that install.

## Rule

Applies when a probe or a Verify step installs a package from a fixture registry or a fixture tarball with a name and version that an earlier install of the same check, or the real registry, already used. Action: give each install its own new package-manager cache folder (BUN_INSTALL_CACHE_DIR for Bun, npm_config_cache for npm), and clear the bunx or npx folder of that name and version that an earlier run made. Check: the registry log of each install shows the request of its own tarball, and the installed files match the source of that install by digest.

## Related lessons

[[isolate-verification-barriers-per-attempt]]
