import type { CoordinatorKey, CoordinatorState } from '../../lib/coordinator-types.ts';
import type { ChatBlock, ChatCall, ChatEntry, ChatInline, ChatText } from '../types.ts';
import { clock } from '../view.ts';
import { el, icon, link } from './ui.ts';

type Shown = CoordinatorState | 'ended';
type Dialog = { lines: string[]; keys: CoordinatorKey[] };
type Answer = { after: string | null; key: CoordinatorKey | null };
type Item = { id: string; json: string; build(): HTMLElement };

export const KEYS: Record<CoordinatorKey, { cap: string; name: string }> = {
  up: { cap: '↑', name: 'Up' },
  down: { cap: '↓', name: 'Down' },
  enter: { cap: 'Enter', name: 'Enter' },
  esc: { cap: 'Esc', name: 'Esc' },
  '1': { cap: '1', name: '1' },
  '2': { cap: '2', name: '2' },
  '3': { cap: '3', name: '3' },
};
const VERBS: Record<ChatCall['state'], string> = { runs: 'Running', done: 'Used', failed: 'Failed', waits: 'Waiting' };
const MARKS: Record<ChatCall['state'], string> = { runs: 'works', done: 'check', failed: 'xcircle', waits: 'target' };
const HEADINGS = ['h3', 'h4', 'h5', 'h6'] as const;

const put = <T extends HTMLElement>(node: T, children: (Node | string)[]) => {
  node.append(...children);
  return node;
};

const inline = (parts: readonly ChatInline[]): (Node | string)[] =>
  parts.map((part) => {
    if (typeof part === 'string') return part;
    if (part.k === 'link') return put(link('co-link', '', part.href), inline(part.c));
    return put(el(part.k), inline(part.c));
  });

const block = (part: ChatBlock): HTMLElement => {
  switch (part.k) {
    case 'p':
      return put(el('p'), inline(part.c));
    case 'h':
      return put(el(HEADINGS[part.level - 1] ?? 'h6', 'co-h'), inline(part.c));
    case 'code':
      return el('pre', 'co-pre', part.text);
    case 'list': {
      const list = part.ordered ? el('ol', 'co-list') : el('ul', 'co-list');
      if (list instanceof HTMLOListElement && part.start !== null) list.start = part.start;
      return put(
        list,
        part.items.map((item) => put(el('li'), item.map(block))),
      );
    }
    case 'quote':
      return put(el('blockquote', 'co-quote'), part.c.map(block));
    case 'rule':
      return el('hr', 'co-rule');
  }
};

const textOf = (value: ChatText): HTMLElement[] => [
  el('pre', 'co-pre', value.text),
  ...(value.cut > 0 ? [el('p', 'co-cut', `(${value.cut} characters left out)`)] : []),
];

const seconds = (calls: readonly ChatCall[]) => {
  const starts = calls.map((call) => Date.parse(call.startedAt ?? ''));
  const ends = calls.map((call) => Date.parse(call.endedAt ?? ''));
  if ([...starts, ...ends].some(Number.isNaN)) return null;
  return Math.round((Math.max(...ends) - Math.min(...starts)) / 1000);
};

const steps = (count: number) => `${count} step${count === 1 ? '' : 's'}`;

