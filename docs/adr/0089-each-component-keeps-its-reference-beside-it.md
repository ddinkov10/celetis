# Each component keeps its reference beside it

## Date

2026-11-09

## Related

- [Issue #265](https://github.com/ddinkov10/celetis/issues/265): the spec (body of the issue), and the
  [plan comment](https://github.com/ddinkov10/celetis/issues/265#issuecomment-6743996201), which holds the plan with
  its "Decisions of the plan session" and the specification of its probe.
- Labels in this record: "the probe" names the probe that that plan comment specifies, and "case e" names a case of its
  mode `citefail`. "Approach 2" and "approach 3" name approaches of the spec.
- [Issue #195](https://github.com/ddinkov10/celetis/issues/195): finding F19, marked "take" on 2026-11-05.
- [ADR-0084](0084-the-agent-text-names-engine-outcomes.md), [ADR-0085](0085-the-plugin-lives-in-plugins-celetis.md),
  and [ADR-0086](0086-the-gate-checks-cited-sections-and-link-fragments.md): the records of the agent text, the
  plugin folder, and the checked citations, which this record builds on.

## Supersedes

Only these claims change. The accepted records keep their other text.

- [ADR-0014](0014-one-workflow-uses-explicit-host-operations.md), the sentence "`docs/celetis-flow.md`, "Acceptance
  status", records current proof and limits.": "Acceptance status" in `plugins/celetis/docs/workflow.md` records the
  current status and the open checks. The proof of a run stays on its issue.
- [ADR-0029](0029-the-repository-keeps-no-tests.md), the sentence ""Acceptance status" in `docs/celetis-flow.md`
  keeps the observed results.": the section keeps the current status and names the issue of the evidence.
- [ADR-0034](0034-native-windows-uses-kernel32-and-spawned-children.md), the sentence ""Acceptance status" in
  `docs/celetis-flow.md` holds the Windows observations and the open checks.": the section keeps the open checks and
  the current status, not the observations.
- [ADR-0036](0036-the-engine-enforces-the-lifecycle-and-the-landing.md), the claim that the live check of `issue`
  is "recorded in `docs/celetis-flow.md`, "Acceptance status"": the evidence of that check stays on its issue.
- [ADR-0041](0041-the-engine-owns-the-attempts-and-checks-each-dispatch.md), the two sentences that "Acceptance
  status" "records the exact child identities, native arguments/results/completion checks, evidence paths, scorer
  results, and source boundary" and "keeps the exact refusal and exit lines": the evidence stays on its issue.
- [ADR-0047](0047-skills-load-shared-procedures-on-demand.md), the claim that the Verify phase of the plan of #105
  "records the live checks of both hosts in `docs/celetis-flow.md`, "Acceptance status"": the evidence stays on its
  issue.

Each replaced claim describes the section at the time of its record. The history before #265 stays in
`plugins/celetis/docs/workflow.md` at commit `81c126e`.

## Context

At `81c126e` three files held most of the reference:

- `plugins/celetis/README.md` had 1,598 lines. "Wire a product project" was about 750 of them, a restatement of
  what `/celetis:setup` writes.
- `plugins/celetis/docs/workflow.md` had 3,050 lines. "Acceptance status" was 729 of them, a dated history of runs.
- `engine/board/README.md` had 1,229 lines.

These files also quoted error lines that the code holds. Most commits changed them, so parallel lanes conflicted
there, and the hand copies drifted from the code. A change of the daemon edited a plugin document.

A grep of `docs/adr/` for "Acceptance status" finds ten records. ADR-0016 only links the section. ADR-0033,
ADR-0042, and ADR-0054 say that it holds open checks or limits, which it still does. The other six are in
"Supersedes".

The installed plugin is a copy of `plugins/celetis/` only (Claude Code 2.1.319 documents that "Files outside the plugin
directory aren't copied", [Claude Code plugins](https://code.claude.com/docs/en/plugins/loading)), and `checkCitations` refuses an agent citation of a file outside that folder.

## Decision

1. **The home of each kind of reference.** Each component keeps its reference beside it:
   - `plugins/celetis/README.md` holds the overview, the requirements, the install, the full loop, the skills, the
     generated commands, and the update rule.
   - `plugins/celetis/docs/setup.md` holds what setup writes, owns, preserves, and reports.
   - `plugins/celetis/docs/configuration.md` holds the config, the agent selection, and the custom parts.
   - `plugins/celetis/docs/workflow.md` holds the steps of a run as a session and a person meet them, and
     "Acceptance status".
   - `engine/README.md` holds the daemon and the runs.
   - `engine/board/README.md` holds the board.
   - `scripts/README.md` holds the checks.
   - The command manual stays generated from `engine/lib/contract.ts`.
2. **The status rule.** "Acceptance status" lists the current status of each capability or host part, its observed
   host versions, and its open checks. Each item names one issue that holds its evidence. An item whose issue holds
   no evidence comment names the commit of the last version of `workflow.md` that held its evidence. The section
   holds no date and no run narrative.
3. **The link rule.** A plugin document names a file of `engine/` or `scripts/` by its absolute GitHub URL, because
   the installed plugin has no such file. A document of `engine/` or `scripts/` links a plugin document by a
   relative path.
4. **The pointer rule.** A program line or a code comment names the new home as plain text, for example
   `engine/README.md`, "The master daemon". A moved section keeps its heading text, so each pointer stays
   recognizable.
5. **The continuous queue.** "The continuous queue" now lives in `engine/README.md`. The link
   `workflow.md#the-continuous-queue` of ADR-0070 and the link `README.md#explicit-source-repair` of ADR-0031 stay
   dead, because a landed record is not rewritten. The probe mode `links` at `81c126e` also finds the dead links
   `../../tests/manual/live-acceptance.md` and `../../tests/manual/config-entry-codex.md` in ADR-0016, which
   ADR-0029 already accepts.
6. **The quoted lines.** No document quotes an error line by hand, except a line that an agent acts on and that
   `engine/lib/contract.ts` declares or the build generates.

## Alternatives considered

- **Keep `workflow.md` whole (approach 2).** Only the history and the quoted lines go, and the board part merges
  into `engine/board/README.md`. The diff is smaller, but a daemon change still edits a plugin document, so the
  effect of F19 is lost for the runner.
- **Move the runner reference to the engine and change the agent citations to it (approach 3).** The installed
  plugin has no `engine/`, and `checkCitations` refuses a citation of a file outside `plugins/celetis/`.

## Consequences

- A daemon change edits `engine/README.md`. A board change edits `engine/board/README.md`. A check change edits
  `scripts/README.md`. A setup change edits `plugins/celetis/docs/setup.md`.
- No agent text cites `engine/README.md`, `engine/board/README.md`, or `scripts/README.md`.
- `checkCitations` reads only the Markdown files under `plugins/celetis/`. So a broken link or pointer in
  `engine/README.md`, `engine/board/README.md`, `scripts/README.md`, `AGENTS.md`, the root `README.md`,
  `PRODUCT.md`, `docs/hosts/`, or `docs/adr/` passes the gate. The probe mode `citefail`, case e, observed this
  limit: the first link fragment of `engine/board/README.md` lost its last character, and `checkCitations` printed no
  line for it. The same run printed the expected line for each of cases a to d, which break a moved citation or a
  link fragment inside `plugins/celetis/`, and no line for the unchanged map. The result on the final tree is
  `citefail: PASS (5 of 5 cases, control clean)`.
- The change adds no gate check. The build checked these links once with the probe modes `links` and `pointers`.

## Reconsider when

- A host copies files outside the plugin folder into its plugin cache. A plugin document can then link `engine/`
  and `scripts/` by a relative path.
- A gate check reads the references outside `plugins/celetis/`. The limit of the consequences then ends.
