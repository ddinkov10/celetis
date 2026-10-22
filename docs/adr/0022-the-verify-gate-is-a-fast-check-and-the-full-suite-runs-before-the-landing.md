# The verify gate is a fast check, and the full suite runs before the landing

## Date

2026-10-22

## Related

- ddinkov10/celetis#83: the spec of this change, with the decisions of the maintainer.
- ddinkov10/celetis#81 and its PR ddinkov10/celetis#86: the tests run at the same time.
- ddinkov10/celetis#85: the config reader on Bun, which removes yq from each file.
- ADR-0008: the build step lands the change. ADR-0012: the harness is the plugin `celetis`.
  ADR-0020: the board is a part of the plugin. This record changes a part of ADR-0012 and of
  ADR-0020 (Supersedes).
- `scripts/verify.sh`, `tests/suite.sh`, `tests/lib/tools.txt`, `tests/lib/pool.sh`,
  `.github/workflows/test.yml`, `.editorconfig`, `.shellcheckrc`, `biome.jsonc`, and Land step 3
  of `skills/implement/SKILL.md`.

## Supersedes

From ADR-0012, "The harness is the Claude plugin `celetis`, and each product project wires it in",
each part that says the gate of this repository runs a test:

- In its Supersedes: "The gate of the plugin repository, which has the same file name, runs each
  script test."
- In its Supersedes: "Each script test runs in the gate and in the CI of the plugin repository."
- Decision 16: "The verify gate on a machine runs the check."
- In its Decision: "Its verify gate is `scripts/verify.sh`: the script tests, with the contract
  check of the board, and `claude plugin validate`."
- In its Decision: the words "the glob `tests/*.test.sh` of the gate and of the CI".
- In its Consequences: "A change of the runner that breaks the contract passes the CI and fails the
  verify gate on a machine."

The verify gate of this repository is still `scripts/verify.sh`, but it runs no script test but the
text rules now. `tests/suite.sh` runs the script tests, with the contract check of the board, and
CI runs the suite on each pull request. So a change that breaks the contract fails the full suite,
in CI and on a machine.

From ADR-0020, "The board is a part of the plugin", the decision "The board suite runs in the gate,
and in CI on Node 22", and its consequence "The verify gate needs Node 22.18, or Node 24.2 or
later". `tests/suite.sh` runs `(cd board && node --test)`, and the workflow runs it in the step
"Full suite" on Node 22. The suite needs that Node range now, not the gate.

This record changes no other part of either record.

## Context

The maintainer said: "every issue implementation and verification takes too much time this is fast
moving project i cant allow that". The maintainer then decided: "verify should be one deterministic
check like lintel formatter and once per issue pre merge a full CI should be ran".

