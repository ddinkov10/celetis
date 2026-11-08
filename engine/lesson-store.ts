import { lstat, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { readConfig } from './lib/config.ts';
import { type ExitCode, exits, usage } from './lib/contract.ts';
import { installRecorder, markDefect } from './lib/events.ts';
import { HostError } from './lib/host.ts';
import {
  LessonError,
  type LessonSnapshot,
  type ReviewSnapshot,
  type StoreResult,
  validateCapture,
  validateReviewRequest,
  validateReviewSnapshot,
} from './lib/lesson-record.ts';
import {
  applyLessonReview,
  captureLesson,
  previewLessonReview,
  readLessons,
  recoverLessons,
} from './lib/lesson-store.ts';
import { commandInput, createOperation, locateCheckouts } from './lib/operation.ts';

export async function main(argv: string[]): Promise<ExitCode> {
  try {
    const selected = commandInput(argv);
    if (!selected.explicit)
      throw new LessonError(exits.usage, 'lesson-store', 'select --agent claude or codex explicitly');
    const [act, argument, digest] = selected.args;
    if (
      !(
        (act === 'read' && (argument === 'main' || argument === 'active') && selected.args.length === 2) ||
        ((act === 'capture' || act === 'preview') && argument && selected.args.length === 2) ||
        (act === 'apply' && argument && digest && selected.args.length === 3) ||
        (act === 'recover' && selected.args.length === 1)
      )
    )
      throw new LessonError(exits.usage, 'lesson-store', usage('lesson-store'));
    const cwd = process.cwd();
    const checkout = await locateCheckouts(cwd).catch((error: unknown) => {
      throw new LessonError(exits.blocked, cwd, error instanceof Error ? error.message : String(error));
    });
    await createOperation(checkout, { explicit: selected.explicit }, 'host');
    for (const root of new Set([checkout.main, checkout.active]))
      if (root) {
        const config = join(root, '.celetis.yaml');
        const exists = await lstat(config).catch((error: unknown) => {
          if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
          throw new LessonError(exits.blocked, config, error instanceof Error ? error.message : String(error));
        });
        if (exists) {
          try {
            readConfig(root);
          } catch (error) {
            throw new LessonError(exits.usage, config, error instanceof Error ? error.message : String(error));
          }
        }
      }
    let result: LessonSnapshot | ReviewSnapshot | StoreResult;
    if (act === 'read') result = await readLessons(cwd, argument as 'main' | 'active');
    else if (act === 'recover') result = await recoverLessons(cwd);
    else {
      const file = resolve(cwd, argument as string);
      let input: unknown;
      let bytes: Buffer;
      try {
        bytes = await readFile(file);
      } catch (error) {
        throw new LessonError(exits.blocked, file, error instanceof Error ? error.message : String(error));
      }
      try {
        input = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
      } catch {
        throw new LessonError(exits.usage, file, 'need valid UTF-8 JSON');
      }
      if (act === 'capture') result = await captureLesson(cwd, validateCapture(input, file));
      else if (act === 'preview') result = await previewLessonReview(cwd, validateReviewRequest(input, file));
      else result = await applyLessonReview(cwd, validateReviewSnapshot(input, file), digest as string);
    }
    console.log(JSON.stringify(result));
    return exits.done;
  } catch (error) {
    if (!(error instanceof LessonError)) markDefect(error);
    console.error(`lesson-store: ${error instanceof Error ? error.message : String(error)}`);
    return error instanceof LessonError || error instanceof HostError ? error.code : exits.internal;
  }
}
if (import.meta.main) {
  installRecorder('lesson-store');
  process.exitCode = await main(process.argv.slice(2));
}
