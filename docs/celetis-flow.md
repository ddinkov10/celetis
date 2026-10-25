# The celetis-flow runner

`BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 bun --no-env-file --no-install --config=/dev/null --no-macros <plugin>/bin/celetis.ts --agent <host> celetis-flow` runs the celetis flow from a Terminal tab. It asks the resolver for
the next step of an issue and starts that step in a new interactive Claude or Codex session in
its tab. In a herdr pane, the script ends the session when the step is done, and starts the next step
when its gate is `auto`. The GitHub issue stays the state store (`docs/issue-tracker.md`): every
result of a step goes to the issue. The board is a local web page that shows each agent session and
the next step of each issue, and its Run button starts the script for one issue in a new herdr tab.
The board is `engine/board/` of the plugin: a product project, a repository that uses the plugin
`celetis`, holds its config, and the plugin holds the board and the script that prints its data.
ADR-0002 holds the reasons for the script, ADR-0003 holds the reasons for the board, ADR-0005 holds
the reasons why herdr, not a mod, gives the session state and ends a step, and ADR-0007 holds the
reasons why `specify` is a step of the script. ADR-0008 holds the reasons why the build step lands
the change, ADR-0009 holds the reasons for contract 1, and ADR-0020 holds the reasons why the board
is a part of the plugin. ADR-0011 holds the reasons why a step session hands a stop to the issue.

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

- macOS or Linux, with Bun 1.4.2 or later. There is no native Windows runner.
- The selected host CLI (`claude` 2.1.299 or later, or `codex` 0.162.1 or later; the README gives
  the reason for each), `gh` (logged in), Bun 1.4.2 or later,
  and `git` 2.31 or later on `PATH`. See `docs/configuration.md` for the install of
  Bun. A missing external command keeps its diagnostic and failure status. The source entrypoint
  imports the engine of its invoked package. Terminal bootstrap and host operations validate native metadata. Child Celetis
  programs keep the selected Bun and all startup isolation flags. No jq or Perl runtime is needed.
- The scripts use only the REST API of GitHub (`gh api`), so they also work where a proxy refuses
  GraphQL, as in a Claude Code cloud session.
- The plugin `celetis@celetis`, installed on the machine, and the installed `bin/celetis.ts` entrypoint. The scripts and the step text come from the installed plugin:
  `BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 bun --no-env-file --no-install --config=/dev/null --no-macros <plugin>/bin/celetis.ts --agent <host> <name> <arguments>` runs `engine/<name>.ts` of that plugin with those arguments.
  The selected host must report a current enabled installation. Missing, disabled, malformed,
  or ambiguous metadata stops lookup. Codex lookup uses `skills/list` on a short-lived local
  app-server connection; it starts no model turn. The README holds the separate installation
  recipes and product permissions. A Codex-only machine needs no Claude CLI.
- The trunk of the main checkout is current. The trunk is the default branch of the repository on
  GitHub. The config comes from the main checkout of the product project, and so does the custom
  part of a step that the script starts ("The config and the custom parts"):
  `BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 bun --no-env-file --no-install --config=/dev/null --no-macros <plugin>/bin/celetis.ts --agent <host> land` moves the trunk of the main checkout after each landing. After a merge by
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
BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 bun --no-env-file --no-install --config=/dev/null --no-macros <plugin>/bin/celetis.ts --agent <host> celetis-flow            # the automatic runner; it does not end
BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 bun --no-env-file --no-install --config=/dev/null --no-macros <plugin>/bin/celetis.ts --agent <host> celetis-flow 373 374    # a start with numbers; it takes the issues in this order and ends
BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 bun --no-env-file --no-install --config=/dev/null --no-macros <plugin>/bin/celetis.ts --agent <host> celetis-flow --board    # the data of the issues for the board, as one JSON document
BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 bun --no-env-file --no-install --config=/dev/null --no-macros <plugin>/bin/celetis.ts --agent <host> celetis-flow --resume 373    # the session of a step with no progress, again
```

These human commands use `CELETIS_AGENT`, then `host` in the main checkout's `.celetis.yaml`,
then Claude. Put `--agent claude` or `--agent codex` before `celetis-flow` to override that choice.
Every skill call supplies that prefix. Invalid host values stop; PATH order never chooses a host.
The selected host stays fixed for the new step. Resume instead selects its recorded host and
rejects an explicit prefix that names the other host.

An argument is `<n>`, or `'#<n>'` in quotes. A shell can read an unquoted word that starts with `#`
as the start of a comment: the script then gets neither that word nor the words after it, and with
no number it starts the automatic runner. Each line of the script starts with `celetis-flow: `,
apart from its usage line and the output of `--board`.

