# The design skill

How a session uses the design skill `impeccable` at each lane point of a UI change: the check for
the skill, the stop or the one line when it is missing, the pick of a look on the `impeccable` path
as a question in the terminal, the design review, and the `detect` scenario. The skills, the UI
procedure, and the step text cite it.

## Contents

- **The check:** the skill, `<impeccable>`, the commands, and the context, in their order.
- **Missing:** the stop of a look decision, and the one line of the review and of `detect`.
- **The lane points:** the command and the result of each lane point.
- **A whole screen or a smaller change:** which path gives the options.
- **Can the session ask:** the stop of a session that cannot ask.
- **The pick:** the structure round and `generate`, each read after the terminal answer.
- **The fallback of the pick:** the terminal question alone, or the stop of `generate`.
- **The design review:** the refine pass on the rendered screen after the build.
- **The detect scenario:** the Verify scenario on the web, by exit code.
- **Claude Code** and **Codex:** the check, and the question tool.

## The check

Run the check once in a session, before its first lane point. For a look decision on the
`impeccable` path (a whole web or mobile screen, or a smaller web change), check in this order,
before any page, prototype checkout, or `shape` question: the skill, the commands of the lane
point, `PRODUCT.md`, then "Can the session ask". The first failure is the stop of "Missing".

- **The skill.** Invoke `impeccable` as the host part says, and bind `<impeccable>` to the folder
  of its loaded `SKILL.md`. Its CLI is `<impeccable>/scripts/impeccable`. The skill is missing
  when the skill list of the session does not hold it, or when its launch fails: keep the exact
  error.
- **The commands.** This text is written against `impeccable` 4.8.0. A lane point uses two kinds
  of command, and a missing one is missing for that lane point:
  - A skill command (`shape`, `critique`, `audit`, the refine commands, `generate`) runs by its
    reference, as the `Commands` table of the loaded `SKILL.md` says. It is missing when that
    table does not list it.
  - A CLI verb (`context`, `concept-seed`, `serve-question`, `live-generate`, `live-poll`,
    `live-server`, `detect`, `ignores`) runs as `<impeccable>/scripts/impeccable <verb>`. It is
    missing only when the CLI answers `Unknown command` for it.
- **The context.** Run `<impeccable>/scripts/impeccable context` once, from the root of the
  product. A run that fails is a failed launch. Its line `NO_PRODUCT_MD` means that the product
  has no `PRODUCT.md`.

The maintainer owns the installation of `impeccable`. The lane only checks for it: it never
installs or updates it, never makes it a dependency of the plugin `celetis`, and never runs its
`init`, `document`, `extract`, or `doctor`.

## Missing

For a look decision on the `impeccable` path, a failed check is a stop
(`<plugin>/docs/procedures/stop.md`, "The two modes"), before any page, prototype checkout, or
`shape` question. Its message names the exact cause and one setup action, which ends with "then
start the step again":

- The skill is not in the list, or its launch failed: install or repair the `impeccable` skill
  from its own source. The message keeps the exact error of a failed launch.
- The installed version has no `<command>`: update `impeccable`.
- The `context` output or `concept-seed` says `NO_PRODUCT_MD`: run `/impeccable init` once for
  the product.
- The session cannot ask: run the look decision of the issue in a session that can ask.

The design review and the `detect` scenario run with no `PRODUCT.md`. When the skill or a command
of either is missing, print this one line, and go on:

`design: impeccable is not available; <step> does not run.`

`<step>` is `the design review` or `the detect scenario`. The step has no PASS, and it is no hold.

## The lane points

| Lane point | Command | Result |
| --- | --- | --- |
| The states of a look decision (`specify`, `bug`) | `shape`, only its discovery questions and its brief, with no Phase 2 (its direction or concept choice) | The "States and ranges" part of its brief is the list of states |
| A whole screen, web or mobile | The structure round: `concept-seed --scope surface` and the decision page | The locked card is the pick. With no `PRODUCT.md`, "The check" stops before the round |
| A smaller web change | `generate` on the element, in the prototype checkout | The accepted variant is the pick |
| The design review after the build, web and mobile | `critique`, `audit`, the refine commands, and on the web `detect` ("The design review") | Fixes on the lane branch |
| The `detect` scenario of Verify | `detect` | Evidence, web only, by exit code |

## A whole screen or a smaller change

The structure round runs for a whole page, screen, or flow whose composition is open: a new
screen, or an existing screen that is redone as a whole. A section, card, step, or element inside
an existing screen is a smaller change, and `generate` gives its options. A change of several
screens is one look decision for each screen. Step 1 of `<plugin>/docs/procedures/ui.md` shows
the chosen path with the list of states. A smaller change on mobile takes the hand-built path of
that procedure: `generate` is web only.

## Can the session ask

The session can ask when its host part says so. A session that cannot ask opens no page and takes
no card or variant. It stops with the last setup action of "Missing", by
`<plugin>/docs/procedures/stop.md`, "The two modes": a step session hands the stop to the issue
("A stop in a step session"), and an interactive session shows it.

## The pick

The maintainer picks each look. The page shows the options, the question in the terminal waits
for the maintainer, and the session reads the page only after the answer. Before the answer, run
no `serve-question --wait`, and no `live-poll` other than the reply `--reply <event id> done`.
Never take a card or a variant that
the maintainer did not choose: THE ROLL is no pick, and an answer that the host gives by its own
timeout is no answer.

**The structure round.**

1. Follow `<impeccable>/reference/new-work.md`, "Create a whole surface inside an established
   world", up to the payload: run
   `<impeccable>/scripts/impeccable concept-seed --scope surface --mode <mode>`, then write the
   payload as its PRESENTATION block says.
