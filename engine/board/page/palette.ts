import type { Host } from '../../lib/config-core.ts';
import type { MenuEntry, PaletteItem } from '../types.ts';
import { filterItems } from '../view.ts';
import { $, AGENT_ICONS, el, icon } from './ui.ts';

let items: PaletteItem[] = [];
let shown: PaletteItem[] = [];
let active = 0;

const exactNumber = () => /^#?(\d+)$/.exec($('pal-input').value.trim())?.[1];

const option = (item: PaletteItem, index: number) => {
  const node = el(
    'div',
    `pal-row${index === active ? ' on' : ''}${item.isGoTo ? ' go' : ''}${item.tone ? ` tone-${item.tone}` : ''}`,
  );
  node.id = `pal-${index}`;
  node.setAttribute('role', 'option');
  node.setAttribute('aria-selected', String(index === active));
  if (item.isDisabled) node.setAttribute('aria-disabled', 'true');
  if (item.isGoTo) node.setAttribute('aria-label', `${item.label}, ${item.context}. Press Enter to go.`);
  if (item.title) node.title = item.title;
  const context = el('span', 'ctx');
  if (item.number !== null && !item.isGoTo) context.append(el('span', 'num', `#${item.number}`));
  if (item.context) context.append(item.context);
  node.append(
    icon(item.icon),
    el('b', '', item.label),
    context,
    item.isGoTo ? el('kbd', '', 'Enter to go') : item.key ? el('kbd', '', item.key) : el('span'),
  );
  node.addEventListener('mousemove', () => {
    if (active !== index) select(index);
  });
  node.addEventListener('click', () => pick(index));
  return node;
};

const draw = () => {
  const list = $('pal-list');
  const rows = [];
  let group: string | null = null;
  let section: HTMLElement | null = null;
  const exact = exactNumber();
  shown.forEach((item, index) => {
    const label = exact && !item.isGoTo && String(item.number) === exact ? `Actions for #${exact}` : item.group;
    if (section === null || label !== group) {
      group = label;
      const heading = el('div', 'pal-group', group);
      heading.id = `pal-g-${rows.length}`;
      section = el('div');
      section.setAttribute('role', 'group');
      section.setAttribute('aria-labelledby', heading.id);
      section.append(heading);
      rows.push(section);
    }
    section.append(option(item, index));
  });
  if (shown.length === 0) rows.push(el('p', 'pal-empty', 'No card or command matches.'));
  list.replaceChildren(...rows);
  $('pal-input').setAttribute('aria-activedescendant', shown.length ? `pal-${active}` : '');
};

const mark = (index: number, isOn: boolean) => {
  const row = $(`pal-${index}`);
  row.classList.toggle('on', isOn);
  row.setAttribute('aria-selected', String(isOn));
};

const select = (index: number) => {
  mark(active, false);
  active = index;
  mark(active, true);
  $('pal-input').setAttribute('aria-activedescendant', `pal-${active}`);
  $(`pal-${active}`).scrollIntoView({ block: 'nearest' });
};

const pick = (index: number) => {
  const item = shown[index];
  if (!item) return;
  $('palette').close();
  item.run();
};

const filter = () => {
  shown = filterItems(items, $('pal-input').value);
  active = 0;
  draw();
};

export const openPalette = (next: PaletteItem[]) => {
  items = next;
  $('pal-input').value = '';
  filter();
  $('palette').showModal();
  $('pal-input').focus();
};

export const setupPalette = () => {
  $('pal-input').addEventListener('input', filter);
  $('pal-input').addEventListener('keydown', (event) => {
    const moves: Record<string, number> = { ArrowDown: 1, ArrowUp: -1 };
    if (event.key in moves && shown.length) {
      event.preventDefault();
      select((active + (moves[event.key] as number) + shown.length) % shown.length);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      pick(active);
    }
  });
  $('palette').addEventListener('click', (event) => {
    if (event.target === $('palette')) $('palette').close();
  });
};

let anchor: HTMLElement | null = null;
let closed: (() => void) | undefined;

