# The lesson format

The schema of `.celetis/lessons/`, used by `lesson`, by the agent curation at each landing, and by
`lesson-review`. Keep the keys and body headings in the order below. The `lesson-store` command
validates records and queue rows.

## Contents

- The store
- The frontmatter
- The body
- The queue rows
- The capture input
- Review requests and snapshots
- The Tag Vocabulary

## The store

The store of a checkout is the live files `.celetis/lessons/{name}.md` of the checkout that runs the
command, plus the pending folder `.celetis/lessons/_pending/` of the resolved main checkout. In the
main checkout the two are one checkout. A command in a linked checkout never reads the live files
of the main checkout, except `recover` of a journal without `lane`: that journal comes from an
apply in the main checkout, so recovery completes its live paths there. Capture writes pending
proposals in the main checkout, including from a linked checkout. A review writes live files in
the checkout that runs it, and in a linked checkout it commits them there. Task retrieval reads
the active checkout's live files and excludes historical rules. Missing stores are empty; reads
create no lesson directory. A denied read, old-format record, or inconsistent row/file is an
error that names the path. Review old-format data explicitly; the command does not convert it.

No live catalog exists: `lesson-store read` derives the active and history lists from the lesson
files. A leftover `.celetis/lessons/INDEX.md` fails each read, with its path, until someone deletes
it. A pending proposal can hold an incident that a live or historical file holds with equal
evidence, for example a replay from a checkout that lacks that lesson. Two records of the
pending folder cannot share an incident when one of them is a pending proposal.

Pending proposals use `_pending/{candidate}.md` and `_pending/QUEUE.md`. Rejected proposals
use `_pending/_rejected/{candidate}.md`, retain `pending-review`, and have a reason and a final
reject review. Active and superseded files use `{name}.md`. Create directories only for an
actual record.

Before publishing a journal, the first mutation creates `_pending/.gitignore` with `*` and a
final newline. This local infrastructure ignores itself and all pending data without project
setup. Preserve an existing file that ignores all pending data; conflicting exceptions require
explicit correction. The ignore file can remain after interruption and is validated on recovery.

All mutations hold a private lock from validation through the final check. Each read in each
checkout takes the same lock, so no read sees a write in progress. A lane apply holds the lock
through the project's commit hooks. `lesson-store capture FILE` waits up to 120 seconds for the lock, and each
other `lesson-store` command up to 10 seconds; then it exits 3 with `busy`. Its file is
`/tmp/celetis-<uid>/lessons/<digest>.lock`, or `celetis\lessons\<digest>.lock` in the temporary
folder on Windows, where the digest is the SHA-256 of the real path of the common Git directory.
Independent proposals use separate UUIDs. The command rejects links and non-regular files and
checks parents again before replacement. Only a lane apply and its recovery change the Git index:
the apply stages and commits its live lesson paths, and a rollback unstages them. The command
grants no permission to stage or commit other paths, push, or change instructions.

`_pending/.transaction.json` of the main checkout retains the exact before/after bytes of one
operation. A lane apply spans two checkouts: its journal also records `lane`, the absolute path
and the HEAD of the linked checkout that holds its live paths. Each read refuses an incomplete
transaction: the read holds the lock, so the writer of that journal stopped.
`lesson-store recover` runs from any checkout of the repository. Without `lane`, it completes the
operation only when each target matches its recorded before or after value; a third value blocks
recovery. With `lane`, a commit after the recorded HEAD whose message holds
`Lesson-Transaction: <journal id>` lets recovery complete the pending side and print `recovered`.
A lane still at the recorded HEAD has no lesson commit: recovery restores and unstages each live
path that holds its before or after bytes, keeps the queue, and prints `rolled-back`. A lane HEAD
that moved without the lesson commit, or a lane that is not a checkout of the repository, blocks
recovery. For a moved HEAD, the line names the repair:
`git -C <lane> reset --soft <recorded HEAD>`, then `recover` again. The reset moves only the
branch: the changes of the later commits stay staged, to commit again after the rollback. When the
recorded lane checkout is gone, add its branch again at the recorded path
(`git worktree add <root> <branch>`) and run `recover`. When the branch is gone too, restore each
`_pending/` path of the journal to its before bytes, then delete the journal. Keep the journal
until the complete result validates. Never treat it as another lesson database.

## The frontmatter

Required keys, in order: `schema`, `name`, `description`, `tags`, `date`, `status`, `source`,
`incidents`, `recurrences`, `reviews`. Optional keys follow in order: `candidate`, `replacement`,
`reason`. Omit an unused optional key. Use schema `1`, a safe kebab-case `name`, a one-line
`description`, a nonempty unique tag list, and a valid `YYYY-MM-DD` date.

