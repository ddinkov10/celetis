# The harness is the Claude plugin `celetis`, and each product project wires it in

## Date

2026-10-13

## Related

- ddinkov10/fwrh_calculator#435 (this change): the spec, the plan, and the comment
  `## Risk results`
- ddinkov10/fwrh_calculator#430: the board became a package of its own (ADR-0009). Part 4 of the
  related plan of its spec was "the harness in a repository of its own, with Copier"
- ddinkov10/fwrh_calculator#412: the superpowers plugin and its auto-update (ADR-0010)
- ddinkov10/fwrh_calculator#394: the last change of the harness in its first repository
  (ADR-0011). It landed before the move of the harness files
- ddinkov10/fwrh_calculator#442: the harness records in the ADR store of that product
- ddinkov10/fwrh_calculator#422: the runner and the board on a Windows host, with no bash file
- ddinkov10/agent-board#5: the lane flow in `ddinkov10/agent-board`. It was
  ddinkov10/fwrh_calculator#431, the number that ADR-0009 names
- ADR-0002 (`docs/adr/0002-loop-script-and-mod-run-the-agent-flow.md`): the runner, the gate
  rule, the lock, and the record of the steps with no progress stand
- ADR-0005 (`docs/adr/0005-herdr-gives-the-session-state-and-ends-each-step.md`): the step end
  through herdr stands
- ADR-0006 (`docs/adr/0006-domain-routing-and-the-domain-skills-go.md`): it stands. A custom part
  is no domain skill
- ADR-0008 (`docs/adr/0008-the-build-step-lands-the-change.md`): the landing script, its two
  mechanisms, and the marks of a landing on the issue stand
- ADR-0009 (`docs/adr/0009-the-board-is-a-package-of-its-own.md`): the package, contract 1, and
  the trust boundary stand
- ADR-0010 (`docs/adr/0010-the-superpowers-plugin-stays-and-updates-itself.md`): superpowers
  stays a plugin of its own, and its facts on the plugin records are evidence here
- ADR-0011 (`docs/adr/0011-a-step-session-hands-a-stop-to-the-issue.md`): rules 4 and 5 of the
  step text stand
- `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`, `scripts/celetis`,
  `scripts/root.sh`, `scripts/agent-flow.sh`, `scripts/worktree.sh`, `tests/text.test.sh`

## Supersedes

- From ADR-0005, "herdr gives the state of each session and ends each step, and the mod goes":
  the clause "so the harness can move to another repository with no plugin" of its Consequences.
  The harness moves as a plugin. Each machine installs it one time, and each product project
  wires it in.

The records ADR-0001 to ADR-0011 are copies (the Decision gives the rule). Each one describes the
harness as files of `ddinkov10/fwrh_calculator`, the repository that held it. These parts describe
the harness before the plugin, and this record takes their place:

- From ADR-0002, "A loop script in a Terminal tab runs the agent flow, and a mod ends each step
  session": the home of the two scripts in "`scripts/agent-flow.sh` runs the flow from one
  Terminal tab" and in "`.claude/scripts/next-step.sh` resolves the next step". The runner and
  the resolver are scripts of the plugin. A product project starts them as
  `scripts/celetis agent-flow` and `scripts/celetis next-step`.
- From ADR-0008, "The build step lands the change, by the mechanism that the repository names":
  - "`scripts/land.sh <n> '<subject>'` is the one landing path of an agent" and
    "`.claude/settings.json` allows it". The one landing path is
    `scripts/celetis land <n> '<subject>'`, and the `allow` rule of a product project is
    `Bash(scripts/celetis land *)`. Each output line of the landing script and of the resolver
    that named `scripts/land.sh` names `scripts/celetis land`.
  - "`scripts/worktree.sh --remove <n>`". The command is `scripts/celetis worktree --remove <n>`.
  - "the skills of a step session come from the main checkout". They come from the installed
    plugin.
  - "The gate `scripts/verify.sh` runs no harness test." The gate of the plugin repository, which
    has the same file name, runs each script test.
- From ADR-0009, "The board is a package of its own, and a contract with a version is its input":
  - "This repository keeps the config and the producer of the document". A product project keeps
    the config. The producer is the runner of the plugin.
  - "This repository adds the form `scripts/agent-flow.sh --resume <n>`, and `resume` of the
    config names it", and "`scripts/agent-flow.sh --board` prints contract 1". The three entries
    of `board.json` name the launcher `scripts/celetis`, with the arguments `agent-flow --board`,
    `agent-flow {n}`, and `agent-flow --resume {n}`.
- From ADR-0010, "The superpowers plugin stays, and it updates itself": "There is no script, no
  flag of `claude`, and no line in `scripts/agent-flow.sh`." The sentence stands for superpowers.
  It does not stand for each plugin: the runner updates the plugin `celetis` before each step
  (`update_plugin` in `scripts/agent-flow.sh`). This is the alternative "An update command in the
  runner" of that record, for another plugin.
- From ADR-0011, "A step session hands a stop to the issue: a comment, then `ready-for-human`":
  - "the runner takes the step text from the checkout that holds the script". The runner takes
    the step text from the install folder of the plugin. A rule of the step text reaches a
    session after it is on `main` of `ddinkov10/celetis` and the plugin of the machine has it.
  - "It is hand-run, as each other test of the harness is." The test of the step text stays
    hand-run. Each script test runs in the gate and in the CI of the plugin repository.

A path in a copy is a path of `ddinkov10/fwrh_calculator` at the date of that record. Its home
today:

- `scripts/agent-flow.sh`, `scripts/land.sh`, `scripts/worktree.sh`, and
  `.claude/scripts/next-step.sh` are the files of the same names in `scripts/` of the plugin.
  Each test `<name>.test.sh` is in `tests/`.
- `.claude/agent-flow/step-prompt.md` is `step-prompt.md` of the plugin, and its test is
  `tests/manual/step-prompt.test.sh`.
