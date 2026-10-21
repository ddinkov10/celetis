# The setup command proposes and tests the worktree setup

## Date

2026-10-21

## Related

- ddinkov10/celetis#42: the spec of this change, with the decisions of the maintainer, and its
  plan.
- ddinkov10/celetis#7: the epic of the setup command. Its comment of 2026-10-18 holds the 9 points
  of the hand setup of the first lane of a product project. ddinkov10/celetis#6: the record of
  that hand wiring, with its gaps 4 and 5.
- ddinkov10/celetis#41 and ADR-0017: the setup command, which names #42 as a later child. This
  record adds the product parts that setup writes.
- ddinkov10/celetis#46: the second run, which replaces and removes owned entries only.
  ddinkov10/celetis#55: the review that keeps `worktreeSetup` beside Claude's `.worktreeinclude`.
- ADR-0012 and ADR-0015: the worktree setup, its marker in the git dir, and `worktreeSetup` in
  `.celetis.yaml`.
- `skills/setup/SKILL.md`; `try`, `lane`, and the inputs `--setup-file`, `--ignore`, and
  `--baseline-file` of `write` in `scripts/setup.sh`; `run_setup` and `marker_of` in
  `scripts/worktree-lib.sh`; `scripts/worktree.sh`; `tests/setup.test.sh` and
  `tests/worktree.test.sh`; and `README.md`, "Wire a product project".

## Context

The maintainer wired a product project by hand, and its first lane worktree got no setup. The
lane had no environment of its own, so it could not run the checks of the project. The setup is
different for each repository, so the plugin cannot ship one generic script. The hand setup also
met these traps (the comment of 2026-10-18 on #7, and gaps 4 and 5 of the record on #6):

- The bare system interpreter had no release of a pinned dependency.
- The environment of the main checkout held an editable install of the main checkout, so a lane
  that used it tested the code of the main checkout.
- `.gitignore` had no `.claude/worktrees/`.
- A script that is only on the local trunk has no effect: a new lane branch starts at
  `origin/<trunk>`.
- `scripts/celetis worktree` wrote its marker also when the project had no script, so a lane made
  before the script landed never got the setup.
- The shared pre-commit hook called a tool in `.venv/bin/` relative to the working directory. In a
  lane with no environment, it printed a warning, skipped its checks, and exited 0.
- The base had 28 type-check errors, and a lane had no place to find that baseline.

#41 made `/celetis:setup`, which writes the wiring. It writes no `worktreeSetup` and runs no check
of the project. ADR-0017 names the stack of #42 as a judgment of a session.

## Constraints and evidence

- The maintainer made the two decisions of the spec of #42 in a session on 2026-10-20: the shape
  of the flow, and the baseline in `AGENTS.md` of the product. The other choices of the spec
  ("Calls of the session") and the 10 decisions of the plan were open at the review of each
  document.
- git 2.56.0: in a linked worktree, `git rev-parse --git-path hooks` prints the hooks folder of
  the main repository, so all worktrees share the hooks. `git commit --no-verify` skips only the
  `pre-commit` and `commit-msg` hooks. The commit that adds `git hook list` has the date
  2026-02-19, after the freeze of 2.53, so the command is newer than the git floor 2.31 of the
  README. Its first release is not settled.
- git 2.40.0.windows.1, in a detached linked worktree: a commit with
  `-c core.hooksPath=/dev/null -c commit.gpgsign=false` ran neither the `pre-commit` nor the
  `post-commit` hook, and a plain `git commit` ran `pre-commit`. `GIT_AUTHOR_NAME`,
  `GIT_AUTHOR_EMAIL`, `GIT_COMMITTER_NAME`, and `GIT_COMMITTER_EMAIL` set the identity with no
  config.
- uv 0.10.0 downloads a managed Python when the requested version is not on the machine, unless
  `--no-python-downloads` or `UV_PYTHON_DOWNLOADS=never` is set. uv 0.10.10 uses a system Python
  when no managed Python is installed, and `--managed-python` refuses the system Pythons.
  `uv sync` makes `.venv` in the project and installs the project in editable mode by default.
- yq v4.54.1, through `celetis_config_read`: a `worktreeSetup` literal block at the end of a file
  keeps the trailing newlines that its chomping gives. `|-` drops the final newline, `|` keeps one,
  and `|+` keeps all. With `|2`, the spaces after the first two stay. A CRLF line reads as LF, so
  the value changes. A block after a `...` end marker gives `<document>: invalid YAML`. jq 1.8.1:
  `--rawfile` binds the bytes of a file with its trailing newlines.
- Claude's `.worktreeinclude` copies ignored files into a new worktree, but only on Claude (#55,
  "Effect on epic #7").
