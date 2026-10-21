# CI verification duration and freshness

Researched 2026-10-21. Only primary sources count as verified. Many primary hosts were blocked from the research environment (martinfowler.com, dora.dev, docs.github.com, docs.gitlab.com, abseil.io, uber.com, github.blog, and others). Where the site's source is published in a public repository, the claim was read from that source file. The table gives both the public URL and the source file used.

## Summary

- Commit-stage / pre-merge check: the target is "a few minutes". The upper limit is about 10 minutes (DORA, from the 2018 State of DevOps report, p. 56).
- Google TAP: the average wait to submit a change is around 11 minutes. Longer tests run after submit.
- Chromium CQ: the median trybot cycle time must be under 40 minutes. The 90th percentile should be around 1 hour.
- Full pipeline: no verified primary source gives a single number. The DORA pattern is to move slower tests into later deployment-pipeline stages, so that the commit stage stays under about 10 minutes.
- Freshness: GitHub merge queue, GitLab merge trains and bors define a valid result by the exact base commit that was tested, not by wall-clock time. A result is valid only for the tested combination of base plus queued changes.
- Chromium CQ is the one primary source with a tolerance window. It reuses a passing build while the branch has moved fewer than N commits (example: 800 on `main`), or for up to 24 hours where no commit-distance window is set.

## Duration findings

| Source | Stage | Number | Quote | URL |
| --- | --- | --- | --- | --- |
| DORA, Continuous integration capability | Commit build and tests | A few minutes; upper limit about 10 min | "The tests should not take more than a few minutes to run, with an upper limit of about 10 minutes according to DORA's research" | https://dora.dev/capabilities/continuous-integration/ (source: https://raw.githubusercontent.com/dora-team/dora.dev/main/hugo/content/capabilities/continuous-integration/index.md) |
| DORA, Continuous integration capability | Commit build and tests | A few minutes | "Each commit should trigger a series of automated tests that provide feedback in a few minutes." and "The tests must also run in a few minutes or less." | same as above |
| DORA, Continuous integration capability | Overflow tests | Not a number | "If your build takes longer than this, you should improve the efficiency of your tests, add more compute resources so you can run them in parallel, or split out longer-running tests into a separate build using the deployment pipeline pattern." | same as above |
| DORA, Continuous integration capability | Broken build repair | A few minutes | "If the build can't be fixed in a few minutes, the change that caused the build to break should be identified and reverted." | same as above |
| DORA, Test automation capability | Test feedback (local and CI) | < 10 min | "Developers should be able to get feedback from automated tests in less than ten minutes both on local workstations and from the continuous integration system." | https://dora.dev/capabilities/test-automation/ (source: https://raw.githubusercontent.com/dora-team/dora.dev/main/hugo/content/capabilities/test-automation/index.md) |
| DORA 2018 Accelerate State of DevOps Report, p. 56 | Test feedback | < 10 min | "Being able to get feedback from automated tests in less than ten minutes both on local workstations and from a CI server" | https://dora.dev/research/2018/dora-report/2018-dora-accelerate-state-of-devops-report.pdf#page=56 |
| DORA, Trunk-based development capability | Build and test | A few minutes | "The build and test process should execute in a few minutes." | https://dora.dev/capabilities/trunk-based-development/ (source: https://raw.githubusercontent.com/dora-team/dora.dev/main/hugo/content/capabilities/trunk-based-development/index.md) |
| DORA, Trunk-based development capability | Branch lifetime | A few hours | "branches in trunk-based development typically last no more than a few hours" | same as above |
| Software Engineering at Google, ch. 23 "Continuous Integration" | TAP presubmit (submit wait) | ~11 min average | "the average wait time to submit a change is around 11 minutes, often run in the background." | https://abseil.io/resources/swe-book/html/ch23.html (source: https://raw.githubusercontent.com/abseil/abseil.github.io/master/resources/swe-book/html/ch23.html) |
| Software Engineering at Google, ch. 23 | TAP scale | 50,000 changes/day | "Every day it is responsible for handling more than 50,000 unique changes and running more than four billion individual test cases." | same as above |
| Chromium CQ docs | Pre-merge trybots | Median < 40 min; p90 ~1 h | "Median cycle time needs to be under 40 minutes for trybots. 90th percentile should be around an hour (preferably shorter)." | https://chromium.googlesource.com/chromium/src/+/main/docs/infra/cq.md (source: https://raw.githubusercontent.com/chromium/chromium/main/docs/infra/cq.md) |
| trunkbaseddevelopment.com, Continuous Integration | Pre-merge CI | Minutes (no exact number) | "The CI verification takes minutes, and a review that takes days undoes that." | https://trunkbaseddevelopment.com/continuous-integration/ (source: https://raw.githubusercontent.com/paul-hammant/tbd/master/content/continuous-integration/index.md) |

