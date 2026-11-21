---
{
  "schema": 1,
  "name": "guard-a-parsed-input-with-the-parser-of-its-consumer",
  "description": "Guards before a consumer were bypassed: a lexical guard of the board CSS before the Tailwind CLI four times, because each fix taught the scan one more parse rule, and an MCP argument guard that refused only whole other forms admitted a list that the CLI routes by its first word",
  "tags": [
    "build",
    "recurring",
    "false-negative"
  ],
  "date": "2026-11-21",
  "status": "active",
  "source": "implement of #357 (step session), lane feat/357-intent-a-set-of-mcp-tools-that\n\nThe implement session of #344 on Claude Code, the CSS guard of scripts/build.ts (Task 2 fix round 1, Task 9 and its review), 2026-11-20 to 2026-11-21",
  "incidents": [
    {
      "id": "2b2698f4-0562-4042-9ebb-dd50410bb85a",
      "date": "2026-11-21",
      "action": "Task 1 of #357 built a guard in `argumentsOf` that refused a built argument list only when it matched another form of the command exactly.",
      "expected": "Decision 2 of the plan: a value that names another form is refused with code 2 and no process; the lesson guard-a-parsed-input-with-the-parser-of-its-consumer asks that each form built from another parse rule of the consumer is refused before the consumer acts.",
      "observed": "The task review probe on 19ab461 printed `issue_comment n=create {\"kind\":\"argv\",\"argv\":[\"issue\",\"create\",\"comment\",\"x.md\"]}` and `issue_built n=list {\"kind\":\"argv\",\"argv\":[\"issue\",\"list\",\"built\"]}`. engine/issue.ts:363-364 routes by `argv[0]` to `createIssue` and `listIssues` before any arity check. The fix 2090bb1 added the refusal of a list that starts with the leading literal words of another form.",
      "source": {
        "kind": "tool-output",
        "excerpt": "issue_comment n=create {\"kind\":\"argv\",\"argv\":[\"issue\",\"create\",\"comment\",\"x.md\"]}",
        "reference": "https://github.com/ddinkov10/celetis/issues/357"
      },
      "inference": "Inferred: the guard modeled the consumer as a whole-form matcher, but the consumer dispatches by prefix and checks arity later. The brief carried the lesson; the implementer added one bypass form and saw it refused, so the Check passed while the prefix class stayed open. Alternative: the brief did not name the dispatch order of the command files.",
      "diagnosis": [
        "wrong-or-incomplete-rule"
      ],
      "revision": "19ab461",
      "brief": "Task 1 dispatch of #357: \"In your probe, add one bypass form beyond the brief's list, built from another parse rule of the CLI, and show its refusal\".",
      "lesson": {
        "name": "guard-a-parsed-input-with-the-parser-of-its-consumer",
        "revision": "45910e0",
        "digest": "99eae282ac1018e1b693e2ed66fb1531b25bc6b47c9750aec9232d9caa9fedbb"
      }
    },
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
  "recurrences": 1,
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
    },
    {
      "id": "526da52b-c15c-4183-a4eb-01552030307a",
      "requestDigest": "3a310875f064793cce7b3a0da822d94ec8291e147fbc59b2db38f44034b32a10",
      "date": "2026-11-21",
      "decision": "merge",
      "source": "agent review: lesson curation in the landing of #357; claude child opus/high\n\nMerge: the proposal and the active lesson guard-a-parsed-input-with-the-parser-of-its-consumer state one rule (a guard before a consumer must decide as the consumer parses), and the incident names that lesson with the diagnosis wrong-or-incomplete-rule: its Check passed with one extra bypass form while the dispatch-prefix class stayed open. Two active lessons on one guard situation would split the rule, so the active lesson survives under its name with both incidents, and its rule and check gain the dispatch-order clause. The evidence is observed tool output of the task review probe and the fix 2090bb1; the rule widens no permission, weakens no check, and agrees with the boundary-discipline principle. Causes stay labelled as inferred.",
      "related": [
        "match-a-guard-to-the-dispatch-order-of-its-consumer",
        "guard-a-parsed-input-with-the-parser-of-its-consumer"
      ],
      "followUp": {
        "state": "proposed",
        "detail": "A gate rule that derives, for each form, the dispatch prefixes of its command file and refuses a tool input that can build one of them. It needs separate authorization."
      }
    }
  ]
}
---
# Guard a parsed input with the parser of its consumer

