import { createHash } from 'node:crypto';
import { cp, lstat, mkdir, mkdtemp, readdir, readFile, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { run } from '../../scripts/lib/process.ts';
import { type CustomInput, checkCustomArtifacts } from './custom-entry-checks.ts';
import { ManualInterrupted, manualClients, manualEnvironment } from './manual-runtime.ts';
import type { StreamRow } from './native-entry-events.ts';

const root = dirname(dirname(import.meta.dir));
const recording =
  'For test evidence only, emit each actual lstat result as JSON with its absolute path and boolean file, directory, and symlink fields from isFile(), isDirectory(), and isSymbolicLink() on that result. For an actual ENOENT error, emit its exact path and code.';
const prompt = '/celetis:guide see the next step of an issue',
  files = 'Skill,Read,Glob,Grep',
  mcp = '{"mcpServers":{}}';
interface Case {
  name: string;
  folder: string;
  tools: string;
  settings: Record<string, unknown>;
  goal: string;
  marker: string;
  checkout: string;
  reads: number;
}
const sha256 = (bytes: string | Uint8Array) => createHash('sha256').update(bytes).digest('hex');
export function validateTransition(input: CustomInput, events: unknown[], result: unknown): void {
  const rows = events as StreamRow[],
    session = (result as StreamRow).session_id;
  let pending: { id?: string; path?: string; session?: string } | undefined, entered: string | undefined;
  for (const row of rows)
    for (const block of Array.isArray(row.message?.content) ? row.message.content : []) {
      if (block.type === 'tool_use' && ['EnterWorktree', 'ExitWorktree'].includes(block.name ?? '')) {
        entered = undefined;
        pending =
          block.name === 'EnterWorktree'
            ? { id: block.id, path: block.input?.path, session: row.session_id }
            : undefined;
      }
      if (row.type === 'user' && block.type === 'tool_result' && pending && block.tool_use_id === pending.id) {
        const path = typeof row.tool_use_result === 'object' ? row.tool_use_result?.worktreePath : undefined;
        entered =
          block.is_error !== true && pending.session === session && row.session_id === session && path === pending.path
            ? pending.path
            : undefined;
        pending = undefined;
      }
    }
  if (!entered || `${entered}/.git` !== input.git.path)
    throw new Error('missing successful current native lane transition');
}
export async function main(args: string[]): Promise<number> {
  let outputDir = '';
  if (args.length) {
    if (args.length !== 2 || args[0] !== '--output-dir' || !args[1]) {
      console.error('usage: tests/manual/custom-part.ts [--output-dir DIR]');
      return 2;
    }
    outputDir = resolve(args[1]);
    await mkdir(outputDir, { recursive: true });
  }
  const tmp = await realpath(await mkdtemp(join(tmpdir(), 'celetis-custom.'))),
    lane = join(tmp, 'project/.claude/worktrees/lane'),
    plugin = join(tmp, 'plugin'),
    observer = join(tmp, 'observer');
  const outputFiles = new Set<string>(),
    env = manualEnvironment(),
    clients = manualClients(env);
  let cleanupCode = 0;
  const selected = (name: string) =>
    !process.env.CUSTOM_PART_CASES?.trim() || process.env.CUSTOM_PART_CASES.split(/\s+/).includes(name);
  try {
    for (const path of [plugin, join(tmp, 'project/sub'), join(tmp, 'outside'), join(tmp, 'missing')])
      await mkdir(path, { recursive: true });
    for (const name of ['skills', 'docs', 'scripts', '.claude-plugin', 'hooks', 'step-prompt.md'])
      await cp(join(root, name), join(plugin, name), { recursive: true });
    await cp(join(root, 'tests/manual/native-observer'), observer, { recursive: true });
    const version = await clients.run('claude', ['--version'], { cwd: tmp });
    await writeFile(join(tmp, 'version'), version.stdout + version.stderr);
    outputFiles.add(join(tmp, 'version'));
    if (version.code) return version.code;
    const sources = async (base: string, origin: string, names: string[]) =>
      Promise.all(
        names.map(async (name) => ({
          path: join(base, name),
          source: join(origin, name),
          sha256: sha256(await readFile(join(base, name))),
        })),
      );
    const pluginSources = await sources(plugin, root, [
      'docs/hosts/entry.md',
      'docs/hosts/claude.md',
      'docs/configuration.md',
      'skills/guide/SKILL.md',
      'skills/writing-for-agents/SKILL.md',
      'skills/lesson-review/SKILL.md',
      'skills/lesson/SKILL.md',
      'hooks/hooks.json',
      'hooks/entry.js',
    ]);
    const observerSources = await sources(observer, join(root, 'tests/manual/native-observer'), [
      '.claude-plugin/plugin.json',
      'hooks/hooks.json',
      'hooks/register.js',
    ]);
    const git = async (folder: string, args: string[]) => {
      const result = await run('git', ['-C', folder, ...args], { env });
      if (result.code) throw new Error(result.stderr);
      return result.stdout.replace(/\n+$/, '');
    };
    const project = join(tmp, 'project');
    await git(project, ['init', '-q']);
    await git(project, [
      '-c',
      'user.name=Test',
      '-c',
      'user.email=test@example.invalid',
      'commit',
      '-qm',
      'initial',
      '--allow-empty',
    ]);
    await git(project, ['worktree', 'add', '-qb', 'lane', lane]);
    await git(project, ['worktree', 'add', '-qb', 'missing', join(tmp, 'missing-lane')]);
    await git(join(tmp, 'missing'), ['init', '-q']);
    const config = (folder: string, marker: string) =>
      writeFile(
        join(folder, '.celetis.yaml'),
        `landing: pr\nworktreeSetup: |-\n  console.log('SETUP_MUST_NOT_RUN');\n  await Bun.write('SETUP_MUST_NOT_RUN', '');\ncustom:\n  guide: |-\n    Include ${marker} on its own line in your answer.\n  bug: |-\n    Include UNRELATED_CUSTOM_MUST_NOT_RUN on its own line in your answer.\n`,
      );
    await config(project, 'CUSTOM_FROM_ROOT');
    await config(join(project, 'sub'), 'CUSTOM_FROM_SUBFOLDER');
    await config(lane, 'CUSTOM_FROM_LANE');
    const configs: Record<string, string> = {
      malformed: 'landing: pr\ncustom: [\n',
      'duplicate-key': 'landing: pr\ncustom:\n  guide: one\n  guide: two\n',
      'wrong-type': 'landing: pr\ncustom:\n  guide: [one, two]\n',
      folded: 'landing: pr\ncustom:\n  guide: >\n    one\n    two\n',
      ambiguous: 'landing: pr\n---\nlanding: merge\n',
      'unknown-field': 'landing: pr\ncustom:\n  unknown: text\n',
      'missing-custom': 'landing: pr\n',
      'empty-custom': 'landing: pr\ncustom: {}\n',
      'empty-instruction': 'landing: pr\ncustom:\n  guide: ""\n',
      borrowed:
        'landing: pr\ncustom:\n  lesson-review: |-\n    Include CUSTOM_BORROWED_REVIEW once on its own line when this reference entry is complete.\n  lesson: |-\n    Include CUSTOM_BORROWED_LESSON once on its own line when this reference entry is complete.\n  bug: |-\n    Include UNRELATED_CUSTOM_MUST_NOT_RUN on its own line in your answer.\n',
    };
    for (const name of [...Object.keys(configs), 'symlink', 'handoff']) {
      const folder = join(tmp, name);
      await mkdir(folder);
      if (selected(name)) await git(folder, ['init', '-q']);
      if (configs[name] !== undefined) await writeFile(join(folder, '.celetis.yaml'), configs[name] ?? '');
    }
    await symlink(join(project, '.celetis.yaml'), join(tmp, 'symlink/.celetis.yaml'));
    await config(join(tmp, 'handoff'), 'CUSTOM_FROM_ROOT');
    await writeFile(
      join(tmp, 'handoff/.celetis.yaml'),
      `${await readFile(join(tmp, 'handoff/.celetis.yaml'), 'utf8')}  writing-for-agents: |-\n    Include CUSTOM_HANDOFF_WRITING once on its own line when this reference entry is complete.\n`,
    );
    const make = (
      name: string,
      folder: string,
      marker: string,
      reads = 1,
      tools = files,
      settings: Record<string, unknown> = {},
      goal = prompt,
      checkout = folder,
    ): Case => ({ name, folder, marker, reads, tools, settings, goal, checkout });
    const noShell = make('no-shell', project, 'CUSTOM_FROM_ROOT');
    const cases: Case[] = [
      ...['ask-cat', 'deny-cat', 'ask-git', 'deny-git'].map((name) => {
        const [permission, command] = name.split('-');
        return make(name, project, 'CUSTOM_FROM_ROOT', 1, `${files},Bash`, {
          permissions: { [permission ?? '']: [`Bash(${command} *)`] },
        });
      }),
      make('subfolder', join(project, 'sub'), 'CUSTOM_FROM_ROOT', 1, files, {}, prompt, project),
      make('worktree', lane, 'CUSTOM_FROM_LANE'),
      make('outside', join(tmp, 'outside'), '', 0, files, {}, prompt, ''),
      make('missing', join(tmp, 'missing'), '', 0),
      make('missing-lane', join(tmp, 'missing-lane'), '', 0),
      make(
        'enter-worktree',
        project,
        'CUSTOM_FROM_LANE',
        1,
        `${files},EnterWorktree`,
        {},
        `Enter the existing worktree at ${lane} with EnterWorktree. Then wait for my guide invocation. Read no config and invoke no skill in this setup turn.`,
        lane,
      ),
      make('denied-read', project, 'blocked', 1, files, { permissions: { deny: [`Read(/${project}/.celetis.yaml)`] } }),
      ...[
        'malformed',
        'duplicate-key',
        'wrong-type',
        'folded',
        'ambiguous',
        'unknown-field',
        'symlink',
        'missing-custom',
        'empty-custom',
        'empty-instruction',
      ].map((name) =>
        make(
          name,
          join(tmp, name),
          ['missing-custom', 'empty-custom', 'empty-instruction'].includes(name) ? '' : 'invalid',
          name === 'symlink' ? 0 : 1,
        ),
      ),
      make(
        'handoff',
        join(tmp, 'handoff'),
        'CUSTOM_FROM_ROOT\nCUSTOM_HANDOFF_WRITING',
        2,
        files,
        {},
        'First invoke /celetis:writing-for-agents to read its rules as a reference. Then invoke /celetis:guide see the next step of an issue in this same session.',
      ),
      make(
        'borrowed',
        join(tmp, 'borrowed'),
        'CUSTOM_BORROWED_LESSON\nCUSTOM_BORROWED_REVIEW',
        2,
        files,
        {},
        '/celetis:lesson-review Read these rules through Host entry as a reference. Then read the borrowed lesson rules through Host entry as a reference, including the Tag Vocabulary and canonical body headings. Consult the lesson Tag Vocabulary again. Do not invoke the borrowed procedure or save a lesson. Report when these reference reads are complete.',
      ),
    ];
    const turn = async (item: Case) => {
      if (!selected(item.name)) return;
      const goal = item.goal,
        full = item.name === 'enter-worktree' ? goal : `${goal}\n\n${recording}`;
      let checkout = '';
      const found = await run('git', ['-C', item.folder, 'rev-parse', '--show-toplevel'], { env });
      if (found.code === 0) checkout = found.stdout.replace(/\n+$/, '');
      if (item.name === 'enter-worktree') checkout = lane;
      const path = checkout ? `${checkout}/.celetis.yaml` : '';
      let source = '',
        hash = '',
        kind = 'missing',
        gitKind = 'directory';
      if (checkout) {
        try {
          if ((await lstat(join(checkout, '.git'))).isFile()) gitKind = 'file';
        } catch {}
      }
      if (path)
        try {
          const meta = await lstat(path);
          const bytes = await readFile(path);
          source = bytes.toString('utf8');
          hash = sha256(bytes);
          kind = meta.isSymbolicLink() ? 'symlink' : 'regular';
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
        }
      const spec: CustomInput = {
        cwd: item.folder,
        plugin,
        pluginSources,
        observerSources,
        tools: item.tools,
        settings: item.settings,
        goal,
        prompt: full,
        metadataRecording: recording,
        mcpConfig: mcp,
        git: { path: `${checkout}/.git`, kind: gitKind },
        messages:
          item.name === 'enter-worktree'
            ? [goal, `${prompt}\n\n${recording}`].map((content) => ({
                type: 'user',
                message: { role: 'user', content },
                parent_tool_use_id: null,
              }))
            : null,
        config: { path, source, sha256: hash, kind },
      };
      for (const suffix of ['input.json', 'jsonl', 'err', 'status'])
        outputFiles.add(join(tmp, `${item.name}.${suffix}`));
      await writeFile(join(tmp, `${item.name}.input.json`), `${JSON.stringify(spec)}\n`);
      const args = [
        '-p',
        '--no-session-persistence',
        '--strict-mcp-config',
        '--mcp-config',
        mcp,
        '--setting-sources',
        '',
        '--plugin-dir',
        observer,
        '--plugin-dir',
        plugin,
        '--tools',
        item.tools,
        '--add-dir',
        tmp,
        '--permission-mode',
        'dontAsk',
        '--allowedTools',
        'mcp__node_repl__js',
        '--settings',
        JSON.stringify(item.settings),
        ...(item.name === 'enter-worktree'
          ? ['--input-format', 'stream-json', '--output-format', 'stream-json', '--verbose', '--replay-user-messages']
          : ['--output-format', 'stream-json', '--verbose', full]),
      ];
      const result = await clients.run('claude', args, {
        cwd: item.folder,
        ...(spec.messages
          ? {
              protocol: {
                messages: spec.messages,
                validate: (rows: unknown[], result: unknown) => validateTransition(spec, rows, result),
              },
            }
          : {}),
      });
      await writeFile(join(tmp, `${item.name}.jsonl`), result.stdout);
      await writeFile(join(tmp, `${item.name}.err`), result.stderr);
      await writeFile(join(tmp, `${item.name}.status`), `${result.code}\n`);
    };
    const setupExists = async (folder: string): Promise<boolean> => {
      for (const item of await readdir(folder, { withFileTypes: true })) {
        if (item.name === 'SETUP_MUST_NOT_RUN') return true;
        if (item.isDirectory() && (await setupExists(join(folder, item.name)))) return true;
      }
      return false;
    };
    const check = async (item: Case) => {
      if (!selected(item.name)) return 0;
      const checked = await checkCustomArtifacts(tmp, {
        name: item.name,
        marker: item.marker,
        checkout: item.checkout,
        reads: item.reads,
        lane,
        setupFound: await setupExists(tmp),
      });
      process.stdout.write(checked.stdout);
      return checked.code;
    };
    await turn(noShell);
    const initial = await check(noShell);
    if (initial) return initial;
    for (let at = 0; at < cases.length; at += 4) await Promise.all(cases.slice(at, at + 4).map(turn));
    let failed = 0;
    for (const item of cases) {
      const result = await check(item);
      if (result === 2) return 2;
      if (result) failed = 1;
    }
    if (failed) return 1;
    console.log(`PASS: ${process.env.CUSTOM_PART_CASES?.trim() || '24 native custom-entry cases'}`);
    return 0;
  } finally {
    clients.close();
    if (outputDir)
      for (const path of outputFiles)
        try {
          await cp(path, join(outputDir, basename(path)));
        } catch {
          cleanupCode = 1;
        }
    await rm(tmp, { recursive: true, force: true });
    if (cleanupCode) process.exitCode = 1;
  }
}
if (import.meta.main)
  try {
    const status = await main(process.argv.slice(2));
    process.exitCode = process.exitCode || status;
  } catch (error) {
    if (!(error instanceof ManualInterrupted)) console.error(String(error));
    process.exitCode = error instanceof ManualInterrupted ? error.status : 2;
  }
