# Runtime verification

Apply this procedure to post-change runtime checks used to claim PASS, including optional
checks in another lane. Pre-fix red reproductions, static checks, suite scheduling, and checks
by hand after landing keep their existing roles.

## Contents

- **Planning:** define runtime scenarios and their acceptance.
- **Confirming a target:** link the tested source, loaded content, target, and oracle.
- **Evidence lifetime:** renew evidence affected by changes.
- **Usage-limit exception:** decide whether explicit host usage limits permit landing.
- **Reports and deferred checks:** publish evidence and preserve existing human holds.

## Planning

For each runtime scenario in a plan or hotfix micro-plan, name the actual target, the source
identity, the methods that confirm both links below, and an independent behavioral oracle.
Use the project's existing runtime tools. A runtime with no usable identity stays unverified;
the plan must not assume a build-ID endpoint or add instrumentation to obtain one.

Apply "Usage-limit exception" to host checks in every lane, in interactive and step sessions.
The plan uses that decision before requiring a new runtime hold or a separate human quota waiver.

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

## Usage-limit exception

Before creating or restoring a new runtime hold, evaluate these conditions together:

1. One supported host completed every required runtime scenario applicable to that host for this
   change. Each PASS has valid source, target, loaded-resource, and independent oracle evidence
   under "Confirming a target" and "Evidence lifetime". A project gate PASS alone is insufficient.
2. The other host explicitly reports an exhausted weekly, usage, or session allowance that
   prevents its remaining host checks from running or finishing. Keep the actual diagnostic.
   A prediction of quota exhaustion is insufficient.
3. That usage limit is the only outstanding cause of incomplete checks on the other host.
   A failed assertion or behavioral mismatch remains FAIL, including beside a quota diagnostic.
4. The project gate, required reviews, and every other landing prerequisite pass under their
   existing rules. Existing human holds retain their completion requirements below.

Apply the rule equally to Claude Code and Codex. The passing host need not execute operations
that exist only on the blocked host. This accepts incomplete coverage, never host parity.
A generic HTTP 429, timeout, connection failure, missing login, missing tool, unsupported model,
permission denial, invalid target proof, or context-length error does not qualify by itself.
Mixed quota and non-quota causes retain ordinary failure, renewal, and stop handling.

When all conditions hold, publish the normal runtime report before build completion, with:

- The passing host's version and surface, source identity, target confirmation, scenario results,
  and oracle evidence.
- The blocked host's version and surface, attempted invocation, preserved output path or link,
  exact observed diagnostic, and reset time only when the host supplied one.
- Each incomplete or partially completed scenario as BLOCKED, with its preserved-output reference.
  Identify each host-only scenario left unrun after the same confirmed refusal and that reason.
- An explicit decision that the usage-limit exception permits the normal landing path, naming
  the checks still incomplete and stating that no full host-parity claim is made.

Keep BLOCKED distinct from PASS. Invent no reset time or claim that a reset has happened.
An eligible decision needs no separate waiver request, quota-only `## Before landing` comment,
or `ready-for-human` write. Every other prerequisite and the existing landing command still apply.

This rule prevents new quota-only holds. It clears no existing human hold, replaces no existing
`## Before landing` completion rule, and rewrites no issue history. For an existing hold, first
read `<plugin>/docs/issue-tracker.md`, "Completing a human precondition", and confirm the evidence
that its kind requires. Preserve unmet requirements even with an absent label or `open: none`.
After a repair or re-entry, renew invalidated passing evidence before applying the exception;
unchanged valid evidence needs no repeat.

## Reports and deferred checks

Keep each source identity, target, both links, scenario result, and independent oracle together
in the runtime report. Publish it on the issue, or post a link to an existing durable report,
before recording build completion with `## Built` or `## Before landing`.
Use `gh issue comment <n> --body-file <report>`. Its first line is ordinary text, for example
`Runtime verification for #<n>`, and does not start with `## `. This report changes no resolver
state, clears no refusal, and never replaces a human completion report. Use the existing
`celetis --agent <host> issue` acts for workflow writes.

Apply "Usage-limit exception" before creating or restoring a new runtime hold, including after
a repair and on re-entry. Publish its report when eligible; otherwise use the ordinary handling
below. Existing human holds always keep their completion requirements.

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
