# The lesson store lives in .celetis/lessons, and the ADR store stays in docs/adr

## Date

2026-11-10

## Related

- [Issue #285](https://github.com/ddinkov10/celetis/issues/285): the spec (body of the issue), and the
  [plan comment](https://github.com/ddinkov10/celetis/issues/285#issuecomment-6775203591). In this record, "the
  store probe", "the adoption probe", and "the setup sequence" name the probes of Tasks 1 and 2 of that plan, and a
  label such as `r2` or `g1` names a case of its probe table. "Prior art" and "Approaches" name parts of the spec.
- The [final review record](https://github.com/ddinkov10/celetis/issues/285#issuecomment-6776064246) of the build:
  it holds the output of each probe that this record cites, and two runs that the plan does not define. "The
  leftover probe" is the run of `recover` on an interrupted capture across the move of the pending folder. "The
  move recipe" is the run of the move command of "Consequences" in five start states.
- [ADR-0052](0052-setup-owns-required-configuration-and-host-wiring.md): its `## Supersedes` section names "the
  empty `docs/lessons/INDEX.md`" in the list of what setup no longer creates. That is the context of a removal and
  no current rule, so this record replaces no clause of it. Its sentence "A store writer creates a product
  directory only with its first record" holds no path and stays.
- [ADR-0071](0071-setup-reconciles-recorded-owned-wiring.md): the reconcile rule that removes the recorded old
  ignore line. This record applies it and replaces no clause of it.
- [ADR-0085](0085-the-plugin-lives-in-plugins-celetis.md), Decision 1, and its quote in
  [ADR-0091](0091-the-engine-is-one-name-and-the-folder-engine.md): "the ADRs, the lessons, and `AGENTS.md` stay at
  the root". The sentence holds no path and stays: the lessons of this repository stay at its root, in
  `docs/lessons/` now and in `.celetis/lessons/` after the move of its store.
- [ADR-0090](0090-a-contract-version-replaces-the-same-revision-rule.md): the raise rule of the contract version.
  This record applies it. Its example `{ "contract": 1 }` keeps the number of its date.
- [ADR-0031](0031-plugin-development-is-independent-of-adoption.md): no step looks at another product project, so
  the number of projects with a store at `docs/lessons/` is unknown.

## Supersedes

Only these clauses change. The accepted records keep their historical text and evidence.

- [ADR-0006](0006-domain-routing-and-the-domain-skills-go.md), Decision: "`docs/adr/` and
  `docs/lessons/INDEX.md` stay in the steps that read them." The steps read the lessons from `.celetis/lessons/`,
  through `lesson-store read active`. `docs/adr/` stays.
- [ADR-0012](0012-the-harness-is-the-plugin-celetis.md), Decision: a product project holds "its own stores
  `docs/adr/` and `docs/lessons/`". The lesson store is `.celetis/lessons/`. `docs/adr/` stays.
- [ADR-0068](0068-agent-curation-at-each-landing-activates-lessons.md), Decision: "a leftover
  `docs/lessons/INDEX.md` fails each read". The path of the leftover file is `.celetis/lessons/INDEX.md`. The rest
  of the record stays, with the decision of the maintainer that it holds: the lessons persist in git on `origin`.

## Context

The maintainer asked: "should the content produced by the celetis such as ADR and Lesson be in .celetis subfolder
in the product" (chat, 2026-11-10). No rule said where an output of Celetis lives in a product project, so each new
output needed a new decision. The two stores were in the document folder of the product: `docs/adr/` and
`docs/lessons/`.

The two stores are different in kind. An ADR is a record of the product, and people read it. The lesson store
belongs to the engine: `lesson-store` defines its format, validates each file, and refuses a file that it does not
know. An engine store in `docs/` had three effects:

- A file that the product put into `docs/lessons/` failed each lesson read, with
  `unrecognized lesson store file; review it explicitly`.
- `docs/` is the default source folder of a documentation site (MkDocs 1.6.1, `docs_dir`:
  https://github.com/mkdocs/mkdocs/blob/1.6.1/docs/user-guide/configuration.md).
- The edit scope of the skill `doc-drift-sync`, `docs/**/*.md`, contained the lesson files.

## Constraints and evidence

- A change keeps no backward compatibility (a rule of the maintainer). So the engine gets no reader of the old
  path, no move command, and no check for a leftover store.
- The lessons persist in git on `origin`
  ([ADR-0068](0068-agent-curation-at-each-landing-activates-lessons.md), "Constraints and evidence", decision 2 of
  the maintainer).
- The repository keeps no tests ([ADR-0029](0029-the-repository-keeps-no-tests.md)). Each check of the build is a
  scratch probe with temporary data and the entry of the lane checkout.
- Prior art (the spec, "Prior art"). adr-tools and MADR keep decision records in a visible document folder
  (`doc/adr`, `docs/decisions`). Kiro and OpenSpec keep all content of the tool in one tool folder (`.kiro/`,
  `openspec/`). Spec Kit v1.3.3 splits by owner: the tool folder `.specify/` holds what the tool manages, and the
  visible folder `specs/` holds the specifications of the product, which "is completely excluded from template
  packages and will never be modified during upgrades"
  (https://github.com/github/spec-kit/blob/v1.3.3/docs/upgrade.md). Claude Code keeps the notes that the agent
  learns outside the repository (https://code.claude.com/docs/en/memory.md).
- The hosts do not protect the folder. In Claude Code 2.1.322, the protected directories include `.git` and
  `.claude`; `.celetis` is not in the list (https://code.claude.com/docs/en/permission-modes.md). In the
  `workspace-write` sandbox of Codex CLI 0.167.0, `.git`, `.agents`, `.codex`, and `.aws` are read-only; `.celetis`
  is not in the list (https://learn.chatgpt.com/docs/agent-approvals-security). The plan comment, "External facts",
  holds a write check of each host.
- ripgrep 15.2.0 skips hidden files and directories by default
  (https://github.com/BurntSushi/ripgrep/blob/15.2.0/GUIDE.md).
- The contract digest covers no prose field and not the JSON of `lesson-store`, so the gate forces no raise of the
  contract version for this change. The digest is the same before and after it.

## Decision

1. **The answer.** The lesson store: yes, it lives in `.celetis/lessons/`. The ADR store: no, it stays in
   `docs/adr/`.
2. **The layout rule.** Three rules give each output of Celetis its place in a product project:
   1. A record that the product owns and people read lives at the conventional path of the product. The ADR store
      stays `docs/adr/`.
   2. A store that the engine owns lives in `.celetis/` at the root of the product project. The engine owns a store
      when an engine command defines its format, validates each file, and refuses a file that it does not know.
      The lesson store is the one such store today: `.celetis/lessons/`.
   3. The scratch and the wiring keep their paths. The config `.celetis.yaml` and the setup record
      `.claude/celetis/wiring.json` are files that an engine command validates too. Each is one file, not a folder
      of records, and this rule keeps its path.

   | Content | Path before | In git | Result |
   | --- | --- | --- | --- |
   | ADRs | `docs/adr/` | yes | stays |
   | Lessons | `docs/lessons/` | yes | moves to `.celetis/lessons/` |
   | Pending lessons | `docs/lessons/_pending/` of the main checkout | no | moves to `.celetis/lessons/_pending/` |
   | Drafts, captures, visuals, reports | `docs/superpowers/`, `.superpowers/` | no | stays |
   | Config, setup record, lane worktrees | `.celetis.yaml`, `.claude/celetis/wiring.json`, `.claude/worktrees/` | yes, yes, no | stays |

3. **One value in the engine.** `lessonsPath` of `engine/lib/lesson-record.ts` is `.celetis/lessons`. The pending
   folder, the queue, the journal, and the ignore file derive from it. Each `lesson-store` command and the lesson
   check of `land` follow the value. `lessonFile` takes the value as literal text and builds no pattern from it:
   the `.` of the value is a wildcard in a pattern, and `xceletis/lessons/a.md` then counted as a live lesson path.
   Only `.celetis/lessons/` is the store: a file of the product beside it in `.celetis/` is not refused (`r8`).
4. **The ignore line of setup.** Setup owns the line `.celetis/lessons/_pending/` in `.gitignore`. The scope of
   the setup record keeps the old line `docs/lessons/_pending/` beside the new one. The record of a wired project
   claims the old line, a claim outside the scope makes a record invalid, and the reconcile rule removes a recorded
   line that setup no longer owns.
5. **The contract version.** The plugin text and the engine both name the store path. The plugin needs contract
   version 2, and the engine serves only version 2. The plugin text of version 1 names `docs/lessons/`, which the
   engine does not read.
6. **No move in the engine.** The owner of each product project moves its store by hand ("Consequences"). This
   repository is such a project: the change that brings this record moves no file of `docs/lessons/`.

## Alternatives considered

The maintainer picked the split by owner (B of "Approaches") among A, B, and C. The specify session rejected D and
E before it offered the approaches.

- **A. All content in `.celetis/`**, with `.celetis/adr/`, as Kiro does. A hidden folder for decision records is
  against the convention of adr-tools and MADR, and people read ADRs. Each record of this repository moves, and each
  GitHub link to a record in an issue or in a landed commit breaks.
- **C. No change**, with a record that says so. `docs/` keeps a store that the engine owns, with the three effects
  of "Context".
- **D. A setting for the path of each store**, as `.adr-dir` of adr-tools. No product project asked for a path of
  its own, each reader would need the config, and the skill `record-architecture-decisions` already honors the ADR
  policy that the product names in its `AGENTS.md`.
- **E. The lesson store outside the repository**, as the auto memory of Claude Code. The lessons persist in git on
  `origin` ("Constraints and evidence"), and that decision stays.

## Consequences

- Each kind of output has one home, and a new output needs no new decision: the layout rule gives its place.
  `docs/` of a product project holds no store that the engine owns.
- **A product project sees no lesson until its owner moves the store.** After the update and before the move,
  `lesson-store read active` exits 0 with no lesson, and no message names the old folder (`r2`, and check `n1` of
  the adoption probe). The engine has no reader of the old path, no move command, and no check for a leftover
  store.
- **Setup must run again.** In a project whose setup record claims the old ignore line, `setup status` exits 3
  with `setup: missing: .gitignore: no line .celetis/lessons/_pending/; setup adds it`. The next `setup write`
  changes `.gitignore` and the setup record: the new line is there, and the old line is gone (the setup sequence).
  When `.gitignore` holds the old line two times, each `setup write` exits 3 with
  `setup: .gitignore: repeated recorded line docs/lessons/_pending/; remove the ambiguous copy by hand first` and
  changes no file, until the owner removes one copy. This is the rule of the reconcile for a repeated line; the
  build ran the write three times in that state (the final review record).
- **The move, by hand.** The tracked files move with
  `mkdir -p .celetis/lessons && git mv docs/lessons/*.md .celetis/lessons/`. The command moves the files, not the
  folder. A move of the folder, `git mv docs/lessons .celetis/lessons`, puts it inside `.celetis/lessons/` when
  that folder is there already, and each lesson read then exits 2 with `unrecognized lesson store file`. The folder
  is there after the move of the pending folder, and after a landing that made a lesson active at the new path.
  When a lesson of the same name is at both paths, the command stops with `fatal: destination exists` and replaces
  no file. The untracked `docs/lessons/_pending/` of the main checkout moves to `.celetis/lessons/_pending/` with `mv`,
  before the updated engine makes that folder. When the engine made it first, a `mv` puts the old folder inside
  the new one, and each `lesson-store read main` then exits 2 (the plan comment, "Decisions of the maintainer", 1).
  After both moves, in each order, the engine reads the same lessons and the same proposals with the same digests
  (the move recipe of the final review record).
- **An interrupted lesson write must be recovered before the update.** A journal of a write that stopped part way
  names its destinations by the old path. After the move of the pending folder, `lesson-store read main` exits 6
  with `incomplete transaction; run lesson-store recover`, and `lesson-store recover` exits 6 with
  `invalid or duplicate transaction destination` and writes no file. The build ran `recover` three times in that
  state with the same result (the leftover probe). The engine before this change recovers the same journal at the old path. So the owner
  reads the store, and runs `recover` when the read asks for it, before the update.
- **A published plan with a lesson line of the old path stops.** A lesson path that is in neither list of the read
  is a context problem at the next task boundary (`plugins/celetis/docs/procedures/task-lessons.md`, "Refresh").
  A new plan gives the new paths.
- **Git must not ignore `.celetis/lessons/`.** With the ignore rule `/.celetis/`, an apply of a review in a lane
  exits 6 with `cannot commit the lessons:`, rolls back, and keeps the proposal, so no lesson becomes active
  (`g1`). The pending folder ignores itself, as before.
- **A hidden folder.** A search with ripgrep skips `.celetis/` unless it has `--hidden`. The supported read is
  `lesson-store read active`, and a plan carries each lesson path, so no step depends on a search.
- **The plugin and the engine update together.** The gate refuses a tree whose plugin needs contract 1, with a
  line that starts with `verify: contract version: the plugin needs contract 1 and the engine serves 2` (the gate
  on a copy of the tree).
  At a step start, `requireContract` of `engine/lib/contract-check.ts` refuses a plugin whose version the engine
  does not serve; the build read this code and did not run it.
- **This repository** keeps its store at `docs/lessons/` until its maintainer moves it. Between the update and the
  landing of that move, the engine finds no lesson here, and a lane in that window plans and builds with no lesson
  rule. A record of this repository that links a lesson by the relative path `../lessons/` keeps its text, and that
  link does not resolve after the move.
- Not verified by the probes of the build: Linux and Windows (the probes ran on macOS), the transport between
  `celetis land` and the daemon (the land probe called the landing function directly), and how the real `gh`
  chooses its target (each probe used a fake).

## Reconsider when

- A host starts to protect or to hide `.celetis/`: a write there needs an approval, or a sandbox makes it
  read-only.
- A product project needs a path of its own for a store (approach D).
- The lessons leave git (the `Reconsider when` of the ADR-0068 record).
- People, not agent sessions, become the main readers of the lesson files. Rule 1 then applies to them.
