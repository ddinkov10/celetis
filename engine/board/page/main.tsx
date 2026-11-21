import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { App } from './app/app.tsx';

const root = createRoot(document.body);
flushSync(() => root.render(<App />));
await import('./board.ts');