- `.claude/skills/<name>/SKILL.md` is `skills/<name>/SKILL.md` of the plugin, and the command
  `/<name>` is `/celetis:<name>`.
- `docs/agents/agent-flow.md` and `docs/agents/issue-tracker.md` are `docs/agent-flow.md` and
  `docs/issue-tracker.md` of the plugin.
- `.claude/agent-flow/gates.json`, `landing.json`, and `board.json`, and `.claude/settings.json`,
  keep their paths. Each product project has its own.
- `scripts/merge-pr.sh` and `/finish` (ADR-0008), `.claude/agent-flow/mod/` (ADR-0005), and
  `.claude/agent-flow/board/` (ADR-0009) went before the move.

Where a copy names a part of the product `ddinkov10/fwrh_calculator` (its staging stack, its
promotion, its verify script, its design document), the part is of that repository. The plugin
names the role, and each product project names the thing. The other parts of the eleven records
stand.

## Context

Until this change the harness lived in `ddinkov10/fwrh_calculator`, the repository of the first
product that used it. ADR-0001 to ADR-0011 record how it grew there. At the time of the spec
(commit `040f54c` of that repository) it was 17 skills, one command, six scripts with four tests,
one step text, and four documents. That home had two defects:

- **A second product project could get the harness only as a copy, and each copy drifts.** The
  maintainer runs the agent flow in more than one repository (ADR-0008, ADR-0009).
- **The harness files named parts of that product**: its `backend` and `frontend` folders, its
  staging stack, and its promotion. So a copy did not run in another project with no edit.
  ADR-0009 gives the size: the harness without the board was about 50 files, and 35 of them named
  parts of the product.

The maintainer said: "I want to have one generalized harness, like the one that is in this repo,
to be installable like a plugin to multiple product projects, so they can reuse our pipeline flows
such as intake, triage, type lanes, specification, implementation, the wrapping around
superpowers", and: "my top priority is to up the harness changes and move it outside and install
it as plugin so i clean the repo from internal harness".

Two earlier texts pointed another way. ADR-0005 said that the harness can move to another
repository with no plugin. The spec of ddinkov10/fwrh_calculator#430, which moved the board out
as a package (ADR-0009), named Copier for the harness in its related plan. Copier is a tool that
copies a template into each repository.

This record is layer 1 of the request: the general harness is a plugin in a repository of its
own, the first product project runs on it, and the copy inside that project is gone. The
maintainer said: "layer one is everything that we will extract. So this project in particular can
work. After that, with new issues, we will add new functionality there, such as setup,
additionals, skills, agents".

The build of ddinkov10/fwrh_calculator#435 wrote this record when the scripts and their tests
were in the plugin repository. The documents and the skills were not there, no lane had run in
`ddinkov10/celetis`, and `ddinkov10/fwrh_calculator` still had its own copy of the harness. For
those parts this record holds the decision, and that issue holds the results.

## Constraints and evidence

Read on 2026-10-12 for Claude Code 2.1.296 (installed), where a line gives no other date. A source
`docs:<page>` is `https://code.claude.com/docs/en/<page>`.

The documents of Claude Code, on a plugin:

- A skill `review` of the plugin `my-plugin` is `/my-plugin:review` (docs:plugins-reference).
- Files in `bin/` of an enabled plugin are on the `PATH` of the Bash tool only, after the entries
  of the user, so a command of the user with the same name comes first
  (docs:plugins/components).
- `${CLAUDE_PLUGIN_ROOT}` is put into the body of a plugin skill at load. It is not in the
  environment of a Bash tool command, and its folder changes with each version
  (docs:plugins-reference).
- A plugin gives no permission rule: its `settings.json` applies only `agent` and
  `subagentStatusLine` (docs:plugins/components).
- A plugin whose declared dependency is missing does not load, and a dependency of another
  marketplace installs only with the setting `allowCrossMarketplaceDependenciesOn`
  (docs:plugins/dependencies).
- `plugin.json` needs only `name`. `marketplace.json` needs `name`, `owner`, and `plugins`, and a
  relative source of an entry starts with `./` (docs:plugins/manifest-reference,
  docs:plugins/marketplace-reference). `claude plugin validate <path>` exits 0 with warnings, and
  a missing `version` is a warning (docs:plugins/cli-reference).
- With no `version` in the manifest and in the marketplace entry, the version of a plugin is the
  commit. With a `version`, a user stays on a copy until the string changes (docs:plugins/loading,
  docs:plugins/host-marketplace).
- A `--plugin-dir` plugin takes the place of an installed plugin with the same manifest name
  (docs:plugins/loading).

The documents of Claude Code, on the install and the update:

- Claude Code does not fetch a plugin that only the project file enables, unless its marketplace
  entry has a relative-path source. Such a plugin needs no install record (docs:plugins/loading).
- `extraKnownMarketplaces` of a project file registers a marketplace after the workspace trust
  dialog. An entry takes `source` and an optional `autoUpdate`. A cloud session adds no such
  marketplace (docs:settings-reference).
- Claude Code clones a private marketplace with the git credentials of the machine and never
  prompts. For `owner/repo` it uses SSH when the key works, else HTTPS. A token in the
  environment works only through a credential helper (docs:plugins/install,
  docs:plugins/host-marketplace).
- Auto-update is off by default for a marketplace that is not official. An interactive session
  runs the update pass at most 10 minutes after its first message and keeps the versions that it
  loaded (docs:plugins/loading; ADR-0010 has the rule in full).
- `claude plugin update <plugin>` takes `--scope <user|project|local|managed>`. With no scope it
  updates the most specific record of the current project. The documents do not say if it
  refreshes the marketplace first; `claude plugin marketplace update [name]` does
  (`claude plugin update --help`, docs:plugins/cli-reference).
- `claude plugin list --json` prints an array. Each record has `id`, `version`, `scope`,
  `enabled`, and `installPath`, and a `project` record has `projectPath` (a run of the command).
