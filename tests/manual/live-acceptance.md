# Live acceptance

Use this procedure after the deterministic gate and independent code review. Required automation
acceptance covers Claude Code and Codex TUI/CLI under
[Acceptance status](../../docs/celetis-flow.md#acceptance-status). Codex desktop automation is an
optional diagnostic. A shell fixture, a direct-file model test, and a native desktop invocation
prove different operations. Record each surface separately.

## Prepare the fixture

1. Record the reviewed plugin commit, its tracked-file hashes, the installed package path and
   hashes, and runtime versions. The plugin commit is also the board commit. Read the current host
   tool schema and CLI help. Use the installed package for native entry and runner acceptance.
2. Use an owned private disposable product repository with real issues, branches, PRs, and CI.
   Keep a separate repository or checkout for each concurrent scenario. A board fixture whose
   instructions reserve all changes to its controller can test board recovery only. Prepare an
   independent fixture for full lanes; keep the board fixture's restrictions intact.
3. Record the fixture's allowed files, repositories, issues, commands, and test landing boundary.
   Read its instructions, hooks, permissions, and source before normal folder or hook trust.
   Use only the supported setup flow. Keep authentication and profile changes with their owner.
4. Start with a working product and a real verify gate. Define the expected output and exit
   status of each scenario before implementation. CI must exercise the same behavior. Record
   setup commits separately from implementation commits. A deliberate failure needs an oracle
   independent of the agent's proposed fix.
5. Record each preapproved fixture input and its actual human authorization source. General
   permission to run tests is not approval of a later written spec or proof of a human action.
   At an unresolved decision, retain the waiting state and collect evidence of that state.
6. Run the Claude Code reference and Codex TUI/CLI on each applicable required scenario below.
   Give each run its own issue and evidence directory. Keep the expected states, artifacts, and
   cleanup criteria equal. A denied operation, quota limit, or missing native control blocks
   that test; continue independent cases. Record optional desktop diagnostics separately.

For herdr tests, create an owned named session and controller pane. Verify real `HERDR_ENV=1`
inside that pane before controls. Start the board there on an unused local port.
Use its real browser actions. Record the returned pane identities; control only owned panes.

For the single-config cutover, the board start is `scripts/celetis --agent <agent> board` in the
fixture main checkout. The adapter must run `board/cli.ts` of the installed plugin with
`--config-stdin`; keep the plugin commit, input, stdout/stderr, HTTP producer data, and port.
Test main and subfolder startup, lane refusal before board startup, malformed config, external/lane
executable refusal, default/configured ports, inherited `PORT`, and absence of a second config file.
Check that the agent menu and command palette show the default as read-only and expose the
reason by pointer and keyboard. They must send no setter request. A valid trusted `POST /api/agent`
must return 409 with `The producer controls the default agent. Change it in the producer configuration.`
Keep tracked YAML, all local Git settings, and the producer default unchanged. Before a YAML edit,
check that an unqualified Run still uses the original default.
Exercise actual Run for each explicit agent and Resume after changing YAML `host`; retain the
session record, exact session/pane IDs, checkout, selected host, shared lock, and closed port after
cleanup. Deterministic host fixtures and stdin checks do not close the real action row.
Before landing, require the maintainer's readiness report for the
[manual product replacement](../../docs/configuration.md#replace-the-old-setup) and stopped old runners.

## Model suites and saved results

These commands use model tokens. Run them only when the selected host can accept the work.
Use the selected Bun executable on PATH:

```bash
BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 bun --no-env-file --no-install --config=/dev/null --no-macros tests/manual/step-prompt.ts \
  --agent claude --output-dir <new-evidence-directory>
BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 bun --no-env-file --no-install --config=/dev/null --no-macros tests/manual/step-prompt.ts \
  --agent codex --output-dir <new-evidence-directory>
BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 bun --no-env-file --no-install --config=/dev/null --no-macros tests/manual/custom-part.ts \
  --output-dir <new-evidence-directory>
```

The step suite has 25 cases. The native Claude custom suite has 24 cases. Capture the command,
client version, suite exit status, and complete stdout/stderr separately from their case files.
The custom suite saves each exact prompt, tools, settings, checkout, plugin path, event stream,
stderr, config source bytes and hashes, installed source hashes, runtime version, and client
exit status, including on failure. It keeps 97 generated artifacts after a complete run.
Save generated fixture data only. Run the required CLI native YAML probes and record any optional
desktop probes separately in
[config entry on Codex](config-entry-codex.md), with their actual tools and isolated installations.

For Claude, the isolated package includes the native entry module. Load the passive observer
from the owned acceptance fixture with its source hashes. It observes normal native metadata,
Read calls/results and permission decisions without changing them. Its system/ui_log records
carry native IDs, exact paths, metadata and compact complete-content SHA256 values. Match each
result to its earlier call and compare content hashes with the retained package/config bytes.
Reject missing, fabricated, wrong-path or late records. A model's output or an entry-data marker
is no read proof. Keep every actual assistant TextBlock in timing checks.
No MCP server, global installation, output style or system-prompt override is needed. Missing
native hook capability is a normal setup block. Missing config has zero content reads; a symlink
has zero content reads. The 24 cases still produce 97 artifacts.
The borrowed case uses explicit initial Skill selection as a reference, with no procedure.
A native `file_unchanged` result is valid only after a matching prior successful whole-file
result; each entry still makes its own exact full `Read` request. Static host operations may
be reused for borrowed references. Count target markers across assistant text without counting
the final result's mirrored text twice.
The EnterWorktree case keeps one CLI process. A first user turn enters the actual lane;
after its successful native result, a second user turn starts with `/celetis:guide`. Keep both
SDKUserMessage inputs in the case input and both result events with the same session ID.
Match the successful native call/result and returned `worktreePath` to the current binding.
The hook uses the current native root and validates its Git boundary; an old cwd string,
mismatched, failed, or stale binding does not select the checkout. Config metadata still precedes
its full `Read`. The tool cwd can remain at main; all entry paths must name the returned lane.
The native input adds one test recording instruction: emit actual `lstat` results as JSON with
absolute path and boolean `file`, `directory`, and `symlink` fields from that result's methods;
an actual ENOENT records path and code. It adds no expected root, marker, operation, or response rule.
The native hook uses `fs.stat`, so that old recording request supplies no evidence by itself.
The passive observer must record actual metadata results or native rejections at their exact paths.

For checker-only changes, compare hashes of the old and current model inputs before reusing
saved results. Compare the quoted skills, host references, step text, and applicable project
instructions too. Replay unchanged answers, events, and statuses through the current checker.
Use local fault fixtures to prove rejection of unsafe answers. Call the result a replay.
Changed model inputs require the complete final suite on the affected host. Keep every earlier
failed, blocked, and interrupted run; use a new directory for each later run.

Native denied-read evidence needs a file-read call at the exact active `.celetis.yaml` path, its matching error
result with specific permission-error text, and no later tool call. Keep a separate native denial
record when the host emits one; a matching observer-proven native Read error is also evidence.
A final answer that says it could
not read a file does not establish those facts. Keep host-specific IDs and denial formats.
A no-shell probe must explicitly name its
permitted file-read tool. If access is denied, retain the denial and stop that operation.

## Scenario oracles

For each row, record the required surfaces independently. Use the current skills and host
references for the step order. Only the shared landing script may perform a fixture landing.

| Scenario | Surfaces | Required observations |
|---|---|---|
| Feature from intake to landing | Claude Code, Codex TUI/CLI | Approved written spec in the issue body; latest Plan; task gates and independent reviews; all Verify scenarios pass; landed trunk commit; closed issue; cleanup |
| Bug, chore, hotfix | Claude Code, Codex TUI/CLI | Each lane's labels, artifacts, and step order; meaningful verify result; landing; lane and prototype cleanup |
| All 19 skills and helpers | Claude Code regression, Codex TUI/CLI | Installed inventory matches the repository; representative output or artifact for every skill; native invocation where required; guide and setup run only on explicit human invocation; Codex lists `celetis:setup` in a project with no `.codex/` folder |
| Scope split, spike, rejected design | Codex TUI/CLI | Real epic/child or issue state; correct worktree and prototype retention or removal; approval waits remain intact |
| Custom text and handoffs | Claude Code, Codex TUI/CLI | Whole active `.celetis.yaml` read once per entry; only target custom string applied; no setup; missing config/custom harmless; invalid or ambiguous config stops; distinct root/lane/subfolder markers; direct, borrowed, and handed-off rules; exact denied-read stop without another access path |
| Task gate failure and repair | Codex TUI/CLI | First failure at an independent meaningful oracle; same implementer repair; scoped independent re-review; unchanged oracle; final PASS |
| CAP floor, escalation, STOP | Codex TUI/CLI | Requested and actual model/effort from runtime evidence; floor applies; changed pair reaches the same child when supported; attempt 4 hands off and stops before landing |
| Waiting decision or permission | Interactive Codex TUI/CLI, herdr | Real waiting prompt and blocked card; unchanged issue state; no watcher exit; no guard bypass; record foreground lifetime |
| Interrupt, no progress, exact resume | Claude Code and Codex TUI/CLI through runner and board | Saved non-null record from a current turn; actual interruption and no-progress results; same host, ID, and checkout on resume; no duplicate issue lock |
| Red CI, unrun Verify, human precondition | Codex TUI/CLI | Separate cases for each cause; correct stopped or built markers; no early merge; current human completion evidence when required; re-entry keeps the completed build |
| Both landing mechanisms | Codex TUI/CLI | Same verified trunk result through each supported mechanism; actual PR checks where required; lane/prototype cleanup; shared landing script used |
| Approved update and retained installed package | Claude Code, Codex TUI/CLI | Read-only exact offer once per human task; direct native user reply; one consumed target-bound attempt; refusal on unsafe policy or lifetime boundary; no startup update; cleanup before unlock; fresh discovery and exact Resume keep identity after a supported successful cutover |
| Cross-host Plan handoff | Claude Code to Codex TUI/CLI, Codex TUI/CLI to Claude Code | Same spec, Plan, and issue; published CAP digits resolve on the receiving host; verified landing; record the receiving Codex surface |
| Resume and compaction | Codex TUI/CLI | Step/custom rules persist; exact saved identity; ledger and issue recovery preserve finished work; no repeat build |
| Board actions | The board of the installed plugin and herdr, Claude Code and Codex TUI/CLI | Real Run, Resume, Go, Open shell; exact issue/session/pane association; actual waiting, active, and recovery cards |

For update tests, retain the actual native user reply, exact offer, consumer exit and complete
lifetime evidence, command output, and fresh discovery under [Updates](../../README.md#updates).
Current apply refuses on both observed hosts and all Codex consumer starts refuse the unsafe
native automatic refresh policy. Deterministic fixtures prove check/action oracles and cleanup;
they do not authenticate a real human or prove a successful native cutover. Those live scenarios
were explicitly skipped for this completion. No real installation was updated. Stop a future
explicitly authorized isolated diagnostic at its first failed assertion and mark later assertions
unrun.

For failure and re-entry tests, save the old and new heads, oracle output, labels, issue events,
and check results. A missing label alone is not human completion evidence. Keep deliberately
red CI separate from a failed local task gate so that each cause has its own observation.

## Optional Codex desktop diagnostics

The shared flows remain available for manual or inline desktop invocation. Any desktop scenario
or native config probe uses a separate PASS, FAIL, BLOCKED, or UNRUN record. Use the same applicable
observations above without making desktop a required surface.

For native desktop tests, use the actual installed selector and collaboration controls. Save
their native results and the applied model/effort. Direct-file CLI reads and a supported CLI
same-ID model change prove only their recorded CLI scope. Record each desktop operation's native
result or exact limitation; an unattempted operation is UNRUN. A missing tool or denied
read still stops that requested operation. Optional desktop BLOCKED or UNRUN remains incomplete
without blocking CLI development, required CLI acceptance, or a change that meets its required
checks. Optional desktop PASS cannot close a required CLI gap, including resource lifetime or
changed-pair same-child repair.

## Evidence and cleanup

Each row/surface record needs the reviewed and installed source hashes, runtime versions,
authorization source, command or UI action, exit status, issue/PR URLs, branch/head, observed
issue events, checks, session and pane IDs, saved records, and cleanup result. Save screenshots
for UI state and the corresponding underlying state when available. Use `not captured` for a
missing exit status; never infer it from a closed pane.

Use PASS only when every required observation exists for that row and surface. Use FAIL for
an observed contract violation, BLOCKED for a concrete precondition or unavailable operation,
and UNRUN for an unattempted scenario. List narrow passing checks as supporting evidence under
an incomplete row. A checker PASS, code review, or deterministic gate cannot close live rows.

End owned clients before removing their profile or scratch files. Verify foreground exit
before lock release, inspect any stale owner, and release only a matching owned stale lock.
Stop the owned board/controller/server, close its browser tab and panes, and check the port.
Retain failed outputs and required fixture repositories. Report every retained resource and its
owner. Publish no full CLI acceptance claim while a required CLI row or surface remains open.
