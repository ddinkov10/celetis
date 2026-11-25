import { cn } from 'cn';
import {
  type CSSProperties,
  type ReactNode,
  type RefObject,
  startTransition,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  ViewTransition,
} from 'react';
import type { IssueKey } from '../../../lib/tracker/key.ts';
import type { Action, Card as CardData, Column, ParentEpic } from '../../types.ts';
import { COLUMNS, groupEpics, groupNeeds, isYourTurn, LIVE, pipeline, stateLabel, tail } from '../../view.ts';
import { Icon } from '../app/icon.tsx';
import { shellStore, useShellStore } from '../store.ts';
import { Badge } from '../ui/badge.tsx';
import { actionsOf } from './actions.ts';
import { Card, type CardProps, type Env, UnseenDot } from './card.tsx';
import { indexCards, layoutOf } from './cards.ts';
import { columnId, columnStop, isStop, STOPS, showHints, stopKey } from './keys.ts';
import { IconButton, Mark, Timed, useKeptScroll } from './parts.tsx';
import { closeDetails, openDetails, type ScreenState, screen, useScreen, view } from './state.ts';

type Held = {
  node: HTMLElement;
  kind: 'card' | 'control' | 'tail' | 'epic' | 'pill' | 'menu';
  key: string;
  column?: string;
  label?: string;
};

const MENU = '[data-slot="dropdown-menu-content"]';

// React cancels the root cross-fade of a card move unless the root has an inline name.
document.documentElement.style.viewTransitionName = 'root';

const markOf = (active: Element | null, menu: ScreenState['menu']): Held | null => {
  if (!(active instanceof HTMLElement)) return null;
  if (menu && active.closest(MENU)) {
    const col = document.querySelector(`#columns [data-key="${CSS.escape(menu.key)}"]`)?.closest('.col');
    return { node: active, kind: 'menu', key: menu.key, column: col ? columnId(col) : undefined };
  }
  const pill = active.closest<HTMLElement>('.human-pill');
  if (pill) {
    const key = pill.querySelector<HTMLElement>('[data-key]')?.dataset.key ?? '';
    return { node: active, kind: 'pill', key, label: active.matches('.human-go') ? 'go' : undefined };
  }
  const col = active.closest('#columns .col');
  if (!col) return null;
  const column = columnId(col);
  if (active.closest('.tail')) return { node: active, kind: 'tail', key: '', column };
  const row = active.closest<HTMLElement>('.epic-row');
  if (row) return { node: active, kind: 'epic', key: row.dataset.group ?? '', column };
  const card = active.closest<HTMLElement>('.card[data-key]');
  if (!card) return null;
  const key = card.dataset.key ?? '';
  return card === active
    ? { node: active, kind: 'card', key, column }
    : {
        node: active,
        kind: 'control',
        key,
        column,
        label: active.getAttribute('aria-label') ?? active.textContent?.trim(),
      };
};

const shown = (node: HTMLElement | null | undefined) => (node?.checkVisibility() ? node : null);
const reachable = (node: HTMLElement | null | undefined) =>
  node?.closest('.epic-children[hidden]')?.closest('.epic-group')?.querySelector<HTMLElement>('.epic-row') ?? node;

const targetOf = (mark: Held): HTMLElement | null | undefined => {
  const one = (selector: string) => document.querySelector<HTMLElement>(selector);
  const keyed = (key: string, scope = '#columns') => one(`${scope} [data-key="${CSS.escape(key)}"]`);
  const card = ['card', 'control', 'menu'].includes(mark.kind) ? keyed(mark.key) : null;
  const stop = columnStop(mark.column);
  switch (mark.kind) {
    case 'tail':
      return shown(one('.col-needs .tail')) ?? stop;
    case 'epic':
      return one(`.epic-row[data-group="${CSS.escape(mark.key)}"]`) ?? stop;
    case 'pill': {
      const open = keyed(mark.key, '#human');
      return (mark.label ? open?.closest('.human-pill')?.querySelector<HTMLElement>('.human-go') : open) ?? stop;
    }
    case 'control': {
      const control = [...(card?.querySelectorAll<HTMLElement>('button, a') ?? [])].find(
        (node) => (node.getAttribute('aria-label') ?? node.textContent?.trim()) === mark.label,
      );
      return control ?? reachable(card) ?? stop;
    }
    default:
      return reachable(card) ?? stop;
  }
};

