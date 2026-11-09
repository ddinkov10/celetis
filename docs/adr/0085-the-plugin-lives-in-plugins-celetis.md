# The plugin lives in plugins/celetis

## Date

2026-11-09

## Related

- [Issue #261](https://github.com/ddinkov10/celetis/issues/261): the spec (body of the issue), and the
  [plan comment](https://github.com/ddinkov10/celetis/issues/261#issuecomment-6729102229), which holds the plan
  with its `### Your steps` and its Verify phase.
- Labels in this record: "Task N" and "VN" name a task and a Verify scenario of that plan. "Probe B" names
  probe B of the spec in issue #261. "F21" names item F21 of issue [#251](https://github.com/ddinkov10/celetis/issues/251).
- [Issue #195](https://github.com/ddinkov10/celetis/issues/195): decision 2, "One repository with package
  folders", which chose the plugin folder for this repository.
- [ADR-0042](0042-one-celetis-program-for-both-hosts.md): the two deliveries (program and host plugins),
  the Codex marketplace source `https://github.com/ddinkov10/celetis.git`, and `requireSameRevision`.
  Its clauses stay.
- [ADR-0030](0030-the-installed-plugin-owns-the-entrypoint.md): the program entry and the plugin root of
  the session. Its clauses stay.
- [ADR-0012](0012-the-harness-is-the-plugin-celetis.md): the harness is the plugin, with the root as the
  marketplace.

## Supersedes

Only these clauses change. The accepted records keep their historical text and evidence.

- [ADR-0012](0012-the-harness-is-the-plugin-celetis.md), "The repository is private, and its root is the
  marketplace and the plugin" (line 404): the root catalog gives `"source": "./"`, and the plugin files sit
  at the root. Now the root catalog gives `"source": "./plugins/celetis"`, and the plugin files sit in
  `plugins/celetis/`. The id `celetis@celetis` stays.
- [ADR-0012](0012-the-harness-is-the-plugin-celetis.md), "The skills are in one flat `skills/` folder" (line
  407): the folder is `plugins/celetis/skills/`. The grouping in the README stays.
- [ADR-0012](0012-the-harness-is-the-plugin-celetis.md), the development loop `claude --plugin-dir .` (line
  548): the loop is `--plugin-dir plugins/celetis`.

## Context

The harness of ADR-0012 is the root of this repository: the root holds the marketplace, the plugin files,
the program, the ADRs, and the lessons. The Claude Code and Codex caches copy the whole catalog source
folder. When that folder is the root, each cache takes the program with it, so a plugin install copies
`engine/`, `scripts/`, and the records, and a plugin cannot be separated from the program.

The host copies only the folder of the catalog source. Each official plugin folder and each BMAD plugin
folder names its files in one folder, and the root catalog names that folder. This change follows that
pattern.

## Constraints and evidence

- Claude Code accepted a `git-subdir` entry in the inline `settings` marketplace of `celetis update`. The
  installed cache held only the files of `plugins/celetis` (Task 4). The fallback of the plan was not used.
- Codex copies the marketplace clone into the cache and records the clone revision in
  `.codex-marketplace-install.json`. The cache holds no witness of its own. The record of a moved clone does
  not change the cache, so a clone move with no new cache copy must be found from the bytes (Task 3, probe B
  of the spec).
- Task 3 ran the Codex probe on a local smart-HTTP Git server with Codex 0.166.0 and temporary homes. Cases
  (a) to (j) passed. A clone moved to a new revision with no new cache copy gave `README.md is changed`
  (simulated, with no real Codex upgrade).
- Task 1 ran the gate probe of the citation and link rules. A `<plugin>` citation outside the folder fails, a
  relative link of a moved document out of the folder fails, a link to a tracked root file fails, a TypeScript
  file in the folder fails, and a link inside the folder passes.
- Task 2 ran the session probe. `assist` and `intake` start the host with no `--plugin-dir`, and the step
  text is read from the plugin root of the step header.
- The root link scan of Task 1 gives five lines that stay on the base revision too. Four are historical
  links in ADR-0016 and ADR-0029, and one is a link example in a code span of `AGENTS.md`.

## Decision

The plugin folder is `plugins/celetis/`. These parts make up the decision:

1. **The layout.** `git mv` moves the skills, the procedure modules, the principles, the step text, the hook
   `hooks/hooks.json` and its built `entry.js`, both host manifests, and the cited documents into the folder.
   The program, `engine/`, `scripts/`, the ADRs, the lessons, and `AGENTS.md` stay at the root.
2. **The catalogs.** The root `.claude-plugin/marketplace.json` names `"source": "./plugins/celetis"`. The
   plugin folder holds its own catalog, `plugins/celetis/.claude-plugin/marketplace.json`, with one entry
   `"source": "./"`. The Codex session pin uses this catalog, so that the cache root is a local marketplace.
3. **The cited documents.** `README.md`, `docs/issue-tracker.md`, `docs/capability.md`, `docs/workflow.md`,
   `docs/configuration.md`, `docs/adr/README.md`, and `docs/adr/template.md` move whole into the folder. A
   relative link of a moved document to a file that stays at the root becomes the GitHub URL of that file on
   `main`, with its anchor kept. The root gets a short `README.md`.
4. **The Codex revision witness.** `codexRevision` in `engine/lib/plugin-metadata.ts` reads the revision as the
   `HEAD` of the marketplace clone with its `.codex-marketplace-install.json`. The cache must hold exactly the
   regular files of `git ls-tree -r <revision> -- plugins/celetis`, and each file must have the object ID of
   `git hash-object --no-filters`. A missing, extra, changed, or non-regular entry refuses. File modes are
   outside this witness: every tree entry is `100644`, and the bytes are the rule. `codexSessionPin` uses this
   witness.
5. **The Claude update.** `updatePlugin` in `engine/lib/updater.ts` names the inline `settings` marketplace with
   the `git-subdir` entry `{source: 'git-subdir', url, path: 'plugins/celetis', ref?, sha}`. Any other entry form
   is refused.
6. **The runner.** `assist` and `intake` call `requireSameRevision` before they start the host, as a step does.
   The step text is read from `plugin root` in the step header. The skill file is read from the plugin root.
7. **The gate.** `checkCitations` in `scripts/verify.ts` resolves each `<plugin>/<path>` citation of agent text to
   `plugins/celetis/<path>`, and each relative link of a tracked document in the folder must stay in the folder.
   A `.ts` file in the folder fails. `classify` gives a new `.md` file and a skill's `agents/openai.yaml` the text
   check and a new `.json` file the Biome check, with no row. A new file of another type, for example `.png`, or a
   `.js` file other than the generated `hooks/entry.js`, fails until `scripts/verify.ts` gives it a row or an
   exemption. A probe of `classify` on such paths in the folder showed each of these results.
8. **The development loop.** `claude --plugin-dir plugins/celetis` is the loop of a checkout. `AGENTS.md`, "Traps"
   names it.

## Alternatives considered

- **Two repositories**, with a separate marketplace repository. Rejected in #195: two of three text changes would
  need two branches and two landings.
- **One tree, filtered at release**, with a declared file list. Rejected in #195: the development loop still reads
  the mixed root, and the host copies the catalog source folder whole, so a filter needs a release step that the
  hosts do not have.
- **Keep `README.md` at the root and move only its four cited sections.** Rejected: the README split is a part of
  #265. The front page stays a short root `README.md` and the whole `plugins/celetis/README.md` ships.
- **Remove the citations now** by moving the agent text of these documents into procedure modules. Rejected: that is
  the work of #264, which is ordered after this issue.

## Consequences

**What improves.** The installed cache of each host holds the plugin files and no program source. Each host cache has
the files of `plugins/celetis/` at the installed revision (Task 4 showed this for Claude). The gate refuses a
citation or a link that leaves the folder, and a TypeScript file in it.

**What gets harder.**

- **The one-time crossing of each machine.** The old program must not run `celetis update`: it installs the whole
  repository into the Claude cache through its `url` catalog, and its check then fails. The new program refuses the
  old Codex layout (the catalog source `"./"`), so its update has an error part and changes nothing. The
  maintainer runs the commands of `### Your steps` of the plan in the [plan comment](https://github.com/ddinkov10/celetis/issues/261#issuecomment-6729102229), "After the landing": the program install at the
  landed revision, the Claude marketplace update and plugin update (or the replacement uninstall and install), the
  Codex marketplace upgrade (or the replacement remove and add), then `celetis update check` and a daemon restart.
  No compatibility path reads the old layout.
- **The program still holds a copy of `plugins/celetis/`**, because the program install clones the whole tree. Nothing
  in the program reads that copy after this change. F21 (#251) removes it.
- **The cited documents ship whole**, with their maintainer parts, until #264 and #265.
- **`assist` and `intake` refuse more often.** A plugin at another revision stops them with the line of
  `requireSameRevision`, as it stops a step.

**Risks of the spec, and what the build showed.**

- **The inline settings marketplace with a `git-subdir` entry.** Task 4 showed the entry accepted, and an update from
  one revision to another reached the target with equal files and an empty offer. The Verify phase (V5) checks it on
  the final tree.
- **Codex can move the clone with no new cache copy.** Task 3 simulated the move with no cache copy, and the witness
  refused with `README.md is changed`. A real Codex upgrade that moves the clone without a copy was not run. Verify
  V4 cases (c) to (f) check the refusal.
- **Whether `claude plugin update celetis@celetis` reads a changed catalog source.** Task 4 used the new source in both
  revisions. The crossing from the old `url` catalog was not observed. Verify V8 settles it. The plan has
  pre-decided replacement commands for Claude and for Codex.
- **Open: a real Codex session writes a file into the plugin cache.** The witness then refuses with
  `<path> is extra`. The old witness refused an untracked file in the cache in the same way. No task observed a
  real session that writes into the cache.
- The native Claude and Codex updates across the crossing, and each refusal of `assist` and `intake` for a revision
  mismatch, are checked by the Verify phase of #261 (V7, V8). No result of them exists when this record is written.

## Reconsider when

- A host copies a catalog source outside its folder, or a Codex cache writes files that the witness must allow.
- #262 replaces the same-revision rule with a contract version.
- #251 removes the program copy of the plugin folder, or changes the program artifact.
- #264 or #265 moves agent text out of the documents that the plugin ships, or splits the documents.
- A second plugin appears in this repository, and the root catalog must name more than one folder.
