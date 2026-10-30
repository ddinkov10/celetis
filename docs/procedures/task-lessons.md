# Lesson rules in task context

## Authoring

After the project-context reads, select every matched lesson whose rule constrains the actual
task. Inside each affected `Task <N>` heading's body, add `**Lesson rules:**` once. For each
applicable lesson, put its project lesson path immediately before its complete `## Rule` body.
Copy the body unchanged, with all Markdown, wording, and qualifications. Include only the rule
body and its source path, not the incident history or other sections.

Include every applicable rule. Repeat a shared rule independently in each affected task. A task
with no applicable lesson has no lesson section. The lesson file remains authoritative; the
task copy supplies context, not another rule store. Keep principle bodies in their canonical
files and carry their paths as before.

## Delivery

Before a task begins in either build flow, preserve its complete applicable lesson rules and
source paths in the implementer and task reviewer context. An inline session applies the same
rules to its own task. Give final reviewers the rules applicable to the changes they review.

Gate repairs, task review fixes, final-review fixes, Verify fixes, and landing fixes retain the
rules that still apply. Review and re-review receive the same updated rule context as the repair
implementer. When an earlier task brief or workspace is unavailable, reconstruct that context
from the current plan and applicable lesson files. This also applies on re-entry; it needs no
earlier transcript or saved task brief.

## Changed scope

When task or repair scope changes, use `<plugin>/docs/procedures/project-context.md` to scan the
existing lesson catalog for that scope and read each additional match in full. Select the rules
that constrain the changed task. Before implementation and review, put their complete bodies
and source paths in the task or saved repair brief, together with every retained applicable
rule. Deliver that updated context to each repair implementer, reviewer, and re-reviewer.