Before this change, the verify gate of this repository was the full suite. `implement` runs the
gate after each task, again in Tail step 3, and often again in a Verify scenario. One run took
1079 s on the maintainer's Mac before #81, and 252 s in a cloud session with 4 cores after #86
(2026-10-21). In 16 lane issues (#30 to #77), there were 11 merges of the trunk. Each merge led to
a new gate run and a new CI run, because `scripts/land.sh` refuses a branch that does not contain
the trunk head. The repository had no lint and no format check of its code.

## Constraints and evidence

- A skill runs inside each product project, so it names a role, not a tool (`AGENTS.md`, "General
  text"). A product project names its verify gate in its own `AGENTS.md`.
- With the landing `pr`, `scripts/celetis land` waits for each check run of the head commit. With
  the landing `merge`, no CI runs.
- Each script and each test runs under bash 3.2, the `/bin/bash` of macOS. The cloud cannot reach
  the GNU servers, so only CI could prove a build of bash 3.2.57.
- #85 removes yq from each file of the plugin.
- On a private repository, a macOS minute of a GitHub-hosted runner counts as 10 included minutes.
- The first run of the new checks on the trunk: ShellCheck 0.11.0 gave 298 findings, shfmt changed
  about 2,000 lines in 27 of 36 shell files, and Biome gave 168 findings in 12 files.
- Biome 2.5.15 exits 0 on an info finding, also with `--error-on-warnings`. It processes no YAML
  file. Its changelog calls its HTML formatter experimental, and no entry up to 2.5.15 makes it
  stable.
- ShellCheck 0.11.0 shows some findings in a run on one file that a run on many files hides.
- The results on the lane branch:
  - The gate takes about 7 s on 4 cores. In CI, the step "Verify gate" took 9 s to 13 s, and the
    step "Full suite" took about 3 min to 5 min.
  - The build of bash 3.2.57 passed on its first CI attempt, with
    `./configure --without-bash-malloc --disable-nls` and the GCC of `ubuntu-24.04`. Two download
    sources gave the same SHA-256, and `gpgv` accepted the GNU signature.
  - The CI log shows `shell: /usr/bin/bash -e {0}` for each `run:` step. So each step after the
    install runs under the new bash, and each step and post step of the 3.2.57 leg passed.

## Decision

**The decisions of the maintainer** (spec of #83):

1. The verify gate is one deterministic check. Each code and config file gets a lint, format, or
   syntax check. Markdown keeps only the text rules.
2. The full suite runs once per issue, before the merge.
3. The bash 3.2 proof runs in CI on Linux, with bash 3.2.57 built from source, next to bash 5.

**Two kinds of check.**

- The verify gate of the project is the fast check. It analyses the tracked files, and it runs no
  code that it checks. With the same tree and the same tool versions, it gives the same result each
  time. It needs no network, no model, and no clock. A session runs it after each task, after each
  fix, and in Tail step 3 of `implement`.
- The full suite is each test of the project. It runs once per issue, on the tree that lands. The
  implementer still runs the tests of its own task in its TDD loop, and that loop is no gate.

**The role keeps its name.** The skills still say "the verify gate of the project", and the meaning
of the role changes. A product project with a slow gate keeps working, at its old speed, until its
`AGENTS.md` names a fast gate. `README.md`, "`AGENTS.md`", has a new row, "The full suite", for the
landing `merge` only.

**The `merge` rule.** With the landing `pr`, the CI of the lane PR runs the full suite, and
`scripts/celetis land` waits for it. With the landing `merge`, no CI runs. So Land step 3 of
`implement` runs the full suite of the project in the lane, on the head that `land` gets. It runs it
again when the head moved after its last pass: a fix of the Verify phase, a fix of Land step 4, or a
merge of the trunk. A failure goes to the task loop of Land step 4. When `AGENTS.md` names no full
suite, the verify gate is the full suite, so a `merge` project whose gate runs its tests keeps that
proof. The one rule of Land step 3 covers each path to `land`, Re-entry too. `chore` and `hotfix`
reach it through Land of `implement`.

**The gate of this repository** is `scripts/verify.sh`. It runs its checks at the same time with
`tests/lib/pool.sh`, and its last line stays `verify: PASS`.

| Files | Checks |
|---|---|
| Shell files | `shfmt` (`.editorconfig`); ShellCheck at its default severity (`.shellcheckrc`), one job for each file; `/bin/bash -n` |
| JavaScript, TypeScript, JSON, and CSS | Biome (`biome.jsonc`) with `--error-on-warnings`, and a `Found <n> info` line fails too; `node --check` on each `.js` and `.mjs` file |
| TypeScript on Bun in `scripts/` | `tsc -p scripts/tsconfig.json`, with the Bun types of `npm root -g` |
| jq programs | `jq -f <file> /dev/null` |
| `.github/workflows/*.yml` | actionlint |
| `.celetis.yaml` | the config reader `celetis_config_read` |
| Perl | `perl -c` |
| The plugin manifest | `claude plugin validate .` |
| Each tracked file | the text rules, `tests/text.test.sh` |

**The sort of each tracked path.** The gate sorts each path of `git ls-files` into a row, or into an
exemption with its reason on the comment line above its pattern in the script. A path with neither
fails the gate with `verify: no check for <path>: add a row or an exemption in scripts/verify.sh`.
So a new file type gets its row, and it cannot pass unchecked. A file that a check excludes has its
reason in the config file of the check. A disabled rule has its reason in the config file or on its
line.

**The pins in one file.** `tests/lib/tools.txt` holds one line for each tool:
`<command> <version> <installer> <package>`. The pins are ShellCheck 0.11.0, shfmt 3.14.1,
actionlint 1.7.12, Biome 2.5.15, TypeScript 7.0.2, and @types/bun 1.4.2. CI installs each package
from that file. The gate prints the version of each tool. A missing tool fails the gate with one
line that names its package. A version that differs from its pin prints a warning and does not
fail. A product project needs none of these tools.

**The full suite of this repository** is `tests/suite.sh`. It runs the board suite and each
`tests/*.test.sh` at the same time, each test as `PATH="/bin:$PATH" /bin/bash <test>`. Then it runs
`scripts/capscore.sh --test`. Its last line is `suite: PASS`.

**The CI legs.** `.github/workflows/test.yml` has one job with the matrix `bash: ["5", "3.2.57"]`
on `ubuntu-24.04`, and each leg is one check run. Each leg installs the pinned tools, then runs the
step "Verify gate" and the step "Full suite". The 3.2.57 leg builds bash 3.2.57 from the GNU source
with a pinned SHA-256. It caches the build by its version and its runner image, and it installs the
build as `/usr/bin/bash`, which is `/bin/bash` on the runner. The image is `ubuntu-24.04`, not
`ubuntu-latest`, because GCC 13 of that image builds the 2014 source, and GCC 14 makes an implicit
function declaration an error by default. `scripts/celetis land` waits for both legs with no change.

## Alternatives considered

- **The full suite as the gate**, at the speed of #81. Rejected: one run took 252 s in a cloud
  session after #86, and a lane runs the gate after each task and after each fix.
- **A gate of the changed files only.** Rejected: its result depends on the base of the diff, so the
  same tree can give two results. A change of a config file or of a pin also changes the result of
  files that the diff does not hold. The gate of each tracked file takes about 7 s, so a gate of the
  diff saves little.
- **A parse of each YAML file with yq.** Rejected: #85 removes yq from each file, so a yq row would
  break its Done when. `.celetis.yaml` gets the config reader of the plugin, in both orders of the
  two landings. actionlint parses each workflow. `tests/text.test.sh` compares each
  `skills/*/agents/openai.yaml` with its one allowed text, which is stronger than a parse.
- **A macOS leg for the bash 3.2 proof.** Rejected: on a private repository, a macOS minute counts
  as 10 included minutes, 10 times a Linux minute. The spec kept it as the fallback for a Linux
  build that failed twice, and the Linux build passed on its first attempt.

## Consequences

- A task gets its gate result in seconds, not minutes.
- A test failure shows at the landing, not after a task. Each such failure costs one CI run and one
  fix loop of Land step 4, which starts from the test that failed in CI. The TDD runs of the
  implementer keep most failures early.
- Each machine that runs a lane here needs the pinned tools, and a lane on a machine without them
  stops at its gate. A machine with another version of shfmt or Biome can format a file in another
  way than CI. The gate only warns there, and CI then fails at the landing.
- A bash built from the GNU source on Linux is not Apple's bash, which has its own patches. A run
  of `/bin/bash tests/suite.sh` on a Mac checks Apple's build, by hand.
- The check of `.celetis.yaml` needs Mike Farah yq on `PATH` until #85 changes the reader.
- A product project with a slow gate stays slow until its `AGENTS.md` names a fast gate. A product
  project with the landing `merge` names its full suite in the same change. Otherwise its fast gate
  becomes its full suite, and no test runs before its landing.

## Reconsider when

- The step "Verify gate" takes more than 15 s in CI.
- The pinned Biome checks YAML, or checks HTML as a stable feature.
- The plugin drops bash 3.2.
