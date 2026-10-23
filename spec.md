Spec: 2026-10-22

# The Celetis toolchain uses TypeScript and Bun

Issue: https://github.com/ddinkov10/celetis/issues/96

## Who

The Celetis maintainer and the agents that run Celetis in a product project.

## Problem

The maintainer wants the whole Celetis toolchain written in TypeScript and run on Bun, with no shell scripts. Issue #85 is the first layer: the strict configuration reader moves to TypeScript on Bun. This feature completes that change across the toolchain.

The current checkout has Bash commands, a Perl update helper, shell tests and fixtures, JavaScript board modules, and a native JavaScript entry hook. Its fast gate also needs separate tools for these languages. A port of the commands alone would leave most of this toolchain unchanged.

Issue #85 is still open on 2026-10-22. This spec can be prepared now. Implementation must start from the landed #85 tree, not a copy of its proposed reader.

## Done when

- Each Celetis command, shared helper, board module, hook source, test, fixture generator, and maintenance or build program is authored in TypeScript.
- Bun 1.4.2 or later runs all Celetis command processes and tests. The browser runs generated JavaScript. The native host loads its entry module in its own runtime.
- No shell script remains in the tracked tree. This includes extensionless executables, fixtures, manual tests, wrappers, and generated shell scripts. The Perl helper and executable jq programs also go.
- Celetis does not invoke Bash, sh, Node, Perl, Python, jq, or a shell interpreter to perform its own logic. It calls external tools with argument arrays. It does not move shell programs into TypeScript strings or Bun Shell expressions.
- `worktreeSetup` contains TypeScript. Bun runs it in the lane, with the absolute main checkout path as its input. No Bash setup path remains.
- `scripts/celetis` remains the standalone executable that setup copies to a product project. Its subcommand names, flags, argument boundaries, stdout, exit statuses, and public JSON contracts keep their current behavior, except for changes stated in this spec.
- The fast gate ends with `verify: PASS`. The full suite ends with `suite: PASS`. CI runs both on the tree that lands.
- The documents, skills, settings templates, allow rules, process checks, and quoted manual tests name the new paths and runtime. No live caller still points to a removed script.
- The maintainer completes the product cutover before this feature lands. No compatibility wrapper, old interpreter path, or automatic conversion remains.

## Goals

- Use one language for Celetis logic and one runtime for its command processes and tests.
- Keep the current behavior and trust boundaries while removing interpreter and text-processing glue.
- Keep the fast gate separate from the full suite, as ADR-0022 requires.
- Keep the plugin usable directly from its installed files. A product project needs no dependency installation or build for Celetis itself.

## Non-goals

- New runner, board, issue workflow, or setup features.
- A board redesign or a change to contract 1.
- Replacing Git, GitHub CLI, herdr, or the agent hosts with new clients.
- Rewriting an external tool, a product project's application, or vendored third-party code into TypeScript.
- Adding native Windows runner support. macOS and Linux remain the supported runner platforms.
- Closing existing host acceptance gaps unrelated to this conversion.

## Anti-goals

The conversion fails if it reduces test coverage, weakens permission or path checks, loses process cleanup, changes which checkout a command uses, or makes a successful command hide a failed child process.

It also fails if a plugin refresh starts an old runner against incompatible new files, if generated files can drift from their sources, or if a product project's Bun configuration executes before Celetis validates its inputs.

## Design

### Scope and structure

This is one conversion of a shared toolchain. The launcher, runner, resolver, landing command, setup, and board share paths and process contracts. They must agree at the cutover. The implementation can grow through working internal layers, but only the complete conversion lands.

Keep the existing concern boundaries. Command modules remain separate. Shared configuration, host, session, worktree, and process functions have direct typed interfaces. Use ordinary TypeScript values for JSON data and filesystem operations for file work. Reuse the strict reader and the vendored YAML parser from #85.

Replace each first-party `.sh`, `.pl`, and `.jq` program with TypeScript. Convert the board's JavaScript modules and tests too. Remove obsolete implementations rather than keep forwarding wrappers. A build does not rewrite third-party vendor sources or licenses.

### Launcher and packaging

Keep the public executable path `scripts/celetis`. Its source is TypeScript. Bun produces one readable, standalone JavaScript file at that path, with a Bun shebang. That generated file has no relative bootstrap dependency, so setup can still copy one file into a product project.

The launcher retains host selection and installed-package discovery. It starts the selected installed command with Bun and an argument array. It never finds another installation by guessing a cache path. The product copy still resolves the enabled installation on each call.

Installed command modules use `.ts` paths and local imports. The command basenames stay the same. Internal helpers become imports, not shell functions that a caller sources. Remove the documented Bash sourcing interface and update all its repository callers.

The build program is TypeScript. Check generated delivery files into the plugin, because neither host supplies an install-time build. The gate checks that these files match a build from their TypeScript sources with the pinned Bun version. It compares output without modifying the checkout. No native binary, package download, or runtime build is needed.

### Processes and environment

