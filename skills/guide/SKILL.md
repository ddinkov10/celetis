---
name: guide
description: Which command fits what you want to do
argument-hint: [what you want to achieve]
disable-model-invocation: true
---

**Host entry.** Before any step or response, including commentary or an announcement, bind `<plugin>` to the absolute prefix before `/skills/<name>/SKILL.md` in this loaded file's path. Read [the host operations](../../docs/hosts/entry.md) at `<plugin>/docs/hosts/entry.md` directly, before any product-path scan. The relative link starts in the absolute directory containing this SKILL.md. Complete its startup reads on each invocation, including a same-session handoff.

Match the goal to a row. Give the selected host's skill prompt or command and one line on why it fits. Execute no recommended action and invoke no other skill. Goal: the invocation input.

| You want to… | Run |
|---|---|
| turn a raw request into an issue with an intent | `/celetis:intake <text>` |
| find the lane of an issue whose type is unclear | `/celetis:triage <#>` |
| add behavior the app lacks | `/celetis:feature <# or text>` |
| fix shipped behavior, production not on fire | `/celetis:bug <# or text>` |
| ship a fix for broken production now | `/celetis:hotfix <# or text>` |
| make a zero-behavior-change edit (dep bump, rename, docs) | `/celetis:chore <# or text>` |
| turn an approved spec (the issue body) into a plan | `/celetis:plan <#>` in a fresh context |
| build a posted plan (`ready-for-agent`) and land the change | `/celetis:implement <#>` in a fresh context |
| see each agent session and each issue's next step, and start a step | the board: `npx 'github:ddinkov10/agent-board#semver:^2'` in the main checkout, then `http://127.0.0.1:<port>`, with the `port` of `.claude/celetis-flow/board.json` (`<plugin>/docs/celetis-flow.md`) |
| run the next step of an issue in a fresh session, in your own terminal | `scripts/celetis celetis-flow <n>...` in a Terminal tab; each gate is `me` by default, so it runs one step of each issue and ends. With no number it runs only the steps that `gates.<step>: auto` in `.celetis.yaml` makes `auto`, so with the defaults it starts nothing (`<plugin>/docs/celetis-flow.md`) |
| see an issue's next step without running it | `scripts/celetis next-step <#>`; `scripts/celetis next-step --open` lists each open issue |
| open the session of a step again to diagnose it | the selected host's session-recovery command from the host operations, using the recorded session identity |
| land a change whose landing stopped (`## Landing refused`) | the build step again, `/celetis:implement <#>` or `/celetis:chore <#>`: it lands the change and does not build it again |
| score the current diff before asking for review | `/celetis:critic-loop` |
| record a decision or a lesson | `/celetis:record-architecture-decisions`, `/celetis:lesson` |
| prove work is done before claiming it | the verify gate of the project (`AGENTS.md` names it) |
| merge a PR by hand | you: `gh pr merge --squash` in your own shell, or on GitHub; an agent lands a change only with `scripts/celetis land`, which its build step runs |

No row fits → `/celetis:intake`; the intent and `/celetis:triage` sort it into a lane.
