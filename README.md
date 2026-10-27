# celetis

`celetis` is a general agent harness with required automation for Claude Code and Codex TUI/CLI.
The shared flows also allow manual or inline invocation in the Codex desktop app.
It takes a request from free text to a change on the trunk through one GitHub issue: the intent,
the lane, the spec, the plan, the
build, and the landing. The issue is the state store: each result goes onto the issue, and each
hand-off reads the issue again.

Codex remains opt-in while required CLI workflow acceptance is incomplete. Changed-pair same-child repair and final live workflows still need proof. Open sessions have
no immutable-resource or automatic skill-reload guarantee (ADR-0028). Desktop automation is optional and has separate evidence in
[Acceptance status](docs/celetis-flow.md#acceptance-status).

The plugin holds:

- 19 skills: the lanes, the steps of a lane, the skills for review and memory, and the helpers
  ("The skills");
- the scripts: the runner, the resolver, the landing script, the worktree script, the setup
  script, and the capability scorer ("The commands");
- the step text of the runner, `step-prompt.md`;
- the documents that the skills cite, in `docs/`.

There are two kinds of repository:

- The **plugin repository** is this one, `ddinkov10/celetis`. It is private, and it is also the
  marketplace `celetis` with one plugin, so the id of the plugin is `celetis@celetis`.
- A **product project** is any repository that uses the plugin. This repository also runs its
  own lanes on its own installed plugin.

A product project holds no Celetis launcher, runtime source, skill, or document of the harness. It holds only what is its own:

| Part | Place in the product project |
|---|---|
| The host wiring | Claude: `.claude/settings.json`. Codex: the installed plugins and trusted `.codex/config.toml` and `.codex/rules/` (below) |
| The config | `.celetis.yaml` |
| The record of setup | `.claude/celetis-flow/wiring.json` |
| The worktree setup | `worktreeSetup` in `.celetis.yaml` |
| The custom parts | `custom.<skill>` in `.celetis.yaml`, one string for each skill that needs one |
| The product facts | `AGENTS.md` |
| The stores | `docs/adr/` and `docs/lessons/` |

No file of the plugin names a part of a product, apart from the records of `docs/adr/`. The plugin
names a role, for example "the verify gate of the project", and the product project names the
thing. A lane ends when the change is on the trunk, which is the default branch of the repository
on GitHub: the verify gate, the deployment, and each other part of a product stay in the product
project. The plugin has no `version` or declared dependency. Its source entrypoint is `bin/celetis.ts`;
its runtime is `engine/`. Shared permissions restrict direct merges. Personal host rules bind landing. Its Claude native hook completes file entry before skill expansion.
Codex declares no Celetis lifecycle hooks and uses the shared skill entry instructions.
ADR-0030 owns the installed entrypoint and update controls. ADR-0012 holds the original packaging decision; ADR-0014 extends it to both hosts without a
second copy of the procedures. ADR-0015 replaces their config storage clauses with one YAML file.
ADR-0016 limits required automation to the CLI hosts while keeping desktop invocation available.
ADR-0032 records shared configuration parsing and immutable operation values. The
[configuration reference](docs/configuration.md#operation-values-and-freshness) names each fresh
read boundary. Native skill entry still reads its whole active file through the host's permission
controls and applies only that skill's custom text.

## Requirements

- macOS or Linux for the runner. Commands use Bun 1.4.4 or later. Native Windows is partly
  checked: the documented command form loads the launcher from Git Bash, and a numbered runner
  start, the data of the board before #102, and the update lock passed their checks. Other parts
  are open ([Acceptance status](docs/celetis-flow.md#acceptance-status)).
- The selected host CLI: Claude Code 2.1.299 or later, or Codex CLI 0.162.1 or later. The Claude
  entry hook reads the `skill.prompt` fields `source`, `pluginName`, and `path`, which came in
  2.1.299; an older release stops each skill for hook setup. Codex 0.162.1 is the lowest release
  on which the install, the refresh, and the lookup of the plugin were checked; an older release
  is not supported. These versions are a floor, not proof of the full workflow
  ([Acceptance status](docs/celetis-flow.md#acceptance-status)).
- `gh` (logged in), Bun 1.4.4 or later, and `git` 2.31 or later on `PATH`.
- Git credentials for GitHub that need no prompt, an ssh key or a credential helper for https: the
  plugin repository is private.
- Superpowers, installed and enabled on the selected host: the lanes call its `superpowers:*` skills.
- herdr 0.9.3, for the step end of the runner and for the board. In another terminal the
  runner works too, but you leave each session with `/exit`.
- For the board: a Chromium browser.

`docs/celetis-flow.md` gives each requirement in full ("Requirements", and "The board").
The [configuration reference](docs/configuration.md) gives the repository schema and the
commands that install Bun.

## Wire a product project

### Each machine: Claude Code

1. Add the marketplace, and install the plugin:

   ```bash
   claude plugin marketplace add ddinkov10/celetis
   claude plugin install celetis@celetis
   ```

   The install enables the plugin at the `user` scope, so each session of the machine loads it, in
   each folder. A session in a project that is not wired also lists the 19 skills, and a lane
   skill that starts there from free text makes a GitHub issue before it validates product setup.

   The user install is the only supported Claude install. A project install of `celetis@celetis`
   makes discovery refuse, with `Claude installation is ambiguous`. Setup writes no project
   enable of the plugin.

   Terminal discovery finds the enabled plugin through native metadata, so the two commands are
   necessary on each machine. It is not shown that the block of the project file (below) loads
   the plugin with no install. In the probe, a headless turn in a new repository whose project
   file held the marketplace and the two plugins loaded no plugin and added no marketplace. A
   headless turn shows no workspace trust dialog, so the probe does not show what an interactive
   session does after that dialog (ADR-0012, R1).
2. Add and install Superpowers:

   ```bash
   claude plugin marketplace add obra/superpowers-marketplace
   claude plugin install superpowers@superpowers-marketplace
   ```
3. Last, turn on auto-update for superpowers. In `~/.claude/settings.json`, add
   `"autoUpdate": true` beside `source` in the entry `superpowers-marketplace` of
   `extraKnownMarketplaces`. Do this step last, and again after a later run of an add command: in
   Claude Code 2.1.296 that command writes the entry again with `source` only. The entry `celetis`
   uses `"autoUpdate": false` in the project file. See [Updates](#updates) before changing an
   installed Celetis package. The Superpowers setting stays independent.

### Each machine: Codex only

Use a signed-in Codex CLI and Git credentials that can read this private repository without a
prompt. Claude is not required. Add the Git source, then install the plugin:

```bash
codex plugin marketplace add ddinkov10/celetis --ref main
codex plugin add celetis@celetis --json
```

Terminal discovery finds the enabled installation through `skills/list`; it does not calculate a cache
path. A local-path marketplace is unsuitable for the runner: `plugin marketplace upgrade celetis`
requires a Git source. `--ref main` selects the landed source. For an unlanded check, use supported checkout loading with the existing host and authentication. These commands and result fields were checked
on Codex 0.162.1. See the [Codex CLI reference](https://learn.chatgpt.com/docs/cli/reference).

Install Superpowers from its Git marketplace:

```bash
codex plugin marketplace add obra/superpowers-marketplace
codex plugin add superpowers@superpowers-marketplace --json
```

This installed Superpowers 7.0.0 on Codex 0.162.1. The Superpowers README also gives a catalog
route: search for Superpowers in Codex's `/plugins` screen or the desktop Plugins page. Start a
new chat and check that both plugins' skills are available. A missing required skill stops its lane.

Codex saves user plugin choices in its configuration. A trusted product project can explicitly
enable celetis in `.codex/config.toml`:

```toml
[plugins."celetis@celetis"]
enabled = true

[plugins."superpowers@superpowers-marketplace"]
enabled = true
```

The [plugin configuration documentation](https://developers.openai.com/plugins/build/plugins)
describes project trust and enablement. Install each host's plugins separately. A Claude install
does not provide the Codex installation.

The two parts above stay by hand on each machine. The next parts are the files and labels of one
product project. `/celetis:setup` writes them in its main checkout (ADR-0017), and each section
below shows the current form that it writes. Where a part stays by hand, its section says so.

- The session asks for the issue tracker, the hosts (Claude, Codex, or both), and the landing. With
  `merge`, it also asks for the suite: a TypeScript file that `land` runs.
  Setup stops on each tracker other than GitHub. With two hosts, the session also asks for the
  default host. For the landing and the default host, the session proposes the value of
  `.celetis.yaml` when the file has one.
- After the landing, when `.celetis.yaml` has no `worktreeSetup`, the session proposes the
  worktree setup: one script from the manifests, the lockfiles, the version pins, and the CI
  workflows of the project. It shows the script, each ignored file that the script copies, each
  credential path that it does not copy, each tool that each machine needs, and the checks that
  the test runs. A `worktreeSetup` that is there, also an empty one, stays as it is, and setup
  tests it.
- Before any write, `/usr/bin/env BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 '<bun>' '--no-env-file' '--no-install' '--config=/dev/null' '--no-macros' '<plugin>/bin/celetis.ts' '--agent' '<host>' 'setup' try` runs the script in a test lane,
  `.claude/worktrees/setup-try`: a detached worktree at the local trunk plus a commit of the
  wiring, which is the tree of a new lane after the push. There, the session runs the checks of
  the project, and it checks the import of the package of the project, a clean `git status`, and
  the hooks. Then it removes the test lane. A dirty path becomes a proposed `.gitignore` line. A
  failure of the base becomes a proposed section `## Baseline of the checks` for `AGENTS.md`,
  when `AGENTS.md` states no baseline rule. A proposed script that fails its test goes back to
  the proposal, not to the write. Setup installs no tool and changes no hook: the report names
  each missing tool and each hook that skips its checks in the test lane (ADR-0018).
- Setup writes the part of a host only when you choose that host: `.claude/settings.json` and the
  line `@AGENTS.md` for Claude, and `.codex/rules/celetis.rules` for Codex.
- New setup owns `.codex/rules/celetis.rules`. It writes no launcher or machine path allow.
  Setup preserves an existing `scripts/celetis` file and its ownership record. When that file or
  its ownership entry is present, setup also preserves an existing Codex rules file. An owned
  `enabledPlugins.celetis@celetis` entry in `.claude/settings.json` and its ownership record stay
  intact. The owner of the active project reviews existing files, related permissions,
  attributes, instructions, and ownership entries against the current wiring below and approves
  each change or removal. Setup performs no migration. In a file that the product also uses,
  setup adds each missing entry, and it changes or removes no entry that is there.
- In `.celetis.yaml`, setup owns three entries: `host` (the default host, or the one host),
  `landing`, and `suite` (with `merge` only). It makes the file when there is none. In a valid file,
  it adds a missing `host` as a
  line at the end, and it keeps each byte of the product. When an entry is there with a value
  other than your answer, setup keeps that value and prints a warning. Change that field by hand
  when your answer is the intended value.
- Setup records each file and each entry that it owns in `.claude/celetis-flow/wiring.json`, so
  that a later run can tell them from the entries of the product.
- The write adds only the parts that you approved: the script as `worktreeSetup`, the ignore
  lines, and the baseline section. These three parts are product parts: setup writes each one
  only when it is missing, and the record does not list it.
- Setup shows the diff, and it commits and pushes the wiring only after your yes ("The wiring on
  the trunk"). It makes the labels at the write, before that question, so a no keeps them.
- After the push step, setup lists each lane worktree that exists and offers to run the script
  there with `/usr/bin/env BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 '<bun>' '--no-env-file' '--no-install' '--config=/dev/null' '--no-macros' '<plugin>/bin/celetis.ts' '--agent' '<host>' 'setup' lane <path>`. It does this also after a no or a failed push,
  and when no file changed. A lane branch with an older `.gitignore` can then show the new
  environment as untracked, and the resolver stops its issue: after the wiring is on the trunk, a
  merge of the trunk into that branch brings the ignore lines.

### Claude permissions: `.claude/settings.json`

The file holds the marketplace, the Superpowers plugin, and the permission rules:

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

Shared rules retain direct merge restrictions. Put the tested `land` allow in personal host
settings after native discovery. An `issue` allow is optional, and it has a risk. The
[personal binding procedure](#personal-landing-permission) owns the exact commands, the risk of
the `issue` allow, and their lifetime across an update.

### Codex permissions: `.codex/rules/celetis.rules`

Setup saves these rules in the trusted project's `.codex/rules/` directory:

```starlark
prefix_rule(
    pattern = ["gh", "pr", "merge"],
    decision = "forbidden",
    justification = "Use the bound plugin entrypoint with --agent codex land from the main checkout.",
)
```

This shared rule forbids direct merge. The personal rule of `land`, and the optional rule of
`issue`, bind the selected package and their sub-command.
Codex matches literal prefixes. A machine path is not a portable shared default. A policy-file
check does not prove that an active session loaded the rule. Keep the host sandbox and approval
settings. Follow the tested binding below.

### Installed entrypoint

Skills bind `<plugin>` from their loaded path and select their actual host. Bind `<bun>` to the
canonical absolute path of the selected Bun as `docs/hosts/entry.md` says. Their command is:

```sh
/usr/bin/env BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 '<bun>' '--no-env-file' '--no-install' '--config=/dev/null' '--no-macros' '<plugin>/bin/celetis.ts' '--agent' '<host>' '<command>'
```

Replace the placeholders with the bound absolute package path and actual host. Quote each complete
path argument. Maintainer terminals use native discovery below. The entrypoint imports only its
own engine. Runtime modules keep their basenames; maintenance commands stay under `scripts/`.
No installation build is needed. Missing Bun keeps the native failure; an executing older Bun
refuses the command. Generic command errors and argument boundaries stay unchanged.

### Terminal discovery

Start in the product directory. Use Bun 1.4.4 or later and the selected existing native host.
Run one discovery block. Keep the resulting absolute path in `celetis_entry`. If discovery
fails, use the stated native setup action. Do not select another host or search cache folders.
These blocks validate the package identity and one enabled canonical root. They never execute
metadata as shell text. Other Claude project registrations are outside the selected product;
an applicable project registration and a user registration with different roots are ambiguous.

```sh
# bootstrap-claude
celetis_entry=$(
BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 bun --no-env-file --no-install --config=/dev/null --no-macros - <<'CELETIS_CLAUDE'
import { execFileSync } from 'node:child_process';
import { lstatSync, readFileSync, realpathSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';
if (Bun.semver.order(Bun.version, '1.4.4') < 0) throw Error('Need Bun >=1.4.4');
const cwd = realpathSync(process.cwd());
let project = cwd;
const git = (args, at = cwd) => execFileSync('git', args, { cwd: at, encoding: 'utf8', timeout: 10000, stdio: ['ignore', 'pipe', 'pipe'] }).replace(/\n$/, '');
let top;
try {
  top = git(['rev-parse', '--show-toplevel']);
} catch (error) {
  if (error.status !== 128 || !String(error.stderr).startsWith('fatal: not a git repository')) throw error;
}
if (top !== undefined) {
  project = realpathSync(top);
  const common = realpathSync(git(['rev-parse', '--path-format=absolute', '--git-common-dir']));
  if (realpathSync(git(['rev-parse', '--absolute-git-dir'])) !== common) {
    const first = git(['worktree', 'list', '--porcelain', '-z']).split('\0\0')[0].split('\0');
    if (!first[0].startsWith('worktree ') || first.includes('bare')) throw Error('Cannot identify the main checkout from Git metadata');
    project = realpathSync(git(['rev-parse', '--show-toplevel'], first[0].slice(9)));
    if (realpathSync(git(['rev-parse', '--absolute-git-dir'], project)) !== common) throw Error('Cannot identify the main checkout from Git metadata');
  }
}
const records = JSON.parse(execFileSync('claude', ['plugin', 'list', '--json'], { encoding: 'utf8', timeout: 10000 }));
if (!Array.isArray(records)) throw Error('Invalid Claude plugin list; inspect claude plugin list --json');
const roots = new Set();
for (const item of records) {
  if (!item || item.id !== 'celetis@celetis') continue;
  if (item.scope !== 'user') {
    if (!['project', 'local'].includes(item.scope) || typeof item.projectPath !== 'string' || !isAbsolute(item.projectPath)) throw Error('Invalid Claude scope; repair its native registration');
    let applicable;
    try { applicable = realpathSync(item.projectPath); } catch { continue; }
    if (applicable !== project) continue;
  }
  if (item.enabled === false) continue;
  if (item.enabled !== true || typeof item.installPath !== 'string' || !isAbsolute(item.installPath) || /[\x00-\x1f\x7f]/.test(item.installPath)) throw Error('Invalid Claude enabled identity; repair its native registration');
  roots.add(realpathSync(item.installPath));
}
if (roots.size !== 1) throw Error('Need one enabled Celetis root for this product; inspect claude plugin list --json');
const root = [...roots][0];
const manifest = join(root, '.claude-plugin/plugin.json');
if (!lstatSync(manifest).isFile() || JSON.parse(readFileSync(manifest, 'utf8')).name !== 'celetis') throw Error('Wrong Celetis package identity; repair the native installation');
const entry = join(root, 'bin/celetis.ts');
if (!lstatSync(entry, { throwIfNoEntry: false })?.isFile() || !lstatSync(join(root, 'engine'), { throwIfNoEntry: false })?.isDirectory()) throw Error('Incomplete source-entrypoint layout; use the reviewed source repair procedure');
console.log(entry);
CELETIS_CLAUDE
)
```

```sh
# bootstrap-codex
celetis_entry=$(
BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 bun --no-env-file --no-install --config=/dev/null --no-macros - <<'CELETIS_CODEX'
import { execFileSync, spawn } from 'node:child_process';
import { lstatSync, readFileSync, realpathSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';
import { createInterface } from 'node:readline';
if (Bun.semver.order(Bun.version, '1.4.4') < 0) throw Error('Need Bun >=1.4.4');
const cwd = realpathSync(process.cwd());
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const native = JSON.parse(execFileSync('codex', ['plugin', 'list', '--marketplace', 'celetis', '--json'], { encoding: 'utf8', timeout: 10000 }));
if (!object(native) || !Array.isArray(native.installed)) throw Error('Invalid Codex plugin list');
const packages = native.installed.filter(item => object(item) && item.pluginId === 'celetis@celetis');
if (packages.length !== 1 || packages[0].enabled !== true || packages[0].installed !== true || packages[0].name !== 'celetis' || packages[0].marketplaceName !== 'celetis') throw Error('Need one enabled celetis@celetis installation; inspect codex plugin list --json');
const child = spawn('codex', ['app-server', '--stdio'], { cwd, stdio: ['pipe', 'pipe', 'pipe'] });
const exited = new Promise(resolve => { child.once('exit', resolve); child.once('error', resolve); });
const lines = createInterface({ input: child.stdout, crlfDelay: Infinity });
const iterator = lines[Symbol.asyncIterator]();
let diagnostics = '';
child.stderr.setEncoding('utf8').on('data', text => diagnostics += text);
child.stdin.on('error', () => {});
let rejectSignal;
const interrupted = new Promise((_, reject) => rejectSignal = reject);
const handlers = new Map();
for (const signal of ['SIGHUP', 'SIGINT', 'SIGTERM']) {
  const handler = () => rejectSignal(Error(`Interrupted by ${signal}`));
  handlers.set(signal, handler);
  process.on(signal, handler);
}
const send = value => child.stdin.write(JSON.stringify(value) + '\n');
async function reply(id) {
  let timer;
  const timeout = new Promise((_, reject) => timer = setTimeout(() => reject(Error('Codex discovery timed out after 10 seconds')), 10000));
  try {
    while (true) {
      const row = await Promise.race([iterator.next(), timeout, interrupted]);
      if (row.done) throw Error('Codex app-server closed its output');
      const value = JSON.parse(row.value);
      if (!object(value)) throw Error('Invalid Codex response');
      if (Object.hasOwn(value, 'id')) {
        if (value.id !== id) continue;
        if (value.error != null) throw Error(JSON.stringify(value.error));
        if (!object(value.result)) throw Error('Invalid Codex result');
        return value.result;
      }
      if (typeof value.method !== 'string') throw Error('Invalid Codex notification');
    }
  } finally { clearTimeout(timer); }
}
try {
  send({ id: 1, method: 'initialize', params: { clientInfo: { name: 'celetis-terminal', version: '0.0.0' }, capabilities: { experimentalApi: true } } });
  await reply(1);
  send({ method: 'initialized' });
  send({ id: 2, method: 'skills/list', params: { cwds: [cwd], forceReload: true } });
  const result = await reply(2);
  const catalogs = Array.isArray(result.data) ? result.data.filter(item => object(item) && item.cwd === cwd) : [];
  if (catalogs.length !== 1 || !Array.isArray(catalogs[0].errors) || catalogs[0].errors.length || !Array.isArray(catalogs[0].skills)) throw Error('Invalid checkout skill catalog; repair native skill discovery');
  const roots = new Set();
  for (const skill of catalogs[0].skills) {
    if (!object(skill) || skill.pluginId !== 'celetis@celetis' || skill.enabled === false) continue;
    if (skill.enabled !== true || typeof skill.path !== 'string' || !isAbsolute(skill.path) || /[\x00-\x1f\x7f]/.test(skill.path) || !/\/skills\/[a-z][a-z0-9-]*\/SKILL\.md$/.test(skill.path)) throw Error('Invalid Celetis skill identity');
    roots.add(realpathSync(skill.path.replace(/\/skills\/[^/]+\/SKILL\.md$/, '')));
  }
  if (roots.size !== 1) throw Error('Need one enabled Celetis root; repair native skill discovery');
  const root = [...roots][0];
  const manifest = join(root, '.claude-plugin/plugin.json');
  if (!lstatSync(manifest).isFile() || JSON.parse(readFileSync(manifest, 'utf8')).name !== 'celetis') throw Error('Wrong Celetis package identity');
  const entry = join(root, 'bin/celetis.ts');
if (!lstatSync(entry, { throwIfNoEntry: false })?.isFile() || !lstatSync(join(root, 'engine'), { throwIfNoEntry: false })?.isDirectory()) throw Error('Incomplete source-entrypoint layout; use the reviewed source repair procedure');
console.log(entry);
} catch (error) {
  throw Error(`${error.message}\n${diagnostics.trimEnd()}`);
} finally {
  lines.close();
  child.stdin.destroy();
  child.kill('SIGTERM');
  let timer;
  await Promise.race([exited, new Promise(resolve => timer = setTimeout(resolve, 500))]);
  clearTimeout(timer);
  if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
  await exited;
  child.stdout.destroy();
  child.stderr.destroy();
  for (const [signal, handler] of handlers) process.off(signal, handler);
}
CELETIS_CODEX
)
```

Verify that the returned path is the regular entrypoint of the enabled
package. Run the second stage from the same product directory. Use the actual selected host.

```sh
BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 bun --no-env-file --no-install --config=/dev/null --no-macros "$celetis_entry" --agent codex root
```

For Claude Code, replace `codex` with `claude`. Resolve the package again after an update.
The variable is one complete path argument. Do not use `eval` or expand it without quotes.

### Personal landing permission

Select an absolute Bun executable and the canonical validated package entrypoint. Bind the
actual host and one sub-command: `land`, or `issue` for the workflow writes. Make one rule for
each sub-command that needs a rule. Retain shared direct-merge restrictions. A broad Bun allow is
unsuitable.

The rule of `issue` is optional. The path for `issue` is the review of the host: in the checks of
#103, Claude in auto mode ran it with no rule, and a Codex sandbox block of `issue` goes through
the approval procedure of `docs/hosts/codex.md`. The risk of the rule: an allow rule skips the
review of the host for each `issue` call, and each act with a file posts the text of a path that
the session names, so a session can post any file that it can read (for example a token file) on
the issue. Text from an issue can steer a session. Add the rule only when the host cannot run
`issue` through its review, for example Codex with the approval policy `never`.

For Claude Code, use the untracked product `.claude/settings.local.json`. The generator below
constructs a `Bash(...)` rule from the complete shell prefix, including the unquoted
`/usr/bin/env`, both environment assignments, the selected Bun, all four isolation options, the
quoted package entrypoint, `--agent claude`, the sub-command, and a final ` *`. Claude does not
strip `env` before it matches a rule. Native permission text escapes literal wildcards
separately from shell quoting. The renderer also preserves literal backslashes before
a wildcard; shell quoting alone does not bind these paths.

Historical driver checks for #99 recorded native refusals of another script, another subcommand,
inserted Bun options, a different host, direct merge, shell injection, a compound command, and a
new package path. Claude Code 2.1.310 also matched a quoted `'/usr/bin/env'` to this rule, and the
command ran the same landing. The earlier driver accepted a refusal of that form, or an allow
that ran the same landing. The driver is no longer supplied by this package.

To produce a concrete personal rule, first run native discovery above. Replace the five
arguments below with the selected host, an example issue, an example subject of `land` or act of
`issue`, the validated `celetis_entry`, and the sub-command. The selected Bun is the executable
that runs this generator. This prints data for review; it changes no settings. The printed
command is the literal tool text for that issue and subject or act. The rule ends at the
sub-command, so one rule serves each issue and subject of `land`, or each issue and act of `issue`.

```sh
BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 bun --no-env-file --no-install --config=/dev/null --no-macros - claude 99 'reviewed subject' "$celetis_entry" land <<'CELETIS_RULE'
import { realpathSync } from 'node:fs';
const [host, issue, argument, entry, subcommand] = process.argv.slice(2);
if (!['claude', 'codex'].includes(host) || !/^[1-9][0-9]*$/.test(issue) || !argument || !entry?.startsWith('/') || !['land', 'issue'].includes(subcommand)) throw Error('Need host, issue, subject or act, absolute validated entrypoint, and land or issue');
const quote = value => "'" + value.replaceAll("'", "'\\''") + "'";
const env = ['/usr/bin/env', 'BUN_RUNTIME_TRANSPILER_CACHE_PATH=0', 'DO_NOT_TRACK=1'];
const words = [realpathSync(process.execPath), '--no-env-file', '--no-install', '--config=/dev/null', '--no-macros', realpathSync(entry), '--agent', host, subcommand];
const prefix = [...env, ...words.map(quote)].join(' ');
const command = prefix + ' ' + quote(issue) + ' ' + quote(argument);
const literal = value => value.replaceAll('\\', '\\\\').replace(/(\\*)\*/g, (_match, slashes) => '\\'.repeat(slashes.length * 2 + 1) + '*');
const rule = host === 'claude' ? 'Bash(' + literal(prefix) + ' *)' : 'prefix_rule(pattern=' + JSON.stringify([...env, ...words]) + ', decision="allow")';
console.log(JSON.stringify({ command, rule }, null, 2));
CELETIS_RULE
```

For the optional rule of `issue`, give an act such as `state` in place of the subject, and `issue`
as the last argument.

For Claude, add the printed rule to `permissions.allow` in the untracked local settings.
Preserve its other fields. For Codex, put each printed rule in a personal
`rules/celetis-<sub-command>.rules` under the existing user configuration. Preserve other rules.

Before using an allow, verify that it permits the bound command of its sub-command for the
selected host and package. Verify that it refuses another script, another subcommand, inserted
Bun options, a different host or package path, direct merge, shell injection, and a compound
command.

Codex compares argument lists. It splits a shell script into commands only when each word is
plain or quoted ([Codex rules](https://learn.chatgpt.com/docs/agent-configuration/rules)). A
leading assignment, a quoted first word, or a substitution outside single quotes keeps the
whole script in one shell argument, and the rule does not match it. The unquoted first word
`/usr/bin/env` makes both assignments plain arguments. So Codex splits the command, and the
printed `prefix_rule` matches its argument list up to the sub-command. One Codex rule serves each
call of that sub-command, package path, and host. It survives Codex updates because the Codex
package path does not change. A changed Bun path or host needs a new rule. A single quote in the
Bun path, the package path, the subject, or the file of an act becomes `'\''` and stops the
split, so that call needs approval. Codex runs a command that an `allow` rule matches outside the
sandbox. The `workspace-write` sandbox has no network access by default: there `gh` cannot reach
GitHub, and `issue` exits 6 before any write, unless its rule matches or an approval lets it run
outside the sandbox. Historical driver checks for #99 used `codex execpolicy check` on the
printed rule. A live turn with a temporary `forbidden` copy proved the split, and that a quoted
first word or a substitution did not match. These historical observations require no driver run.

A Claude rule needs a new binding after each update, because the Claude package path contains
the version. After the person confirms one Claude package update, run native discovery again.
For each sub-command that has a personal allow, remove the old allow and add the new validated
path. Check that the old rule refuses the new path, then that the replacement rule refuses the
old path and permits the new command. Start a fresh host session. These steps do not approve an
update and do not stop open work.
Remove only the exact old personal rule. Preserve other rules and settings. Historical driver
checks used temporary bindings for old and new paths. An installed-package update remains a
separate human act.

### Explicit source repair

Use a clean maintainer-reviewed checkout of the configured Git source outside the product and
its lanes. Confirm its remote URL, clean status, and full reviewed revision before running code.
Select its absolute `bin/celetis.ts` as `celetis_repair_entry`. From the affected product, run:

```sh
BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 bun --no-env-file --no-install --config=/dev/null --no-macros "$celetis_repair_entry" --agent codex plugin-update
```

Use `claude` for that host. The person answers the interactive terminal prompt for one exact
attempt. The checkout supplies the updater code. Native metadata still supplies the enabled
installation and offered source/revisions. Pre-update identity does not need an executable old
runtime. Fresh post-update validation requires `bin/celetis.ts` and `engine/`. Do not run the broken installed updater or infer an
approved target from the checkout revision. A refusal or failure needs a new terminal command
and response. Resolve the installed root again after success, check its approved revision and
layout, rebind the personal permission, and return ordinary commands to that package.

A `null` offer or `up to date` result does not repair same-revision corruption. Missing native
registration or an integrity refusal requires separately reviewed native-host repair. There is
no force flag or automatic fallback. Keep a temporary repair checkout until its owned command
exits. Open sessions can stay open, but replaced cache resources might require a restart.

### Agent selection and model setup

`host` in `.celetis.yaml` selects the host of the human terminal and board commands. Setup writes
it with the default host that you choose, or with the one host. Setup does not change a `host`
that is there: to change the default host, edit `host` by hand. Check the installed package with
an explicit host:

```bash
/usr/bin/env BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 '<bun>' '--no-env-file' '--no-install' '--config=/dev/null' '--no-macros' '<plugin>/bin/celetis.ts' '--agent' 'codex' 'root'
```

Selection is `--agent claude|codex`, then `CELETIS_AGENT`, then `host` in the main checkout's
`.celetis.yaml`, then `claude`. An invalid value stops the command. Skills always pass their
actual host explicitly on each call, including landing. The selected host is exported to child scripts. Both installed
hosts can use one product project; their installations and configuration remain separate.

`root` validates the enabled plugin and returns the installed package directory. Codex discovery
uses a short-lived app-server connection and `skills/list`, with no thread or model turn.
Missing, disabled, malformed, or ambiguous installation data stops lookup. Do not use a
marketplace source checkout in place of the returned installation.

With no profile, each Codex child keeps the parent's model and gets the effort of its rank. This
needs no setup. For model tiers, supply the four-slot profile and reviewer minimum in
`docs/capability.md`, "Codex model profiles". Obtain the model IDs and efforts from the active
dispatch surface. Store its profile under `codexProfiles` in the main config and pass the current
runtime allowlist to each scorer call. A CLI catalog does not establish desktop dispatch support.
A missing pair or a tool that cannot apply the required pair stops the dependent work.

For herdr, run `herdr integration status` in the same host configuration used by the runner.
Use `herdr integration install codex` for the Codex integration; it honors `CODEX_HOME`.
Inspect the installed hook and complete the host's normal trust flow. A current integration alone does not prove that
a model session can start. The runner reports startup dialogs and leaves them for the human.

### The config, the worktree setup, and the custom parts

Operational settings and setup are fields of `.celetis.yaml` (`docs/configuration.md`).
Commands that need repository setup require this file and stop if it is missing or invalid.
`/celetis:setup` makes the file with `host`, `landing`, and, with `merge`, `suite` when there is
none. It adds a missing
`host` at the end of a valid file, or it stops when the file cannot take the line. After your yes,
it adds a missing `worktreeSetup` as a literal block at the end of the file; a new file holds
`host`, `landing`, `suite`, and then the block. The block must read back as the script, byte for byte, and
each other value must stay the same. Else setup stops before any write, for example on a script
with CRLF line endings or on a file with a `...` end marker: add the field by hand first. Setup
changes no field that is there. Each other field stays by hand.

| Field or file | What it holds | When omitted |
|---|---|---|
| `landing` | Required `pr` or `merge`. `pr` squash-merges a PR when each check is green. `merge` creates one squash commit on the trunk, with no PR. A project with no PR check uses `merge` | The command exits 2 |
| `suite` | A relative path of a TypeScript file in the checkout. `land` runs it in the lane, with no argument, at the tip that it lands; exit status 0 is a pass. Required with `merge`, refused with `pr` | With `merge`, the command exits 2 |
| `gates` | A mapping from the seven step names to `me` or `auto` | Each omitted step is `me` |
| `worktreeSetup` | One TypeScript program for a lane, for example dependency installation and copying ignored files | No setup |
| `board.port` | The board port ("The agent board") | 4403 |
| `codexProfiles.<runtime>` | Four ordered model slots and the reviewer minimum for that dispatch surface | Each Codex child keeps the parent's model |
| `custom.<skill>` | An addition to the skill procedure | No addition |

- **Operational settings** come from the main checkout, including when a command starts in a
  lane or subfolder. `/usr/bin/env BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 '<bun>' '--no-env-file' '--no-install' '--config=/dev/null' '--no-macros' '<plugin>/bin/celetis.ts' '--agent' '<host>' 'land'` moves the trunk of the main checkout; after a merge by
  other means, or after its line `land: the main checkout did not move`, run `git pull` there.
- **The gate of a step** comes from `gates.<step>`. An `auto` step starts by itself. A `me` step
  starts when you supply a number or press Run on the board. Old Git defaults have no effect.
- **With the landing `pr`,** keep the repository setting `squash_merge_commit_title` at
  `COMMIT_OR_PR_TITLE`: for a PR with one commit, GitHub then takes the subject of that commit and
  adds the PR number (`docs/issue-tracker.md`, "Branches, PRs, merge").
  `gh api 'repos/{owner}/{repo}' --jq .squash_merge_commit_title` prints the value.
- **The worktree setup.** `/usr/bin/env BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 '<bun>' '--no-env-file' '--no-install' '--config=/dev/null' '--no-macros' '<plugin>/bin/celetis.ts' '--agent' '<host>' 'worktree' '<n>'` reads `worktreeSetup` from the lane's
  `.celetis.yaml`. It writes the complete TypeScript string to a private 0600 temporary file outside the main
  checkout and lane, then runs it on the selected Bun in that lane. `process.argv[2]` is the
  absolute main checkout. Streams stay inherited. After nonempty setup output, stdout has an LF
  separator and the final absolute lane path. Check each external command status in the program.
  A failed setup removes a new worktree and a branch created by the command. An existing branch
  or worktree stays for repair and retry. The command writes the marker only after a script that
  is not empty succeeded, and that script then runs only once. With an empty or missing
  `worktreeSetup`, the command writes no marker. Each later entry reads the lane config again, so
  a script that a merge of the trunk brings runs at the next entry. A lane that has a marker keeps
  it; `/usr/bin/env BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 '<bun>' '--no-env-file' '--no-install' '--config=/dev/null' '--no-macros' '<plugin>/bin/celetis.ts' '--agent' '<host>' 'setup' lane <path>` runs the script there. Every entry still checks the lane
  config (`docs/celetis-flow.md`).
- **A custom part** is the parsed string `custom.<skill>` in `.celetis.yaml`. At entry, the
  skill reads the whole config once from the active checkout through supported host file access and
  applies only its own string (ADR-0013 and ADR-0015). Claude uses its native entry hook; Codex can
  use shell commands, dedicated readers, or runtime file APIs and the existing config reader.
  Entry runs no setup. A runner step starts in the main checkout; a later skill entered in a lane reads that lane's config.
  A same-session handoff or first borrowed reference creates its own entry. Later sections
  reuse that entry. Missing checkout, config, or custom text gives no addition; an invalid,
  ambiguous, unreadable, or denied config stops entry. A denied read has no alternate path.
  The text is an addition: it cannot remove a rule of the general skill (ADR-0006).
  `custom.hotfix` holds the project's ship acts, and `custom.lesson` holds its tags. Keep
  literal block text and parsed trailing newlines intact (`docs/configuration.md`).

`docs/celetis-flow.md` holds these parts in full ("Gates", and "The config and the custom parts").

### `.gitignore`

```
.claude/worktrees/
.claude/settings.local.json
docs/superpowers/
.superpowers/
docs/lessons/_pending/
```

With no entry for `.claude/worktrees/`, a lane worktree makes the main checkout dirty, and the
resolver prints the dirty-tree line for each issue (`docs/issue-tracker.md`).
`.claude/settings.local.json` holds the settings of one person for the project. The three other
folders are scratch of the skills, and a file that git does not ignore makes a tree dirty too:

- `docs/superpowers/` holds the drafts of the intents, the specs, and the plans;
- `.superpowers/` holds the review package of `critic-loop`;
- `docs/lessons/_pending/` holds the lesson drafts that wait for `lesson-review`.

### The labels

The flow uses the ten labels of `docs/issue-tracker.md`, "Labels". Setup makes each label that the
repository does not have, with this description:

| Label | Description |
|---|---|
| `needs-triage` | not yet classified |
| `bug` | Something isn't working |
| `enhancement` | New feature or request |
| `hotfix` | production broken, the fix ships now |
| `chore` | zero-behavior-change edit |
| `epic` | parent of several feature sub-issues |
| `needs-info` | the report lacks what its lane needs; the questions are in a comment |
| `ready-for-agent` | plan posted; `/celetis:implement #<n>` can start |
| `ready-for-human` | a step only a human runs |
| `wontfix` | This will not be worked on |

GitHub gives a new repository three of them (`bug`, `enhancement`, and `wontfix`), and their
descriptions are the ones of GitHub. A label that is there keeps its color and its description.
Setup ignores the case of a name: when the repository has `Bug`, setup makes no `bug`, and it
prints a warning.

### `AGENTS.md`

The plugin names a role, and the `AGENTS.md` of the project names the thing. It names:

| What `AGENTS.md` names | Who reads it |
|---|---|
| **The verify gate:** the one fast deterministic check of a change (lint, format, syntax, and config checks, with no test run), and how to read its result | `plan`, `implement`, `chore`, `hotfix`, and `guide` say "the verify gate of the project", and `/usr/bin/env BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 '<bun>' '--no-env-file' '--no-install' '--config=/dev/null' '--no-macros' '<plugin>/bin/celetis.ts' '--agent' '<host>' 'land'` names it in a refusal |
| **The full suite** is no line of `AGENTS.md`: with the landing `merge`, `suite` in `.celetis.yaml` names the file that runs each test, and `land` runs it at the tip that it lands. With the landing `pr`, the CI of the lane PR runs it | `land`, which `implement` (Land step 3), `chore`, and `hotfix` run |
| **The architecture and the traps:** the shape of the project in the root file, and the traps of each subsystem in the `AGENTS.md` of its folder. They are the domain knowledge: the plugin has no domain skill (ADR-0006) | `specify`, `bug`, `hotfix`, `plan`, `chore`, and `critic-loop` |
| **The design document and the look decision,** in a project with a UI: the document that holds the design rules, and how a session builds the options of a look decision and hands them over, with the dev server of the project | `specify` and `bug`; the two items "Prototype" of `docs/issue-tracker.md`, in "What lives on the issue" and in "Branches, PRs, merge" |
| **The installed version of a dependency:** how a session reads it, and the documents that an installed package ships | `docs/docs-lookup.md`, which `specify`, `plan`, `bug`, `hotfix`, and `chore` cite |
| **The celetis flow of the project:** what a session must know of the lanes there, for example that the lanes are the plugin `celetis`, the landing mechanism, and the acts that only the maintainer does. It also holds two rules of the harness, "A lane never skips a step." and "The maintainer starts the runner; an agent starts it only when its task says so, with a number, and in a terminal.", because a session reads `AGENTS.md` at its start and reads a document of the plugin only when a skill cites it | Each session, also a step session |

Setup writes the celetis flow part as the section `## Celetis flow`, with these four lines.
`<owner>/<repo>` is the repository on GitHub:

```markdown
## Celetis flow

- The lanes are the skills of the plugin `celetis`, on the issues of `<owner>/<repo>`.
- `landing` in `.celetis.yaml` names the landing mechanism, and a build step ends with `land` through the bound plugin entrypoint and personal host binding.
- A lane never skips a step.
- The maintainer starts the runner; an agent starts it only when its task says so, with a number, and in a terminal.
```

Setup adds each missing line at the end of the section. With no section, it adds the section at
the end of the file, and with no `AGENTS.md`, it makes the file. A line of the section counts when
its text after the list mark is the same, also with `*` or with no list mark, and setup then adds
no second copy. A bullet that wraps over two lines has no match, and setup adds the one-line form
beside it. A line in a fenced code block is no heading and no line of the section. The rest of
`AGENTS.md` stays by hand: the other rows of the table, and the acts of the celetis flow that only
the maintainer does.

The plugin has no role for the deployment of a project. It is a product fact, so it also goes into
`AGENTS.md` when more than one step needs it: a lane ends when the change is on the trunk.

Claude Code reads `AGENTS.md` at the start of a session only when the project and each folder above
it have no `CLAUDE.md`, `.claude/CLAUDE.md`, or `CLAUDE.local.md`. A project that keeps a
`CLAUDE.md` imports the file from it, with the line `@AGENTS.md` (the documents of Claude Code,
`https://code.claude.com/docs/en/memory`, read on 2026-10-13 for Claude Code 2.1.296). With Claude
as a chosen host, setup adds that line to `CLAUDE.md` and to `.claude/CLAUDE.md`, each one only
when it is there. It leaves a file that is a symbolic link alone, for example a `CLAUDE.md` that
links to `AGENTS.md`, and it warns when the link leads to another file. When `AGENTS.md` links to
one of the two files, setup writes the section into that file and adds no `@AGENTS.md` line.

### The stores

Setup makes each of the three files below when it is missing, and it changes no file that is
there. Its record does not list them: they are files of the product.

- `docs/adr/`, with a `README.md` and a `template.md`: the skill `record-architecture-decisions`
  reads the two files and writes each record as `NNNN-short-title.md`, and the lanes read the
  records. Setup copies `docs/adr/README.md` and `docs/adr/template.md` of the plugin.
- `docs/lessons/INDEX.md`: the catalog of the lessons, with one table row for each lesson. The
  lanes scan it, and the skill `lesson` adds a row to it. A new catalog has this head:

  ```markdown
  # Lessons

  | Lesson | Tags | Date | Summary |
  |---|---|---|---|
  ```

### Optional: the board in Claude desktop

Use a personal, untracked `.claude/launch.json` in the main checkout. For a new file, put that
path in `.git/info/exclude`. If the project already tracks the file, keep its shared content and
use the terminal start. Add the example entry to the local file's `configurations` array.

Bind `<bun>` to the selected absolute Bun path and `<plugin>` through native discovery. Replace
the placeholders as JSON data, with no shell quotes inside the values. Keep the resolved machine
paths local. The native preview port must match `board.port` in `.celetis.yaml`:

```json
{
  "name": "board",
  "runtimeExecutable": "<bun>",
  "runtimeArgs": [
    "--no-env-file",
    "--no-install",
    "--config=/dev/null",
    "--no-macros",
    "<plugin>/bin/celetis.ts",
    "--agent",
    "claude",
    "board"
  ],
  "env": { "BUN_RUNTIME_TRANSPILER_CACHE_PATH": "0", "DO_NOT_TRACK": "1" },
  "port": 4403
}
```

The [desktop field contract](https://code.claude.com/docs/en/desktop#configuration-fields) keeps
the executable, argument array, and environment values separate. The historical marker-only
contract check covered those data boundaries; native desktop launch remains UNRUN
(`docs/celetis-flow.md`, "Limits"). The terminal start has separate acceptance evidence.

### The wiring on the trunk

The wiring must be on the trunk of `origin` before the first lane. A lane branch starts at the trunk
of `origin`, so a file that is not there is in no lane worktree: `.celetis.yaml`,
including a custom part and the worktree setup. A file that git does not track also makes the main
checkout dirty, and the resolver then stops each issue.

Setup stops before any write when the index holds a staged change, or when a path that setup can
write for either host has an uncommitted change. This includes each store file, also one that
setup makes only when it is missing. So the commit of setup holds only its own changes. At the end,
setup asks one question: commit and push to the trunk of `origin`?

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

## The full loop

One request goes from free text to a change on the trunk. The example is a feature, the lane that
has each step.

**In a session by hand.** Start the selected host in the main checkout of the product project.
In a terminal, start Codex with `codex --no-daemon` so its hooks use the current pane's environment.
The table uses Claude's `/celetis:<skill> <input>` form. In Codex CLI or a desktop chat, use the
advertised skill name: `Use the celetis:<skill> skill for <input>. Complete its Host entry startup reads before any response, including commentary.`, or select that skill in the
host's skill selector. Native desktop selector acceptance is optional under
[Acceptance status](docs/celetis-flow.md#acceptance-status).

| You type | The session | It leaves on the issue |
|---|---|---|
| `/celetis:intake <the request>` | writes the intent in your words, and asks "proceed?" | a new issue `#<n>` with the intent and the label `needs-triage` |
| `/celetis:triage #<n>` | picks the lane, and asks whether to go on | the lane label, here `enhancement` |
| `/celetis:feature #<n>` | makes the lane worktree and runs `specify`: the design, in a conversation with you | the spec that you approved, as the body of the issue |
| `/celetis:plan #<n>`, in a new session | writes the plan: your steps (the human acts of the lane), tasks with a capability score, and a Verify phase | a `## Plan` comment and the label `ready-for-agent` |
| `/celetis:implement #<n>`, in a new session | builds each task (an implementer, the verify gate of the project, a review), runs the Verify phase, and lands the change with `/usr/bin/env BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 '<bun>' '--no-env-file' '--no-install' '--config=/dev/null' '--no-macros' '<plugin>/bin/celetis.ts' '--agent' '<host>' 'land'` | the change on the trunk, and a closed issue |

- On a yes, `intake` hands on to `triage`, and `triage` hands on to the lane, so the first three
  rows can be one session. `plan` and `implement` each start in a fresh context, and each one reads
  the issue again.
- When you know the type, start the lane directly, with a number or with free text:
  `/celetis:bug the export stops on a report with no rows`.
- A lane and each step after it work in the lane worktree of the issue,
  `.claude/worktrees/<n>-<slug>`, on the branch of the issue. `intake` and `triage` enter no
  worktree. Claude binds the returned path with its worktree tools. Codex binds every command,
  read, edit, and child brief to that exact path and reads its `AGENTS.md` files. A shell `cd`
  alone does not bind later file tools. An app-created detached checkout does not replace the
  lane checkout. Both hosts return to the main checkout for landing.
- The landing puts the change on the trunk by the `landing` field of `.celetis.yaml`. With `pr`,
  `/usr/bin/env BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 '<bun>' '--no-env-file' '--no-install' '--config=/dev/null' '--no-macros' '<plugin>/bin/celetis.ts' '--agent' '<host>' 'land' '<n>' '<subject>'` pushes the branch, opens the PR, waits up to 15 minutes
  for the checks. Each invocation waits for workflow completion before it accepts green checks,
  including when a dependent job has no check row yet. It squash-merges at the checked commit only
  when every check passed or was skipped and at least one check passed. Before the merge, when each
  red check is a GitHub Actions check that failed or timed out, the failed jobs of their workflow
  runs get one re-run for each commit, with up to 15 more minutes of wait. It then moves the trunk
  of the main checkout to the merge, and removes the worktree and the branch. With `merge`, it runs
  the `suite` file of `.celetis.yaml` in the lane, at the tip that it lands, and only on a pass it
  puts that tip on the trunk as one squash commit, with no PR.
- The other lanes are shorter. `/celetis:bug` finds the root cause, posts it as a `## Root cause`
  comment, and hands on to `plan`. `/celetis:chore` makes a change with no change of behavior: it
  verifies, commits, and lands in one session. `/celetis:hotfix` fixes broken production in one
  session, and it ends with the ship acts of the project. When its landing stops, it prints your
  checklist: remove `ready-for-human` first, because `land` refuses while the label is on, then
  run `land` in your own shell, then do the ship acts. A request that spans some independent
  features becomes an epic, and each child issue runs its own flow.

**Through the runner.** `/usr/bin/env BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 '<bun>' '--no-env-file' '--no-install' '--config=/dev/null' '--no-macros' '<plugin>/bin/celetis.ts' '--agent' '<host>' 'celetis-flow' '<n>'` starts the next step of the issue in a
new interactive session, in the terminal tab where you start it. For each step, the runner:

1. asks the resolver for the next step: `/usr/bin/env BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 '<bun>' '--no-env-file' '--no-install' '--config=/dev/null' '--no-macros' '<plugin>/bin/celetis.ts' '--agent' '<host>' 'next-step' '<n>'` prints a `run` line with
   the command of the step, for example `run /celetis:plan #<n>`, or a `stop` line with the reason;
2. checks the resources of the installed package selected at startup ("Updates");
3. starts the selected interactive CLI in the main checkout with the host's skill prompt and
   step text. Claude uses `--permission-mode auto` and an appended system-prompt file. Codex
   uses `--no-daemon`, keeps its configured permissions, and appends the step text to effective `developer_instructions`;
4. in a herdr pane, ends the session when the issue shows that the step is done.

The runner starts at an issue: write one with `/celetis:intake`, or open one on GitHub. Then, for
the feature `#12`:

```bash
/usr/bin/env BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 '<bun>' '--no-env-file' '--no-install' '--config=/dev/null' '--no-macros' '<plugin>/bin/celetis.ts' '--agent' '<host>' 'celetis-flow' '12'    # triage
/usr/bin/env BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 '<bun>' '--no-env-file' '--no-install' '--config=/dev/null' '--no-macros' '<plugin>/bin/celetis.ts' '--agent' '<host>' 'celetis-flow' '12'    # specify: the session asks, and it waits for your approval of the design
/usr/bin/env BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 '<bun>' '--no-env-file' '--no-install' '--config=/dev/null' '--no-macros' '<plugin>/bin/celetis.ts' '--agent' '<host>' 'celetis-flow' '12'    # plan
/usr/bin/env BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 '<bun>' '--no-env-file' '--no-install' '--config=/dev/null' '--no-macros' '<plugin>/bin/celetis.ts' '--agent' '<host>' 'celetis-flow' '12'    # implement: it builds, verifies, and lands
```

With each gate `me`, one start runs one step. With a gate `auto`, a start goes on through that step
by itself, and `/usr/bin/env BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 '<bun>' '--no-env-file' '--no-install' '--config=/dev/null' '--no-macros' '<plugin>/bin/celetis.ts' '--agent' '<host>' 'celetis-flow'` with no number is the automatic runner: it runs each
`auto` step of each open issue. A Run press on the agent board is the same start, in a new herdr
tab.

A step session follows the step text: it asks only for a decision that the issue does not hold, and
at a stop it puts the reason on the issue and adds `ready-for-human`. The `specify` session has no
step text: it waits for your approval of the design, as a session by hand does.

`docs/celetis-flow.md` holds the runner in full. `docs/issue-tracker.md` holds the labels, what
lives on the issue, the branches, and the order of the resolver.

## The skills

The table uses `/celetis:<skill>` as the shared skill notation and the Claude invocation.
On Codex, explicitly name or select the advertised `celetis:<skill>` as described above.

| Group | Skill | What it does |
|---|---|---|
| **Lanes** | [`/celetis:intake`](skills/intake/SKILL.md) | Writes the intent of a raw request onto an issue. It classifies nothing |
| | [`/celetis:triage`](skills/triage/SKILL.md) | Picks the lane of an issue whose type is not known, and sets the lane label |
| | [`/celetis:feature`](skills/feature/SKILL.md) | The lane for new behavior: the scope check that can make an epic, the worktree, and then `specify` |
| | [`/celetis:bug`](skills/bug/SKILL.md) | The lane for existing behavior that is wrong: the root cause with `superpowers:systematic-debugging`, the `## Root cause` report, and then `plan` |
| | [`/celetis:hotfix`](skills/hotfix/SKILL.md) | The lane for broken production: the root cause, a plan of one task, `implement`, and the ship checklist |
| | [`/celetis:chore`](skills/chore/SKILL.md) | The lane for a change with no change of behavior: the change, the verify gate, the commit, and the landing |
| **Steps** | [`/celetis:specify`](skills/specify/SKILL.md) | The design step. It adds the project context to `superpowers:brainstorming`, and the spec that you approve becomes the body of the issue |
| | [`/celetis:plan`](skills/plan/SKILL.md) | The plan step. It adds a capability score for each task and a Verify phase to `superpowers:writing-plans`, and it posts the plan on the issue |
| | [`/celetis:implement`](skills/implement/SKILL.md) | The build step. It adds the verify gate before each review, the Verify phase, and the landing to `superpowers:subagent-driven-development` |
| **Review and memory** | [`/celetis:critic-loop`](skills/critic-loop/SKILL.md) | Scores the current diff from 0 to 10 across five perspectives, and fixes and scores again until the diff passes |
| | [`/celetis:polishing-code-comments`](skills/polishing-code-comments/SKILL.md) | A pass that removes and tightens the comments of a diff or a file |
| | [`/celetis:lesson`](skills/lesson/SKILL.md) | Writes a lesson from a correction or an incident to `docs/lessons/`, with a row in its catalog |
| | [`/celetis:lesson-review`](skills/lesson-review/SKILL.md) | Your review of the lesson drafts that an automatic capture put in a queue |
| | [`/celetis:record-architecture-decisions`](skills/record-architecture-decisions/SKILL.md) | Reads and writes the records of `docs/adr/` |
| | [`/celetis:doc-drift-sync`](skills/doc-drift-sync/SKILL.md) | Keeps the documents of the project true against the code: it fixes the drift that the source proves, and it flags the rest |
| **Helpers** | [`/celetis:prototype`](skills/prototype/SKILL.md) | Builds throwaway code that answers a design question: a logic demo in one HTML file, or UI variants on one route |
| | [`/celetis:writing-for-agents`](skills/writing-for-agents/SKILL.md) | The reference for a document that an agent reads: a skill, or an `AGENTS.md` |
| | [`/celetis:guide`](skills/guide/SKILL.md) | Says which command fits a goal. Only you can start it |
| | [`/celetis:setup`](skills/setup/SKILL.md) | Proposes and tests the worktree setup of a product project, writes the wiring in its main checkout, and commits and pushes the wiring after your yes. Only you can start it |

Two documents of the plugin are not skills: `docs/capability.md`, the rubric of the capability
score, and `docs/docs-lookup.md`, the lookup of the external facts.

`guide` and `setup` are explicit-only on both hosts. Claude reads `disable-model-invocation: true`;
Codex reads `policy.allow_implicit_invocation: false` in `skills/guide/agents/openai.yaml` and
`skills/setup/agents/openai.yaml`. Their shared entry also requires a human invocation. Guide
reads its custom part and gives advice; it starts no workflow command. Setup runs the bound entrypoint of
the plugin in the main checkout, and it enters no lane worktree.

## The commands

A product project runs each command through the bound installed entrypoint. The table gives the human terminal
and board form. Every skill call adds `--agent claude` or `--agent codex` before the sub-command:

| Command | What it does |
|---|---|
| `/usr/bin/env BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 '<bun>' '--no-env-file' '--no-install' '--config=/dev/null' '--no-macros' '<plugin>/bin/celetis.ts' '--agent' '<host>' 'worktree' '<n>'` | Makes the lane worktree and the branch of the issue, or enters the one that is there and brings it up to the trunk, and prints its path |
| `/usr/bin/env BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 '<bun>' '--no-env-file' '--no-install' '--config=/dev/null' '--no-macros' '<plugin>/bin/celetis.ts' '--agent' '<host>' 'worktree' --remove <n>` | Removes the lane worktree and the branch of an issue that ended with no landing by the script. It refuses while the issue is open and its branch has no merged PR, so close the issue first |
| `/usr/bin/env BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 '<bun>' '--no-env-file' '--no-install' '--config=/dev/null' '--no-macros' '<plugin>/bin/celetis.ts' '--agent' '<host>' 'land' '<n>' '<subject>'` | Lands the change of the issue by the `landing` field of `.celetis.yaml`. It is the one landing path of an agent. It refuses an issue that is not ready to land. Exit status: 0 landed, 1 internal error, 2 usage, 3 prerequisite, 4 repair, 5 checks, 6 blocked, 7 landed with a stopped cleanup (run it again), 128+n signal |
| `/usr/bin/env BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 '<bun>' '--no-env-file' '--no-install' '--config=/dev/null' '--no-macros' '<plugin>/bin/celetis.ts' '--agent' '<host>' 'issue' '<n>' <act>` | Makes each workflow write that the engine reads: `route <lane>`, `epic`, `needs-info <file>`, `wontfix <file>`, `spec <file>`, `root-cause <file>`, `plan <file>`, `built`, `before-landing <file> [--during-the-build]`, `landing-refused <file>`, `stopped <file>`, `ready-for-human`. It writes the heading of each comment, posts the comment before the label change, and refuses an act whose prerequisite the issue does not meet. `state` writes nothing and prints the lifecycle facts of the issue. `docs/issue-tracker.md`, "Conventions", gives each act. Exit status: 0 done, 1 internal error, 2 usage, 3 prerequisite, 6 blocked |
| `/usr/bin/env BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 '<bun>' '--no-env-file' '--no-install' '--config=/dev/null' '--no-macros' '<plugin>/bin/celetis.ts' '--agent' '<host>' 'next-step' '<n>' \| --open` | The resolver: the next step of one issue, or of each open issue |
| `/usr/bin/env BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 '<bun>' '--no-env-file' '--no-install' '--config=/dev/null' '--no-macros' '<plugin>/bin/celetis.ts' '--agent' '<host>' 'board'` | Starts the board of the plugin (`engine/board/`) with the selected Bun, from the main YAML config; takes no arguments. The board reads its data in its own process |
| `/usr/bin/env BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 '<bun>' '--no-env-file' '--no-install' '--config=/dev/null' '--no-macros' '<plugin>/bin/celetis.ts' '--agent' '<host>' 'capscore' J V B N S X` | Resolves the six digits. `--json` gives portable scores and the host pair. With a Codex profile, it selects the profile by live runtime identity and needs `--runtime-models`; with no Codex profile, `dispatch.model` is null |
| `/usr/bin/env BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 '<bun>' '--no-env-file' '--no-install' '--config=/dev/null' '--no-macros' '<plugin>/bin/celetis.ts' '--agent' '<host>' 'celetis-flow' [<n>...] \| --resume <n>` | The runner: the next step of each number, or the automatic runner with no number. `--resume` opens the session of a step with no progress again |
| `/usr/bin/env BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 '<bun>' '--no-env-file' '--no-install' '--config=/dev/null' '--no-macros' '<plugin>/bin/celetis.ts' '--agent' '<host>' 'root'` | Prints the root of the invoked package |
| `/usr/bin/env BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 '<bun>' '--no-env-file' '--no-install' '--config=/dev/null' '--no-macros' '<plugin>/bin/celetis.ts' '--agent' '<host>' 'plugin-update' check` | Read-only configured-source check; prints an exact offer JSON or `null` |
| `/usr/bin/env BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 '<bun>' '--no-env-file' '--no-install' '--config=/dev/null' '--no-macros' '<plugin>/bin/celetis.ts' '--agent' '<host>' 'plugin-update'` | Discovers the update, asks for terminal confirmation, and applies one exact target; sessions can stay open |
| `bun --no-env-file --no-install --config=/dev/null --no-macros scripts/build.ts [--check]` | Builds the delivery with exactly Bun 1.4.4, or compares generated bytes, and modes on macOS and Linux, without writes |
| `bun --no-env-file --no-install --config=/dev/null --no-macros scripts/verify.ts` | Runs this plugin repository's fast gate in its checkout |
| `bun --no-env-file --no-install --config=/dev/null --no-macros scripts/install-tools.ts DESTINATION [--claude]` | Installs pinned development tools into a private destination |
| `/usr/bin/env BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 '<bun>' '--no-env-file' '--no-install' '--config=/dev/null' '--no-macros' '<plugin>/bin/celetis.ts' '--agent' '<host>' 'setup' check \| write ... \| try ... \| try --remove \| lane <path> \| push` | The deterministic part of `/celetis:setup`: the checks, the write of the wiring, the test lane (`try` makes it and runs the worktree setup there, and `try --remove` removes it), the run of the worktree setup in a lane that exists (`lane`), and the commit with the push. Every setup run calls the installed entrypoint; no product launcher is written |

- Use the exact personal binding form, including its quoted absolute package path.
- Each sub-command gives the output and the exit code of its script.
- Run a command in a checkout of the product project: the plugin holds the scripts, so only the
  current folder names the project. `capscore` and `root` run in each folder.
- The entrypoint needs Bun. Host operations need the selected host CLI. After the entrypoint
  starts it, the named command creates one operation. An implicit host uses the shared reader's
  host projection of the main config; an explicit `--agent` or `CELETIS_AGENT` performs no YAML read
  for selection. Project commands require full valid configuration before protected work, as
  described in `docs/configuration.md`. A missing tool or invalid installation
  stops with a setup action. Codex commands require no Claude binary. The current metadata must
  explicitly mark the installation enabled; missing fields are not an old-format fallback.

## Updates

Run one command in a normal terminal:

```sh
/usr/bin/env BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 '<bun>' '--no-env-file' '--no-install' '--config=/dev/null' '--no-macros' '<plugin>/bin/celetis.ts' '--agent' '<host>' 'plugin-update'
```

The command selects the host from the normal agent settings, discovers its installed package
and configured Git source, and resolves the available revision. It displays the host, native
home, source and full revisions, then asks `Update Celetis now? [y/N]`. Enter `y` or `yes` to
permit that exact attempt. Empty input, EOF or any other answer leaves the installation unchanged.
No cache paths or commit hashes are command arguments. Use `--agent claude` or `--agent codex`
before `plugin-update` to select another host. A noninteractive invocation cannot confirm an update.
When the configured revision is already installed, the command reports that without prompting.

Codex and Claude sessions, runners and boards can stay open. The updater never stops their
processes or requires the Codex daemon to stop. It uses each host's native cache replacement.
A fresh session loads the updated skills and tools; old cache files are not guaranteed to remain
available to running work. Restart a session or board if it still needs a resource that the host
replaced. This user-selected policy supersedes the consumer-exit rule of ADR-0027; see ADR-0028.

The invoked package imports its own updater. An obsolete installed updater needs the explicitly
selected [reviewed source repair](#explicit-source-repair). A plugin update does not rewrite
product files. There is no automatic fallback to another updater. Read-only `/usr/bin/env BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 '<bun>' '--no-env-file' '--no-install' '--config=/dev/null' '--no-macros' '<plugin>/bin/celetis.ts' '--agent' '<host>' 'plugin-update' check` still returns the exact
`UpdateOffer` JSON or `null`. Agents can report that result and provide the one terminal command.
They never type the confirmation, pipe approval, or use issue/configuration text as a response.
Automatic workflow steps do not run updates.

Confirmed updates serialize on the selected host profile's updater lock. Discovery holds a short
shared lock and releases it before a foreground starts. A busy lock refuses the attempt; running
sessions do not reserve this mutex. The existing 120-second monotonic
deadline and descendant cleanup apply. Revalidation under that lock must match the displayed home,
root, source, installed revision and target. A changed identity or target refuses this attempt.
Rerunning the command creates a fresh offer and requires fresh terminal confirmation. No attempt
is queued or retried automatically. Failures preserve native diagnostics and observed partial state.

Claude keeps its native installation scope. It writes a private catalog with the approved source
and exact target SHA, then temporarily registers that catalog and its matching inline source for
one native update. It restores the complete saved marketplace entry locally before it removes the
catalog and releases the lock, including after a native failure, timeout or interruption. User and
project settings stay unchanged. If restoration fails, the error includes the observed native state.
The updater keeps the catalog and reports its path if the registration still points to it or cannot
be read. Repair the native registration before removing that retained catalog or making a new attempt.
Codex uses command-only overrides
for the selected source and exact target. Its whole-marketplace operation refuses other configured
or listed plugins in the Celetis marketplace, including disabled or pending siblings. Other
marketplaces are unchanged. Both paths validate fresh enabled discovery and the full installed
revision. Product configuration, authentication and unrelated plugin policies remain unchanged.
Owned Claude wiring continues to disable Celetis background updates. A successful update starts
no workflow.

## The agent board

The board is `engine/board/` of the plugin, a part of its engine. It shows each agent session and
the next step of each issue, and starts a step with one press. Start it in the main checkout or one
of its subfolders, then open the URL on its last line:

```bash
/usr/bin/env BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 '<bun>' '--no-env-file' '--no-install' '--config=/dev/null' '--no-macros' '<plugin>/bin/celetis.ts' '--agent' '<host>' 'board'
/usr/bin/env PORT=4500 BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 '<bun>' '--no-env-file' '--no-install' '--config=/dev/null' '--no-macros' '<plugin>/bin/celetis.ts' '--agent' '<host>' 'board'
```

The command takes no arguments. It validates the main checkout's `.celetis.yaml` and refuses a
lane start before it starts the board. At the start, the fixed adapter `engine/board/adapter.ts`
checks only the selected Bun. At each Run or Resume press, it finds the enabled copy of the
session's host and checks its entrypoint. The start prints two lines: the main checkout and the
URL. Each refresh reads the issue data in the board process,
with the resolver and the locks of the engine and a fresh operation of the main checkout. So a
change of `host` or `gates` in the main YAML shows at the next refresh. No config file is made.
Only `board.port` comes from YAML at the start; its default is 4403. `PORT` overrides it. This
repository uses 4404, so its board can run beside a board on 4403. Restart the board after a port
change. For a plugin update, follow [Updates](#updates), including resource limits for open work,
and start the board again for its new code.

The `agents` entries of the data report executable availability for Claude and Codex. Sign-in,
trust, and enabled plugin discovery need their own checks. A Run press types this line, with the
selected agent, into a new herdr tab. `<copy>` is the enabled copy of that agent:

```text
'/usr/bin/env' 'BUN_RUNTIME_TRANSPILER_CACHE_PATH=0' 'DO_NOT_TRACK=1' '<bun>' '--no-env-file' '--no-install' '--config=/dev/null' '--no-macros' '<copy>/bin/celetis.ts' '--agent' '<agent>' 'celetis-flow' <n> && exit
```

With no explicit choice, it uses `defaultAgent`: `CELETIS_AGENT`, then `host` in the main
YAML, then `claude`. Set the project default in that YAML field. A Run choice changes only that
start. The board's default-agent menu and command palette show `Default agent is read-only`.
They show the reason: `The main .celetis.yaml controls the default agent. Change host there.`
Unknown or unavailable Run choices return 409 and start no agent. A Resume press types this line,
with `<copy>` from the saved host. The runner uses that host and exact session ID, even after the
YAML default changes:

```text
'/usr/bin/env' 'BUN_RUNTIME_TRANSPILER_CACHE_PATH=0' 'DO_NOT_TRACK=1' '<bun>' '--no-env-file' '--no-install' '--config=/dev/null' '--no-macros' '<copy>/bin/celetis.ts' 'celetis-flow' '--resume' <n> && exit
```

On Windows, both lines are for Windows PowerShell 5.1, the default pane shell of herdr.
Each press finds the enabled copy again. A Claude update needs no board restart for Run and
Resume; new board code still needs a restart. A lookup or entrypoint failure returns 409 before
tab creation or pane execution. Read-only herdr status calls can precede that failure.

`docs/celetis-flow.md`, "The board", gives the data, the fixed lines, and the card states.
[`engine/board/README.md`](engine/board/README.md) describes the page.
Open work may stay open. Required CLI workflow
acceptance remains open; optional desktop evidence is separate in
[Acceptance status](docs/celetis-flow.md#acceptance-status).

## Checks

Run the checks in a checkout of this repository. No check needs model credentials or tokens.

- **The verify gate** is `scripts/verify.ts`. It classifies every tracked path, runs Biome on
  authored TypeScript, JSON and CSS, checks strict runtime/browser/native types, runs native
  actionlint, validates YAML and the plugin, and compares generated bytes, and modes on macOS and
  Linux, without writes. It refuses a tracked test file. Generated JavaScript, unchanged vendor
  sources, and other file exemptions have exact paths and roles. A new unexplained path fails.
  Checks use bounded workers and install nothing. The last line is `verify: PASS`.
- **Build delivery** with exactly Bun 1.4.4. `scripts/build.ts` generates the browser modules
  and native hook modules. `scripts/build.ts --check` fails on changed bytes, or on changed
  modes on macOS and Linux, and writes nothing. Plugin users run no build and install no
  package dependency.
- **The workflow** has one job, `test`, on Linux with Bun 1.4.4. It installs the pinned tools,
  then runs the verify gate.
- **The pin installer,** `scripts/install-tools.ts`, installs exact tool pins into private
  scratch and checks the actionlint archive hash; `AGENTS.md` gives its command.

```sh
BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 bun --no-env-file --no-install --config=/dev/null --no-macros scripts/build.ts
BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 bun --no-env-file --no-install --config=/dev/null --no-macros scripts/verify.ts
```

`docs/celetis-flow.md`, "Check the harness", holds the reasons behind the facts of the gate and the
workflow.