- `tests/setup.test.sh` and `tests/worktree.test.sh`, in the verify gate, cover the deterministic
  part: the three new inputs of `write`, the test lane, the run in a lane that exists, and the
  marker rule. The plan has one live run of the skill on Claude, in a scratch Python project with
  `uv`. Codex stays UNRUN (risk 4 of the spec).

## Decision

**The session proposes the script, and the script is a part of the product** (decision 1 of the
spec). After the landing question, when `.celetis.yaml` has no `worktreeSetup`, the session reads
the manifests, the lockfiles, the version pins, and the CI workflows, and proposes one script:

- It stops at the first failed command (`set -euo pipefail`).
- It gets the interpreter from a version manager that can fetch it, at the version that the
  project pins and that its dependencies accept. It never uses the bare system interpreter: with
  `uv`, it adds `--managed-python`.
- It builds the environment inside the lane, with an editable install there.
- It copies an ignored file of the main checkout (`$1`) only by its exact name, and it copies no
  credential file. Each copy is optional: a missing source prints one line on stderr, because a
  failed setup removes the new lane. The session reads only the names of the ignored files.

The session shows the script, each copied file, each excluded credential path, each tool that each
machine needs, and the checks of the test, and it asks before any write. Setup installs no tool.
With no manifest, the session proposes no script. A `worktreeSetup` that is there, also `""`,
stays and goes to the test as it is: an empty field is the maintainer's choice of no setup.

**A test lane before any write** (decision 1). `scripts/celetis setup try` takes the options of
`write`. It removes a test lane that an earlier run left, and it stops on a folder there that is
no worktree. It makes the detached worktree `.claude/worktrees/setup-try` at `HEAD` of the local
trunk, and it writes the wiring there with the code of `write`. It commits the wiring with no hook
(`-c core.hooksPath=/dev/null`), no signing, and the fixed identity
`celetis <setup@celetis.invalid>`. So the test lane holds the tree of a new lane after the push,
and the commit needs no identity and no key of the machine. No product hook runs before the script
built the environment. `try` then runs the `worktreeSetup` of the test lane with the call of
`scripts/celetis worktree`. It runs in the main checkout after the checks of `check`, which read
the repository on GitHub once, and it makes no label: a label is a change on GitHub. Its stdout
holds only the path of the test lane, also after a failed setup, and it exits with the status of
the setup. `try --remove` removes the test lane; the throwaway commit has no ref. The test runs
also with no script, because a lane with no setup is what a new lane gets then.

In the test lane, the session checks the exit status, an import of the package of the project from
a path inside the lane, the checks of the project, a clean `git status` after the setup and after
the checks, and the hooks. It runs only lint, test, type-check, and build steps that need no
secret. A dirty path becomes a proposed `.gitignore` line, and after the maintainer's yes, `try`
runs again with the lines. A proposed script that fails the exit status, the import, or the clean
status goes back to the proposal, not to the write. When the maintainer drops it, the test runs
again with no script. A failure of a script that was in `.celetis.yaml` already is a finding of the
report, and the maintainer changes the field by hand. A failure from a missing environment or tool
is a finding of the setup, not a failure of the base.

