# The Celetis workflow

`celetis --agent <host> run` and `celetis --agent <host> queue` send the requests of the Celetis
workflow from a terminal to the master daemon of the repository ("The master daemon"), and return
at once. The daemon asks the
resolver for the next step of an issue and starts that step in a new interactive Claude or Codex
session. Each session starts in a new tab of the Herdr app, in an hc terminal of herdr-core of its
own, and the daemon steers that tab from outside: it ends the session when the step is done, and
starts the next step when its gate is `auto`. The GitHub issue stays the state store
(`docs/issue-tracker.md`): every result of a step goes to the issue. The master daemon also serves
the board, a local web page that shows each agent session and the next step of each issue. Its
Run button gives the request for one issue to the daemon, and the daemon opens the session tab. The board is
`engine/board/` of the plugin: a product project, a repository that uses the plugin `celetis`,
holds its config, and the plugin holds the board, which reads its data in the daemon process. ADR-0002 holds the reasons for the script,
ADR-0003 holds the reasons for the board, ADR-0005 holds the reasons why the terminal program, not a
mod, gives the session state and ends a step, ADR-0058 holds the reasons why herdr-core and the
Herdr app are that program, ADR-0062 holds the reasons why each session runs in a tab of its own
that the script steers, and ADR-0007 holds the reasons why `specify` is a step of the script.
ADR-0008 holds the reasons why the build step lands the change, ADR-0020 holds the reasons why the
board is a part of the plugin, and ADR-0035 holds the reasons why the board reads its data with the
engine and starts fixed commands. ADR-0011 holds the reasons why a step session hands a stop to the
issue, ADR-0033 holds the reasons for the one definition of the workflow and for the skip rule, and
ADR-0038 holds the reasons why a `bug` session hands on to `plan` in that rule.
ADR-0072 holds the reasons for the one master daemon of a repository, and
[ADR-0073](adr/0073-the-runner-commands-are-clients-of-the-master-daemon.md) holds the reasons why
each `run` and `queue` command sends one request to it and returns.

`engine/lib/workflow.ts` of the plugin is the one definition of the workflow: the lanes, with the
label, the branch prefix, and the steps in order of each lane; the stages; the command of each step;
the default gate `me`; the decision of an issue; and the skip rule. The resolver, the daemon, the
board data, the config reader, the session record, `worktree`, `land`, and `setup` take these facts
from it. A product project cannot change it.

Two rules of the harness hold in each session, also in a session by hand:

- A lane never skips a step.
- The maintainer starts the daemon and turns auto mode on; an agent starts a run only when its task
  says so, with a number, and in a terminal.

In this document, these names are files of the plugin `celetis`, also when a session reads the
document inside a product project that has a `docs/` folder and an ADR store of its own: the five
documents (`docs/workflow.md`, `docs/issue-tracker.md`, `docs/capability.md`,
`docs/procedures/docs-lookup.md`, `docs/procedures/prior-art.md`), `step-prompt.md`, a runtime of `engine/` or a program
of `scripts/` that the text names by its file, and each ADR number, which is a record of
`docs/adr/` in the folder of the plugin and not of the product project. Each other path is a path
of the product project, apart from a path that starts with `~/` or `/`.

## Requirements

- macOS or Linux, with Bun 1.4.4 or later. Native Windows has no daemon: it does not
  start there, and each form of `run` and `queue` that sends a request exits 3 with
  `run: Windows is not a support target` or `queue: Windows is not a support target`. The data of the board before #102 and the update
  lock passed their checks before the program. The program installs from Git Bash and runs from Git
  Bash, PowerShell, and `cmd`; its Windows checks are open ("Acceptance status").
- The selected host CLI (`claude` 2.1.299 or later, or `codex` 0.162.1 or later; the README gives
  the reason for each), `gh` (logged in), Bun 1.4.4 or later,
  and `git` 2.31 or later on `PATH`. See `docs/configuration.md` for the install of
  Bun. A missing external command keeps its diagnostic and failure status. The entry of the
  program imports the engine of its own version folder. Host operations validate native metadata. Child Celetis
  programs keep the selected Bun and all startup isolation flags. No jq or Perl runtime is needed.
- The scripts use only the REST API of GitHub (`gh api`), so they also work where a proxy refuses
  GraphQL, as in a Claude Code cloud session.
- For a look decision and a visual bug: `gh` 2.99.0 or later on github.com, and the capture tool of
  the platform row ([ui.md](procedures/ui.md), "Captures"). A look decision on the `impeccable` path
  (a whole web or mobile screen, or a smaller web change) also needs the `impeccable` skill and a
  `PRODUCT.md` of the product. The session checks for both. It never installs `impeccable`, which
  is no plugin dependency, and you run `/impeccable init` once for the product
  ([design.md](procedures/design.md), "The check").
- For the research of a UI component, optional tools that you install: a code-search tool (for
  example the grep.app MCP server), a web fetch or scrape tool, and a browser tool that the session
  opens for itself (for example the Playwright MCP server with `--isolated`). The session uses each
  one that it has and records a limit for each missing one
  ([component-research.md](procedures/component-research.md)).
- The program `celetis` on `PATH` (`README.md`, "First install"), and the plugin `celetis@celetis`
  of the selected host at the revision of the program. The scripts and the step text come from
  the version folder of the program: `celetis --agent <host> <name> <arguments>` runs
  `engine/<name>.ts` of that folder with those arguments. Before each new step session, the
  daemon reads the enabled installation of the session's host ("How a step runs"). Missing,
  disabled, malformed, or ambiguous metadata stops that read. Codex lookup uses `skills/list` on a
  short-lived local app-server connection; it starts no model turn. The README holds the separate
  installation recipes and product permissions. A Codex-only machine needs no Claude CLI.
- The trunk of the main checkout is current. The trunk is the default branch of the repository on
  GitHub. The config comes from the main checkout of the product project, and so does the custom
  part of a step that the script starts ("The config and the custom parts"):
  after each landing, `celetis --agent <host> land` moves the trunk of the main checkout. With the
  landing `merge`, it also fast-forwards a clean main checkout on the trunk that is only behind
  `origin/<trunk>` before it lands. A checkout with uncommitted changes, off the trunk, or with
  commits that `origin/<trunk>` does not have is a refusal with exit 6 that names that work. After a
  merge by other means, or after its line `land: the main checkout did not move`, run `git pull` in
  the main checkout.
- herdr-core 0.1.16 (`hc`) with its running server, and the open window of the Herdr app 0.1.11
  (`herdr-app`), for each start: each session runs in a tab of the Herdr app ("How a step runs").
  The support target is macOS ([ADR-0058](adr/0058-herdr-core-hosts-the-agent-terminals.md),
  [ADR-0062](adr/0062-each-session-runs-in-a-tab-that-the-runner-steers.md)). `celetis daemon start`
  checks them before it spawns the daemon, and exits with the same line: 3 for a command that is
  not on `PATH`, 6 for a server or an app that does not answer. The daemon checks them
  again before each run reads its issue (a number, auto mode, a queue wake, and `run resume`). A failed check there is the refusal of the
  request, with the same code and one of these lines; for a queue wake, the line becomes the queue error:
  - `daemon: hc is not on PATH; install herdr-core 0.1.16, then start again`
  - `daemon: the hc server does not answer: <cause>; start the Herdr app, then start again`
  - `daemon: herdr-app is not on PATH; install the Herdr app 0.1.11, then start again`
  - `daemon: the Herdr app does not answer: <cause>; open the Herdr app window, then start again`

  The host reports its status with OSC 7501 and needs no integration: Claude Code since 2.1.295,
  and Codex 0.166.0. Complete the normal folder trust of the host before a run. The daemon never
  answers that prompt.
- Superpowers installed and enabled on the selected host. The README holds its setup for each
  host. A missing required `superpowers:*` skill stops the lane.
