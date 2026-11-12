import type { PluginHost } from './host-names.ts';

export type UpdateStage = { part: 'engine' | PluginHost; state: 'started' | 'completed' };
