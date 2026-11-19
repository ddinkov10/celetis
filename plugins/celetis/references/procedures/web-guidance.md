# Web guidance

The consult of the skill `modern-web-guidance` when a step writes or decides the UI of a web
product. `implement` applies it to the build and the review of a task. `specify` and `bug` apply it
to their research.

## When

The product is of the kind web (`<plugin>/references/procedures/ui.md`, "The platform rows"): its
`AGENTS.md` names the kind, else the code shows it. The work writes or decides HTML, CSS, or
client-side JavaScript of that product. A change of only the backend, the tooling, the build
configuration, or the tests does not qualify. Work that does not qualify does not apply this
module, and prints nothing about it.

## The skill

The skill list of the session holds a skill named `modern-web-guidance`, alone or with the name of
its plugin first (`modern-web-guidance:modern-web-guidance`). Either name is the skill.

## The consult

Before the work, invoke the skill (the part of the host below), and follow its primary workflow:
one `search` for each capability or UI pattern of the work, `retrieve` of each matching guide, and
its compliance check of the code against the retrieved guides. The guides bind the code. The
approved spec, the plan, the principles, and the permission rules of the project rank above a
guide, and a guide changes none of them ("A conflict").

## The limits

- Run no `install`, `update`, `set-allow-origin-trials`, `set-allow-volatile-features`, or
  `legacy-scan` command of the skill, and write no `.mwgrc`. Do not install, update, or pin the
  skill.
- A guide that `retrieve` gates, for an Origin Trial or a volatile feature, stays unused.
- Copy no guide into the product or the plugin. The record holds the id and a short quote.
- Write no browser support policy. That policy is a fact of the `AGENTS.md` of the product. The
  record can name a suggestion of the skill.

## The record

The record of the step takes the place of the `### Modern Web Guidance` section that the skill
asks for.

- **In the research:** each applied guide is a finding line of `## Prior art`
  (`<plugin>/references/procedures/prior-art.md`, "Record"). Its product is the guide id with the
  skill, its version is the skill version of the `search`, its label is `(state of the art)`, its
  pattern holds the short quote, and its source is
  `https://github.com/GoogleChrome/modern-web-guidance/blob/main/skills/modern-web-guidance/guides/<category>/<id>.md`,
  with `<category>/<id>.md` the path of the guide under `guides/` in the folder of the skill. When the
  skill is unavailable ("Unavailable"), its one line is a limit sentence after the finding lines
  (`<plugin>/references/procedures/prior-art.md`, "No tool or no access").
  When the component research runs, a guide that states a behavior of the component is also a line
  of its `### Required behavior` list (`<plugin>/references/procedures/component-research.md`,
  "The record").
- **In the build:** one line of the task report starts with `Web guidance:`. It holds each applied
  guide id with its short quote. With no applied guide, it names the searched topics. When the skill
  is unavailable ("Unavailable"), it holds the one line instead. On the inline flow, the session writes the line to the
  ledger as `Task <N>: Web guidance: ...`.

## The review

The reviewer of a task that "When" covers reads the `Web guidance:` line of its report, runs
`retrieve` for each reported id, and checks the code against those guides. A covered task with no
`Web guidance:` line is a finding. A reviewer for whom the skill is unavailable prints the one line
of "Unavailable", checks the code against the reported quotes, and says so in its review; the
missing skill alone is no finding. On the inline flow, the final reviewer does this for each covered
task, from its ledger line.

## A conflict

When a guide contradicts the approved spec or the plan, follow the spec or the plan, and do not
change the design. Report the conflict with the guide id: in the build, as a concern of the task
report (`DONE_WITH_CONCERNS` of `superpowers:subagent-driven-development`), or, on the inline flow,
as a `Ruling:` line of the ledger; in the research, as a finding of the report of the step.

## Unavailable

The skill is unavailable when it is not in the skill list, its launch fails, or a command of its
workflow fails after the retries that the skill names. A command that the host sandbox blocks first
takes the approval procedure for a sandbox block of the host
(`<plugin>/references/procedures/entry.md`, "The contract"). Then print this one line, and go on
with the work:

`web guidance: modern-web-guidance is not available; <cause>.`

`<cause>` names the missing skill, the error of the launch, or the last error line of the command.
The line causes no stop and no hold, and changes no PASS. The record holds the line.

## Claude Code

- **The skill.** The skill list of the session holds the name. Invoke it with the Skill tool. A
  refused launch, for example by a deny rule, is a failed launch.

## Codex

- **The skill.** The available skills of the session list the name with the path of its
  `SKILL.md`. Read that file, and follow it. A failed read is a failed launch.