- For Codex children with model tiers, the profile and current runtime allowlist from
  `docs/capability.md`. With no profile, each Codex child keeps the parent's model.
  The actual dispatch surface must support the resolved model and effort on isolated starts
  and same-pair follow-up. The task loop replaces a child when its effective pair changes
  ([Dispatch records](capability.md#dispatch-records)). CLI and desktop capabilities can differ.
- The board has more requirements: "The board" names them.

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

These human commands use an explicit `CELETIS_AGENT`, then the local ordered preference.
The absent preference is Claude, then Codex. Put `--agent claude` or `--agent codex` before `run` or `queue` to override that choice.
Every skill call supplies that prefix. Invalid host values stop; PATH order never chooses a host.
An explicit host stays fixed. A default step selects its host again at each session start, from
the effective order of the step ("The agent of each start"), so a usage-limit recovery can
continue the step on another host ("How a step runs"). Resume instead
selects its recorded host and rejects an explicit prefix that names the other host. `run retry`
needs no prefix: it only wakes the live waiter of a quota wait.

A run uses the environment of the daemon, which it got from the shell of `celetis daemon start`.
Only these values of the command travel in its request: `--agent` and `CELETIS_AGENT` as the
host selection, `--effort`, and `--quiet`. Each other variable of the shell of the command, for
example `PATH`, `CLAUDE_CONFIG_DIR`, or `CODEX_HOME`, does not reach the run. To change one, stop
the daemon and start it again from a shell with the new value.

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

An argument is `<n>`, or `'#<n>'` in quotes. A shell can read an unquoted word that starts with `#`
as the start of a comment: the script then gets neither that word nor the words after it, and with
no number it prints its usage line and exits 2. Each line of `run` starts with `run: `, each line of
`queue` with `queue: `, and each line of the daemon with `daemon: `, apart from the usage line and
the lines that keep their own prefix (`queue: `, `recovery: `, `session: `, and `state …: `). A
client prints the answer of the daemon as it comes.

**The answer.** Each form that starts work (`run <n>`, `run resume`, `run retry`, and a `queue action`
with a wake) sends one request to the master daemon of the Git common folder of the
current folder, so a linked worktree reaches the daemon of its main checkout. It waits at most 120
seconds for the answer, prints it, and exits; it never sends the request again. The daemon answers
after the checks before the first session of the run and after its first decision read ("The
master daemon", "The requests"):

- An accepted start prints `run: #<n>: accepted as run <first 8 characters of the run ID>
  of the daemon PID <pid>; read its progress: celetis daemon status` and exits 0; for a queue with
  no number, the subject is `queue`, and the prefix of a queue form is `queue: `. A quota wait at the
  first session is accepted. An accepted Retry prints `run: #<n>: Retry requested; the waiting run
  starts one bounded attempt cycle` and exits 0.
- A refusal, or an end at the first decision (for example a closed issue, or a `me` gate of a queue
  wake), prints the line of the daemon run for that cause, and exits with its code.
  A line with code 0 goes to stdout, any other line to stderr. A busy issue lock answers code 3, and
  a failed GitHub read of the issue code 6; each other end before the first session answers code 0.
- With no daemon, the form prints `run: no daemon runs for this repository; start it:
  celetis daemon start`, exits 3, and starts nothing. No form starts the daemon.
- A daemon of another revision of the program gets no request: the form prints `run: the
  daemon runs the program at <revision> and this program is at <revision>; restart it: celetis
  daemon stop, then celetis daemon start` and exits 3. After `celetis update`, restart the daemon.
- A daemon that cannot be read exits 6 with `run: the daemon of this repository does not
  answer: <reason>; read celetis daemon status`. A request with no answer in 120 seconds, or with an
  answer that cannot be read (also a code that is no exit class), exits 6 with `run: the outcome of the request is unknown:
  <message>; read celetis daemon status`. Read the status before you send the request again: a
  second start can start a second step.
- On Windows, each of these forms exits 3 with `run: Windows is not a support target`.
- A program version that an update removed prints `run: #<n>: the program version of this command
  was removed after an update; run the command again` (`run: ` and the same text for `resume` and
  `retry`) on stderr and exits 3.

A `queue action` with a wake prints the lines of no daemon, another revision, a
daemon that does not answer, an unknown outcome, and Windows with `queue: ` in place of `run: `.

After the answer, the run lives in the daemon. `celetis daemon status` shows one line for each run,
with its state and its last line, then one line for each landing ("A landing"), and `<git common dir>/celetis/daemon/daemon.log` has each
line of the runs. Ctrl+C, a signal, or a closed terminal of the command stops no run.
`celetis daemon stop` stops the daemon and detaches every run; no command stops one run.

The lines that say `start the run again` mean: send the request again. The lines that say `start the
daemon again` mean: start the daemon when it does not run, then send the request again.

**A start with one number** asks the daemon for a run of the issue. The daemon run reads the
decision of the issue from the in-process resolver (`nextIssue` of `next-step.ts`), a Run of a step or a stop, and starts the step
of a Run, whatever its gate. When the session ends, it reads the decision again and starts each
next step whose gate is `auto`. It ends the issue at the first of these, in this order: a stop,
the same step again ("no progress"), a refused skip, or a `me` gate. With the default gates, each
next step is a `me` step, so a start with a number runs one step of that issue.

**The effort level.** Each session that the script starts gets an effort level ("How a step runs").
The level is the decision of the step before on the issue, the newest `Effort: <step> <level>`
comment for the step (`docs/issue-tracker.md`, "What lives on the issue", "Effort"), else the
default `high`. `--effort <level>`, before or after the one number, overrides that level for the
first session of this start only: `low`, `medium`, `high`, `xhigh`, or `max`. Each later step of
the same start uses its own decision, and the override writes no decision on the issue. With
`run resume`, `queue`, no number, two numbers, a second `--effort`, or another value, the command
prints its usage line, exits 2, and starts nothing.

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
the run prints `#<n>: <T> skips <steps> after <S>; fix the issue, or start <T> by hand: celetis --agent <host> run <n>`,
for example `#12: plan skips specify after triage; …`. It adds the row `<n>\t<run line of T>` to
the record and ends the issue. The skip check comes before the gate check, so a refused step with a
`me` gate also gets a row. The first step of a start with one number, and the first step that
auto mode takes, have no skip check. So your start with the number is the override: it
starts T.

**Auto mode** of the daemon reads the decision of each open issue from the same resolver (`nextOpen`)
and takes the lowest open issue whose decision is a Run,
whose step has the gate `auto`, whose step has no row in the record, and
whose lock is free. It does the same work on that issue, but it starts no `me` step, and then it
asks again. It does not take a step that the script refused as a skip, because that step has a row
in the record. When no issue can start, when the issue started no session, or when the resolver cannot
read GitHub, it waits 60 seconds. It prints one line for the whole wait. While it waits,
`celetis --agent <host> next-step --open` shows the line of each open issue: a `stop` line gives the
cause, and a `run` line that does not start has a `me` gate, a row in the record, or the lock of
another run. Start it with `celetis --agent <host> daemon auto on` and stop it with
`celetis daemon auto off`, at any time; the run that the loop took continues to its end. A session that works
stays open in its tab ("How a step runs", "A stop of a run"). It reads open issues
only. With the default gates no step is `auto`, so auto mode starts nothing.

**The form `run resume <n>`** asks the daemon to reopen the exact session from
`<git common dir>/celetis/sessions/<n>.json`. The daemon run first takes the shared issue lock
and keeps it until the session exits. Under that lock, it prepares a supported schema-1 record as schema 2,
then reads and validates the current record, selects
its saved host and checkout, and runs `claude --resume <id> --effort <level>` or
`codex resume --no-daemon -c model_reasoning_effort="<level>" <id>` with the level of the record,
in a new tab that comes to the front ("How a step runs"). A missing or
invalid record stops with a recovery action. It makes no `gh` call or update and starts no completion watcher,
so the session stays open until you leave it. A Resume press of the board types this form ("The
board").

**The option `--quiet`** opens each session tab of the start in the background: the focus of the
Herdr app does not move. The request carries it to the daemon run. The board passes it for a Run
press and a Queue press. With no
`--quiet`, each session tab comes to the front. `run resume` ignores it. A second `--quiet` is a
usage error.

The script asks for no confirmation. A start with the number of an issue whose next step is
`implement`, `chore`, or `hotfix` builds the change and lands it with `celetis --agent <host> land` when
its checks are green, with no more act of yours. With an `auto` gate on a step, the daemon run
continues through that step by itself.

Issue locks and the lock `auto` of auto mode use shared Git refs under
`refs/celetis/locks/`. Their owner records are `{ daemon, session }`: the daemon and foreground
PIDs and process start times. Either live process keeps the lock, including after
a killed daemon; an exited
process does not. A process that the program cannot read, for example after a failed `ps` call,
also keeps the lock. Only a definite read frees it: the process does not exist, it has another
start, or the daemon PID does not run `daemon.ts`. A daemon that stops while its session
lives leaves the lock to that session.
A new start for the issue cannot begin until the session exits. Claims and releases use Git
compare-and-set, and foreground registration updates all held locks in one transaction. Both
hosts and manual resume share the issue lock.
A landing in the master daemon holds the lock ref `land-<n>`, with the daemon as its owner and no
session ("How a step runs", **A landing**). The `no-progress` file in `<git common dir>/celetis/` has one row for each step that ended with no progress, and one row for
each step that the script refused as a skip. Auto mode and the board read it. An
explicit issue start can start that step. `engine/lib/locks.ts` of the plugin owns the lock refs,
the owner records, the liveness check of an owner, and the record; the daemon and the board use it.

### The continuous queue

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
the answer ("Start the script", "The answer"). When the action would issue a wake on the record
that it reads first (an Add to an empty queue, a Continue, or a Retry), it checks the daemon
before the admission: with no daemon it exits 3 and writes no queue record. A move, a remove, and
an Add to a nonempty queue need no daemon. When the daemon stops between the admission and the
wake, the queue keeps an unowned pending launch, which a deliberate Try again recovers.
Old batch start and reset forms are removed.

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
("The agent of each start"). The active
host is the host of the current session, or null. `quota-wait` has the wait ID of the issue's
recovery record and no active host ("Usage-limit recovery").
It has no completed rows, history, reset, or tab-local draft.

The stable native `queue-write.lock` serializes short read-modify-write transactions. Acquisition
waits at most 5 seconds. Remote reads and foreground execution stay outside this lock.
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
Other callers use a finite internal path in the same revision's `daemon.ts`; it starts no
terminal, host, GitHub read, or workflow action. Live owners and busy locks refuse without
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

### The master daemon

The master daemon is one long-lived process for one repository, the Git common folder of its
working folder. It runs many issue runs at the same time, with the run engine
(`engine/lib/run-engine.ts`), runs each landing of `celetis --agent <host> land` in the daemon
process, one at a time ("How a step runs", **A landing**), and serves requests over HTTP on a Unix socket
([ADR-0072](adr/0072-one-master-daemon-runs-every-issue-run.md)). Its process is
`engine/daemon.ts --daemon` (a successor adds `--after <pid> <start>`, "The restart"), so the
lock, step-end, and recovery checks accept it as the daemon. Nothing starts a daemon by itself. The daemon also serves the board on a loopback port
("The board"). The `run`, `queue`, and `land` commands send their requests to it, and the board presses
go to it in its process ("Start the script", "The answer"). The shared locks keep one owner
for each issue, for the queue, and for auto mode across the daemon and a second daemon.

**The commands.** `celetis daemon start`, `status`, `stop`, and `auto on|off` (`engine/daemon.ts`) find the Git
common folder of the current folder, so a linked worktree reaches the daemon of its repository.
They refuse Windows with exit 3. For `start`, `status`, and `stop`, the optional `--agent` selects
nothing; for `auto`, it selects the host of auto mode.

- `start` prints the running daemon (`daemon: a daemon of this repository runs: PID <pid> at
  <revision>`, with `; this program is at <revision>; it was not replaced` for another revision)
  and exits 0. For a daemon of its own revision, it then reads the status and prints
  `daemon: board http://127.0.0.1:<port>`; a failed status read prints its line on stderr and
  exits 6. It reads no status of a daemon of another revision. Otherwise it checks `gh`, `hc`, and
  the Herdr app (a missing one exits 3, a server or an app that does not answer 6), then
  spawns `engine/daemon.ts --daemon` in the main checkout. The spawn is detached, with stdin
  closed and stdout and stderr appended to `daemon/daemon.log` (0600). It polls the status for at
  most 30 seconds, prints `daemon: started PID <pid> on <socket>` and
  `daemon: board http://127.0.0.1:<port>`, and exits 0. A daemon that
  ends or stays silent exits 6, for example when its board port cannot open ("The start"). Another
  daemon that wins a race is printed as above.
- `status` first compares the revision of the daemon with its own. Another revision exits 3 with
  `daemon: the daemon runs the program at <revision> and this program is at <revision>; restart it:
  celetis daemon stop, then celetis daemon start`, and no status read. Else it prints the daemon
  line, `daemon: board http://127.0.0.1:<port>`, `daemon: auto mode on|off|stopping`, and one line
  for each run. It exits 3 when no daemon runs.
- `stop` sends `POST /stop`, reads the process until it is gone for at most 60 seconds, prints
  `daemon: stopped PID <pid>`, and exits 0; with no daemon it exits 0 too.
- `auto on` and `auto off` send `POST /auto` with `quiet: false`, the host of `--agent`, and
  `CELETIS_AGENT` (each only when present), wait at most 120 seconds, and never send again. On an
  accept they read the status and print `daemon: auto mode <on|off|stopping>`, exit 0. A
  refusal prints its line (stdout for code 0, else stderr) and exits with its code. With no daemon
  they print `daemon: no daemon runs for this repository; start it: celetis daemon start` and exit
  3; a daemon that cannot be read exits 6 with `daemon: the daemon of this repository does not
  answer: <reason>; read celetis daemon status`; a daemon at another revision exits 3 with
  `daemon: the daemon runs the program at <revision> and this program is at <revision>; restart it:
  celetis daemon stop, then celetis daemon start`; a request with an unknown outcome exits 6 with
  `daemon: the outcome of the request is unknown: <message>; read celetis daemon status`. Any
  other form of `auto` prints `usage: celetis daemon start | status | stop | auto on|off`, exit 2.
- A daemon is running only when the identity file names a PID with that start time and a command
  that holds `daemon.ts`. A failed read of the process table is neither: each form exits 6
  and `start` spawns nothing.

The daemon gets the environment of the shell of `daemon start`, except `HC_SCOPE` and `PORT`.
`hc kill` ends each process that carries the scope of its terminal, so a daemon with `HC_SCOPE`
would end with the terminal that started it. `PORT` is the port of the board, so only the board
reads it. A later change of the shell environment does not reach a running daemon, and so no run
and no landing.

**The start.** In this order, the daemon:

1. refuses Windows with `daemon: Windows is not a support target` and exit 3;
2. finds the main checkout and the Git common folder of its working folder;
3. makes the socket path `/tmp/celetis-<uid>/daemon/<first 16 hex digits of the SHA-256 of the
   Git common folder>.sock`. A path of 104 bytes or more stops the start with exit 3, before any
   folder or lock;
4. makes `<git common dir>/celetis/daemon/` and its `runs/` folder (0700), and the socket
   folder `/tmp/celetis-<uid>/daemon/` (0700);
5. reads its process start, then takes the lock ref `daemon` with that start. A failed read of the
   start stops the daemon before the lock, with
   `daemon: cannot read the process start of the daemon; allow process access and start the daemon again`
   and exit 6. When another live process holds `daemon`, the daemon prints
   `daemon: another daemon of this repository has PID <n>; this one stops` and exits 3;
6. reads `board.port` of the main `.celetis.yaml` with the full validation of the config, default
   4403. A file with an error prints the diagnostic of the config reader and exits with its code;
7. opens the board ("The board"). A nonzero `Number(PORT)` of its environment is an exact port;
   else the board takes the first free port from `board.port` through 65535. It prints
   `agent-board: repository <main>` and `agent-board: http://127.0.0.1:<port>`. A port that cannot
   open prints `agent-board: cannot listen on 127.0.0.1:<port>: …` (or the range of an exhausted
   search), releases `daemon`, and exits 6, before any takeover;
8. reads the run records and makes one adoption attempt for each record ("The takeover");
9. removes a socket file that a killed daemon left;
10. serves on the socket;
11. writes the identity file `daemon/daemon.json` (0600, a temporary file and a rename):
    `{schema: 1, pid, start, revision, main, common, socket}`, where `start` is the process start
    time and `revision` is the Git revision of the program;
12. prints `daemon: PID <pid> serves <socket>`.

A successor ("The restart") first waits for the old daemon to end, then starts in this order. Its
board tries the port of `PORT` first and searches from `board.port` when that port is in use. After
step 12, it turns auto mode on when the old daemon carried it.

From the open of the board to the end of the takeover, the board serves the page and its reads,
but the daemon refuses each request of the board (Run, Resume, Retry, a queue action, a queue
reconcile) with 503, `daemon: the daemon takes over its runs; send the request again after its
start`, and code 3. So no press takes an issue lock before the adoption of its old run.

The socket folder is private to the user, and the daemon uses no token: any process of the same
user can send a request. Auto mode is off at each start, also after a crash. Only a successor
turns it on again, with the selection and `quiet` of the old loop ("The restart").

**The requests.** The board gives its requests to the same dispatcher in the daemon process, with
no socket and no HTTP request to itself: the same parser and the same answers. An error that the
dispatcher throws is the 500 answer below. A body is JSON of at most 16 KiB, with exactly these keys:

| Request | Body | Effect |
| --- | --- | --- |
| `GET /status` | none | The status object |
| `POST /run` | `{number, selection, effort, quiet}` | A start with one number; `effort` is a level or `null` |
| `POST /auto` | `{on, selection, quiet}` | Auto mode on or off |
| `POST /queue` | `{id, token, selection, quiet}` | The claim and the run of a queue wake that a `queue action` issued |
| `POST /resume` | `{number, selection}` | `run resume <number>` |
| `POST /retry` | `{number, waitId}` | The wake of the live quota wait, as `run retry <number> <waitId>` |
| `POST /stop` | `{}` | The stop of the daemon |
| `POST /queue/action` | `{action, selection, quiet}` | A queue action, as `queue action '<QueueAction JSON>'`; `action` is that JSON |
| `POST /queue/reconcile` | `{}` | The queue reconcile of a board read |
| `POST /land` | `{number, subject, selection, from}` | A landing, as `celetis --agent <host> land <number> '<subject>'` from the folder `from`; the answer is a stream (below) |

`selection` is `{explicit?, environment?}`: an explicit host (`claude` or `codex`), the
`CELETIS_AGENT` value of the client, or neither. Each run and each landing selects its host from its own request,
as `celetis --agent <host> run` does from its prefix and its environment. The
`CELETIS_AGENT` of the daemon never selects a host. A queue wake keeps the recorded agent choice of
the queue. A queue action uses the choice rules of `queue action`: an Add
uses the request selection; each other action of a queue with a recorded choice refuses another
named host with `queue: recorded agent choice is <choice>` and code 2, and uses the recorded
choice. A reconcile uses the recorded choice.

A `/land` body has a positive safe integer `number`, a `subject` that `land` accepts (a
Conventional Commit subject with no newline and no ` (#<number>)` at its end), and an absolute
`from`, the top-level folder of the checkout of the client. The landing uses
`from` only for the refusal of a run from inside the lane worktree. The daemon answers an accepted
`/land` at once with 200 and a stream of NDJSON lines (`application/x-ndjson`): `{"out": <text>}`
for a write of the landing to stdout and `{"err": <text>}` for a write to stderr, in the order of
the writes, an empty line each 5 seconds, and one last line `{"code": <status>}`. A landing behind another
writes one `out` record first ("How a step runs", **A landing**). Each character of
`<text>` is one byte of the write (U+0000 to U+00FF), so the client writes the bytes of the landing
unchanged. A refused `/land` gets the refusal answers below, with no stream.

An answer is `{accepted: true, run}` or `{accepted: false, line, code}`. `run` is the run ID, or
`null` for `/auto`, `/retry`, and `/stop`. A queue action and a reconcile answer
`{accepted: true, run, view}`, where `view` is the queue view of `queue status` after the change, and
`run` is the run ID of the queue wake of the change, or `null` when the change has no wake. A queue
wake of either request starts as `POST /queue` does. When the daemon refuses that wake with 409, it
writes `error` to the queue record, with the refusal line as the reason and the act
`Fix the launch failure, then use Try again.`, but only while the record has that launch token and
no live run or foreground owns the queue or its current issue; so it never writes over a live queue
run. A 503 writes nothing: the record
keeps its pending launch, and a deliberate Try again starts it. A refusal has the line and the exit
code of its cause:

| Status | When |
| --- | --- |
| 200 | An accepted request, the status object, and the stream of a landing |
| 400 | A body that is not valid: the usage line, code 2 |
| 404, 405 | Another path, or another method for a path; code 2 |
| 409 | A refused admission or an end before the first session, with its line and code: for example `daemon: another run or its session (PID <n>) works on #<n>` with code 3, `daemon: stop cannot read #<n> from GitHub` with code 6, and `daemon: stop #<n> is finished.` with code 0. A refused queue action or reconcile, with the line and code of `queue action`: for example `queue: the ID, revision, or current issue changed; refresh the queue` with code 3 |
| 413 | A body of more than 16 KiB; code 2 |
| 503 | A request that arrives during a stop (except `POST /stop` during a restart, "The restart"), and the answer of a run, queue, resume, or auto on request, or of a queue action or reconcile with a wake, that comes after a stop began: `daemon: the daemon stops; start it again, then send the request`, code 3. A status read that began before the stop answers 200. A run, resume, retry, queue action, or reconcile request of the board before the end of the takeover: `daemon: the daemon takes over its runs; send the request again after its start`, code 3 |
| 500 | An unexpected error of the daemon while it answers: `daemon: <message>`, code 1 |

A run, queue, or resume request answers after every check before the first session of its run:
the issue lock, the host selection, the setup checks of `gh` (not for a resume), `hc`, and the
Herdr app, a stale launch token, the first decision read for a run and a queue, and the saved
session for a resume. The answer comes directly before the session tab opens, or at a quota
wait. An end at the first decision is a refusal with the line and the code of that end, for
example `daemon: stop #<n> is finished.` with code 0. The code of the answer is not the code of the
run outcome: a busy issue lock (code 3) and a failed GitHub read of the issue (code 6) end the run
with the outcome code 0, as each other end before a session, so auto mode takes the next issue and
the daemon writes no `run-exit` event. When a stop begins before the answer,
the answer is 503. The stop detaches that run: it starts no session and keeps no lock and no run
record. A queue wake that the run claimed before the stop leaves the queue record `running` with
no owner, and a deliberate Try again of the queue starts it. Auto on starts the loop of
auto mode, which takes one issue at a time and holds the lock `auto`. When auto mode of another
daemon or its session holds that lock, auto on gets 409 with
`daemon: auto mode of another daemon or its session has PID <n>`. A second auto on while the
loop is on changes nothing. Auto off stops new picks: the issue run that the loop took continues to
its end, and the loop then releases `auto`. Until then, the status says `stopping`. An auto on
while the loop is `stopping` turns the same loop on again: the status says `on`, and the loop takes
the next issue after its current issue run, with the same lock `auto`. When the loop has already
started to end, auto on waits until it released `auto`, then starts a new loop. When a later auto
on or auto off comes during that wait, the waiting auto on answers 200 and starts no loop, so the
last auto request decides. An issue run that ends with a nonzero code ends the loop, and the
status then says `off`.

**The locks of a run.** Each run has its own lock owner. A run that ends while its session lives,
for example with the `cannot prove` line of a quota recovery, leaves each lock that it holds to that
session alone: the owner record then names no daemon and that session. So a later request, a second
daemon, the board, and auto mode find the lock free when the session ends, as after the
exit of a daemon. A detached run keeps its owner records ("The stop").

**The status object.** `{schema: 1, daemon, board, auto, runs, landings}`. `daemon` is the identity file.
`board` is the URL of the board, `http://127.0.0.1:<port>`. `auto` is `on`, `off`, or
`stopping`. Each run has one row, in start order:

| Field | Value |
| --- | --- |
| `id` | The run ID |
| `kind` | `number`, `auto`, `queue`, or `resume` |
| `issue`, `numbers` | The current issue; the issue numbers of a queue run, else `null` |
| `step`, `host`, `tab` | The step, the host, and the tab name of the current session, else `null` |
| `state` | `starting`, `running`, `checking`, `waiting`, `exiting`, `quota-wait`, `ending`, `taken-over`, or `finished` |
| `line` | The last `daemon: ` line of the run, else `null` |
| `changedMs` | The time of the last change of `state`, in milliseconds since 1970 UTC |
| `session` | `runs`, `gone`, or `unknown`: a process read of the start barrier of the current session at this status read, else `null` |
| `outcome` | `{kind, reason, code}` of a finished run (`closed`, `gate`, or `stopped`), else `null` |

A finished run stays in the status, with its outcome, until the daemon stops. A refused run
request is a finished run too. A text field has at most 4096 characters.

`landings` has one row `{issue, state, changedMs}` for each landing in the line, in the order of
the requests: `state` is `runs` for the landing at the head and `waits` for each other one, and
`changedMs` is the time that the landing entered its state, in milliseconds since 1970 UTC. A
landing leaves the list when it ends. `celetis daemon status` prints one line
`daemon: landing #<n> runs|waits since <HH:MM:SS>` for each row, after the run lines.

**The output.** Each line that the daemon writes to its stdout or stderr starts with
`<ISO time> <tag> `. The tag is the first 8 characters of the run ID for a line of a run,
`land-<n>` for a line of the landing of #<n>, else
`daemon`, also for the `agent-board:` lines of the board. A line of a run starts with `daemon: `, apart from the lines that keep their own prefix. The daemon writes
nothing else to a file; the process that starts the daemon decides where its stdout and stderr go. A run that ends
with a nonzero code adds the event `run-exit` to the event record, with its last line as
`message`. Each write of a landing, also of its suite, also goes to the stream of its request, as
the landing wrote it, with no time and no tag; when the client is gone, it goes only to the log. A
landing that ends with a nonzero status adds the event `land-exit`, or `land-defect` for an
unexpected error. The event record keeps its other entries ("The event record").

**The stop.** A stop request, SIGINT, SIGTERM, or SIGHUP stops the daemon. The daemon answers the
stop request first and gives each later request 503, except a stop request during a restart ("The
restart"). It detaches each run and the loop, keeps the
run record of each detached run, aborts each landing as a lost client does ("How a step runs",
**A landing**; a suite that still runs 10 seconds after its SIGTERM gets SIGKILL), and waits until
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
next session tab ("The session tab"). It does not end a released session, close its tab, or remove
its start folder. A lock with a live session keeps its owner record, which names the daemon and that
session: the session holds the lock after the daemon exits, and the next daemon adopts it. It does
not write the queue record and does not change the recovery record. So a stopped queue keeps its
state ("A stop of a run"). A stop while the run proves
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
tells whether the barrier was released. The record has `schema: 2`, with its paths under
`<git common dir>/celetis/`; a schema-1 record converts as "The move of the old names" says.

At its start, after it holds `daemon`, the daemon reads the records in the order of their file
names. It does not take over a record that it cannot read, that is not valid JSON, that has another
schema, or that does not validate, and the file does not change:
`daemon: cannot take over <path>: <cause>; its session stays in its tab`. For each
other record, the daemon adopts the issue lock with a new lock owner and the session identity of the
recorded barrier, else of the `pid` file of the start folder, else none. A queue run adopts the
`queue` lock first, then the lock of its current issue. The adoption takes a free lock, and
a lock whose owner record names no daemon or a gone daemon (a definite read), with no live session
or with a live session equal to that identity; the owner record then names the new daemon and keeps
that session.

- Another live owner holds the lock: the run ends with
  `daemon: #<n>: another run or its session (PID <holder>) took #<n> while no daemon ran; this run ends`.
  Its record goes. The queue record, the recovery record, and the tabs stay as they are.
- A process read is unknown: the record and the lock stay, the state of the row is `taken-over`,
  and the daemon reads again each 2 seconds.
- The daemon takes the lock: it writes the record again with its own identity and continues the
  run by its phase.

The daemon serves requests only after one adoption attempt for each record. So a request for an
issue whose record still reads unknown gets the lock refusal.

| Phase | The daemon |
| --- | --- |
| A session whose start folder has no `go` file | Closes its tab, when the record knows it, and ends the run with `daemon: #<n>: the daemon stopped before the step <step> started; no step was started` |
| A live session: the barrier runs with its start, and its command holds `daemon.ts` | Writes the step-end record `checking` under its own identity and runs the step-end watch and the usage watch. After the session end, the run continues with the gates of a continuing run, with no effort override |
| An ended session: the barrier is gone | Verifies the saved session identity once, records one usage observation of the attempt, and applies the normal end with the status of the `status` file. No valid status is an unknown status. Then the next steps follow |
| A barrier read that is unknown | Keeps the record, the lock, and the start folder, and reads again each 2 seconds |
| Between two steps | Reads the resolver again and continues with the gates of a continuing run |
| Before the first step | Starts the accepted request with its gate rule, its effort, and its queue request |

A resume run has the same phases with no step-end watch. The finished tab of a record closes by the
normal rule: when the next session tab opens, or at the end of the run. A run of the loop
continues as a run after a takeover. Auto mode stays off, except for a successor that carries it:
after its identity file, a new loop starts, and it takes its first issue only after each taken-over
run of auto mode ends; when one of them ends with a nonzero code, the loop ends ("The restart"). A
usage block in the one observation of an ended session starts the quota recovery for the default
choice ("Usage-limit recovery", "A session that ended while no daemon ran"); for an explicit host,
the normal end applies.

**A queue run.** After the adoption, the daemon reads the queue record again. A record with another
ID, or whose first number is not the recorded issue, ends the run with
`daemon: queue: the queue changed while no daemon ran; this run ends`, and the queue record
does not change. The outcome is `stopped` with code 0, and its reason is the text after `daemon: `.
Else the run continues its issue by the phase, with the queue transitions of
a queue wake, then the drain to the next issues. When the queue record still holds the launch
token of the claim, the daemon removes it and writes `running`. After each drain, the run record
names the next issue with no session, so a stop between two issues continues the drain at the next
start. A session whose start folder has no `go` file ends the issue as the table says, and the
queue state becomes `error` with that line.

**A quota recovery.** The recovery record has `schema: 2` with the key `daemon`; a schema-1 record converts as "The
move of the old names" says. When the recovery record of the
issue names a daemon that is gone (a definite read), the daemon writes itself as the owner of the record in one
transaction. Retry and the bound lane of the
recovery then accept the daemon. A `POST /retry` for a record that names this daemon needs a run of
this daemon for that issue whose state is not `ending` or `finished`; else it gets
`recovery: the run of #<n> no longer runs; start the run again` with code 3. So a second
Retry of a wait that woke gets the answer of the first. An unknown read keeps the record and reads
again each 2 seconds. A quota wait continues with its recorded wait ID, step authority, agent
choice, and the usage records that it saw. The daemon prints the wait line again and makes no new
wait ID, so `run retry <n> <wait id>` of that wait wakes it. A wait whose ID the recovery record no
longer has ends with `daemon: #<n>: the quota wait record changed; start the run again`.

**Per-run failures.** A refusal line, a startup error, a failed queue save, a failed write of the
run record (`daemon: cannot write the run record <path>: <cause>`), and an unexpected
error end only their run. Its outcome is `stopped` with the line and the code. An unexpected error
also prints its stack and adds a defect event `run-defect`. One failure stops the whole daemon with
exit 6: a step-end record that can neither be removed nor emptied. The daemon prints its two lines
(`daemon: #<n> cannot remove step-end: …` and `daemon: cannot revoke watcher ownership; …`), because only the end
of the daemon that the record names revokes it. The sessions stay open in their tabs.

**A removed program version.** The daemon checks its program files each 5 seconds, and its runs
check them as the daemon does. When a file is gone after an update, the daemon prints
`daemon: the program version of this daemon was removed after an update; start the daemon again`,
stops as above, and exits 3. The sessions stay in their tabs, and their run records stay for the
next start.

**The restart.** An approved update of the board, or **Restart** of the board after a terminal
update ("The board"), restarts a daemon whose program folder is the version folder of its revision, `<base>/.local/share/celetis/versions/<revision>`
(the real paths, read once at the start; a failed read counts as a checkout). A daemon of a checkout
never restarts: its update completes, and the update view says `updated`. The old daemon stops, and
a new process of the installed program takes over
([ADR-0077](adr/0077-the-master-daemon-hosts-the-board-and-restarts-as-a-successor.md)):

1. The claim. After the answer of the approval or of the restart request is sent, the daemon
   validates the installed program: the link names the target, and the source, revision, and clean
   state of its folder are the target. A restart request validates it once before its answer too. A failed validation keeps the daemon running, and the update view is
   `update-failed` with the validation line. Else it prints `daemon: restarts on the program at <12>`
   and stops. A claim after a stop began (`daemon stop`, a signal, a removed program version)
   changes nothing and starts no successor, so one restart runs at a time.
2. The stop, as "The stop" says. A stop that reaches the daemon after the claim and before its exit
   cancels the successor: a `POST /stop` (it gets the accepted answer, not 503, so
   `celetis daemon stop` ends with `daemon: stopped PID <pid>`), SIGINT, SIGTERM, SIGHUP, or a fatal
   stop such as a removed program version. The daemon prints
   `daemon: the stop cancels the restart; no successor starts`, starts no successor, and exits
   with the code of that stop: 0 for a stop request, 128 plus the number of a signal, 3 for a
   removed program version, 6 for the step-end failure ("Per-run failures"). No daemon runs after it. The page shows the timeout with the recovery line.
3. The spawn. After the release of `daemon`, the daemon starts one detached successor,
   `engine/daemon.ts --daemon --after <pid> <start>` of the installed program, with
   `--auto <JSON>` when auto mode is `on`. It runs in the main checkout, with the environment of the
   daemon, `HC_SCOPE` removed, and `PORT` set to the actual board port, and its stdout and stderr
   append to `daemon/daemon.log`. Then the old daemon exits 0. A failed spawn prints
   `daemon: cannot start the successor: <message>; run celetis daemon start` and exits 6; the runs
   stay detached for the next start.
4. The wait. The successor reads `{pid, start}` of the old daemon each 250 ms until a definite
   `gone`; a read that is `unknown` waits too. After 60 seconds it prints
   `daemon: the daemon PID <pid> did not exit within 60 seconds; this successor stops` and exits 3,
   with no lock. Else it starts as "The start" says and takes over the runs.
5. The port. The board of the successor tries the port of `PORT` first, so the page reconnects at
   its URL. When that port is in use, it searches from `board.port` and prints the new URL to the
   log; `celetis daemon status` prints it. Only the board gets that `PORT`: each daemon removes
   it from its own environment before it takes over the runs, so no run or landing suite gets the
   board port.
6. Auto mode. When auto mode is `on` at the claim, `--auto` carries
   `{"selection":<selection>,"quiet":<boolean>}` of the loop, and the successor makes that
   `POST /auto` with `on: true` after its identity file. A refusal, for example
   `daemon: auto mode of another daemon or its session has PID <n>`, goes to the log once, and auto
   mode stays off. Auto mode that is `off` or `stopping` at the claim stays off. The new loop holds
   `auto` and the status says `on` at once, but the loop takes its first issue only after each run
   of auto mode that the successor took over ends, so auto mode takes one issue at a time across a
   restart. When one of those runs ends with a nonzero code, the loop ends after they all end, as
   after an issue run of its own: it takes no issue, releases `auto`, and the status then says
   `off`. An auto off in that wait gives `stopping` until those runs end, and a stop in that wait
   starts nothing. Only the carried auto mode waits: an auto on after a normal start starts its
   loop as "The requests" says.

The old program writes the successor argument list, and the installed program reads it, so the list
is a contract between two program versions. The successor refuses a list of another shape
(`--after` with no PID and start, another option, an extra item) with exit 2 and
`daemon: invalid internal request`, before its wait, because it cannot wait safely. A `--auto`
value that the new program refuses (no JSON, no object, or no valid `POST /auto` body of this
program) does not stop the successor: it waits, starts, and serves with auto mode off, and after its
identity file it prints `daemon: this program refuses the carried auto mode <value>; auto mode stays
off`.

Between the stop and the takeover, no daemon steers the sessions: a session that ends its step in
that gap waits until the successor takes over its run. A known limit: after the old daemon spawned
the successor and exited, or after it closed its socket, a stop does not reach it. In the gap until
the successor writes its identity file, `celetis daemon stop` prints
`daemon: no daemon runs for this repository`, and the successor still starts; stop it after its
start.

#### The move of the old names

A repository that an earlier program used holds its state under the old names. The first access to
the state folder moves it (`stateFolder` of `engine/lib/state-folder.ts` calls `moveState` of
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

A refusal starts with `state: `. It exits 3, or 6 when a file or a Git read or write failed. A refusal before step 4 of the first round changes nothing. A later round, and the
`cannot move` line and the `changed during the move` line, can follow a deletion in step 4 of an
earlier round of the same command: that deletion removed only old lock refs whose owners were
proven gone, and it stays; the folder did not move. `<subject>` is `#<n>` for the lock `issue-<n>`, else the name of the lock:

- `state: <git common dir>/celetis-flow does not move: the old daemon PID <pid> holds <subject>; end PID <pid>, then run the command again`
- `state: <git common dir>/celetis-flow does not move: the old session PID <pid> of <subject> still runs; let it finish or end it in its tab, then run the command again`
- `state: <git common dir>/celetis-flow does not move: the process PID <pid> of <subject> cannot be read; run the command again`
  (also `…: the owner record of <subject> cannot be read; run the command again`)
- `state: <git common dir>/celetis-flow and <git common dir>/celetis both exist; nothing moves; keep one of them by hand, then run the command again`
- `state: <git common dir>/celetis-flow is not a folder; nothing moves; remove it by hand, then run the command again`
- `state: cannot read <path>: <cause>`, for the old or the new folder when `lstat` cannot read it
- `state: cannot read refs/celetis-flow/locks/: <git error>`
- `state: cannot move <git common dir>/celetis-flow to <git common dir>/celetis: <cause>`, after a
  rename error other than a missing source or an existing target
- `state: <git common dir>/celetis-flow changed during the move; run the command again`, after the
  third round

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
- The run record: schema 1 becomes schema 2. The paths `session.folder` and `session.capture`
  under the old folder move to `celetis/`. A path outside the old and the new folder is a refusal,
  `the record names session.folder <path> outside <git common dir>/celetis-flow`, and the daemon
  takes over no run from that record ("The takeover").
- The step-end record has the key `daemon` only. A record with the key `runner` reads as no
  record, and nothing converts it.
- The queue record and the session record keep their schemas ("Automatic storage preparation",
  "Sessions").
- A hook settings file `usage-captures/<id>/settings.json` that an old program wrote keeps its old
  absolute hook path. Claude Code reads it only when its session starts, and a new session gets a
  new folder.

Setup moves the setup record at its next run: `setup status` reports `the setup record is at
.claude/celetis-flow/wiring.json; setup moves it`, and with both records present, setup refuses and
asks you to remove the one that is not current. The first read of the marker of a worktree renames
`celetis-flow-setup-done` to `celetis-setup-done`, or removes the old marker when the new one
exists. A later `chore` issue removes the move.

## How a step runs

A session is one selected host process in the foreground of a new tab of its own ("The session
tab"), in the main checkout. `hostArguments` of `engine/lib/session.ts` builds its arguments. The
step text is a facts header (`stepHeader`), an empty line, and `step-prompt.md` of the version
folder of the program that runs the daemon. For `run /celetis:plan #402`, the header is:

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
folder of the program: `requireSameRevision` of `engine/update.ts` returns the `root` of
`installation()`. The step text compares it with the `<plugin>` of the skill entry, and a
difference after the resolution of both paths stops the step for setup. The landing comes from the
validated main config. The header holds no custom text: the entry of the skill reads
`custom.<skill>` of its active checkout through its own permission-checked read (ADR-0032), and a
skill entered in a lane reads the lane's file, which the daemon cannot know.

Claude starts the step as:

```bash
claude \
  --permission-mode auto \
  --effort xhigh \
  -n '#402 plan' \
  --append-system-prompt '<the step text>' \
  '/celetis:plan #402'
```

The daemon puts `--session-id <uuid>` before these arguments ("The step end").
`--effort` gives the chosen level ("Start the script", "The effort level"). The daemon removes
`CLAUDE_CODE_EFFORT_LEVEL` from the environment of each Claude session that it starts or resumes,
because that variable outranks `--effort`.

Codex reads effective `developer_instructions` with `config/read`, preserves that text, and
appends the step text. It passes the combined value as one quoted `developer_instructions=...`
value after `-c`. For each step, `specify` too, the daemon reads the session model: `model` of
`config/read`, else the `isDefault` model of the app-server `model/list`. It reads every page of
`model/list` with `includeHidden: true` and takes the supported levels of that model. It applies
the highest supported level at or below the chosen level, else the lowest supported level, and
passes it as `-c model_reasoning_effort="<level>"` before the prompt. A configured model that the
list does not hold, a model with none of the five levels, or a failed read stops the start with a
message: the daemon starts no session and writes no session record.
Its prompt is `Use the celetis:plan skill for #402. Complete its Celetis entry before any response, including commentary.`
The prompt came from a wording test ("Acceptance status"): its second sentence, the startup
sentence, changed first-response compliance from 0 of 5 to 5 of 5. The first sentence stays byte
for byte. The current second sentence names the entry of `docs/procedures/entry.md` and needs a
fresh compliance check. Every interactive Codex launch, including specify and
exact resume, uses `--no-daemon` so its hooks use the current pane's environment. The CLI must
support that option; it was checked on 0.162.1. The daemon retains the configured sandbox,
approval, and model settings. No document content is evaluated as shell code.
`docs/hosts/claude-code.md` and `docs/hosts/codex.md` hold the integration facts of each host.

After it builds the arguments, the daemon prints the level and its source:
`daemon: start: /celetis:plan #402 at xhigh (decided)`. The source is `decided`, `default`,
or `override`. When Codex applies another level, the line names both:
`daemon: start: /celetis:plan #402 at max (override); codex applies xhigh for <model>`.

The lane uses the exact path returned by `celetis --agent <host> worktree`. Each skill that works
on the branch follows [the lane worktree](procedures/worktree.md): it binds its commands, files,
instructions, and children to that checkout, and [the landing](procedures/landing.md) returns to
the main checkout. Claude keeps its native worktree tools. Codex's app worktree does not replace
the lane checkout.

`step-prompt.md` holds only what differs in a step session: the check of `<plugin>` against the
plugin root of the header; follow the skill, and start no step that a skill sends to a fresh
context; ask only for a decision that the issue does not hold, and never for a go-ahead or a
review; land only with `celetis --agent <host> land`, and only when the skill says so; and the stop
rules, which cite `docs/procedures/stop.md` for a stop and for a Verify scenario that the session
cannot run, after applying [Usage-limit exception](procedures/runtime-verification.md#usage-limit-exception); and, with `- recovery: yes` in the header, the continuation from the existing lane changes and the issue with no replay, reset, stash, or clean. It overrides no instruction of a skill: a skill says what it does "In a step session".
A step session is a session that the daemon starts with the step text. The exit status of the
host decides nothing: the resolver decides.

The session of `specify` is the one session with no step text, so it is no step session. For
`run /celetis:feature #402`:

```bash
claude --permission-mode auto --effort high -n '#402 specify' '/celetis:feature #402'
```

Rule 2 of the step text tells a session to publish with no wait for a review. `specify` publishes
the spec only after you approve the design, and nothing checks the design again after the publish.
So that session asks and waits as a session that you start by hand does (ADR-0007).
Codex also omits the step text for specify. Its configured developer instructions remain.

**The program and the plugin.** The daemon uses the version folder of the program that started it
for the resolver, entry, and step text of each run. Numbered starts, auto-mode starts, and later steps make no update call.
The form `run resume` keeps its no-update behavior and saved identity.
Before a step starts, the daemon checks that its required files and step text still exist.
Before each new step session, it also compares the installed revision of the plugin of the
session's host with its own revision (`requireSameRevision` of `engine/update.ts`). On a
difference it starts no session, writes no session record, and ends with
`celetis: the <host> plugin is at <12> and this program is at <12>; run celetis update, then start the daemon again`.
For the daemon, that means: run `celetis update`, restart the daemon, then send the request again.
So the skills, the step text, and the engine of a step session have one revision. `run resume` has
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
session loads updated skills and tools. A restart of the daemon alone updates nothing. After
`celetis update`, restart the daemon (`celetis daemon stop`, then `celetis daemon start`): its runs
then use the new program, and a `run` or `queue` form of another revision refuses with exit 3 until then.

**The session tab.** For each session, also an exact resume, the daemon opens a new hc terminal
with a tab in the space of the repository in the Herdr app (`openTab` of
`engine/lib/terminal.ts`): `hc run --bg --no-parent --no-notify` in the main checkout, with the
labels `herdr.space=<id>` and `celetis.link=#<n> <step>`, and the tab name `#<n> <step>`
(`herdr-app do tab.rename`). The space has the name of the folder of the main checkout. When that
space is missing, the daemon makes it with `herdr-app do space.new`, and the app shows it. The file
lock `<git common dir>/celetis/space.lock` lets one process at a time find or make the space.
The tab runs the start barrier, `daemon.ts --session-start <folder> <daemon PID> <host> <attempt ID or -> <recovery or ->
<arguments>`, through a login shell of `$SHELL` (`"$@"; exec "$0" -li`), so the tab keeps a shell
after the barrier exits. `<folder>` is a private start folder in `<git common dir>/celetis/`:

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

The tab of a start and of a resume comes to the front (`herdr-app do pane.focus`); with
`--quiet`, a tab stays in the background. The daemon closes a tab (`hc kill`, then `hc rm`) only
after a normal end: the status is 0 and, for a step, a saved turn has a verified identity. It
closes that tab after the next session tab of the same start is open, or when the run ends.
Each other end leaves the tab open with the last screen of the host and a shell under it: a
nonzero or unknown status, a session with no verified identity, and a session whose daemon
stopped. A tab whose barrier the daemon did not release closes, and no host starts in it. These
lines end the run with code 6, or 3 for a space lock that stays held, apart from the warning. No command prints them: they show as the
`line` of the row of `celetis daemon status` and in `daemon/daemon.log`:

- `daemon: #<n> cannot open the session tab: <cause>`.
- The warning, once after 60 seconds, while the terminal of the tab stays live and the daemon
  waits:
  `daemon: #<n> <host> startup: the start barrier of the tab #<n> <step> did not report after 60 seconds; waiting continues. Check the login files of $SHELL in that tab.`
- `daemon: #<n> <host> startup: the tab #<n> <step> ended before its start barrier reported; check the login files of $SHELL, then start the step again`.
- `daemon: #<n> <host> startup: the start barrier record of the tab #<n> <step> is not valid; start the step again`.

**A stop of a run.** A `run` or `queue` form has nothing to stop. Ctrl+C, a signal, or a closed terminal
of the command stops no run, because the command returned at the answer ("The answer"), and the
run lives in the daemon. No command stops one run. `celetis daemon stop` stops the daemon and
detaches every run ("The master daemon", "The stop"): each run stops its job of the step end and
removes its step-end record. A session whose barrier the run released stays open in its tab and
keeps the issue lock until it exits, so leave it with `/exit`. Before the release, the run closes
the tab. A stopped queue run does not write the queue record.

**The step end.** The script ends each step session by itself, from outside its tab
([ADR-0058](adr/0058-herdr-core-hosts-the-agent-terminals.md),
[ADR-0062](adr/0062-each-session-runs-in-a-tab-that-the-runner-steers.md)). Each `hc` call of the
step end names the session terminal, the hc terminal of the tab. Its label `celetis.link`,
`#<n> <step>`, links the session to the issue on the board. Before the release, the script starts
a job in the background that ends the session:

1. The script starts each Claude step with a new session ID (`--session-id`). That ID is the
   identity of the step. For Codex, the job finds the thread of the step with the app-server
   `thread/list` ("Sessions"). The job then waits for that identity and a saved turn in the correct
   checkout. For both hosts, it warns once after 60 seconds and continues verification while the
   foreground runs. It saves the verified ID in the current session record
   ([ADR-0046](adr/0046-pending-startup-keeps-the-completion-watcher.md)).
2. It waits until the host does not work: `hc wait <terminal> --timeout 60`. A timeout is only a
   check-in, because hc counts a terminal with no status as working.
3. It reads the current turn of the terminal with `hc get <terminal>`. A turn is current when the
   status `app` names the host of the step, and the status changed at or after the start of the
   step (`status_ms`). The job verifies the current host and a current `idle`, `done`, or
   `error` status, then reads the decision of the issue from the in-process resolver of
   `next-step.ts`. A decision with a result
   other than the result that started the session permits an exit check: a Run of another step,
   or a stop of the issue. A stop from an observation (the dirty tree, a landing that runs, or a
   failed read) permits none. The job reads the resolver again, and that read must give the same
   result. It then makes a final session-state check. A `working`, `blocked`, or missing status
   gets no exit.
   For Codex, it requests exit with `hc keys <terminal> ctrl+c ctrl+c`, which clears
   unsent composer text and requests native quit without submitting a chat message. Completion
   can discard a draft. For Claude, it sends `hc send <terminal> /exit`; hc refuses to send to a
   blocked program. A failed request leaves the session open and prints a recovery action.
4. Otherwise it pauses five seconds and checks again. `hc wait` returns at once while the host
   does not work, so this pause permits a new resolver check while the session remains idle.

Two decisions have the same result when both are a Run of the same step, or both are a stop with
the same reason, variant, and data (for example, the labels of a stop for several lane labels). The
state and the lane are not part of the result. So when `implement` records `## Built`, the
issue goes from planned to built, the result stays a Run of `implement`, and the session stays open.
The two variants of `ready-for-human` (`landing refused` and `ready for your step`) print the same
line, but they are two results. When the variant changes between the two reads of one check, the
job sends no exit input at that check, and it checks again at the next idle moment.

The daemon waits for the foreground process to exit before it releases a lock or starts the
next step. Successful input delivery alone is not completion. After a successful request, the
job waits for the owned host process to exit. If it stays alive for 10 seconds, the job prints
one recovery message and keeps waiting. Process exit cancels that diagnostic timer. The job
does not repeat the request or force-kill the host. If a UI state consumes the keys without
exiting, exit the session in its tab when ready.

The daemon publishes its completion disposition before it releases the start barrier. The
private file is `<git common dir>/celetis/step-end/<issue>.json`.
`checking` means that the current turn has no retained verdict. A resolver read of a landing that
runs also keeps `checking`, because the decision is pending until the landing ends; the daemon
reads again at the next check. `waiting` records an idle turn that stays open after a complete
decision. `exiting` lasts from the successful exit check until the foreground exits.
The record binds the daemon PID and process start, under the key `daemon`, to the session terminal and host. A turn binds
the terminal ID, the verified session UUID, and the hc `turn`. hc increases `turn` each time the
status leaves `working`, so a change between `idle`, `done`, and `error` keeps the turn key.
A slow resolver result cannot retain or close a different turn. Rechecking a retained turn keeps
its waiting disposition, so board polls do not produce repeated attention transitions.

The board reads this local record on every placement request, including `?local=1`, without a
GitHub read. Only a live matching daemon and valid snapshot identity can suppress attention.
Pending and exiting idle turns stay in Running with `checks step`; retained and unowned turns
keep Needs you. Dialogs always keep Needs you. A resume publishes no record.
The daemon removes the record on foreground exit, startup rejection, watcher failure, abort, or
package removal, before it releases the issue lock. A failed write withdraws the signal and
reports its cause. If deletion fails, cleanup invalidates the existing file's contents.
If neither act is possible, the daemon stops so its record cannot claim a live watcher.
The foreground stays open and keeps its issue lock until it exits. Restoring file access cannot
revive the stopped watcher's ownership. A missing or invalid signal never authorizes `/exit`. Updated server code
needs a new start of the daemon.

In each other case the session stays open: a decision with the same result, the dirty-tree line,
the line of a landing that runs, the cannot-read line, and a resolver read that fails. So a
session whose agent waits for an answer, waits for a background task, or left an uncommitted file
stays open, and a session that you start by hand never ends by itself. The exit of the start
barrier after the host exits is the only sign that the session ended: the script then stops the
job, and it reads no terminal status after the exit. When a session does not end and its agent
waits for nothing, leave it with `/exit` in its tab: the script then asks the resolver again, and
it prints the reason or starts the next step.

**The agent of each start.** At each start, the daemon reads the local order, the main config, and
the per-host usage records again. It computes the effective order of the step
(`effectiveOrder` of `engine/lib/agent-order.ts`): when the `agents` field names a preferred agent
for the step and the local order includes it, that agent comes first, then the other agents of the
local order in their order; otherwise the effective order is the local order. It passes that order
to `selectAgent` of `engine/lib/agent-usage.ts`. The default choice takes the first included host
with no active block; an explicit choice keeps its host and ignores the preference. The preflight
and the plugin revision check of the selected host run after this selection. A missing executable
or another setup error of a preferred agent stops the start, and no next agent is tried; the
remedy is a local exclusion of that agent, which then wins. Each step session gets a
usage attempt. A Claude step gets attempt-local `Stop` and `StopFailure` callbacks through
`--settings`, beside its `--session-id`. A Codex step is read through `thread/read` and
`thread/turns/list` after the daemon saves its verified ID. The daemon acts only on the
observation of its own attempt, also when the shared record keeps a newer attempt.

**Usage-limit recovery.** Only a daemon-owned step with the default choice continues on another
agent. A confirmed refusal of an explicit host is recorded; that session stays open, and no other
agent starts. After a confirmed refusal of the default host, the daemon:

1. Saves the block, writes `<git common dir>/celetis/recovery/<n>.json` (schema 2, with the key `daemon`) with the state
   `recovering`, and stops the job of the step end.
2. Ends only its own attempt (`endOwnedAttempt` of `engine/lib/quota-recovery.ts`). The barrier
   gives the host `CELETIS_ATTEMPT=<attempt id>`, and each child inherits it. For Claude, the
   daemon records three groups: the process tree under the barrier, each process with that entry
   in its environment (not in its arguments), and each process on the tab's controlling terminal
   outside the tab shell's own tree. It sends `/exit` and reads the groups again until the barrier
   and every recorded process are gone, for at most 20 seconds. So a writer that left the tree, as
   with `cmd &` or `nohup`, still counts. A session with no controlling terminal (`ps` shows none, `?`, or `??`), a missing
   marker, a failed process read, a native dialog, or a process that still runs at the deadline is
   `unverified`, and the line names the running PIDs. Codex, and each host on Windows, have no
   proved termination path, so their result is always `unverified`. The check cannot see a
   process that leaves the tree and the terminal (a new session) and whose environment `ps`
   cannot show: one that clears the entry, or a macOS platform binary such as `/bin/sh`. The check
   accepts Linux terminal names (`pts/<n>`), but no Linux run has proved it.
3. On `unverified`, starts no other agent. The session stays in its tab and keeps the issue lock.
   The daemon stops with
   `daemon: #<n>: <reason> The daemon cannot prove that the <host> session and its delegated work stopped: <cause> (running PIDs: <PIDs>). No other agent starts. The session stays in the tab <tab>; its native resume from the main checkout: <command>`.
4. After proof, archives the session record ("Sessions"), prints the native resume command, and
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
([the lane worktree](procedures/worktree.md)). A normal end of a session removes the recovery
record. The next step computes its own effective order, so a recovered preferred host takes the
next step.
A preference change or a recovered block does not stop a session that works.

**A session that ended while no daemon ran.** The master daemon ("The takeover") applies the same
steps to a usage block that it reads after the session ended, with another proof in step 2. The
barrier is gone, so the daemon sends no exit request, and the process tree under the barrier is
gone with it. The run record keeps the PID of the tab shell and the terminal name of the barrier.
The daemon starts a control child (Bun, alive until the proof ends) with a new `CELETIS_ATTEMPT`
value and requires the environment read to show it. Then it reads two groups: each process with the
attempt marker in its environment, and each process on the recorded terminal outside the tree of
the tab shell. A failed process read, also the first read of the process table, reads again, for
at most 20 seconds in total; then the result is `unverified` with
`the process table could not be read`. A group process that runs gives `unverified` with its PIDs;
no such process gives `quiescent`. A record with no tab shell or terminal, a control child that the
read does not show, or a control child that ended before a read showed it gives `unverified`. The
limits above stay: the proof cannot see a process that left the terminal and whose environment `ps`
cannot show. When the barrier of a live refusal in the daemon ends before step 2 reads it, the
daemon uses the same proof, and its first failed read of the process table reads again in the same
way. The daemon records no tab shell, so its result there, and after a failed first read, stays
`unverified`.

**Exhaustion.** In one cycle, the daemon attempts each included host at most once. When no host can
start, it keeps the issue lock, writes the state `waiting` with a new wait ID, and prints:

```text
daemon: #<n>: all default agents are limited (<host>: <reason> Reset: <ISO time or unknown>; …); <the run waits until <ISO time> or no reset is known>. Retry: celetis run retry <n> <wait id>
```

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

**A stop.** Before a stop, the session sorts each act that the stop would ask of the maintainer
([The check before a stop](procedures/stop.md#the-check-before-a-stop)): it does the agent work,
asks a live question for an answer in words, and makes a hold only for an act outside the session.
A live question waits in the tab of the session; the board shows it in Needs you, and the
maintainer answers in the tab or with Go. A step session hands a stop that is not a question to
the issue (rule 4 of the step text), through the write command
`celetis --agent <host> issue`
(`docs/issue-tracker.md`, "Conventions"). The reason is a comment: the comment that its skill
posts for the stop (`## Landing refused`, `## Before landing`), else a comment with `## Stopped` as
its first line. When the skill adds no label for the stop, the session then adds `ready-for-human`
as its last act. Both `stopped` and `ready-for-human` remove `ready-for-agent` when present;
`stopped` posts its reason first. A successful hold leaves only the human readiness label, so the
line becomes `stop #<n> is ready-for-human. …` and the job ends the session. A stop for which
the skill adds a label, such as the `needs-info` stop of `/celetis:triage`, stays as the skill says.
A question is not a stop: where a skill says to ask, rule 2 holds, and a session that asks for a
decision waits in its tab. The `detect` scenario of a web UI change is the exception of rule 5:
when `impeccable` is missing, the session prints the one line of
[design.md](procedures/design.md#missing), and the scenario is no stop. Before a Verify scenario
that cannot run becomes a `## Before landing` stop (rule 5), the session applies
[Usage-limit exception](procedures/runtime-verification.md#usage-limit-exception).
An eligible decision retains BLOCKED results and permits the normal landing path without a new quota hold.
Otherwise the session does not land the change. The act `before-landing` posts the comment,
then adds `ready-for-human`, then removes `ready-for-agent`. The comment records the change as
built. A failed human-label addition, or an interruption before that addition, can leave the
comment with no `ready-for-human`. The line then becomes `stop #<n> has an open human step. …`
(the `human-step` stop): the absence of the label is no evidence that the human step is done, so no step starts. Do
the act that the line names. The precondition comment preserves build completion even if a
label write fails. A plain stop records no completion: after its clearance, an unfinished plan
resumes the build without requiring the agent label. A `specify` session and a session that you
start by hand have no step text: at such a stop they show the message and stay open (ADR-0011).

After a stop with `ready-for-human`, complete its current requests and evidence, then start the
normal step again. Assistance can perform permitted work and clear a verified hold through
`issue <n> assisted <file>` by [Assisted completion](procedures/assisted-completion.md). It asks
only for missing human contributions and returns the actual resolver step without starting it.
A `## Stopped` or `## Before landing` comment names the act. For a refused landing of
`/celetis:implement` or `/celetis:chore`, fix a cause outside the change (for example, run the
failed job again, or land a chore that removes the advisory of a dependency): the next run of the
step fixes a cause that the change made, lands the change, and does not build it again. For a Verify
scenario, the act is a run of the scenario with the source and running-target proof defined in
[Runtime verification](procedures/runtime-verification.md), "Reports and deferred checks".
The next `/celetis:implement` run checks that evidence and its lifetime before it can land the
built change. Label removal clears a workflow hold; it supplies no runtime proof. Missing or
invalidated proof preserves the built change and restores the existing hold.
The usage-limit exception preserves existing completion requirements, including with `open: none`. A comment that names an act of "During the build",
or a comment with no marker of its kind, also needs a `## Human steps done` report of the act.
After a FAIL, keep the label: put the result on the issue, run
`/celetis:plan #<n>` in a session of your own, and remove the label when the new plan is on the
issue. Re-entry requires completion evidence for the current build: a later
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

**The human acts of a plan.** The plan names them in its first section, `### Your steps`, in three
lists: "Answers before the build", "During the build", and "After the landing". Before it publishes
the plan, the plan step asks you each consent that a Verify scenario or the landing needs: an act
that disturbs your live tools, changes an account or a shared resource, or sends data to a service
beyond the normal use of the session. An act on temporary data in the lane or in a scratch folder
needs no consent.
"Answers before the build" records each answer and its source (your message in the plan session,
with its date). The build uses that answer and does not ask again. "During the build" holds only
acts outside the session, never a consent. Do each act of "During the build" while the build runs,
and report the acts in one `## Human steps done` comment. Assistance can record verified work and sourced human answers with that same heading;
the heading denotes completed steps, not human authorship. A build that needs an act with no report runs each other scenario. Then it stops with one
`## Before landing` comment that names each such act, its report form, and the scenarios that wait
for it. The act `before-landing` gives that comment the marker of "During the build", so the engine
needs both the report and the removal. Post the report, then remove `ready-for-human`: the next
run of `/celetis:implement` runs those scenarios and lands when the runtime procedure permits continuation. A check of "After the landing" is no stop. The last message of
`/celetis:implement` quotes it after the landing.

A `specify` session starts with the line `run /celetis:feature #<n>`. The paths of `specify` give
three lines that end it: `run /celetis:plan #<n>` (the spec is on the issue),
`stop #<n> is an epic. Each child runs its own flow.` (the scope check made the issue an epic), and
`stop #<n> is closed as wontfix.` (`specify` rejected the design). While you answer its questions,
the line stays the same, and the session stays open. A session that ends while the line is still
`run /celetis:feature #<n>`, as after a spike, is "no progress". A lane change in step 1 of
`/celetis:feature` moves the line too, for example to `run /celetis:bug #<n>`: the session ends at
its next idle moment, and a Run press starts that lane.

**A landing.** Before `land` puts the change on the trunk, the step curates the lesson queue in
the lane (`docs/procedures/lesson-curation.md`, "Curation at a landing"): a fresh reviewer child
decides at most the five oldest pending proposals, its lesson commits land with the change, and a
curation failure does not stop the landing. A run of `land` again after the change is on the
trunk curates nothing.

The master daemon of the repository runs the landing ("The master daemon"). `land` is its client:
it checks `--agent` and the form (exit 2 with the usage line; the issue number is a safe integer),
refuses Windows with `land: prerequisite: Windows is not a support target` and exit 3, refuses a
folder with no Git checkout with `land: usage: celetis: need a Git checkout` and exit 2, finds the daemon
of the Git common folder of its folder, and sends one `POST /land` with `--agent`, its
`CELETIS_AGENT`, and the top-level folder of its checkout. It writes each `out` record to its
stdout and each `err` record to its stderr at once, waits with no time limit, and exits with the
last `code`. It runs no Git or GitHub act of the landing (it runs `git rev-parse` to find its checkout), no suite, and no lock, and it never sends the request
again by itself. Each act of the landing, the suite, and each `git` and `gh` call is a part or a
child of the daemon process, and they get the environment of the daemon ("The master daemon"),
not of the shell of the client: for example the `PATH` to the tools of the suite comes from the
shell of `celetis daemon start`, and a `GH_TOKEN` of the shell of the client does not reach the
landing. `PORT` of that shell is the exception: only the board reads it, so no landing gets it. For
the host `codex`, the landing sets `CODEX_HOME` of the daemon as a `codex` run does.

The daemon keeps one line of landings and runs the landing at its head only. A request that comes
while another landing runs, or waits, goes to the end of the line and writes
`land: #<n> waits for the landing of #<m> in the daemon PID <pid>` first (`<m>` is the landing at
the head of the line, the one that runs), then only the heartbeat until its turn. A waiting landing holds no lock and does no Git
or GitHub act, so the resolver does not see it (below). A request for an issue whose
landing runs or waits waits behind it too, and then runs as a new `land` would run after it: it
finds the change on the trunk and completes the cleanup, or refuses as `land` refuses. So the
second landing of a repository reads the trunk after the first moved it, and a branch that does not
contain the new head ends at its start with `land: repair: …`, exit 4, not after its suite. A
waiting landing whose client goes away leaves the line, with the status 143 for the client. At a
stop of the daemon, each waiting landing ends at once with `land: blocked: the daemon stops; start
it again, then run celetis --agent <host> land <n> again` on stderr and the status 6.

The landing takes the lock ref `land-<n>` with an owner of its own, whose record names the daemon
and no session, and it releases the lock at its end with each status, also after an abort or an
error, while the daemon lives. A failed release is tried once more; a second failure prints
`land: warning: cannot release the lock land-<n>: <cause>; restart the daemon: celetis daemon
stop, then celetis daemon start` on stdout and keeps the status of the landing. A daemon that dies
during a landing leaves a ref whose daemon is gone, and the next landing takes it. When another
live process holds `land-<n>`, the landing does nothing:
`land: prerequisite: the lock land-<n> has the owner PID <holder>; wait until that landing ends, then
run celetis --agent <host> land <n> again`, exit 3.

The client that goes away (a signal, the time limit of a background command, an ended session)
aborts the landing, as a stop of the daemon does ("The stop"): the landing stops at its next check,
as `land` stopped on a signal before. A running suite gets SIGTERM, and SIGKILL when it still runs
10 seconds later. Before the push it ends with no change on the trunk and the
status 143; after the push it ends with 7 and its cleanup line. Its last lines go only to the
daemon log, and the client exits 128 plus the number of its signal. At a stop of the daemon, the
client prints the last lines of the landing and exits 143, or 7 with the cleanup line. A client
that gets a signal after the push prints nothing more and exits 128 plus the number of its signal;
the cleanup line goes only to the daemon log, so a 128+n can come before or after the change is on
the trunk, and a new `land` completes it. Known limit: a client that stops reading its stream for
about 10 seconds while output is unread (for example a suspended client) makes the socket server
time out its request, which aborts the landing as a lost client does; a new `land` completes it. A stream
that ends with no `code` line (a killed daemon, a lost socket) has an unknown outcome: the client
prints `land: blocked: the daemon ended the landing of #<n> with no status: <cause>; read celetis
daemon status, then run celetis --agent <host> land <n> again` and exits 6. A new `land` finds the
change on the trunk, or lands it.

`celetis --agent <host> land` moves the line of the issue when it merges, and it then closes
the child and checks parent acceptance before it removes the worktree. While it runs, `celetis --agent <host> next-step <n>` prints
`stop the landing of #<n> runs; wait until celetis --agent <host> land ends`: the resolver reads
the holder of `land-<n>`, and a process read that fails keeps the landing. That line is the stop of an
observation, not a stop of the issue, so the job does not end the session. An agent that waits
for a background command can end its turn and report `done` or `idle`. So while the script
runs, for up to 30 minutes, the board can show the session in Needs you as `turn ended`: do not
leave that session. If a session ended during a landing, wait until `celetis --agent <host> next-step <n>` prints
another line, and then run `celetis --agent <host> land <n> '<subject>'` again from the main checkout: it
completes the landing. After the merge the issue is finished, so Run and
`celetis --agent <host> run <n>` start nothing, and no card shows the lane worktree and the branch
that stay. `celetis --agent <host> worktree --remove <n>` also removes them after the merge of the PR; it
does not close the epic.

After the child closes, `land` validates the parent's full issue URL. Automatic completion stays
in the active repository. A parent in another repository stays open; the command prints its
canonical URL and directs explicit acceptance from that repository's main checkout. For a local
parent, `land` uses the shared completion guard with no acceptance submission.
An independent epic closes only when its declaration is valid, its complete child
list is nonempty and closed, and no hold or open human precondition remains. A combined or
unresolved parent stays open; the command names the parent and `/celetis:accept-epic #<parent>`.
Pending acceptance writes no comment and sets no hold. A parent read or completion failure
prints a warning and child cleanup continues. A repeat uses the same guard and does not add a
duplicate completion record.

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
| 0 | none | landed | `land: #<n> is on <trunk>`; also with a warning, for example `land: warning: cannot read the parent of #<n>: …` |
| 1 | none | an internal error of `land` | an unexpected exception; the 500 answer of the daemon, with its line |
| 2 | `usage` | usage | bad arguments (the line starts with `usage: `); no Git checkout; a run from inside the lane worktree; a dirty lane worktree; no lane branch; nothing to land; an invalid configuration; a refusal of the request by the daemon with code 2, with its line (for example the 400 usage line of the requests, or the 413 line of a subject that makes the body more than 16 KiB) |
| 3 | `prerequisite` | the issue is not ready to land | the refusals of the paragraph above; Windows; another live holder of `land-<n>`; no daemon (`land: prerequisite: no daemon runs for this repository; start it: celetis daemon start`); a daemon at another revision (`land: prerequisite: the daemon runs the program at <revision> and this program is at <revision>; restart it: celetis daemon stop, then celetis daemon start`) |
| 4 | `repair` | the lane needs a repair | a conflict with the trunk; a lane branch that does not contain the head of the trunk; a trunk head, a lane branch, a lane checkout, or a PR that changed during the landing; a missing lane worktree with the landing `merge`; lane lessons that do not validate |
| 5 | `checks` | a check is not green | a failed CI check, also after its re-run; a failed `suite` with the landing `merge` (`docs/configuration.md`) |
| 6 | `blocked` | an external block | GitHub does not answer or refuses an act; a fetch or a push fails; the checks did not finish; no check ran; the main checkout is dirty, off the trunk, or with commits that the trunk does not have; the landing mechanism or the default branch changed; two branches or two PRs match; an incomplete lesson transaction (`lesson-store recover`); a lesson lock that stays busy for 10 seconds; a daemon that cannot be read (`land: blocked: the daemon of this repository does not answer: <reason>; read celetis daemon status`); a request during a stop of the daemon (`land: blocked: ` and the 503 line); a landing that waits in the line when the daemon stops (`land: blocked: the daemon stops; start it again, then run celetis --agent <host> land <n> again`); a stream with no status (the line above) |
| 7 | `cleanup` | landed, the cleanup stopped | the change is on the trunk, and the removal, the pull of the main checkout, or the close of the issue stopped, also by an abort: run `land` again |
| 128+n | none | a signal | a signal to the client stopped `land`, and the daemon aborted the landing (after the change is on the trunk, a new `land` completes the cleanup); 143 also for a stop of the daemon before the change is on the trunk |

## Gates

Each step has a gate. An `auto` step starts by itself. A `me` step starts with an explicit
single-issue start, an Add to an empty queue, or Continue for its displayed queue step. The step is
the command of the `run` line with no prefix: `triage`, `bug`,
`chore`, `hotfix`, `plan`, or `implement`. One command has another step name:
`run /celetis:feature #<n>`, the line of an `enhancement` with no spec, is the step `specify`.

`gates` in the main checkout's `.celetis.yaml` holds the project gates. Each omitted step is
`me`. The only values are `me` and `auto`; a wrong value stops the command. Git gate settings
have no effect. The default gates start one step for each number or Run press. With `specify`
as `auto`, the daemon starts a design session and waits for your first answer.

```yaml
landing: pr
gates:
  implement: auto
```

## The config and the custom parts

**The config.** Operational settings are in the main checkout's `.celetis.yaml`, including when
commands start in a lane or subfolder. `docs/configuration.md` gives the full schema. The record
of setup, `.claude/celetis/wiring.json`, is no config: only `celetis --agent <host> setup` reads it.

- `agents` names a preferred agent for each step ("The agent of each start").
- `gates` selects `me` or `auto` for each step ("Gates").
- `landing` selects `pr` or `merge` for `celetis --agent <host> land` (`docs/issue-tracker.md`).
- `board.port` selects the board port ("The board").
- `codexProfiles.<runtime>` supplies an optional dispatch profile for model tiers
  (`docs/capability.md`).

A missing or invalid required config stops before branch or worktree changes, locks, runtime
state, host sessions, or landing pushes. A public command creates an immutable operation after
the program starts it. Internal calls receive its values instead of reading again.
The daemon creates a fresh main operation before each new step. Its resolution, gate decision,
and session start use that operation. It retains the original host-selection inputs, so a changed
local order or `agents` field can select the agent of the next new session: a new step, or a
recovery cycle of a step. A running session keeps its captured host and exact identity.
Monitoring can refresh status separately; a monitoring config error is reported after the active
child exits. Resume uses the recorded host and exact session ID; a changed default
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
in the lane before setup. `worktreeSetup: "scripts/worktree-setup.ts"` selects a normal
root-relative TypeScript file. The value uses `/` separators and a case-sensitive `.ts` suffix.
It rejects absolute, rooted, drive, and UNC paths; backslashes; colons; empty, `.`, `..`, and
`.git` components; U+0000–U+001F; and U+007F. Accepted characters stay exact, with no trim,
expansion, splitting, or code interpretation. Omission or exactly `""` means no setup. Null,
whitespace-only text, inline code, and wrong types fail validation.

Immediately before a run, the target must be a readable regular file inside the canonical
target checkout. Final or ancestor symlinks below that root, directories, special files,
outside targets, nested repositories, submodules, and other worktrees start no setup child.
A canonical alias of the root is accepted. A config read checks only reference syntax and
performs no script access. Entry never reads or executes that file. Normal sibling imports
work; transitive imports have no added restrictions. The trusted-checkout boundary is not a
file-swap transaction.

The selected Bun runs the file directly, with its source identity intact and cwd at the lane
root, also after a subfolder invocation. It needs no executable bit or exported-function API.
`process.argv[2]` is one absolute main-checkout argument. Stdin, stdout, and stderr stay
inherited. Product `.env`, Bun configuration, preloads, macros, automatic package installation,
and transpiler cache stay disabled. Check each external command status and stop on failure.
After nonempty setup output, the command prints an LF separator and the final absolute lane
path. `setup try` also prints its path after preparation or execution failure and returns the
child status. `worktree` and `setup lane` map setup failure to exit 6. Signals stop the owned
child.

The setup skill shows the proposed relative path and complete contents for review. The product
owner approves, creates, and commits the entry and required helpers on the local trunk in a
separate product change before the detached wiring test. `try` and `write --setup-file <path>`
require that entry in local trunk HEAD, with an unchanged index and working file. The option
resolves from the main root. Setup writes only the reference; it creates, copies, stages, owns,
commits, and pushes no application source to make its test possible. A changed failed proposal
needs another owner source commit before retry. An existing reference, including `""`, stays
unchanged. A conflict prints `setup: warning: .celetis.yaml: worktreeSetup differs from the requested setup reference; setup leaves it`.

A failed setup or invalid new lane config prints `worktree setup failed:` and removes a new
worktree and a branch created by the command. Configuration validation exits 2 after cleanup;
a failed setup script and a Git failure exit 6, and a conflict with the trunk exits 4. An existing branch or worktree
stays for repair and retry. A refused update of an existing branch prints its own reason, not
`worktree setup failed:`, and uses the same cleanup. Entry into the target lane creates a fresh
operation before setup or marker acceptance. Setup validates again after it writes or selects a
different file.
The marker remains `<git dir of the worktree>/celetis-setup-done`. The command writes it
only after a nonempty reference succeeded, including a zero-byte file. With exactly `""` or
missing `worktreeSetup`, it writes no marker. It runs setup again in an unmarked lane, so a
reference that a merge of the trunk brings runs at the next entry. A marked lane still needs
valid config; source edits do not clear its marker. Explicit
`celetis --agent <host> setup lane <path>` selects the reference from main, clears the old marker
before file validation or execution, and runs the target lane's file. An older lane that lacks
the entry or a required helper needs the owner to bring that committed source into the lane.
There is no source copy, automatic merge, or loader fallback. Reading config in another command
never executes setup. Main supplies operational policy, the target lane supplies executable
setup, and the active checkout supplies only the selected `custom.<skill>` at entry
([ADR-0032](adr/0032-shared-configuration-operation-snapshots.md)).

**A custom part.** `custom.<skill>` in the active checkout's `.celetis.yaml` holds an
addition to that skill's procedure, for example a check on a real device after the build. It
reaches only the invocation of that skill: `chore` does not apply `custom.implement`, and
`lesson-review` does not apply `custom.lesson`. A product fact that two or more skills need goes
into the `AGENTS.md` of the product. The text cannot remove a general rule. An added act comes
before the skill moves the line of the issue, because the daemon ends the session when the issue
shows that the step is done. Domain knowledge stays in the `AGENTS.md` files (ADR-0006).

**The entry.** Each `SKILL.md` holds one entry line: bind `<plugin>` from the path of the loaded
skill, and read `<plugin>/docs/procedures/entry.md` before any step or answer. On Claude Code,
the native hook (`engine/hooks/entry.ts`) puts a facts block in place of that line before the
model sees the skill. It makes its own permission-checked `Read` of the Git boundary and of the
whole config, parses and validates the text with the configuration code of the engine
(`engine/lib/config-core.ts`), and gives the host, the plugin root, the checkout, the contract
of `docs/procedures/entry.md`, and the custom text of the skill. It gives no host manual and no
raw YAML. On Codex, and on Claude Code when the hook did not run, the session follows "Entry
without the hook" of `docs/procedures/entry.md`: Codex with a shell runs the config reader; else
the session reads the file natively and applies a short rule list. Each command that needs the
config validates the whole file before protected work. Entry executes no setup and consumes no
runtime snapshot (ADR-0013, ADR-0032, ADR-0047). `docs/configuration.md`, "Skill entry", and the
host references in `docs/hosts/` give the details.

- **Which checkout.** The nearest folder at or above the active binding with a `.git` folder or
  file, so a linked checkout counts. A step that the daemon starts runs in the main checkout. A later skill
  entered in a lane uses that lane's config. Read no parent config and combine no files.
- **With no checkout or config,** continue with the common skill. Omitted or empty custom
  values also give no addition. An existing invalid, ambiguous, unreadable, or symlink config
  stops entry with the file and field.
- **When file access needs approval,** request it through the normal controls. A denied read
  stops; no other tool, shell, parser subprocess, or cached copy follows.
- **Each invocation is a new entry,** also a same-session handoff and an invocation in a child
  agent, with its own checkout and its own custom text. No skill reads another skill's
  `SKILL.md`. After the entry, a step that needs another value of the config reads it at that
  step through the config reader.

## The board

The board is `engine/board/` of the plugin, a part of its engine. The master daemon serves it in
its own process, and the board reads the data of the issues there with the typed functions of the
engine. Run, Resume, Retry, and each queue action are one request of that daemon; and New intake,
Assist, and Open shell open a new tab of the Herdr app with
a fixed argv. It has no config of its own: the main
checkout's `.celetis.yaml` gives `board.port` at the start of the daemon and `gates` at each read. ADR-0020 makes the board a
part of the plugin, ADR-0035 makes it a part of the engine, and ADR-0058 gives its sessions to
herdr-core and its tabs to the Herdr app.

**Requirements.** Bun 1.4.4 or later; Git 2.31 or later; herdr-core 0.1.16 (`hc`) and its
running server; the Herdr app 0.1.11 (`herdr-app`) with its window open; and a Chromium browser.
The board reads GitHub with `gh`, as the daemon does, and needs no GitHub credentials of its own.
The read needs `gh` (logged in), `git`, and Bun, and `ps` on macOS and Linux. The board runs only
in the master daemon, so the requirements of the daemon apply ("The master daemon").

**The start.** `celetis daemon start` starts the board with the daemon ("The master daemon", "The
start"). `celetis daemon start` and `celetis daemon status` print its URL as
`daemon: board http://127.0.0.1:<port>`. With no daemon, nothing serves the board. The daemon
validates the main YAML at its start, and the board start checks no update policy: each run checks
the policy of its own host before it starts a session. The board records the program revision of
the daemon and starts an independent update check after it listens. Each press of Open agent or
Make visual reads the installed program at the press, and Run, Resume, Retry, and a queue action
go to the daemon ("Run and Resume"). The start writes two lines to the daemon log, with the tag
`daemon`, the main checkout and the URL:

```text
agent-board: repository /Users/me/code/shop
agent-board: http://127.0.0.1:4403
```

The listening port is `PORT` of the environment of the daemon, else the first free port from
`board.port` of the main YAML, else from 4403. It remains fixed until the daemon stops. This
repository uses 4404. `engine/board/README.md` gives each refusal of the start.

**The data.** Each refresh reads the data in the daemon process (`engine/board/data.ts`). It creates
a fresh main operation with no host selection, so the `CELETIS_AGENT` of the daemon selects no
host. It reads the typed rows of the
in-process resolver (`nextBoard` of `next-step.ts`), and the issue locks and the record through
`engine/lib/locks.ts`, the module of the daemon. Resolution and displayed gates
share that refresh's operation, and a change of `gates` in the main YAML shows at the next refresh.
Each board response separately reads the current local agent order and usage blocks, and it reads
the status object of the daemon once, in its process.
Each module of this path is a static import: a refresh loads no plugin
file, takes no plugin read lock, and checks no update policy. Independent update checks validate
the native update policy. A Run, Resume, Retry, or
queue action sends a request, and its run lives in the daemon. A
conflict can show in the update check. A startup stop of the run of a Run or Resume appears in the
card warning area.

A full collection makes these `gh api` calls: 2 paginated lists (open issues and open PRs),
one paginated call for the timeline of each open issue that has a comment, and 3 calls for each
open PR whose branch holds `/<number>-`. It gives each row the state that it knows from GitHub and
from the working trees: `blocked` with `reason` and `act`, `ready`, or `dirty` with `path`.
It also gives the `noRun` text for a dirty main checkout. The board adds what the daemon knows:
`starting` for a lock that a live script holds, `stuck` with its `act` for a row of the record, the
`step`, `started`, and `urgent` of each row, `tracker`, and `flow` with the gate of each step.
A full collection then sends the queue reconcile request `POST /queue/reconcile` to the master
daemon through the fixed adapter. The daemon reconciles the queue and starts a queue run that is
due. The request has a limit of 30 seconds inside the 60 seconds of the read. With a refusal, for
example during the takeover of the start of the daemon, or with no answer in that limit, the
collection uses the read view (`readQueueView`) and writes nothing; the next collection sends the
request again.

A selected collection reads each selected issue and its timeline, lists open PRs once, and
reads check and review details only for matching issue branches. It uses the same row rules,
checks only selected lane directories and the main checkout, and replaces or removes selected
rows in number order. Other rows stay unchanged. Closed issues, PR objects, and an explicit 404
from the initial issue request have no active row; a failed timeline or other request fails the
batch. Each batch refreshes the configuration, agents, and main dirty state. It sends the queue
reconcile request only when a selected issue is in the current queue, after
remote row and History reads finish. Existing ownership and launch rules remain authoritative.
It also reads once each distinct parent of the open selected issues that is in the same
repository, with `issues/<parent>` and no timeline; a 404 of that read gives no epic.

The server lists local refresh hints each second and selects newly seen issue numbers. Its first
listing seeds existing names before the initial full read. A disappeared session selects its
known issue, including at local requests; an unknown-issue session retains the nonlocal full-read
cause. Each board consumes hints independently. GitHub remains authoritative.

One full or selected read runs at a time. Hints that arrive after a read starts remain pending.
Full requests join an active full read or queue one after an active selected read, with priority
over subsequent selected batches. A failed full read restores its consumed targets; a failed
selected read waits for another cause. Before a good document exists, only full reads run.
The five-minute full-read schedule recovers direct GitHub edits without hints. Selected reads
change neither that schedule, the last-full-read timestamp, nor Assist session-start detection evidence.

A read has a limit of 60 seconds, and the stop of the board also stops a read. On a failure, the
board keeps its last document and shows one line after `cannot read:` on its status line:

- an invalid main YAML: the first line of the diagnostic of the config reader;
- a resolver that cannot read GitHub: the first line of the resolver's stderr, else
  `cannot read the issues from GitHub`;
- a read that passes 60 seconds: `the issue read did not end in 60 seconds`;
- another failure: the first line of its message, else `the issue read failed`.

A full read, or a selected read that finds a closed issue, calls `readHistory` once in
`engine/board/history.ts`. Other selected reads retain History. It reads remote repository metadata,
captures the default branch head, and walks pages pinned to that SHA. It stops at 20 distinct issue
identities or history exhaustion, preserving traversal order and the newest occurrence. Direct
Celetis squash subjects resolve to real issues. Associated merged lane PRs must match the commit's
merge SHA, trunk base, and both repository identities; their lane number and `Closes #<n>` must
agree. A nonempty PR association cannot fall back to a suffix, which can identify the PR itself.
Unsupported or ambiguous associations are omitted. Request and parse errors fail the whole read.
Closures and a 14-day window do not determine landing history. A later revert does not erase the
landing event; absence from the list says nothing about older history.

The History button follows Search and precedes Refresh. It uses the existing nonmodal card panel,
starts closed on each page load, and stays open through refresh. Card details and History exclude
each other. Escape and Close return focus to History. The count, `d`, and the search command use
the same panel. At widths below 1100 px or heights below 701 px it is a drawer, including on a
phone. Each semantic row has issue and commit links and accessible full commit identity/time.
`View <trunk>` opens older history. Each row has Make visual (Starting… while the press runs), Making… while its tab is open, or Open visual (`engine/board/README.md`,
"Landed history" and "The commands of the board"). Loading, empty success, and
initial error are separate states. Read failures preserve both cards and history with the visible
read error. A selected-read error takes priority over a full-read error. A good selected read
clears only its own error; a good full read clears both. The snapshot's `history` is null before a
good document.

The board runs the data and server code that the daemon loaded at its start. A board-approved
update restarts the daemon on the approved installed program ("The master daemon", "The restart").
A terminal-started `celetis update` still needs a restart of the daemon for new data and server
code: **Restart** in the board, or `celetis daemon stop`, then `celetis daemon start`.

The daemon checks at its start and every 10 minutes, in a worker child process, with one joined
check and a 120-second limit.
`GET /api/update` returns the update snapshot and `{revision, instance}` runtime identity.
`POST /api/update/check` takes exactly `{}` and starts or joins a check without waiting for its
result. `POST /api/update/start` takes exactly one opaque `offerId` string.
`POST /api/update/restart` takes exactly `{}`. These routes share the existing HTTP trust checks
and do not wait for issue or terminal reads. The browser supplies no program path, host, or
command.

A daemon of a version folder reads the installed program (`readProgram`, and `programSource` when
its revision differs) at most once each 5 seconds; `close` of the controller ends these reads. The
update view is `restart-needed` when the check result is `current` or `check-failed` and the
installed revision differs from the revision of the daemon. Its `target` is the installed
revision; `runtime.revision` stays the revision of the daemon. A failed read keeps the last view. An
installed revision equal to that of the daemon gives back the check result. An offer
(`available`) and the other phases take precedence; `update-failed` keeps its state until a new
check. A daemon of a checkout makes no such reads and never shows `restart-needed`. The page shows
**Restart needed** and opens its dialog by itself one time for each installed revision in the
tab; **Later** keeps the control state, and nothing restarts the daemon before a click.

`POST /api/update/restart` refuses with 503 and the stop line during a stop or a restart, and with
409 and `update: no restart is needed; check again` when the view, after a new read of the
installed program, is not `restart-needed`. Then it validates the installed program as an
approved update does (`installedProgram`); a failed validation gives 409 with its line and keeps
the daemon running. Else the view becomes `restarting`, and the route answers 202 with
`{runtime, target}`, where `target` is the revision that the successor runs. The daemon drains
that answer and restarts as after an approved update. A second request during that restart gets
503. The page takes its reconnect target from the answer, reloads once when that revision answers
from a new runtime instance, and shows the timeout after 60 seconds. It never sends the request
again by itself.

An approved start consumes one exact offer for one attempt. After complete validated success,
the update view of a daemon of a version folder stays `restarting`: the daemon drains its HTTP
start response, validates the installed program, and restarts ("The master daemon", "The
restart"). A failed validation keeps the daemon running and gives `update-failed` with the line of
the validation. The update view of a daemon of a checkout becomes `updated`, and the daemon keeps
running. The recovery line of the view is
`From <main>, run celetis daemon status; when no daemon runs, run celetis daemon start`. A failure
or stale offer needs a new check and decision; there is no automatic retry.

The board puts these values in the fields of its document (`Document` of `engine/board/types.ts`):

| Field | Value |
|---|---|
| `tracker` | `GitHub` |
| `flow.lanes` | The four lanes: `feature` (triage, specify, plan, implement), `bug` (triage, bug, plan, implement), `chore` (triage, chore), and `hotfix` (triage, hotfix). |
| `flow.stages` | Triage, Define (specify, bug, chore, hotfix), Plan, and Implement. |
| `flow.steps.<step>.gate` | The gate of each of the seven steps, by the rule of "Gates". |
| `flow.steps.<step>.hint` | `It lands the change when the build is done.` for `implement`, `chore`, and `hotfix`. No other step has a hint. |
| `noRun` | `The main checkout is dirty: <path>. Commit or stash first.` while the main checkout is dirty, else `null`. |
| `daemon` | Read at each response, not in the refresh: `{pid, auto}` of the status object of the daemon that serves the board, with `auto` `on`, `off`, or `stopping`. |
| `agents` | Entries `claude` and `codex`. Each has `available: true` and `cause: null` when its executable is on the `PATH` of the board, else `available: false` and `cause: "celetis: <agent> is not on PATH"`. |
| `history` | The remote trunk name, history URL, captured full head SHA, and up to 20 distinct landed issues. Each entry holds the issue number/title/URL and commit SHA/URL/committer time. |
| `queue` | A `QueueView` with the schema-3 record, live owner, resolver result, error, and Add/Edit/Continue/Retry permissions. A null record means no saved queue yet. |
| `issues` | One row for each open issue. An issue whose line of the resolver is the epic line or the `wontfix` line has no row. |

A row gets its `state` by the first rule that matches:

| # | The issue | `state` | Fields of that state |
|---|---|---|---|
| 2 | has a lock that a live script holds | `starting` | |
| 3 | has a dirty lane worktree | `dirty` | `path`: the lane worktree |
| 4 | has a row in the record for its `run` line: no progress, or a refused skip | `stuck` | `act`: `celetis --agent <host> run resume <n>` |
| 5 | has `needs-info` or `ready-for-human`, two or more lane labels, an open human step, or a hotfix to land by hand | `blocked` | `reason`, from the first match in the order of the resolver (`docs/issue-tracker.md`, "Resolving an issue's state"): `needs info` for `needs-info`; for `ready-for-human`, `landing refused` while a landing refusal is current, else `ready for your step`; `several lane labels` for two or more lane labels; `human step open` for a `## Before landing` comment with no completion evidence; `land by hand` for a hotfix whose stop is cleared. `act`: the act that the `stop` line of the issue names |
| 6 | has a `run` line | `ready` | |

Each `GET /api/board` reply reads the local agent state again and adds two fields. `picker` holds
`order` (the local order with its version), `usage` (the confirmed usage block of each host with
its reason and reset time, or `null`; a block whose reset time passed is `null`), `activeHosts`
(the hosts of the live sessions of the repository), `waits` (`{number, waitId, nextResetAt}` of
each issue whose live run waits because every included agent is limited), and `error`. `next`
is the decision of a new default start from the local order, with no step preference: `start`
with its host, or `wait` with the blocks and the
earliest future reset. A waiting issue shows as a `quota-wait` card in Needs you, not as running
work. A recovery record whose daemon no longer runs adds a warning to the card of its issue.

Each row also has `number`, `title`, `url`, `updatedAt` and these fields:

- `type`: the lane of the one lane label of the issue: `feature` (the label `enhancement`), `bug`,
  `chore`, or `hotfix`. It is `null` for an issue with no lane label, with two or more lane labels,
  or with `epic`, also in the row of an issue that stops.
- `step`: the step of the Run decision of the issue, the step of its `run` line ("Gates"), else
  `null`.
- `effort`: the effort level of that step, from the read of the resolver (`docs/issue-tracker.md`,
  "What lives on the issue", "Effort"): `level`, and `source` `decided` with `by` (the step before
  in the lane) and `reason`, or `source` `default` with the level `high`. It is `null` for a row
  whose line is not `run`.
- `started`: `true` when the step comes after the define step of its lane (`plan` or `implement`),
  because an earlier step of the lane ran.
- `urgent`: `true` for the type `hotfix`.
- `epic`: `{ number, title }` of the parent issue when the `parent_issue_url` of the issue is the API
  URL of an open issue of the same repository with the label `epic`, else `null`.
- `pr`: the open pull request whose branch name holds `/<n>-`, with its number, URL, draft state, CI
  result (`pass`, `fail`, `pending`, or `null`), and review state (`approved`, `changes`,
  `required`, or `null`); else `null`. For the review state, the last review of each reviewer that
  approves, requests changes, or is dismissed counts. The review state is `changes` when one of
  those reviews requests changes, else `approved` when one approves, else `required` when a
  requested reviewer or team has not answered, else `null`.

**Run and Resume.** Each press is one request of the master daemon that serves the board. The
fixed adapter gives it to the dispatcher of the daemon in the same process, with only these fixed
fields, and parses the answer ("The master daemon", "The requests"):

```text
POST /run {"number":<n>,"selection":<selection>,"effort":<level>|null,"quiet":true}
POST /resume {"number":<n>,"selection":{}}
```

The selection is `{"explicit":"<agent>"}` for an explicit agent choice of Run, else `{}`. The
board sends no `environment`, so the `CELETIS_AGENT` of the daemon selects no host. A `Run at <level>` entry of
the run menu sends the level as `effort`. The board starts no `celetis` command and no terminal
for Run and Resume, and the run uses the environment of the daemon. The daemon checks `hc` and the
Herdr app before its answer ("Requirements"), and it selects the saved session of Resume itself.
Each refusal of the daemon gives 409 with its line, for example
`daemon: the daemon takes over its runs; send the request again after its start` during the start
of the daemon, and the page shows `Run failed` or `Resume failed` above it.

The page sends Run and Resume with no timeout, and the board keeps the request open until the
answer of the daemon, so the card stays `Starting`. An accepted answer gives the run ID of the
press. An accepted answer with no run ID is a refusal with `daemon: the daemon sent no run ID`. A
press has no unknown outcome: the dispatcher gives each error of the daemon as its 500 answer, and
the press gets 409 with that line.

The board keeps one reservation for each issue, from the start of the press, so a second Run or
Resume of that issue gets 409. With a run ID, the board follows the run at each placement, after
the hc session list and the one status read of the placement. A session of the issue in the hc list,
or a row of the run with a session (`session` is not null), clears the feedback and ends the
reservation. A status that has no row with
the run ID gives `failed` with `The daemon PID <pid> has no run <first 8 characters> of this press.`
A row with an `outcome` and no session gives `failed` with the outcome reason, else the last
`line` of the run, else `The run <first 8 characters> ended with code <code> before a session.`
Each outcome counts, also `closed` or `gate` with code 0. Each `failed` feedback ends the
reservation and selects a read of the issue.
Else the card stays `Starting`. A read that started before the answer, or before the last read that counted, does not count. An observed session or a changed issue
decision clears the feedback. A same-step `starting` lock row is not a session. Assist keeps its
timed feedback.

The daemon then opens the session tab `#<n> <step>` in the space of the repository ("How a step
runs", "The session tab"). With `quiet`, the tab of a Run stays in the background, and the
current tab keeps the focus. The tab of a Resume comes to the front. The daemon gives each tab the
link label `celetis.link=#<n> <step>`, which links its session card to the issue. With the default
`me` gates, a Run starts one step, and its run ends when its session ends. The board has no
control that stops a run. `celetis daemon stop` stops the daemon and detaches every
run, and a session whose start barrier the daemon released stays open ("A stop of a run").

`POST /api/run` takes `number`, an optional `agent`, and an optional `effort`; another field returns
400. With `agent`, the request has the selection `{"explicit":"<agent>"}`, and the host is pinned
for that start, also when it is limited. The agent must be `claude` or `codex` and on `PATH`. With
no `agent`, the selection is `{}`, and the daemon run selects from the effective order of each step
("The agent of each start"). At admission the server reads the local order and the usage records again, and it
refuses with 409 when the first eligible host of the local order is not on `PATH`; it tries no
other host. The admission reads no step preference: the daemon preflight of the selected step
agent decides the start. When every included host is limited, the
run starts and waits. Unknown or unavailable choices return 409 and start no agent.
Availability checks only executable presence; sign-in, trust, plugin discovery, and full host
parity need separate checks. The `CELETIS_AGENT` of the daemon selects no host for the board
reads and does not pin a default start.

A `Run at <level>` entry of the run menu of a `ready` card sends `effort` with no agent choice.
The server accepts only `low`, `medium`, `high`, `xhigh`, or `max`; another value returns 400 with
`the effort is not one of low, medium, high, xhigh, max` before any read, and starts nothing. The
daemon starts that step at that level for this start only ("Start the script", "The effort
level"). On the current issue of a queue paused at a `me` gate, an `effort` returns 409 with
`The queue starts this step at the decided level`, because Run continues the queue there.

Resume sends the selection `{}`. It uses the host and exact ID in the saved record, even after the
local order changes.

Open agent and Make visual send no agent choice, and their argvs have no `--agent`. They refuse
with 409 when the first eligible host is not on `PATH` or every included host is limited.

**The agent order.** `POST /api/agent` takes exactly `{"order": [...], "expectedVersion": "<64 hex>"}`.
The order is a nonempty, unique list of `claude` and `codex`; another shape returns 400. The fixed
adapter runs `celetis agents replace` with the program entry and parses its output as external
input. Success returns `{"order": <AgentOrder>}`. A stale version returns 409 with `error` and
`latest`, the current validated order, and writes nothing. A repeated replacement that is already
saved returns 200 with the same version. The order lives in the Git common directory, so a change
dirties no checkout.

**Retry of a usage-limit wait.** `POST /api/run` with exactly `{"number": <n>, "waitId": "<uuid>"}`
gives `POST /retry` `{number, waitId}` to the daemon through the fixed adapter. The daemon wakes
the live run that owns that wait for one bounded attempt cycle and starts no run. A stale wait ID,
a finished wait, or a run that no longer runs returns 409 with the line of the daemon, as
`run retry` prints it. The board never sends a Retry again. A repeated Retry of a pending wake
changes nothing.

The board and its daemon run one program, so a press never meets a daemon of another revision.
An update approved in the board restarts the daemon by itself. After a terminal
`celetis update`, restart the daemon (`celetis daemon stop`, then `celetis daemon start`) to
load the new program for the runs and the board ("Start the script", "The answer"). A
terminal-started update keeps the daemon and its board open. Restart the daemon if a
terminal-started update removes a file that the board still needs. Follow
[Updates](../README.md#updates) for manual updates.
Real Run/Resume acceptance remains a separate live gate.

**Queue actions.** `POST /api/queue` accepts exactly `{"action": <QueueAction>}`, or for Add with an
explicit host `{"action": <QueueAction>, "agent": "claude" | "codex"}`. An Add with no agent records
the default order. Another action uses the choice of the saved record. The shared engine validator enforces
the continuous-queue contract. Host, Origin, JSON, and the 1024-byte body limit stay in force.

The fixed adapter gives `POST /queue/action` `{action, selection, quiet: true}` to the daemon
("The requests"). An Add sends the choice of
the press: `{}` for the default order, `{explicit: <host>}` for one host. Each other action sends
`{}`, and the daemon uses the recorded choice. The adapter parses the answer as external input.
Each queue action of the board, also a move and a remove, goes to the daemon. The HTTP
response is the QueueView of the answer; it does not await History or a session. The
board writes no queue record. When the action issued a wake, the daemon starts the queue run in the
same request and opens a quiet session tab `#<n> <step>` for each step; no command stops a queue
run. A refusal returns 409 with its line, and the board never sends a queue action again.

The browser supplies no executable or path. When the daemon refuses the wake of an admitted
action, it saves the failure in the queue record (`Fix the launch failure, then use Try again.`).
A stop of the daemon during the request (503) leaves the pending launch, which a deliberate Try
again recovers.

Run on the current paused issue uses Continue with the saved agent choice and fresh displayed step.
An explicit host refuses when the saved choice is default or names another host. The board
disables those explicit Run actions; the server checks the choice again before Continue.
Waiting edits remain available during runs and stops.
The current run never transfers explicit authorization to another issue.

`GET /api/queue` reads authoritative state without a full-board refresh. After a stale or lost
response, the browser reads state before another deliberate attempt. It merges acknowledged
and polled queue revisions and keeps the last good list on a failed read. Pending admission,
saved/starting, and verified running are separate states. Only existing session observations
prove running. A refresh carries no wake: its reconcile request starts a due queue run in the
daemon. A full-read error disables queue actions until a full read
succeeds. A selected-read error alone does not disable them; queue-specific restrictions remain.
The hint timer reads local files, with no second remote poller.

**The page.** [`engine/board/README.md`](../engine/board/README.md) of the plugin holds the page: the
columns and the card of each state, the layout, the keys, the buttons Run, Resume,
Open shell, and Go, the errors, the start refusals, the HTTP API, the trust boundary, and the limits
of the page.

## What the script prints, and your act

| The script prints | The maintainer's act | Then |
|---|---|---|
| `stop … needs info` or `stop … ready-for-human` | do what the line says; for `ready-for-human`, the latest `## Stopped` or `## Before landing` comment names the act, and "How a step runs", **A stop**, gives the act after a refused landing. The card of an issue with a current landing refusal reads `landing refused`: its `## Landing refused` comment names the cause | the next step starts with a Run press or with `celetis --agent <host> run <n>`; auto mode starts it only when its gate is `auto` |
| `stop … has several lane labels …` | keep one lane label and remove the others | as the first row |
| `stop … has an open human step. …` | do what the line says: the latest `## Before landing` comment names the act. The line names the evidence that is missing: a `## Human steps done` report and the removal of `ready-for-human` after the comment, the report, or the removal (`docs/issue-tracker.md`, "Completing a human precondition") | as the first row |
| `stop … waits for a landing by hand. …` | run `land` in your own shell, from the main checkout, as the line says | none: the landing finishes the issue |
| `stop … is an epic` | none: each child is an open issue with its own flow | — |
| `stop … is finished` or `stop … is closed as wontfix` | none | — |
| `stop the working tree is dirty …` | commit or stash | as the first row |
| `stop the landing of #<n> runs …` | none: a session lands the issue | start the script again when the landing ended |
| `stop cannot read … from GitHub` | check `gh auth status`, the network, and the REST rate limit (`gh api rate_limit`) | auto mode tries again by itself; press Refresh on the board |
| a `me` gate | a Run press on the card, or `celetis --agent <host> run <n>` | — |
| `no progress: /celetis:feature #<n>` | the session ended with no spec on the issue: open the session again, or read the comment of a spike | a Run press, or `celetis --agent <host> run <n>` |
| `no progress:` with another command | open the session again, or read the issue | a Run press, or `celetis --agent <host> run <n>` |
| `#<n>: <T> skips <steps> after <S>; …` | read the issue ("A refused skip"). When a label or a heading is wrong, fix the issue. When the skip is correct, start `<T>` by hand | a Run press, or `celetis --agent <host> run <n>`, starts the next step; auto mode does not start a refused step |

A Run press sends the request of `run <n>` to the daemon, which answers at its first decision. The
CLI prints a line of this table only when the run ends at its first decision or is refused. Else the
line is the `line` of the row of `celetis daemon status` and a line of
`<git common dir>/celetis/daemon/daemon.log`. Read the state on the issue card; a startup stop
appears in its existing warning area after the board reads the outcome of the run in the status of the daemon. "The board" gives
the state of each issue, and `engine/board/README.md` of the plugin gives the card of each state.

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
requests outside its sandbox; they do not create a stronger sandbox. A host refusal that the
maintainer cannot lift in the session remains a stop
([A Verify scenario that cannot run](procedures/stop.md#a-verify-scenario-that-cannot-run)).
The deterministic script checks and final Verify results remain required (ADR-0008),
subject only to [Usage-limit exception](procedures/runtime-verification.md#usage-limit-exception)
for incomplete host checks. The exception changes no engine guard or existing human hold.

## Sessions

The hc terminal of each session tab, also a resume tab, has the label `celetis.link` with the
value `#<n> <step>`. It links the live card to the issue on the board. The label and the tab name
are not the saved session ID. From the main checkout, `celetis --agent <host> run resume 402`
asks the daemon to resume. The daemon run first takes the shared issue lock and keeps it until the
session exits. Under that lock, it reads and validates the current record for #402 and opens its exact host and session ID at the
level of the record: Claude gets `--effort <level>`, and Codex gets
`-c model_reasoning_effort="<level>"`.
No completion job or update runs during resume.

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
([ADR-0058](adr/0058-herdr-core-hosts-the-agent-terminals.md)).
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
local. It has no network part. [ADR-0066](adr/0066-one-shared-event-record-with-a-lock.md) holds
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
| `command` | The sub-command name, or the role of a process with no sub-command: `launcher`, `config-reader`, `session-start`, `update-worker` |
| `argv` | The arguments of the process after the sub-command name |
| `cwd` | The absolute working directory |
| `host` | `claude` or `codex` from `--agent`, then `CELETIS_SESSION_AGENT`, then `CELETIS_AGENT`, else `null` |
| `revision` | The full revision of the running program, or `null` when it is not known |
| `pid` | The process ID |
| `issue` | The issue number when the site knows it, else `null` |
| `code` | The exit code of an exit entry, the HTTP status of a board entry, else `null` |
| `message` | For a defect, the message of the error. For a refusal, the text that the process itself wrote to stderr. For a workflow entry, the line that the site printed or returned; for `land-exit`, the last line that starts with `land: ` among the writes of the landing itself (not of its suite), or an empty text when it printed none |
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

These processes record: each sub-command, the launcher before it replaces its process, the config
reader (`engine/lib/config.ts`), the session-start child of the daemon, and the update worker of
the board. These do not record: `build`, `verify`, `install-tools`, `events`, a product script
that a Celetis process runs, the `bun --eval` helper, and the host sessions. A child process
records its own failure. A parent that passes on the exit code of a child unchanged (`passOn`)
records nothing. A parent that turns the failure of a child into a new error of its own records
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
| `exit-timeout` | A session does not exit within 10 seconds. `issue` is set |
| `issues-read` | Auto mode cannot read the open issues from GitHub |
| `queue-error` | The queue of the daemon saves the state `error`, or ends with an error |
| `run-exit` | A run of the master daemon ends with a nonzero code. `issue` and `code` are set |
| `run-defect` | A run or auto mode of the master daemon ends with an unexpected error. A defect with its stack |
| `land-exit` | A landing of the master daemon ends with a nonzero status, also 143, and no unexpected error. `issue` and `code` are set |
| `land-defect` | A landing of the master daemon ends with an unexpected error. A defect with its stack. `issue` and `code` are set |
| `board-request` | A board request ends with status 500. A defect with the stack of the cause. `code` is 500 |
| `board-terminal` | A board request ends with status 502 because the terminal core failed. `code` is 502 |
| `board-update` | The board cannot replace the program in an update, or it cannot restart after a completed installation |

The daemon records a line once for each printed line. A no-progress stop in the queue gives both
`no-progress` and `queue-error`. A board request with status 4xx is a result, not a failure, and
the board health reads are state that the board shows, so neither is recorded.

The board does not stop a repeated failure. Each repeat is one more entry with the same
fingerprint:

- The board checks for an update when it starts and 10 minutes after each check ends. An update
  that a person starts stops this timer. Each check starts the update worker, and the worker
  starts one `engine/update.ts --inspect <host>` child for each host that it inspects. Each of
  these processes records its own failed exit. A child that fails, for example because the update
  source cannot be reached, gives one refusal entry (`command` `update`) at each check. The worker
  exits 0 when it reports a failed check, so it records nothing then. A failure that the worker
  finds itself, such as a source of the program that cannot be reached, gives no entry.
- Each board answer with status 500 is one entry. The page reads the board state again 5 seconds
  after each read, or 15 seconds after it when the page is hidden. A read that fails each time
  gives one entry for each read.

The fingerprint is the first 16 hex digits of SHA-256 over a key. The key parts are joined with
`\n`:

| Kind | Key |
| --- | --- |
| `defect` | `defect`, `command`, `exception.type`, and the first stack frame inside the program folder: its path relative to the program folder and its function name, with no line or column |
| `refusal` | `refusal`, `command`, `code`, and the first line of `message`, with each run of digits replaced by `0` and the program folder replaced by `<program>` |
| `workflow` | `workflow`, `command`, and `name` |

Each write opens `events.lock` and takes an exclusive `flock` (`LockFileEx` on Windows). It
retries for 2 seconds at most. Under the lock, the writer appends the whole line with one write.
When `events.jsonl` is then larger than 5 MiB, the writer renames it to `events.1.jsonl`, which
replaces the older file. The record is about 10 MiB at most. A process holds no lock between two
writes. When the previous writer died in the middle of a line, the next writer ends that line with
`\n` first.

A record that cannot complete does not change the exit code, the stdout, or the other stderr text
of the process. It prints one line, `celetis: cannot record the event: <reason>`, and writes no
entry. The reasons are: the lock is busy after 2 seconds, the folder is not private, a relative
`CELETIS_HOME`, a full disk, or a removed working directory.

`celetis --agent <host> events [--after <id>]` takes a shared lock with the same 2-second bound,
reads `events.1.jsonl` and then `events.jsonl`, and prints each entry as one JSON line on stdout,
oldest first. The record file is input that the command does not trust. It prints a line
only after it parsed the line as a JSON object with a string `id`. It skips the incomplete last
line of a file (no `\n`). A line that is not a valid entry gives one stderr line with the file
name and the line number, `events: <file>:<line>: not a valid entry; the read continues`, and the
read continues. With `--after <id>`, it prints the entries after the last entry with that `id`.
When no kept entry has the `id`, it prints one stderr line and then all entries. With no folder
or no file, it prints nothing. The exit code is 0 for each of these. A usage error exits 2. A busy
lock after 2 seconds exits 3, and a folder or a lock file that is not private to the user exits 6,
each with one line. The command writes nothing to the record, also not its own failures.

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

## Acceptance status

**Owned-step usage recovery (#236), synthetic runner checks.** On 2026-11-04 on macOS, the lane
source of this change, on base `16a108421e0ecb625f0f6fbd50a4a98f60431371`, ran with Bun 1.4.4, hc
0.1.18, and herdr-app 0.1.13 in Herdr lab `celetis-lab-701be3`. Synthetic Claude and Codex
stand-ins, a fake `gh`, and a local fixture repository drove the actual runner, start barrier,
recovery record, and `worktree` entry. No provider and no installed host ran. After a Claude
stand-in refused and then stopped its own writer on `/exit`, a Codex session started the same step
with unchanged lane bytes, a new session ID, the recovery header, and a kept dirty lane at
`worktree`. The native host does not do that: Claude Code 2.1.318 shows a background-task dialog on
`/exit` and keeps the writer, so that path is `unverified`. Progress, a later `me` gate, a hold, a dirty main checkout, another dirty lane, a
changed branch, HEAD, or snapshot, an unresolved merge, a competing runner, a live child, and a
Codex refusal started no replacement. Waits covered a timer wake, a past reset, duplicate and
stale Retry, a stopped runner, a preference change, early availability, and a default queue in
`quota-wait`. Real interactive
refusal, Codex termination, native delegated children, Linux, and Windows remain unverified. The
evidence is in `docs/superpowers/verification/236-task-4/`.

**Native usage adapters (#236), macOS observation checks.** On 2026-11-04, the candidate at
`ed1f9befee7feb73958cccb5b94570c69a4d96b5` plus the retained adapter source passed focused
checks with Bun 1.4.4, Claude Code 2.1.318, and Codex CLI 0.166.0. Both installed interactive
hosts completed a real tool-free request with their existing authentication. Renewed checks
of the adapter source classified real success, a synthetic allowance refusal, a generic 429,
and successful model text that quoted a quota message. Repeated reads kept the same sequence.

Claude uses an attempt-local native `Stop` or `StopFailure` callback. A matching session,
project, attempt binding, and native prompt ID are required. The observed weekly and five-hour
refusals combine `StopFailure`, `rate_limit`, and the anchored host-generated allowance message.
A generic provider error could not imitate that prefix; an identical model message was `Stop`.
The callback supplies no absolute reset, so its reset is null. Codex reads the exact saved
thread and fresh UUIDv7 turn through the app-server helper. Only a failed turn's
`usageLimitExceeded` establishes a block. Account percentages establish none. Reset lookup
requires the OpenAI provider and a `codex` or matching-model limit bucket; it keeps the latest
deadline of the applicable exhausted windows, or null when a required deadline is unknown.
Custom-provider refusals receive no unrelated ChatGPT account deadline.

Codex keeps a private sequence record per attempt under the Git common directory's
`celetis-flow/usage-sequences/`. The same-attempt lock covers both the native reads and the
record update. A changed turn or combined observation, including an updated reset deadline,
gets a newer sequence; unchanged polling keeps its sequence across processes. Focused repair
checks covered changed deadlines, overlapping reads, and invalid record boundaries. The
original native transport evidence remains separate from these synthetic repair checks.

The refusals came from dummy-credential loopback fixtures through the real interactive hosts;
they were not live subscription exhaustion. Plain Claude `/exit` left a tracked background
writer running at a native confirmation. Selecting the observed `Exit and stop tasks` choice
ended the host, shell, and writer, with stable output and gone PID/start identities. This proves
that controlled case, not blind confirmation of an unknown dialog. Codex delegated-writer
shutdown remains unverified: the requested writer did not start in the attempted native checks.
Unknown or detached ownership remains unsafe to switch. These adapter checks make no complete
V1, Windows, or end-to-end recovery claim. The evidence is in
`docs/superpowers/verification/236-native-signals/` and `236-native-adapters/`; the transport
checkpoint is on [#236](https://github.com/ddinkov10/celetis/issues/236#issuecomment-6632153323).

**Product-owned setup references (#107), implementation complete; Codex native acceptance complete.**
On 2026-10-30, the candidate checkout at `7eff11866df88ea26cd40b6ca88db971464800c0` plus the
retained document/ADR diff passed V1–V5 with Bun 1.4.4. The independent temporary checks covered
81 configuration groups, 13 filesystem groups, 6 direct and 4 command process groups, 3 direct
and 6 command marker/cleanup groups, and 6 proposal/ownership groups. These are case groups,
not individual assertions. Source identity, sibling imports, root cwd after subfolder entry,
real unreadable-file denial, streams/statuses, owned-child signals, markers, committed-source
ordering, and unchanged source ownership were observed. The generated hook harness and build
byte check are separate from native host acceptance. Native Windows remains unverified.

Codex CLI 0.166.0 completed native main/lane/subfolder entry, invalid-inline entry stop, a
successful committed-source control, and an actual fixture-rule denial before process creation.
It also completed the committed-source proposal/test case with the exact `--setup-file`
reference, lane source/helper URLs, unchanged main HEAD/index/files and origin, and no source
ownership. The earlier absent-source target `V7-task3-codex-2` remains refusal history: its
setup-check fetch hit sandbox EPERM, and automatic approval review rejected the retry and the
one safer attempt as a prohibited update. No further route was taken in that session.

After explicit human approval for fixture Git metadata writes, the new target
`V7-human-approved-codex-1/proposal-absent` passed the independent checker. Native session
`01a18eaa-565f-70c2-89b6-7f1c480cea50` used the clean candidate checkout at
`dcdf02875ec0f17bdb3367ea3a6fbd40ad737e95` with Codex CLI 0.166.0. Its setup check passed
after the normal approved retry. The proposal gives a normal root-relative filename and
complete TypeScript contents, and requires the owner to create and commit source and helpers
on local `main` in a separate product change before `try`. No source was created or staged,
no `try` ran, and main HEAD/index/files and origin stayed unchanged. The first checker result
rejected Markdown code spans around `main`; a reviewed one-line temporary-checker correction
accepts that format and preserves all behavioral checks. The original failure, older native
negative, and six guard checks remain separate from the passing native result.

Claude Code 2.1.312 was attempted through the existing authenticated executable and session-only
candidate plugin for both V6 and V7. It reported `usage_limit_reached` and
`You've hit your weekly limit · resets 9pm (Europe/Sofia)`, with a rejected `seven_day` event and
`resetsAt: 1793473200` (`2026-10-31T19:00:00Z`, still in the future at the new Codex run).
All six V6 cases (main, lane, subfolder, invalid inline, control, denial) and both V7 cases
(absent source, committed source) remain BLOCKED. Codex completed all applicable native
scenarios; Claude's explicit quota is the only remaining cause of incomplete checks, with no
behavioral mismatch. The usage-limit exception permits the normal landing path when the
project gate, required reviews, and all other landing prerequisites pass. It accepts these
incomplete Claude checks; no full host parity, future gate, CI, installed-program, or landing
PASS is claimed.

Raw source/target records, exact invocations, native requests/results, independent oracles, and
earlier discarded fixture attempts remain under `/private/tmp/celetis-107-checks.tGGtzI`.
Current native cases use `V6-task3-codex-1` (main/lane/subfolder), `V6-task3-codex-2` (control),
`V6-task3-codex-3` (invalid entry), `V6-task3-codex-5` (denial), `V7-human-approved-codex-1`
(absent source), `V7-task3-codex-3` (committed source), `V6-task3-claude-1`, and
`V7-task3-claude-2`. Their manifests retain the tested setup skill digest
`96c1066ca93f076359d38413e582fae817ca4b2f487010e45c9cfabb7793d070`. The unchanged runtime
inputs preserve the other native and 119 direct V1–V5 case-group results. Only this acceptance
entry changed after the runs; no scenario reads it.

**Reduced setup ownership (#106), built; Codex acceptance complete, Claude checks waived.** The implementation ends
at `9793800497798e93682599f9363ef502543f3325`. On 2026-10-29–30, all four tasks and the final
whole-branch source review completed with no findings. Each task gate and the gate after final
review ended with `verify: PASS`. The checks used Bun 1.4.4 with
`--no-env-file --no-install --config=/dev/null --no-macros`, Codex CLI 0.165.0, and Claude Code
2.1.312. The build generated the runner instruction in `engine/hooks/entry.js`; its byte check
passed. Source assertions passed 21/21 after an observed RED run.

On 2026-10-30, the maintainer explicitly permitted continuing without Claude tests for #106.
Fresh Codex checks used the clean checkout at `9df8dd42ac6768edbd86b4130987c425d1b3dfb3`,
Codex CLI 0.166.0, Bun 1.4.4, and the existing installation and authentication. Claude checks
remain incomplete. This waiver records no Claude PASS or host parity.

The final Verify results are:

| Scenario | Result and evidence |
| --- | --- |
| V1, fresh setup and stable re-entry | PASS. The 55-case output/ownership matrix and 14 extra boundary cases check selected hosts, both landing modes, product bytes, imports, approved additions, and stable repeats. |
| V2, conflicts, evidence, labels, and staging | PASS. The matrix, 13 preflight/label cases, and local-origin push check preserve conflicts and exclude dirty obsolete files. The exact seven-path synthetic cleanup diff and manifest pass; product board settings and an existing ADR stay unchanged. No product cleanup ran. |
| V3, unsafe paths and recovery | PASS. The 34 entry-safety cases and 19 module-fault cases check preflight, real OS denials, injected I/O, partial bytes, interruption, record ordering, and reviewed recovery. Their evidence stays separate. |
| V4, test lane and existing lane | PASS. Eight real-worktree/push regressions check detached plumbing commits, hook and marker sentinels, main configuration, failure recovery, and bounded removal. |
| V5, native stores and grounding | PASS on Codex. Eighteen scenarios and 23 native runs check first records, numbering, exact catalog headers, approved promotion, pending-only capture, duplicates, product policy, existing stores, grounding, malformed and unreadable stores, interrupted states, and symlink paths. File snapshots and native reads confirm the results. Claude remains unrun under the waiver. |
| V6, native restrictions and imports | PASS on Codex. Twenty argument-boundary checks pass. Direct guarded native sessions load both product markers and reject the merge call before either fake sentinel runs. A no-rule control executes its fake sentinel. Generated files add no shared entrypoint allow. Claude loading and imports remain unrun under the waiver. |
| V7, native product-specific lane | PASS on Codex. A fresh plan step uses a fake issue and local origin. Entry and custom text precede its first response; the runner rule is read, only `custom.plan` runs, the fake plan is published, and both checkouts remain clean. No implementation or runner starts. Claude remains unrun under the waiver. |
| V8, effective confirmed-update policy | PASS for the Codex Celetis session pin. Native configuration selects the installed local source over active project and user Git sources. Native discovery reports 29 enabled Celetis skills from that installed root. No update runs. Claude effective-policy checks remain incomplete under the waiver. |

Claude's native request failed with `usage_limit_reached` (429):
`You've hit your weekly limit · resets Oct 31 at 9pm (Europe/Sofia)`. Further Claude model calls
were not made. Earlier Codex 0.165.0 probes persisted nine temporary project-trust entries.
Only those entries were removed, with all other configuration bytes preserved. Those earlier
native runs grant no V5–V8 PASS.

A fresh 0.166.0 startup preflight also wrote one test trust entry before any model turn. Its
removal restored the exact pre-probe configuration hash. Passing V5 and V7 runs start in the
trusted main checkout and select the disposable directory per turn. That form is excluded from
V6: its no-rule control still inherits the main checkout's deny. Passing V6 runs start directly
in each disposable project with an additional OS guard against writes to user configuration.
Their successful no-rule sentinel control separates actual rule enforcement from that inherited
deny. Startup still warns about disabled project configuration in untrusted standalone data;
the recorded native calls and control establish the observed execution-policy effect.

V8 uses a detached temporary worktree, which inherits the main checkout's existing trust.
Native layer metadata confirms that its conflicting project source is active. The local session
pin wins over both that source and the active user Git source. The temporary worktree was
removed after its input and native evidence were saved. This result covers the Celetis session
pin, not arbitrary unpinned Codex sessions. Each passing run preserves the user configuration
bytes, `on-request` approval, the `auto_review` reviewer, and the `workspace-write` sandbox.

All harnesses, fixtures, raw native events, partial observations, and cleanup evidence remain
outside the checkout under `/private/tmp/celetis-106-ZyRHuv/`. The fresh continuation evidence
is under `/private/tmp/celetis-106-assist-lhjQjA/`, including target identity, exact commands,
native events, file snapshots, independent oracles, controls, and configuration recovery.
Native denials come from saved tool calls and results. No tracked test or fixture was added.
No real installation update, merge probe, or product cleanup ran. The maintainer later cleared
the runtime hold. The renewal below covers re-entry after the merge; #106 records the final
landing commit and its separate CI result.

**Re-entry after merging trunk (#106), renewed Codex acceptance.** On 2026-10-30, clean merge
commit `4de23b2dd7cff701636c4ae892648d49f5b14e71` included trunk
`f90d2ec135ed6d26a5c4fe9bda420b5c2c9a8e4f`. The repair retained both sides' acceptance reports
and renumbered the unlanded setup record to ADR-0052. The shared entry, plan, and step text
changed, so their earlier native observations were renewed rather than treated as current.

V1–V4 pass again: 55 matrix cases, 14 extra boundaries, 13 preflight/label cases, 34 filesystem
cases, 19 injected faults, eight worktree/push regressions, and one project-policy scope case.
These checks use the absolute checkout entry with disposable repositories and local origins.
The earlier reviewed cleanup sample remains unchanged; no product cleanup ran.

V5 passes all 18 independent file/transcript oracles across 23 native Codex runs. V6 passes
20 policy-file boundaries, both direct guarded denial targets, and the successful no-rule
sentinel control. V7 passes the fresh product-specific plan probe with entry/custom text before
response, fake issue publication, and two clean checkouts. V8 again selects the installed local
Celetis session source over active project and user Git sources and discovers its 29 enabled
skills. Its scope remains the Celetis session pin, not arbitrary unpinned Codex sessions.

The host remains Codex CLI 0.166.0 with the executable digest recorded above. The probes use
Bun 1.4.4, existing authentication, `on-request` approval, the `auto_review` reviewer, and the
`workspace-write` sandbox. Every fresh native target adds an OS guard against user-configuration
writes. Every passing run and the final audit preserve configuration SHA-256
`4957ec04d5d2c0fe84dcd2e8f80812e0ce01fa8fd58b236c31937e0b0173a091`.

Fresh source identities, input digests, exact commands, native events, snapshots, oracles, and
program digests remain under `/private/tmp/celetis-106-reentry-JU60Oo/`. The policy oracle first
rejected harmless spacing in a saved tool call; its corrected matcher accepts the same native
events without changing the denial or control requirements. The serial store coordinator
finished its active native target, then stopped before a new host start with code 75. Three
workers completed the remaining fixtures with separate reports and one final aggregation.
The paused coordinator record remains separate from the 23 completed native runs.

Claude V5–V7 remain BLOCKED after the preserved explicit weekly-limit refusal from Claude Code
2.1.312. Claude V8 remains UNVERIFIED: the earlier native metadata did not establish the effective
policy value. The command, session, native output, and exact reset diagnostic remain in
`/private/tmp/celetis-106-ZyRHuv/V5-claude-ground/`; `claude-usage-limit.json` in the renewal
directory records the reference. No fresh Claude model call was made. The maintainer's explicit
instruction on #106 permits continuing without these incomplete Claude checks, including the
unresolved policy observation. The gate, review, and workflow prerequisites still apply. No
Claude PASS or host parity is claimed. The final audit confirms that all tested source inputs
remain unchanged by this reference-only acceptance update.

**Explicit host usage limits (#172), decision-probe acceptance.** On 2026-10-30, the dirty lane
snapshot based on `cebd8f7d61e0865f2d8f7d61eff7c10f7ebaa6fa` passed 33 fixture decisions on
codex-cli 0.166.0. Five fresh read-only `exec` sessions loaded the six complete candidate
instructions and the named "Completing a human precondition" section of `docs/issue-tracker.md`.
Retained contents, source digests, and successful native read output confirm those inputs.
An independent oracle checked decisions, preserved holds, results, and evidence references.
Wrong continuation and hidden-failure controls failed the oracle; reordered JSON fields passed.
An earlier unmarked-hold case failed before the explicit completion-rule lookup was added.
Every affected candidate group was renewed after that change.

Claude Code 2.1.312's bounded `print`/Read probe exited 1 in session
`a9135c02-274c-4e2e-94ad-f8cb60f14bfb` with
`You've hit your weekly limit · resets Oct 31 at 9pm (Europe/Sofia)`.
Claude V1 remains BLOCKED; Claude V2 remains BLOCKED and unrun after that same confirmed refusal.
The [Usage-limit exception](procedures/runtime-verification.md#usage-limit-exception) accepts
this incomplete host coverage, subject to the unchanged gate, review, and landing prerequisites.
It establishes no Claude PASS or full host parity.

These are synthetic evidence cases that test real host decisions against checkout resources.
They do not establish execution of the fixture scenarios, installed-plugin behavior, or a model
reliability rate. Each final case has one observed decision. Earlier failures and all temporary
programs, snapshots, prompts, raw events, and oracle outputs remain in
`/private/tmp/celetis-172-TIB699/` and the runtime report on #172. The acceptance note changes no
loaded instruction input; their digests are checked again before the issue report.

**Running-build evidence (#169), partial acceptance.** On 2026-10-30, clean lane revision
`79d4d3120b521da4bb76c581764033e8d15f834a` passed the task gate and the gate after the
whole-branch source review. The review found no defects. The direct checkout invocation of
`celetis --agent codex capscore 0 0 0 0 0 0 --bias 0` exited 0 and returned
`CAP: J0 V0 B0 N0 S0 X0 = 0 → inherit/low`. The evidence records the absolute entry, its local
launcher import, the launcher's local command resolution, the process identity, and source hashes.
This proves checkout execution only, not an installed Celetis check.

The pre-change host probe reproduced the deferred-check gap: after reading the original
implement, stop, and landing resources, it chose `land` with no runtime source or target proof.
The candidate probe and one compact-output retry each reached the 180-second deadline without
final decisions. Both observed complete reads of all seven candidate resources. V1 remains
UNVERIFIED; reading the resources alone does not pass its behavioral oracle. The issue must keep
its `Before landing` hold until that check completes with the required evidence.

The checks used Bun 1.4.4 and the existing codex-cli 0.166.0 installation and authentication.
The baseline is one observed decision; the two candidate attempts establish no passing decisions
or model reliability rate. Device, browser, and process cases were synthetic inputs, not live
checks of those runtimes. No product repository, new login, or real installation update took
part. Temporary programs, snapshots, prompts, and raw events are in
`/private/tmp/celetis-169.m9nYtn/`. A later reference-only acceptance note does not change the
seven resources loaded by the probes; their hashes are checked again before the issue report.

**Standalone engineering principles (#166), partial acceptance.** On 2026-10-29, lane commit
`aac1e49758f9a9360fd02491fecafc1b979c43f6` completed all three implementation tasks, their
reviews, and the whole-branch source review with no findings. Each task gate and the gate after
final review ended with `verify: PASS`. On 2026-10-29, the maintainer authorized landing despite
host quota limits. This waives quota-blocked host checks for #166; their results remain BLOCKED.

The checks used Bun 1.4.4, codex-cli 0.165.0, and Claude Code 2.1.312 with the existing
installations and sign-in. All fixture programs and raw events are under
`/tmp/celetis-166-g52bj4/`. No product repository, new login, or real installation update took
part. The citation, configuration, package-shape, workflow-contract, and integrity probes pass
against the reviewed source. The existing tracked-test prohibition remains checked.

| Principle | Codex explicit use | Codex implicit selection | Claude execution |
| --- | --- | --- | --- |
| `attack-the-premise` | PASS | PASS | BLOCKED |
| `encode-lessons-in-structure` | PASS | PASS | BLOCKED |
| `make-operations-idempotent` | PASS | PASS | BLOCKED |
| `separate-before-serializing-shared-state` | PASS | PASS | BLOCKED |
| `explain-the-number` | PASS | PASS | BLOCKED |
| `boundary-discipline` | PASS | PASS | BLOCKED |
| `model-the-domain` | PASS | PASS | BLOCKED |
| `type-system-discipline` | PASS | PASS | BLOCKED |
| `test-behavior-not-implementation` | PASS | PASS | BLOCKED |

Codex native discovery exposed 28 enabled fixture skills. All nine full descriptions reached
the model-visible initial input. Wrapper and canonical rule bytes matched the checkout. Each
case above read the complete selected rule and produced its required observation. Cases covered
both a directory outside Git and a checkout without configuration. The `orange` and `42`
controls ran no command and loaded no rule body. Valid custom text reached entry before rule
use; numeric and duplicate custom values stopped entry before a canonical read.

The final workflow package matched 30 source components, including all nine changed workflow
skills, and retained the empty Codex hooks override. Bounded Codex workflow checks read only
applicable canonical rules directly. The plan carries exact paths per affected task, duplicate
and interruption outcomes, and separate write targets. The premise check rejects the absent-file
assumption before a permitted next fix. The stopped case preserves the actual attempt-4 STOP,
with no extra fix or counter reset. The synthetic measurement review states n=2, range 30–80 ms,
spread 50 ms, and scope/cache/skipped-work limits. The domain case retains clear local logic.
The behavior check rejects a changed result and accepts an internal rename. Automatic lesson
capture remains pending, and its fresh duplicate review asks for a human promotion decision
without changing the draft or catalog.

Fresh implementer and reviewer sessions each read the persistence task first, then its five
exact canonical paths. Neither received the planner transcript or read a discovery wrapper.
These bounded checks ended after context entry. Source review separately checked both build
flows and the final-review repair brief. They do not claim a complete fixture application build.

Claude initialization exposed all nine names. Its explicit timing-rule case and both initial
workflow cases stopped with `You've hit your weekly limit · resets Oct 31 at 9pm (Europe/Sofia)`.
No successful canonical-rule execution follows that refusal. The remaining Claude
explicit, implicit, custom-entry, control, and workflow cases have no PASS. The reset time is an
observed account message, not a completed readiness action.

The initial four-minute bound interrupted planning, idempotence, and valid custom-entry probes.
The preserved retries used a ten-minute bound or a smaller fixed boundary fixture. Other probe
corrections accepted native namespace prefixes, checked the JSON STOP status rather than a
nonzero exit, and selected the persistence task for its five-path handoff. The initial behavior fixture refused an ancillary issue-creation request; its corrected inert
adapter run passed. The model fixture refused an optional parent lookup; its local decision
and assertions completed independently. No shipped source changed for these probe corrections. The planning fixture could not resolve Bun type
declarations for its optional compiler check; that fixture command was not implemented. The
standalone exhaustiveness checks and the repository's strict type checks did pass.

Both temporary native plugins and marketplaces were removed through the native CLI. Their
registry and configuration entries are absent. The real Celetis native identity and checked
manifest/hook hashes remain unchanged. The observer was never installed. No runner, board,
daemon, or other session was stopped.

The per-case record is `standalone-results.json`; custom entry is `configured-results.json`.
The ten scoped workflow results are in `workflow-results.json`.
Native package hashes are in `component-hashes.json` and `workflow-component-hashes.json`.
The full source review and dispatch trail are preserved in `final-record/`. These are bounded
observations, with one ordinary prompt per trigger. They establish no general selection rate,
lower context cost, or improvement in engineering outcomes. See the plan for
[issue #166](https://github.com/ddinkov10/celetis/issues/166).

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

**Module architecture and facts entry.** On 2026-10-28 and 2026-10-29, lane commit `bc76a8a` of
[issue #105](https://github.com/ddinkov10/celetis/issues/105) passed its Verify phase with Claude
Code 2.1.312 and codex-cli 0.165.0. The checks used the existing installations and sign-in,
disposable fixture repositories, and a fake `gh`. No other product repository took part. The
installed program and plugin stayed at `0a5d1f8`: Claude runs loaded the lane with `--plugin-dir`,
and Codex prompts named the skill paths of the lane.

| Check | Evidence and limit |
|---|---|
| V1 material | The Claude entry text of `/celetis:polishing-code-comments` is 65,044 bytes at `0a5d1f8` (the three host documents and the YAML) and 6,841 bytes on the lane (the facts block, the contract, the custom text, and the skill). The Codex entry reads fall from 31,352 to 9,889 bytes, the 19 `SKILL.md` files from 138,954 to 116,140 bytes, and the step text from 5,838 bytes to 2,339 bytes and a header of about 235 bytes |
| V2, V7 on Claude | PASS: custom text, no config, no checkout, a denied read (a stop with no later tool call), a duplicate key, a symlink, a lane, a same-session handoff, an isolated child, and no hook. Also PASS: a custom line of 2,359 characters, and a new entry after `--resume`. No run read `docs/hosts/` or `docs/configuration.md`, or `.celetis.yaml` after entry |
| V3, V7 on Codex | PASS: cases (a) to (i); case (i) used a `spawn_agent` child. The denial used a permission profile, and the model stopped from the permission text before a read. The first no-shell run FAILED: with the shell tools off, the model ran the reader CLI through the `node_repl` tool. The fix `bc76a8a` defines a shell as each tool that can start a process. With no such tool, the run stopped before entry, because no tool could read a file. So the rule-list path of "Entry without the hook" has no live Codex evidence |
| V4 | PASS on both hosts: a triage step routed fixture issue #1 to `chore`, asked no question, started no lane, and read no host document, no `step-prompt.md`, and no `celetis` cache folder. `requireSameRevision` returned the root of `installation()` |
| V5 | A plan step read `worktree.md` whole before `worktree` and `project-context.md` whole at its step, read no `landing.md` or `dispatch.md`, and put the line of `custom.plan` into the `## Plan` comment only when the entry was present. The oracle "`project-context.md` before the first `AGENTS.md` read" FAILED in both runs, because `worktree.md` tells the session to read the `AGENTS.md` files of the lane on entry, as the base entry text did. The build ruled this a defect of the oracle |
| V6 | PASS on both hosts: the normal, stable-pair, and changed-pair tasks of #104, with the agent reading `docs/procedures/dispatch.md` whole. Each host had its follow-up tool, so no `unsupported` report ran |
| V8 | PASS in 5 of 5 runs: the first acts read the skill and `docs/procedures/entry.md` before any answer text. One run read a host skill between the two reads |

Entry does not stop on an invalid UTF-8 byte (Claude's `Read` gives U+FFFD) or on a BOM. The command
reader still refuses both at each command. Each Codex run printed a parse error of `hooks/hooks.json`
of the installed plugin (`unknown field 'modules'`), and the runs continued; #105 did not change
that file. Open: an installed entry after `celetis update`, a runner step in an hc terminal with
the header, the Codex rule-list entry with a file reader and no process tool, and Windows. The
issue comment "Acceptance evidence of #105" holds the scenario tables.

**Codex empty hooks override.** On 2026-10-29, lane commit `9e0b46c` of
[issue #161](https://github.com/ddinkov10/celetis/issues/161) passed its package checks with
codex-cli 0.165.0 and Claude Code 2.1.312, using the existing installations and sign-in.
A uniquely named temporary native Codex plugin was installed and enabled; native `skills/list`
discovered 19 enabled skills from its installed cache. Its manifest had `"hooks": { "hooks": {} }`.
The startup run exited 0 with the exact marker and no hooks parse warning for that package.
The unchanged original installed Celetis still printed its known warning, even with its
command-scoped disable override. Native removal left no temporary plugin record or config entry;
the original Celetis package and native identity were unchanged.

Claude loaded the lane through `--plugin-dir`. A temporary pass-through native observer captured
the `skill.prompt` binding and the facts delivery at `session.append`, where the unchanged hook
replaces the entry line. The facts held the lane root, scratch checkout, and custom marker.
The run read no `entry.md`, exited 0 without a hook load error, and left the scratch tree clean.
The observer was never installed, and all probe files stayed outside the checkout. The issue's
"Acceptance evidence of #161" comment records the commands, native events, and probe corrections.
Installed startup after a terminal-confirmed `celetis update` remains an after-landing check.

[Issue #164](https://github.com/ddinkov10/celetis/issues/164) checked automatic board activation
on macOS with Bun 1.4.4. Two clean temporary full-program installations had distinct server
import and browser asset markers. The same nondefault origin returned the target revision and
a new runtime instance, with the target import and asset, main checkout, explicit startup host,
native profile, captured environment, and actual port. An occupied port failed without an update
worker. Signals during check and apply stopped only the owned board. A changed installed target
was refused before teardown. A second board and a sentinel child survived all cases. The focused
check ended with `restart: PASS`. This proves the macOS process replacement path with an arranged
update result, not a real native plugin replacement. Linux process replacement and final browser
reconnect acceptance remain open; Windows board activation has no acceptance claim.

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
that starts `celetis.cmd` in a new tab), the `PATH` of a desktop host, and the first real
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

Open on Windows: herdr-core and the Herdr app (a board Run, Resume, and the step end), Codex (not
installed), PowerShell 7, a real `land` run and its live land-lock check, and a confirmed update
apply (only the lock probes and the update check of that release ran). The board of #102 is also
open on Windows: the board row above checked the board before #102, which read its data through a
`celetis-flow --board` subprocess and typed its lines from command lists. The personal rules of
`land` and `issue` are also open on Windows, and so is the program of #126 ("The celetis program").

#125 left the moved POSIX process-identity path with no runtime check on macOS. The scratch checks
of the merge of #125 into #102 then ran it on macOS through the runner and the board: a live
owner, a dead PID, a zombie, a process with another command, and a changed start time gave the
same lock states as `266a05c`. On Linux, one probe in WSL Ubuntu 24.04 with a private Linux Bun
1.4.2 passed its four cases once. CI runs only the static verify gate (ADR-0029).
ADR-0034 records the Windows decisions and their limits.

**Blocked-issue assistance.** On 2026-10-29, the source checks of
[#147](https://github.com/ddinkov10/celetis/issues/147) used Bun 1.4.4, Codex CLI 0.165.0,
Claude Code 2.1.312, and herdr client/server 0.9.3. The final runtime source was
`e2984889a58ee4e3975e0e3335c083226c9760ae`. The checks reused the existing host installations and
authentication. Temporary program copies used a private `CELETIS_HOME`; no real installation
update was part of these checks.

| Check | Evidence and limit |
|---|---|
| V1, Codex command | PASS: the source command loaded its skill and complete entry before commentary, read a real held issue and its current resolver state, and answered a scripted follow-up in the same native session. The issue and runner records stayed unchanged. |
| V2, Codex assistance | PASS: 11 interactive fixture cases covered current and obsolete requests, unexplained holds, open human preconditions, equal-timestamp timeline order, cleared and closed issues, missing information, conflicting labels, and manual hotfix landing. Malicious-looking commands stayed data. A later scripted clearance caused fresh reads. No human report, label removal, runner control, or landing occurred. |
| V3, server | PASS: 124 real-loopback assertions covered freshness, held reads and diffs, current agent/noRun changes, snapshot health, strict HTTP refusals, fixed commands, shared start exclusion, explicit focus, timeout feedback, and deliberate retry. Execution and clock inputs were controlled; Windows evidence is line construction only. |
| V4, browser | PASS: Chromium at 1440×900 and 375×812 passed 89 core assertions, 14 race assertions, two focus cases, and six notice scenarios. The [12 inspected captures](https://github.com/ddinkov10/celetis/issues/147#issuecomment-6505313866) use example data. The existing compact layout and styles remain. |
| V5, Codex board/native components | PASS: an actual UI press used the real adapter and private installed program, focused its new tab, loaded the source skill and entry, produced two useful native answers, read real issue #147 separately, and changed the card to Go. Only synthetic assistance data and owned panes entered this check. |
| V5, separate bounded API case | PASS: one deliberate synthetic request returned HTTP 200 and `{"ok":true}` through the same final route, real adapter, program, and native path. This was separate from the UI press. |

The original V5 Playwright press callback timed out after 300 seconds without returning its
request/response result. A later bounded UI replay captured the exact request body and actual
HTTP 200 headers, and the server recorded a completed 200 response. Playwright's raw-body read
exceeded its 6,000 ms bound, so that browser body remains unobserved. The separate API case
proved its own JSON body; it does not claim the missing browser body. All owned native tabs and
test servers were closed. After the user approved URL-only cleanup, the two previously
unconfirmed test browser contexts were closed. Other pages and native sessions were untouched.

Claude returned first-party HTTP 429, `usage_limit_reached`. Its required V1, V2, and V5 checks
remain UNRUN, so the feature's Verify phase is incomplete. On 2026-10-29, the user explicitly
permitted this #147 landing: "i allow you to land it without claude verification". This waiver
applies only to this landing; it does not record Claude PASS or change general acceptance policy.
The fixture checks used the trusted main checkout with isolated issue data. They did not approve persistent
trust for a new disposable project. The `custom.assist` source reader and generated-hook bytes
passed separately; native custom entry in that untrusted project remains UNRUN. These observations
do not close the other CLI or native Windows acceptance gaps.

**Assisted completion of holds (#178).** On 2026-10-31, Bun 1.4.4 and the existing Codex CLI
0.166.0 installation exercised the source `issue assisted` command and assistance instructions.
The unchanged guidance first repaired the temporary file but delegated report and label writes
to the maintainer; the completion assertion failed. After the change, 16 isolated native cases
passed their disk/API checks. They covered machine repair, a same-session human answer, mixed
blocks, unexplained holds, deferral, denial, stale equal-time evidence, all three precondition
kinds, deceptive content, partial-write re-entry, known and unknown lane conflicts, cleared and
closed issues, and manual hotfix landing. No case continued a lane or landed.

The command probe also passed both host attributions, input and prerequisite refusals,
report-before-removal order, build preservation, timeline boundaries, repetition, and failures
at every write. Two deliberately broken command variants failed the probe. These checks used
controlled GitHub data. A separate real GitHub check on owned disposable issue
[#183](https://github.com/ddinkov10/celetis/issues/183) confirmed one attributed report before
both removals, preservation of the lane label, unchanged body and build state, the actual next
step, and repeat refusal without another report. The fixture was then closed.

Claude Code 2.1.312 loaded the source plugin path but returned `usage_limit_reached` with
`seven_day` rejected and `out_of_credits`: "You've hit your weekly limit · resets 9pm
(Europe/Sofia)". Every Claude assistance scenario remains BLOCKED; plugin discovery alone is
not proof of loaded instructions or behavior. The usage-limit exception applies only when the
Codex evidence and every other landing prerequisite pass. No full host-parity claim is made.
The source records, native transcripts, command logs, and independent oracles are retained under
`/tmp/celetis-178-checks/`; #178 holds the runtime report. No product adopter or real installation
update entered these checks. The older #147 observations above remain historical evidence.

**herdr-core host (#182).** On 2026-11-02 on macOS, the checks used hc 0.1.16, the Herdr app
0.1.11, Claude Code 2.1.316, Codex CLI 0.166.0, and Bun 1.4.4. The target was a clone at the
installed revision `0828b798ba89c655b17b811d06e8aa2635bf0f9b` with the lane diff as uncommitted
changes; its tree equals the tree of lane commit `cbca6917c2753439604ad9c29d799885e656e7e2`. The
step sessions loaded the installed plugin at that revision. A disposable fixture with fake GitHub
data held the issues. The first V2 run found that the runner renamed its tab before Herdr listed
the new terminal; `cbca691` makes `renameTab` wait for the tab, and all scenarios then ran again.
S1 passed (the greps, one module for `hc` and `herdr-app`, no hook change). V2 passed: the Claude
step labeled its terminal and named its tab `#1 triage` within 5 seconds with no focus change,
saved the id of `--session-id`, stayed open 56 seconds idle with no change, and ended 1.6 seconds
after a changed result. V5 passed: a blocked session got no exit input for 32 seconds after a
changed result. V3 passed: the saved Codex ids were the `thread/list` matches of the triage and
bug prompts, `ctrl+c ctrl+c` ended the first session 3.9 seconds after a changed result, the
runner started `bug` in the same terminal, and the closed issue ended it. hc cleared the status to
null at each host exit, so no stale `done` occurred. V4 passed for both hosts. V6 passed: the
cards showed `works`, `waits` for a dialog, and `waits` for a turn, the card screen equaled the
cleaned `hc read` lines, a status-less shell had no card, and the status bar item matched the
installed board in Chromium at 1440×900 and 375×812. V7 passed: the first press made one space
whose first tab held the session, Run and Queue opened quiet tabs, two presses at once made one
space, a tab kept a login shell after its runner failed, and the sessions lived after the board
ended. V8 passed: Assist, Open shell, and New intake opened focused tabs, and Go focused the
session. V9 passed: with the app closed, Run gave 502 and started no terminal, and a failed `hc`
showed `herdr down`. V10 passed outside hc. Claude Code drew no `/exit` input at 30 ms sampling;
its exit text and the exit times are the evidence of that exit. One `ctrl+c` only interrupts a
Claude turn, so V7 (d) ended the host with `ctrl+c ctrl+c`. Open: native Windows, and a board Run
of the installed program with the real `gh` (the check after the landing of #182).

**Session tabs (#232).** On 2026-11-02 on macOS 26.4.1, the checks used hc 0.1.16, the Herdr app
0.1.11, Claude Code 2.1.316, Codex CLI 0.166.0, and Bun 1.4.4. The target was a clone at the
installed revision `94b60b87cda2502c2becc3d05ab2283d4406afba` with the lane diff as uncommitted
changes; its tree equals the tree of lane commit `733c3d1`. Each runner and each barrier ran the
`celetis-flow.ts` of that clone, and the step sessions loaded the installed plugin at that
revision. Two disposable fixtures with fake GitHub data held the issues. The first V1 run showed
that the Herdr app removes a space when its last tab closes; `733c3d1` keeps the tab of a normal
end until the next session tab of the same start is open or the runner ends, and all scenarios
then ran again. V1 passed (Codex): each step opened its own front tab `#1 <step>` in a terminal
other than the runner's, the saved ids were the `thread/list` matches of the triage and bug
prompts, Codex exited 2.4 seconds after a changed result, the next tab opened in the same space
before the old tab closed, and no `[99;5u` text reached the next tab. V2 passed (Claude): the
saved id was the `--session-id` of the host, and the exit input of the runner reached Claude as a
plain `/exit` (its prompt history recorded `/exit`, and its transcript had no `<hc` text); the tab
closed 4 seconds after a changed result. V3 passed: a board Run started a hidden runner labeled
`celetis.runner=#3` with `--quiet` and no tab, its session tab came with no focus change, the card
named that terminal, and both went after the issue closed. V4 passed with a queue of two issues:
the runner labeled `celetis.runner=queue` opened the tab of the second issue in the same space,
quietly, 0.3 seconds before it closed the tab of the first, and the queue ended empty. V5 passed:
a board Resume and a typed `--resume` opened a front tab whose host ran `claude --resume` with the
saved id. V6 passed: a host killed with SIGKILL gave status 137, a refused trust dialog gave the
startup error that names the tab, a killed tab gave status unknown with a free lock, and each tab
of a failed end kept the last host screen and a shell. V7 passed: ctrl+c stopped a typed runner
with 130 while its session worked on for more than 30 seconds, a second start was refused with the
PID of the barrier, the card did not show `checks step`, and `hc kill` of a hidden runner left its
session and card. V8 passed: a runner started from another hc terminal opened its own tab and
changed no label, input, or screen of that terminal. V9 passed: each setup stop gave its line, exit
1, and no issue read. V10 passed: two runners started at once made one space. V11 passed: a login
shell that waited 70 seconds gave the 60-second warning once and then a verified session, and
ctrl+c before the release closed the tab and started no host. A merge of the trunk with #193 then
changed the board read and no runner file. On a clone whose tree equals the tree of lane commit
`c2ae36d`, V3, V4 with two issues, V5 (a), and V7 (b) ran again and passed with the same
results. Open: native Windows, a board Run of
the installed program with the real `gh`, the focus outside the Herdr app, and the automatic runner
(the checks after the landing of #232).

### Optional Codex desktop evidence

Desktop probes have their own PASS, FAIL, BLOCKED, or UNRUN records. BLOCKED and UNRUN remain
incomplete without blocking otherwise complete required CLI checks. A CLI probe does not
establish a desktop result. Manual desktop operations still use the active surface's tools,
model profiles, and permissions; a missing tool or denied read stops that operation.

| Component | Evidence and limit |
|---|---|
| Codex desktop | The current selector cannot bind the owned isolated package: BLOCKED. CLI typed skill input and quoted tests do not establish desktop entry |

## Limits

- A session that waits holds its run. Each Run press and each start with a number is its own run
  in the daemon, so another issue can run beside it.
- The daemon sees only its own locks. While a run works on an issue, start each step of that
  issue through the script or the board, not by hand in a session of your own.
- With the default gates auto mode starts nothing. The board has no control for it:
  start it with `celetis --agent <host> daemon auto on`, after you set a gate to `auto` in the main YAML. With `triage` as `auto`, it
  classifies each new issue, and a splitter question of `/celetis:triage` holds it until you answer.
  With `specify` as `auto`, it opens a design session for the lowest feature with no spec, and that
  session holds it until the spec is on the issue or you leave the session.
- With a gate that is `auto` in the main YAML, the run of a Run press goes on with that step in a
  new tab. Between two sessions the card is in Running with `Starting`.
- A closed terminal, Ctrl+C, or a restart of the terminal program of a command stops no run: the
  command returned at the answer. Only the stop of the daemon stops its runs, and their sessions
  stay open in their tabs ("A stop of a run"). The lock stays while either the daemon or its
  session is live. After both exit, a new run can claim the stale lock; the session record stays.
- Auto mode that runs long opens one tab for each session. A normal end closes its tab. Each tab
  of a failed end, and each tab whose daemon stopped, stays open until you close it.
- A session gets the login environment of its tab, not the environment of the daemon, so a
  variable that you export only in the shell of the command, or of the daemon, does not reach the
  session. When `CLAUDE_CONFIG_DIR` or `CODEX_HOME` of the daemon differs from that of the session,
  the daemon looks for the saved turn in the wrong place: it warns after 60 seconds, and the
  session does not end by itself.
- For a command in another terminal program, whether `herdr-app do pane.focus` brings the
  window of the Herdr app to the front is not checked.
- The Herdr app 0.1.11 removes a space when its last tab closes (observed in the Verify phase of
  #232). The next session tab then makes the space again with `herdr-app do space.new`, and the
  app shows that space and gives it the focus, also for a `--quiet` start. So a normal end closes
  its tab only after the next session tab of the same start is open, or when the run ends. Auto
  mode that waits for work keeps the tab of its last normal end open until it starts
  the next session or stops.
- A session outside herdr-core, for example in a Code tab of the desktop app or in another terminal
  program, has no card on the board, and the script does not end its step.
- The script ends a step only from the status that the host reports with OSC 7501. A host that
  reports no status, for example Claude Code before 2.1.295, gets no step end and no card: leave
  its session with `/exit`.
- After its exit, Codex keeps the status `done` on a live terminal (Codex 0.166.0 kept it for more
  than 45 seconds). Each session has a new terminal, so no later session reads that status. The
  script also reads only a status that changed at or after the start of the step.
- The script finds the thread of a Codex step by the exact prompt of the step in `preview` of
  `thread/list` ("Sessions"). When a Codex release changes `preview`, no thread matches: the script
  warns after 60 seconds, and the session does not end by itself. When a person starts the same
  prompt in the main checkout at the same moment, two threads match, and the job ends with the
  startup error `no single session identity can be saved`.
- Automatic completion can discard an unsent Codex draft through native cancel/quit input.
  Claude still receives `/exit` through its composer, so concurrent text can join that command.
  A successful request that leaves either host alive prints recovery instructions after
  10 seconds; the daemon keeps ownership until the process exits ("The step end").
- The `hc` and `herdr-app` calls of the script use the API of herdr-core 0.1.16 and the commands of
  the Herdr app 0.1.11. Both are previews (version 0.x), so a later 0.x release can break the step
  end. On Windows, no daemon runs and each request form exits 3 ("Requirements"), so a board Run,
  Resume, Retry, or queue press fails there. The tab of a board press and the card
  of a session are not checked. The board starts the argv with no shell, and a program that
  `hc run` starts with no shell has no foreground in `hc get`, so its session can get no card. Two
  parts of the step end are not checked: the end of a session after its
  `celetis --agent <host> land` run ends (ADR-0008), and the end of a session after it adds
  `ready-for-human` at a stop (ADR-0011). Two shapes of the REST reads of the board data
  (`nextBoard`) for each open PR are not checked against a live GitHub: a commit status list that
  is not empty, and a review list that is not empty.
- The REST API of GitHub lists a commit status only after the status reports. So the list does not
  show a status that branch protection requires until that status reports. Until then,
  `celetis --agent <host> land` can read `pass` and ask for the merge. GitHub then refuses the merge, and
  the build step stops with `## Landing refused`. Until then, the board also shows `pass` for the PR.
- The card warnings and the reservations of a Run or Resume do not survive a stop of the daemon;
  the next daemon takes over the run. A queue action uses the persisted queue state.
- The daemon keeps the version folder of the program that started it for the resolver, entry, and
  step text of its runs. An install or an update keeps the three newest version folders, the
  current one, and the installed version that runs that install. A daemon that stays open while
  other versions run three later updates can lose its folder. After that, it stops with the true
  cause ("A removed program version"). A `run` or `queue` form that starts after its own folder went prints
  `run: #<n>: the program version of this command was removed after an update; run the command
  again` for a start with one number, else `run: the program version of this command
  was removed after an update; run the command again` (`queue: ` for a `queue` form), on stderr, and exits 3. The cure is to restart the
  daemon from the installed program, then to send the request again (ADR-0012). The board stops
  with its daemon. Each press of Open agent or Make visual reads the installed program again, and
  an update needs no restart for these presses; a terminal-started update needs a restart of the
  daemon for new board code (ADR-0042).
- A host can update its plugin by itself, for example with a marketplace auto-update. Then the
  daemon starts no new step session until `celetis update` and a restart of the daemon ("How a
  step runs").
- The master daemon keeps the environment of its start. A later change of `PATH`,
  `CLAUDE_CONFIG_DIR`, or `CODEX_HOME` in a shell, also in the shell of a `run` or `queue` form, does not
  reach it until its next start. Each session still gets the login environment of its tab.
- The output of the master daemon grows with each run. The daemon does not rotate or trim it.
- A host can run a session at another level than the daemon chose, and the daemon does not see
  it. The daemon removes only the process variable `CLAUDE_CODE_EFFORT_LEVEL`. It does not read
  or change a `CLAUDE_CODE_EFFORT_LEVEL` in the `env` block of a Claude Code settings file, which
  outranks `--effort`, or `maxEffortLevel` and an organization cap, which run a higher level at
  the cap. Claude Code runs a level that the model does not support at the highest supported level
  below it. The start line names the chosen level, and the applied level only when Codex applies
  another level.

`engine/board/README.md` of the plugin holds the limits of the page.

## Check the harness

Run repository checks in a checkout of `ddinkov10/celetis`. The verify gate is `scripts/verify.ts`.
It classifies every tracked path, runs Biome and three strict type environments, native
actionlint, YAML and plugin validation, the citation check of the skills, the procedure modules,
the principles, and the step text (`checkCitations`), the check of each `celetis` form and each
exit code of the same text against `engine/lib/contract.ts` (`checkContract`, ADR-0079), and
generated byte comparison, with modes
on macOS and Linux. Only procedure modules need two citers; principles have no minimum citer
count. Citations and relative links must name tracked files. Skills, procedure modules, and
principles cannot cite `docs/hosts/`, and each `SKILL.md` needs the entry line exactly once. It
installs nothing and refuses a tracked test file. Exact file roles distinguish generated
delivery, unchanged vendor code and file exemptions.

The workflow has one job, `test`, on Linux with Bun 1.4.4. It installs the pinned tools, then runs
the verify gate. The private TypeScript installer checks the official actionlint hash
and installs pinned JavaScript tools with Bun. Checks resolve package/type metadata from the
filesystem and run JavaScript tool entries on the selected Bun. No model credentials are needed.

```sh
BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 bun --no-env-file --no-install --config=/dev/null --no-macros scripts/verify.ts
```
