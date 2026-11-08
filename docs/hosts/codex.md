# Codex

A maintainer reference: how the plugin `celetis` integrates with Codex CLI. No session reads it at
entry, and no skill or module cites it. Each agent rule of a host operation lives in the module of
its procedure, under its `Codex` part ("The module index").

## Skills and the entry

- Codex declares no Celetis lifecycle hook: `.codex-plugin/plugin.json` sets `"hooks": { "hooks": {} }`.
  This explicit empty override excludes the shared Claude native hooks file, `hooks/hooks.json`.
  The initial skills list holds each skill's name, description, and path, and Codex reads the
  whole `SKILL.md` when it uses the skill.
- With no hook, the entry line of each skill sends the session to `docs/procedures/entry.md`,
  "Entry without the hook". With a shell, the entry runs the reader CLI, which validates the whole
  file and checks each `custom` key against the skills of the plugin. With no shell, full schema
  validation comes at each command that needs the configuration: `createOperation` validates
  before protected work.
- `guide` and `setup` are explicit-only: `policy.allow_implicit_invocation: false` in
  `skills/guide/agents/openai.yaml` and `skills/setup/agents/openai.yaml`.
- The prompt that starts a skill is
  `Use the celetis:<command> skill for #<n>. Complete its Celetis entry before any response, including commentary.`
  The prompt came from a wording test: its second sentence, the startup sentence, changed
  first-response compliance from 0 of 5 to 5 of 5. The first sentence stays byte for byte. The
  current second sentence names the entry of `docs/procedures/entry.md` and needs a fresh
  compliance check. `docs/workflow.md`, "Acceptance status", records each check.

## The daemon and `developer_instructions`

`hostArguments` of `engine/lib/session.ts` reads the effective `developer_instructions` with
`config/read`, keeps that text, and appends the step text: the facts header (`stepHeader`) and
`step-prompt.md` of the version folder of the program. It passes the result as one quoted
`developer_instructions=<JSON string>` value after `-c`, then the prompt above. `specify` gets no
step text, and its configured developer instructions stay. Every interactive launch, also
`specify` and exact resume, uses `--no-daemon`, so its hooks use the environment of the current
pane. The daemon keeps the configured sandbox, approval, and model settings.

Codex has no option that sets the thread ID before the start (`codex --help`). The daemon finds
the thread of a step with the app-server `thread/list`: the one thread of the
main checkout whose `createdAt` is at or after the start of the step and whose `preview` is the
exact prompt above (`docs/workflow.md`, "Sessions", and ADR-0058). It ends the step with
`hc keys <terminal> ctrl+c ctrl+c`. After its exit, Codex 0.166.0 kept the status `done` on a live
terminal for more than 45 seconds. So the daemon reads only a status that changed at or after the
start of the step.

For each step, `specify` too, `hostArguments` also reads the session model: `model` of
`config/read`, else the `isDefault` model of `model/list`. It reads every page of `model/list` with
`includeHidden: true`, because a configured model can be hidden. `selectCodexEffort` takes the
supported levels of that model (`supportedReasoningEfforts[].reasoningEffort`), keeps the five
levels of Celetis, and applies the highest one at or below the chosen level, else the lowest one.
The daemon passes it as `-c model_reasoning_effort="<level>"` before the prompt and saves it in the
session record. A resume runs `codex resume --no-daemon -c model_reasoning_effort="<level>" <id>`.
A model that `model/list` does not list, a model with none of the five levels, or a failed read
stops the start with a message.

The plugin root of the header is the `root` of `installation('codex', …)` in `engine/lib/updater.ts`,
which `requireSameRevision` returns. The lookup uses `skills/list` on a short-lived app-server
connection, with no thread or model turn.

## The sandbox

- The `workspace-write` sandbox has no network by default and permits no write outside the
  workspace. `issue`, `worktree`, and `land` reach GitHub; `issue` reads the issue before any write.
  In a sandbox with no network, `issue` exits 6 with
  `issue: blocked: cannot read #<n> from GitHub`, and each part of `update check` can fail.
- Codex runs a command that an `allow` rule matches outside the sandbox. A rule compares argument
  lists, and splits a shell script into commands only when each word is plain or quoted
  (`README.md`, "Personal landing permission"). The rule of `issue` is optional; with it, a session
  can post any file that it can read on the issue.
- In the checks of #104, `dispatch` wrote its record under `/tmp/celetis-<uid>/dispatch/` in the
  `workspace-write` sandbox with no approval.

## Dispatch

The engine does not intercept a native child call, and Codex needs no hook or trust change for the
task loop. A task-loop report is agent-reported evidence: `engine/lib/dispatch-record.ts` validates
it against the issued action and cannot prove a consistent report true (ADR-0041; independent
native enforcement is #151). The observed follow-up tool has no model or effort control, so the
engine stops a changed pair before a resume. The native trace encrypts the message fields, so it
cannot prove the CAP line of a call. With no profile, a child keeps the parent's model, or the model
of `[agents].default_subagent_model` in the Codex config (`docs/capability.md`, "Codex model
profiles").

## Versions

- 0.162.1 is the floor: the install, the refresh, and the lookup of the plugin were checked on it,
  and so was `--no-daemon` (`README.md`, "Requirements"). An older release is not supported.
- 0.164.0 ran the report-flow checks of #104; 0.165.0 is the release on which the entry of #105
  was built.
- `docs/workflow.md`, "Acceptance status", separates observed versions from open checks.

## The module index

| Host operation | Module and section |
| --- | --- |
| Skill entry: the read of `.celetis.yaml` | [entry.md](../procedures/entry.md), "Entry without the hook" |
| Skill invocation and its prompt, the approval procedure for a sandbox block, `issue` with no network, `update check` in `workspace-write`, and session recovery | [entry.md](../procedures/entry.md), "The contract", "Codex" |
| Lane worktree binding of the command cwd and the file paths, the app worktree, and the network of `worktree` | [worktree.md](../procedures/worktree.md), "Codex" |
| The return before `land`, the wait for its exit, and its network | [landing.md](../procedures/landing.md), "Codex" |
| Child spawn and resume (`collaboration.spawn_agent`, `collaboration.followup_task`), `--runtime-models`, and the report shapes | [dispatch.md](../procedures/dispatch.md), "Codex" |
