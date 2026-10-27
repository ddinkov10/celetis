# One celetis program for both hosts

## Date

2026-10-27

## Related

- [Issue #126](https://github.com/ddinkov10/celetis/issues/126): the spec (approaches A to E), the
  plan, its rulings, and its Verify phase. The spec merges issue #127 into #126.
- [ADR-0012](0012-the-harness-is-the-plugin-celetis.md),
  [ADR-0025](0025-the-toolchain-runs-on-typescript-and-bun.md),
  [ADR-0028](0028-terminal-confirmed-native-plugin-updates.md),
  [ADR-0030](0030-the-installed-plugin-owns-the-entrypoint.md),
  [ADR-0034](0034-native-windows-uses-kernel32-and-spawned-children.md),
  [ADR-0035](0035-the-board-is-a-part-of-the-engine.md), and
  [ADR-0039](0039-the-board-starts-each-step-from-the-copy-of-its-host.md).
- `celetis`, `engine/launcher.ts`, `engine/install.ts`, `engine/update.ts`,
  `engine/lib/program.ts`, `engine/celetis-flow.ts`, `engine/board/adapter.ts`, and
  `bunShebang` and `programEntry` of `engine/lib/process.ts`.
- `README.md`: "First install", "Personal landing permission", and "Updates".

## Supersedes

Only these clauses change. The accepted records keep their historical text and evidence.

- ADR-0030, "The installed plugin owns the entrypoint": in Decision, the delivery of the entrypoint
  `bin/celetis.ts` in the installed plugin, and dispatch through the invoked package; terminal
  discovery of one enabled root, with the absolute entrypoint in a shell variable; personal rules
  that bind the selected Bun and the package path; rediscovery after each update, and a new Claude
  rule after each Claude update; the repair of an obsolete updater from a reviewed source checkout.
  In Alternatives, the rejection of a global installer. The program now owns the entry and the
  engine. The runtime basenames, the process and lock rules, and the rules for an old product
  launcher stay.
- ADR-0025, "The toolchain runs on TypeScript and Bun", Decision: "Plugin users install no package
  dependency". A person now installs the program one time on each machine. The program is the
  same TypeScript source on Bun, and users still run no build.
- ADR-0028, "Terminal-confirmed native plugin updates", Decision: one update command for each host
  (`plugin-update` of the selected host), and the operator command for an obsolete updater. One
  `celetis update` with one confirmation now covers the program and each installed host. The
  terminal confirmation, the default decline, no confirmation by an agent, the updater
  serialization, the revalidation, open sessions, and no automatic retry stay.
- ADR-0039, "The board starts each step from the copy of its host", Decision: at each press the
  board finds the enabled copy of the session's host with `installedRoot`, checks its
  `bin/celetis.ts`, and types the line from that copy; the start checks the selected runtime. The
  board now reads the installed program at each press and types its command. ADR-0039 named this
  case in "Reconsider when": "Celetis gets one engine install for all hosts."
- ADR-0035, "The board is a part of the engine", Decision, "A fixed adapter": the items of the two
  lines (`/usr/bin/env`, the two isolation assignments, `process.execPath`, the isolated Bun flags,
  and the entrypoint), and call 6, "Keep the Run and Resume text byte for byte". The two lines now
  start with the command of the program. The other clauses stay.
- ADR-0034, "Native Windows uses kernel32 and spawned children": in Decision, "The board", the
  `$env:` pairs of the PowerShell line; in Consequences, the documented command form from Git Bash
  as the Windows entry, and "A PowerShell form of the commands for people, and its landing rule,
  are not part of this decision". The program installs from Git Bash and runs from Git Bash,
  PowerShell, and `cmd` through two shims, and the shims set the isolation values. The PowerShell
  line keeps `&`, its quote, and `; if ($?) { exit }`. The other clauses stay.
- ADR-0012, "The harness is the plugin celetis", Supersedes, ADR-0011: "The runner takes the step
  text from the install folder of the plugin." The runner takes the step text from the version
  folder of the program, at the revision of the plugin of the session's host.

## Context

The user said in #126: "CLI commands and each command are way too long", about a runner start of
about 250 characters: `/usr/bin/env`, two variables, the absolute Bun path, four Bun flags, the
absolute plugin entry, and the arguments. Nothing put the entry on `PATH` (ADR-0030), so each
command named the plugin path, and a terminal ran a discovery heredoc to find it. Each host keeps
its own plugin copy, and Claude Code keeps one folder for each version and scope, so the copy that
ran depended on the host and the project. The personal `land` rule held the Bun path and the
package path, and a Claude update changed that path. The user asked for "a single celetis on path
to work under claude/codex", with the binary installed once and the host wiring in the plugin.
In #127 the user asked for one `celetis update` for both hosts.

## Constraints and evidence

The plan of #126, "External facts", holds the sources.

- The isolation must hold before any code starts (ADR-0024, ADR-0025). Bun 1.4.4: an extensionless
  file that starts with `bunShebang` runs by bare name through a symbolic link. `process.argv[1]`
  and `import.meta.path` give the target path, so relative imports resolve in the version folder.
  From a folder with a hostile `.env` and a `bunfig.toml` preload, the run loads neither.
- Claude Code 2.1.311 puts the `bin/` folder of an enabled plugin on the `PATH` of the Bash tool,
  after `~/.local/bin`. claude.ai and Cowork refuse a plugin with a top-level `bin/` folder.
  Codex CLI 0.164.0 puts no plugin `bin/` folder on `PATH` (openai/codex#40461 is open).
- In the Codex `workspace-write` sandbox, the app-server request of `codexPlugin` fails with
  `Operation not permitted (os error 1)`. A lookup of the plugin copy takes 0.2 to 0.7 s.
- The native Claude Code installer keeps `~/.local/bin/claude` as one link into
  `~/.local/share/claude/versions/<version>`, with three versions. On Windows, npm cmd-shim puts
  an extensionless `sh` shim beside a `.cmd` shim, and PowerShell and `cmd` run the `.cmd`.
  `cmd.exe` reads a running batch file again after each command.
- `codex execpolicy check` with
  `prefix_rule(pattern=["celetis", "--agent", "codex", "land"], decision="allow")` allows
  `celetis --agent codex land 126 'feat(x): y'`, and matches no `--agent claude`, no `worktree`,
  and no absolute program path. A Claude Bash rule matches the whole command text, with `*` for
  any text.
- Claude Code records the source `{"source": "github", "repo": "ddinkov10/celetis"}` with the ref
  `HEAD`. Codex records `https://github.com/ddinkov10/celetis.git` with the ref of
  `codex plugin marketplace add`: `main` with `--ref main`, else `HEAD`. `git ls-remote --symref`
  resolves `HEAD` and `main` to `refs/heads/main`.
- The guard of an agent session refuses a command that sets `HOME`, so the checks of the program
  need another base, as `CLAUDE_CONFIG_DIR` and `CODEX_HOME` give for the hosts.

## Decision

**Two deliveries of one repository** (approach E of the spec). The repository reaches a machine in
two forms at one revision. The program `celetis` runs each command, also the runner and the board.
The host plugins give the skills, the native entry hook, and the documents that skills cite as
`<plugin>/<path>`. No skill runs a workflow command through a plugin path; the optional
configuration reader of `docs/configuration.md` stays a plugin file. The top-level `bin/` folder
goes, so no host puts a second copy on `PATH`.

**The entry.** The root file `celetis` (mode 755, no extension) holds `bunShebang` and one import
of `engine/launcher.ts`, and `scripts/build.ts` generates it. Each command has the form
`celetis --agent <host> <command> [<argument>...]`. `celetis --version` prints the revision of the
program. A usage line and an unknown command end with
`celetis: when a skill or a document gave this command, run celetis update`.

**The layout.** `<base>` is `CELETIS_HOME` when it is not empty, else the home folder. The program
refuses a `CELETIS_HOME` that is not an absolute path: `celetis install` exits 2, and
`celetis update` and the board report the error.
`<base>/.local/share/celetis/versions/<revision>/` is a Git clone of the source of the program, on
its branch, at that revision. On macOS and Linux, `<base>/.local/bin/celetis` is a symbolic link to
the file `celetis` of the current version folder, and an install replaces it with one `rename`. On
Windows, `<base>/.local/bin/` holds two shims of fixed text, `celetis` for Git Bash and
`celetis.cmd` for PowerShell and `cmd`. Both read the revision in
`<base>/.local/share/celetis/current`, and an install writes only `current`. An install keeps the
three newest version folders and the current one. It holds `install.lock`, removes the staging
folder of a stopped install, refuses a foreign entry and a version folder that holds another
program, and changes no other file. `celetis install` installs the revision of the clean checkout
that it runs from, and `README.md`, "First install", gives the first command.

**The update.** `celetis update check` prints one JSON array of three parts (program, `claude`,
`codex`). Each part is installed, skipped, or an error, and each host plugin at another revision
than the program gives one line on stderr. `celetis update` prints each part. Then it stops with no
change on an error, on no program, on no host with Celetis, or on parts that do not name one
source, one ref (resolved with `ls-remote --symref`), and one target revision. Else, when a part is
not at its target, it asks one `[y/N]` question in an interactive terminal. After `y`, it updates
Claude Code, then Codex, with the native updater of ADR-0028, then the program. The first failure
stops the update, names the completed parts and the parts that did not start, and starts no retry.
No flag confirms an update.

**The runner check.** Before each new step session, the runner compares the installed revision of
the plugin of the session's host with its own revision (`requireSameRevision`). On a difference it
starts no session and tells the person to run `celetis update`. `--resume` has no check. This check
replaces the root comparison of `codexSessionPin`, which still pins a Codex session to the enabled
Codex root. So the skills, the step text, and the engine of a step session have one revision.

**The board line.** At each Run or Resume press, the adapter reads the installed program and types
`'<command>' '--agent' '<agent>' 'celetis-flow' <n> && exit`, or for Resume
`'<command>' 'celetis-flow' '--resume' <n> && exit`. On Windows, the line starts with `&`, names
`celetis.cmd`, and ends with `; if ($?) { exit }`. The program supplies Bun and the isolation. An
HTTP request still selects only a host and an issue.

**The permission rules.** Claude Code: `Bash(celetis --agent claude land *)`, and
`PowerShell(celetis --agent claude land *)` with the PowerShell tool on Windows, in the personal
`.claude/settings.local.json`. Codex:
`prefix_rule(pattern=["celetis", "--agent", "codex", "land"], decision="allow")` in
`~/.codex/rules/celetis-land.rules`. No rule changes after an update, and no rule pins a Bun: the
entry finds `bun` on `PATH`, as `land` finds `git` and `gh`. The shared direct-merge rules stay.

## Alternatives considered

- **A. Agents type the full plugin path, and a terminal uses a link.** An agent command stays
  about 100 characters, and the Claude `land` rule changes after each Claude update.
- **B. Agents in Claude type the bare name, and a terminal links to one fixed plugin copy.** Claude
  Code puts the plugin `bin/` folders after the `PATH` of the user, so a Claude session runs the
  linked copy, which can have another revision than its skills.
- **C. B with another name for the terminal link, such as `cel`.** Two names for one tool.
- **D. One `celetis` link to a shim that asks the host for its enabled plugin copy** (the pattern
  of rustup, rbenv, and Volta). The lookup fails in the Codex `workspace-write` sandbox, so each
  Codex command needs an approval, and the lookup adds 0.2 to 0.7 s to each command.
- **A Windows junction, or a `.cmd` that an update writes again.** A junction is a second kind of
  link with its own ownership checks. `cmd.exe` reads a running batch file again, so a changed
  `.cmd` can run other text. Fixed shims and the `current` file avoid both.
- **The `--yes` of #127.** An agent, a runner step, or piped input could then confirm an update,
  which ADR-0028 and the anti-goals of #126 forbid.
- With E, the spec also rejected a link to one fixed plugin copy, a reader of the files of a host
  that copies the lookup logic of that host, and a rewrite in another language with no measured
  gain.

## Consequences

- An agent command is `celetis --agent <host> <command> <arguments>`. The board line on the Mac of
  the maintainer is about 80 characters, against about 250 before.
- Each machine has one more install step, and the program and the plugins can have different
  revisions. `update check`, the update hint of a usage error, and the runner check show a
  difference; no check runs at each command. A host that updates its plugin by itself stops each
  new runner step until `celetis update`.
- A host installation whose marketplace source is not Git, such as a local Codex marketplace, can
  start no new runner step, because the runner can compare no revision.
- The program needs `bun` on `PATH`, and on macOS and Linux an `env` with `-S`; the `env` of
  busybox has none. A desktop host needs `~/.local/bin` on its `PATH`.
- The cutover from the release before #126 follows `README.md`, "Updates": the first install, then
  `celetis update`, then the new personal rules in place of the old ones. The new updater checks
  no `bin/celetis.ts`, so the false `incomplete` failure that the spec expected does not occur, and
  the old `plugin-update` does not run. Until the program is installed, the new skills stop with
  the install message.
- A broken program needs the first install again, after the person moves away each entry that the
  install refuses: a link or `current` whose version folder is gone, or a version folder that holds
  another program. There is no repair command.
- On Windows, `readProgram` compares each shim with the shim text of its own revision, byte for
  byte. So after an update to a revision that changes `shShim` or `cmdShim`, the install, the
  update, and the board find the old shims foreign and refuse, until the person moves the shims
  away and runs the first install again.
- These checks are open: native Windows (each item of "After the landing" 4 of the plan of #126),
  the `PATH` of a desktop host, and the first real `celetis update` of the installations of the
  maintainer. `docs/celetis-flow.md`, "Acceptance status", holds them.

## Reconsider when

- A host puts plugin binaries on `PATH` for both hosts from one copy.
- Bun or Windows changes the facts of the shims: `env -S`, the precedence of `celetis.cmd` in
  PowerShell, or the read of a running batch file.
- The lookup of the plugin copy works in the Codex `workspace-write` sandbox at a low cost.
- One host can load the plugin install of the other host.