`status` is `pending-review`, `active`, or `superseded`. Pending and rejected files require a
lowercase UUID `candidate` that matches the filename. Live and historical files have no
candidate. A superseded lesson requires a reason; it can name a replacement lesson slug.
Retirement is supersession without a replacement. An active record has neither field.

`source` is nonempty origin text, retained in every state. `incidents` is a nonempty array of:

```yaml
id: retained-event-reference-or-UUID
date: YYYY-MM-DD
action: the mistaken action or failed repair
expected: the required behavior
observed: the observation that establishes the difference
source: {kind: tool-output, excerpt: retained evidence, reference: optional-durable-reference}
inference: the proposed cause, uncertainty, and alternatives
diagnosis: [unknown]
revision: optional-relevant-revision
lesson: {name: optional-examined-lesson, revision: its-revision, digest: its-SHA-256}
brief: optional-relevant-task-excerpt-or-durable-reference
```

Incident source kind is `user-report` or `tool-output`. Retain a concise excerpt even when a
session or temporary log can disappear. Use a stable event reference as the opaque ID when one
exists; otherwise assign and retain a UUID on first capture. Replays preserve bytes and counts.
A reused ID with different evidence is an error.

Diagnosis is a nonempty unique subset of `not-retrieved`, `not-followed`,
`wrong-or-incomplete-rule`, `failed-structural-constraint`, and `unknown`. Use `unknown` alone when
the evidence cannot distinguish causes. A missing transcript does not prove failed retrieval.
`recurrences` is the distinct incident count minus one; it grants no authority.

`reviews` is an array, empty on a new proposal. Each entry has `id`, `requestDigest` (SHA-256),
`date`, `decision`, `source`, `related` (lesson names), and `followUp`. Decision is `approve`,
`edit`, `merge`, `supersede`, `retire`, or `reject`; source identifies the actual decision record.
Follow-up has `state: proposed | verified | not-needed`, `detail`, and optional `owner`,
`reference`, and `evidence`. Verified requires evidence. Keep it proposed until separately
authorized and checked. Preserve earlier evidence, uncertainty, origins, and review entries;
correct a prior claim with an attributed addendum in a new review.

Identity strings are bounded and nonempty. Dates, scalar types, unique IDs, allowed keys, and
state-specific fields are checked. The parser rejects controls, invalid UTF-8, extra YAML
documents, duplicate keys, aliases, merge keys, and custom tags. Markdown remains data.

## The body

Start with `# {Title}`, a plain statement of the rule. Blank lines can separate the frontmatter
from the title; body bytes stay unchanged. Leading prose and an indented title are invalid.
Use these `##` headings in order:

| Heading | Content |
|---|---|
| What happened | Required. Observed facts, distinct from inferred causes |
| Root cause | Required. Label inference, uncertainty, and unresolved alternatives |
| Anti-pattern | Optional. The wrong approach, with a code block when useful |
| Fix | Required. Distinguish proposed prevention from proven enforcement; explain why a judgment-dependent rule remains text |
| Detection signature | Optional. The observable error, symptom, or marker |
| Rule | Required. State applicability, action, and check |
| Related lessons | Optional. `[[slug]]` links |

## The queue rows

Preserve introduction bytes and unrelated rows. `QUEUE.md` has exactly one row per pending
proposal. It starts with `# Pending lessons`, a blank line, header
`| Candidate | Lesson | Date | Summary |`, and separator `|---|---|---|---|`. Its row is:

```markdown
| [{candidate}]({candidate}.md) | {name} | {YYYY-MM-DD} | {description} |
```

Escape `&`, `|`, backticks, `<`, and `>` in the description cell as HTML entities. Rejected
records have no queue row. Orphaned files and inconsistent rows require explicit correction.

## The capture input

`lesson-store capture FILE` reads this JSON object; every key is required and no other key is
allowed:

```text
{schema:1, candidate, expected, name, description, tags:[], date, source, incidents:[], body}
```

`candidate` is a lowercase UUID. `expected` is `null` for a new proposal, or the SHA-256 of the
stored pending file from `lesson-store read main` for an extension. `name`, `description`,
`tags`, `date`, `source`, and each incident follow "The frontmatter"; every text value,
including an incident revision, is a JSON string. `body` is the complete Markdown body of "The
body", from its title line. The command builds the pending record with `status`, `candidate`,
`recurrences`, and `reviews`, and writes it.

An extension keeps the stored `name` and `source`. The record keeps the stored incidents in
order and the stored reviews, then appends input incidents with new IDs in input order; an
input incident stored with equal evidence stays once. `description`, `tags`, `date`, and `body`
come from the input. When every input incident is already stored with equal evidence in any
record, the command reports unchanged and writes nothing.

## Review requests and snapshots

`lesson-store preview FILE` reads this JSON request:

```text
{schema:1, id, date, source, followUp, decision, candidates:[], lessons:[{name,document}], reason}
```