- Claude Code removes the folder of an old version in a background cleanup 14 days after an
  update, "so a session that already loaded the old version keeps running" (docs:plugins/loading,
  "Cleanup of previous versions").

The documents of Claude Code, on a skill and on a permission rule:

- A `` !`<command>` `` line of a skill runs through bash before Claude gets the skill, in the
  current folder of the session shell. Its output takes the place of the line, and its stderr
  goes into the text. "A failed command aborts the entire skill invocation". The setting
  `disableSkillShellExecution` turns such lines off, for plugin skills too (docs:skills).
- An injected command never prompts. Outside auto mode, a permission check that does not return
  allow aborts the invocation, and `allowed-tools` pre-approves a command. The documents also
  say: in auto mode the skill loads with an instruction to run the command first (docs:skills).
  The probes below correct this sentence for a command that only reads.
- `disable-model-invocation: true` makes a skill start only from `/name`. The documents name no
  substitution in a supporting file of a skill (docs:skills).
- `Bash(scripts/celetis land *)` matches `scripts/celetis land` with or with no arguments, and
  not `./scripts/celetis land`: a rule matches the text before its first `*` (docs:permissions).
- In `claude -p`, a skill that the prompt names with `/skill-name` runs, and the session shows no
  trust dialog (docs:headless).

Other facts:

- agent-board v1 reads its config from the constant path `.claude/agent-flow/board.json`, and an
  entry of that config starts a file inside the main checkout (ADR-0009). The repository
  `ddinkov10/agent-board` is private, and a workflow of another repository cannot read it.
- The resolver finds a live landing in the process list with the pattern `*land.sh*`, and the
  runner finds a live runner with `*agent-flow.sh*`.
- Before this change, the marketplace `dinq` of the private repository `ddinkov10/dinq-harness`,
  with the entry `"source": "./"`, was installed at the `user` scope on the machine of the
  maintainer (`~/.claude/plugins/installed_plugins.json`).
- The worktree guard (ADR-0011): a session in a lane worktree refused `bash --version`, a `for`
  loop with `gh`, and two compound commands with git, and it ran
  `git -C <folder outside the worktree> rev-parse --git-dir`. So the build made each change of
  the plugin repository in a session outside a worktree.
- On 2026-10-12 `ddinkov10/celetis` was private and empty. gh 2.100.0 moves an issue with
  `gh issue transfer`, and `gh label create <name> --force` updates a label that is there.
- In `ddinkov10/fwrh_calculator`, `docs/adr/README.md` and the deployment runbook were the two
  documents outside `AGENTS.md` that named a lane command.

The probes. The build made them on 2026-10-12 on the Mac of the maintainer, with the plugin
`celetis@celetis` from `ddinkov10/celetis`. `P` was a new repository whose `.claude/settings.json`
held the marketplace and the two enabled plugins, and no permission rule. A turn was
`claude -p --no-session-persistence --permission-mode <mode> '/celetis:probe'` in `P`. The comment
`## Risk results` on ddinkov10/fwrh_calculator#435 holds each result with the name of its
evidence file. The files are in the lane worktree of that issue, and they go with it at the
landing. R1 to R5 are the risks of the spec. A "ruling of the build session" is a decision that
the build session made on these results. It is not a result of a probe.

- **R1, the wiring from the project file only: not shown.** Before each install, a turn in `P`
  did not load the plugin, and it added no marketplace and no record. Limit: a `-p` turn shows no
  trust dialog, so `P` was not a trusted workspace, and the probe does not show what an
  interactive session does after the trust dialog. The two commands of the Decision gave a
  `user` record at the head of `main` with no prompt (the clone used SSH), and
  `scripts/celetis capscore 1 0 1 1 1 0` then ran in `P`.
- **What the two commands write.** `claude plugin install` puts `"celetis@celetis": true` into
  `enabledPlugins` of `~/.claude/settings.json`. `claude plugin marketplace add` puts the
  marketplace into `extraKnownMarketplaces` there, with no `autoUpdate`.
- **R5, the lookup of the launcher: holds.** `claude plugin list --json` took 0.67, 0.72, 0.68,
  0.68, and 0.68 s in five runs in `P`, against a limit of 1.5 s. A second set of five gave a
  median of 0.70 s.
- **R4, the line of the custom part: holds.** The line of the Decision is a ruling of the build
  session. With that line in a throwaway skill, a turn in `default`, in `auto`, and in `dontAsk`
  gave the text of the custom file, with no tool call and no error text. After
  `cd .claude/agent-flow`, the Skill tool gave the same text. After `EnterWorktree`, it gave the
  custom file of the lane branch. In a worktree with no custom file, the skill showed no error,
  and it got the text that "With no custom file" in the Decision names.
  - The permission check is active in these turns: a control skill with a line that writes a
    file did not load in `default` and in `dontAsk` (`Shell command permission check failed`). In
    a `-p` turn, a failed check gives an empty answer and exit code 0.
  - In `auto`, a line that only reads ran when the skill loaded, with no tool call. The control
    line, which needs an approval, went to the model, and the model ran it with the Bash tool.
  - No turn loaded a skill and then entered a worktree. "Which checkout" in the Decision follows
    from the time at which the line runs.
  - In a folder that is no git repository, the shell text of the line prints one `fatal:` line
    of git on stderr and exits 0. No turn loaded a skill in such a folder.
  - Limit: each turn was a `-p` turn in `P`, which was not trusted and had no permission rule.
    No turn probed the line together with the `allow`, `ask`, and `deny` rules of a product
    project.