// Read before the commit: a removed focused node leaves the focus on body after it.
// The Agents and Pipeline panels mount one Board each, so a view change hands the focus over.
let handed: Held | null = null;

const useRescue = (menu: ScreenState['menu']) => {
  const mark = useRef<Held | null>(null);
  mark.current = markOf(document.activeElement, menu);
  useLayoutEffect(() => {
    const lost = mark.current ?? handed;
    handed = null;
    if (!lost || (lost.node.isConnected && lost.node.checkVisibility()) || screen.cause() === 'quiet') return;
    const now = document.activeElement;
    if (now !== null && now !== document.body && now !== lost.node) return;
    if (lost.kind === 'menu' && (screen.cause() !== 'read' || document.querySelector(MENU))) return;
    targetOf(lost)?.focus({ preventScroll: true });
  });
  useLayoutEffect(
    () => () => {
      handed = markOf(document.activeElement, null);
      queueMicrotask(() => {
        handed = null;
      });
    },
    [],
  );
};

type Measure = Readonly<{ isMeasured: boolean; below: ReadonlySet<string>; text: string; fade: boolean }>;
const UNMEASURED: Measure = { isMeasured: false, below: new Set(), text: '', fade: false };

const measureOf = (columns: HTMLElement, isPipeline: boolean): Measure => {
  const body = columns.querySelector<HTMLElement>('.col-needs .col-body');
  const wrap = body?.querySelector<HTMLElement>('.tail-wrap');
  const below = new Set<string>();
  const counts = new Map<string, { short: string; count: number }>();
  if (body && wrap) {
    const bottom =
      Math.min(
        body.getBoundingClientRect().bottom,
        (columns.parentElement as HTMLElement).getBoundingClientRect().bottom,
      ) - (wrap.hidden ? 0 : wrap.offsetHeight);
    for (const node of body.querySelectorAll<HTMLElement>('.card[data-key]')) {
      if (node.getBoundingClientRect().bottom <= bottom + 1) continue;
      below.add(node.dataset.key ?? '');
      const group = node.closest<HTMLElement>('.group');
      const name = group?.dataset.group ?? '';
      counts.set(name, { short: group?.dataset.short ?? '', count: (counts.get(name)?.count ?? 0) + 1 });
    }
  }
  return {
    isMeasured: Boolean(body && wrap),
    below,
    text: counts.size ? tail([...counts.values()]) : '',
    fade: isPipeline && columns.scrollLeft + columns.clientWidth < columns.scrollWidth - 2,
  };
};

const sameMeasure = (a: Measure, b: Measure) =>
  a.isMeasured === b.isMeasured &&
  a.text === b.text &&
  a.fade === b.fade &&
  a.below.size === b.below.size &&
  [...a.below].every((key) => b.below.has(key));

const useMeasure = (columns: RefObject<HTMLDivElement | null>, isPipeline: boolean) => {
  const [measure, setMeasure] = useState(UNMEASURED);
  const update = () => {
    if (!columns.current) return;
    const next = measureOf(columns.current, isPipeline);
    setMeasure((was) => (sameMeasure(was, next) ? was : next));
  };
  const latest = useRef(update);
  latest.current = update;
  const frame = useRef(0);
  // A frame later: the old code of the shell changes the layout after a commit.
  const later = useRef(() => {
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => latest.current());
  });
  useLayoutEffect(() => later.current());
  useEffect(() => {
    const board = columns.current?.parentElement;
    const measureLater = later.current;
    board?.addEventListener('scroll', measureLater, true);
    addEventListener('resize', measureLater);
    return () => {
      cancelAnimationFrame(frame.current);
      board?.removeEventListener('scroll', measureLater, true);
      removeEventListener('resize', measureLater);
    };
  }, [columns]);
  return measure;
};

const HOLD_LABEL =
  'flex-none text-[0.6875rem] leading-none font-semibold tracking-[0.07em] text-muted-foreground uppercase';
