import { type FocusEvent, useLayoutEffect, useRef } from 'react';
import type { Board, Card as BoardCard } from '../../types.ts';
import { agentOf, keyOf, stateLabel } from '../../view.ts';
import { facts, type Kind, sparkPath, type Tile, tileOf } from '../home.ts';
import { shellStore, useShellStore } from '../store.ts';
import { Button } from '../ui/button.tsx';
import { Card, CardTitle } from '../ui/card.tsx';
import { Icon } from './icon.tsx';

const KINDS: readonly Kind[] = ['needs', 'working', 'landed', 'median'];
const PAD = 'p-[12px_14px] [box-shadow:var(--raise)] phone:p-[12px_14px]';
const LIST = 'mt-2 mb-0 list-none p-0 [&>li+li]:border-t [&>li+li]:border-t-border';
const EMPTY = 'mt-2 mb-0 text-[0.78125rem] text-muted-foreground';
const TITLE = 'm-0 text-[0.8125rem] leading-[1.4] text-foreground wrap-anywhere text-pretty';
const META = 'm-0 block font-mono text-[0.75rem] leading-[1.4] font-normal wrap-anywhere';
const SMALL = 'm-0 text-[0.75rem] leading-normal';

const open = (card: BoardCard) => shellStore.handlers().open(keyOf(card));

type ListId = 'home-needs' | 'home-agents';
type Spot = { list: ListId; index: number; key: string; node: HTMLElement };

const rowOf = (event: FocusEvent<HTMLUListElement>) => {
  const node = (event.target as HTMLElement).closest('li');
  return node?.parentElement === event.currentTarget ? node : null;
};

function TileCard({ tile }: { tile: Tile }) {
  const spark = tile.state.kind === 'line' ? sparkPath(tile.state.points) : null;
  return (
    <Card className={PAD} role="group" aria-label={tile.name}>
      <CardTitle>{tile.label}</CardTitle>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
        <p className="my-0 mr-auto ml-0 font-mono text-[1.5rem] leading-8 font-semibold text-foreground">
          {tile.value}
        </p>
        {tile.state.kind !== 'line' && (
          <p className="m-0 text-[0.8125rem] leading-[1.4] text-muted-foreground">{tile.state.text}</p>
        )}
        {spark && (
          <>
            <svg
              className="h-8 w-24 flex-none fill-none stroke-card-foreground stroke-[1.5] [stroke-linecap:round] [stroke-linejoin:round]"
              viewBox="0 0 96 32"
              aria-hidden="true"
            >
              <path d={spark.d} />
              <circle
                className="fill-foreground stroke-none"
                cx={String(spark.dot.x)}
                cy={String(spark.dot.y)}
                r="2.5"
              />
            </svg>
            <span
              className="font-mono text-[0.6875rem] leading-none font-normal text-card-foreground"
              aria-hidden="true"
            >
              {spark.last % 1 ? spark.last.toFixed(1) : String(spark.last)}
            </span>
          </>
        )}
      </div>
      <p className="mt-1 mb-0 text-[0.75rem] leading-normal text-card-foreground">{tile.unit}</p>
      {tile.change && (
        <p className={`${SMALL} flex items-center gap-1 text-card-foreground`}>
          {tile.change.dir && <Icon name={tile.change.dir === 'up' ? 'trend-up' : 'trend-down'} />}
          <span>{tile.change.text}</span>
        </p>
      )}
      <p className={`${SMALL} text-muted-foreground`}>{tile.window}</p>
    </Card>
  );
}

function NeedsRow({ card }: { card: BoardCard }) {
  const meta = stateLabel(card) ?? card.reason ?? '';
  return (
    <li className="flex min-h-11 items-center gap-3 py-2" data-key={keyOf(card)}>
      <div className="min-w-0 flex-1">
        <p className={TITLE}>{card.title}</p>
        <p className={`${META} text-needs`}>{card.number === null ? meta : `#${card.number} · ${meta}`}</p>
      </div>
      <Button
        className="min-h-7 hover:opacity-[0.88] [&:hover]:opacity-[0.88] phone:h-11 phone:min-h-11 phone:min-w-11"
        aria-label={`Open #${card.number} ${card.title}`}
        onClick={() => open(card)}
      >
        Open
      </Button>
    </li>
  );
}

function AgentRow({ card, board }: { card: BoardCard; board: Board }) {
  const meta = [card.step, agentOf(card, board.registry)?.name, stateLabel(card)].filter(Boolean).join(' · ');
  return (
    <li data-key={keyOf(card)}>
      <button
        type="button"
        className="flex min-h-11 w-full flex-col items-start justify-center gap-0.5 [border:0] bg-transparent px-0 py-2 text-start"
        onClick={() => open(card)}
      >
        <span className={`${TITLE} [button:hover>&]:underline`}>{`#${card.number} ${card.title}`}</span>
        <span className={`${META} text-working`}>{meta}</span>
      </button>
    </li>
  );
}

