# One Bun version for the project

## Date

2026-10-26

## Related

- [Issue #124](https://github.com/ddinkov10/celetis/issues/124): the spec (approaches A, B, and C,
  and the open risks) and the plan with its External facts and its Verify phase.
- [ADR-0024](0024-the-config-read-runs-on-bun.md): the floor and its check with
  `Bun.semver.order`. One item of its Decision changes ("Supersedes"). Its Constraints and evidence
  observed Bun 1.4.2 in a Claude Code cloud session and Bun 1.2.10 in the Codex cloud image.
- [ADR-0025](0025-the-toolchain-runs-on-typescript-and-bun.md): the toolchain runs on Bun, and an
  exact Bun version generates the delivery. Its two version sentences change ("Supersedes").
- [ADR-0026](0026-the-board-resolves-executables-with-libc.md): the realpath APIs of Bun 1.4.2
  report EACCES on macOS for a file with no read permission. ADR-0035 superseded that record as a
  whole and removed the libc wrapper. The board adapter still calls `realpath` on its entrypoint
  only after its read check. The notes of Bun 1.4.4 do not say that the EACCES result changed, so
  that order stays.
- [ADR-0029](0029-the-repository-keeps-no-tests.md): the repository keeps no tests, so no check
  runs an engine command. The runtime changes of Bun 1.4.3 and 1.4.4 get a check by hand, V5 of
  the Verify phase of the plan.
- [ADR-0035](0035-the-board-is-a-part-of-the-engine.md): the board command `engine/board.ts` calls
  `requireBun()`. So the floor of the board is the floor of the entry, with the same line and
  exit 2.
- `bunFloor` (the constant `floor`) in `engine/lib/config.ts`, `requireBun` in
  `engine/lib/host.ts`, `scripts/build.ts`, `scripts/install-tools.ts`,
  `.github/workflows/test.yml`, and the blocks `bootstrap-claude` and `bootstrap-codex` of
  `README.md`, "Terminal discovery".

## Supersedes

These clauses change. The accepted records keep their historical text and evidence.

- ADR-0024, "The config read runs on Bun", Decision, "The floor": "The floor is Bun 1.4.2, the
  version of a Claude Code cloud session", and the version of "CI pins `bun-version: 1.4.2`". The
  floor is now Bun 1.4.4, the one Bun version of the project (Decision). The Bun of a Claude Code
  cloud session does not set the floor now. The floor still has no upper bound, and the check is
  still `Bun.semver.order(Bun.version, floor) < 0`. The rest of ADR-0024 stands.
- ADR-0025, "The toolchain runs on TypeScript and Bun", Decision: the version of "Bun 1.4.2 or
  later runs command and repository test processes" (ADR-0029 removed the test processes), and
  "Use exactly Bun 1.4.2 to generate" the delivery. Now Bun 1.4.4 or later runs commands, and
  exactly Bun 1.4.4 generates the delivery. Both versions are `bunFloor`. The rest of ADR-0025
  stands.

Other records repeat these versions as current versions. Each such version is now 1.4.4:

- ADR-0022, "The verify gate is a fast check, and the full suite runs before the landing",
  Decision, "The pins in one file": the `@types/bun` pin 1.4.2.
- ADR-0024, "The config read runs on Bun": the floor and the CI pin in its Supersedes, and the
  floor in its Consequences.
- ADR-0029, "The repository keeps no tests, and the verify gate is its only check": the CI version
  in its Supersedes and its Decision ("CI."). Also the version of the local gate in its
  Consequences.

The Context and the Constraints and evidence of older records, and each check that ran on Bun
1.4.2, are history. This record changes none of that text.

## Context

`scripts/build.ts` refused each Bun except 1.4.2: it compared `Bun.version` with its own constant
`pin`. The verify gate runs `scripts/build.ts --check`. So the gate failed on Bun 1.4.3 and on Bun
1.4.4. On the machine of the maintainer, `bun --version` printed 1.4.3.

