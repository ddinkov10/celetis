# The celetis-flow runner

`celetis --agent <host> celetis-flow` runs the celetis flow from a Terminal tab. It asks the resolver for
the next step of an issue and starts that step in a new interactive Claude or Codex session in
its tab. In a herdr pane, the script ends the session when the step is done, and starts the next step
when its gate is `auto`. The GitHub issue stays the state store (`docs/issue-tracker.md`): every
result of a step goes to the issue. The board is a local web page that shows each agent session and
the next step of each issue, and its Run button starts the script for one issue in a new herdr tab.
The board is `engine/board/` of the plugin: a product project, a repository that uses the plugin
`celetis`, holds its config, and the plugin holds the board, which reads its data in its own
process. ADR-0002 holds the reasons for the script, ADR-0003 holds the reasons for the board,
ADR-0005 holds the reasons why herdr, not a mod, gives the session state and ends a step, and
ADR-0007 holds the reasons why `specify` is a step of the script. ADR-0008 holds the reasons why the
build step lands the change, ADR-0020 holds the reasons why the board is a part of the plugin, and
ADR-0035 holds the reasons why the board reads its data with the engine and types two fixed lines.
ADR-0011 holds the reasons why a step session hands a stop to the issue, ADR-0033 holds the
reasons for the one definition of the workflow and for the skip rule, and ADR-0038 holds the
reasons why a `bug` session hands on to `plan` in that rule.

`engine/lib/workflow.ts` of the plugin is the one definition of the workflow: the lanes, with the
label, the branch prefix, and the steps in order of each lane; the stages; the command of each step;
the default gate `me`; the decision of an issue; and the skip rule. The resolver, the runner, the
board data, the config reader, the session record, `worktree`, `land`, and `setup` take these facts
from it. A product project cannot change it.

Two rules of the harness hold in each session, also in a session by hand:

- A lane never skips a step.
- The maintainer starts the runner; an agent starts it only when its task says so, with a number,
  and in a terminal.

In this document, these names are files of the plugin `celetis`, also when a session reads the
document inside a product project that has a `docs/` folder and an ADR store of its own: the four
documents (`docs/celetis-flow.md`, `docs/issue-tracker.md`, `docs/capability.md`,
`docs/docs-lookup.md`), `step-prompt.md`, a runtime of `engine/` or a program of `scripts/`
that the text names by its file, and each ADR number, which is a record of `docs/adr/` in the folder
of the plugin and not of the product project. Each other path is a path of the product project,
apart from a path that starts with `~/` or `/`.

## Requirements

- macOS or Linux, with Bun 1.4.4 or later. Native Windows is partly checked: a numbered runner
  start, the data of the board before #102, and the update lock passed their checks before the
  program. The program installs from Git Bash and runs from Git Bash, PowerShell, and `cmd`; its
  Windows checks are open ("Acceptance status").
- The selected host CLI (`claude` 2.1.299 or later, or `codex` 0.162.1 or later; the README gives
  the reason for each), `gh` (logged in), Bun 1.4.4 or later,
  and `git` 2.31 or later on `PATH`. See `docs/configuration.md` for the install of
  Bun. A missing external command keeps its diagnostic and failure status. The entry of the
  program imports the engine of its own version folder. Host operations validate native metadata. Child Celetis
  programs keep the selected Bun and all startup isolation flags. No jq or Perl runtime is needed.
- The scripts use only the REST API of GitHub (`gh api`), so they also work where a proxy refuses
  GraphQL, as in a Claude Code cloud session.
- The program `celetis` on `PATH` (`README.md`, "First install"), and the plugin `celetis@celetis`
  of the selected host at the revision of the program. The scripts and the step text come from
  the version folder of the program: `celetis --agent <host> <name> <arguments>` runs
  `engine/<name>.ts` of that folder with those arguments. Before each new step session, the
  runner reads the enabled installation of the session's host ("How a step runs"). Missing,
  disabled, malformed, or ambiguous metadata stops that read. Codex lookup uses `skills/list` on a
  short-lived local app-server connection; it starts no model turn. The README holds the separate
  installation recipes and product permissions. A Codex-only machine needs no Claude CLI.
- The trunk of the main checkout is current. The trunk is the default branch of the repository on
  GitHub. The config comes from the main checkout of the product project, and so does the custom
  part of a step that the script starts ("The config and the custom parts"):
  `celetis --agent <host> land` moves the trunk of the main checkout after each landing. After a merge by
  other means, or after its line `land: the main checkout did not move`, run `git pull` in the
  main checkout.
- herdr 0.9.3, with the selected host's integration installed in its active configuration.
  Use `herdr integration status`; complete normal folder and inspected-hook trust before a run.
  The runner never answers those prompts. It ends a session only in a herdr pane. In another
  terminal you leave each session with `/exit`, and exact runner resume has no observed identity.
- Superpowers installed and enabled on the selected host. The README holds its setup for each
  host. A missing required `superpowers:*` skill stops the lane.
- For Codex children with model tiers, the profile and current runtime allowlist from
  `docs/capability.md`. With no profile, each Codex child keeps the parent's model.
  The actual dispatch surface must support the resolved model and effort and the required
  same-child follow-up controls. CLI and desktop capabilities can differ.
- The board has more requirements: "The board" names them.

## Start the script

```bash
celetis --agent <host> celetis-flow            # the automatic runner; it does not end
celetis --agent <host> celetis-flow 373 374    # a start with numbers; it takes the issues in this order and ends
celetis --agent <host> celetis-flow --resume 373    # the session of a step with no progress, again
```

These human commands use `CELETIS_AGENT`, then `host` in the main checkout's `.celetis.yaml`,
then Claude. Put `--agent claude` or `--agent codex` before `celetis-flow` to override that choice.
Every skill call supplies that prefix. Invalid host values stop; PATH order never chooses a host.
The selected host stays fixed for the new step. Resume instead selects its recorded host and
rejects an explicit prefix that names the other host.

An argument is `<n>`, or `'#<n>'` in quotes. A shell can read an unquoted word that starts with `#`
as the start of a comment: the script then gets neither that word nor the words after it, and with
no number it starts the automatic runner. Each line of the script starts with `celetis-flow: `,
apart from its usage line.

**A start with numbers** does this for each issue. It reads the decision of the issue from the
in-process resolver (`nextIssue` of `next-step.ts`), a Run of a step or a stop, and starts the step
of a Run, whatever its gate. When the session ends, it reads the decision again and starts each
next step whose gate is `auto`. It ends the issue at the first of these, in this order: a stop,
the same step again ("no progress"), a refused skip, or a `me` gate. With the default gates, each
next step is a `me` step, so a start with a number runs one step of that issue.

**A refused skip.** Between two steps of one start, the script refuses a next step that skips a
step of its lane. Let S be the step that ended, and T the next step in the lane of the decision.
T can start when its position in the lane is at most one more than the position of S. A session
of `bug` also writes the plan (step 7 of `/celetis:bug`), so in the lane `bug` the script takes
the position of `plan` for S = `bug`. When S is not a step of that lane (a lane change), T must be
the first or the second step of the lane. `triage` can always start. So `specify` → `plan`,
`bug` → `plan`, `bug` → `implement`, `plan` → `implement`, `specify` → `bug` after a relabel, and
`implement` → `plan` can start, and `triage` → `plan`, `specify` → `implement`, and
`triage` → `implement` cannot.
At a refusal
the script prints `#<n>: <T> skips <steps> after <S>; fix the issue, or start <T> by hand: celetis --agent <host> celetis-flow <n>`,
for example `#12: plan skips specify after triage; …`. It adds the row `<n>\t<run line of T>` to
the record and ends the issue. The skip check comes before the gate check, so a refused step with a
`me` gate also gets a row. The first step of a start with numbers, and the first step that the
automatic runner takes, have no skip check. So your start with the number is the override: it
starts T.

**The automatic runner** reads the decision of each open issue from the same resolver (`nextOpen`)
and takes the lowest open issue whose decision is a Run,
whose step has the gate `auto`, whose step has no row in the record, and
whose lock is free. It does the same work on that issue, but it starts no `me` step, and then it
asks again. It does not take a step that the script refused as a skip, because that step has a row
in the record. When no issue can start, when the issue started no session, or when the resolver cannot
read GitHub, it waits 60 seconds. It prints one line for the whole wait. While it waits,
`celetis --agent <host> next-step --open` shows the line of each open issue: a `stop` line gives the
cause, and a `run` line that does not start has a `me` gate, a row in the record, or the lock of
another script. To stop it, close its tab, or press ctrl+c while it waits. It reads open issues
only. With the default gates no step is `auto`, so the automatic runner starts nothing.

