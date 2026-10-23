import { readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { type JobResult, printJobs, runJobs } from '../scripts/lib/parallel.ts';
import { bunArgs } from '../scripts/lib/process.ts';

export const processEntries = [
  'board/realpath.test.ts',
  'tests/process.test.ts',
  'tests/runner-lock.test.ts',
  'tests/runner-lifecycle.test.ts',
  'tests/runner-startup.test.ts',
  'tests/host-session.test.ts',
  'tests/host-observation.test.ts',
  'tests/host-identity.test.ts',
  'tests/host-resume.test.ts',
];

export async function discoverTests(root: string): Promise<string[]> {
  const files: string[] = [];
  const visit = async (folder: string) => {
    for (const entry of await readdir(join(root, folder), { withFileTypes: true })) {
      const path = folder ? `${folder}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        if (!['.git', '.claude', '.codex', '.superpowers', 'node_modules', 'vendor'].includes(entry.name))
          await visit(path);
      } else if (entry.isFile() && /(?:[._](?:test|spec))\.ts$/.test(entry.name)) files.push(path);
    }
  };
  await visit('');
  return files.sort();
}

export async function suite({
  root = dirname(import.meta.dir),
  files,
  workers = 1,
  timeoutMs = 30_000,
  output = (text: string) => {
    process.stdout.write(text);
  },
}: {
  root?: string;
  files?: string[];
  workers?: number;
  timeoutMs?: number;
  output?: (text: string) => void;
} = {}): Promise<{ code: number; results: JobResult[] }> {
  const discovered = await discoverTests(root);
  const selected = files ?? discovered;
  if (!selected.length || selected.some((path) => !discovered.includes(path))) {
    output('suite: missing automatic test entry\n');
    return { code: 1, results: [] };
  }
  const results = await runJobs(
    selected.map((path) => ({
      label: path,
      file: process.execPath,
      args: bunArgs('test', ['--timeout', '29000', join(root, path)]),
      cwd: root,
    })),
    { workers, timeoutMs },
  );
  for (const result of results) {
    output(`== ${result.label}\n`);
    printJobs([result], output);
    output(`-- ${result.label}: ${(result.elapsedMs / 1000).toFixed(3)} s\n`);
  }
  const code = Number(results.some((result) => result.code !== 0));
  output(`suite: ${code ? 'FAIL' : 'PASS'}\n`);
  return { code, results };
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  if (!args.length || (args.length === 1 && args[0] === '--process'))
    process.exitCode = (await suite({ files: args.length ? processEntries : undefined })).code;
  else {
    console.error('usage: tests/suite.ts [--process]');
    process.exitCode = 2;
  }
}
