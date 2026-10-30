import type { QueueAction, QueueView } from '../lib/queue-types.ts';
import type { Step } from '../lib/workflow.ts';
import type { Board, Card } from './types.ts';
import { $, el, icon, iconButton, post } from './ui.ts';

let board: Board | null = null;
let submitted: QueueView | null = null;
let draft: number[] = [];
let agent = '';
let open = false;
let busy = false;
let awaitingRecord = false;
let options: { back: () => void; refresh: () => Promise<void> };

const section = () => $('queue');
const cards = () => Object.values(board?.columns ?? {}).flat();
const available = () => cards().filter((card) => card.number !== null && !card.sessionId && card.run && card.step);
const find = (number: number) => cards().find((card) => card.number === number);
const announce = (message: string) => {
  $('announce').textContent = message;
};
const heading = () => section().querySelector<HTMLElement>('.queue-status h3');
const control = (key: string) =>
  section().querySelector<HTMLElement>(`[data-control="${CSS.escape(key)}"]:not(:disabled)`);
const focusAvailable = () =>
  (section().querySelector<HTMLElement>('.queue-pick button:not(:disabled)') ?? heading())?.focus();
const authoritative = () => Boolean(board?.queue && !board.source.error);
const stateOf = () => {
  const record = submitted?.record;
  return (record?.state === 'running' || record?.state === 'me-gate') && submitted?.error && !submitted.owner
    ? 'error'
    : (record?.state ?? (draft.length ? 'ordered' : 'empty'));
};

const button = (text: string, key: string, run: () => unknown, disabled = false, quiet = false) => {
  const node = el('button', `btn${quiet ? ' ghost' : ''}`, text);
  node.type = 'button';
  node.dataset.control = key;
  node.disabled = disabled;
  node.addEventListener('click', () => {
    if (!node.disabled) run();
  });
  return node;
};

const restore = (key: string | undefined) => {
  if (!key) return;
  const number = key.split('-').at(-1);
  const row = section().querySelector<HTMLElement>(`.queue-row[data-number="${number}"] button:not(:disabled)`);
  (
    control(key) ??
    row ??
    section().querySelector<HTMLElement>('.queue-pick button:not(:disabled)') ??
    heading()
  )?.focus({ preventScroll: true });
};

const edit = (run: () => string, nextFocus?: () => void) => {
  if (busy || submitted?.record || awaitingRecord) return;
  const message = run();
  draw();
  nextFocus?.();
  announce(message);
};

const add = (card: Card) =>
  edit(() => {
    if (!available().some((item) => item.number === card.number) || draft.includes(card.number as number)) return '';
    draft.push(card.number as number);
    return `#${card.number} added at position ${draft.length}`;
  }, focusAvailable);

const move = (number: number, direction: number) =>
  edit(
    () => {
      const index = draft.indexOf(number);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= draft.length) return '';
      [draft[index], draft[target]] = [draft[target] as number, number];
      return `#${number} moved to position ${target + 1}`;
    },
    () => restore(`${direction < 0 ? 'up' : 'down'}-${number}`),
  );

const remove = (number: number) => {
  const index = draft.indexOf(number);
  edit(
    () => {
      draft = draft.filter((item) => item !== number);
      return `#${number} removed from the queue`;
    },
    () => (draft.length ? restore(`remove-${draft[Math.min(index, draft.length - 1)]}`) : focusAvailable()),
  );
};

const request = async (action: QueueAction) => {
  if (busy || !authoritative()) return;
  busy = true;
  draw();
  const ok = await post('/api/queue', { action, ...(action.kind === 'start' ? { agent } : {}) }, 'Queue action failed');
  if (ok && action.kind === 'reset') draft = [];
  if (ok && action.kind === 'start') awaitingRecord = true;
  await options.refresh();
  busy = false;
  const hadFocus = section().contains(document.activeElement);
  draw();
  if (hadFocus && open) {
    if (ok && action.kind === 'reset' && !submitted?.record) focusAvailable();
    else (section().querySelector<HTMLElement>('.queue-actions button:not(:disabled)') ?? heading())?.focus();
  }
  if (ok)
    announce(
      action.kind === 'reset'
        ? 'The queue was reset'
        : `${heading()?.textContent}. The board shows the latest runner state.`,
    );
};

