# Repository configuration

Store Celetis setup in one regular, readable `.celetis.yaml` at the checkout root. A symlink is
not allowed. Do not search parent folders or combine files. Use one YAML 1.2 document with a
mapping root. Comments are allowed.

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
| `worktreeSetup` | One Bash script string | No setup |
| `custom` | Mapping from a Celetis skill stem to an instruction string | No addition for an omitted skill |
| `codexProfiles` | Mapping from a runtime identity to its profile | None |

The allowed gate names are `triage`, `specify`, `bug`, `chore`, `hotfix`, `plan`, and
`implement`. No other step is accepted. An empty `gates` mapping uses `me` for all seven.
An empty `board` mapping uses port 4403. `PORT` takes precedence over the configured board port.

The allowed custom keys are `bug`, `chore`, `critic-loop`, `doc-drift-sync`, `feature`,
`guide`, `hotfix`, `implement`, `intake`, `lesson`, `lesson-review`, `plan`,
`polishing-code-comments`, `prototype`, `record-architecture-decisions`, `specify`,
`triage`, and `writing-for-agents`.
An empty setup string runs no setup. An empty instruction string gives no addition.
An empty `custom` or `codexProfiles` mapping is valid.

Host selection is `--host`, then `CELETIS_HOST`, then the main config's `host`, then
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
effort evidence from the active dispatch surface. There is no default or bundled profile.
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
its setup marker. An unmarked lane runs setup once and receives the marker only after success.
A setup failure or invalid new lane config uses the existing cleanup: remove the new worktree
and a branch created by the command; keep an existing branch or worktree for repair and retry.
Git settings `celetis-flow.host` and `celetis-flow.gate.<step>` have no effect.

Use the main checkout for `host`, `landing`, `gates`, `board`, and `codexProfiles`.
Use the new lane checkout for setup. At each skill entry, use `custom.<skill>` from the active
checkout. With no checkout or no config, optional skill entry has no custom addition.
An existing invalid or unreadable config stops entry. A denied read has no alternate read path.
Commands that need repository setup require a valid file.

## Validation and reader interface

Unknown fields are errors at every level. Supplied null values, wrong types, invalid enum
values, duplicate keys, non-string keys, aliases, merge keys, custom tags, and non-JSON YAML
values are errors. Only the standard map, sequence, string, null, Boolean, integer, and float
tags can pass the parser check; the field schema then limits each value. Non-finite numbers
are not accepted. Script and instruction strings cannot contain NUL.
Plain `yes` and `on` are strings under YAML 1.2.

Source `scripts/celetis` to use these functions without starting installation discovery:

- `celetis_config_main` prints the absolute main checkout path. A failed Git lookup returns
  a nonzero status.
- `celetis_config_read CHECKOUT` reads only `CHECKOUT/.celetis.yaml`. It prints one compact,
  validated JSON object. It does not insert defaults, select a host, or execute text.
  An invalid or missing config returns status 2 with empty stdout. Its diagnostic names the
  selected file and field; syntax and root errors use `<document>`.

The reader uses one private YAML snapshot for metadata checks and JSON conversion. It checks
document, key, node, and style metadata before JSON conversion can remove YAML information.
JSON remains in memory. No generated config file is written.

## Install the parser

Shell readers need [Mike Farah's yq](https://github.com/mikefarah/yq) `>=4.54.1,<5` on
`PATH`, together with `jq`. Another implementation named `yq` is not accepted.
The plugin does not install dependencies. CI and these machine instructions pin
[release v4.54.1](https://github.com/mikefarah/yq/releases/tag/v4.54.1).

Select the release asset for the machine:

| Platform | `asset` value |
| --- | --- |
| macOS, Apple Silicon | `yq_darwin_arm64` |
| macOS, Intel | `yq_darwin_amd64` |
| Linux, x86-64 | `yq_linux_amd64` |
| Linux, ARM64 | `yq_linux_arm64` |

Set `asset` to that value, then run:

```bash
asset=yq_darwin_arm64
mkdir -p "$HOME/.local/bin"
curl --fail --location --output "$HOME/.local/bin/yq" \
  "https://github.com/mikefarah/yq/releases/download/v4.54.1/$asset"
chmod +x "$HOME/.local/bin/yq"
export PATH="$HOME/.local/bin:$PATH"
yq --version
```

The last command must print:

```text
yq (https://github.com/mikefarah/yq/) version v4.54.1
```

The parser behavior is documented in the official
[YAML conversion](https://mikefarah.gitbook.io/yq/usage/convert),
[key metadata](https://mikefarah.gitbook.io/yq/operators/keys),
and [document index](https://mikefarah.gitbook.io/yq/operators/document-index) references.
[YAML 1.2.2](https://yaml.org/spec/1.2.2/) defines literal block behavior.
