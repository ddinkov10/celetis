import { CSPProvider } from '@base-ui/react/csp-provider';
import { QueryClientProvider } from '@tanstack/react-query';
import { memo, useEffect, useSyncExternalStore } from 'react';
import { StopDialog } from '../operations/stop.tsx';
import { Palette } from '../palette/palette.tsx';
import { queryClient } from '../query.ts';
import { startRead } from '../read/read.ts';
import { Shortcuts } from '../shortcuts/shortcuts.tsx';
import { Toaster } from '../toast/toaster.tsx';
import { announcement } from '../ui.ts';
import { UpdateDialog } from '../update/update.tsx';
import { useGlobalKeys } from './keys.ts';
import { Shell } from './shell.tsx';

const Announcer = memo(() => {
  const text = useSyncExternalStore(announcement.subscribe, announcement.get);
  return (
    <p className="sr-only" id="announce" aria-live="polite">
      {text}
    </p>
  );
});

export function App() {
  useGlobalKeys();
  // A store emit inside a mount effect does not commit before it returns.
  useEffect(() => queueMicrotask(startRead), []);
  return (
    <CSPProvider disableStyleElements>
      <QueryClientProvider client={queryClient}>
        <Shell />
        <Announcer />
        <UpdateDialog />
        <StopDialog />
        <Palette />
        <Shortcuts />
        <Toaster />
      </QueryClientProvider>
    </CSPProvider>
  );
}
