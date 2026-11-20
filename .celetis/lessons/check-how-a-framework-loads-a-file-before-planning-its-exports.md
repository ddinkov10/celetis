---
{
  "schema": 1,
  "name": "check-how-a-framework-loads-a-file-before-planning-its-exports",
  "description": "A plan gave named exports to the Docusaurus config and sidebars files, and the build read each export as a config field or a sidebar",
  "tags": [
    "build",
    "config",
    "process"
  ],
  "date": "2026-11-20",
  "status": "active",
  "source": "The implement session of #355 on Claude Code, Task 1 implementer report, 2026-11-20",
  "incidents": [
    {
      "id": "site-config-named-exports-refused",
      "date": "2026-11-20",
      "action": "The Task 1 implementer wrote website/docusaurus.config.ts and website/sidebars.ts with the named exports that the plan interface required (githubUrl, fileLinks; homes, homePage).",
      "expected": "Docusaurus loads the default export of each file, and the build continues.",
      "observed": "Two refusals in a row: config validation names fileLinks and githubUrl as unknown fields, then the sidebar loader reads homePage as a sidebar.",
      "source": {
        "kind": "tool-output",
        "excerpt": "bun run --bun build in website/ (Docusaurus 3.10.2): configValidation.js:503 names fileLinks and githubUrl as unknown config fields; plugin-content-docs sidebars/normalization.js:49 reads homePage as a sidebar.",
        "reference": "https://github.com/ddinkov10/celetis/issues/355"
      },
      "inference": "The loader seems to merge named exports into the default export (an interop default). The loader source was not read; another cause is possible.",
      "diagnosis": [
        "unknown"
      ],
      "revision": "829cf90"
    }
  ],
  "recurrences": 0,
  "reviews": [
    {
      "id": "801f780b-08f7-419a-b1c8-244842337057",
      "requestDigest": "9d7e20291abcc6ba543b9d40561d805f54e622be86d7769a4f5f2dbff87737f9",
      "date": "2026-11-20",
      "decision": "approve",
      "source": "agent review: lesson curation in the landing of #334; claude child opus/high\n\nApprove by the reviewer rules: the proposal has observed tool-output evidence (two build refusals of Docusaurus 3.10.2 on the planned named exports), states applicability, action, and check, and keeps its inferred cause labeled apart from the facts. It widens no permission, weakens no check or gate, adds no network or credential act, and contradicts no project instruction, skill, or principle. No live or historical lesson holds its incident or states the same rule.",
      "related": [
        "check-how-a-framework-loads-a-file-before-planning-its-exports"
      ],
      "followUp": {
        "state": "not-needed",
        "detail": "The rule is judgment-dependent plan text; no gate can know which files a framework loads as configuration."
      }
    }
  ]
}
---
# Check how a framework loads a file before a plan gives that file an export interface

## What happened

The plan of #355, Task 1, gave the interface of two files that Docusaurus 3.10.2 loads:
`website/docusaurus.config.ts` was to export `githubUrl` and the remark plugin `fileLinks` beside
the default config, and `website/sidebars.ts` was to export `homes` and `homePage` beside the
default sidebars. The implementer built the files to that interface. The build refused it twice
(tool output of `bun run --bun build`): config validation named `fileLinks` and `githubUrl` as
unknown config fields, and the sidebar loader read `homePage` as a sidebar. The implementer kept
the helpers module-local and moved the shared values to a sixth file, `website/homes.ts`, so the
next task that copies the site files had to carry six files, not five.

## Root cause

Inference: the loader of Docusaurus appears to merge the named exports of the config and the
sidebars modules into the loaded object, so each named export is read as a field. The loader
source was not read. The design probe of the spec built a config with no named exports, so it
did not reach this case. The plan stated the interface from the TypeScript shape alone.

## Fix

Proposed prevention, not enforcement: at plan time, when a planned file is a module that a
framework or tool loads as configuration, take its export shape from the framework's loader or
from one probe build, not from the plan's own module design. Keep shared helpers in a module that
the framework does not load as configuration. This stays text: no gate can know which files a
framework loads.

## Rule

Applies when a plan or a brief gives an export interface (named exports, extra symbols) to a file
that a framework or a tool loads as configuration (a site config, a sidebar file, a bundler or a
test-runner config). Action: before the plan fixes the interface, read the loader of that
framework or run one build with the planned exports, and keep each shared symbol that the loader
would read as a field in a module that the framework does not load. Check: the plan names the
loader source or the probe build for each such file, and one build with the planned exports
passes.
