# impeccable gives the options of web and mobile look decisions

## Date

2026-11-02

## Related

- [Issue #204](https://github.com/ddinkov10/celetis/issues/204): let `impeccable` take care of the
  UI/UX design work of the harness.
- [ADR-0044](0044-the-plugin-owns-the-prototype-skill.md): the plugin owns the prototype skill. Its
  hand-built variants stay for the kinds that `impeccable` does not serve.
- [ADR-0047](0047-skills-load-shared-procedures-on-demand.md): host-specific text lives in
  modules, and a shared procedure is a module with two or more citers.
- `docs/procedures/design.md`, and "The two paths" of `docs/procedures/ui.md`.
- `skills/plan/SKILL.md` (the design-review task and the `detect` scenario), step 6 of
  `skills/bug/SKILL.md`, and rules 2 and 5 of `step-prompt.md`.

## Supersedes

- From ADR-0044, "The plugin owns the prototype skill", the Decision sentences "`UI.md` holds the
  whole procedure of a look decision for each kind of product: web, mobile, desktop, and terminal.
  It names the list of states and the platform row before the build, the research before the
  variants, the live switches, the check at each size, the captures, the hand-over with a
  recommendation, and the record." On the `impeccable` path (a whole web or mobile screen, or a
  smaller web change), `docs/procedures/design.md` holds the check, the pick, and their stops,
  `shape` gives the list of states, and the lock or the accept of the maintainer is the pick, so
  the hand-over has no recommendation. `docs/procedures/ui.md` keeps the rest of that procedure,
  and all of it on the hand-built path. The other clauses of that Decision stay.

## Context

The look decisions of `docs/procedures/ui.md` built 3 to 5 live variants by hand. No lane step
reviewed the rendered result for design quality after the build. The maintainer judged that
`impeccable` makes better options than the hand-built prototype, and wanted it to propose, audit,
critique, and improve designs, including the states.

Two limits shaped the design. The runner starts each step as an interactive session that the
maintainer watches, and the board shows a session that asks a question as "needs you" (ADR-0004).
The board cannot show a command that waits on a browser page. And `impeccable` is a skill that the
maintainer installs, not a part of the plugin.

## Constraints and evidence

The checks ran on 2026-11-02 with `impeccable` skill 4.8.0 (engine 0.1.18) and Claude Code
2.1.316. The facts of Codex CLI 0.166.0 come from a read of its source, not from a run.

- The skill is a folder, and its CLI is `<skill-base-dir>/scripts/impeccable`, not a command on
  `PATH`. Claude Code lists the skills that a session can invoke. Codex loads skills from
  `.agents/skills` roots and from `$HOME/.agents/skills`, so a script that checks a fixed path
  would copy this discovery and could disagree with the session.
- `plugin.json` `dependencies` of Claude Code is a hard requirement with no optional form. The
  Codex manifest has no dependency field. Skill frontmatter has no dependency field.
- The structure round deals 3 of 5 to 7 structures as cards on a decision page. Its dice choose
  the lead card, which has `kind: assigned` and the kicker THE ROLL. Locking a card is the
  approval. `generate` makes 1 to 8 variants of one element in a live overlay and is web only.
- `serve-question --wait` blocks for a fixed 60 s window and then exits 3. `--timeout` does not
  shorten it. Exit 4 means that the page closed with no answer.
- The `generate` pick premise held in 2 of 2 runs: an accept that the browser sent while no
  `live-poll` ran reached a later `live-poll --timeout=5000` at once. A bounded poll before any
  choice printed `{"type":"timeout"}`. So the module reads the pick with no wait before the
  maintainer answers, and it needs no stop fallback for `generate`.
- With no `PRODUCT.md`, `impeccable` sends `shape` and a from-scratch build to `init`, and
  `concept-seed` refuses with `NO_PRODUCT_MD`.
- A `claude -p` session has no `AskUserQuestion`. `codex exec` rejects `request_user_input`. Codex
  also has collaboration modes with no such tool.
- Prior art: gstack treats `impeccable` as an optional engine. It probes for it, never runs its
  installer, and skips a check with at most one line. In an unattended run, gstack takes the
  recommended option, and the headless UX step of BMAD records its assumptions and open
  questions. Chromatic keeps a UI review pending until a person approves it.

## Decision

- **`impeccable` gives the options of a web or mobile look decision.** A whole screen uses its
  structure round, and the locked card is the pick. A smaller web change uses `generate`, and the
  accepted variant is the pick. `shape` gives the list of states, with no concept choice of its
  own, so each look has one pick point. `docs/procedures/design.md` holds the procedure, with a
  `Claude Code` part and a `Codex` part.
- **The session checks for `impeccable` and never installs it.** The skill list of the session
  decides. The lane never installs or updates it, and never runs its `init`, `document`,
  `extract`, or `doctor`. It is no dependency in `plugin.json`. A command that the installed
  version lacks counts as missing for its lane point. The text names `impeccable` 4.8.0 as the
  version that it was written against.
