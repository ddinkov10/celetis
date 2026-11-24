import type { Host } from '../../lib/host/names.ts';
import { toast } from './toast/toast.ts';

const CODEX_ICON =
  'data:image/svg+xml;base64,PHN2ZyBoZWlnaHQ9IjFlbSIgc3R5bGU9ImZsZXg6bm9uZTtsaW5lLWhlaWdodDoxIiB2aWV3Qm94PSIwIDAgMjQgMjQiIHdpZHRoPSIxZW0iIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHRpdGxlPkNvZGV4PC90aXRsZT48cGF0aCBkPSJNMTkuNTAzIDBINC40OTZBNC40OTYgNC40OTYgMCAwMDAgNC40OTZ2MTUuMDA3QTQuNDk2IDQuNDk2IDAgMDA0LjQ5NiAyNGgxNS4wMDdBNC40OTYgNC40OTYgMCAwMDI0IDE5LjUwM1Y0LjQ5NkE0LjQ5NiA0LjQ5NiAwIDAwMTkuNTAzIDB6IiBmaWxsPSIjZmZmIj48L3BhdGg+PHBhdGggZD0iTTkuMDY0IDMuMzQ0YTQuNTc4IDQuNTc4IDAgMDEyLjI4NS0uMzEyYzEgLjExNSAxLjg5MS41NCAyLjY3MyAxLjI3NS4wMS4wMS4wMjQuMDE3LjAzNy4wMjFhLjA5LjA5IDAgMDAuMDQzIDAgNC41NSA0LjU1IDAgMDEzLjA0Ni4yNzVsLjA0Ny4wMjIuMTE2LjA1N2E0LjU4MSA0LjU4MSAwIDAxMi4xODggMi4zOTljLjIwOS41MS4zMTMgMS4wNDEuMzE1IDEuNTk1YTQuMjQgNC4yNCAwIDAxLS4xMzQgMS4yMjMuMTIzLjEyMyAwIDAwLjAzLjExNWMuNTk0LjYwNy45ODggMS4zMyAxLjE4MyAyLjE3LjI4OSAxLjQyNS0uMDA3IDIuNzEtLjg4NyAzLjg1NGwtLjEzNi4xNjZhNC41NDggNC41NDggMCAwMS0yLjIwMSAxLjM4OC4xMjMuMTIzIDAgMDAtLjA4MS4wNzZjLS4xOTEuNTUxLS4zODMgMS4wMjMtLjc0IDEuNDk0LS45IDEuMTg3LTIuMjIyIDEuODQ2LTMuNzExIDEuODM4LTEuMTg3LS4wMDYtMi4yMzktLjQ0LTMuMTU3LTEuMzAyYS4xMDcuMTA3IDAgMDAtLjEwNS0uMDI0Yy0uMzg4LjEyNS0uNzguMTQzLTEuMjA0LjEzOGE0LjQ0MSA0LjQ0MSAwIDAxLTEuOTQ1LS40NjYgNC41NDQgNC41NDQgMCAwMS0xLjYxLTEuMzM1Yy0uMTUyLS4yMDItLjMwMy0uMzkyLS40MTQtLjYxN2E1LjgxIDUuODEgMCAwMS0uMzctLjk2MSA0LjU4MiA0LjU4MiAwIDAxLS4wMTQtMi4yOTguMTI0LjEyNCAwIDAwLjAwNi0uMDU2LjA4NS4wODUgMCAwMC0uMDI3LS4wNDggNC40NjcgNC40NjcgMCAwMS0xLjAzNC0xLjY1MSAzLjg5NiAzLjg5NiAwIDAxLS4yNTEtMS4xOTIgNS4xODkgNS4xODkgMCAwMS4xNDEtMS42Yy4zMzctMS4xMTIuOTgyLTEuOTg1IDEuOTMzLTIuNjE4LjIxMi0uMTQxLjQxMy0uMjUxLjYwMS0uMzMuMjE1LS4wODkuNDMtLjE2NC42NDYtLjIyN2EuMDk4LjA5OCAwIDAwLjA2NS0uMDY2IDQuNTEgNC41MSAwIDAxLjgyOS0xLjYxNSA0LjUzNSA0LjUzNSAwIDAxMS44MzctMS4zODh6bTMuNDgyIDEwLjU2NWEuNjM3LjYzNyAwIDAwMCAxLjI3MmgzLjYzNmEuNjM3LjYzNyAwIDEwMC0xLjI3MmgtMy42MzZ6TTguNDYyIDkuMjNhLjYzNy42MzcgMCAwMC0xLjEwNi42MzFsMS4yNzIgMi4yMjQtMS4yNjYgMi4xMzZhLjYzNi42MzYgMCAxMDEuMDk1LjY0OWwxLjQ1NC0yLjQ1NWEuNjM2LjYzNiAwIDAwLjAwNS0uNjRMOC40NjIgOS4yM3oiIGZpbGw9InVybCgjbG9iZS1pY29ucy1jb2RleC1fUl8wXykiPjwvcGF0aD48ZGVmcz48bGluZWFyR3JhZGllbnQgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiIGlkPSJsb2JlLWljb25zLWNvZGV4LV9SXzBfIiB4MT0iMTIiIHgyPSIxMiIgeTE9IjMiIHkyPSIyMSI+PHN0b3Agc3RvcC1jb2xvcj0iI0IxQTdGRiI+PC9zdG9wPjxzdG9wIG9mZnNldD0iLjUiIHN0b3AtY29sb3I9IiM3QTlERkYiPjwvc3RvcD48c3RvcCBvZmZzZXQ9IjEiIHN0b3AtY29sb3I9IiMzOTQxRkYiPjwvc3RvcD48L2xpbmVhckdyYWRpZW50PjwvZGVmcz48L3N2Zz4=';
