import { createHash } from 'node:crypto';
import { cp, lstat, mkdir, mkdtemp, readdir, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { run } from '../../scripts/lib/process.ts';
import { ManualInterrupted, manualClients, manualEnvironment } from './manual-runtime.ts';
import { stepCases } from './step-cases.ts';
import { checkStep } from './step-checks.ts';

const root = dirname(dirname(import.meta.dir));
export async function main(args: string[]): Promise<number> {
  let host = 'claude',
    outputDir = '',
    only = '';
  for (let at = 0; at < args.length; at++) {
    const flag = args[at],
      value = args[++at];
    if (!['--agent', '--output-dir', '--only'].includes(flag ?? '') || value === undefined) {
      console.error('usage: tests/manual/step-prompt.ts [--agent claude|codex] [--output-dir DIR] [--only CASE:MODE]');
      return 2;
    }
    if (flag === '--agent') host = value;
    else if (flag === '--output-dir') outputDir = resolve(value);
    else only = value;
  }
  if (!['claude', 'codex'].includes(host)) {
    console.error(`invalid agent: ${host}`);
    return 2;
  }
  const tmp = await mkdtemp(join(tmpdir(), 'celetis-step.')),
    env = manualEnvironment(),
    clients = manualClients(env);
  try {
    if (outputDir) await mkdir(outputDir, { recursive: true });
    const cwd = await realpath(process.cwd()),
      git = await run('git', ['rev-parse', '--show-toplevel'], { cwd, env });
    if (git.code) {
      console.error('start this test in a product Git checkout');
      return 2;
    }
    const product = await realpath(git.stdout.replace(/\n+$/, '')),
      directories = [cwd];
    while (directories[0] !== product) {
      const parent = dirname(directories[0] ?? '/');
      if (parent === directories[0]) throw new Error('starting folder is outside product checkout');
      directories.unshift(parent);
    }
    let context = `Product root: ${product}\nStarting folder: ${cwd}\n\nApply these product instructions in the listed order.\n`;
    const sources: { path: string; sha256: string; snapshot: string }[] = [];
    for (const directory of directories) {
      const path = join(directory, 'AGENTS.md');
      let exists = true;
      try {
        await lstat(path);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') exists = false;
        else throw error;
      }
      if (!exists) continue;
      let bytes: Buffer;
      try {
        bytes = await readFile(path);
      } catch {
        console.error(`cannot read product instructions: ${path}`);
        return 2;
      }
      const snapshot = `product-instruction-${sources.length + 1}.md`;
      await writeFile(join(tmp, snapshot), bytes);
      sources.push({ path, sha256: createHash('sha256').update(bytes).digest('hex'), snapshot });
      context += `\n# Instructions from ${path}\n\n${bytes.toString()}\n`;
    }
    if (!sources.length) context += '\nNo product AGENTS.md was found.\n';
    await writeFile(join(tmp, 'product-context.md'), context);
    await writeFile(join(tmp, 'product-context.json'), `${JSON.stringify({ cwd, root: product, sources })}\n`);
    const project = join(tmp, 'project');
    await mkdir(project);
    await run('git', ['-C', project, 'init', '-q'], { env });
    const version = await clients.run(host, ['--version'], { cwd });
    await writeFile(join(tmp, 'version'), version.stdout + version.stderr);
    if (version.code) return version.code;
    for (const [k, text] of Object.entries(stepCases)) await writeFile(join(tmp, `case-${k}`), `${text}\n`);
    const refs = `${await readFile(join(root, 'docs/hosts/entry.md'), 'utf8')}${await readFile(join(root, `docs/hosts/${host}.md`), 'utf8')}`,
      step = await readFile(join(root, 'step-prompt.md'), 'utf8');
    const pairs: [number, string][] = [
      ...[
        1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31,
        32, 33, 34,
      ].map((k) => [k, 'step'] as [number, string]),
      [15, 'specify'],
      ...[1, 2, 3, 4].map((k) => [k, 'hand'] as [number, string]),
    ];
    const selected = pairs.filter(([k, mode]) => (k !== 34 || host === 'codex') && (!only || only === `${k}:${mode}`));
    const turns = new Map<string, { answer: string; status: number; events: unknown[]; stderr: string }>();
    for (let at = 0; at < selected.length; at += 2)
      await Promise.all(
        selected.slice(at, at + 2).map(async ([k, mode]) => {
          const started =
            mode === 'hand' || (k >= 22 && k <= 33 && k !== 32)
              ? 'A person started the session by hand for issue #7.'
              : 'scripts/celetis celetis-flow started the session for issue #7.';
          const prompt = `This is a dry run. Run no tool and invoke no skill. Answer with the acts that you do next, in order. Each act is one exact shell command, or one sentence that you write to the person at the terminal. End with one line: "Then: I wait for the person", "Then: my step ends", or "Then: I go on with <what>". Do not explain.\n\nYou are the session of one step of this repository's celetis flow. ${started} The skill excerpts are verbatim. The host is ${host}. These host references are already loaded for this dry run; apply their command spellings without executing their initialization:\n\n${context}\nHost references:\n${refs}${mode === 'step' && host === 'codex' ? `\nStep instructions:\n${step}` : ''}\nScenario:\n${stepCases[k]}\n`;
          const answer = join(tmp, `out-${k}-${mode}`),
            key = `${k}-${mode}`;
          await writeFile(join(tmp, `in-${key}`), prompt);
          const args =
            host === 'claude'
              ? [
                  '-p',
                  '--no-session-persistence',
                  '--tools',
                  '',
                  ...(mode === 'step'
                    ? ['--permission-mode', 'auto', '--append-system-prompt-file', join(root, 'step-prompt.md')]
                    : []),
                ]
              : [
                  'exec',
                  '--ephemeral',
                  '--json',
                  '-C',
                  project,
                  '--sandbox',
                  'read-only',
                  '-c',
                  'features.shell_tool=false',
                  '-c',
                  'features.apps=false',
                  '-c',
                  'features.plugins=false',
                  '--output-last-message',
                  answer,
                  '-',
                ];
          const result = await clients.run(host, args, { cwd: project, input: prompt });
          if (host === 'claude') await writeFile(answer, result.stdout);
          else await writeFile(join(tmp, `events-${key}`), result.stdout);
          await writeFile(join(tmp, `err-${key}`), result.stderr);
          await writeFile(join(tmp, `status-${key}`), `${result.code}\n`);
          let text = '';
          try {
            text = await readFile(answer, 'utf8');
          } catch {}
          let events: unknown[] = [];
          try {
            events = result.stdout
              .trim()
              .split('\n')
              .filter(Boolean)
              .map((line) => JSON.parse(line));
          } catch {}
          turns.set(key, { answer: text, status: result.code, events, stderr: result.stderr });
        }),
      );
    let failed = false;
    for (const [k, mode] of selected) {
      const turn = turns.get(`${k}-${mode}`);
      if (!turn) continue;
      const checked = checkStep({ ...turn, k, mode, host, productCwd: cwd });
      if (checked.errors.length) {
        failed = true;
        console.log(`FAIL: case ${k} ${mode}: ${checked.errors.join(', ')}`);
        process.stdout.write(turn.answer + turn.stderr);
      } else {
        if (checked.recovered) console.log(`WARN: case ${k} ${mode} recovered ${checked.recovered} service event(s)`);
        console.log(`PASS: case ${k} ${mode} (${host})`);
      }
    }
    if (outputDir)
      for (const name of await readdir(tmp))
        if (name === 'version' || name.startsWith('product-') || /^(case|in|out|err|status|events)-/.test(name))
          await cp(join(tmp, name), join(outputDir, name));
    if (failed) return 1;
    console.log(only ? `PASS (${host}): case ${only}` : `PASS (${host}): ${selected.length} cases`);
    return 0;
  } finally {
    clients.close();
    await rm(tmp, { recursive: true, force: true });
  }
}
if (import.meta.main)
  try {
    process.exitCode = await main(process.argv.slice(2));
  } catch (error) {
    if (!(error instanceof ManualInterrupted)) console.error(String(error));
    process.exitCode = error instanceof ManualInterrupted ? error.status : 2;
  }
