# The security review

How the security-review task of a plan uses the security skill `security-audit` on the diff of the
lane: the check for the skill, the one line when it is missing, the request, the findings, and the
issue comment. `plan` and `hotfix` cite it in the text of the task.

## The check

Run the check once, at the start of the task. Launch `security-audit` with the request of "The
review", as the host part below says. The skill is available when the skill list of the session
holds `security-audit` and that launch succeeds. Bind `<security-audit>` to the folder of the
loaded `SKILL.md`. A name in the list with a failed launch is a failed check: keep the exact error
in the task report.

This text is written against cloudflare/security-audit-skill c1c8a8c. The maintainer owns the
installation of `security-audit`. The lane only checks for it: it never installs or updates it,
and never makes it a dependency of the plugin `celetis`.

## Missing

When the check fails, print this one line:

`security: security-audit is not available; the security review does not run.`

Then complete the task with no change and no commit, and go on. The task has no PASS, and it is
no hold. The task report keeps the line.

## The review

The request leaves the skill no choice of mode. It says:

- This is a focused security review of the diff of the lane branch, in the guidance mode of the
  skill. It is not a complete audit: run no phase workflow, make no output folder, and write no
  report file.
- The scope is the diff from the merge base with the trunk to the start commit of the task:
  `git diff $(git merge-base origin/<trunk> <start>) <start>`, with `<start>` the commit of the
  lane at the start of the task. The review can read the unchanged code that the diff reaches.
- Run no product code: no build, no test, no server, and no other process of the product. A
  decisive fact that only a run can settle stays `needs_validation`.
- Give each finding its verdict (`confirmed`, `needs_validation`, or `rejected`), the boundary
  that it crosses, and its source path. A `confirmed` finding has its severity. A
  `needs_validation` finding has the exact open fact.

The prohibition of product code is for the review only. The failing check and the verify gate of a
fix in "The findings" are the lane's own checks, and they run as in each task.

## The findings

Sort each finding by its verdict and its place:

- **`confirmed`, of the change.** The change adds the finding or makes it reachable. Fix it in the
  task, test-first. First write a check in the verification form of the product (a regression
  test, or the check that the `AGENTS.md` of the product names), and see it fail. Then make the
  smallest source fix at the last trusted decision point, and see the check pass. When the product
  has no form of check that can reach the path, the task report says so for that finding, and the
  fix goes on with the source trace as its evidence. Each fix is a commit of the task that
  references `#<n>`.
- **`confirmed`, from before the change.** The change does not touch the code and does not make
  it reachable. Make no fix in the lane. The finding goes into the comment with its severity, as a
  finding that was there before the change.
- **`needs_validation`.** The finding goes into the comment with the boundary, the source path,
  and the exact open fact. The lane goes on with no hold.
- **`rejected`.** The finding goes only into the task report.

The comment is one issue comment for the lane. Its first line is `## Security review`, and it
lists each finding of the comment with its verdict, its boundary, its source path, and its
severity or its open fact. Post the comment only when it has one or more findings. Before the
post, read the comments of the issue. When a `## Security review` comment of the issue already
holds each finding of the new comment, post no second comment. Else write the comment to a file,
and post it with `celetis --agent <host> issue <n> comment <file>`.

The task report lists each finding with its verdict, its fix commit, and the link of the comment,
for the task reviewer.

A new run of the task after an interruption keeps each fix commit that exists. It runs the review
again from its own start commit, and the post rule above keeps a second comment with the same
findings off the issue.

## Claude Code

The skill list of the session holds `security-audit`. Invoke it with the Skill tool, with the
request of "The review" as its arguments. Bind `<security-audit>` to the base directory that the
launch prints. A refused launch, for example by a deny rule `Skill(security-audit)`, is a failed
launch.

## Codex

The available skills of the session list `security-audit` with the path of its `SKILL.md`. Read
that `SKILL.md`: `<security-audit>` is its folder. Then follow it with the request of "The
review". A failed read is a failed launch.
