# Lesson rules in task context

The lesson file in the task checkout is the authority for its rule. A copy in a plan or brief
is a versioned lead to that file, never another rule store.

## Authoring

After the project-context reads, select every active lesson whose rule constrains the actual
task. Copy rules only from the `active` records of that `lesson-store read active` result.
Inside each affected `Task <N>` heading's body, add `**Lesson rules:**` once. For each
applicable lesson, put a line with its project lesson path and the `digest` that the read
printed for it, then its complete `## Rule` body:

```markdown
`.celetis/lessons/{name}.md` sha256:{digest}
```

Copy the body unchanged, with all Markdown, wording, and qualifications. Include only the rule
body, its path, and its digest, not the incident history or other sections.

Include every applicable rule. Repeat a shared rule independently in each affected task. A task
with no applicable lesson has no lesson section. Keep principle bodies in their canonical files
and carry their paths as before.

## Refresh

A boundary is the start of a task in either build flow, the start of the final review, and the
start of each repair: a task-review fix, gate repair, final-review fix, Verify fix, or landing
fix. A changed task or repair scope, re-entry, and a rebuild of a lost saved brief are also
boundaries. At each boundary, before an implementer or reviewer starts:

1. Run `celetis --agent <host> lesson-store read active` in the task checkout. It reads the
   lessons of that checkout, not newer versions in the main checkout.
2. For each lesson path that the plan or an earlier brief of this work carries:
   - **An `active` record:** carry its current complete `## Rule` body and digest. This
     replaces an older copy.
   - **A `history` record:** drop its rule. Its `replacement` names a lesson to check: carry
     that active rule only when it constrains the task.
   - **In neither list:** a context problem.
3. Scan the other `active` records for the task or repair scope. Read each new match in full and
   add each rule that constrains that scope.

The result is the complete rule set of the boundary. A running implementer or reviewer keeps its
brief until its next boundary.

A nonzero exit of the read, or a referenced path in neither list, is a context problem. Before
that task or repair starts, stop by `<plugin>/references/procedures/stop.md` with the path and cause.

When a carried rule requires work outside the approved task or repair scope, or contradicts it,
keep the approved scope. Before that task or repair starts, stop by
`<plugin>/references/procedures/stop.md` with a resolution request that names the lesson path, its
digest, and the conflicting part of the scope.

## Delivery

Give the implementer and the reviewer of a task or repair the same rule set from its boundary,
with each path and digest. An inline session applies that set to its own work. Final reviewers
receive the rules that constrain the reviewed changes. A re-reviewer receives the set of the
repair it checks.

A resumed child keeps its earlier brief in context. When a repair or re-review resumes a kept
child, its message states that the new set replaces every earlier lesson rule of that child. The
message lists as withdrawn, by path only, each lesson path of the earlier brief that the new set
does not carry.

A saved repair brief carries the rule set of its boundary. When an earlier task brief or the
workspace is unavailable, rebuild the set by "Refresh" from the current plan and the repair
scope. This needs no earlier transcript.