- **R3, the update before a step: holds.** The two commands of the Decision are the default of
  decision 8 of the plan. The probes confirmed that default, and the build session kept it by a
  ruling. `claude plugin update celetis@celetis --scope user` alone refreshes the marketplace
  clone and moves the `user` record: in five runs it got a new commit in about 5.5 s, and a new
  turn then printed the new version. But after a refresh of that clone it makes no fetch for
  about 30 s. 3 s after a refresh it printed
  `celetis is already at the latest version (eef069313c98)` in 0.64 s with exit code 0, while
  `main` of `origin` was at `5202ff8`. Directly after that, the two commands moved the `user`
  record to `5202ff806686`. The documents state a rule of 30 seconds for the refresh before an
  install (docs:plugins/loading).
  - Times of the two commands, for a repository of about ten files: 5.55 s and 0.67 s with a
    new commit, and about 3.6 s and 0.65 s with nothing new. For a new commit the first command
    makes a full new clone.
  - Exit codes: each run of the two commands exited 0, also with nothing new. A plugin name
    that does not exist exited 1. No probe shows a fetch that fails (no network, no
    credential).
  - `claude plugin update celetis@celetis` with no `--scope`, in a checkout that has a `project`
    record, moved only that record, and a new turn did not get the new version.
  - A turn in `P` loaded the folder of the `user` record, also when the `project` record of `P`
    was newer. Limit: the documents say that a project-scope plugin loads only after the trust
    check, and `P` was not trusted. So the turns do not show which record an interactive session
    in a trusted checkout loads.
  - `claude plugin uninstall celetis@celetis --scope project` removes the entry of the plugin
    from `enabledPlugins` of the project file.
  - No update removed a version folder. The folders that no record named had a marker
    `.orphaned_at`. No probe shows the cleanup after 14 days.
- **R2, `autoUpdate` in a project file: holds.** ADR-0010 records that this was not tested. The
  probe was one interactive session in the trusted checkout of `ddinkov10/celetis`. The project
  file of that checkout holds the key on the entry `celetis`, and the entry `celetis` of
  `~/.claude/settings.json` had no `autoUpdate`. Before the session, the `user` record, the
  `project` record of that checkout, and the marketplace clone were at `6793272cdd9d`, and
  `main` was at `8943f2d5ea39`. 3 min 18 s after the start of the session, the two records and
  the clone were at `8943f2d5ea39`, and no `claude plugin` command ran. So the key of the
  project file is sufficient for `celetis` in a trusted folder, and the new version reaches the
  next session. The probe is one run, in a checkout that has a `project` record.
- **A session in a trusted checkout with the project file makes a `project` record.** One
  headless turn in the checkout of `ddinkov10/celetis`, after its project file was there, made
  a `project` record of that checkout at the version of the `user` record. The update before a
  step moves only the `user` record, and the auto-update of R2 moved the two records.
- **V5 of the Verify phase: the runner updates the plugin before a step.** On 2026-10-13 the
  runner, started in a lane worktree of `ddinkov10/fwrh_calculator`, moved the `user` record
  from `8943f2d5ea39` to `652f410a7375` in 7 s, with no command by hand. The transcript of the
  session that it started holds only the folder of the new version.
- **V5b of the Verify phase: a session loads the version of the `user` record.** The check ran
  on 2026-10-13, directly after that update of the runner. The `user` record of
  `celetis@celetis` was at `652f410a7375`, and the `project` record of the trusted checkout of
  `ddinkov10/celetis` was at `8943f2d5ea39`, behind it. One interactive session in that checkout
  (`claude --permission-mode auto '/celetis:guide …'`) got the path
  `…/cache/celetis/celetis/652f410a7375/docs/agent-flow.md`. So a session loads the version of
  the `user` record, also when the `project` record of its checkout is behind, and the update
  before a step needs no third command.

The scripts and their tests, at the date of this record:

- Each script test of the plugin passes in `scripts/verify.sh`, under `/bin/bash` 3.2 of macOS,
  and in the workflow on Linux. Each test of a script starts it from a folder with a space.
- A script that reads the product project stops outside a git repository with the `fatal:` line
  of git: `worktree.sh`, `land.sh`, `next-step.sh`, and `agent-flow.sh`. The script is in the
  folder of the plugin, so only the current folder names the product project. `capscore.sh` and
  `root.sh` read no product project and run in each folder.

## Decision

The general harness is the Claude plugin `celetis`. It lives in the private repository
`ddinkov10/celetis`, which is also its marketplace. A product project holds no skill, no script,
and no document of the harness apart from one launcher file. It gives its product parts in three
places: its `AGENTS.md`, the config folder `.claude/agent-flow/`, and the custom parts in
`.claude/agent-flow/custom/`. It also holds its wiring, its worktree setup file, and its own
stores `docs/adr/` and `docs/lessons/`. `ddinkov10/fwrh_calculator` is the first product project,
and `ddinkov10/celetis` is the second: it runs its own lanes on its own landed plugin.

The maintainer made sixteen decisions in the `specify` session of 2026-10-12:

1. **A Claude plugin takes the place of the Copier approach.** The maintainer said: "yes it
   replaces the copier approach".
2. **The open harness changes land before the build.** The maintainer said: "first finish what
   the harness has to udpate from the issues and then move it outside of the repo".
   ddinkov10/fwrh_calculator#394 was the open one.
3. **Layer 1 is the move, and each later function is a new issue**: a setup command, add-on
   parts, verify scripts, another tracker, and the other product projects.
4. **`ddinkov10/dinq-harness` is not the home.** That repository is a fork of superpowers with
   the plugin `dinq-harness`. The maintainer said: "dinq harness is gone, it's a dead end, skip
   it". The lane skills keep their calls to the upstream `superpowers:*` skills, and ADR-0010
   stands.
5. **The name is `celetis`**: the repository, the plugin, and the prefix `/celetis:`. A
   repository with that name held an earlier attempt. The maintainer deleted it and made the new
   one, so that the build makes none: "as prerequisite i can create the new one so the agent
   doesn't have issues". The earlier attempt also had a global command `celetis` on the machine
   of the maintainer, which the maintainer removed.
6. **Each landed change of the plugin reaches the product projects, with no release step.** The
   maintainer said: "we will start with every change to land in the plugin repository as fast
   iteration is needed in the first rounds".
7. **The lanes run in `ddinkov10/celetis`, and the agent board is set up there.** The maintainer
   said: "the lanes should work there, and agent board should be set up".
