# Repository configuration

Store Celetis setup in one regular, readable `.celetis.yaml` at the checkout root. A symlink is
not allowed. Do not search parent folders or combine files. Use one YAML 1.2 document with a
mapping root. Comments are allowed. Put nothing after a `---` marker on its line.

This repository uses:

```yaml
host: codex
landing: pr
board:
  port: 4404
```

## Fields and defaults

| Field | Accepted value | Default when omitted |
| --- | --- | --- |
| `host` | `claude` or `codex` | `claude` |
| `landing` | Required: `pr` or `merge` | None |
| `gates` | Mapping from a step name to `me` or `auto` | `me` for each omitted step |
| `board` | Mapping with optional `port`, an integer from 1024 to 65535 | Port 4403 |
| `worktreeSetup` | One TypeScript program string | No setup |
| `custom` | Mapping from a Celetis skill stem to an instruction string | No addition for an omitted skill |
| `codexProfiles` | Mapping from a runtime identity to its profile | Each Codex child keeps the parent's model |

The allowed gate names are `triage`, `specify`, `bug`, `chore`, `hotfix`, `plan`, and
`implement`. No other step is accepted. An empty `gates` mapping uses `me` for all seven.
An empty `board` mapping uses port 4403. `PORT` takes precedence over the configured board port.

The allowed custom keys are `bug`, `chore`, `critic-loop`, `doc-drift-sync`, `feature`,
`guide`, `hotfix`, `implement`, `intake`, `lesson`, `lesson-review`, `plan`,
`polishing-code-comments`, `prototype`, `record-architecture-decisions`, `setup`, `specify`,
`triage`, and `writing-for-agents`.
An empty setup string runs no setup. An empty instruction string gives no addition.
An empty `custom` or `codexProfiles` mapping is valid.

Agent selection is `--agent`, then `CELETIS_AGENT`, then the main config's `host`, then
`claude`. Resume uses the host and session ID in its saved record. An explicit host that
conflicts with that record stops resume.

Each `codexProfiles` key must be a nonempty string that identifies the dispatch runtime.
Each profile has exactly two required fields:

| Profile field | Accepted value |
| --- | --- |
| `slots` | Four ordered, nonempty model IDs in an array |
| `reviewer` | Mapping with required integer `rank` from 0 to 3 and required `effort` |

