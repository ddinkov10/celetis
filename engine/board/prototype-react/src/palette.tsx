import { Autocomplete } from '@base-ui/react/autocomplete';
import { cn } from 'cn';
import { useMemo, useState } from 'react';
import type { Board, Card, Column, PaletteItem } from '../../types.ts';
import { filterItems } from '../../view.ts';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { agentName, mainAction } from './data.ts';
import { Icon } from './icon.tsx';

type Item = Omit<PaletteItem, 'run'> & { id: string };
type Group = { value: string; items: Item[] };

const GROUPS: [Column, string][] = [
  ['needs', 'Needs you'],
  ['running', 'Running'],
  ['idle', 'Run the next step'],
  ['human', 'Human sessions'],
];

const BOARD_ITEMS: [string, string, string][] = [
  ['Show the agent order', 'person', ''],
  ['Show the pipeline', 'stages', 'v'],
  ['Show the history', 'clock', 'd'],
  ['Read the issues again', 'refresh', 'r'],
  ['Keyboard shortcuts', 'keyboard', '?'],
];

export function paletteItems(board: Board): Item[] {
  const items: Item[] = [];
  const goTo: Item[] = [];
  const push = (list: Item[], item: Omit<Item, 'id'>) => list.push({ ...item, id: `${list.length}-${item.group}-${item.label}-${item.number}` });
  for (const [column, group] of GROUPS)
    for (const card of board.columns[column] as Card[]) {
      if (card.number !== null)
        push(goTo, { group: 'Go to', isGoTo: true, number: card.number, label: `Go to #${card.number}`, context: card.title, icon: 'panel', tone: null, key: '' });
      const main = mainAction(board, card);
      if (main && !main.isDisabled)
        push(items, {
          group,
          number: card.number,
          label: main.name.replace(/, #\d+$/, '').replace(/ of #\d+$/, '').replace(/^(Open issue) #\d+/, '$1'),
          context: card.title,
          icon: main.icon,
          tone: group === 'Needs you' ? 'needs' : null,
          key: '',
        });
      else if (card.number !== null || card.sessionId)
        push(items, { group, number: card.number, label: 'Show the details', context: card.title, icon: 'panel', tone: null, key: '' });
      if (card.run && card.number !== null && board.agents && !board.noRun)
        for (const [id, entry] of Object.entries(board.agents)) {
          if (!entry.available) continue;
          push(items, { group, number: card.number, label: `Run with ${agentName(board, id)}`, context: card.title, icon: 'run', tone: group === 'Needs you' ? 'needs' : null, key: '' });
        }
    }
  for (const card of board.history?.entries ?? [])
    if (card.url) push(items, { group: 'History', number: card.number, label: `Open the issue${board.tracker ? ` on ${board.tracker}` : ''}`, context: card.title, icon: 'open', tone: null, key: '' });
  for (const [label, icon, key] of BOARD_ITEMS) push(items, { group: 'Board', number: null, label, context: '', icon, tone: null, key });
  return [...goTo, ...items];
}

const groupsOf = (shown: Item[], query: string): Group[] => {
  const exact = /^#?(\d+)$/.exec(query.trim())?.[1];
  const groups: Group[] = [];
  for (const item of shown) {
    const label = exact && !item.isGoTo && String(item.number) === exact ? `Actions for #${exact}` : item.group;
    const last = groups.at(-1);
    if (last && last.value === label) last.items.push(item);
    else groups.push({ value: label, items: [item] });
  }
  return groups;
};

export function Palette({ board, open, onOpenChange }: { board: Board; open: boolean; onOpenChange: (open: boolean) => void }) {
  const [query, setQuery] = useState('');
  const all = useMemo(() => paletteItems(board), [board]);
  const groups = useMemo(() => groupsOf(filterItems(all, query), query), [all, query]);
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) setQuery('');
        onOpenChange(next);
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="top-[12vh] flex max-h-[min(70vh,560px)] w-[min(640px,calc(100vw-32px))] max-w-none translate-y-0 flex-col gap-0 overflow-hidden rounded-2xl bg-card p-0 text-ink-muted data-open:animate-[rise-in_0.16s_cubic-bezier(0.2,0.8,0.2,1)] data-open:zoom-in-100 sm:max-w-none"
      >
        <DialogTitle className="sr-only">Search the cards, history, and commands</DialogTitle>
        <Autocomplete.Root
          open
          inline
          items={groups}
          filter={null}
          value={query}
          onValueChange={setQuery}
          itemToStringValue={(item: Item) => item.label}
          autoHighlight="always"
          keepHighlight
        >
          <div className="flex min-h-[52px] flex-none items-center gap-2.5 border-b border-border px-4">
            <Autocomplete.Input
              aria-label="Search the cards, history, and commands"
              placeholder="Search an issue, a step, or a command; #n jumps to an issue"
              autoComplete="off"
              spellCheck={false}
              className="min-w-0 flex-1 self-stretch border-0 bg-transparent px-0.5 text-[0.90625rem] text-foreground outline-0 placeholder:text-muted-foreground focus-visible:outline-0"
            />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-1.5 pt-1.5 pb-2">
            <Autocomplete.Empty>
              <p className="mx-2.5 my-[18px] text-sm text-muted-foreground">No card or command matches.</p>
            </Autocomplete.Empty>
            <Autocomplete.List>
              {(group: Group) => (
                <Autocomplete.Group key={group.value} items={group.items}>
                  <Autocomplete.GroupLabel className="px-2.5 pt-2.5 pb-1.5 text-[0.6875rem] leading-none font-semibold tracking-[0.07em] text-muted-foreground uppercase">
                    {group.value}
                  </Autocomplete.GroupLabel>
                  <Autocomplete.Collection>
                    {(item: Item) => (
                      <Autocomplete.Item
                        key={item.id}
                        value={item}
                        onClick={() => onOpenChange(false)}
                        className={cn(
                          'group grid min-h-[38px] cursor-pointer grid-cols-[18px_auto_minmax(0,1fr)_auto] items-center gap-2.5 rounded-lg px-2.5 text-sm text-ink-muted outline-none phone:min-h-[45px] data-highlighted:bg-accent data-highlighted:outline-2 data-highlighted:outline-solid data-highlighted:-outline-offset-2 data-highlighted:outline-ring',
                          item.isGoTo && 'min-h-11',
                        )}
                      >
                        <Icon name={item.icon} className={cn('size-[15px] text-muted-foreground group-data-highlighted:text-foreground', item.tone === 'needs' && 'text-needs group-data-highlighted:text-needs')} />
                        <b className={cn('font-medium whitespace-nowrap text-foreground', item.isGoTo && 'font-semibold')}>{item.label}</b>
                        <span className="min-w-0 truncate text-ink-muted">
                          {item.number !== null && !item.isGoTo && <span className="mr-1.5 font-mono text-xs leading-none">#{item.number}</span>}
                          {item.context}
                        </span>
                        {item.isGoTo ? (
                          <kbd className="inline-flex px-1.5 font-sans text-ink-muted">Enter to go</kbd>
                        ) : item.key ? (
                          <kbd className="min-h-5 min-w-5">{item.key}</kbd>
                        ) : (
                          <span />
                        )}
                      </Autocomplete.Item>
                    )}
                  </Autocomplete.Collection>
                </Autocomplete.Group>
              )}
            </Autocomplete.List>
          </div>
          <div className="flex min-h-[38px] flex-none items-center gap-4 border-t border-border px-4 text-xs text-muted-foreground [&_kbd]:min-h-[18px] [&_kbd]:min-w-[18px] [&_kbd]:px-1 [&>span]:inline-flex [&>span]:items-center [&>span]:gap-1.5">
            <span>
              <kbd>↑</kbd>
              <kbd>↓</kbd>move
            </span>
            <span>
              <kbd>Enter</kbd>do it
            </span>
            <span>
              <kbd>Esc</kbd>close
            </span>
          </div>
        </Autocomplete.Root>
      </DialogContent>
    </Dialog>
  );
}
