# Repository configuration

Store Celetis setup in one regular, readable `.celetis.yaml` at the checkout root. A symlink is
not allowed. Do not search parent folders or combine files. Use one YAML 1.2 document with a
mapping root. Comments are allowed. Put nothing after a `---` marker on its line.

## Fields and defaults

| Field | Accepted value | Default when omitted |
| --- | --- | --- |
| `host` | `claude` or `codex` | `claude` |
| `landing` | Required: `pr` or `merge` | None |
| `gates` | Mapping from a step name to `me` or `auto` | `me` for each omitted step |
| `board` | Mapping with optional `port`, an integer from 1024 to 65535 | Port 4403 |
| `worktreeSetup` | A root-relative `.ts` file reference, or exactly `""` | No setup |
| `suite` | A relative path of a TypeScript file in the checkout; required with `landing: merge`, refused with `landing: pr` | With `merge`, the config is refused |
| `custom` | Mapping from a Celetis skill stem to an instruction string | No addition for an omitted skill |
| `codexProfiles` | Mapping from a runtime identity to its profile | Each Codex child keeps the parent's model |

The allowed gate names are `triage`, `specify`, `bug`, `chore`, `hotfix`, `plan`, and
`implement`. No other step is accepted. An empty `gates` mapping uses `me` for all seven.
An empty `board` mapping uses port 4403. `PORT` takes precedence over the configured board port.

The allowed custom keys are `assist`, `attack-the-premise`, `boundary-discipline`, `bug`, `chore`,
`critic-loop`, `doc-drift-sync`, `encode-lessons-in-structure`, `explain-the-number`, `feature`,
`guide`, `hotfix`, `implement`, `intake`, `lesson`, `lesson-review`, `make-operations-idempotent`,
`model-the-domain`, `plan`, `polishing-code-comments`, `prototype`,
`record-architecture-decisions`, `separate-before-serializing-shared-state`, `setup`, `specify`,
`test-behavior-not-implementation`, `triage`, `type-system-discipline`, and `writing-for-agents`.
Exactly `""` as the setup reference runs no setup. An empty instruction string gives no addition.
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

## Setup file and instruction text

`worktreeSetup` names a normal TypeScript file of the product. Use `/` separators and a
case-sensitive `.ts` suffix. The value is root-relative, also when a command starts in a
subfolder. Celetis preserves accepted characters exactly: it does not trim, expand variables or
`~`, split arguments, or interpret the value as code. A literal `$` or `~` stays literal.

Reject absolute, rooted, drive, and UNC paths; backslashes; colons; empty, `.`, `..`, and `.git`
components; U+0000–U+001F; and U+007F. Omission or exactly `""` means no setup. Null,
whitespace-only text, inline code, and wrong types are errors. Configuration validation checks
the reference only; a valid reference to a missing file can be read. Skill entry neither reads
nor executes the setup file.

Use a literal block, `|` or `|-`, for multiline `custom` instructions. `|` keeps one final
newline; `|-` removes it; `|+` keeps all trailing newlines. A short instruction can be a normal
YAML string. Folded blocks (`>`) and arrays are not accepted for instructions. Quotes,
backslashes, Unicode, blank lines, and parsed trailing newlines stay intact.

```yaml
landing: pr
worktreeSetup: "scripts/worktree-setup.ts"
custom:
  bug: |-
    Keep the change small.
```

Immediately before execution, the reference must identify a readable regular file inside the
canonical target checkout. Celetis rejects final and ancestor symlinks below that root,
directories, special files, outside targets, nested repositories, submodules, and other
worktrees. An invalid target starts no setup child. A canonical alias of the checkout root is
accepted. The trusted-checkout boundary is not a file-swap transaction and adds no restrictions
to transitive imports.

The selected Bun executes the lane file directly, with cwd at the lane root. The file keeps its
source path and ordinary sibling imports. It needs no executable bit or exported-function API.
`process.argv[2]` is one absolute main-checkout argument. Stdin, stdout, and stderr stay
inherited. Product `.env`, Bun configuration, preloads, macros, automatic package installation,
and transpiler cache remain disabled. Pass each external executable and its arguments as an
array; check its status and stop on failure. Signals stop the owned child. The worktree command
adds an LF separator after nonempty setup output and prints the final absolute lane path.
`setup try` prints its path even when preparation or execution fails, and returns the child
status. `worktree` and `setup lane` report setup failure as status 1.

