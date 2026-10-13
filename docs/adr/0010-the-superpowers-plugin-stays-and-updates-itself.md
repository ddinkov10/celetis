# The superpowers plugin stays, and it updates itself

## Date

2026-10-11

## Related

- #412: the spec, the plan, and the comment `## Live proof`
- #413: the review of superpowers 7.0.0 against the lane skills
- ADR-0011 (`docs/adr/0011-herdr-gives-the-session-state-and-ends-each-step.md`): the harness moves
  to another repository with no change, and `--plugin-dir` went
- `.claude/settings.json`, `docs/agents/agent-flow.md`

## Context

The skills `specify`, `plan`, `implement`, `bug`, and `hotfix` delegate to `superpowers:*` skills:
`brainstorming`, `writing-plans`, `subagent-driven-development`, `systematic-debugging`, and
`finishing-a-development-branch`. These skills come from the Claude Code plugin
`superpowers@superpowers-marketplace`. On the machine of the maintainer, the copy stayed at 6.4.1
from 2026-09-19 while upstream released 6.4.2 (2026-09-25) and 7.0.0 (2026-10-10). The maintainer
had to see a release and update the plugin by hand, and asked for a mechanism that gives each
harness session the latest release with no update step. The repository also held no record that the
harness needs the plugin.

## Constraints and evidence

From the documents of Claude Code (code.claude.com/docs, read on 2026-10-10 and on 2026-10-11) and
from the machine of the maintainer:

- The plugin system had not failed. By default, auto-update is on for most official marketplaces,
  such as `claude-plugins-official`, and for marketplaces added from claude.ai, and it is off for
  every other marketplace. It was off for `superpowers-marketplace`, so no refresh ran after the
  install.
- Whether a marketplace auto-updates follows the first of these that is set: `autoUpdate` on its
  `extraKnownMarketplaces` entry in a settings file, `autoUpdate` on its entry in
  `~/.claude/plugins/known_marketplaces.json`, the default.
- When two settings files define the same marketplace name, Claude Code v2.1.228 or later uses the
  entry of the highest file whole. The order, highest first, is managed settings, the `--settings`
  value, `.claude/settings.local.json`, `.claude/settings.json`, `~/.claude/settings.json`.
- Claude Code takes `extraKnownMarketplaces` from a project file only after the workspace trust
  dialog for the folder. A worktree uses the trust of the main checkout.
- In an interactive session, after the first message, Claude Code waits a random delay of up to 10
  minutes. It then refreshes each marketplace with auto-update on and updates the plugins that are
  installed from it. The session keeps the versions that it loaded, and it shows
  `Plugin updated: superpowers · Run /reload-plugins to apply`. The next session loads the new
  version. Claude Code removes the folder of the old version 14 days later.
- The marketplace entry of superpowers is the git URL `https://github.com/obra/superpowers.git` with
  no `ref`, so Claude Code reads the head of `main`. The version of the plugin is the `version` of
  `.claude-plugin/plugin.json`, and an update copies the plugin only when that version differs from
  the installed record. On 2026-09-19 and on 2026-10-10, `main` was equal to the tag of the release.
- Claude Code does not fetch a plugin that only a project file enables. On a machine where the
  plugin is not installed, the Errors tab of `/plugin` shows
  `Plugin "superpowers" is enabled in project settings but isn't installed here`.
- Claude Code must know a marketplace before it installs from it, and
  `claude plugin marketplace add` writes the marketplace to `extraKnownMarketplaces` in the user
  settings. The project file declares no marketplace, so a machine that does not know
  `superpowers-marketplace` needs this command before the install command. No second machine ran
  the three setup steps.
- The premise that Claude Code takes `autoUpdate` from the `extraKnownMarketplaces` entry of a
  project file is not tested. On 2026-10-11, `"autoUpdate": true` was on the entry
  `superpowers-marketplace` in `~/.claude/settings.json` and in `known_marketplaces.json` of the
  maintainer. Each interactive session on the machine thus refreshed the marketplace, and a proof
  could not show which key caused a refresh.
