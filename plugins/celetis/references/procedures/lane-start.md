# The lane start

The start of a lane. `bug`, `chore`, `feature`, and `hotfix` apply "The Iron Law" and "Before
step 1" after the Celetis entry and before their step 1, and "Start the issue" at the end of their classification
step, with their `<lane>` (`bug`, `chore`, `feature`, `hotfix`). The input of the lane is free
text or `#<n>`.

## The Iron Law

```
NO STEP SKIPPED. NO STEP REORDERED.
```

Each step is the next one's precondition. Perceived simplicity waives nothing: a small change runs
the same lane. If you have not completed step N, you cannot start step N+1.

## Before step 1

Run `celetis --agent <host> setup status` once, in the checkout of the entry. It is the first act
of the lane: it comes before each read of the issue, each issue write, each label change, and
each branch or worktree. Each new lane invocation runs it again, also after a classification that
hands the request to another lane. An entry stop (a denied read, an invalid `.celetis.yaml`)
comes first; after an entry stop, this check does not run.

- **Exit 0:** the project is wired. Go on to step 1.
- **Exit 6 in a sandbox:** a blocked observation, for example a tracker read with no network.
  Run the same command again once, with the same cwd, by the approval procedure for a sandbox
  block of the host (`<plugin>/references/procedures/entry.md`, "The contract"). Use the exit of that
  run.
- **Each other exit:** show the person each line that the command printed. Its report ends with
  the setup action, the line that starts with `Run /celetis:setup` or `Enter the main checkout`;
  a later warning line, for example of the event record, does not replace that action. The report
  is the last act of the lane: it runs no setup, writes no issue, comment, or label, and makes no
  branch or worktree. In a step session too, it posts no stop comment and changes no readiness
  label.

## Start the issue

### Free text

Create the issue first, and continue with its key: fill the template of
`<plugin>/references/procedures/intent.md` into a file, then run
`celetis --agent <host> issue create <intent>`. Then continue as "Any other issue" with the
key in the URL that it prints.

### An epic

Given `#<n>` whose issue carries `epic`: stop. An epic has no branch, and each child runs its
own lane.

### Any other issue

Run `celetis --agent <host> issue <n> route <lane>`.
