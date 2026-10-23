**Silent rounding of attempt inputs — ADDRESSED.** `scripts/capscore.ts:280` now rejects unsafe attempt values before scoring or output. `scripts/capscore.ts:276` and `scripts/capscore.ts:292` apply the approved bound to explicit and environment bias values. The existing decimal checks, lower bounds, and diagnostic text remain intact. Safe integer inputs retain exact numeric values.

### Finding Verdicts

- **Numeric result and text line can disagree — ADDRESSED.** `tests/capscore.test.ts:656` checks the exact maximum value, explicit-bias precedence, and maximum-attempt STOP output before lookup. `tests/capscore.test.ts:696` covers all three input sources at the first unsafe integer, the reported overflow, and a 400-digit decimal. Each rejection requires status 2, exact stderr, empty stdout, and no Git lookup. The fix follows the controller's explicit safe integer range and adds no arbitrary-precision path.

### New Breakage in the Fix Diff

- None.

### Out-of-Scope Observations

- None.

### Verdict

**Fix round:** All findings addressed, no new Critical/Important breakage.

**Checks:** Confirmed the requested path and branch. Read the fix diff, brief, appended report, RED summary, full GREEN log, and controller gate result. GREEN records 19 pass, 0 fail, 868 assertions, and 9.61 seconds. The controller gate ends with `verify: PASS`. No test or gate was repeated. Live acceptance remains UNRUN under the user instruction; final CI owns the full suite. Only this report was written.
