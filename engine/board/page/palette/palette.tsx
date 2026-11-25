import { Autocomplete } from '@base-ui/react/autocomplete';
import { cn } from 'cn';
import { type ReactNode, useLayoutEffect, useMemo, useRef } from 'react';
import { grammar } from '../../../lib/tracker/grammar.ts';
import type { PaletteItem } from '../../types.ts';
import { filterItems } from '../../view.ts';
import { Icon } from '../app/icon.tsx';
import { Dialog, DialogContent } from '../ui/dialog.tsx';
import { Kbd } from '../ui/kbd.tsx';
import { ViewBoundary } from '../ui/view-boundary.tsx';
import { paletteStore, usePalette } from './state.ts';

const POPUP =
  'inset-0 h-fit m-[12vh_auto_auto] flex max-h-[min(70vh,560px)] w-[min(640px,calc(100vw-32px))] translate-x-0 translate-y-0 animate-rise-in-fast flex-col overflow-hidden rounded-2xl';
const ROW =
  'grid min-h-[38px] cursor-pointer grid-cols-[18px_auto_minmax(0,1fr)_auto] items-center gap-2.5 rounded-lg px-2.5 text-[0.8125rem] text-card-foreground phone:min-h-[45px] phone:flex-none aria-disabled:cursor-not-allowed aria-disabled:opacity-45 data-highlighted:bg-accent data-highlighted:outline-2 data-highlighted:-outline-offset-2 data-highlighted:outline-ring [&_.icon]:size-[15px]';
const GO_KBD =
  'inline-flex min-h-5 min-w-5 items-center px-1.5 font-sans text-[0.6875rem] leading-none font-medium text-card-foreground';

const exactNumber = (query: string) => new RegExp(`^#?(${grammar().query})$`).exec(query.trim())?.[1];

const option = (item: PaletteItem, index: number) => (
  <Autocomplete.Item
    key={index}
    value={item}
    index={index}
    className={cn(
      ROW,
      item.isGoTo && 'min-h-11 phone:min-h-11',
      item.tone === 'needs'
        ? '[&_.icon]:text-needs'
        : '[&_.icon]:text-muted-foreground data-highlighted:[&_.icon]:text-foreground',
    )}
    aria-disabled={item.isDisabled ? 'true' : undefined}
    aria-label={item.isGoTo ? `${item.label}, ${item.context}. Press Enter to go.` : undefined}
    title={item.title || undefined}
    render={(props, state) => <div {...{ ...props, 'aria-selected': state.highlighted }} />}
    onClick={() => paletteStore.pick(item)}
  >
    <Icon name={item.icon} />
    <b className={cn('font-medium whitespace-nowrap text-foreground', item.isGoTo && 'font-semibold')}>{item.label}</b>
    <span className="min-w-0 truncate text-card-foreground">
      {item.number !== null && !item.isGoTo && (
        <span className="mr-1.5 font-mono text-xs leading-none font-normal text-card-foreground">#{item.number}</span>
      )}
      {item.context}
    </span>
    {item.isGoTo ? (
      <Kbd className={GO_KBD}>Enter to go</Kbd>
    ) : item.key ? (
      <Kbd className="min-w-5">{item.key}</Kbd>
    ) : (
      <span />
    )}
  </Autocomplete.Item>
);