- The live proof of #412 (the comment `## Live proof`), with Claude Code 2.1.296 on 2026-10-11 and
  with the two keys on: after `2026-10-11T14:51:44Z`, no plugin command ran in the `implement`
  session or in the proof session, and the `lastUpdated` of `superpowers-marketplace` went from
  `2026-10-11T14:51:17.633Z` to `2026-10-11T14:57:25.426Z`. Three of the twelve marketplaces of the
  machine moved in 4 seconds at that time, `claude-plugins-official`, `superpowers-marketplace`,
  and `anthropic-agent-skills`, and the nine others did not: this is the pattern of an update pass,
  not of an update by hand. Other sessions ran on the machine, so the readings do not show which
  session ran the pass.
- No reading shows an update pass that copies a release. In the proof the installed version was
  7.0.0, the upstream version, before and after. The `user` record of the plugin was last written at
  `2026-10-11T14:26:56.381Z`, with a refresh of this one marketplace: `claude-plugins-official` did
  not move at that time, so that write was not an update pass.
- A session that starts in a checkout whose project file enables the plugin writes a second record
  of the plugin to `installed_plugins.json`, with the scope `project` and the path of that checkout.
  On 2026-10-11 the proof session of #412 caused such a record for its worktree, at the version and
  the cache folder of the `user` record. The documents say that a plugin installed at project scope
  from the main checkout also loads in the worktrees of the repository. They do not say whether the
  update pass moves a `project` record together with the `user` record, and no release arrived to
  show it. One `project` record on the machine was behind its marketplace on 2026-10-11:
  `expo@claude-plugins-official` at 1.8.5, while its marketplace entry pinned a commit whose
  `plugin.json` has the version 1.13.6. It is not known whether a session ran in that project after
  the change of the entry.

## Decision

- **The plugin stays the source of the `superpowers:*` skills.** The plugin system had not failed:
  auto-update was off.
- **Each machine turns auto-update on once, and the project file enables the plugin.**
  `.claude/settings.json` sets `"superpowers@superpowers-marketplace": true` under `enabledPlugins`;
  that entry is the record that the harness needs the plugin. Auto-update is `"autoUpdate": true` on
  the entry `superpowers-marketplace` of `extraKnownMarketplaces` in `~/.claude/settings.json`. The
  maintainer chose this key with no test of the same key in the project file: a proof on a machine
  with the two user-level keys cannot isolate it. The marketplace refreshes on the machine with this
  key and the same key in `known_marketplaces.json`. `docs/agents/agent-flow.md` gives the step.
- **"The latest release" is the head of `main` of `obra/superpowers` at the first update pass after
  a change of the `version` in `.claude-plugin/plugin.json`.** Upstream changes that version with
  each release.
- **A new machine does three things once:** it adds the marketplace
  (`claude plugin marketplace add obra/superpowers-marketplace`), it installs the plugin
  (`claude plugin install superpowers@superpowers-marketplace`), and it sets the `autoUpdate` key.
- **Nothing else changes.** There is no script, no flag of `claude`, and no line in
  `scripts/agent-flow.sh`. No lane skill changes: #413 holds the alignment with 7.0.0.

## Alternatives considered

- **A clone of `obra/superpowers` that the harness owns, loaded with `--plugin-dir`.** The harness
  then controls the time of each update. But it brings back the flag that ADR-0011 removed, and it
  adds a sync script.
- **A pinned copy in the repository, with a bot PR for each release.** The maintainer sees each
  release before the lanes use it, and no upstream code runs with no review. But each release waits
  for a merge, and the maintainer asked for no update step.
- **An update command in the runner** (`claude plugin update` before each step). Each step session
  then starts on the latest release. But it adds a network call before each step, and it has no
  effect on a session that the maintainer starts by hand. Add it when the lag of one session is a
  problem.
