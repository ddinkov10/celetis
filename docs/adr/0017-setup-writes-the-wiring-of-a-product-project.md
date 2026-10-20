# The setup command writes the wiring of a product project

## Date

2026-10-20

## Related

- ddinkov10/celetis#41: the spec of the setup command, with the decisions of the maintainer, and
  its two plans.
- ddinkov10/celetis#32 and ADR-0015: one `.celetis.yaml` for each repository. #32 landed before
  #41.
- ddinkov10/celetis#46: the second run, which replaces and removes owned entries. #42 and #43:
  the later children, the worktree setup and the agent board.
- ADR-0012: the plugin, the wiring by hand in layer 1, and the order of the later issues.
  ADR-0014: the explicit host operations.
- `skills/setup/SKILL.md`, `scripts/setup.sh`, `tests/setup.test.sh`, and `README.md`, "Wire a
  product project".

## Supersedes

From ADR-0015, "One repository YAML file owns Celetis setup", one clause of its Decision: "Add no
fallback, automatic migration, settings generator, or dependency installer." The clause changes
for the setup of a product project only. `/celetis:setup` writes the native host settings of the
wiring and the entries `host` and `landing` of `.celetis.yaml`. It is still no fallback, no
automatic migration, and no dependency installer: it reads no file of the old layout, and the
cutover of ADR-0015 stays manual. This record changes no other part of ADR-0015.

## Context

In layer 1 (ADR-0012), the maintainer wrote the wiring of each product project by hand: the
launcher, the permission rules, the config, the lines of `.gitignore`, the labels, and the stores.
To choose the landing, the hand work had to read `.github/workflows/`. It also did not see that the
local trunk was 5 commits ahead of `origin`, so a new lane branch would not get them. ADR-0012
names a setup command as the next function after the first product project that gets the plugin
by hand. More product projects now need the wiring.

## Constraints and evidence

- The maintainer made the decisions of the spec of #41 in a session on 2026-10-20. Decision 7 put
  #41 before #32. #32 landed first (`eb2203e`), with no change of setup (risk 8 of the spec). So
  the second plan of #41 moves setup to the config of ADR-0015. Since #32, no script reads
  `.claude/celetis-flow/landing.json` or `git config celetis-flow.agent`.
- Claude reads `disable-model-invocation: true` in the frontmatter of a skill, and Codex reads
  `policy.allow_implicit_invocation: false` in `agents/openai.yaml`. With these keys, only a human
  starts the skill (Claude Code 2.1.303 and Codex 0.162.1, "External facts" of the spec).
- Nix home-manager and Copier keep a record of what they wrote, so that a later run can tell
  their parts from the parts of the user (decision 2 of the spec).
- `celetis_config_read` needs Mike Farah yq `>=4.54.1,<5` and `jq`. With yq v4.54.1 on
  2026-10-20:
  - a line after a `|-` block with no final newline parses, and the block keeps its value;
  - a CRLF file with an appended LF line parses;
  - a line after a flow root (`{landing: pr}`) or after a `...` end marker gives
    `<document>: invalid YAML`;
  - a second `host` line gives `host: duplicate key`;
  - a `|` or `|+` block at the end of a file with no final newline gets one more newline in its
    value when a newline and a line come after it.
- A rewrite of `.claude/settings.json` with `jq` can change lines of the product: it splits an
  array on one line, changes CRLF to LF, and adds a missing final newline. The report of the
  skill shows such a change.
- `tests/setup.test.sh`, in the verify gate, covers the writes on an empty project, on a project
  with its own entries, and on a hand-wired project, the record, a rerun, the trunk checks, and
  the cases of `.celetis.yaml`. The live checks V3 (an empty project with a push) and V4 (the
  skill on Claude Code 2.1.302) passed for the build `a7364d8`, before the change to
  `.celetis.yaml`. The plan of that change runs them again.

## Decision

**The command is a skill in a session** (decision 1 of the spec). `/celetis:setup` is a skill
that only a human starts. The session asks the questions and holds the approval: the tracker, the
hosts, the default host, the landing, and one question before the commit and the push.
`scripts/celetis setup` does each deterministic act, in three sub-commands: `check`, `write`, and
`push`. The skill calls the launcher of the plugin, because the project can have no launcher yet.
The later children need the judgment of a session: #42 detects the stack, and #43 checks herdr.

**A record holds the ownership** (decision 2). `.claude/celetis-flow/wiring.json` is committed
with the wiring. It holds the answers (the hosts and the tracker), each file that setup owns
whole, and each entry that setup owns in a shared file: a JSON entry as its path (and its item in
an array), and a line as its text. Setup changes or removes no entry that is not in the record.
In #41, setup removes nothing: removal is #46.

**A first run adopts each equal entry** (decision 3). An entry that is there and equals an entry
of the current form goes into the record as owned. So a hand-wired project comes under the second
run of #46.

