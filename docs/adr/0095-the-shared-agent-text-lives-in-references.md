# The shared agent text lives in references/, and docs/ holds only documents

## Date

2026-11-10

## Related

- [Issue #286](https://github.com/ddinkov10/celetis/issues/286): the spec (body of the issue), and the
  [plan comment](https://github.com/ddinkov10/celetis/issues/286#issuecomment-6779661429). In this record, "the
  gate probe", "the map probe", and "the link probe" name the probes `gate-probe.ts`, `map-only.ts`, and
  `outside-links.ts` of that comment, "Probe sources". A label such as "run A" names a run of the gate probe.
  "Prior art", "Approaches", and "External facts" name parts of the spec.
- The runtime report of the build is a comment of that issue whose first line is `Runtime verification for #286`.
  It holds the output of each probe run that this record cites, and the result of the host checks.
- [ADR-0012](0012-the-harness-is-the-plugin-celetis.md), "Constraints and evidence": it names
  `docs/adr/README.md` of a product project. That is another file, and this record replaces no clause of it.
- [ADR-0051](0051-explicit-host-usage-limits-can-permit-landing.md) and
  [ADR-0066](0066-one-shared-event-record-with-a-lock.md), "Related": each holds a relative link to a moved file.
  The link is a pointer and no decision clause. It does not resolve after this change ("Consequences").
- [ADR-0055](0055-assistance-can-complete-verified-holds.md) and
  [ADR-0057](0057-the-step-before-decides-the-effort-of-the-next-step.md), "Related" and "Consequences": each
  names a module by its old path as a pointer. No decision clause holds the path.
- [ADR-0078](0078-the-master-daemon-runs-each-landing.md), "Related" and "Constraints and evidence", and
  [ADR-0084](0084-the-agent-text-names-engine-outcomes.md), "Context" and "Constraints and evidence": the old
  paths are evidence of their date.
- [ADR-0090](0090-a-contract-version-replaces-the-same-revision-rule.md) and
  [ADR-0094](0094-the-lesson-store-lives-in-celetis-lessons.md), "Consequences": each names one module by its old
  path. ADR-0090 also holds the rule of the contract version: this change edits no declaration, so the version
  stays.
- Each match of an old path in the "Related", "Supersedes", or "Context" section of a record of "Supersedes"
  below is a pointer or history, and stays.
- [ADR-0054](0054-product-owned-setup-files.md) and
  [ADR-0071](0071-setup-reconciles-recorded-owned-wiring.md) say "reference" for the file reference of
  `worktreeSetup`. That sense stays.
- [ADR-0029](0029-the-repository-keeps-no-tests.md): the repository keeps no tests, so each check of the build is
  a scratch probe.
- [ADR-0031](0031-plugin-development-is-independent-of-adoption.md): no step looks at another product project.

## Supersedes

Only these clauses change. The accepted records keep their historical text and evidence.

- [ADR-0047](0047-skills-load-shared-procedures-on-demand.md), Decision: "the module,
  `docs/procedures/<name>.md`", and the entry line "then read `<plugin>/docs/procedures/entry.md`". The module is
  `references/procedures/<name>.md`, and the entry line names `<plugin>/references/procedures/entry.md`. Also the
  names "The maintainer references are never read at entry" and "The host documents are maintainer references":
  the current documents say "maintainer document". This record replaces no other clause of it.
- [ADR-0050](0050-standalone-engineering-principles-have-canonical-rules.md), Decision: "General engineering
  principles live in `docs/principles/<name>.md`", and "`checkCitations` checks direct `docs/principles/*.md`
  files". The folder is `references/principles/`. The rest of the decision stays.
- [ADR-0052](0052-setup-owns-required-configuration-and-host-wiring.md), Decision, the table of the removed
  product rules: "Existing `docs/procedures/landing.md`" and "`docs/procedures/entry.md`, `The contract`". The two
  modules are in `references/procedures/`.
- [ADR-0060](0060-impeccable-gives-the-options-of-web-and-mobile-look-decisions.md), Decision:
  "`docs/procedures/design.md` holds the procedure". The module is `references/procedures/design.md`.
- [ADR-0063](0063-a-step-stops-only-for-an-act-outside-the-session.md), Decision: "`docs/procedures/stop.md`
  holds one check", and "the `Claude Code` and `Codex` parts of `docs/procedures/stop.md`". The module is
  `references/procedures/stop.md`.
- [ADR-0067](0067-component-research-binds-behavior-and-guides-looks.md), Decision: "**A new module.**
  `docs/procedures/component-research.md`". The module is `references/procedures/component-research.md`.
- [ADR-0068](0068-agent-curation-at-each-landing-activates-lessons.md), Decision: "\"The reviewer rules\" of
  `docs/procedures/lesson-curation.md`". The module is `references/procedures/lesson-curation.md`.
- [ADR-0074](0074-a-capture-record-feeds-the-normal-steps.md), Decision: "through `docs/procedures/capture.md`".
  The module is `references/procedures/capture.md`.
- [ADR-0080](0080-a-look-decision-bypasses-the-page-csp-on-its-own-browser-tab.md), Decision:
  "`docs/procedures/design.md`, \"The page CSP\", holds the rules". The module is
  `references/procedures/design.md`.
- [ADR-0085](0085-the-plugin-lives-in-plugins-celetis.md), Decision 3: "`docs/adr/README.md`, and
  `docs/adr/template.md` move whole into the folder". The two files are in the folder of the skill
  `record-architecture-decisions`. The other documents of Decision 3 stay, and Decision 1 holds no path and stays.
- [ADR-0089](0089-each-component-keeps-its-reference-beside-it.md), Decision 1: "**The home of each kind of
  reference.** Each component keeps its reference beside it". The homes stay. The current documents say "document"
  for that kind of file.

## Context

The maintainer said: "why the skills are in folder docs", and then: "i was talking about procedus principles and
such. docs isn't about that" (chat, 2026-11-10). At `d202da5`, `plugins/celetis/docs/` held 46 files of three
kinds:

- 5 documents that people read: `capability.md`, `configuration.md`, `issue-tracker.md`, `setup.md`, and
  `workflow.md`. An agent reads only a named section of one, when a step needs a definition.
- 39 files of agent text: the 28 procedure modules of `docs/procedures/` and the 11 principles of
  `docs/principles/`. A skill or the step text loads one when a step names it.
- 2 files that one skill reads: the ADR guide `docs/adr/README.md` and the ADR template `docs/adr/template.md`.
  Only the skill `record-architecture-decisions` cites them.

So 41 of the 46 files were not documents, and the folder name did not say what they were.

## Constraints and evidence

- A change keeps no backward compatibility (a rule of the maintainer). So no file, no link, and no reader stays at
  an old path, and no check looks for a leftover file.
- [ADR-0047](0047-skills-load-shared-procedures-on-demand.md) defines a module as text that two or more callers
  need, and no skill reads the `SKILL.md` of another skill.
  [ADR-0050](0050-standalone-engineering-principles-have-canonical-rules.md) gives each principle one canonical
  file apart from the skills. Both rules stay, so a shared file cannot live in the folder of one skill.
- Prior art (the spec, "Prior art"). The Agent Skills specification gives a skill a folder `references/`, which
  "Contains additional documentation that agents can read when needed" (https://agentskills.io/specification.md).
  Superpowers v7.0.2 and BMAD-METHOD v6.12.4 keep the on-demand files of a skill in the folder of that skill
  (https://github.com/obra/superpowers/tree/v7.0.2,
  https://github.com/bmad-code-org/BMAD-METHOD/tree/v6.12.4/src/core-skills). visual-explainer v0.12.0 has a
  folder `references/` at the plugin root for the files that its skill and its commands share
  (https://github.com/nicobailon/visual-explainer/tree/v0.12.0/plugins/visual-explainer). The Agent Plugins
  specification 1.0.0 names no location for text that several skills share (https://agent-plugins.org/llms.txt).
  None of the 41 plugin folders with a manifest of the official Claude plugins has a folder `docs`
  (https://github.com/anthropics/claude-plugins-official/tree/dceb15d50832/plugins).
- The hosts give the folder no meaning (the spec, "External facts"). The default component locations of a plugin
  of Claude Code 2.1.322 do not include `references/` (https://code.claude.com/docs/en/plugins-reference.md), and
  a skill reaches "files bundled anywhere in the plugin" through the plugin root
  (https://code.claude.com/docs/en/skills.md). The fixed package paths of a plugin of Codex CLI 0.167.0 are
  `skills/` and `mcp.json`, and "other resources stay at the plugin root"
  (https://developers.openai.com/plugins/build/plugins.md). On Codex, a directory under `skills/` must hold a
  `SKILL.md`, and each skill directory is an immediate child of `skills/`
  (https://developers.openai.com/plugins/deploy/submission-errors.md).
- The gate job `plugin` runs `claude plugin validate plugins/celetis`. It passes with the root folder
  `references/` on Claude Code 2.1.322.
- The gate probe runs the real gate on a copy of the tracked files. On the tree before the change, 6 of its 7
  runs fail: the gate reads no file at a new path. On the changed tree, the 7 runs pass. Run C: the unchanged
  tree gives `verify: PASS` and no other `verify:` line. Run A: the gate refuses, in a module at the new path, a
  citation of a file that is not tracked, a citation of the old path of `entry.md`, a section name that is no
  heading, a module with one citer, the text `docs/hosts/`, and a `celetis` code span that matches no declared
  form. In a principle at the new path, it refuses the same text `docs/hosts/` and the same code span. It also
  refuses a `SKILL.md` with no entry line. Run H: the gate and `scripts/build.ts` refuse an `entry.md` at the new
  path with a wrong heading. Run I: the gate refuses a wrong entry line there. Run G: the gate refuses a citation
  of a file that is not tracked in the ADR guide, so it reads that file as agent text. Run K: a file at an old
  path gets no line, and the gate passes.
- The map probe compares each changed file with its bytes before the change. It ran with `--all` after the move
  and the rewrite, before the document edits of "Decision", 5. Each changed file other than the built hook (95
  files) differed only by the map of "Decision", 2, and by the wrap of one statement of
  `engine/lib/entry-text.ts` into three lines. Its control changes one byte of one module and fails.
- The built hook `plugins/celetis/hooks/entry.js` names `references/procedures/` on 8 lines and `docs/procedures/`
  on none. Its changed lines differ only by the folder name.
- The link probe resolves each relative link into `plugins/celetis/` of `engine/README.md`,
  `engine/board/README.md`, `scripts/README.md`, `AGENTS.md`, the root `README.md`, and `docs/hosts/`. After the
  moves alone, 11 of the 41 links were dead. After the rewrite, none is dead.
- The plan session ran both host checks of the plan comment ("Verify phase", V7-claude and V7-codex) on a copy of
  the changed tree, and both passed (the plan comment, "The dry run of the plan session"). The runtime report
  holds the result of the same checks on the lane.

## Decision

1. **The layout rule.** The folders of `plugins/celetis/` follow three rules:
   1. `references/` holds the agent text that more than one caller can load: the procedure modules in
      `references/procedures/` and the principles in `references/principles/`.
   2. A file that only one skill reads lives in the folder of that skill. The ADR guide and the ADR template live
      in `plugins/celetis/skills/record-architecture-decisions/`.
   3. `docs/` holds only documents that people read. An agent reads a named section of such a document when a step
      needs a definition.

   `AGENTS.md`, "Where agent text lives", holds the rule.
2. **The map.** No file changes its name.

   | Before | After |
   | --- | --- |
   | `plugins/celetis/docs/procedures/<name>.md` | `plugins/celetis/references/procedures/<name>.md` |
   | `plugins/celetis/docs/principles/<name>.md` | `plugins/celetis/references/principles/<name>.md` |
   | `plugins/celetis/docs/adr/README.md` | `plugins/celetis/skills/record-architecture-decisions/README.md` |
   | `plugins/celetis/docs/adr/template.md` | `plugins/celetis/skills/record-architecture-decisions/template.md` |

   A citation that starts with `<plugin>/` follows the same map, with `<plugin>/` in place of `plugins/celetis/`.
   The text of a module or a principle changes only in its citations and links.
3. **The gate keeps each rule and reads the new folders.** `agentText` of `scripts/verify.ts` is each `.md` file
   of `plugins/celetis/skills/`, each module, each principle, and the step text. The host reference rule, the
   two-citer rule, and the entry line rule read the new paths. The rule for a citation of a maintainer document
   does not change. Two results change. A file in an old folder was agent text and is plain text. The ADR guide
   and the ADR template were plain text and are agent text.
4. **The contract version stays 2.** No declaration of `engine/lib/contract.ts` changes: the change edits one help
   text, and the digest covers no prose field. At run time, the engine reads no file of the moved folders. The
   hook holds the text of the contract from build time, `scripts/build.ts` and the gate read `entry.md`, and each
   other engine site is a printed line.
5. **One name for a document.** `references/` is the folder of agent text. A current document says "document" for
   a document that people read: "maintainer document", "the host documents", "the setup document". The word
   "reference" stays for a file reference of `worktreeSetup`, an evidence or child reference, the external title
   "Codex CLI reference", and the gate line `verify: host reference:`.
6. **No backward compatibility.** The folders `plugins/celetis/docs/procedures/`,
   `plugins/celetis/docs/principles/`, and `plugins/celetis/docs/adr/` do not exist after the change.

## Alternatives considered

The maintainer picked B of "Approaches", one folder `references/`, in the question dialog of the specify session
(2026-11-10). The session recommended A. In the same dialog, the maintainer picked the move of the ADR guide and
the ADR template into their skill.

- **A. Two folders at the plugin root**, `plugins/celetis/procedures/` and `plugins/celetis/principles/`. Each
  folder name is the name of its layer, and a citation is the shortest. The plugin root gets two more entries.
  The maintainer rejected it.
- **C. Each file in the folder of the skill that reads it**, the industry standard. A shared file in the folder of
  one skill makes each other caller read into that folder, against the two rules of "Constraints and evidence".
  C applies where a file has one reader: the ADR guide and the ADR template.
- **D. A folder with no skill inside `skills/`.** Both hosts give `skills/` one meaning: each immediate child is a
  skill (the spec, "Approaches", D).
- **E. No move.** The maintainer answered "yes" to a move in the issue.
- **"Reference" changes in only 5 lines**, the lines with "maintainer reference". The plan session asked, and the
  maintainer answered "All 31 lines (Recommended)" (the plan comment, "Decisions of the maintainer in the plan
  session"). The tree had 32 such lines, and the rule of the answer covers each.

## Consequences

- Each kind of file of the plugin has one home, and the folder name says the kind. The plugin root gets one more
  entry.
- **The update.** After the landing, the maintainer updates the installation (`plugins/celetis/README.md`,
  "Updates"). A new session loads the new plugin. A session from before the update keeps its skill text and its
  plugin folder of the old version, where the old paths exist.
- **A product project.** A custom part (`custom.<skill>`) or an `AGENTS.md` of a product that cites a module, a
  principle, or an ADR file of the plugin by an old path names a path that does not exist after the update. Its
  owner changes the path by hand. No command finds such a citation: the config reader checks the keys of
  `custom`, not its text.
- **A published plan.** On 2026-11-10, the comments of #287, #252, and #4 named files of the old folders (the
  spec, "Consequences for existing checkouts"). #287 landed before this change. #252 and #4 are open. A build of
  such a plan after this landing reads each old path as its new path by the map. No command stops that build.
- **A lane in flight.** A lane that edits a moved file merges the trunk at its next entry. A conflict there is
  integration work of that lane.
- **Two links of landed records do not resolve.** The "Related" links of ADR-0051 and ADR-0066 name
  `plugins/celetis/docs/procedures/runtime-verification.md` and
  `plugins/celetis/docs/principles/separate-before-serializing-shared-state.md`. A landed record keeps its text.
- **The old paths stay in the record stores.** Before this record, 17 records of `docs/adr/` and 10 lesson files
  of `docs/lessons/` named `docs/procedures` or `docs/principles`. A lesson file changes only through the lesson
  curation. A landed record also keeps the word "reference" for a document of a component.
- **The ADR guide and the ADR template are agent text.** The citation rules and the contract rules of the gate
  read them (run G).
- **A file at an old path gets only the plain text check.** The gate passes and prints no line for it (run K).
  Nothing reads such a file as a module or a principle.
- **The gate does not read the links outside the plugin folder**
  ([ADR-0089](0089-each-component-keeps-its-reference-beside-it.md), "Consequences"). The link probe checked them
  once. A later broken link there passes the gate.
- Not verified: that Git follows each rename when a lane in flight merges the trunk, and each platform other than
  macOS (each probe ran on macOS).

## Reconsider when

- A host gives a root folder `references/` of a plugin a meaning of its own.
- The Agent Plugins specification names a home for text that several skills share.
- A file of `references/` has only one caller. Rule 2 of the layout then gives it the folder of that skill.
