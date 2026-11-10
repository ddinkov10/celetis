# The Celetis workflow

`celetis --agent <host> run` and `celetis --agent <host> queue` send the requests of the Celetis
workflow from a terminal to the master daemon of the repository
([The master daemon](https://github.com/ddinkov10/celetis/blob/main/engine/README.md#the-master-daemon)), and return
at once. The daemon asks the resolver for the next step of an issue and starts that step in a new
interactive Claude or Codex session. Each session starts in a new tab of the Herdr app, in an hc
terminal of herdr-core of its own, and the daemon steers that tab from outside: it ends the
session when the step is done, and starts the next step when its gate is `auto`. The GitHub issue
stays the state store (`docs/issue-tracker.md`): every result of a step goes to the issue. The
master daemon also serves the board, a local web page that shows each agent session and the next
step of each issue. Its Run button gives the request for one issue to the daemon. The board is
`engine/board/` of the engine: a product project, a repository that uses the plugin `celetis`,
holds its config, and the engine holds the board, which reads its data in the daemon process.

These records hold the reasons:

- ADR-0002: the script. ADR-0003: the board. ADR-0020: the board (its home moved to the engine in ADR-0035).
- ADR-0035: the board reads its data with the engine and starts fixed commands.
- ADR-0005: the terminal program, not a mod, gives the session state and ends a step.
- ADR-0058: herdr-core and the Herdr app are that program. ADR-0062: each session runs in a tab of
  its own that the script steers.
- ADR-0007: `specify` is a step of the script. ADR-0008: the build step lands the change.
- ADR-0011: a step session hands a stop to the issue.
- ADR-0033: the one definition of the workflow, and the skip rule. ADR-0038: a `bug` session hands
  on to `plan` in that rule.
- ADR-0072: the one master daemon of a repository.
  [ADR-0073](https://github.com/ddinkov10/celetis/blob/main/docs/adr/0073-the-runner-commands-are-clients-of-the-master-daemon.md):
  each `run` and `queue` command sends one request to it and returns.

`engine/lib/workflow.ts` of the engine is the one definition of the workflow: the lanes, with the
label, the branch prefix, and the steps in order of each lane; the stages; the command of each step;
the default gate `manual`; the decision of an issue; and the skip rule. A product project cannot change
it.

Each lane skill follows its steps in order ([lane-start.md](../references/procedures/lane-start.md), "The Iron
Law"), and a run refuses a skip between two steps
([The start of a step](https://github.com/ddinkov10/celetis/blob/main/engine/README.md#the-start-of-a-step), "A refused skip").

In this document, these names are files of the repository `celetis`, also when a session reads the
document inside a product project that has a `docs/` folder and an ADR store of its own: the three
documents `docs/workflow.md`, `docs/issue-tracker.md`, and `docs/capability.md`, the two procedure
modules `references/procedures/docs-lookup.md` and `references/procedures/prior-art.md`, and
`step-prompt.md` of the plugin folder; a runtime of `engine/` or a program of `scripts/` that the
text names by its file, which is
a file of the repository `celetis`; and each ADR number, which is a record of `docs/adr/` of the repository and
not of the product project. Each other path is a path
of the product project, apart from a path that starts with `~/` or `/`.

## Start the script

```bash
celetis daemon start                           # once: the master daemon of this repository
celetis --agent <host> run 373                 # one issue; its first step is explicit
celetis --agent <host> run 373 --effort xhigh  # the same, with its first session at xhigh
celetis --agent <host> run resume 373          # the session of a step with no progress, again
celetis --agent <host> queue status
celetis --agent <host> queue action '{"kind":"add","number":12,"step":"plan","expected":{"id":null,"revision":0,"current":null}}'
celetis run retry 373 <wait id>               # one bounded attempt cycle of a quota wait
celetis daemon status                          # the runs of the daemon, with their progress
```

These human commands select their host as
[Agent selection and model setup](configuration.md#agent-selection-and-model-setup) says. Put
`--agent claude` or `--agent codex` before `run` or `queue` to override that choice.
An explicit host stays fixed. A default step selects its host again at each session start, from
the effective order of the step
([The agent of each start](https://github.com/ddinkov10/celetis/blob/main/engine/README.md#the-agent-of-each-start)),
so a usage-limit recovery can continue the step on another host
([Usage-limit recovery](https://github.com/ddinkov10/celetis/blob/main/engine/README.md#usage-limit-recovery)).
`run retry` needs no prefix: it only wakes the live waiter of a quota wait.

Start the master daemon once for each repository with `celetis daemon start`, from a shell with
the environment that the runs need
([The master daemon](https://github.com/ddinkov10/celetis/blob/main/engine/README.md#the-master-daemon)).

A start with a number, `celetis --agent <host> run <n>`, asks the daemon for the next step of the
issue and returns at the answer of the daemon. With the default gates, it runs one step of that
issue. When the outcome of the request is unknown, read
`celetis daemon status` before you send the request again: a second start can start a second step.
[The start of a step](https://github.com/ddinkov10/celetis/blob/main/engine/README.md#the-start-of-a-step)
gives the answer, the effort level, a refused skip, auto mode, the resume, the option `--quiet`,
and the locks.

Auto mode of the daemon starts the steps whose gate is `auto`, in the lanes that `autoLanes` names,
where `triage` stands for an issue with no lane ([Gates](#gates)). Turn it on with
`celetis --agent <host> daemon auto on` and off with `celetis daemon auto off`, at any time. With
the default gates no step is `auto`, so auto mode starts nothing.

`celetis --agent <host> run resume <n>` reopens the saved session of a step
([Sessions](https://github.com/ddinkov10/celetis/blob/main/engine/README.md#sessions)).
`queue status` and `queue action` read and change the queue
([The continuous queue](https://github.com/ddinkov10/celetis/blob/main/engine/README.md#the-continuous-queue)),
and `celetis run retry <n> <wait id>` wakes a quota wait for one attempt cycle
([Exhaustion](https://github.com/ddinkov10/celetis/blob/main/engine/README.md#exhaustion)).

An argument is `<n>`, or `'#<n>'` in quotes. A shell can read an unquoted word that starts with `#`
as the start of a comment: the script then gets neither that word nor the words after it, and with
no number it prints its usage line and exits 2. Each line of `run`, `queue`, and the daemon starts
with the name of its command and a colon, apart from the usage line and the lines of the queue,
the recovery, the session, and the state, which keep their own prefix. A client prints the answer
of the daemon as it comes.

After the answer, the run lives in the daemon. `celetis daemon status` shows one line for each run,
with its state and its last line, then one line for each landing ("A landing"), and `<git common dir>/celetis/daemon/daemon.log` has each
line of the runs. Ctrl+C, a signal, or a closed terminal of the command stops no run.
`celetis daemon stop` stops the daemon and detaches every run; no command stops one run.

A line that tells you to start the run again means: send the request again. A line that tells you
to start the daemon again means: start the daemon when it does not run, then send the request
again.

The script asks for no confirmation. A start with the number of an issue whose next step is
`implement`, `chore`, or `hotfix` builds the change and lands it with `celetis --agent <host> land` when
its checks are green, with no more act of yours. With an `auto` gate on a step, the daemon run
continues through that step by itself.

## How a step runs

A session is one selected host process in the foreground of a new tab of its own, in the main
checkout
([The session tab](https://github.com/ddinkov10/celetis/blob/main/engine/README.md#the-session-tab)).
[The start of a step](https://github.com/ddinkov10/celetis/blob/main/engine/README.md#the-start-of-a-step),
"The arguments of a session", gives its arguments. The step text is a facts header
(`stepHeader`), an empty line, and `step-prompt.md` of the plugin root of the header. For
`run /celetis:plan #402`, the header is:

```text
Celetis step session
- step session: yes
- issue: #402
- step: plan
- host: claude
- main checkout: <absolute main checkout>
- plugin root: <absolute plugin folder of the host>
- landing: merge
```

The plugin root is the host-installed plugin folder that holds the loaded skills, not the version
folder of the engine: `requireContract` of `engine/lib/contract-check.ts` returns the resolved
`installedRoot` of the host. The step text compares it with the `<plugin>` of the skill entry, and a
difference after the resolution of both paths stops the step for setup. The header holds no custom
text (ADR-0032).

`step-prompt.md` holds the rules of a step session. It overrides no instruction of a skill: a skill
says what it does "In a step session". A step session is a session that the daemon starts with the
step text. The exit status of the host decides nothing: the resolver decides.

The session of `specify` is the one session with no step text, so it is no step session. For
`run /celetis:feature #402`:

```bash
claude --permission-mode auto --effort high -n '#402 specify' '/celetis:feature #402'
```

Rule 2 of the step text tells a session to publish with no wait for a review. `specify` publishes
the spec only after you approve the design, and nothing checks the design again after the publish.
So that session asks and waits as a session that you start by hand does (ADR-0007).
Codex also omits the step text for specify. Its configured developer instructions remain.

### The step end

The script ends each step session by itself, from outside its tab
([ADR-0058](https://github.com/ddinkov10/celetis/blob/main/docs/adr/0058-herdr-core-hosts-the-agent-terminals.md),
[ADR-0062](https://github.com/ddinkov10/celetis/blob/main/docs/adr/0062-each-session-runs-in-a-tab-that-the-runner-steers.md)).
Before it releases the start barrier, the daemon starts a job in the background that ends the
session. `<terminal>` below is the hc terminal of the tab:

1. The job waits for the identity of the step: the new session ID (`--session-id`) of a Claude
   step, or the thread of a Codex step, which it finds with the app-server `thread/list`
   ([Sessions](https://github.com/ddinkov10/celetis/blob/main/engine/README.md#sessions)). It also
   waits for a saved turn in the correct checkout. It warns once after 60 seconds, goes on while
   the foreground runs, and saves the verified ID in the current session record
   ([ADR-0046](https://github.com/ddinkov10/celetis/blob/main/docs/adr/0046-pending-startup-keeps-the-completion-watcher.md)).
2. It waits until the host does not work: `hc wait <terminal> --timeout 60`. A timeout is only a
   check-in, because hc counts a terminal with no status as working.
3. It reads the current turn with `hc get <terminal>`. A turn is current when the status `app`
   names the host of the step, and the status changed at or after the start of the step
   (`status_ms`). The job verifies the host and a current `idle`, `done`, or `error` status, then
   reads the decision of the issue from the in-process resolver. A decision with a result other
   than the result that started the session permits an exit check: a Run of another step, or a
   stop of the issue. A stop from an observation (the dirty tree, a landing that runs, or a failed
   read) permits none. The job reads the resolver again, and that read must give the same result.
   It then makes a final session-state check. A `working`, `blocked`, or missing status gets no
   exit.
   For Codex, it requests exit with `hc keys <terminal> ctrl+c ctrl+c`, which clears unsent
   composer text and requests native quit without submitting a chat message. Completion can
   discard a draft. For Claude, it sends `hc send <terminal> /exit` through the composer, so text
   that you type at that moment can join the command; hc refuses to send to a blocked program.
   Claude Code can answer `/exit` with a dialog and keep running (below). A failed request leaves
   the session open and prints a recovery action.
4. Otherwise it pauses five seconds and checks again. `hc wait` returns at once while the host
   does not work, so this pause permits a new resolver check while the session remains idle.

Two decisions have the same result when both are a Run of the same step, or both are a stop with
the same reason, variant, and data. The state and the lane are not part of the result. So when
`implement` records `## Built`, the issue goes from planned to built, the result stays a Run of
`implement`, and the session stays open. The two variants of `ready-for-human` (`landing refused`
and `ready for your step`) print the same line, but they are two results. When the variant changes
between the two reads of one check, the job sends no exit input at that check, and it checks again
at the next idle moment.

The daemon waits for the foreground process to exit before it releases a lock or starts the next
step. Delivery of the exit input is not completion: when the session has running background work
(a shell, a monitor, a subagent) or an active worktree session, Claude Code answers `/exit` with a
dialog and keeps running. After a successful request, the job waits for the owned host process to
exit. If a Claude host still runs 10 seconds after the job sent the request, the job sends SIGTERM
once to the host process and keeps waiting. The 10 seconds count from the start of the request,
because `hc send` can return some seconds after the delivery, while it waits for a turn to start.
The target is the host process, the one child of the start barrier, not the barrier, which handles
only SIGINT and SIGBREAK. Claude Code ends on SIGTERM with status 143 and stops its background
work. Before the signal, the job writes the file `terminated` in the start folder, and the status
143 with that file is the requested exit: the step ends as after `/exit`, and the finished tab
closes. The job sends no SIGKILL, no second request, and no key to a dialog (ADR-0080).

The job sends no signal for Codex, which keeps `ctrl+c ctrl+c`, and on Windows, where a signal is
a hard kill. It sends none either when the process read fails, when the barrier is gone or has
another process start, when the barrier has no child or more than one, when the child is gone or
has another process start, when the job cannot write `terminated`, or when the job ends first.
Then it prints one recovery message and keeps waiting. A host that still runs 10 seconds after the
SIGTERM gets one recovery message too, and the job keeps waiting. If the session stays open, exit
it in its tab when ready.

Before it releases the start barrier, the daemon publishes its completion disposition in the
private file `<git common dir>/celetis/step-end/<issue>.json`. `checking` means that the current
turn has no retained verdict. A resolver read of a landing that runs also keeps `checking`, because
the decision is pending until the landing ends; the daemon reads again at the next check.
`waiting` records an idle turn that stays open after a complete decision. `exiting` lasts from the
successful exit check until the foreground exits. The board shows a `checking` or `exiting` idle
turn in Running as `checks step`, and a `waiting` turn in Needs you
([The cards](https://github.com/ddinkov10/celetis/blob/main/engine/board/README.md#the-cards)).
The daemon removes the record when the foreground exits or the run stops. A missing or invalid
record never authorizes `/exit`. The foreground stays open and keeps its issue lock until it exits.

In each other case the session stays open: a decision with the same result, the stop of the dirty
tree, the stop of a landing that runs, the stop of a read that cannot reach GitHub, and a resolver
read that fails. So a session whose agent waits for an answer, waits for a background task, or
left an uncommitted file stays open, and a session that you start by hand never ends by itself. The
exit of the start barrier after the host exits is the only sign that the session ended: the script
then stops the job, and it reads no terminal status after the exit. When a session does not end and
its agent waits for nothing, leave it with `/exit` in its tab: the script then asks the resolver
again, and it prints the reason or starts the next step.

### A stop

A live question waits in the tab of the session; the board shows it in Needs you, and you answer in
the tab or with Go. A step session hands a stop to the issue with the act `stopped`,
`ready-for-human`, or `before-landing` of `celetis --agent <host> issue`. The act table of
`docs/issue-tracker.md`, "Conventions", gives the effect of each act. After a hold, the resolver
gives a stop with `ready-for-human`, and the job ends the session. After `before-landing`, a failed
label write, or an interruption before it, can leave the comment with no `ready-for-human`. The
resolver then gives the `human-step` stop: the absence of the label is no evidence that the human
step is done, so no step starts. Do the act that the comment names. The precondition comment
preserves build completion even if a label write fails. A plain stop records no completion: after
its clearance, an unfinished plan resumes the build without requiring the agent label. A `specify`
session and a session that you start by hand have no step text (ADR-0011).

After a stop with `ready-for-human`, complete its current requests and evidence, then start the
normal step again. Assistance can perform permitted work and clear a verified hold through
`issue <n> assisted <file>` by [Assisted completion](../references/procedures/assisted-completion.md).
A `## Stopped` or `## Before landing` comment names the act. For a refused landing of
`/celetis:implement` or `/celetis:chore`, fix a cause outside the change (for example, run the
failed job again, or land a chore that removes the advisory of a dependency). For a Verify
scenario, the act is a run of the scenario with the source and running-target proof defined in
[Runtime verification](../references/procedures/runtime-verification.md), "Reports and deferred checks".
Label removal clears a workflow hold; it supplies no runtime proof. A comment that names an act of
"During the build", or a comment with no marker of its kind, also needs a `## Human steps done`
report of the act. Label absence alone does not clear the precondition: the resolver stops an
issue with no completion evidence with the `human-step` stop, and `docs/issue-tracker.md`,
"Completing a human precondition", gives that evidence.
After a FAIL, keep the label: put the result on the issue, run `/celetis:plan #<n>` in a session of
your own, and remove the label when the new plan is on the issue.

For a hotfix whose landing stopped, the checklist of step 7 of `skills/hotfix/SKILL.md` of the
plugin holds your acts: remove `ready-for-human` first, because the landing script refuses while
the label is on, then land with `celetis --agent <host> land` in your own shell. The step does not
run again. After the removal, and until the landing, the resolver gives the `land-by-hand` stop, so
no new hotfix session starts.

### The human acts of a plan

The plan names them in its first section, `### Your steps`, in three lists: "Answers before the
build", "During the build", and "After the landing". Before it publishes the plan, the plan step
asks you each consent that a Verify scenario or the landing needs: an act that disturbs your live
tools, changes an account or a shared resource, or sends data to a service beyond the normal use
of the session. An act on temporary data in the lane or in a scratch folder needs no consent.
"Answers before the build" records each answer and its source (your message in the plan session,
with its date). The build uses that answer and does not ask again. "During the build" holds only
acts outside the session, never a consent. Do each act of "During the build" while the build runs,
and report the acts in one `## Human steps done` comment. Assistance can record verified work and
sourced human answers with that same heading; the heading denotes completed steps, not human
authorship. The act `before-landing` with `--during-the-build` gives its `## Before landing`
comment the marker of "During the build", so the engine needs both the report and the removal.
Post the report, then remove `ready-for-human`. A check of "After the landing" is no stop. The
last message of `/celetis:implement` quotes it after the landing.

### The lines of a specify session

A `specify` session starts with the run line of `/celetis:feature` for the issue. The paths of
`specify` give three lines that end it: the run line of `/celetis:plan` (the spec is on the issue),
the stop for an epic (the scope check made the issue an epic), and the stop for `wontfix`
(`specify` rejected the design). While you answer its questions, the line stays the same, and the
session stays open. A session that ends while the line is still the run line of
`/celetis:feature`, as after a spike, is "no progress". A lane change in step 1 of
`/celetis:feature` moves the line too, for example to the run line of `/celetis:bug`: the session
ends at its next idle moment, and a Run press starts that lane.

### A landing

Before `land` puts the change on the trunk, the landing curates the lesson queue in
the lane (`references/procedures/lesson-curation.md`, "Curation at a landing").

The master daemon of the repository runs the landing
([The master daemon](https://github.com/ddinkov10/celetis/blob/main/engine/README.md#the-master-daemon)).
`land` is its client: it sends one request, writes each `out` record to its stdout and each `err`
record to its stderr at once, waits with no time limit, and exits with the last `code`. It runs no
Git or GitHub act of the landing, no suite, and no lock, and it never sends the request again by
itself. Each act of the landing, the suite, and each `git` and `gh` call is a part or a child of
the daemon process, and they get the environment of the daemon, as
[The master daemon](https://github.com/ddinkov10/celetis/blob/main/engine/README.md#the-master-daemon) says,
not of the shell of the client: for example the `PATH` to the tools of the suite comes from the
shell of `celetis daemon start`, and a `GH_TOKEN` of the shell of the client does not reach the
landing. `PORT` of that shell is the exception: only the board reads it, so no landing gets it. For
the host `codex`, the landing checks the Codex home (`CODEX_HOME`, else `~/.codex`) as a `codex` run
does.

The daemon keeps one line of landings and runs the landing at its head only. A request that comes
while another landing runs, or waits, goes to the end of the line, names the landing that runs
first, then prints only the heartbeat until its turn. A waiting landing holds no lock and does no
Git or GitHub act, so the resolver does not see it (below). A request for an issue whose landing
runs or waits waits behind it too, and then runs as a new `land` would run after it: it finds the
change on the trunk and completes the cleanup, or refuses as `land` refuses. So the second landing
of a repository reads the trunk after the first moved it, and a branch that does not contain the
new head ends at its start with a `repair` line and exit 4, not after its suite. A waiting landing
whose client goes away leaves the line, with the status 143 for the client. At a stop of the
daemon, each waiting landing ends at once with a `blocked` line on stderr, which tells you to start
the daemon again and then run `land` again, and the status 6.

The landing takes the lock ref `land-<n>` with an owner of its own, whose record names the daemon
and no session, and it releases the lock at its end with each status, also after an abort or an
error, while the daemon lives. A failed release is tried once more; a second failure prints a
warning that names the lock and tells you to restart the daemon (`celetis daemon stop`, then
`celetis daemon start`), and the landing keeps its status. A daemon that dies during a landing
leaves a ref whose daemon is gone, and the next landing takes it. When another live process holds
`land-<n>`, the landing does nothing and exits 3 with a `prerequisite` line that names the holder;
wait until that landing ends, then run `land` again.

The client that goes away (a signal, the time limit of a background command, an ended session)
aborts the landing, as a stop of the daemon does
([The master daemon](https://github.com/ddinkov10/celetis/blob/main/engine/README.md#the-master-daemon), "The stop"): the landing stops at its next check,
as `land` stopped on a signal before. A running suite gets SIGTERM, and SIGKILL when it still runs
10 seconds later. Before the push it ends with no change on the trunk and the
status 143; after the push it ends with 7 and its cleanup line. Its last lines go only to the
daemon log, and the client exits 128 plus the number of its signal. At a stop of the daemon, the
client prints the last lines of the landing and exits 143, or 7 with the cleanup line. A client
that gets a signal after the push prints nothing more and exits 128 plus the number of its signal;
the cleanup line goes only to the daemon log, so a 128+n can come before or after the change is on
the trunk, and a new `land` completes it. Known limit: a client that stops reading its stream for
about 10 seconds while output is unread (for example a suspended client) makes the socket server
time out its request, which aborts the landing as a lost client does; a new `land` completes it. A
stream that ends with no `code` line (a killed daemon, a lost socket) has an unknown outcome: the
client prints a `blocked` line that says the daemon ended the landing with no status, and tells you
to read `celetis daemon status` and run `land` again, and it exits 6. A new `land` finds the change
on the trunk, or lands it.

`celetis --agent <host> land` moves the line of the issue when it merges, and it then closes the
child and checks parent acceptance before it removes the worktree
(`docs/issue-tracker.md`, "Epics" and "Epic completion and repair"). A failed read or completion of the parent prints a warning, and
the cleanup of the child continues. While `land` runs, `celetis --agent <host> next-step <n>` gives
the stop of a landing that runs: the resolver reads the holder of `land-<n>`, and a process read
that fails keeps the landing. That stop is a stop of an observation, not a stop of the issue, so
the job does not end the session. An agent that waits for a background command can end its turn
and report `done` or `idle`. So while the script runs, for up to 30 minutes, the board can show the
session in Needs you as `turn ended`: do not leave that session. If a session ended during a
landing, wait until `celetis --agent <host> next-step <n>` gives another line, and then run
`celetis --agent <host> land <n> '<subject>'` again from the main checkout: it completes the
landing. After the merge the issue is finished, so Run and `celetis --agent <host> run <n>` start
nothing, and no card shows the lane worktree and the branch that stay.
`celetis --agent <host> worktree --remove <n>` also removes them after the merge of the PR; it does
not close the epic.

Before each push, PR, re-run of a check, and merge, `land` reads the issue again, as it reads the
Git state again, and the refusal gives the resolver line of the issue
(`landable` in `engine/lib/workflow.ts` of the engine). A change that is already on the trunk (its
merge tree is the tree of the trunk, or a merged PR into the trunk has the lane tip as its head)
skips this check, so a second run after a stopped cleanup completes the cleanup on the closed
issue.
The exit status and the first word of the `land` line give the result:

| Status | First word | Result | Examples |
|---|---|---|---|
| 0 | none | landed | the change is on the trunk; also with a warning, for example when the parent of the issue cannot be read |
| 1 | none | an internal error of `land` | an unexpected exception; the 500 answer of the daemon, with its line |
| 2 | `usage` | usage | bad arguments (the usage line); no Git checkout; a run from inside the lane worktree; a dirty lane worktree; no lane branch; nothing to land; an invalid configuration; a refusal of the request by the daemon with code 2, with its line (for example the 400 usage line of the requests, or the 413 line of a subject that makes the body more than 16 KiB) |
| 3 | `prerequisite` | the issue is not ready to land | the landing prerequisites of `docs/issue-tracker.md`, "Branches, PRs, merge"; Windows; another live holder of `land-<n>`; no daemon (the line tells you to start it with `celetis daemon start`); a daemon at another revision (the line tells you to restart it with `celetis daemon stop`, then `celetis daemon start`) |
| 4 | `repair` | the lane needs a repair | a conflict with the trunk; a lane branch that does not contain the head of the trunk; a trunk head, a lane branch, a lane checkout, or a PR that changed during the landing; a missing lane worktree with the landing `merge`; lane lessons that do not validate |
| 5 | `checks` | a check is not green | a failed CI check, also after its re-run; a workflow run of the PR head that failed to start, or that ended not green with no check run; a failed `suite` with the landing `merge` (`docs/configuration.md`) |
| 6 | `blocked` | an external block | GitHub does not answer or refuses an act; a fetch or a push fails; the checks did not finish; no check ran; the main checkout is dirty, off the trunk, or with commits that the trunk does not have; the landing mechanism or the default branch changed; two branches or two PRs match; an incomplete lesson transaction (`lesson-store recover`); a lesson lock that stays busy for 10 seconds; a daemon that cannot be read (the line tells you to read `celetis daemon status`); a request during a stop of the daemon (the 503 line); a landing that waits in the line when the daemon stops; a stream with no status (above) |
| 7 | `cleanup` | landed, the cleanup stopped | the change is on the trunk, and the removal, the pull of the main checkout, or the close of the issue stopped, also by an abort: run `land` again |
| 128+n | none | a signal | a signal to the client stopped `land`, and the daemon aborted the landing (after the change is on the trunk, a new `land` completes the cleanup); 143 also for a stop of the daemon before the change is on the trunk |

## Gates

Each step has a gate. An `auto` step starts by itself. A `manual` step starts with an explicit
single-issue start, an Add to an empty queue, or Continue for its displayed queue step. The step is
the command of the `run` line with no prefix: `triage`, `bug`, `chore`, `hotfix`, `plan`, or
`implement`. One command has another step name: `run /celetis:feature #<n>`, the line of an
`enhancement` with no spec, is the step `specify`.

`gates` in the main checkout's `.celetis.yaml` holds the project gates; each omitted step is `manual`
(`docs/configuration.md`, "Fields and defaults"). The default gates start one step for each number
or Run press. With `specify` as `auto`, the daemon starts a design session and waits for your first
answer.

```yaml
landing: pr
gates:
  implement: auto
```

`autoLanes` in the same file names the lanes that auto mode takes: a sequence with one or more of
`triage`, `feature`, `bug`, `chore`, and `hotfix`. The four last names are the lane names, not the
label names. `triage` stands for each issue with no lane, whose next step is `triage`. With a list,
auto mode starts a step only for an issue whose lane is in the list, and it starts a `triage` step
only when the list names `triage`. A run of auto mode continues only into a lane of the list: when
a triage routes its issue to another lane, the run ends before the next step, and a Run press or
`celetis --agent <host> run <n>` starts that step. With no `autoLanes`, auto mode takes each lane
and each issue with no lane. The gates stay in force inside a listed lane. The list changes only
auto mode: a start with a number, a Run press, a queue run, `run resume`, and `run retry` work in
each lane. An edit of the list applies at the next read of auto mode and before the next step of
its run, with no restart of the daemon.

```yaml
landing: pr
gates:
  triage: auto
  bug: auto
  plan: auto
  implement: auto
autoLanes: [triage, bug]
```

## The board

The board is a local web page that shows each agent session of the repository and the next step of
each issue. The master daemon of the repository serves it. After `celetis daemon start` in any
checkout, open the URL in the line `daemon: board http://127.0.0.1:<port>`; `celetis daemon status`
prints it again. A repository with no daemon has no board.

The board has no config of its own. `board.port` of the main `.celetis.yaml` sets the first port
that the daemon tries, and the default is 4403. `PORT` in the environment of the daemon requests an
exact port. A person presses Run or Resume on the card of an issue to start its next step, Open
agent on a blocked issue, and Go on a session.
[The board document](https://github.com/ddinkov10/celetis/blob/main/engine/board/README.md#start)
gives the start, the port rules, the cards, the keys, and the errors.

## What the script prints, and your act

| The case that the script prints | The maintainer's act | Then |
|---|---|---|
| The issue needs info, or the issue is `ready-for-human` | do what the printed line says; for `ready-for-human`, the latest `## Stopped` or `## Before landing` comment names the act, and "A stop", gives the act after a refused landing. The card of an issue with a current landing refusal reads `landing refused`: its `## Landing refused` comment names the cause | the next step starts with a Run press or with `celetis --agent <host> run <n>`; auto mode starts it only when its gate is `auto` and `autoLanes` permits its lane |
| The issue has several lane labels | keep one lane label and remove the others | as the first row |
| The issue has an open human step | do what the printed line says: the latest `## Before landing` comment names the act. The line names the evidence that is missing: a `## Human steps done` report and the removal of `ready-for-human` after the comment, the report, or the removal (`docs/issue-tracker.md`, "Completing a human precondition") | as the first row |
| The issue waits for a landing by hand | run `land` in your own shell, from the main checkout, as the line says | none: the landing finishes the issue |
| The issue is an epic | none: each child is an open issue with its own flow | — |
| The issue is finished, or closed as `wontfix` | none | — |
| The working tree is dirty | commit or stash | as the first row |
| A landing of the issue runs | none: a session lands the issue | start the script again when the landing ended |
| The script cannot read the issue from GitHub | check `gh auth status`, the network, and the REST rate limit (`gh api rate_limit`) | auto mode tries again by itself; press Refresh on the board |
| The next step has a `manual` gate | a Run press on the card, or `celetis --agent <host> run <n>` | — |
| A run of auto mode ends before a step whose lane `autoLanes` does not name (`autoLanes does not name <name>`, where `triage` is the name of an issue with no lane) | a Run press on the card, or `celetis --agent <host> run <n>`, starts the step; to let auto mode take the lane, add its name to `autoLanes` ("Gates") | — |
| The session ended with no spec on the issue | open the session again, or read the comment of a spike | a Run press, or `celetis --agent <host> run <n>` |
| The session ended with no progress, and the next command is not `/celetis:feature` | open the session again, or read the issue | a Run press, or `celetis --agent <host> run <n>` |
| The next step skips a step of its lane (a refused skip) | read the issue ([The start of a step](https://github.com/ddinkov10/celetis/blob/main/engine/README.md#the-start-of-a-step), "A refused skip"). When a label or a heading is wrong, fix the issue. When the skip is correct, start the refused step by hand | a Run press, or `celetis --agent <host> run <n>`, starts the next step; auto mode does not start a refused step |

A Run press sends the request of `run <n>` to the daemon, which answers at its first decision. The
CLI prints a line of this table only when the run ends at its first decision or is refused. Else the
line is the `line` of the row of `celetis daemon status` and a line of
`<git common dir>/celetis/daemon/daemon.log`. Read the state on the issue card; a startup stop
appears in its existing warning area after the board reads the outcome of the run in the status of the daemon. `engine/board/README.md` of the repository `celetis` gives
the state of each issue and the card of each state.

A finished issue is closed with no `wontfix` label. After a landing, the change is on the trunk.

## Acceptance status

Each item gives the current status of one capability or host part, the host versions that its
evidence observed, its open checks, and the issue that holds the evidence. A status word claims no
more than that evidence shows: PASS, partial, BLOCKED, FAIL, or unverified. An item that has no
issue, or no evidence comment on its issue, points to the history of this document. Required acceptance covers
Claude Code and Codex TUI/CLI only (ADR-0016). A desktop probe has its own record. A BLOCKED or
UNRUN desktop probe does not block complete CLI checks, and a desktop success does not close a CLI
gap. An observed version is no minimum version.

- **Owned-step usage recovery (#236).** partial. Hosts: Claude Code 2.1.318, Codex CLI 0.166.0,
  Bun 1.4.4. Open: a real ordinary Claude turn (BLOCKED by the weekly allowance); Codex and Windows
  termination proof (Codex stops and keeps its Resume information); native Linux and Windows; the
  exit-watcher, PID 1, and process-snapshot timing cases; the Starting-row timing of the board.
  Evidence: [#236](https://github.com/ddinkov10/celetis/issues/236).
- **Native usage adapters (#236).** partial. Hosts: Claude Code 2.1.318, Codex CLI 0.166.0,
  Bun 1.4.4. Open: a real ordinary Claude turn (BLOCKED by the weekly allowance); a live
  subscription refusal and failover; Codex and Windows termination proof; native Linux. Evidence:
  [#236](https://github.com/ddinkov10/celetis/issues/236).
- **Product-owned setup references (#107).** partial. Hosts: Codex CLI 0.166.0, Claude Code
  2.1.312, Bun 1.4.4. Open: the six Claude V6 cases and the two Claude V7 cases (BLOCKED by the
  weekly allowance); native Windows. Evidence:
  [#107](https://github.com/ddinkov10/celetis/issues/107).
- **Reduced setup ownership (#106).** partial. Hosts: Codex CLI 0.166.0, Claude Code 2.1.312,
  Bun 1.4.4. Open: Claude V5 to V7 (BLOCKED by the weekly allowance); Claude V8 (unverified);
  Codex sessions that the Celetis session pin does not cover. Evidence:
  [#106](https://github.com/ddinkov10/celetis/issues/106).
- **Explicit host usage limits (#172).** partial. Hosts: Codex CLI 0.166.0, Claude Code 2.1.312.
  Open: Claude V1 and V2 (BLOCKED by the weekly allowance); the installed plugin and the runner.
  Evidence: [#172](https://github.com/ddinkov10/celetis/issues/172).
- **Running-build evidence (#169).** PASS. Hosts: Codex CLI 0.166.0, Bun 1.4.4. Open: the real
  device, browser, backend, and installed-plugin runtimes (the checks used synthetic inputs).
  Evidence: [#169](https://github.com/ddinkov10/celetis/issues/169).
- **Standalone engineering principles (#166).** partial. Hosts: Codex CLI 0.165.0, Claude Code
  2.1.312, Bun 1.4.4. Open: every Claude explicit, implicit, custom-entry, control, and workflow
  case (BLOCKED by the weekly allowance). Evidence:
  [#166](https://github.com/ddinkov10/celetis/issues/166).
- **Codex CLI opt-in support (#21).** partial. Hosts: Codex CLI 0.162.1 (a board Run opened it and
  completed a real fixture turn; the 21-case step suite passed). Open: resource lifetime of an
  installed plugin; same-child changed-model and effort repair; every applicable lane and helper;
  failed-task repair; waiting, permission, and guard scenarios; cross-host steps and handoffs;
  compaction and exact resume; native CLI skill selection; permissions in the active CLI host; live
  board state and action pairs; updates; Claude runtime checks (deferred). Evidence:
  [#21](https://github.com/ddinkov10/celetis/issues/21).
- **Claude Code CLI step runs.** partial. Hosts: Claude Code 2.1.302. Open: managed plugin setup
  and complete child bootstrap. Evidence: in the history of `workflow.md` before #265, at
  `81c126e`.
- **Superpowers 7.0.0 on Codex.** partial. Hosts: Superpowers 7.0.0. Open: each active surface
  must expose the dispatch and follow-up controls that the procedures require. Evidence: in the
  history of `workflow.md` before #265, at `81c126e`.
- **Checkout native entry (#100).** PASS. Hosts: Claude Code 2.1.310, Codex CLI 0.164.0. Open: an
  installed-package update; native Windows; optional desktop; a full lane. Evidence:
  [#100](https://github.com/ddinkov10/celetis/issues/100).
- **The `issue` command in a step session (#103).** partial. Hosts: Claude Code 2.1.310, Codex CLI
  0.164.0. Open: a step session that runs the command from a skill; a Codex step session with the
  personal rule in the user configuration. Evidence: in the history of `workflow.md` before #265,
  at `81c126e`.
- **Dispatch report flow (#104).** PASS. Hosts: Claude Code 2.1.311, Codex CLI 0.164.0. Open:
  independent native enforcement ([#151](https://github.com/ddinkov10/celetis/issues/151));
  changed-pair same-child repair (unsupported by the observed follow-up tools); live Windows lock
  execution; an installed-package update. Evidence:
  [#104](https://github.com/ddinkov10/celetis/issues/104).
- **Module architecture and facts entry (#105).** partial. Hosts: Claude Code 2.1.312, Codex CLI
  0.165.0. Open: an installed entry after `celetis update`; a runner step in herdr with the facts
  header; the Codex rule-list entry with a file reader and no process tool; Windows. Evidence:
  [#105](https://github.com/ddinkov10/celetis/issues/105).
- **Codex empty hooks override (#161).** PASS. Hosts: Codex CLI 0.165.0, Claude Code 2.1.312.
  Open: installed startup after a terminal-confirmed `celetis update`. Evidence:
  [#161](https://github.com/ddinkov10/celetis/issues/161).
- **Board update and restart (#164).** PASS. Hosts: Claude Code 2.1.312, Codex CLI 0.165.0,
  Bun 1.4.4 on macOS; Bun 1.4.4 on Linux. Open: Windows. Evidence:
  [#164](https://github.com/ddinkov10/celetis/issues/164).
- **The celetis program (#126).** partial. Hosts: none named in the evidence. Open: native Windows;
  the `PATH` of a desktop host; the first real `celetis update` of the maintainer installations.
  Evidence: [#126](https://github.com/ddinkov10/celetis/issues/126).
- **Native Windows (#125).** partial. Hosts: Windows 11 Pro 10.0.26200, Bun 1.4.4 and 1.4.2, Git
  Bash, Windows PowerShell 5.1 (the verify gate, the launcher, the update lock, and the board
  before #102 passed). Open: herdr-core and the Herdr app; Codex; PowerShell 7; a real
  `land` run; a confirmed update apply; the board of #102; the personal `land` and `issue` rules.
  Evidence: in the history of `workflow.md` before #265, at `81c126e`.
- **Blocked-issue assistance (#147).** partial. Hosts: Codex CLI 0.165.0, Claude Code 2.1.312,
  Bun 1.4.4, herdr 0.9.3. Open: Claude V1, V2, and V5 (BLOCKED by the weekly allowance); native
  custom entry in an untrusted project; native Windows. Evidence: in the history of `workflow.md`
  before #265, at `81c126e`.
- **Assisted completion of holds (#178).** partial. Hosts: Codex CLI 0.166.0, Claude Code 2.1.312,
  Bun 1.4.4. Open: every Claude assistance scenario (BLOCKED by the weekly allowance). Evidence:
  [#178](https://github.com/ddinkov10/celetis/issues/178).
- **herdr-core host (#182).** PASS. Hosts: hc 0.1.16, herdr-app 0.1.11, Claude Code 2.1.316,
  Codex CLI 0.166.0, Bun 1.4.4. Open: native Windows (the paths compile and are marked
  unverified); a board Run of the installed program on real issues with the real `gh` (the check
  after the landing). Evidence: [#182](https://github.com/ddinkov10/celetis/issues/182).
- **Session tabs (#232).** PASS. Hosts: hc 0.1.16, herdr-app 0.1.11, Claude Code 2.1.316,
  Codex CLI 0.166.0, Bun 1.4.4. Open: native Windows; a board Run of the installed program on real
  issues with the real `gh`; the focus outside the Herdr app; the automatic runner (the checks
  after the landing). Evidence: [#232](https://github.com/ddinkov10/celetis/issues/232).
- **Codex desktop.** BLOCKED. Hosts: none. Open: native entry and automation of the owned isolated
  package (optional; a CLI probe does not establish a desktop result). Evidence: in the history of
  `workflow.md` before #265, at `81c126e`.

## Limits

- The REST API of GitHub lists a commit status only after the status reports. So the list does not
  show a status that branch protection requires until that status reports. Until then,
  `celetis --agent <host> land` can read `pass` and ask for the merge. GitHub then refuses the merge, and
  the build step stops with `## Landing refused`. Until then, the board also shows `pass` for the PR.
- The board reads the check runs and the commit statuses of a PR, and no workflow run. So for a PR
  whose workflow run failed to start, or ended not green with no check run, the board shows `pass`,
  or no value when the PR has no check, while `celetis --agent <host> land` refuses the PR with
  exit 5.

`engine/board/README.md` of the repository `celetis` holds the limits of the page.