2. Run `<impeccable>/scripts/impeccable serve-question --start --payload <file>`. It prints
   `QUESTION URL:` and `QUESTION KEY:`. Open the URL as the web row of
   `<plugin>/docs/procedures/ui.md`, "The platform rows", says, also for a mobile screen.
3. Ask in the terminal, with the URL: lock one card on the page, or ask for a re-roll there, then
   answer. The options are "I locked a card or asked for a re-roll" and "The page did not open".
4. After each answer other than "The page did not open", run
   `<impeccable>/scripts/impeccable serve-question --wait --key <key>`:
   - Exit 0 with an `ANSWER` whose `optionId` is `reroll`: re-roll as
     `<impeccable>/reference/new-work.md` says, deliver the new hand with
     `serve-question --update --key <key> --payload <file>`, and ask again.
   - Exit 0 with another `ANSWER`: the card of the payload that its `optionId` names is the pick.
     An `optionId` that names no card of the payload is no pick: ask again.
   - Exit 3, after 60 s: the page holds no lock. Ask again.
   - Exit 4: the page closed. Run `serve-question --start` again with the same payload, open its
     URL, and ask again. Later reads use the key that it prints.
   - Another result is no pick: do what its message says, then ask again.

**`generate`.**

1. Follow Steps 1 to 3 of `<impeccable>/reference/generate.md`: `live-generate`, then the variants
   as `<impeccable>/reference/live.md`, "Handle `generate`", says. One change: reply with
   `<impeccable>/scripts/impeccable live-poll --reply <event id> done --file <file>`, with no
   `--then-poll`.
2. Ask in the terminal: accept or discard the variants in the overlay, then answer. The options
   are "I accepted a variant", "I discarded them", and "The overlay did not show".
3. After "I accepted a variant" or "I discarded them", run
   `<impeccable>/scripts/impeccable live-poll --timeout=5000`:
   - `accept`: its `variantId` is the pick. Go on with "Step 4: Accept and close" of the reference.
   - `discard`: ask for a new direction, and run `generate` again.
   - `{"type":"timeout"}`: the overlay holds no choice. Ask again.
   - Another event is no pick: handle it as `<impeccable>/reference/live.md` says, then ask again.

After "The page did not open" or "The overlay did not show", follow "The fallback of the pick".

## The fallback of the pick

When `serve-question --start` exits 2, the CLI reports no browser, or the maintainer answers "The
page did not open": stop a running page with `serve-question --stop --key <key>`, and ask the
terminal question alone. Its options are the cards, each by its name and one line, as the
structured question channel of `<impeccable>/reference/new-work.md`. The chosen card is the pick.

`generate` has no such channel. When `generate` cannot start, or the overlay did not show, run
`live-server stop`, and stop the look decision (`<plugin>/docs/procedures/stop.md`, "The two
modes"). Its message names the exact failure and one setup action, which ends with "then start the
step again": the act that lets the overlay show on the page, for example a start of the dev server
of the product, or a browser that the session can open.

## The design review

The review refines the chosen look on the rendered screen and keeps its direction
("refinement preserves; redesign replaces" of `impeccable`):

1. Run the skill commands `critique`, then `audit` (its native variant on mobile), each by its
   reference ("The check", "The commands").
2. Fix the findings with only the refine commands that they name, each a skill command run by its
   reference, from `polish`, `harden`, `clarify`, `adapt`, `layout`, `typeset`, `optimize`, and
   `onboard`. The commands `bolder`, `quieter`, `distill`, `colorize`, `animate`, `delight`, and
   `overdrive` change the direction: the review never runs them.
3. On the web, run `<impeccable>/scripts/impeccable detect --json --viewport <W>x<H> <url>` once at
   each size of the platform row, and fix its findings.

Run at most two rounds. The task report keeps each finding that needs a new look, each unfixed
finding, and the degraded mark of a `critique` that could not start its own subagents. The review
commits no file that it wrote under `.impeccable/`, for example the report of `critique`. Before
the task ends, remove each such untracked file, so that `git status --porcelain` shows none of
them. Only an ignore of "The detect scenario" commits `.impeccable/config.json`.

## The detect scenario

On the web only. On the running page, run
`<impeccable>/scripts/impeccable detect --json --viewport <W>x<H> <url>` once for each size of the
platform row:

- Exit 0: evidence of no primary findings, not proof of quality.
- Exit 2: FAIL. Its fix fixes the finding, or records an ignore with its reason:
  `<impeccable>/scripts/impeccable ignores add-value <rule> <value> --reason <text>`, and commits
  the `.impeccable/config.json` that this writes.
- Exit 1: a target was not scanned, so the scenario has no PASS.

An advisory finding never changes the exit code, so it never fails the scenario.

## Claude Code

- **The check.** The skills of the session list `impeccable`. Invoke it with the Skill tool, and
  bind `<impeccable>` to the base directory that the launch prints. A refused launch, for example
  by a deny rule `Skill(impeccable)`, is a failed launch.
- **Can the session ask.** It can when its tool list holds `AskUserQuestion`. A `claude -p`
  session has none.
- **The question.** Ask with `AskUserQuestion`. A question that the `askUserQuestionTimeout`
  setting closes is no answer, with or without a selection: ask again.

## Codex

- **The check.** The available skills of the session list `impeccable` with the path of its
  `SKILL.md`. Read that `SKILL.md`: `<impeccable>` is its folder. A failed read is a failed launch.
- **Can the session ask.** It can, unless a call of `request_user_input` gets the rejection
  `request_user_input is not supported in exec mode`. That rejection, also at a later question of
  the look decision, is the stop of "Can the session ask".
- **The question.** Ask with `request_user_input` when the session offers it. With no such tool,
  or with the rejection `request_user_input is unavailable in <mode> mode`, ask in plain text, end
  the turn, and wait for the reply, as a Codex step session asks.
