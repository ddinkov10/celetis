import type { Host } from './config-core.ts';

export type UpdateStage = { part: 'program' | Host; state: 'started' | 'completed' };