const sections = (shown: PaletteItem[], query: string) => {
  let group: string | null = null;
  let section: { id: string; heading: ReactNode; options: ReactNode[] } | null = null;
  const parts: { id: string; heading: ReactNode; options: ReactNode[] }[] = [];
  const exact = exactNumber(query);
  shown.forEach((item, index) => {
    const keyed = exact && !item.isGoTo && item.number === exact;
    const label = keyed ? `Actions for #${exact}` : item.group;
    if (section === null || label !== group) {
      group = label;
      section = {
        id: `pal-g-${parts.length}`,
        heading: keyed ? (
          <>
            {'Actions for '}
            <span className="normal-case">{`#${exact}`}</span>
          </>
        ) : (
          group
        ),
        options: [],
      };
      parts.push(section);
    }
    section.options.push(option(item, index));
  });
  if (shown.length === 0)
    return <p className="mx-2.5 my-[18px] text-[0.8125rem] text-muted-foreground">No card or command matches.</p>;
  return parts.map((part) => (
    <Autocomplete.Group key={part.id}>
      <Autocomplete.GroupLabel className="px-2.5 pt-2.5 pb-1.5 font-sans text-[0.6875rem] leading-none font-semibold tracking-[0.07em] text-muted-foreground uppercase">
        {part.heading}
      </Autocomplete.GroupLabel>
      {part.options}
    </Autocomplete.Group>
  ));
};

function Search() {
  const items = usePalette((state) => state.items);
  const query = usePalette((state) => state.query);
  const shown = useMemo(() => filterItems([...items], query), [items, query]);
  const input = useRef<HTMLInputElement>(null);
  // Base UI focuses a frame later and loses a fast key. The microtask runs after it reads the return target.
  useLayoutEffect(() => {
    queueMicrotask(() => input.current?.focus());
  }, []);
  return (
    <Autocomplete.Root
      open
      inline
      autoHighlight="always"
      keepHighlight
      loopFocus
      filter={null}
      items={shown}
      value={query}
      itemToStringValue={(item: PaletteItem) => item.label}
      onValueChange={(next, details) => {
        if (details.reason === 'input-change') paletteStore.setQuery(next);
      }}
    >
      <div className="flex min-h-[52px] flex-none items-center gap-2.5 border-b border-b-border px-4">
        <Autocomplete.Input
          ref={input}
          type="text"
          autoComplete="off"
          spellCheck="false"
          onKeyDown={(event) => {
            if (event.key === 'Home' || event.key === 'End') event.preventBaseUIHandler();
          }}
          placeholder={`Search an issue, a step, or a command; ${grammar().kind === 'local' ? 'a key' : '#n'} jumps to an issue`}
          className="min-w-0 flex-1 self-stretch bg-transparent text-[0.90625rem] text-foreground [border:0] [outline:0] placeholder:text-muted-foreground"
        />
      </div>
      <Autocomplete.List aria-label="Results" className="min-h-0 flex-1 overflow-y-auto px-1.5 pt-1.5 pb-2">
        {sections(shown, query)}
      </Autocomplete.List>
    </Autocomplete.Root>
  );
}

export function Palette() {
  const isOpen = usePalette((state) => state.isOpen);
  const items = usePalette((state) => state.items);
  const session = usePalette((state) => state.session);
  const popup = useRef<HTMLDivElement>(null);
  return (
    <Dialog
      open={isOpen}
      onOpenChange={(next) => {
        if (!next) paletteStore.close();
      }}
      onOpenChangeComplete={(next) => {
        if (!next) paletteStore.takePicked()?.run();
      }}
    >
      <DialogContent
        ref={popup}
        data-slot="palette"
        aria-label="Search the cards, history, and commands"
        className={POPUP}
        initialFocus={() => popup.current?.querySelector('input') ?? null}
      >
        <ViewBoundary snapshot={items} fallback={null} onFail={paletteStore.close}>
          <Search key={session} />
          <div className="flex min-h-[38px] flex-none items-center gap-4 border-t border-t-border px-4 text-[0.75rem] text-muted-foreground [&_kbd]:min-h-[18px] [&_kbd]:min-w-[18px] [&_kbd]:px-1 [&_kbd]:text-[0.6875rem] [&_span]:inline-flex [&_span]:items-center [&_span]:gap-1.5">
            <span>
              <Kbd>↑</Kbd>
              <Kbd>↓</Kbd>
              move
            </span>
            <span>
              <Kbd>Enter</Kbd>
              do it
            </span>
            <span>
              <Kbd>Esc</Kbd>
              close
            </span>
          </div>
        </ViewBoundary>
      </DialogContent>
    </Dialog>
  );
}
