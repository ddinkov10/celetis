# Project-owned verification recipes

A recipe supplies reusable execution instructions. The calling skill's runtime verification
procedure remains the authority for acceptance evidence, target confirmation, evidence lifetime,
and failures. Historical success never supplies a current PASS.

## Planning

Follow the project's `AGENTS.md` verification pointer to its named feature-map section or index,
then read only recipes relevant to the change. With no pointer or relevant recipe, define the
normal runtime scenarios. A missing recipe or incomplete map creates no capture task, inventory,
extra run, or hold. The map describes documented flows, not required acceptance coverage.

Cite useful recipes and their actual helper invocations in the plan. Add the change-specific
expected results, current target confirmation, and independent behavioral oracle. Cover required
behavior that has no recipe too. Treat stale instructions as investigation leads; resolve them
against current source and requirements without weakening acceptance.

## Execution and retention

Before building an affected task, read its cited recipes through the project pointer, limited
to the flows it uses. Include affected recipe edits in the normal task and review scope. During
Verify, use the instructions for the already-required scenarios without adding another run.

Retention is optional and uses knowledge available from earlier execution records or current
implementation checks. Prefer an existing project document. When the project permits and chooses
a new document, `docs/verification.md` is the default, not a required path. Keep a short pointer
in `AGENTS.md` to the document's feature-map section or an existing index. The map links only
documented flows; it needs no empty entries or native skill installation.

A useful recipe supplies or links:

- The product surface, test data, and authorized prerequisites.
- Startup or instance selection, readiness, and target confirmation.
- Actions through supported interfaces, using existing tools and stable handles.
- The visible outcome and independent observation of relevant side effects.
- The evidence destination and owned resources, with cleanup that preserves evidence.
- Known limits and the execution reference, when one exists.

Reuse existing helper invocations instead of copying their internals. Store no secrets. A recipe
grants no permission for shared or external state changes; each operation keeps its authorization.

Retain useful instructions before the existing final review. The already-required scenarios can
exercise them once. Steps first discovered after that review stay in the normal runtime report
for a later change to retain. Do not edit reviewed files solely to capture a recipe or execution
reference. Omit optional retention when it requires another verification cycle or new access;
it authorizes no post-landing commit.

Before describing a recipe as exercised, compare its commands, prerequisites, actions, and cleanup
with the retained execution record. Identify the covered source and environment. Exact
transcription needs no repeat run and gives no permanent verified badge. Changed executable
instructions and uncovered environments stay explicitly unverified until exercised. Preserve
the original execution identity; documentation capture does not identify a new running build.

During normal work, correct only affected instructions and map entries used by the change.
Remove obsolete references. Leave unrelated flows alone. A source-confirmed path or name repair
does not establish runtime success. A stale recipe does not excuse a failed required scenario,
and a product regression does not justify a weaker expected result. Keep blocked or unexecuted
coverage explicit under the existing runtime procedure. Recipe absence or an unverified recipe
alone creates no hold; an unverified required scenario keeps its existing handling.