const GLYPH: Record<string, string> = { needs: 'text-needs', running: 'text-working', idle: 'text-muted-foreground' };
const COL = {
  now: 'flex min-h-0 min-w-0 flex-none flex-col',
  pipeline:
    'flex min-h-0 min-w-0 flex-col rounded-3xl border border-border bg-panel phone:w-[min(300px,80vw)] phone:flex-none',
};
const HEAD = {
  now: '-top-2.5 sticky z-4 -mx-2.5 flex min-h-10 flex-none items-center gap-2.5 bg-panel px-4',
  pipeline: 'flex min-h-[46px] flex-none items-center gap-2.5 pr-3.5 pl-4',
};
const BODY = {
  now: 'relative flex min-h-0 flex-none flex-col gap-2.5 overflow-visible px-0.5 pt-0.5 pb-3',
  pipeline:
    'relative flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-2.5 pt-1 pb-3 [mask-image:linear-gradient(to_bottom,#000_calc(100%-40px),transparent)]',
};
const COL_NAME =
  'min-w-0 flex-1 font-sans text-[0.84375rem] leading-[1.125rem] font-semibold tracking-[-0.01em] text-foreground';
const GHOSTS = ['h-[116px]', 'h-[92px]', 'h-[76px] opacity-60'];

const glyph = (key: Column, hasWaits = false) => (
  <span
    className={cn(
      'grid size-[18px] flex-none place-items-center',
      GLYPH[key],
      hasWaits && '[&_.core]:origin-[8px_8px] [&_.core]:animate-breathe',
    )}
  >
    <Icon name={`col-${key}`} />
  </span>
);

function Skeleton({ isPipeline }: { isPipeline: boolean }) {
  const at = isPipeline ? 'pipeline' : 'now';
  return COLUMNS.map(({ key, name }) => (
    <section key={key} className={`col col-${key} ${COL[at]}`}>
      <header className={HEAD[at]}>
        {glyph(key)}
        <h2 className={COL_NAME}>{name}</h2>
      </header>
      <div className={BODY[at]}>
        {GHOSTS.map((size) => (
          <div
            key={size}
            className={`card @container relative flex flex-none animate-flow-fast cursor-default flex-col gap-2 rounded-xl border border-transparent px-3.5 py-3 transition-[border-color,background-color] duration-150 ease-[ease] [background:linear-gradient(100deg,var(--card)_40%,var(--card-hover)_50%,var(--card)_60%)_0_0/300%_100%] [box-shadow:none] ${size}`}
          />
        ))}
      </div>
    </section>
  ));
}

function HumanPill({
  card,
  cardKey,
  isSelected,
  registry,
}: {
  card: CardData;
  cardKey: string;
  isSelected: boolean;
  registry: Env['registry'];
}) {
  const isTurn = isYourTurn(card, screen.seenTurn);
  const [go] = actionsOf(card) as [Action | undefined];
  const isDialog = card.waitFor === 'dialog';
  const isAlert = isTurn || isDialog;
  return (
    <div
      className={cn(
        'human-pill inline-flex min-h-7 max-w-full min-w-0 items-center rounded-lg border shadow-raise phone:min-h-[46px]',
        isSelected
          ? 'border-[color-mix(in_srgb,var(--focus)_70%,transparent)]'
          : isDialog
            ? 'border-[color-mix(in_srgb,var(--needs-tint)_55%,transparent)]'
            : 'border-border',
        isDialog ? 'bg-[color-mix(in_srgb,var(--needs-tint)_8%,var(--card))]' : 'bg-card [&:hover]:bg-card-hover',
      )}
      data-state={card.state ?? ''}
      data-wait={card.waitFor ?? ''}
      data-your-turn={isTurn ? '' : undefined}
    >
      <button
        type="button"
        className={cn(
          'inline-flex min-w-0 items-center gap-2 self-stretch rounded-l-lg border-0 bg-transparent py-0 pr-2 pl-[7px] font-sans text-[0.78125rem] leading-none font-medium whitespace-nowrap text-muted-foreground',
          isSelected && 'is-selected',
        )}
        data-key={cardKey}
        title="Show the details and the screen of this session"
        onClick={() => (isSelected ? closeDetails(true) : openDetails(cardKey))}
      >
        <Mark card={card} registry={registry} />
        <span
          className={cn(
            'max-w-[14em] shrink-0 overflow-hidden leading-[1.3] text-ellipsis text-foreground phone:min-w-0 phone:shrink',
            isTurn && 'font-semibold',
          )}
        >
          {card.title || 'A session'}
        </span>
        <i
          className={cn(
            'size-1.5 flex-none rounded-[50%]',
            isAlert ? 'bg-needs' : card.state === 'works' ? 'bg-working' : 'bg-muted-foreground',
          )}
        />
        <span
          className={cn(
            'min-w-0 flex-[0_100_auto] overflow-hidden text-ellipsis phone:flex-none',
            isAlert ? 'text-needs' : card.state === 'works' && 'text-working',
          )}
        >
          {isTurn ? 'your turn' : stateLabel(card)}
        </span>
      </button>
      <Timed
        iso={card.since}
        isFine={LIVE.has(card.state as string)}
        className="mr-1.5 flex-none font-mono text-[0.71875rem] leading-none font-normal text-muted-foreground normal-nums"
      />
      {go && (
        <IconButton
          name="go"
          label={go.name}
          press={() => go.run?.()}
          className="human-go mr-0.5 min-h-[26px] phone:min-h-11 phone:w-11"
        />
      )}
    </div>
  );
}

