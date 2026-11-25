# Repository configuration

Store Celetis setup in one regular, readable `.celetis.yaml` at the checkout root. A symlink is not
allowed. Each reader reads only `<checkout>/.celetis.yaml`; no reader searches a parent folder for
it or combines files. Use one YAML 1.2 document with a mapping root. Comments are allowed. Put
nothing after a `---` marker on its line.

## Fields and defaults

| Field | Accepted value | Default when omitted |
| --- | --- | --- |
| `tracker` | Required: `github` or `local`: the issue tracker of the project. `local` keeps the issues in the repository and needs `landing: merge`; with `landing: pr`, the config is refused. The key form of each command follows it: a number for `github`, the 7 hexadecimal characters of a local issue for `local` | None: the config is refused |
| `landing` | Required: `pr` or `merge`. `pr` squash-merges a PR when each check is green. `merge` creates one squash commit on the trunk, with no PR; a project with no PR check uses `merge` (`docs/issue-tracker.md`, "Branches, PRs, merge") | None: the config is refused |
| `gates` | Mapping from `triage` and each lane name to a gate (`docs/workflow.md`, "Gates") | `manual` for each omitted key and step |
| `agents` | Mapping from a step name to `claude`, `codex`, or `opencode`: the preferred agent of that step ([Agent selection and model setup](#agent-selection-and-model-setup)) | Each step uses the local order |
| `sessions` | Mapping from a step name to a mapping with an optional `model` (`haiku`, `sonnet`, `opus`, or `fable`) and an optional `effort` (`low`, `medium`, `high`, `xhigh`, or `max`): a pin of the model, the level, or both for each step session that the daemon starts. A pinned value wins over the decision of the step before. A `--model` or `--effort` of one start wins over the pin ([Agent selection and model setup](#agent-selection-and-model-setup)) | No pin |
| `autoLanes` | A sequence with one or more of `triage`, `feature`, `bug`, `chore`, and `hotfix`: the lanes that auto mode of the daemon takes. `triage` stands for an issue with no lane (`docs/workflow.md`, "Gates") | Auto mode takes each lane and each issue with no lane |
| `board` | Mapping with optional `port`, an integer from 1024 to 65535: the first port to try for the board ("Start the board") | Search starts at 4403 |
| `worktreeSetup` | A root-relative `.ts` file reference, for example `"scripts/worktree-setup.ts"`, or exactly `""` ("Setup file and instruction text") | No setup |
| `suite` | A relative path of a TypeScript file in the checkout: the full check of a `merge` landing ("Setup file and instruction text"); required with `landing: merge`, refused with `landing: pr` | With `merge`, the config is refused |
| `holdLanding` | A boolean. `true` holds each built `feature` and `bug` issue on its branch until the maintainer lands or discards it on the board (`docs/workflow.md`, "A held change"). `true` with `landing: pr` is refused | `false`: no issue is held; one issue can still be held by `celetis --agent <host> issue <n> hold` or the board |
| `custom` | Mapping from a skill name of the plugin to an instruction string: an addition to the procedure of that skill | No addition for an omitted skill |
| `codexProfiles` | Mapping from a runtime identity to its profile: four ordered model slots and the reviewer minimum for that dispatch surface | Each Codex child keeps the parent's model |

The engine reads `tracker`, `landing`, `suite`, `holdLanding`, `gates`, `agents`, `sessions`, `autoLanes`, `board`,
and `codexProfiles` from the main checkout, also when a command starts in a lane or a subfolder.
The worktree command reads `worktreeSetup` from the lane checkout. At a skill entry, the active
checkout supplies only the selected `custom.<skill>`
([ADR-0032](https://github.com/ddinkov10/celetis/blob/main/docs/adr/0032-shared-configuration-operation-snapshots.md)).
Commands that need repository setup require a valid file: a missing or invalid required config
stops before a Git prune, branch or worktree changes, locks, runtime state, host sessions, or
landing pushes. The daemon checks the main config again before each new session ("Operation
values and freshness"). Installation discovery with an explicit host and standalone capability
scoring with explicit inputs work outside a repository and need no project config. For the record
of setup, see `docs/setup.md`, "`setup write`".

For the repository setting of the squash title with the landing `pr`, see
`docs/issue-tracker.md`, "Branches, PRs, merge".

The keys of `gates` are `triage` and the lane names `feature`, `bug`, `chore`, and `hotfix`. A
label name, for example `enhancement`, is no key. The value of `triage` is `manual` or `auto`: the
gate of the triage of an issue with no lane. The value of a lane is one of these:

- `manual` or `auto`: the gate of each step of the lane.
- A mapping from a step of the lane to `manual` or `auto`. The steps are `specify`,
  `plan`, and `implement` for `feature`; `bug`, `plan`, and `implement` for `bug`; `chore` for
  `chore`; and `hotfix` for `hotfix`.

An omitted `gates`, an omitted key, an empty mapping, and an omitted step give `manual`. The config
is invalid with any other key, step key, or value, for example the step-keyed form
`gates: {plan: auto}` of older versions, `gates.chore.plan`, or `gates.bug.triage`. The former value
`me` is invalid too. There is no automatic conversion. A step-keyed file of older versions with keys
only from `triage`, `bug`, `chore`, and `hotfix` and the values `manual` or `auto` stays valid, and
its `gates.bug: auto` now sets each step of the lane `bug`, also `plan` and `implement`. `chore` and
`hotfix` keep their meaning, because each of those lanes has one step. `gates.bug`
names the lane `bug`, while `agents.bug` and `sessions.bug` name the step `bug`.
The `agents` keys are the seven step names `triage`, `specify`, `bug`, `chore`, `hotfix`, `plan`,
and `implement`, and the allowed values are `claude`, `codex`, and `opencode`. A step with no entry, an omitted `agents` field, and an empty `agents` mapping give no
preference.
An empty `board` mapping starts the automatic port search at 4403. An effective `PORT` takes
precedence and requests one exact port ("Start the board").

A `custom` key is a skill name: a lowercase letter, then lowercase letters, digits, or `-`. Each
command that reads the file refuses a key of another form. The reader CLI and the Claude Code
entry also refuse a key when `<plugin>/skills/<key>/SKILL.md` is not a regular file with no
symlink, so a new skill of the plugin needs no engine change. The other commands check only the
form, and a Codex entry with no shell checks no name.
Exactly `""` as the setup reference runs no setup. An empty instruction string gives no addition.
An empty `custom` or `codexProfiles` mapping is valid.

A `custom.<skill>` string reaches only the invocation of its own skill, for example a check on a
real device after the build: `chore` does not apply `custom.implement`, and `lesson-review` does
not apply `custom.lesson`. The text is an addition: it cannot remove a rule of the general skill
(ADR-0006). `custom.hotfix` holds the ship acts of the project. A product fact that two or more
skills need, for example a landing rule that both `implement` and `chore` follow, or the lesson
tags of the project, goes into the `AGENTS.md` of the project, with the domain knowledge
(`docs/setup.md`, "`AGENTS.md`"). Each invocation reads the whole config once and applies only its
own string ("Skill entry").

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

Validation rejects absolute, rooted, drive, and UNC paths; backslashes; colons; empty, `.`, `..`,
and `.git` components; U+0000–U+001F; and U+007F. Omission or exactly `""` means no setup. Null,
whitespace-only text, inline code, and wrong types are errors. Configuration validation checks the
reference only; a valid reference to a missing file can be read. A configuration read, a skill
entry, and the reader CLI neither read nor execute the setup file. `setup status` checks that a configured `suite` and a nonempty
`worktreeSetup` name readable regular files in the active checkout, by the target rules below, and
runs neither file.

Use a literal block, `|` or `|-`, for multiline `custom` instructions. `|` keeps one final
newline; `|-` removes it; `|+` keeps all trailing newlines. A short instruction can be a normal
YAML string. Folded blocks (`>`) and arrays are not accepted for instructions. Quotes,
backslashes, Unicode, blank lines, and parsed trailing newlines stay intact.

```yaml
tracker: github
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

The selected Bun executes the lane file directly, with cwd at the lane root, also after a
subfolder invocation. The file keeps its source path and ordinary sibling imports. It needs no executable bit or exported-function API.
`process.argv[2]` is one absolute main-checkout argument. Stdin, stdout, and stderr stay
inherited. Product `.env`, Bun configuration, preloads, macros, automatic package installation,
and transpiler cache remain disabled. A setup file passes each external executable and its
arguments as an array, checks each status, and stops on failure. Signals stop the owned child. The
worktree command adds an LF separator after nonempty setup output and prints the final absolute
lane path.
`setup try` prints its path even when preparation or execution fails, and returns the child
status. For the life of its test lane, see `docs/setup.md`, "`setup try`". `worktree` and `setup lane` report setup failure as
exit 6.

The worktree command checks the lane config on every entry, including a lane with its setup
marker `<git dir of the worktree>/celetis-setup-done`. An unmarked lane runs setup once and
receives the marker only after a nonempty reference succeeded, including a zero-byte file. With
exactly `""` or missing `worktreeSetup`, the lane stays unmarked. Each entry runs setup again in
an unmarked lane, so a reference that a merge of the trunk brings runs at the next entry. Source
edits do not clear a marker. Explicit `setup lane <path>` uses
the main reference and target lane source, and clears an old marker before file validation or
execution. It writes the marker again only on success. An older lane with missing source needs
the owner to bring that committed source into the lane; there is no copy or merge fallback.
After a setup failure or an invalid new lane config, the worktree command removes the new
worktree and a branch that it created, and keeps an existing branch or worktree for repair and
retry. An invalid lane config exits 2 after that cleanup, and a failed setup script or a Git
failure exits 6. A refused update of an existing branch names its own reason and uses the same
cleanup.

The `suite` file is the full check of a `merge` landing. `land` runs it in the lane checkout, with
no argument, at the tip that it lands, after the last check of the lane and before the commit on
the trunk. Exit status 0 is a pass; any other status stops the landing with the checks failure of
`land`. A suite
that changes the lane or the trunk stops the landing with a repair or usage line, and the trunk
stays as it was. `land` runs the suite again on each run. The suite is a child process of the
process that runs the landing, the master daemon or `land` itself (`docs/workflow.md`, "A
landing"): it has no stdin, its stdout and stderr are pipes, not a terminal, and their bytes reach
the stdout and stderr of `land` unchanged. With a daemon, it has the environment of the daemon, not
of the shell that runs `land`. With no daemon, it has the environment of the shell of `land`.
An abort of the landing sends SIGTERM to the suite, and SIGKILL when the suite still runs 10
seconds later. A `pr` landing runs no suite: its checks are the checks of the PR.

## Skill entry

Each skill invocation is an entry of its own, also a same-session handoff and an invocation in a
child agent. On Claude Code, the native entry hook (`engine/hooks/entry.ts`) makes one native `Read`
of the whole file of the active checkout at each invocation, when the file exists and is no symlink.
It parses and validates the returned text with `parseConfigText` and `validateConfig`, the full
validation of the reader below, and checks each `custom` key against the skills of the plugin with
`checkSkills`, as the reader CLI does. It puts only `custom.<skill>`, with its parsed string intact,
into the facts block of that invocation. Other custom strings and `worktreeSetup` stay data, the
hook runs no setup, and a runtime operation value never replaces the read (ADR-0032). With no
checkout or no file, the block has no custom text. A symlink, an invalid or ambiguous file, and a
failed or denied read stop the entry with the path and the field, and the stop block allows no other
access path. The hook parses text, not bytes: the byte checks of the reader, for example strict
UTF-8, hold at each command, which validates the file again before protected work.

Each `SKILL.md` holds one entry line: bind `<plugin>` from the path of the loaded skill, and read
`<plugin>/references/procedures/entry.md` before any step or answer. On Claude Code, the hook puts its
facts block in place of that line before the model sees the skill. The block gives the host, the
plugin root, the checkout, the contract of `references/procedures/entry.md`, and the custom text of the
skill, with no host manual and no raw YAML. The hook also makes its own permission-checked `Read`
of the Git boundary, and it consumes no runtime snapshot (ADR-0013, ADR-0047).

A step that the daemon starts runs in the main checkout; a later skill entered in a lane reads the
config of that lane. No skill reads another skill's `SKILL.md`.

`references/procedures/entry.md`, "Entry without the hook", holds the entry with no hook.
`docs/hosts/claude-code.md` and `docs/hosts/codex.md` hold the integration facts of each host
(ADR-0047).

## Validation and reader interface

Unknown fields are errors at every level. A `custom` key is not a field: it is a skill name of the
form above. Supplied null values, wrong types, invalid enum values, duplicate keys, non-string keys,
aliases, merge keys, custom tags, and non-JSON YAML values are errors. Only the standard map,
sequence, string, null, Boolean, integer, and float tags can pass the parser check; the field schema
then limits each value. Non-finite numbers are not accepted. Instruction strings cannot contain NUL.
Setup references use the lexical rules above.
Plain `yes` and `on` are strings under YAML 1.2.

`engine/lib/config/core.ts` of the engine owns parsing, validation, types, and diagnostics. It has
no `node:` import and no `Bun` global, so the native entry hook bundles it. `parseConfigText(text)`
checks the characters and the source structure of one text. `validateHost(value)` defines accepted
host inputs. `validateConfig(source)` checks the full schema and returns a deeply frozen `Config`
without inserted defaults. `skillName` is the form of a `custom` key.
`checkSkills(config, plugin, isFile)` asks `isFile` for `<plugin>/skills/<key>/SKILL.md` of each
`custom` key, in order, and throws a `ConfigError` of `custom.<key>` at the first missing file. The
caller gives `isFile`, because the module has no file access. Only the reader CLI and the entry hook
check the skill file of a `custom` key; each other command checks only its form. `ConfigError` names
the field, and `formatConfigError` renders the selected path, field, and message. A failed read also
keeps its filesystem code (`ioCode`), so `setup status` reports an absent file as missing and a
denied read as blocked.

`engine/lib/config/config.ts` of the engine owns byte access. Importing it starts no installation
discovery or setup. `readSnapshot(file)` reads the bytes of one regular file with no
symlink. `readConfigSource(CHECKOUT)` checks the Bun floor, reads that checkout's `.celetis.yaml`
once, decodes it as strict UTF-8, and parses it. `readConfig(CHECKOUT)` combines the source read
and full validation.

Source reads require safe file access, strict UTF-8, one mapping document, string keys, unique keys,
supported tags, finite scalars, and no aliases or merge keys. Full validation checks allowed fields,
the form of each `custom` key, required `tracker` and `landing`, `landing: merge` with
`tracker: local`, instruction literal styles, setup reference syntax, and field-specific integer
forms and ranges. There is no YAML host projection. Host selection reads the local preference only
for default mode. A command that needs full configuration still validates it before protected
work, including when a host is explicit.

The reader CLI is the engine command `config` (`engine/config.ts`):

```sh
celetis --agent <host> config CHECKOUT PLUGIN
```

It checks PLUGIN first: `PLUGIN/.claude-plugin/plugin.json` must be a regular file with no
symlink, with a JSON object whose `name` is `celetis`. Any other path exits 2 with a line that
names PLUGIN as no celetis plugin, and no field check runs. Then `readConfig(CHECKOUT)`
reads and validates the file, and `checkSkills` checks each `custom` key against
`PLUGIN/skills/<key>/SKILL.md` with `lstat`: a regular file with no symlink. It prints one compact
validated JSON object and LF. Invalid or missing configuration and a missing skill file exit 2
with empty stdout. Its diagnostic names the selected path and field; syntax and root errors
use `<document>`. Another form exits 2 with its usage line. `--agent` selects nothing. The
engine entry checks the Bun floor (`requireBun`) before it starts the command: a below-floor
Bun exits 3. Missing, broken, or nonexecutable Bun uses the native env/kernel diagnostic and
status. There is no interpreter wrapper. The engine owns its entry file `engine/celetis`.
Child Celetis processes use selected `process.execPath`, isolated
environment/config/preload/macro/package controls, disabled transpiler cache, and `DO_NOT_TRACK=1`.

The reader uses one private parsed source for metadata checks and JSON conversion. It checks
document, key, node, and style metadata before JSON conversion can remove YAML information.
JSON remains in memory. No generated config file is written.

The reader refuses invalid UTF-8. It refuses each character outside the printable set of
YAML 1.2, and U+0085, U+2028, and U+2029. A comment is no exception. These errors use
`<document>`. A plain value in the YAML 1.1 timestamp form, such as `2026-10-16`, is an error.
A plain value or key in a YAML 1.1 number form that YAML 1.2 reads as a string, such as `4_404`
or `0b101`, is an error too. Quote such a value to keep it as a string.

### Operation values and freshness

The engine entry imports its own modules and replaces its process with the named command before
configuration reads. On Windows, it spawns the command with the same stdio and environment,
waits, and exits with its status. The command consumes the forwarded `--agent`, validates its
arguments, and creates its operation. `daemon.ts` retains its process identity for lock-owner
checks.

`locateCheckouts(cwd)` in `engine/lib/command/operation.ts` resolves canonical active, main, and common
Git paths. A subfolder has its checkout's identity. When the Git directory equals the common
directory, the active top level identifies main, including a checkout with a separate Git directory.
For a linked worktree, Git's first worktree record must resolve to a main top level whose own Git
directory is that common directory. Git's `core.worktree` can supply this binding for a separate
Git directory. If Git cannot identify main, discovery fails before any configuration read.
It never uses an adjacent or parent directory as a policy source.

`createOperation(checkout, selection, required)`
captures these identities, the original selection inputs, derived `choice`, selected control host, and required validated
values. Its mode is `host`, `main`, or `active`, or a selector resolved once from the selected
host. `choice` is `{kind:'default'}` or `{kind:'explicit',host}`; saved Resume, `--agent`, and
explicit `CELETIS_AGENT` select explicit mode. `host` requires no YAML. `main` requires the main config; `active`
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
| New workflow step | Fresh main policy for resolution, gate choice, the lane test of auto mode (`autoLanes`), the `agents` preference and the `sessions` pin of the step, and session start; a fresh local order; original explicit and environment inputs retain precedence |
| Active-session monitoring | A separate fresh operation for status; the running session retains its captured host and exact ID; a config failure waits until that child exits |
| Target lane entry | Fresh main and lane validation before setup or acceptance of an existing setup marker |
| Configuration setup or test after a write | Fresh validation of the written or newly selected file |
| Landing start and protected actions after asynchronous work | Fresh policy and repository preflight before push, PR creation, check rerun, or merge |

The selected board port stays fixed while the board runs. An update restart requests that same
port exactly. A changed local order applies to the next new session, and a changed `agents`
field to the next new session of a run: a new step, or a recovery cycle of a step. A changed
`autoLanes` list applies at the next pick of auto mode and before the next new step of its run; a
recovery cycle of a started step has no lane test. A running
session keeps its agent, and exact Resume retains its saved host and ID. Each skill entry is a
native boundary of its own ("Skill entry"), independent of runtime operations.

Landing keeps the mechanism selected at its start. If the mechanism changed, it stops and
requires a new invocation. Invalid fresh configuration also stops it. Preflight rechecks checkout,
branch, captured tip and trunk SHAs, and PR identity where applicable. After green checks, it
refreshes again around the final checks and PR-identity wait before its SHA-bound merge.
Pushes remain non-forced and use captured SHAs. These boundaries give stable internal values,
not a filesystem transaction across checkouts or a transaction with GitHub.

## Start the board

The master daemon serves the board
([Start](https://github.com/ddinkov10/celetis/blob/main/engine/board/README.md#start)). At its start the daemon reads
the main config's `board.port`, default 4403, with the full validation of the config. **The port**
in [Start](https://github.com/ddinkov10/celetis/blob/main/engine/board/README.md#start) gives the
port search and the exact `PORT`. Use the actual URL that `celetis daemon start` or
`celetis daemon status` prints.

Each data refresh creates a fresh
main operation, so a change of `gates` shows at the next refresh ("Operation values and
freshness"). Each read of `/api/board` reads the local order, the usage records, and the
usage-limit waits again. At each press of Open agent or Make visual, the fixed adapter reads the
installed engine and builds a fixed argv with its command and no `--agent`. A Run or a queue
action with no agent choice gives the selection `{}` to the daemon, an explicit Run choice gives
`{"explicit":"<agent>"}`, and Resume has no agent and uses the saved host. No board config file is
made. The board start checks no replacement policy; the daemon run of each Run and Resume checks
it. The board can remain open during a manual update. The agent order of the Control screen reads and replaces the local
order through the `agents` command, with the version that it read; a stale version returns the
current order and writes nothing. A board Run choice applies only to that start; Resume
uses its saved host. See [the board document](https://github.com/ddinkov10/celetis/blob/main/engine/board/README.md#the-commands-of-the-board) for the refusal of each press.

A deterministic gate check does not replace live board acceptance. Stable installed resources,
changed-pair child controls on required CLI surfaces, managed Claude setup, and complete child
bootstrap keep their acceptance states in [Acceptance status](workflow.md#acceptance-status).
Native Codex desktop binding is separate optional evidence; a desktop limit does not block
otherwise complete required CLI checks. Active-surface validation and permission stops still
apply to each requested operation.

## Install Bun

Celetis commands need Bun 1.4.4 or later on `PATH`: the entry of the engine finds `bun` there.
CI pins Bun 1.4.4. The engine installs its locked dependencies, `zod`, `yaml`, and
`@modelcontextprotocol/server`, into its version folder at each install and update. The YAML parser
of the reader is the `yaml` package 2.9.1 of `engine/bun.lock`.

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
the engine from Git Bash, and the engine runs from Git Bash, PowerShell, and `cmd`.
[Acceptance status](workflow.md#acceptance-status) gives the Windows checks and the open ones.

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

## Agent selection and model setup

The local agent preference is an ordered list of one to three of `claude`, `codex`, and `opencode`. The list is unique and
nonempty; any host can be excluded. OpenCode runs only the step triage in this version, so the order skips it for another step. It lives at `<Git common directory>/celetis/agents.json`,
shared by the main checkout and all linked worktrees on this machine, and it changes no tracked
file. Its schema is exactly `{"schema":1,"order":["claude","codex"]}`. That is also the order with
no record: OpenCode starts excluded from default work. The three hosts are the agents of the agent
registry of the engine, in that order. For the record that setup writes, see `docs/setup.md`, "`setup write`".
YAML `host` is an unknown field; there is no migration. Check
selection with an explicit host:

```bash
celetis --agent codex root
```

Selection is an explicit `--agent claude|codex|opencode`, then an explicit `CELETIS_AGENT`, then, for a
step that a run starts, the preferred agent of that step, then the local order. An invalid host
value stops; the order of `PATH` never chooses a host. Control
operations use the first host of the local order without a quota check; outside a Git checkout
they use Claude. A default `land`, `dispatch`, `capscore`, or `setup` refuses when the first host
of the order cannot run it, while a step and an interactive session skip that host. The scripts
of the verify gate (`scripts/verify.ts`, `scripts/build.ts`, and `scripts/install-tools.ts`)
take `--agent`, else `CELETIS_AGENT`, else Claude, and read no order.
Explicit control commands and `agents` work without reading the preference for
selection. Commands that require YAML still validate the whole file. Skills pass their actual
host explicitly, including landing. Exact Resume keeps its saved host and session ID, and a
conflicting explicit host stops resume.

The `agents` field of the main `.celetis.yaml` names a preferred agent for each step that a run starts, for
example `implement: codex`. It is tracked repository policy: it applies on each machine and
changes through a commit, at the next new step. A default start of that step tries the preferred
agent first, then the other agents of the local order. A blocked preferred agent gives the next
agent with no wait. A step with no entry uses the local order. A local exclusion wins: a preferred
agent that the local order excludes has no effect, so a step preference selects its agent only when the order includes it. When this machine cannot start the preferred
agent (not installed or not signed in), the start stops at its preflight and tries no other
agent; exclude that agent from the local order to continue with the others.

A step session on Claude Code starts on the model of the `--model` of its start (the first session only), else of its `sessions` pin, else on the model that the step before decides, or else on the default `opus`, and a Codex step session keeps the model of its Codex config (`engine/README.md`, "The start of a step").

New Intake, Assist, and Make visual sessions use the first included host without an active
confirmed usage block. An explicit host remains pinned despite exclusion or a block.
`CELETIS_SESSION_AGENT` identifies the current native session; it does not select the next
host. A real incoming `CELETIS_AGENT` remains an explicit choice. The selected host still
runs its preflight; a missing executable or another setup error does not try a second host.

Usage records live separately at `<Git common directory>/celetis/limits/<host>.json`.
A passed provider reset permits a new attempt. It does not clear the recorded block.
An unknown observation keeps an existing block; a newer verified availability result can
clear it. If every included host is blocked, these independent launchers report the hosts
and known reset times without opening a session. A launched session keeps its native error
and recovery controls. Intake, Assist, and Make visual never transfer their conversation or
automatically start another host after exhaustion.

`celetis agents read` prints `{schema:1,order,version}`, with the digest of the canonical content
as `version`, and creates no record. To change the order, pass exactly `order` and that
`expectedVersion` to `celetis agents replace '<JSON>'`. A stale different edit exits 3 with
`{kind:"conflict",latest}`; an edit to the current order succeeds, also with an older version.
The version is not permission to write. A private preference lock serializes writers, with a
ten-second wait limit, and an atomic replacement keeps the old bytes on a failed write. Preference
writes leave the independent usage observations and attempt sequence intact. The record and the
lock must be private regular files, with no symbolic links. Their folder
`<Git common directory>/celetis` is shared daemon state: it must be a real directory of the
current user with no group or other write access, so an existing 0755 folder is accepted. A store
that creates it uses mode 0700. The record subfolders (`limits/`, `usage-captures/`,
`usage-sequences/`, `recovery/`, and `sessions/<n>/`) must be private (0700). Invalid or unsafe
records fail without replacement: preserve the file and correct its reported cause before
retrying. Both installed hosts retain separate installations and configuration.

`root` prints the version folder that holds the running engine.
`celetis update check` reports the enabled plugin of each host. Its Codex discovery uses a
short-lived app-server connection and `skills/list`, with no thread or model turn. A missing or
disabled installation is a `skipped` part; malformed or ambiguous installation data is an `error`
part.

A Codex profile is optional ("Fields and defaults"). For model tiers, supply the four-slot profile
and reviewer minimum in `docs/capability.md`, "Codex model profiles". Obtain the model IDs and
efforts from the active dispatch surface. Store its profile under `codexProfiles` in the main
config and pass the current runtime allowlist to each `capscore` call and each `dispatch` act that
issues a dispatch. A CLI catalog does not establish desktop dispatch support.
A missing pair or a tool that cannot apply the required pair stops the dependent work.

Complete the host's normal trust flow before a run. The daemon reports startup dialogs and leaves
them for the human.
