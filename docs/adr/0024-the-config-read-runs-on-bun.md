# The config read runs on Bun

## Date

2026-10-22

## Related

- ddinkov10/celetis#85: the spec and the plan of this change.
- The decision study: https://claude.ai/artifact/At5SMFcPJ1Lhu8xk5ci11T. It recommends a rewrite of
  the scripts to TypeScript on Bun, in layers.
- ADR-0015: one repository YAML config. This record replaces one item of it.
- `scripts/celetis`, `scripts/lib/config.ts`, and `scripts/lib/vendor/`.
- `docs/configuration.md`, "Validation and reader interface" and "Install Bun".

## Supersedes

From ADR-0015, "One repository YAML file owns Celetis setup", the first item of "Constraints and
evidence": the shell readers need Mike Farah yq `>=4.54.1,<5`, and the install examples and CI pin
yq v4.54.1. Now the shell readers need Bun 1.4.2 or later, and CI pins Bun 1.4.2. The rest of that
item stands: the shell readers need `jq`, and the reader refuses invalid YAML, lossy YAML features,
and schema errors before work. The rest of ADR-0015 stands.

## Context

Until this change, `celetis_config_read` in `scripts/celetis` read and checked `.celetis.yaml`
with Bash, Mike Farah yq, jq, and Perl. The function had about 140 lines. Most of them were two jq
programs in strings that no tool checked.

This had three costs:

- Each machine and each CI job installed a pinned yq only for this function.
- The name `yq` is not unique. In the Claude Code cloud session of the plan, `/bin/yq` is a Python
  yq, and the test run of that time put `/bin` first on `PATH`. There, the config reads of 14 test
  files stopped with `need Mike Farah yq >=4.54.1,<5 on PATH`.
- One read took 69 ms in the decision study, and 44 ms on the machine of the spec.

The maintainer wants a fast-moving project, with short build and verification times. The decision
study recommends a rewrite of the scripts to TypeScript on Bun, in layers. The maintainer chose
this first layer: the config read, and Bun as a stated requirement with a version floor.

## Constraints and evidence

The spec and the plan of #85 found these facts on Bun 1.4.2, on 2026-10-21 and 2026-10-22.

- `Bun.YAML.parse` takes no options and returns values only. A probe accepted duplicate keys (the
  last one wins), aliases, `<<` merge keys, custom tags, `!!binary`, a folded block, and number
  keys, with no error.
- The `yaml` package (eemeli/yaml) 2.9.1 has the ISC license and no dependencies. Its parser gives
  the tag, the style, and the key of each node. So a walk of its tree can do each metadata check of
  today's reader.
- A plugin has no install step: no `bun install`, no `node_modules`, and no `package.json`
  dependency.
- Bun reads `bunfig.toml` and runs its `preload` only from its working folder. It loads `.env`
  only from there too. `bun -e` acts in the same way. A `preload` in `~/.bunfig.toml` or
  `$XDG_CONFIG_HOME/.bunfig.toml` did not run.
- Bun does not transpile the bundle, because it starts with `// @bun`. Bun still writes the
  transpiled `config.ts` to its global cache. So the launcher turns the cache off.
- `Bun.semver.satisfies("1.5.0-canary.1", ">=1.4.2")` is `false`. `Bun.semver.order` puts that
  prerelease after `1.4.2`.
- A Claude Code cloud session has Bun 1.4.2. The Codex cloud image has Bun 1.2.10.
- The first parse of `yaml` costs 11 to 17 ms of each read. A minified bundle saved about 8 ms.
- `dts-bundle-generator` 9.5.1 could not bundle the declarations of `yaml` 2.9.1 into one file.

Times change from day to day. So the Verify phase of #85 ran today's reader (yq 4.54.1 and jq) and
the new reader on one machine: a Linux cloud container with 4 cores, and Bun 1.4.2.

- V3, the time: each mean is of 20 reads of this repository's `.celetis.yaml`, after one warm-up
  read. In two runs, today's reader took 54 ms and 56 ms. The new reader took 39 ms and 38 ms.
- V2, the two readers: both readers read each case of `tests/config.test.sh`, the extra inputs of
  the plan, and a corpus of 285 probe inputs. The final review of #85 ran both readers on about
  2080 more inputs: 1968 generated inputs and about 110 inputs by hand. "The intended differences"
  below lists each difference that these runs found.

## Decision

`celetis_config_read CHECKOUT` runs the TypeScript reader `scripts/lib/config.ts` on Bun. The
function keeps its input, its output, its exit status, its diagnostics, and its rules
(`docs/configuration.md`, "Validation and reader interface"). No caller changes.

- **The reader.** It reads the bytes of the file once, after a check that the open file is the file
  of the first `lstat`. It decodes the bytes as strict UTF-8. It refuses each character outside the
  printable set of YAML 1.2, and U+0085, U+2028, and U+2029. Then it parses with the vendored
  `yaml`, walks the tree with today's metadata rules, and checks the schema as typed code. At
  `board.port` and `rank`, go-yaml reads a plain `-0` and a leading-zero integer with an 8 or a 9,
  such as `08080`, as a float. So the reader refuses them with `need an integer`, as today. It
  prints one compact JSON object, or one line `celetis: <file>: <field>: <message>` with exit 2.
