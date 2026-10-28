# Claude Code

A maintainer reference: how the plugin `celetis` integrates with Claude Code. No session reads it
at entry, and no skill or module cites it. Each agent rule of a host operation lives in the module
of its procedure, under its `Claude Code` part ("The module index").

This file is not named `claude.md`: on a case-insensitive file system, for example on macOS,
Claude Code loaded the earlier file of that name as a nested `CLAUDE.md` memory file when a session
read a file in its folder (ADR-0047).

## The native entry hook

`hooks/hooks.json` names one hooks module, `engine/hooks/entry.js`. `scripts/build.ts` builds it
from `engine/hooks/entry.ts` with exactly Bun 1.4.4, and `build --check` in the verify gate
compares its bytes. The hook runtime has no Node and no DOM: a module that the hook imports has no
`node:` import and no `Bun` global, and `tsconfig.native.json` types it against
`engine/hooks/native-host.d.ts`.

- **`skill.prompt`.** For a skill `celetis:<name>` of this plugin (`source`, `pluginName`, and
  `path` of the event), the hook marks the expansion with a ticket. Other skills pass through.
- **`session.append`.** When the marked skill text reaches the context of a bound agent loop, the
  hook makes its own permission-checked `Read` of the `.git` boundary and of `.celetis.yaml`. A
  main loop starts from the session root, and a child agent from its cwd. The hook uses no
  `$.fs.read`, because its permission semantics are not documented. It parses and validates the
  text of the `Read` with `parseConfigText` and `validateConfig` of `engine/lib/config-core.ts`,
  the full validation of the reader CLI. Then it puts its block in place of the entry line of the
  skill:

  ```text
  Celetis entry: celetis:<name>
  - host: claude
  - plugin: <absolute plugin root>
  - checkout: <absolute checkout> | none
  - custom: none | after the contract

  <"The contract" of docs/procedures/entry.md, with its Claude Code part>

  Custom text of celetis:<name>:
  <custom.<name>, when present>
  ```

  The block holds no host manual and no raw YAML. Custom text comes only after its marker line,
  so it cannot change a facts line. An empty string is `- custom: none`.
- **The contract** comes from `docs/procedures/entry.md` at build time: `engine/hooks/entry.ts`
  imports the file as text, so the bundle holds it, and takes "The entry line" and "The contract"
  up to its `### Codex` part. There is no runtime read of plugin text. The verify gate checks that
  each `SKILL.md` holds that entry line once (`checkCitations` in `scripts/verify.ts`).
- **`file_unchanged`.** A `Read` of a file that the session read before returns no content. The
  hook then reuses its own parsed result for that path, keyed by `size` and `mtimeMs` from
  `$.fs.stat`. The cache lives for the session, so a child agent that sees the parent's read
  reuses the parent's result. With no cached result, or with a changed stat, the entry stops. An
  edit that keeps both the size and the millisecond of the modification time is a residual risk.
- **A stop.** A denied, partial, or invalid read replaces the skill text with
  `Celetis entry stopped: <path> <field>: <message>`. Then `turn.step` ends each later turn of that
  agent loop natively, with no model call and no usage. A hook that throws or overruns its budget
  of 10,000 ms gives the same stop through its `.catch` handler.
- **A hook that makes no entry** leaves the entry line in the skill text. On a release before
  2.1.299, the hook runs but finds no skill name in the event, so it makes no entry. The session
  then makes the entry itself, by "Entry without the hook" of `docs/procedures/entry.md`.
- **After the entry.** A later `Read` of `.celetis.yaml` in the same session returns
  `file_unchanged` with no content.

## The runner

`hostArguments` of `engine/lib/session.ts` starts a step as
`claude --permission-mode auto -n '#<n> <step>' --append-system-prompt <step text> '/celetis:<command> #<n>'`.
The step text is the facts header (`stepHeader`) and `step-prompt.md` of the version folder of the
program. `specify` gets no step text. In a herdr pane, the runner puts `--session-id <uuid>` first
and reports that ID to herdr (ADR-0039). The plugin root of the header is the `root` of
`installation('claude', …)` in `engine/update.ts`, which `requireSameRevision` returns
(`docs/celetis-flow.md`, "How a step runs").

## Permissions

- The runner starts each step with `--permission-mode auto`. In the checks of #103, auto mode ran
  `celetis --agent claude issue` with no allow rule.
- The personal rule of `land`, `Bash(celetis --agent claude land *)`, and the optional rule of
  `issue` are in `README.md`, "Personal landing permission". A Claude rule matches the whole
  command text.

## Dispatch

The engine does not intercept a native child call. A task-loop report is agent-reported evidence:
`engine/lib/dispatch-record.ts` validates it against the issued action and cannot prove a
consistent report true (ADR-0041; independent native enforcement is #151). The observed follow-up
tool has no model or effort control, so the engine stops a changed pair before a resume. In the
checks of #104, native results exposed no applied effort to the calling agent.

## Versions

- 2.1.299 is the floor: the hook reads the `skill.prompt` fields `source`, `pluginName`, and
  `path`, which came in that release (`README.md`, "Requirements").
- 2.1.312 is the release on which the facts entry was built (#105).
- `docs/celetis-flow.md`, "Acceptance status", separates observed versions from open checks.

## The module index

| Host operation | Module and section |
| --- | --- |
| Skill entry with no hook: the `Read` of `.celetis.yaml` | [entry.md](../procedures/entry.md), "Entry without the hook" |
| The hook block, skill invocation with the Skill tool, `.celetis.yaml` after the entry, the sandbox approval procedure, and session recovery | [entry.md](../procedures/entry.md), "The contract", "Claude Code" |
| Lane worktree entry and return: `EnterWorktree`, `ExitWorktree` with keep | [worktree.md](../procedures/worktree.md), "Claude Code" |
| The return before `land`, and the run of `land` in background Bash | [landing.md](../procedures/landing.md), "Claude Code" |
| Child spawn and resume (`Agent`, `SendMessage`), and the report shapes | [dispatch.md](../procedures/dispatch.md), "Claude Code" |