**A start with numbers** does this for each issue. It calls the in-process `resolveNext` resolver
for the line of the issue and starts the step of the `run` line, whatever its gate. When the
session ends, it asks again and starts each next step whose gate is `auto`. It ends the issue at a
line that is not a `run` line, at a `me` gate, or at the same `run` line again ("no progress"). With
the default gates, each next step is a `me` step, so a start with a number runs one step of that
issue.

**The automatic runner** calls the same resolver for the line of each open issue
and takes the lowest open issue whose line is a `run` line,
whose step has the gate `auto`, whose step has no row in the record, and
whose lock is free. It does the same work on that issue, but it starts no `me` step, and then it
asks again. When no issue can start, when the issue started no session, or when the resolver cannot
read GitHub, it waits 60 seconds. It prints one line for the whole wait. While it waits,
`BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 bun --no-env-file --no-install --config=/dev/null --no-macros <plugin>/bin/celetis.ts --agent <host> next-step --open` shows the line of each open issue: a `stop` line gives the
cause, and a `run` line that does not start has a `me` gate, a row in the record, or the lock of
another script. To stop it, close its tab, or press ctrl+c while it waits. It reads open issues
only. With the default gates no step is `auto`, so the automatic runner starts nothing.

**The form `--board`** is read-only: it takes no lock, writes no row in the record, and starts no
session. `--board` is its only argument. It prints contract 1, the JSON document that the board
reads: `contract`, `tracker`, `flow`, `noRun`, `runner`, `agents`, `defaultAgent`, and `issues`, with
one row for each issue that has a card. The rows come from the same in-process resolver as
`next-step --json`; resolution, displayed gates, and the default host share that refresh's operation.
The resolver makes these `gh api` calls: 3 paginated lists (open issues, closed issues, open PRs),
one paginated call for the comments of each open issue that has a comment, and 3 calls for each
open PR whose branch holds `/<number>-`. The resolver gives
each row the state that it knows from GitHub and from the working
trees: `done`, `blocked` with `reason` and `act`, `ready`, or `dirty` with `path`. The `reason` is
`needs info`, `landing refused`, or `ready for your step` ("The board", rule 5). It also gives the
`noRun` text for a dirty main checkout. `--board` adds what the runner knows: `starting` for a lock
that a live script holds, `stuck` with its `act` for a row of the record, the `step`, `started`,
and `urgent` of each row, `runner`, `tracker`, and `flow` with the gate of each step. "The board"
gives the value of each field. When a tracker request or its data conversion fails, the form prints
`stop cannot read the issues from GitHub` and exits 1. The board is its reader: the adapter supplies this form as `data`.

**The form `--resume <n>`** reopens the exact session from
`<git common dir>/celetis-flow/sessions/<n>.json`. It validates the current record, selects its
saved host and checkout, and runs `claude --resume <id>` or `codex resume --no-daemon <id>`. A missing or
invalid record stops with a recovery action. Resume takes the shared issue lock and retains it
until the foreground exits. It makes no `gh` call or update and starts no completion watcher,
so the session stays open until you leave it. The board adapter supplies this form as `resume`.

The script asks for no confirmation. A start with the number of an issue whose next step is
`implement`, `chore`, or `hotfix` builds the change and lands it with `BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 bun --no-env-file --no-install --config=/dev/null --no-macros <plugin>/bin/celetis.ts --agent <host> land` when
its checks are green, with no more act of yours. With an `auto` gate on a step, the script continues
through that step by itself.

Issue locks and the automatic-runner lock use shared Git refs under
`refs/celetis-flow/locks/`. Their owner records hold the runner and foreground PIDs and process
start times. Either live process keeps the lock, including after a killed runner; an exited
process does not. Claims and releases use Git compare-and-set, and foreground registration
updates all held locks in one transaction. Both hosts and manual resume share the issue lock.
`BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 bun --no-env-file --no-install --config=/dev/null --no-macros <plugin>/bin/celetis.ts --agent <host> land` keeps its separate `land-<n>.lock` in `<git common dir>/celetis-flow/`.
The `no-progress` file there has one row for each step that ended with no progress. The automatic
runner and `--board` read it. An explicit issue start can retry that step.

## How a step runs

A session is one selected host process in the foreground of the tab, with its original terminal
input, in the main checkout. Claude starts `run /celetis:plan #402` as:

```bash
claude \
  --permission-mode auto \
  -n '#402 plan' \
  --append-system-prompt-file <plugin root>/step-prompt.md \
  '/celetis:plan #402'
```

