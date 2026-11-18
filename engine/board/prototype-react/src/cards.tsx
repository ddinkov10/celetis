import { cn } from 'cn';
import { useState } from 'react';
import type { Board, Card, Column, ParentEpic } from '../../types.ts';
import { AGENT_ICONS } from '../../page/ui.ts';
import {
  age,
  agentOf,
  COLUMNS,
  groupEpics,
  groupNeeds,
  knownAgent,
  LIVE,
  laneTrack,
  startName,
  stateLabel,
} from '../../view.ts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { mainAction } from './data.ts';
import { Icon } from './icon.tsx';

const STATUS_ICONS: Record<string, string> = {
  works: 'works',
  starts: 'works',
  waits: 'target',
  'no-progress': 'alert',
  stopping: 'stop',
  'dirty-tree': 'diff',
  blocked: 'person',
  'quota-wait': 'clock',
};
const TYPES: Record<string, string> = { bug: 'bug', feature: 'spark', chore: 'wrench', hotfix: 'flame' };
const STATE_TEXT: Record<string, string> = {
  works: 'text-working',
  waits: 'text-needs',
  blocked: 'text-needs',
  'dirty-tree': 'text-amber',
  'no-progress': 'text-destructive',
};
const NOW_SEG: Record<string, string> = {
  works:
    'bg-[linear-gradient(90deg,var(--working)_30%,color-mix(in_srgb,var(--working)_75%,var(--card))_50%,var(--working)_70%)] bg-size-[300%_100%] animate-[flow_1.6s_linear_infinite]',
  waits: 'bg-needs',
  blocked: 'bg-needs',
  'no-progress': 'bg-destructive',
  'dirty-tree': 'bg-amber',
  starts: 'bg-transparent shadow-[inset_0_0_0_1.5px_var(--working)]',
};

const Sep = () => <span className="opacity-60">·</span>;

export function Mark({ board, card, decorative = false }: { board: Board; card: Card; decorative?: boolean }) {
  const agent = agentOf(card, board.registry);
  const base = 'grid min-h-[18px] w-[18px] flex-none place-items-center rounded-xs text-ink-muted';
  if (agent) {
    const known = knownAgent(board.registry, card.agent) ? card.agent : null;
    if (!known)
      return (
        <span className={cn(base, 'bg-accent text-[0.6875rem] leading-none font-semibold text-foreground shadow-[inset_0_0_0_1px_var(--input)]')} title={agent.name}>
          {agent.letter}
        </span>
      );
    return (
      <span className={cn(base, known === 'opencode' && 'bg-accent shadow-[inset_0_0_0_1px_var(--input)]')} title={agent.name}>
        <img src={AGENT_ICONS[known]} alt={decorative ? '' : agent.name} className={known === 'opencode' ? 'size-3' : 'size-[18px] object-contain'} />
      </span>
    );
  }
  const name = card.type && TYPES[card.type] ? TYPES[card.type] : card.number === null ? 'terminal' : 'nolane';
  return (
    <span className={base} title={!card.type && card.number !== null ? 'No lane yet' : undefined}>
      <Icon name={name as string} className="size-[13px]" />
    </span>
  );
}

function Track({ board, card }: { board: Board; card: Card }) {
  const steps = laneTrack(card, board.flow);
  if (!steps) return null;
  const at = steps.findIndex((step) => step.state === 'now');
  return (
    <span
      role="img"
      aria-label={`Step ${at + 1} of ${steps.length}: ${steps[at]?.name}`}
      title={steps.map((step) => (step.state === 'next' ? step.name : `${step.name} (${step.state === 'now' ? 'now' : 'done'})`)).join(' · ')}
      className="ml-auto inline-flex flex-none items-center gap-[3px] pl-2"
    >
      {steps.map((step, index) => (
        <i
          key={index}
          className={cn(
            'h-1.5 w-3.5 rounded-[3px]',
            step.state === 'done' && 'bg-muted-foreground',
            step.state === 'next' && 'shadow-[inset_0_0_0_1px_var(--muted-foreground)]',
            step.state === 'now' && cn('w-5 bg-foreground', NOW_SEG[card.state as string]),
          )}
        />
      ))}
    </span>
  );
}