const CLAUDE_ICON =
  'data:image/svg+xml;base64,PHN2ZyBoZWlnaHQ9IjFlbSIgc3R5bGU9ImZsZXg6bm9uZTtsaW5lLWhlaWdodDoxIiB2aWV3Qm94PSIwIDAgMjQgMjQiIHdpZHRoPSIxZW0iIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHRpdGxlPkNsYXVkZSBDb2RlPC90aXRsZT48cGF0aCBjbGlwLXJ1bGU9ImV2ZW5vZGQiIGQ9Ik0yMC45OTggMTAuOTQ5SDI0djMuMTAyaC0zdjMuMDI4aC0xLjQ4N1YyMEgxOHYtMi45MjFoLTEuNDg3VjIwSDE1di0yLjkyMUg5VjIwSDcuNDg4di0yLjkyMUg2VjIwSDQuNDg3di0yLjkyMUgzVjE0LjA1SDBWMTAuOTVoM1Y1aDE3Ljk5OHY1Ljk0OXpNNiAxMC45NDloMS40ODhWOC4xMDJINnYyLjg0N3ptMTAuNTEgMEgxOFY4LjEwMmgtMS40OXYyLjg0N3oiIGZpbGw9IiNEOTc3NTciIGZpbGwtcnVsZT0iZXZlbm9kZCI+PC9wYXRoPjwvc3ZnPg==';

const OPENCODE_ICON =
  'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxNSIgaGVpZ2h0PSIxNSIgdmlld0JveD0iMCAwIDE1IDE1Ij48dGl0bGU+T3BlbkNvZGU8L3RpdGxlPjxzdHlsZT50ZXh0e2ZpbGw6I2VkZWRmMH1AbWVkaWEgKHByZWZlcnMtY29sb3Itc2NoZW1lOmxpZ2h0KXt0ZXh0e2ZpbGw6IzE3MTcxYX19PC9zdHlsZT48dGV4dCB4PSI3LjUiIHk9IjcuNSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZG9taW5hbnQtYmFzZWxpbmU9ImNlbnRyYWwiIGZvbnQtZmFtaWx5PSJHZWlzdCwnU2Vnb2UgVUknLHN5c3RlbS11aSxzYW5zLXNlcmlmIiBmb250LXNpemU9IjEzIiBmb250LXdlaWdodD0iNjAwIj5PPC90ZXh0Pjwvc3ZnPg==';

export const AGENT_ICONS: Record<Host, string> = { claude: CLAUDE_ICON, codex: CODEX_ICON, opencode: OPENCODE_ICON };

