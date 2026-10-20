---
name: setup
description: Writes the wiring of the plugin celetis into a product project. Only a human starts it.
disable-model-invocation: true
---

**Host entry.** Before any step or response, including commentary or an announcement, bind `<plugin>` to the absolute prefix before `/skills/<name>/SKILL.md` in this loaded file's path. Read [the host operations](../../docs/hosts/entry.md) at `<plugin>/docs/hosts/entry.md` directly, before any product-path scan. The relative link starts in the absolute directory containing this SKILL.md. Complete its startup reads on each invocation, including a same-session handoff.

The session asks the questions and holds the approval; `setup` of the launcher makes each change of the project.

1. **The checkout.** Run in the main checkout of the product project, and enter no lane worktree. The project can have no launcher yet, so run each call as `<plugin>/scripts/celetis --agent <host> setup <sub-command>`, with `<host>` the host that runs this session.
2. **The tracker.** Ask which issue tracker the project uses. On each answer other than GitHub, say that only GitHub is supported now, and stop.
3. **The checks.** Run `check`. If it fails, show its output and stop. A warning is no stop: keep it for the report. After a pass, the current branch is the trunk.
4. **The hosts.** Ask: Claude, Codex, or both. For each chosen host, run `<plugin>/scripts/celetis --agent <chosen> root`. A failure is a warning with the install commands of `<plugin>/README.md` ("Each machine") for that host, not a stop. With both hosts, ask which one is the default host of the bare terminal and board commands.
5. **The landing.** When `.claude/celetis-flow/landing.json` is there, propose its value. Else read `.github/workflows/`. A PR check is a workflow whose `on` holds `pull_request` or `pull_request_target` with no `paths` or `paths-ignore` filter. A `branches` filter there must match the trunk, and a `branches-ignore` filter must not. Propose `pr` with one PR check or more, else `merge`. The maintainer confirms or changes it.
6. **The write.** Run `write --hosts claude|codex|claude,codex [--default claude|codex] --landing pr|merge` with the answers; `--default` goes with both hosts only. If it fails, show its output and `git status --short`, and stop.
7. **The report.** Show the output of `write`: the labels that it made, the warnings, and the changed paths. With `setup: no file changed` and no warning that the trunk is ahead of `origin`, say that the wiring is current, and end. Else show the commits ahead of `origin`, which the push carries. With a changed path, also show:
   - `git status --short`;
   - the `git diff` of each changed path, and each new file in full;
   - a reflow of `.claude/settings.json` lines other than the added entries, when there is one: the rewrite with `jq` splits an array on one line, changes CRLF to LF, and adds a missing final newline;
   - the parts of `AGENTS.md` that stay by hand: the verify gate, the architecture and the traps, and the acts that only the maintainer does (`<plugin>/README.md`, "`AGENTS.md`").

   Then ask one question: commit and push to `origin/<trunk>`? With no changed path, ask only to push.
8. **The push.** On a yes, run `push`. If it passes, show its output, `git log -1 --stat origin/<trunk>`, and `git status --short`. If it fails, show its output with the message of git, and stop; after `setup: the push failed`, say that the commit stays on the local trunk, and that a later run of this skill pushes it after the cause is fixed. When the message of git says that the trunk refuses direct pushes, say instead that the maintainer pushes the setup commit to a branch, lands it through a PR, and then updates the local trunk from `origin`. After `setup: the commit failed`, say that the files stay uncommitted, and ask the push question again when the maintainer has fixed the cause. On a no with a changed path, say that the files stay uncommitted in the main checkout, and that the resolver stops on a dirty tree until the maintainer commits or drops them. On a no with no changed path, say that the commits ahead stay on the local trunk.
9. **The hand-run test.** After a push that changed `AGENTS.md`, name the hand-run test of the step text and its command in a product project (`<plugin>/README.md`, "Tests").
