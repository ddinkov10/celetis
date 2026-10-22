import { $, el, icon } from './ui.mjs';
import { filterItems } from './view.mjs';

let items = [];
let shown = [];
let active = 0;

const option = (item, index) => {
  const node = el('div', `pal-row${index === active ? ' on' : ''}${item.tone ? ` tone-${item.tone}` : ''}`);
  node.id = `pal-${index}`;
  node.setAttribute('role', 'option');
  node.setAttribute('aria-selected', String(index === active));
  if (item.isDisabled) node.setAttribute('aria-disabled', 'true');
  if (item.title) node.title = item.title;
  const context = el('span', 'ctx');
  if (item.number !== null) context.append(el('span', 'num', `#${item.number}`));
  if (item.context) context.append(item.context);
  node.append(icon(item.icon), el('b', '', item.label), context, item.key ? el('kbd', '', item.key) : el('span'));
  node.addEventListener('mousemove', () => {
    if (active !== index) select(index);
  });
  node.addEventListener('click', () => pick(index));
  return node;
};

const draw = () => {
  const list = $('pal-list');
  const rows = [];
  let group = null;
  shown.forEach((item, index) => {
    if (item.group !== group) {
      group = item.group;
      rows.push(el('div', 'pal-group', group));
    }
    rows.push(option(item, index));
  });
  if (shown.length === 0) rows.push(el('p', 'pal-empty', 'No card or command matches.'));
  list.replaceChildren(...rows);
  $('pal-input').setAttribute('aria-activedescendant', shown.length ? `pal-${active}` : '');
};

const select = (index) => {
  active = index;
  draw();
  $(`pal-${index}`)?.scrollIntoView({ block: 'nearest' });
};

const pick = (index) => {
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

export const openPalette = (next) => {
  items = next;
  $('pal-input').value = '';
  filter();
  $('palette').showModal();
  $('pal-input').focus();
};

export const setupPalette = () => {
  $('pal-input').addEventListener('input', filter);
  $('pal-input').addEventListener('keydown', (event) => {
    const moves = { ArrowDown: 1, ArrowUp: -1 };
    if (event.key in moves && shown.length) {
      event.preventDefault();
      select((active + moves[event.key] + shown.length) % shown.length);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      pick(active);
    }
  });
  $('palette').addEventListener('click', (event) => {
    if (event.target === $('palette')) $('palette').close();
  });
};

let anchor = null;

export const openMenu = (from, entries) => {
  const menu = $('menu');
  anchor = from;
  menu.replaceChildren(
    ...entries.map((entry) => {
      if (entry === 'rule') return el('hr');
      const node = el('button', `menu-row${entry.isDanger ? ' danger' : ''}`);
      node.type = 'button';
      node.setAttribute('role', 'menuitem');
      node.append(icon(entry.icon), el('span', '', entry.label), entry.key ? el('kbd', '', entry.key) : el('span'));
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
  menu.showPopover();
  const box = from.getBoundingClientRect();
  const width = menu.offsetWidth;
  const height = menu.offsetHeight;
  const left = Math.min(Math.max(8, box.right - width), innerWidth - width - 8);
  const below = box.bottom + 6 + height <= innerHeight - 8;
  menu.style.left = `${left}px`;
  menu.style.top = `${below ? box.bottom + 6 : Math.max(8, box.top - height - 6)}px`;
  menu.querySelector('.menu-row')?.focus();
};

export const setupMenu = () => {
  const menu = $('menu');
  menu.addEventListener('keydown', (event) => {
    const rows = [...menu.querySelectorAll('.menu-row')];
    const at = rows.indexOf(document.activeElement);
    const moves = { ArrowDown: 1, ArrowUp: -1 };
    if (event.key in moves) {
      event.preventDefault();
      rows[(at + moves[event.key] + rows.length) % rows.length]?.focus();
    } else if (event.key === 'Tab') {
      menu.hidePopover();
    }
  });
  menu.addEventListener('toggle', (event) => anchor?.setAttribute('aria-expanded', String(event.newState === 'open')));
};
