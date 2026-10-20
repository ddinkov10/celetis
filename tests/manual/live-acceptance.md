# Live acceptance

Use this procedure after the deterministic gate and independent code review. It tests the
shared workflow on Claude, Codex CLI, and Codex desktop. A shell fixture, a direct-file model
test, and a native desktop invocation prove different operations. Record each surface separately.

## Prepare the fixture

1. Record the reviewed plugin commit, its tracked-file hashes, the installed package path and
   hashes, runtime versions, and the exact released board tag and commit. Read the current host
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
6. Run the Claude reference and both Codex surfaces on the same scenario behavior. Give each
   run its own issue and evidence directory. Keep the expected states, artifacts, and cleanup
   criteria equal. A denied operation, quota limit, or missing native control blocks that test;
   continue independent cases.

For herdr tests, create an owned named session and controller pane. Verify real `HERDR_ENV=1`
inside that pane before controls. Start the released board there on an unused local port.
Use its real browser actions. Record the returned pane identities; control only owned panes.

## Model suites and saved results

These commands use model tokens. Run them only when the selected host can accept the work:

```bash
PATH="/bin:$PATH" /bin/bash tests/manual/step-prompt.test.sh \
  --agent claude --output-dir <new-evidence-directory>
PATH="/bin:$PATH" /bin/bash tests/manual/step-prompt.test.sh \
  --agent codex --output-dir <new-evidence-directory>
PATH="/bin:$PATH" /bin/bash tests/manual/custom-part.test.sh \
  --output-dir <new-evidence-directory>
```

The step suite has 21 cases. The native Claude custom suite has 12 cases. Capture the command,
client version, suite exit status, and complete stdout/stderr separately from their case files.
The custom suite saves each exact prompt, tools, settings, checkout, plugin path, event stream,
stderr, and client exit status, including on failure. Save generated fixture data only.

For checker-only changes, compare hashes of the old and current model inputs before reusing
saved results. Compare the quoted skills, host references, step text, and applicable project
instructions too. Replay unchanged answers, events, and statuses through the current checker.
Use local fault fixtures to prove rejection of unsafe answers. Call the result a replay.
Changed model inputs require the complete final suite on the affected host. Keep every earlier
failed, blocked, and interrupted run; use a new directory for each later run.

Native denied-read evidence needs a Read call at the exact custom path, its matching error
result and permission-denial record, and no later tool call. A final answer that says it could
not read a file does not establish those facts. A no-shell probe must explicitly name its
permitted file-read tool. If access is denied, retain the denial and stop that operation.

## Scenario oracles

For each row, record the required surfaces independently. Use the current skills and host
references for the step order. Only the shared landing script may perform a fixture landing.

| Scenario | Surfaces | Required observations |
|---|---|---|
| Feature from intake to landing | Claude, CLI, desktop | Approved written spec in the issue body; latest Plan; task gates and independent reviews; all Verify scenarios pass; landed trunk commit; closed issue; cleanup |
| Bug, chore, hotfix | Claude, CLI, desktop | Each lane's labels, artifacts, and step order; meaningful verify result; landing; lane and prototype cleanup |
| All 19 skills and helpers | Claude regression, CLI, desktop | Installed inventory matches the repository; representative output or artifact for every skill; native invocation where required; guide and setup run only on explicit human invocation |
| Scope split, spike, rejected design | CLI, desktop | Real epic/child or issue state; correct worktree and prototype retention or removal; approval waits remain intact |
| Custom text and handoffs | Claude, CLI, desktop | Each appropriate file read once at its entry; missing file harmless; distinct main/lane markers; direct, borrowed, and handed-off rules; denied-read stop |
| Task gate failure and repair | CLI, desktop | First failure at an independent meaningful oracle; same implementer repair; scoped independent re-review; unchanged oracle; final PASS |
| CAP floor, escalation, STOP | CLI, desktop | Requested and actual model/effort from runtime evidence; floor applies; changed pair reaches the same child when supported; attempt 4 hands off and stops before landing |
| Waiting decision or permission | Interactive CLI, desktop, herdr | Real waiting prompt and blocked card; unchanged issue state; no watcher exit; no guard bypass; record foreground lifetime |
| Interrupt, no progress, exact resume | Both hosts through runner and board | Saved non-null record from a current turn; actual interruption and no-progress results; same host, ID, and checkout on resume; no duplicate issue lock |
| Red CI, unrun Verify, human precondition | CLI, desktop | Separate cases for each cause; correct stopped or built markers; no early merge; current human completion evidence when required; re-entry keeps the completed build |
| Both landing mechanisms | CLI, desktop | Same verified trunk result through each supported mechanism; actual PR checks where required; lane/prototype cleanup; shared landing script used |
| Update, failed refresh, long-lived runner | Both hosts | Next step uses new content; failure retains its cause and stops before launch; updater cleanup before unlock; active resources keep their promised content and path lifetime |
| Cross-host Plan handoff | Claude to Codex, Codex to Claude | Same spec, Plan, and issue; published CAP digits resolve on the receiving host; verified landing; record the receiving Codex surface |
| Resume and compaction | CLI, desktop | Step/custom rules persist; exact saved identity; ledger and issue recovery preserve finished work; no repeat build |
| Board actions | Released board and herdr, both hosts | Real Run, Resume, Go, Open shell; exact issue/session/pane association; actual waiting, active, and recovery cards |

For update tests, inspect the old advertised skill path while its session remains alive. Check
both its bytes and continued existence. A versioned directory name alone proves neither.
Stop a diagnostic at its first failed assertion and mark all later assertions unrun.

For failure and re-entry tests, save the old and new heads, oracle output, labels, issue events,
and check results. A missing label alone is not human completion evidence. Keep deliberately
red CI separate from a failed local task gate so that each cause has its own observation.

For native desktop tests, use the actual installed selector and collaboration controls. Save
their native results and the applied model/effort. Direct-file CLI reads and a supported CLI
same-ID model change are useful evidence for their own scope. Desktop fields remain open until
the native operation is observed or its exact limitation is recorded.

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
owner. Publish no full acceptance claim while a required row or surface remains open.
