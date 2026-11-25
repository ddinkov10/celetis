# A Linux lab runs the real hc and a fake Herdr app

## Date

2026-11-25

## Related

- [Issue #390](https://github.com/ddinkov10/celetis/issues/390): the spec (the body of the issue, `Spec: 2026-11-24`).
  In this record, "The rule of the new ADR", "The Mac session", "The fidelity check", and "The sources of the fake
  answers" name sections of that body.
- [The plan of #390](https://github.com/ddinkov10/celetis/issues/390#issuecomment-7146703165): its section "The Linux
  facts of `hc` 0.1.19" holds the facts that the plan session observed on 2026-11-24. The facts marked "build" below
  were observed in the build of #390 on 2026-11-25 and are stated in this record, because the build could not post
  them as a comment.
- [The repository keeps no tests](0029-the-repository-keeps-no-tests.md): the probes and the scenarios of a Mac or
  Linux session are throwaway scripts, and the fake is a tool of the lab, not a test.
- [herdr-core hosts the agent terminals](0058-herdr-core-hosts-the-agent-terminals.md): the source of the recorded
  facts about the Herdr app (probe 3, and the error JSON on stdout) that "The fake answers" cites.
- [A run session tab never takes the focus](0101-a-run-session-tab-never-takes-the-focus.md): the source of the
  recorded facts about `space.rename` and `pane.focus` on the real app (probes 1 and 2).
- [Native Windows is a support target again](0107-native-windows-is-a-support-target-again.md): the Windows lines of
  `scripts/herdr-lab.ts`, which this record leaves as they are.
- `scripts/herdr-lab.ts` (`upLinux`, `labEnv`), `scripts/fake-herdr-app.ts`, `scripts/install-tools.ts`
  (`--herdr-core`), and `engine/lib/terminal/terminal.ts` (`readSpaces`, `startTab`).
- The release manifest of herdr-core 0.1.19: https://releases.herdr.dev/core/0.1.19/manifest.json

## Context

A Claude Code cloud session runs in a Linux container with no `hc` and no Herdr app. The lab `scripts/herdr-lab.ts up`
refused each platform other than macOS and Windows, so each Verify scenario that starts the daemon with step sessions
was blocked in a cloud session. The change then stopped with `## Before landing` and `ready-for-human` until a person
ran the lab on a Mac or a Windows machine.

herdr-core 0.1.19 has Linux builds. Only the Herdr app is a desktop app that a container cannot run. The engine uses the
app only for spaces and tabs (`herdr-app ls`, `do space.rename`, `do tab.rename`, `do pane.focus`); the status, the turn,
the input, the wait, and the screen of a session come from `hc`.

## Constraints and evidence

- The release manifest names `https://releases.herdr.dev/core/0.1.19/herdr-core-linux-x86_64.tar.gz` with SHA-256
  `4adcfb423d52f24c5cc4a1e2cd2fcad1f62d28bb77876ac472c29082a3eaa424`, and
  `https://releases.herdr.dev/core/0.1.19/herdr-core-linux-aarch64.tar.gz` with SHA-256
  `f95c34fd7177ed58807d74fe4ee78bb3dc73eb37f21c69496064000a21abcb10`. The x86_64 archive holds `herdr-core`, `LICENSE`,
  and `THIRD-PARTY-NOTICES`. The vendor script installs `herdr-core` and links `hc` to it.
- Observed in the plan session (the plan comment above), with the Linux x86_64 archive and `hc` 0.1.19, in a lab root
  with the lab variables of `labEnv`:
  - As root, `tar` keeps the archive owner `1001:1001` of `herdr-core` unless it gets `--no-same-owner`.
  - `hc server start --json` exits 0. The socket is `<XDG_RUNTIME_DIR>/herdr-core/<id>.sock`, equal to `labSocket`. The
    core has parent PID 1 and answered after its caller ended. With `env -i` and no `XDG_RUNTIME_DIR`, `hc server start`
    printed `hc: no systemd user manager here: the core ends with whatever started it`.
  - `ps eww` of the core shows `HC_SESSION=<id>`, `XDG_RUNTIME_DIR`, and `PATH` of the lab. So the sweep of `down`
    needs no Linux change. The default socket is `$HOME/.local/state/herdr-core/default/default.sock`, equal to the last
    branch of `realSocket`.
  - A tab of `hc run --bg -- bash -lic ...` gets the environment of the core, then the login files change `PATH`.
  - A program that prints OSC 7501 `state=working:app=claude-code`, then `state=idle:app=claude-code`, gives `status`
    `working`, then `idle` with `turn` 1. `hc send <t> --json -- /exit` exits 0, and the program exits 0.
  - `hc server stop --json` prints `{"stopped":true}`, and the socket is gone. The core and a tab process stay as
    zombies (`Z`) for a short time, and `labProcesses` skips state `Z`.
- Observed in the build (2026-11-25, Linux x86_64, `hc` 0.1.19 from `scripts/install-tools.ts --herdr-core`); these
  correct or add to the plan facts:
  - `foreground` of `hc get` is absent, or `null`, on the first read right after `hc run --bg`. It shows the started
    program on a read about 0.3 s later. The plan said "from the first read". A check reads `foreground` in a bounded
    loop until it settles.
  - A Linux login shell puts the real `claude` before the lab `bin`. In the container of the build,
    `/etc/profile.d/nodejs.sh` put `/opt/node22/bin` first. A fixture `HOME` with `~/.bash_profile` that sets
    `PATH="<root>/bin:<fixture>/bin:$PATH"` put the lab and the fixture first again: the control tab answered the fixture
    `claude`, the lab `herdr-app`, and the fixture `hc`.
  - `/bin/sh` is `dash` there, and `command -v ls cat sh` printed only the first name, so a control tab reads one
    `command -v` for each name.
  - `hc get` of a Linux tab gave the labels `celetis.link` and `herdr.space` only. It has no `where` label, so
    `readTerminal` gives no tab title in a Linux lab.
  - `herdr-core` is owned by the user that ran the install, and `hc` is a link to it. A wrong hash refuses the install
    before any write.
  - `herdr-lab.ts up` on Linux printed the id, then the JSON line with `"appPid":null`, `hc 0.1.19`, and
    `herdr-app 0.1.15 (celetis fake)`. `down` exited 0, and no process kept the lab id in its environment (zombies in
    state `Z` excepted).

## Decision

**The Linux lab.** `scripts/install-tools.ts DESTINATION --herdr-core` installs the pinned `hc` on Linux, after a
check of the archive hash, next to `actionlint`; macOS and Windows refuse the flag, because the Herdr app supplies `hc`
there. On Linux, `herdr-lab.ts up` makes the root `/tmp/<id>` with `state`, `run`, `app`, and `bin`, starts a real lab
core, and writes a launcher `<root>/bin/herdr-app` that runs `scripts/fake-herdr-app.ts`. `<root>/bin` is first on the
`PATH` of the lab core and of `run`, so the daemon, the board, and each tab resolve `herdr-app` to the fake. `up`,
`run`, and `down` keep their interface. `down` is the POSIX `down`. The fake keeps no process, and keeps its names and
its focus in `$HERDR_APP_HOME/celetis-fake-app/`, a folder that no file of the real app uses, because both share
`HERDR_APP_HOME` in a macOS lab. The fake runs only in a lab: it exits 2 and answers nothing when `HC_SESSION` is not
`celetis-lab-<6 hex>` or `HERDR_APP_HOME` is not `/tmp/<that id>/app`.

**The rule.** A Linux lab check may prove engine behavior that rests on the answers of the real `hc` and on the
recorded answers of the fake: the daemon start, auto mode, the run transitions, the step start and end, the exit
request, the exit codes, the logs and records, the landings, and the board reads of sessions. It counts as the Herdr
proof of a change when the change touches no part of this list. A change that touches a part of it runs one session on
a real machine in its Verify, by the rules of "The Mac session" below. After that change lands, the Linux lab with the
fake carries on. The list:

1. A change of a `herdr-app` call or of its parse in `engine/lib/terminal/terminal.ts`: one Mac session with the
   fidelity check, extended to the calls that the change touches.
2. A behavior of the Herdr app under check (a new space, the placement and the names of tabs, the focus, the login
   shell of the first tab of a space, and each outcome that rests on an unverified answer of the fake): one Mac session
   with the fidelity check, extended to that behavior.
3. A raise of the pin of the Herdr app: one Mac session with the fidelity check on the new app. The recorded answers
   take the new version as their label.
4. A change of the macOS behavior of `scripts/herdr-lab.ts`, or a macOS platform behavior: one Mac session with its
   own scenarios, and no fidelity check unless an item above also holds.
5. A change of the Windows behavior of `scripts/herdr-lab.ts`, or a Windows platform behavior: one Windows session with
   its own scenarios, and no fidelity check, because the fidelity check compares the fake with the macOS app, which such
   a change does not touch.

Each other scenario of such a change runs in the Linux lab. The engine paths of the daemon depend on the unverified
answers below only for tab names, the reuse of a space, and the focus: the engine ignores the result of each rename,
`openTab` catches a focus failure, and a missing space only delays a tab start by `SPACE_POLL_LIMIT_MS`. So the daemon
outcomes of a Linux check rest only on recorded answers, and a check whose outcome rests on a tab name, a space, or the
focus is a Herdr app check.

**The Mac session.** These rules hold for each change of the list; on Windows, read "Windows" for "Mac".

- The change has one session on the machine. Inside it, the session may fix the fake or a lab line, run the Linux
  scenarios again on the new commit, and compare again, until each scenario of the session passes on one commit. That
  commit is the tip that lands. After the session, only text that no scenario reads (this record, `AGENTS.md`,
  `scripts/README.md`) may change.
- The session reaches the machine through Remote Control at Verify. When no machine is connected, Verify is BLOCKED: the
  session posts `## Before landing` with the exact commands, and the issue gets `ready-for-human`.
- The fidelity probe and the scenarios of the session are throwaway scripts of the Verify session, not tracked files
  (ADR-0029). The evidence comment holds their text and their output. On macOS, the probe runs the fake by its path in
  the checkout, with the lab environment.

**The fidelity check.** Once per session of items 1 to 3, in one real lab on macOS (`herdr-lab.ts up`, then `run`),
with the Herdr app 0.1.15 and `hc` 0.1.19:

- Start terminals with `hc run --bg` and the labels `herdr.space=<id>` and `celetis.link=<name>`: two in one new space
  and one in a second space. Then rename a space and a tab, and focus one terminal.
- Run each call of the engine and the lab against the real app and against the fake (run directly with the lab
  environment), over the same lab core: `ls`, `status`, `--version`, the three `do` calls with a known id, and each
  `do` call with an unknown id. Also read `ls` after a terminal ends and after `hc rm`, and `hc get` of each terminal
  for its `where` label.
- Probe each input that chooses a target, each with a control that changes only that input: `HERDR_APP_HOME`,
  `HC_SESSION`, `--id`, `--terminal`, the `herdr.space` label, and the JSON of `space.rename`. An input that the
  session does not probe stays unverified, and the fake check is no proof of it.
- Compare, per call: the exit, the stream of the answer, and each field that `engine/lib/terminal/terminal.ts` and
  `scripts/herdr-lab.ts` read (`spaces[].id`, `name`, `machine`, `tabs[].id` as a usable `--id`,
  `tabs[].terminals[].terminal`, and the form of the error message). A field that no code reads is not compared.
- Record the real answers and the comparison in the Verify evidence, and the decisive real answers in this record. Fix
  each difference in the fake, or record it here as a limit of a Linux check.

**The fake answers.** The real Herdr app runs only in the Mac session. Each answer of the fake has one label.
"Recorded" is an answer that the fidelity check observed with the Herdr app 0.1.15, or, before that check, a fact that
a record of this repository observed with a real app, or a form that the engine parse accepts and that the engine uses
against the real app every day. "Unverified assumption" is each answer that the fidelity check did not observe. A
Linux check proves no outcome that rests on an unverified answer. This list is the state before the first fidelity
check; the Mac session of #390 turns each observed answer into a recorded one in this record, and records each
difference as a limit.

| Answer of the fake | Label and basis |
| --- | --- |
| `ls` exits 0 and prints `{"spaces":[...]}` with `id`, `name`, `machine: null`, `tabs[].id`, and `tabs[].terminals[].terminal` | Recorded: `readSpaces` parses this form against the real app every day, and `herdr-lab.ts up` reads the empty `ls` |
| A live terminal with the label `herdr.space=<id>` gets a tab in the space `<id>`; one tab for each such terminal | Recorded: ADR-0058, probe 3 |
| The name of a space after `space.rename` is the new name | Recorded: ADR-0101, "Constraints and evidence": "a space that `space.rename` named keeps its name" |
| `status` exits 0 | Recorded: `herdr-lab.ts up` waits for exit 0 from the real app |
| The error JSON of a failed `do` call is on stdout | Recorded: ADR-0058 |
| `do space.rename` with a known space succeeds (exit 0) | Recorded: ADR-0101, "Constraints and evidence", probe 1 (`space.rename` acts on the real app 0.1.15 and does not move the focus). The stdout `{}` is an unverified assumption, because no code reads it |
| `do tab.rename` with a known tab succeeds (exit 0) | Recorded: ADR-0058, "Constraints and evidence", probe 3 (`tab.rename` names the real tab). The stdout `{}` is an unverified assumption, because no code reads it |
| `do pane.focus` with a known terminal exits 0 and prints `{}` | Unverified assumption: ADR-0101, probe 2, records that `pane.focus --terminal <id>` focuses the terminal on the real app, and no record names its exit or its output. `openTab` swallows a focus failure, so no engine path reads them |
| The name of a new space before `space.rename` is its id | Unverified assumption |
| The tab id form `tab-<terminal>` | Unverified assumption |
| A space is absent from `ls` when no live terminal carries its label; a terminal that is not live, or has no safe `herdr.space`, gets no tab; spaces come in the order of the first terminal | Unverified assumption |
| `ls` gives a tab no name field, and `tab.rename` writes the name to a file that `ls` does not read | Unverified assumption: `readSpaces` reads no tab name, and the fake check cannot read one |
| `pane.focus` stores the terminal in `focus`, and answers `{}` | Unverified assumption |
| An unknown id in a `do` call exits 1 with `{"error":{"message":"<space, tab, or terminal> not found: <id>"}}`; a `space.rename` JSON that does not parse exits 1 with `invalid space.rename JSON` | Unverified assumption for the exit code and the message (the stream is recorded) |
| `hc ls` fails: exit 1 and `{"error":{"message":"hc ls failed: <first stderr line>"}}` on stdout | Unverified assumption for the exit code and the message (the stream is recorded); no record shows a real answer for a failed `hc ls` |
| `--version` prints `herdr-app 0.1.15 (celetis fake)` | Unverified assumption |
| The `where` label of `hc get`, which gives the tab title to `readTerminal`, is absent | Unverified assumption about the app: it probably comes from the Herdr app (`engine/board/README.md`). The `hc get` of a Linux tab has no `where` label (build), so a Linux lab gives no tab title to a session with no `celetis.link` label |

Two rules of the fake carry no claim about the real app: the guard answer (exit 2, stderr
`herdr-app (celetis fake): refused: not in a lab`), and the refusal of each other call (exit 2, stderr
`herdr-app (celetis fake): unsupported: <call>`), so that a new engine call shows at once. The fake skips a terminal that
ends between `hc ls` and `hc get`, and writes each state file with a temporary file and a `rename`, so that its `ls`
does not fail where the real app answers.

**The scope of a Linux pass.** A Linux pass does not prove macOS: the engine path differs where `hc` or `bash` differs,
for example in the login files of `bash -lic`. A Linux-only failure is a real finding of the engine on Linux, and the
report says so. A report of a Linux lab check names the platform, `hc` 0.1.19, and the fake app. A Linux check that
starts a host tab follows the build facts above: a fixture `HOME` with the `~/.bash_profile` that puts `<root>/bin`
and the fixture `bin` first, a control tab that reads one `command -v` for each name before the first launch, and a
bounded read of `foreground`.

**The pin of `hc`.** A raise of the `hc` pin needs a Linux lab run with the new `hc` and the hash of the new manifest.
The fake does not change for it. For a change outside the list, the Linux lab and the real lab are equal proof, and a
session on macOS or Windows can use either one.

## Constitution

Read: `CONSTITUTION.md`, amended 2026-11-12.

- Serves: 2. Autonomous steps: a Verify of a change built in a cloud session runs its daemon scenarios with no hold for
  a Mac or a Windows machine, when the change touches no part of the list; only a change of that list runs one Mac
  session.
- Serves: 1. Intent to release: a change built in a cloud session can reach the landing.
- Tension: 3. Verified landing: a Linux check with a fake app proves less than the real lab, and the fake is verified
  against the real app only in the changes of the list. The rule limits a Linux check to outcomes that rest on the real
  `hc` and on recorded answers, and keeps the real lab for each other outcome, so the evidence of the landed tip stays
  real for what it claims. Goal 2 is higher than goal 3.
- Hard limits and non-goals: none touched.

## Alternatives considered

- **A fake `hc` and a fake Herdr app.** The step end depends on `turn`, `status_ms`, `foreground`, and the wait of the
  real `hc`, so a drift there gives false passes of the behavior under check. The premise "no `hc` on Linux" does not
  hold.
- **Record and replay.** The answers of `hc get` and `hc wait` depend on live processes, so no recorded sequence fits a
  new run.
- **No change: a Mac through Remote Control at each Verify.** It stays as the path for each session that the list asks
  for. It does not fix the block of a cloud session.

## Consequences

- A cloud session can take a change outside the list from its Verify to the landing with no Mac or Windows machine.
- A change of the list cannot land before its one session on a real machine. With no connected machine, it stops at
  `ready-for-human`.
- The fake is verified against the Herdr app 0.1.15 only. A later drift of the real app (for example a new required
  field of `ls`, or a space that the app keeps) does not show in a Linux check until a change of the list runs the
  fidelity check again.
- Until the Mac session of #390 runs, the answers that the list marks as unverified assumptions are guesses of the
  fake, and no Linux check proves an outcome that rests on one.
- A Linux lab needs `hc` on `PATH` and the host `releases.herdr.dev` for the install, and needs no real `herdr-app`.
- The macOS `up` and the Windows `upWindows` of `scripts/herdr-lab.ts` keep their lines. The Linux additions are
  `upLinux`, the Linux `PATH` in `labEnv`, and the dispatch in `main`. The macOS `up` changes only the text of its
  refusal for another platform. The Mac session of #390 runs `up`, one daemon step, and `down` on macOS to prove the
  macOS result.

## Reconsider when

- The Herdr app ships a build that runs in a container, or herdr-core ships a headless app API.
- A fidelity check finds differences that this list cannot hold as limits.
- herdr-core stops shipping Linux builds, or a raise of the `hc` pin changes a fact of "Constraints and evidence".