8. **The promotion parts and the verify gate stay in each product project.**
9. **A step takes a custom part from the product project.** The maintainer said: "with an option
   to add a custom part of the prompt in each step", and: "that custom part to be injected into
   the generalized prompt". An add-on is not for each project: "verifications done on a real
   device, for example, emulator or such spikes are add-ons that not all projects needs".
10. **The config folder keeps the name `.claude/agent-flow/`.** The maintainer said: "Keep the
    config folder as is, it will open a new separate set of issues on both repos, so the agent
    board and the celetis in union change the paths".
11. **The harness ADRs get a copy in `ddinkov10/celetis`, with numbers from ADR-0001.** The
    maintainer said: "celetis copy of ADR should start from 1 not 7".
12. **A session by hand keeps working on a Windows host.** The maintainer said: "session by hand
    is good to be working even if not full auto is possibl through cli or agent baord". The
    runner and the board on a Windows host stay with ddinkov10/fwrh_calculator#422.
13. **No automation outside `ddinkov10/fwrh_calculator` names a harness command or a harness
    path.** The maintainer was asked about a daily job, a shell alias, and a routine, and said:
    "no".
14. **The later issues have an order**, below. The setup command comes after the first product
    project that gets the plugin by hand: "Step three will be the first one that we will see
    what we have to address as a setup".
15. **The ADR store of `ddinkov10/fwrh_calculator` gets no record of the move.** The session
    proposed a short record there that points to this one. The maintainer said: "the product
    project ADR Sshould care only about the product project ADR not outside scope, open separate
    issue in this repo to handle this". ddinkov10/fwrh_calculator#442 is that issue.
16. **The CI of `ddinkov10/celetis` skips the contract check of the board, and a later issue
    ends that difference.** The maintainer chose the skip over a credential as a secret of the
    repository: "CI skips this one check, but note as separate issue to handle this divergence".
    The verify gate on a machine runs the check.

**Calls of the session.** The maintainer did not make these choices. Each one is a choice of the
`specify` session, which the maintainer could correct at the review of the spec:

- **A product project uses the skills of the plugin directly, and nothing copies a skill into a
  project.** One copy on the machine gets each fix at once.
- **One launcher file in each product project, `scripts/celetis`, starts each script of the
  plugin**, for a session, for the maintainer in a terminal, and for the agent board. A skill and
  the maintainer then run the same command line. The maintainer saw this call and made no
  objection.
- **The name `agent-flow` stays in each place in layer 1**: the config folder, the runner
  (`scripts/celetis agent-flow`), the lock folder `<git common dir>/agent-flow/`, the git config
  key `agent-flow.gate.<step>`, and the line prefix `agent-flow: `. A rename of one part gives
  two names for one thing.
- **The repository is private**, and its root is the marketplace and the plugin:
  `.claude-plugin/marketplace.json` has one entry with `"source": "./"`, and
  `.claude-plugin/plugin.json` has no `version`. The id is `celetis@celetis`.
- **The skills are in one flat `skills/` folder**, and the README groups them.
- **The scripts stay bash.** A move and a rewrite in one change cannot be checked against each
  other. The script files keep their names, because the resolver and the runner find a live
  script by its name in the process list.
- **The history of `ddinkov10/celetis` starts new.** Each commit that brings harness files names
  the commit of `ddinkov10/fwrh_calculator` that they come from,
  `29422924717bb6d53f12a2c8ac19e052eee6b493`.
- **`ddinkov10/celetis` lands with the mechanism `pr`**, and its CI runs the script tests on
  Linux.
- **The plugin declares no dependency on superpowers.** The settings file of each product
  project enables the two plugins.
- **The numbers of the ADR copies come from the store at the time of the build**, and the record
  of the move lists the parts of the copies that describe the harness before the plugin. "The
  ADR copies", below, holds the rule of a copy, and Supersedes holds the list.
- **A project can have a custom part for each skill.** `ddinkov10/fwrh_calculator` gets two:
  `hotfix.md` and `implement.md`.
- **The test of the step text is a hand-run test.** It runs live `claude -p` turns, so it is not
  in the verify gate and not in the CI.

**The plugin.** It holds 18 skills in four groups: the lanes (`intake`, `triage`, `feature`,
`bug`, `hotfix`, `chore`), the steps (`specify`, `plan`, `implement`), review and memory
(`critic-loop`, `polishing-code-comments`, `lesson`, `lesson-review`,
`record-architecture-decisions`, `doc-drift-sync`), and the helpers (`prototype`,
`writing-for-agents`, `guide`). `guide` was a command, and it is a skill that only the user
starts. The plugin also holds the scripts, the step text, the documents, and its tests. It has no
`version`, no `bin/` folder, no hook, and no declared dependency.

**The commands.** In a session, a skill of the plugin is `/celetis:<skill>`, and a skill that
starts another skill names it the same way. `scripts/celetis <name> <arguments>` runs
`scripts/<name>.sh` of the installed plugin, with those arguments, and gives its output and its
exit code. The sub-commands are `worktree`, `land`, `next-step`, `capscore`, and `agent-flow`. The
runner uses one more, `root`, which prints the install folder. The form has no `./`, because a
permission rule matches the text of a command. A skill cites a document of the plugin as
`${CLAUDE_PLUGIN_ROOT}/docs/<file>`. The runner starts a step as before, with two changes: the
first prompt is `/celetis:<step> #<n>`, and the step text comes from the plugin. The session name
stays `#<n> <step>`, and the `step` field of contract 1 keeps the bare step name. The resolver
prints `run /celetis:<step> #<n>`, and its line for a finished issue is `stop #<n> is finished.`,
with no hint.

**The launcher.** `scripts/celetis` is one bash file, the same in each product project, and the
plugin repository holds it. It reads the records with `claude plugin list --json` at each call
and keeps no folder. It uses the `user` record of `celetis@celetis`, else the first record of
that id. With no `jq` on `PATH`, it prints `celetis: jq is not on PATH` and exits 1, before that
lookup. With no record, or with a `claude` that prints no JSON, it prints one line with the two
install commands and exits 1. A new script of the plugin needs no change to the launcher.