**Setup writes the host files** (decisions 6 and 7). For each chosen host, it writes the owned
entries of `.claude/settings.json` or the whole `.codex/rules/celetis.rules`, in the form of the
README. This replaces the sentence of the spec of #32 that Celetis does not generate the host
files. The owned entries of `.claude/settings.json` include the plugin block, beside the
permission rules: `extraKnownMarketplaces.celetis` and the two keys of `enabledPlugins`. A project
cannot decline the block. A block that the maintainer removes comes back at the next run.

**Setup writes the current config** (decision 7, and the second plan of #41). `.celetis.yaml` is
a shared file for both hosts. Setup owns two entries in it, `host` and `landing`, with the record
entries `{"path": ["host"]}` and `{"path": ["landing"]}`. The product owns each other field. `host`
holds the default host, or the one host. The file is committed, so each clone gets the value.

- Setup adds each missing entry as a line at the end of the file. It never rewrites the file with
  a YAML tool, so the comments, the literal blocks, and the order of the product keep their bytes.
  A new file holds `host` before `landing`.
- A `host` or `landing` with a value other than the answer is an entry of the product. Setup
  leaves it, prints a warning, and adds no record entry for it. The maintainer changes that field
  by hand. Replacement is #46.
- Setup stops before any write in two cases: the reader refuses the file (for example, a file
  with no `landing`), or the file cannot take a line. A file cannot take a line when the reader
  refuses the file with the line, or when the line changes a value of the product.
- `.gitattributes` gets the owned lines `scripts/celetis text eol=lf` and
  `.celetis.yaml text eol=lf`. The second owned line of `AGENTS.md` names `landing` in
  `.celetis.yaml`.
- Setup writes no `.claude/celetis-flow/landing.json`, and it sets no `celetis-flow.agent` in the
  Git config.

## Alternatives considered

- **A script with flags, and no session.** It is simpler to test. But the landing proposal is a
  judgment (risk 2 of the spec), and the later children (#42, #43) need the judgment of a session.
- **No record: compare the files with the current form at each run.** A later run then cannot
  tell an owned entry from an equal entry of the product. And #46 cannot remove an entry that the
  current form drops.
- **A record of the added entries only, with no adoption.** The hand-wired projects then stay
  outside #46: no run can replace or remove their entries.
- **No host files from Celetis, as the spec of #32 said.** Each product project then writes its
  permission rules and its plugin block by hand. That is the work that setup removes.
- **A plugin block that a project can decline.** It keeps a choice of the product, for example an
  empty `enabledPlugins`. But setup then has more than one form, and the project file gives the
  marketplace `celetis` no `autoUpdate` key (ADR-0012, R2).
- **Keep `landing.json` and `git config celetis-flow.agent`, as the first plan of #41 did.** No
  script reads them since #32. A Git setting is also local to one clone, so the other clones do
  not get it.
- **Rewrite `.celetis.yaml` with yq.** yq can set a key in one command. But it writes the whole
  file again, and it can change the comments, the literal blocks, and the format of the product.
  The bar is a hand edit of the YAML.
- **Replace a differing `host` or `landing` with the answer.** The maintainer then does less by
  hand. But setup then changes an entry of the product, against an anti-goal of the spec.

## Consequences

- The maintainer wires a product project with one command in a session. The diff and one question
  hold the approval. A rerun writes the owned files again and adds each missing entry. With no
  change, it prints `setup: no file changed`.
- Setup is now a settings generator for the wiring of a product project. The cutover of an old
  setup stays manual: setup reads no file of the old layout.
- Each product project holds one more file, the record. Setup stops on a record that it cannot
  read, until the maintainer fixes or removes it.
- A project cannot decline the plugin block.
- Adoption can take an entry that the product also needs for its own reason, for example
  `.claude/worktrees/` (risk 3 of the spec). #46 must name each removal in its diff.
- A `host` or `landing` that differs from the answer stays until the maintainer changes it by
  hand.
- Setup reads an existing `.celetis.yaml` with yq and jq. With no `.celetis.yaml`, setup needs no
  yq.
- A `.celetis.yaml` that cannot take a line at its end needs a hand edit before setup: a flow
  root, a `...` end marker, or a `|` or `|+` block at the end with no final newline.
- Not checked: a protected trunk (risk 1 of the spec), a fresh clone on Windows (risk 5), the
  explicit selection on Codex (risk 6), and Codex in a project with no `.codex/` folder (risk 7).

## Reconsider when

- Each act of setup can run with no judgment of a session.
- A host gives a native way to wire a project, its permission rules and its plugins, with no file
  in the project.
- #46 needs a fact of ownership that the record does not hold.
- A YAML tool can add a key to a file and keep each other byte.
- A product project must keep the plugin block out of its `.claude/settings.json`.
- The schema of `.celetis.yaml` moves `host` or `landing` out of the file.
