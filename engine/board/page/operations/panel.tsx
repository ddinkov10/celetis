import { cn } from 'cn';
import { Fragment, type ReactElement, type ReactNode, useRef } from 'react';
import type { Registry } from '../../../lib/host/names.ts';
import type { RowSource, StartPair } from '../../../lib/workflow/effort.ts';
import type { Action, Board, Card, DaemonView, Flow } from '../../types.ts';
import {
  agentOf,
  clock,
  diffText,
  gateOf,
  LIVE,
  laneTrack,
  levelSource,
  modelSource,
  prFacts,
  shortPath,
  stateLabel,
} from '../../view.ts';
import { Icon } from '../app/icon.tsx';
import { useShellStore } from '../store.ts';
import { buttonVariants } from '../ui/button.tsx';
import { Separator } from '../ui/separator.tsx';
import { copy, safeUrl } from '../ui.ts';
import { detailActions, onTracker } from './actions.ts';
import { ActionButton, GateLabel, IconButton, Link, Mark, PrChips, Timed, useKeptFocus } from './parts.tsx';
import { closeDetails, screen, useScreen } from './state.ts';

// The class sec-label has no rule: the detect scenario reads it to leave the 11.5px aside of the label alone.
const SECTION_LABEL =
  'sec-label flex items-center gap-[7px] text-[0.6875rem] leading-none font-semibold tracking-[0.07em] text-muted-foreground uppercase';
const MONO_ASIDE = 'font-mono text-[0.71875rem] leading-none font-normal normal-nums';
const TONES: Record<string, string> = {
  waits:
    'text-[color-mix(in_srgb,var(--fg)_20%,var(--needs))] bg-[color-mix(in_srgb,var(--needs-tint)_11%,transparent)]',
  blocked:
    'text-[color-mix(in_srgb,var(--fg)_20%,var(--needs))] bg-[color-mix(in_srgb,var(--needs-tint)_11%,transparent)]',
  works:
    'text-[color-mix(in_srgb,var(--fg)_30%,var(--working))] bg-[color-mix(in_srgb,var(--working)_13%,transparent)]',
  starts:
    'text-[color-mix(in_srgb,var(--fg)_30%,var(--working))] bg-[color-mix(in_srgb,var(--working)_13%,transparent)]',
  'no-progress':
    'text-[color-mix(in_srgb,var(--fg)_30%,var(--danger))] bg-[color-mix(in_srgb,var(--danger)_13%,transparent)]',
  'dirty-tree':
    'text-[color-mix(in_srgb,var(--fg)_20%,var(--amber))] bg-[color-mix(in_srgb,var(--amber)_13%,transparent)]',
};
const MUTED_TONE = 'bg-accent text-card-foreground';
const NODE_TONES: Record<string, string> = {
  waits: 'text-needs',
  blocked: 'text-needs',
  works: 'text-working',
  starts: 'text-working',
  'no-progress': 'text-destructive',
  'dirty-tree': 'text-caution',
};
const PILL_ICONS: Record<string, string> = {
  works: 'works',
  starts: 'works',
  waits: 'target',
  'no-progress': 'alert',
  'set-aside': 'aside',
  stopping: 'stop',
  'dirty-tree': 'diff',
  blocked: 'person',
  'quota-wait': 'clock',
};
const ASKS: Record<string, [string, string]> = {
  dialog: ['question', 'waits for your answer'],
  turn: ['message', 'ended its turn'],
};
const COPIES: Record<string, string> = { 'no-progress': 'command', 'set-aside': 'command', 'dirty-tree': 'path' };

function Section({ title, aside = null, children }: { title: string; aside?: string | null; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className={SECTION_LABEL}>
        {title}
        {aside && <span className={cn(MONO_ASIDE, 'ml-auto tracking-[0] normal-case')}>{aside}</span>}
      </h3>
      {children}
    </section>
  );
}

const Screen = ({ card }: { card: Card }) =>
  card.screen?.length ? (
    <pre className="m-0 rounded-lg border border-border bg-secondary px-3 py-2.5 font-mono text-[0.71875rem] leading-[1.55] font-normal [overflow-wrap:anywhere] whitespace-pre-wrap text-foreground">
      {card.screen.join('\n')}
    </pre>
  ) : null;