The setup skill proposes the relative path and complete contents for review. Before a detached
wiring test, the product owner approves, creates, and commits the entry and required helpers on
the local trunk in a separate product change. `setup try` and `setup write --setup-file <path>`
require the entry in local trunk HEAD with an unchanged index and working file. They resolve the
option from the main root and add only the reference. They create, copy, stage, own, commit, and
push no application source to make testing possible. A changed proposal requires another owner
source commit before retry. Existing references, including `""`, stay unchanged; a conflict
prints `setup: warning: .celetis.yaml: worktreeSetup differs from the requested setup reference; setup leaves it`.

The main config is checked before Git prune, branch or worktree changes, runtime state creation,
host sessions, and landing pushes. The runner checks it again before each new
session. The worktree command also checks the lane config on every entry, including a lane with
its setup marker. An unmarked lane runs setup once and receives the marker only after a nonempty
reference succeeded, including a zero-byte file. With exactly `""` or missing `worktreeSetup`,
the lane stays unmarked. Source edits do not clear a marker. Explicit `setup lane <path>` uses
the main reference and target lane source, and clears an old marker before file validation or
execution. It writes the marker again only on success. An older lane with missing source needs
the owner to bring that committed source into the lane; there is no copy or merge fallback.
A setup failure or invalid new lane config uses the existing cleanup: remove the new worktree
and a branch created by the command; keep an existing branch or worktree for repair and retry.
Old Git defaults have no effect.

The `suite` file is the full check of a `merge` landing. `land` runs it in the lane checkout, with
no argument, at the tip that it lands, after the last check of the lane and before the commit on
the trunk. Exit status 0 is a pass; any other status stops the landing with `land: checks:`. A suite
that changes the lane or the trunk stops the landing with a repair or usage line, and the trunk
stays as it was. `land` runs the suite again on each run. A `pr` landing runs no suite: its checks
are the checks of the PR.

Use the main checkout for `host`, `landing`, `suite`, `gates`, `board`, and `codexProfiles`.
Use the new lane checkout for setup. At each skill entry, use `custom.<skill>` from the active
checkout ("Skill entry"). Commands that need repository setup require a valid file.

## Skill entry

Each skill invocation is an entry of its own, also a same-session handoff and an invocation in a
child agent. The entry reads the whole file of the active checkout once, through a
permission-checked native read, and applies only `custom.<skill>`, with its parsed string intact.
The string reaches only that invocation. Other custom strings and `worktreeSetup` remain data, and
entry executes no setup. A runtime operation value never replaces the read (ADR-0032). With no
checkout or no file, the entry has no custom addition. An existing invalid, ambiguous, unreadable,
or symlink file stops the entry with the path and the field. A denied read stops the entry, and
no other access follows.

- **On Claude Code,** the native entry hook (`engine/hooks/entry.ts`) makes the read with `Read`.
  It parses and validates the returned text with `parseConfigText` and `validateConfig`, the full
  validation of the reader below, and puts the custom string into its facts block. The hook
  parses text, not bytes: the byte checks of the reader, for example strict UTF-8, hold at each
  command, which validates the file again before protected work.
- **On Codex, and on Claude Code when the hook did not run,** the session follows "Entry without
  the hook" of `docs/procedures/entry.md`. Codex with a shell runs the reader CLI below. Else the
  session reads the file natively (Claude Code with `Read`, Codex with a dedicated reader or a
  runtime file API) and applies a short rule list of that part, and the full validation comes with
  the first command that needs the file.

After the entry, a step that needs another value of the file reads it at that step through the
reader CLI (`docs/procedures/entry.md`, "The contract"). `docs/hosts/claude-code.md` and
`docs/hosts/codex.md` hold the integration facts of each host (ADR-0047).

## Validation and reader interface

Unknown fields are errors at every level. Supplied null values, wrong types, invalid enum
values, duplicate keys, non-string keys, aliases, merge keys, custom tags, and non-JSON YAML
values are errors. Only the standard map, sequence, string, null, Boolean, integer, and float
tags can pass the parser check; the field schema then limits each value. Non-finite numbers
are not accepted. Instruction strings cannot contain NUL. Setup references use the lexical
rules above.
Plain `yes` and `on` are strings under YAML 1.2.