function StartLabel({ card }: { card: Card }) {
  const pair = card.effort;
  if (!pair) return null;
  const parts = [
    ['model', pair.model],
    ['level', pair.level],
  ] as const;
  return (
    <span role="img" aria-label={startName(pair)} title={startName(pair)} className="inline-flex min-h-[18px] cursor-help items-stretch font-mono text-[0.6875rem] leading-none font-medium whitespace-nowrap">
      {parts.map(([part, value], index) => {
        const isDefault = pair.source[part] === 'default';
        const prevDefault = index === 1 && pair.source.model === 'default';
        return (
          <span
            key={part}
            className={cn(
              'inline-flex items-center gap-[3px] px-[7px]',
              part === 'model' ? 'rounded-l-[9px] bg-[color-mix(in_srgb,var(--foreground)_17%,transparent)] text-foreground' : 'rounded-r-[9px] bg-accent text-ink-muted',
              index === 1 && !isDefault && !prevDefault && 'ml-px',
              isDefault && 'border border-dashed border-current bg-transparent px-1.5 text-muted-foreground',
              isDefault && prevDefault && 'border-l-0 pl-[7px]',
            )}
          >
            {pair.source[part] === 'pinned' && <Icon name="pin" className="size-[9px]" />}
            <span>{value}</span>
          </span>
        );
      })}
    </span>
  );
}

function Gate({ board }: { board: Board }) {
  const on = board.daemon.auto === 'on';
  return (
    <span
      title={on ? 'Auto mode of the daemon starts this step by itself' : 'Auto mode is off: this step waits for Run.'}
      className={cn(
        'inline-flex min-h-[18px] cursor-help items-center rounded-xs px-1.5 font-sans text-[0.6875rem] leading-none font-medium',
        on ? 'bg-[color-mix(in_srgb,var(--ready)_13%,transparent)] text-ready' : 'border border-dashed border-input text-ink-muted',
      )}
    >
      {on ? 'auto' : 'auto off'}
    </span>
  );
}

function Status({ board, card, glyph = true, short = false, compact = false }: { board: Board; card: Card; glyph?: boolean; short?: boolean; compact?: boolean }) {
  const label = stateLabel(card);
  if (card.state) {
    const agent = agentOf(card, board.registry);
    return (
      <span
        className={cn(
          'inline-flex min-w-0 items-center gap-[7px] overflow-hidden font-sans text-xs leading-[1.2] font-medium *:flex-none *:whitespace-nowrap *:last:min-w-0 *:last:flex-[0_1_auto] *:last:truncate',
          compact ? 'text-muted-foreground' : 'text-ink-muted',
          STATE_TEXT[card.state],
        )}
      >
        {glyph && (
          <Icon
            name={STATUS_ICONS[card.state] ?? 'pending'}
            className={cn('size-[13px]', card.state === 'starts' && 'animate-spin text-working')}
          />
        )}
        <span className="first-letter:uppercase">{label}</span>
        {!short && agent && (
          <span className="font-normal text-muted-foreground before:mr-[7px] before:opacity-70 before:content-['·'] @max-[360px]:sr-only">{agent.name}</span>
        )}
        {!short && card.step && card.step !== card.type && (
          <span className="font-mono text-[0.95em] font-normal text-muted-foreground before:mr-[7px] before:opacity-70 before:content-['·'] @max-[300px]:hidden">{card.step}</span>
        )}
      </span>
    );
  }
  if (!card.step) return null;
  return (
    <span className={cn('inline-flex items-center gap-1 font-sans text-xs leading-[1.2] font-medium text-ink-muted', compact && 'flex-wrap gap-y-1 text-muted-foreground')}>
      {glyph && <Icon name="pending" className="size-[13px] text-muted-foreground" />}
      <span className="font-normal text-muted-foreground">next</span>
      <span className="font-mono text-[0.95em] font-normal text-foreground">{card.step}</span>
      {card.effort && <StartLabel card={card} />}
      {card.gate === 'auto' && <Gate board={board} />}
    </span>
  );
}

function Time({ iso, now, fine }: { iso: string; now: number; fine: boolean }) {
  return (
    <time dateTime={iso} className="font-mono text-[0.71875rem] leading-none text-muted-foreground tabular-nums">
      {age(iso, now, fine)}
    </time>
  );
}

function ActionButton({ board, card, quiet }: { board: Board; card: Card; quiet: boolean }) {
  const action = mainAction(board, card);
  if (!action) return null;
  return (
    <Button
      variant={quiet ? 'outline' : 'default'}
      aria-label={action.name}
      aria-disabled={action.isDisabled || undefined}
      className="phone:h-11 phone:min-w-11"
    >
      <Icon name={action.icon} />
      <span>{action.label}</span>
    </Button>
  );
}