function Ask({ card, actions, registry }: { card: Card; actions: Action[]; registry: Registry }) {
  const [glyph, verb] = ASKS[card.waitFor as string] ?? ['target', 'waits for your answer'];
  return (
    <div className="flex flex-col gap-2.5 rounded-xl border border-[color-mix(in_srgb,var(--needs-tint)_34%,transparent)] bg-[color-mix(in_srgb,var(--needs-tint)_6%,var(--card))] px-3.5 py-3">
      <div className="flex items-center gap-2 text-[0.75rem] text-muted-foreground [&_.icon]:size-3.5 [&_.icon]:text-needs">
        <Icon name={glyph} />
        <b className="font-medium text-card-foreground">{agentOf(card, registry)?.name ?? 'The agent'}</b>
        <span>{verb}</span>
        <Timed
          iso={card.since}
          isFine={LIVE.has(card.state as string)}
          suffix=" ago"
          className={cn(MONO_ASIDE, 'ml-auto')}
        />
      </div>
      <Screen card={card} />
      <div className="flex items-center justify-between gap-2">
        <span className="hint text-[0.75rem] text-muted-foreground">Answer it in the terminal pane.</span>
        {actions.slice(0, 1).map((action) => (
          <ActionButton key={action.id} card={card} action={action} className="phone:min-h-11" />
        ))}
      </div>
    </div>
  );
}

function Steps({ card, flow, auto }: { card: Card; flow: Flow | null; auto: DaemonView['auto'] }) {
  const track = laneTrack(card, flow);
  if (!track) return null;
  return (
    <Section
      title="Lane"
      aside={`${card.type} · step ${track.findIndex((step) => step.state === 'now') + 1} of ${track.length}`}
    >
      <ol
        className="m-0 grid list-none grid-cols-[16px_1fr_auto_auto] gap-x-2.5 py-0 pr-1 pl-0.5"
        aria-label={`Steps of the lane ${card.type}`}
      >
        {track.map((step) => (
          <li
            key={step.name}
            aria-current={step.state === 'now' ? 'step' : undefined}
            className="relative col-span-full grid min-h-8 grid-cols-subgrid items-center gap-2.5 not-last:after:absolute not-last:after:top-[23px] not-last:after:left-[7.5px] not-last:after:h-[18px] not-last:after:w-px not-last:after:bg-border-strong not-last:after:content-['']"
          >
            <span
              className={cn(
                'grid size-4 place-items-center text-muted-foreground [&_.icon]:size-3.5',
                step.state === 'done' &&
                  'rounded-[50%] bg-accent text-card-foreground [&_.icon]:size-[11px] [&_.icon]:stroke-2',
                step.state === 'now' && cn('text-foreground', NODE_TONES[card.state as string]),
              )}
            >
              <Icon
                name={
                  step.state === 'done'
                    ? 'check'
                    : step.state === 'now'
                      ? (PILL_ICONS[card.state as string] ?? 'pending')
                      : 'pending'
                }
              />
            </span>
            <span
              className={cn(
                'font-mono text-[0.78125rem] leading-none font-normal text-card-foreground',
                step.state === 'now' && 'font-medium text-foreground',
                step.state === 'next' && 'text-muted-foreground',
              )}
            >
              {step.name}
            </span>
            <span
              className={cn(
                'justify-self-end text-[0.75rem] text-muted-foreground',
                step.state === 'now' && 'first-letter:uppercase',
              )}
            >
              {step.state === 'done' ? 'done' : step.state === 'now' ? (card.state ? stateLabel(card) : 'next') : ''}
              {step.state === 'next' && <span className="sr-only">not started</span>}
            </span>
            {gateOf(flow, card.type, step.name) === 'auto' ? (
              <GateLabel mode={auto} className="cursor-default" />
            ) : (
              <span />
            )}
          </li>
        ))}
      </ol>
    </Section>
  );
}

type Fact = [string, string | ReactElement, [string, string]?];

function Facts({ rows }: { rows: (Fact | null | false | '' | undefined)[] }) {
  return (
    <dl className="m-0 grid grid-cols-[96px_minmax(0,1fr)_auto] items-center gap-x-2.5 gap-y-0.5">
      {rows
        .filter((row): row is Fact => Boolean(row))
        .map(([term, value, copyable]) => {
          const isText = typeof value === 'string';
          return (
            <Fragment key={term}>
              <dt
                className={cn(
                  'text-[0.78125rem] leading-[1.875rem] text-muted-foreground',
                  !isText && '[align-self:start]',
                )}
              >
                {term}
              </dt>
              <dd
                className={cn(
                  'm-0 min-w-0 [overflow-wrap:anywhere] whitespace-normal text-foreground',
                  isText
                    ? 'py-1.5 font-mono text-[0.75rem] leading-normal font-normal'
                    : 'py-0 font-sans text-[0.78125rem] leading-normal font-normal',
                )}
              >
                {value}
              </dd>
              {copyable ? (
                <IconButton
                  name="copy"
                  label={`Copy the ${copyable[1]}`}
                  press={() => copy(copyable[0], copyable[1])}
                  className="size-6 [&_.icon]:size-[13px]"
                />
              ) : (
                <span />
              )}
            </Fragment>
          );
        })}
    </dl>
  );
}

