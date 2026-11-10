# The engine is one name and the folder engine/

## Date

2026-11-10

## Related

- [Issue #283](https://github.com/ddinkov10/celetis/issues/283): the spec (body of the issue), and the
  [plan comment](https://github.com/ddinkov10/celetis/issues/283#issuecomment-6764811385), which holds the plan
  with its "After the landing" list. In this record, "Approaches" names a part of the spec.
- [Issue #278](https://github.com/ddinkov10/celetis/issues/278): the opening text that named "the application shell".
- [ADR-0075](0075-the-names-of-the-workflow-the-daemon-and-a-run.md): the precedent. It renamed "runner" with no
  old name left in the commands, the files, the lines, and the current documents. It kept the lessons as written.
- [ADR-0089](0089-each-component-keeps-its-reference-beside-it.md): `engine/README.md` and
  `engine/board/README.md` keep their homes. None of its clauses names the root entry, so none changes. Where it
  says "program line", the engine is meant (Decision, point 5).

## Supersedes

Only these clauses change. The accepted records keep their historical text and evidence.

- [ADR-0085](0085-the-plugin-lives-in-plugins-celetis.md), Decision 1, "The layout": "The program, `engine/`,
  `scripts/`, the ADRs, the lessons, and `AGENTS.md` stay at the root." The engine is the folder `engine/`, with
  its entry `engine/celetis`, so the entry does not stay at the root. `scripts/`, the ADRs, the lessons, and
  `AGENTS.md` stay at the root.
- [ADR-0042](0042-one-celetis-program-for-both-hosts.md):
  - "The entry": "The root file `celetis` (mode 755, no extension)". The entry is the file `engine/celetis`, with
    mode 755. It holds `bunShebang` and the one import of `engine/launcher.ts` as before.
  - "The layout": "a symbolic link to the file `celetis` of the current version folder", and the Windows
    shims that read the revision in `current`. The link and the shims point to
    `versions/<revision>/engine/celetis`.
  - "The update": the part name `program` in "three parts (program, `claude`, `codex`)". The part name is
    `engine`.
- [ADR-0083](0083-a-library-starts-a-celetis-process-through-the-program-entry.md), Decision: "only through the
  program entry `<root>/celetis` and that form". The entry is `<root>/engine/celetis`, and
  `daemonArgv(root, form)` of `engine/lib/daemon-start.ts` gives it. The other clauses do not change.

## Context

At `5cfd9da`, the current text used three names for the application half of Celetis: "the program", "the
engine", and "the application shell". The entry `celetis` was at the root, and its runtime was in `engine/`. The
maintainer asked for a cleaner name than "the program" and for one folder for the whole module.

## Constraints and evidence

- The command stays `celetis`. No sub-command, form, exit class, or install path under `<base>/.local/` changes.
- Prior art (the spec): Docker Engine and the Dagger Engine use "engine" for the runtime that a CLI client
  drives. Terraform uses "Core" for its binary.
- The engine installs by a Git clone of the repository into a version folder. The new code reads a link or
  shim of the old layout as foreign.
- The rules of the maintainer forbid a compatibility layer, so no code reads both layouts.

## Decision

1. **The name.** "The engine" names the module: the folder `engine/`, with its entry `engine/celetis`, its
   daemon, its board, and its runtime. A place that needs a proper name says "the Celetis engine". Celetis has two
   modules: the plugin `celetis` and the engine. In current text, "the application shell" and "the program" are
   not names of the engine.
2. **The folder.** The entry is `engine/celetis`, which `scripts/build.ts` writes. The native type environment
   is `engine/hooks/tsconfig.json`. `scripts/`, `docs/`, `AGENTS.md`, `README.md`, `DESIGN.md`, `PRODUCT.md`,
   `.impeccable/`, and the repository configuration stay at the root. The version folder stays a full clone at
   `<base>/.local/share/celetis/versions/<revision>/`, and `celetis root` prints it.
3. **The reach.** The rename reaches the current documents, the agent text, the help text, the printed lines,
   the board text, the machine values (the update part `engine`, and the event placeholder `<engine>`), and the code
   names (`engine/lib/installation.ts`, `readEngine`, `installEngine`). This follows ADR-0075.
4. **The install.** The install links `<base>/.local/bin/celetis` to `versions/<revision>/engine/celetis`, and it
   refuses a revision with no `engine/celetis` before it changes the link or a shim. A link of the old layout is
   foreign.
5. **The records.** "The program" in an earlier record names the engine. No earlier record changes. The lessons keep
   their text, as in ADR-0075.

## Alternatives considered

Names (Approaches of the spec):

- **Core** (Terraform). It clashes with "the hc core" in the Herdr lab rules of `AGENTS.md`.
- **CLI** (GitHub CLI). The daemon and the board are not a CLI. The name clashes with "the reader CLI" and with
  the host CLIs.
- **The app.** It clashes with "the Herdr app".
- **The runtime.** It clashes with runtime checks and "Runtime PASS".
- **The application shell.** The name is long, and "shell" names the OS shell in the entry contract.
- **Keep "the program".** The maintainer rejected it.

Layouts and reach:

- **Keep the entry at the root.** The maintainer rejected it: everything about the engine lives in a folder.
- **A root link or shim to `engine/celetis` for earlier installs.** It is a compatibility layer.
- **Rename the prose only, and keep the code names and the machine values.** Two names would stay, and a reader of
  the code would meet the old one.

## Consequences

- One name names one thing in current text, and the entry, the native types, and the runtime of the engine are in `engine/`. The board design files
  `DESIGN.md`, `PRODUCT.md`, and `.impeccable/` stay at the root.
- The command `celetis` and the install paths do not change.
- A one-time break for an earlier install. An engine installed before #283 runs its own install code at
  `celetis update`. After it updates the plugins, it refuses the engine part with exit 3 (`celetis: revision <R>
  has no celetis program file; the program did not change`), because that code needs `<version folder>/celetis`. The
  board control **Update and restart** fails the same way. The maintainer does the five steps of "After the
  landing" in the
  [plan comment](https://github.com/ddinkov10/celetis/issues/283#issuecomment-6764811385) one time. No code
  bridges the two layouts.
- Records and lessons keep "the program" and `program`, so a search of the repository finds both words. The
  active lesson `declare-the-exit-classes-of-each-layer-that-runs-a-command` says "the program entry". It means
  the engine entry.
- Event records written before #283 keep the placeholder `<program>`. Nothing migrates them.
- The contract digest covers no prose field, so no check catches a mixed pair of an old engine and a new plugin
  (ADR-0090). The pair exists only between the reinstall and the plugin update.

## Reconsider when

- The engine splits into modules that need separate names or folders.
- A release channel (#251) installs the engine in another form than a Git clone of a version folder.
