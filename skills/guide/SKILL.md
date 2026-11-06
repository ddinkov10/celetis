---
name: guide
description: Which command fits what you want to do
argument-hint: [what you want to achieve]
disable-model-invocation: true
---

**Celetis entry.** Before any step or response, including commentary or an announcement, bind `<plugin>` to the absolute prefix before `/skills/<name>/SKILL.md` in the path of this loaded file. Then read `<plugin>/docs/procedures/entry.md` whole, in one read, and follow it before any product-path scan. Do this on each invocation, including a same-session handoff.

If entry stops, report only the exact block and the required repair or access setup. End the turn without goal advice, including conditional commands.

After the entry succeeds, match the goal to a row. Give the selected host's skill prompt or command and one line on why it fits.
When the advice quotes `board.port` or `gates`, get the value at that point from the reader CLI of the entry contract, run on the main checkout.
Write each launcher recommendation as `celetis --agent claude <command>` or `celetis --agent codex <command>` for the running host, including commands for the person's terminal.
Execute no recommended action and invoke no other skill. Goal: the invocation input.

| You want to… | Run |
|---|---|
| turn a raw product request into an intent in the product tracker | `/celetis:intake <text>` |
| file feedback about Celetis in `github.com/ddinkov10/celetis` | `/celetis:feedback <concern or conversation reference>`; files directly without another go-ahead |
| find the lane of an issue whose type is unclear | `/celetis:triage <#>` |
| add behavior the app lacks | `/celetis:feature <# or text>` |
| fix shipped behavior, production not on fire | `/celetis:bug <# or text>` |
| ship a fix for broken production now | `/celetis:hotfix <# or text>` |
| make a zero-behavior-change edit (dep bump, rename, docs) | `/celetis:chore <# or text>` |
| turn an approved spec (the issue body) into a plan | `/celetis:plan <#>` in a fresh context |
| build a posted plan and land the change | `/celetis:implement <#>` in a fresh context |
| create initial recipes for core user flows | `/celetis:create-verification` |
| refresh every flow in an existing verification map | `/celetis:maintain-verification` |
| wire a product project to the plugin | `/celetis:setup` in the main checkout of the project |
| see each agent session and each issue's next step, and start a step | the board: `celetis --agent <host> board` in the main checkout, then `http://127.0.0.1:<port>`, with `board.port` in `.celetis.yaml` (`<plugin>/docs/celetis-flow.md`) |
| run the next step of an issue in a fresh session, in your own terminal | start the daemon once with `celetis daemon start`; then `celetis --agent <host> celetis-flow <n>` asks it for the next step of the issue and returns at once. Each gate is `me` by default, so the run does one step and ends. Read its progress with `celetis daemon status`. The automatic runner is `celetis daemon auto on`; it runs only the steps that `gates.<step>: auto` in `.celetis.yaml` makes `auto`, so with the defaults it starts nothing (`<plugin>/docs/celetis-flow.md`) |
| see an issue's next step without running it | `celetis --agent <host> next-step <#>`; `celetis --agent <host> next-step --open` lists each open issue |
| open the session of a step again to diagnose it | the selected host's session-recovery command of the entry contract, using the recorded session identity |
| land a change whose landing stopped (`## Landing refused`) | the build step again, `/celetis:implement <#>` or `/celetis:chore <#>`: it lands the change and does not build it again |
| score the current diff before asking for review | `/celetis:critic-loop` |
| record a decision or a lesson | `/celetis:record-architecture-decisions`, `/celetis:lesson` |
| check a shared premise after two fixes fail | `/celetis:attack-the-premise` |
| prevent a repeated mistake through structure | `/celetis:encode-lessons-in-structure` |
| check retries of an operation that changes persistent state | `/celetis:make-operations-idempotent` |
| choose write targets for concurrent actors | `/celetis:separate-before-serializing-shared-state` |
| assess a measured performance or quality result | `/celetis:explain-the-number` |
| check external input or a validation change | `/celetis:boundary-discipline` |
| clarify state combinations, branches, or repeated shape rules | `/celetis:model-the-domain` |
| choose types that prevent an identified error | `/celetis:type-system-discipline` |
| design or review a check of required behavior | `/celetis:test-behavior-not-implementation` |
| prove work is done before claiming it | the verify gate of the project (`AGENTS.md` names it) after each change, and the full suite once, on the tree that lands |
| merge a PR by hand | you: `gh pr merge --squash` in your own shell, or on GitHub; an agent lands a change only with `celetis --agent <host> land`, which its build step runs |

No row fits → `/celetis:intake`; the intent and `/celetis:triage` sort it into a lane.
