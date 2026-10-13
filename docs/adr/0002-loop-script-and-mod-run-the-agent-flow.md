# A loop script in a Terminal tab runs the agent flow, and a mod ends each step session

## Date

2026-10-06

## Related

- #402 (this change), #401 (the epic, whose Decisions bind), #403 (the board pane, child B), #394
- #381 (the runner that this replaces), #386 (its queue), #387 (its step-end hook)
- ADR-0007 (`docs/adr/0007-agents-merge-lane-prs.md`), which names the board; its decision on the merge path stands
- `scripts/agent-flow.sh`, `.claude/agent-flow/`, `.claude/scripts/next-step.sh`, `docs/agents/agent-flow.md`
- `docs/research/herdr-board-vs-herdr-projects.md` (the comparison behind the runner that goes)

## Context

Since #381, herdr-board ran the agent flow in herdr panes: one card for each issue, one new Claude Code session for each lane step, and a hook that closed the pane of a step that was done. The maintainer moves away from herdr and works in the desktop app of Claude Code, where the Terminal panel is the place for a step. The flow keeps its shape: the GitHub issue is the state store, `.claude/scripts/next-step.sh` resolves the next step, and each step gets a fresh context.

## Constraints and evidence

- Claude Code CLI 2.1.291: `claude '<prompt>'` starts an interactive session with a first prompt, `-n` names it for `claude --resume <name>`, `--plugin-dir` loads a mod for that session only, and `--append-system-prompt-file` appends a file to the system prompt.
- The mod API (function hooks) is early access and changes between releases. The engine skips a hook that fails.
- The live proof on #402 (the comment headed `## Live proof`): it ran on Claude Code 2.1.292. R1: the mod ended its session with `/exit`. R2: `--plugin-dir` loaded the mod with no dialog, `turn.complete` fired, and `$.process.run` ran the resolver with no dialog. R3: the session ran the slash command of its first prompt. R4: after `EnterWorktree`, the mod ended a session in a clean worktree and a session in a worktree with commits, with no prompt, and the worktrees stayed.
- The Terminal tool of the desktop app types one command line into a new tab, and each call can ask for an approval. By the reading of the `specify` session of #401, a permission rule for the tool matches its name, not its command; nothing verified that.
- `next-step.sh <n>` makes 2 `gh` calls for each issue; 22 issues were open on 2026-10-06.

## Decision

`scripts/agent-flow.sh` runs the flow from one Terminal tab, and herdr-board and herdr go, with no second launch path. The script asks the resolver and starts each lane step in a new interactive `claude` session. Each step has a gate, `me` or `auto`: the defaults are in `.claude/agent-flow/gates.json`, and a git config value changes one on a machine. With numbers the script starts the next step of each issue whatever its gate; with no number it runs each `auto` step of each open issue, one issue at a time. The mod `.claude/agent-flow/mod` ends the session of a step with `/exit` when the resolver gives another line than the line that the session started with, and that line is a `run` line or starts with `stop #<n> `. A dirty working tree and a resolver that fails end no session. No model is in that path. A step that ends with no new line counts as "no progress": the script stops there and records the step, so the automatic runner does not start it again.

## Alternatives considered

- **herdr-board stays.** It works today, but the maintainer leaves herdr. The board also follows herdr's socket protocol and has no Windows build.
- **The board starts each step through the Terminal tool.** A session that waits then holds no other issue. But each step is one call that can ask for an approval, so an `auto` step waits for a click; an `allow` rule for the tool lets an agent run each command with no prompt; and each step leaves a tab.
- **One session clears its context between steps.** A step then has no session and no name of its own, the working directory of a lane worktree carries over to the next step, and the mod, not a script, starts each step.
- **A classic `Stop` hook ends the session in place of the mod.** It runs in each session of the repository and must end the process from a command hook. Decision 1 of #401 names the mod, the mod loads only in a session that the script starts, and child B (#403) builds the board on the same mod.

## Consequences

- The flow runs with herdr and herdr-board not installed, in one tab for each script.
- A session that waits holds its runner. A start with a number runs another issue in another tab. Nothing shows the sessions in one place before #403, and the notification setting of Claude Code is the only signal for a session that waits.
- A session ends at the first idle moment after the state of the issue moved. An agent that asks a question after that moment loses its later acts; rule 2 of the step text covers the known cases (#394, spots 1 to 3).
- An update of Claude Code can break the mod. The session of a step then stays open, and the runner waits; `docs/agents/agent-flow.md` gives the checks.
- The "no progress" rule replaces the board's guard of 8 automatic hops, and `max_concurrent` goes: one automatic runner works on one issue at a time.
- The runner does not see a session that the maintainer starts by hand.

## Reconsider when

- A release of Claude Code changes the mod API so that a mod cannot end its session or cannot run the resolver.
- Claude Code gets a supported way to run a chain of fresh sessions with a gate for each step.
- The board of #403 starts each step, and the automatic runner in a tab is no longer necessary.
- Automatic runs in parallel become necessary, or the maintainer needs a native Windows runner.
