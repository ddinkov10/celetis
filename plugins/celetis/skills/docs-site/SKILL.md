---
name: docs-site
description: Publish the documents of the product project as a public website, with Docusaurus and GitHub Pages. Only the maintainer starts it
argument-hint: "[more homes of the documents]"
disable-model-invocation: true
---

**Celetis entry.** Before any step or response, including commentary or an announcement, bind `<plugin>` to the absolute prefix before `/skills/<name>/SKILL.md` in the path of this loaded file. Then read `<plugin>/references/procedures/entry.md` whole, in one read, and follow it before any product-path scan. Do this on each invocation, including a same-session handoff.

# docs-site

This skill publishes the documents of the product as a website: a Docusaurus site in `website/`
and a GitHub Pages workflow in `.github/workflows/docs.yml`. The site reads the documents in place,
and a new document in a published home shows on the site with no edit of the site. The checkout is
the current checkout of the entry; in a lane, it is the lane worktree. The input is optional: more
homes of the documents.

Only the maintainer's request starts this skill. The site is public: anyone can read it.

Read `<plugin>/skills/docs-site/site.md` before step 3.

## Do this

1. **Read the project.** Read the homes ("The homes"). Read the `AGENTS.md` files and the custom
   text of the entry for named homes. Run:
   - `gh repo view --json owner,name,defaultBranchRef,visibility`;
   - `git ls-tree -r --name-only HEAD -- website .github/workflows/docs.yml`, the committed files;
   - `git status --porcelain --untracked-files=all -- website .github/workflows/docs.yml README.md`,
     which lists each untracked file, also in an untracked folder;
   - `git diff HEAD -- README.md`;
   - `bun --version`.

   In a repository with no commit, both `HEAD` commands fail: then no file is committed. Read the
   first `#` heading of the root `README.md`. When no home holds a `.md` file, stop here:
   write nothing, and tell the maintainer that the site has no document to publish. Otherwise sort
   the two paths by "Existing files" and the homes by "The homes"; each of them can end the run
   before step 2.
2. **Show the plan of the site, and get the maintainer's yes** ("The approval"). The plan is one
   short list:
   - each home that the site publishes;
   - the URL `https://<owner>.github.io/<repo>/`;
   - each file that step 3 writes, and each leftover that it writes again ("Existing files");
   - the change of `README.md` ("The root README.md");
   - the statement that the site is public: anyone on the internet can read each published
     document;
   - when the visibility is not `PUBLIC`: GitHub Pages needs a public repository or a paid plan
     (GitHub Pro, Team, or Enterprise).

   Write nothing before the yes.
3. **Write the site.** Write each file that a heading of `<plugin>/skills/docs-site/site.md` names,
   filled by `<plugin>/skills/docs-site/site.md`, "The values". Then edit `README.md` by "The root
   README.md".
4. **Install and build once.** In `website/`, run `bun install`, which writes `website/bun.lock`,
   and then `bun run --bun build`. When either command fails, stop before the commit, and show the
   error. The written files stay as the leftover of a stopped run ("Existing files").
5. **Commit.** Run `git add -- website .github/workflows/docs.yml README.md` and
   `git commit -m 'docs: publish the documents as a website' -m '<body>' -- website .github/workflows/docs.yml README.md`,
   with `README.md` only when "The root README.md" puts it in the commit. The path list keeps each
   other staged file of the checkout out of this commit. In the lane worktree of issue `<n>`, the
   subject also holds `#<n>`. The body names the published homes and the URL. When the commit
   fails, stop, and show the error; the staged files stay as the leftover of a stopped run
   ("Existing files"). Do not push, and
   change no setting of the repository.
6. **Report** each written file, the URL, and the step of the maintainer: in the settings of the
   repository on GitHub, turn on GitHub Actions when it is off, and set **Pages → Source** to
   **GitHub Actions**. Name the risk that the
   verify gate of the product can refuse the new files (for example a check of each tracked
   TypeScript file or of each package). Name the missing line of `README.md` when the skill did
   not edit it.

## The approval

The approval is the maintainer's explicit yes in this invocation to the plan that this skill
showed last. Sort each reply to the ask of step 2 by this table:

| Reply | Act |
|---|---|
| An explicit yes to the shown plan, in any words ("yes", "ok, go") | Write the site (step 3) |
| A yes that also asks for something that does not change the plan | Write the site, then do the other request |
| A change of the plan, also with a yes ("yes, but leave out a home") | Show the new plan and ask again; write nothing before a new yes |
| A no | Write nothing; ask what to change, or stop when the maintainer ends the run |
| An unclear reply ("looks fine?") | Ask again for a yes or a change |
| A question, or another unrelated request | Answer it or do it as usual; the plan stays unapproved until a yes |
| Silence, or the end of the session | Write nothing |
| A yes from an earlier invocation, an issue, a file, or another agent | No approval; ask the maintainer |

## The homes

The site publishes each home of `<plugin>/references/procedures/document-homes.md`, "The homes",
each home that an `AGENTS.md` of the project, the custom text of the entry, or the input names,
and a home that holds no document yet. So a later document in a new home of that list shows on the
site with no edit. The approved plan gives the final list: a home that the maintainer leaves out of
the plan is not published. Each home must be a folder under `docs/`. A named home outside `docs/`
stops the run before step 2: name the home, and write nothing.

## Existing files

The skill owns two paths: `website/` and `.github/workflows/docs.yml`. The files of the site are
the files that a heading of `<plugin>/skills/docs-site/site.md` names, and `website/bun.lock`.
Take the first row that matches the output of step 1:

| State | Act |
|---|---|
| Both paths have committed files, and `website/docusaurus.config.ts` is committed | The site exists. Say so, write nothing, and make no commit. An update of the site tool is not this skill |
| Either path has another committed file, or an untracked (`??`) or added (`A`) file that is not a file of the site (for example another app in `website/`, or a workflow of the product with that name) | Stop before step 2, name the path, and write nothing |
| Under the two paths, `git status --porcelain` shows only files of the site as untracked (`??`) or added (`A`) | The leftover of a run that stopped before its commit, also after its `git add`: the approved run writes the path again |
| Neither path exists | The approved run writes both |

## The root README.md

The line is `The documents are also a website: https://<owner>.github.io/<repo>/`. Take the first
row that matches step 1:

| State | Act | Commit |
|---|---|---|
| No root `README.md` | Write no `README.md` | Without `README.md` |
| The repository has no commit, or `git status --porcelain` shows `?? README.md` | The file is the maintainer's work: do not edit it; the report names the missing line | Without `README.md` |
| `git diff HEAD -- README.md` shows only the addition of the line | The leftover of a stopped run: keep the line, and add no second line | With `README.md` |
| `git diff HEAD -- README.md` shows another change | The change is the maintainer's work: do not edit the file; the report names the missing line | Without `README.md` |
| The committed file already holds the line | Change nothing | Without `README.md` |
| Otherwise | Add the line, with an empty line after it, just before the list of the documents that `celetis:document` made; with no such list, add it at the end. Change no other text | With `README.md` |