const ring = (extra: Record<string, string> = {}): [string, Record<string, string | number>] => [
  'circle',
  { cx: 8, cy: 8, r: 6, ...extra },
];
export const ICONS: Record<string, [string, Record<string, string | number>][]> = {
  logo: [
    ['rect', { x: 1.5, y: 1.5, width: 5.5, height: 13, rx: 1.75, class: 'fill' }],
    ['rect', { x: 9, y: 1.5, width: 5.5, height: 8, rx: 1.75, class: 'fill' }],
  ],
  'col-needs': [ring(), ['circle', { cx: 8, cy: 8, r: 2.6, class: 'fill core' }]],
  'col-running': [ring({ class: 'track' }), ['path', { d: 'M8 4.6a3.4 3.4 0 0 1 0 6.8Z', class: 'fill' }]],
  'col-idle': [ring({ 'stroke-dasharray': '2.6 2.2' })],
  nolane: [['circle', { cx: 8, cy: 8, r: 5.5, 'stroke-dasharray': '2.3 2' }]],
  clear: [ring(), ['path', { d: 'm5.4 8.1 1.8 1.8 3.5-3.7' }]],
  bug: [
    [
      'path',
      {
        d: 'M5.5 5.5h5a1 1 0 0 1 1 1V9a3.5 3.5 0 0 1-7 0V6.5a1 1 0 0 1 1-1ZM6 5.5a2 2 0 0 1 4 0M8 8v4.25M2.75 8.5H4.5M11.5 8.5h1.75M3.5 5.5l1.25.9M12.5 5.5l-1.25.9M3.5 12.5l1.4-1M12.5 12.5l-1.4-1',
      },
    ],
  ],
  'trend-up': [['path', { d: 'M8 13V3M4 7l4-4 4 4' }]],
  'trend-down': [['path', { d: 'M8 3v10M4 9l4 4 4-4' }]],
  pin: [['path', { d: 'M5.5 2h5l-.8 4.2 2.3 2.3v1H8.6V14h-1.2V9.5H4v-1l2.3-2.3z', class: 'fill' }]],
  spark: [['path', { d: 'M8 2.25 9.3 6.7 13.75 8 9.3 9.3 8 13.75 6.7 9.3 2.25 8 6.7 6.7Z' }]],
  wrench: [
    [
      'path',
      {
        d: 'M10.6 2.6a3.25 3.25 0 0 0-3.9 4.2L2.9 10.6a1.4 1.4 0 0 0 2 2l3.8-3.8a3.25 3.25 0 0 0 4.2-3.9l-2 2-1.8-.5-.5-1.8Z',
      },
    ],
  ],
  flame: [
    [
      'path',
      { d: 'M8 14a4 4 0 0 0 4-4c0-2.5-2-4-2.5-6.5C8 5 7.5 6.5 7.5 6.5S6.5 5.5 6.5 4C5 5.5 4 7.5 4 10a4 4 0 0 0 4 4Z' },
    ],
  ],
  terminal: [
    ['rect', { x: 1.75, y: 2.75, width: 12.5, height: 10.5, rx: 2 }],
    ['path', { d: 'm4.75 6.25 2 1.75-2 1.75M8.5 10h2.75' }],
  ],
  works: [
    ['circle', { cx: 8, cy: 8, r: 5.75, class: 'track' }],
    ['path', { d: 'M8 2.25A5.75 5.75 0 0 1 13.75 8' }],
  ],
  refresh: [['path', { d: 'M13.25 8A5.25 5.25 0 1 1 11.7 4.3M13.25 2.5v3h-3' }]],
  run: [['path', { d: 'M5 3.6v8.8a.6.6 0 0 0 .9.5l7-4.4a.6.6 0 0 0 0-1L5.9 3.1a.6.6 0 0 0-.9.5Z', class: 'fill' }]],
  go: [['path', { d: 'M5 11 11 5M6.25 5H11v4.75' }]],
  open: [
    [
      'path',
      {
        d: 'M9.5 2.5h4v4M13.5 2.5 7.5 8.5M12 9.5v2.75a1.25 1.25 0 0 1-1.25 1.25h-7A1.25 1.25 0 0 1 2.5 12.25v-7A1.25 1.25 0 0 1 3.75 4H6.5',
      },
    ],
  ],
  copy: [
    ['rect', { x: 5.5, y: 5.5, width: 8, height: 8, rx: 1.75 }],
    ['path', { d: 'M10.5 3.5V3A1.5 1.5 0 0 0 9 1.5H4A1.5 1.5 0 0 0 2.5 3v5A1.5 1.5 0 0 0 4 9.5h.5' }],
  ],
  check: [['path', { d: 'm3.5 8.5 3 3 6-7' }]],
  stop: [['rect', { x: 4.25, y: 4.25, width: 7.5, height: 7.5, rx: 1.5 }]],
  aside: [['path', { d: 'M6 4v8M10 4v8' }]],
  'move-first': [['path', { d: 'M3.5 2.75h9M8 13.25v-7.5M4.75 9 8 5.75 11.25 9' }]],
  'move-up': [['path', { d: 'M8 12.75v-9.5M4.5 6.75 8 3.25l3.5 3.5' }]],
  'move-down': [['path', { d: 'M8 3.25v9.5M4.5 9.25 8 12.75l3.5-3.5' }]],
  'move-last': [['path', { d: 'M3.5 13.25h9M8 2.75v7.5M4.75 7 8 10.25 11.25 7' }]],
  alert: [
    ['path', { d: 'M7.13 2.5a1 1 0 0 1 1.74 0l5.5 9.75a1 1 0 0 1-.87 1.5H2.5a1 1 0 0 1-.87-1.5Z' }],
    ['path', { d: 'M8 6.25v3' }],
    ['circle', { cx: 8, cy: 11.4, r: 0.45, class: 'fill' }],
  ],
  chevron: [['path', { d: 'm6 4 4 4-4 4' }]],
  keyboard: [
    ['rect', { x: 1.5, y: 4, width: 13, height: 8.5, rx: 2 }],
    ['path', { d: 'M4.5 7h.01M7 7h.01M9.5 7h.01M12 7h.01M5.25 9.75h5.5' }],
  ],
  target: [
    ['circle', { cx: 8, cy: 8, r: 5.75 }],
    ['circle', { cx: 8, cy: 8, r: 2.25, class: 'fill' }],
  ],
  pending: [['circle', { cx: 8, cy: 8, r: 5.75, 'stroke-dasharray': '2.4 2.1' }]],
  diff: [
    ['rect', { x: 2.25, y: 2.25, width: 11.5, height: 11.5, rx: 2.5 }],
    ['path', { d: 'M8 4.75v4M6 6.75h4M6 11h4' }],
  ],
  question: [
    ['circle', { cx: 8, cy: 8, r: 6 }],
    ['path', { d: 'M6.3 6.4a1.75 1.75 0 1 1 2.55 1.55c-.55.3-.85.65-.85 1.25' }],
    ['circle', { cx: 8, cy: 11.2, r: 0.45, class: 'fill' }],
  ],
  person: [
    ['circle', { cx: 8, cy: 5.25, r: 2.75 }],
    ['path', { d: 'M2.75 14c.6-2.6 2.6-4 5.25-4s4.65 1.4 5.25 4' }],
  ],
  message: [
    [
      'path',
      {
        d: 'M2.5 4.25A1.75 1.75 0 0 1 4.25 2.5h7.5a1.75 1.75 0 0 1 1.75 1.75v5a1.75 1.75 0 0 1-1.75 1.75H7.25L4.5 13.25V11h-.25A1.75 1.75 0 0 1 2.5 9.25Z',
      },
    ],
  ],
  close: [['path', { d: 'm4.5 4.5 7 7M11.5 4.5l-7 7' }]],
  dots: [
    ['circle', { cx: 3.5, cy: 8, r: 1.1, class: 'fill' }],
    ['circle', { cx: 8, cy: 8, r: 1.1, class: 'fill' }],
    ['circle', { cx: 12.5, cy: 8, r: 1.1, class: 'fill' }],
  ],
  bell: [
    ['path', { d: 'M4 11.25V7.5a4 4 0 0 1 8 0v3.75l1 1.25H3Z' }],
    ['path', { d: 'M6.5 14a1.6 1.6 0 0 0 3 0' }],
  ],
  'bell-off': [
    [
      'path',
      {
        d: 'M5.2 4.4A4 4 0 0 1 12 7.5v2.4M12.6 12.5H3l1-1.25V7.5c0-.5.1-1 .25-1.45M6.5 14a1.6 1.6 0 0 0 3 0M2.5 2.5l11 11',
      },
    ],
  ],
  'theme-system': [
    ['circle', { cx: 8, cy: 8, r: 5.5 }],
    ['path', { d: 'M8 2.5a5.5 5.5 0 0 1 0 11Z', class: 'fill' }],
  ],
  'theme-light': [
    ['circle', { cx: 8, cy: 8, r: 3 }],
    [
      'path',
      {
        d: 'M8 1.5v1.6M8 12.9v1.6M1.5 8h1.6M12.9 8h1.6M3.4 3.4l1.1 1.1M11.5 11.5l1.1 1.1M3.4 12.6l1.1-1.1M11.5 4.5l1.1-1.1',
      },
    ],
  ],
  'theme-dark': [['path', { d: 'M13 9.6A5.5 5.5 0 1 1 6.4 3a4.4 4.4 0 0 0 6.6 6.6Z' }]],
  search: [
    ['circle', { cx: 7.25, cy: 7.25, r: 4.25 }],
    ['path', { d: 'm10.5 10.5 3 3' }],
  ],
  pr: [
    ['circle', { cx: 4.5, cy: 3.75, r: 1.6 }],
    ['circle', { cx: 4.5, cy: 12.25, r: 1.6 }],
    ['circle', { cx: 11.5, cy: 12.25, r: 1.6 }],
    ['path', { d: 'M4.5 5.35v5.3M11.5 10.65V6.5A2 2 0 0 0 9.5 4.5H7.25M8.75 3 7.25 4.5 8.75 6' }],
  ],
  xcircle: [
    ['circle', { cx: 8, cy: 8, r: 6 }],
    ['path', { d: 'm6 6 4 4M10 6l-4 4' }],
  ],
  clock: [
    ['circle', { cx: 8, cy: 8, r: 6 }],
    ['path', { d: 'M8 4.75V8l2 1.5' }],
  ],
  file: [
    ['path', { d: 'M4 1.75h5L12.5 5.25v8a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-10.5a1 1 0 0 1 1-1Z' }],
    ['path', { d: 'M9 1.75v3.5h3.5' }],
  ],
  folder: [
    [
      'path',
      {
        d: 'M2 4.25A1.25 1.25 0 0 1 3.25 3h3l1.5 1.75h5A1.25 1.25 0 0 1 14 6v5.75A1.25 1.25 0 0 1 12.75 13h-9.5A1.25 1.25 0 0 1 2 11.75Z',
      },
    ],
  ],
  board: [
    ['rect', { x: 1.75, y: 2.5, width: 3.5, height: 11, rx: 1 }],
    ['rect', { x: 6.25, y: 2.5, width: 3.5, height: 8, rx: 1 }],
    ['rect', { x: 10.75, y: 2.5, width: 3.5, height: 5.5, rx: 1 }],
  ],
  queue: [['path', { d: 'M2.75 4h10.5M2.75 8h10.5M2.75 12h6.5' }]],
  stages: [
    ['path', { d: 'M1.75 8h2.5M6.75 8h2.5M11.75 8h2.5' }],
    ['circle', { cx: 5.5, cy: 8, r: 1.25 }],
    ['circle', { cx: 10.5, cy: 8, r: 1.25 }],
  ],
  home: [
    ['path', { d: 'M2.75 7.25 8 2.75l5.25 4.5v5.5a.75.75 0 0 1-.75.75H9.75V9.75h-3.5v3.75H3.5a.75.75 0 0 1-.75-.75Z' }],
  ],
  sliders: [
    ['path', { d: 'M2.75 4.5h5.5M11.25 4.5h2M2.75 11.5h2M7.75 11.5h5.5' }],
    ['circle', { cx: 9.75, cy: 4.5, r: 1.5 }],
    ['circle', { cx: 6.25, cy: 11.5, r: 1.5 }],
  ],
  trend: [['path', { d: 'M2.25 11.5 6 7.75l2.5 2.5 5.25-5.5M10.5 4.75h3.25V8' }]],
  panel: [
    ['rect', { x: 1.75, y: 2.5, width: 12.5, height: 11, rx: 2 }],
    ['path', { d: 'M9.5 2.5v11' }],
  ],
};

