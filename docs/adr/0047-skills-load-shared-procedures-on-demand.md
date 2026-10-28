# Skills load shared procedures on demand, and entry is a facts block

## Date

2026-10-28

## Related

- [ddinkov10/celetis#105](https://github.com/ddinkov10/celetis/issues/105): the spec
  (`Spec: 2026-10-28`) and the plan, with its removal ledger.
- ADR-0013, ADR-0014, ADR-0015, ADR-0029, and ADR-0032: the clauses that "Supersedes" names.
- ADR-0006: domain knowledge lives in `AGENTS.md`. ADR-0031: plugin development is independent of
  adoption. ADR-0041: dispatch evidence is agent-reported.
- `docs/procedures/`, `engine/hooks/entry.ts`, `engine/lib/config-core.ts`, `stepHeader` and
  `hostArguments` in `engine/lib/session.ts`, `requireSameRevision` in `engine/update.ts`,
  `step-prompt.md`, `checkCitations` in `scripts/verify.ts`, `AGENTS.md` ("Where agent text
  lives"), `docs/hosts/claude-code.md`, and `docs/hosts/codex.md`.

## Supersedes

From ADR-0013, "The session reads custom parts with file tools", its Decision: "Each skill starts
with a required instruction to read its custom part using `Read` before any step or answer. The
session uses file tools to locate the root of its current checkout". Each skill now starts with
one entry line. On Claude Code, the native hook makes the permission-checked `Read`, finds the
checkout, and gives the session a facts block; the session makes no read for the entry. The
session makes the read itself only on Codex, and on Claude Code when the hook did not run. The
optional absence, the normal request for approval, and the stop on a denied read or another read
error stand.

From ADR-0014, "One workflow uses explicit host operations":

- Its Decision: "One host entry owns installed references, invocation, custom text, checkout
  binding, and dispatch operations." The module `docs/procedures/entry.md` owns the entry and the
  contract of an invocation. The worktree, landing, and dispatch operations live in the modules of
  those procedures, each with its `Claude Code` and `Codex` part. `docs/hosts/` holds maintainer
  references only. One set of skills, one step text, and the shared procedures for both hosts
  stand.
- Its Supersedes: "Codex uses a supported file-access operation exposed by its active session."
  Codex with a shell runs the configuration reader CLI at entry. With no shell, it uses a supported
  file access and the short rule list of "Entry without the hook".

From ADR-0015, "One repository YAML file owns Celetis setup":

- Its Constraints and evidence: "Native skill entry uses supported file tools and interprets the
  documented schema; it has no shell parser or config cache." On Claude Code, the hook parses the
  text of its native `Read` with the configuration code of the engine, bundled into
  `engine/hooks/entry.js`, and keeps a result cache for a `file_unchanged` read. On Codex with a
  shell, the reader CLI validates the file. No model interprets the full schema at entry.
- Its Decision: the words "or first borrowed reference" of "Native entry reads the whole active
  file once for each skill invocation or first borrowed reference". No skill reads another
  skill's `SKILL.md`, so no borrowed reference exists. The rest of that paragraph stands.

From ADR-0032, "Shared configuration operation snapshots", its Decision: the words "or first
borrowed reference" of "Native entry still reads its whole optional active file through the
host's permission-checked tools for each invocation or first borrowed reference". The rest
stands: no runtime snapshot replaces the read at entry, and the runner header carries no custom
text.

ADR-0029, "The repository keeps no tests, and the verify gate is its only check", keeps its rule
"no tracked test". This record adds one text check to its gate. For that check only, it reverses
decision 5 of the maintainer, "The text rules go with the tests", the rejected alternative "Move
the text rules into gate code", and the Consequence "No check of the skill text".

The landed records keep their text.

## Context

Each skill entry loaded full host manuals before the task started, and most of that text was
about operations that the step did not reach. Inside the skills, the same procedures (the lane
start, the worktree, the project context, the child dispatch, the landing, and the stop) appeared
in several skills in different words. The step text of the runner repeated the entry reads and
overrode skill text, so a session had to reconcile layers before it did the task.

The maintainer wanted one architecture of the skills and the text that they load: a change of one
procedure is an edit of one file, and a new skill is its own procedure plus citations of modules.
Success is preserved behavior with less repeated procedure. The lower cost of entry is a result,
not the goal.

## Constraints and evidence

- At `0a5d1f8`, a first Claude Code entry got `docs/hosts/entry.md`, `docs/hosts/claude.md`, and
  `docs/configuration.md` twice (28,797 bytes, as raw content and again with line numbers), plus
  the raw YAML. Codex read three documents (31,171 bytes) itself. The Host entry line was about 420
  bytes in each of 19 skills, and `step-prompt.md` (5,838 bytes) told the session to read
  `entry.md` again, which the Claude hook had supplied.
- About 30 phrases of the skills ("using the host operations") expected the whole host manual in
  context. `chore` borrowed the landing of `implement`, with `custom.implement`, through a
  borrowed skill entry.
- On macOS, a case-insensitive file system, Claude Code loaded `docs/hosts/claude.md` as a nested
  `docs/hosts/CLAUDE.md` memory file when a session read a file in `docs/hosts/`.
- `docs/configuration.md` held a copy of this repository's `.celetis.yaml`, which drifted (the
  #105 comment of 2026-10-26).
- The prior art (read on 2026-10-28): the Agent Skills specification has three tiers of progressive
  disclosure and file references one level deep; the Claude Code skills documentation says that
  `SKILL.md` names its supporting files and that Claude reads them only when needed; the Claude
  authoring practices keep references one level deep and give a file over 100 lines a table of
  contents; Codex reads the whole `SKILL.md` only when it uses the skill. An `@path` import of
  `CLAUDE.md` loads eagerly with the file that imports it, the counter-pattern.
- Claude Code 2.1.312: `skill.prompt` fires when the engine expands a skill, and a hooks module
  imports the plugin's own files. The hook runtime has no Node and no DOM, and its budget is
  10,000 ms. The types do not say whether `$.fs.read` applies the file permissions of the session.
- The parser spike of the plan ran the vendored `yaml` 2.9.1 and the pure configuration core in the
  hook runtime of Claude Code 2.1.312: 14 cases gave the results of the Bun reader, in 11.68 ms and
  12.34 ms for all 14.
- In the build of #105, a child agent's `Read` of a file that its parent had read returned
  `file_unchanged` with no content.
- Codex CLI 0.165.0 has no Celetis hook. The runner passes the step text as
  `developer_instructions`. The Codex runner prompt came from a wording test: its second
  sentence, the startup sentence, changed first-response compliance from 0 of 5 to 5 of 5.
- No product used the current Celetis, so no product text had to move (ADR-0031).

## Decision

**Three layers and one placement rule.** Agent text has three layers: the entry, at each skill
invocation; the skill, `skills/<name>/SKILL.md`; and the module, `docs/procedures/<name>.md`, when
a step of a skill names it. Text that two or more skills, or a skill and the step text, need is a
module. Text that one skill needs stays in it. Host-specific text lives only in modules, and a
skill never names a host tool. Engine-enforced policy is not restated. `custom.<skill>` reaches
only its own invocation, and a product fact that two or more skills need goes into the product's
`AGENTS.md`. The maintainer references are never read at entry. `AGENTS.md`, "Where agent text
lives", holds the rule.

**Modules on demand, one level deep, with host parts inside (Approach A).** Each module holds the
host-neutral procedure, then a short `Claude Code` and `Codex` part. A session reads a module
whole when its step comes. A module cites another module only for a branch that some runs take.
The target is under 100 lines, and a longer module starts with `## Contents`. The lines of the
other host load too, about 3 to 6 for each module: the criterion "only the selected host's
instructions" became "only when the step reaches the operation", and the maintainer accepted it.

**Entry is a facts block.** Each skill holds one entry line: bind `<plugin>` from the loaded
`SKILL.md` path, then read `<plugin>/docs/procedures/entry.md`. On Claude Code, the native hook
makes its permission-checked `Read` of the Git boundary and of `.celetis.yaml`, parses and validates
the text with `parseConfigText` and `validateConfig`, and puts a block in place of the line: the
host, the plugin root, the checkout, "The contract" of `entry.md` with its Claude Code part, and the
custom text. It gives no host manual and no raw YAML. `scripts/build.ts` embeds the contract at
build time; there is no runtime read of plugin text. A stop keeps the form
`Celetis entry stopped: <path> <field>: <message>` and the native stop of each later turn. A hook
that fails stops the entry. A hook that did not run leaves the entry line, and the session takes
"Entry without the hook", which uses the same native read. On Codex, the session takes that path:
with a shell, the reader CLI gives full validation; with no shell, a short rule list applies, and
`createOperation` validates the full file before each protected command. For a `file_unchanged`
read, the hook reuses its parsed result for that path, keyed by size and modification time; a
changed stat or no result stops the entry. A skill step that needs a configuration value other
than its custom text (`setup`, `guide`) reads it with the reader CLI only, not with a native read:
on Claude Code, a second native `Read` of `.celetis.yaml` returns `file_unchanged` with no content.
On Codex with no shell, such a step cannot get the value, and says so.

**A runner step gets a facts header.** `stepHeader` puts the step session, the issue, the step,
the host, the main checkout, the plugin root, and the landing mechanism before the step text. The
plugin root is the host-installed folder that `requireSameRevision` returns. Claude gets the text
through `--append-system-prompt`, and Codex through `developer_instructions`. The header holds no
custom text (ADR-0032). The step text holds only what differs in a step session and overrides no
skill. The Codex prompt keeps its first sentence byte for byte. Its new second sentence, the
startup sentence, is `Complete its Celetis entry before any response, including commentary.`, and
it needs a fresh compliance check.

**The host documents are maintainer references.** `docs/hosts/claude-code.md` and
`docs/hosts/codex.md` hold the integration facts and an index of the module of each host
operation. `docs/hosts/entry.md` is gone, and `docs/hosts/claude.md` became `claude-code.md`.

**The gate checks the citations.** `checkCitations` in `scripts/verify.ts` checks the skills, the
modules, and the step text: each `<plugin>/<path>` citation and each relative link names a tracked
file, each module has two or more citers, each `SKILL.md` holds the entry line once, and no skill
or module cites `docs/hosts/`.

**The removals.** The removal ledger of the plan of #105 maps each removed instruction to the
engine contract that enforces it or to the evidence of a no-op: the host-manual reads at entry,
the interpretation of the schema and the raw YAML at entry, the `file_unchanged` rule of the model,
the borrowed entry, the binding paragraph of the step text, the updater internals, the dispatch
counts and retry gating, and the rule that `guide` and `setup` need a human invocation. Text that
only moved into a module is no removal.

## Alternatives considered

- **B. Host-neutral modules, plus one host file for each operation.** Only the text of the
  selected host loads. Rejected: two reads for each operation, two or three files to edit for each
  change, and a reference chain two levels deep, which the prior art warns about.
- **C. The hook inlines the imports when the skill expands.** Rejected: eager loading on Claude
  Code, two delivery paths to keep in step, because Codex still reads the files, and the logic of
  the architecture inside the hook.
- **Keep the host manuals at entry.** Rejected: each entry keeps loading the manuals, and the
  repeated procedures keep drifting.
- **The runner supplies the custom text.** Rejected: it replaces the permission-checked read
  (ADR-0032), and a lane entry must read the lane's file, which the runner cannot know.
- **The hook reads bytes with `$.fs.read`.** Rejected: its permission semantics are not
  documented.
- **A hook that did not run stops the entry.** Rejected: the fallback uses the same native read,
  so no new access path opens.

## Consequences

- A change of one shared procedure is an edit of one module. A new skill is its own steps plus
  citations, and the gate refuses a citation of a file that is not tracked.
- On Claude Code, an entry gives the facts and the contract, not the manuals. Codex reads one entry
  module and the configuration.
- `chore` no longer applies `custom.implement`, and `lesson-review` no longer applies
  `custom.lesson`. A product fact that both skills of a pair need goes into the product's
  `AGENTS.md`, for example a landing rule or the lesson tags.
- The gate checks the citations, not that a session reads a module whole or follows it. The Verify
  phase of the plan of #105 records the live checks of both hosts in `docs/celetis-flow.md`,
  "Acceptance status".
- **Residual risks.** The hook parses the text that `Read` returns, not the bytes, so the strict
  UTF-8 check of the reader holds at each command, not at entry. An edit that keeps both the size
  and the millisecond of the modification time can reuse a stale cached result. The Codex startup
  sentence needs its fresh compliance check. On Claude Code, a model-run entry after a hook entry
  in the same agent loop gets an unchanged result with no content and stops.

## Reconsider when

- A host documents a permission-checked byte read for hooks, or a skill-time file inclusion with
  the same checkout and permission semantics.
- Live checks show that a session reads a module in part, reads it before its step, or skips it.
- Codex gets a lifecycle hook that can make the entry.
- The host parts of the modules grow beyond a few lines each, or a third host comes.
- The Codex startup sentence loses first-response compliance.