- **The vendored bundle.** `scripts/lib/vendor/yaml.mjs` is a readable ES module bundle of the npm
  release `yaml` 2.9.1, built with `bun build`. Beside it are the license, a hand-written
  `yaml.d.mts`, and a `README.md` with the integrity, the hash, and the build command. The reader
  imports the bundle by a relative path, so Bun looks up and installs no package.
- **The floor.** The floor is Bun 1.4.2, the version of a Claude Code cloud session, with no upper
  bound. It is in two places of code: `celetis_bun_floor=1.4.2` in `scripts/celetis`, and the
  constant `floor` of `scripts/lib/config.ts`. The copy of the launcher in a product project
  cannot import plugin code, so both places are necessary. The test `bun_floor_agrees`
  keeps them equal, and CI pins `bun-version: 1.4.2`. The check is
  `Bun.semver.order(Bun.version, floor) < 0`, because `Bun.semver.satisfies` refuses each
  prerelease.
- **The start folder.** Each `bun` call of the launcher starts in a fixed folder: the folder of the
  reader for the full read, and `/` for the host hint. So a `bunfig.toml` preload and a `.env`
  file of a product project have no effect. The `cd` needs no flag, so an old Bun reaches the
  floor check, not a flag error.
- **No transpiler cache.** Bun does not transpile the bundle, but it still writes the transpiled
  `config.ts` to its global cache. So the launcher sets `BUN_RUNTIME_TRANSPILER_CACHE_PATH=0`, and
  a read writes no file. The test `read_writes_no_cache_file` guards this.
- **No crash report.** On macOS and Windows, Bun 1.4.2 uploads a crash report to `bun.report` by
  default. The host hint gives the file of a product project to the native `Bun.YAML.parse`. So
  the launcher also sets `DO_NOT_TRACK=1`, and a crash of Bun sends no report. The test
  `bun_sends_no_crash_report` guards this.
- **The host hint.** When neither `--agent` nor `CELETIS_AGENT` names the host, the launcher reads
  only `host` of the main `.celetis.yaml`, with `Bun.YAML.parse`. This needs no package, so the
  copy of the launcher in a product project selects the host before it finds the plugin.
- **The full check.** After the plugin lookup, the launcher checks the main config with the reader
  of the plugin, before `worktree`, `celetis-flow`, `next-step`, `land`, and `board`. The copy of
  the launcher in a product project has no reader beside it. When a script sources that copy,
  `celetis_config_read` stops with a line that names the launcher of the plugin,
  `$(scripts/celetis root)/scripts/celetis`.

**The intended differences.** These differences from today's reader are intended. The texts of
the parser and Bun diagnostics are new too.

- **From the spec.** `port: 4_404` fails with `quote this value: YAML 1.1 reads it as a number`.
  yq read 4404. Each plain scalar in the YAML 1.1 timestamp form fails with
  `unsupported YAML tag`, also `2026-10-16T10:00:00` and `2026-13-45`, which yq did not tag. A file
  with CR-only line breaks can give another result: yq accepted `landing: pr\rcustom:\r  bug: x\r`,
  and the new reader refuses it as invalid YAML. No current platform writes such a file.
- **The new reader refuses more.** It refuses a character outside the printable set of YAML 1.2,
  and U+0085, U+2028, and U+2029, in each place of the file. yq accepted some of them, for example
  a raw ESC in a first comment line, or U+2028 in a quoted scalar. It refuses a plain YAML 1.1
  number form that YAML 1.2 reads as a string, in each field and key: `port: 0X1000` (yq read
  4096) and `._1`. It refuses a core tag on a collection of another kind
  (`gates: !!seq {plan: me}`) and `!!int 4_404`. In the layout, it refuses a tab that starts a line
  in a flow collection or in a double-quoted continuation line. It also refuses two `...` markers,
  and a BOM at the start of the line after `---`. It refuses a quoted `"<<"` key outside
  `codexProfiles` as an `unknown field`, where yq merged it away.
  It refuses text after `---` on its line: `put nothing after --- on its line`. yq refused
  `--- &r` and `--- !!map` before a block mapping. After `--- # c`, yq dropped the first key when
  its value was a scalar or a flow collection. So yq lost that value, for example the `host`,
  a gate, or the port. yq read a flow mapping on the `---` line, and `--- # c` before a blank or
  comment line, as YAML 1.2 does.
  YAML 1.2 reads a plain `1e400` as a float that is not finite. So in a string field or a key, the
  reader refuses it with `non-finite numbers are not allowed` or `mapping keys must be strings`.
  yq read the string "1e400". The reader refuses a lone `?` or `-` as a value in a flow mapping
  (`{bug: ?}`, `{bug: -}`) as invalid YAML, where yq read a string.