**The hooks** (a call of the session). The session finds the hooks of a commit and of a push in the
folder of `core.hooksPath` when it is set, else in the folder of `git rev-parse --git-path hooks`,
and in the `hook.*` entries of the Git config. It reads each hook, checks in the test lane each path
and each tool that the hook needs, and runs the pre-commit hook there. A run alone is no proof: a
hook can pass because nothing is staged. Setup reports each hook that does not find a tool, or that
skips its checks in the test lane, and it changes no hook.

**The baseline goes into `AGENTS.md` of the product** (decision 2). When a check of the project
fails on the base, the session drafts the section `## Baseline of the checks`: the rule to compare
each check of a lane with the base commit of the lane, not with zero, and each failure with its
command, its count, and its date. It drafts no section when each check passes, or when `AGENTS.md`
states a baseline rule already. Each session reads `AGENTS.md` at its start, so no lane step
changes.

**Three product parts of `write`** (decisions 1 and 2, and the calls of the session). `write` runs
once, with `--setup-file`, one `--ignore` for each line, and `--baseline-file`, and only with the
parts that the maintainer approved. Setup writes each part only when it is missing, and the record
`.claude/celetis-flow/wiring.json` does not list it, as with the stores of #41. So the second run
of #46 never replaces or removes it, and a part that is there gets no change.

- `worktreeSetup` goes as a literal block at the end of `.celetis.yaml`. A new `.celetis.yaml`
  holds `host`, `landing`, and then the block. The chomping comes from the trailing newlines of
  the script (`|-`, `|`, or `|+`), with the indentation indicator `2` when the first line that is
  not empty starts with a space. `celetis_config_read` must give back the script byte for byte,
  and each other value unchanged. Else setup stops before any write:
  `setup: cannot add worktreeSetup to .celetis.yaml; add it by hand first`. A field that is there
  with another value gets a warning, as `host` and `landing` do.
- Each missing `--ignore` line goes to `.gitignore`, with the line compare of #41.
- The baseline section goes to the end of `AGENTS.md` when no line of the file equals its heading.
  Else setup leaves it and prints a warning.
- The script and the section pass as files, so that no shell changes their text. The files live in
  a scratch folder outside the checkout, so that `git status` does not show them. A relative path
  resolves against the working directory of the caller. A file that `write` cannot read stops it
  before any write.

**The lanes that exist** (decision 1). After the push step, also after a no or a failed push and
when no file changed, the session lists each worktree in `.claude/worktrees/` on a branch
`feat|fix|hotfix|chore/<n>-*`, and it asks for each one whether to run the script there.
`scripts/celetis setup lane <path>` runs only from the main checkout, and a relative `<path>`
resolves against the working directory of the caller. It runs the `worktreeSetup` of the main
`.celetis.yaml`, not the one of the lane, because the lane branch can be older than the script. It
runs no trunk check and no check of a dirty tree, so it also runs after a no to the push. A marker
that is there does not stop it. It writes the marker after a success. After a failure, it keeps the
lane with no marker. Setup changes nothing else in the lane. A lane branch with an older
`.gitignore` can show the new environment as untracked, and the report then names a merge of the
trunk into that branch.

**The marker means that a script ran** (decision 1). `scripts/celetis worktree` writes
`<git dir of the worktree>/celetis-flow-setup-done` only after a script that is not empty
succeeded. With an empty or missing `worktreeSetup`, it writes no marker, so a script that a merge
of the trunk brings runs at the next entry. `run_setup` in `scripts/worktree-lib.sh` holds the call
of the setup and the write of the marker for `worktree`, `try`, and `lane`. The marker stays in the
git dir (ADR-0012).

## Alternatives considered

- **A generic script in the plugin.** One script is simpler to ship. But the stack, the pinned
  versions, and the ignored files of a lane are different for each repository, and a generic
  script cannot tell a safe file from a credential file.
