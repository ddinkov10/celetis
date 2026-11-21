---
{
  "schema": 1,
  "name": "guard-a-parsed-input-with-the-parser-of-its-consumer",
  "description": "A lexical guard of the board CSS before the Tailwind CLI was bypassed four times, because each fix taught the scan one more parse rule of Tailwind",
  "tags": [
    "build",
    "recurring",
    "false-negative"
  ],
  "date": "2026-11-21",
  "status": "active",
  "source": "The implement session of #344 on Claude Code, the CSS guard of scripts/build.ts (Task 2 fix round 1, Task 9 and its review), 2026-11-20 to 2026-11-21",
  "incidents": [
    {
      "id": "a54b5659-3340-418e-a87a-59fad67d95be",
      "date": "2026-11-21",
      "action": "The CSS guard (styleRefusals of scripts/build.ts) scanned the text of app.css with regular expressions to refuse @plugin, @config, and @import or @source paths outside engine/board/. Three fixes each added one parse rule: source() on @import and a full .css name (Task 2), strings and escapes (Task 9 F1).",
      "expected": "Each input that the Tailwind CLI reads as a @plugin, an @import, or a source path outside engine/board/ is refused before the CLI runs.",
      "observed": "After each fix a new form passed the guard and reached Tailwind: @import ... source(\"../../../outside\"), @import \"./x\" with no extension, a /* inside a string, and a comment inside the name (@plu/**/gin), which Tailwind joins with no gap.",
      "source": {
        "kind": "tool-output",
        "excerpt": "\"@plugin \\\"./p.mjs\\\";\" refused: build: engine/board/page/app.css:1: @plugin \"./p.mjs\"; loads code ... plugin ran: false\n\"@plu/**/gin \\\"./p.mjs\\\";\" refused: no plugin ran: true",
        "reference": "https://github.com/ddinkov10/celetis/issues/344"
      },
      "inference": "Inferred by the coordinator: the shared premise of each fix was that a hand-written scan can predict what the Tailwind parser reads as a directive or a path. tailwindcss 4.3.5 exports compile() with loadModule and loadStylesheet hooks and a sources result, so the guard can decide on what the parser reports. Not yet proven: the fix round that moves the guard to these hooks is in progress.",
      "diagnosis": [
        "unknown"
      ],
      "revision": "1881b3b"
    }
  ],
  "recurrences": 0,
  "reviews": [
    {
      "id": "b9482db2-a3ac-4ba8-a52e-41cd4e4eb435",
      "requestDigest": "d475b548f95784082dc3b2e3f8da05d2baf384956d9cf7770498c915d82eb587",
      "date": "2026-11-21",
      "decision": "approve",
      "source": "agent review: lesson curation in the landing of #355; claude child opus/high\n\nApprove: observed tool-output evidence of four bypasses of one guard; the rule states applicability, action, and check; it widens no permission, weakens no check, and contradicts no principle (it applies attack-the-premise and boundary-discipline to a guard before a parser); no live or historical lesson holds its incident or states the same rule. The body keeps the cause labelled as inferred and the fix as proposed, not enforced.",
      "related": [
        "guard-a-parsed-input-with-the-parser-of-its-consumer"
      ],
      "followUp": {
        "state": "not-needed",
        "detail": "The rule stays text: each consumer exposes its parser differently, so no structural check applies."
      }
    }
  ]
}
---
# Guard a parsed input with the parser of its consumer

## What happened

The board build of #344 runs the locked Tailwind CLI on `engine/board/page/app.css`. A guard in `scripts/build.ts` scanned the CSS text with regular expressions and refused `@plugin`, `@config`, and each `@import` or `@source` path outside `engine/board/`. Reviews found four bypasses in a row: `source("../../../outside")` on an `@import`, an `@import "./x"` with no extension, a `/*` inside a string or after a backslash, and a comment inside the directive name (`@plu/**/gin "./p.mjs";`), which Tailwind joins with no gap. In each case the plugin ran or a class from outside the board reached `board.css`. Each fix taught the scan one more parse rule.

## Root cause

Inferred, not proven: the premise of each fix was that a hand-written scan can predict what the parser of the consumer reads. A CSS parser has more rules (comments, strings, escapes, options, resolution) than a scan copies. Alternative: a strict allowlist scan that refuses each unknown form could also close the class.

## Fix

Proposed prevention, not enforced: decide on what the consumer's own parser reports. Tailwind 4.3.5 exports `compile(css, { base, loadModule, loadStylesheet })`; the hooks see each `@plugin`, `@config`, and `@import`, and the result holds each source base and pattern. A guard on those reports sees what Tailwind sees. The rule stays text, because each consumer exposes its parser differently.

## Rule

Applies when a change adds or fixes a guard that must refuse inputs before another tool parses them (a CSS file before a CSS compiler, a config before a loader, a path list before a scanner). Action: find whether the consuming tool exposes its own parser, hooks, or a resolved result, and make the guard decide on that output; when it exposes none, refuse each form that the guard does not positively recognise. After a second bypass of the same guard, stop adding parse rules and apply this before the next fix. Check: a probe gives the guard each known bypass form and one new form built from another parse rule of the consumer (a comment, an escape, a string, an option), and each is refused before the consumer acts.