Use Bun or standard Node-compatible APIs on Bun. Keep external commands as executable-plus-argument arrays. Decode their structured output in TypeScript. Preserve each timeout, output limit, signal, exit status, inherited input stream, and cleanup rule that protects a live operation.

The runner keeps its saved host and exact session ID rules. Locks still distinguish a live runner or landing from a stale process. The port changes each filename check together with the executable it identifies. A bare PID remains insufficient proof of ownership.

Port the Perl update helper to TypeScript without losing its independent update timeout or child cleanup. Preserve the current refresh and package-resolution behavior. This feature does not claim to fix the separate installed-resource lifetime gaps recorded in ADR-0014.

Celetis control code starts with the isolation established by #85: product `.env` files, Bun preloads, and automatic package installation must not inject code into it. Use the selected Bun executable for child Celetis programs. Keep the board's exclusion of product `node_modules/.bin` entries from executable lookup.

External applications keep their own runtimes. A project setup may invoke a Python package manager, for example, through an argument array. Celetis does not require that application's code to use Bun. A terminal or host API that accepts only a command line can receive a safely quoted executable invocation; this boundary must not become a shell program.

### Worktree setup

The maintainer chose TypeScript for `worktreeSetup` in this session. The field stays an optional string in the same `.celetis.yaml`. Literal block rules and parsed trailing newlines stay intact. Omitted and empty values still mean no setup.

Bun executes the text as TypeScript in a separate process whose working directory is the lane. The first argument available to the setup is the absolute main checkout path, replacing Bash's `$1`. The public setup contract names its exact access expression. The setup inherits stdin, stdout, and stderr. An uncaught exception or nonzero exit fails setup. A setup must check the exit status of each external command it starts; Bun does not supply Bash's `set -e` behavior.

Setup code can use Bun and standard filesystem APIs. It needs no implicit helper, generated project file, or new dependency. The implementation chooses how to deliver the literal text to Bun, subject to preserving its contents and lane working directory. It must not load a product preload before the setup begins.

Keep the current marker, retry, and cleanup rules. A successful nonempty setup writes the marker. A failed new lane is removed under the current ownership rules. A failed existing lane stays for repair. `setup try` and `setup lane` use this same execution contract. The setup skill proposes TypeScript, tests the proposal in its detached test lane, and retains its current approval and product-file ownership rules.

Old Bash setup text is not supported or converted. Each affected product project must replace it manually before cutover.

### Board and native entry hook

Run the board server and checker on Bun. Keep its current HTTP behavior, asset paths, CSP, realpath checks, executable checks, selected-agent arguments, and contract validation. Use the existing HTTP and filesystem design where Bun supports it; no new web framework is needed.

Author browser modules in TypeScript and build the JavaScript assets that the browser needs. Keep their current behavior and visual layout. The generated asset names can retain existing browser URLs.

Author the native entry hook and its manual observer helper in TypeScript. If the native host requires JavaScript module files, ship generated readable JavaScript at the required paths. That module continues to use native metadata and file tools. It must not replace native entry with a Bun command, a shell command, or a new YAML parser. Its runtime belongs to the host, not to a separately launched Celetis process.

Generated JavaScript at these delivery boundaries and the vendored parser are explicit exceptions to the TypeScript-source rule. They are not independently maintained implementations.

### Tests, gate, and CI

Use `bun:test` for tests. Port the existing shell cases and board cases without dropping their assertions. Keep isolated temporary repositories, private fixture state, executable stubs, and explicit process cleanup. Replace shell fixture programs with TypeScript sources or generated Bun executables. Negative test data may contain invalid shell text, but no test executes it through a shell.

Keep a TypeScript fast gate and a separate TypeScript full-suite entry. The fast gate retains tracked-file coverage, formatting, lint, strict type checks, workflow validation, configuration validation, plugin validation, and the general-text rules. It checks all first-party TypeScript, including tests, the board, and hook sources. Use separate compiler environments where the browser and native host need different globals. Remove shell-only, Perl-only, and jq-only checks and pins.

The full suite runs on Bun. Each test file keeps the existing 30-second upper bound when run alone. Preserve bounded parallel work where needed; do not keep the shell pool as a hidden dependency. Manual tests remain separate and retain their token-use warning and host selection.

CI replaces the Bash-version matrix with the supported Bun floor. It keeps the fast gate and full suite as distinct steps. CI can use one-line runner commands to start Bun and external installation actions. It contains no Celetis shell logic, shell heredocs, or Bash build job. Build and install orchestration authored in this repository is TypeScript.

### Records, references, and cutover

Record the runtime decision in a new ADR. State which Bash-specific clauses of ADR-0015, ADR-0018, ADR-0020, and ADR-0022 it replaces. Historical ADRs keep their text.

Update live references across skills, host operations, setup templates, permission rules, manifests, README command tables, tests, and project instructions. Update the hand-run test's verbatim quotes in the same change when a quoted sentence changes. Run that manual test under its repository rule.

Before landing, stop old runners and boards in affected product projects. Install the required Bun version. Replace each Bash `worktreeSetup` with the reviewed TypeScript equivalent. Prepare the generated standalone launcher and any owned settings changes for those projects. Require the maintainer's readiness report for this build before the plugin reaches `main`.