type Place = Pick<CardProps, 'column' | 'isCompact' | 'level' | 'isHold'>;

const cardAt = (target: EventTarget | null) =>
  target instanceof Element ? target.closest<HTMLElement>('.card[data-key]') : null;

const useColumnEvents = (columns: RefObject<HTMLDivElement | null>) =>
  useEffect(() => {
    const board = columns.current;
    if (!board) return;
    const click = (event: MouseEvent) => {
      const key = cardAt(event.target)?.dataset.key;
      if (key === undefined || (event.target as Element).closest('a, button')) return;
      if (shellStore.get().shell.details === key) closeDetails(true);
      else openDetails(key);
    };
    const menu = (event: MouseEvent) => {
      const node = cardAt(event.target);
      const key = node?.dataset.key;
      if (key === undefined || !screen.index().byKey.has(key)) return;
      event.preventDefault();
      screen.openMenu(key, 'actions', Boolean(node?.classList.contains('compact')));
    };
    const focus = (event: FocusEvent) => {
      const stop = (event.target as Element).closest<HTMLElement>(STOPS);
      const col = stop?.closest('.col');
      if (stop && col && isStop(stop)) screen.setColumnStop(columnId(col), stopKey(stop));
      const key = cardAt(event.target)?.dataset.key ?? null;
      if (key !== null && screen.isUnseen(key)) screen.markSeen(key);
      showHints(key);
    };
    const blur = (event: FocusEvent) => {
      if (board.contains(event.relatedTarget as Node | null)) return;
      // A moved card loses the focus inside a commit and gets it back in the same task; a store emit there skips the card move.
      queueMicrotask(() => {
        if (!board.contains(document.activeElement)) showHints(null);
      });
    };
    const over = (event: PointerEvent) => {
      const key = (event.target as Element).closest<HTMLElement>('.card[data-key].is-unseen')?.dataset.key;
      if (key !== undefined) screen.markSeen(key);
    };
    board.addEventListener('click', click);
    board.addEventListener('contextmenu', menu);
    board.addEventListener('focusin', focus);
    board.addEventListener('focusout', blur);
    board.addEventListener('pointerover', over);
    return () => {
      board.removeEventListener('click', click);
      board.removeEventListener('contextmenu', menu);
      board.removeEventListener('focusin', focus);
      board.removeEventListener('focusout', blur);
      board.removeEventListener('pointerover', over);
    };
  }, [columns]);

// A poll gives a new read each time; its unchanged parts keep their references, so the cards keep theirs.
const useEnv = (read: ScreenState['read']): Env | null => {
  const registry = read?.registry;
  const flow = read?.flow ?? null;
  const auto = read?.daemon.auto ?? 'off';
  const agents = read?.agents ?? null;
  const noRun = read?.noRun ?? null;
  const record = read?.queue?.record;
  const next = read?.next ?? null;
  const starts = read?.starts ?? null;
  const tracker = read?.tracker ?? null;
  return useMemo(
    () => (registry === undefined ? null : { registry, flow, auto, agents, noRun, record, next, starts, tracker }),
    [registry, flow, auto, agents, noRun, record, next, starts, tracker],
  );
};