The version was a literal in six places of code: the constant `floor` of `engine/lib/config.ts`,
the constant `pin` of `scripts/build.ts`, three strings of the `@types/bun` pin in
`scripts/install-tools.ts` (the version, the package, and the missing-package message), and
`bun-version` of `.github/workflows/test.yml`. The two bootstrap blocks of `README.md` stated it
too.

The maintainer wants the project on the latest Bun, 1.4.4, and moves the local environment to it.

## Constraints and evidence

The plan of #124 found these facts on 2026-10-26.

- Bun 1.4.4 is the latest release, from 2026-10-22. The npm dist-tag `latest` of `bun` is 1.4.4.
  `@types/bun` 1.4.4 was published on 2026-10-23. Its dist-tags `latest` and `ts7.0` are 1.4.4,
  which matches TypeScript 7.0.2 of the tool pins.
- A probe on macOS arm64 (Darwin 25.4.0) used the official zip `bun-v1.4.4/bun-darwin-aarch64.zip`,
  with the build pin and the `@types/bun` pin set to 1.4.4 in a copy of trunk `5734ab9`.
  `scripts/build.ts --check` exited 0, so no generated file changes bytes.
  `scripts/install-tools.ts <dir> --claude` exited 0 and installed `@types/bun` 1.4.4, so Bun 1.4.4
  accepts `bun add --exact --ignore-scripts --no-progress --cwd`. The gate printed
  `== @types/bun 1.4.4`, no pin warning, and `verify: PASS`.
- The release notes list changes that the engine meets. In 1.4.3, `signalCode` and `kill()` use
  the macOS signal numbers on macOS, and bundler regressions of 1.4.1 are fixed. One fixed bundler
  bug also affected 1.4.2. In 1.4.4, `fs.realpath` changes on Linux and macOS, `process.on()`
  changes for a function that is registered two times, and `bun install` checks its flags.
  `@types/bun` 1.4.4 types `Bun.hash()` and the CPU times of `resourceUsage()` as `bigint`. The
  engine uses neither API.
- 1.4.4 extends `--no-env-file` to each package manager command. Celetis gives it only to runtime
  commands. Neither note lists a change to `--no-install`, `--no-macros`,
  `BUN_RUNTIME_TRANSPILER_CACHE_PATH`, or `DO_NOT_TRACK`. A relative `--config` now resolves from
  the working folder. Celetis passes the absolute `--config=/dev/null`. `Bun.semver.order` no
  longer throws on `"2+1"`. It is the floor check of `engine/lib/host.ts` and
  `engine/lib/config.ts`.
- Static checks of the code of `5734ab9` against these changes:
  - Each of the eight `process.on(signal, handler)` calls registers a new closure one time for
    each signal. `engine/lib/update-lock.ts` registers one function `hold` for two different
    signals. No pair of signal and function is registered two times, so the `process.on()` change
    has no effect.
  - Each `kill()` passes a signal name, no argument (SIGTERM), or 0, and each use of `signalCode`
    compares it with `null`. An exit status is `128 + constants.signals[name]`. SIGHUP, SIGINT,
    SIGTERM, and SIGKILL have the same numbers on macOS and Linux.
  - Each `realpath` call takes a path from Git output, `process.cwd()`, `tmpdir()`, host metadata,
    the host home of `CLAUDE_CONFIG_DIR` or `CODEX_HOME`, the `PATH` lookup `Bun.which('claude')`,
    or `join()`, which collapses `..` before the call.
- The gate runs the config reader and the shared helpers that it imports, but no engine command
  (ADR-0029). At the time of this record, that gate run and the static checks are the only
  evidence for the engine on Bun 1.4.4. V5 of the Verify phase of the plan runs the main
  commands on Bun 1.4.4 by hand after this record: from the lane, from a symlinked working folder,
  and with a SIGINT stop of the board. This record states no result of that check.
- ADR-0024 observed Bun 1.4.2 in a Claude Code cloud session. Its current Bun is not verified.
  ADR-0024 also observed Bun 1.2.10 in the Codex cloud image, which is below the old floor too.

## Decision

The whole project uses one Bun version, 1.4.4. This is approach B of the spec. ADR-0035 removed
the board floor files that B also named, so the board uses the floor of the entry. The version
has four roles:

- **The floor.** Each Celetis command needs Bun 1.4.4 or later. `requireBun` of
  `engine/lib/host.ts` stops an older Bun with `celetis: need Bun >=1.4.4 on PATH, found <version>`
  and exit 2. The config reader refuses it with `need Bun >=1.4.4 on PATH, found <version>` and
  exit 2. The floor has no upper bound.
- **The build pin.** `scripts/build.ts` needs exactly Bun 1.4.4: it refuses when
  `Bun.version !== bunFloor`. On another version it stops with
  `build: need Bun 1.4.4, found <version>`. The gate runs `scripts/build.ts --check`, so the gate
  needs exactly Bun 1.4.4.
- **The `@types/bun` pin.** `scripts/install-tools.ts` installs `@types/bun@1.4.4`, and its
  missing-package message names that package.
- **CI.** `.github/workflows/test.yml` sets up Bun 1.4.4.

**One source in the code.** `bunFloor`, the constant `floor` of `engine/lib/config.ts`, is the only
source of the version in the code. `engine/lib/host.ts`, `scripts/build.ts`, and
`scripts/install-tools.ts` import it. Two places keep a literal, because they cannot import code.
The CI workflow is YAML, and `setup-bun` installs Bun from its `bun-version`. The two bootstrap
blocks of `README.md` run before they find the plugin.

**No compatibility path.** The floor goes up from 1.4.2 to 1.4.4. An older Bun stops with the
floor line. No fallback, no second floor, and no migration keep Bun 1.4.2 or 1.4.3 in use.

This is the practical choice: one constant states the rule in the code, and the gate, CI, the
installed types, and the build of the generated files all use the same Bun.

## Alternatives considered

- **A. A literal at each place.** Change `1.4.2` to `1.4.4` in the six places of code. This is the
  smallest diff. But each later Bun release needs the same six edits, and no check keeps them
  equal. Rejected.
- **C. Follow the latest release automatically** (`bun-version: latest` in CI, and no exact build
  pin). Rejected: the generated board and hook files can change bytes with a Bun release, so CI
  fails with no change in the repository. The floor still moves by hand.
- **A floor below the build pin.** For example, the floor stays 1.4.2, and the build pin is 1.4.4.
  Then the project has two versions to keep in agreement. The gate and CI run only on the build
  pin, so no check covers a Bun between the floor and the pin. Rejected.

## Consequences

- A Bun older than 1.4.4 stops each Celetis command with the floor line and exit 2. The board
  stops in the same way (ADR-0035). The bootstrap blocks throw `Need Bun >=1.4.4`. A machine with
  Bun 1.4.2 or 1.4.3 must update Bun first.
- A Claude Code cloud session with a Bun below 1.4.4 stops too. This is an accepted cost. The Codex
  cloud image (Bun 1.2.10) with no setup step stopped at the old floor already (ADR-0024).
- A Bun newer than 1.4.4 runs commands, because the floor is a minimum. On that Bun,
  `scripts/build.ts` stops with `build: need Bun 1.4.4, found <version>`, and the gate fails with
  `verify: FAIL`. The gate needs exactly Bun 1.4.4, also as the `suite` of a landing of this
  repository.
- The next Bun release changes `bunFloor`, the `bun-version` of CI, the two bootstrap blocks, and
  the text that states the version. Then `scripts/build.ts` runs on the new Bun, and each generated
  file whose bytes change is committed. The `@types/bun` pin follows `bunFloor`, so the move also
  needs an `@types/bun` release of the same version.
- Apart from the parts that the gate runs, the runtime changes of Bun 1.4.3 and 1.4.4 have static
  checks and the check by hand of V5 only. A later regression of an engine command on this Bun
  passes the gate (ADR-0029).

## Reconsider when

- A product environment cannot reach the version, for example a Claude Code cloud session that
  stays below it.
- Bun build output stays byte-stable across releases. Then the build pin can become a minimum, or
  CI can follow the latest release.
- The gate gets a runtime check of the engine. Then a floor below the build pin has a check.
