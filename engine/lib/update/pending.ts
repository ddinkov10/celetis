import type { PluginHost } from '../host/names.ts';
import type { Part, PreparedUpdate } from './updater.ts';

export const partDiffers = (part: Extract<Part, { installed: string }>): boolean =>
  part.installed !== part.target || part.ref !== part.to || ('clone' in part && part.clone !== part.target);

export const pendingParts = (offer: PreparedUpdate): ('engine' | PluginHost)[] => [
  ...offer.plugins
    .filter((plugin) => partDiffers({ ...plugin, part: plugin.host, ref: plugin.resolvedRef }))
    .map((plugin) => plugin.host),
  ...(offer.engine.source.revision !== offer.target ? (['engine'] as const) : []),
];