- **Claude's `.worktreeinclude`.** It copies ignored files into a new worktree with no script. But
  it works only on Claude, and it builds no environment (#55).
- **An option that only removes the marker of a lane,** as the comment on #7 offers. It runs
  nothing: the next `scripts/celetis worktree <n>` reads the config of the lane, which has no
  script until the lane branch merges the trunk. So `lane` is the one option.
- **`git hook list` to find the hooks.** It names each hook of an event with its source in one
  command. But it is newer than the git floor 2.31 of the README. The hooks folder and the
  `hook.*` entries work on that floor.
- **`--no-verify` for the commit of the test lane.** It skips only the `pre-commit` and
  `commit-msg` hooks, so the other hooks of a commit still run before the script built the
  environment.
- **A required copy of an ignored file.** A missing file is then a clear failure. But a failed
  setup removes the new lane, so each lane on a machine with no such file (a fresh clone, another
  machine) fails.
- **Own the script, the ignore lines, and the baseline in the record, as `host` and `landing`.** A
  later run can then replace a stale script. But they are parts of the product, which the
  maintainer changes by hand, as the stores of #41 are.
- **Propose a new script also when `worktreeSetup` is there, and replace the field after a yes.**
  The maintainer then edits less by hand. But setup then changes a part of the product that is
  there, against an anti-goal of the spec, and an empty field is the maintainer's choice of no
  setup.
- **A lane step that compares each check with the base by itself** (not now in the spec). The
  product then holds no rule. But the rule in `AGENTS.md` reaches each session with no change of a
  lane step.

## Consequences

- A script reaches the trunk only after it passed its test in a lane with the tree of a new lane.
  After the push, a new lane gets an environment of its own and a place to find the baseline. A
  lane made before the script gets it through `lane`.
- `write` still runs once, and it makes the labels. `try` and `lane` make no change on GitHub.
- Each machine needs the tools of the script, for example `uv`, and a missing tool makes the test
  fail. Setup runs a script only in the test lane, and in a lane that exists after a yes for that
  lane.
- The three parts are not in the record, so a stale script, ignore line, or baseline stays until
  the maintainer changes it by hand. A `worktreeSetup` that is there and fails its test also needs
  a hand edit.
- A script that cannot read back from a literal block needs a hand edit of `.celetis.yaml` first:
  CRLF line endings, a first line that starts with a tab, or a file with a `...` end marker.
- On a first run, the main `.gitignore` can lack `.claude/worktrees/`, so `git status` of the main
  checkout shows the test lane as untracked until `try --remove`.
- On a no to the push, a new lane gets no setup until the wiring is on the trunk of `origin`.
- The risks of the spec stay open:
  - A hook can pass with nothing staged, so the session must read each hook (risk 1).
  - The stack detection is a judgment: a stack that the session does not know gets a weak
    proposal, and the test lane is the guard (risk 2).
  - A check can be slow, or need a service or the network. Such a failure goes into the baseline
    with its cause (risk 3).
  - The sandbox of a host can refuse the network, or a cache outside the checkout, in `try`. The
    refusal goes to the normal approval of the host. Not checked on either host (risk 4).
  - A lane made before the marker change keeps a marker with no setup, and only `lane` fixes it
    (risk 5).
  - The test lane equals a new lane only after the push: another push to the trunk between the test
    and the push changes the base of the next lane (risk 6).

## Reconsider when

- Both hosts give one native way to set up a new worktree, with an environment and the copies of
  ignored files.
- The git floor of the README reaches the first release with `git hook list`.
- A later run must replace or remove a worktree setup, an ignore line, or a baseline section.
- A lane step can compare each check with the base commit of the lane by itself.
- A new lane starts at a base other than the trunk of `origin`, so that the test lane no longer
  holds its tree.
- The reader of `.celetis.yaml` changes how a literal block reads back.
- A product project needs a credential file in a lane.
