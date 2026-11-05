import type { AgentOrder, Host } from '../lib/config-core.ts';
import type { AgentPickerView, QuotaWait } from './types.ts';
import { AGENT_ICONS, el } from './ui.ts';

export class OrderConflict extends Error {
  constructor(
    readonly latest: AgentOrder,
    message: string,
  ) {
    super(message);
  }
}

type Actions = {
  replace(order: readonly Host[], version: string): Promise<AgentOrder>;
  retry(number: number, waitId: string): Promise<void>;
};
type Drag = {
  row: HTMLElement;
  host: Host;
  pointer: number;
  x: number;
  y: number;
  offset: number;
  started: boolean;
  to: number | null;
  ghost: HTMLElement | null;
};

const HOSTS: readonly Host[] = ['claude', 'codex'];
const NAMES: Record<Host, string> = { claude: 'Claude Code', codex: 'Codex' };
const NS = 'http://www.w3.org/2000/svg';
const GAP = 8;
const EDGE = 12;

const svg = (className: string, viewBox: string, shapes: [string, Record<string, string>][]) => {
  const node = document.createElementNS(NS, 'svg');
  node.setAttribute('class', className);
  node.setAttribute('viewBox', viewBox);
  node.setAttribute('aria-hidden', 'true');
  for (const [tag, attributes] of shapes) {
    const shape = document.createElementNS(NS, tag);
    for (const [key, value] of Object.entries(attributes)) shape.setAttribute(key, value);
    node.append(shape);
  }
  return node;
};
const chevron = () =>
  svg('ap-chev', '0 0 10 10', [
    [
      'path',
      {
        d: 'M2 3.5 5 6.5 8 3.5',
        fill: 'none',
        stroke: 'currentColor',
        'stroke-width': '1.4',
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round',
      },
    ],
  ]);
const grip = () =>
  svg(
    'ap-grip',
    '0 0 10 14',
    [2.5, 7.5].flatMap((cx) =>
      [2.5, 7, 11.5].map((cy): [string, Record<string, string>] => [
        'circle',
        { cx: String(cx), cy: String(cy), r: '1.3', fill: 'currentColor' },
      ]),
    ),
  );
const agentIcon = (host: Host) => {
  const node = el('span', 'ap-icon');
  const image = el('img');
  image.src = AGENT_ICONS[host];
  image.alt = '';
  node.append(image);
  return node;
};
const resetText = (at: number | null) => {
  if (at === null) return 'reset unknown';
  const date = new Date(at);
  const today = date.toDateString() === new Date().toDateString();
  return `resets ${date.toLocaleString([], today ? { hour: '2-digit', minute: '2-digit' } : { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`;
};
const same = (a: readonly Host[], b: readonly Host[]) => a.length === b.length && a.every((host, at) => b[at] === host);

