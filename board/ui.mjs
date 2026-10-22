import { AGENTS, age, agentOf } from './view.mjs';

const NS = 'http://www.w3.org/2000/svg';
const ring = (extra) => ['circle', { cx: 8, cy: 8, r: 6, ...extra }];
const ICONS = {
  logo: [
    ['rect', { x: 1.5, y: 1.5, width: 5.5, height: 13, rx: 1.75, class: 'fill' }],
    ['rect', { x: 9, y: 1.5, width: 5.5, height: 8, rx: 1.75, class: 'fill' }],
  ],
  'col-needs': [ring(), ['circle', { cx: 8, cy: 8, r: 2.6, class: 'fill core' }]],
  'col-running': [ring({ class: 'track' }), ['path', { d: 'M8 4.6a3.4 3.4 0 0 1 0 6.8Z', class: 'fill' }]],
  'col-idle': [ring({ 'stroke-dasharray': '2.6 2.2' })],
  nolane: [['circle', { cx: 8, cy: 8, r: 5.5, 'stroke-dasharray': '2.3 2' }]],
  'col-done': [
    ['circle', { cx: 8, cy: 8, r: 7, class: 'fill' }],
    ['path', { d: 'm5.1 8.2 2 2 3.8-4.1', class: 'knock' }],
  ],
  clear: [ring(), ['path', { d: 'm5.4 8.1 1.8 1.8 3.5-3.7' }]],
  bug: [
    [
      'path',
      {
        d: 'M5.5 5.5h5a1 1 0 0 1 1 1V9a3.5 3.5 0 0 1-7 0V6.5a1 1 0 0 1 1-1ZM6 5.5a2 2 0 0 1 4 0M8 8v4.25M2.75 8.5H4.5M11.5 8.5h1.75M3.5 5.5l1.25.9M12.5 5.5l-1.25.9M3.5 12.5l1.4-1M12.5 12.5l-1.4-1',
      },
    ],
  ],
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
  stages: [
    ['path', { d: 'M1.75 8h2.5M6.75 8h2.5M11.75 8h2.5' }],
    ['circle', { cx: 5.5, cy: 8, r: 1.25 }],
    ['circle', { cx: 10.5, cy: 8, r: 1.25 }],
  ],
  panel: [
    ['rect', { x: 1.75, y: 2.5, width: 12.5, height: 11, rx: 2 }],
    ['path', { d: 'M9.5 2.5v11' }],
  ],
};

export const $ = (id) => document.getElementById(id);

export const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

export const icon = (name) => {
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 16 16');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('class', `icon i-${name}`);
  for (const [tag, attributes] of ICONS[name]) {
    const part = document.createElementNS(NS, tag);
    for (const [key, value] of Object.entries(attributes)) part.setAttribute(key, value);
    svg.append(part);
  }
  return svg;
};

export const link = (className, text, url) =>
  url
    ? Object.assign(el('a', className, text), { href: url, target: '_blank', rel: 'noreferrer' })
    : el('span', className, text);

export const timed = (iso, isFine = false, suffix = '') => {
  const node = el('time', 'time', `${age(iso, Date.now(), isFine)}${suffix}`);
  node.dateTime = iso;
  node.dataset.since = iso;
  node.dataset.suffix = suffix;
  node.title = new Date(iso).toLocaleString();
  if (isFine) node.dataset.fine = '';
  return node;
};

const withCode = (text) => {
  const node = el('span', 'toast-detail');
  text.split('`').forEach((part, index) => {
    if (part) node.append(index % 2 ? el('code', '', part) : part);
  });
  return node;
};

let toastTimer;
export const toast = (title, { detail = '', isError = false } = {}) => {
  $('toast').dataset.tone = isError ? 'error' : 'ok';
  $('toast-icon').replaceChildren(icon(isError ? 'alert' : 'check'));
  $('toast-text').replaceChildren(el('strong', 'toast-title', title));
  if (detail) $('toast-text').append(withCode(detail));
  $('toast').hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    $('toast').hidden = true;
  }, 6000);
};

export const SERVER_DOWN = 'The board server does not answer';
const RESTART = 'Start the board again in a terminal.';

export const post = async (path, value, failure) => {
  try {
    const response = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(value),
    });
    if (!response.ok) toast(failure, { detail: (await response.json()).error, isError: true });
    return response.ok;
  } catch {
    toast(SERVER_DOWN, { detail: RESTART, isError: true });
    return false;
  }
};

export const copy = async (text, what) => {
  try {
    await navigator.clipboard.writeText(text);
    toast(`Copied the ${what}`);
  } catch {
    toast('Copy failed', { detail: 'The browser did not allow access to the clipboard.', isError: true });
  }
};

export const pressable = (node, press, busy) => {
  node.addEventListener('click', async (event) => {
    event.stopPropagation();
    if (node.getAttribute('aria-busy') === 'true') return;
    const label = node.querySelector('.label');
    const text = label?.textContent;
    node.setAttribute('aria-busy', 'true');
    if (label && busy) label.textContent = busy;
    await press();
    node.removeAttribute('aria-busy');
    if (label && busy) label.textContent = text;
  });
  return node;
};

export const actionButton = (action, isQuiet) => {
  const kind = `btn ${isQuiet || action.isGhost ? 'ghost' : 'primary'}${action.isMain ? ' main-action' : ''}`;
  const node = action.href
    ? Object.assign(el('a', kind), { href: action.href, target: '_blank', rel: 'noreferrer' })
    : el('button', kind);
  if (!action.href) node.type = 'button';
  node.append(icon(action.icon), el('span', 'label', action.label));
  node.title = action.title;
  node.setAttribute('aria-label', action.name);
  if (action.isDisabled) node.setAttribute('aria-disabled', 'true');
  if (action.href) node.addEventListener('click', (event) => event.stopPropagation());
  else pressable(node, action.run, action.busy);
  return node;
};

export const iconButton = (name, label, press, className = '') => {
  const node = el('button', `icon-btn ${className}`.trim());
  node.type = 'button';
  node.setAttribute('aria-label', label);
  node.title = label;
  node.append(icon(name));
  node.addEventListener('click', (event) => {
    event.stopPropagation();
    press(event);
  });
  return node;
};

export const store = {
  get: (key) => {
    try {
      return localStorage.getItem(`agent-board:${key}`);
    } catch {
      return null;
    }
  },
  set: (key, value) => {
    try {
      localStorage.setItem(`agent-board:${key}`, value);
    } catch {}
  },
};

const TYPES = { bug: 'bug', feature: 'spark', chore: 'wrench', hotfix: 'flame' };

export const mark = (card) => {
  const agent = agentOf(card);
  if (agent) {
    const node = el(
      'span',
      `mark agent agent-${Object.hasOwn(AGENTS, card.agent) ? card.agent : 'other'}`,
      agent.letter,
    );
    node.title = agent.name;
    return node;
  }
  const node = el('span', `mark type-${card.type ?? 'none'}`);
  node.append(icon(Object.hasOwn(TYPES, card.type) ? TYPES[card.type] : card.number === null ? 'terminal' : 'nolane'));
  if (!card.type && card.number !== null) node.title = 'No lane yet';
  return node;
};
