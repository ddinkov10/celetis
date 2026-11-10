# Setup of a product project

`/celetis:setup` wires one product project in its main checkout
([ADR-0071](https://github.com/ddinkov10/celetis/blob/main/docs/adr/0071-setup-reconciles-recorded-owned-wiring.md)).
The installs of [Wire a product project](../README.md#wire-a-product-project) stay by hand on each
machine. Setup writes the required integration and the product additions that you approve. Its
required set is the selected host settings, instruction imports, the dedicated Codex restriction,
required configuration, ignore and attribute lines, and its record. It also makes missing tracker
labels. It owns the parts that its record lists, preserves each other byte of a shared file, and
reports each part that the owner must repair or review. Product procedures and stores stay with
their owner.

## `setup status`

`celetis --agent <host> setup status` reads that required set in the active checkout, for the
selected host only, and writes nothing. It reports each missing, invalid, different, or blocked
part with its path or label name. A line for content that setup preserves names the owner
repair; a new run of setup does not repair it. A permission failure is a blocked observation,
never a missing part. The tracker reads go to the repository of `origin` only: its host must be
`github.com` or a GitHub host that `gh` is logged in to, and an SSH host alias resolves by
`ssh -G`. Unlike `setup check`, status needs no main checkout on the trunk, fetches
nothing, and runs no product file. A pass proves only the file contents and the label names. It
does not prove that a host loads the policy, that the worktree setup works, or that the wiring is
on the remote trunk.

## `setup check`

The session runs `setup check` first and reuses its validated saved tracker and ordered hosts.
It uses landing and, with `merge`, suite from the current valid `.celetis.yaml`. It asks only
for an absent answer or a change explicitly requested in the invocation. An invalid present
answer refuses; it is not treated as absent. Only GitHub is supported. Both `try` and `write`
receive the same resolved selection and configuration options.

## `setup try`

After the landing, when `.celetis.yaml` has no `worktreeSetup`, the session proposes the
worktree setup: a normal root-relative `.ts` file, such as `scripts/worktree-setup.ts`, from the
manifests, lockfiles, version pins, and CI workflows of the project. It shows the path and
complete script, each ignored file that the script copies, each
credential path that it does not copy, each tool that each machine needs, and the checks that
the test runs. A `worktreeSetup` that is there, also an empty one, stays as it is, and setup
tests its referenced lane file.

Before the detached wiring test, the product owner approves, creates, and commits the entry and
required helpers on the local trunk in a separate product change. `setup try` and
`setup write --setup-file <path>` require the entry in local trunk HEAD, with an unchanged index
and working file; missing or uncommitted source stops the test. They resolve the option from the
main root and add only the reference. Setup creates, copies, stages, owns, commits, and pushes no
application source to make its test possible. A changed proposal requires another owner source
commit before retry.

Before any wiring write, `celetis --agent <host> setup try --setup-file <path>` takes the exact
root-relative reference and runs the committed file in a test lane,
`.claude/worktrees/setup-try`: a detached worktree at the local trunk plus a commit of the
wiring, which is the tree of a new lane after the push. There, the session runs the checks of
the project, and it checks the import of the package of the project, a clean `git status`, and
the hooks. `setup try` keeps the test lane after its run, also after a failure, and replaces an
existing test lane at its start. After the checks, and when `setup try` prints no path, the
session removes the test lane with `celetis --agent <host> setup try --remove`. A dirty path becomes a proposed `.gitignore` line. A
failure of the base becomes a proposed section `## Baseline of the checks` for `AGENTS.md`,
when `AGENTS.md` states no baseline rule. A proposed script that fails its test goes back to
the proposal; the owner commits each source repair before another detached test. Setup
installs no tool and changes no hook: the report names
each missing tool and each hook that skips its checks in the test lane (ADR-0018).

## `setup write`

- Setup writes the part of a host only when you choose that host: required entries in
  `.claude/settings.json` and imports from existing Claude instruction files, or the dedicated
  `.codex/rules/celetis.rules`. Every host selection creates or refreshes the marked Celetis entry
  pointer in `AGENTS.md`. See [`AGENTS.md`](#agentsmd) for its ownership and both relative import forms.
- Setup accepts `--hosts claude`, `codex`, `claude,codex`, or `codex,claude`; it rejects
  `--default`. The ordered `--hosts` value initializes an absent local preference only during
  `setup write`, after setup validation. An existing valid preference stays unchanged, also after
  a host-selection change; `check` and `try` create no preference.
- Setup writes no launcher, shared entrypoint allow, project `celetis@celetis` enablement,
  generic flow section, ADR starter, or empty lesson catalog. It refreshes current owned wiring
  and removes obsolete owned scopes, including a recorded dedicated launcher. A valid recorded
  object key owns its current value; a dedicated whole-file claim owns that file. Manual edits
  inside those scopes are replaced or removed. Shared files retain content outside owned scopes.
  Differing unowned settings and rules stay unchanged with exact path warnings and no new claim.
  Unrecorded old wiring and remaining product callers need [owner review](#review-old-wiring).
- In `.celetis.yaml`, setup owns required `landing` and `suite` (with `merge` only). With no file,
  it makes one with `landing` and, with `merge`, `suite`. In a valid file, it adds missing
  entries, refreshes recorded owned values, and removes an obsolete owned suite for `pr`, while
  preserving unrelated bytes and values. A differing unowned value stays with an exact warning;
  change that field by hand when the answer is the intended value. An unowned suite that blocks
  `pr` refuses before writes. Invalid current configuration still needs owner repair; setup reads
  no old configuration format. Each other field stays by hand.
- After your yes, setup adds a missing `worktreeSetup` as a quoted file reference at the end of
  the file, for example `worktreeSetup: "scripts/worktree-setup.ts"`; a new file holds `landing`,
  `suite` with `merge`, and then the reference. `worktreeSetup`, also exactly `""`, stays
  product-owned: an existing different value stays unchanged with a warning, so change that field
  by hand when the approved reference is intended. The value must read back exactly, and each
  other value must stay the same outside the planned owned edits. If that validation fails, setup
  stops before any write; repair the reported field by hand first.
- The schema-1 record at `.claude/celetis/wiring.json` records the resulting owned files and
  entries and the resolved tracker and hosts. It is no config: only `setup` reads it. Setup
  validates its complete shape and finite wiring scope before using any claim. It drops retired
  claims rather than keeping their union. An unchanged committed repeat changes no bytes or
  modification times.
- The write adds only the parts that you approved: the file reference as `worktreeSetup`, the ignore
  lines, and the baseline section. These three parts are product parts: setup writes each one
  only when it is missing, and the record does not list it.
- Setup shows the diff, and it commits and pushes the wiring only after your yes
  ([The wiring on the trunk](#the-wiring-on-the-trunk)). It makes the labels at the write, before
  that question, so a no keeps them.

## `setup lane`

After the push step, setup lists each lane worktree that exists and offers to run the script
there with `celetis --agent <host> setup lane <path>`. It does this also after a no or a failed push,
and when no file changed. A lane branch with an older `.gitignore` can then show the new
environment as untracked, and the resolver stops its issue: after the wiring is on the trunk, a
merge of the trunk into that branch brings the ignore lines. Main selects the reference and
the target lane supplies the source. If an older lane lacks the entry or a helper, setup
reports the missing path and requires the owner to bring the committed source into that
lane before retry. It copies no source and performs no automatic merge or fallback.

## Claude permissions: `.claude/settings.json`

Setup adds or refreshes owned marketplace settings, Superpowers enablement, and direct-merge denies.
It removes obsolete recorded host entries. It adds no shared
allow and no project Celetis enablement:

```json
{
  "permissions": {
    "deny": ["Bash(gh pr merge*)", "PowerShell(gh pr merge*)"]
  },
  "extraKnownMarketplaces": {
    "celetis": {
      "source": { "source": "github", "repo": "ddinkov10/celetis" },
      "autoUpdate": false
    }
  },
  "enabledPlugins": {
    "superpowers@superpowers-marketplace": true
  }
}
```

Shared rules keep the direct-merge restriction. The `land` allow is personal:
`Bash(celetis --agent claude land *)` in the untracked `.claude/settings.local.json` of each
person. An `issue` allow is optional, and it has a risk.
[Personal landing permission](../README.md#personal-landing-permission) gives the rules, the risk of the
`issue` allow, and their lifetime across an update.

The command checks only the planned project settings. The generated `autoUpdate: false` value
does not prove that a native session loaded it or that a stronger policy disables automatic
updates. Review each enabled or unknown policy warning and set the effective Celetis policy to
false by hand. Setup preserves unrelated JSON values; its serializer can change formatting,
including compact JSON, line endings, and the final newline. The setup report shows that diff.

## Codex permissions: `.codex/rules/celetis.rules`

Setup creates this file when absent, adopts an identical file without a content write, and
refreshes a file with a validated whole-file claim:

```starlark
prefix_rule(
    pattern = ["gh", "pr", "merge"],
    decision = "forbidden",
    justification = "Use celetis --agent codex land from the main checkout.",
)
```

This shared rule forbids direct merge. The personal rule of `land`, and the optional rule of
`issue`, name the engine, the host, and their sub-command
([Personal landing permission](../README.md#personal-landing-permission)).
Codex matches literal prefixes. A policy-file check does not prove that an active session loaded
the rule. Keep the host sandbox and approval settings.

A differing unowned file stays unchanged with the required direct-merge restriction and obsolete
allows reported for [owner review](#review-old-wiring). Removing Codex from the selected hosts
removes its recorded owned rules file; shared requirements of a remaining host stay. That warning
can accompany the line that no file changed, and it establishes no loaded-policy result. Project rule
loading also needs the native host's project trust.

## `.gitignore`

```
.claude/worktrees/
.claude/settings.local.json
docs/superpowers/
.superpowers/
.celetis/lessons/_pending/
```

`.claude/worktrees/` holds the lane worktrees (`docs/issue-tracker.md`, "What lives on the
issue"). `.claude/settings.local.json` holds the settings of one person for the project. Two of the
three other folders are scratch of the skills, and the third is the pending folder of the lesson
store. A file that git does not ignore makes a tree dirty too:

- `docs/superpowers/` holds the drafts of the intents, the specs, and the plans;
- `.superpowers/` holds the review package of `critic-loop`;
- `.celetis/lessons/_pending/` holds the lesson drafts that wait for the agent curation of the next
  landing, or for `lesson-review`.

## The labels

The flow uses the ten labels of `docs/issue-tracker.md`, "Labels". Setup makes each label that the
repository does not have, with the description and the color of `labelStyles` in
[`engine/setup.ts`](https://github.com/ddinkov10/celetis/blob/main/engine/setup.ts).

GitHub gives a new repository three of them (`bug`, `enhancement`, and `wontfix`), and their
descriptions are the ones of GitHub. A label that is there keeps its color and its description.
Setup ignores the case of a name: when the repository has `Bug`, setup makes no `bug`, and it
prints a warning.

## `AGENTS.md`

The plugin names a role, and the `AGENTS.md` of the project names the thing. It names:

| What `AGENTS.md` names | Who reads it |
|---|---|
| **The verify gate:** the one fast deterministic check of a change (lint, format, syntax, and config checks, with no test run), and how to read its result | `plan`, `implement`, `chore`, `hotfix`, and `guide` say "the verify gate of the project", and `celetis --agent <host> land` names it in a refusal |
| **Optional verification instructions:** a short pointer to a project document's feature-map section or an existing index of documented user flows | `plan` and `implement` read the index and only relevant recipes (`docs/procedures/verification-recipes.md`) |
| **The full suite** is no line of `AGENTS.md`: with the landing `merge`, `suite` in `.celetis.yaml` names the file that runs each test, and `land` runs it at the tip that it lands. With the landing `pr`, the CI of the lane PR runs it | `land`, which `implement`, `chore`, and `hotfix` run (`docs/procedures/landing.md`, "Step 3: the landing") |
| **The architecture and the traps:** the shape of the project in the root file, and the traps of each subsystem in the `AGENTS.md` of its folder. They are the domain knowledge: the plugin has no domain skill (ADR-0006) | `specify`, `bug`, `hotfix`, `plan`, `chore`, and `critic-loop` |
| **The design document and the look decision,** in a project with a UI: the kind of the product and each difference from its default row in `docs/procedures/ui.md`, and how a session starts the product with live data for the variants. The design document is `DESIGN.md` at the root of the product, which `impeccable` and `prototype` share, so `AGENTS.md` does not name it. A look decision is each change to what a person sees on screen or to how the screen behaves | `prototype` (`docs/procedures/ui.md`), which `specify` and `bug` follow; the two items "Prototype" of `docs/issue-tracker.md`, in "What lives on the issue" and in "Branches, PRs, merge" |
| **The installed version of a dependency:** how a session reads it, and the documents that an installed package ships | `docs/procedures/docs-lookup.md`, which `specify`, `plan`, `bug`, `hotfix`, and `chore` cite |
| **The lesson tags:** the tags of the project, for example the names of its subsystems and technologies, that a lesson can carry beside the controlled list of the plugin. A new tag goes here in the same change as its lesson | `lesson` and `lesson-review` (`docs/procedures/lesson-format.md`, "The Tag Vocabulary") |
| **The product flow:** project-specific landing rules, deployment facts, and acts that only the maintainer does, when more than one step needs them | Each session, also a step session |

Setup creates a missing or empty `AGENTS.md` with one marked `## Celetis` block. It appends the
block to an unmarked file and refreshes an existing block. This short pointer directs a new
request with no recorded intent or lane to `celetis:intake`, honors an explicitly requested
Celetis skill, and follows the current step of an existing issue. It generates no project facts,
empty sections, or generic flow procedures. Product instructions stay by hand, except for an
approved baseline section (ADR-0061).

The delimiters are the exact, case-sensitive standalone lines `<!-- CELETIS:START -->` and
`<!-- CELETIS:END -->`. Inline mentions do not count. Complete delimiter lines are reserved even
inside Markdown examples, so show them inline when documenting them. A missing, duplicate, or
reversed delimiter refuses during planning, before project files or tracker labels change.

A valid pair authorizes replacement from the start marker through the end marker, even without
a wiring record. Edits inside the pair are replaced; put project instructions outside it. Setup
preserves every byte outside the pair, including the end marker's following newline. Replacement
uses the start marker's LF or CRLF convention. Appending uses the first existing line ending, or
LF when none exists, and adds only the separator needed for a blank line. New files end with one
LF. An unchanged block is not written again, so its modification time stays unchanged.

The schema-1 record stores `{ "start": "<!-- CELETIS:START -->", "end": "<!-- CELETIS:END -->" }`
under the actual instruction destination. Setup claims no whole instruction file, even on
creation. Retired claims are removed from the resulting record. An approved baseline is added
after the managed block transformation, outside its ownership; an existing baseline keeps its
collision warning. Complete recorded old flow lines can be removed outside the block; every
other byte stays unchanged. Product flow content and unrecorded old text remain for owner review.

The plugin has no role for the deployment of a project. It is a product fact, so it also goes into
`AGENTS.md` when more than one step needs it: a lane ends when the change is on the trunk.

With Claude selected, setup adds the correct relative import to
each existing regular Claude instruction file: `@AGENTS.md` in root `CLAUDE.md`, and
`@../AGENTS.md` in `.claude/CLAUDE.md`. Imports resolve from the containing file
([Claude Code memory documentation](https://code.claude.com/docs/en/memory)). Setup creates no Claude instruction file just for an import. A wrong existing
unowned import stays unchanged and gets an exact manual action. Obsolete recorded imports are
removed. Codex-only setup adds no Claude import.
Direct native loading depends on the host's instruction precedence and settings. Generated files
and imports do not prove that a fresh host session loaded them.

Setup preserves supported instruction links without a write through a link. A Claude instruction
file that links to `AGENTS.md` needs no import. When `AGENTS.md` links to a regular root or nested
Claude instruction file, the block and any approved baseline go into that real in-project file.
The marker entry names that destination, and setup adds no self-import. An unrelated `AGENTS.md`
link refuses; an unrelated Claude instruction link stays unchanged with an owner-review warning.

## The stores

Three rules give each output of Celetis its place in a product project:

1. A record that the product owns and people read lives at the conventional path of the product.
   The ADR store stays `docs/adr/`.
2. A store that the engine owns lives in `.celetis/` at the root of the product project. The engine
   owns a store when an engine command defines its format, validates each file, and refuses a file
   that it does not know. The lesson store is the one such store: `.celetis/lessons/`. Only that
   folder is the store: a file of the product beside it in `.celetis/` is not refused.
3. The scratch and the wiring keep their paths: the scratch `docs/superpowers/` and
   `.superpowers/`, each wiring file that this document names, with the config `.celetis.yaml` and
   the setup record `.claude/celetis/wiring.json` among them, and the lane worktrees
   `.claude/worktrees/`. An engine command validates the config and the setup record too. Each is
   one file, not a folder of records.

Git must not ignore `.celetis/lessons/`. With an ignore rule that covers it, for example
`/.celetis/`, an apply of a review in a lane exits 6 with `cannot commit the lessons:`, rolls back,
and keeps the proposal, so no lesson becomes active.

Setup creates no store, starter README, template, or empty catalog. Store writers create only the
paths that their first record needs:

- `record-architecture-decisions` reads generic guidance and the template from the plugin, plus
  product policy named by `AGENTS.md`. It creates `docs/adr/` with the first numbered record.
  Existing product ADR guidance and templates remain product content.
- A review that activates a lesson creates `.celetis/lessons/` when needed, in the checkout where
  the review runs. It writes no catalog. Superseded records remain as history.
- Capture creates only a pending proposal and queue row in the main checkout's
  `.celetis/lessons/_pending/`, also when the task runs in a linked worktree. Grounding reads active
  lessons from the lane's own checkout with `lesson-store read active`. A plan copies each
  applicable active rule with its path and digest.
  Each task and repair boundary, including the final review and re-entry, refreshes those copies
  from the task checkout: changed rules replace old copies, and superseded or retired rules drop
  out. A missing lesson or a rule that conflicts with the
  approved scope stops the task or repair for a decision. Missing stores cause no bootstrap
  write.
- Ordinary chats use native skill discovery for substantive corrections and repeated failed
  repairs. Workflow steps use the same bounded capture procedure at correction, repeated-fix,
  and pre-stop checkpoints. Explicit save requests also produce pending proposals. Each turn
  handles at most three proposals, with one per distinct incident; further incidents are deferred.
  Children report evidence to the coordinator, who owns the write. A blocked capture reports
  its cause once and leaves independent task work running. It grants no extra repair attempt.
- A recurrence retains the examined rule digest and available task evidence. Its diagnosis
  separates missing retrieval, a violated rule, incomplete guidance, failed enforcement, and
  unknown cause. Conflicts remain proposals for review. Structural follow-ups need separate
  authorization and proof; judgment-dependent rules state why they remain text.
- `docs/procedures/lesson-format.md` gives the lesson files, the pending folder and its ignore
  file, the lock of `lesson-store`, and its recovery.
- Each agent landing curates the queue first, in the lane: one fresh reviewer child decides at
  most the five oldest proposals by the reviewer rules of `docs/procedures/lesson-curation.md`,
  and its lesson commits land with the lane. No human approves these decisions. A curation
  failure keeps the decisions applied before it, leaves the other proposals pending, and the
  landing runs. `lesson-review` is your optional review: it can promote, edit, merge, supersede,
  retire, or reject selected records, and it shows the exact snapshot before your approval;
  changed inputs require a new review. Each result keeps its origins, incident evidence,
  uncertainty, and review history. In a linked checkout, `lesson-store apply` commits only the
  live lesson paths on the lane branch, before the proposals leave the queue. In the main
  checkout it leaves the Git index unchanged.

An existing unreadable or malformed store is an error. Its failed read is not an absent store.
Existing records, catalogs, guidance, and templates stay unchanged unless the relevant writer or
owner explicitly changes them.

## Review old wiring

Setup reconciles valid recorded scopes in the active product checkout. It refreshes current
owned requirements and removes obsolete owned entries, including edits within owned keys and
dedicated files. It preserves differing unowned values and old unrecorded wiring with exact
warnings. Installation and update remain separate explicit operations. The marked `## Celetis`
entry pointer retains its bounded marker authority, even without a record.

1. Review the complete setup diff, including deleted paths, new files and JSON formatting.
   The resulting record contains current ownership only. Setup reports surviving tracked callers
   of a removed launcher by path; it changes no product caller. Its literal search cannot find
   dynamic or external references. A remaining caller or unresolved wiring warning prevents a
   claim that the wiring is current.
2. Review these candidates against the required forms above:

   - Copied `scripts/celetis` launchers and every caller in scripts, CI, instructions, permissions,
     and board configuration. Move each approved remaining caller to the installed `celetis`
     engine. A valid whole-file claim permits setup to remove the launcher; unrecorded launchers
     need owner review. Keep product additions until their owner has reviewed them.
   - Old `permissions.allow` entries for `scripts/celetis`, `./scripts/celetis`, or broad `celetis`
     calls in `.claude/settings.json`, and obsolete entrypoint allows in
     `.codex/rules/celetis.rules`. Keep the direct-merge restriction. Personal `land` and optional
     `issue` rules stay explicit and local.
   - The old `.gitattributes` line `scripts/celetis text eol=lf`. Keep
     `.celetis.yaml text eol=lf` and unrelated attributes.
   - Project `enabledPlugins.celetis@celetis` in `.claude/settings.json`. The supported Celetis
     installation is user-scoped. Keep Superpowers and other plugins, the required marketplace,
     and product settings. Review effective automatic-update policy separately.
   - Old generic board commands, including `scripts/celetis board` and its `./` form, in launch
     files or scripts. Keep product-specific board configuration, port choices, and local desktop
     entries. `celetis daemon start` serves the board and prints its URL.
   - The exact generic flow lines below. Read the repository identity from the recorded flow line,
     not from a current answer alone, and compare the current content. A matching phrase alone is
     insufficient evidence of ownership.

     ```markdown
     ## Celetis flow

     - The lanes are the skills of the plugin `celetis`, on the issues of `<owner>/<repo>`.
     - `landing` in `.celetis.yaml` names the landing mechanism, and a build step ends with `celetis --agent <host> land`.
     - A lane never skips a step.
     - The maintainer starts the runner; an agent starts it only when its task says so, with a number, and in a terminal.
     ```

3. The owner reviews unowned removals and caller changes in a separate product change. Keep
   product-specific flow instructions and every unreviewed unowned entry. Setup removes an old
   recorded generic heading only when no product content remains in its section. Existing generic
   ADR files and populated stores stay product content and need independent owner review. Commit
   repairs before another setup run so the tree meets its preflight requirements.

The existing `setup try` and `setup write` share the reconciliation plan; there is no separate
cleanup command. One final commit-and-push question covers all shown additions, replacements
and removals. A local desktop configuration stays product content.
The line that no file changed describes only the diff. With any unresolved wiring or policy
warning, it establishes neither current wiring nor native policy loading. Keep each exact warning
and its manual action in the report.

## The wiring on the trunk

The wiring must be on the trunk of `origin` before the first lane. A lane branch starts at the trunk
of `origin`, so a file that is not there is in no lane worktree: `.celetis.yaml`,
including a custom part and the worktree setup. A file that git does not track also makes the main
checkout dirty, and the resolver then stops each issue.

Setup stops before any write when the index holds a staged change, or when an affected setup path
has an uncommitted change, including a planned deletion. Validated obsolete owned paths, such as
the copied launcher, are in the plan and commit; starter documents stay product content. Setup
stages only validated planned wiring paths and excludes unrelated product changes. After a failed
write, the report shows the failing path, `git status --short`, the complete diff of each changed
or deleted setup path, and every new setup file in full. Partial writes need owner review and
a commit or restore before retry;
setup claims no success and makes no automatic push. After a successful write, setup asks one
question: commit and push to the trunk of `origin`?

- On a yes, setup commits the files that it changed, with the subject
  `chore(celetis): wire the project for the celetis lanes`, and it pushes the trunk. The push also
  carries each commit of the local trunk that is ahead of `origin`, and setup names them before it
  asks. When `origin` refuses the push, setup stops with the message of git, and the commit stays
  on the local trunk. A later run of setup pushes it after you fix the cause. When the trunk
  refuses direct pushes, push the setup commit to a branch, land it through a PR, and then run
  `git pull --rebase` on the local trunk. After a squash landing, a pull with a merge keeps the
  setup commit ahead of `origin`, and the next push is refused again.
- On a no, the files stay uncommitted in the main checkout, and the resolver stops each issue until
  you commit or drop them.

Commit each change that you make by hand on the trunk too, and push it: for example a custom part
in `.celetis.yaml`. The `.celetis.yaml` file needs LF line endings on each host. Setup adds
`.celetis.yaml text eol=lf` to `.gitattributes`. When
the index holds `.celetis.yaml` with CRLF line endings, setup stops before any write: convert the
file to LF and commit it first.