const whyOf = (pair: StartPair<RowSource>) => {
  const pinned = (['model', 'level'] as const).filter((part) => pair.source[part] === 'pinned');
  const pin = pinned.length
    ? `The config pins ${pinned.length === 2 ? 'the model and the level' : `the ${pinned[0]}`} of this step.`
    : '';
  const decision = pair.decision
    ? pair.decision.reason || 'No reason given.'
    : pin
      ? ''
      : 'No decision on the issue; the default applies.';
  return [decision, pin].filter(Boolean).join(' ');
};

const effortFacts = (pair: StartPair<RowSource> | null | undefined): Fact[] =>
  pair
    ? [
        ['Model', `${pair.model} · ${modelSource(pair)}`],
        ['Effort', `${pair.level} · ${levelSource(pair)}`],
        [
          'Why',
          <span className="block py-1.5 leading-[1.125rem] [overflow-wrap:anywhere] whitespace-normal">
            {whyOf(pair)}
          </span>,
        ],
      ]
    : [];

function Details({ card }: { card: Card }) {
  const { flow, registry, daemon } = screen.read() as Board;
  const actions = detailActions(card);
  const hasHelp = actions.some((action) => action.help);
  const firstGroup = actions.findIndex((action, at) => action.group && action.group !== actions[at - 1]?.group);
  const on = onTracker();
  const { state } = card;
  const asks = state === 'waits' && (card.number !== null || card.waitFor === 'dialog');
  const isSession = Boolean(card.sessionId);
  const open = safeUrl(card.url);
  const facts: (Fact | null | false | '' | undefined)[] = isSession
    ? [
        ['Agent', agentOf(card, registry)?.name ?? 'unknown'],
        card.cwd && ['Folder', card.cwd, [card.cwd, 'folder']],
        card.diff && [
          'Changes',
          `${diffText(card.diff)} · ${card.diff.files} ${card.diff.files === 1 ? 'file' : 'files'}`,
        ],
      ]
    : [
        card.act &&
          COPIES[card.state as string] && [
            COPIES[card.state as string] === 'path' ? 'Worktree' : 'Command',
            shortPath(card.act),
            [card.act, COPIES[card.state as string] as string],
          ],
        card.act && !COPIES[card.state as string] && ['Your act', card.act],
        ...effortFacts(card.effort),
        ['Updated', clock(card.since)],
      ];
  return (
    <>
      <div className="relative flex min-h-12 flex-none items-center gap-1 pr-2.5 pb-px pl-4 phone:min-h-14">
        <div className="flex min-w-0 flex-1 items-center gap-[7px] overflow-hidden font-mono text-[0.71875rem] leading-none font-normal whitespace-nowrap text-muted-foreground phone:[&_a]:inline-flex phone:[&_a]:min-h-11 phone:[&_a]:items-center">
          <Mark card={card} registry={registry} identifiedByText />
          {card.number === null ? (
            <span className="num none">human session</span>
          ) : (
            <Link className="num" url={card.url}>{`#${card.number}`}</Link>
          )}
          {[card.type, card.step === card.type ? null : card.step].map(
            (part, at) =>
              part && (
                <Fragment key={at}>
                  <span className="sep">·</span>
                  <span>{part}</span>
                </Fragment>
              ),
          )}
        </div>
        {open && (
          <a
            data-slot="button"
            className={buttonVariants({ variant: 'icon', size: 'icon', className: 'phone:size-11' })}
            href={open}
            target="_blank"
            rel="noreferrer"
            title={`Open the issue${on} (o)`}
            aria-label={`Open the issue${on}`}
          >
            <Icon name="open" />
          </a>
        )}
        <IconButton
          name="close"
          label="Close the details (Esc)"
          press={() => closeDetails(true)}
          className="phone:size-11"
        />
        <Separator className="absolute inset-x-0 bottom-0" />
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-4 pt-4 pb-[22px] phone:scroll-pb-[calc(var(--dock)+8px)]">
        <div>
          <h2
            className="m-0 text-[1.03125rem] leading-[1.4] font-semibold tracking-[-0.016em] text-pretty text-foreground [overflow-wrap:anywhere]"
            id="panel-title"
          >
            {card.title || (card.number === null ? 'A session' : `Issue #${card.number}`)}
          </h2>
          <div className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-[0.78125rem] text-muted-foreground">
            <span
              className={cn(
                'inline-flex min-h-6 items-center gap-1.5 rounded-[7px] py-1 pr-[9px] pl-[7px] text-[0.75rem] leading-[1.25] font-medium [&_.icon]:size-[13px]',
                (state && (state !== 'waits' || asks) ? TONES[state] : undefined) ?? MUTED_TONE,
                state === 'starts' && '[&_.icon]:animate-[turn_0.9s_linear_infinite] [&_.icon]:text-working',
              )}
            >
              <Icon name={state ? (PILL_ICONS[state] ?? 'pending') : 'pending'} />
              <span className="[overflow-wrap:anywhere] whitespace-normal first-letter:uppercase">
                {state ? stateLabel(card) : `next: ${card.step}`}
              </span>
            </span>
            {card.state !== 'starts' && (
              <>
                <span>since</span>
                <Timed
                  iso={card.since}
                  isFine={Boolean(card.sessionId) && LIVE.has(card.state as string)}
                  className="font-mono text-[0.75rem] leading-none font-normal normal-nums"
                />
              </>
            )}
          </div>
          {card.warning && <p className="warning">{card.warning}</p>}
        </div>
        {asks ? (
          <Ask card={card} actions={actions} registry={registry} />
        ) : actions.length ? (
          <div
            className={cn(
              'flex flex-wrap gap-2',
              hasHelp && 'grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-2.5 gap-y-1.5',
            )}
          >
            {actions.map((action, index) => (
              <Fragment key={action.id}>
                {action.group && action.group !== actions[index - 1]?.group && (
                  <span
                    className={cn(
                      'mt-1 basis-full text-[0.6875rem] leading-none font-semibold tracking-[0.07em] text-muted-foreground uppercase',
                      hasHelp && '[grid-column:1/-1]',
                    )}
                  >
                    {action.group}
                  </span>
                )}
                <ActionButton
                  card={card}
                  action={action}
                  className={cn(
                    'phone:min-h-11',
                    hasHelp && firstGroup !== -1 && index >= firstGroup && 'justify-self-start [grid-column:1/-1]',
                  )}
                />
                {action.help && <span className="self-center text-[0.75rem] text-muted-foreground">{action.help}</span>}
              </Fragment>
            ))}
          </div>
        ) : null}
        {prFacts(card.pr).length > 0 && (
          <Section title="Pull request">
            <PrChips pr={card.pr} />
          </Section>
        )}
        <Steps card={card} flow={flow} auto={daemon.auto} />
        <Section title={isSession ? 'Session' : 'Issue'}>
          <Facts rows={facts} />
        </Section>
        {isSession && !asks && card.screen?.length ? (
          <Section title="Screen" aside="the last lines of its pane">
            <Screen card={card} />
          </Section>
        ) : null}
      </div>
    </>
  );
}

