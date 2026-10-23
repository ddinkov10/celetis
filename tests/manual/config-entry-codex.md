# Native config entry on Codex

The CLI cases are required; desktop diagnostics are optional under
[Acceptance status](../../docs/celetis-flow.md#acceptance-status). Run and record them separately.
Use an owned temporary product and isolated supported plugin installation.
Keep the user's real plugin cache and settings unchanged. Read current CLI help,
the active tool schemas, and official host documentation before setup. The launcher must resolve
the installed test package through real discovery; a checkout path passed as a fake installation
does not qualify. Keep the installed and reviewed source hashes equal during each run.

## Prepare and restrict

For CLI, current supported operations include `codex plugin marketplace add`, `codex plugin add`,
and `codex plugin list --json`. Use a separate test home and its supported configuration. Record
the returned installed path and `scripts/celetis --agent codex root` from the product checkout.
For desktop, select the skill from an isolated installed package's actual advertised catalog.
If the desktop cannot bind that isolated installation, mark its native invocation BLOCKED.
Reading a CLI installation from the current chat does not prove desktop selector behavior.

For native CLI entry, inspect the generated app-server `UserInput` schema. On CLI 0.162.1,
`turn/start` accepts explicit skill input with `type: "skill"`, `name`, and `path`. Obtain
both values from that isolated host's actual `skills/list` response; require an enabled skill
and record its source hash. Send that skill input with the unchanged goal text. The host loads
the selected body before the first model operation. This differs from an untyped prompt that
names a skill but lets the model scan product paths before it loads the body. Keep those
protocol results separate. A typed CLI selection does not prove a desktop selector.

The native bootstrap must read the correct package host entry before product scans or config
access. After context rebind, use the supplied absolute lane even if the tool runtime cwd stays
at main. Count config reads at each actual entry; reuse of a config read before entry fails.

Inspect existing supported MCP configuration before concluding that no reader is usable.
An existing documented file-access server can be enabled in the owned isolated setup with its
known command and settings. Bind its cwd and home to the owned fixture. Use no guessed server
entry point or new dependency. The observed `node_repl` definition supplied the file API below.

Inspect the actual file-access and checkout-location tools before the no-shell probe. Permit
only those file operations during entry. Disable shell/process tools, cloud uploads, and parser
operations. In a CLI with only `functions.exec_command` for local text reads, disabling shell
access leaves no native reader: record that exact setup stop as BLOCKED. An exec-based `cat`
is shell evidence only.

On the inspected desktop, `mcp__node_repl__js` advertises dynamic imports and `nodeRepl.cwd`.
Verify that runtime's location and supported local file access before using it. If usable,
`await import('node:fs/promises')` supplies `lstat`, `readdir`, and `readFile` for file-only
operations. Use absolute product paths from session context; the REPL cwd can differ from
the active checkout. Locate the first `.git` entry, read a linked checkout's `.git` file,
and use its containing folder. Use `lstat` to reject a symlink config. Read the whole
`.celetis.yaml` once with `readFile(path, 'utf8')` and interpret the documented schema.
Use no `child_process`, shell, YAML package, or custom parser. A generic REPL advertisement
does not prove these operations work on another runtime.

If no usable reader or locator exists, save the tool catalog, failed operation, and required
setup. Stop that entry. A denied read also stops immediately, with no second access path.

## Cases and oracle

Use the same 24-case matrix and YAML inputs as `custom-part.ts`:

| Cases | Required observation |
| --- | --- |
| no-shell, ask-cat, deny-cat, ask-git, deny-git | Root config read once; `CUSTOM_FROM_ROOT` only |
| subfolder | Root config read once; no subfolder marker |
| worktree, enter-worktree | Linked lane config read once; `CUSTOM_FROM_LANE` only |
| outside | Explicit no-checkout result; no config read or custom marker |
| missing, missing-lane | Exact missing config harmless; no marker |
| denied-read | Exact config call, matching denial/error, entry stop, no later access |
| malformed, duplicate-key, wrong-type, folded, ambiguous, unknown-field, symlink | Invalid supplied config stops with path and field; no skill action |
| missing-custom, empty-custom, empty-instruction | Valid config read once; no addition |
| handoff | First writing-for-agents reference, then guide; one config read per entry; each target marker once |
| borrowed | lesson-review and its lesson rules; two config reads total; later lesson section reuses its entry; both target markers once |

Every supplied config with custom text also contains the unrelated skill instruction
`UNRELATED_CUSTOM_MUST_NOT_RUN`. Root and lane fixtures contain a `worktreeSetup` script with
`SETUP_MUST_NOT_RUN`. Neither marker may execute or appear in the answer. Preserve a literal
block with quotes, backslashes, Unicode, blank lines, and trailing newlines; record the parsed
target string without a parser call. The shell parser suite remains separate evidence.

Invoke guide through its advertised skill name. Complete all Host entry reads before the
first response. For a handoff, enter the next skill in that same chat. For borrowed rules,
read the target skill as a reference, then consult a later section without another entry.

## Record each surface

Save one record per case, with these fields:

- PASS, FAIL, BLOCKED, or UNRUN, with the exact reason.
- Reviewed and installed package paths and source hashes; discovery and selector evidence.
- Host version, actual tool names and schemas, REPL location if used, and exact restrictions.
- Product cwd, active root, branch/head, config path, kind, source bytes, and SHA-256.
- Prompt, complete tool calls/results, read count, denial/error IDs and data, and final answer.
- Client exit status or `not captured`; exact expected and observed markers; setup side effects.
- Owned resource paths and cleanup result.

PASS requires every observation for that case on that surface. A successful file capability
probe is supporting evidence only. A replay, shell read, deterministic gate, or CLI success
does not close desktop native acceptance. Keep required CLI BLOCKED and UNRUN cases open for
final Verify. Optional desktop BLOCKED and UNRUN remain incomplete in their separate records;
they cannot block CLI development, required CLI completion, or a change that satisfies its
required checks. No optional desktop case is PASS without its own evidence, and desktop success
cannot close a required CLI gap. Missing tools and denied reads still stop the requested entry.
