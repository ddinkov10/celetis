# The lane start

The first act of a lane after its classification sentence. `bug`, `chore`, `feature`, and
`hotfix` cite it with their `<lane>` (`bug`, `chore`, `feature`, `hotfix`) and their `<label>`
(`bug`, `chore`, `enhancement`, `hotfix`). The input of the lane is free text or `#<n>`.

## Free text

Create the issue first, and continue with its number: fill the template of
`<plugin>/docs/procedures/intent.md` into a file, then run
`gh issue create --label <label> --title "<one line>" --body-file <intent>`.

## An epic

Given `#<n>` whose issue carries `epic`: stop. An epic has no branch, and each child runs its
own lane.

## Any other issue

Make `<label>` its only lane label with `celetis --agent <host> issue <n> route <lane>`. It adds
`<label>` when the issue lacks it, and removes `needs-triage` and each other lane label (`bug`,
`enhancement`, `hotfix`, `chore`) that the issue carries, because `celetis --agent <host> worktree`
names the branch from the lane label.
