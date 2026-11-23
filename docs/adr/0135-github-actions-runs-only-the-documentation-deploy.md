# GitHub Actions runs only the documentation deploy of this repository

## Date

2026-11-23

## Related

- [Issue #385](https://github.com/ddinkov10/celetis/issues/385): the intent, and
  [its root cause](https://github.com/ddinkov10/celetis/issues/385#issuecomment-7113520159), which holds the answer of
  the maintainer.
- [The plan of #385](https://github.com/ddinkov10/celetis/issues/385#issuecomment-7113607500).
- [ADR-0037](0037-one-bun-version.md): its role "CI" names `test.yml`. The file keeps its Bun pin, so that role stays
  true.

## Supersedes

- [The harness is the Claude plugin `celetis`, and each product project wires it in](0012-the-harness-is-the-plugin-celetis.md),
  in part: in "Decision", the words "the private repository" of its first sentence and "The repository is private"
  of its item on the marketplace. The repository is public.
- [The repository keeps no tests, and the verify gate is its only check](0029-the-repository-keeps-no-tests.md), in
  part: in "Decision", the paragraph "CI", because `test.yml` stays and no longer runs; and in "Supersedes", the
  sentence "CI runs only the gate, on Linux with Bun 1.4.2."; and in "Consequences", the sentence "The workflow runs on
  the push to `main`, so a failure of the gate on the CI runner shows after the landing."
- [Native Windows uses kernel32 and spawned children](0034-native-windows-uses-kernel32-and-spawned-children.md), in part: in "Decision", item "The verify gate",
  the sentence "The Linux CI job stays the authority." No job runs the gate on Linux now.
- [The documents of a product are a Docusaurus website on GitHub Pages](0122-the-documents-of-a-product-are-a-website-on-github-pages.md),
  in part: in "Related", the words that the paragraph "CI" of ADR-0029 stays true; in "Decision", item 5, the
  sentence that names the acts of the maintainer before the first deploy, because the deploy also needs GitHub Actions
  turned on; and in "Consequences", the item that the build on a Linux runner and the deploy are not probed.

## Context

The maintainer made the repository public and asked to publish the documentation. GitHub Actions was off for the
repository, so `.github/workflows/docs.yml` never ran, and the repository had no Pages site. ADR-0122 named the Pages
source and the visibility as the acts before the first deploy, and did not name the Actions setting. With Actions on,
`.github/workflows/test.yml` also runs on each push to `main` and on each pull request, unless it is disabled.

## Constraints and evidence

All reads are from 2026-11-23, and the
[runtime report of #385](https://github.com/ddinkov10/celetis/issues/385#issuecomment-7114053413) holds them.

- Before the change, `actions/permissions` answered `enabled: false`, and `pages` and the public URL answered 404.
- `actions/upload-pages-artifact@v5` calls `actions/upload-artifact`, so the allowlist needs the GitHub-owned actions
  and not only the actions that `docs.yml` names.
- GitHub accepted the disable request for `test` while Actions was off.
- [Run 45263745757](https://github.com/ddinkov10/celetis/actions/runs/45263745757) of `docs.yml` on `main` passed its
  jobs `build` and `deploy` at `15d7692`. It is the first proof of the Linux build and the deploy.
- The environment `github-pages` allows deployments only from `main`.
- GitHub also lists five workflows of old check branches as `active`: `164-linux-v4.yml`, `193-v6-native.yml`,
  `bytes.yml`, `probe.yml`, and `rerun-proof.yml`. No branch or tag holds their files, so no push of a current ref
  starts them. GitHub can still re-run an old run of a workflow up to 30 days after its first run (ADR-0023).
- The fork approval policy is `first_time_contributors`, so a fork pull request can add a workflow, and only the run of
  a first-time contributor waits for approval.

The search of the records for `test.yml`, `CI runs`, and `Pages → Source`, and for "is private", found other matches
that stay out of "Supersedes". ADR-0037, ADR-0090, ADR-0115, and ADR-0119 describe the content of `test.yml`, which does
not change. ADR-0012 (its `pr` item), ADR-0022, and ADR-0025 have clauses that ADR-0029 already replaced, or context.
ADR-0001, ADR-0008, ADR-0009, and ADR-0122 (its probe) hold evidence of their time, and ADR-0020 names another repository.

## Decision

The maintainer chose this on 2026-11-23 (option 1, "Docs only", in the bug session of #385).

1. **GitHub Actions is on, with an allowlist.** `allowed_actions` is `selected`, `github_owned_allowed` is `true`,
   `verified_allowed` is `false`, and `patterns_allowed` is `["oven-sh/setup-bun@*"]`.
2. **The workflow `test` is disabled.** Its state is `disabled_manually`, and the file `.github/workflows/test.yml` stays
   unchanged. A push or a pull request starts no run of it.
3. **`docs.yml` deploys the site.** It is the only enabled workflow that a branch or a tag holds. Each push to `main` publishes `https://ddinkov10.github.io/celetis/`.
4. **The `merge` landing stays the check of a change.** `land` runs `scripts/verify.ts` as its suite on the commit that
   it lands. A run of `test` after that push could not stop the landing.

## Constitution

Read: `CONSTITUTION.md`, amended 2026-11-12.

- Serves: 1 Intent to release: the documents that land reach their readers.
- Hard limits and non-goals: none touched. The landing path and its checks do not change.

## Alternatives considered

- **Keep `test` on.** It repeats the gate after the landing, on Linux, and it cannot stop a landing that already
  happened. The maintainer did not choose it.
- **Keep Actions off.** `docs.yml` cannot run, so the site cannot deploy through the workflow of ADR-0122.

## Consequences

- A person with no GitHub login can read the site, and each push to `main` deploys it.
- No job runs the verify gate on Linux. A defect that shows only on Linux can land.
- A workflow step that uses an action outside the allowlist fails until the maintainer changes the allowlist.
- "Only" describes the workflows of the branches and the tags, and it is no enforced limit. A new branch or a fork pull
  request that adds a workflow file can run it, and an old run can be re-run. The allowlist limits `uses:`, not `run:`.
- The actions of `docs.yml` stay on their tags. The allowlist limits their owners and does not pin their commits.
- A failed deploy shows only in GitHub Actions, and the site keeps its last good version.

## Reconsider when

- The landing of this repository changes to `pr`, which needs a passing check on the pull request.
- The maintainer wants a Linux check of each change.
- A workflow needs an action outside the allowlist.