A model ID starts with an ASCII letter or digit. Its other characters are ASCII letters,
digits, `.`, `_`, `/`, or `-`. Reviewer effort is `low`, `medium`, `high`, or `xhigh`.
A profile has no `schema`, `runtime`, or model allowlist field. Celetis reads the model and
effort evidence from the active dispatch surface. There is no bundled profile. With no entry,
each Codex child keeps the parent's model and gets the effort of its rank
([Codex model profiles](capability.md#codex-model-profiles)).
Explicit `--profile` and `CAP_MODEL_PROFILE` inputs take precedence for standalone or one-run
scoring.

## Script and instruction text

Use a literal block, `|` or `|-`, for multiline text. `|` keeps one final newline;
`|-` removes it. `|+` keeps all trailing newlines. A short value can be a normal YAML string.
Folded blocks (`>`) and arrays are not accepted for setup or instructions.
Quotes, backslashes, Unicode, blank lines, and parsed trailing newlines stay intact.

```yaml
landing: pr
worktreeSetup: |
  console.log(process.argv[2]);
custom:
  bug: |-
    Keep the change small.
```

The setup program runs on the selected Bun in the new lane checkout. Celetis writes the exact
parsed string to a private 0600 TypeScript file outside the canonical main checkout and lane.
`process.argv[2]` is the absolute main checkout. Stdin, stdout and stderr stay inherited. The
worktree command adds an LF separator after nonempty setup output and prints the final absolute
lane path. `setup try` prints its path even when preparation or execution fails.
Pass each external executable and its arguments as an array. Check its exit status and stop on
failure. Variables and functions share one program. Reading the config or entering a skill
executes no setup. An omitted or empty program runs no setup. Signals stop the owned child and
remove the temporary file; the existing marker and lane cleanup rules remain below.

The main config is checked before Git prune, branch or worktree changes, runtime state creation,
host sessions, and landing pushes. The runner checks it again before each new
session. The worktree command also checks the lane config on every entry, including a lane with
its setup marker. An unmarked lane runs setup once and receives the marker only after a script
that is not empty succeeded. With an empty or missing `worktreeSetup`, the lane stays unmarked.
A setup failure or invalid new lane config uses the existing cleanup: remove the new worktree
and a branch created by the command; keep an existing branch or worktree for repair and retry.
Old Git defaults have no effect; the cutover table below lists them.

Use the main checkout for `host`, `landing`, `gates`, `board`, and `codexProfiles`.
Use the new lane checkout for setup. At each skill entry, use `custom.<skill>` from the active
checkout. With no checkout or no config, optional skill entry has no custom addition.
An existing invalid or unreadable config stops entry. A denied read has no alternate read path.
Commands that need repository setup require a valid file.

Skill entry reads the whole file once through the running host's supported file access,
then interprets this schema and applies only `custom.<skill>`. Keep the parsed string intact.
Other custom strings and `worktreeSetup` remain data. Claude uses its native entry hook;
Codex can use shell commands, dedicated readers, or supported runtime file APIs. Entry executes
no setup. Codex can also use the existing configuration reader below. An ambiguous interpretation
stops with the selected file and field. A file read alone is not a deterministic parser PASS. The shared
[host entry](hosts/entry.md) owns the exact-once rule for handoffs and borrowed references.

## Validation and reader interface

Unknown fields are errors at every level. Supplied null values, wrong types, invalid enum
values, duplicate keys, non-string keys, aliases, merge keys, custom tags, and non-JSON YAML
values are errors. Only the standard map, sequence, string, null, Boolean, integer, and float
tags can pass the parser check; the field schema then limits each value. Non-finite numbers
are not accepted. Script and instruction strings cannot contain NUL.
Plain `yes` and `on` are strings under YAML 1.2.

Import `readConfig` and `ConfigError` from `engine/lib/config.ts` of the plugin for typed
configuration reads. Importing the module starts no installation discovery or setup.
`readConfig(CHECKOUT)` reads only that checkout's `.celetis.yaml`, validates it, and returns the
object without inserted defaults. `mainCheckout` in `engine/lib/host.ts` resolves the main
checkout and reports a failed Git lookup. The former Bash sourcing interface is removed.

The reader CLI runs as:

```sh
BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 bun --no-env-file --no-install --config=/dev/null --no-macros <plugin>/engine/lib/config.ts CHECKOUT
```

It prints one compact validated JSON object and LF. Invalid or missing configuration exits 2
with empty stdout. Its diagnostic names the selected path and field; syntax and root errors
use `<document>`. A below-floor Bun that can execute the entrypoint exits 2. Missing, broken,
or nonexecutable Bun uses the native env/kernel diagnostic and status. There is no interpreter
wrapper. The plugin owns the source entrypoint and its engine. Child Celetis programs use
selected `process.execPath`, isolated environment/config/preload/macro/package controls,
disabled transpiler cache, and `DO_NOT_TRACK=1`.

The reader uses one private YAML snapshot for metadata checks and JSON conversion. It checks
document, key, node, and style metadata before JSON conversion can remove YAML information.
JSON remains in memory. No generated config file is written.

The reader refuses invalid UTF-8. It refuses each character outside the printable set of
YAML 1.2, and U+0085, U+2028, and U+2029. A comment is no exception. These errors use
`<document>`. A plain value in the YAML 1.1 timestamp form, such as `2026-10-16`, is an error.
A plain value or key in a YAML 1.1 number form that YAML 1.2 reads as a string, such as `4_404`
or `0b101`, is an error too. Quote such a value to keep it as a string.

The entrypoint imports its own engine before local dispatch. It reads only `host` of the main
config when neither `--agent` nor `CELETIS_AGENT` selects a host. The full reader checks the main
config before `worktree`, `celetis-flow`, `next-step`, `land`, and `board`.

## Start the board

Run `BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 bun --no-env-file --no-install --config=/dev/null --no-macros <plugin>/bin/celetis.ts --agent <host> board` in the main checkout or a subfolder. It takes no arguments and
refuses a lane start before it starts the board. It reads only the main config's `board.port`, default 4403,
and keeps `PORT` above that value. It supplies the fixed data, selected-agent Run, and
saved-host Resume lists through a local module interface. The adapter validates the package
entrypoint and selected runtime; generic stdin remains restricted to project executables. No board config file is made.
The board checks concrete replacement-policy conflicts. It can remain open during a manual update.
The producer default is read-only. Change `host` in the main YAML to set
the project default. A board Run choice applies only to that start; Resume uses its saved host.
See [the board contract](celetis-flow.md#the-board) for the exact lists.

## Replace the old setup

This is a manual cutover. Before the next use of Celetis in each affected product project, the
maintainer completes its readiness review and cutover under [Updates](../README.md#updates).
That section owns the exact offer, one direct terminal response, target-bound replacement,
and the resource limits of open sessions. A push to the plugin trunk does not update a product's installation
or copied launcher. This lane changes no other project.

1. Install Bun 1.4.2 or later on each machine and CI job that runs Celetis commands, using
   the instructions below.
2. Review each old input and prepare one `.celetis.yaml` in that product's main checkout:

   | Old input | Replacement |
   | --- | --- |
   | Git `celetis-flow.agent` or `celetis-flow.host` | Optional YAML `host`. Keep the intended new-step default. |
   | Git `celetis-flow.gate.<step>` and `.claude/celetis-flow/gates.json` | YAML `gates.<step>`. Write each intended `auto`; omitted steps now use `me`. |
   | `.claude/celetis-flow/landing.json` | Required YAML `landing`. |
   | `.claude/celetis-flow/board.json` | YAML `board.port` only. The adapter supplies all three fixed command lists. |
   | `.claude/celetis-flow/worktree-setup.sh` | Rewrite its complete program as TypeScript in a literal `worktreeSetup` string. Check external command statuses. Main is `process.argv[2]`. |
   | Each `.claude/celetis-flow/custom/<skill>.md` | Complete instruction text in `custom.<skill>`, with its parsed line breaks and trailing newlines. |
   | Each repository-owned `--profile` or `CAP_MODEL_PROFILE` JSON input | Its `slots` and `reviewer` under `codexProfiles.<runtime>`. Use the matching runtime identity as the key; omit the old `schema` and `runtime` fields. |

   Use `|`, `|-`, or `|+` to preserve the required script and instruction strings. Check each
   profile against the active dispatch surface's current model/effort allowlist. Supply no
   placeholder or bundled model defaults. Explicit profile files remain available for one-run
   or standalone scoring; remove a persistent override when the main YAML should own selection.
3. Before that product's next use of Celetis, review the
   [product cutover](../README.md#product-cutover). Select and validate
   the reviewed source repair entrypoint before removing the product launcher. Review the exact
   owned launcher, permission, attribute, instruction, and ownership-record changes. Preserve
   differing and unowned files until the owner approves each removal. If the product has a
   Claude project install, the first cutover act runs
   `claude plugin uninstall celetis@celetis --scope project` in its main checkout. It commits
   the changed `.claude/settings.json` with the removal of the owned
   `enabledPlugins.celetis@celetis` record from `.claude/celetis-flow/wiring.json`. Check that
   `claude plugin list --json` then shows no `celetis@celetis` record with `"scope": "project"`
   and a `projectPath` equal to that main checkout. A record of another path, such as an old
   lane worktree, does not count. Check that the `celetis@celetis` record with
   `"scope": "user"` shows `"enabled": true`.
4. Keep native settings, product instructions, config bytes, setup programs, session records,
   runtime state, and setup markers intact. Bind a desktop board entry to the installed absolute
   entrypoint with isolated Bun and its explicit host; match its port to YAML.
5. Record the product's readiness and complete the acts of the
   [product cutover](../README.md#product-cutover) in their order before its next use of Celetis.
   This is not a condition of the plugin landing. Open sessions, runners, boards, and daemons may
   stay open. The first update uses the reviewed source repair, because the installed
   package has no `bin/celetis.ts` yet. Start a fresh session for changed skills. Resume with the
   saved host and ID. If an act fails and blocks a product,
   [roll back the entrypoint landing](../README.md#roll-back-the-entrypoint-landing).

There is no old-layout reader, automatic migration, or dependency installer. `/celetis:setup`
writes the wiring of a product project (`README.md`, "Wire a product project"); it does not
migrate an old setup. A deterministic gate check does not replace the live board acceptance.
Stable installed resources, changed-pair child controls on required CLI surfaces, managed Claude
setup, and complete child bootstrap keep their acceptance states in
[Acceptance status](celetis-flow.md#acceptance-status). Native Codex
desktop binding is separate optional evidence; a desktop limit does not block otherwise complete
required CLI checks. Active-surface validation and permission stops still apply to each requested
operation.

## Install Bun

Celetis commands need Bun 1.4.2 or later on `PATH`. The plugin does not
install dependencies. CI pins Bun 1.4.2. The YAML parser of the reader, the `yaml` package
2.9.1, comes with the plugin in `engine/lib/vendor/`, so a read installs no package.

Install Bun with Homebrew:

```bash
brew install oven-sh/bun/bun
```

Or use the official installer on macOS or Linux. On Linux, the installer needs `unzip`.

```bash
curl -fsSL https://bun.com/install | bash
```

To install one version, give its tag to the installer:

```bash
curl -fsSL https://bun.com/install | bash -s "bun-v1.4.2"
```

The official Windows installer runs in PowerShell. Native host paths replace the former
Git Bash translation; native Windows runner acceptance is still open.

```powershell
powershell -c "irm bun.sh/install.ps1|iex"
```

Then run:

```bash
bun --version
```

The command must print 1.4.2 or a later version. When the shell does not find `bun` after the
official installer, add `$HOME/.bun/bin` to `PATH`. To update an older Bun, run `bun upgrade`,
or `brew upgrade bun` after a Homebrew install.

The [Bun installation page](https://github.com/oven-sh/bun/blob/main/docs/installation.mdx)
gives each method. [YAML 1.2.2](https://yaml.org/spec/1.2.2/) defines literal block behavior.
