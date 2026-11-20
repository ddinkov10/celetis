# The gate tools come from the lockfile of the engine

## Date

2026-11-20

## Related

- [Issue #353](https://github.com/ddinkov10/celetis/issues/353): the spec (the body of the issue, `Spec: 2026-11-20`).
  Its section "Design probes" is "the spec probe" below.
- [The plan of #353](https://github.com/ddinkov10/celetis/issues/353#issuecomment-7049011161): its section "Decisions
  of this plan" and its external facts are "the plan probe" below.
- [ADR-0115](0115-the-engine-pins-its-packages-in-a-lockfile.md): its "Reconsider when" named this move ("The gate
  tools of `scripts/` move into a manifest (#353)"). Its decisions 3 to 7 stay, except the install command that a
  refusal of decision 3 names: the gate checks and installs nothing, needs no network, and imports a package only
  after its preflight.
- [ADR-0037](0037-one-bun-version.md): `bunFloor` stays the one source of the Bun version in the code.
- [ADR-0035](0035-the-board-is-a-part-of-the-engine.md): `childEnv` still removes each `node_modules/.bin` from
  `PATH`, so the gate runs the JavaScript entries of the tools on the selected Bun.

## Supersedes

Only these clauses change. The records keep their historical text and evidence.

- [The verify gate is a fast check, and the full suite runs before the landing](0022-the-verify-gate-is-a-fast-check-and-the-full-suite-runs-before-the-landing.md),
  in part: in "The pins in one file", "A missing tool fails the gate with one line that names its package. A version
  that differs from its pin prints a warning and does not fail." A missing or stale Biome, TypeScript, or Bun types
  package refuses with the command of the worktree setup (Decision 3 below). Only `actionlint` keeps the warning, and
  a missing `actionlint` names `scripts/install-tools.ts`.
- [The engine pins its packages in a lockfile and checks the daemon protocol with Zod schemas](0115-the-engine-pins-its-packages-in-a-lockfile.md),
  in part: in decision 1, "The gate tools of `scripts/install-tools.ts` stay as they are"; decision 2, "One install
  command", which ran `install --frozen-lockfile --production --ignore-scripts` in four places; and, in decision 3,
  the install command that a refusal names. Now two install kinds run (Decision 2 below), and a refusal of the gate
  names the worktree setup.
- [One Bun version for the project](0037-one-bun-version.md), in part: "The `@types/bun` pin" (`scripts/install-tools.ts` installs
  `@types/bun@1.4.4`), and, in "One source in the code", `scripts/install-tools.ts` as an importer of `bunFloor`, and
  "Two places keep a literal". `engine/package.json` is a third place with a literal, and the gate keeps it equal to
  `bunFloor` (Decision 3 below).
- [The repository keeps no tests, and the verify gate is its only check](0029-the-repository-keeps-no-tests.md), in part: in "The checks of the gate", "The
  pins are data in `scripts/install-tools.ts`"; and, in its Supersedes item on "The pins in one file", "the
  pins are data in `scripts/install-tools.ts` now, and `toolPins` gives them to the gate and to the installer".
  `toolPins` is gone, and the gate takes the versions of Biome, TypeScript, and the Bun types from
  `engine/node_modules`.
- [Native Windows uses kernel32 and spawned children](0034-native-windows-uses-kernel32-and-spawned-children.md), in
  part: in "The verify gate", "the gate finds them beside actionlint". The gate finds `tsc` and `biome` in
  `engine/node_modules` of its checkout. "No platform gets `tsc` or `biome` links" stays true.

## Context

The verify gate uses Biome, TypeScript, and the Bun types. `scripts/install-tools.ts` installed them with
`bun add --exact` into a private folder, next to the native `actionlint`, from a pin list of its own. Since #348 the
engine has `engine/package.json` and `engine/bun.lock` with exact pins, so the repository had two homes for package
pins. The maintainer asked for the gate tools to come from the lockfile of the project, and picked the devDependencies
of `engine/package.json` (approach A of the spec).

## Constraints and evidence

- A lockfile with the three tools as exact devDependencies installs with `--ignore-scripts`, and both tools run from
  their JavaScript entries (`bin/tsc`, `bin/biome`): `Version 7.0.2` and `Version: 2.5.15` (the spec probe).
- `bun.lock` holds each platform package of Biome (8) and TypeScript (20), each with `os` and `cpu` in its metadata
  object, and an install puts only the packages of the host into `node_modules` (the spec probe).
- `--frozen-lockfile --production --ignore-scripts` installed only `yaml` and `zod`; a full install of the same
  lockfile installed 10 packages, about 107 MB, in 2.31 s with an empty Bun cache (the spec probe and the plan probe).
  So the install timeout stays 120 s.
- The lock moves `@types/node` from 26.6.5 of the old tools folder to 26.6.6, the range `*` of `bun-types` 1.4.4 (the
  plan probe). The gate passed with it on macOS arm64 in the build of #353.
- TypeScript 7.0.2 does not match a file in a `node_modules` folder at any depth with a `**` include (the plan
  probe), so the `tsc runtime` job takes no file of `engine/node_modules` as a root file with no change of
  `tsconfig.runtime.json`.
- The probes ran on macOS arm64 with Bun 1.4.4. Linux runs in CI after the landing; Windows is not checked.

## Decision

1. **The pins.** `engine/package.json` has `devDependencies` with `@biomejs/biome` `2.5.15`, `@types/bun` `1.4.4`, and
   `typescript` `7.0.2`, as exact versions, locked in `engine/bun.lock` with their dependencies.
2. **Two install kinds.** `installDependencies` of `engine/lib/install/dependencies.ts` takes an `InstallKind`. A user
   installation (`installEngine`, so `celetis install` and `celetis update`) runs `install --frozen-lockfile
   --production --ignore-scripts` and gets only `zod` and `yaml`; the hand commands of "First install" keep
   `--production` too. A development checkout runs `install --frozen-lockfile --ignore-scripts`: the worktree setup
   (`scripts/worktree-setup.ts`, also in CI) and the release worktree of `scripts/release.ts`. Both kinds keep the
   check that `engine/bun.lock` exists and no lifecycle script.
3. **The gate checks the full install.** `checkDependencies` of `scripts/verify.ts` accepts `devDependencies` with the
   rule of `dependencies`, compares each map with the same map of `workspaces[""]` of `engine/bun.lock`, and checks
   each lock package in `engine/node_modules`, except a package whose metadata has `os` or `cpu`. A missing or stale
   package refuses with the command of the worktree setup. Then `checkBunTypes` refuses an `@types/bun` that is not
   `bunFloor`, with both versions.
4. **The gate finds its tools in the checkout.** Biome and TypeScript run from `engine/node_modules` of the checked
   checkout on the selected Bun, and the type root is `engine/node_modules/@types`. `actionlint` comes from `PATH`.
   The gate prints `== <tool> <version>` for `actionlint`, `biome`, `tsc`, and `@types/bun`; only `actionlint` keeps
   the pin warning, because a lock mismatch of the other three refuses.
5. **The installer.** `scripts/install-tools.ts` installs the native `actionlint` with its hash check, and with
   `--claude` Claude Code. It exports `actionlintVersion` for the pin warning of the gate.
6. **No path across the change.** A checkout with a production-only install from before this change gets the refusal
   of Decision 3 and runs the worktree setup once. No fallback and no migration.

## Constitution

Read: `CONSTITUTION.md`, amended 2026-11-12.

- Serves: 3 Verified landing: the gate tools come from the lockfile of the tip that lands, and a mismatch refuses in
  place of a warning.
- Tension: 2 Autonomous steps: each lane worktree installs about 107 MB more, and an old lane needs one full install.
  Goal 3 wins, and the cost is one command.
- Hard limits and non-goals: none touched.

## Alternatives considered

- **A second manifest `scripts/package.json` with its own lockfile.** The engine manifest would stay limited to what
  ships, but the repository would get two lockfiles, two install commands, and two gate checks. ADR-0115 rejected a
  split of the manifest in a related form.
- **mise for all four tools.** It also pins `actionlint` with a checksum for each platform, but each machine and CI
  would need mise, and the issue keeps `actionlint` with the installer.
- **Keep the warning for a gate tool version.** A version that differs from its pin could still pass the gate. The
  spec makes it an anti-goal.

## Consequences

- One lockfile holds each package pin of the repository; `actionlint` and Claude Code stay pins of the installer.
- Each development checkout installs about 107 MB of packages, and the release worktree downloads them when the Bun
  cache is cold.
- Each existing lane worktree and the main checkout need one run of the worktree setup.
- The gate does not check the platform package of the host. When it is missing, the tool job fails, and its line does
  not name the install command.
- `@types/node` comes from the range `*` of `bun-types`. A later `bun install` that writes the lockfile can move it.

## Reconsider when

- Bun changes how `bun.lock` records platform packages, or the meaning of `--production` or `--frozen-lockfile`.
- A gate tool needs a lifecycle script.
- `actionlint` gets a package with a pinned native binary, so it could join the lockfile.
- TypeScript starts to match `node_modules` files with a `**` include.
