---
description: Which command fits what you want to do
argument-hint: [what you want to achieve]
disable-model-invocation: true
---

Match the goal to a row. Answer with the command and one line on why it fits; run nothing. Goal: $ARGUMENTS

| You want to… | Run |
|---|---|
| turn a raw request into an issue with an intent | `/intake <text>` |
| find the lane of an issue whose type is unclear | `/triage <#>` |
| add behavior the app lacks | `/feature <# or text>` |
| fix shipped behavior, production not on fire | `/bug <# or text>` |
| ship a fix for broken production now | `/hotfix <# or text>` |
| make a zero-behavior-change edit (dep bump, rename, docs) | `/chore <# or text>` |
| turn an approved spec (the issue body) into a plan | `/plan <#>` in a fresh context |
| build a posted plan (`ready-for-agent`) and land the change | `/implement <#>` in a fresh context |
| see each agent session and each issue's next step, and start a step | the board: `npx 'github:ddinkov10/agent-board#semver:^1'` in the main checkout, then `http://127.0.0.1:4403` (`docs/agents/agent-flow.md`) |
| run the next step of an issue in a fresh session, in your own terminal | `scripts/agent-flow.sh <n>...` in a Terminal tab; each gate is `me` by default, so it runs one step of each issue and ends. With no number it runs only the steps that `git config agent-flow.gate.<step> auto` makes `auto` on this machine, so with the defaults it starts nothing (`docs/agents/agent-flow.md`) |
| see an issue's next step without running it | `.claude/scripts/next-step.sh <#>`; `.claude/scripts/next-step.sh --open` lists each open issue |
| open the session of a step again to diagnose it | `claude --resume '#<n> <step>'` from the main checkout, for example `claude --resume '#402 plan'` |
| land a change whose landing stopped (`## Landing refused`) | the build step again, `/implement <#>` or `/chore <#>`: it lands the change and does not build it again |
| score the current diff before asking for review | `/critic-loop` |
| record a decision or a lesson | `/record-architecture-decisions`, `/lesson` |
| prove work is done before claiming it | `scripts/verify.sh` |
| merge a PR by hand | you: `gh pr merge --squash` in your own shell, or on GitHub; an agent lands a change only with `scripts/land.sh`, which its build step runs |
| preview what a promotion will land before you run it | `/promote-preview` |
| put merged work live | you, by hand: `scripts/promote.sh` |

No row fits → `/intake`; the intent and `/triage` sort it into a lane.