**The wiring.** Each machine runs `claude plugin marketplace add ddinkov10/celetis` and
`claude plugin install celetis@celetis` one time: R1 is not shown, and the launcher needs the
install record. The `.claude/settings.json` of a product project holds the marketplace under
`extraKnownMarketplaces`, with `"source": {"source": "github", "repo": "ddinkov10/celetis"}` and
`"autoUpdate": true`. It enables `celetis@celetis` and `superpowers@superpowers-marketplace`
under `enabledPlugins`. It allows `Bash(scripts/celetis land *)`, and it holds the `deny` rules
of the project. A plugin gives no permission rule.

**Versions and updates.** Each commit on `main` of `ddinkov10/celetis` is a new version.

- **Before the runner starts the session of a step, it runs two commands:**
  `claude plugin marketplace update celetis`, then
  `claude plugin update celetis@celetis --scope user`. They are the default of decision 8 of the
  plan. The probes confirmed that default, and the build session kept it by a ruling: the second
  command alone has the window of about 30 s of the evidence, in which a commit that lands does
  not come, and the command gives no sign.
- **A failed update does not stop a step.** The runner prints
  `agent-flow: the plugin update failed; the session starts on the installed version` and starts
  the session.
- **The step text follows the update (ruling of the build session).** After a successful update
  the runner reads the install folder again with `scripts/celetis root` and takes the step text
  of the session from that folder. The resolver and the logic of the runner stay the version of
  the runner process. The spec does not name the sub-command `root`.
- **The update by hand is the same two commands (ruling of the build session).** The spec named
  `claude plugin update celetis@celetis` for a session by hand. In a checkout that has a
  `project` record, that form moves only that record.
- **A session by hand** gets a change from auto-update at most one session late (ADR-0010), when
  auto-update is on for the marketplace. The key of the project file turns it on (R2). The two
  commands bring a change at once.
- `--board` and `--resume` make no update and no lookup.

**The config.** It is in `.claude/agent-flow/` of the main checkout of the product project. The
scripts read `gates.json` and `landing.json`, and the board reads `board.json`. With no
`gates.json`, a step is `auto` only when the git config of the machine names it `auto`, and `land`
refuses a missing or wrong `landing.json`.

**The worktree setup.** `scripts/celetis worktree <n>` makes the worktree and the branch from the
default branch of `origin`. It reads that name with `gh repo view --json defaultBranchRef`, as
the landing script does, only when it makes a new branch. It then runs
`bash .claude/agent-flow/worktree-setup.sh <main checkout>` of the new worktree, in that
worktree, with stdout sent to stderr. So the file needs no execute bit and can print, and the
path of the worktree is the only stdout line. A non-zero exit removes the new worktree and prints
`worktree setup failed`. A project with no such file gets no setup. The marker of a setup that is
done is `<git dir of the worktree>/agent-flow-setup-done`: a file in the working tree makes the
tree dirty. A lane worktree that the old harness made has no such marker, so its setup runs one
more time.

**A custom part.** It is the file `.claude/agent-flow/custom/<skill>.md` of a product project,
with the name of a skill of the plugin. Its text is an addition to one step. It cannot remove a
rule of the general skill, and it is no domain skill (ADR-0006).