const cardBase =
  'relative flex flex-none flex-col gap-2 rounded-xl border border-border bg-card px-3.5 py-3 shadow-sm transition-colors duration-150 @container hover:border-input hover:bg-card-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring data-[state=waits]:isolate data-[state=waits]:border-[color-mix(in_srgb,var(--needs-tint)_55%,transparent)] data-[state=waits]:bg-[color-mix(in_srgb,var(--needs-tint)_6%,var(--card))] data-[state=waits]:[--muted-foreground:var(--fg2)] data-[state=waits]:before:pointer-events-none data-[state=waits]:before:absolute data-[state=waits]:before:inset-0 data-[state=waits]:before:-z-1 data-[state=waits]:before:rounded-[inherit] data-[state=waits]:before:bg-[color-mix(in_srgb,var(--needs-tint)_10%,transparent)] data-[state=waits]:before:content-[""] data-[state=waits]:before:animate-[attention_3s_cubic-bezier(0.45,0,0.55,1)_infinite]';

function Title({ card, compact, as: Tag = 'h3' }: { card: Card; compact: boolean; as?: 'h3' | 'h4' }) {
  const text = card.title || `Issue #${card.number}`;
  return (
    <Tag
      title={text}
      className={cn(
        'm-0 line-clamp-2 min-w-0 text-pretty text-foreground',
        compact ? 'text-sm leading-[1.125rem] font-medium tracking-[-0.012em]' : 'text-base font-semibold tracking-[-0.012em]',
      )}
    >
      {card.url ? (
        <a href={card.url} target="_blank" rel="noreferrer" className="hover:underline hover:decoration-input hover:underline-offset-3">
          {text}
        </a>
      ) : (
        text
      )}
    </Tag>
  );
}

function Num({ card }: { card: Card }) {
  const text = `#${card.number}`;
  return card.url ? (
    <a href={card.url} target="_blank" rel="noreferrer" className="inline-flex min-h-6 min-w-6 items-center whitespace-nowrap text-ink-muted tabular-nums hover:text-foreground">
      {text}
    </a>
  ) : (
    <span className="whitespace-nowrap text-ink-muted">{text}</span>
  );
}

export function CompactCard({ board, card, column, level = 'h3' }: { board: Board; card: Card; column: Column; level?: 'h3' | 'h4' }) {
  return (
    <article
      tabIndex={-1}
      data-state={card.state ?? 'next'}
      className={cn(cardBase, 'grid grid-cols-[18px_minmax(0,1fr)_auto] items-center gap-x-2.5 gap-y-[5px] py-2.5 pr-2.5 pl-3')}
    >
      <Mark board={board} card={card} />
      <Title card={card} compact as={level} />
      <div className="col-[2/-1] flex min-w-0 flex-wrap items-center gap-1.5 gap-y-1 overflow-hidden font-mono text-xs leading-[1.3] text-muted-foreground *:flex-none *:whitespace-nowrap">
        <Num card={card} />
        {card.type && card.type !== card.step && (
          <span className="inline-flex gap-1.5 @max-[340px]:hidden">
            <Sep />
            {card.type}
          </span>
        )}
        {card.state && <Sep />}
        <span className="flex-[0_1_auto]!">
          <Status board={board} card={card} glyph={card.state === 'starts'} short compact />
        </span>
      </div>
      <div className="col-start-3 row-start-1">
        <ActionButton board={board} card={card} quiet={column !== 'needs'} />
      </div>
    </article>
  );
}