## Freshness findings

Freshness is defined by the base commit that was tested. Wall-clock age does not matter in the merge-queue designs below.

- GitHub branch protection, "strict" mode: "The branch **must** be up to date with the base branch before merging." The trade-off: "More builds may be required, as you'll need to bring the head branch up to date after other collaborators update the target branch." In "loose" mode: "Status checks may fail after you merge your branch if there are incompatible changes with the base branch." Source: https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches (file `content/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches.md` in `github/docs`).
- GitHub merge queue: "The merge queue will ensure the pull request's changes pass all required status checks when applied to the latest version of the target branch and any pull requests already in the queue." Also: "the changes in the pull request are grouped into a `merge_group` with the latest version of the `base_branch` as well as changes from pull requests ahead of it in the queue." When an entry ahead fails, "The merge queue recreates the temporary branch" without it. CI must trigger on the `merge_group` event or on `gh-readonly-queue/{base_branch}` branches. The only time setting is a "Status check timeout", which limits how long the queue waits for CI. It is not a freshness window. Source: https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/configuring-pull-request-merges/managing-a-merge-queue (files `managing-a-merge-queue.md` and `data/reusables/pull_requests/merge-queue-overview.md` in `github/docs`).
- GitLab merge trains: "Merge trains prevent this by testing each merge request against the combined changes of every merge request ahead of it in the queue." When the train changes, "The old pipelines were comparing against the previous combined changes in the merge train, which are no longer valid, so these old pipelines are canceled." If a merge request skips the train, "the changes in the merge request that skipped the train are not verified against any of the other merge requests in the train." Source: https://docs.gitlab.com/ci/pipelines/merge_trains/ (file `doc/ci/pipelines/merge_trains.md` in `gitlab-org/gitlab`).
- bors-ng: bors merges the main branch with the batch into a `staging` branch. "If the build passes, the main branch gets fast-forwarded to meet the staging branch. Since the main branch contains the exact contents that were just tested, bit-for-bit, it's not broken." Source: https://github.com/bors-ng/bors-ng (README).
- Chromium CQ build reuse: this is the one primary source that accepts a stale result inside a window. Two windows exist:
  - "Builders configured with a commit-distance window (e.g. `800` commits on `main`) evaluate freshness based on how many commits have landed since the build ran rather than wall-clock time."
  - "If a builder or target branch ... does not use a commit-distance window, passing builds can be reused for up to **24 hours** from when they were created."
  - Source: https://chromium.googlesource.com/chromium/src/+/main/docs/infra/cq.md.
- trunkbaseddevelopment.com: "There is still room for error based on timing, so CI needs to happen a second time **after** the push to the shared trunk". It recommends verifying each commit "where it looks like it is immediately following a previously known green (passing) commit". Source: https://trunkbaseddevelopment.com/continuous-integration/.

## Gaps and unverified claims

The research environment blocked these primary sources. Treat each claim below as unverified.

- Kent Beck, *Extreme Programming Explained*, "ten-minute build". This is a book and was not checked.
- Martin Fowler, "Continuous Integration" (martinfowler.com was blocked). The ten-minute build and the staged / secondary build passages were not read. Secondary sources attribute a ten-minute target to the article.
- Humble and Farley, *Continuous Delivery*: the commit-stage target (often cited as under 5 to 10 minutes) was not checked. continuousdelivery.com was blocked. DORA links to its deployment-pipeline pattern for the overflow tests.
- *Accelerate* (Forsgren, Humble, Kim): the book was not checked. The 2018 DORA report, p. 56, is verified, and it carries the same "less than ten minutes" claim.
- GitLab MR pipeline duration KPI: the current handbook pages under `content/handbook/engineering/infrastructure-platforms/developer-experience/` hold no minute target. A search summary cites a 2022 GitLab blog with a target "below 45 minutes". The same summary cites a job post with an FY25 goal of 15 minutes, and a proposal to measure p80 instead of the average. None of these were read on a primary page.
- GitHub engineering blog (merge queue rollout, CI speed): github.blog was blocked. Not checked.
- Uber SubmitQueue paper ("Keeping master green at scale", EuroSys 2019): the paper was not read. A search summary says that SubmitQueue keeps every commit point green and handles thousands of commits per day. It gives no verified latency number.
- Graydon Hoare, "not rocket science rule": the original blog post was not found or read.
- Shopify, Meta, Stripe and Spotify engineering posts: not checked.
- Developer-productivity research on build-latency wait cost (Google or DORA studies): not checked beyond the DORA capability pages.
- Mergify and Aviator docs: not checked.
