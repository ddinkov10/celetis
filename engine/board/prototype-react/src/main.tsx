import { CSPProvider } from '@base-ui/react/csp-provider';
import { createRoot } from 'react-dom/client';
import { App } from './board.tsx';

createRoot(document.getElementById('root') as HTMLElement).render(
  <CSPProvider disableStyleElements>
    <App />
  </CSPProvider>,
);
