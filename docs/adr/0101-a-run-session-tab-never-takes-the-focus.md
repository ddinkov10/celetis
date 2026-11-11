# A run session tab never takes the focus

## Date

2026-11-11

## Related

- [Issue #304](https://github.com/ddinkov10/celetis/issues/304): the spec (the body of the issue), and the
  [plan comment](https://github.com/ddinkov10/celetis/issues/304#issuecomment-6796342501), and the
  [runtime report](https://github.com/ddinkov10/celetis/issues/304#issuecomment-6799363652) with
  [its renewal after the merge of #290](https://github.com/ddinkov10/celetis/issues/304#issuecomment-6800347254). In this record,
  "Design probes", "Approaches", "Design", and "Constraints and traps" name parts of the spec. The comment of the
  maintainer [that asked for the focus rule](https://github.com/ddinkov10/celetis/issues/304#issuecomment-6794678034)
  is the origin of the spec.
- [ADR-0090](0090-a-contract-version-replaces-the-same-revision-rule.md), Decision 2: a plugin that asks for a
  contract version that the engine does not serve exits 3 with a line that names both versions. That rule stays.
  This record only chooses the next version, and replaces no clause of it.
- [ADR-0097](0097-a-coordinator-session-steers-the-runs-for-the-maintainer.md): a second `celetis coordinator`
  call brings the live coordinator tab to the front. It is a tab that a person opens, so it stays, and this record
  replaces no clause of it.
- [ADR-0004](0004-the-board-shows-what-each-agent-asks-and-unblocks-a-stuck-card.md): the stuck card has Resume and
  Open shell. The Resume tab of ADR-0058 replaced a clause of that record, and this record changes how the Resume
  tab opens; it names no clause of ADR-0004.
- [ADR-0083](0083-a-library-starts-a-celetis-process-through-the-program-entry.md): the session tab runs the entry
  form through the login shell of `$SHELL`. That stays for each run session tab; it is context only.
- `openTab`, `startTab`, and `focusTerminal` of `engine/lib/terminal.ts`; `startSession` of
  `engine/lib/run-engine.ts`; the run-input parser of `engine/lib/run-record.ts`;
  `engine/README.md`, "The session tab"; `engine/board/README.md`, "The commands of the board"; and the note
  "Contract 5 (#304)" in `plugins/celetis/README.md`, "Updates".

## Supersedes

- From [ADR-0058](0058-herdr-core-hosts-the-agent-terminals.md), "herdr-core hosts the agent terminals":
  - The answer "the first press that makes the space of the repository shows it once" (Context). A new space now
    opens without a focus move.
  - The `space.new` case of the Decision "Quiet tabs come from `hc run --bg` with `herdr.space` and a rename
    (approach 3)": the sentence "When the space of the repository is missing, the press makes it with
    `herdr-app do space.new`". The rest of that Decision stays: the `hc run --bg` start, the label, the wait for
    the tab, the tab rename, `pane.focus` for a focused press, and the login-shell form of the argv.
  - The Resume part of "Resume and Open shell now open a focused tab", which is the entry of its Supersedes section
    about the stuck-card remedy of the board. Resume opens in the background. The Open shell part stays.
  - The Consequence "The shell of the first press".
- From [ADR-0062](0062-each-session-runs-in-a-tab-that-the-runner-steers.md), "Each session runs in a tab that the
  runner steers":
  - The Decision "`--quiet`": the option goes, and nothing replaces it.
  - The answer "background as today" (Context): a typed start and a Resume no longer show their tab in front.
  - The Consequence "The empty space": the next session makes the space again with a label, not with
    `herdr-app do space.new`, and the new space has no focus move. The deferred close, which the Consequence names,
    stays (Decision, point 5).
- From [ADR-0073](0073-the-runner-commands-are-clients-of-the-master-daemon.md), "The runner commands are clients
  of the master daemon": in the Consequence "A run uses the environment of the daemon", the value `--quiet` that
  travels in the request. The host selection, `--effort`, and `--model` still travel.
- From [ADR-0077](0077-the-master-daemon-hosts-the-board-and-restarts-as-a-successor.md), "The master daemon hosts
  the board and restarts as a successor": in "Auto mode carries over a restart", the field `"quiet":…` of
  `--auto {"selection":…,"quiet":…}`. The successor gets `--auto {"selection":…}`.

## Context

When a run starts, its session tab takes the focus of the Herdr app. The maintainer works in other tabs while
the daemon starts runs, for example in the coordinator tab, and the coordinator session starts runs with
`celetis --agent <host> run <n>`, which had no `--quiet`. So each start moved the maintainer out of the tab that
they used. The maintainer said: "when new hc is opened i don't need initial focus to that tab", and the goal is
"keep the same visiblite of the agent session, just don't switch the focus to it when started".

The decisions of the maintainer in the specify session of #304:

- Resume opens in the background, as each other run tab does (rule "a"). After a Resume press on the board, the
  maintainer presses Go.
- `--quiet` goes, and nothing replaces it (approach 1, "yes").
- Version 3 of the contract goes: the engine serves only the new version, and the plugin asks for it (rule "b").

These answers replace two older answers: ADR-0058 ("the first press that makes the space of the repository shows
it once") and ADR-0062 ("background as today", with a typed start and a Resume in front).

## Constraints and evidence

The facts held on macOS on 2026-11-11 with hc 0.1.20 and the Herdr app 0.1.15. They come from the External facts
and the two design probes of the spec.

- `space.new` makes the new space the focused space. An `hc run --bg` terminal with a `herdr.space` id that the
  app does not know makes a new space with that exact id and does not move the focus. `space.rename` does not move
  the focus (probe 1). The first tab of a space that `space.new` makes starts through the start form of the app,
  so that tab keeps a shell; ADR-0058 recorded this.
- `pane.focus --terminal <id>` of a terminal in a space that is not active makes that space, its tab, and its pane
  the focused ones, also for the first tab of a label-made space. A second labelled terminal in a space that is not
  active adds a tab there and the focus does not move (probe 2). So a tab that a person opens needs `pane.focus`
  and no `space.select`.
- A space that nobody named is called after the place of its first terminal; a space that `space.rename` named
  keeps its name. A space closes when its last tab closes, and it stays in `recent`. `herdr-app do` accepts one
  JSON object as its argument.
- Limits of the probes: each ran once, with the lab app in the background (so a front Herdr window was not
  observed), and probe 1 had the welcome overlay open. The probes did not make the space from the main checkout of
  a repository, and they did not check the poll time of a slow app.
- Prior art (spec, "Prior art"): VS Code tasks keep the focus of a task terminal off by default and decide the
  visibility apart; xdg-activation gives the focus only from an act of the user; tmux `new-window -d` and kitty
  `launch --keep-focus` are opt-in flags for a background open. The first two are the pattern of this decision.
  The last pair is the pattern of the `--quiet` of today.
- Before this change, one boolean went through four requests, three run inputs, the run records, and the restart.
  Resume ignored it, and auto mode always sent `false`.

## Decision

1. **The focus rule.** A run session tab, which the daemon opens for a session of a run, never takes the focus. A
   tab that a person opens (a press or a command of the person, for the person to work in at once) takes it. The
   kind of tab decides, in one home: the caller of `openTab`.

   | Start | Focus |
   | --- | --- |
   | `run <n>`, `run <n> --effort <level>`, `run <n> --model <model>`, `queue action`, auto mode, and each later step of a start | none |
   | The next attempt after `run retry` or a quota recovery, and a run that a successor daemon takes over | none |
   | `run resume <n>` and a Resume press | none |
   | A Run press and a queue action press on the board | none |
   | Each of the starts above when the repository has no Herdr space | none |
   | Go on the board | the session tab (no change) |
   | New intake, Assist, Make visual, and Open shell on the board | the new tab (no change) |
   | `celetis coordinator`: the new tab, and the bring to front of a live tab | the tab (no change) |

   Each run session tab still shows in the space of the repository, with its name `#<n> <step>` and its link
   label. It is not hidden, settled, or parked. Only the focus does not move.

2. **One open path.** `openTab` of `engine/lib/terminal.ts` opens every tab with `hc run --bg` and the label
   `herdr.space=<id>`. In the space lock, it reads `herdr-app ls`, and it takes the id of the space whose name is
   the folder name of the main checkout. When no space has that name, it takes a new id, `celetis-<uuid>`, a fresh
   one for each new space, so no id of a closed space in `recent` comes back. It starts the terminal, and for a new
   id it polls `herdr-app ls` each 250 ms for that id, and the poll stops after 10 seconds. When the space shows, it
   names the space with `herdr-app do space.rename` and the one JSON object `{"id":…,"name":…}`, so a folder name
   that starts with `-` stays a value. It releases the lock only then, so a second open finds the space and two opens
   at once make one space. After the lock, it names the tab, and it runs `pane.focus` only when `focus` is true.
   `space.new`, `newSpace`, and the `shown` case of `startTab` go. A failed read in the poll counts as "not yet".
   At the limit, the open goes on with no rename and releases the lock.

3. **`startSession` has no focus choice.** The one call of `openTab` in `startSession` of
   `engine/lib/run-engine.ts` passes `focus: false`, for a step and for a resume. The four presses of
   `engine/board/presses.ts` that open a tab, and the open of `engine/lib/coordinator.ts`, pass `focus: true`. Go
   and the bring to front of a live coordinator tab call `focusTerminal`, as before.

4. **`quiet` is gone from every layer that carried it.** The forms of `run` and `queue action` have no `--quiet`,
   so a command with it is another form and exits 2 with the usage line, also `run resume <n> --quiet` and
   `run retry <n> <wait-id> --quiet`, which ignored the option before. The requests `POST /run`, `/auto`, `/queue`,
   and `/queue/action` have no `quiet`, and a body with it gets the refusal of a body with a key that is not exact.
   The run inputs `number`, `auto`, and `queue`, and their validation in `engine/lib/run-record.ts`, have no
   `quiet`. The loop of auto mode keeps only its selection, and the successor gets `--auto {"selection":…}`. No
   option replaces `--quiet`: no `--focus`, and no field in any request or record. The matches of the word `quiet`
   that remain in `engine/` and `scripts/` are another role (for example `git … --quiet` and the `quiet` argument of
   `tracked` in `engine/lib/landing.ts`).

5. **The late close stays, with a new reason.** The daemon still closes the tab of a normal end only after the next
   session tab of the same start is open, or when the run ends, and auto mode that waits keeps the tab of its last
   normal end open. Its old reason was the focus move of `space.new`. Its reason now: it keeps the space of the
   repository and its place in the space list from one session to the next, because a space that is made again goes
   to the end of the list.

6. **Contract 5 only.** The forms change, so the digest of `engine/lib/contract.ts` changes. #290 raised the
   contract to version 4 with other declarations, so the merged declarations are version 5.
   `engine/lib/contract-versions.json` serves only version 5, and `plugins/celetis/contract.json` asks for 5.
   Version 3 and the version 4 of #290 go. The run record keeps the schema of #290, `schema: 3`, because the key
   check of the input already refuses a record with `quiet`, so a new schema number adds nothing.

7. **The documented Herdr app is 0.1.15.** The probes saw the label-made space only on 0.1.15, and the one open
   path needs it. The documents and the install line of `requireTerminals` in `engine/lib/terminal.ts` say 0.1.15,
   not 0.1.11. herdr-core stays 0.1.19. The mentions of the Herdr app 0.1.11 in ADR-0058 and ADR-0062 (their
   Constraints and evidence, and the Consequences "A preview API" and "The empty space") are dated facts of those
   records, not decisions. They stay unchanged.

## Alternatives considered

- **Approach 2: `--focus` in place of `--quiet`.** `run` and `queue action` would get `--focus`, which brings the
  tabs of that start to the front: the tmux and kitty pattern in reverse. A field would stay in each request and
  record, and no one asked for a start that takes the focus. Rejected.
- **Approach 3: remove `--quiet` and keep `space.new`.** It is the smallest change. A new space still takes the
  focus once, for example at the first start of a day, so Goal 2 of the spec (no focus move also with no space)
  fails. Rejected.
- **Approach 4: `space.new`, then a focus move back to the old tab.** The maintainer sees the jump, and a key typed
  in that time goes to the new tab, which is an anti-goal of the spec. The old focus must also be read first.
  Rejected.
- **Move the focus to a tab that shows a question or a dialog.** A tab that shows a dialog does not take the focus
  either: a focus move while the maintainer types can send a stray key, for example Enter, into a permission
  dialog. The Herdr app shows a blocked agent on its tab and its space, and the board shows the card in Needs you,
  with Notify. Rejected.

## Consequences

- **The update.** The engine and the plugins update together. A run record of the old daemon with a `number`,
  `auto`, or `queue` input holds `quiet`, so it is not valid: the new daemon prints the path and the cause, the
  file stays, and the session stays in its tab. A `resume` input never held `quiet`, so a resume record is still
  taken over. The old daemon gives the successor `--auto` with `quiet`, so the new daemon prints
  `daemon: this engine refuses the carried auto mode …; auto mode stays off`. After the update, the maintainer
  starts each such run again and turns auto mode on again. Until the plugins update, a host whose plugin asks for
  version 3 or the version 4 of #290 exits 3 for each step start, `assist`, `intake`, and the open of a new
  `celetis coordinator` session. The steps of the update are in the note "Contract 5 (#304)" of
  `plugins/celetis/README.md`, "Updates". They were not run for this record.
- **A second space is possible.** When the new space does not show within the poll limit, or the person renames the
  space of the repository by hand, the next open finds no space with the folder name and makes another one. The
  space of the first open keeps the name that the app gave it.
- **The first tab of a new space** runs through the same shell script and the same `--rm` rule as each other tab.
  A run session tab keeps its shell after the step, as before. A tab that the board or the coordinator opens with no
  kept shell and an argv (the New intake, Assist, and Make visual presses, and the coordinator) now closes after an
  exit 0, also as the first tab of a new space. The ADR-0058 Consequence about the
  shell of the first press goes.
- **A slow Herdr app.** When a new space does not show within the 10-second poll, a board press with no space (New
  intake, Assist, Make visual, Open shell) takes about the time of `hc run`, 10 seconds of poll, and the tab poll of
  up to 5 seconds. The New intake press has a 10-second timeout on the board page (`post('/api/intake', …)` in
  `engine/board/page/board.ts`), so it can pass that timeout. The page then says that the launch outcome is unknown
  while the tab opens. The other three presses set no such timeout. No rule of the spec covers the press outcome in
  this case, and the board page is a non-goal, so this record accepts the risk.
- **The documented Herdr app goes from 0.1.11 to 0.1.15.** Both are preview versions (0.x), so a later release can
  break a call. The one module `engine/lib/terminal.ts` is the place to change.
- **A tab that shows a dialog does not take the focus.** The person sees it as `blocked` in the app and as a card in
  Needs you on the board, and presses Go.
- **The limits of the Verify phase** ([runtime report](https://github.com/ddinkov10/celetis/issues/304#issuecomment-6799363652)).
  The scenarios ran in one lab with hc 0.1.20, the Herdr app 0.1.15, and synthetic hosts, once each. The focus
  samples have a gap of about 100 to 130 ms; the call log covers that gap, because a focus change needs a `do`
  call. After the merge of #290, each scenario but the front window ran again on the merged code. A front lab
  window was observed for two opens only, before that merge, and a slow app was not observed in the lab. New
  intake, Assist, and Make visual were not run (Open shell and the coordinator take their open call). The status
  row of `celetis daemon status` shows `-` for a run that the contract check refuses; the line is on the stderr of
  `run <n>` and in the outcome of the run, as before this change. The checks in the maintainer's own Herdr window
  and native Windows stay open.

## Reconsider when

- The Herdr app changes the label rule of an unknown id, so a label does not make a space, or it makes a space that
  takes the focus.
- The Herdr app gets a `tab.new` that does not move the focus, which would remove the poll and the rename.
- The Herdr app moves the focus for a new space.
- A second terminal runner comes, with its own rule for a new tab.
- A person asks for a run that takes the focus. A new request then needs its own record.