export const safeUrl = (url?: string | null): string | null => {
  if (url && !/[\u0000-\u0020\u007f-\u009f]/.test(url)) {
    try {
      const parsed = new URL(url);
      if (['http:', 'https:'].includes(parsed.protocol) && !parsed.username && !parsed.password) return url;
    } catch {}
  }
  return null;
};

export const openUrl = (url?: string | null) => {
  const href = safeUrl(url);
  if (href) window.open(href, '_blank', 'noopener,noreferrer');
};

export const capital = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

export const SERVER_DOWN = 'The board server does not answer';
const RESTART = 'Start the daemon again in a terminal: celetis daemon start.';

export type PostOutcome =
  | { status: 'accepted'; body: unknown }
  | { status: 'rejected'; error: string }
  | { status: 'unavailable'; error?: string };
export async function send(path: string, value: unknown, failure: string): Promise<string | null> {
  try {
    const response = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(value),
    });
    if (response.ok) return null;
    const body = (await response.json().catch(() => null)) as { error?: unknown } | null;
    const error = typeof body?.error === 'string' ? body.error : `the server answered ${response.status}`;
    toast(failure, { detail: error, isError: true });
    return error;
  } catch {
    toast(SERVER_DOWN, { detail: RESTART, isError: true });
    return SERVER_DOWN;
  }
}
export function post(path: string, value: unknown, failure: string): Promise<boolean>;
export function post(path: string, value: unknown, failure: string, options: { timeout: number }): Promise<PostOutcome>;
export async function post(
  path: string,
  value: unknown,
  failure: string,
  options?: { timeout: number },
): Promise<boolean | PostOutcome> {
  if (!options) return (await send(path, value, failure)) === null;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeout);
  try {
    const response = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(value),
      signal: controller.signal,
    });
    if (response.ok) return { status: 'accepted', body: await response.json().catch(() => null) };
    const body = (await response.json()) as { error?: unknown } | null;
    const error = typeof body?.error === 'string' ? body.error : undefined;
    if (response.status >= 400 && response.status < 500 && error !== undefined) return { status: 'rejected', error };
    return { status: 'unavailable', ...(error !== undefined ? { error } : {}) };
  } catch {
    return { status: 'unavailable' };
  } finally {
    clearTimeout(timeout);
  }
}