export function createChat(log: HTMLElement, pressKey: (key: CoordinatorKey) => Promise<boolean>) {
  const list = el('ol', 'co-thread');
  log.replaceChildren(list);
  const open = new Map<string, boolean>();
  let nodes = new Map<string, { json: string; node: HTMLElement }>();
  let answers: Answer[] = [];
  let asking: Answer | null = null;
  let last: { entries: readonly ChatEntry[]; dialog: Dialog | null; state: Shown } | null = null;
  let drawnEntries: readonly ChatEntry[] | null = null;
  let drawnKey = '';

  const disclose = (row: string, initial: boolean, head: HTMLButtonElement, body: HTMLElement) => {
    const show = (value: boolean) => {
      head.setAttribute('aria-expanded', String(value));
      body.hidden = !value;
    };
    show(open.get(row) ?? initial);
    head.addEventListener('click', () => {
      const value = head.getAttribute('aria-expanded') !== 'true';
      open.set(row, value);
      show(value);
    });
  };

  const trigger = (row: string, mark: string, words: (Node | string)[]) => {
    const head = put(el('button', 'co-trigger'), [icon(mark), ...words, icon('chevron')]);
    head.type = 'button';
    head.dataset.row = row;
    return head;
  };

  const callRow = (call: ChatCall) => {
    const item = el('li', 'co-call');
    item.dataset.state = call.state;
    const head = trigger(`c:${call.id}`, MARKS[call.state], [
      el('span', 'co-verb', VERBS[call.state]),
      ' ',
      el('span', 'co-tool', call.tool),
      ' ',
      el('span', 'co-sum', call.summary),
    ]);
    const body = put(el('div', 'co-detail'), [
      ...textOf(call.input),
      ...(call.result
        ? [el('p', 'co-label', call.state === 'failed' ? 'Error:' : 'Result:'), ...textOf(call.result)]
        : []),
    ]);
    disclose(`c:${call.id}`, false, head, body);
    return put(item, [head, body]);
  };

  const stepsRow = (entry: Extract<ChatEntry, { kind: 'steps' }>) => {
    const live = entry.calls.some((call) => call.state === 'runs' || call.state === 'waits');
    const failed = entry.calls.filter((call) => call.state === 'failed').length;
    const time = live ? null : seconds(entry.calls);
    const words = live
      ? `Running ${steps(entry.calls.length)}`
      : `Ran ${steps(entry.calls.length)}${failed ? `, ${failed} failed` : ''}${time === null ? '' : ` · ${time}s`}`;
    const item = el('li', 'co-run');
    item.dataset.state = live ? 'runs' : failed ? 'failed' : 'done';
    const head = trigger(`s:${entry.id}`, live ? 'works' : failed ? 'alert' : 'check', [el('span', 'co-verb', words)]);
    const calls = put(el('ol', 'co-calls'), entry.calls.map(callRow));
    disclose(`s:${entry.id}`, live, head, calls);
    return put(item, [head, calls]);
  };

  const entryNode = (entry: ChatEntry): HTMLElement => {
    switch (entry.kind) {
      case 'you': {
        const bubble = el('p', 'co-bubble', entry.text);
        if (entry.at) bubble.title = clock(entry.at, true);
        return put(el('li', 'co-you'), [bubble]);
      }
      case 'agent':
        return put(el('li', 'co-agent'), entry.blocks.map(block));
      case 'note':
        return el('li', 'co-note', `${entry.text.replace(/\.$/, '')}${entry.at ? ` · ${clock(entry.at)}` : ''}`);
      case 'steps':
        return stepsRow(entry);
    }
  };

  const press = (key: CoordinatorKey) => {
    const record = asking;
    void pressKey(key).then((sent) => {
      if (!sent || !record) return;
      record.key = key;
      if (last) draw(last.entries, last.dialog, last.state);
    });
  };

  const card = (call: ChatCall | undefined, dialog: Dialog) => {
    const name = el('span', 'co-ask-name', call ? `Waiting on you: ${call.tool}` : 'Waiting on you');
    name.id = 'coordinator-ask-name';
    const group = el('div', 'co-ask-group');
    group.setAttribute('role', 'group');
    group.setAttribute('aria-labelledby', name.id);
    group.append(
      put(el('p', 'co-ask-head'), [icon('target'), name, ...(call ? [' ', el('span', 'co-sum', call.summary)] : [])]),
    );
    if (dialog.lines.length) group.append(el('pre', 'co-lines', dialog.lines.join('\n')));
    if (dialog.keys.length)
      group.append(
        put(
          el('div', 'co-ask-keys'),
          dialog.keys.map((key) => {
            const button = el('button', 'co-key');
            button.type = 'button';
            button.dataset.key = key;
            const cap = el('kbd', '', KEYS[key].cap);
            if (KEYS[key].cap !== KEYS[key].name) {
              button.setAttribute('aria-label', KEYS[key].name);
              cap.setAttribute('aria-hidden', 'true');
            }
            button.append(cap);
            button.addEventListener('click', () => press(key));
            return button;
          }),
        ),
      );
    return put(el('li', 'co-ask'), [group]);
  };

  const answerItems = (after: string | null): Item[] =>
    answers.flatMap((answer, index) => {
      if (answer.after !== after) return [];
      const words = answer.key ? `Answered with ${KEYS[answer.key].name}` : 'The dialog closed';
      return [
        {
          id: `a:${index}`,
          json: words,
          build: () => put(el('li', 'co-answered'), [icon(answer.key ? 'check' : 'target'), el('span', '', words)]),
        },
      ];
    });

  function draw(entries: readonly ChatEntry[], dialog: Dialog | null, state: Shown): boolean {
    last = { entries, dialog, state };
    if (state === 'dialog') {
      asking ??= { after: null, key: null };
      asking.after = entries.at(-1)?.id ?? null;
    } else if (asking) {
      answers.push(asking);
      asking = null;
    }
    const key = JSON.stringify([state, dialog, answers, asking]);
    if (entries === drawnEntries && key === drawnKey) return false;
    drawnEntries = entries;
    drawnKey = key;

    const items: Item[] = answerItems(null);
    for (const entry of entries)
      items.push(
        { id: `e:${entry.id}`, json: JSON.stringify(entry), build: () => entryNode(entry) },
        ...answerItems(entry.id),
      );
    if (dialog) {
      const call = entries
        .flatMap((entry) => (entry.kind === 'steps' ? entry.calls : []))
        .filter((item) => item.state === 'waits')
        .at(-1);
      items.push({
        id: 'ask',
        json: JSON.stringify([call?.tool, call?.summary, dialog]),
        build: () => card(call, dialog),
      });
    }
    if (state === 'works')
      items.push({
        id: 'works',
        json: '',
        build: () => put(el('li', 'co-working'), [icon('works'), el('span', '', 'The coordinator works')]),
      });
    if (entries.length === 0 && state !== 'works' && state !== 'dialog') {
      const absent = state === 'none' || state === 'ended';
      const title = absent ? 'No coordinator session' : 'The session starts';
      items.push({
        id: 'empty',
        json: title,
        build: () =>
          put(el('li', 'co-empty'), [
            el('p', 'co-empty-title', title),
            el(
              'p',
              'co-empty-text',
              absent
                ? 'Start a session to steer the runs from here.'
                : 'The conversation shows here when the session writes its first message.',
            ),
          ]),
      });
    }

    const active = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focus = active && list.contains(active) ? (active.dataset.row ?? active.dataset.key) : undefined;
    const next = new Map<string, { json: string; node: HTMLElement }>();
    for (const item of items) {
      const kept = nodes.get(item.id);
      next.set(item.id, { json: item.json, node: kept?.json === item.json ? kept.node : item.build() });
    }
    for (const [id, { node }] of nodes) if (next.get(id)?.node !== node) node.remove();
    [...next.values()].forEach(({ node }, index) => {
      if (list.children[index] !== node) list.insertBefore(node, list.children[index] ?? null);
    });
    nodes = next;
    if (focus && !active?.isConnected)
      list
        .querySelector<HTMLElement>(`[data-row="${CSS.escape(focus)}"], [data-key="${CSS.escape(focus)}"]`)
        ?.focus({ preventScroll: true });
    return true;
  }

  return {
    draw,
    reset() {
      open.clear();
      answers = [];
      asking = null;
      last = null;
      drawnEntries = null;
    },
  };
}