export function createAgentPicker(
  root: HTMLElement,
  actions: Actions,
): { update(view: AgentPickerView): void; destroy(): void } {
  let view: AgentPickerView | null = null;
  let confirmed: AgentOrder | null = null;
  let saving: readonly Host[] | null = null;
  let notice = '';
  let open = false;
  let menuFor: Host | null = null;
  let drag: Drag | null = null;
  let suppressClick = false;
  let drawn = '';
  const retrying = new Set<string>();

  const trigger = el('button', 'ap-trigger');
  trigger.type = 'button';
  trigger.setAttribute('aria-haspopup', 'dialog');
  trigger.setAttribute('aria-expanded', 'false');
  trigger.setAttribute('aria-controls', 'agent-order');
  const stack = el('span', 'ap-stack');
  trigger.append(stack, chevron());
  const pop = el('section', 'ap-pop');
  pop.id = 'agent-order';
  pop.setAttribute('role', 'dialog');
  pop.setAttribute('aria-labelledby', 'agent-order-title');
  pop.inert = true;
  const head = el('header', 'ap-head');
  const title = el('h2', '', 'Agent order');
  title.id = 'agent-order-title';
  head.append(
    title,
    el('p', '', 'New default work uses the first available agent. Drag a handle, or press it for move actions.'),
  );
  const list = el('ol', 'ap-list');
  list.setAttribute('aria-label', 'Agents in priority order');
  const message = el('p', 'ap-notice');
  message.setAttribute('role', 'status');
  const waits = el('div', 'ap-waits');
  pop.append(head, list, message, waits);
  const live = el('p', 'sr-only');
  live.setAttribute('aria-live', 'polite');
  root.replaceChildren(trigger, pop, live);
  root.hidden = true;

  const announce = (text: string) => {
    live.textContent = '';
    setTimeout(() => {
      live.textContent = text;
    }, 50);
  };
  const shown = (): readonly Host[] => saving ?? confirmed?.order ?? [];
  const excluded = () => HOSTS.filter((host) => !shown().includes(host));
  const handleOf = (host: Host) => list.querySelector<HTMLElement>(`.ap-row[data-host="${host}"] .ap-handle`);
  const paused = () => Boolean(view && shown().every((host) => view?.usage[host]));

  const place = () => {
    if (!open) return;
    const box = trigger.getBoundingClientRect();
    pop.style.maxHeight = `${Math.max(0, Math.min(innerHeight - EDGE * 2, box.top - GAP - EDGE))}px`;
    const left = Math.max(EDGE, Math.min(box.left, innerWidth - pop.offsetWidth - EDGE));
    pop.style.left = `${left}px`;
    pop.style.top = `${Math.max(EDGE, box.top - pop.offsetHeight - GAP)}px`;
  };
  const resize = new ResizeObserver(place);
  resize.observe(pop);
  if (root.parentElement) resize.observe(root.parentElement);

  const detail = (host: Host) => {
    if (!shown().includes(host)) return 'Excluded from default work';
    const parts: string[] = [];
    if (view?.activeHosts.includes(host)) parts.push('In use');
    const block = view?.usage[host];
    if (block) parts.push(`Limit reached · ${resetText(block.resetAt)}`, block.reason);
    else if (!parts.length) parts.push('Available');
    return parts.join(' · ');
  };

  const row = (host: Host, rank: number | null) => {
    const item = el('li', `ap-row${rank === null ? ' ap-excluded' : ''}`);
    item.dataset.host = host;
    const handle = el('button', 'ap-handle');
    handle.type = 'button';
    handle.setAttribute('aria-haspopup', 'menu');
    handle.setAttribute(
      'aria-label',
      rank === null
        ? `${NAMES[host]}, excluded from default work. Actions`
        : `${NAMES[host]}, priority ${rank} of ${shown().length}. Move or exclude`,
    );
    if (saving) handle.setAttribute('aria-disabled', 'true');
    handle.append(grip());
    const name = el('span', 'ap-name', NAMES[host]);
    const text = detail(host);
    const availability = el('small', 'ap-detail', text);
    availability.title = text;
    name.append(availability);
    item.append(handle, el('span', 'ap-rank', rank === null ? '–' : String(rank)), agentIcon(host), name);
    if (rank === 1) item.append(el('span', 'ap-badge', 'First'));
    return item;
  };

  const waitLine = (wait: QuotaWait) => {
    const line = el('div', 'ap-wait');
    line.append(
      el(
        'p',
        '',
        `#${wait.number} is paused: every included agent reached a usage limit. ${
          wait.nextResetAt === null
            ? 'No reset time is known.'
            : `It tries again at ${resetText(wait.nextResetAt).replace('resets ', '')}.`
        }`,
      ),
    );
    const button = el('button', 'btn ghost ap-retry', `Retry #${wait.number}`);
    button.type = 'button';
    button.dataset.wait = wait.waitId;
    button.setAttribute('aria-label', `Retry #${wait.number} with the current agent order`);
    if (retrying.has(wait.waitId)) button.setAttribute('aria-busy', 'true');
    button.addEventListener('click', () => void retry(wait));
    line.append(button);
    return line;
  };

  const focusKey = () => {
    const active = document.activeElement;
    if (!(active instanceof HTMLElement) || !root.contains(active)) return null;
    if (active === trigger) return 'trigger';
    const host = active.closest<HTMLElement>('.ap-row')?.dataset.host;
    if (active.matches('.ap-menu button')) return `menu:${active.dataset.action}`;
    if (host) return `handle:${host}`;
    if (active.dataset.wait) return `wait:${active.dataset.wait}`;
    return null;
  };
  const restore = (key: string | null) => {
    if (!key) return;
    const target =
      key === 'trigger'
        ? trigger
        : key.startsWith('menu:')
          ? list.querySelector<HTMLElement>(`.ap-menu [data-action="${key.slice(5)}"]:not(:disabled)`)
          : key.startsWith('handle:')
            ? handleOf(key.slice(7) as Host)
            : waits.querySelector<HTMLElement>(`[data-wait="${CSS.escape(key.slice(5))}"]`);
    (target ?? (open ? list.querySelector<HTMLElement>('.ap-handle') : trigger))?.focus({ preventScroll: true });
  };

  const draw = (force = false) => {
    if (!view || !confirmed || drag) return;
    const signature = JSON.stringify([view, confirmed, saving, notice, open, menuFor, [...retrying]]);
    if (!force && signature === drawn) return;
    drawn = signature;
    const focus = focusKey();
    root.hidden = false;
    const order = shown();
    stack.replaceChildren(...order.map(agentIcon));
    const using = view.activeHosts.length ? ` In use: ${view.activeHosts.map((host) => NAMES[host]).join(', ')}.` : '';
    trigger.setAttribute(
      'aria-label',
      `Agent order: ${order.map((host) => NAMES[host]).join(', then ')}.${using}${paused() ? ' Default work is paused.' : ''}`,
    );
    trigger.title = `Agent order: ${order.map((host) => NAMES[host]).join(' › ')}`;
    trigger.dataset.state = paused() ? 'paused' : 'ready';
    list.replaceChildren(
      ...order.map((host, at) => row(host, at + 1)),
      ...excluded().map((host) => row(host, null)),
      Object.assign(el('div', 'ap-drop'), { hidden: true }),
    );
    list.setAttribute('aria-busy', String(Boolean(saving)));
    const status =
      notice ||
      (saving
        ? 'Saving the agent order.'
        : view.error
          ? `The agent state is unavailable: ${view.error}`
          : paused() && !view.waits.length
            ? 'New default work waits: every included agent reached a usage limit.'
            : '');
    message.textContent = status;
    message.hidden = !status;
    waits.replaceChildren(...view.waits.map(waitLine));
    if (menuFor) showMenu(menuFor, false);
    place();
    restore(focus);
  };

  const commit = async (next: readonly Host[], success: string) => {
    if (!confirmed || saving || same(next, confirmed.order) || !next.length) return;
    const version = confirmed.version;
    saving = next;
    notice = '';
    announce('Saving the agent order.');
    draw();
    try {
      confirmed = await actions.replace(next, version);
      notice = '';
      announce(success);
    } catch (cause) {
      if (cause instanceof OrderConflict) {
        confirmed = cause.latest;
        notice = 'Another tab or command saved a new order first. The current order shows now. Change it again.';
      } else notice = `The order was not saved: ${cause instanceof Error ? cause.message : String(cause)}`;
      announce(notice);
    } finally {
      saving = null;
      draw(true);
    }
  };
  const move = (host: Host, to: number) => {
    const order = [...shown()];
    const from = order.indexOf(host);
    to = Math.max(0, Math.min(order.length - 1, to));
    if (from < 0 || from === to) return;
    order.splice(from, 1);
    order.splice(to, 0, host);
    void commit(
      order,
      to === 0 ? `${NAMES[host]} is now first.` : `${NAMES[host]} moved to position ${to + 1} of ${order.length}.`,
    );
  };
  const toggle = (host: Host) => {
    const order = shown();
    if (order.includes(host)) {
      if (order.length > 1)
        void commit(
          order.filter((each) => each !== host),
          `${NAMES[host]} is excluded from default work.`,
        );
    } else void commit([...order, host], `${NAMES[host]} is included in default work, last in the order.`);
  };

  const retry = async (wait: QuotaWait) => {
    if (retrying.has(wait.waitId)) return;
    retrying.add(wait.waitId);
    draw();
    try {
      await actions.retry(wait.number, wait.waitId);
      notice = '';
      announce(`Retry requested for #${wait.number}. Its runner starts one attempt with the current order.`);
    } catch (cause) {
      notice = `Retry of #${wait.number} failed: ${cause instanceof Error ? cause.message : String(cause)}`;
      announce(notice);
    } finally {
      retrying.delete(wait.waitId);
      draw();
    }
  };

  const closeMenu = (refocus: boolean) => {
    const host = menuFor;
    list.querySelector('.ap-menu')?.remove();
    menuFor = null;
    if (refocus && host) handleOf(host)?.focus();
  };
  const showMenu = (host: Host, focus = true) => {
    list.querySelector('.ap-menu')?.remove();
    const item = list.querySelector<HTMLElement>(`.ap-row[data-host="${host}"]`);
    if (!item) {
      menuFor = null;
      return;
    }
    menuFor = host;
    const order = shown();
    const at = order.indexOf(host);
    const included = at >= 0;
    const last = order.length - 1;
    const menu = el('div', 'ap-menu');
    menu.setAttribute('role', 'menu');
    menu.setAttribute('aria-label', `${NAMES[host]} actions`);
    const entry = (action: string, label: string, disabled: boolean, run: () => void) => {
      const button = el('button', '', label);
      button.type = 'button';
      button.dataset.action = action;
      button.setAttribute('role', 'menuitem');
      button.disabled = disabled || Boolean(saving);
      button.addEventListener('click', () => {
        closeMenu(false);
        handleOf(host)?.focus();
        run();
      });
      return button;
    };
    menu.append(
      entry('first', 'Move first', !included || at === 0, () => move(host, 0)),
      el('hr'),
      entry('up', 'Move up', !included || at === 0, () => move(host, at - 1)),
      entry('down', 'Move down', !included || at === last, () => move(host, at + 1)),
      entry('bottom', 'Move to bottom', !included || at === last, () => move(host, last)),
      el('hr'),
      included
        ? entry('exclude', 'Exclude from default work', order.length === 1, () => toggle(host))
        : entry('include', 'Include in default work', false, () => toggle(host)),
    );
    if (included && order.length === 1) menu.append(el('p', 'ap-menu-note', 'At least one agent stays included.'));
    list.append(menu);
    const rows = list.getBoundingClientRect();
    const box = item.getBoundingClientRect();
    const below = box.bottom + menu.offsetHeight <= innerHeight - EDGE;
    menu.style.top = `${(below ? box.bottom : Math.max(EDGE, box.top - menu.offsetHeight)) - rows.top}px`;
    menu.addEventListener('keydown', (event) => {
      const buttons = [...menu.querySelectorAll<HTMLElement>('button:not(:disabled)')];
      const index = buttons.indexOf(document.activeElement as HTMLElement);
      const step = event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1 : 0;
      if (step && buttons.length) {
        event.preventDefault();
        buttons[(index + step + buttons.length) % buttons.length]?.focus();
      } else if (event.key === 'Home' || event.key === 'End') {
        event.preventDefault();
        (event.key === 'Home' ? buttons[0] : buttons.at(-1))?.focus();
      } else if (event.key === 'Tab') closeMenu(false);
    });
    if (focus) menu.querySelector<HTMLElement>('button:not(:disabled)')?.focus();
  };

  const setOpen = (value: boolean, refocus = true) => {
    open = value;
    pop.classList.toggle('ap-open', open);
    pop.inert = !open;
    trigger.setAttribute('aria-expanded', String(open));
    if (!open) {
      cancelDrag();
      closeMenu(false);
      if (refocus) trigger.focus();
      return;
    }
    draw(true);
    list.querySelector<HTMLElement>('.ap-handle')?.focus();
  };

  const cancelDrag = () => {
    if (!drag) return;
    const { row: item, ghost, pointer } = drag;
    drag = null;
    ghost?.remove();
    item.classList.remove('ap-dragging');
    root.classList.remove('ap-is-dragging');
    const marker = list.querySelector<HTMLElement>('.ap-drop');
    if (marker) marker.hidden = true;
    const handle = item.querySelector<HTMLElement>('.ap-handle');
    if (handle?.hasPointerCapture(pointer)) handle.releasePointerCapture(pointer);
  };

  trigger.addEventListener('click', () => setOpen(!open));
  list.addEventListener('click', (event) => {
    const handle = (event.target as Element).closest<HTMLElement>('.ap-handle');
    if (!handle) return;
    if (suppressClick) {
      suppressClick = false;
      return;
    }
    const host = handle.closest<HTMLElement>('.ap-row')?.dataset.host as Host;
    if (menuFor === host) closeMenu(true);
    else showMenu(host);
  });
  list.addEventListener('pointerdown', (event) => {
    const handle = (event.target as Element).closest<HTMLElement>('.ap-handle');
    suppressClick = false;
    if (!handle || event.button !== 0 || saving) return;
    const item = handle.closest<HTMLElement>('.ap-row') as HTMLElement;
    const host = item.dataset.host as Host;
    if (!shown().includes(host)) return;
    drag = {
      row: item,
      host,
      pointer: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      offset: event.clientY - item.getBoundingClientRect().top,
      started: false,
      to: null,
      ghost: null,
    };
    handle.setPointerCapture(event.pointerId);
  });
  list.addEventListener('pointermove', (event) => {
    if (!drag || event.pointerId !== drag.pointer) return;
    if (!drag.started) {
      if (Math.hypot(event.clientX - drag.x, event.clientY - drag.y) < 4) return;
      drag.started = true;
      closeMenu(false);
      root.classList.add('ap-is-dragging');
      drag.row.classList.add('ap-dragging');
      const box = drag.row.getBoundingClientRect();
      const ghost = drag.row.cloneNode(true) as HTMLElement;
      ghost.className = 'ap-row ap-ghost';
      ghost.setAttribute('aria-hidden', 'true');
      ghost.style.width = `${box.width}px`;
      ghost.style.left = `${box.left}px`;
      root.append(ghost);
      drag.ghost = ghost;
    }
    (drag.ghost as HTMLElement).style.top = `${event.clientY - drag.offset}px`;
    const rows = [...list.querySelectorAll<HTMLElement>('.ap-row:not(.ap-excluded)')];
    let slot = rows.length;
    for (const [index, each] of rows.entries()) {
      const box = each.getBoundingClientRect();
      if (event.clientY < box.top + box.height / 2) {
        slot = index;
        break;
      }
    }
    const from = rows.indexOf(drag.row);
    const marker = list.querySelector<HTMLElement>('.ap-drop') as HTMLElement;
    if (slot === from || slot === from + 1) {
      marker.hidden = true;
      drag.to = null;
      return;
    }
    const near = rows[Math.min(slot, rows.length - 1)] as HTMLElement;
    marker.style.top = `${slot < rows.length ? near.offsetTop - 2 : near.offsetTop + near.offsetHeight}px`;
    marker.hidden = false;
    drag.to = slot > from ? slot - 1 : slot;
  });
  const endDrag = (event: PointerEvent) => {
    if (!drag || event.pointerId !== drag.pointer) return;
    const { started, host, to } = drag;
    suppressClick = started;
    cancelDrag();
    if (started && to !== null) move(host, to);
    else if (started) draw(true);
    else setTimeout(draw, 0);
  };
  list.addEventListener('pointerup', endDrag);
  list.addEventListener('pointercancel', (event) => {
    if (!drag || event.pointerId !== drag.pointer) return;
    suppressClick = drag.started;
    cancelDrag();
    draw(true);
  });
  list.addEventListener('keydown', (event) => {
    const handle = (event.target as Element).closest<HTMLElement>('.ap-handle');
    if (!handle) return;
    const host = handle.closest<HTMLElement>('.ap-row')?.dataset.host as Host;
    const handles = [...list.querySelectorAll<HTMLElement>('.ap-row .ap-handle')];
    const index = handles.indexOf(handle);
    const at = shown().indexOf(host);
    if (event.altKey && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
      event.preventDefault();
      if (at >= 0) move(host, at + (event.key === 'ArrowUp' ? -1 : 1));
    } else if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      event.preventDefault();
      handles[Math.max(0, Math.min(handles.length - 1, index + (event.key === 'ArrowUp' ? -1 : 1)))]?.focus();
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      (event.key === 'Home' ? handles[0] : handles.at(-1))?.focus();
    }
  });
  const onKey = (event: KeyboardEvent) => {
    if (event.key !== 'Escape' || !open) return;
    event.preventDefault();
    event.stopPropagation();
    if (drag) {
      cancelDrag();
      draw(true);
    } else if (menuFor) closeMenu(true);
    else setOpen(false);
  };
  const onOutside = (event: PointerEvent) => {
    if (open && !root.contains(event.target as Node)) setOpen(false, false);
  };
  root.addEventListener('keydown', onKey);
  document.addEventListener('pointerdown', onOutside);
  addEventListener('resize', place);
  addEventListener('scroll', place, true);

  return {
    update(next) {
      const changed = Boolean(confirmed && next.order.version !== confirmed.version);
      view = next;
      if (saving) return;
      if (changed && drag) {
        const started = drag.started;
        cancelDrag();
        if (started) {
          notice = 'The order changed in another tab or command. The drag stopped. The current order shows now.';
          announce(notice);
        }
      } else if (changed && notice.startsWith('Another tab')) notice = '';
      confirmed = next.order;
      draw();
    },
    destroy() {
      cancelDrag();
      resize.disconnect();
      root.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onOutside);
      removeEventListener('resize', place);
      removeEventListener('scroll', place, true);
      root.replaceChildren();
    },
  };
}
