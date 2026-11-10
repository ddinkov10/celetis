import type { Host } from './config-core.ts';

export type UpdateStage = { part: 'engine' | Host; state: 'started' | 'completed' };