## What happened

The board build of #344 runs the locked Tailwind CLI on `engine/board/page/app.css`. A guard in `scripts/build.ts` scanned the CSS text with regular expressions and refused `@plugin`, `@config`, and each `@import` or `@source` path outside `engine/board/`. Reviews found four bypasses in a row: `source("../../../outside")` on an `@import`, an `@import "./x"` with no extension, a `/*` inside a string or after a backslash, and a comment inside the directive name (`@plu/**/gin "./p.mjs";`), which Tailwind joins with no gap. In each case the plugin ran or a class from outside the board reached `board.css`. Each fix taught the scan one more parse rule.

In #357, the MCP server guards each tool input before the CLI parses the built argument list. The first guard (`argumentsOf`) refused a list only when it matched another declared form exactly. The CLI command `issue` routes by its first word (`create`, `list`) before it checks the arity of the act (`engine/issue.ts:363-364`). So the value `n: "create"` of `issue_comment` built `issue create comment x.md`, which the guard admitted and the CLI sent to `createIssue`; only the arity check of that act refused it. The task brief carried this lesson, and the probe of the implementer added one bypass form, which the guard refused. The task review probe on 19ab461 found the open prefix class. The fix 2090bb1 also refuses a list that starts with the leading literal words of another form.

## Root cause

Inferred, not proven: the premise of each fix was that a hand-written scan can predict what the parser of the consumer reads. A CSS parser has more rules (comments, strings, escapes, options, resolution) than a scan copies. Alternative: a strict allowlist scan that refuses each unknown form could also close the class.

For #357, inferred: the guard treated the consumer as a matcher of whole forms, but the consumer dispatches by a prefix first and checks the rest later. The earlier Check asked for one new bypass form; one refused form cannot show that a class of dispatch keys is closed. Alternative: the brief did not name the dispatch order of the command files.

## Fix

Proposed prevention, not enforced: decide on what the consumer's own parser reports. Tailwind 4.3.5 exports `compile(css, { base, loadModule, loadStylesheet })`; the hooks see each `@plugin`, `@config`, and `@import`, and the result holds each source base and pattern. A guard on those reports sees what Tailwind sees. The rule stays text, because each consumer exposes its parser differently.

For a consumer that dispatches by part of the input, the fix 2090bb1 of #357 and its probe prove the prefix refusal for that one guard; the rule text below is proposed prevention. A structural follow-up needs separate authorization: a gate rule that derives, for each form, the dispatch prefixes of its command file and refuses a tool input that can build one of them.

## Rule

Applies when a change adds or fixes a guard that must refuse inputs before another tool parses them (a CSS file before a CSS compiler, a config before a loader, a path list before a scanner, an argument list before a CLI that routes by a sub-command word). Action: find whether the consuming tool exposes its own parser, hooks, or a resolved result, and make the guard decide on that output; when it exposes none, refuse each form that the guard does not positively recognise. When the consumer dispatches by part of the input (a sub-command word, a prefix, a first key) before it checks the rest, read its dispatch order, and refuse each input whose built form starts with the dispatch key of another branch, not only an input that matches another branch whole. After a second bypass of the same guard, stop adding parse rules and apply this before the next fix. Check: a probe gives the guard each known bypass form and one new form built from another parse rule of the consumer (a comment, an escape, a string, an option), and, for a consumer that dispatches by part of the input, a value equal to each dispatch key of each other branch in each position that a value can fill; each is refused before the consumer acts.
