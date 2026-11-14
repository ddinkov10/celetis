import type { Host } from '../../lib/host-names.ts';
import type { QueueAction, QueueRecord, QueueView } from '../../lib/queue-types.ts';
import type { Step } from '../../lib/workflow.ts';
import type { Board } from '../types.ts';
import { knownAgent, stateLabel } from '../view.ts';
import { $, announce, el, iconButton, toast } from './ui.ts';

const recordedHost = (record: QueueRecord | null | undefined) =>
  record?.choice?.kind === 'explicit' ? record.choice.host : null;
const chosenHost = (record: QueueRecord | null | undefined) => (record?.choice ? recordedHost(record) : agent || null);

let board: Board | null = null;
let submitted: QueueView | null = null;
let agent = '';
let open = false;
let busy = false;
let uncertain = false;
const retired = new Set<string>();
let options: { back: () => void; refresh: () => Promise<void> };
const section = () => $('queue');
const cards = () => Object.values(board?.columns ?? {}).flat();
const available = () => cards().filter((card) => card.number !== null && !card.sessionId && card.run && card.step);
const find = (number: number) => cards().find((card) => card.number === number);
const heading = () => section().querySelector<HTMLElement>('.queue-status h3');
const expected = () => ({
  id: submitted?.record?.id ?? null,
  revision: submitted?.record?.revision ?? 0,
  current: submitted?.record?.numbers[0] ?? null,
});
const authoritative = () => Boolean(submitted && !uncertain && !board?.source.error);

function accept(view: QueueView): void {
  const old = submitted?.record;
  const next = view.record;
  if (next && (retired.has(next.id) || (old?.id === next.id && next.revision < old.revision))) return;
  if (!next && old) {
    submitted = {
      ...(submitted as QueueView),
      error: view.error ?? 'The queue record is unavailable. Refresh before acting.',
      actions: { add: false, edit: false, continue: false, retry: false },
    };
    return;
  }
  if (old && next && old.id !== next.id) retired.add(old.id);
  submitted = view;
}
const restore = (key: string | undefined) => {
  if (!key) return;
  const control = section().querySelector<HTMLElement>(
    `[data-control="${CSS.escape(key)}"]:not([aria-disabled="true"])`,
  );
  (
    control ??
    section().querySelector<HTMLElement>(
      '.queue-move button:not([aria-disabled="true"]), .queue-pick button:not([aria-disabled="true"])',
    ) ??
    heading()
  )?.focus({ preventScroll: true });
};
const button = (text: string, key: string, action: () => unknown, disabled = false) => {
  const node = el('button', 'btn ghost', text);
  node.type = 'button';
  node.dataset.control = key;
  node.setAttribute('aria-disabled', String(disabled));
  node.addEventListener('click', () => {
    if (node.getAttribute('aria-disabled') !== 'true') action();
  });
  return node;
};
const request = async (action: QueueAction) => {
  if (busy || !authoritative()) return;
  busy = true;
  announce('Saving the queue');
  draw();
  try {
    const response = await fetch('/api/queue', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        action,
        ...(action.kind === 'add' && chosenHost(submitted?.record) ? { agent: chosenHost(submitted?.record) } : {}),
      }),
      signal: AbortSignal.timeout(150_000),
    });
    if (!response.ok) throw new Error(((await response.json()) as { error: string }).error);
    accept((await response.json()) as QueueView);
    announce(action.kind === 'add' ? `#${action.number} is saved in the queue` : 'The queue is saved');
  } catch (error) {
    uncertain = true;
    toast('Queue action needs a refresh', {
      detail: error instanceof Error ? error.message : String(error),
      isError: true,
    });
    try {
      const response = await fetch('/api/queue', { signal: AbortSignal.timeout(30_000) });
      if (!response.ok) throw new Error('Queue state is unavailable');
      const view = (await response.json()) as QueueView;
      accept(view);
      uncertain = !view.actions.add && !view.actions.edit && !view.actions.continue && !view.actions.retry;
    } catch {
      uncertain = true;
    }
    announce('Check the saved queue before another attempt');
  } finally {
    busy = false;
    draw();
  }
};
const stateOf = () => {
  const record = submitted?.record;
  if (!record?.numbers.length) return 'empty';
  if (record.state === 'me-gate') return 'me-gate';
  if (record.state === 'error' || (submitted?.error && !submitted.owner)) return 'error';
  const observed = cards().some(
    (card) =>
      card.number === record.numbers[0] &&
      card.sessionId &&
      card.step === record.current?.step &&
      card.state !== null &&
      card.state !== 'starts',
  );
  return record.state === 'running' && observed ? 'running' : 'starting';
};
const row = (number: number, index: number, numbers: number[]) => {
  const node = el('li', `queue-row${index === 0 ? ' queue-current' : ''}`);
  node.dataset.number = String(number);
  const copy = el('div', 'queue-copy');
  const next = submitted?.next;
  const step = next?.kind === 'run' ? next.step : submitted?.record?.current?.step;
  copy.append(
    el('span', 'queue-number', `#${number}`),
    el('span', 'queue-title', find(number)?.title ?? `Issue #${number}`),
    el(
      'span',
      'queue-meta',
      index === 0
        ? `${stateOf() === 'me-gate' ? 'Waiting for approval' : stateOf() === 'error' ? 'Stopped' : stateOf() === 'running' ? 'Running' : 'Saved · starting'}${step ? ` · ${step}` : ''}`
        : 'Waiting',
    ),
  );
  node.append(el('span', 'queue-rank', String(index + 1)), copy);
  if (index > 0) {
    const controls = el('div', 'queue-move');
    for (const direction of ['up', 'down'] as const) {
      const control = iconButton('chevron', `Move #${number} ${direction}`, () =>
        request({ kind: 'move', number, direction, expected: expected() }),
      );
      control.classList.add(`queue-${direction}`);
      control.dataset.control = `${direction}-${number}`;
      control.setAttribute(
        'aria-disabled',
        String(
          busy ||
            !authoritative() ||
            !submitted?.actions.edit ||
            (direction === 'up' ? index === 1 : index === numbers.length - 1),
        ),
      );
      controls.append(control);
    }
    const remove = iconButton('close', `Remove #${number} from queue`, () =>
      request({ kind: 'remove', number, expected: expected() }),
    );
    remove.dataset.control = `remove-${number}`;
    remove.setAttribute('aria-disabled', String(busy || !authoritative() || !submitted?.actions.edit));
    controls.append(remove);
    node.append(controls);
  }
  return node;
};

