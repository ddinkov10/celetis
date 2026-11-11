# The engine

`engine/` is the Celetis engine: the master daemon of a repository, its runs,
the session tabs that the runs open and end, and the records that they keep. This document holds
the rules of the engine. [The workflow](../plugins/celetis/docs/workflow.md) holds what a person
does and what a session sees, and [the board document](board/README.md) holds the board.

## Requirements

[Requirements](../plugins/celetis/README.md#requirements) of the plugin names the platforms, the
tools, and their versions. The engine adds these rules:

- `celetis daemon start` checks `hc`, its server, `herdr-app`, and the window of the Herdr app
  before it spawns the daemon; the row of `daemon` in
  [The commands](../plugins/celetis/README.md#the-commands) gives its exit codes. The daemon checks them again before each run reads its issue (a
  number, auto mode, a queue wake, and `run resume`). A failed check there is the refusal of the
  request, with the same code and a line that names the missing part and how to start it; for a
  queue wake, the line becomes the queue error.
- Complete the normal folder trust of the host before a run. The daemon never answers that prompt.

## The start of a step

A run uses the environment of the daemon ([The master daemon](#the-master-daemon)). Only these
values of the command travel in its request: `--agent` and `CELETIS_AGENT` as the host selection,
`--effort`, and `--model`. Each other variable of the shell of the command, for example `PATH`,
`CLAUDE_CONFIG_DIR`, or `CODEX_HOME`, does not reach the run.

Intake, Assist, and Make visual share the independent-session launcher. Default launches read
the current order and per-host usage records from the Git common directory. They select the
first included host with no confirmed active block. Explicit choices keep their exact host.
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

**The answer.** Each form that starts work (`run <n>`, `run resume`, `run retry`, and a `queue action`
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
decision of the issue from the in-process resolver (`nextIssue` of `engine/lib/resolver.ts`), a Run of a step or a stop, and starts the step
of a Run, whatever its gate. When the session ends, it reads the decision again and starts each
next step whose gate is `auto`. It ends the issue at the first of these, in this order: a stop,
the same step again ("no progress"), a refused skip, or a `manual` gate. With the default gates, each
next step is a `manual` step.

**The model and the effort level.** The daemon resolves one start pair, a model and an effort
level, for each session that it starts (`startPair` of `engine/lib/effort.ts`). Each value is the
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
the first or the second step of the lane. `triage` can always start. So `specify` → `plan`,
`bug` → `plan`, `bug` → `implement`, `plan` → `implement`, `specify` → `bug` after a relabel, and
`implement` → `plan` can start, and `triage` → `plan`, `specify` → `implement`, and
`triage` → `implement` cannot.
At a refusal the run prints the skip line, which names T, the skipped steps, and S
([What the script prints, and your act](../plugins/celetis/docs/workflow.md#what-the-script-prints-and-your-act)).
It adds the row `<n>\t<run line of T>` to the record and ends the issue. The skip check comes before the gate check, so a refused step with a
`manual` gate also gets a row. The first step of a start with one number, and the first step that
auto mode takes, have no skip check. So your start with the number is the override: it
starts T.

**Auto mode** of the daemon reads the decision of each open issue from the same resolver (`nextOpen`)
and takes the lowest open issue whose decision is a Run,
whose step has the gate `auto`, whose lane is in `autoLanes` of the main `.celetis.yaml`,
whose step has no row in the record, and
whose lock is free. A Run with no lane, the `triage` step of an issue with no lane label, counts as
the name `triage` of the list. With no `autoLanes`, each lane and each issue with no lane passes
this lane test. It does the same work on that issue, but it starts no `manual` step, and then it
asks again. It does not take a step that the script refused as a skip, because that step has a row
in the record. When no issue can start, when the issue started no session, or when the resolver cannot
read GitHub, it waits 60 seconds. It prints one line for the whole wait. While it waits,
`celetis --agent <host> next-step --open` shows the line of each open issue: a `stop` line gives the
cause, and a `run` line that does not start has a `manual` gate, a lane outside `autoLanes`, a row
in the record, or the lock of another run. It reads open issues only.
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
No other run has a lane test: a start with a number, a Run press, a queue run, and `run resume`
work in each lane, and `run retry` only wakes the quota wait of a run. The engine reads `autoLanes`
from the main checkout at each pick of auto mode and before each step of its run. So an edit of the
list applies with no restart of the daemon and no new auto on, and a session that runs keeps
running. An invalid list is an invalid configuration: it refuses the next operation of auto mode,
and that refusal ends auto mode, as each other invalid field does.

**The form `run resume <n>`** asks the daemon to reopen the exact session of the record
`<git common dir>/celetis/sessions/<n>.json`, with its saved host and checkout, in a new tab that
opens in the background ([Sessions](#sessions)). A Resume press of the board types this form.

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
session ([A landing](../plugins/celetis/docs/workflow.md#a-landing)). The `no-progress` file in `<git common dir>/celetis/` has one row for each step that ended with no progress, and one row for
each step that the script refused as a skip. Auto mode and the board read it. An
explicit issue start can start that step. `engine/lib/locks.ts` of the engine owns the lock refs,
the owner records, the liveness check of an owner, and the record; the daemon and the board use it.

**The arguments of a session.** `stepArguments` of the adapter of each host builds the arguments
of a step session from the start pair: [Claude Code](../docs/hosts/claude-code.md#the-daemon) and
[Codex](../docs/hosts/codex.md#the-daemon-and-developer_instructions) give them, with the Codex
prompt. Claude Code gets `--model <model>` and `--effort <level>` of the pair. Codex keeps the model
of its config and gets only a level: a level with the source `pinned` or `override` as it is, else
the level raised by the tier of the model of the pair (`tierRaise` of `engine/lib/host-codex.ts`):
0 levels for `haiku` and `sonnet`, 1 for `opus`, and 2 for `fable`, at most `max`. Then the
supported levels of the Codex model apply. A failed model read of Codex starts no session and
writes no session record. No document content is evaluated as shell code. After it builds the
arguments, the daemon prints the start line
`start: <prompt> on <model> (<source>) at <level> (<source>)`, with the source of each value of the
pair. On Codex the line ends with `; codex keeps its configured model <codex model> and applies <applied level>`.

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

Every action has `expected: {id, revision, current}`, where current is the first issue number.
Only a missing record accepts null ID, revision 0, and null current. Add has kind, number, and
step; move has kind, number, and direction up/down; remove has kind and number; continue and
retry have kind and step. Retry alone permits a null step. Extra fields, unsafe integers,
duplicates, stale identity/revision/current, current-row edits, and a conflicting agent choice refuse.

Schema 3 is at `<git common dir>/celetis/queue.json`. It has an ID and increasing
revision, ordered unique numbers, the fixed agent choice (`default`, or `explicit` with its host),
the active host, current and last Runs, reason/action, a wait ID, and a nullable launch token with
issue-bound one-step authorization. Its states are empty, starting, running, quota-wait, me-gate,
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

The existing launch loop retains startup barriers, saved-session checks, skip/no-progress checks,
and foreground cleanup. A live foreground retains ownership when its daemon dies. A save failure
prevents further starts. An unowned pending or running record permits deliberate Try again;
it never silently starts again. A question remains a live session; use Go to answer it.

Only fresh resolver results of finished or wontfix remove work. A full board read, or a selected
read of a queued issue, resolves waiting members, including issues absent from the open list.
Unreadable members stay queued with an error. A current issue cannot drain while its run or foreground owns it.
When an unowned stopped current closes, reconciliation advances with normal gates or leaves
empty. An Add after the final drain starts more work without reload or reset.

**Automatic storage preparation.** Ordinary queue readers and writers convert valid schema 1
and schema 2 to schema 3. Schema 2 retains ordered numbers, state, current/last Runs,
reason/action, and pending launch token and authorization. Schema 1 keeps only
`numbers.slice(position)` as unfinished work; its completed prefix and results stay in the
backup. Complete becomes empty. Nonempty work pins its recorded host as an explicit choice.
Active host and wait ID become null; schema 1 has no launch. The revision advances once.
A valid current record or absent record causes no conversion or archive.

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
(`engine/lib/run-engine.ts`), runs each landing of `celetis --agent <host> land` in the daemon
process, one at a time ([A landing](../plugins/celetis/docs/workflow.md#a-landing)), and serves requests over HTTP on a Unix socket
([ADR-0072](https://github.com/ddinkov10/celetis/blob/main/docs/adr/0072-one-master-daemon-runs-every-issue-run.md)). Its process is
`engine/daemon.ts --daemon` (a successor adds `--after <pid> <start>`, "The restart"), so the
lock, step-end, and recovery checks accept it as the daemon. Nothing starts a daemon by itself. The daemon also serves the board on a loopback port
([The board](board/README.md#start)). The `run`, `queue`, and `land` commands send their requests to it, and the board presses
go to it in its process ([The start of a step](#the-start-of-a-step), "The answer"). The shared locks keep one owner
for each issue, for the queue, and for auto mode across the daemon and a second daemon.

**The commands.** `celetis daemon start`, `status`, `stop`, and `auto on|off` (`engine/daemon.ts`) find the Git
common folder of the current folder, so a linked worktree reaches the daemon of its repository.
The row of `daemon` in [The commands](../plugins/celetis/README.md#the-commands) gives the output
and the exit codes of each form.

- `start` replaces no running daemon, and it reads no status of a daemon of another revision.
  Else it spawns `engine/daemon.ts --daemon` in the main checkout. The spawn is detached, with
  stdin closed and stdout and stderr appended to `daemon/daemon.log` (0600). It polls the status
  for at most 30 seconds. Another daemon that wins a race is printed as a running daemon.
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

1. refuses Windows with exit 3;
2. finds the main checkout and the Git common folder of its working folder;
3. makes the socket path `/tmp/celetis-<uid>/daemon/<first 16 hex digits of the SHA-256 of the
   Git common folder>.sock`. A path of 104 bytes or more stops the start with exit 3, before any
   folder or lock;
4. makes `<git common dir>/celetis/daemon/` and its `runs/` folder (0700), and the socket
   folder `/tmp/celetis-<uid>/daemon/` (0700);
5. reads its process start, then takes the lock ref `daemon` with that start. A failed read of the
   start stops the daemon before the lock with exit 6. When another live process holds `daemon`,
   the daemon names its PID and exits 3;
6. reads `board.port` of the main `.celetis.yaml` with the full validation of the config, default
   4403. A file with an error prints the diagnostic of the config reader and exits with its code;
7. opens the board ([Start](board/README.md#start) of the board document gives its lines). A
   nonzero `Number(PORT)` of its environment is an exact port; else the board takes the first free
   port from `board.port` through 65535. A port that cannot open releases `daemon` and exits 6,
   before any takeover;
8. reads the run records and makes one adoption attempt for each record ("The takeover"), then
   reads the coordinator record ([The coordinator session](#the-coordinator-session));
9. removes a socket file that a killed daemon left;
10. serves on the socket;
11. writes the identity file `daemon/daemon.json` (0600, a temporary file and a rename):
    `{schema: 1, pid, start, revision, main, common, socket}`, where `start` is the process start
    time and `revision` is the Git revision of the engine;
12. prints its PID and its socket.

A successor ("The restart") first waits for the old daemon to end, then starts in this order. Its
board tries the port of `PORT` first and searches from `board.port` when that port is in use. After
step 12, it turns auto mode on when the old daemon carried it.

From the open of the board to the end of the takeover, the board serves the page and its reads,
but the daemon refuses each request of the board (Run, Resume, Retry, a queue action, a queue
reconcile) with 503 and code 3. So no press takes an issue lock before the adoption of its old run.

The socket folder is private to the user, and the daemon uses no token: any process of the same
user can send a request. Auto mode is off at each start, also after a crash. Only a successor
turns it on again, with the selection of the old loop ("The restart").

**The requests.** The board gives its requests to the same dispatcher in the daemon process, with
no socket and no HTTP request to itself: the same parser and the same answers. An error that the
dispatcher throws is the 500 answer below. A body is JSON of at most 16 KiB, with exactly these keys:

| Request | Body | Effect |
| --- | --- | --- |
| `GET /status` | none | The status object |
| `POST /run` | `{number, selection, effort, model}` | A start with one number; `effort` is a level or `null`, and `model` is a model or `null` |
| `POST /auto` | `{on, selection}` | Auto mode on or off |
| `POST /queue` | `{id, token, selection}` | The claim and the run of a queue wake that a `queue action` issued |
| `POST /resume` | `{number, selection}` | `run resume <number>` |
| `POST /retry` | `{number, waitId}` | The wake of the live quota wait, as `run retry <number> <waitId>` |
| `POST /stop` | `{}` | The stop of the daemon |
| `POST /queue/action` | `{action, selection}` | A queue action, as `queue action '<QueueAction JSON>'`; `action` is that JSON |
| `POST /queue/reconcile` | `{}` | The queue reconcile of a board read |
| `POST /land` | `{number, subject, selection, from}` | A landing, as `celetis --agent <host> land <number> '<subject>'` from the folder `from`; the answer is a stream (below) |
| `POST /coordinator/open` | `{selection}` | The open of the coordinator session, as `celetis coordinator`; the answer is `{accepted: true, opened}` ([The coordinator session](#the-coordinator-session)) |
| `POST /coordinator/read` | `{number}` | The screen read, as `celetis coordinator read <number>`; the answer is `{accepted: true, text, complete, why}` ([The coordinator session](#the-coordinator-session)) |
| `POST /coordinator/send` | `{number, authority, text, token}` | The send, as `celetis coordinator send <number> <file> --as <authority>`; `authority` is `maintainer` or `coordinator`, `text` is a string, and `token` is a UUID; the answer is `{accepted: true, run: null}` ([The coordinator session](#the-coordinator-session)) |

`selection` is `{explicit?, environment?}`: an explicit host (`claude` or `codex`), the
`CELETIS_AGENT` value of the client, or neither. Each run and each landing selects its host from its own request,
as `celetis --agent <host> run` does from its prefix and its environment. The
`CELETIS_AGENT` of the daemon never selects a host. A queue wake keeps the recorded agent choice of
the queue. A queue action uses the choice rules of `queue action`: an Add
uses the request selection; each other action of a queue with a recorded choice refuses another
named host with code 2, and uses the recorded choice. A reconcile uses the recorded choice.

A `/land` body has a positive safe integer `number`, a `subject` that `land` accepts (a
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
`null` for `/auto`, `/retry`, and `/stop`. A queue action and a reconcile answer
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
| 503 | A request that arrives during a stop (except `POST /stop` during a restart, "The restart"), and the answer of a run, queue, resume, or auto on request, or of a queue action or reconcile with a wake, that comes after a stop began, code 3. A status read that began before the stop answers 200. A run, resume, retry, queue action, or reconcile request of the board before the end of the takeover, code 3 |
| 500 | An unexpected error of the daemon while it answers: its message, code 1 |

A run, queue, or resume request answers after every check before the first session of its run:
the issue lock, the host selection, the setup checks of `gh` (not for a resume), `hc`, and the
Herdr app, a stale launch token, the first decision read for a run and a queue, and the saved
session for a resume. The answer comes directly before the session tab opens, or at a quota
wait. An end at the first decision is a refusal with the line and the code of that end, for
example code 0 for a finished issue. The code of the answer is not the code of the
run outcome: a busy issue lock (code 3) and a failed GitHub read of the issue (code 6) end the run
with the outcome code 0, as each other end before a session, so auto mode takes the next issue and
the daemon writes no `run-exit` event. When a stop begins before the answer,
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

**The status object.** `{schema: 1, daemon, board, auto, runs, landings, coordinator}`. `daemon` is the identity file.
`board` is the URL of the board, `http://127.0.0.1:<port>`. `auto` is `on`, `off`, or
`stopping`. `coordinator` is `true` while the daemon holds a coordinator record
([The coordinator session](#the-coordinator-session)). Each run has one row, in start order:

| Field | Value |
| --- | --- |
| `id` | The run ID |
| `kind` | `number`, `auto`, `queue`, or `resume` |
| `issue`, `numbers` | The current issue; the issue numbers of a queue run, else `null` |
| `step`, `host`, `tab` | The step, the host, and the tab name of the current session, else `null` |
| `state` | `starting`, `running`, `checking`, `waiting`, `exiting`, `quota-wait`, `ending`, `taken-over`, or `finished` |
| `line` | The last daemon line of the run, else `null` |
| `changedMs` | The time of the last change of `state`, in milliseconds since 1970 UTC |
| `session` | `runs`, `gone`, or `unknown`: a process read of the start barrier of the current session at this status read, else `null` |
| `attention` | `{state, kind, changedMs}` while the run needs a decision, else `null`: `state` is `dialog`, `turn-ended`, or `quota-wait`; `kind` is `permission`, `question`, or `auth` for a `dialog` that the host named, else `null`; `changedMs` is the time that the pair entered its state ([The coordinator session](#the-coordinator-session)) |
| `outcome` | `{kind, reason, code}` of a finished run (`closed`, `gate`, or `stopped`), else `null` |

A finished run stays in the status, with its outcome, until the daemon stops. A refused run
request is a finished run too. A text field has at most 4096 characters.

`landings` has one row `{issue, state, changedMs}` for each landing in the line, in the order of
the requests: `state` is `runs` for the landing at the head and `waits` for each other one, and
`changedMs` is the time that the landing entered its state, in milliseconds since 1970 UTC. A
landing leaves the list when it ends. `celetis daemon status` prints one line for each row, with
the issue, the state, and the time, after the run lines.

**The output.** Each line that the daemon writes to its stdout or stderr starts with
`<ISO time> <tag> `. The tag is the first 8 characters of the run ID for a line of a run,
`land-<n>` for a line of the landing of #<n>, else
`daemon`, also for the lines of the board. A line of a run is a daemon line, apart from the lines that keep their own prefix. The daemon writes
nothing else to a file; the process that starts the daemon decides where its stdout and stderr go. A run that ends
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
listener. Then it closes the socket (the socket file goes), removes the identity file, and
releases `daemon`. A board request that runs longer than its 5 seconds loses its connection at the
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
finished tab that waits for its close), a quota wait, and the current session. The session facts
are its step, host, Run, session record, usage attempt, start folder, terminal, and tab, the start
barrier (PID, start, the PID of its parent shell, and its terminal name), and the start time of the
step. The daemon writes the record at the admission, before and after it opens a session tab,
after the start barrier reports and before its release, after each session end, at a quota wait
and its wake, at the claim of a queue wake, and after each drain of a queue issue. A run that ends
removes its record. A detached run
keeps it, except a run whose answer was 503. The `go` file of the start folder, not the record,
tells whether the barrier was released. The record has `schema: 3`, with its paths under
`<git common dir>/celetis/`; a schema-1 or a schema-2 record converts as
[The move of the old names](#the-move-of-the-old-names) says.

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

A resume run has the same phases with no step-end watch. The finished tab of a record closes by the
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

**A quota recovery.** The recovery record has `schema: 2` with the key `daemon`; a schema-1 record
converts as [The move of the old names](#the-move-of-the-old-names) says. When the recovery record of the
issue names a daemon that is gone (a definite read), the daemon writes itself as the owner of the record in one
transaction. Retry and the bound lane of the
recovery then accept the daemon. A `POST /retry` for a record that names this daemon needs a run of
this daemon for that issue whose state is not `ending` or `finished`; else it gets code 3, and
the line asks for a new start of the run. So a second
Retry of a wait that woke gets the answer of the first. An unknown read keeps the record and reads
again each 2 seconds. A quota wait continues with its recorded wait ID, step authority, agent
choice, and the usage records that it saw. The daemon prints the wait line again and makes no new
wait ID, so `run retry <n> <wait id>` of that wait wakes it. A wait whose ID the recovery record no
longer has ends its run.

**Per-run failures.** A refusal line, a startup error, a failed queue save, a failed write of the
run record, and an unexpected error end only their run. Its outcome is `stopped` with the line and the code. An unexpected error
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

### The move of the old names

A repository that an earlier engine used holds its state under the old names. The first access to
the state folder moves it (`repositoryState` of `engine/lib/state.ts` calls `moveState` of
`engine/lib/state-move.ts` once in each process for each Git common folder), so each command and
the daemon do it with no step of yours:

| Old | New |
| --- | --- |
| `<git common dir>/celetis-flow/` | `<git common dir>/celetis/` |
| `refs/celetis-flow/locks/<name>` | `refs/celetis/locks/<name>`; the move deletes the old refs and moves no owner |
| the key `runner` of an owner record, and the lock `runner` | the key `daemon`, and the lock `auto` |
| `<git dir>/celetis-flow-setup-done` | `<git dir>/celetis-setup-done` |
| `.claude/celetis-flow/wiring.json` | `.claude/celetis/wiring.json` |

The move runs at most three rounds. Each round:

1. lists the refs under `refs/celetis-flow/locks/` and looks at `<git common dir>/celetis-flow`.
   With no ref and no folder, the move ends. An old path that is not a folder is a refusal;
2. proves each owner of a listed ref by PID and process start, for the keys `runner` and `session`
   of its owner record. A live owner, an owner that the process table does not show, and a record
   that cannot be read are a refusal. Each process gives one line, and the lines come together;
3. checks whether `celetis` exists while `celetis-flow` exists. If both exist, the round refuses
   before it deletes any ref (if `celetis-flow` went away meanwhile, the next round starts). It
   then lists the refs again; a changed list starts the next round;
4. deletes the listed refs in one transaction, each with the object ID that it read; a failed
   transaction starts the next round. It lists the refs again before the rename and before the
   return that has refs only; a ref that remains starts the next round. It then renames the folder
   to `celetis`.

A refusal line names the state of the move. It exits 3, or 6 when a file or a Git read or write failed. A refusal before step 4 of the first round changes nothing. A later round, a failed rename of the folder
(an error other than a missing source or an existing target), and the refusal of a state that
still changed after the third round can follow a deletion in step 4 of an
earlier round of the same command: that deletion removed only old lock refs whose owners were
proven gone, and it stays; the folder did not move. Each refusal line names its cause and your act:
end the old daemon, let an old session finish or end it in its tab, keep one of the two folders by
hand, remove an old path that is not a folder, or run the command again.

The owner proof has a named blind spot: an old process with no lock ref, such as an old board or an
old `celetis assist`, `intake`, or `visual` session. It can make `celetis-flow` again after the
move. The safe result is the both-exist refusal of a later access, with no merge. The daemon moves
once, when it starts; a later old process is seen by the next process that reads the state.

The records convert when a process reads them and keep the exact original bytes in an immutable
sibling archive (ADR-0070). The recovery record converts under its record lock. The run records
convert when the daemon starts, after it holds the lock `daemon` and before it serves; they have
no record lock. An invalid record is refused with its path and its cause; it is never read as
empty:

- The recovery record: schema 1 with the key `runner` becomes schema 2 with the key `daemon`.
- The run record: schema 1 and schema 2 become schema 3, with `model: null` in a `number` input. A
  `number`, `auto`, or `queue` input with `quiet` is not valid, so its record does not convert. For
  schema 1, the paths `session.folder` and `session.capture` under the old folder move to
  `celetis/`. A path outside the old and the new folder is a refusal, and the daemon takes over no
  run from that record ("The takeover").
- The step-end record has the key `daemon` only. A record with the key `runner` reads as no
  record, and nothing converts it.
- The queue record and the session record keep their schemas
  ([The continuous queue](#the-continuous-queue), "Automatic storage preparation", and
  [Sessions](#sessions)).
- A hook settings file `usage-captures/<id>/settings.json` that an old engine wrote keeps its old
  absolute hook path. Claude Code reads it only when its session starts, and a new session gets a
  new folder.

Setup moves the setup record at its next run: `setup status` reports the old record, and with both
records present, setup refuses and asks you to remove the one that is not current. The first read of the marker of a worktree renames
`celetis-flow-setup-done` to `celetis-setup-done`, or removes the old marker when the new one
exists. A later `chore` issue removes the move.

## The engine and the plugin

The daemon uses the version folder of the engine that started it
for the resolver and entry of each run. Numbered starts, auto-mode starts, and later steps make no update call.
The form `run resume` keeps its no-update behavior and saved identity.
Before a step starts, the daemon checks that the entry of its version folder, `engine/celetis`, is still a file.
[Updates](../plugins/celetis/README.md#updates) gives the contract check of the plugin before each
new step session (`requireContract` of `engine/lib/contract-check.ts`): the engine must serve the
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

## The session tab

For each session, also an exact resume, the daemon opens a new hc terminal
with a tab in the space of the repository in the Herdr app (`openTab` of
`engine/lib/terminal.ts`): `hc run --bg --no-parent --no-notify` in the main checkout, with the
labels `herdr.space=<id>` and `celetis.link=#<n> <step>`, and the tab name `#<n> <step>`
(`herdr-app do tab.rename`). The space is the space with the name of the folder of the main
checkout. When that space is missing, the terminal gets a new id in `herdr.space`, the Herdr app
makes the space in the background, and the daemon names it with `herdr-app do space.rename`. The
file lock `<git common dir>/celetis/space.lock` lets one process at a time find or make the space.
For a new space, that process holds the lock until the space has its name or the poll of
`herdr-app ls` stops. The poll stops after 10 seconds when the space does not show in it.
The tab runs the start barrier, the internal form
`daemon --session-start <folder> <daemon PID> <host> <attempt ID or -> <recovery or ->
<arguments>` through the engine entry `engine/celetis` of the engine of the daemon, through a login
shell of `$SHELL` (`"$@"; exec "$0" -li`), so the tab keeps a shell after the barrier exits. The
entry replaces its process with `daemon.ts --session-start …` under the same PID, and the barrier
record and the board read that process after the replace: with the job control of the login
shell, the barrier leads the foreground process group of the tab. `<folder>` is a private start
folder in `<git common dir>/celetis/`:

1. The barrier writes `pid` there: its PID and its process start. The daemon accepts that record
   only when that process runs, has that start, and runs `daemon.ts`.
2. The daemon registers that PID in the issue lock. For a step, it also publishes the step-end
   record and starts the job of the step end. It then writes `go`: this is the release of the
   barrier.
3. The barrier waits for `go` while the daemon lives. A failed read of the daemon process does not
   end this wait; the barrier exits with status 3 before `go` only when the daemon process does
   not exist. After `go`, the barrier starts the host as its child, waits
   for the host to exit, writes the exit status of the host to `status`, and exits with that
   status.

The exit of the barrier is the one sign that the session ended. A missing or invalid `status`,
for example after a person closed the tab, is an unknown status, and it counts as a failure:
before issue progress, the daemon stops with the recovery line and `status unknown`.

The session gets the login environment of its tab, not the environment of the daemon. The barrier
sets `CELETIS_SESSION_AGENT` to the host and `CELETIS_ATTEMPT` to the attempt ID of a step, removes `CLAUDE_CODE_EFFORT_LEVEL` for Claude, and sets
`CODEX_HOME` to the resolved native home for Codex. hc gives the terminal of the tab its own
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
warns once after 60 seconds and waits on. The lines of a tab that ends early and of the warning
ask you to check the login files of `$SHELL` in that tab. No command prints these lines: they
show as the `line` of the row of `celetis daemon status` and in `daemon/daemon.log`.

## The coordinator session

The coordinator session is one interactive session of a host with the skill `coordinate`, in a
tab that the daemon opens. It is no run: it has no issue, no issue lock, no step-end watch, and no
resume by the daemon. You end it in its tab.

**The forms.** `celetis coordinator` (`engine/coordinator.ts`) sends `POST /coordinator/open` with
the selection of `--agent` and `CELETIS_AGENT`, as `run` does, and waits at most 120 seconds.
`celetis coordinator status` reads `GET /status` and prints the status object as one JSON line.
`celetis coordinator read <n>` sends `POST /coordinator/read` ("The screen read"), and
`celetis coordinator send <n> <file> --as maintainer|coordinator` sends `POST /coordinator/send`
("The send"). The row of `coordinator` in [The commands](../plugins/celetis/README.md#the-commands)
gives the lines and the exit codes.

**The open.** The daemon answers one open at a time; a second open waits for the first. In this
order, it:

1. reads the process of the barrier of the coordinator record, when it holds one. When it runs,
   the daemon brings its tab to the front (`herdr-app do pane.focus`) and answers
   `{accepted: true, opened: false}`; a failed focus refuses the open with code 6. A failed read
   refuses the open with code 6 too, and the record stays. When the process is gone, the daemon removes the record and its start folder and goes on;
2. selects the host as `assist` does, with the local order and the usage records;
3. checks the native home of the host, the update policy of its plugin, the host on `PATH`, the
   contract version of its plugin ([The engine and the plugin](#the-engine-and-the-plugin)), the
   file `skills/coordinate/SKILL.md` of the plugin root, and `hc` and the Herdr app;
4. opens the tab `Coordinator` with the link label `Coordinator` and the focus, in the main
   checkout, as a session tab ([The session tab](#the-session-tab)): the start barrier
   `daemon --session-start <folder> <daemon PID> <host> - - <arguments>` with the interactive
   arguments of `assist` and the prompt of the skill `coordinate`. The tab argv sets
   `BUN_RUNTIME_TRANSPILER_CACHE_PATH=0`, `DO_NOT_TRACK=1`, and `CELETIS_COORDINATOR=<token>`, a
   new random UUID. The login shell keeps no shell after an exit with status 0;
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
`{schema: 1, host, terminal, barrier: {pid, start}, folder, token}`. `terminal` is the hc
terminal of the tab, `barrier` is the process of the start barrier, `folder` is its start folder,
and `token` is the value of `CELETIS_COORDINATOR`. The daemon holds the record while that process
runs. It reads the process each 2 seconds and removes the record and the start folder only after
a definite read that the process is gone. A failed read keeps the record. A record that does not
validate is no record: the daemon prints its path and the cause once, and the next open writes
over it.

**The takeover.** After the takeover of the run records and before it serves, a daemon, also a
successor, reads the record. It takes over a record whose barrier runs, and keeps a record whose
read fails. It removes a record whose barrier is gone. `celetis daemon stop` keeps the record and
leaves the session open in its tab; until the next start, each form of `coordinator` exits 3 with
the line of no daemon.

**The value of the session.** The barrier gives its environment to the host, so each command of
the session has `CELETIS_COORDINATOR`. Its name holds no `KEY`, `SECRET`, or `TOKEN`, so the
default environment policy of Codex keeps it. A step session has no such value. Each process of
the same user can copy the value: it is a guard against a confused agent, not a security boundary.

**The attention state.** The daemon derives the field `attention` of each run row with one loop,
each 2 seconds, and keeps the row of a run unchanged when a pass cannot decide. A run view holds
the hc terminal of its released session (`terminal`) and the hc turn of its last step-end state
(`turn`). A state other than `running`, `checking`, `waiting`, and `exiting` clears both; a
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
| 6 | The status is `idle`, `done`, or `error`, the run is a `resume` run, and its state is `running` | `turn-ended` |
| 7 | Each other case, also a terminal with no status | `null` |

A turn that ended after the last step-end verdict gives no state until the step-end watch gives
its verdict for that turn. A resume run has no step-end watch, so row 6 stands for it. A result
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

At the end of a pass with one or more items, inside the sequence of the coordinator terminal, the
daemon reads `hc get` of the coordinator terminal. Only the status `idle`, `done`, or `error`
goes on; a failed read and the statuses `working`, `blocked`, and none type nothing and print
nothing, and the items stay. The daemon then types one note with `hc send <terminal> --json --
<note>` (no `--force`, no `HC_TERMINAL_ID`) and removes the items on a sent result. Another result
keeps the items for the next pass, and the first failure after a success prints
`daemon: coordinator: cannot type a note into the tab Coordinator; its items stay for the next
note`. A session at an ended turn starts a turn with the note; the status gate keeps the note out of
a working turn, so the daemon sends no reminder: an item leaves only by a sent note, by a change of
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
   3. Then `hc get` of the terminal: a failed read or no status refuses with code 6, and the status
   `blocked` refuses with code 3 and a line that names the dialog kind and the tab.

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

**The limit of the composer.** hc pastes the message into the composer of the run session. When
the maintainer left unsent text there, that text comes before the header, and hc has no option
that refuses a composer with text. So the rule of the session that receives a message takes the
header at any place of the message, and the text before the header is no answer.

**The board.** The board shows the session by its rules for a session tab with no issue: the
link label `Coordinator` names no issue, so it is in the strip Human sessions
([The cards](board/README.md#the-cards)).

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

## The agent of each start

At each start, the daemon reads the local order, the main config, and
the per-host usage records again. It computes the effective order of the step
(`effectiveOrder` of `engine/lib/agent-order.ts`): when the `agents` field names a preferred agent
for the step and the local order includes it, that agent comes first, then the other agents of the
local order in their order; otherwise the effective order is the local order. It passes that order
to `selectAgent` of `engine/lib/agent-usage.ts`. The default choice takes the first included host
with no active block; an explicit choice keeps its host and ignores the preference. The preflight
and the contract check of the selected host run after this selection. A missing executable
or another setup error of a preferred agent stops the start, and no next agent is tried; the
remedy is a local exclusion of that agent, which then wins. Each step session gets a
usage attempt. A Claude step gets attempt-local `Stop` and `StopFailure` callbacks through
`--settings`, beside its `--session-id`. A Codex step is read through `thread/read` and
`thread/turns/list` after the daemon saves its verified ID. The daemon acts only on the
observation of its own attempt, also when the shared record keeps a newer attempt.

## Usage-limit recovery

Only a daemon-owned step with the default choice continues on another
agent. A confirmed refusal of an explicit host is recorded; that session stays open, and no other
agent starts. After a confirmed refusal of the default host, the daemon:

1. Saves the block, writes `<git common dir>/celetis/recovery/<n>.json` (schema 2, with the key `daemon`) with the state
   `recovering`, and stops the job of the step end.
2. Ends only its own attempt (`endOwnedAttempt` of `engine/lib/quota-recovery.ts`). The barrier
   gives the host `CELETIS_ATTEMPT=<attempt id>`, and each child inherits it. For Claude, the
   daemon records three groups: the process tree under the barrier, each process with that entry
   in its environment (not in its arguments), and each process on the tab's controlling terminal
   outside the tab shell's own tree. It sends `/exit`. When the barrier still runs 10 seconds after
   the start of that request, it sends SIGTERM once to the host process, the one child of the
   barrier (as at the step end), so a native dialog of the host does not keep it alive. It reads
   the groups again until the barrier and every recorded process are gone, for at most 20 seconds.
   So a writer that left the tree, as with `cmd &` or `nohup`, still counts. A session with no
   controlling terminal (`ps` shows none, `?`, or `??`), a missing marker, a failed process read,
   or a process that still runs at the deadline is `unverified`, and the line names the running
   PIDs. Codex, and each host on Windows, have no
   proved termination path, so their result is always `unverified`. The check cannot see a
   process that leaves the tree and the terminal (a new session) and whose environment `ps`
   cannot show: one that clears the entry, or a macOS platform binary such as `/bin/sh`. The check
   accepts Linux terminal names (`pts/<n>`), but no Linux run has proved it.
3. On `unverified`, starts no other agent. The session stays in its tab and keeps the issue lock.
   The daemon stops with a line that names the reason, the cause, the running PIDs, the tab, and
   the native resume command of the session from the main checkout.
4. After proof, archives the session record ([Sessions](#sessions)), prints the native resume command, and
   binds the one dirty lane of the issue: its path, branch, HEAD, and a digest of its status,
   diff, and untracked files. Two or more dirty lanes of the issue give no binding.
5. Reads the issue again. When the record, the live daemon, the issue lock, the attempt, and the
   lane binding all match, the bound lane does not stop the read. A dirty main checkout, another
   dirty lane, a changed branch, HEAD, or digest, and an unresolved merge, rebase, cherry-pick, or
   revert still stop it.
6. Starts the same step again on the next eligible host of the effective order of the step when
   the decision is the same step with the same spec digest and `## Plan` comment. The first
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
value and requires the environment read to show it. Then it reads two groups: each process with the
attempt marker in its environment, and each process on the recorded terminal outside the tree of
the tab shell. A failed process read, also the first read of the process table, reads again, for
at most 20 seconds in total; then the result is `unverified`, with the cause that the process
table could not be read. A group process that runs gives `unverified` with its PIDs;
no such process gives `quiescent`. A record with no tab shell or terminal, a control child that the
read does not show, or a control child that ended before a read showed it gives `unverified`. The
limits above stay: the proof cannot see a process that left the terminal and whose environment `ps`
cannot show. When the barrier of a live refusal in the daemon ends before step 2 reads it, the
daemon uses the same proof, and its first failed read of the process table reads again in the same
way. The daemon records no tab shell, so its result there, and after a failed first read, stays
`unverified`.

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
value `#<n> <step>`. It links the live card to the issue on the board. The label and the tab name
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
`schema: 2`, `host`, `issue`, `step`, absolute main `checkout`, `session_id` (UUID or null), and
`effort`, the level that the daemon requested after the Codex clamp.
The daemon writes it atomically. Before a current record is used or replaced, a valid schema-1
record becomes schema 2 under the issue lock. This preserves its host, issue, step, checkout, and
nullable native session ID exactly, and retains its original bytes in an immutable sibling backup.
The new `effort` is `high`, the current Resume policy default; it does not describe the original
session's effort. Unsupported schemas and invalid data stop without replacement.
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
Claude persistence is a current saved user turn with matching ID, cwd, and launch time.
Codex verifies `thread/read` and `thread/turns/list` without resuming or starting a model turn.

If startup has not verified identity and a saved turn after 60 seconds, the daemon prints one
warning for Claude or Codex. It says that monitoring continues and directs the person to check
setup prompts in the tab of the session. Verification continues while the foreground runs, until
a saved turn verifies, an invalid identity ends the watcher, or cancellation stops it. A late
verified turn enters the normal completion checks without a restart.

An invalid identity ends the watcher with the startup error and the last 40 lines of the
terminal (`hc read`). Foreground
exit without a verified saved turn also reports the startup error, unless an earlier terminal
failure already reported it. The pending warning writes no terminal error marker, so it does
not suppress that final error. These failures write no false no-progress row. A record with a
null ID cannot be used for exact run resume.

## The event record

Each Celetis process that detects a failure appends one entry to the event record of the user. A
later session reads the record with `celetis --agent <host> events [--after <id>]`. The record is
local. It has no network part. [ADR-0066](https://github.com/ddinkov10/celetis/blob/main/docs/adr/0066-one-shared-event-record-with-a-lock.md) holds
the reasons why all processes write one shared file under a lock.

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
| `schema` | `1` |
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
| `issue` | The issue number when the site knows it, else `null` |
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
refusals, for example a missing daemon or a stream with no status, with only its own lines as the
message, not the output of the landing that it prints.

A process that ends with 0, 129, 130, or 143 writes no exit entry. A successful `execve`
replacement of the launcher ends no process, so the new process records its own exit. A workflow
entry and the later exit entry of the same process are two reports, and both stay.

The workflow and board entries, by `name`:

| Name | Site |
| --- | --- |
| `no-progress` | The daemon stops a step that gave no progress. `issue` is set |
| `step-skip` | The daemon stops a step that skips a step of the lane. `issue` is set |
| `startup-error` | A session does not start (`startupError` in `engine/lib/session.ts`). `issue` is set |
| `step-end-write` | The daemon cannot write a step-end record and continues. `issue` is set |
| `exit-request` | The daemon cannot ask a session to exit. `issue` is set |
| `exit-signal` | The daemon sends SIGTERM to a Claude host that does not exit within 10 seconds of its exit request. `issue` is set |
| `exit-timeout` | A session does not exit within 10 seconds of its exit request and gets no signal, or within 10 seconds of the SIGTERM. `issue` is set |
| `issues-read` | Auto mode cannot read the open issues from GitHub |
| `queue-error` | The queue of the daemon saves the state `error`, or ends with an error |
| `run-exit` | A run of the master daemon ends with a nonzero code. `issue` and `code` are set |
| `run-defect` | A run or auto mode of the master daemon ends with an unexpected error. A defect with its stack |
| `land-exit` | A landing of the master daemon ends with a nonzero status, also 143, and no unexpected error. `issue` and `code` are set |
| `land-defect` | A landing of the master daemon ends with an unexpected error. A defect with its stack. `issue` and `code` are set |
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
  starts one `engine/lib/updater.ts --inspect <host>` child for each host that it inspects. Each of
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
| `refusal` | `refusal`, `command`, `code`, and the first line of `message`, with each run of digits replaced by `0` and the folder that holds `engine/` replaced by `<engine>` |
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
name and the line number, and the read continues. With `--after <id>`, it prints the entries after the last entry with that `id`.
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
  end. On Windows, no daemon runs, so a board Run, Resume, Retry, or queue press fails there. Two
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