export function FullCard({ board, card, column, now }: { board: Board; card: Card; column: Column; now: number }) {
  return (
    <article tabIndex={-1} data-state={card.state ?? 'next'} className={cardBase}>
      <div className="flex h-[18px] min-w-0 items-center gap-[7px] font-mono phone:h-auto phone:min-h-8 text-[0.71875rem] leading-none text-muted-foreground">
        <Mark board={board} card={card} decorative={Boolean(card.state)} />
        <Num card={card} />
        {card.type && (
          <>
            <Sep />
            <span className="min-w-0 truncate">{card.type}</span>
          </>
        )}
        <Track board={board} card={card} />
        <Button variant="ghost" size="icon" aria-label="More actions (m)" aria-haspopup="menu" className="-my-[5px] -mr-1.5 phone:-my-1.5 phone:-mr-2 phone:size-11">
          <Icon name="dots" />
        </Button>
      </div>
      <Title card={card} compact={false} />
      {card.state === 'works' && card.diff && (
        <div title="Changed since the branch left its base" className="flex min-h-[18px] min-w-0 items-center gap-2 font-mono text-xs leading-none text-ink-muted">
          <Icon name="diff" className="size-[13px] text-working" />
          <span className="min-w-0 flex-1 truncate">
            {card.diff.files} {card.diff.files === 1 ? 'file' : 'files'} changed
          </span>
          <span className="ml-auto flex-none text-muted-foreground tabular-nums">
            <i className="text-ink-muted not-italic">+{card.diff.added}</i> −{card.diff.removed}
          </span>
        </div>
      )}
      {card.act && card.state !== 'no-progress' && <p className="m-0 text-xs text-ink-muted">{card.act}</p>}
      {card.warning && <p className="m-0 text-xs text-amber">{card.warning}</p>}
      <div className="flex min-h-7 items-center justify-between gap-2.5 @max-[360px]:flex-col @max-[360px]:items-stretch">
        <Status board={board} card={card} />
        <div className="flex flex-none items-center gap-2 @max-[360px]:justify-end">
          {card.state !== 'starts' && (
            <span className="mr-0.5 @max-[360px]:mr-auto">
              <Time iso={card.since} now={now} fine={Boolean(card.sessionId) && LIVE.has(card.state as string)} />
            </span>
          )}
          <ActionButton board={board} card={card} quiet={column !== 'needs'} />
        </div>
      </div>
    </article>
  );
}

const labelClass = 'font-sans text-[0.6875rem] leading-none font-semibold tracking-[0.07em] text-muted-foreground uppercase';