- **No session picks a look for the maintainer.** THE ROLL is no pick, and an answer that a host
  gives by its own timeout is no answer. A session that cannot ask opens no page, takes no card,
  and stops. This differs from gstack, whose unattended run takes the recommended option.
- **A browser pick is a question in the terminal.** The page shows the options. The terminal
  question waits for the maintainer. The session reads the page only after the answer, with
  `serve-question --wait` or a bounded `live-poll`. No blocking command runs before the answer.
  The board shows the question as "needs you".
- **A missing `PRODUCT.md` stops a look decision on the `impeccable` path.** The stop names the
  setup action: run `/impeccable init` once for the product, then start the step again. The
  maintainer chose this on 2026-11-02, after the installed `impeccable` showed that `shape` does
  not run without `PRODUCT.md`. This replaced the earlier plan that `shape` and `generate` run
  without it. The design review and the `detect` scenario still run without it.
- **A missing `impeccable` stops a look decision and skips the review.** A look decision on the
  `impeccable` path stops and names the install or repair action. The design review and the
  `detect` scenario print one line, `design: impeccable is not available; <step> does not run.`,
  and the lane goes on with no PASS and no hold.
- **The hand-built path stays** for a terminal program, a native desktop app, and a smaller
  change on mobile. `impeccable` has no variant source there: `generate` is web only.
- **The review refines and never redesigns.** The design review is the last task of the plan of a
  web or mobile UI change. It runs `critique`, `audit`, and only refine commands, and on the web
  `detect --json`, in at most two rounds. It never runs a command that changes the direction. A
  finding that needs a new look goes in the task report.
- **A `bug` that touches UI/UX asks the maintainer** whether the fix needs a new look. The
  session never answers for the maintainer.

## Alternatives considered

- **Approach B: put everything in `ui.md`.** The file is already over 200 lines against a target
  under 100. It would mix the prototype, the review, and the host parts, and `plan` would load the
  whole prototype procedure for a review task. Rejected.
- **Approach C: an engine command, for example `celetis design check`.** It is the closest to the
  code probe of gstack. But a script must copy the skill discovery of each host, so it can
  disagree with the session, and the repository keeps no tests (ADR-0029), so the copy has no
  test. Rejected.
- **A `plugin.json` dependency.** Claude Code makes it a hard requirement with no optional form,
  so a missing `impeccable` would keep the whole plugin disabled. Codex and the Agent Skills
  specification have no dependency field. A dependency from another marketplace also needs the
  root marketplace to allow it. Rejected.
- **Take the recommended option when the session cannot ask.** gstack does this. The maintainer
  decided that UI/UX is never decided without a look by the maintainer. Rejected.
- **A blocking `--wait` or `live-poll` as the way to wait.** The board cannot show it, and the
  session would hold a browser page open. Rejected.

## Consequences

- A look decision on the `impeccable` path needs `impeccable` and a `PRODUCT.md`. A product
  without either stops at the start of the step, with the setup action named. This repository
  has no `PRODUCT.md`, so a look decision for the board stops until the maintainer runs
  `/impeccable init`.
- The decisions of a look are always the decisions of the maintainer. A step that cannot ask
  hands the stop to the issue.
- The Codex gap. In a collaboration mode with no `request_user_input`, a `codex exec` run asks in
  plain text, and its turn end ends the run. No pick happens, but no stop reaches the issue. The
  runner starts only interactive sessions, so the gap shows only in a direct `codex exec` run.
- After an answer with no lock, `--wait` blocks for its fixed 60 s window before it exits 3. The
  module accepts this bounded wait only after the maintainer answered, and it never runs `--wait`
  before the answer.
- The `generate` pick uses `live-poll --reply <id> done` with no `--then-poll`, and it reads the
  accept with `live-poll --timeout=5000` after the answer. This order is not a documented flow of
  `impeccable`. The probe held in 2 of 2 runs. A run on a newer version can fail it.
- Version drift. The commands, the exit codes, and the page protocol come from `impeccable` 4.8.0.
  A newer version can rename them. A renamed command counts as missing, so a look decision stops
  with the update message, and the review and `detect` print the one line.
- A degraded `critique` is possible when it runs inside a subagent that cannot start its own
  subagents. The task report keeps the degraded mark.
- This repository has no design document until the maintainer runs `impeccable document` for the
  board, after the landing of #204.

## Reconsider when

- `impeccable` renames its commands or changes its page protocol: the exit codes of
  `serve-question`, or the order of `live-poll` and `live-complete`.
- A host adds an optional dependency for plugins or skills, so the check can move out of the
  session.
- `generate` gains a variant source for mobile, native desktop, or terminal programs.
- `impeccable` gets a way to run a pick that the board can show, with no terminal question.
- A host gives a session a way to tell the caller that it cannot ask, so the Codex gap closes.
