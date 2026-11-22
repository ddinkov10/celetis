import { CSPProvider } from '@base-ui/react/csp-provider';
import { QueryClientProvider } from '@tanstack/react-query';
import { StopDialog } from '../operations/stop.tsx';
import { queryClient } from '../query.ts';
import { Layers } from './hosts.tsx';
import { Shell } from './shell.tsx';

export function App() {
  return (
    <CSPProvider disableStyleElements>
      <QueryClientProvider client={queryClient}>
        <Shell />
        <Layers />
        <StopDialog />
      </QueryClientProvider>
    </CSPProvider>
  );
}
