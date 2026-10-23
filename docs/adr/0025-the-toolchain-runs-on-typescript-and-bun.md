# The toolchain runs on TypeScript and Bun

## Date

2026-10-22

## Related

- ddinkov10/celetis#96.
- ADR-0015, ADR-0018, ADR-0020, ADR-0022, and ADR-0024.
- `scripts/build.ts`, `scripts/launcher.ts`, `scripts/verify.ts`, and `tests/suite.ts`.

## Supersedes

This record replaces only these runtime clauses. All other decisions and open acceptance gaps stand.

- ADR-0015: Bash setup execution and the sourced launcher/config functions. Setup is TypeScript;
  callers import typed interfaces. JSON reader output and YAML validation stay the same.
- ADR-0018: the Bash setup proposal and execution language. The maintainer still approves each
  proposal and product-file change. The setup skill still owns no unapproved product changes.
- ADR-0020: Node execution of board server modules and tests. The board server uses Bun; browser
  JavaScript stays generated delivery, and the generic producer and contract 1 stay unchanged.
- ADR-0022: the Bash matrix, shell/Perl/jq checks, installer wrappers, and shell job pool. The fast
  gate and full suite remain separate. The full suite still runs on the final tree before landing.
- ADR-0024: the Bash launcher, sourced reader interface, runtime path translation, and remaining
  shell-runtime tool requirements. The vendored parser and strict YAML semantics stay unchanged.

Historical records remain unchanged.

## Decision

Author every first-party command, helper, board module, native hook source, test, fixture generator,
manual program, and maintenance/build program in TypeScript. Bun 1.4.2 or later runs command and
repository test processes. Native hooks stay in their host runtime. Public command names, flags,
argument boundaries, output, statuses, session identity, locks, streams, and cleanup remain the
existing contracts, apart from the explicit runtime and setup-language changes of this record.

Use exactly Bun 1.4.2 to generate the copied executable `scripts/celetis`, browser assets, and
native hook modules. Compile every target before writing delivery. Check exact bytes and modes
without writes. Plugin users install no package dependency and run no build. The unchanged
vendored YAML parser is the only non-generated JavaScript source exception.

The launcher and each child Celetis process disable product configuration, environment files,
preloads, macros, automatic package installation, transpiler cache, and crash reporting before
control code starts. Child Celetis programs use the selected `process.execPath`. Missing, broken,
or nonexecutable Bun keeps the env/kernel failure. An executing below-floor Bun exits 2. Native
host paths replace the old platform translation.

Setup writes the exact parsed TypeScript to a private 0600 file outside main and lane. The selected
Bun runs it in the lane with the absolute main checkout in `process.argv[2]` and inherited streams.
The program checks each external command status. Worktree output ends with an LF separator and
absolute path after nonempty setup output. `setup try` prints its path after failure too. Existing
marker, cleanup, proposal approval, and product-file ownership rules stay in force.

The board accepts the same four stdin keys. It first validates the actual relative project
executable, realpath, regular-file status, execute permission, control characters, and lane
boundary. Only then does the exact isolated Bun shebang declare a Bun program. Bind that
validated file to the board's selected `process.execPath` and all isolation flags for data, Run,
and Resume. Keep other valid executables native. A denied runtime-declaration read preserves
the validated native command; declaration inspection adds no read permission condition. This uses the executable's existing runtime
declaration instead of adding a JSON runtime field or weakening first-item validation. It also
prevents a missing or shadow Bun on PATH from changing the selected runtime. No Bash detection
or fallback remains. The main checkout stays trusted, as it was before this decision.

The fast gate classifies every tracked file, checks Biome, strict runtime/browser/native types,
native actionlint, configuration, plugin metadata, text contracts, vendor identity, and generated
bytes and modes. It installs nothing and runs no full suite. The private installer pins surviving
tools, uses Bun argument arrays for packages, and checks actionlint's official native archive hash.
JavaScript tools run on selected Bun; package/type paths come from filesystem metadata.

The suite discovers all automatic TypeScript test entries, uses bounded independent file workers,
enforces a 30-second file deadline, propagates failure, and cleans child groups on signals. It
starts one file worker by default because the process entries already bound several real fixture
groups per file. Two file workers exhausted unchanged case and file limits in Linux CI. The same
targeted pair on macOS took 23.541/29.658 seconds with two workers and 15.052/22.138 seconds with
one. File isolation trades total suite time for headroom under the existing short waits; the
changed build still needs Linux CI. Explicit worker counts remain available. Independent
frozen-reference cases keep separate async state and a two-case bound. Manual
token-using programs have no test suffix. CI runs the gate and one full suite on Linux with Bun
1.4.2, plus the actual process/lock subset on Linux and macOS.

## Consequences

Remove the superseded first-party shell, Perl, executable jq and authored JavaScript programs and
all live callers together. Keep exact generated and vendor roles and explicit non-executed
baseline assertion/caller data. No compatibility reader, automatic migration, or dependency
installation is added to product operations.

This is a coordinated manual cutover. Prepare each affected product, approve its setup, copy the
current generated launcher, and stop old processes before landing. Each product owns and commits
its wiring. A current-build readiness report still gates landing. Deterministic local evidence
proves no live host, browser, native module-loading, or token acceptance. Installed-resource
lifetime, same-child retry controls, managed setup, and other unrelated acceptance gaps remain open.