- **The last line of each `SKILL.md` puts the file into the skill (ruling of the build
  session):**
  `` !`cat "$(git rev-parse --show-toplevel)/.claude/agent-flow/custom/<skill>.md" 2>/dev/null || true` ``,
  with no `allowed-tools` line. It reads the file from the root of the checkout where the shell
  of the session is when the skill loads. The plan named three other forms ("Alternatives
  considered").
- **Which checkout.** A skill that is the first prompt of a session, as in each step that the
  runner starts, reads the custom part of the main checkout. A skill that loads after
  `EnterWorktree` reads the custom part of the lane branch. So the sentence of the spec "a lane
  reads the custom part of its branch" holds only for a skill that loads inside the lane
  worktree.
- **With no custom file**, the skill gets the text `(Bash completed with no output)` in place of
  the line, not "no more text", as the spec says.
- **A skill that tells the session to read the file of another skill** does not give the custom
  part of that skill: the line runs only at a skill load, and the session reads the raw line.

**The general text.** No skill, script, or document of the plugin names a part of a product. A
product line of the old harness has one of three homes: the `AGENTS.md` of the product project,
for a fact that more than one step needs (the plugin names the role, for example "the verify gate
of the project"); a custom part, for an addition to one step; or no home, when a rule of
`.claude/settings.json` or the gate holds it already. A skill changes only where it names a
product part, a path of the harness, or a command name. `tests/text.test.sh` is the authority:
it fails on a product word of `ddinkov10/fwrh_calculator` (`backend`, `frontend`, `staging`,
`promote`, `fwhr`, `DESIGN.md`, `verify.py`) in a file that is no record of `docs/adr/`, with an
allow list for general uses.

**The ADR copies.** ADR-0001 to ADR-0011 are the copies of ddinkov10/fwrh_calculator ADR-0007
to ddinkov10/fwrh_calculator ADR-0017, in the same order: the number of a copy is the old number
minus 6, and its file keeps its slug. A copy changes only in its numbers. Each reference to one
of those eleven records has the new number, apart from one sentence of ADR-0008 that quotes two
issue texts (Consequences). Each reference to a record of that product has
`ddinkov10/fwrh_calculator ` before it, as in ddinkov10/fwrh_calculator ADR-0005. Line 3 of a
copy names its source. No other text changes, so an issue number in a copy is an issue of
`ddinkov10/fwrh_calculator`. The records stay in that repository too. The same test fails on an
ADR reference that names no record of `docs/adr/` and has no such prefix.

**`ddinkov10/celetis` as a product project.** Its `.claude/settings.json` enables the two
plugins, allows `Bash(scripts/celetis land *)`, and denies `gh pr merge`. Its `landing.json`
names `pr`, each gate is `me`, and its `board.json` has the port 4404, so its board runs beside
the board of the first product project on 4403. Its verify gate is `scripts/verify.sh`: the
script tests, with the contract check of the board, and `claude plugin validate`. Its workflow
sets `AGENT_FLOW_SKIP_BOARD_CHECK=1`, which makes `tests/agent-flow.test.sh` skip the contract
check. Only the workflow sets it. The repository needs no worktree setup file and no custom part.
A session there loads the installed plugin, which is the landed `main`, not the files of the
checkout, and its launcher runs the scripts of the installed plugin too. `claude --plugin-dir .`
loads the files of the checkout for a test of a change.

**Decisions of the plan.** The plan of ddinkov10/fwrh_calculator#435 made eighteen decisions.
The parts above hold seven of them: the install record ("The wiring"), the `user` record ("The
launcher"), the marker and the trunk ("The worktree setup"), the skip variable
("`ddinkov10/celetis` as a product project"), the two commands of the update ("Versions and
updates"), and the map of the ADR copies ("The ADR copies"). "Alternatives considered" holds one
more: the three forms of the line of the custom part. Two more shape the plugin:

- **Tests are in `tests/`.** The hand-run test of the step text is
  `tests/manual/step-prompt.test.sh`, so the glob `tests/*.test.sh` of the gate and of the CI
  does not run it. It runs its turns in the folder where it starts, so it also checks the
  `AGENTS.md` of a product project.
- **The text test has two more checks than the spec names:** old names of the harness, and the
  citations of the skills.

The other eight decisions are on the way and the order of the build, not on the plugin. The
plan and the order of the build are on ddinkov10/fwrh_calculator#435.

**The later issues**, in the order that the maintainer approved. They are issues of
`ddinkov10/celetis` unless the line names another repository.

1. The rename of `agent-flow` to `celetis-flow`, with an issue in `ddinkov10/agent-board` for
   the config path. It is first, so that no new product project gets the old path.
2. The plugin in `porftolio-rebalancer`, by hand. Its issue records each file that the hand work
   wrote, and each general part that is still not in the plugin.
3. A setup command that asks about a project, writes its files, and sets up the agent board. It
   is built from the record of step 2.
4. The add-on parts, for example a check on a real device or an emulator.
5. The plugin in `norla`, as the first user of the setup command. It is a mobile app, so it
   comes after the add-on parts.
6. With no order between them: a setup that writes verify scripts for a product project, a fully
   local flow with no issue tracker, and Plane as the issue tracker.

Two issues have no place in the order: the contract check of the board in the CI (decision 16),
and a runner that stays open for more than 14 days (Consequences).

## Alternatives considered

- **Copier: a template that copies the harness into each repository.** The related plan of the
  spec of ddinkov10/fwrh_calculator#430 named it. Each copy can drift, and ADR-0009 rejected
  Copier for the board for that cause.
- **A copy of each skill in each project, which the plugin writes or updates.** The maintainer
  asked which is best: skills that the plugin applies to a project, or skills that the project
  uses directly with its custom parts injected. A project can then edit each line of a step. But
  a copy drifts, and a fix must reach each copy.
- **The `bin/` folder of the plugin in place of the launcher.** It needs no file in a product
  project. But by the fact of the documents on `bin/` ("Constraints and evidence"), a terminal
  and the board do not get that folder. The documents do not show it for a subagent or for a
  Windows host. The config of the board also names a file inside the main checkout (ADR-0009),
  and the launcher is such a file.
- **The fork `ddinkov10/dinq-harness` as the home.** It holds the plugin `dinq-harness` in a
  fork of superpowers. The maintainer said that it is a dead end (decision 4).
- **A version and a release step.** A product project then stays on a copy until a release, so a
  bad change does not reach it at once. But each change waits for a release, and the maintainer
  asked for fast iteration in the first rounds (decision 6). Layer 1 has neither.
- **The wiring from the project file only**, with no command on a machine. The documents allow
  it for a relative-path entry. "The wiring" in the Decision gives the two causes against it.
- **The launcher keeps the folder that it found in a file.** It was the fallback of R5. The
  lookup takes about 0.7 s, so it is not necessary, and a kept folder is the folder of an old
  version after each update.
- **The three forms of the line of the custom part that the plan named**, to try in this order.
  The first is `cat .claude/agent-flow/custom/<skill>.md`. The risk results say that it "passed
  each condition of the brief" of the probe task. The probe in a subfolder is the one that it
  did not pass: after a `cd` to a subfolder it loses the custom part with no error. The second
  is that line with an `allowed-tools` line. The first form and the line of the Decision ran in
  each mode with no such line. The third is a sentence that tells the session to read the custom
  file. It was the fallback of R4, and R4 holds.
- **`git show HEAD:.claude/agent-flow/custom/<skill>.md` as the line of the custom part.** It
  ran with no prompt in each mode. It gives the text of the last commit of the branch, not the
  text of the file.
- **`claude plugin update celetis@celetis --scope user` alone before a step.** It is the
  shortest sequence that got a new commit, but it has the window of about 30 s.
- **No update in the runner, and one command by hand.** It was the fallback of R3. A change of
  the plugin then reaches a step only after an act of the maintainer.
- **A declared dependency on superpowers.** The two plugins come from two marketplaces, so the
  dependency needs one more setting, and a plugin whose dependency is missing does not load.
- **Folders for the groups of the skills.** They need a `skills` list in the manifest and give
  nothing more.
- **The rename of `agent-flow` in this change.** The board reads a fixed config path, so the
  rename is one change in two repositories together. It is the first later issue.
- **A credential of `ddinkov10/agent-board` as a secret of the CI**, so that the CI runs the
  contract check. The maintainer chose the skip (decision 16).
- **A short record in the ADR store of `ddinkov10/fwrh_calculator` that points to this one.**
  The maintainer rejected it (decision 15).
- **A marker of the worktree setup in the working tree.** It makes a new worktree dirty unless
  each product project ignores the file.

## Consequences

- One copy of the harness serves each product project on a machine, and a fix reaches each one
  with no copy step. A product project holds its wiring, its config, its custom parts, its
  worktree setup file, and the launcher.
- **The costs of direct use.** Each command has the prefix `/celetis:`. A project can only add
  text to a general step. A bad change reaches each product project at once (R7): the plugin has
  no version and no release step. The gate and the CI of `ddinkov10/celetis` guard only a change
  that lands through `scripts/celetis land`. A direct push to `main` reaches each product project
  at its next step, and the workflow runs after the push. The repository has no branch
  protection, so each process that has the git credential of the maintainer can push. A revert on
  `main` is the way back. When a bad version stops the runner before its update, the runner does
  not get the revert by itself: revert on `main`, and then run the two commands of the update by
  hand ("Versions and updates" in the Decision).
- **A private marketplace and the background update (R8).** The update needs a credential that
  works with no prompt. Without one the background update fails quietly, and the old copy stays.
  A cloud session adds no marketplace from a project file.
- **One version for each machine (R9).** The product projects of a machine always run the same
  version, and a project cannot stay on an older one. A session by hand can be one version
  behind the scripts that its launcher runs.
- **A Windows host (R10).** The Bash tool of a Windows host is Git Bash, and the scripts run
  there. The launcher turns a Windows path with `cygpath`, but no session showed its lookup
  there: the build session has no Windows host. The maintainer makes that check before
  `ddinkov10/fwrh_calculator` changes to the plugin.
- **Each machine needs two commands one time.** The install enables the plugin at the `user`
  scope, so each session of that machine loads it, in each folder.
- **The plugin is on in each folder of a machine.** A session in a project that is not wired
  also lists the 18 skills, and a lane skill that starts there from free text makes a GitHub
  issue before it finds no launcher. Layer 1 keeps the install at the `user` scope: the launcher
  and the update need the `user` record. The documents give a way to limit this, which is not
  shown here: `"celetis@celetis": false` in `enabledPlugins` of `~/.claude/settings.json` turns
  the plugin off at the `user` scope, and the project file of a wired project turns it on
  (docs:plugins/loading, "Disabled in user settings but still loads", read on 2026-10-13).
- **Each step that the runner starts begins about 5 to 7 s later.** The two commands take 4.2 s
  with nothing new and 6.2 s with a new commit, and the one lookup of the launcher after a good
  update takes 0.68 s. The step needs the network and a credential for the update. The times are
  for a repository of about ten files, and for a new commit the first command makes a full
  clone.
- **A runner process that stays open keeps the folder of its own version** for its resolver and
  its launcher. Claude Code removes that folder 14 days after an update. After that, the
  automatic runner (the form with no number, which is the form that stays open) cannot start
  `next-step.sh`. It prints `agent-flow: stop cannot read the open issues from GitHub` one time,
  and bash prints a `No such file or directory` line each 60 s. A runner with numbers prints
  `agent-flow: #<n>: next-step.sh printed no line` for each number. The first line points at
  GitHub, and the cause is the removed folder. The cure is a new start of the runner. Layer 1
  does not fix this.
- **A change of a custom part on a lane branch reaches a step that the runner starts only after
  it is on the trunk and in the main checkout** ("Which checkout" in the Decision).
- **The text of a skill is not the same in each folder.** With no custom file it ends with the
  text that "With no custom file" in the Decision names. In a folder that is no git repository,
  the line gives one `fatal:` line of git, which goes into the text by the documents. The
  setting `disableSkillShellExecution` turns the custom parts off.
- **The permission rules are the work of each product project.** The plugin gives none. A rule
  matches the text of a command, so a command with `./` before `scripts/celetis` does not match
  the `allow` rule.
- **Two names stay until the rename:** the plugin is `celetis`, and each place that the call
  "The name `agent-flow` stays" lists keeps the name `agent-flow`.
- **The CI of the plugin repository does not check contract 1.** A change of the runner that
  breaks the contract passes the CI and fails the verify gate on a machine.
- **A change on a lane branch of `ddinkov10/celetis` reaches no session before it lands**, unless
  the session starts with `--plugin-dir` ("`ddinkov10/celetis` as a product project" in the
  Decision). The tests run the files of the checkout.
- **The copies have two number systems in one text.** ADR-0005 is a record of this store, and
  ddinkov10/fwrh_calculator ADR-0005 is a record of that product. A copy that quotes a number of
  an issue text holds that number with the repository before it: ADR-0008 says that the spec on
  its issue names it ddinkov10/fwrh_calculator ADR-0012. A number with no `ADR-` before it did
  not change: ADR-0009 gives its own number as 0015. One `Supersedes` section names a record by
  its file stem, and that stem has the new number.
- **The ADR store of `ddinkov10/fwrh_calculator` keeps the eleven records** with their old
  numbers until ddinkov10/fwrh_calculator#442 decides on them. The two stores can then differ.
- **One thing is open at the date of this record:** the launcher on a Windows host (R10).

## Reconsider when

- A bad change of the plugin reaches the product projects and breaks a lane there: a version and
  a release step are then the alternative.
- A product project tracks its issues in a tracker that is not GitHub. The resolver, the landing
  script, and the worktree script call `gh`.
- The runner or the board must run on a Windows host with no bash
  (ddinkov10/fwrh_calculator#422).
- Claude Code changes the load of a plugin, the injected `` !`<command>` `` line of a skill, or
  the output of `claude plugin list --json`. The launcher, the update, and the custom parts
  depend on them.
- A second maintainer uses the harness, or the repository becomes public. Each landed commit
  then reaches the machine of another person with no review by that person.
- An interactive session in a trusted checkout loads a `project` record that is behind the
  `user` record.
- A runner stays open for more than 14 days in normal use.
- A product project must remove or change a rule of a general step, and an addition is not
  enough.
