# Runtime verification

Apply this procedure to post-change runtime checks used to claim PASS, including optional
checks in another lane. Pre-fix red reproductions, static checks, suite scheduling, and checks
by hand after landing keep their existing roles.

## Planning

For each runtime scenario in a plan or hotfix micro-plan, name the actual target, the source
identity, the methods that confirm both links below, and an independent behavioral oracle.
Use the project's existing runtime tools. A runtime with no usable identity stays unverified;
the plan must not assume a build-ID endpoint or add instrumentation to obtain one.

## Confirming a target

Before accepting PASS, make one evidence record per distinct target, with a local record ID:

1. Record the absolute source checkout, full commit, and clean or dirty state. For dirty source,
   retain `git diff --binary HEAD`, relevant untracked input contents, and a path/digest manifest.
   Include ignored inputs when they affect the build. A commit alone cannot identify dirty source.
2. Identify the actual executable and process/session, URL and server instance, device and
   application, or equivalent runtime target used by the scenario.
3. Establish **source to artifact/files**: capture observed commands/output or native evidence
   that the artifact or loaded files come from that source or retained snapshot.
4. Establish **artifact/files to target**: capture observed commands/output or native evidence
   that the tested instance actually uses that artifact or those files.
5. Associate the scenario result and its separate behavioral oracle with this record. Accept
   PASS only when both links are confirmed and that oracle succeeds.

Use an existing immutable artifact identity with source/build provenance and a matching runtime
identity; an exact direct-source entry path and invocation; or an already authorized controlled
build and launch with the resulting artifact and actual instance identified. A successful build
alone does not establish what the tested instance runs.

Examples of evidence appropriate to each runtime:

- **Device application:** retain source/build output and the package digest, then native evidence
  of that package installed and launched on the identified device/application instance.
- **Web:** identify the server process and its source or artifact, then the URL and asset content
  actually loaded by the tested browser. A fresh server alone cannot confirm cached assets.
- **Backend:** link the source/build to the executable digest, then that executable to the tested
  process/container instance and endpoint.
- **CLI/plugin:** record the resolved executable and exact checkout entry/invocation. For a
  plugin, retain observed host reads or native evidence of the resources loaded by that session,
  as well as evidence for any command under test. Files on disk do not prove a host loaded them.

A version label, timestamp, installation folder name, changed behavior, or files on disk are
insufficient alone when they do not identify the tested content. Keep checkout commands, loaded
plugin resources, and installed checks distinct. Editing source does not reload a process or
session. Confirmation permits no real installation update or other operation without its
existing authorization.

A confirmed stale target has no PASS. Correct it only through an already authorized operation,
reconfirm it, and repeat affected scenarios. An unknown target stays UNVERIFIED with the specific
missing evidence. Run independent checks, then use the existing stop of the calling skill
(`<plugin>/docs/procedures/stop.md`, "A Verify scenario that cannot run", in a step session).

## Evidence lifetime

Reuse one record across scenarios only while its source inputs, artifacts/files, and target
remain unchanged. A source edit, regenerated artifact, restart, reload, deployment, or target
switch requires renewed confirmation and scenario results for the affected target. Preserve
unrelated evidence and results whose inputs and instances did not change. Apply this rule after
a review or landing repair, and on re-entry, before relying on earlier results.

## Reports and deferred checks

Keep each source identity, target, both links, scenario result, and independent oracle together
in the runtime report. Publish it on the issue, or post a link to an existing durable report,
before recording build completion with `## Built` or `## Before landing`.
Use `gh issue comment <n> --body-file <report>`. Its first line is ordinary text, for example
`Runtime verification for #<n>`, and does not start with `## `. This report changes no resolver
state, clears no refusal, and never replaces a human completion report. Use the existing
`celetis --agent <host> issue` acts for workflow writes.

For a deferred runtime scenario, its `## Before landing` record also names the missing source
or running-build proof and the action that supplies it, alongside the existing scenario,
commands, expected result, and limitation. A scenario waiting for an act of "During the build"
retains that act's report form instead of commands that cannot yet run.

On re-entry, check each deferred scenario against the current build and "Evidence lifetime",
even with `open: none`. A trusted human completion report can carry or reference the same
runtime proof that an agent check must supply. Valid, unchanged evidence completes that scenario
without repeating it. Label removal can clear the workflow hold but supplies no runtime proof.
An act of "During the build" still needs its existing human report and label clearance, then
the waiting agent scenarios; a preparation report alone does not complete them.

For missing, incomplete, outdated, or invalidated runtime proof, keep the built change. Renew
affected confirmation and scenarios when authorized and runnable. Run independent checks.
If proof remains missing, restore `ready-for-human` with
`celetis --agent <host> issue <n> ready-for-human` as the last act, using the existing precondition
comment as its reason. If that comment does not name the new missing proof, publish an updated
`## Before landing` record by the calling skill's stop procedure instead. Never write the human's
report. Workflow clearance alone does not permit skipping an unverified scenario or landing.