const row = (number: number, index: number, numbers: number[]) => {
  const record = submitted?.record;
  const card = find(number);
  const done = Boolean(record && index < record.position);
  const current = Boolean(record && index === record.position);
  const node = el('li', `queue-row${current ? ' queue-current' : ''}${done ? ' queue-done' : ''}`);
  node.dataset.number = String(number);
  node.dataset.step = card?.step ?? '';
  const rank = el('span', 'queue-rank', String(index + 1));
  rank.setAttribute('aria-label', `Position ${index + 1}`);
  if (done) rank.replaceChildren(icon('check'));
  const text = el('div', 'queue-copy');
  const outcome = record?.results[index];
  const state = stateOf();
  const step =
    state === 'running' ? record?.current?.step : submitted?.next?.kind === 'run' ? submitted.next.step : null;
  const closed = submitted?.next?.kind === 'stop' && ['finished', 'wontfix'].includes(submitted.next.reason);
  const meta = done
    ? outcome === 'wontfix'
      ? 'Closed: wontfix'
      : outcome === 'already-closed'
        ? 'Already closed'
        : 'Finished'
    : current
      ? closed
        ? 'Closed; try again to update the queue'
        : state === 'me-gate'
          ? `Waiting for you · ${step ?? 'read the current step'}`
          : state === 'error'
            ? `Stopped${step ? ` · ${step}` : ''}`
            : `Running${step ? ` · ${step}` : ''}`
      : record
        ? 'Waiting'
        : card?.run
          ? `Next: ${card.step}`
          : 'No longer runnable; remove this issue';
  text.append(
    el('span', 'queue-number', `#${number}`),
    el('span', 'queue-title', card?.title ?? `#${number}`),
    el('span', 'queue-meta', meta),
  );
  node.append(rank, text);
  if (!record) {
    const controls = el('div', 'queue-move');
    for (const direction of [-1, 1]) {
      const name = direction < 0 ? 'up' : 'down';
      const item = iconButton('chevron', `Move #${number} ${name}`, () => move(number, direction));
      item.classList.add(`queue-${name}`);
      item.dataset.control = `${name}-${number}`;
      item.disabled = busy || awaitingRecord || (direction < 0 ? index === 0 : index === numbers.length - 1);
      controls.append(item);
    }
    const item = iconButton('close', `Remove #${number} from queue`, () => remove(number));
    item.dataset.control = `remove-${number}`;
    item.disabled = busy || awaitingRecord;
    controls.append(item);
    node.append(controls);
  }
  return node;
};

