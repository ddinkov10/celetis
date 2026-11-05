import { receiveClaudeUsage } from './lib/usage-claude.ts';

async function main(args: string[]): Promise<number> {
  const [directory, attemptId] = args;
  if (args.length !== 2 || !directory || !attemptId) {
    console.error('usage: usage-hook <capture-directory> <attempt-id>');
    return 1;
  }
  const chunks: Uint8Array[] = [];
  let size = 0;
  for await (const chunk of Bun.stdin.stream()) {
    size += chunk.byteLength;
    if (size > 1024 * 1024) throw new Error('usage-hook: native event is too large');
    chunks.push(chunk);
  }
  const value: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  await receiveClaudeUsage(directory, attemptId, value);
  return 0;
}

try {
  process.exitCode = await main(process.argv.slice(2));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