export function Board() {
  const shell = useShellStore((state) => state.shell);
  const read = useScreen((state) => state.read);
  const launches = useScreen((state) => state.launches);
  useScreen((state) => state.seen);
  useScreen((state) => state.turns);
  const openEpics = useScreen((state) => state.openEpics);
  const asides = useScreen((state) => state.asides);
  const stops = useScreen((state) => state.stops);
  const refusals = useScreen((state) => state.refusals);
  const startFailures = useScreen((state) => state.startFailures);
  const menu = useScreen((state) => state.menu);
  const columnStops = useScreen((state) => state.columnStops);
  const columns = useRef<HTMLDivElement>(null);
  const isPipeline = shell.tab === 'pipeline';
  useRescue(menu);
  useColumnEvents(columns);
  const measure = useMeasure(columns, isPipeline);
  const env = useEnv(read);
  const live = read && screen.board();
  const now = useMemo(() => ({ read, board: live }), [read, live]);
  const [shown, setShown] = useState(now);
  const isCalm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  // A held commit comes after the menu closed, and the rescue would read the focus after the menu took it away.
  const isHeld =
    shown.read !== read &&
    shown.board !== null &&
    live !== null &&
    !document.hidden &&
    !isCalm &&
    (menu === null || screen.index().byKey.has(menu.key)) &&
    layoutOf(shown.board, view()) !== layoutOf(live, view());
  // A store emit is a synchronous update, and React animates only an update in startTransition.
  useEffect(() => {
    if (shown === now) return;
    if (isHeld) startTransition(() => setShown(now));
    else setShown(now);
  });
  const board = isHeld ? shown.board : live;
  const heldIndex = useMemo(() => (isHeld && board ? indexCards(board, view()) : null), [isHeld, board]);
  useKeptScroll(() => {
    const root = columns.current?.parentElement;
    return root ? [root, ...root.querySelectorAll<HTMLElement>('.col-body')] : [];
  }, board);
  const boardCls = isPipeline
    ? 'grid min-h-0 flex-1 grid-cols-[repeat(var(--stages),minmax(200px,1fr))] grid-rows-[auto_minmax(0,1fr)] gap-3 overflow-x-auto px-2 [scroll-padding-inline:8px_56px] data-[fade]:[mask-image:linear-gradient(to_right,#000_calc(100%-56px),transparent)] phone:flex phone:gap-2.5'
    : 'flex min-h-0 flex-none flex-col gap-1.5 overflow-visible';
  const humanCls =
    'flex flex-none flex-wrap items-center gap-1.5 rounded-xl border border-border bg-panel py-1.5 pr-2 pl-3 phone:p-2';
  if (!board || !env)
    return (
      <>
        <section className={humanCls} id="human" aria-labelledby="human-title" hidden />
        <div ref={columns} className={boardCls} id="columns" aria-busy="true">
          <Skeleton isPipeline={isPipeline} />
        </div>
      </>
    );
  const { keyOf } = heldIndex ?? screen.index();
  const keyFor = (card: CardData) => {
    const key = keyOf.get(card);
    if (key === undefined)
      throw new Error(`board: card #${card.number ?? card.sessionId} has no key in the card index`);
    return key;
  };

  const cardOf = (card: CardData, place: Place, stop: string | undefined) => {
    const key = keyFor(card);
    const number = card.number;
    const has = (pressed: ReadonlyMap<IssueKey | null, unknown>) => pressed.has(number);
    return (
      <ViewTransition key={key} name={key} default={isCalm ? 'none' : 'auto'}>
        <Card
          card={card}
          cardKey={key}
          {...place}
          isSelected={key === shell.details}
          isUnseen={screen.isUnseen(key)}
          isStop={key === stop}
          isBelow={place.column === 'needs' && !isPipeline && measure.isMeasured ? measure.below.has(key) : undefined}
          isPipeline={isPipeline}
          menu={menu?.key === key ? menu : null}
          env={env}
          isAside={has(asides)}
          isStopping={has(stops)}
          refusal={number === null ? undefined : refusals.get(number)?.line}
          failure={card.sessionId === null && number !== null ? startFailures.get(number) : undefined}
          launch={number === null ? undefined : launches.get(number)}
        />
      </ViewTransition>
    );
  };

  type Item =
    | { kind: 'card'; card: CardData; place: Place }
    | { kind: 'epic'; epic: ParentEpic; scope: string; cards: CardData[]; place: Place };
  const stopOf = (column: string, items: Item[]) => {
    const keys = items.flatMap((item) =>
      item.kind === 'card'
        ? [keyFor(item.card)]
        : [`${item.scope}-${item.epic.number}`, ...(openEpics.has(item.epic.number) ? item.cards.map(keyFor) : [])],
    );
    const kept = columnStops.get(column);
    return kept !== undefined && keys.includes(kept) ? kept : keys[0];
  };
  const itemOf = (item: Item, stop: string | undefined): ReactNode => {
    if (item.kind === 'card') return cardOf(item.card, item.place, stop);
    const { epic, scope, cards } = item;
    const id = `eg-${scope}-${epic.number}`;
    const group = `${scope}-${epic.number}`;
    const isOpen = openEpics.has(epic.number);
    const hasHiddenUnseen = !isOpen && cards.some((card) => screen.isUnseen(keyFor(card)));
    const EPIC_MONO = 'flex-none font-mono text-[0.75rem] leading-[1.125rem] font-normal text-muted-foreground';
    return (
      <div key={id} className="epic-group flex flex-none flex-col gap-2" data-epic={epic.number}>
        <button
          type="button"
          className={cn(
            'epic-row flex min-h-10 phone:min-h-11 w-full cursor-pointer items-start gap-2 rounded-xl border border-border bg-secondary px-3 py-2.5 text-left font-sans text-[0.8125rem] leading-[1.125rem] font-medium text-foreground transition-[border-color,background-color] duration-150 ease-[ease] [&:hover]:border-border-strong [&:hover]:bg-accent [&_.icon]:mt-px [&_.icon]:flex-none [&_.icon]:text-card-foreground [&_.icon]:[transition:transform_0.15s]',
            isOpen && '[&_.icon]:[transform:rotate(90deg)]',
          )}
          tabIndex={group === stop ? 0 : -1}
          id={`${id}-row`}
          data-epic={epic.number}
          data-group={group}
          aria-expanded={isOpen}
          aria-controls={id}
          onClick={() => screen.setEpicOpen(epic.number, !isOpen)}
        >
          <Icon name="chevron" />
          <span className={EPIC_MONO}>{`#${epic.number}`}</span>
          <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">{epic.title}</span>
          <span className={EPIC_MONO}>
            {cards.length}
            <span className="sr-only">{cards.length === 1 ? ' issue' : ' issues'}</span>
          </span>
          <UnseenDot className={hasHiddenUnseen ? 'mt-[5px]' : 'mt-[5px] hidden'} />
        </button>
        {/* biome-ignore lint/a11y/useSemanticElements: a fieldset would change the DOM that the old readers and the styles find */}
        <div
          className="epic-children ml-1.5 flex flex-col gap-2 border-l border-l-border-strong pl-3"
          id={id}
          hidden={!isOpen}
          role="group"
          aria-labelledby={`${id}-row`}
        >
          {cards.map((card) => cardOf(card, item.place, isOpen ? stop : undefined))}
        </div>
      </div>
    );
  };

  const { needs, running, idle, human } = board.columns;
  const agents = () =>
    COLUMNS.map(({ key, name, note, empty: [emptyTitle, emptyText] }) => {
      const cards = board.columns[key];
      const id = `col-${key}`;
      const groups = key === 'needs' ? groupNeeds(cards) : [];
      const items: Item[] =
        key === 'needs'
          ? groups.flatMap((each) =>
              each.cards.map((card) => ({
                kind: 'card' as const,
                card,
                place: { column: key, isCompact: each.isCompact, level: 'h4' as const },
              })),
            )
          : key === 'idle'
            ? groupEpics(cards, () => true).map(
                (item): Item =>
                  item.kind === 'group'
                    ? {
                        kind: 'epic',
                        epic: item.epic,
                        scope: 'idle',
                        cards: item.cards,
                        place: { column: key, isCompact: true, level: 'h3' },
                      }
                    : { kind: 'card', card: item.card, place: { column: key, isCompact: true, level: 'h3' } },
              )
            : cards.map(
                (card): Item => ({ kind: 'card', card, place: { column: key, isCompact: false, level: 'h3' } }),
              );
      const stop = stopOf(id, items);
      return (
        <section key={key} className={`col col-${key} ${COL.now}`} id={id} aria-labelledby={`h-${key}`}>
          <header className={HEAD.now} title={note}>
            {glyph(key, key === 'needs' && cards.some((card) => card.state === 'waits'))}
            <h2 className={COL_NAME} id={`h-${key}`}>
              {name}
            </h2>
            <Badge variant="column">{cards.length}</Badge>
          </header>
          <div className={`col-body ${BODY.now}`}>
            {cards.length === 0 ? (
              <div
                className={cn(
                  'empty mt-1 flex flex-col items-center gap-1 rounded-xl border px-5 py-8 text-center',
                  key === 'needs'
                    ? 'border-solid border-[color-mix(in_srgb,var(--ready)_25%,transparent)] bg-[color-mix(in_srgb,var(--ready)_5%,transparent)] [&_.icon]:text-ready'
                    : 'border-dashed border-border-strong [&_.icon]:text-muted-foreground',
                  '[&_.icon]:mb-1.5 [&_.icon]:size-[22px]',
                )}
                tabIndex={-1}
              >
                <Icon name={key === 'needs' ? 'clear' : `col-${key}`} />
                <p className="m-0 font-sans text-[0.8125rem] leading-[1.4] font-semibold text-foreground">
                  {emptyTitle}
                </p>
                <p className="m-0 max-w-[32ch] text-[0.75rem] leading-normal text-balance text-muted-foreground">
                  {emptyText}
                </p>
              </div>
            ) : key === 'needs' ? (
              <>
                {groups.map((each, at) => (
                  // biome-ignore lint/a11y/useSemanticElements: a fieldset would change the DOM that the old readers and the styles find
                  <div
                    key={each.key}
                    className={cn('group flex flex-col gap-2', at > 0 && 'mt-0.5')}
                    data-group={each.key}
                    data-short={each.short}
                    role="group"
                    aria-labelledby={`g-${each.key}`}
                  >
                    <h3
                      className={cn(
                        'sticky top-[30px] z-3 -mx-3 flex items-center gap-[7px] bg-panel px-4 pt-2.5 pb-2 text-[0.6875rem] leading-none font-semibold tracking-[0.07em] uppercase',
                        each.key === 'answer' ? 'text-needs' : 'text-muted-foreground',
                      )}
                      id={`g-${each.key}`}
                    >
                      <span>{each.label}</span>
                      <span className="font-medium tracking-[0] tabular-nums">{each.cards.length}</span>
                    </h3>
                    {each.cards.map((card) =>
                      cardOf(card, { column: 'needs', isCompact: each.isCompact, level: 'h4' }, stop),
                    )}
                  </div>
                ))}
                <div
                  className="tail-wrap sticky bottom-0 z-3 -mx-3 bg-[linear-gradient(to_bottom,transparent,var(--panel)_35%)] px-3 pt-2.5 pb-3"
                  hidden={measure.text === ''}
                >
                  <button
                    type="button"
                    className="tail flex min-h-[34px] w-full items-center justify-center gap-2 rounded-lg border border-border-strong bg-card font-sans text-[0.78125rem] leading-none font-medium text-card-foreground shadow-raise [&:hover]:border-[color-mix(in_srgb,var(--fg3)_60%,transparent)] [&:hover]:text-foreground [&_.icon]:size-[13px] [&_.icon]:[transform:rotate(90deg)]"
                    onClick={() => {
                      const first = [...document.querySelectorAll<HTMLElement>('.col-needs .card[data-key]')].find(
                        (node) => measure.below.has(node.dataset.key ?? ''),
                      );
                      first?.scrollIntoView({
                        block: 'center',
                        behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
                      });
                      first?.focus({ preventScroll: true });
                    }}
                  >
                    <Icon name="chevron" />
                    <span>{measure.text}</span>
                  </button>
                </div>
              </>
            ) : (
              items.map((item) => itemOf(item, stop))
            )}
          </div>
        </section>
      );
    });

  const where = new Map<CardData, Column>([
    ...needs.map((card): [CardData, Column] => [card, 'needs']),
    ...running.map((card): [CardData, Column] => [card, 'running']),
    ...idle.map((card): [CardData, Column] => [card, 'idle']),
  ]);
  const placeOf = (card: CardData): Place => ({ column: where.get(card) ?? 'idle', isCompact: true, level: 'h3' });
  const stages = () => {
    const { stages: list, hold } = pipeline([...needs, ...running, ...idle], board.flow);
    const holdItems: Item[] = hold.map((card) => ({
      kind: 'card',
      card,
      place: { ...placeOf(card), isHold: true },
    }));
    const holdStop = stopOf('hold-title', holdItems);
    return [
      hold.length > 0 && (
        <section
          key="hold"
          className="col col-span-full flex min-h-0 min-w-0 flex-row items-center gap-3 rounded-3xl border border-border bg-panel py-2 pr-2.5 pl-4 phone:w-[min(300px,80vw)] phone:flex-none phone:flex-col phone:items-stretch"
          aria-labelledby="hold-title"
        >
          <h2 className={HOLD_LABEL} id="hold-title">
            Not in a step
          </h2>
          <div className="flex min-w-0 gap-2 overflow-x-auto p-0.5 phone:flex-col phone:overflow-x-hidden phone:overflow-y-auto">
            {holdItems.map((item) => itemOf(item, holdStop))}
          </div>
        </section>
      ),
      ...list.map((stage) => {
        const items: Item[] = groupEpics(stage.cards, (card) => where.get(card) === 'idle').map(
          (item): Item =>
            item.kind === 'group'
              ? {
                  kind: 'epic',
                  epic: item.epic,
                  scope: `s${stage.key}`,
                  cards: item.cards,
                  place: placeOf(item.cards[0] as CardData),
                }
              : { kind: 'card', card: item.card, place: placeOf(item.card) },
        );
        const stop = stopOf(`s-${stage.key}`, items);
        return (
          <section key={stage.key} className={`col ${COL.pipeline}`} aria-labelledby={`s-${stage.key}`}>
            <header className={HEAD.pipeline} title={stage.steps.join(', ')}>
              <h2 className={COL_NAME} id={`s-${stage.key}`}>
                {stage.name}
              </h2>
              <Badge variant="column">{stage.cards.length}</Badge>
            </header>
            <div className={`col-body ${BODY.pipeline}`}>
              {stage.cards.length ? (
                items.map((item) => itemOf(item, stop))
              ) : (
                <p className="mx-0.5 my-1 rounded-xl border border-dashed border-border-strong p-3.5 text-center text-[0.75rem] text-muted-foreground">
                  No issue at this step
                </p>
              )}
            </div>
          </section>
        );
      }),
    ];
  };

  return (
    <>
      <section className={humanCls} id="human" aria-labelledby="human-title" hidden={human.length === 0}>
        {human.length > 0 && (
          <h2 className={`${HOLD_LABEL} mr-1.5 phone:my-0.5 phone:mr-0 phone:ml-1.5 phone:basis-full`} id="human-title">
            Human sessions
          </h2>
        )}
        {human.map((card) => {
          const key = keyFor(card);
          return (
            <HumanPill key={key} card={card} cardKey={key} isSelected={key === shell.details} registry={env.registry} />
          );
        })}
      </section>
      <div
        ref={columns}
        className={boardCls}
        id="columns"
        data-view={isPipeline ? 'pipeline' : 'now'}
        data-fade={measure.fade ? '' : undefined}
        aria-busy="false"
        style={{ '--stages': String(Math.max(1, board.flow?.stages.length ?? 0)) } as CSSProperties}
      >
        {isPipeline ? stages() : agents()}
      </div>
    </>
  );
}