export const copy = async (text: string, what: string) => {
  try {
    await navigator.clipboard.writeText(text);
    toast(`Copied the ${what}`);
  } catch {
    toast('Copy failed', { detail: 'The browser did not allow access to the clipboard.', isError: true });
  }
};

export const store = {
  key: (name: string) => `celetis:${name}`,
  get: (key: string) => {
    try {
      return localStorage.getItem(store.key(key));
    } catch {
      return null;
    }
  },
  set: (key: string, value: string) => {
    try {
      localStorage.setItem(store.key(key), value);
    } catch {}
  },
  keys: (prefix: string) => {
    try {
      const start = store.key('').length;
      return Object.keys(localStorage)
        .filter((name) => name.startsWith(store.key(prefix)))
        .map((name) => name.slice(start));
    } catch {
      return [];
    }
  },
  remove: (key: string) => {
    try {
      localStorage.removeItem(store.key(key));
    } catch {}
  },
};

let announced = '';
let announcing: ReturnType<typeof setTimeout> | undefined;
const announcers = new Set<() => void>();
const say = (text: string) => {
  announced = text;
  for (const listener of announcers) listener();
};
export const announcement = {
  get: (): string => announced,
  subscribe: (listener: () => void) => {
    announcers.add(listener);
    return () => void announcers.delete(listener);
  },
};
export const announce = (text: string) => {
  clearTimeout(announcing);
  if (announced !== text) {
    say(text);
    return;
  }
  say('');
  announcing = setTimeout(() => say(text), 100);
};

export const TYPES: Record<string, string> = { bug: 'bug', feature: 'spark', chore: 'wrench', hotfix: 'flame' };
