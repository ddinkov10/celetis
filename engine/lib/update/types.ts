import { z } from 'zod';
import { isPluginHost, type PluginHost } from '../host/names.ts';

export const part = z.union([z.literal('engine'), z.custom<PluginHost>(isPluginHost)]);
export const updateStage = z.strictObject({ part, state: z.enum(['started', 'completed']) });
export type UpdateStage = z.output<typeof updateStage>;