**The form `--resume <n>`** reopens the exact session from
`<git common dir>/celetis-flow/sessions/<n>.json`. It first takes the shared issue lock and keeps it
until the foreground exits. Under that lock, it reads and validates the current record, selects
its saved host and checkout, and runs `claude --resume <id>` or `codex resume --no-daemon <id>`. A missing or
invalid record stops with a recovery action. It makes no `gh` call or update and starts no completion watcher,
so the session stays open until you leave it. A Resume press of the board types this form ("The
board").

The script asks for no confirmation. A start with the number of an issue whose next step is
`implement`, `chore`, or `hotfix` builds the change and lands it with `celetis --agent <host> land` when
its checks are green, with no more act of yours. With an `auto` gate on a step, the script continues
through that step by itself.

Issue locks and the automatic-runner lock use shared Git refs under
`refs/celetis-flow/locks/`. Their owner records hold the runner and foreground PIDs and process
start times. Either live process keeps the lock, including after a killed runner; an exited
process does not. Claims and releases use Git compare-and-set, and foreground registration
updates all held locks in one transaction. Both hosts and manual resume share the issue lock.
`celetis --agent <host> land` keeps its separate `land-<n>.lock` in `<git common dir>/celetis-flow/`.
The `no-progress` file there has one row for each step that ended with no progress, and one row for
each step that the script refused as a skip. The automatic runner and the board read it. An
explicit issue start can start that step. `engine/lib/locks.ts` of the plugin owns the lock refs,
the owner records, the liveness check of an owner, and the record; the runner and the board use it.

## How a step runs

A session is one selected host process in the foreground of the tab, with its original terminal
input, in the main checkout. Claude starts `run /celetis:plan #402` as:

```bash
claude \
  --permission-mode auto \
  -n '#402 plan' \
  --append-system-prompt-file <program folder>/step-prompt.md \
  '/celetis:plan #402'
```

`<program folder>` is the version folder of the program that runs the runner.

Codex reads effective `developer_instructions` with `config/read`, preserves that text, and
appends the step text. It passes the combined value as one quoted `developer_instructions=...`
value after `-c`. Its prompt is `Use the celetis:plan skill for #402. Complete its Host entry startup reads before any response, including commentary.`
Every interactive Codex launch, including specify and exact resume, uses `--no-daemon` so its
hooks use the current pane's environment. The CLI must support that option; it was checked on
0.162.1. The runner retains the configured sandbox, approval, and model settings. No document
content is evaluated as shell code.

The lane uses the exact path returned by `celetis --agent <host> worktree`. The selected
[host operations](hosts/entry.md) bind its commands, files, instructions, and children to that
checkout; landing returns to the main checkout. Claude keeps its native worktree tools.
Codex's app worktree does not replace the lane checkout. `step-prompt.md` is the step text: no start
of a step that a skill sends to a fresh context, when to ask, the limits on landing, what a session
does at a stop, and what it does with a Verify scenario that it cannot
run. A step session is a session that the runner starts with the step text. The exit status of
the host decides nothing: the resolver decides.

The session of `specify` is the one session with no step text, so it is no step session. For
`run /celetis:feature #402`:

```bash
claude --permission-mode auto -n '#402 specify' '/celetis:feature #402'
```

Rule 2 of the step text tells a session to publish with no wait for a review. `specify` publishes
the spec only after you approve the design, and nothing checks the design again after the publish.
So that session asks and waits as a session that you start by hand does (ADR-0007).
Codex also omits the step-text override for specify. Its configured developer instructions remain.

**The program and the plugin.** The runner uses the version folder of the program that started it
for its resolver, entry, and step text. Numbered starts, automatic starts, and later steps make no update call.
The form `--resume` keeps its no-update behavior and saved identity.
Before a step starts, the runner checks that its required files and step text still exist.
Before each new step session, it also compares the installed revision of the plugin of the
session's host with its own revision (`requireSameRevision` of `engine/update.ts`). On a
difference it starts no session, writes no session record, and ends with
`celetis: the <host> plugin is at <12> and this program is at <12>; run celetis update, then start the runner again`.
So the skills, the step text, and the engine of a step session have one revision. `--resume` has
no such check. The check reads the Git source of the plugin, so an installation whose marketplace
source is not Git, such as a local Codex marketplace, cannot start a new step session.
Known concrete policy conflicts are diagnosed. Running consumers do not reserve the update mutex. Run and exact Resume bind their Codex session to the active
installed root through a command-only Local marketplace. Native catalog, manifest, and cache
version checks prove the refresh no-op for Git and local installations. A Git SHA ref alone can
force same-revision replacement and is reserved for approved application. External package
edits remain outside the update protocol. Metadata RPC disables plugins before app-server construction, so
read-only thread and configuration checks do not trigger startup refresh.

[Updates](../README.md#updates) owns the read-only check, terminal-confirmed one-command update,
its updater mutex and deadline, and native cache replacement. Sessions may remain open; a fresh
session loads updated skills and tools. A runner restart alone updates nothing; after
`celetis update`, a new start runs the new program.

**The step end.** In a herdr pane (`HERDR_ENV=1` and a valid `HERDR_PANE_ID`), the script names its
tab `#<n> <step>` with `herdr tab rename "$HERDR_TAB_ID"`, so the
board links the session to the issue. It also starts a job in the background that ends the session:

1. The script starts each Claude step with a new session ID (`--session-id`). Before the session
   starts, it reports that ID to herdr for its pane with `herdr pane report-agent-session`, source
   `herdr:claude`, and start source `clear`. herdr keeps the previous Claude ID while the runner
   keeps the foreground ([ADR-0039](adr/0039-the-runner-announces-the-claude-session-id-to-herdr.md)).
   The job then waits for the selected host's new identity and a saved turn in the correct
   checkout, for 60 seconds at most. It saves the verified ID in the current session record.
2. It waits until the agent is ready for the next prompt:
   `herdr agent wait <pane> --until idle --until done`.
3. It verifies the current host, identity, readiness, and idle/done state, then reads the
   decision of the issue from the in-process resolver of `next-step.ts`. A decision with a result
   other than the result that started the session permits an exit check: a Run of another step,
   or a stop of the issue. A stop from an observation (the dirty tree, a landing that runs, or a
   failed read) permits none. The job reads the resolver again, and that read must give the same
   result. It then makes a final session-state check. A blocked or unknown state gets no exit.
   For Codex, it requests exit with `herdr agent send-keys <pane> ctrl+c ctrl+c`, which clears
   unsent composer text and requests native quit without submitting a chat message. Completion
   can discard a draft. For Claude, it keeps `herdr agent prompt <pane> /exit`. A failed request
   leaves the session open and prints a recovery action.
4. Otherwise it waits up to five seconds for working or blocked state, pauses one second, and
   checks again. This also permits a new resolver check while the session remains idle.

Two decisions have the same result when both are a Run of the same step, or both are a stop with
the same reason, variant, and data (for example, the labels of a stop for several lane labels). The
state and the lane are not part of the result. So when `implement` removes `ready-for-agent`, the
issue goes from planned to built, the result stays a Run of `implement`, and the session stays open.
The two variants of `ready-for-human` (`landing refused` and `ready for your step`) print the same
line, but they are two results. When the variant changes between the two reads of one check, the
job sends no exit input at that check, and it checks again at the next idle moment.

The runner waits for the foreground process to exit before it releases a lock or starts the
next step. Successful input delivery alone is not completion. After a successful request, the
job waits for the owned host process to exit. If it stays alive for 10 seconds, the job prints
one recovery message and keeps waiting. Process exit cancels that diagnostic timer. The job
does not repeat the request or force-kill the host. If a UI state consumes the keys without
exiting, exit the session in its pane when ready.

In each other case the session stays open: a decision with the same result, the dirty-tree line,
the line of a landing that runs, the cannot-read line, and a resolver read that fails. So a
session whose agent waits for an answer, waits for a background task, or left an uncommitted file
stays open, and a session that you start by hand never ends by itself. herdr ends a wait when its agent exits, so the job
ends with the session, and the script stops the job when the host process ends. When a session does not end
and its agent waits for nothing, leave it with `/exit`: the script then asks the resolver again,
and it prints the reason or starts the next step. Outside herdr the script starts no job and makes
no `herdr` call.

**A stop.** A step session hands a stop that is not a question to the issue (rule 4 of the step
text), through the write command
`celetis --agent <host> issue`
(`docs/issue-tracker.md`, "Conventions"). The reason is a comment: the comment that its skill
posts for the stop (`## Landing refused`, `## Before landing`), else a comment with `## Stopped` as
its first line. When the skill adds no label for the stop, the session then adds `ready-for-human`
as its last act (the act `stopped` posts the `## Stopped` comment, then adds the label), so the
line becomes `stop #<n> is ready-for-human. …` and the job ends the session. A stop for which
the skill adds a label, such as the `needs-info` stop of `/celetis:triage`, stays as the skill says.
A question is not a stop: where a skill says to ask, rule 2 holds, and a session that asks for a
decision waits in its pane. A Verify scenario that the session cannot run is a `## Before landing`
stop (rule 5): the session does not land the change. The act `before-landing` posts the comment,
then adds `ready-for-human`, then removes `ready-for-agent`, which marks the change as built. A
label write that fails after the comment, or a session that ends during the act, leaves the
comment with no `ready-for-human`. The line then becomes `stop #<n> has an open human step. …` (the `human-step`
stop): the absence of the label is no evidence that the human step is done, so no step starts. Do
the act that the line names. When `ready-for-agent` stayed on the issue, the next run then builds
and verifies the change again. A `specify` session and a session that you start by hand have no
step text: at such a stop they show the message and stay open (ADR-0011).

After a stop with `ready-for-human`, do the act of the stop, remove the label, and start the step
again. A `## Stopped` or `## Before landing` comment names the act. For a refused landing of
`/celetis:implement` or `/celetis:chore`, fix a cause outside the change (for example, run the
failed job again, or land a chore that removes the advisory of a dependency): the next run of the
step fixes a cause that the change made, lands the change, and does not build it again. For a Verify
scenario, the act is a run of the scenario. After a PASS and the removal of the label, the next run
of `/celetis:implement` lands the built change. A comment that names an act of "During the build",
or a comment with no marker of its kind, also needs a `## Human steps done` report of the act.
After a FAIL, keep the label: put the result on the issue, run
`/celetis:plan #<n>` in a session of your own, and remove the label when the new plan is on the
issue. Re-entry requires completion evidence for the current build: the maintainer's later
label-removal event or a trusted completion report, and both for an act of "During the build" and
for a comment with no marker, as `docs/issue-tracker.md` specifies. Label
absence alone does not clear the precondition: the resolver stops an issue with no such evidence
with `stop #<n> has an open human step. …`. For a hotfix whose landing
stopped, the checklist of step 7 of `skills/hotfix/SKILL.md` of the plugin holds your acts: remove
`ready-for-human` first, because the landing script refuses while the label is on, then land with
`celetis --agent <host> land` in your own shell. The step does not run again.
After the removal, and until the landing, the line is
`stop #<n> waits for a landing by hand. …` (the `land-by-hand` stop), so no new hotfix session
starts. A `## Before landing` comment with no marker also needs its `## Human steps done` report:
until then, the line is the `human-step` stop.

**The human acts of a plan.** The plan names them in its first section, `### Your steps`. Do each
act of "During the build" while the build runs, and report the acts in one `## Human steps done`
comment. A build that needs an act with no report runs each other scenario. Then it stops with one
`## Before landing` comment that names each such act, its report form, and the scenarios that wait
for it. The act `before-landing` gives that comment the marker of "During the build", so the engine
needs both the report and the removal. Post the report, then remove `ready-for-human`: the next
run of `/celetis:implement` runs those scenarios and lands on a PASS. A check of "After the landing" is no stop. The last message of
`/celetis:implement` quotes it after the landing, and a FAIL is a new bug (`/celetis:bug`).

A `specify` session starts with the line `run /celetis:feature #<n>`. The paths of `specify` give
three lines that end it: `run /celetis:plan #<n>` (the spec is on the issue),
`stop #<n> is an epic. Each child runs its own flow.` (the scope check made the issue an epic), and
`stop #<n> is closed as wontfix.` (`specify` rejected the design). While you answer its questions,
the line stays the same, and the session stays open. A session that ends while the line is still
`run /celetis:feature #<n>`, as after a spike, is "no progress". A lane change in step 1 of
`/celetis:feature` moves the line too, for example to `run /celetis:bug #<n>`: the session ends at
its next idle moment, and a Run press starts that lane.

**A landing.** `celetis --agent <host> land` moves the line of the issue when it merges, and it then closes
the epic and removes the worktree. While it runs, `celetis --agent <host> next-step <n>` prints
`stop the landing of #<n> runs; wait until celetis --agent <host> land ends`. That line is the stop of an
observation, not a stop of the issue, so the job does not end the session. herdr 0.9.3 reads an
agent that waits for a background command as `done`, then `idle` (read on a live herdr on 2026-10-11). So while the script
runs, for up to 30 minutes, the board shows the session in Needs you as `turn ended`: do not leave
that session. If a session ended during a landing, wait until `celetis --agent <host> next-step <n>` prints
another line, and then run `celetis --agent <host> land <n> '<subject>'` again from the main checkout: it
completes the landing. After the merge the issue is finished, so Run and
`celetis --agent <host> celetis-flow <n>` start nothing, and no card shows the lane worktree and the branch
that stay. `celetis --agent <host> worktree --remove <n>` also removes them after the merge of the PR; it
does not close the epic.

Before each push, PR, re-run of a check, and merge, `land` reads the issue again, as it reads the
Git state again. It refuses an issue that is not ready to land: the issue is closed; it has no lane
label, two lane labels, or `epic`; it has `needs-info` or `ready-for-human`; it has an open human
step; or the change of a `feature` or a `bug` is not built. These are the rules of the resolver
(`landable` in `engine/lib/workflow.ts` of the plugin), and the refusal quotes the resolver line of
the issue, for example
`land: prerequisite: #<n> is not ready to land: stop #<n> is ready-for-human. …`. A change that is
already on the trunk (its merge tree is the tree of the trunk, or a merged PR into the trunk has
the lane tip as its head) skips
this check, so a second run after a stopped cleanup completes the cleanup on the closed issue.
The exit status and the first word after `land: ` give the result:

| Status | First word | Result | Examples |
|---|---|---|---|
| 0 | none | landed | `land: #<n> is on <trunk>`; also with a warning, for example `land: cannot read the parent of #<n>; close its epic by hand: …` |
| 1 | none | an internal error of `land` | an unexpected exception |
| 2 | `usage` | usage | bad arguments (the line starts with `usage: `); a run from inside the lane worktree; a dirty lane worktree; no lane branch; nothing to land; an invalid configuration |
| 3 | `prerequisite` | the issue is not ready to land | the refusals of the paragraph above |
| 4 | `repair` | the lane needs a repair | a conflict with the trunk; a lane branch that does not contain the head of the trunk; a trunk head, a lane branch, a lane checkout, or a PR that changed during the landing; a missing lane worktree with the landing `merge` |
| 5 | `checks` | a check is not green | a failed CI check, also after its re-run; a failed `suite` with the landing `merge` (`docs/configuration.md`) |
| 6 | `blocked` | an external block | GitHub does not answer or refuses an act; a fetch or a push fails; the checks did not finish; no check ran; the main checkout is dirty, off the trunk, or not level; the landing mechanism or the default branch changed; two branches or two PRs match |
| 7 | `cleanup` | landed, the cleanup stopped | the change is on the trunk, and the removal, the pull of the main checkout, or the close of the issue stopped: run `land` again |
| 128+n | none | a signal | a signal stopped `land` before it put the change on the trunk or found it there; a later signal gives 7 |

## Gates

Each step has a gate. An `auto` step starts by itself. A `me` step starts only as the first step of
a start with numbers. The step is the command of the `run` line with no prefix: `triage`, `bug`,
`chore`, `hotfix`, `plan`, or `implement`. One command has another step name:
`run /celetis:feature #<n>`, the line of an `enhancement` with no spec, is the step `specify`.

`gates` in the main checkout's `.celetis.yaml` holds the project gates. Each omitted step is
`me`. The only values are `me` and `auto`; a wrong value stops the command. Git gate settings
have no effect. The default gates start one step for each number or Run press. With `specify`
as `auto`, the runner starts a design session and waits for your first answer.

```yaml
landing: pr
gates:
  implement: auto
```

## The config and the custom parts

**The config.** Operational settings are in the main checkout's `.celetis.yaml`, including when
commands start in a lane or subfolder. `docs/configuration.md` gives the full schema. The record
of setup, `.claude/celetis-flow/wiring.json`, is no config: only `celetis --agent <host> setup` reads it.

- `host` selects the default host for a new step ("Start the script").
- `gates` selects `me` or `auto` for each step ("Gates").
- `landing` selects `pr` or `merge` for `celetis --agent <host> land` (`docs/issue-tracker.md`).
- `board.port` selects the board port ("The board").
- `codexProfiles.<runtime>` supplies an optional dispatch profile for model tiers
  (`docs/capability.md`).

A missing or invalid required config stops before branch or worktree changes, locks, runtime
state, host sessions, or landing pushes. A public command creates an immutable operation after
the program starts it. Internal calls receive its values instead of reading again.
The runner creates a fresh main operation before each new step. Its resolution, gate decision,
and session start use that operation. It retains the original host-selection inputs, so a changed
YAML default can select the next new session. A running session keeps its captured host and exact
identity. Monitoring can refresh status separately; a monitoring config error is reported after
the active child exits. Resume uses the recorded host and exact session ID; a changed default
cannot select another saved session. [Configuration freshness](configuration.md#operation-values-and-freshness)
defines the remaining boundaries, including landing's fresh policy and repository preflight
after waits and before protected actions. A changed landing mechanism requires a new invocation.
Installation discovery with an explicit host and standalone capability scoring with explicit
inputs remain available outside a repository. They need no project config.

**The worktree setup.** `celetis --agent <host> worktree <n>` creates the lane worktree and its branch
(`docs/issue-tracker.md`, "Branches, PRs, merge"). On each entry,
`gh api 'repos/{owner}/{repo}' --jq .default_branch` gives the trunk, and the command fetches it
from `origin`. A new branch starts at that trunk. An existing branch comes up to it before the
config check (`docs/issue-tracker.md`, "Branches, PRs, merge"). The command checks `.celetis.yaml`
in the lane before setup. It reads `worktreeSetup`
as one TypeScript string and writes its exact bytes to a private 0600 temporary file outside
both the main checkout and lane. The selected Bun runs it in the lane. `process.argv[2]` is the
absolute main checkout. Stdin, stdout, and stderr stay inherited. Check each external command
status and stop on failure. After nonempty setup output, the command prints an LF separator and
the final absolute lane path. `setup try` also prints its path after preparation or execution
failure. Signals remove the temporary file and stop the owned child.
An omitted or empty setup runs no script.

A failed setup or invalid new lane config prints `worktree setup failed:` and removes a new
worktree and a branch created by the command. Configuration validation exits 2 after cleanup;
ordinary setup and Git failures keep their existing statuses. An existing branch or worktree
stays for repair and retry. A refused update of an existing branch prints its own reason, not
`worktree setup failed:`, and uses the same cleanup. Entry into the target lane creates a fresh
operation before setup or marker acceptance. Setup validates again after it writes or selects a
different file.
The marker remains
`<git dir of the worktree>/celetis-flow-setup-done`. The command writes it only after a script that
is not empty succeeded. With an empty or missing `worktreeSetup`, it writes no marker. It runs
setup again in an unmarked lane, so a script that a merge of the trunk brings runs at the next
entry. A marked lane still needs valid config, but does not run setup again. A lane that has a
marker keeps it; `celetis --agent <host> setup lane <path>` runs the script there. Reading config in
another command never executes setup.

**A custom part.** `custom.<skill>` in the active checkout's `.celetis.yaml` holds an
addition to that skill's procedure, for example a check on a real device after the build.
The text cannot remove a general rule. An added act comes before the skill moves the line
of the issue, because the runner ends the session when the issue shows that the step is done.
Domain knowledge stays in the `AGENTS.md` files (ADR-0006).

Each `SKILL.md` starts with the common host entry, which reads the whole config once through
the running host's supported file access before any step or answer and applies only its target string (ADR-0013).
Claude's native hook supplies metadata and permission-checked `Read` results before the
model sees the entry; filename search alone proves no file kind. Codex uses available supported
access, including shell commands, dedicated readers, or runtime file APIs on its actual surface.
The agent applies the schema in `docs/configuration.md`; Codex can use the existing config reader.
Entry executes no setup and consumes no runtime snapshot. A file read alone proves no
deterministic parser check.
`docs/hosts/entry.md` and the selected host reference own the entry rules.

- **Which checkout.** Locate the active root from session context and file tools, including
  a linked checkout's `.git` file. A runner step starts in the main checkout. A later skill
  entered in a lane uses that lane's config. Read no parent config and combine no files.
- **With no checkout or config,** continue with the common skill. Omitted or empty custom
  values also give no addition. An existing invalid, ambiguous, unreadable, or symlink config
  stops entry with the file and field.
- **When file access needs approval,** request it through the normal controls. A denied read
  stops; use no other tool or shell to retry it.
- **When a skill borrows another skill's rules,** enter that reference and apply its
  `custom.<skill>` once. Reuse that entry for later sections. A same-session handoff or an
  intentional new invocation creates a new entry and reads the active config once again.

## The board

The board is `engine/board/` of the plugin, a part of its engine. It reads the data of the issues
in its own process with the typed functions of the engine, and a press types one of two fixed
command lines into a new herdr tab. It has no config of its own: the main checkout's `.celetis.yaml`
gives `board.port` at the start, and `host` and `gates` at each read. ADR-0020 makes the board a
part of the plugin, and ADR-0035 makes it a part of the engine.

**Requirements.** Bun 1.4.4 or later; Git 2.31 or later; herdr 0.9.3 and a
running server; and a Chromium browser. The board reads GitHub with `gh`, as the runner does, and
needs no GitHub credentials of its own. The read needs `gh` (logged in), `git`, and Bun, and `ps`
on macOS and Linux. The script requirements above apply to Run and Resume.

**Start the board** in the main checkout or a subfolder:

```bash
celetis --agent <host> board
PORT=4500 celetis --agent <host> board
```

The command takes no arguments. It fully validates the main YAML, refuses a lane start, and checks
the plugin update policy of the selected host once. `--agent` selects the host of the board process
only: its policy check and, for Codex, its `CODEX_HOME`. The start reads no program: each Run and
Resume reads the installed program at the press ("Run and Resume"). The start prints two lines,
the main checkout and the URL:

```text
agent-board: repository /Users/me/code/shop
agent-board: http://127.0.0.1:4403
```

The listening port is `PORT`, else `board.port` of the main YAML, else 4403. It remains fixed until
restart. This repository uses 4404. A native desktop preview entry, when used, starts the same
program and uses the same port (`README.md`, "Optional: the board in Claude desktop").
`engine/board/README.md` gives each refusal of the start.

**The data.** Each refresh reads the data in the board process (`engine/board/data.ts`). It creates
a fresh main operation with `CELETIS_AGENT` and no explicit host. It reads the typed rows of the
in-process resolver (`nextBoard` of `next-step.ts`), and the issue locks, the runner lock, and the
record through `engine/lib/locks.ts`, the module of the runner. So resolution, displayed gates, and
the default host share that refresh's operation, and a change of `host` or `gates` in the main YAML
shows at the next refresh. Each module of this path is a static import: a refresh loads no plugin
file, takes no plugin read lock, and checks no update policy. The board checks that policy once,
at its start. Each Run and Resume starts a new `celetis-flow` process, which makes its own check. So
a conflict that starts while the board runs shows in the pane of the next Run or Resume, not on the
status line of the board.

The resolver makes these `gh api` calls: 3 paginated lists (open issues, closed issues, open PRs),
one paginated call for the timeline of each open issue that has a comment, and 3 calls for each
open PR whose branch holds `/<number>-`. It gives each row the state that it knows from GitHub and
from the working trees: `done`, `blocked` with `reason` and `act`, `ready`, or `dirty` with `path`.
It also gives the `noRun` text for a dirty main checkout. The board adds what the runner knows:
`starting` for a lock that a live script holds, `stuck` with its `act` for a row of the record, the
`step`, `started`, and `urgent` of each row, `runner`, `tracker`, and `flow` with the gate of each
step.

A read has a limit of 60 seconds, and the stop of the board also stops a read. On a failure, the
board keeps its last document and shows one line after `cannot read:` on its status line:

- an invalid main YAML: the first line of the diagnostic of the config reader;
- a resolver that cannot read GitHub: the first line of the resolver's stderr, else
  `cannot read the issues from GitHub`;
- a read that passes 60 seconds: `the issue read did not end in 60 seconds`;
- another failure: the first line of its message, else `the issue read failed`.

The board runs the data code that it loaded at its start. After `celetis update`, start the board
again for new data code, as for new server code.

The board puts these values in the fields of its document (`Document` of `engine/board/types.ts`):

| Field | Value |
|---|---|
| `tracker` | `GitHub` |
| `flow.lanes` | The four lanes: `feature` (triage, specify, plan, implement), `bug` (triage, bug, plan, implement), `chore` (triage, chore), and `hotfix` (triage, hotfix). |
| `flow.stages` | Triage, Define (specify, bug, chore, hotfix), Plan, and Implement. |
| `flow.steps.<step>.gate` | The gate of each of the seven steps, by the rule of "Gates". |
| `flow.steps.<step>.hint` | `It lands the change when the build is done.` for `implement`, `chore`, and `hotfix`. No other step has a hint. |
| `noRun` | `The main checkout is dirty: <path>. Commit or stash first.` while the main checkout is dirty, else `null`. |
| `runner` | `true` while a live automatic runner holds its lock. |
| `agents` | Entries `claude` and `codex`. Each has `available: true` and `cause: null` when its executable is on the `PATH` of the board, else `available: false` and `cause: "celetis: <agent> is not on PATH"`. |
| `defaultAgent` | The agent selected by `CELETIS_AGENT`, `host` in the main YAML, or the default `claude`, in that order. The `--agent` of the board start does not set it. |
| `issues` | One row for each open issue and for each issue that closed in the last 14 days. An issue whose line of the resolver is the epic line or the `wontfix` line has no row. |

A row gets its `state` by the first rule that matches:

| # | The issue | `state` | Fields of that state |
|---|---|---|---|
| 1 | is closed | `done` | `closedAt` |
| 2 | has a lock that a live script holds | `starting` | |
| 3 | has a dirty lane worktree | `dirty` | `path`: the lane worktree |
| 4 | has a row in the record for its `run` line: no progress, or a refused skip | `stuck` | `act`: `celetis --agent <host> celetis-flow --resume <n>` |
| 5 | has `needs-info` or `ready-for-human`, two or more lane labels, an open human step, a hotfix to land by hand, or a plan that is not marked or already built | `blocked` | `reason`, from the first match in the order of the resolver (`docs/issue-tracker.md`, "Resolving an issue's state"): `needs info` for `needs-info`; for `ready-for-human`, `landing refused` while a landing refusal is current, else `ready for your step`; `several lane labels` for two or more lane labels; `human step open` for a `## Before landing` comment with no completion evidence; `land by hand` for a hotfix whose stop the maintainer cleared; `plan not marked` for a plan with no `ready-for-agent`; `plan already built` for `ready-for-agent` on a built plan. `act`: the act that the `stop` line of the issue names |
| 6 | has a `run` line | `ready` | |

Each row also has `number`, `title`, `url`, `updatedAt`, `closedAt`, and these fields:

- `type`: the lane of the one lane label of the issue: `feature` (the label `enhancement`), `bug`,
  `chore`, or `hotfix`. It is `null` for an issue with no lane label, with two or more lane labels,
  or with `epic`, also in the row of an issue that is closed or that stops.
- `step`: the step of the Run decision of the issue, the step of its `run` line ("Gates"), else
  `null`.
- `started`: `true` when the step comes after the define step of its lane (`plan` or `implement`),
  because an earlier step of the lane ran.
- `urgent`: `true` for the type `hotfix`.
- `pr`: the open pull request whose branch name holds `/<n>-`, with its number, URL, draft state, CI
  result (`pass`, `fail`, `pending`, or `null`), and review state (`approved`, `changes`,
  `required`, or `null`); else `null`. For the review state, the last review of each reviewer that
  approves, requests changes, or is dismissed counts. The review state is `changes` when one of
  those reviews requests changes, else `approved` when one approves, else `required` when a
  requested reviewer or team has not answered, else `null`.

**Run and Resume.** The adapter types two fixed lines. Each item is in single quotes for the pane
shell, the issue number is its digits, and ` && exit` ends the line. At each press, the adapter
reads the installed program (`readProgram` of `engine/lib/program.ts`). `<command>` is its
command: `<base>/.local/bin/celetis`, or `<base>\.local\bin\celetis.cmd` on Windows, where
`<base>` is `CELETIS_HOME` or the home folder. The read refuses an entry that is not a file of the
program, so the command always starts the program in its version folder, and the command path
has no control character. The program supplies Bun and its isolation flags (ADR-0042). A missing
program, a failed read, or a saved record that Resume cannot use returns 409 with the first line
of the error, before tab creation or pane execution. Read-only herdr status calls can precede that
failure.

```text
'<command>' '--agent' '<agent>' 'celetis-flow' <n> && exit
'<command>' 'celetis-flow' '--resume' <n> && exit
```

On Windows, the default pane shell of herdr is Windows PowerShell 5.1. There each line starts the
command with `&`, the quote doubles `'` and each of U+2018 to U+201B, and `; if ($?) { exit }`
ends the line in place of ` && exit`, with the same result:

```text
& '<command>' '--agent' '<agent>' 'celetis-flow' <n>; if ($?) { exit }
& '<command>' 'celetis-flow' '--resume' <n>; if ($?) { exit }
```

Run opens a quiet tab `#<n> <step>` in the herdr workspace of the repository and types its line.
Resume opens a focused tab and types its line. The exit at the end of the line closes the tab on
success; a failed script leaves its message there. With the default `me` gates, a Run starts one
step and ends when its session ends.

`POST /api/run` uses the chosen agent, or `defaultAgent` when no choice is supplied. The agent must
be a name of `agents` of the last document, and available. Unknown or unavailable choices return
409 and start no agent. Availability checks only executable presence; sign-in, trust, plugin
discovery, and full host parity need separate checks. Run does not change the project default. Set
that default with `host` in the main YAML; `CELETIS_AGENT` overrides it.

Resume has no `--agent`. It uses the host and exact ID in the saved record, even after the project
default changes.

The board shows the default as read-only in its agent menu and command palette. A valid trusted
`POST /api/agent` returns 409 with `The main .celetis.yaml controls the default agent. Change host there.`
It changes no YAML or Git setting. Change `host` in the main YAML to set the project default.

An update does not stop the board. Each Run and Resume reads the installed program again; the
adapter keeps no program path between presses. After `celetis update`, the next press starts the
new program with no board restart. New board code still needs a board restart: the board runs the
code of the version folder that started it. Reload or restart the board if an update removes a
file that it still needs. Follow [Updates](../README.md#updates) for manual updates.
Real Run/Resume acceptance remains a separate live gate.

**The page.** [`engine/board/README.md`](../engine/board/README.md) of the plugin holds the page: the
columns and the card of each state, the layout, the keys, the buttons Run, Resume,
Open shell, and Go, the errors, the start refusals, the HTTP API, the trust boundary, and the limits
of the page.

## What the script prints, and your act

| The script prints | The maintainer's act | Then |
|---|---|---|
| `stop … needs info` or `stop … ready-for-human` | do what the line says; for `ready-for-human`, the latest `## Stopped` or `## Before landing` comment names the act, and "How a step runs", **A stop**, gives the act after a refused landing. The card of an issue with a current landing refusal reads `landing refused`: its `## Landing refused` comment names the cause | the next step starts with a Run press or with `celetis --agent <host> celetis-flow <n>`; the automatic runner starts it only when its gate is `auto` |
| `stop … has several lane labels …` | keep one lane label and remove the others | as the first row |
| `stop … has an open human step. …` | do what the line says: the latest `## Before landing` comment names the act. The line names the evidence that is missing: a `## Human steps done` report and the removal of `ready-for-human` after the comment, the report, or the removal (`docs/issue-tracker.md`, "Completing a human precondition") | as the first row |
| `stop … waits for a landing by hand. …` | run `land` in your own shell, from the main checkout, as the line says | none: the landing finishes the issue |
| `stop … has a plan with no ready-for-agent. …` | add `ready-for-agent` to build the latest `## Plan` comment, or run `/celetis:plan #<n>` for a new plan | as the first row |
| `stop … has ready-for-agent on a built plan. …` | remove `ready-for-agent` to land the built change, or run `/celetis:plan #<n>` for a new plan | as the first row |
| `stop … is an epic` | none: each child is an open issue with its own flow | — |
| `stop … is finished` or `stop … is closed as wontfix` | none | — |
| `stop the working tree is dirty …` | commit or stash | as the first row |
| `stop the landing of #<n> runs …` | none: a session lands the issue | start the script again when the landing ended |
| `stop cannot read … from GitHub` | check `gh auth status`, the network, and the REST rate limit (`gh api rate_limit`) | the automatic runner tries again by itself; press Refresh on the board |
| a `me` gate | a Run press on the card, or `celetis --agent <host> celetis-flow <n>` | — |
| `no progress: /celetis:feature #<n>` | the session ended with no spec on the issue: open the session again, or read the comment of a spike | a Run press, or `celetis --agent <host> celetis-flow <n>` |
| `no progress:` with another command | open the session again, or read the issue | a Run press, or `celetis --agent <host> celetis-flow <n>` |
| `#<n>: <T> skips <steps> after <S>; …` | read the issue ("A refused skip"). When a label or a heading is wrong, fix the issue. When the skip is correct, start `<T>` by hand | a Run press, or `celetis --agent <host> celetis-flow <n>`, starts the next step; the automatic runner does not start a refused step |

A Run press runs the script in a new herdr tab. A script that ends with no error closes its tab, so
read the state on the card of the issue: "The board" gives the state of each issue, and
`engine/board/README.md` of the plugin gives the card of each state.

`stop … is finished` means that the issue is closed with no `wontfix` label. After a landing, the
change is on the trunk.

## Guards

The README's host permission sections are the source for the rules and their checks. Claude
uses `.claude/settings.json`; Codex uses a trusted `.codex/rules/` configuration. Both cover the
current bare and explicit-host landing forms and restrict direct `gh pr merge`. The plugin does
not grant permissions. Retain each product project's own restricted acts.

The landing script is the required agent path. Before a push, a PR, a re-run, or a merge, it
refuses each unmet lifecycle prerequisite of the issue ("How a step runs", **A landing**). The
script holds this guard for each caller: a session, the maintainer in a shell, and the hotfix
checklist. With `pr`, it merges only the issue's lane PR on
the trunk, at the checked commit, with every check passed or skipped and at least one PASS.
Each invocation waits for workflow completion before it accepts green checks, including when a
dependent job has no check row yet.
When each red check is a check of GitHub Actions that failed or timed out, it re-runs the failed
jobs of their workflow runs once for each commit before it refuses (ADR-0023).
The main and lane checkout guards apply on both hosts. Host rules do not inspect the commands
inside an allowed script or enforce every alternate command spelling. Codex prefix rules govern
requests outside its sandbox; they do not create a stronger sandbox. A host refusal remains a
stop. The deterministic script checks and final Verify results remain required (ADR-0008).

## Sessions

The herdr tab label is `#<n> <step>`. It links the live card to the issue on the board. The label
is not the saved session ID. From the main checkout, `celetis --agent <host> celetis-flow --resume 402`
first takes the shared issue lock and keeps it until the foreground exits. Under that lock, it
reads and validates the current record for #402 and opens its exact host and session ID.
No completion job or update runs during resume.

A missing or invalid record stops with a recovery action. A record with no verified ID directs
you to `claude --resume` or `codex resume --no-daemon`, by its saved host, to select a saved session manually.
Exact runner resume needs the identity from herdr and a saved turn. A resumed session stays open
until you leave it.

The record at `<git common dir>/celetis-flow/sessions/<n>.json` has exactly six fields:
`schema: 1`, `host`, `issue`, `step`, absolute main `checkout`, and `session_id` (UUID or null).
The runner writes it atomically. It accepts no old record format and makes no migration.
Herdr supplies `result.agent.agent_session.value`; a tab name is never an identity.
For a Claude step in a herdr pane, the runner chooses that ID and reports it to herdr before the
session starts ([ADR-0039](adr/0039-the-runner-announces-the-claude-session-id-to-herdr.md)).
Claude persistence is a current saved user turn with matching ID, cwd, and launch time.
Codex verifies `thread/read` and `thread/turns/list` without resuming or starting a model turn.

If startup cannot verify identity and a saved turn within 60 seconds, the runner prints the
host and local pane output with a recovery action. It leaves the foreground open and writes no
false no-progress row. Complete the normal setup action, then retry. A record with a null ID
cannot be used for exact runner resume.

## Acceptance status

Automatic flows are required for Claude Code and Codex TUI/CLI. In this acceptance policy,
"both hosts" means those two CLI hosts. The terminal runner and board actions target those CLIs.
The shared flows remain callable manually or inline in the Codex desktop app; desktop automation
is optional. A missing desktop automation capability or an incomplete optional desktop check
does not block CLI development, CLI acceptance, or a change that satisfies its required checks.
ADR-0016 records this scope.

Codex is opt-in while required CLI acceptance remains open. These are observed versions and
results as of 2026-10-20, not a certified minimum-version range:

| Component | Evidence and limit |
|---|---|
| Codex CLI 0.162.1 | Private Git marketplace install and refresh, shared manifest discovery, effective configuration, and saved-turn API checks passed. A fresh 21-case step run passed with product instructions and the clarified startup text. These do not prove a full live workflow or native desktop selection |
| Claude Code 2.1.302 | The single-config Task 4 checks recorded 24 quoted cases and 24 native cases. The native result used 22 provider cases and two module-owned zero-usage stops, with strict event checks. Managed plugin setup and complete child bootstrap remain UNRUN. Changed inputs require fresh live results |
| Superpowers 7.0.0 | Installation on the isolated Codex Git configuration passed. Each active surface must still expose the dispatch and follow-up controls its procedures require |
| herdr 0.9.3 | The installed integrations report Claude v10 and Codex v8. Later reviewed-source Codex checks passed valid startup, real no-progress, and native exact Resume with a saved second turn. The resumed herdr reply still lacked `agent_session`. Claude recovery, compaction, and full workflow checks remain open |
| agent-board 2.0.0, tag commit `e36283b` (earlier storage) | Contract 1 and the current config path passed. Released-browser Open shell and partial Claude Run/Go passed. The earlier Codex Run stopped on a local-marketplace setup error; Claude later stopped on quota. Later reviewed-source Codex Run, Resume, and Go passed with the correct issue and pane. Full acceptance remains open |
| `board/` at source commit `95144d3` (ADR-0020; now `engine/board/`) | The board code of `95144d3` is the code of the release commit `2014361f365e03e18169ed75d602b729e25e03bb`. That release records a 322-test gate and read-only default-agent controls. The adapter and fixture Run/Resume checks of that release have separate evidence. Real browser/Herdr Run and Resume remain open |
| Bash 3.2.57, Perl 5.34.1, Node 26.11.1 | Historical gate and released-board evidence before ADR-0025. Current commands require Bun 1.4.4 or later |

[Issue #100](https://github.com/ddinkov10/celetis/issues/100) separately checked checkout native
entry on Claude Code 2.1.310 with `--plugin-dir` and Codex CLI 0.164.0 with explicit checkout
skill paths. Actual whole-file events covered main, lane, and subfolder selection, literal custom
text, first borrowed reference, repeated reference, and same-session handoff. Optional absence
continued; malformed, symlink, unreadable, and native permission-denied inputs stopped. Codex's
file-deny profile stopped at metadata access; a separate native command rule permitted metadata
and refused the whole-file read. No alternate read followed either denial. These checks used the
existing installations and authentication. They establish checkout instruction behavior, not an
installed-package update, a full lane, or closure of the other acceptance gaps below.

[Issue #101](https://github.com/ddinkov10/celetis/issues/101) changed the step end from a compare
of resolver lines to a compare of typed decisions ("The step end"). On 2026-10-26, with Claude
Code 2.1.310 and herdr 0.9.3, the runner of the checkout at commit `bd3db8a` ran `celetis-flow 1` in
a herdr tab, in a private product repository with a fake `gh`. A change with the same result (the
label `needs-triage` on an unrouted issue) kept the session open for 49 seconds after it was idle,
with no `/exit`. A change to a Run of `plan` that skips `specify` (the label `enhancement` and a
`Spec:` body) ended the session with `/exit` within 5 seconds. The runner then printed the refusal
line, exited 0, and recorded the row `1\trun /celetis:plan #1`. The triage session asked a type
question, and the check cancelled it with Esc to get the idle state. The live Codex step end of
that change is an open runtime check (Finding 2 of the plan of #101). The runner refuses a new
step session when the plugin of the session's host is at another revision than the program
(`requireSameRevision` of `engine/update.ts`). So the check needs an installed program and an
installed Codex plugin at one revision that holds the change.

[Issue #102](https://github.com/ddinkov10/celetis/issues/102) made the board read its data in its
own process and type two fixed lines ("The board"). On 2026-10-26, with Claude Code 2.1.310,
codex-cli 0.164.0, and herdr 0.9.3, a package copy of the lane at commit `0b18274` ran the board in
a private product repository with a fake `gh` and the real herdr. The start printed only the
repository line and the URL line, and the board read its document in process. Resume of a saved
Claude record opened the tab `#3 triage` in the product and typed the exact Resume line, with no
`--agent`. It continued the exact saved session (`claude --resume <id>`), and herdr reported the
same session ID. `/exit` closed the tab. Resume of a saved Codex record stopped in its tab with
`celetis: enabled package changed before session start; start a fresh runner`, because the copy is
not the enabled installed Codex root. Run with the default agent and Run with the choice `codex`
opened quiet tabs and typed the exact Run lines with `--agent claude` and `--agent codex`. With an
invalid main `.celetis.yaml`, the runner stopped on the `landing` diagnostic, and the tab stayed
open. The next refresh showed that line as the read error and kept the cards. A full Codex Run and
Resume from the installed package is an open runtime check, by hand after the landing (the plan of
#102, "Your steps"). A full Run session through the board was not observed, because a board tab
runs with the real `gh`.

On 2026-10-27, [issue #145](https://github.com/ddinkov10/celetis/issues/145) makes a board Codex Run
start from the enabled Codex copy; the live session remains the check of "After the landing" in
its plan. #126 then replaced the copy in the line with the command of the installed program
("Run and Resume", ADR-0042).

[Issue #103](https://github.com/ddinkov10/celetis/issues/103) added the write command `issue`, a
new command prefix for a step session. On 2026-10-26, with Claude Code 2.1.310 and codex-cli
0.164.0, a session in the main checkout ran the `issue` command of the lane checkout at commit
`4449a9a` on a disposable issue, in the quoted form of that release (`/usr/bin/env`, the Bun path,
the isolation flags, and the entry path of the lane): `issue <n> state`, then
`issue <n> wontfix <file>`. The prompt named the two commands.
`claude -p --permission-mode auto --append-system-prompt-file` with the step text ran both on
#132, with no refusal and no personal rule. Each exited 0. `codex exec` ran both on #133, with
the step text in `developer_instructions` and the configured settings: the `workspace-write`
sandbox with no network, `on-request` approval, and the automatic approval review. Each command
exited 6 with `issue: blocked: cannot read #133 from GitHub`,
`error connecting to api.github.com`, and
`check your internet connection or https://githubstatus.com`, and wrote nothing. The prompt said
not to get around a refusal, and the session did not ask for approval. A second prompt told the
session to ask for approval when the sandbox stops a command. The session asked to run each
command outside the sandbox, the review approved each request, and each command then exited 0
outside the sandbox. The timeline of each issue lists the comment, then
`labeled wontfix`, then `closed` (`not_planned`). So "Personal landing permission" in
`README.md` then also gave a rule for `issue`. The `issue` rule of each host, in the form of that
release, permitted the `state` command. Claude in `dontAsk` mode, with the rule in
`--settings`, refused another script, another sub-command, an inserted Bun option, another host,
another package path, two compound commands, and two shell injections. Each refusal started
`Permission to use Bash has been denied because Claude Code is running in don't ask mode.` With
no rule, it refused that command too. `codex execpolicy check` matched the argument list of
that command, and no list with another script, sub-command, Bun option, host, or package
path. It compares the list as given, so it does not show the shell split. A live Codex turn with
the rule in a trusted scratch project ran that command outside the sandbox with no approval
request. The two compound commands and the two shell injections ran in the sandbox and printed
`issue: blocked: cannot read #133 from GitHub`. A step session that runs the command from a
skill, and a Codex step session with the personal rule in the user configuration, are open
runtime checks.

**Historical hook-based #104 checks (2026-10-27).** The revised
[issue #104](https://github.com/ddinkov10/celetis/issues/104) replaces this hook prerequisite with
agent-reported execution records. The earlier build ran these checks. On 2026-10-27, Claude Code 2.1.311 and codex-cli 0.164.0 ran checkout commit
`9afc18d2a17ad014a823ea1e4a80802e412ef0cc` with disposable Git data; the prompts, stream
transcripts, native Codex trace, and record JSON are in `/tmp/celetis-104-check/live/`.
V3 passed with the checkout loaded by `--plugin-dir` in auto mode: Agent received `model: "haiku"`
and `effort: "low"`, recorded child `a75c095040e4a37ec`, and reported model `claude-haiku-5-5`.
The deliberate `effort: "high"` call was refused with `the spawn effort must be low`; the next
request named and voided dispatch `db50660f-8564-4e7d-9b09-dc3e394b2f63`, then allowed the corrected
`haiku`/`low` call as child `a95cb69ec28e0d84f`. A no-line Agent call started child
`ab1b8c98e30123a9d` with no entry. SendMessage with a new line resumed `a75c095040e4a37ec` and
recorded outcome `started`; the no-line message was refused with
`` a message to a recorded child needs a dispatch line from `dispatch next` ``. The record, shell,
and stream session IDs were all `b79161a6-b7e1-4870-a630-4830a087a653`. Each started outcome has
`effort: null`; the real argument is recorded, and applied effort is not inferred. Both V4
no-hook cases passed. Claude's `haiku`/`low` Agent started `adb7155424fc95fa0`; its next command
exited 5 with ``dispatch: setup: dispatch d2d2ce05-1ee0-4868-9c65-77dd22450912: the Celetis mod did not check the call: enable the plugin `celetis` and start a fresh session``.
Codex's real `spawn_agent` omitted `model`, set `reasoning_effort: "low"` and `fork_turns: "none"`,
and returned `/root/runtime_check`, linked by native activity to child thread
`01a17d70-081e-7962-bf6d-35f4e78e8171`; its next command exited 5 with
``dispatch: setup: dispatch 6913a000-00d0-4f26-a75b-c74bee7e9fdb: the Codex plugin hooks did not run: trust them in `/hooks` (docs/hosts/codex.md of the plugin `celetis`) and start a fresh session``.
Both pending records have no check or outcome. Codex's record session and `CODEX_SESSION_ID` were
`01a17d6f-df6b-7993-b2ab-1b66a5566694`; the command wrote under `/tmp/celetis-501/dispatch/` in its
`workspace-write` sandbox with no inner approval. Initial outer sandbox starts returned
`Not logged in · Please run /login` on Claude and
`Error: failed to initialize in-process app-server client: Operation not permitted (os error 1)`
on Codex; one approved retry of each same command completed with the existing authentication.
Historical V5 later failed on codex-cli 0.164.0 at `dda6d24`. Even with trusted hooks, the real
spawn returned `/root/runtime_check_a` in session `01a17e09-b7a1-70e3-8c04-d1802bfdd1f9` without a
hook check; the next act exited 5. The code-mode probe in session
`01a17e18-31ef-75f2-a39d-78f7356bce85` found no nested spawn tool. These are FAIL/STOP, not an open
test or a PASS. Evidence: issue comments [6446729138](https://github.com/ddinkov10/celetis/issues/104#issuecomment-6446729138)
and [6446922098](https://github.com/ddinkov10/celetis/issues/104#issuecomment-6446922098),
`/tmp/celetis-104-check/live/v5-codex.*`, and `replan-code-mode.*`. The revised #104 spec supersedes
this hook requirement. Independent native enforcement is [#151](https://github.com/ddinkov10/celetis/issues/151).
The installed-package checks of the old plan do not prove the revised report flow. Changed-pair
same-child repair remains unsupported by the observed follow-up controls. The real POSIX lock
checks and controlled Windows-helper FFI fixture passed; no live Windows DLL, filesystem,
reparse-point, descriptor-conversion, or `LockFileEx` check ran. The fixture is not live Windows
acceptance. [ADR-0041](adr/0041-the-engine-owns-the-attempts-and-checks-each-dispatch.md) retains the history.

**Revised #104 report-flow acceptance.**

On 2026-10-27, checkout commit `20cfca70c19ddcc1107d33a15d28e47b9f987140` passed the revised report-flow V3/V4 checks
with Claude Code 2.1.311 and codex-cli 0.164.0. Both used existing installations and authentication
with disposable Git data and local issue key 9104. The installed Celetis package was not updated.

- **Claude V3 PASS.** Session `111456dd-fe10-4cc6-81f0-a009f4c8540d` closed the normal task with implementer
  `a02f4858894e663aa` and reviewer `add5ddc38819bc8f2`. The stable-pair task
  retained implementer `afbfcc6130225b0b8` through three turns and reviewer
  `ad89c515b55dbf704` through two turns. Its gate repair and review fix used real
  `SendMessage` calls; the scoped re-review kept the reviewer. The task closed at attempt 2,
  round 1. Eight native calls, returned identities, and eight child handbacks back the eight
  stored execution reports. The original arguments and complete visible results match the stream.
  Claude adds legacy message aliases to its native trace; those aliases were checked against
  the original `to`, `message`, and `summary` fields. Native entry supplied the startup reads
  and custom text; its delivered context and `native-entry.txt` retain the custom sentinel.
- **Codex V4 PASS.** Session `01a17e5d-1f5c-7e00-968b-e8e75bf05c94` closed the normal task with
  `/root/verify9104_t1_implementer` and `/root/verify9104_t1_reviewer`. The stable-pair
  task retained `/root/verify9104_t2_implementer` through three completions and
  `/root/verify9104_t2_reviewer` through two. Real `collaboration.followup_task` calls
  performed the gate repair, review fix, and scoped re-review. The task closed at attempt 2,
  round 1. The native trace links each identity to its child thread and completion turns.
  All eight reported calls match the actual tool and non-message arguments. Spawns omit
  `model`, set `reasoning_effort`, and use `fork_turns: "none"`. Native message fields are
  encrypted, so they cannot independently prove the CAP line. Reports retain the plaintext
  message as sent. This limit remains explicit.
- **Changed-pair STOP as expected on both hosts.** Task 3 records one started implementer
  and one gate failure, then returns setup exit 5 before a resume or replacement. Claude's
  child is `ab5c45f27c21d6939`; Codex's is `/root/verify9104_t3_implementer`.
  Their required effort changes from low to medium. The observed follow-up tools cannot set
  that changed pair. No unsupported same-pair case was reported.

Every execution retains `provenance: "agent-reported"`. The engine validates reports; these
checks do not make a consistent false report independently verifiable. Native results expose no
applied effort to the calling agent in these runs; reports keep unavailable native settings null.
No dispatch interception, hook trust change, bypass flag, new login, or product-adoption step
participated. The first sandboxed starts failed; one approved retry per unchanged command
completed with the existing authentication. These startup failures are not PASS results.

Evidence is in `/tmp/celetis-104-report-check/live/`: each host's invocation JSON, prompt,
stream, exit JSON, copied record, and `*-checked.json`; per-call reports and gate outputs are
in its `claude/` or `codex/` checkout. The native Codex trace is
`/Users/dinq/.codex/sessions/2026/10/27/rollout-2026-10-27T19-16-34-01a17e5d-1f5c-7e00-968b-e8e75bf05c94.jsonl`.
The checker is `/tmp/celetis-104-report-check/check-live.ts`. Its final V3/V4 logs are
`v3-native-check.log` and `v4-native-check.log` in that scratch root.

V1 passed unchanged: `parity: 11841 cases, 0 differ` and `pairs: 4434 cases, 0 differ`.
V2 passed the 26 rule cases, CLI/storage checks, entry/text checks, report examples, and 10
final-review regression cases. The project gate ended with `verify: PASS` after the fixes.
The historical hook-based V5 remains FAIL/STOP and is superseded by the revised scope.
Changed-pair follow-up and live Windows lock execution retain their stated limits. These
checkout results do not prove an installed-package update.

The later Codex board checks used reviewed commit `626881b`; the
[public evidence record](https://github.com/ddinkov10/celetis/issues/21#issuecomment-6187619525)
keeps the earlier failures. The first fixture turn attempted a forbidden issue comment, which
failed on connectivity. The separate persistence turn used no tools. These results do not prove
full instruction compliance, interruption, compaction, or a complete lane.

The earlier 21 text-only cases omitted product instructions. The first run with those instructions
rejected a valid product-directory prefix; its results passed a local replay after the checker
repair. A later run rejected reason prose in case 13, whose oracle permits only commands and the
ending. After that case's output format was made explicit, a fresh full run passed all 21 cases.
Every client exited 0 without tool use or service errors. The strict action oracle stayed intact,
and both failed runs remain recorded. Those earlier quota results remain historical; the Task 4 row above records the later native and quoted checks.

A historical source wording test completed startup reads before the first response in five of five repair
samples, compared with zero of five control samples. It used the full guide text and actual file
reads. Normal installed skill entry and chore step order still need verification after review.

The remaining required CLI acceptance checks include every applicable lane and helper on Claude
Code and Codex TUI/CLI, cross-host steps, compaction and exact resume, native CLI skill selection,
permissions in the active CLI host, changed-model/effort repair on the same child, and live board
state/action pairs. These gaps remain open. Optional desktop success cannot close a required
CLI gap. No obsolete metadata or protocol fallback is supplied.

**Native cache replacement follows the host.** The user chose terminal confirmation and updates
with sessions left open (ADR-0028). Celetis no longer scans native processes or holds consumer
admission for their lifetime. Updater serialization, exact-target application, source restoration,
fresh validation and child cleanup remain. Native replacement may remove old cache resources;
Celetis makes no immutable-resource promise for running sessions. Newly installed Codex skills
and tools load in a new session. Historical ADR-0014 and ADR-0027 evidence remains. Real native
installation and terminal-approval acceptance must be recorded separately from fixture results.

**The celetis program.** [Issue #126](https://github.com/ddinkov10/celetis/issues/126) runs each
command through one installed program, `celetis` (ADR-0042). The Verify phase of the plan of #126
holds the macOS checks: the install and its refusals, `celetis update check` on the real
installations, the runner check and the board line, one confirmed update on temporary host homes,
and the personal `land` rules. Open: native Windows (each check of "After the landing" 4 of that
plan: the first install from Git Bash and the user `Path`; `celetis --version` and `next-step` in
Git Bash and in Windows PowerShell 5.1; `celetis update check` in PowerShell; and a board Run
whose herdr tab gets the `celetis.cmd` line), the `PATH` of a desktop host, and the first real
`celetis update` of the maintainer's installations.

**Native Windows.** [Issue #125](https://github.com/ddinkov10/celetis/issues/125) checked the
lane checkout of its fix on Windows 11 Pro 10.0.26200 with the existing installations. These are
observed versions and results as of 2026-10-26. The board refused a package entrypoint inside
the main checkout, so the board check ran from an export of the lane:

| Component | Evidence and limit |
|---|---|
| Bun 1.4.2 and the pinned tools | The verify gate passed on native Windows at each task head |
| Bun 1.4.4, Git Bash and Windows PowerShell 5.1 | The launcher loaded in the documented form of that release from Git Bash, and from PowerShell with `--config=NUL`. With no arguments it exited 2 with `usage:`; the update check of that release exited 0 with an offer; `next-step 125` exited 0 |
| Bun 1.4.4 and 1.4.2, the update lock | The updater refused as busy while a reader held the lock, and took the lock after the reader ended. A forced kill of the updater ended its child and a `.cmd`-shim grandchild within 2 seconds |
| Bun 1.4.4, the board | The board started, and `/api/board` gave `source.error: null` and a card for #125 |
| Claude Code 2.1.310, herdr 0.9.2-preview | Board Run on disposable #129 created a herdr tab with live runner and session PIDs and foreground `claude.exe`. The board card showed its Claude session. One Ctrl+C left the same Claude PID and both parent PIDs alive |

Open on Windows: Codex (not installed), PowerShell 7, Resume, the step end, a real `land` run and its
live land-lock check, and a confirmed update apply (only the lock probes and the update check of
that release ran). The board of #102 is also open on Windows: the board row above
checked the board before #102, which read its data through a `celetis-flow --board` subprocess
and typed its lines from command lists. The personal rules of `land` and `issue` are also open on
Windows, and so is the program of #126 ("The celetis program").

#125 left the moved POSIX process-identity path with no runtime check on macOS. The scratch checks
of the merge of #125 into #102 then ran it on macOS through the runner and the board: a live
owner, a dead PID, a zombie, a process with another command, and a changed start time gave the
same lock states as `266a05c`. On Linux, one probe in WSL Ubuntu 24.04 with a private Linux Bun
1.4.2 passed its four cases once. CI runs only the static verify gate (ADR-0029).
ADR-0034 records the Windows decisions and their limits.

### Optional Codex desktop evidence

Desktop probes have their own PASS, FAIL, BLOCKED, or UNRUN records. BLOCKED and UNRUN remain
incomplete without blocking otherwise complete required CLI checks. A CLI probe does not
establish a desktop result. Manual desktop operations still use the active surface's tools,
model profiles, and permissions; a missing tool or denied read stops that operation.

| Component | Evidence and limit |
|---|---|
| Codex desktop | The current selector cannot bind the owned isolated package: BLOCKED. CLI typed skill input and quoted tests do not establish desktop entry |

On 2026-10-27, the #157 investigation checked native exit input on macOS with Codex CLI
0.164.0 and Herdr client/server 0.9.3. `herdr agent send-keys <agent> ctrl+c ctrl+c` returned
control to the shell for an empty composer, an unsent `§`, a visible two-line draft, and `/`
with its slash-command popup open. No draft became a chat message. These observations cover
the native operation, not the changed runner. The changed-watcher Verify results belong to
[#157](https://github.com/ddinkov10/celetis/issues/157). The original incident's source of `§`
remains unknown.

## Limits

- A session that waits holds its script. Each Run press and each start with a number has its own
  tab, so another issue can run beside it.
- The runner sees only its own locks. While a script works on an issue, start each step of that
  issue through the script or the board, not by hand in a session of your own.
- With the default gates the automatic runner starts nothing. The board has no control for it:
  start it in a terminal, after you set a gate to `auto` in the main YAML. With `triage` as `auto`, it
  classifies each new issue, and a splitter question of `/celetis:triage` holds it until you answer.
  With `specify` as `auto`, it opens a design session for the lowest feature with no spec, and that
  session holds it until the spec is on the issue or you leave the session.
- With a gate that is `auto` in the main YAML, the script of a Run press goes on with that step in the
  same tab. Between two sessions the card is in Running with `Starting`.
- A Terminal tab and the script in it can end when the app starts again. The lock stays while
  either the runner or its foreground session is live. After both exit, a new runner can claim
  the stale lock; the session record stays.
- A session outside herdr, for example in a Code tab of the desktop app, has no card on the board,
  and the script does not end its step.
- The script ends a step from the selected host state that herdr reports. A new host release can
  need a new herdr integration or agent manifest
  (`herdr server update-agent-manifests`).
- Automatic completion can discard an unsent Codex draft through native cancel/quit input.
  Claude still receives `/exit` through its composer, so concurrent text can join that command.
  A successful request that leaves either host alive prints recovery instructions after
  10 seconds; the runner keeps ownership until the process exits ("The step end").
- The `herdr` commands of the script come from the documents and the source of herdr 0.9.3. The
  step end of the script was checked against a live herdr on 2026-10-11 (ADR-0007). That check
  covered the compare of lines. The compare of typed decisions was checked on Claude Code on
  2026-10-26, and the Codex check is open ("Acceptance status"). Two parts of the step end are not
  checked: the end of a session after its `celetis --agent <host> land` run ends (ADR-0008), and
  the end of a session after it adds `ready-for-human` at a stop (ADR-0011). Two shapes of the REST
  reads of the board data (`nextBoard`) for each open PR are not checked against a live GitHub: a
  commit status list that is not empty, and a review list that is not empty.
- The REST API of GitHub lists a commit status only after the status reports. So the list does not
  show a status that branch protection requires until that status reports. Until then,
  `celetis --agent <host> land` can read `pass` and ask for the merge. GitHub then refuses the merge, and
  the build step stops with `## Landing refused`. Until then, the board also shows `pass` for the PR.
- The script exits 0 at each `stop` line, at a `me` gate, at "no progress", and at a refused
  skip, so the exit that the board adds closes the tab with the message of the script. A Run press
  whose session ends at once thus leaves no message: start `celetis --agent <host> celetis-flow <n>` in a terminal to see it.
- A start of the board from the entry `board` of `.claude/launch.json`, in a project that has such
  an entry, needs `bun`, `herdr`, and the tools of the command on the `PATH` of the desktop app,
  and no git credentials. This is not checked: the desktop app reads
  `.claude/launch.json` of the main checkout, so the build of a lane cannot start the entry `board`
  of its branch. When that entry does not start the board, start the board in a terminal.
- A runner keeps the version folder of the program that started it for its resolver, entry, and
  step text. An install or an update keeps the three newest version folders and the current one,
  so a runner that stays open through three later updates can lose its folder. After that, the
  runner stops with the true cause. The automatic runner prints
  `celetis-flow: stop the program version of this runner was removed after an update; start the
  runner again` and exits 1. A runner with numbers prints
  `celetis-flow: #<n>: the program version of this runner was removed after an update; start the
  runner again` for each number. The cure is a new start of the runner (ADR-0012). A board whose
  version folder is gone keeps its data reads, because it loaded their code at its start. Each
  Run and Resume reads the installed program again. An update needs no board restart for these
  presses; new board code still needs a restart (ADR-0042).
- A host can update its plugin by itself, for example with a marketplace auto-update. Then the
  runner starts no new step session until `celetis update` ("How a step runs").

`engine/board/README.md` of the plugin holds the limits of the page.

## Check the harness

Run repository checks in a checkout of `ddinkov10/celetis`. The verify gate is `scripts/verify.ts`.
It classifies every tracked path, runs Biome and three strict type environments, native
actionlint, YAML and plugin validation, and generated byte comparison, with modes on macOS and
Linux. It installs nothing and refuses a tracked test file. Exact file roles distinguish
generated delivery, unchanged vendor code and file exemptions.

The workflow has one job, `test`, on Linux with Bun 1.4.4. It installs the pinned tools, then runs
the verify gate. The private TypeScript installer checks the official actionlint hash
and installs pinned JavaScript tools with Bun. Checks resolve package/type metadata from the
filesystem and run JavaScript tool entries on the selected Bun. No model credentials are needed.

```sh
BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 bun --no-env-file --no-install --config=/dev/null --no-macros scripts/verify.ts
```