- **The new reader accepts more.** It accepts YAML 1.2 input that today's reader refuses. The
  cases are a tab in a blank or comment line after a plain scalar, after the indent of the first
  line of a block scalar, or right after a block `-`. They are also the tag `!` on a collection, a
  surrogate-pair escape, a reserved directive (`%FOO bar`) before `---`, a BOM before a comment
  line after `...`, the `\/` escape, and a plain `:x` in a flow mapping. A tagged empty value in a
  flow mapping, `{bug: !!str}`, is the empty string. These cases follow YAML 1.2 on purpose. An
  emulation of the layout quirks of go-yaml costs about 30 lines of parser-quirk code.
- **The same result, with another message or JSON form.** A schema message has no
  `jq: error (at <stdin>:1): ` prefix. A file that both readers refuse can get another field or
  message: `!!int abc`, `port: 1e999`, `custom: {bug: 1_000}`, `!!null {…}`, a lone surrogate
  escape, or a directive after `...` at the end of the file (`need one YAML document`).
  Integer-like keys, such as a quoted `"1"`, come first in the JSON, so the first unknown
  key can differ. A DEL from an escape is raw in the JSON, where jq wrote `\u007f`.
- **Another JSON value.** A quoted `"<<"` key under `codexProfiles` stays an ordinary runtime key,
  so `codexProfiles` is `{"<<": …}` in the JSON. yq merged the key away and gave `{}`, which is a
  defect of yq.
- **The launcher.** `root`, `capscore`, and `setup` no longer stop at the launcher when the file
  parses but fails a strict rule, because the host hint reads only `host`. `capscore` and `setup`
  still run the strict read where they use the config. A `host` that is not a string, such as
  `host: null`, stops the host hint with `invalid agent null`. A mapping or a sequence gives
  `invalid agent a mapping` or `invalid agent a sequence`. Today, the strict read stopped first
  with `host: invalid value`. The host hint refuses two inputs that the strict reader accepts: a
  plain `:x` key in a flow mapping, and a BOM at the start of a `---` line that is not the first
  line. Then the launcher stops with `invalid YAML`. Today's reader refused the first input and
  accepted the second.

## Alternatives considered

- **`Bun.YAML` alone.** It needs no package. But it gives no node metadata and takes no options,
  so it cannot refuse duplicate keys, aliases, tags, or folded blocks. The read is then not strict.
- **TOML with `Bun.TOML.parse`.** It needs no package, and it refused each duplicate key in a
  probe. But the switch changes 43 files: skills, the entry hook, the setup writer, and the tests.
  It also needs a second config cutover in each product project, soon after the YAML cutover of
  ADR-0015.
- **Keep yq.** It needs no change. But each machine and each CI job keeps a pinned tool for one
  function, and the checks stay jq programs in strings.
- **A minified bundle.** It saves about 8 ms for each read. But a person cannot read or review the
  vendored code.
- **Generated upstream declarations.** `dts-bundle-generator` 9.5.1 failed on the declarations of
  `yaml` 2.9.1. So `yaml.d.mts` is written by hand, and it declares only the API that the reader
  uses.
- **Flags for the start folder.** `--config`, `--no-env-file`, and `--no-install` also stop the
  inputs of the start folder. But an old Bun can refuse an unknown flag before the floor check. The
  `cd` needs no flag.

## Consequences

- After the cutover, yq goes from each machine and each CI job. jq stays for the other scripts,
  and Perl stays for the update helper of the runner.
- The strict checks are typed code in one file, not jq programs in strings.
- A read is faster: 38 to 39 ms against 54 to 56 ms on one machine.
- Each machine that runs Celetis needs Bun 1.4.2 or later. The Codex cloud image has Bun 1.2.10.
  With no setup step, a Codex cloud session stops at its first config read, with the floor line.
- A product project gets the new launcher when it runs `/celetis:setup`. Until then, its old
  launcher reads with yq, and each plugin script reads with Bun. So keep yq on a machine until each
  of its product projects has the new launcher. A new launcher with an old plugin stops with
  `the plugin at … has no config reader; update the plugin`.
- A product script that sources its copy of `scripts/celetis` and calls `celetis_config_read`
  stops, with a line that names the launcher of the plugin. No product repository was checked for
  such a script.
- The launcher has two parsers: `Bun.YAML` for the host hint and `yaml` for the full check. For
  each valid case of `tests/config.test.sh`, the test checks that both give the same `host`.
- The plugin holds code of a third party. An update of `yaml` is a manual rebuild with the commands
  of `scripts/lib/vendor/README.md`, and then a run of `scripts/verify.sh` and `tests/suite.sh`.
- The Bun version on each machine of the maintainer, and the path form that `bun.exe` gets from
  Windows Git Bash, are not checked. They are checks by hand.

## Reconsider when

- `Bun.YAML` gains node metadata (tags, styles, and keys) or parse options. Then the vendored
  `yaml` can go.
- The next layers of the decision study move more scripts to Bun.
- `yaml` 3 is released.
- A new Bun floor is necessary.