`engine/lib/config-core.ts` of the plugin owns parsing, validation, types, and diagnostics. It has
no `node:` import and no `Bun` global, so the native entry hook bundles it.
`parseConfigText(text)` checks the characters and the source structure of one text.
`configHost(source)` validates only the optional `host`; `validateHost(value)` defines accepted
configuration hosts. `validateConfig(source)` checks the full schema and returns a deeply frozen
`Config` without inserted defaults. `ConfigError` names the field, and `formatConfigError` renders
the selected path, field, and message.

`engine/lib/config.ts` of the plugin owns byte access and the reader CLI. Importing it starts no
installation discovery or setup. `readSnapshot(file)` reads the bytes of one regular file with no
symlink. `readConfigSource(CHECKOUT)` checks the Bun floor, reads that checkout's `.celetis.yaml`
once, decodes it as strict UTF-8, and parses it. `readConfig(CHECKOUT)` combines the source read
and full validation.

Both projections require safe file access, strict UTF-8, one mapping document, string keys,
unique keys, supported tags, finite scalars, and no aliases or merge keys. Host selection does
not check unrelated field values or require `landing`: `host: codex` alone selects Codex.
An unknown root field, invalid gate, or invalid board port can pass that projection. Only full
validation checks allowed fields, required `landing`, instruction literal styles, setup reference
syntax, and field-specific
integer forms and ranges. A host projection is never a full `Config`.

Bootstrap uses this shared source instead of `Bun.YAML.parse`. Duplicate keys, aliases, unsafe
files, invalid encoding, and other ambiguous source forms now fail during implicit selection.
Implicit YAML host errors use `host: invalid value`, and syntax or root errors use `<document>` with the shared
reader diagnostic. The former `invalid agent null`, mapping/sequence host messages, and native
parser quirks are removed. `--agent` and `CELETIS_AGENT` select a host without a YAML read for
selection; a command that needs full configuration still validates it before protected work.

The reader CLI runs as:

```sh
BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 bun --no-env-file --no-install --config=/dev/null --no-macros <plugin>/engine/lib/config.ts CHECKOUT
```

It prints one compact validated JSON object and LF. Invalid or missing configuration exits 2
with empty stdout. Its diagnostic names the selected path and field; syntax and root errors
use `<document>`. A below-floor Bun that can execute the entrypoint exits 2. Missing, broken,
or nonexecutable Bun uses the native env/kernel diagnostic and status. There is no interpreter
wrapper. The program owns its entry file `celetis` and its engine. Child Celetis programs use
selected `process.execPath`, isolated environment/config/preload/macro/package controls,
disabled transpiler cache, and `DO_NOT_TRACK=1`.

The reader uses one private parsed source for metadata checks and JSON conversion. It checks
document, key, node, and style metadata before JSON conversion can remove YAML information.
JSON remains in memory. No generated config file is written.

The reader refuses invalid UTF-8. It refuses each character outside the printable set of
YAML 1.2, and U+0085, U+2028, and U+2029. A comment is no exception. These errors use
`<document>`. A plain value in the YAML 1.1 timestamp form, such as `2026-10-16`, is an error.
A plain value or key in a YAML 1.1 number form that YAML 1.2 reads as a string, such as `4_404`
or `0b101`, is an error too. Quote such a value to keep it as a string.

### Operation values and freshness

The program entry imports its own engine and replaces its process with the named command before
configuration reads. On Windows, it spawns the command with the same stdio and environment,
waits, and exits with its status. The command consumes the forwarded `--agent`, validates its
arguments, and creates its operation. `land.ts` and `celetis-flow.ts` retain their process
identities for lock-owner checks.

`locateCheckouts(cwd)` in `engine/lib/operation.ts` resolves canonical active, main, and common
Git paths. A subfolder has its checkout's identity. When the Git directory equals the common
directory, the active top level identifies main, including a checkout with a separate Git directory.
For a linked worktree, Git's first worktree record must resolve to a main top level whose own Git
directory is that common directory. Git's `core.worktree` can supply this binding for a separate
Git directory. If Git cannot identify main, discovery fails before any configuration read.
It never uses an adjacent or parent directory as a policy source.

`createOperation(checkout, selection, required)`
captures these identities, the original selection inputs, selected host, and required validated
values. Its mode is `host`, `main`, or `active`, or a selector resolved once from the selected
host. `host` reads YAML only when selection needs it. `main` requires the main config; `active`
requires both files. Each distinct required checkout is read once. Equal main and active paths
reuse one source and one `Config`. A null config means that projection was not required.

