# OpenCode

A maintainer document: how the engine runs OpenCode as a host of a step session. No session reads
it at entry, and no skill or module cites it. `engine/lib/host/opencode/adapter.ts` is the adapter of the
host (ADR-0088).

## Skills and the entry

- OpenCode has no plugin manager that Celetis can pin. The engine version folder holds
  `plugins/celetis` of the same revision as the engine, and that folder is the plugin root
  (`installedRoot('opencode', …)` of `engine/lib/plugin/metadata.ts`). So OpenCode has no plugin
  install, no plugin update, and no plugin revision check.
- The session gets the skills through the configuration document of the session: its `skills`
  entry is `<plugin root>/skills`. OpenCode registers an explicit `skills` entry last, so in that
  session a Celetis skill wins over a skill of the maintainer with the same ID.
- A skill ID on OpenCode has no namespace: it is the folder name, for example `triage`. In a run
  session, a Celetis skill hides a maintainer skill of the same ID, for example `prototype` or
  `writing-for-agents`.
- OpenCode runs no Celetis hook. The entry line of each skill sends the session to
  `plugins/celetis/references/procedures/entry.md`, "Entry without the hook".
- The prompt that starts a skill is
  `Load the skill <id> with the skill tool and follow it for #<n>. Complete its Celetis entry before any response, including commentary.`
  Only the result of the `skill` tool is evidence that a skill loaded: in the design probes, the
  list of skills that a model gave was wrong twice.

## The daemon

`stepArguments` of `engine/lib/host/opencode/adapter.ts` starts a step as
`opencode --standalone --auto -s <id> --prompt <prompt>`. Each `opencode` call of the engine passes
`--standalone`: OpenCode then runs a private server (`opencode serve --stdio --port 0`, a child
of the TUI) and does not start or use the background service of the maintainer.

- **The session ID.** OpenCode can create a session with an ID that the caller gives (`-s`, "Session
  ID to continue, or to create if it does not exist"). The adapter makes a new ID of the form
  `ses_` + 12 hex + 14 base62 before the start, and the claim of the step is that announced ID.
  The 12 hex digits follow the time order of OpenCode IDs.
- **The model and the level (D1).** OpenCode has no `--model` flag, and its root model keeps no
  variant. The session uses the model and the variant of the OpenCode configuration of the
  maintainer. The start line ends with
  `; opencode keeps the model and the variant of its configuration`, and the `effort` of the
  session record is `null`.
- **Permissions (D2).** The start and the Resume pass `--auto`: OpenCode approves each action that
  a rule of the maintainer does not deny. A deny rule still holds. A `question` tool call shows as
  the waiting state of the session.
- **The session environment.** `sessionEnv` of the adapter writes the step text (the facts header
  and `step-prompt.md` of the plugin root) to `step.md` in the start folder of the session, with
  mode 0600. It returns one variable, `OPENCODE_CONFIG_CONTENT`, a JSON document with
  `skills: ["<plugin root>/skills"]` and `instructions: ["<start folder>/step.md"]`. The daemon
  writes the variables to the file `env` of the start folder, and the start barrier gives them to
  OpenCode ([The session tab](../../engine/README.md#the-session-tab)). OpenCode adds this document
  after the global and the project configuration files; the document works only with
  `--standalone`. `stepEnv` removes `OPENCODE_CONFIG_CONTENT`, `OPENCODE_CONFIG`, and
  `OPENCODE_CONFIG_DIR` from the environment of the tab, so only the daemon sets them. Celetis
  writes no OpenCode configuration file of the maintainer.
- **The step text file.** OpenCode reads `instructions` at each turn, not once. So `step.md` stays
  as long as the session, and goes with the start folder at the end of the session.
- **The Resume.** A Resume runs `opencode --standalone --auto -s <id>` with no prompt, and builds
  `step.md` and `env` again in the start folder of the Resume, from the step of the session record.
  It checks the contract version of the plugin before it writes the two files; a Claude Code or
  Codex Resume has no contract check.
- **The session check.** A session ID is verified when `opencode session list --format json --standalone`
  in the main checkout lists it, the `realpath` of its `directory` is the main checkout, its
  `created` is at or after the start, and `opencode session export <id> --standalone` holds a user
  message. The check trusts `session list` for the folder: `export` gave `directory: null` for a
  TUI session.
- **Usage.** OpenCode gives no usage observation: the observation of each attempt is `unknown`. A
  usage limit of OpenCode shows only on its screen, and no quota recovery moves a run away from
  OpenCode.

**Manual recovery.** The recovery line of a startup error is
`opencode --standalone -s <session-id>`, from the main checkout. Get the session ID from
`opencode session list --format json --standalone` in the main checkout: it lists the sessions of
that project, newest first, each with `id`, `title`, `created`, and `directory`. The session record
of the issue has the ID too, after a verified turn.

## The end

- The daemon ends the step with `hc send <terminal> /exit` from its own terminal. `/exit` ends the
  TUI with exit code 0, and the private server ends with it. A blocked question needs `esc` first.
- When the TUI did not exit 10 seconds after the request, the daemon sends SIGTERM to the one
  direct child of the start barrier, which is the `opencode` TUI, as it does for Claude Code. When
  that process does not exit within 10 seconds more, the session stays open in its tab.
- The design probes did not observe the end of the private server after a SIGTERM of the TUI. The
  Verify phase of #308 checks that no `opencode serve --stdio` process of the run stays.

## The capability

The `capability` of the adapter allows only the step `triage` of a run, and no interactive session,
no `dispatch`, no landing, and no setup.

## Versions

- opencode 2.2.5, hc 0.1.20, and herdr-app 0.1.15 are the releases of the design probes of #308,
  all on 2026-11-12, on macOS, in a lab of `scripts/herdr-lab.ts`:
  - P1: OpenCode reports OSC 7501 to hc itself (`app` is `opencode`), with no integration of
    Celetis.
  - P2: `-s` with a new `ses_` ID creates that session, and `-s` with the same ID and no prompt
    continues it. A UUID is refused.
  - P3: `/exit` ends the TUI with exit code 0, and no `opencode serve --stdio` child stays.
  - P4: `OPENCODE_CONFIG_CONTENT` with `--standalone` gives the session the `skills` folder and the
    `instructions` file, and the shell tool of the session sees `OPENCODE_SESSION_ID`.
  - P5: a `question` tool call reports the state `blocked` with the kind `question`.
- The Verify report on #308 records the live start, the Resume, and the end on these releases.
- `plugins/celetis/docs/workflow.md`, "Acceptance status", separates observed versions from open checks.