export function Home() {
  const board = useShellStore((state) => state.inputs.board);
  const needs = board?.columns.needs ?? [];
  const running = board?.columns.running ?? [];
  const spot = useRef<Spot | null>(null);
  const lists = { 'home-needs': useRef<HTMLUListElement>(null), 'home-agents': useRef<HTMLUListElement>(null) };
  const rows = (list: ListId) => [...(lists[list].current?.children ?? [])] as HTMLElement[];
  const focusIn = (list: ListId) => (event: FocusEvent<HTMLUListElement>) => {
    const node = rowOf(event);
    if (node) spot.current = { list, index: rows(list).indexOf(node), key: node.dataset.key ?? '', node };
  };
  const focusOut = (event: FocusEvent<HTMLUListElement>) => {
    const node = rowOf(event);
    queueMicrotask(() => {
      if (spot.current?.node === node && node?.isConnected) spot.current = null;
    });
  };
  useLayoutEffect(() => {
    const was = spot.current;
    if (!was) return;
    if (was.node.isConnected) {
      was.index = rows(was.list).indexOf(was.node);
      return;
    }
    spot.current = null;
    if (document.activeElement !== document.body || !document.getElementById('area-home')?.checkVisibility()) return;
    const mine = rows(was.list);
    const row =
      mine.find((each) => each.dataset.key === was.key) ??
      mine[Math.min(was.index, mine.length - 1)] ??
      rows(was.list === 'home-needs' ? 'home-agents' : 'home-needs')[0];
    (row?.querySelector('button') ?? document.getElementById('work'))?.focus({ preventScroll: true });
  }, [board]);
  return (
    <section
      className="area-screen flex flex-col place-items-stretch gap-3 overflow-auto p-5 phone:scroll-pb-[calc(var(--dock)+8px)] phone:p-3"
      id="area-home"
      aria-labelledby="area-home-title"
    >
      <h2 className="text-sm leading-[1.38] font-semibold tracking-[-0.012em] text-foreground" id="area-home-title">
        Home
      </h2>
      <div
        className="grid grid-cols-[minmax(0,1fr)] gap-3 empty:hidden min-[720px]:grid-cols-2 min-[1200px]:grid-cols-4 phone:order-2"
        id="home-tiles"
      >
        {board && KINDS.map((kind) => <TileCard key={kind} tile={tileOf(kind, board)} />)}
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-3 [align-items:start] wide:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] phone:contents">
        <Card className={`${PAD} phone:order-1`} id="home-needs" aria-labelledby="home-needs-title">
          <CardTitle id="home-needs-title">Needs you</CardTitle>
          <ul
            className={LIST}
            id="home-needs-list"
            hidden={board !== null && needs.length === 0}
            ref={lists['home-needs']}
            onFocus={focusIn('home-needs')}
            onBlur={focusOut}
          >
            {needs.map((card) => (
              <NeedsRow key={keyOf(card)} card={card} />
            ))}
          </ul>
          <p className={EMPTY} id="home-needs-empty" hidden={board === null || needs.length > 0}>
            No issue needs you.
          </p>
        </Card>
        <div className="grid min-w-0 gap-3 phone:order-3">
          <Card className={PAD} id="home-agents" aria-labelledby="home-agents-title">
            <CardTitle id="home-agents-title">Agents now</CardTitle>
            <ul
              className={LIST}
              id="home-agents-list"
              hidden={board !== null && running.length === 0}
              ref={lists['home-agents']}
              onFocus={focusIn('home-agents')}
              onBlur={focusOut}
            >
              {board && running.map((card) => <AgentRow key={keyOf(card)} card={card} board={board} />)}
            </ul>
            <p className={EMPTY} id="home-agents-empty" hidden={board === null || running.length > 0}>
              No agent works now.
            </p>
          </Card>
          <Card className={PAD} id="home-system" aria-labelledby="home-system-title">
            <CardTitle id="home-system-title">System</CardTitle>
            <dl className="mt-2 mb-0" id="home-system-facts">
              {board &&
                facts(board).map(([name, value]) => (
                  <div className="flex min-h-7 items-center justify-between gap-3 text-[0.8125rem]" key={name}>
                    <dt className="text-muted-foreground">{name}</dt>
                    <dd className="m-0 text-end text-foreground wrap-anywhere">{value}</dd>
                  </div>
                ))}
            </dl>
          </Card>
        </div>
      </div>
    </section>
  );
}