Operations, checkout identities, selection inputs, and nested configuration values are frozen.
Internal handlers receive them as arguments. They do not rediscover cwd or launch a reader or
resolver command to obtain configuration. There is no global cache, environment snapshot, or
generated product snapshot file. The reader CLI remains for skill entry without the hook, for a
step that needs a value of the file, and for the verify gate of this repository.

| Fresh boundary | Values used within the boundary |
| --- | --- |
| Public command | One operation before protected side effects; argument errors can fail first |
| Board data refresh | One main operation for issue resolution, gates, and default host; Run and Resume start separate commands |
| New workflow step | Fresh main policy for resolution, gate choice, and session start; original explicit and environment inputs retain precedence |
| Active-session monitoring | A separate fresh operation for status; the running session retains its captured host and exact ID; a config failure waits until that child exits |
| Target lane entry | Fresh main and lane validation before setup or acceptance of an existing setup marker |
| Configuration setup or test after a write | Fresh validation of the written or newly selected file |
| Landing start and protected actions after asynchronous work | Fresh policy and repository preflight before push, PR creation, check rerun, or merge |

The board port stays fixed at startup until restart. A changed default host applies to the next
new session; exact Resume retains its saved host and ID. Each skill entry is a native boundary of
its own ("Skill entry"), independent of runtime operations.

Landing keeps the mechanism selected at its start. If the mechanism changed, it stops and
requires a new invocation. Invalid fresh configuration also stops it. Preflight rechecks checkout,
branch, captured tip and trunk SHAs, and PR identity where applicable. After green checks, it
refreshes again around the final checks and PR-identity wait before its SHA-bound merge.
Pushes remain non-forced and use captured SHAs. These boundaries give stable internal values,
not a filesystem transaction across checkouts or a transaction with GitHub.

## Start the board

Run `celetis --agent <host> board` in the main checkout or a subfolder. It takes no arguments and
refuses a lane start before it starts the board. At its start it reads the main config's
`board.port`, default 4403, and keeps `PORT` above that value. Each data refresh creates a fresh
main operation, so a change of `host` or `gates` shows at the next refresh ("Operation values and
freshness"). At each press, the fixed adapter reads the installed program and types two fixed
lines with its command: Run with the selected agent, and Resume with no agent, using the saved host.
No board config file is made. The board checks concrete replacement-policy conflicts at its
start only; each Run and Resume checks them again in its own process. It can
remain open during a manual update. After `celetis update`, Run and Resume need no board restart;
new board code still needs a restart. The default agent is read-only on the board. Change `host` in
the main YAML to set the project default. A board Run choice applies only to that start; Resume
uses its saved host. See [The board](celetis-flow.md#the-board) for the exact lines.

A deterministic gate check does not replace live board acceptance. Stable installed resources,
changed-pair child controls on required CLI surfaces, managed Claude setup, and complete child
bootstrap keep their acceptance states in [Acceptance status](celetis-flow.md#acceptance-status).
Native Codex desktop binding is separate optional evidence; a desktop limit does not block
otherwise complete required CLI checks. Active-surface validation and permission stops still
apply to each requested operation.

## Install Bun

Celetis commands need Bun 1.4.4 or later on `PATH`: the entry of the program finds `bun` there.
Celetis installs no package dependency. CI pins Bun 1.4.4. The YAML parser of the reader, the
`yaml` package 2.9.1, comes with the plugin in `engine/lib/vendor/`, so a read installs no package.

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
curl -fsSL https://bun.com/install | bash -s "bun-v1.4.4"
```

The official Windows installer runs in PowerShell. Then the first install of `README.md` installs
the program from Git Bash, and the program runs from Git Bash, PowerShell, and `cmd`.
[Acceptance status](celetis-flow.md#acceptance-status) gives the Windows checks and the open ones.

```powershell
powershell -c "irm bun.sh/install.ps1|iex"
```

Then run:

```bash
bun --version
```

The command must print 1.4.4 or a later version. When the shell does not find `bun` after the
official installer, add `$HOME/.bun/bin` to `PATH`. To update an older Bun, run `bun upgrade`,
or `brew upgrade bun` after a Homebrew install.

The [Bun installation page](https://github.com/oven-sh/bun/blob/main/docs/installation.mdx)
gives each method. [YAML 1.2.2](https://yaml.org/spec/1.2.2/) defines literal block behavior.
