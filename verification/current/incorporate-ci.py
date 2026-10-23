from pathlib import Path
import json,shutil
state=Path(__file__).resolve().parent;b=json.loads((state/'binding.json').read_text());root=Path(b['checkout']);ci=json.loads((state/'proof/controller-ci-summary.json').read_text())
assert ci['head']==b['head'] and ci['conclusion']=='success'
section=f'''## Controller-provided current-head CI

[GitHub Actions run {ci['run']}]({ci['url']}) completes **SUCCESS** on exact source HEAD `{ci['head']}`. Saved metadata confirms all three jobs succeed. This evidence is from the controller's GitHub Actions run, separate from the local macOS proof. The verifier ran no local full suite and made no external CI action.

| Provider boundary | Result |
| --- | --- |
| Linux test job: verify gate | PASS; raw log ends `verify: PASS`. |
| Linux test job: full suite | PASS; 52 files, 1,851 cases, zero failures, 13,924 reported `expect()` calls; `suite: PASS`. |
| Largest Linux full-suite file | `tests/celetis-flow.test.ts`, 27.477 s, below 30 s. |
| Process job: ubuntu-24.04 | PASS; nine entries, 169 cases. |
| Process job: macos-14 | PASS; nine entries, 169 cases. |

All three saved sanitized logs identify Bun 1.4.2, revision 744846f84. The process jobs include native realpath, process/lock/lifecycle/startup and all four host entries. Linux acceptance comes from that real provider execution, not an inference from macOS. Metadata, summaries, raw logs and sanitized logs are copied into `ci/`; exact provenance and hashes are in `proof/controller-ci-summary.json`. Both older failed workflows and every local failure remain in the history.

The current-build maintainer cutover report remains required before merge. Live V2/V4/V5/V6 remain UNRUN under the user waiver.

'''
p=root/'.superpowers/sdd/96/final-verify-report.md';text=p.read_text()
text=text.replace("New-head Linux/process/full-suite CI remains the controller's work. This local result gives no overall CI or merge approval.","Exact-head controller CI now passes. Local and provider runtime evidence remain distinct. The current-build cutover precondition remains open.")
text=text.replace('| V3 Linux | PENDING for current-head CI | Controller owns actual new-head workflow. No macOS result is a Linux PASS. |','| V3 Linux | PASS from CI provider | Exact-head run39941193404, ubuntu-24.04 process job: nine entries,169 cases. No local Linux execution is claimed. |')
text=text.replace('The current full suite remains PENDING for controller CI. Prior CI failures remain below. The current-build maintainer cutover report remains required before merge.','The controller-provided current Linux full suite passes. Prior CI failures remain below. The current-build maintainer cutover report remains required before merge.')
text=text.replace('## Retained history and errors\n',section+'## Retained history and errors\n')
text=text.replace('Remaining gates: actual current-head Linux/process/full-suite CI and the current-build maintainer cutover report before merge. Live V2/V4/V5/V6 remain UNRUN under the user waiver. No overall CI/Verify or merge approval is given by this local task.','Remaining merge precondition: the current-build maintainer cutover report. Current CI passes; prior failures remain recorded. Live V2/V4/V5/V6 stay UNRUN under the user waiver. This task performs no Land or merge.')
text=text.replace('run39941193404','run 39941193404').replace('entries,169','entries, 169')
assert 'PENDING' not in text
p.write_text(text)
p=root/'.superpowers/sdd/96/verification.md';text=p.read_text()
text=text.replace('Linux/current full-suite CI remains PENDING for the controller.','Controller-provided exact-head CI39941193404 now passes: all three jobs succeed.')
text=text.replace('| V3 Linux | PENDING | Controller owns actual new-head CI; no macOS inference. |','| V3 Linux | PASS from CI provider | Exact-head run39941193404: ubuntu-24.04 process job, nine entries/169 cases; no local inference. |')
text=text.replace('Current CI and full-suite proof remain controller work.','Controller-provided current-head CI and Linux full-suite proof now pass.')
text+='\nController-provided current-head CI: [run39941193404](https://github.com/ddinkov10/celetis/actions/runs/39941193404), head b6053743e492dde0624207c90fc3a23cdeeca57a, conclusion SUCCESS. All three jobs succeed. Linux full suite:52 files/1851 cases/13924 reported expect() calls/zero failures, max file27.477s (celetis-flow). Gate verify:PASS and suite:PASS. Linux/macOS process jobs each pass169 cases across nine entries. Raw/sanitized logs and metadata are in the private proof ci/ directory, with provenance in proof/controller-ci-summary.json. Bun1.4.2 (744846f84). No local full suite was run. Prior CI/local failures remain recorded. The current-build cutover report remains required before merge.\n'
for a,c in {'CI39941193404':'CI 39941193404','run39941193404':'run 39941193404','suite:52':'suite: 52','max file27.477s':'max file 27.477 s','pass169':'pass 169','Bun1.4.2':'Bun 1.4.2'}.items():text=text.replace(a,c)
assert 'PENDING' not in text
p.write_text(text)
for filename in ['final-verify-report.md','verification.md']:shutil.copy2(root/'.superpowers/sdd/96'/filename,state/'reports'/filename)
print('Current-head CI PASS added with provider/runtime separation. Cutover remains required. Prior failure history retained.')