Codex reads effective `developer_instructions` with `config/read`, preserves that text, and
appends the step text. It passes the combined value as one quoted `developer_instructions=...`
value after `-c`. Its prompt is `Use the celetis:plan skill for #402. Complete its Host entry startup reads before any response, including commentary.`
Every interactive Codex launch, including specify and exact resume, uses `--no-daemon` so its
hooks use the current pane's environment. The CLI must support that option; it was checked on
0.162.1. The runner retains the configured sandbox, approval, and model settings. No document
content is evaluated as shell code.

The lane uses the exact path returned by `BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 bun --no-env-file --no-install --config=/dev/null --no-macros <plugin>/bin/celetis.ts --agent <host> worktree`. The selected
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

**The installed package.** The runner uses the package selected at startup for its resolver,
entrypoint, and step text. Numbered starts, automatic starts, and later steps make no update call.
The forms `--board` and `--resume` keep their existing no-update behavior and saved identity.
Before a step starts, the runner checks that its required files and step text still exist.
Known concrete policy conflicts are diagnosed. Running consumers do not reserve the update mutex. Run and exact Resume bind their Codex session to the active
installed root through a command-only Local marketplace. Native catalog, manifest, and cache
version checks prove the refresh no-op for Git and local installations. A Git SHA ref alone can
force same-revision replacement and is reserved for approved application. External package
edits remain outside the update protocol. Metadata RPC disables plugins before app-server construction, so
read-only thread and configuration checks do not trigger startup refresh.

