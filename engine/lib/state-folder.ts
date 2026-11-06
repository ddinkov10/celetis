import { join } from 'node:path';
import { moveState } from './state-move.ts';

const moves = new Map<string, Promise<void>>();

export async function stateFolder(common: string): Promise<string> {
  let moved = moves.get(common);
  if (moved === undefined) {
    const started = moveState(common);
    moved = started;
    moves.set(common, started);
    started.catch(() => {
      if (moves.get(common) === started) moves.delete(common);
    });
  }
  await moved;
  return join(common, 'celetis');
}
