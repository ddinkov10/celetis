# The engine

`engine/` is the Celetis engine: the master daemon of a repository, its runs,
the session tabs that the runs open and end, and the records that they keep. This document holds
the rules of the engine. [The workflow](../plugins/celetis/docs/workflow.md) holds what a person
does and what a session sees, and [the board document](board/README.md) holds the board.

## Requirements

[Requirements](../plugins/celetis/README.md#requirements) of the plugin names the platforms, the
tools, and their versions. The engine adds these rules:

- `celetis daemon start` checks `hc`, its server, `herdr-app`, and the window of the Herdr app
  before it spawns the daemon. It also checks `gh` on `PATH`, except in a project with the local
  tracker and the `merge` landing; a project with no valid `.celetis.yaml` counts as GitHub; the row of `daemon` in
  [The commands](../plugins/celetis/README.md#the-commands) gives its exit codes. The daemon checks them again before each run reads its issue (a
  number, auto mode, a queue wake, `run resume`, and `run assist`), with `gh` by the same rule. A failed check there is the refusal of the
  request, with the same code and a line that names the missing part and how to start it; for a
  queue wake, the line becomes the queue error.
- Complete the normal folder trust of the host before a run. The daemon never answers that prompt.

## The tracker of a process

The entry `engine/celetis` reads `tracker` of the `.celetis.yaml` of the main checkout of its
folder and gives it to the command as `CELETIS_TRACKER` (`github` with no checkout or no valid
file; the command then reports the config itself). `commandInput` sets the key grammar of the
process from it (`useGrammar` of `engine/lib/tracker/grammar.ts`) before any key parses, so a lane
worktree cannot change the grammar. The daemon inherits the value from `daemon start`, and the
entry `engine/daemon.ts` sets the grammar from it (`useProjectGrammar`) before its forms `--daemon`,
`--session-start`, and `--prepare-state`, which skip `commandInput`. Its
runs and its board read keys with it. The board page in the browser takes the grammar from
`grammar` of each board document (`useGrammar`) before it parses a key of that document.
Each command takes its tracker and its code host from `services` of
`engine/lib/services/services.ts`, with the `tracker` and the `landing` of the main config.

## The start of a step

A run uses the environment of the daemon ([The master daemon](#the-master-daemon)). Only these
values of the command travel in its request: `--agent` and `CELETIS_AGENT` as the host selection,
`--effort`, and `--model`. Each other variable of the shell of the command, for example `PATH`,
`CLAUDE_CONFIG_DIR`, or `CODEX_HOME`, does not reach the run.

Intake, Assist, and Make visual share the independent-session launcher. Default launches read
the current order and per-host usage records from the Git common directory. They select the
first included host that can run an interactive session and has no confirmed active block.
Explicit choices keep their exact host.
An elapsed supplied reset permits an attempt without changing the stored block. Exhausted
defaults report each block and its supplied reset, or unknown, without starting an agent.
The selected host's normal preflight remains binding; other errors do not select another host.

Each independent launch allocates a per-host attempt number under its own limit-record lock.
Native observations must match the verified session and attempt. Accepted attempt numbers
and observation sequences reject stale updates and duplicate delivery. Unknown observations
preserve blocks; verified availability can clear them. Preference records, per-host limits,
and native per-attempt sequences have separate write targets. A running independent session
keeps native recovery and its exit status; exhaustion never transfers its conversation or
starts a replacement. `CELETIS_SESSION_AGENT` carries attribution only. An inherited explicit
`CELETIS_AGENT` keeps its user meaning.

**The capability of a host.** The adapter of each host states what it can run
([ADR-0104](../docs/adr/0104-a-host-states-what-it-can-run.md)); OpenCode runs only the step `triage`
([OpenCode](../docs/hosts/opencode.md), "The capability"). The start of a step that the selected host cannot run,
also a Resume or the next step of a run, and each command that it cannot run (`land`, `dispatch`, `capscore`,
`assist`, `intake`, `visual`, `coordinator`, and `setup`) exit 3 with a line that names the host, what it runs, and
the hosts that can. No other host starts. The default order and the quota recovery skip such a host for the
step, except the preferred host of `agents.<step>`; when no host is left, the start refuses with that line.

**The answer.** Each form that starts work (`run <n>`, `run resume`, `run assist`, `run retry`, and a `queue action`
with a wake) sends one request to the master daemon of the Git common folder of the
current folder, so a linked worktree reaches the daemon of its main checkout. It waits at most 120
seconds for the answer, prints it, and exits; it never sends the request again. The daemon answers
after the checks before the first session of the run and after its first decision read
([The master daemon](#the-master-daemon), "The requests"). A quota wait at the first session is
accepted. A daemon of another revision of the engine gets no request. An answer that cannot be
read, also a code that is no exit class, is an unknown outcome. The rows of `run` and `queue` in
[The commands](../plugins/celetis/README.md#the-commands) give the lines and the exit codes of the
answer.

**A start with one number** asks the daemon for a run of the issue. The daemon run reads the
decision of the issue from the in-process resolver (`nextIssue` of `engine/lib/resolver/resolver.ts`), a Run of a step or a stop, and starts the step
of a Run, whatever its gate. When the session ends, it reads the decision again and starts each
next step whose gate is `auto`. The gate of a Run is the value of its lane and its step in `gates`,
or `gates.triage` for a Run with no lane (`gateOf` of `engine/lib/workflow/workflow.ts`). It ends
the issue at the first of these, in this order: a stop, the same step again ("no progress"), a
refused skip, or a `manual` gate. At a `manual` gate it prints
`the gate of <step> in the lane <lane> is manual: celetis --agent <host> run <n> starts <command>`,
or `the gate of triage is manual: …` for a Run with no lane. With the default gates, each next
step is a `manual` step.

**The model and the effort level.** The daemon resolves one start pair, a model and an effort
level, for each session that it starts (`startPair` of `engine/lib/workflow/effort.ts`). Each value is the
first that is present, from the strongest: the override of this start, the `sessions` pin of the
step in the `.celetis.yaml` of the main checkout
([Fields and defaults](../plugins/celetis/docs/configuration.md#fields-and-defaults)), the
decision of the step before on the issue, and the default `opus` and `medium`. The decision is the
newest `Effort: <step> <model> <level>` comment for the step
([What lives on the issue](../plugins/celetis/docs/issue-tracker.md#what-lives-on-the-issue),
"Effort"); a comment in the old form `Effort: <step> <level>` is no decision. The source of each
value is `override`, `pinned`, `decided`, or `default`. `--model <model>` and `--effort <level>`,
each before or after the one number, override the model and the level for the first session of
this start only, also over a pin: the model is `haiku`, `sonnet`, `opus`, or `fable`, and the level
is `low`, `medium`, `high`, `xhigh`, or `max`. Each later step of the same start uses its own pin
and decision, and an override writes no decision on the issue. Claude Code starts on the model and
the level of the pair. Codex keeps the model of its config, and raises a decided or default level by the tier of
the model of the pair ("The arguments of a session" below).

**A refused skip.** Between two steps of one start, the script refuses a next step that skips a
step of its lane. Let S be the step that ended, and T the next step in the lane of the decision.
T can start when its position in the lane is at most one more than the position of S. A session
of `bug` also writes the plan (step 7 of `/celetis:bug`), so in the lane `bug` the script takes
the position of `plan` for S = `bug`. When S is not a step of that lane (a lane change), T must be
the first step of the lane. `triage` can always start. So `specify` → `plan`,
`bug` → `plan`, `bug` → `implement`, `plan` → `implement`, `specify` → `bug` after a relabel, and
`implement` → `plan` can start, and `triage` → `plan`, `specify` → `implement`, and
`triage` → `implement` cannot.
At a refusal the run prints the skip line, which names T, the skipped steps, and S
([What the script prints, and your act](../plugins/celetis/docs/workflow.md#what-the-script-prints-and-your-act)).
It adds the row `<n>\t<run line of T>` to the record and ends the issue. The skip check comes before the gate check, so a refused step with a
`manual` gate also gets a row. The first step of a start with one number, and the first step that
auto mode takes, have no skip check. So your start with the number is the override: it
starts T.

**Auto mode** of the daemon reads the decision of each open issue from the same resolver, with the
GraphQL batch read of `nextOpen`, and takes the lowest open issue whose decision is a Run,
whose Run has the gate `auto`, whose lane is in `autoLanes` of the main `.celetis.yaml`,
whose step has no row in the record, whose number is not in the `set-aside` file, and
whose lock is free. A Run with no lane, the `triage` step of an issue with no lane label, counts as
the name `triage` of the list. With no `autoLanes`, each lane and each issue with no lane passes
this lane test. It does the same work on that issue, but it starts no `manual` step, and then it
asks again. It does not take a step that the script refused as a skip, because that step has a row
in the record. When no issue can start, when the issue started no session, when the resolver cannot
read GitHub, or when it cannot read the `set-aside` file, it waits 60 seconds. It prints one line for the whole wait. While it waits,
`celetis --agent <host> next-step --open` shows the line of each open issue: a `stop` line gives the
cause, and a `run` line that does not start has a `manual` gate, a lane outside `autoLanes`, a row
in the record, a number in the `set-aside` file, or the lock of another run. It reads open issues only.
[The master daemon](#the-master-daemon), "The requests", gives auto off.

**The lanes of auto mode.** A run that auto mode started tests the lane again before each step that
it starts, the first step too: a session can route the issue to another lane, or change its lane
label. Before a step whose lane is outside `autoLanes`, the run prints
`#<n>: autoLanes does not name <name>: celetis --agent <host> run <n> starts <command>`, where
`<name>` is the lane of the decision, or `triage` for an issue with no lane. It starts no session
and ends the issue as at a `manual` gate, with the end kind `gate` and the code 0, so auto mode
takes the next issue. The lane test comes before the check for no progress and the skip check, and
the end adds no row to the record: the lane test of the pick keeps the issue out. The quota
recovery of a step that already started has no lane test, as it has no gate test; the test applies
again before the next step. A run of auto mode that a successor daemon takes over keeps the test.
No other run has a lane test: a start with a number, a Run press, a queue run, `run resume`, and
`run assist` work in each lane, and `run retry` only wakes the quota wait of a run. The engine reads `autoLanes`
from the main checkout at each pick of auto mode and before each step of its run. So an edit of the
list applies with no restart of the daemon and no new auto on, and a session that runs keeps
running. An invalid list is an invalid configuration: it refuses the next operation of auto mode,
and that refusal ends auto mode, as each other invalid field does.

**The form `run resume <n>`** asks the daemon to reopen the exact session of the record
`<git common dir>/celetis/sessions/<n>.json`, with its saved host and checkout, in a new tab that
opens in the background ([Sessions](#sessions)). A Resume press of the board types this form.

**The form `run assist <n>`** asks the daemon to open an assist session for an issue with
`needs-info` or `ready-for-human`, in the main checkout, in a new tab `#<n> assist` that opens in
the background. The run takes the issue lock, then reads the issue: an unreadable issue refuses
with code 6, a closed issue refuses with `daemon: #<n> is closed; no assist session starts`, and an
issue with no hold refuses with
`daemon: #<n> has no hold (needs-info or ready-for-human); no assist session starts`, both with code
3. The session starts the skill `assist` with the input `#<n> coordinator`, with no saved session
record, so the record of a stopped step stays for `run resume <n>`. The run has no step-end watch,
as a resume run, and ends with the session. The direct command `celetis assist <n>` is no run.

Issue locks and the lock `auto` of auto mode use shared Git refs under
`refs/celetis/locks/`. Their owner records are `{ daemon, session }`: the daemon and foreground
PIDs and process start times. Either live process keeps the lock, including after
a killed daemon; an exited
process does not. A process that the engine cannot read, for example after a failed `ps` call,
also keeps the lock. Only a definite read frees it: the process does not exist, it has another
start, or the daemon PID does not run `daemon.ts`. A daemon that stops while its session
lives leaves the lock to that session.
A new start for the issue cannot begin until the session exits. Claims and releases use Git
compare-and-set, and foreground registration updates all held locks in one transaction. Both
hosts and manual resume share the issue lock.
A landing in the master daemon holds the lock ref `land-<n>`, with the daemon as its owner and no
session. A direct landing, which `land` runs with no daemon, holds it with the `land` process as the session and no daemon
([A landing](../plugins/celetis/docs/workflow.md#a-landing)). The `no-progress` file in `<git common dir>/celetis/` has one row for each step that ended with no progress, and one row for
each step that the script refused as a skip. Auto mode and the board read it. An
explicit issue start can start that step. `engine/lib/state/locks.ts` of the engine owns the lock refs,
the owner records, the liveness check of an owner, and the record; the daemon and the board use it.
The `set-aside` file in the same folder holds one issue key per line, for each issue that the
maintainer set aside. It is keyed by the issue only, so it holds across a step change. Auto mode
starts no issue of the file, and the board shows the issue as set aside in Idle. That state comes
after a held issue lock and before a dirty lane worktree and a no-progress row. A run of the issue
with the input of a number, a resume, or a queue (`celetis run <n>`, `celetis run resume <n>`, the board Run and
Resume, and each issue that a queue run takes) removes the number when it takes the issue lock, so
a refused start keeps it. An assist run (`celetis run assist <n>`), as auto mode, removes no number. Only the master daemon writes the file, one write at a time (the request `POST /aside` adds a number, under the issue lock, and a Stop adds the number of its
run after the proven end of the session, [A stop of a run](#a-stop-of-a-run)), and each
write replaces the whole file. A missing file holds no issue, and a line that is not a positive
number has no effect. Each other read failure is an error of the board read, and auto mode starts
no issue in that pass. An explicit start also fails then: its removal at the admission cannot read
the file, so the run ends with that error before a session starts. A run of auto mode reads the file
again after it takes the issue lock. When the issue is in the file, or the read fails, the run
prints the cause, ends with the outcome `stopped` (no failure), releases the lock, and starts
nothing. `engine/lib/queue/set-aside.ts` owns the file.

**The arguments of a session.** `stepArguments` of the adapter of each host builds the arguments
of a step session from the start pair: [Claude Code](../docs/hosts/claude-code.md#the-daemon) and
[Codex](../docs/hosts/codex.md#the-daemon-and-developer_instructions) give them, with the Codex
prompt. Claude Code gets `--model <model>` and `--effort <level>` of the pair. Codex keeps the model
of its config and gets only a level: a level with the source `pinned` or `override` as it is, else
the level raised by the tier of the model of the pair (`tierRaise` of `engine/lib/host/codex/adapter.ts`):
0 levels for `haiku` and `sonnet`, 1 for `opus`, and 2 for `fable`, at most `max`. Then the
supported levels of the Codex model apply. A failed model read of Codex starts no session and
writes no session record. No document content is evaluated as shell code. After it builds the
arguments, the daemon prints the start line
`start: <prompt> on <model> (<source>) at <level> (<source>)`, with the source of each value of the
pair. On Codex the line ends with `; codex keeps its configured model <codex model> and applies <applied level>`.
[OpenCode](../docs/hosts/opencode.md#the-daemon) gets `--standalone --auto -s <id> --prompt <prompt>`,
with the session ID that the adapter makes before the start, and no model or level: the session
keeps the model and the variant of the OpenCode configuration, and the start line ends with
`; opencode keeps the model and the variant of its configuration`. Before the tab opens, the
daemon writes the session environment of the host (`sessionEnv` of the adapter) as a JSON object to
the file `env` of the start folder ([The session tab](#the-session-tab)). For OpenCode it holds
`OPENCODE_CONFIG_CONTENT`, which names the skills of the plugin root and the step text file
`step.md` of the start folder; for Claude Code and Codex it is `{}`. A Resume writes both files
again in its own start folder. An OpenCode Resume checks the contract version of the plugin before
it writes them; a Claude Code or Codex Resume has no contract check. A failure there ends the run
with `daemon: #<n> cannot prepare the session environment: <cause>`, opens no tab, and writes no
session record.

## The continuous queue

Add persists one eligible issue and starts its displayed first step when the queue is empty.
Later Add actions append without interrupting current work or authorizing a stopped step.
Only waiting issues can move or leave through an edit. The agent choice stays fixed while nonempty.
An incoming explicit host must match that saved explicit choice. A saved default choice refuses
an explicit host before admission or wake claim. With no explicit input, Continue, Retry, and
waiting edits keep the saved choice. Status does not select work.
Every later step, including the first step of waiting work, follows fresh project gates.
Continue authorizes exactly the displayed step. Retry authorizes recovery of that displayed
step; a null step only acknowledges a fresh terminal result and authorizes no later issue.

The public forms are `queue status` and `queue action '<QueueAction JSON>'`. Status may
prepare supported old storage, but performs no workflow action. Action persists a mutation and
prints the queue view; when the mutation issued a wake, it sends the wake to the daemon and prints
the answer ([The start of a step](#the-start-of-a-step), "The answer"). When the action would issue a
wake on the record that it reads first (an Add to an empty queue, a Continue, or a Retry), it
checks the daemon before the admission. A move, a remove, and an Add to a nonempty queue need no
daemon. When the daemon stops between the admission and the
wake, the queue keeps an unowned pending launch, which a deliberate Try again recovers.

Every action has `expected: {id, revision, current}`, where current is the issue key of the first
issue, as a JSON string (`"12"`). Only a missing record accepts null ID, revision 0, and null
current. Add has kind, number, and step; move has kind, number, and direction up/down; remove has
kind and number; continue and retry have kind and step. Each `number` is an issue key as a JSON
string. Retry alone permits a null step. Extra fields, unsafe integers, a key that the grammar of
the tracker refuses, duplicates, stale identity/revision/current, current-row edits, and a
conflicting agent choice refuse.

Schema 4 is at `<git common dir>/celetis/queue.json`. It has an ID and increasing
revision, ordered unique issue keys in `numbers` (each a JSON string), the fixed agent choice
(`default`, or `explicit` with its host), the active host, current and last Runs, reason/action, a
wait ID, and a nullable launch token with issue-bound one-step authorization (its `number` is the
key of the first issue). Its states are empty, starting, running, quota-wait, me-gate,
and error. Empty retains the record identity but has no numbers, choice, or active host. A
default choice stays default: each start selects its host from the effective order of its step
([The agent of each start](#the-agent-of-each-start)). The active host is the host of the current
session, or null. `quota-wait` has the wait ID of the issue's recovery record and no active host
([Usage-limit recovery](#usage-limit-recovery)).
It has no completed rows, history, reset, or tab-local draft.

The stable native `queue-write.lock` serializes short read-modify-write transactions. Acquisition
waits at most 10 seconds. Remote reads and foreground execution stay outside this lock.
The separate queue and issue execution locks retain the existing process-identity checks.
Claim consumes a launch token once under ownership. A delayed or duplicate wake starts nothing.
Waiting edits preserve a pending token and the current stop. The daemon reads committed
membership before transitions. Final drain releases execution ownership and commits empty under
the same write lock, so an Add on either side survives with an executor or explicit recovery.

The board keeps two local trend files beside it, `trend-samples.jsonl` and `trend-cache.jsonl`
(mode 0600, one JSON object per line). A sample line is `{at, needs, working}` with counts or null;
a cache line is a commit line `{sha, issue, at}` or an issue line `{issue, createdAt}`. The native
`trends-write.lock` serializes each append and each prune, and waits at most 10 seconds. A read takes
no lock and skips a line that does not parse. The prune keeps the samples of the last 7 days and the
commit lines of the last 56 days with the issue lines that they name. The board server is the one
writer in the normal case.

The existing launch loop retains startup barriers, saved-session checks, skip/no-progress checks,
and foreground cleanup. A live foreground retains ownership when its daemon dies. A save failure
prevents further starts. An unowned pending or running record permits deliberate Try again;
it never silently starts again. A question remains a live session; use Go to answer it.

Only fresh resolver results of finished or wontfix remove work. A full board read, or a selected
read of a queued issue, resolves waiting members, including issues absent from the open list.
Unreadable members stay queued with an error. A current issue cannot drain while its run or foreground owns it.
When an unowned stopped current closes, reconciliation advances with normal gates or leaves
empty. An Add after the final drain starts more work without reload or reset.

**Automatic storage preparation.** Ordinary queue readers and writers convert valid schemas 1,
2, and 3 to schema 4. Schema 3 to 4 writes each issue number of `numbers` and of the launch
authorization as its key, a JSON string (`12` becomes `"12"`), and keeps each other field and the
revision. Schemas 1 and 2 first convert in memory as they did to schema 3, then to schema 4, in the
same access. Schema 2 retains ordered numbers, state, current/last Runs,
reason/action, and pending launch token and authorization. Schema 1 keeps only
`numbers.slice(position)` as unfinished work; its completed prefix and results stay in the
backup. Complete becomes empty. Nonempty work pins its recorded host as an explicit choice.
Active host and wait ID become null; schema 1 has no launch. From schema 1 or 2 the revision
advances once. A number that the grammar of the tracker refuses (for example `0`) refuses the
record intact, before any lock. A valid current record or absent record causes no conversion or
archive.

Preparation takes queue execution ownership, then ownership of the current unfinished issue,
then the write lock, and rereads under those locks. A run with those locks prepares directly.
Other callers start the internal form `daemon --prepare-state queue` or
`daemon --prepare-state session <n>` through the engine entry `engine/celetis` of the same revision.
On macOS and Linux the entry replaces its process with `daemon.ts`; on Windows the launcher
starts `daemon.ts` as a child and stays its parent. The preparation starts no terminal, host,
GitHub read, or workflow action. Live owners and busy locks refuse without
stealing ownership. Retry through the ordinary operation after the owner exits.

Before atomic replacement, a private sibling
`queue.json.schema-<source schema>.<SHA-256 of original bytes>.bak` retains the exact original
bytes. An identical safe archive is reused; conflicting archives refuse. Backups remain
indefinitely and are never restored over live data automatically. A retry after interruption
sees either the old record or the complete current record; it does not advance the revision again.
This is a process-interruption guarantee on the supported local filesystem, not a power-loss claim.
Invalid JSON/UTF-8, unknown fields or schemas, unsafe storage, unmappable values, and failed
persistence refuse with the record path and cause. No missing Run or authorization is invented.
Invalid or unreadable storage requires repair; it is never empty. Product configuration and
installation adoption remain outside this runtime-state exception (ADR-0070).

## The master daemon

The master daemon is one long-lived process for one repository, the Git common folder of its
working folder. It runs many issue runs at the same time, with the run engine
(`engine/lib/run/engine.ts`), runs each landing of `celetis --agent <host> land` in the daemon
process, one at a time, when it runs (with no daemon, `land` runs the landing in its own process) ([A landing](../plugins/celetis/docs/workflow.md#a-landing)), and serves requests over HTTP on a Unix socket
([ADR-0072](https://github.com/ddinkov10/celetis/blob/main/docs/adr/0072-one-master-daemon-runs-every-issue-run.md)). Its process is
`engine/daemon.ts --daemon` (a successor adds `--after <pid> <start>`, "The restart"), so the
lock, step-end, and recovery checks accept it as the daemon. Nothing starts a daemon by itself. The daemon also serves the board on a loopback port
([The board](board/README.md#start)). The `run`, `queue`, and `land` commands send their requests to it, and the board presses
go to it in its process ([The start of a step](#the-start-of-a-step), "The answer"). The shared locks keep one owner
for each issue, for the queue, and for auto mode across the daemon and a second daemon.

**The commands.** `celetis daemon start`, `status`, `stop`, `auto on|off`, and `events` (`engine/daemon.ts`) find the Git
common folder of the current folder, so a linked worktree reaches the daemon of its repository.
The row of `daemon` in [The commands](../plugins/celetis/README.md#the-commands) gives the output
and the exit codes of each form.

- `start` replaces no running daemon, and it reads no status of a daemon of another revision.
  Else it spawns `engine/daemon.ts --daemon` in the main checkout. The spawn is detached, with
  stdin closed and stdout and stderr appended to `daemon/daemon.log` (0600). It polls the status
  for at most 30 seconds. Another daemon that wins a race is printed as a running daemon.
  On Windows, `start` calls `CreateProcessW` (`createDetachedProcess` of `engine/lib/process/windows.ts`)
  with a console that has no window (`CREATE_NO_WINDOW`, so its console children share it and open no window), a new process group, and the flag that lets the daemon break away from the
  job of its terminal, so the daemon runs after that terminal closes. When the innermost job of
  the terminal does not allow breakaway, the call fails with error 5 and `start` calls again
  without the flag. After the call, `start` reads `IsProcessInJob` of the new process for any job
  (a failed read counts as a job). When the process is in a job, `start` prints `daemon: this
  terminal does not let the daemon leave its job; the daemon ends when this terminal closes` on
  stderr after its start line, and it still exits 0. The read covers an outer job that a
  breakaway at the inner levels did not leave.
- `status` first compares the revision of the daemon with its own, and reads no status of another
  revision.
- `stop` sends `POST /stop` and reads the process until it is gone, for at most 60 seconds.
- `auto on` and `auto off` send `POST /auto` with the host of `--agent` and
  `CELETIS_AGENT` (each only when present), wait at most 120 seconds, and never send again. On an
  accept they read the status.
- A daemon is running only when the identity file names a PID with that start time and a command
  that holds `daemon.ts`. A failed read of the process table is neither: each form exits 6
  and `start` spawns nothing.

The daemon gets the environment of the shell of `daemon start`, except `HC_SCOPE` and `PORT`.
`hc kill` ends each process that carries the scope of its terminal, so a daemon with `HC_SCOPE`
would end with the terminal that started it. `PORT` is the port of the board, so only the board
reads it. A later change of the shell environment does not reach a running daemon, and so no run
and no landing. To change a value, stop the daemon and start it again from a shell with the new
value.

**The start.** In this order, the daemon:

1. finds the main checkout and the Git common folder of its working folder;
2. makes the socket path `/tmp/celetis-<uid>/daemon/<first 16 hex digits of the SHA-256 of the
   Git common folder>.sock`; on Windows, `%TEMP%\celetis\daemon\<the same digits>.sock`. A path of
   104 bytes or more stops the start with exit 3, before any folder or lock;
3. makes `<git common dir>/celetis/daemon/` and its `runs/` folder (0700), and the socket
   folder `/tmp/celetis-<uid>/daemon/` (0700); on Windows, `%TEMP%\celetis\daemon\`. On Windows, it
   then holds the socket folder open with no `FILE_SHARE_DELETE` until the daemon exits, so the
   folder cannot be renamed, sets a protected access list on it (the current user, SYSTEM, and the
   administrators, with no inherited entry), and checks the owner and the list. It exits 3 when
   another user owns the folder, the folder denies the current user access, the folder is a
   reparse point, or another user can still reach the folder, and 6 when a security call fails.
   `daemon start` then exits 6, because the daemon ended before it served. Before the spawn, on
   Windows, `daemon start` makes the same check of a socket folder that exists (the reparse point,
   the access list, the owner), so it exits 3 with the folder in its line, and the daemon's own
   check guards only the race between that check and the spawn;
4. reads its process start, then takes the lock ref `daemon` with that start. A failed read of the
   start stops the daemon before the lock with exit 6. When another live process holds `daemon`,
   the daemon names its PID and exits 3. Else it makes the writer of the lifecycle log and writes
   `daemon.started` ([The lifecycle log](#the-lifecycle-log));
5. reads `board.port` of the main `.celetis.yaml` with the full validation of the config, default
   4403. A file with an error prints the diagnostic of the config reader and exits with its code;
6. reads the coordinator record ([The coordinator session](#the-coordinator-session), "The
   takeover"), then opens the board ([Start](board/README.md#start) of the board document gives
   its lines). A nonzero `Number(PORT)` of its environment is an exact port; else the board takes
   the first free port from `board.port` through 65535. A port that cannot open releases `daemon`
   and exits 6, before the takeover of a run;
7. reads the run records and makes one adoption attempt for each record ("The takeover"), then
   starts the loop of the coordinator session;
8. removes a socket file that a killed daemon left;
9. serves on the socket;
10. writes the identity file `daemon/daemon.json` (0600, a temporary file and a rename):
    `{schema: 1, pid, start, revision, main, common, socket}`, where `start` is the process start
    time and `revision` is the Git revision of the engine;
11. prints its PID and its socket.

A successor ("The restart") first waits for the old daemon to end, then starts in this order. Its
board tries the port of `PORT` first and searches from `board.port` when that port is in use. After
step 11, it turns auto mode on when the old daemon carried it.

From the open of the board to the end of the takeover, the board serves the page and its reads,
but the daemon refuses each request of the board (Run, Resume, Retry, a queue action, a queue
reconcile) with 503 and code 3. So no press takes an issue lock before the adoption of its old run.

The socket folder is private to the user, and the daemon uses no token: any process of the same
user can send a request. On Windows, the access list makes the folder private, and SYSTEM and the
administrators can also reach it. The daemon holds the folder open for its life. When a daemon
runs, each client checks the owner and the access list of the folder before it connects, and
`daemon start` checks them before it spawns the daemon. It exits
3 when another user owns the folder, the folder denies the current user access, or another user
can reach it, and 6 when the list cannot be read. A short
race stays: when no daemon holds the folder, another user can plant a folder between that check
and the connect. The root `%TEMP%\celetis` keeps its inherited access list, so other users of the
host can still read or change the dispatch and lesson records there
([ADR-0107](https://github.com/ddinkov10/celetis/blob/main/docs/adr/0107-native-windows-is-a-support-target-again.md)).
Auto mode is off at each start, also after a crash. Only a successor
turns it on again, with the selection of the old loop ("The restart").

**The requests.** The board gives its requests to the same dispatcher in the daemon process, with
no socket and no HTTP request to itself: the same parser and the same answers. The board also
calls the acts of the coordinator session as methods of the dispatcher, with no path of the table
below ([The coordinator session](#the-coordinator-session), "The board acts"). An error that the
dispatcher throws is the 500 answer below. A body is JSON of at most 16 KiB, with exactly these keys:

| Request | Body | Effect |
| --- | --- | --- |
| `GET /status` | none | The status object |
| `POST /run` | `{number, selection, effort, model}` | A start with one number; `effort` is a level or `null`, and `model` is a model or `null` |
| `POST /auto` | `{on, selection}` | Auto mode on or off |
| `POST /queue` | `{id, token, selection}` | The claim and the run of a queue wake that a `queue action` issued |
| `POST /resume` | `{number, selection}` | `run resume <number>` |
| `POST /assist` | `{number, selection}` | `run assist <number>` |
| `POST /retry` | `{number, waitId}` | The wake of the live quota wait, as `run retry <number> <waitId>` |
| `POST /aside` | `{number}` | The Set aside of an issue: the daemon takes the issue lock, then adds the number to the `set-aside` file. It refuses with 409 and `daemon: #<n> runs now; use Stop` when another owner holds the lock or an entry of the daemon has the issue in a state other than `finished`; it releases the lock at the end of the request |
| `POST /halt` | `{number, terminal}` | The Stop of a run ([A stop of a run](#a-stop-of-a-run)); `terminal` is a safe terminal ID |
| `POST /stop` | `{}` | The stop of the daemon |
| `POST /queue/action` | `{action, selection}` | A queue action, as `queue action '<QueueAction JSON>'`; `action` is that JSON |
| `POST /queue/reconcile` | `{}` | The queue reconcile of a board read |
| `POST /land` | `{number, subject, selection, from}` | A landing, as `celetis --agent <host> land <number> '<subject>'` from the folder `from`; the answer is a stream (below) |
| `POST /coordinator/open` | `{selection}` | The open of the coordinator session, as `celetis coordinator`; the answer is `{accepted: true, opened}` ([The coordinator session](#the-coordinator-session)) |
| `POST /coordinator/read` | `{number}` | The screen read, as `celetis coordinator read <number>`; the answer is `{accepted: true, text, complete, why}` ([The coordinator session](#the-coordinator-session)) |
| `POST /coordinator/send` | `{number, authority, text, token}` | The send, as `celetis coordinator send <number> <file> --as <authority>`; `authority` is `maintainer` or `coordinator`, `text` is a string, and `token` is a UUID; the answer is `{accepted: true, run: null}` ([The coordinator session](#the-coordinator-session)) |
| `POST /coordinator/end-assist` | `{number, token}` | The end, as `celetis coordinator end <number>`; `token` is a UUID; the answer is `{accepted: true, run: null}` ([The coordinator session](#the-coordinator-session)) |

Each `number` is an issue key as a JSON string (`"12"`) that the grammar of the tracker accepts. A
JSON number (`12`) or a string that the grammar refuses (`"012"`) gives the 400 answer with the usage line.

`selection` is `{explicit?, environment?}`: an explicit host (`claude`, `codex`, or `opencode`), the
`CELETIS_AGENT` value of the client, or neither. Each run and each landing selects its host from its own request,
as `celetis --agent <host> run` does from its prefix and its environment. The
`CELETIS_AGENT` of the daemon never selects a host. A queue wake keeps the recorded agent choice of
the queue. A queue action uses the choice rules of `queue action`: an Add
uses the request selection; each other action of a queue with a recorded choice refuses another
named host with code 2, and uses the recorded choice. A reconcile uses the recorded choice.

A `/land` body has the issue key `number`, a `subject` that `land` accepts (a
Conventional Commit subject with no newline and no ` (#<number>)` at its end), and an absolute
`from`, the top-level folder of the checkout of the client. The landing uses
`from` only for the refusal of a run from inside the lane worktree. The daemon answers an accepted
`/land` at once with 200 and a stream of NDJSON lines (`application/x-ndjson`): `{"out": <text>}`
for a write of the landing to stdout and `{"err": <text>}` for a write to stderr, in the order of
the writes, an empty line each 5 seconds, and one last line `{"code": <status>}`. A landing behind another
writes one `out` record first ([A landing](../plugins/celetis/docs/workflow.md#a-landing)). Each character of
`<text>` is one byte of the write (U+0000 to U+00FF), so the client writes the bytes of the landing
unchanged. A refused `/land` gets the refusal answers below, with no stream.

An answer is `{accepted: true, run}` or `{accepted: false, line, code}`. `run` is the run ID, or
`null` for `/auto`, `/retry`, `/aside`, `/halt`, and `/stop`. A queue action and a reconcile answer
`{accepted: true, run, view}`, where `view` is the queue view of `queue status` after the change, and
`run` is the run ID of the queue wake of the change, or `null` when the change has no wake. A queue
wake of either request starts as `POST /queue` does. When the daemon refuses that wake with 409, it
writes `error` to the queue record, with the refusal line as the reason and an act
that tells the person to fix the launch failure and then use Try again, but only while the record has that launch token and
no live run or foreground owns the queue or its current issue; so it never writes over a live queue
run. A 503 writes nothing: the record
keeps its pending launch, and a deliberate Try again starts it. A refusal has the line and the exit
code of its cause:

| Status | When |
| --- | --- |
| 200 | An accepted request, the status object, and the stream of a landing |
| 400 | A body that is not valid: the usage line, code 2 |
| 404, 405 | Another path, or another method for a path; code 2 |
| 409 | A refused admission or an end before the first session, with its line and code: for example a busy issue lock with code 3, a failed GitHub read of the issue with code 6, and a finished issue with code 0. A refused queue action or reconcile, with the line and code of `queue action`: for example a stale `expected` with code 3 |
| 413 | A body of more than 16 KiB; code 2 |
| 503 | A request that arrives during a stop (except `POST /stop` during a restart, "The restart"), and the answer of a run, queue, resume, assist, or auto on request, or of a queue action or reconcile with a wake, that comes after a stop began, code 3. A status read that began before the stop answers 200. A run, resume, retry, aside, halt, queue action, or reconcile request of the board before the end of the takeover, code 3 |
| 500 | An unexpected error of the daemon while it answers: its message, code 1 |

A run, queue, resume, or assist request answers after every check before the first session of its run:
the issue lock, the host selection, the setup checks of `gh` (not for a resume), `hc`, and the
Herdr app, a stale launch token, the first decision read for a run and a queue, the saved
session for a resume, and, for an assist request, the read of the hold, the contract version of
the plugin, and the skill `assist`. The answer comes directly before the session tab opens, or at a quota
wait. An end at the first decision is a refusal with the line and the code of that end, for
example code 0 for a finished issue. An assist request refuses a closed issue and an
issue with no hold with code 3 ("The form `run assist <n>`"). The code of the answer is not the code of the
run outcome: a busy issue lock (code 3) and a failed GitHub read of the issue (code 6) end the run
with the outcome code 0, as each other end before a session, so auto mode takes the next issue and
the daemon writes no `run-exit` event. A resume run and an assist run are the exception: a refusal
before the session ends the run with the code of that refusal, so the daemon writes a `run-exit`
event for code 3 or 6. When a stop begins before the answer,
the answer is 503. The stop detaches that run: it starts no session and keeps no lock and no run
record. A queue wake that the run claimed before the stop leaves the queue record `running` with
no owner, and a deliberate Try again of the queue starts it. Auto on starts the loop of
auto mode, which takes one issue at a time and holds the lock `auto`. When auto mode of another
daemon or its session holds that lock, auto on gets 409 with a line that names its PID. A second auto on while the
loop is on changes nothing. Auto off stops new picks: the issue run that the loop took continues to
its end, and the loop then releases `auto`. Until then, the status says `stopping`. An auto on
while the loop is `stopping` turns the same loop on again: the status says `on`, and the loop takes
the next issue after its current issue run, with the same lock `auto`. When the loop has already
started to end, auto on waits until it released `auto`, then starts a new loop. When a later auto
on or auto off comes during that wait, the waiting auto on answers 200 and starts no loop, so the
last auto request decides. An issue run that ends with a nonzero code ends the loop, and the
status then says `off`.

**The locks of a run.** Each run has its own lock owner. A run that ends while its session lives,
for example after a quota recovery that cannot prove that the session stopped, leaves each lock that it holds to that
session alone: the owner record then names no daemon and that session. So a later request, a second
daemon, the board, and auto mode find the lock free when the session ends, as after the
exit of a daemon. A detached run keeps its owner records ("The stop").

**The run machine.** A run is a state machine that a table defines
([ADR-0103](https://github.com/ddinkov10/celetis/blob/main/docs/adr/0103-a-run-of-the-daemon-is-an-explicit-state-machine.md)).
Three files hold it:

| File | Holds |
| --- | --- |
| `engine/lib/run/machine.ts` | The types `State`, `Event`, `Effect`, `Own`, `Accepts`, `Targets`, and `Table`, the table `on`, and its pure helpers. It does no I/O and does not name the I/O context. |
| `engine/lib/run/activities.ts` | The I/O context `Io`, the ledger of the resources that the cleanup releases, the activities, and `perform` for the effects. |
| `engine/lib/run/engine.ts` | The driver in `begin()`, `createRun`, `autoLoop`, `requireSetup`, and the exported types. |

Each state has one activity. The activity does I/O, waits, and returns one event. A table entry for
a state and an event is a pure function: it returns the next state and an ordered list of effects,
and it does no I/O. The driver is the only code that sets the state of a run. It sets only a state
that an entry returned, and it performs the effects of the entry before the next activity runs. A
throw of an activity, of an entry, or of an effect is the event `failed` of the state that was
current. A taken-over run starts in `adopting` and uses the same table as a new run.

The status label (`state` in "The status object" and in the run record) is an output of the
run, not the machine state. The machine has 17 states. Each state except `finished` waits for this:

| State | The run waits for |
| --- | --- |
| `starting` | The setup check of a request run, and for a queue run the lock `queue` and the claim of the queue record |
| `admitting` | The lock of the issue and the first record of the issue |
| `binding` | The recovery record of the issue: a new issue run clears it, a taken-over issue run clears it or adopts it |
| `resolving` | The next step of the issue from the resolver |
| `selecting` | The agent order and the usage records |
| `quota-wait` | A reset, a renewed agent that can run the step, or Retry |
| `preparing` | The preflight of the host and the session arguments; a resume run selects its saved session here, and an assist run reads the hold of its issue here |
| `opening` | The session tab and its start barrier |
| `live` | The release of the barrier of a new session, then the end of the session, with the step-end watch and the usage watch for a step session; after a Stop, the proof of the end ([A stop of a run](#a-stop-of-a-run)) |
| `closing` | The end of an issue: the watch stops, the step-end record goes, the unreleased tab closes, and the lock of the issue is released, except after an unproved Stop |
| `advancing` | The removal of a closed issue from the queue |
| `reporting` | A queue run after a failure: the tabs close and the error state goes into the queue record |
| `adopting` | A takeover: the locks of the run record |
| `observing` | A takeover: the queue record and the phase of the recorded session |
| `ended` | A takeover: the session that ended while no daemon ran |
| `ending` | The cleanup of the run |
| `finished` | Nothing. It holds the end of the run and has no activity. |

The step-end watch stays a loop inside the activity of `live`. `autoLoop` starts runs and is not a
run. The type check refuses a state with no activity, a state with no row in the table, a state
with no `failed` entry, an event with no entry, an entry for an event that its state does not accept, an activity that returns an
event that its state does not accept, and an entry that returns a state outside `Targets` of its
state ([ADR-0103](https://github.com/ddinkov10/celetis/blob/main/docs/adr/0103-a-run-of-the-daemon-is-an-explicit-state-machine.md),
"What the type check covers").

**The status object.** `{schema: 1, daemon, board, auto, runs, landings, coordinator}`. `daemon` is the identity file.
`board` is the URL of the board, `http://127.0.0.1:<port>`. `auto` is `on`, `off`, or
`stopping`. `coordinator` is `true` while the daemon holds a coordinator record
([The coordinator session](#the-coordinator-session)). Each run has one row, in start order:

| Field | Value |
| --- | --- |
| `id` | The run ID |
| `kind` | `number`, `auto`, `queue`, or `resume` |
| `issue`, `numbers` | The current issue key; the issue keys of a queue run, else `null`. Each key is a JSON string (`"12"`) |
| `step`, `host`, `tab` | The step, the host, and the tab name of the current session, else `null` |
| `terminal` | The terminal ID of the current session, else `null` |
| `state` | `starting`, `running`, `checking`, `waiting`, `exiting`, `quota-wait`, `stopping`, `ending`, `taken-over`, or `finished` |
| `line` | The last daemon line of the run, else `null` |
| `changedMs` | The time of the last change of `state`, in milliseconds since 1970 UTC |
| `session` | `runs`, `gone`, or `unknown`: a process read of the start barrier of the current session at this status read, else `null` |
| `attention` | `{state, kind, changedMs}` while the run needs a decision, else `null`: `state` is `dialog`, `turn-ended`, or `quota-wait`; `kind` is `permission`, `question`, or `auth` for a `dialog` that the host named, else `null`; `changedMs` is the time that the pair entered its state ([The coordinator session](#the-coordinator-session)) |
| `outcome` | `{kind, reason, code}` of a finished run (`closed`, `gate`, or `stopped`), else `null` |

A finished run stays in the status, with its outcome, until the daemon stops. A refused run
request is a finished run too. A text field has at most 4096 characters.

`landings` has one row `{issue, state, changedMs}`, with the issue key as a JSON string, for each landing in the line, in the order of
the requests: `state` is `runs` for the landing at the head and `waits` for each other one, and
`changedMs` is the time that the landing entered its state, in milliseconds since 1970 UTC. A
landing leaves the list when it ends. `celetis daemon status` prints one line for each row, with
the issue, the state, and the time, after the run lines.

**The output.** Each line that the daemon writes to its stdout or stderr starts with
`<ISO time> <tag> `. The tag is the first 8 characters of the run ID for a line of a run,
`land-<n>` for a line of the landing of #<n>, else
`daemon`, also for the lines of the board. A line of a run is a daemon line, apart from the lines that keep their own prefix. Apart from the lifecycle log ([The lifecycle log](#the-lifecycle-log)) and the event `run-exit` below, the daemon writes
no log file; the process that starts the daemon decides where its stdout and stderr go. A run that ends
with a nonzero code adds the event `run-exit` to the event record, with its last line as
`message`. Each write of a landing, also of its suite, also goes to the stream of its request, as
the landing wrote it, with no time and no tag; when the client is gone, it goes only to the log. A
landing that ends with a nonzero status adds the event `land-exit`, or `land-defect` for an
unexpected error. The event record keeps its other entries ([The event record](#the-event-record)).

**The stop.** A stop request, SIGINT, SIGTERM, or SIGHUP stops the daemon. The daemon answers the
stop request first and gives each later request 503, except a stop request during a restart ("The
restart"). It detaches each run and the loop, keeps the
run record of each detached run, aborts each landing as a lost client does ([A landing](../plugins/celetis/docs/workflow.md#a-landing); a suite that still runs 10 seconds after its SIGTERM gets SIGKILL), and waits until
each run ends and each landing released its lock, wrote its last
record, and lost its client (at most 5 seconds after that record). Then it waits at most 5 seconds
for the requests of the board in flight, as the socket waits for its requests: such a request gets
the answer of the daemon, for example the stop line for a wake that the stop refuses, and the
daemon then waits for each run that it started. Then it closes the board: it stops
the reads, closes the update check and its worker, closes the connections, and closes the
listener. Then it closes the socket (the socket file goes), removes the identity file, writes
`daemon.ended` to the lifecycle log ([The lifecycle log](#the-lifecycle-log)), and releases `daemon`.
A board request that runs longer than its 5 seconds loses its connection at the
close of the board, and the exit of the daemon ends its work. It exits 0 after a stop request and 128
plus the number of a signal. A restart stops in the same way, then starts its successor ("The
restart").

A detached run stops its step-end watch and its usage watch and removes its step-end record. It
closes a tab whose start barrier it did not release, and the tab of a normal end that waits for the
next session tab ([The session tab](#the-session-tab)). It does not end a released session, close its tab, or remove
its start folder. A lock with a live session keeps its owner record, which names the daemon and that
session: the session holds the lock after the daemon exits, and the next daemon adopts it. It does
not write the queue record and does not change the recovery record. So a stopped queue keeps its
state ([A stop of a run](#a-stop-of-a-run)). A stop while the run proves
that a refused session and its delegated work stopped (the quota recovery) writes no end of that
session: the next daemon proves the end again from the run record and the start folder, and the
recovery continues there. A run that the stop detaches in or after its preflight, before its session
tab is open or while it opens, starts no step: it closes that tab, writes no session record, and
begins no usage attempt. The run begins the usage attempt and writes the session record only
after the tab is open. The run record then keeps the run before that step, except for a run that
has not answered its request yet: that request gets 503, and the record goes ("The requests").

**The takeover.** The daemon writes one run record for each run to `daemon/runs/<run ID>.json`
(0600, a temporary file and a rename). A record holds the facts
that a new daemon needs: the daemon PID and start, the request input, the issue and its lock, the
queue ID and the request of a queue authorization, the loop facts (the last Run and its host, the
status of the last session, the gate rule of the next step, the hosts of a quota recovery, and the
finished tab that waits for its close), a quota wait, the current session, and the key `stop`
(`{terminal, at}`) while a Stop is pending ([A stop of a run](#a-stop-of-a-run)). The session facts
are its step, host, Run, session record, usage attempt, start folder, terminal, and tab, the start
barrier (PID, start, the PID of its parent shell, and its terminal name), and the start time of the
step. The daemon writes the record at the admission, before and after it opens a session tab,
after the start barrier reports and before its release, after each session end, at a quota wait
and its wake, at the claim of a queue wake, and after each drain of a queue issue. A run that ends
removes its record. A detached run
keeps it, except a run whose answer was 503. The `go` file of the start folder, not the record,
tells whether the barrier was released. The record has `schema: 5`, with its paths under
`<git common dir>/celetis/`. Its `issue` and the `number` of its input are issue keys, each a JSON
string (`"12"`), and its `session.record` is a saved session of schema 3. A schema-2 or schema-3
record converts to schema 5 when the daemon reads it at its start, after it holds `daemon` and
before it serves, only when each `plan` of the record is `null`: a record with a numeric `plan` is refused with
`the record is not a valid run record`. A schema-4 record is refused with `the record has another schema`: its plan comment ID is a number
([ADR-0126](https://github.com/ddinkov10/celetis/blob/main/docs/adr/0126-a-local-tracker-in-the-git-bug-format.md)). A schema-2 record first gets `model: null` in a `number` input, as it did to
schema 3. The conversion writes each issue number as its key, converts the embedded session record
by the rule of the saved session, and keeps each other field. A number that the grammar of the
tracker refuses refuses the record intact. A `number`, `auto`, or `queue` input with `quiet` is not
valid, so its record does not convert. The
conversion keeps the exact original bytes in an immutable sibling archive
([ADR-0070](https://github.com/ddinkov10/celetis/blob/main/docs/adr/0070-automatic-runtime-state-migration.md)). The run
records have no record lock.

At its start, after it holds `daemon`, the daemon reads the records in the order of their file
names. It does not take over a record that it cannot read, that is not valid JSON, that has another
schema, or that does not validate: it prints the path and the cause, the file does not change, and
its session stays in its tab. For each
other record, the daemon adopts the issue lock with a new lock owner and the session identity of the
recorded barrier, else of the `pid` file of the start folder, else none. A queue run adopts the
`queue` lock first, then the lock of its current issue. The adoption takes a free lock, and
a lock whose owner record names no daemon or a gone daemon (a definite read), with no live session
or with a live session equal to that identity; the owner record then names the new daemon and keeps
that session.

- Another live owner holds the lock: the run ends with a line that names the PID of that owner.
  Its record goes. The queue record, the recovery record, and the tabs stay as they are.
- A process read is unknown: the record and the lock stay, the state of the row is `taken-over`,
  and the daemon reads again each 2 seconds.
- The daemon takes the lock: it writes the record again with its own identity and continues the
  run by its phase.

The daemon serves requests only after one adoption attempt for each record. So a request for an
issue whose record still reads unknown gets the lock refusal.

| Phase | The daemon |
| --- | --- |
| A session whose start folder has no `go` file | Closes its tab, when the record knows it, and ends the run: no step was started |
| A live session: the barrier runs with its start, and its command holds `daemon.ts` | Writes the step-end record `checking` under its own identity and runs the step-end watch and the usage watch. After the session end, the run continues with the gates of a continuing run, with no effort override |
| An ended session: the barrier is gone | Verifies the saved session identity once, records one usage observation of the attempt, and applies the normal end with the status of the `status` file; 143 with the file `terminated` of the step end is the status 0. No valid status is an unknown status. Then the next steps follow |
| A barrier read that is unknown | Keeps the record, the lock, and the start folder, and reads again each 2 seconds |
| Between two steps | Reads the resolver again and continues with the gates of a continuing run |
| Before the first step | Starts the accepted request with its gate rule, its effort, and its queue request |

A resume run and an assist run have the same phases with no step-end watch. The finished tab of a record closes by the
normal rule: when the next session tab opens, or at the end of the run. A run of the loop
continues as a run after a takeover, and it keeps the lane test of auto mode
([The start of a step](#the-start-of-a-step), "The lanes of auto mode"). Auto mode stays off, except
for a successor that carries it:
after its identity file, a new loop starts, and it takes its first issue only after each taken-over
run of auto mode ends; when one of them ends with a nonzero code, the loop ends ("The restart"). A
usage block in the one observation of an ended session starts the quota recovery for the default
choice ([Usage-limit recovery](#usage-limit-recovery),
[A session that ended while no daemon ran](#a-session-that-ended-while-no-daemon-ran)); for an explicit host,
the normal end applies.

**A queue run.** After the adoption, the daemon reads the queue record again. A record with another
ID, or whose first number is not the recorded issue, ends the run, and the queue record does not
change. The outcome is `stopped` with code 0, and its reason is the line of that end.
Else the run continues its issue by the phase, with the queue transitions of
a queue wake, then the drain to the next issues. When the queue record still holds the launch
token of the claim, the daemon removes it and writes `running`. After each drain, the run record
names the next issue with no session, so a stop between two issues continues the drain at the next
start. A session whose start folder has no `go` file ends the issue as the table says, and the
queue state becomes `error` with that line.

**A quota recovery.** The recovery record has `schema: 4` with the key `daemon`. A valid schema-2
record with `plan: null` converts to schema 4 when it is read ([Usage-limit recovery](#usage-limit-recovery)). A
record of another schema, or with an invalid field, is refused with its path and `invalid or obsolete recovery record;
inspect it, then remove it`, and it is never read as empty. When the recovery record of the
issue names a daemon that is gone (a definite read), the daemon writes itself as the owner of the record in one
transaction. Retry and the bound lane of the
recovery then accept the daemon. A `POST /retry` for a record that names this daemon needs a run of
this daemon for that issue whose state is not `ending` or `finished`; else it gets code 3, and
the line asks for a new start of the run. So a second
Retry of a wait that woke gets the answer of the first. An unknown read keeps the record and reads
again each 2 seconds. A quota wait continues with its recorded wait ID, step authority, agent
choice, and the usage records that it saw. The daemon prints the wait line again and makes no new
wait ID, so `run retry <n> <wait id>` of that wait wakes it. A wait whose ID the recovery record no
longer has ends its run. The usage records that a wait saw have one key for each host. A run record
of an older engine has no `opencode` key there, so after the update the daemon refuses it:
`daemon: cannot take over <path>: the record keeps the quota wait of an older engine; start the run again; its session stays in its tab`.

**Per-run failures.** A refusal line, a startup error, a failed queue save, a failed write of the
run record, and an unexpected error end only their run. Its outcome is `stopped` with the line and the code. When the run
leaves a released session that still runs in its tab, its start folder stays too, because OpenCode
reads `step.md` there at each turn; the run removes each other start folder. An unexpected error
also prints its stack and adds a defect event `run-defect`. One failure stops the whole daemon with
exit 6: a step-end record that can neither be removed nor emptied. The daemon stops, because only
the end of the daemon that the record names revokes it. The sessions stay open in their tabs.

**A removed engine version.** The daemon reads the entry of its version folder, `engine/celetis`,
each 5 seconds, and its runs make the same read. For a daemon of a checkout, that folder is the
checkout. When the entry is absent or is not a regular file, as after an update that removed the
folder, the daemon stops as above and exits 3 ([Updates](../plugins/celetis/README.md#updates)).
A read that fails with another error, for example a permission error, stops nothing, and the next
read decides. The sessions stay in their tabs, and their run records stay for the next start.

**The restart.** An approved update of the board, or **Restart** of the board after a terminal
update ([Open work during updates](board/README.md#start)), restarts a daemon that runs from the version folder of its revision, `<base>/.local/share/celetis/versions/<revision>`
(the real paths, read once at the start; a failed read counts as a checkout). A daemon of a checkout
never restarts: its update completes, and the update view says `updated`. The old daemon stops, and
a new process of the installed engine takes over
([ADR-0077](https://github.com/ddinkov10/celetis/blob/main/docs/adr/0077-the-master-daemon-hosts-the-board-and-restarts-as-a-successor.md)):

1. The claim. After the answer of the approval or of the restart request is sent, the daemon
   validates the installed engine: the link names the target, and the source, revision, and clean
   state of its folder are the target. A restart request validates it once before its answer too. A failed validation keeps the daemon running, and the update view is
   `update-failed` with the validation line. Else it prints the revision of the installed engine
   and stops. A claim after a stop began (`daemon stop`, a signal, a removed engine version)
   changes nothing and starts no successor, so one restart runs at a time.
2. The stop, as "The stop" says. A stop that reaches the daemon after the claim and before its exit
   cancels the successor: a `POST /stop` (it gets the accepted answer, not 503, so
   `celetis daemon stop` ends normally), SIGINT, SIGTERM, SIGHUP, or a fatal stop such as a
   removed engine version. The daemon starts no successor and exits
   with the code of that stop: 0 for a stop request, 128 plus the number of a signal, 3 for a
   removed engine version, 6 for the step-end failure ("Per-run failures"). No daemon runs after it. The page shows the timeout with the recovery line.
3. The spawn. After the release of `daemon`, the daemon starts one detached successor, the
   internal form `daemon --daemon --after <pid> <start>` through the engine entry `engine/celetis` of
   the installed engine, with `--auto <JSON>` when auto mode is `on`. The entry replaces its
   process with `engine/daemon.ts --daemon --after <pid> <start>`, so the successor keeps its
   PID. It runs in the main checkout, with the environment of the
   daemon, `HC_SCOPE` removed, and `PORT` set to the actual board port, and its stdout and stderr
   append to `daemon/daemon.log`. Then the old daemon exits 0. A failed spawn exits 6, and its line
   asks for `celetis daemon start`; the runs stay detached for the next start.
4. The wait. The successor reads `{pid, start}` of the old daemon each 250 ms until a definite
   `gone`; a read that is `unknown` waits too. After 60 seconds it stops with exit 3 and no lock. Else it starts as "The start" says and takes over the runs.
5. The port. The board of the successor tries the port of `PORT` first, so the page reconnects at
   its URL. When that port is in use, it searches from `board.port` and prints the new URL to the
   log; `celetis daemon status` prints it. Only the board gets that `PORT`: each daemon removes
   it from its own environment before it takes over the runs, so no run or landing suite gets the
   board port.
6. Auto mode. When auto mode is `on` at the claim, `--auto` carries
   `{"selection":<selection>}` of the loop, and the successor makes that
   `POST /auto` with `on: true` after its identity file. A refusal, for example a lock `auto` of
   another daemon, goes to the log once, and auto mode stays off. Auto mode that is `off` or `stopping` at the claim stays off. The new loop holds
   `auto` and the status says `on` at once, but the loop takes its first issue only after each run
   of auto mode that the successor took over ends, so auto mode takes one issue at a time across a
   restart. When one of those runs ends with a nonzero code, the loop ends after they all end, as
   after an issue run of its own: it takes no issue, releases `auto`, and the status then says
   `off`. An auto off in that wait gives `stopping` until those runs end, and a stop in that wait
   starts nothing. Only the carried auto mode waits: an auto on after a normal start starts its
   loop as "The requests" says.

The old engine writes the successor argument list, and the installed engine reads it, so the list
is a contract between two engine versions. The successor refuses a list of another shape
(`--after` with no PID and start, another option, an extra item) with exit 2, before its wait, because it cannot wait safely. A `--auto`
value that the new engine refuses (no JSON, no object, or no valid `POST /auto` body of this
engine) does not stop the successor: it waits, starts, and serves with auto mode off, and after its
identity file it prints the refused value.

Between the stop and the takeover, no daemon steers the sessions: a session that ends its step in
that gap waits until the successor takes over its run. A known limit: after the old daemon spawned
the successor and exited, or after it closed its socket, a stop does not reach it. In the gap until
the successor writes its identity file, `celetis daemon stop` finds no daemon, and the successor
still starts; stop it after its start.

## The engine and the plugin

The daemon uses the version folder of the engine that started it
for the resolver and entry of each run. Numbered starts, auto-mode starts, and later steps make no update call.
The form `run resume` keeps its no-update behavior and saved identity.
Before a step starts, the daemon checks that the entry of its version folder, `engine/celetis`, is still a file.
[Updates](../plugins/celetis/README.md#updates) gives the contract check of the plugin before each
new step session (`requireContract` of `engine/lib/contract/check.ts`): the engine must serve the
contract version that the plugin of the session's host needs. When it does not, the daemon also
writes no session record. So the skills, the step text, and the engine of a step session share one
contract version.
Known concrete policy conflicts are diagnosed. Running consumers do not reserve the update mutex. Run and exact Resume bind their Codex session to the active
installed root through a command-only Local marketplace. Native catalog, manifest, and cache
version checks prove the refresh no-op for Git and local installations. A Git SHA ref alone can
force same-revision replacement and is reserved for approved application. External package
edits remain outside the update protocol. Metadata RPC disables plugins before app-server construction, so
read-only thread and configuration checks do not trigger startup refresh.

[Updates](../plugins/celetis/README.md#updates) owns the read-only check, terminal-confirmed one-command update,
its updater mutex and deadline, and native cache replacement. A restart of the daemon alone updates nothing. After
`celetis update`, the runs of the restarted daemon use the new engine.

## The MCP server

`celetis --agent <host> mcp` serves the agent forms of the contract as MCP tools over stdio
(`engine/mcp.ts` and `engine/lib/mcp/`). It needs an explicit `--agent <host>`, and it ends when its
stdin closes. A tool call runs one form of the CLI in a child process. So a tool and the shell
command of its form share the locks, the exit classes, the outputs, and the daemon requests. The
tools come from `engine/lib/contract/contract.ts`: a new agent form gets its tool with no second
table. [ADR-0125](../docs/adr/0125-each-agent-form-is-an-mcp-tool-that-runs-the-cli.md) records the
decision.

**The start.**

- The key `mcpServers` of `plugins/celetis/.claude-plugin/plugin.json` holds the server `celetis`:
  the command `celetis`, the arguments `--agent claude mcp`, and the `timeout` 100000000
  milliseconds (about 27.8 hours). The server is in the Claude manifest only. The Codex plugin
  shares the folder `plugins/celetis/`, and it must not start a server that names the host `claude`.
- Claude Code names each tool `mcp__plugin_celetis_celetis__<tool>`: the plugin `celetis`, the server
  `celetis`, and the tool name.
- The documents of Claude Code 2.1.330 say that a `timeout` of 1000 or more limits the wall-clock
  time of one call and is also a floor of the idle window, which is 30 minutes for a stdio server.
  They also say that a call of the main conversation that runs for more than two minutes moves to a
  background task
  ([Time limits on MCP tool calls](https://code.claude.com/docs/en/mcp.md)). No check of a real
  session shows these effects yet.
- The probe of the spec started a plugin server by a bare command name that `PATH` finds as a `.cmd`
  shim on Windows (Claude Code 2.1.330, one run of `claude -p`). The server got the environment of the
  session, and its working folder was the start folder of the session
  ([issue #357](https://github.com/ddinkov10/celetis/issues/357), "Design probes"). The start on
  macOS and Linux is unchecked: there the shim is a POSIX `sh` script. The maintainer checks it by
  hand after the landing.

**The tool set.** `toolSet` of `engine/lib/mcp/tools.ts` builds it from `commands`.

- A form is covered when its entry has `agent: true`, the entry is not `internal`, and the form does
  not hand the terminal to a host session (its `passThrough` is not the exit code of the host
  session). The forms that are not covered:
  - `intake`, `assist <n>`, and `visual <n> <sha>`. Each starts a host session in the terminal of the
    caller, and an MCP call has no terminal.
  - Each form of `dispatch` (`sessionBound` in the contract). An MCP server keeps the session ID of
    its start, and `dispatch` binds its records to the current session, which changes on `/clear`.
    The agent text keeps the shell command.
  - `update`, `install`, `agents`, `root`, and `mcp` (`agent: false` in the contract). They get no
    tool. The agent text that runs `agents read` or `update check` keeps the shell command.
    `update` is also under the hard limit "No agent approval of an update" of `CONSTITUTION.md`.
  - The internal forms of `daemon`: `--daemon`, `--session-start`, and `--prepare-state`.
- The name of a tool is the literal words of its form (a word that is no placeholder, enum word,
  or `--x` word), joined by `_`, for example `issue_route` for
  `issue <n> route feature|bug|chore|hotfix`, `daemon_status`, `run_resume`, and
  `lesson-store_read`. Forms with one name make
  one tool, for example the `run <n>` forms, `next-step <n>` with `next-step --open`, `worktree <n>`
  with `worktree --remove <n>`, and the `setup try` forms.
- Each placeholder word is a string parameter. An issue key is a string. A word `a|b|c` is an enum
  parameter. A flag with a value is a string parameter, or an enum parameter when its value is
  `a|b|c`, as in `--state open|closed`. A flag with no value is a boolean, and a flag
  that repeats (`--attach`, `--ignore`) is an array. A word `--x` inside a form, as in
  `worktree --remove <n>`, is a required boolean. A parameter of a tool is required when each of its
  forms requires it. The field `names` of a form gives the name of a parameter that is not a word of
  the form, for example `judgment`, `verification`, `consequence`, `novelty`, `scope`, and `security`
  for the digits `J V B N S X`.
- Each tool has the required parameter `checkout`: the absolute path of a folder that exists. The
  form runs there. The server cannot guess the folder: its working folder is the start folder of the
  session, and a lane session works in its lane worktree. The server accepts each such folder of the
  machine, also a folder outside the project of the session. A permission rule that allows a tool
  cannot limit a parameter of an MCP tool (the documents of Claude Code 2.1.330,
  [Match by input parameter](https://code.claude.com/docs/en/permissions.md)). So a rule that allows
  a tool, for example `issue_comment` or `land`, allows its act in each folder that a call names.
- The description of a tool opens with what its forms do, then gives the descriptions of its entries.
  The text of a form is its `purpose`, or else its `help` summary; the gate refuses a covered form
  with neither. A tool of one form opens with that text. A tool of more forms gives, for each form,
  its text, the words of the form, and its required parameters, as in `run <n> --effort <level>`
  (`n, effort`). The `purpose` of an issue act is a field of `issueActs`. These texts are outside
  the digest of the contract.
- The annotation `readOnlyHint` is `true` only when each form of the tool declares `read: true` in the
  contract. A form is a read when it changes none of these: the project checkout, Git, the tracker,
  the daemon or its state, a session, the queue, a lesson store, a dispatch record, or an
  installation. The event-record entry that the launcher writes for a nonzero exit and a transient
  lock file do not count. `setup check` is not a read, because it runs `git fetch`. The gate requires
  a value on each covered form. It does not check that the value is true.

**A call.**

1. The SDK checks the input against the schema of the tool: a strict object with the parameters and
   `checkout`. An input that fails, or an unknown tool, gets the error of the SDK, and the handler of
   the server does not run.
2. The server checks `checkout`. A path that is not absolute, or not a folder, gives code 2 and
   starts no process. On Windows, a path whose root has no drive letter and is no UNC root, for
   example `\Windows` or `/Windows`, is not absolute.
3. `argumentsOf` selects the form and builds the argument list. A refusal gives code 2 with the usage
   line of the command, and starts no process.
4. The server reads `versionFolderGone` of `engine/lib/install/version-folder.ts`. An update can
   remove the version folder of a running engine. When the folder is gone, the result has code 3 and a
   line that tells the session to start a fresh session.
5. `runForm` of `engine/lib/mcp/call.ts` starts `process.execPath` with `bunArgs` and the program
   entry `<root>/engine/celetis` of the engine of the server, as `daemonArgv` does
   ([ADR-0083](../docs/adr/0083-a-library-starts-a-celetis-process-through-the-program-entry.md)). The
   arguments are `--agent <host>` and the built list. The child has `checkout` as its working folder,
   the environment of `childEnv`, no stdin, and no shell. A file parameter is a path as on the command
   line, so a relative path resolves against `checkout`.
6. The server waits for the `exit` of the child, and then for `close` of its pipes for at most one
   second, so a descendant that holds a pipe (the daemon of `daemon start`) cannot hold the call. A
   child that cannot start gives code 6.

The result is `{ code, class, saved?, json | stdout, stderr }`, with the keys in this order. `class` is
the exit class of `classOf`, or `null` for a code that no class declares, for example an exit code of the
worktree setup script that `setup try` passes on. The result holds the output once. `json` is the
parsed stdout when the stdout is one JSON value that `JSON.stringify(value)` or
`JSON.stringify(value, null, 2)` prints again, with or without one final newline. Else `stdout` holds
the text as it is, also for JSON Lines (`events`), a number that a parse changes, and any other layout.
So the result never holds a change of the output, and an empty stdout is `stdout: ""`. For a nonzero
code whose serialized result is longer than 10,000 characters, the server writes that serialized result
to `result.json` in a new folder of `celetis-mcp-` in the temporary folder, and `saved` is the absolute
path of the file. The server returns the object as `structuredContent` with an `outputSchema`, and as
JSON text in one text block. `isError` is `true` when `code` is not 0.

**The selection and the guard.** The input is an MCP argument. `argumentsOf` treats it as an untrusted
value that the CLI parses again.

- A form matches an input when the input holds each required parameter of the form and no parameter
  outside the form. A `false` boolean, an empty array, and an absent value count as not given.
- An input that matches no form gives code 2. When two or more forms match, they must build the same
  argument list, else the input gives code 2. For example, `run` with `n`, `effort`, and `model`
  matches both flag forms of `run <n>`, and both build `run <n> --effort <level> --model <model>`.
- The argument list has the words of the form in their order, with a literal word and a `--x` word as
  written. The flags follow in the order of the flags of the tool. A boolean `true` gives the bare
  flag, and an array gives the flag once for each element.
- The guard refuses with code 2 and starts no process when:
  - a string value, or an element of an array, starts with `-`;
  - the built list matches exactly a form of the command that the input did not select, for example
    `issue_view` with `n` set to `create` builds `issue create view`, which is `issue create <file>`;
  - the built list starts with two or more leading literal words of a form outside the tool, because
    the command files route by those words before they check the arity of the act. For example,
    `issue_comment` with `n` set to `create` builds `issue create comment a.md`. Forms of the same
    tool are exempt from this rule.

**These rules also hold.**

- **The revision.** The server runs the CLI of its own engine revision, not the CLI that `PATH` finds.
  So the schemas of the tools and the forms that they run come from one revision. After an update, a
  session keeps the tools of its start revision until a fresh session starts.
- **No timeout and no kill.** The server sets no timer on a child and sends it no signal. A call waits
  for its child, also for `land` and `worktree`, and a cancel of the client does not end the child.
  So the server never stops a child in the middle of an act.
- **Concurrent calls.** Each call starts its own child, as parallel shell calls do. The locks of the
  CLI order them.
- **The environment.** The child gets the environment of the server, which is the environment of the
  session, for example `CELETIS_COORDINATOR` of the coordinator session.

**The gate.** `checkTools` of `engine/lib/mcp/tools.ts` runs in `scripts/verify.ts`. It reports an
error when:

- the field `names` of a form names a word that is no placeholder or enum word of that form;
- an agent form is no tool, is not in `notCovered`, and has no `sessionBound` entry;
- a covered form has no `read` value;
- a placeholder or enum word has no parameter name, a form gives one parameter name twice, or a
  parameter is named `checkout`;
- a tool name breaks the MCP name rule (1 to 128 characters of `A-Z`, `a-z`, `0-9`, `_`, `-`, and `.`),
  or two tools get one name in Claude Code, where a character outside `A-Z`, `a-z`, `0-9`, `_`, and `-`
  becomes `_`;
- a tool holds a form of `update`, `install`, `agents`, `root`, `mcp`, or `dispatch`;
- one parameter of a tool has two kinds or two value lists;
- one input of a tool matches two forms with different argument lists;
- the sample input of a form, with one value for each of its parameters, is refused by the guard, or
  builds an argument list that does not match the form.

The probes of [ADR-0125](../docs/adr/0125-each-agent-form-is-an-mcp-tool-that-runs-the-cli.md),
"Constraints and evidence", show each rule: one changed or added form of `commands` gives its error,
and `commands` as it stands gives none. The gate does not check the text of a description, and it does
not check that a `read` value is true: a `read: true` on `land` and an empty description of `config`
both gave no error.

**Limits.**

- The macOS start is unchecked ("The start"). The maintainer checks it by hand after the landing.
- Claude Code sends a successful text result of more than 50,000 characters to a file, and it keeps
  the first and the last 5,000 characters of an error text of more than about 11,000 characters (the
  documents of 2.1.330,
  [MCP output limits and warnings](https://code.claude.com/docs/en/mcp.md)). The server sets no size
  limit of its own, and it holds the whole output of a child in memory. For a long error, `saved` is
  in the first 5,000 characters, so the file keeps every line that the cut removes from the text block.
- A session that ends during a call leaves its child running, and the output goes nowhere. A shell call
  that a session leaves has the same limit.

## The session tab

For each session, also an exact resume, the daemon opens a new hc terminal
with a tab in the space of the repository in the Herdr app (`openTab` of
`engine/lib/terminal/terminal.ts`): `hc run --bg --no-parent --no-notify` in the main checkout, with the
labels `herdr.space=<id>` and `celetis.link=#<n> <step>`, and the tab name `#<n> <step>`
(`herdr-app do tab.rename`). The space is the space with the name of the folder of the main
checkout. When that space is missing, the terminal gets a new id in `herdr.space`, the Herdr app
makes the space in the background, and the daemon names it with `herdr-app do space.rename`. The
file lock `<git common dir>/celetis/space.lock` lets one process at a time find or make the space.
For a new space, that process holds the lock until the space has its name or the poll of
`herdr-app ls` stops. The poll stops after 10 seconds when the space does not show in it.
The tab runs the start barrier, the internal form
`daemon --session-start <folder> <daemon PID> <host> <attempt ID or -> <recovery or ->
<arguments>` through the engine entry `engine/celetis` of the engine of the daemon. On macOS and
Linux, the tab runs through a login shell of `$SHELL` (`"$@"; exec "$0" -li`), so it keeps a shell
after the barrier exits, and the entry replaces its process with `daemon.ts --session-start …`
under the same PID. The barrier record and the board read that process after the replace: with
the job control of the login shell, the barrier leads the foreground process group of the tab.
On Windows, the tab runs through the tab wrapper `tabWrapper` of `engine/lib/terminal/terminal.ts`. The
wrapper is `bun -e` with the isolation flags. It sets `BUN_RUNTIME_TRANSPILER_CACHE_PATH=0`,
`DO_NOT_TRACK=1`, and the other variables of the tab, starts the engine entry with no shell, and
holds the tab after the program exits, with the line `<program> exited <code>. Press Enter to
close this tab.`, until Enter. The entry cannot replace its process there, so it starts
`daemon.ts --session-start …` as a child and stays its parent ([The master
daemon](#the-master-daemon) and ADR-0034); the board reads the program argv after the wrapper
words. `<folder>` is a private start folder in `<git common dir>/celetis/`:

1. The barrier writes `pid` there: its PID and its process start. The daemon accepts that record
   only when that process runs, has that start, and runs `daemon.ts`.
2. The daemon registers that PID in the issue lock. For a step, it also publishes the step-end
   record and starts the job of the step end. It then writes `go`: this is the release of the
   barrier.
3. The barrier waits for `go` while the daemon lives. A failed read of the daemon process does not
   end this wait; the barrier exits with status 3 before `go` only when the daemon process does
   not exist. After `go`, the barrier reads `env`: one JSON object whose values are strings. Else
   it writes `error` and the status 1 to `status`, exits with status 1, and starts no host. Then
   the barrier starts the host as its child, waits
   for the host to exit, writes the exit status of the host to `status`, and exits with that
   status. On Windows, before it starts the host, the barrier creates the job object
   `Local\celetis-attempt-<attempt ID>` (`Local\celetis-session-<folder name>` for `-`) with no
   breakaway and joins it, so each process that the host starts is a member of that job. It holds
   the handle of the job to its exit. A job name that exists already, or a failed create or join,
   gives status 6 with the line on stderr, and no host starts.

The exit of the barrier is the one sign that the session ended. A missing or invalid `status`,
for example after a person closed the tab, is an unknown status, and it counts as a failure:
before issue progress, the daemon stops with the recovery line and `status unknown`.

The session gets the login environment of its tab, not the environment of the daemon. The barrier
sets `CELETIS_SESSION_AGENT` to the host and `CELETIS_ATTEMPT` to the attempt ID of a step session, a resume session, or the session of an assist run, removes `CLAUDE_CODE_EFFORT_LEVEL` for Claude, and sets
`CODEX_HOME` to the resolved native home for Codex. For OpenCode it removes `OPENCODE_CONFIG_CONTENT`,
`OPENCODE_CONFIG`, and `OPENCODE_CONFIG_DIR`. It sets the values of `env` last, so they replace a
value of the tab. hc gives the terminal of the tab its own
`HC_TERMINAL_ID`. The daemon reads no `HC_TERMINAL_ID`, so a run that the agent of a session
starts from its shell tool opens tabs of its own and does not touch the terminal of that session.

Each session tab of a run, also of a resume, opens in the background: the focus of the Herdr app
does not move. Go of the board brings it to the front. A tab that a person opens (New intake,
Assist, Make visual, and Open shell of the board, and `celetis coordinator`) comes to the front
(`herdr-app do pane.focus`). The daemon closes a tab (`hc kill`, then `hc rm`) only
after a normal end: the status is 0, or 143 with the file `terminated` of the step end
([The step end](../plugins/celetis/docs/workflow.md#the-step-end)), and, for a step, a saved turn has a verified identity. It
closes that tab after the next session tab of the same start is open, or when the run ends.
Each other end leaves the tab open with the last screen of the host and a shell under it:
another nonzero or unknown status, a session with no verified identity, and a session whose
daemon stopped. A tab whose barrier the daemon did not release closes, and no host starts in it.

These ends of the start of a tab end the run with code 6, or 3 for a space lock that stays held: the
tab cannot open, the tab ends before its start barrier reports, and the barrier record is not
valid. While the terminal of the tab stays live and the barrier has not reported, the daemon
warns once after 60 seconds and waits on. On macOS and Linux, the lines of a tab that ends early and of the warning
ask you to check the login files of `$SHELL` in that tab; on Windows, the tab has no shell, and the lines ask you to
read that tab. No command prints these lines: they
show as the `line` of the row of `celetis daemon status` and in `daemon/daemon.log`.

## The coordinator session

The coordinator session is one interactive session of a host with the skill `coordinate`, in a
tab that the daemon opens. It is no run: it has no issue, no issue lock, no step-end watch, and no
resume by the daemon. You end it in its tab, or with End session on the board ("The board acts").

**The forms.** `celetis coordinator` (`engine/coordinator.ts`) sends `POST /coordinator/open` with
the selection of `--agent` and `CELETIS_AGENT`, as `run` does, and waits at most 120 seconds.
`celetis coordinator status` reads `GET /status` and prints the status object as one JSON line.
`celetis coordinator read <n>` sends `POST /coordinator/read` ("The screen read"), and
`celetis coordinator send <n> <file> --as maintainer|coordinator` sends `POST /coordinator/send`
("The send"), and `celetis coordinator end <n>` sends `POST /coordinator/end-assist` ("The end").
The row of `coordinator` in [The commands](../plugins/celetis/README.md#the-commands)
gives the lines and the exit codes. The board opens the session with the default agent order and
no focus move (the quiet open), and it carries the acts of "The board acts".

**The open.** The daemon answers one open at a time; a second open waits for the first. In this
order, it:

1. reads the process of the barrier of the coordinator record, when it holds one. When it runs,
   the daemon brings its tab to the front (`herdr-app do pane.focus`) and answers
   `{accepted: true, opened: false}`; a failed focus refuses the open with code 6. The quiet open
   makes no focus call and gives the same answer. A failed read
   refuses the open with code 6 too, and the record stays. When the process is gone, the daemon removes the record and its start folder and goes on;
2. selects the host as `assist` does, with the local order and the usage records;
3. checks the native home of the host, the update policy of its plugin, the host on `PATH`, the
   contract version of its plugin ([The engine and the plugin](#the-engine-and-the-plugin)), the
   file `skills/coordinate/SKILL.md` of the plugin root, and `hc` and the Herdr app;
4. writes the session environment of the host (`{}` for Claude Code and Codex) to the file `env`
   of a new start folder, then opens the tab `Coordinator` with the link label `Coordinator` in the
   main checkout, as a session tab ([The session tab](#the-session-tab)): with the focus for
   `celetis coordinator`, and with no focus for the quiet open, like a run session tab. It starts
   the start barrier `daemon --session-start <folder> <daemon PID> <host> - - <arguments>` with the interactive
   arguments of `assist` and the prompt of the skill `coordinate`. For Claude Code, the arguments
   start with `--session-id <uuid>`, a new random UUID. The tab sets
   `BUN_RUNTIME_TRANSPILER_CACHE_PATH=0`, `DO_NOT_TRACK=1`, and `CELETIS_COORDINATOR=<token>`, a
   new random UUID: on macOS and Linux through `env` in the argv of the login shell, on Windows
   through the pairs of the tab wrapper. The login shell keeps no shell after an exit with
   status 0, and on Windows the tab closes after an exit with status 0 and holds after another
   exit, until Enter;
5. waits for the `pid` file of the barrier, and reads the terminal of the tab each second. A tab
   that ends first (hc says that the terminal finished or is gone), a barrier record that is not
   valid, and 60 seconds with no barrier record close the tab, remove the start folder, and refuse
   the open with code 6. A failed read of the terminal is no end: the wait goes on. A daemon stop
   in the wait closes the tab, removes the start folder, and refuses the open with code 3 and the
   stop line;
6. writes the coordinator record, then `go`, and answers `{accepted: true, opened: true}`.

Each refusal is a 409 answer with its line and code, as "The requests" says: the lines of the
config reader, of the contract check, and of the setup checks keep their codes.

**The record.** `daemon/coordinator.json` (0600, a temporary file and a rename):
`{schema: 2, host, terminal, barrier: {pid, start}, folder, token, session, prompt, startedAt}`.
`terminal` is the hc terminal of the tab, `barrier` is the process of the start barrier, `folder`
is its start folder, and `token` is the value of `CELETIS_COORDINATOR`. `prompt` is the last
argument that the host got, and `startedAt` is the time of the open in whole seconds. `session` is
the native session ID, or `null` until the daemon has it. For Claude Code, the open writes the ID
of `--session-id`. For Codex, the open writes `null`. After the notes of each pass, the loop asks
`thread/list` for the one thread of the main checkout that has the exact `prompt` and starts at or
after `startedAt`, as the claim of a Codex step does. When one thread matches, and `thread/read` and
one saved turn of `thread/turns/list` confirm it, the daemon writes the record again with the ID,
prints
`daemon: coordinator: the codex session has the ID <id>`, and asks no more. No match asks again in
the next pass. Two or more matches are no identity: the daemon prints one line and asks no more for
that record. The daemon is the one writer of the record: the open, the late ID, and each removal go
one after the other, and the late ID is written only while the daemon still holds the record that
the claim started from. The daemon holds the record while the process of the barrier runs. It
reads the process each 2 seconds and removes the record and the start folder only after a definite
read that the process is gone. A failed read keeps the record. A record that does not validate is
no record: the daemon prints its path and the cause once, and the next open writes over it. A
record of schema 1 has no session ID and is no valid record: end its session in its tab, and the
next open starts a session with an ID.

**The takeover.** Before it opens the board, a daemon, also a successor, reads the record. So the
first read of the board has the record of a live session, and no read shows that session as no
session. It takes over a record whose barrier runs, and keeps a record whose read fails. It removes
a record whose barrier is gone. A record with `session: null` is valid: the new daemon goes on
asking for the ID in its loop. After the takeover of the run records and before it serves, it
starts the loop that reads the process, the attention states, and the notes; until then, `open` and
`act` of the board answer the takeover line ("The board acts"). `celetis daemon stop` keeps the
record and leaves the session open in its tab; until the next start, each form of `coordinator`
exits 3 with the line of no daemon.

**The value of the session.** The barrier gives its environment to the host, so each command of
the session has `CELETIS_COORDINATOR`. Its name holds no `KEY`, `SECRET`, or `TOKEN`, so the
default environment policy of Codex keeps it. A step session has no such value. Each process of
the same user can copy the value: it is a guard against a confused agent, not a security boundary.

**The attention state.** The daemon derives the field `attention` of each run row with one loop,
each 2 seconds, and keeps the row of a run unchanged when a pass cannot decide. A run view holds
the hc terminal of its released session (`terminal`) and the hc turn of its last step-end state
(`turn`). A state other than `running`, `checking`, `waiting`, `exiting`, and `stopping` clears both; a
taken-over run with a live session holds the terminal. Each pass reads `hc get` of each run with a
terminal, and the first row that matches decides:

| Row | Condition | `attention` |
| --- | --- | --- |
| 1 | The state of the run is `quota-wait` | `quota-wait`, kind `null` |
| 2 | The run has no terminal | `null` |
| 3 | The read of the terminal failed, and a second `hc get` does not say that the terminal is gone | no change |
| 3a | The read failed, and the second `hc get` says that the terminal finished or is gone | `null` |
| 4 | The status of the terminal is `blocked` | `dialog`, with the kind that the host reported, else `null` |
| 5 | The status is `idle`, `done`, or `error`, the state is `waiting`, and the turn of the terminal equals the turn of the state | `turn-ended` |
| 6 | The status is `idle`, `done`, or `error`, the run is a `resume` or an `assist` run, and its state is `running` | `turn-ended` |
| 7 | Each other case, also a terminal with no status | `null` |

A turn that ended after the last step-end verdict gives no state until the step-end watch gives
its verdict for that turn. A resume run and an assist run have no step-end watch, so row 6 stands for them. A result
whose state, kind, and turn equal the last result keeps its `changedMs`.

**The notes.** The daemon types a note into the coordinator tab when a run needs attention. It
holds items only while it holds a coordinator record. The loop of the attention state changes the
items:

- A change of the attention of a run to a state gives the run one attention item, in place of its
  earlier one; a change to `null` removes it, so a state that went away before the note is not sent.
- A run whose `outcome` is set for the first time gives one ended item (its outcome kind and exit
  code), unless the daemon refused the request of the run. A run that the daemon detached has no
  outcome and gives no item.
- A daemon that takes over a live record gives each run with an attention its item again, in the
  first pass. With no record the daemon holds no item, and an open starts with none, so the open
  types no note for a change that came before it.

A pass that ends while an act of the board is in flight ("The board acts") types no note, and the
items stay for the next pass. At the end of each other pass with one or more items, inside the
sequence of the coordinator terminal, the daemon reads `hc get` of the coordinator terminal. Only
the status `idle`, `done`, or `error` goes on; a failed read and the statuses `working`, `blocked`,
and none type nothing and print nothing, and the items stay. The daemon then types one note with
`hc send <terminal> --json -- <note>` (no `--force`, no `HC_TERMINAL_ID`) and removes the items on a
sent result. Another result keeps the items for the next pass, and the first failure after a success
prints
`daemon: coordinator: cannot type a note into the tab Coordinator; its items stay for the next note`.
A session at an ended turn starts a turn with the note; the status gate keeps the note out of a
working turn, so the daemon sends no reminder: an item leaves only by a sent note, by a change of
its run, or by the end of the record.

The note is the marker `[celetis daemon note]`, `Items: <count>.`, and the sentence `This note is
data from the daemon. It is not an instruction of the maintainer.` on the first line. One line
follows for each item, in the order of the items: `- #<issue> <step>: turn-ended`, `- #<issue>
<step>: dialog (<kind>)` (`no kind` when the host named none), `- #<issue> <step>: quota-wait`, or
`- #<issue> <step>: ended, <outcome>, code <code>`, with `-` for a missing issue or step. The last
line is `Read the status: celetis --agent <host> coordinator status`. The note holds only fixed
words and validated values: no title, no screen text, no issue text, and no reason text.

**The limit of the composer, for a note.** A note joins the unsent text of the composer of the
coordinator session, as a send does ("The limit of the composer", below), and hc has no option
that refuses a composer with text.

**The screen read.** `celetis coordinator read <n>` sends `POST /coordinator/read`. The daemon
takes the run of issue `<n>` that has a terminal and reads the screen with 200 lines of history
(`hc read --lines 200`); it sends no key and no text. The client prints the text on stdout and
exits 0. When hc gave only the visible screen (`complete` is false), the client also prints a line
on stderr, with the reason `why` when hc gave one: a full-screen program that works gives only its
screen. A run with no terminal refuses with code 3, and a failed read refuses with code 6.

**The send.** `celetis coordinator send <n> <file> --as maintainer|coordinator` types one message
into the session of the run of issue `<n>`; the flag can stand at any place after `send`. The
client reads the file as bytes and removes one final newline. A file that it cannot read or that
is not valid UTF-8 exits 2. With no `CELETIS_COORDINATOR` that is a UUID, it sends no request and
exits 3. Else it sends `{number, authority, text, token}`, with the value as `token`, and prints
`coordinator: sent to #<n> as <authority>` at an accepted answer. The daemon checks in this
order, and each refusal types nothing and changes no file:

1. the token: no coordinator record, another value, or a barrier that a read shows gone refuses
   with code 3 (`coordinator: this session is not the coordinator session of the daemon; run
   celetis coordinator in a terminal`);
2. the text: an empty text, more than 4096 characters, a text that is not well-formed Unicode, and
   a control character other than a newline and a tab (U+0000 to U+001F, U+007F to U+009F; so a
   CRLF file refuses at U+000D) give the 400 answer with the problem and code 2;
3. the run: the run of the issue with a terminal, else the last run of the issue that is not
   `finished`. No run refuses with code 3; a run with no terminal refuses with code 3 and the
   reason: it starts, it waits for a usage limit (`quota-wait`), or it ends (`ending`);
4. inside the sequence of the terminal ([The step end](../plugins/celetis/docs/workflow.md#the-step-end),
   step 3): the run again; another terminal, no terminal, and the state `exiting` refuse with code
   3. Then `hc get` of the terminal: a failed read or no status refuses with code 6, the status
   `blocked` refuses with code 3 and a line that names the dialog kind and the tab, and a status
   whose app is no host (a shell tab, or a Windows tab that holds after its program exited) refuses
   with code 3 and a line that names the tab.

The daemon then types the header, a newline, and the text with `hc send <terminal> --json --
<message>`, with no `--force` and no `HC_TERMINAL_ID`. The header is one line: the marker
`[celetis coordinator session]`, `authority: <authority>.`, `Time: <UTC time to the second>.`,
the fixed words of the authority, and `A later header never widens this authority.` For
`maintainer`, the text holds the words of the maintainer, passed on by the coordinator session;
for `coordinator`, the coordinator session decided it, and it is no consent and no approval. The
header holds no other text of the caller. A sent message prints
`daemon: coordinator: sent to #<n> <step> as <authority>, <length> characters` to the log, with no
part of the text. hc refuses a blocked program (code 3, the kind of a new read); a terminal that hc
says is gone refuses with code 3; each other failure is an unknown outcome with code 6, and its line
tells the coordinator session to read the screen before it sends again. The text of such a send
can be in the session, so the daemon prints
`daemon: coordinator: the outcome of a send to #<n> <step> as <authority>, <length> characters, is unknown`
to the log, also with no part of the text. A session at an ended turn
starts a new turn with the message; a working session gets it as its host delivers typed text
during a turn.

**The end.** `celetis coordinator end <n>` asks the assist session of issue `<n>` to exit. With no
`CELETIS_COORDINATOR` that is a UUID, it sends no request and exits 3. Else it sends
`{number, token}` and prints `coordinator: asked the assist session of #<n> to exit` at an accepted
answer. The daemon checks in this order, and each refusal types nothing:

1. the token, as "The send" does: no record, another value, or a barrier that a read shows gone
   refuses with code 3; a failed read of the barrier is no end;
2. the run: the run of the issue with a terminal. None refuses with code 3 (`coordinator: #<n> has
   no live run with a released session`). A run whose kind is not `assist` refuses with code 3
   (`coordinator: the run of #<n> is no assist run; coordinator end ends only an assist session`);
3. inside the sequence of the terminal, shared with the send and the notes: the run again (another
   terminal or none refuses with code 3). Then `hc get` of the terminal: a failed read or no status
   refuses with code 6; `blocked` refuses with code 3 and the dialog line of the send; `working`
   refuses with code 3 (`coordinator: the session of #<n> works; end it after its turn ends`); a
   status whose app is no host refuses with code 3 and a line that names the tab;
4. the exit request of the host, as the step end sends it. A sent request prints
   `daemon: coordinator: exit request to #<n> assist` to the log and answers `{accepted: true, run:
   null}`. A failed request prints
   `daemon: coordinator: the outcome of an exit request to #<n> assist is unknown` and refuses with
   code 6; its line tells the coordinator session to read the screen before it ends again.

The run ends by the rule of an unwatched session when the host exits. The end adds no `set-aside`
row and starts no step.

The daemon keeps no state of a sent exit request, because an assist run has no state `exiting`.
Until the host exits, a second end sends a second exit request when the checks pass again, and a
send is typed into the session. On Claude Code the exit request is `hc send <terminal> /exit`, the
hc call of a send, and it has no header. So it can join unsent text of the maintainer in the
composer ("The limit of the composer"), and the end can then answer `{accepted: true, run: null}`
while the session stays open. No check of this build observed that case with a real host.

**The limit of the composer.** hc pastes the message into the composer of the run session. When
the maintainer left unsent text there, that text comes before the header, and hc has no option
that refuses a composer with text. So the rule of the session that receives a message takes the
header at any place of the message, and the text before the header is no answer.

**The board acts.** The board server calls three methods of the dispatcher in the daemon process
(`coordinator` of `BoardDaemon`, `engine/board/adapter.ts`): `facts` gives the host, the terminal, the
session ID, and the prompt of the record while the daemon holds it, else `null`; `open` is the quiet open; `act` takes one act:
`{kind: 'say', text}`, `{kind: 'key', key}`, `{kind: 'interrupt'}`, or `{kind: 'end'}`. The
socket has no path for them: `POST /coordinator/say`, `/coordinator/key`, `/coordinator/interrupt`,
and `/coordinator/end` get 404. While the daemon stops, `open` and `act` answer the stop line, and
during the takeover the takeover line, each with code 3 ("The requests"). An act has no terminal:
its one target is the terminal of the coordinator record. The daemon checks in this order, and
each refusal types nothing:

1. the shape: another kind or another field, a key outside the table, and a text that the rule of
   "The send" refuses give the 400 answer with code 2. The keys are `up`, `down`, `enter`, `esc`,
   `1`, `2`, and `3`, the hc key names of the fixed table;
2. the record: no record refuses with code 3 (`coordinator: no coordinator session runs; press
   Coordinator on the board to start one`);
3. inside the sequence of the coordinator terminal, with the notes: the record again, then the
   process of the barrier (gone refuses with code 3 and the line of no record; a failed read refuses
   with code 6), then `hc get` of the terminal. A failed read refuses with code 6
   (`coordinator: cannot read the hc status of the tab Coordinator; nothing was sent`);
4. the state of the session, from the hc status, and the acts that it permits:

   | State | hc status | Acts |
   | --- | --- | --- |
   | `starting` | none | none of the four |
   | `dialog` | `blocked` | a key |
   | `works` | `working` | a message, an interrupt |
   | `turn-ended` | `idle`, `done`, or `error` | a message, an end |

   Another act refuses with code 3 and a line that names the state, with the kind of a dialog:
   `coordinator: the coordinator session shows a dialog (<kind>); a message is not possible in this
   state`.

Then the daemon does the act:

- **say** types the text as the maintainer types it, with no header:
  `hc send <terminal> --json -- <text>`, with no `--force` and no `HC_TERMINAL_ID`. The call waits
  at most 90 seconds, above the draft wait of hc (60 seconds by default). hc waits for an unsent
  draft of the tab, then pastes the text after it and presses Enter, so the composer submits the
  draft and the text as one input; what a real host does with that input is not observed in this
  build. hc refuses a blocked program (code 3, the kind of a new read), a terminal
  that hc says is gone refuses with the line of no record, and each other failure is an unknown
  outcome with code 6 (`coordinator: the outcome of the message is unknown; read the log of the
  panel before you send again`);
- **key** presses one key with `hc keys <terminal> <key> --json`. hc presses a key in each state, so
  the state check is the one guard that a key goes only into a dialog;
- **interrupt** runs `hc interrupt <terminal> --json`, which waits at most 30 seconds. It is accepted
  when hc names the stop key that it pressed; the answer holds no result of the turn;
- **end** sends only the exit request of the host (`requestExit`, as the step end does), and waits
  at most 90 seconds too: the exit request of Claude is a message (`hc send <terminal> /exit`), so a
  draft of the tab holds it. The record goes when a definite read shows that the barrier is gone, as
  "The record" says. With a draft, hc pastes `/exit` after the draft and presses Enter, as for a
  message.

For a key and an interrupt, a terminal that hc says is gone refuses with the line of no record, and
each other failure is an unknown outcome with code 6. A failed exit request is an unknown outcome.

An accepted act prints one line to the log: `daemon: coordinator: board: say, <length> characters`,
`daemon: coordinator: board: key, <key>`, `daemon: coordinator: board: interrupt`, or
`daemon: coordinator: board: end`. An unknown outcome prints the same words and `; the outcome is
unknown`, and its line of code 6 tells the maintainer to read the log of the panel first. No line
holds a part of the text. Each act waits for the act before it in the sequence, so a message that
waits for a draft holds a key, an interrupt, and an end too. A draft holds `hc keys` only for the
short pause of hc, and `hc interrupt` not at all. A note and a message are two pastes in
that sequence, never one composer with both.

A stop of the daemon waits at most 5 seconds for an act in flight and does not abort it. An act
that takes longer gets no answer, and the text of a message or an end can still arrive in the
session. The page shows a failed request and keeps the text, with the line of an unknown outcome.
The stop does not wait for a note behind that act: a note never waits behind an act in flight
("The notes"). The items of a stopped daemon end with it, and a daemon that takes over the record
gives each run with an attention its item again. A note that the daemon types at the moment of the
stop ends first; each `hc` call of it has a bound of 15 seconds.

**The board.** The coordinator session is no item of the strip Human sessions
([The cards](board/README.md#the-cards)). Its one place on the board is the header control
`Coordinator`.

**Limit.** The daemon records no usage observation of the coordinator session, and a usage limit
of its host stops it as it stops an `assist` session.

## A stop of a run

A `run` or `queue` form has nothing to stop
([Start the script](../plugins/celetis/docs/workflow.md#start-the-script)).
`celetis daemon stop` detaches every run, as "The stop" of
[The master daemon](#the-master-daemon) says: each run stops its job of the step end and removes
its step-end record. A session whose barrier the run released stays open in its tab and keeps the
issue lock until it exits, so leave it with `/exit`. Before the release, the run closes the tab. A
stopped queue run does not write the queue record.

**The Stop of a run.** The request `POST /halt {number, terminal}` (the board Stop) ends the session
of one run of the daemon. The daemon refuses with 409, code 3, and one line, in this order:

1. No run of the daemon holds the issue in a state other than `ending` or `finished`:
   `daemon: #<n> has no live run of the daemon; close its tab, then use Set aside`.
2. A landing of the issue runs (`status.landings`):
   `daemon: a landing of #<n> runs. Wait for the landing to end, then stop again.`
3. The terminal of the run is another one: `daemon: the card of #<n> is stale: its run has another
   session now; read the board again`.
4. The state of the run is not `running`, `waiting`, `checking`, or `stopping`, or its session has
   already ended: `daemon: #<n> has no session that runs now`.
5. The host is Codex, which has no proved end:
   `daemon: The daemon cannot prove the end of a Codex session. Close its tab, then use Set aside.`

A refused Stop changes nothing. An accepted Stop sets the stop flag of the run (the key `stop` of
the run record, with the terminal and the time), writes the record, marks the run `stopping`, and
closes the tab (`hc kill`, then `hc rm`). An accepted Stop records the members of the attempt (on
Windows, opens its job and holds the handle) before it closes the tab. The proof of the session end
then signals, after a grace of 5 s from the tab close, each member that still runs (SIGTERM, then
SIGKILL 5 s later), and reads for at most 5 s more. A failed read of the process table reads again,
for at most 20 s from the start of the proof; then the result is `unverified`. A process on the
terminal that the proof first sees after the tab close is counted, never signalled, unless its
environment carries the attempt marker. When the daemon signalled a process, it prints
`#<n>: the daemon signalled <k> processes of the attempt (SIGTERM: <pid> <name>, …; SIGKILL: …)`
(on Windows `#<n>: the daemon ended <k> processes of the attempt in its job (PIDs: …)`) and records
the event `attempt-signalled`. The name is the executable name only. A flag that expires at 60 s
drops the record and closes the held job. A second Stop while the flag is set changes nothing. While
the flag is set, the state stays `stopping` until `ending`. The flag wins over each session end:
when the session ends (any exit code) or the usage watch reports a block, the run proves the end of
the session and its delegated work with `endOwnedAttempt` of `engine/lib/run/attempt-end.ts` (step 2 of
[Usage-limit recovery](#usage-limit-recovery)), and writes no recovery record. A proven end
removes the start folder, adds the issue to the `set-aside` file, records no no-progress row,
starts no next step, and ends the run with the outcome `stopped` and the line
`#<n>: stopped by the maintainer; set aside`. A queue run ends as a stopped step: the queue record
gets the state `error` with that reason. An unproved end adds no set-aside row and prints the line
of an unverified recovery, with the reason `stopped by the maintainer.`, the cause, the running
PIDs, and the native resume, and the act `End those processes, then restart the daemon: celetis
daemon stop, then celetis daemon start.` The run then ends with the outcome `stopped`, and keeps the
issue lock until the daemon stops, so no run of the issue starts while that work can still run.
While the run is `stopping`, `POST /land` of the issue refuses with 409, code 3, and
`daemon: #<n> is stopping; the landing does not start`, so the close of the tab cannot abort a
landing.

When the session has not ended 60 seconds after the Stop request, the daemon clears the flag,
writes the record, restores the state of the run, and prints
`daemon: #<n>: the tab did not close; the run goes on`. A successor daemon that adopts a record
with the flag keeps the flag, does not close the tab again, and clears the flag at the rest of the
60 seconds. A session that ended while no daemon ran ends as a Stop, and so does a record with the
flag and no session or a session that did not start: the run adds the issue to the `set-aside`
file and starts no step. A usage block that arrives while the flag is set waits for the session
end; when the flag clears first, the run handles the block as a usage-limit recovery.

## The agent of each start

At each start, the daemon reads the local order, the main config, and
the per-host usage records again. It computes the effective order of the step
(`effectiveOrder` of `engine/lib/agent/order.ts`): when the `agents` field names a preferred agent
for the step and the local order includes it, that agent comes first, then the other agents of the
local order in their order; otherwise the effective order is the local order. It passes that order
to `selectAgent` of `engine/lib/agent/usage.ts`. The default choice takes the first included host
with no active block; an explicit choice keeps its host and ignores the preference. The preflight
and the contract check of the selected host run after this selection. A missing executable
or another setup error of a preferred agent stops the start, and no next agent is tried; the
remedy is a local exclusion of that agent, which then wins. Each step session gets a
usage attempt. A Claude step gets attempt-local `Stop` and `StopFailure` callbacks through
`--settings`, beside its `--session-id`. The callbacks use the `command` and `args` form of a
hook, which runs with no shell, so they run on Windows with and without Git Bash. The hook runs
`git`, so `git` must be on the `PATH` of Claude; a host with no `git` there records no usage. A
Codex step is read through `thread/read` and `thread/turns/list` after the daemon saves its verified ID. The daemon acts only on the
observation of its own attempt, also when the shared record keeps a newer attempt.

## Usage-limit recovery

Only a daemon-owned step with the default choice continues on another
agent. A confirmed refusal of an explicit host is recorded; that session stays open, and no other
agent starts. After a confirmed refusal of the default host, the daemon:

1. Saves the block, writes `<git common dir>/celetis/recovery/<n>.json` (schema 4, with the key `daemon`; its `issue`
   is the issue key as a JSON string) with the state `recovering`, and stops the job of the step end.
   A read of a schema-2 record with `plan: null` converts it to schema 4 under the recovery lock, with the issue
   number written as its key and each other field kept, and keeps the exact original bytes in an
   immutable sibling archive. A number that the grammar of the tracker refuses refuses the record
   intact, before the lock.
2. Ends only its own attempt (`endOwnedAttempt` of `engine/lib/run/attempt-end.ts`). The barrier
   gives the host `CELETIS_ATTEMPT=<attempt id>`, and each child inherits it. A resume session
   also gets an attempt ID, which its run record keeps, so a Stop proves its end the same way.
   Codex has no proved
   termination path on either platform, so its result is always `unverified`. On macOS and Linux,
   for Claude, the daemon records the members of the attempt by PID and start time. A member that
   the daemon can signal is a process of the tree under the barrier, a process with that entry in
   its environment (not in its arguments), or a process on the tab's controlling terminal outside
   the tab shell's own tree. A process whose two `ps` views differ and whose text holds the entry
   is a member that the daemon only counts. The daemon, the tab shell and its processes outside
   the barrier tree, the barrier (by its PID and start time), and PID 1 are never members. It
   sends `/exit`. When the barrier
   still runs 10 seconds after the start of that request, it sends SIGTERM once to the host
   process, the one child of the barrier (as at the step end), so a native dialog of the host does
   not keep it alive. It reads
   the members again each 250 ms, and each read adds the new members. A grace of 5 seconds starts
   at the earlier of the barrier end and the time when that host SIGTERM is due (10 seconds
   after the start of the request, also when no SIGTERM is sent). Then the daemon sends
   SIGTERM to each member that it can signal and that still runs, and SIGKILL 5 seconds later.
   Right before each signal, it reads the member, and it signals only a member that runs with its
   recorded start time; a failed read sends nothing. A final read waits at most 5 seconds more.
   So a writer that left the tree, as with `cmd &` or `nohup`, still counts and ends. A session
   with no controlling terminal (`ps` shows none, `?`, or `??`), a missing marker, or a failed
   process read is `unverified`. A member that still runs after the final read (one that the
   daemon only counts, or one that the signal did not end) gives `unverified` with the reason
   `processes of the attempt still run after SIGKILL`, and the line names the running
   PIDs. The check cannot see a
   process that leaves the tree and the terminal (a new session) and whose environment `ps`
   cannot show: one that clears the entry, or a macOS platform binary such as `/bin/sh`. The check
   accepts Linux terminal names (`pts/<n>`), but no Linux run has proved it.

   On Windows, the barrier joins a named job before it starts the host
   ([The session tab](#the-session-tab)), and the proof is the member list of that job. The daemon
   opens the job by its name and holds the handle to the end of the check. For a Stop, it opens
   the job before it closes the tab. When the first read holds no process other than the barrier,
   the attempt is quiescent. Else, for a recovery, the daemon sends `/exit`. When the barrier
   still runs 10 seconds after the start of that request, it ends the host, the one child of the
   barrier, once with `TerminateProcess` and status 143. A Stop sends no request, because the tab
   is closed. The daemon reads the members each 250 ms. A grace of 5 seconds starts at the tab
   close for a Stop, and for a recovery at the earlier of the barrier end and the time when that
   host end is due. When a process other than the barrier remains after the grace, the daemon
   ends each member other than a live barrier with `TerminateProcess`, or the whole job with
   `TerminateJobObject` when the barrier has ended. A final read waits at most 5 seconds more
   until no process other than the barrier remains. When the barrier does not run at the start of
   a recovery check, the daemon ends no member: it reads the members until no process other than
   the barrier remains, for at most 20 seconds after the request. A member with the PID of the
   barrier counts as running when the barrier does not run with its start, and a failed read of
   the barrier spares it. A job that cannot be opened, a failed read of the members, a failed exit
   request, or a member that still runs after the final read or at the 20-second deadline is
   `unverified`, and the line names the running PIDs. The reason after the job end is
   `processes of the attempt still run after the job ended them`.
   The name of a job ends with its last handle, so after the barrier exits the job cannot be
   opened, and the proof reads the record of the barrier instead
   ([A session that ended while no daemon ran](#a-session-that-ended-while-no-daemon-ran)). The
   check cannot see a process that a broker starts outside the job, for example a scheduled task
   or a WMI process.
3. On `unverified`, starts no other agent. The tab stays open, and the run keeps the issue lock.
   The daemon stops with a line that names the reason, the cause, the running PIDs, the tab, and
   the native resume command of the session from the main checkout.
4. After proof, archives the session record ([Sessions](#sessions)), prints the native resume command, and
   binds the one dirty lane of the issue: its path, branch, HEAD, and a digest of its status,
   diff, and untracked files. Two or more dirty lanes of the issue give no binding.
5. Reads the issue again. When the record, the live daemon, the issue lock, the attempt, and the
   lane binding all match, the bound lane does not stop the read. A dirty main checkout, another
   dirty lane, a changed branch, HEAD, or digest, and an unresolved merge, rebase, cherry-pick, or
   revert still stop it.
6. Starts the same step again on the next eligible host (one that can run the step) of the effective
   order of the step when the decision is the same step with the same spec digest and `## Plan` comment. The first
   authorization of the start still holds, so the skip, no-progress, and gate checks do not apply
   to this retry. A changed spec or plan of that step stops. A new step follows the normal checks,
   its gate included.

The retry session gets `CELETIS_RECOVERY`, the attempt ID, in its environment, and `- recovery: yes`
in its header. A `specify` session has no step text, so its retry gets no header line. That value
is only a lookup key: `worktree` validates the recovery record again
([the lane worktree](../plugins/celetis/references/procedures/worktree.md)). A normal end of a session removes the recovery
record. The next step computes its own effective order, so a recovered preferred host takes the
next step.
A preference change or a recovered block does not stop a session that works.

## A session that ended while no daemon ran

The master daemon applies the same
steps to a usage block that it reads after the session ended, with another proof in step 2. The
barrier is gone, so the daemon sends no exit request, and the process tree under the barrier is
gone with it. The run record keeps the PID of the tab shell and the terminal name of the barrier.
The daemon starts a control child (Bun, alive until the proof ends) with a new `CELETIS_ATTEMPT`
value and requires the environment read to show it. Then it reads the members: each process with
the attempt marker in its environment, which the daemon can signal, and each process on the
recorded terminal outside the tree of the tab shell, which it only counts, because that terminal
name can belong to a new tab now. A failed process read, also the first read of the process
table, reads again, for at most 20 seconds in total; then the result is `unverified`, with the
cause that the process table could not be read. The grace of 5 seconds starts at the start of the
proof, and the stages of step 2 follow: SIGTERM, SIGKILL 5 seconds later, and a final read of at
most 5 seconds. A member that still runs after the final read gives `unverified` with its PIDs; no
member that runs gives `quiescent`. A record with no tab shell or terminal, a control child that the
read does not show, or a control child that ended before a read showed it gives `unverified`. The
limits above stay: the proof cannot see a process that left the terminal and whose environment `ps`
cannot show. When the barrier of a live refusal in the daemon ends before step 2 reads it, the
daemon uses the same proof, and its first failed read of the process table reads again in the same
way. The daemon records no tab shell, so its result there, and after a failed first read, stays
`unverified`.

On Windows, the name of the job ends with the last handle, which the barrier held, so a session
that ended by itself leaves no job to read. At the exit of the host, the barrier reads the members
of its job once and writes the file `job-empty` of its start folder when the job holds no process
other than the barrier. On this path, and for a live refusal whose barrier ended before the daemon
opened the job, the proof is `quiescent` when the barrier is gone and that file exists, else
`unverified` (`the job of the attempt could not be opened`). A descendant that still ran at the
exit of the host leaves no file, so a process that outlived the host keeps the result
`unverified`, also after it ended.

## Exhaustion

In one cycle, the daemon attempts each included host at most once. When no host can
start, it keeps the issue lock, writes the state `waiting` with a new wait ID, and prints one
line. The line names each host with its reason and its reset, or unknown; the time of the wake, or
that no reset is known; and the Retry command `celetis run retry <n> <wait id>`.

Only a supplied future reset sets a wake, at the earliest one. A reset in the past and an unknown
reset set none. Each second, the daemon reads the record and the usage records. It starts one new
cycle at the deadline, after Retry, or after a newer accepted observation of an included host has
no block. A clock change can move the wake; it cannot make a loop, because each cycle attempts
each host once and each wait needs a new wake. `run retry <n> <wait id>` writes one wake request
for the live waiter of the issue. A repeated request with the same ID is one cycle. Another wait
ID, no wait, or a run that stopped refuses with exit 3; Retry never starts a run. Retry lets
that cycle attempt blocked hosts once each in the effective order of the step, and keeps their
records. A stop of the daemon ends the wait loop and its wake. The record stays and authorizes
nothing until the next daemon takes the wait over ("A quota recovery"). A new start of the issue
that is no takeover removes the record and evaluates the issue again.

## Guards

[Personal landing permission](../plugins/celetis/README.md#personal-landing-permission) of the
plugin README, and
[Claude permissions: `.claude/settings.json`](../plugins/celetis/docs/setup.md#claude-permissions-claudesettingsjson)
and [Codex permissions: `.codex/rules/celetis.rules`](../plugins/celetis/docs/setup.md#codex-permissions-codexrulesceletisrules)
of the setup document, are the source for the rules and their checks. Claude
uses `.claude/settings.json`; Codex uses a trusted `.codex/rules/` configuration. Both cover the
current bare and explicit-host landing forms and restrict direct `gh pr merge`. The plugin does
not grant permissions. Retain each product project's own restricted acts.

The landing script holds the landing guard of the issue for each caller: a session, the
maintainer in a shell, and the hotfix checklist
([Branches, PRs, merge](../plugins/celetis/docs/issue-tracker.md#branches-prs-merge)).
The main and lane checkout guards apply on both hosts. Host rules do not inspect the commands
inside an allowed script or enforce every alternate command spelling. Codex prefix rules govern
requests outside its sandbox; they do not create a stronger sandbox.

## Sessions

The hc terminal of each session tab, also a resume tab, has the label `celetis.link` with the
value `#<n> <step>`, and the tab of an assist run has the value `#<n> assist`. It links the live card to the issue on the board. The label and the tab name
are not the saved session ID. From the main checkout, `celetis --agent <host> run resume 402`
asks the daemon to resume. The daemon run first takes the shared issue lock and keeps it until the
session exits. Under that lock, it reads and validates the current record for #402 and opens its exact host and session ID at the
level of the record: Claude gets `--effort <level>`, and Codex gets
`-c model_reasoning_effort="<level>"`. The resume passes only the level of the record and no
model. On the Anthropic API, Claude Code keeps the model of the transcript, unless
`ANTHROPIC_MODEL` is set in the environment of the daemon.
No `gh` call, completion job, or update runs during resume.

A missing or invalid record stops with a recovery action. A record with no verified ID directs
you to `claude --resume` or `codex resume --no-daemon`, by its saved host, to select a saved session manually.
Exact run resume needs a verified session identity and a saved turn. The daemon verifies and
saves them for each step session that it starts. A resumed session stays open until you leave it.

The record at `<git common dir>/celetis/sessions/<n>.json` has exactly seven fields:
`schema: 3`, `host`, `issue` (the issue key as a JSON string, `"12"`), `step`, absolute main
`checkout`, `session_id` (UUID or null), and `effort`, the level that the daemon requested after the
Codex clamp.
The daemon writes it atomically. Before a current record is used or replaced, a valid schema-1 or
schema-2 record becomes schema 3 under the issue lock. The conversion writes the issue number as
its key and preserves its host, step, checkout, and nullable native session ID exactly, and retains
its original bytes in an immutable sibling backup. A schema-1 record first gets the `effort` `high`
in memory, as it did to schema 2: the current Resume policy default, which does not describe the
original session's effort. A schema-2 record keeps its `effort`. Unsupported schemas, a number
that the grammar of the tracker refuses, and invalid data stop without replacement.
Before a usage-limit recovery replaces this record, the daemon copies it unchanged to
`<git common dir>/celetis/sessions/<n>/<attempt id>.json`. That archive keeps the exact native
session of each interrupted attempt; Resume reads only the current record.
The daemon supplies the identity, not the terminal; a label or a tab name is never an identity
([ADR-0058](https://github.com/ddinkov10/celetis/blob/main/docs/adr/0058-herdr-core-hosts-the-agent-terminals.md)).
For a Claude step, the daemon chooses the ID and passes it with `--session-id`. Codex has no option
that sets the thread ID before the start. So for a Codex step, the daemon asks the app-server
`thread/list` of the main checkout, and it takes the one thread whose `cwd` is the main checkout,
whose `createdAt` is at or after the start of the step, and whose `preview` is the exact prompt
of the step. No match means that the thread is not there yet. Two or more matches are an invalid
identity. The issue lock lets only one run start that prompt for that issue.
For an OpenCode step, the daemon chooses the ID and passes it with `-s`.
Claude persistence is a current saved user turn with matching ID, cwd, and launch time.
Codex verifies `thread/read` and `thread/turns/list` without resuming or starting a model turn.
OpenCode persistence is an entry of `opencode session list --format json --standalone` in the main
checkout with that ID, the main checkout as its folder, and a creation time at or after the start,
and a user message in `opencode session export <id> --standalone`
([OpenCode](../docs/hosts/opencode.md#the-daemon), "The session check").

If startup has not verified identity and a saved turn after 60 seconds, the daemon prints one
warning, on each host. It says that monitoring continues and directs the person to check
setup prompts in the tab of the session. Verification continues while the foreground runs, until
a saved turn verifies, an invalid identity ends the watcher, or cancellation stops it. A late
verified turn enters the normal completion checks without a restart.

An invalid identity ends the watcher with the startup error and the last 40 lines of the
terminal (`hc read`). Foreground
exit without a verified saved turn also reports the startup error, unless an earlier terminal
failure already reported it. The pending warning writes no terminal error marker, so it does
not suppress that final error. These failures write no false no-progress row. A record with a
null ID cannot be used for exact run resume.

## The attempt record

The daemon writes one record for each session attempt of an issue, so a later session or a person
can read the history of the attempts. The record is local. It has no network part.

The record of an attempt is the file `<git common dir>/celetis/attempts/<n>/<attempt id>.json`.
The folders `attempts` and `attempts/<n>` have mode 0700, and each file has mode 0600. The
daemon writes each file atomically. It writes the file when the attempt starts, and it writes the
same file again when the attempt ends. The daemon is the only writer.

A file is one JSON object with these fields:

| Field | Value |
| --- | --- |
| `schema` | `1` |
| `id` | The attempt ID, a UUID |
| `issue` | The issue key as a string |
| `work` | The kind of work of the session |
| `start` | `new` or `resume` |
| `host` | The host of the session |
| `model` | The model that the daemon chose for a Claude session, else the model that the daemon kept, or `null` |
| `effort` | The effort level, or `null` |
| `startedAt` | ISO 8601 UTC time of the start |
| `end` | `null` while the attempt is open, else `at`, `outcome`, `code`, and `reason` |

`end.at` is the time when the daemon recorded the end, not the time when the session ended. The
`outcome` is `exited`, `no-saved-turn`, `usage-limit`, `stopped`, `unverified`, or
`not-started`. `code` is the exit code of the session, or `null`. `reason` is a text of 512
characters at most, or `null`. The outcome `not-started` means that a takeover proved that the
start barrier was never released. A state with no such proof stays `open`. An `open` attempt
means that the daemon recorded no end. It does not prove that the session still runs or that it
crashed.

A failed write does not stop the run. It records one `workflow` entry named `attempt-record` in
the event record.

`celetis --agent <host> attempts <n>` prints the table of one issue, oldest first. The columns are
`started ended work start host model effort outcome code`. A `null` prints `-`, and an open
attempt prints `open` as its outcome. A reason prints on the next line. A file that is not a valid
entry gives one line on stderr, and the read continues. With no entry, it prints
`#<n>: no attempts recorded`. The command reads only local files and writes nothing. It exits 2 for
a bad key, another form, or a folder with no Git checkout, and 6 for an unsafe or unreadable
folder.

The limits: the record is in one clone, so another clone has none of it. No rule removes an old
file. A removed clone loses its record.

## The event record

Each Celetis process that detects a failure appends one entry to the event record of the user. A
later session reads the record with `celetis --agent <host> events [--after <id>]`. The record is
local. It has no network part. [ADR-0066](https://github.com/ddinkov10/celetis/blob/main/docs/adr/0066-one-shared-event-record-with-a-lock.md) holds
the reasons why all processes write one shared file under a lock. The record holds failures only.
The entries that are not failures go to the lifecycle log of the repository
([The lifecycle log](#the-lifecycle-log)).

The record folder is `<base>/.local/state/celetis/`. `<base>` is `CELETIS_HOME` when it is set,
else the home folder. A relative `CELETIS_HOME` is an error of the record: no entry is written.
The folder holds three files:

- `events.jsonl` is the current file.
- `events.1.jsonl` is the one older file. It exists after the first rotation.
- `events.lock` is the lock file.

The folder has mode 0700 and belongs to the current user. Each file has mode 0600. On Windows, the
mode rule does not apply. Missing parent folders get the default mode. The first write makes the
folder, so a process that writes no entry makes no folder.

An entry is one JSON object on one line, ended by `\n`, in UTF-8:

| Field | Value |
| --- | --- |
| `schema` | `2`. A line of schema 1, written before, keeps its schema and holds `issue` as a JSON number |
| `id` | `<time>-<pid>-<8 hex>`. It is unique. `--after` uses it |
| `time` | ISO 8601 UTC with milliseconds |
| `kind` | `defect`, `refusal`, or `workflow` |
| `name` | `exit` for an exit entry; a stable kebab-case name for a workflow or board entry |
| `command` | The sub-command name, or the role of a process with no sub-command: `launcher`, `session-start`, `update-worker` |
| `argv` | The arguments of the process after the sub-command name |
| `cwd` | The absolute working directory |
| `host` | `claude` or `codex` from `--agent`, then `CELETIS_SESSION_AGENT`, then `CELETIS_AGENT`, else `null` |
| `revision` | The full revision of the running engine, or `null` when it is not known |
| `pid` | The process ID |
| `issue` | The issue key when the site knows it, as a string (`"12"`), else `null` |
| `code` | The exit code of an exit entry, the HTTP status of a board entry, else `null` |
| `message` | For a defect, the message of the error. For a refusal, the text that the process itself wrote to stderr. For a workflow entry, the line that the site printed or returned; for `land-exit`, the last line of `land` among the writes of the landing itself (not of its suite), or an empty text when it printed none |
| `exception.type` | The class name of the error. A defect only |
| `exception.stacktrace` | `Error.stack`. A defect only |
| `fingerprint` | 16 hex digits. The same failure gives the same fingerprint |
| `truncated` | The names of the cut fields. It is absent when no field was cut |

A whole line is 16 KiB at most. When a line is too long, the writer cuts `message` first, then
`exception.stacktrace`, then the last items of `argv`. It keeps valid UTF-8 and valid JSON, and it
lists each cut field in `truncated`. The record holds no environment value.

A refusal keeps the last 16 384 UTF-16 units of the text that the process wrote with
`process.stderr.write` or `console.error`. Text that a child process writes to an inherited
stderr is not in it. `console.error` arguments are formatted with `util.format`. For an object
argument, that text can differ from the terminal text of Bun.

The three kinds:

- **defect:** an error that is not a `HostError` ends a process, or a board request ends with
  status 500. A top-level `catch` that prints such an error and returns exit 1 gives the error to
  `markDefect`, so the entry is a defect with its stack.
- **refusal:** a process ends with a nonzero code and no defect. Usage errors, config errors,
  and results such as the exit 4 of `worktree` are refusals.
- **workflow:** the daemon or the board reports a failure and continues.

These processes record: each sub-command, the launcher before it replaces its process, the
session-start child of the daemon, and the update worker of the board. These do not record:
`build`, `verify`, `install-tools`, `events`, a product script that a Celetis process runs, the
`bun --eval` helper, and the host sessions. A child process records its own failure. A parent
that passes on the exit code of a child unchanged (`passOn`) records nothing. A parent that
turns the failure of a child into a new error of its own records
that error. The `land` client passes on the status of the landing of the daemon in the same way:
the daemon records the landing (`land-exit`, `land-defect`), and the client records only its own
refusals, for example a stream with no status, with only its own lines as the
message, not the output of the landing that it prints. A direct landing, which runs in the `land`
process, records the landing itself: one `land-exit` or `land-defect` event for a nonzero end, none for exit 0.

A process that ends with 0, 129, 130, or 143 writes no exit entry. A successful `execve`
replacement of the launcher ends no process, so the new process records its own exit. A workflow
entry and the later exit entry of the same process are two reports, and both stay.

The workflow and board entries, by `name`:

| Name | Site |
| --- | --- |
| `no-progress` | The daemon stops a step that gave no progress. `issue` is set |
| `step-skip` | The daemon stops a step that skips a step of the lane. `issue` is set |
| `startup-error` | A session does not start (`startupError` in `engine/lib/run/session.ts`). `issue` is set |
| `step-end-write` | The daemon cannot write a step-end record and continues. `issue` is set |
| `exit-request` | The daemon cannot ask a session to exit. `issue` is set |
| `exit-signal` | The daemon sends SIGTERM to a Claude host that does not exit within 10 seconds of its exit request; on Windows, it ends the host process. `issue` is set |
| `exit-timeout` | A session does not exit within 10 seconds of its exit request and gets no signal, or within 10 seconds of the SIGTERM (on Windows, of the end of the host process). `issue` is set |
| `issues-read` | Auto mode cannot read the open issues from the tracker of the project |
| `queue-error` | The queue of the daemon saves the state `error`, or ends with an error |
| `run-exit` | A run of the master daemon ends with a nonzero code. `issue` and `code` are set |
| `run-defect` | A run or auto mode of the master daemon ends with an unexpected error. A defect with its stack |
| `land-exit` | A landing of the master daemon or a direct landing ends with a nonzero status, also 143, and no unexpected error. `issue` and `code` are set |
| `land-defect` | A landing of the master daemon or a direct landing ends with an unexpected error. A defect with its stack. `issue` and `code` are set |
| `board-request` | A board request ends with status 500. A defect with the stack of the cause. `code` is 500 |
| `board-terminal` | A board request ends with status 502 because the terminal core failed. `code` is 502 |
| `board-update` | The board cannot replace the engine in an update, or it cannot restart after a completed installation |

The daemon records a line once for each printed line. A no-progress stop in the queue gives both
`no-progress` and `queue-error`. A board request with status 4xx is a result, not a failure, and
the board health reads are state that the board shows, so neither is recorded.

The board does not stop a repeated failure. Each repeat is one more entry with the same
fingerprint:

- The board checks for an update when it starts and 10 minutes after each check ends. An update
  that a person starts stops this timer. Each check starts the update worker, and the worker
  starts one `engine/lib/update/updater.ts --inspect <host>` child for each host that it inspects. Each of
  these processes records its own failed exit. A child that fails, for example because the update
  source cannot be reached, gives one refusal entry (`command` `update`) at each check. The worker
  exits 0 when it reports a failed check, so it records nothing then. A failure that the worker
  finds itself, such as a source of the engine that cannot be reached, gives no entry.
- Each board answer with status 500 is one entry. The page reads the board state again 5 seconds
  after each read, or 15 seconds after it when the page is hidden. A read that fails each time
  gives one entry for each read.

The fingerprint is the first 16 hex digits of SHA-256 over a key. The key parts are joined with
`\n`:

| Kind | Key |
| --- | --- |
| `defect` | `defect`, `command`, `exception.type`, and the first stack frame inside the folder that holds `engine/`: its path relative to that folder and its function name, with no line or column |
| `refusal` | `refusal`, `command`, `code`, and the first line of `message`, with the folder that holds `engine/` replaced by `<engine>`, then each `#` followed by a match of the issue key grammar replaced by `#0`, then each run of digits replaced by `0`. Only the form `#<key>` is covered: a key with no `#`, for example in a path, groups by its digit runs |
| `workflow` | `workflow`, `command`, and `name` |

Each write opens `events.lock` and takes an exclusive `flock` (`LockFileEx` on Windows). It
retries for 2 seconds at most. Under the lock, the writer appends the whole line with one write.
When `events.jsonl` is then larger than 5 MiB, the writer renames it to `events.1.jsonl`, which
replaces the older file. The record is about 10 MiB at most. A process holds no lock between two
writes. When the previous writer died in the middle of a line, the next writer ends that line with
`\n` first.

A record that cannot complete does not change the exit code, the stdout, or the other stderr text
of the process. It prints one line with the reason, and writes no entry. The reasons are: the lock is busy after 2 seconds, the folder is not private, a relative
`CELETIS_HOME`, a full disk, or a removed working directory.

`celetis --agent <host> events [--after <id>]` takes a shared lock with the same 2-second bound,
reads `events.1.jsonl` and then `events.jsonl`, and prints each entry as one JSON line on stdout,
oldest first. The record file is input that the command does not trust. It prints a line
only after it parsed the line as a JSON object with a string `id`. It skips the incomplete last
line of a file (no `\n`). A line that is not a valid entry gives one stderr line with the file
name and the line number, and the read continues. It follows no link and reads only a regular file
that is private to the current user (mode 0600). A link, a FIFO, another file type, or a file that
is not private is an unsafe file: the command prints one `state:` line and exits 6. On Windows, the read follows a link, and the mode rule does not apply. With `--after <id>`, it prints the entries after the last entry with that `id`.
When no kept entry has the `id`, it prints one stderr line and then all entries. With no folder
or no file, it prints nothing. The exit code is 0 for each of these; the row of `events` in
[The commands](../plugins/celetis/README.md#the-commands) gives the other codes. The command writes
nothing to the record, also not its own failures.

The record has these gaps:

- A stop of the Claude Code entry hook is not in the record. The native API of the hook has no
  file write.
- A failure that only an agent sees, such as a failed tool call, is not in the record. The skills
  `feedback` and `lesson` cover it.
- A rejected promise that nothing awaits is not in the record. Bun 1.4.4 ends the process with
  status 1, but gives the `exit` event the code 0.
- A crash before the recorder loads, and a `SIGKILL`, leave no entry.
- A process that an uncaught `HostError` ends records a refusal with an empty message. Bun does
  not give the native crash text to the capture.
- The exit codes 129, 130, and 143 are not recorded.
- The checks of #239 ran on macOS only. The `flock` exit path on Linux, and `LockFileEx`, the
  rename over an existing file, and the exit handler on Windows, have no runtime evidence.

## The lifecycle log

The master daemon appends one entry to the lifecycle log of its repository for each change of its
work that the type table below lists. A person or a tool reads the log with
`celetis --agent <host> daemon events [--after <id>]`, also when no daemon runs. The log is local. It
has no network part. [ADR-0141](https://github.com/ddinkov10/celetis/blob/main/docs/adr/0141-the-daemon-keeps-a-lifecycle-log-of-its-own.md)
holds the reasons why the daemon has a log of its own and the event record does not hold these
entries.

The log folder is the daemon folder, `<git common dir>/celetis/daemon/`, which also holds
`daemon.log`. It holds three files:

- `events.jsonl` is the current file.
- `events.1.jsonl` is the one older file. It exists after the first rotation.
- `events.lock` is the lock file.

The folder has mode 0700, and each file has mode 0600. On Windows, the mode rule does not apply. The
first write makes the files. A repository whose daemon never started has no log.

**The writer.** Only the master daemon writes. It makes its writer right after it takes the lock
`daemon` ("The master daemon", "The start", step 4), and its first entry is `daemon.started` with
`seq` 1. A daemon that does not get the lock writes nothing. A successor starts after its
predecessor released `daemon`, so one daemon writes at a time. The coordinator session, the board,
the queue record, and the `land` command with no daemon write no entry.

A write follows the event record: an exclusive lock on `events.lock` with a 2-second bound, one whole
line with one write, the end of a partial last line with `\n` first, and a rotation to
`events.1.jsonl` when `events.jsonl` is larger than 5 MiB. The event record and this log share this
code (`engine/lib/state/lines.ts`). A whole line is 16 KiB at most. When a line is too long, the writer
cuts `data.reason` first, then the last items of `data.numbers`. It keeps valid UTF-8 and valid
JSON, and it lists each cut field in `truncated`. The log is about 10 MiB at most, so the oldest
entries leave the log with the rotation. The write is synchronous: while a reader holds the shared
lock, a write waits up to 2 seconds, and the daemon process waits with it.

An entry is one JSON object on one line, ended by `\n`, in UTF-8:

| Field | Value |
| --- | --- |
| `schema` | `1` |
| `id` | `<time>-<pid>-<8 hex>`. It is unique. `--after` uses it |
| `time` | ISO 8601 UTC with milliseconds |
| `seq` | An integer that starts at 1 at each daemon start and grows by 1 for each entry that the daemon tries to write. A gap means a lost write |
| `daemon` | `{pid, revision}`: the PID of the daemon, and the full revision of its engine |
| `type` | The name of the transition, one of the table below |
| `run` | The run ID, or `null` for an entry outside a run |
| `issue` | The current issue key of the run as a string (`"12"`), the key of a landing, or `null` for an entry of no issue |
| `data` | The fields of the `type` |
| `truncated` | The names of the cut fields. It is absent when no field was cut |

The entry holds no environment value, no `argv`, and no `cwd`.

The types, in the order of the table:

| `type` | Written when | `data` |
| --- | --- | --- |
| `daemon.started` | The daemon took the lock `daemon` | `{successor}`: `true` when the daemon follows a restart |
| `daemon.ended` | The stop of the daemon completes, also after SIGINT, SIGTERM, or SIGHUP, before the release of `daemon` | `{code, restart}`: the exit code, and `true` when the stop holds the claim of a successor ("The restart"). The spawn of that successor can still fail |
| `auto.status` | The `auto` value of `daemon status` changes | `{from, to, code}`: two of `off`, `on`, and `stopping`; `code` is the exit code of the loop for a change to `off`, else `null` |
| `run.started` | `begin()` of `engine/lib/run/engine.ts` makes a run: a new run, also one that the admission then refuses, or a takeover | `{kind, numbers, adopted}`: the `kind` of the request, the queue keys when they are known (else `null`), and `true` for a takeover |
| `run.transition` | The driver of the run sets the state of its machine, also to the same state, after the effects of the entry ran | `{from, event, to}`, and `dropped` when the entry or an effect threw |
| `run.status` | The status label of the run changes to another value | `{from, to}`: two values of the `state` field of the status row |
| `step.started` | A session becomes live: the machine goes from `opening` to `live`, for a step session and for an unwatched session (`run resume`, `run assist`) | `{step, host, tab, attempt}`: the work of the session, the host, the tab name, and the attempt ID or `null` |
| `step.ended` | The machine leaves `live` for another state | `{step, host, event, code}`: the event that ended the session, and the exit code of the host when it is known, else `null` |
| `run.ended` | The run reaches `finished` | `{end, code, reason}`: `closed`, `gate`, `stopped`, or `detached`, or `failed` for an unexpected error |
| `landing.waits` | A landing of the daemon waits behind another landing | `{ahead}`: the issue key of that landing |
| `landing.started` | A landing of the daemon runs | `{}` |
| `landing.ended` | A landing of the daemon ends, also one that never ran | `{code}`: the exit code of the landing |

The log has two state axes, and each has one writer site:

- **The machine state** (17 states, "The master daemon", "The run machine") comes only from the driver loop of `begin()`. That loop is the only code that sets the state of a
  run, so each transition of each run is in the log. This is the view of what happens underneath.
- **The status label** (the `state` field of the status row, "The status object") comes only from `mark` of
  `engine/lib/run/activities.ts`. Its ten values are the stable view.

`step.started` and `step.ended` come from the machine transition. The function `transitionNotes` of
`engine/lib/run/lifecycle.ts` maps one transition to its entries. A run that a takeover adopts gives
no `step.started` for its live session in the log of the new daemon. The daemon before wrote it.
A refused admission gives `run.started`, its transitions, and `run.ended`, so each run that `begin()`
makes is in the log. A detached run at a daemon stop gives `run.ended` with `end` `detached`, and the
successor continues the same run ID with `run.started` with `adopted` `true`. A detach does not end
the live session, so a detached live session gives no `step.ended`, also when the run passes `closing`
on its way to `ending`.

**The order.** The file order is the write order, because each write holds the exclusive lock. One
daemon writes from one thread, so the entries of a run are in the order of its transitions, and the
entries of two runs interleave in the order that they happened. The driver writes `run.transition`
after the effects of the entry ran. A `mark` in an activity or in an effect writes its `run.status`
at once, so a `run.status` entry can come before the `run.transition` of the same cycle. When the
entry or an effect threw, the driver runs the entry for `failed` and writes one `run.transition` with
`event` `failed` and `dropped`, the kind of the event whose entry did not complete. The state that
the first entry returned is not in the log, because the driver never set it.

`seq` orders the entries of one daemon. A new `daemon.started` with another PID starts a new
sequence. A daemon that a `SIGKILL` or a crash ends writes no `daemon.ended`: a reader sees that end
as a `daemon.started` of another PID with no `daemon.ended` before it. A gap in `seq` marks an entry
whose write failed.

**A failed write.** A write that fails changes no run, no landing, no exit code, and no answer of the
daemon. The daemon prints `daemon: cannot record the lifecycle event: <reason>`
for the first failure of each reason, and prints a reason again only after a later write succeeded.
The line goes to the daemon log with the tag `daemon`. It is outside the frame of the run that wrote
the entry, so it is never the last line of a run in `daemon status` and never the `message` of a
`run-exit` entry. A reason is, for example, a lock that is busy after 2 seconds, or a folder or a
file that is not private.

**The reader.** `celetis --agent <host> daemon events [--after <id>]` reads the log of the repository
of its checkout, with no request to the daemon. It follows `celetis events`:

- It takes a shared lock with the same 2-second bound.
- It reads `events.1.jsonl` and then `events.jsonl`, and prints each entry as one JSON line on
  stdout, oldest first.
- The files are input that the command does not trust. It prints a line only after it parsed the
  line as a JSON object with a string `id`. It skips the incomplete last line of a file. A line that
  is not a valid entry gives one stderr line with the file name and the line number, and the read
  continues.
- It follows no link and reads only a regular file that is private to the current user (mode
  0600). A link, a FIFO, another file type, or a file that is not private is an unsafe file: it
  prints one `state:` line, reads no byte of that file, and exits 6. On Windows, the read follows a
  link, and the mode rule does not apply.
- With `--after <id>`, it prints the entries after the last entry with that `id`. When no kept entry
  has the `id`, it prints one stderr line and then all entries, so a reader that fell behind the
  rotation gets each kept entry.
- With no folder, or with no log file, it prints nothing and exits 0.

The read writes no entry. It makes the lock file `events.lock` only when a log file exists and the
lock file does not. The row of `daemon` in [The commands](../plugins/celetis/README.md#the-commands)
gives the exit codes.

Three facts bound a reader:

- A `run.transition` uses the names of the machine of the engine revision in `daemon.revision`. A
  later engine can rename a state, so a tool that keys on a name must read the revision.
- `numbers` of `run.started` is `null` for each run today.
- The log keeps about 10 MiB of entries. A daemon that runs long loses its oldest entries.

## Limits

- A session that waits holds its run. Each Run press and each start with a number is its own run
  in the daemon, so another issue can run beside it.
- The daemon sees only its own locks. While a run works on an issue, start each step of that
  issue through the script or the board, not by hand in a session of your own.
- The board has no control for auto mode
  ([Start the script](../plugins/celetis/docs/workflow.md#start-the-script)). With `triage` as `auto`, and
  with no `autoLanes` or with `triage` in that list, it
  classifies each new issue, and a splitter question of `/celetis:triage` holds it until you answer.
  With `specify` as `auto`, and with no `autoLanes` or with `feature` in that list, it opens a design
  session for the lowest feature with no spec, and that
  session holds it until the spec is on the issue or you leave the session.
- [A stop of a run](#a-stop-of-a-run) gives how the runs stop. The lock stays while either the daemon or its session is
  live. After both exit, a new run can claim the stale lock; the session record stays.
- Auto mode that runs long opens one tab for each session. A normal end closes its tab. Each tab
  of a failed end, and each tab whose daemon stopped, stays open until you close it.
- A session gets the login environment of its tab, not the environment of the daemon, so a
  variable that you export only in the shell of the command, or of the daemon, does not reach the
  session. When `CLAUDE_CONFIG_DIR` or `CODEX_HOME` of the daemon differs from that of the session,
  the daemon looks for the saved turn in the wrong place: it warns after 60 seconds, and the
  session does not end by itself.
- For a command in another terminal program, whether `herdr-app do pane.focus` brings the
  window of the Herdr app to the front is not checked.
- The Herdr app closes a space when its last tab closes (#232). The next session tab then makes the
  space again in the background, at the end of the space list. A normal end closes its tab late
  ([The session tab](#the-session-tab)), so the space of the repository and its place in the space
  list stay from one session to the next. Auto
  mode that waits for work keeps the tab of its last normal end open until it starts
  the next session or stops.
- The script does not end the step of a session outside herdr-core, for example in a Code tab of
  the desktop app or in another terminal program. The [Limits](board/README.md#limits) of the board give its card.
- The script ends a step only from the status that the host reports with OSC 7501. A host that
  reports no status, for example Claude Code before 2.1.295, gets no step end and no card: leave
  its session with `/exit`.
- The script finds the thread of a Codex step by the exact prompt of the step in `preview` of
  `thread/list` ([Sessions](#sessions)). When a Codex release changes `preview`, no thread matches:
  the script warns after 60 seconds, and the session does not end by itself. When a person starts
  the same prompt in the main checkout at the same moment, two threads match, and the job ends with
  the startup error that no single session identity can be saved.
- Claude receives `/exit` through its composer, so text that a person types at the same moment
  can join that command ([The step end](../plugins/celetis/docs/workflow.md#the-step-end)).
- The `hc` and `herdr-app` calls of the script use the API of herdr-core 0.1.19 and the commands of
  the Herdr app 0.1.15. Both are previews (version 0.x), so a later 0.x release can break the step
  end. Two
  parts of the step end are not checked: the end of a session after its
  `celetis --agent <host> land` run ends (ADR-0008), and the end of a session after it adds
  `ready-for-human` at a stop (ADR-0011).
- The daemon keeps the version folder of the engine that started it for the resolver and entry
  of its runs, and a later update can remove that folder
  ([Updates](../plugins/celetis/README.md#updates)). The daemon then stops with the true cause
  ("A removed engine version" of [The master daemon](#the-master-daemon)). The cure is to restart
  the daemon from the installed engine, then to send the request again (ADR-0012). The board stops
  with its daemon.
- The output of the master daemon grows with each run. The daemon does not rotate or trim it.
- A host can run a session on another model or at another level than the pair, and the daemon
  does not see it. In Claude Code, `/model` in the session changes the model, and an
  `availableModels` list that blocks the model of the pair starts the session on the default
  model. A resume on Amazon Bedrock, Google Cloud's Agent Platform, or Microsoft Foundry does not
  restore the model of the transcript, and no resume does when `ANTHROPIC_MODEL` is set in the
  environment of the daemon. The daemon removes only the process variable
  `CLAUDE_CODE_EFFORT_LEVEL`. It does not read or change a `CLAUDE_CODE_EFFORT_LEVEL` in the `env`
  block of a Claude Code settings file, which outranks `--effort`, or `maxEffortLevel` and an
  organization cap, which run a higher level at the cap. Claude Code runs a level that the model
  does not support at the highest supported level below it. The start line names the model, the
  level, and their sources; on Codex it also names the configured model and the applied level.