Use a retained review ID, the actual decision source, and the follow-up format above. The source
names the reviewer: the person of a human review, or the agent review and the lane of a curation
at a landing. `candidates` selects pending UUIDs. `lessons` contains the complete resulting live
and historical documents, before the command appends the new review. `reason` states the
decision rationale. Use the decision source for an attributed correction. The command treats
this text as data and does not verify reviewer identity.

| Decision | Selection and result |
|---|---|
| approve | One pending proposal and one new active document with the same name and content |
| edit | One pending proposal or one existing active lesson, and its revised active document |
| merge | At least two pending or active inputs, one active survivor, and a superseded document for every absorbed live lesson |
| supersede | One active replacement and the old live documents marked superseded with that replacement |
| retire | Selected live documents marked superseded with a reason and no replacement |
| reject | Selected pending UUIDs and no live documents; the proposal and decision move to the rejected directory |

Each live and historical document needs a name other than `index`: on a case-insensitive file
system, `index.md` is a leftover catalog `INDEX.md`, so preview refuses that name. Edit promotes a
proposal named `index` under another name.

Skip calls no mutation command. Historical documents keep their old body, description, tags,
date, origins, and evidence. The review adds status, reason, replacement when applicable, and
the decision entry. Historical files are not maintenance targets.

The active survivor of each decision, also the replacement of a supersede, retains the exact
union of the incidents and prior reviews of all inputs, with each ID once. Input order is the
selected candidates, then existing live documents in request order.
Its `source` is those original source strings in that order, separated by a blank line; remove
only identical whole-string duplicates. A format limit requires a refusal, never truncation.
The new review retains the request digest and affected lesson names. Its source joins the
request source and rationale with a blank line. Evidence corrections belong in this attributed
decision record; earlier evidence stays unchanged.

Preview returns `schema`, `root`, `request`, `requestDigest`, exact `before` and `after` path maps,
`watched` digests, and `digest`. Null means expected absence. It changes no lesson bytes. The
snapshot includes queue changes and local ignore infrastructure. Save it outside the store. A
human review shows every changed file before the approval; an agent review applies the snapshot
that it produced. The request and snapshot digests use stable JSON key ordering; the snapshot
digest excludes its own `digest` field.

`lesson-store apply SNAPSHOT DIGEST` checks the approved digest, recomputes the transitions,
and compares watched bytes under the lock. Changed inputs require a new preview and approval.
Matching completed review IDs return unchanged, including after a later edit; a different
request digest for the same ID is an error. Apply writes only the reviewed result. In the main
checkout, and for a decision with no live change (reject), it writes the working tree with no
commit and preserves the index.

In a linked checkout, a `lesson-store apply SNAPSHOT DIGEST` that changes a live path needs a clean checkout on a branch;
else it exits 2 with no write. It writes the journal and the live files, stages only those
paths, and commits them on the branch with the project's hooks. The commit subject is
`docs(lessons): <decision> <lesson names>`, and its body is `Lesson-Transaction: <journal id>`.
Only after that commit does apply remove the proposals, write rejected records, and update the
queue. When a stage or commit fails, apply looks for the lesson commit first. If it exists,
apply goes on and prints `applied`. If HEAD is still the recorded HEAD, apply restores the before
bytes of the live paths, also bytes that a hook rewrote, resets their index entries, removes the
journal, and exits 6 with `cannot commit the lessons:` and the first line of the Git error. If
the rollback stops, the journal stays: exit 6, then run `lesson-store recover`. If HEAD moved
without the commit, the journal stays, and the line of exit 6 names the repair of a moved HEAD
("The store"). A commit hook can rewrite a staged lesson: after the commit, the combined store
must validate, not match the snapshot bytes. Each decision is one local commit; the command
pushes nothing.

The result of `apply` and `recover` has `status` (`applied`, `recovered`, `rolled-back`, or
`unchanged`), `root`, and `paths`. `root` is the main checkout, the root of each `_pending/` path.
A live path lies in the checkout that the transaction wrote: the checkout that ran `apply`, or
the recorded lane for a lane transaction. Recovery completes or rolls back an interrupted
recorded result without a new semantic decision.

## The Tag Vocabulary

Draw tags from this list and the lesson tags that the project's `AGENTS.md` names. When no tag
fits, report the need for a separately authorized project tag change. Lesson review changes no
instruction file. Use no synonyms or one-off tags.
The command checks a nonempty unique string list; the agent checks the project vocabulary.

- Technology: `api` `auth` `database` `data-store` `networking` `bridge` `build` `gradle` `deploy` `platform` `webview` `ui` `test` `config`
- Nature: `false-positive` `false-negative` `refix` `recurring` `regression` `platform-quirk` `data-loss` `performance`
- Process: `process` `build` `e2e` `git` `triage` `release`
