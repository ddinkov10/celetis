# The scripts

This folder holds the verify gate, the build, the pin installer, the worktree setup, and the Herdr
lab. Run each one in a checkout of this repository. No check needs model credentials or tokens. A
product project runs no build: each machine installs the engine one time
(`plugins/celetis/README.md`, "First install"), and that install puts only the locked dependencies
of the engine into its version folder. `scripts/worktree-setup.ts` installs the full lockfile, the
gate tools of the devDependencies too, into `engine/node_modules` of a checkout of this repository.
It installs into the checkout that holds it; the worktree setup passes the main checkout as an
argument that the script does not read.
[`AGENTS.md`](../AGENTS.md#verify-gate) gives the rules of the gate, the build, the worktree setup,
and the pin installer for a change.

## The verify gate

`scripts/verify.ts` is the verify gate. It runs these jobs, each by its name:

- The role of each tracked path.
- Biome on the authored TypeScript, JSON, and CSS, also of `website/`.
- Strict types, also of the TypeScript of `website/`, with no site packages.
- Native actionlint, and YAML validation.
- Plugin validation: `claude plugin validate plugins/celetis` and `claude plugin validate .`.
- `checkCitations`: the citations and the links of the agent text
  ([`AGENTS.md`](../AGENTS.md#where-agent-text-lives) lists its rules).
- `checkContract`: each `celetis` form and each exit code of the agent text against
  `engine/lib/contract/contract.ts` (ADR-0079 and ADR-0084).
- `checkImports`: the import rules of `engine/` (ADR-0081 and ADR-0087).
- `checkContractVersion`: the contract version of the plugin against the served versions, and
  the digest of the declarations of `engine/lib/contract/contract.ts`
  ([`AGENTS.md`](../AGENTS.md#verify-gate) gives the rule, ADR-0090).
- `checkTools`: the MCP tools that `engine/lib/mcp/tools.ts` builds from the agent forms of
  `engine/lib/contract/contract.ts`
  ([`engine/README.md`](../engine/README.md#the-mcp-server), "The gate", lists its rules, ADR-0125).
- The tracked-test check (ADR-0029).
- The generated files of the build.

Before the jobs, `checkDependencies` checks that `engine/package.json`, `engine/bun.lock`, and
`engine/node_modules` agree, in both `dependencies` and `devDependencies`, and `checkBunTypes`
checks that `@types/bun` is `bunFloor`. The gate installs nothing, so a stale or production-only
install refuses with the command of the worktree setup, and the jobs do not start.

The jobs run in bounded workers. A passing run prints the success line of
[`AGENTS.md`](../AGENTS.md#verify-gate). That section gives the command and the pinned tools.

## The build

`scripts/build.ts` writes the files that come from other files. Besides the files that
[`AGENTS.md`](../AGENTS.md#verify-gate) names, it writes the engine entry `engine/celetis` and
`plugins/celetis/hooks/entry.js`, which embeds `plugins/celetis/references/procedures/entry.md`. An edit of
that file needs a run of the build. The build installs nothing. Add the file `engine/<name>.ts` with each new declared command.

The board page has two steps, in `pageArtifacts`. The bundle step builds `engine/board/page/main.tsx`
into `engine/board/board.js`, with the production JSX runtime and the production condition and
`NODE_ENV` of React. Its guard refuses each bundle input that is not a file of `engine/board/`, an
issue key file of the tracker, or a file of a package that `packages` of `engine/bun.lock` holds,
nested packages too. The CSS step runs the Tailwind CLI of the lockfile on
`engine/board/page/app.css` and writes `engine/board/app.css`, with `--cwd engine/board`. Before
it, its guard runs `compile` of `@tailwindcss/node`, the compile that the CLI runs, and refuses
each path that the compile reads when the path is neither in `engine/board/` nor in a package of
`engine/bun.lock` (the decision of the maintainer on issue #344,
https://github.com/ddinkov10/celetis/issues/344#issuecomment-7060263068). The hooks of the compile
refuse each `@plugin` and `@config`, and each `@import` or `@reference` id that is absolute, a
URL, an escape, a brace pattern, a relative id with no `.css` end, or an unlocked package. Each
stylesheet that the compile reads must be in `engine/board/` or in a locked package. Each base and
pattern of the sources of the compile must stay in `engine/board/`, with no `..` segment. An
`@import` that the output still holds is refused. Tailwind drops a repeated `@tailwind utilities` rule, so the guard accepts that
repeat, and it has no effect. ADR-0123, "The limits of the checks", lists the probe of each case.
The global rules of the board are in `engine/board/page/app.css`, and each other rule is utilities of its owner component.

```sh
BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 bun --no-env-file --no-install --config=/dev/null --no-macros scripts/build.ts
```

## The workflow

The workflow `test.yml` has one job, `test`, on Linux. It installs the locked packages of the
engine, the gate tools and the packages of the board page too, with `scripts/worktree-setup.ts`,
then `actionlint` and Claude Code with `scripts/install-tools.ts`, then runs the verify gate.
The workflow is disabled in this repository (ADR-0135), so it does not run.

The workflow `docs.yml` builds the site of `website/` and deploys it to GitHub Pages on each push
to `main`. It is no check of a change.

The workflow `release.yml` runs on a pushed release tag `v<X.Y.Z>` and publishes that version to npm
(ADR-0138; "The release"). It is no check of a change either.

## The pin installer

`scripts/install-tools.ts` installs the native `actionlint` after a check of its hash, with
`--claude` Claude Code, and with `--herdr-core` the pinned `hc` of herdr-core after a check of the hash of its
archive. The flag `--herdr-core` works on Linux only: macOS and Windows refuse it, because the Herdr app
supplies `hc` there. Biome, TypeScript, and `@types/bun` are devDependencies of
`engine/package.json`: the gate runs the JavaScript entries of Biome and TypeScript from
`engine/node_modules` on the selected Bun. [`AGENTS.md`](../AGENTS.md#verify-gate) gives its command.

## The release

`scripts/release.ts <X.Y.Z>` makes a release. The maintainer runs it at the top of the main checkout,
on `main`, with a clean tree and `HEAD` equal to `origin/main`. It makes a detached worktree in the
OS temporary folder, adds `"version": "<X.Y.Z>"` to the two plugin manifests, commits that as
`release: v<X.Y.Z>`, installs the locked packages of the engine there, runs the verify gate on that
commit, and then tags it `v<X.Y.Z>` and pushes the tag. `main` and each other branch do not move.
The tag form is `v<int>.<int>.<int>` with no leading zero and no pre-release part.

Each refusal prints `release: <reason>`. Only the failed push leaves a ref, the local tag:

- Exit 2: the argument is not one version `X.Y.Z`.
- Exit 3: the folder is not the top of a checkout, the branch is not `main`, the tree is not clean,
  or `HEAD` is not the commit of `origin/main`.
- Exit 3: `v<X.Y.Z>` is not newer than the greatest release tag of `origin`; the line names that tag.
- Exit 3: a manifest has no single line `  "name": "celetis",`, or it holds a `version` already.
- Exit 3: the release commit has no `engine/bun.lock`, or the locked package install or the verify
  gate failed on it; the line names the commit, and nothing was tagged.
- Exit 3: the local tag `v<X.Y.Z>` exists and `origin` has no such tag; the line names the push command.
- Exit 6: another Git command failed, for example `git ls-remote` with an `origin` that it cannot
  reach, or `git commit` with a hook that fails. The reason is `git <command> failed: ` and the
  error text of Git, which can have more than one line. Nothing was tagged.
- Exit 6: the push failed. The local tag stays. Run `git push origin refs/tags/v<X.Y.Z>`; the script
  does not retry, and a second run refuses because of the local tag.

A manifest that is not valid JSON gives no `release:` line: the script ends with the stack of the
JSON parse error and exit 1, and nothing was tagged.

On success it prints `release: v<X.Y.Z> -> <full commit>` and exits 0.

The pushed tag runs the workflow `release.yml`. Its job checks out the tag, runs the verify gate,
and runs `scripts/package.ts <X.Y.Z> "$RUNNER_TEMP/celetis"` at the top of that checkout. It runs
`npm publish` on the tarball `"$RUNNER_TEMP/celetis/celetis-<X.Y.Z>.tgz"` that the script packed and
read, through trusted publishing with no stored token, only when the last line is `package: publish`.

`scripts/package.ts <X.Y.Z> <folder>` makes the npm package of a release. It refuses unless the
current folder is the top of a checkout, `HEAD` is the commit of the tag `v<X.Y.Z>`, the tree is clean, both
plugin manifests hold the version, and `<folder>` does not exist. It then makes `<folder>` and
writes into `<folder>/package` the folders `engine/` and `plugins/celetis/` of `HEAD` from `git archive`, a root
`package.json`, and the release stamp `engine/release.json`. The `package.json` has the name
`celetis`, the `bin` `engine/celetis`, the `dependencies` of `engine/package.json`, `engines.bun`
from `bunFloor`, the `repository.url` of the fixed source, and `"license": "UNLICENSED"`, with no
script. Then it runs `npm pack` of `<folder>/package` into `<folder>`, reads the tarball
`celetis-<X.Y.Z>.tgz` with `readArchive` of `engine/lib/package/archive.ts`, the reader of each
install, and checks that `engine/celetis` has the mode 755. So a tracked name that the install
refuses stops the release before any publish. Then it reads the package document of the registry
(`BUN_CONFIG_REGISTRY`, else `https://registry.npmjs.org`). Its first line names the version, the
commit, and the tarball. Its
last line is `package: publish` when npm holds no such version, or `package: published` when the
stamp of the published tarball has the same version and commit. It publishes nothing itself.

- Exit 2: the arguments are not one version `X.Y.Z` and one folder, or `BUN_CONFIG_REGISTRY` is not
  an http or https URL. In the second case the folder already exists.
- Exit 3: a refusal of the checkout or the folder, with `package: <reason>`, also a failed
  `git rev-parse --show-toplevel`. The script writes nothing.
- Exit 3: the packed tarball fails `readArchive`, for example for a tracked name with a space, a
  letter outside ASCII, or a Windows device name, and the line is `celetis: the package archive is
  not valid: <reason>`; or `engine/celetis` is not executable in it. The folder stays.
- Exit 3: npm holds the version at another commit, its tarball fails the integrity, archive, or
  stamp check, or the registry document is not valid. The folder stays.
- Exit 6: another Git command failed, `npm pack` failed or wrote no tarball, or the registry cannot
  be read. The folder can stay.

A failed job leaves the tag, and `latest` of npm stays at the older version. Rerun the failed job in
GitHub Actions: it publishes when npm has no such version, and it passes with no write when npm
holds the version at the same commit. When npm holds the version at another commit, the job fails,
and npm lets no one replace a published version; make a new release. When npm has no such version
but holds a newer one, published after the failed job, the rerun prints `package: publish` and
`npm publish` fails: npm refuses to apply the `latest` tag to an older version. `latest` does not
move. Make a new release.

The documents of npm do not say that trusted publishing works for the first publish of a new
package. If the job of the first npm release fails at `npm publish`, publish that version by hand
from a temporary worktree at the tag, then remove the worktree:

```sh
git worktree add --detach <dir> v<X.Y.Z>
cd <dir>
bun --no-env-file --no-install --config=/dev/null --no-macros scripts/worktree-setup.ts "$PWD"
bun --no-env-file --no-install --config=/dev/null --no-macros scripts/package.ts <X.Y.Z> <absolute new folder>
npm login
npm publish <absolute new folder>/celetis-<X.Y.Z>.tgz --access public
```

Then rerun the failed job. It prints `package: published` and publishes nothing. A version that was
published by hand has no provenance. Add the trusted publisher of the package `celetis` on
npmjs.com, with the repository `ddinkov10/celetis` and the workflow `release.yml`, at most 2 days
before the next release: a new publisher configuration expires after 2 days with no successful
publish.

## The Herdr lab

`scripts/herdr-lab.ts` runs a runtime check that uses the Herdr app or the hc core, away from the
maintainer's window and core. It is no job of the gate. [`AGENTS.md`](../AGENTS.md#host-checks) gives
its use.

The lab runs on macOS, Linux, and Windows. On Windows, the root is `%TEMP%\<id>`, and the lab core keeps its
state in `%LOCALAPPDATA%\herdr-core\<id>`. `up` sets a protected access list on the root (the current
user, SYSTEM, and the administrators, with no inherited entry), and `down` exits 2 with `refused` for
a root that another user owns or can reach. Windows gives no read of the environment of another
process, so a named job `Local\<id>` holds the lab processes. `up` joins the job before it starts
the core and the window, and records the window process in `app.json` of the root. A keeper
process in the job holds the job name until `down`, because the name ends with its last handle,
also while members run. `run` joins the job before it starts its command. The lab core and the
window get the full environment of the caller with the lab keys; macOS gives the window only the
lab keys, `PATH`, and the telemetry opt-out. `down` stops the lab core, ends the job and the
recorded window, and deletes the core state and the root only after the job holds no process.

A Windows `down` keeps the root, names each cause, and exits 1 in these cases: a bad `app.json`; a
lab job that cannot be opened when no earlier `down` saw it empty; a member of the lab job that
still runs after 90 seconds, or a member list that cannot be read; a lab window process that still
runs or cannot be read; a core that still answers; a real core or window that holds lab text; and
an unset `LOCALAPPDATA`. In each case, `down` still stops the lab core and ends what it can find.
Most causes clear when the cause ends and `down` runs again. Two need a manual remedy. A bad
`app.json` hides a window outside the job: confirm that no lab window is open, then delete the root
by hand. When the job cannot be opened and no `down` saw it empty (the keeper ended early), no read
finds the other lab processes, because the job name is gone and Windows gives no read of the
environment of another process. Restart Windows, or accept the risk, then delete the root by hand.

On Linux, the lab runs the real `hc` and a fake Herdr app
([ADR-0141](../docs/adr/0141-a-linux-lab-runs-the-real-hc-and-a-fake-herdr-app.md) gives what such a check may
prove). Install `hc` into a private folder, and put its `bin` folder first on `PATH`:

```sh
bun --no-env-file --no-install --config=/dev/null --no-macros scripts/install-tools.ts /absolute/private-tools --herdr-core
```

Then run the lab with the same Bun flags:

```sh
bun --no-env-file --no-install --config=/dev/null --no-macros scripts/herdr-lab.ts up
bun --no-env-file --no-install --config=/dev/null --no-macros scripts/herdr-lab.ts run <id> herdr-app ls
bun --no-env-file --no-install --config=/dev/null --no-macros scripts/herdr-lab.ts down <id>
```

The root is `/tmp/<id>` with `state`, `run`, and `app` as on macOS, plus `bin`. `up` exits 2 with `refused` when `hc` is
not on `PATH`, and it needs no real `herdr-app`. In place of the window, it writes the launcher
`<root>/bin/herdr-app`, which runs `scripts/fake-herdr-app.ts` of the checkout that ran `up`. `<root>/bin` is first
on the `PATH` of the lab core and of `run`, so each program of the lab and each tab resolves `herdr-app` to the fake.
The JSON line of `up` has `"appPid":null` and the version line of the fake, `herdr-app 0.1.15 (celetis fake)`.
`down` is the macOS `down`: it logs a skip for the real core and the real app that it does not find.

The fake keeps no process. Each call derives the spaces and the tabs from the labels `herdr.space` of the lab core
(`hc ls`, then `hc get` for each live terminal), and keeps only names and the focus in the folder
`<root>/app/celetis-fake-app/`: `space-<id>.name`, `tab-<id>.name`, and `focus`. Its `ls` gives a tab no name. It
answers `--version`, `status`, `ls`, `do space.rename`, `do tab.rename`, and `do pane.focus`. Each other call exits 2
with `unsupported`. Outside a lab (`HC_SESSION` is not a lab id, or `HERDR_APP_HOME` is not `<root>/app`), each call
exits 2 with `refused`, and the fake reads and writes nothing.

A tab runs `$SHELL -lic`, which is `bash -lic` when `$SHELL` is `/bin/bash`, and a login file can put another `claude`
before `<root>/bin`. A check that starts a host tab gives the lab a fixture `HOME` with a `~/.bash_profile` that puts
`<root>/bin` and the fixture `bin` first on `PATH`, and reads `command -v` for each name in a control tab before the
first launch.