const hostAvailable = (host: string | null) => {
  const next = host ?? (board?.next?.kind === 'start' ? board.next.host : null);
  return next === null || (!!board && knownAgent(board.registry, next) && board.agents?.[next]?.available === true);
};

function draw(): void {
  if (!board) return;
  const active = section().contains(document.activeElement)
    ? (document.activeElement as HTMLElement).dataset.control
    : undefined;
  const record = submitted?.record;
  const numbers = record?.numbers ?? [];
  const state = stateOf();
  section().dataset.state = state;
  section().setAttribute('aria-busy', String(busy));
  $('queue-open').textContent = `Queue${numbers.length ? ` ${numbers.length}` : ''}`;
  const head = el('header', 'queue-head');
  const title = el('div', 'queue-heading');
  title.append(el('h2', '', 'Issue queue'), el('span', 'queue-count', `${numbers.length} remaining`));
  head.append(title, button('Back to board', 'back', options.back));
  const status = el('div', 'queue-status');
  const headingNode = el(
    'h3',
    '',
    busy
      ? 'Saving the queue'
      : state === 'empty'
        ? 'Ready for work'
        : state === 'starting'
          ? `Starting #${numbers[0]}`
          : state === 'running'
            ? `Running #${numbers[0]}`
            : state === 'me-gate'
              ? 'Your approval is needed'
              : 'The queue stopped',
  );
  headingNode.tabIndex = -1;
  headingNode.dataset.control = 'heading';
  status.append(
    headingNode,
    el(
      'p',
      '',
      state === 'starting'
        ? 'Your issue is saved. Waiting for a verified session.'
        : state === 'me-gate'
          ? 'Continue starts the displayed step. Later issues stay queued.'
          : 'Add issues at any time. Finished issues leave automatically.',
    ),
  );
  const warning = !authoritative()
    ? 'The queue state is unavailable. Refresh before acting.'
    : (submitted?.error ?? board.noRun);
  if (warning) {
    const node = el('p', 'queue-warning', warning);
    node.setAttribute('role', 'alert');
    status.append(node);
  }
  if (record?.act) status.append(el('p', 'queue-recovery', record.act));
  const current = el('section', 'queue-current-section');
  current.append(el('h4', '', 'Current issue'));
  if (numbers[0]) {
    const list = el('ol', 'queue-list');
    list.append(row(numbers[0], 0, numbers));
    current.append(list);
  } else current.append(el('p', 'queue-empty', 'No issue is running.'));
  status.append(current);
  const actions = el('div', 'queue-actions');
  const label = el('div', 'queue-agent');
  const group = el('div', 'queue-segments');
  group.setAttribute('role', 'group');
  group.setAttribute('aria-label', 'Queue agent');
  const chosen = chosenHost(record) ?? '';
  const choices: [string, string, boolean][] = [['', 'Default order', true]];
  for (const host of Object.keys(board.registry) as Host[])
    choices.push([host, board.registry[host].short, board.agents?.[host]?.available === true]);
  for (const [value, text, usable] of choices) {
    const segment = el('button', '', text);
    segment.type = 'button';
    segment.dataset.control = `agent-${value || 'default'}`;
    segment.setAttribute('aria-pressed', String(chosen === value));
    segment.setAttribute('aria-disabled', String(!usable || numbers.length > 0 || busy || !authoritative()));
    segment.addEventListener('click', () => {
      if (segment.getAttribute('aria-disabled') === 'true') return;
      agent = value;
      draw();
    });
    group.append(segment);
  }
  label.append(el('span', '', 'Agent'), group);
  actions.append(label);
  const next = submitted?.next;
  if (submitted?.actions.continue && next?.kind === 'run')
    actions.append(
      button(
        'Continue queue',
        'continue',
        () => request({ kind: 'continue', step: next.step, expected: expected() }),
        busy || !authoritative(),
      ),
    );
  else if (submitted?.actions.retry)
    actions.append(
      button(
        'Try again',
        'retry',
        () => request({ kind: 'retry', step: next?.kind === 'run' ? next.step : null, expected: expected() }),
        busy || !authoritative(),
      ),
    );
  if (uncertain) actions.append(button('Refresh queue', 'refresh', () => options.refresh(), busy));
  const content = el('div', 'queue-content');
  const waiting = el('section', 'queue-order');
  waiting.append(el('h3', '', 'Up next'));
  const list = el('ol', 'queue-list');
  list.setAttribute('aria-label', 'Waiting issues');
  list.start = 2;
  list.append(...numbers.slice(1).map((number, index) => row(number, index + 1, numbers)));
  waiting.append(numbers.length > 1 ? list : el('p', 'queue-empty', 'No issue waits.'));
  const picker = el('section', 'queue-picker');
  picker.append(
    el('h3', '', 'Add from the board'),
    el('p', '', 'Add puts the issue at the end of the queue, and starts the queue when it is empty.'),
  );
  for (const card of available()) {
    const number = card.number as number;
    const item = el('div', 'queue-pick');
    const copy = el('div');
    copy.append(
      el('span', 'queue-number', `#${number}`),
      el('span', 'queue-title', card.title),
      el('span', 'queue-step', `next ${card.step} · ${card.state ? stateLabel(card) : 'ready'}`),
    );
    const selected = numbers.includes(number);
    const add = button(
      selected ? 'In queue' : 'Add',
      `add-${number}`,
      () => request({ kind: 'add', number, step: card.step as Step, expected: expected() }),
      selected ||
        busy ||
        !authoritative() ||
        !submitted?.actions.add ||
        !hostAvailable(chosenHost(record)) ||
        Boolean(board.noRun),
    );
    add.setAttribute('aria-label', `Add #${number} to queue`);
    item.append(copy, add);
    picker.append(item);
  }
  if (!available().length) picker.append(el('p', '', 'No runnable issues are available.'));
  content.append(waiting, picker);
  section().replaceChildren(head, status, actions, content);
  if (open) restore(active);
}

export function setupQueue(next: { back: () => void; refresh: () => Promise<void> }): void {
  options = next;
}
export function setQueueOpen(value: boolean): void {
  open = value;
  section().hidden = !open;
  document.body.classList.toggle('queue-view-open', open);
  $('queue-open').setAttribute('aria-pressed', String(open));
  for (const button of document.querySelectorAll<HTMLElement>('.views button'))
    button.setAttribute('aria-pressed', String(!open && button.dataset.view === $('columns').dataset.view));
  if (open) {
    draw();
    heading()?.focus();
  }
}
export function drawQueue(next: Board): void {
  board = next;
  const before = submitted?.record?.numbers.length;
  if (board.queue) {
    accept(board.queue);
    if (!board.source.error && Object.values(board.queue.actions).some(Boolean)) uncertain = false;
  }
  draw();
  if (before !== undefined && submitted?.record && before > submitted.record.numbers.length)
    announce(`${submitted.record.numbers.length} issues remain in the queue`);
}
