# The names of the workflow, the daemon, and a run

## Date

2026-11-06

## Related

- [Issue #141](https://github.com/ddinkov10/celetis/issues/141): its approved spec
  (`Spec: 2026-11-05`), the two decisions of the maintainer of 2026-11-06, and its plan.
- [Issue #240](https://github.com/ddinkov10/celetis/issues/240): the epic. #249 moves the board
  presses to direct requests, and #250 hosts the board, the update, and the landing.
- [Issue #275](https://github.com/ddinkov10/celetis/issues/275): the chore that removes the
  one-time moves of this decision.
- [ADR-0070](0070-automatic-runtime-state-migration.md): the conversion rule for runtime records.
- [ADR-0072](0072-one-master-daemon-runs-every-issue-run.md) and
  [ADR-0073](0073-the-runner-commands-are-clients-of-the-master-daemon.md): the daemon and the
  commands that are its clients.
- `engine/run.ts`, `engine/queue.ts`, `engine/daemon.ts`, `engine/lib/state-folder.ts`
  (`stateFolder`), `engine/lib/state-move.ts` (`moveState`), and `engine/lib/process-identity.ts`
  (`daemonScript`).
- `docs/workflow.md` ("The move of the old names").

## Supersedes

- [ADR-0072](0072-one-master-daemon-runs-every-issue-run.md): only its decision that the daemon is
  the script `engine/celetis-flow.ts --daemon`, and its rejected alternative of a daemon script
  with its own name.
- [ADR-0073](0073-the-runner-commands-are-clients-of-the-master-daemon.md): only its keeping of the
  `celetis-flow` command names, and its rejected alternative of new command names.

## Context

After #247 and #248, one daemon runs every issue run, and each client command sends one request to
it. But the names still described the old runner: the script and the commands `celetis-flow`, the
state folder `celetis-flow/`, the lock refs, the lock `runner`, and the word "runner" in lines and
documents. A reader could not tell the daemon, a run, and the workflow apart. The maintainer wants
each name to tell what the part does, and no name of the old runner left in the commands, the
files, the state, the lines, and the current documents (decisions 1 and 2 of #141).

## Constraints and evidence

- ADR-0072 and ADR-0073 kept `celetis-flow.ts` because the lock checks match a process by its
  command line. A rename without a plan makes a live owner look stale: the daemon could end a
  session during landing, or two daemons could take one issue.
- The state is on disk in each repository: a folder, lock refs with owner records, a worktree
  marker, a setup record, and the recovery, run, and step-end records. A new program that reads
  only the new names would start with empty state and lose the waits and the runs of the
  maintainer (decision 3 of #141).
- A lock ref is deleted only when its owners are proven gone, by PID and process start. The refs
  are blob refs, and `git update-ref --stdin` deletes a set of refs in one transaction when each
  object ID still matches.
- `rename(2)` moves a folder in one step on one file system, and fails with `ENOTEMPTY` or
  `EEXIST` when the target exists.
- The names follow the `gh` command groups (`gh run list|view|rerun`) and the guidance of
  clig.dev: a short noun for the group, a verb for the act, and one form for each verb. An old
  form ends like an unknown command of `gh`: at once, nonzero, with the pointer to the help.
- The board text of #249 keeps its words until #249 changes them: the "Runner" status item, its
  titles, and the usage-limit texts.

## Decision

- **The name map.** The document `docs/celetis-flow.md` is `docs/workflow.md`, "The Celetis
  workflow". The commands are `celetis run <n>`, `run resume <n>`, `run retry <n> <wait-id>`, and
  `celetis queue status|action|admit|wake`. The state folder is `<git common dir>/celetis/`, and
  the lock refs are `refs/celetis/locks/<name>`. The owner record is `{ daemon, session }`, and the
  lock `runner` is the lock `auto`. The worktree marker is `celetis-setup-done`, and the setup
  record is `.claude/celetis/wiring.json`. The hc label is `celetis.press`, and the board field and
  element are `auto`. The recorder names are `run`, `queue`, and `daemon`. The recovery and run
  records are schema 2.
- **The file split.** `engine/run.ts` and `engine/queue.ts` hold the client commands, and
  `engine/daemon.ts` holds the daemon, `--session-start`, and `--prepare-state`. The script name
  is one value, `daemonScript`, and every identity check accepts `daemon.ts`. The lock checks and
  the start barrier see the new name from the first start of the new program.
- **The prefix rule.** A line of the daemon process starts with `daemon: `, of `engine/run.ts`
  with `run: `, and of `engine/queue.ts` with `queue: `. A client prints a daemon answer as it
  comes. Words change only where "runner" named the daemon or a run.
- **One move at the first access.** `stateFolder` runs `moveState` once in each process for each
  Git common folder, so each command, the board, and the daemon move the old state with no act of
  the maintainer. The move has at most three rounds. A round lists the old lock refs and looks at
  the old folder, proves each owner gone by PID and process start, checks that the new folder does
  not exist, deletes the old refs in one transaction, and renames the folder.
- **The refusals.** A live owner, an owner that the process table does not show, an owner record
  that cannot be read, both folders present, and an old path that is not a folder refuse with exit
  1 and a line that starts with `state: `. The line names the old owner or both folders and the
  next act. Nothing merges, and nothing is guessed.
- **The conversions.** Records follow ADR-0070: the exact original bytes go to an immutable
  sibling archive, then the converted record replaces them. The recovery record converts from
  schema 1 with `runner` to schema 2 with `daemon`, under its record lock. The run records convert
  when the daemon starts, with their stored paths under the new folder. A path outside both folders
  is a refusal, and the daemon takes over no run from that record. The queue and session records
  keep their schemas. Setup moves the setup record at its next run, and the first read of the
  marker of a worktree renames the old marker.
- **The step-end record has the key `daemon` only, with no conversion** (decision of 2026-11-06).
  A step-end record lives for one session: the daemon writes it when a session starts, or when it
  takes over a live session, and removes it when the session or the run ends. Only a daemon that
  ends before the removal leaves one, and its reader returns null for a gone writer. A record with
  the key `runner` reads as no record. Because the update needs a stopped daemon and ended
  sessions, no such record is live.
- **The update needs a quiet machine.** Before `celetis update`, the maintainer stops the daemon,
  lets each session end, and closes each board (README, "Updates"). The first command after the
  update moves the state.

## Alternatives considered

- **Start empty under the new names.** It is the simplest code. It loses the quota waits, the
  queue, the run records, the agent order, and the usage records of each repository, and it leaves
  live locks under names that nothing reads. The maintainer rejected it (decision 3).
- **One sub-command for each verb of the old form**, for example `celetis run`, `celetis resume`,
  and `celetis retry`, each with its own name. The groups `run` and `queue` carry the same forms
  as the `gh` groups, keep the help short, and keep one place for each verb.
- **"Runner" as GitHub and GitLab use it.** In those products a runner is a worker machine that
  executes a job. Here the part is a daemon that owns every run of a repository, and a run is one
  issue's work. The word would name the wrong part.
- **A daemon script with its own name, beside `celetis-flow.ts`** (the alternative of ADR-0072),
  and **the old command names** (the decision of ADR-0073). The first was rejected for the stale
  owner risk, and the second for the identity checks. The `daemonScript` value and the move of the
  owners remove both reasons.
- **An alias or a fallback read of the old names.** It keeps two names alive for good. The old
  forms end like any unknown command.

## Consequences

- One update needs a stopped daemon and ended sessions: step sessions, and the sessions of
  `celetis assist`, `intake`, and `visual`. A process that is not in the lock refs, such as an old
  board, can make the old folder again after the move; the next access then refuses because both
  folders exist, and the maintainer keeps one by hand.
- An old program that still runs cannot read a converted record or the new folder.
- A hook settings file in `usage-captures/<id>/settings.json` that an old program wrote keeps its
  old absolute hook path; Claude Code reads it only at the start of a session, and a new session
  gets a new folder.
- The move code stays in the program until #275 removes it: `state-move.ts`, the old marker in
  `markerOf`, `oldWiring` of setup, and the schema-1 converters.
- The board shows the old words "Runner" and "automatic runner" until #249.
- The old names stay in ADR prose, in the lessons, and in the dated entries of "Acceptance
  status", because those are records of their time.

## Reconsider when

- The removal issue (#275) lands, and the move code goes.
- A product needs a longer window for the update than one step of the maintainer, for example a
  machine that cannot stop its daemon or its sessions at the update.
- A daemon of another program version has to run beside the new one.
