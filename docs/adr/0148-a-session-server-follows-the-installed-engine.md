# A session server follows the installed engine

## Date

2026-11-26

## Related

- [Issue #396](https://github.com/ddinkov10/celetis/issues/396): the spec (the body of the issue, `Spec: 2026-11-26`), and the
  [plan comment](https://github.com/ddinkov10/celetis/issues/396#issuecomment-7203512591). In this record, "approach A", "approach B",
  and "approach C" name approaches of that spec, and "the start engine" is the engine of the version folder that the server
  started from.
- [ADR-0125](0125-each-agent-form-is-an-mcp-tool-that-runs-the-cli.md): the tools and their server. This record keeps its
  tool list, its schemas, its guard, its `read` values, its manifest `timeout`, and the rest of its child process: the
  launcher entry, `--agent <host>`, no shell, no stdin, `checkout` as the working folder, and `childEnv`. Its alternative
  "A server that runs the CLI that `PATH` finds" was rejected for a reason of its time: the schemas of a session would
  describe one revision and the forms that they run another. The contract guard of Decision 3 answers that reason, and the
  pick of Decision 1 reads no `PATH`. The second sentence of that alternative restates the sentence of Decision 4 that this
  record replaces, and it stays as the reason of its time.
- [ADR-0090](0090-a-contract-version-replaces-the-same-revision-rule.md): the contract version and its digest. The guard
  of this record uses them. Decision 1 of that record fixes the shape of the file and names its old path
  `engine/lib/contract-versions.json`. After the layout move of
  [ADR-0114](0114-the-engine-library-groups-its-files-into-feature-folders.md), the file is
  `engine/lib/contract/versions.json`. The shape stays (Decision 4 of this record).
- [ADR-0092](0092-the-check-for-a-removed-version-folder-reads-the-engine-entry.md): `versionFolderGone` and its
  seven sites. Each decision of that record stays. The pick reads `versionFolderGone` for the start folder.
- [ADR-0146](0146-codex-support-stays-as-it-is-until-the-maintainer-resumes-it.md): Codex support is deferred. The server
  serves both hosts, but this record adds no Codex work and no Codex check.
- ADR-0073 ("After `celetis update`, each runner form refuses until the maintainer restarts the daemon"), ADR-0076
  ("After `celetis update`, the maintainer restarts the daemon"), ADR-0077 (the terminal restart), ADR-0078 ("The landing needs a running
  daemon of the same revision"), and ADR-0124 ("A daemon of another revision still gives exit 3"): each stays true. A form of the installed engine refuses with exit 3
  until the daemon restarts. The refusal of a caller that is not the installed engine names another act (Decision 6).
- [ADR-0042](0042-one-celetis-program-for-both-hosts.md), "The runner check", compares the revision of the plugin with its
  own revision (`requireSameRevision`). ADR-0090 replaced that check. This change does not touch it.

## Supersedes

Only these clauses change. The records keep their historical text and evidence.

- [Each agent form is an MCP tool that runs the CLI](0125-each-agent-form-is-an-mcp-tool-that-runs-the-cli.md), in part:
  - "Decision", item 4: the words "`<root>/engine/celetis` of its own engine", and the sentence "The server runs the CLI of its
    own revision, so the schemas and the forms that they run come from one revision." The tool list and its schemas still
    come from the start revision. Each call runs the engine that `pickEngine` picks (Decision 1). The rest of item 4 stays.
  - "Consequences", the bullet "An update can remove the version folder of a running engine. The tools of that session
    answer with code 3 until a fresh session starts." A call runs the installed engine when it serves the start entry. The
    tools answer with code 3 only when the pick finds no engine to run (Decision 1, steps 1 and 5).
  - "Supersedes", the item on the check for a removed version folder, the sentence "it reads `versionFolderGone` before each start, and it gives code 3
    and its own line". The pick reads `versionFolderGone` in step 1 and in step 4 only. It gives code 3 with one of the
    three lines of Decision 2.
- [The runner commands are clients of the master daemon](0073-the-runner-commands-are-clients-of-the-master-daemon.md),
  in part: in "Decision", the bullet "A daemon of another revision gets no request", the words "and names `celetis daemon
  stop`, then `celetis daemon start`". Each of the three lines of Decision 6 names both revisions, so "refuses with both
  revisions on a difference" stays. Only the line of the outcome "the daemon is old" names the restart.
- [Land runs the landing when no daemon runs](0124-land-runs-the-landing-when-no-daemon-runs.md), in part: in "Decision", the
  table row "Exit 3, `the daemon runs the engine at …`, as before." for `runs` with another revision. The exit 3 and the
  refused request stay. The line is one of the three lines of Decision 6, and the line of the outcome "the caller is old"
  starts with `this engine at`.

## Context

The MCP server of a session ran the CLI of the version folder that it started from (ADR-0125, Decision 4). After an update,
the successor daemon runs the installed engine and takes over the runs, but each session still ran its start engine. So `land`
of a taken-over session exited 3 with the line "the daemon runs the engine at <new> and this engine is at <old>; restart it:
celetis daemon stop, then celetis daemon start". That line asks for a restart of the daemon, and the restart does not help,
because the caller is the old side. The sessions of #349, #350, #351, and #379 needed a manual **Reconnect** in `/mcp`.

An update can also delete the start folder of a session. The install keeps the three newest folders, the folder of the
installer, and the folders of the daemons that answer. Then each call of that session exited 3 with "start a fresh session".

The maintainer wants this: when a new daemon starts on a new engine, the server of each session follows that engine, with no
manual reconnect. The refusal line must also name the side that is old, and it must not say to restart the daemon when the
caller is old.

## Constraints and evidence

- Claude Code 2.1.329 (documents marked `(latest)`, because `claude --version` prints the same version): a stdio server whose
  process exits in an interactive session is marked failed, and only **Reconnect** in `/mcp` starts it again. On a
  `list_changed` notification, the session fetches the new tool list with no reconnect
  ([MCP](https://code.claude.com/docs/en/mcp)). `@modelcontextprotocol/server` 2.4.0 has `sendToolListChanged`. This record does
  not use it.
- Prior art, read on 2026-11-26. rbenv: a shim finds the version at each call, so a new default works at the next
  command ([README](https://raw.githubusercontent.com/rbenv/rbenv/master/README.md)). reloaderoo: a proxy holds the
  client connection and restarts the child server, and a client can still need a refresh for new tools
  ([README](https://raw.githubusercontent.com/cameroncooke/reloaderoo/main/README.md)). The Kubernetes version skew
  policy names which component may be older ([policy](https://kubernetes.io/releases/version-skew-policy/)). The MCP
  specification 2025-11-25 has `notifications/tools/list_changed`
  ([tools](https://modelcontextprotocol.io/specification/2025-11-25/server/tools)).
- A tool schema of the start revision builds the arguments of a call. Only a served contract version guarantees that an
  engine accepts them, and the digest identifies the declarations that build them (ADR-0090).
- `readEngine` of `engine/lib/install/installation.ts` reads the link of the install home of `enginePaths()` (`current` on
  Windows). The install swaps the link and `current` atomically, so a throw of `readEngine` means a broken install or a bad
  `CELETIS_HOME`, not a moment of an update.
- `servedContracts` of `engine/lib/contract/contract.ts` reads `versions.json` for the gate and for the update. It accepts the
  key `serves` alone, and each entry with the keys `contract` and `digest` alone.
- `engine/README.md`, "The MCP server": no timeout and no kill of a child. This record keeps that rule.
- When this record was written, no check of a real session had run the follow. The plan comment holds the check of the
  maintainer for after the landing. It needs two updates, because the first update only installs the new server code.

## Decision

The server keeps its start tool list, and each call picks its engine at the call. This is approach A of the spec. The
maintainer picked it on 2026-11-26. The maintainer also decided that a session follows the installed engine, the version
folder that `celetis` on `PATH` names, and not the engine of the running daemon.

1. **The pick of the engine.** `pickEngine` of `engine/lib/mcp/engine.ts` runs after the checks of the checkout and of the
   arguments, and before `runForm`. The start entry is the entry of `engine/lib/contract/versions.json` of the start engine
   with the highest `contract`.
   1. It reads the installed engine with `readEngine`. When no engine is installed, it picks the start engine while its
      folder exists (`versionFolderGone` is false). Else the call gives code 3 (Decision 2).
   2. When the installed root is the start root, it picks the installed engine.
   3. When the installed engine serves the start entry (Decision 3), it picks the installed engine.
   4. Else, it picks the start engine while its folder exists.
   5. Else, the call gives code 3 and starts no process.

   A throw of `readEngine`, for example a relative `CELETIS_HOME`, goes to step 4. The line of the throw stays for step 5.
2. **The three lines of code 3.** Each has the class `prerequisite`.
   - `celetis: an update removed the engine version of this session; start a fresh session`: no engine is installed, and the
     start folder is gone.
   - The line of the read failure, when `readEngine` threw and the start folder is gone: the message of a `HostError`, for
     example `celetis: CELETIS_HOME must be an absolute path: <path>`, or `celetis: the installed engine cannot be read: <message>`.
   - `celetis: the installed engine does not serve contract <n> of the tools of this session; start a fresh session`: the
     installed engine does not serve the start entry, and the start folder is gone.
3. **The contract guard.** A call runs an installed engine that is not the start engine only when its `versions.json` has an
   entry with the same `contract` and the same `digest` as the start entry. A file that is missing, is not JSON, or has
   another shape does not serve. Then the call keeps the start engine. The number alone is not enough, because the digest
   identifies the declarations that build the arguments.
4. **The shape of `versions.json` is an interface between revisions.** The server of a session reads that file of a later
   revision as data. It needs `{ "serves": [{ "contract": <integer>, "digest": <string> }] }`. The reader of the server
   ignores a key that it does not know, but `servedContracts` refuses one, so this record gives no right to add a key. A
   change of `serves`, `contract`, or `digest`, or of the path of the file, needs a new record. A later revision that changes
   the file another way gives "does not serve", and the call keeps the start engine. That failure is safe.
5. **No change of a child in flight.** The pick runs before `runForm`, and `runForm` does not change. A call that runs keeps its
   child to the end, and concurrent calls each pick their engine. The tool list and its schemas stay those of the start
   revision. A tool that only the new engine has shows only in a fresh session. Until then, an agent runs its form as a shell
   command. There is no `list_changed` notification and no proxy.
6. **The refusal line of the daemon client.** `revisionRefusal` of `engine/lib/daemon/client.ts` compares the revision of the
   caller, the revision of the daemon (`identity.revision`), and the revision of the installed engine (`readEngine`, or none
   when no engine is installed or the read fails). Equal revisions of the caller and the daemon give no refusal. Else
   `oldSide` gives one outcome, and each outcome has exit 3 (`prerequisite`). Each line starts with `<prefix>: `. The
   revisions print as 12 characters.

   | Outcome | When | Line |
   | --- | --- | --- |
   | The daemon is old | The caller is the installed engine | `the daemon runs the engine at <d> and the installed engine is at <c>; restart it: celetis daemon stop, then celetis daemon start` |
   | The caller is old | The daemon is the installed engine, and the root of the caller is a version folder of the install (`enginePaths().versions`) | `this engine at <c> is not the installed engine <d>, which the daemon runs; start a fresh session, or run the installed celetis` |
   | Neither is the installed engine | Each other case: no installed engine, neither revision is it, or the caller is a checkout | `the daemon runs the engine at <d> and this engine is at <c>; run this command and the daemon from one engine` |

   `<d>` is the revision of the daemon, and `<c>` is the revision of the caller. The line of the last row says only what holds
   in each case, because the daemon can be the installed engine while the caller is a checkout. A checkout caller, for example
   `"$PWD/engine/celetis"` of a check, is not a stale session, so it gets this line. `land` and `daemon status` print the line
   and exit 3, `requireDaemon` throws it, and `daemon start` uses only its null test. `daemon stop` does not use it.
7. **The module split.** `liveRevisions` moves from `engine/lib/daemon/client.ts` to `engine/lib/daemon/live.ts`, so that `client.ts`
   can import `engine/lib/install/installation.ts` with no import cycle.
8. **No contract version, and no change of the install.** `engine/lib/contract/contract.ts` and `versions.json` do not change.
   The update, the install, the prune, and the successor start do not change. The prune still does not keep the folder of a
   session server.

## Constitution

Read: `CONSTITUTION.md`, amended 2026-11-12.

- Serves: 2 Autonomous steps: a taken-over step session lands with no manual reconnect, and a refusal names the act that
  ends it.
- Serves: 3 Verified landing: `land` still refuses a daemon of another revision. Only the caller side moves to the installed
  engine.
- Hard limits and non-goals: none touched. The server follows an engine that a person installed, and it approves no update.

## Alternatives considered

- **B. A front proxy with a back server for each revision.** The front holds stdio, runs the back server of the installed
  engine through the MCP client, and sends `list_changed` after a switch. It also moves the tool list. It was not picked. It
  needs the package `@modelcontextprotocol/client`, a supervisor of back servers, and a second interface between
  revisions. Its one gain is a tool that the old skill text does not call. The prior-art rule recommends this state of the
  art. The maintainer picked approach A, and accepted the cost in Consequences.
- **C. The server exits when the engine changes.** Claude Code marks an exited stdio server as failed in an interactive
  session, so it needs a manual reconnect. The request forbids that.
- **The engine of the running daemon.** The maintainer chose the installed engine. A daemon of a checkout has a Git
  revision that is no installed engine.

## Consequences

- After an update, the calls of an open session run the installed engine when it serves the start entry. The next `land` of a
  taken-over session agrees with the daemon, with no reconnect and no fresh session.
- A session whose start folder an update deleted keeps working while the installed engine serves the start entry. When it
  does not, the call gives code 3 and the fresh-session line.
- A tool that only the new engine has shows only in a fresh session. The skill text of the session is also of the start
  revision, so it does not name that tool.
- After a terminal `celetis update`, the sessions run the new engine and the daemon runs the old one until its restart.
  Then `land` refuses with the line of the outcome "the daemon is old". This follows from the choice of the installed engine.
- A daemon of a checkout has a Git revision. A session whose calls run the installed engine then sees the line "the daemon is
  old", a session that keeps its start engine sees the neutral line, and `celetis daemon start` from `PATH` starts the installed
  engine.
- A later change of the shape of `versions.json` makes the calls keep the start engine. It needs a new record (Decision 4).
- It was not known, when this record was written, that the server needs no file of its start folder after its start. All
  imports of `engine/mcp.ts` are static, but a lazy load would fail after a delete.
- Not checked: the follow and the refusal lines in a Codex session (ADR-0146), and the follow in a real Claude Code session
  across two updates. The plan comment lists the second check as a step of the maintainer after the landing.

## Reconsider when

- A tool schema or a new tool must reach a running session. Approach A cannot do that, and approach B or a `list_changed`
  notification can.
- Claude Code reconnects an exited stdio server by itself, or it stops marking that server failed.
- A later engine accepts the arguments of the old tools although its digest differs, or the digest of ADR-0090 passes an
  engine that does not accept them.
- An update removes the start folder of sessions often enough that step 4 of the pick does not hold in practice.