export function Panel() {
  const details = useShellStore((state) => state.shell.details);
  useScreen((state) => state);
  const entry = details === null ? undefined : screen.index().byKey.get(details);
  const last = useRef<{ key: string; card: Card } | null>(null);
  if (details !== null && entry) last.current = { key: details, card: entry.card };
  const card = details === null ? null : (entry?.card ?? (last.current?.key === details ? last.current.card : null));
  const kept = useKeptFocus<HTMLElement>((box, lost) => {
    const label = lost.getAttribute('aria-label');
    if (!label) return null;
    return (
      box.querySelector<HTMLElement>(`[aria-label="${CSS.escape(label)}"]`) ??
      box.querySelector<HTMLElement>('[aria-label^="Close the details"]')
    );
  });
  return (
    <section
      {...kept}
      className="flex min-h-0 min-w-0 flex-1 animate-[panel-in_0.18s_cubic-bezier(0.2,0.8,0.2,1)] flex-col overflow-hidden rounded-3xl border border-border-strong bg-panel phone:scroll-pb-[calc(var(--dock)+8px)] min-[720px]:group-data-[tab=pipeline]/ops:flex-[0_1_auto] min-[720px]:group-data-[tab=pipeline]/ops:[grid-area:1/2]"
      id="panel"
      aria-label="Card details"
      tabIndex={-1}
      hidden={card === null}
      aria-labelledby={card ? 'panel-title' : undefined}
      data-state={card ? (card.state ?? 'next') : undefined}
      data-key={card ? (details ?? undefined) : undefined}
    >
      {card && <Details key={details} card={card} />}
    </section>
  );
}