function EpicGroup({ board, epic, cards }: { board: Board; epic: ParentEpic; cards: Card[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2.5 rounded-xl border border-border bg-secondary px-3 py-2.5 text-left text-sm text-foreground hover:border-input hover:bg-accent phone:min-h-11"
      >
        <Icon name="chevron" className={cn('text-muted-foreground transition-transform duration-150', open && 'rotate-90')} />
        <span className="font-mono text-xs text-ink-muted">#{epic.number}</span>
        <span className="min-w-0 flex-1 font-medium">{epic.title}</span>
        <Badge variant="count">
          {cards.length}
          <span className="sr-only">{cards.length === 1 ? ' issue' : ' issues'}</span>
        </Badge>
      </button>
      {open && (
        <div role="group" className="ml-1.5 flex flex-col gap-2 border-l border-input pl-3">
          {cards.map((card) => (
            <CompactCard key={card.number} board={board} card={card} column="idle" />
          ))}
        </div>
      )}
    </div>
  );
}

const GLYPH: Record<string, string> = { needs: 'text-needs', running: 'text-working', idle: 'text-muted-foreground' };

function Empty({ column, copy: [title, text] }: { column: Column; copy: [string, string] }) {
  return (
    <div
      className={cn(
        'mt-1 flex flex-col items-center gap-1 rounded-xl border border-dashed border-input px-5 py-8 text-center',
        column === 'needs' && 'border-solid border-[color-mix(in_srgb,var(--ready)_25%,transparent)] bg-[color-mix(in_srgb,var(--ready)_5%,transparent)]',
      )}
    >
      <Icon name={column === 'needs' ? 'clear' : `col-${column}`} className={cn('mb-1.5 size-[22px] text-muted-foreground', column === 'needs' && 'text-ready')} />
      <p className="m-0 text-sm leading-[1.4] font-semibold text-foreground">{title}</p>
      <p className="m-0 max-w-[32ch] text-xs text-balance text-muted-foreground">{text}</p>
    </div>
  );
}

export function AgentsColumns({ board, now }: { board: Board; now: number }) {
  return (
    <div className="flex flex-none flex-col gap-1.5">
      {COLUMNS.map((column) => {
        const cards = board.columns[column.key];
        return (
          <section key={column.key} aria-labelledby={`h-${column.key}`} className="flex flex-none flex-col">
            <header title={column.note} className="sticky -top-2.5 z-4 -mx-2.5 flex min-h-10 items-center gap-2.5 bg-panel px-4">
              <span
                className={cn(
                  'grid size-[18px] flex-none place-items-center',
                  GLYPH[column.key],
                  column.key === 'needs' && cards.some((card) => card.state === 'waits') && '[&_.core]:origin-[8px_8px] [&_.core]:animate-[breathe_2.4s_cubic-bezier(0.45,0,0.55,1)_infinite]',
                )}
              >
                <Icon name={`col-${column.key}`} />
              </span>
              <h2 id={`h-${column.key}`} className="m-0 min-w-0 flex-1 text-[0.84375rem] leading-[1.125rem] font-semibold tracking-[-0.01em] text-foreground">
                {column.name}
              </h2>
              <Badge variant="count">{cards.length}</Badge>
            </header>
            <div className="flex flex-col gap-2.5 px-0.5 pt-0.5 pb-3">
              {cards.length === 0 && <Empty column={column.key} copy={column.empty} />}
              {column.key === 'needs' &&
                groupNeeds(cards).map((group) => (
                  <div key={group.key} role="group" aria-labelledby={`g-${group.key}`} className="mt-0.5 flex flex-col gap-2 first:mt-0">
                    <h3
                      id={`g-${group.key}`}
                      className={cn(labelClass, 'sticky top-[30px] z-3 -mx-3 flex items-center gap-[7px] bg-panel px-4 pt-2.5 pb-2 leading-none', group.key === 'answer' && 'text-needs')}
                    >
                      <span>{group.label}</span>
                      <span className="font-medium tracking-normal">{group.cards.length}</span>
                    </h3>
                    {group.cards.map((card) =>
                      group.isCompact ? (
                        <CompactCard key={card.number ?? card.sessionId} board={board} card={card} column="needs" level="h4" />
                      ) : (
                        <FullCard key={card.number ?? card.sessionId} board={board} card={card} column="needs" now={now} />
                      ),
                    )}
                  </div>
                ))}
              {column.key === 'running' &&
                cards.map((card) => <FullCard key={card.number ?? card.sessionId} board={board} card={card} column="running" now={now} />)}
              {column.key === 'idle' &&
                groupEpics(cards, () => true).map((item) =>
                  item.kind === 'group' ? (
                    <EpicGroup key={`e${item.epic.number}`} board={board} epic={item.epic} cards={item.cards} />
                  ) : (
                    <CompactCard key={item.card.number ?? item.card.sessionId} board={board} card={item.card} column="idle" />
                  ),
                )}
            </div>
          </section>
        );
      })}
    </div>
  );
}

export function HumanStrip({ board, now }: { board: Board; now: number }) {
  const cards = board.columns.human;
  if (cards.length === 0) return null;
  return (
    <section aria-labelledby="human-title" className="m-0 flex flex-none flex-wrap items-center gap-1.5 rounded-xl border border-border bg-panel py-1.5 pr-2 pl-3 phone:p-2">
      <h2 id="human-title" className={cn(labelClass, 'm-0 mr-1.5 leading-none phone:mx-1.5 phone:my-0.5 phone:basis-full')}>
        Human sessions
      </h2>
      {cards.map((card) => {
        const isWorks = card.state === 'works';
        return (
          <div key={card.sessionId} className="inline-flex min-h-7 max-w-full phone:min-h-[46px] min-w-0 items-center rounded-lg border border-border bg-card shadow-sm hover:bg-card-hover">
            <button
              type="button"
              title="Show the details and the screen of this session"
              className="inline-flex min-w-0 items-center gap-2 self-stretch rounded-l-lg border-0 bg-transparent pr-2 pl-[7px] text-[0.78125rem] leading-none font-medium whitespace-nowrap text-muted-foreground"
            >
              <Mark board={board} card={card} />
              <span className="max-w-[14em] shrink-0 truncate leading-[1.3] text-foreground phone:min-w-0 phone:shrink">{card.title || 'A session'}</span>
              <i className={cn('size-1.5 flex-none rounded-full bg-muted-foreground', isWorks && 'bg-working')} />
              <span className={cn('min-w-0 flex-[0_100_auto] truncate phone:flex-none', isWorks && 'text-working')}>{stateLabel(card)}</span>
            </button>
            <span className="mr-1.5 flex-none">
              <Time iso={card.since} now={now} fine={LIVE.has(card.state as string)} />
            </span>
            <Button variant="ghost" size="icon" aria-label={`Go to the pane of human session "${card.title}"`} className="mr-0.5 min-h-[26px] w-[26px] phone:min-h-11 phone:w-11">
              <Icon name="go" />
            </Button>
          </div>
        );
      })}
    </section>
  );
}