const position = (menu: HTMLElement, from: HTMLElement) => {
  menu.style.left = '12px';
  const box = from.getBoundingClientRect();
  const width = menu.offsetWidth;
  const height = menu.offsetHeight;
  const left = Math.min(Math.max(12, box.right - width), innerWidth - width - 12);
  const below = box.bottom + 6 + height <= innerHeight - 12;
  menu.style.left = `${left}px`;
  menu.style.top = `${below ? box.bottom + 6 : Math.max(12, box.top - height - 6)}px`;
};

const agentMark = (host: Host) => {
  const node = el('span', 'menu-agent');
  const image = el('img');
  image.src = AGENT_ICONS[host];
  image.alt = '';
  node.append(image);
  return node;
};

export const openMenu = (
  from: HTMLElement,
  entries: (MenuEntry | 'rule')[],
  options: { label: string; focus?: 'first' | 'keep'; onClose?: () => void },
) => {
  const menu = $('menu');
  const isOpen = menu.matches(':popover-open');
  const active = document.activeElement;
  const kept =
    options.focus === 'keep' && active instanceof HTMLElement && menu.contains(active) ? active.dataset.id : undefined;
  if (isOpen && options.focus !== 'keep') {
    const done = closed;
    closed = undefined;
    done?.();
  }
  if (anchor !== from) anchor?.setAttribute('aria-expanded', 'false');
  anchor = from;
  closed = options.onClose;
  menu.setAttribute('aria-label', options.label);
  menu.replaceChildren(
    ...entries.map((entry) => {
      if (entry === 'rule') return el('hr');
      const node = el('button', 'menu-row');
      node.type = 'button';
      node.setAttribute('role', 'menuitem');
      if (entry.id) node.dataset.id = entry.id;
      const text = el('div', 'menu-text');
      text.append(el('span', '', entry.label));
      if (entry.tag) text.append(el('em', 'menu-tag', entry.tag));
      node.append(
        entry.host ? agentMark(entry.host) : icon(entry.icon),
        text,
        entry.key ? el('kbd', '', entry.key) : el('span'),
      );
      if (entry.isDisabled) node.setAttribute('aria-disabled', 'true');
      if (entry.title) node.title = entry.title;
      node.addEventListener('click', (event) => {
        event.stopPropagation();
        menu.hidePopover();
        entry.run();
      });
      return node;
    }),
  );
  if (isOpen) from.setAttribute('aria-expanded', 'true');
  else menu.showPopover();
  position(menu, from);
  (
    (kept && menu.querySelector<HTMLElement>(`.menu-row[data-id="${CSS.escape(kept)}"]`)) ||
    menu.querySelector<HTMLElement>('.menu-row')
  )?.focus();
};

export const placeMenu = () => {
  const menu = $('menu');
  if (anchor && menu.matches(':popover-open')) position(menu, anchor);
};

export const closeMenu = () => {
  const menu = $('menu');
  if (menu.matches(':popover-open')) menu.hidePopover();
};

export const setupMenu = () => {
  const menu = $('menu');
  menu.addEventListener('keydown', (event) => {
    const rows = [...menu.querySelectorAll<HTMLElement>('.menu-row')];
    const at = rows.indexOf(document.activeElement as HTMLElement);
    const moves: Record<string, number> = { ArrowDown: 1, ArrowUp: -1 };
    if (event.key in moves) {
      event.preventDefault();
      rows[(at + (moves[event.key] as number) + rows.length) % rows.length]?.focus();
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      (event.key === 'Home' ? rows[0] : rows.at(-1))?.focus();
    } else if (event.key === 'Tab') {
      menu.hidePopover();
    }
  });
  menu.addEventListener('beforetoggle', (event) => {
    if (event.newState !== 'closed') return;
    if (menu.contains(document.activeElement)) anchor?.focus();
    const done = closed;
    closed = undefined;
    done?.();
  });
  menu.addEventListener('toggle', (event) => anchor?.setAttribute('aria-expanded', String(event.newState === 'open')));
};