function draw() {
  if (!board) return;
  const active = document.activeElement as HTMLElement | null;
  const focus = section().contains(active) ? active?.dataset.control : undefined;
  const record = submitted?.record;
  const numbers = record?.numbers ?? draft;
  const state = stateOf();
  section().dataset.state = state;
  section().dataset.revision = String(record?.revision ?? '');
  section().setAttribute('aria-busy', String(busy));
  $('queue-open').textContent = `Queue${numbers.length ? ` ${numbers.length}` : ''}`;
  const head = el('header', 'queue-head');
  const name = el('div', 'queue-heading');
  name.append(
    el('h2', '', 'Issue queue'),
    el('span', 'queue-count', `${numbers.length} ${record ? 'submitted' : 'selected'}`),
  );
  head.append(name, button('Back to board', 'back', options.back, false, true));
  const status = el('div', 'queue-status');
  const title =
    state === 'empty'
      ? 'Choose what runs next'
      : state === 'ordered'
        ? 'Run from top to bottom'
        : state === 'running'
          ? `Running #${record?.numbers[record.position]}`
          : state === 'me-gate'
            ? 'Stopped at a me gate'
            : state === 'error'
              ? 'The queue could not continue'
              : 'Queue complete';
  const detail =
    state === 'empty'
      ? 'Add issues from the board. Your selection runs in order.'
      : state === 'ordered'
        ? 'Reorder the issues before you start. A me gate stops the whole queue.'
        : state === 'running'
          ? 'One issue runs at a time. The remaining issues wait.'
          : state === 'me-gate'
            ? `The ${submitted?.next?.kind === 'run' ? submitted.next.step : 'waiting'} step needs your press. Later issues stay queued.`
            : state === 'error'
              ? (submitted?.error ?? record?.reason)
              : 'All selected issues are complete. You can prepare another queue.';
  const titleNode = el('h3', '', awaitingRecord && !record ? 'Queue request sent' : title);
  titleNode.tabIndex = -1;
  titleNode.dataset.control = 'heading';
  status.append(
    titleNode,
    el(
      'p',
      '',
      awaitingRecord && !record
        ? 'No submitted queue is visible yet. Your selection is kept. Refresh to check again, or use Edit selection to recover it.'
        : detail,
    ),
  );
  if (record?.reason && state !== 'error') status.append(el('p', '', record.reason));
  if (record?.act && (!submitted?.error || submitted.error === record.reason))
    status.append(el('p', 'queue-recovery', record.act));
  if (submitted?.owner) status.append(el('p', 'queue-owner', `Owner: ${submitted.owner}`));
  const unavailable = !authoritative()
    ? 'The queue state is unavailable. Refresh before you act.'
    : (board.noRun ?? (!record ? submitted?.error : null));
  if (unavailable) {
    const warning = el('p', 'queue-warning', unavailable);
    warning.setAttribute('role', 'alert');
    status.append(warning);
  }
  if (record && submitted?.error && submitted.error !== unavailable) {
    const error = el('p', 'queue-warning', submitted.error);
    error.setAttribute('role', 'alert');
    status.append(error);
  }
  const actions = el('div', 'queue-actions');
  const choice = el('label', 'queue-agent', 'Agent ');
  const agents = el('select');
  agents.dataset.control = 'agent';
  agents.setAttribute('aria-label', 'Queue agent');
  for (const id of ['claude', 'codex']) {
    const option = new Option(id === 'claude' ? 'Claude' : 'Codex', id);
    option.disabled = board.agents?.[id]?.available !== true;
    option.title = board.agents?.[id]?.cause ?? '';
    agents.add(option);
  }
  agents.value = record?.host ?? agent;
  agents.disabled = Boolean(record) || busy || awaitingRecord;
  agents.addEventListener('change', () => {
    agent = agents.value;
    draw();
  });
  choice.append(agents);
  actions.append(choice);
  const disabled = busy || Boolean(unavailable);
  const next = submitted?.next;
  if (!record) {
    const first = find(draft[0] as number);
    const eligible = new Set(available().map((card) => card.number));
    const reason = board.agents?.[agent]?.available
      ? null
      : (board.agents?.[agent]?.cause ?? 'The selected agent is unavailable');
    const start = button(
      busy ? 'Sending' : 'Start queue',
      'start',
      () => request({ kind: 'start', numbers: [...draft], step: first?.step as Step }),
      disabled ||
        awaitingRecord ||
        !draft.length ||
        !first?.step ||
        draft.some((number) => !eligible.has(number)) ||
        Boolean(reason),
    );
    if (reason) {
      start.title = reason;
      status.append(el('p', 'queue-warning', reason));
    }
    actions.append(start);
    if (awaitingRecord)
      actions.append(
        button(
          'Edit selection',
          'edit',
          () => {
            awaitingRecord = false;
            draw();
            focusAvailable();
            announce('Your selection is ready to edit. Start queue requires another press.');
          },
          disabled || Boolean(submitted?.owner),
          true,
        ),
      );
  } else {
    const label = submitted?.actions.retry
      ? 'Try again'
      : state === 'me-gate'
        ? 'Continue queue'
        : state === 'error'
          ? 'Try again'
          : state === 'complete'
            ? null
            : 'Running';
    if (label) {
      const kind = submitted?.actions.retry ? 'retry' : state === 'me-gate' ? 'continue' : 'retry';
      const allowed =
        kind === 'continue' ? submitted?.actions.continue && next?.kind === 'run' : submitted?.actions.retry;
      actions.append(
        button(
          busy ? 'Sending' : label,
          'start',
          () =>
            request(
              kind === 'continue'
                ? { kind, id: record.id, revision: record.revision, step: (next as { step: Step }).step }
                : { kind, id: record.id, revision: record.revision, step: next?.kind === 'run' ? next.step : null },
            ),
          disabled || !allowed,
        ),
      );
    }
    if (submitted?.actions.reset)
      actions.append(
        button(
          'New queue',
          'reset',
          () => request({ kind: 'reset', id: record.id, revision: record.revision }),
          disabled,
          true,
        ),
      );
  }
  const content = el('div', 'queue-content');
  const picker = el('section', 'queue-picker');
  picker.append(
    el('h3', '', 'Add from the board'),
    el('p', '', record ? 'The submitted order and agent are fixed.' : 'Choose the issues for this run.'),
  );
  for (const card of available()) {
    const item = el('div', 'queue-pick');
    const text = el('div');
    text.append(el('span', 'queue-number', `#${card.number}`), el('span', 'queue-title', card.title));
    const selected = numbers.includes(card.number as number);
    const addButton = button(
      selected ? 'Added' : 'Add',
      `add-${card.number}`,
      () => add(card),
      selected || Boolean(record) || busy || awaitingRecord,
      true,
    );
    addButton.setAttribute('aria-label', `Add #${card.number} to queue`);
    item.append(text, addButton);
    picker.append(item);
  }
  if (!available().length) picker.append(el('p', '', 'No runnable issues are available.'));
  const order = el('div', 'queue-order');
  const list = el('ol', 'queue-list');
  list.setAttribute('aria-label', 'Run order');
  list.append(...numbers.map((number, index) => row(number, index, numbers)));
  order.append(numbers.length ? list : el('p', 'queue-empty', 'Your queue is empty. Add an issue to begin.'));
  content.append(picker, order);
  section().replaceChildren(head, status, actions, content);
  if (open) restore(focus);
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
  if (!agent && board.defaultAgent) agent = board.defaultAgent;
  if (board.queue) {
    submitted = board.queue;
    if (submitted.record && authoritative()) {
      awaitingRecord = false;
      draft = [];
    }
  }
  draw();
}
