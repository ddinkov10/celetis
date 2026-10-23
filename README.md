# Evidence for Celetis #96

This private branch contains evidence only. Do not merge it into the product branch. It is not a plugin package.

The reviewed source is `b6053743e492dde0624207c90fc3a23cdeeca57a` on [draft PR #108](https://github.com/ddinkov10/celetis/pull/108). The baseline is `4fe5554c4c09ec522aae410afde6a298787a04a9`. All nine implementation tasks and the final broad review are complete. The two later CI repairs have scoped approval.

- [The complete coverage and caller map](coverage/96-port-map.md) stays outside the product branch.
- [The approved plan](plan.md) and [specification](spec.md) define the work.
- [The final verification report](reports/final-verify-report.md) records local V1 and V3 PASS on the exact source head.
- [The proof manifest](verification/current/proof-manifest.json) records clean-copy builds, byte/mode snapshots, corruption refusal, commands, versions, process evidence and retained history.
- [The complete ruling record](rulings.json) contains all 19 controller decisions and their costs.
- [The progress ledger](reports/progress.md) records tasks, repairs and dispatch identities. Its last snapshot precedes publication of this branch.

Current [CI run 39941193404](https://github.com/ddinkov10/celetis/actions/runs/39941193404) passes all three jobs. The Linux full suite passes 1851 cases in 52 files, with 13924 reported expect() calls. Every file remains below 30 seconds. Linux and macOS process jobs each pass 169 cases in nine entries. Local macOS V3 passes 239 cases in ten entries. No test was retried unchanged to seek a passing result. CI logs and result metadata are in `ci/`.

The earlier workflow failures and local failures remain in the reports, repair evidence and verification history. Task 5 and Task 8 retain their documented test-order gaps. The private Python verification programs are orchestration records; the product toolchain runs on Bun. Published process captures contain task-owned descendants only. Unrelated global process tables are excluded.

Live V2/V4/V5/V6 remain UNRUN under the user's instruction to ignore live checks. The PR remains draft and unmerged. The current-build maintainer cutover report is required before landing:

```text
## Human steps done
Cutover ready: b6053743e492dde0624207c90fc3a23cdeeca57a; projects: <complete list, or none>; old processes stopped; Bun ready; TypeScript setup and settings reviewed
```

The maintainer must then remove `ready-for-human`. The implementation skill remains the authority for landing. `scripts/celetis land` is the only agent merge path.

Recorded absolute paths and filesystem modes describe the original private proof environment. Relative archive paths and content hashes are listed in `evidence-manifest.json`. Verification drivers are retained as evidence and are not installed or executed by this branch.