- **The copy of superpowers in the official marketplace** (`superpowers@claude-plugins-official`).
  Auto-update is on by default for that marketplace. But on 2026-10-11 its entry pinned
  `obra/superpowers` at the commit of v6.4.1, two releases behind.

## Consequences

- By the documents, an interactive session on a machine with the key updates the copy of superpowers
  on disk with no plugin command, and each later session loads that version. The proof showed only
  the refresh of the marketplace.
- A release reaches the lanes one session late: the session that gets the update keeps its own
  version.
- A session that ends before the update pass does not update. A short step of the runner can end
  that early. The next session tries again.
- With no network, a session loads the version on disk, and the copy does not change.
- `DISABLE_UPDATES=1`, `DISABLE_AUTOUPDATER=1`, or `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1`
  turns the update pass off, unless `FORCE_AUTOUPDATE_PLUGINS=1` is set.
- Each machine needs the `autoUpdate` key in `~/.claude/settings.json`. A machine without it stays
  on the version of its install, with no message, so the harness does not move to another machine
  with no setup. This goes against ADR-0011: that record removed one user setting of the harness
  and says that the harness can move to another repository with no plugin. The lanes need the
  superpowers plugin, and each machine needs this key.
- A project file, a `.claude/settings.local.json`, a `--settings` value, or managed settings that
  define `superpowers-marketplace` replace the user entry whole, with its `autoUpdate`. When the new
  entry has no `autoUpdate`, the key in `known_marketplaces.json` decides, and without that key
  auto-update is off, with no message.
- Upstream code runs with no review. The plugin has a `SessionStart` hook: a bad or hostile release
  runs on the machine at the start of the next session, and its skills steer each lane.
- An upstream release can change a lane with no change in this repository. The lane skills name
  upstream behavior, and 7.0.0 shows it for `specify` (#413). The only signal is the line
  `Plugin updated: superpowers` of the session that got the update.
- A commit on `main` that does not change the version in `plugin.json` does not reach the machine,
  and a change of that version before the release is tagged does.
- Each checkout where a session starts gets a `project` record of the plugin in
  `installed_plugins.json`. The documents name no removal of such a record when its checkout is
  removed, so the record of a removed worktree can stay. It is not proven that a `project` record
  follows an update, and the documents do not say which record a session loads when two records
  have different versions. After the next upstream release, a new session in each checkout that has
  sessions must load the new version: the `Base directory` line of a `superpowers:*` skill names the
  folder of that version.
- In a checkout of this repository, a `claude plugin` command with no `--scope` has another target.
  By the documents, `claude plugin update superpowers@superpowers-marketplace` updates the `project`
  record of the checkout, when it has one, and not the `user` record, and
  `claude plugin disable superpowers@superpowers-marketplace` writes the committed
  `.claude/settings.json`. An update by hand in the repository, and the update command in the
  runner, need `--scope user` to update the `user` record.

## Reconsider when

- An upstream release breaks a lane, or ships code that the maintainer would not run with no review:
  the pinned copy with a bot PR is then the alternative.
- After an upstream release, an interactive session runs its update pass and the `user` record of
  the plugin stays on the old version: the update command in the runner, with `--scope user`, is
  then the alternative.
- After an upstream release, a `project` record of the plugin stays on the old version and the
  sessions of that checkout load it: the `enabledPlugins` entry of the project file and the
  `project` records then go.
- Upstream stops changing the `version` in `plugin.json` with each release, moves `main` ahead of
  its releases, or adds a `ref` to the marketplace entry.
- A test on a machine without the two user-level keys shows that Claude Code takes `autoUpdate` from
  an `extraKnownMarketplaces` entry of a project file: the key then moves to
  `.claude/settings.json`.
- Claude Code changes the rule for `autoUpdate` on an `extraKnownMarketplaces` entry of a settings
  file, the rule for two entries of one name, or the time of the update pass.
- The lag of one session is a problem: the update command in the runner is then the alternative.
- The harness runs in a CI job or in a cloud session.
- The source of the `superpowers:*` skills is no longer the plugin
  `superpowers@superpowers-marketplace`.
