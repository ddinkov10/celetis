---
{
  "schema": 1,
  "name": "a-failed-create-is-ambiguous-unless-the-server-refused-it",
  "description": "issue create told the session that no issue was written for every failed POST, also for an HTTP 5xx that can come after GitHub made the issue",
  "tags": [
    "api",
    "networking",
    "process"
  ],
  "date": "2026-11-14",
  "status": "active",
  "source": "The implement session of #323 on Claude Code, final whole-branch review, 2026-11-14",
  "incidents": [
    {
      "id": "8acc0ff7-74fb-429f-b399-1d20e2601127",
      "date": "2026-11-14",
      "action": "createIssue of engine/issue.ts printed `the create failed; no issue was written` for each GitHubError with stderr, and the GitHub rule of entry.md said `With no URL on stdout, nothing was written`; the spec and the plan of #323 stated that rule.",
      "expected": "A failed non-idempotent create says that nothing was written only when the server refused the request (HTTP 4xx). A 5xx answer, a dropped connection, or an unreadable answer can come after the server made the record, so the line says that the record can exist and the caller reads the current state before a new create.",
      "observed": "A fake gh that answered the POST with `gh: HTTP 500` and exit 1 gave exit 6, empty stdout, and `issue: blocked: the create failed; no issue was written`; a session that follows the entry rule then creates the issue a second time.",
      "source": {
        "kind": "tool-output",
        "excerpt": "issue: blocked: the create failed; no issue was written\ngh: HTTP 500",
        "reference": "https://github.com/ddinkov10/celetis/issues/323#issuecomment-6878316713"
      },
      "inference": "Inferred: the spec and the plan treated the absence of an answer as the absence of a write, and the build copied that rule. Not checked: whether GitHub really creates an issue before a 502 or a timeout. Alternative: the risk is small in practice, but the anti-goal of the spec forbids a second issue on a retry.",
      "diagnosis": [
        "unknown"
      ],
      "revision": "d6b9244",
      "brief": "The anti-goal of the spec of #323: A failed write must never make a session create a second issue on its retry."
    }
  ],
  "recurrences": 0,
  "reviews": [
    {
      "id": "508be6af-ea05-423b-b4fd-d1df78dfb160",
      "requestDigest": "ae06c82ccf0dc97363f2e65463a36d7a720669791d56d6937705c7fe4a23ed52",
      "date": "2026-11-14",
      "decision": "approve",
      "source": "agent review: lesson curation in the landing of #323; claude child opus/high\n\nApprove (reviewer rules): the proposal has observed tool-output evidence (a fake gh that answered the POST with HTTP 500 gave exit 6 and the line that no issue was written); its rule states applicability, action, and check; it widens no permission, skips no check, and adds no network or credential act; it agrees with the principle make-operations-idempotent of the plugin celetis and with the GitHub rule of entry.md in the lane, which after 15da3ed says that the exit line tells whether the issue can exist; no live or historical lesson holds its incident or states its rule. The body labels as not checked whether GitHub creates an issue before a 5xx or a timeout.",
      "related": [
        "a-failed-create-is-ambiguous-unless-the-server-refused-it"
      ],
      "followUp": {
        "state": "proposed",
        "detail": "A shared helper of the tracker that classifies the failure of a non-idempotent write as refused or unknown, so that each such write uses one rule. This structural work needs separate authorization; this review changes lesson data only."
      }
    }
  ]
}
---
# A failed create is ambiguous unless the server refused it

## What happened

In #323, the act `issue create` posted a new issue with one `POST /repos/{owner}/{repo}/issues`. On each failed POST with stderr it printed `the create failed; no issue was written`, and the entry contract told the session: with no URL on stdout, nothing was written. The final review ran a fake `gh` that answered the POST with HTTP 500: the act printed the same line. A real 5xx or a dropped connection can come after GitHub made the issue, so a session that followed the line could create the issue twice.

## Root cause

Inferred: the spec and the plan equated "no answer" with "no write", and the build followed them. Not checked on real GitHub: whether an issue exists after a 502 or a timeout.

## Fix

The fix of #323 (`15da3ed`) prints "no issue was written" only for an HTTP 4xx refusal; each other failure says that the issue can exist and that the session reads the open issues before a new create. Proposed structural follow-up, not authorized here: a shared helper of the tracker that classifies a write failure as refused or unknown, so each non-idempotent write uses one rule. This stays text until such a helper exists.

## Rule

Applies when code or agent text reports the outcome of a failed write that is not idempotent (a create, an append, a post) to a caller that can retry. Action: say that nothing was written only when the server refused the request (an HTTP 4xx, or an error raised before the request was sent). For each other failure (5xx, timeout, dropped connection, an answer that cannot be read), say that the record can exist, and tell the caller to read the current state before it writes again. Check: a probe with a 5xx answer and one with a 4xx answer give the two different lines, and the caller text names the read before a retry.

## Related lessons

[[end-the-options-before-a-free-text-argument-of-an-external-tool]]
