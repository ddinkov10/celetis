# Repository configuration

Store Celetis setup in one regular, readable `.celetis.yaml` at the checkout root. A symlink is
not allowed. Do not search parent folders or combine files. Use one YAML 1.2 document with a
mapping root. Comments are allowed.

This repository uses:

```yaml
host: claude
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
| `worktreeSetup` | One Bash script string | No setup |
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
  set -e
  printf '%s\n' "$1"
custom:
  bug: |-
    Keep the change small.
```

The setup script runs in one Bash process in the new lane checkout. Its first positional
argument is the main checkout. Its output goes to stderr and its exit status decides success.
Reading the config or entering a skill does not execute setup. Shell consumers that extract
text use `jq -jr` and a sentinel because command substitution removes trailing newlines.
The worktree command removes exactly the sentinel and runs
`bash -c "$setup" celetis-worktree-setup "$main"`. The script keeps inherited stdin, so `read`
can receive terminal input. An omitted or empty script runs no setup.

The main config is checked before Git prune, branch or worktree changes, runtime state creation,
plugin updates, host sessions, and landing pushes. The runner checks it again before each new
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

Native skill entry reads the whole file once through the running host's supported file tools,
then interprets this schema and applies only `custom.<skill>`. Keep the parsed string intact.
Other custom strings and `worktreeSetup` remain data. Entry executes no setup and invokes no
shell or new parser operation. An ambiguous interpretation stops with the selected
file and field. A native read is not a deterministic parser PASS. The shared
[host entry](hosts/entry.md) owns the exact-once rule for handoffs and borrowed references.

## Validation and reader interface

Unknown fields are errors at every level. Supplied null values, wrong types, invalid enum
values, duplicate keys, non-string keys, aliases, merge keys, custom tags, and non-JSON YAML
values are errors. Only the standard map, sequence, string, null, Boolean, integer, and float
tags can pass the parser check; the field schema then limits each value. Non-finite numbers
are not accepted. Script and instruction strings cannot contain NUL.
Plain `yes` and `on` are strings under YAML 1.2.

Source the launcher of the plugin, `$(scripts/celetis root)/scripts/celetis`, to use these
functions. The source itself starts no installation discovery.

- `celetis_config_main` prints the absolute main checkout path. A failed Git lookup returns
  a nonzero status.
- `celetis_config_read CHECKOUT` reads only `CHECKOUT/.celetis.yaml`. It prints one compact,
  validated JSON object. It does not insert defaults, select a host, or execute text.
  An invalid or missing config returns status 2 with empty stdout. Its diagnostic names the
  selected file and field; syntax and root errors use `<document>`.

The reader is `scripts/lib/config.ts` of the plugin, and it runs on Bun. With no `bun` on
`PATH`, or with a Bun older than 1.4.2, `celetis_config_read` returns status 2 and names the
floor. A copy of the launcher in a product project has no reader beside it. When a script
sources that copy, `celetis_config_read` returns status 2 with a line that names the launcher
of the plugin.

The reader uses one private YAML snapshot for metadata checks and JSON conversion. It checks
document, key, node, and style metadata before JSON conversion can remove YAML information.
JSON remains in memory. No generated config file is written.

The reader refuses invalid UTF-8. It refuses each character outside the printable set of
YAML 1.2, and U+0085, U+2028, and U+2029. A comment is no exception. These errors use
`<document>`. A plain value in the YAML 1.1 timestamp form, such as `2026-10-16`, is an error.
A plain value or key in a YAML 1.1 number form that YAML 1.2 reads as a string, such as `4_404`
or `0b101`, is an error too. Quote such a value to keep it as a string.

Before it finds the plugin, the launcher of a product project reads only `host` of the main
config. It reads `host` only when neither `--agent` nor `CELETIS_AGENT` names the host.
After it finds the plugin, the reader of the plugin checks the whole main config before
`worktree`, `celetis-flow`, `next-step`, `land`, and `board`.

## Start the board

Run `scripts/celetis board` in the main checkout or a subfolder. It takes no arguments and
refuses a lane start before `node`. It reads only the main config's `board.port`, default 4403,
and keeps `PORT` above that value. It supplies the fixed data, selected-agent Run, and
saved-host Resume lists through stdin to `board/cli.mjs` of the installed plugin. The board
validates that JSON and its executable paths. No board config file is made.
The board displays the producer default as read-only. Change `host` in the main YAML to set
the project default. A board Run choice applies only to that start; Resume uses its saved host.
See [the board contract](celetis-flow.md#the-board) for the exact lists.

## Replace the old setup

This is a manual cutover. Each push to the plugin trunk reaches product projects at their next
runner refresh. The maintainer must prepare every affected product project and stop its old
sessions, runners, and boards before the plugin lands. Keep the change unlanded until the
maintainer gives a trusted readiness report for this build. This lane changes no other project.

1. Install Bun 1.4.2 or later on each machine and CI job that runs a shell consumer, using
   the instructions below. Keep `jq` on `PATH`.
2. Review each old input and prepare one `.celetis.yaml` in that product's main checkout:

   | Old input | Replacement |
   | --- | --- |
   | Git `celetis-flow.agent` or `celetis-flow.host` | Optional YAML `host`. Keep the intended new-step default. |
   | Git `celetis-flow.gate.<step>` and `.claude/celetis-flow/gates.json` | YAML `gates.<step>`. Write each intended `auto`; omitted steps now use `me`. |
   | `.claude/celetis-flow/landing.json` | Required YAML `landing`. |
   | `.claude/celetis-flow/board.json` | YAML `board.port` only. The adapter supplies all three fixed command lists. |
   | `.claude/celetis-flow/worktree-setup.sh` | Complete script body in a literal `worktreeSetup` string. It still runs in one lane Bash process with main as `$1`. |
   | Each `.claude/celetis-flow/custom/<skill>.md` | Complete instruction text in `custom.<skill>`, with its parsed line breaks and trailing newlines. |
   | Each repository-owned `--profile` or `CAP_MODEL_PROFILE` JSON input | Its `slots` and `reviewer` under `codexProfiles.<runtime>`. Use the matching runtime identity as the key; omit the old `schema` and `runtime` fields. |

   Use `|`, `|-`, or `|+` to preserve the required script and instruction strings. Check each
   profile against the active dispatch surface's current model/effort allowlist. Supply no
   placeholder or bundled model defaults. Explicit profile files remain available for one-run
   or standalone scoring; remove a persistent override when the main YAML should own selection.
3. Copy the changed standalone `scripts/celetis` from the reviewed plugin package. A plugin
   refresh does not update that product file. The public controls are `--agent` and
   `CELETIS_AGENT`; YAML and saved session records still use the key `host`.
4. Remove the old Celetis setup files and obsolete Git defaults after their values are accounted
   for. Keep native `.claude/settings.json`, `.codex/config.toml`, `.codex/rules/`, project
   instructions, records, runtime state, and the setup marker. If a native desktop board entry
   exists, point it at `scripts/celetis board` and match its preview port to the YAML value.
5. Commit the product's replacement files on its trunk, review the required live results, and
   report readiness before the plugin landing. After the coordinated refresh, restart its
   sessions, runners, and boards. Test both Run agents and Resume with an existing exact record.

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

Shell readers need Bun 1.4.2 or later on `PATH`, together with `jq`. The plugin does not
install dependencies. CI pins Bun 1.4.2. The YAML parser of the reader, the `yaml` package
2.9.1, comes with the plugin in `scripts/lib/vendor/`, so a read installs no package.

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

On a Windows host, run this command in PowerShell. A session by hand then runs the scripts in
Git Bash.

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