[Updates](../README.md#updates) owns the read-only check, terminal-confirmed one-command update,
its updater mutex and deadline, and native cache replacement. Sessions may remain open; a fresh
session loads updated skills and tools. A runner restart alone does not fetch a new package.

**The step end.** In a herdr pane (`HERDR_ENV=1` and a valid `HERDR_PANE_ID`), the script does two things before it
starts a session. It names its tab `#<n> <step>` with `herdr tab rename "$HERDR_TAB_ID"`, so the
board links the session to the issue. It also starts a job in the background that ends the session:

1. The job waits for the selected host's new identity and a saved turn in the correct checkout,
   for 60 seconds at most. It saves the verified ID in the current session record.
2. It waits until the agent is ready for the next prompt:
   `herdr agent wait <pane> --until idle --until done`.
3. It verifies the current host, identity, readiness, and idle/done state, then reads
   `next-step.ts <n>`. A changed `run` line or `stop #<n> ` line permits an exit check. The job
   reads the resolver again, then makes a final session-state check before it submits `/exit`.
   A blocked or unknown state gets no exit. A failed submission leaves the session open and
   prints a recovery action.
4. Otherwise it waits up to five seconds for working or blocked state, pauses one second, and
   checks again. This also permits a new resolver check while the session remains idle.

The runner waits for the foreground process to exit before it releases a lock or starts the
next step. Successful `/exit` submission alone is not completion.

In each other case the session stays open: the same `run` line, the dirty-tree line, the line of a
landing that runs, the cannot-read line, and a resolver that fails. So a session whose agent waits
for an answer, waits for a background task, or left an uncommitted file stays open, and a session
that you start by hand never ends by itself. herdr ends a wait when its agent exits, so the job
ends with the session, and the script stops the job when the host process ends. When a session does not end
and its agent waits for nothing, leave it with `/exit`: the script then asks the resolver again,
and it prints the reason or starts the next step. Outside herdr the script starts no job and makes
no `herdr` call.

**A stop.** A step session hands a stop that is not a question to the issue (rule 4 of the step
text). The reason is a comment: the comment that its skill posts for the stop
(`## Landing refused`, `## Before landing`), else a comment with `## Stopped` as its first line.
When the skill adds no label for the stop, the session then adds `ready-for-human` as its last act,
so the line becomes `stop #<n> is ready-for-human. …` and the job ends the session. A stop for which
the skill adds a label, such as the `needs-info` stop of `/celetis:triage`, stays as the skill says.
A question is not a stop: where a skill says to ask, rule 2 holds, and a session that asks for a
decision waits in its pane. A Verify scenario that the session cannot run is a `## Before landing`
stop (rule 5): the session does not land the change. It posts the comment, and then one command
removes `ready-for-agent`, which marks the change as built, and adds `ready-for-human`. A session
that ends before that command leaves `ready-for-agent`, so the next run builds and verifies the
change again. A `specify` session and a session that you start by hand have no step text: at such
a stop they show the message and stay open (ADR-0011).

After a stop with `ready-for-human`, do the act of the stop, remove the label, and start the step
again. A `## Stopped` or `## Before landing` comment names the act. For a refused landing of
`/celetis:implement` or `/celetis:chore`, fix a cause outside the change (for example, run the
failed job again, or land a chore that removes the advisory of a dependency): the next run of the
step fixes a cause that the change made, lands the change, and does not build it again. For a Verify
scenario, the act is a run of the scenario. After a PASS, the next run of `/celetis:implement` lands
the built change. After a FAIL, keep the label: put the result on the issue, run
`/celetis:plan #<n>` in a session of your own, and remove the label when the new plan is on the
issue. Re-entry requires completion evidence for the current build: the maintainer's later
label-removal event or a trusted completion report, and both for an act of "During the build", as
`docs/issue-tracker.md` specifies. Label
absence alone does not clear the precondition. For a hotfix whose landing
stopped, the checklist of step 7 of `skills/hotfix/SKILL.md` of the plugin holds your acts: you land
with `BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 bun --no-env-file --no-install --config=/dev/null --no-macros <plugin>/bin/celetis.ts --agent <host> land` in your own shell, and the step does not run again.

**The human acts of a plan.** The plan names them in its first section, `### Your steps`. Do each
act of "During the build" while the build runs, and report the acts in one `## Human steps done`
comment. A build that needs an act with no report runs each other scenario. Then it stops with one
`## Before landing` comment that names each such act, its report form, and the scenarios that wait
for it. Post the report, then remove `ready-for-human`: the next run of `/celetis:implement` runs
those scenarios and lands on a PASS. A check of "After the landing" is no stop. The last message of
`/celetis:implement` quotes it after the landing, and a FAIL is a new bug (`/celetis:bug`).

A `specify` session starts with the line `run /celetis:feature #<n>`. The paths of `specify` give
three lines that end it: `run /celetis:plan #<n>` (the spec is on the issue),
`stop #<n> is an epic. Each child runs its own flow.` (the scope check made the issue an epic), and
`stop #<n> is closed as wontfix.` (`specify` rejected the design). While you answer its questions,
the line stays the same, and the session stays open. A session that ends while the line is still
`run /celetis:feature #<n>`, as after a spike, is "no progress". A lane change in step 1 of
`/celetis:feature` moves the line too, for example to `run /celetis:bug #<n>`: the session ends at
its next idle moment, and a Run press starts that lane.

**A landing.** `BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 bun --no-env-file --no-install --config=/dev/null --no-macros <plugin>/bin/celetis.ts --agent <host> land` moves the line of the issue when it merges, and it then closes
the epic and removes the worktree. While it runs, `BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 bun --no-env-file --no-install --config=/dev/null --no-macros <plugin>/bin/celetis.ts --agent <host> next-step <n>` prints
`stop the landing of #<n> runs; wait until /usr/bin/env BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 '<bun>' '--no-env-file' '--no-install' '--config=/dev/null' '--no-macros' '<plugin>/bin/celetis.ts' '--agent' '<host>' 'land' ends`. That line does not start with
`stop #<n> `, so the job does not end the session. herdr 0.9.3 reads an agent that waits for a
background command as `done`, then `idle` (read on a live herdr on 2026-10-11). So while the script
runs, for up to 30 minutes, the board shows the session in Needs you as `turn ended`: do not leave
that session. If a session ended during a landing, wait until `BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 bun --no-env-file --no-install --config=/dev/null --no-macros <plugin>/bin/celetis.ts --agent <host> next-step <n>` prints
another line, and then run `BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 bun --no-env-file --no-install --config=/dev/null --no-macros <plugin>/bin/celetis.ts --agent <host> land <n> '<subject>'` again from the main checkout: it
completes the landing. After the merge the issue is finished, so Run and
`BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 bun --no-env-file --no-install --config=/dev/null --no-macros <plugin>/bin/celetis.ts --agent <host> celetis-flow <n>` start nothing, and no card shows the lane worktree and the branch
that stay. `BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 bun --no-env-file --no-install --config=/dev/null --no-macros <plugin>/bin/celetis.ts --agent <host> worktree --remove <n>` also removes them after the merge of the PR; it
does not close the epic.

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
of setup, `.claude/celetis-flow/wiring.json`, is no config: only `BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 bun --no-env-file --no-install --config=/dev/null --no-macros <plugin>/bin/celetis.ts --agent <host> setup` reads it.

- `host` selects the default host for a new step ("Start the script").
- `gates` selects `me` or `auto` for each step ("Gates").
- `landing` selects `pr` or `merge` for `BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 bun --no-env-file --no-install --config=/dev/null --no-macros <plugin>/bin/celetis.ts --agent <host> land` (`docs/issue-tracker.md`).
- `board.port` selects the board port ("The board").
- `codexProfiles.<runtime>` supplies an optional dispatch profile for model tiers
  (`docs/capability.md`).

A missing or invalid required config stops before branch or worktree changes, locks, runtime
state, host sessions, or landing pushes. A public command creates an immutable operation after
its initial process replacement. Internal calls receive its values instead of reading again.
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

**The worktree setup.** `BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 bun --no-env-file --no-install --config=/dev/null --no-macros <plugin>/bin/celetis.ts --agent <host> worktree <n>` creates the lane worktree and its branch
(`docs/issue-tracker.md`, "Branches, PRs, merge"). A new branch starts at the freshly fetched trunk
of `origin`. `gh api 'repos/{owner}/{repo}' --jq .default_branch` gives the trunk when the command creates a
new branch. The command checks `.celetis.yaml` in the lane before setup. It reads `worktreeSetup`
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
stays for repair and retry. Entry into the target lane creates a fresh operation before setup
or marker acceptance. Setup validates again after it writes or selects a different file.
The marker remains
`<git dir of the worktree>/celetis-flow-setup-done`. The command writes it only after a script that
is not empty succeeded. With an empty or missing `worktreeSetup`, it writes no marker. It runs
setup again in an unmarked lane, so a script that a merge of the trunk brings runs at the next
entry. A marked lane still needs valid config, but does not run setup again. A lane that has a
marker keeps it; `BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 bun --no-env-file --no-install --config=/dev/null --no-macros <plugin>/bin/celetis.ts --agent <host> setup lane <path>` runs the script there. Reading config in
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

The board is `engine/board/` of the plugin. Its generic CLI reads config from stdin only, and that config
supports the fixed Run selection and saved-host Resume commands below.
The board stays independent of YAML and Celetis field names. ADR-0009 keeps contract 1 and the
command/path trust rules. ADR-0015 replaces the config storage, and ADR-0020 makes the board a part
of the plugin.

**Requirements.** Bun 1.4.2 or later; Git 2.31 or later; herdr 0.9.3 and a
running server; and a Chromium browser. The board needs no GitHub credentials of its own.
The script requirements above apply to its commands too.

**Start the board** in the main checkout or a subfolder:

```bash
BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 bun --no-env-file --no-install --config=/dev/null --no-macros <plugin>/bin/celetis.ts --agent <host> board
PORT=4500 BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 bun --no-env-file --no-install --config=/dev/null --no-macros <plugin>/bin/celetis.ts --agent <host> board
```

The adapter takes no arguments. It fully validates the main YAML and refuses a lane start. It binds
fixed lists through `celetisConfig(main, port)` and `startBoard(main, config)`. The selected Bun
must be executable. The same package's `bin/celetis.ts` must be a readable regular file outside
the main checkout and each lane. Control characters and canonical path escapes are refused.
The listening port remains fixed until restart. Each data refresh creates a fresh operation;
each Run or Resume command validates its own current policy.

Generic `engine/board/cli.ts --config-stdin` keeps its separate project-only validator. Each
producer must be a relative executable regular file inside the main checkout, outside lanes.
The known isolated Bun shebang binds a validated Bun producer to `process.execPath`; an absolute
interpreter in JSON cannot bypass this rule. HTTP accepts only an issue and supported host.

Let `P` be `[process.execPath, "--no-env-file", "--no-install", "--config=/dev/null", "--no-macros",
"<absolute-package>/bin/celetis.ts"]`. Each list element below is one argument.

| Key | Value | Use |
| --- | --- | --- |
| `data` | `[...P, "celetis-flow", "--board"]` | Read contract 1 without a shell. |
| `run` | `[...P, "--agent", "{agent}", "celetis-flow", "{n}"]` | Start the selected host and issue in an owned Herdr tab. |
| `resume` | `[...P, "celetis-flow", "--resume", "{n}"]` | Resume the saved host and exact ID before defaults. |
| `port` | Main `board.port`, or 4403 | `PORT` takes precedence. |

Only the port is repository setup. `PORT` stays inherited and takes precedence. This repository
uses 4404. Restart the board after a port change. A native desktop preview entry, when used,
starts the same installed entrypoint and uses the same port (`README.md`, "Optional: the board in Claude desktop").

`POST /api/run` substitutes the chosen agent, or `defaultAgent` when no choice is supplied,
for `{agent}`. Run does not change the project default. Set that default with `host` in the main
YAML; `--agent` and `CELETIS_AGENT` override it. Unknown or unavailable choices return 409 and
start no agent. Availability checks only executable presence; sign-in, trust, plugin discovery,
and full host parity need separate checks.

The board shows the default as read-only in its agent menu and command palette. A valid trusted
`POST /api/agent` returns 409 with `The producer controls the default agent. Change it in the producer configuration.`
It changes no YAML or Git setting. Change `host` in the main YAML to set the project default.

Resume has no fixed agent prefix. It uses the host and exact ID in the saved record, even after
the project default changes. Each item is one argument. The board quotes the items and adds
`&& exit`: success closes the tab; a failed script leaves its message there. With the default
`me` gates, a Run starts one step and ends when its session ends.

The board starts the data script on each read and the action script on each press. A plugin
update does not stop the board. Reload or restart it if native cache replacement removes an asset
it still needs. A fresh board or session resolves the enabled installation again. Follow
[Updates](../README.md#updates) for manual updates.
Real Run/Resume acceptance remains a separate live gate.

**The data.** `BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 bun --no-env-file --no-install --config=/dev/null --no-macros <plugin>/bin/celetis.ts --agent <host> celetis-flow --board` prints contract 1 ("Start the script"). Each read
makes these `gh api` calls: 3 paginated lists (open issues, closed issues, open PRs), one paginated
call for the comments of each open issue that has a comment, and 3 calls for each open PR whose
branch holds `/<number>-`. The script puts these values in the fields of the document:

| Field | Value |
|---|---|
| `contract` | `1` |
| `tracker` | `GitHub` |
| `flow.lanes` | The four lanes: `feature` (triage, specify, plan, implement), `bug` (triage, bug, plan, implement), `chore` (triage, chore), and `hotfix` (triage, hotfix). |
| `flow.stages` | Triage, Define (specify, bug, chore, hotfix), Plan, and Implement. |
| `flow.steps.<step>.gate` | The gate of each of the seven steps, by the rule of "Gates". |
| `flow.steps.<step>.hint` | `It lands the change when the build is done.` for `implement`, `chore`, and `hotfix`. No other step has a hint. |
| `noRun` | `The main checkout is dirty: <path>. Commit or stash first.` while the main checkout is dirty, else `null`. |
| `runner` | `true` while a live automatic runner holds its lock. |
| `agents` | Entries `claude` and `codex`. Each has `available: true` and `cause: null` when its executable is on `PATH`, else `available: false` and `cause: "celetis: <agent> is not on PATH"`. |
| `defaultAgent` | The agent selected by `--agent`, `CELETIS_AGENT`, `host` in the main YAML, or the default `claude`, in that order. |
| `issues` | One row for each open issue and for each issue that closed in the last 14 days. An issue whose line of the resolver is the epic line or the `wontfix` line has no row. |

A row gets its `state` by the first rule that matches:

| # | The issue | `state` | Fields of that state |
|---|---|---|---|
| 1 | is closed | `done` | `closedAt` |
| 2 | has a lock that a live script holds | `starting` | |
| 3 | has a dirty lane worktree | `dirty` | `path`: the lane worktree |
| 4 | has a row in the record for its `run` line | `stuck` | `act`: `BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 bun --no-env-file --no-install --config=/dev/null --no-macros <plugin>/bin/celetis.ts --agent <host> celetis-flow --resume <n>` |
| 5 | has `needs-info` or `ready-for-human` | `blocked` | `reason`: `needs info` for `needs-info`. For `ready-for-human`: `landing refused` while a landing refusal is current (`docs/issue-tracker.md`, "Resolving an issue's state"), else `ready for your step`. `act`: the act that the `stop` line of the issue names |
| 6 | has a `run` line | `ready` | |

Each row also has `number`, `title`, `url`, `updatedAt`, `closedAt`, and these fields:

- `type`: `bug`, `feature` (the label `enhancement`), `chore`, or `hotfix`, from the first of those
  four labels that the issue has, in that order; else `null`.
- `step`: the step of the `run` line of the issue ("Gates"), else `null`.
- `started`: `true` when the step is `plan` or `implement`, because an earlier step of the lane ran.
- `urgent`: `true` for the type `hotfix`.
- `pr`: the open pull request whose branch name holds `/<n>-`, with its number, URL, draft state, CI
  result (`pass`, `fail`, `pending`, or `null`), and review state (`approved`, `changes`,
  `required`, or `null`); else `null`. For the review state, the last review of each reviewer that
  approves, requests changes, or is dismissed counts. The review state is `changes` when one of
  those reviews requests changes, else `approved` when one approves, else `required` when a
  requested reviewer or team has not answered, else `null`.

**Check the document** against the contract, in the main checkout. `BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 bun --no-env-file --no-install --config=/dev/null --no-macros <plugin>/bin/celetis.ts --agent <host> root` prints
`<plugin>`:

```bash
BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 bun --no-env-file --no-install --config=/dev/null --no-macros <plugin>/bin/celetis.ts --agent <host> celetis-flow --board | bun --no-env-file --no-install --config=/dev/null --no-macros <plugin>/engine/board/cli.ts check --stdin
```

The checker prints `agent-board: contract 1, <count> issues, ok` and exits 0, or it prints one line
for each failure and exits 1.

**The page.** [`engine/board/README.md`](../engine/board/README.md) of the plugin holds the page: the
columns and the card of each state, the layout, the keys, the buttons Run, Resume,
Open shell, and Go, the errors, the tables of contract 1, the other forms of the command, the trust
boundary, and the limits of the page.

## What the script prints, and your act

| The script prints | The maintainer's act | Then |
|---|---|---|
| `stop … needs info` or `stop … ready-for-human` | do what the line says; for `ready-for-human`, the latest `## Stopped` or `## Before landing` comment names the act, and "How a step runs", **A stop**, gives the act after a refused landing. The card of an issue with a current landing refusal reads `landing refused`: its `## Landing refused` comment names the cause | the next step starts with a Run press or with `BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 bun --no-env-file --no-install --config=/dev/null --no-macros <plugin>/bin/celetis.ts --agent <host> celetis-flow <n>`; the automatic runner starts it only when its gate is `auto` |
| `stop … is an epic` | none: each child is an open issue with its own flow | — |
| `stop … is finished` or `stop … is closed as wontfix` | none | — |
| `stop the working tree is dirty …` | commit or stash | as the first row |
| `stop the landing of #<n> runs …` | none: a session lands the issue | start the script again when the landing ended |
| `stop cannot read … from GitHub` | check `gh auth status`, the network, and the REST rate limit (`gh api rate_limit`) | the automatic runner tries again by itself; press Refresh on the board |
| a `me` gate | a Run press on the card, or `BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 bun --no-env-file --no-install --config=/dev/null --no-macros <plugin>/bin/celetis.ts --agent <host> celetis-flow <n>` | — |
| `no progress: /celetis:feature #<n>` | the session ended with no spec on the issue: open the session again, or read the comment of a spike | a Run press, or `BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 bun --no-env-file --no-install --config=/dev/null --no-macros <plugin>/bin/celetis.ts --agent <host> celetis-flow <n>` |
| `no progress:` with another command | open the session again, or read the issue | a Run press, or `BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 bun --no-env-file --no-install --config=/dev/null --no-macros <plugin>/bin/celetis.ts --agent <host> celetis-flow <n>` |

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

The landing script is the required agent path. With `pr`, it merges only the issue's lane PR on
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
is not the saved session ID. From the main checkout, `BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 bun --no-env-file --no-install --config=/dev/null --no-macros <plugin>/bin/celetis.ts --agent <host> celetis-flow --resume 402`
reads the current record for #402 and opens its exact host and session ID. It holds the shared
issue lock until the session exits. No completion job or update runs during resume.

A missing or invalid record stops with a recovery action. A record with no verified ID directs
you to `claude --resume` or `codex resume --no-daemon`, by its saved host, to select a saved session manually.
Exact runner resume needs the identity from herdr and a saved turn. A resumed session stays open
until you leave it.

The record at `<git common dir>/celetis-flow/sessions/<n>.json` has exactly six fields:
`schema: 1`, `host`, `issue`, `step`, absolute main `checkout`, and `session_id` (UUID or null).
The runner writes it atomically. It accepts no old record format and makes no migration.
Herdr supplies `result.agent.agent_session.value`; a tab name is never an identity.
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
| Bash 3.2.57, Perl 5.34.1, Node 26.11.1 | Historical gate and released-board evidence before ADR-0025. Current commands require Bun 1.4.2 or later |

[Issue #100](https://github.com/ddinkov10/celetis/issues/100) separately checked checkout native
entry on Claude Code 2.1.310 with `--plugin-dir` and Codex CLI 0.164.0 with explicit checkout
skill paths. Actual whole-file events covered main, lane, and subfolder selection, literal custom
text, first borrowed reference, repeated reference, and same-session handoff. Optional absence
continued; malformed, symlink, unreadable, and native permission-denied inputs stopped. Codex's
file-deny profile stopped at metadata access; a separate native command rule permitted metadata
and refused the whole-file read. No alternate read followed either denial. These checks used the
existing installations and authentication. They establish checkout instruction behavior, not an
installed-package update, a full lane, or closure of the other acceptance gaps below.

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

### Optional Codex desktop evidence

Desktop probes have their own PASS, FAIL, BLOCKED, or UNRUN records. BLOCKED and UNRUN remain
incomplete without blocking otherwise complete required CLI checks. A CLI probe does not
establish a desktop result. Manual desktop operations still use the active surface's tools,
model profiles, and permissions; a missing tool or denied read stops that operation.

| Component | Evidence and limit |
|---|---|
| Codex desktop | The current selector cannot bind the owned isolated package: BLOCKED. CLI typed skill input and quoted tests do not establish desktop entry |

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
  same tab. Between two sessions the card is in Running with `starts`.
- A Terminal tab and the script in it can end when the app starts again. The lock stays while
  either the runner or its foreground session is live. After both exit, a new runner can claim
  the stale lock; the session record stays.
- A session outside herdr, for example in a Code tab of the desktop app, has no card on the board,
  and the script does not end its step.
- The script ends a step from the selected host state that herdr reports. A new host release can
  need a new herdr integration or agent manifest
  (`herdr server update-agent-manifests`).
- The script types `/exit` into the pane of a step that is done. Text that you type in that pane at
  that moment goes into the same line. This is more probable in a `specify` session, because you
  work in its pane.
- The `herdr` commands of the script come from the documents and the source of herdr 0.9.3. The
  step end of the script was checked against a live herdr on 2026-10-11 (ADR-0007). Two parts of it
  are not checked: the end of a session after its `BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 bun --no-env-file --no-install --config=/dev/null --no-macros <plugin>/bin/celetis.ts --agent <host> land` run ends (ADR-0008), and
  the end of a session after it adds `ready-for-human` at a stop (ADR-0011). Two shapes of the REST
  reads of `--json` for each open PR are not checked against a live GitHub: a commit status list
  that is not empty, and a review list that is not empty.
- The REST API of GitHub lists a commit status only after the status reports. So the list does not
  show a status that branch protection requires until that status reports. Until then,
  `BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 bun --no-env-file --no-install --config=/dev/null --no-macros <plugin>/bin/celetis.ts --agent <host> land` can read `pass` and ask for the merge. GitHub then refuses the merge, and
  the build step stops with `## Landing refused`. Until then, the board also shows `pass` for the PR.
- The script exits 0 at each `stop` line, at a `me` gate, and at "no progress", so `&& exit` closes
  the tab with the message of the script. A Run press whose session ends at once thus leaves no
  message: start `BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 bun --no-env-file --no-install --config=/dev/null --no-macros <plugin>/bin/celetis.ts --agent <host> celetis-flow <n>` in a terminal to see it.
- A start of the board from the entry `board` of `.claude/launch.json`, in a project that has such
  an entry, needs `bun`, `herdr`, and the tools of the command on the `PATH` of the desktop app,
  and no git credentials. This is not checked: the desktop app reads
  `.claude/launch.json` of the main checkout, so the build of a lane cannot start the entry `board`
  of its branch. When that entry does not start the board, start the board in a terminal.
- After an external update, a Claude runner that stays open for more than 14 days can lose its
  installed folder. A runner keeps the folder of its own version for its resolver and entrypoint,
  and Claude Code removes the folder of an old version in a background cleanup 14 days after the
  update. After that, the runner stops with the true cause. The automatic runner prints
  `celetis-flow: stop the plugin version of this runner was removed after an update; start the
  runner again` and exits 1. A runner with numbers prints
  `celetis-flow: #<n>: the plugin version of this runner was removed after an update; start the
  runner again` for each number. The form `--board` prints
  `stop the plugin version of this runner was removed after an update; start the runner again`
  and exits 1. The cure is a new start of the runner (ADR-0012).

`engine/board/README.md` of the plugin holds the limits of the page.

## Check the harness

Run repository checks in a checkout of `ddinkov10/celetis`. The verify gate is `scripts/verify.ts`.
It classifies every tracked path, runs Biome and three strict type environments, native
actionlint, YAML and plugin validation, and generated byte/mode comparison. It installs nothing
and refuses a tracked test file. Exact file roles distinguish generated delivery, unchanged
vendor code and file exemptions.

The workflow has one job, `test`, on Linux with Bun 1.4.2. It installs the pinned tools, then runs
the verify gate. The private TypeScript installer checks the official actionlint hash
and installs pinned JavaScript tools with Bun. Checks resolve package/type metadata from the
filesystem and run JavaScript tool entries on the selected Bun. No model credentials are needed.

```sh
BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 bun --no-env-file --no-install --config=/dev/null --no-macros scripts/verify.ts
```