After the coordinated refresh, copy the new launcher through setup and restart runners and boards. Test a new step and exact Resume with the selected host. There is no migration path that lets old and new runners share this cutover.

## Calls made by this session

These are proposed choices, not additional maintainer decisions:

1. Preserve `scripts/celetis` with a generated standalone Bun launcher, instead of changing each product's public command path.
2. Permit generated JavaScript only at delivery boundaries that need it, plus the vendored third-party parser. The native hook remains inside the host runtime.
3. Preserve CLI behavior and operational contracts, except for script paths, the removed Bash sourcing interface, runtime requirements, and the setup language.
4. Use `bun:test` across the suite. Keep existing Bun-compatible standard APIs rather than replace them for style.
5. Land this as one complete conversion after #85. Keep internal layers working during the build.

## External facts

- Bun 1.3.14 (installed): this machine reports `1.3.14`, below the 1.4.2 floor of #85. Source: `bun --version`, 2026-10-22.
- Bun 1.4.2 (pinned by the approved #85 spec): `Bun.spawn` accepts executable argument arrays, working directories, inherited streams, timeout and signal options, and a promise for process completion. Source: https://github.com/oven-sh/bun/blob/bun-v1.4.2/docs/runtime/child-process.mdx ; Context7 `/oven-sh/bun/bun-v1.4.2`.
- Bun 1.4.2 (pinned): `Bun.build` accepts TypeScript entrypoints and a browser or Bun target. Source: https://github.com/oven-sh/bun/blob/bun-v1.4.2/docs/bundler/index.mdx ; Context7 `/oven-sh/bun/bun-v1.4.2`.
- Bun 1.4.2 (pinned): `bun test` has a default per-test timeout of 5000 ms. A test can specify its timeout. Source: https://github.com/oven-sh/bun/blob/bun-v1.4.2/docs/test/writing-tests.mdx ; Context7 `/oven-sh/bun/bun-v1.4.2`.
- Bun 1.4.2 (pinned): `node:test` is only partly implemented; its Node CLI runner mode and several runner options are absent. The documentation recommends `bun:test`. Source: https://github.com/oven-sh/bun/blob/bun-v1.4.2/docs/runtime/nodejs-compat.mdx ; Context7 `/oven-sh/bun/bun-v1.4.2`.
- Claude Code 2.1.306 and Codex CLI 0.163.0 (installed): these are the observed local host versions. Source: `claude --version` and `codex --version`, 2026-10-22. Their live acceptance is not proved by these commands.

## Risks and work left to the plan

- **The base is not ready.** #85 has not landed. Reconcile this design with its final reader, isolation controls, vendored files, and ADR before implementation. Do not rebuild that first layer independently.
- **The local Bun is below the floor.** Install Bun 1.4.2 or later before implementation or live checks. No check on 1.3.14 proves acceptance at the floor.
- **Native hook loading is not settled.** Verify the actual host's accepted module format and generated output before selecting a build target. The lookup did not establish that contract. Keep native entry and denial behavior intact.
- **Process behavior needs proof.** Lock ownership, PID reuse, signal propagation, update timeouts, pipe closure, and descendant cleanup must pass on macOS and Linux. API availability alone does not prove them.
- **Generated delivery files add a build boundary.** The plan must prove a deterministic build, executable permissions, one-file launcher bootstrap, and matching output from the pinned Bun version. No file can depend on an install hook.
- **Startup isolation must carry through the port.** Check local and global Bun config, `.env`, package auto-install, and product executable shadowing at each relevant entry boundary. Reuse #85's evidence where it applies.
- **The port is broad.** Map each existing test case and caller to its replacement. Record any obsolete case removed with the behavior it tested. Do not equate fewer files with equal coverage.
- **Terminal APIs can require command strings.** Verify the actual herdr start and input contracts. Retain correct argument quoting without adding shell orchestration.
- **The product cutover is external work.** The plan must identify affected product projects and the trusted readiness report. This lane changes no unrelated repository without authorization.

## Verification

- Check the tracked tree for shell files, shell shebangs, generated shell fixtures, the Perl helper, jq programs, and removed-path callers. Allow historical text and negative test data only where their role is explicit.
- Run the new fast gate and the full Bun suite on the final tree. Require green CI on Bun 1.4.2.
- Compare every ported CLI contract case, including failed external commands, invalid config, host selection, saved Resume, worktree cleanup, landing, and update failures.
- Test the generated launcher in a scratch product project with no plugin files beside its copied launcher. Require correct enabled-package resolution for both hosts.
- Check board contract 1 and its path and executable guards on Bun. Check the board in Chromium at desktop width and 375×812.
- Run the changed native entry and quoted-step manual checks for the relevant hosts. Preserve UNRUN or BLOCKED for any check not performed.
- Test TypeScript setup success, failure, inherited input, main-path access, empty setup, markers, retry, and cleanup through worktree, `setup try`, and `setup lane`.
- Complete the product readiness report before landing, then test a new step and exact Resume after the coordinated refresh.

