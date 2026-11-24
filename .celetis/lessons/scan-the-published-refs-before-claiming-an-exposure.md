---
{
  "schema": 1,
  "name": "scan-the-published-refs-before-claiming-an-exposure",
  "description": "An exposure scan used git log --all, so it reported commit metadata from local refs as data that publishing the repository would expose",
  "tags": [
    "git",
    "false-positive",
    "process"
  ],
  "date": "2026-11-23",
  "status": "active",
  "source": "The bug session of #40 on Claude Code, pre-publication scan, 2026-11-23",
  "incidents": [
    {
      "id": "386cc443-398c-4c36-b843-64e84ca91665",
      "date": "2026-11-23",
      "action": "Before a repository visibility change, the session scanned commit metadata with git log --all and told the maintainer that 128 author and committer fields would become public.",
      "expected": "An exposure claim covers only what the publishing act exposes: the refs and objects that the remote serves.",
      "observed": "The GitHub commits API answered No commit found for each of the 64 commits that held those fields, and a control commit on the trunk answered 200. The commits were reachable only from local refs and a stale remote-tracking ref.",
      "source": {
        "kind": "tool-output",
        "excerpt": "checked: 64, foundOnGitHub: 0, missingOnGitHub: 64; control exit 0; masterOnGitHub: none",
        "reference": "https://github.com/ddinkov10/celetis/issues/40"
      },
      "inference": "Inferred: --all includes local branches and stale remote-tracking refs, so it is wider than the published history. The maintainer question about the exact values exposed the error. No alternative cause was examined.",
      "diagnosis": [
        "unknown"
      ],
      "revision": "ed1967cc7b96f614a901284b0508be76909ffd1a"
    }
  ],
  "recurrences": 0,
  "reviews": [
    {
      "id": "8042419d-867e-4ed4-a2a5-af9f36168e3b",
      "requestDigest": "c2d094d8457d6e9f3dd991460a2b375e1cf468de5a81d8cf9200fea446a6011b",
      "date": "2026-11-24",
      "decision": "edit",
      "source": "agent review: lesson curation in the landing of #347; claude child opus/high\n\nEdit (reviewer rules: approve, edit first when the text needs a correction). The incident holds observed tool output: the GitHub commits API found none of the 64 commits that the `git log --all` scan reported, and found the control commit. No live or historical lesson holds its incident or states its rule. The proposed rule told the agent to check each finding against the remote with no condition, which adds a network act; the edit keeps that read only where the task already permits it, and else labels each finding as not checked, as probe-real-tool-semantics-behind-fakes does. The edit also states the applicability, the action, and the check in separate parts. The incident, the What happened, and the inferred cause stay unchanged.",
      "related": [
        "scan-the-published-refs-before-claiming-an-exposure"
      ],
      "followUp": {
        "state": "not-needed",
        "detail": "The rule stays text: the scope of a publishing act depends on the act. This review changes lesson data only."
      }
    }
  ]
}
---
# Scan what the remote serves before you claim that publishing exposes it

## What happened

A scan before a visibility change read `git log --all` and reported 128 commit metadata fields as data that would become public. The maintainer asked for the exact values. A check of each of the 64 commits against the GitHub commits API found none of them on GitHub. A control commit on the trunk was found.

## Root cause

Inferred: `--all` walks local branches and stale remote-tracking refs, so it is wider than the history that the remote serves. The evidence does not show another cause.

## Fix

Proposed prevention: an exposure scan takes its scope from the refs that the remote serves, for example `git ls-remote`, and checks each finding against the remote before it reports the finding. When that read needs a network or credential act that the task does not already permit, the scan does not make it: the report names the local refs that it read and labels each finding as not checked against the remote. This stays a text rule, because the scope of a publishing act depends on the act and no general check can derive it.

## Rule

Applies when a task reports what a publishing act (a visibility change, a push, a release) would expose. Action: scan only the refs and objects that the remote serves, not `git log --all` or other local refs. When the task permits a read of the remote, check each finding against the remote, with a control that the remote does serve, before you report it. When it does not, make no such read: name the refs that the scan read, and label each finding as not checked against the remote. Check: the report names the scanned refs, each finding carries its remote result or the label not checked, and the control is found on the remote.
