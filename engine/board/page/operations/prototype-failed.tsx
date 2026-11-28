import { cn } from 'cn';
import { type ReactNode, useEffect, useId, useState, useSyncExternalStore } from 'react';
import { Icon } from '../app/icon.tsx';
import { Button } from '../ui/button.tsx';
import { Card as CardSurface } from '../ui/card.tsx';

const PROTOTYPE = true;
const EVENT = 'prototype-state';
const SOURCE = 'generate on the failed card';

type Cause = 'Setup fault' | 'Broken session' | 'Provider fault' | 'Unknown failure';
type Fixture = Readonly<{
  cause: Cause;
  detail: string;
  fix: string | null;
  status: { text: string; time: string } | null;
  actions: readonly string[];
  limit: string | null;
}>;

const FIXTURES: Record<string, Fixture | null> = {
  rest: null,
  'setup-fault': {
    cause: 'Setup fault',
    detail: 'Claude login expired (authentication_failed)',
    fix: 'Log in to Claude in a terminal (claude /login), then Resume.',
    status: null,
    actions: ['Resume'],
    limit: 'Resume continues the saved session of the build step only. It does not touch other steps.',
  },
  'broken-session': {
    cause: 'Broken session',
    detail: 'The API refuses the saved conversation (invalid_request): Invalid signature in thinking block',
    fix: 'Resume would replay the same error. Start the step again in a new session.',
    status: null,
    actions: ['Start fresh'],
    limit: 'Start fresh runs the build step again in a new session. Other steps stay as they are.',
  },
  'provider-retry': {
    cause: 'Provider fault',
    detail: 'Anthropic API overloaded (server_error, 529)',
    fix: null,
    status: { text: 'Automatic retry 1 of 2 at', time: '14:05' },
    actions: [],
    limit: 'The run retries by itself, at most 2 times. Stop ends it.',
  },
  'provider-failed': {
    cause: 'Provider fault',
    detail: 'The provider failed 3 times (server_error)',
    fix: 'The automatic retries are spent. Try again later.',
    status: null,
    actions: ['Try again'],
    limit: 'Try again re-runs the build step only, one more time.',
  },
  'unknown-fault': {
    cause: 'Unknown failure',
    detail: 'API Error: Connection closed mid-response · exit 1',
    fix: 'Read the error in the tab, then Resume or Try again.',
    status: null,
    actions: ['Resume', 'Try again'],
    limit: 'Resume continues the saved session. Try again starts the build step again. Neither touches other steps.',
  },
};
FIXTURES['details-open'] = FIXTURES['setup-fault'] ?? null;

export const PROTOTYPE_STATES = [
  'rest',
  'setup-fault',
  'broken-session',
  'provider-retry',
  'provider-failed',
  'unknown-fault',
  'details-open',
] as const;

const ISSUE = { number: '#372', title: 'Each failed run names its cause', step: 'build', agent: 'Claude' };

const subscribe = (notify: () => void) => {
  addEventListener(EVENT, notify);
  addEventListener('popstate', notify);
  return () => {
    removeEventListener(EVENT, notify);
    removeEventListener('popstate', notify);
  };
};

export type PrototypeState = Readonly<{ key: string | null; fixture: Fixture | null; isOpen: boolean }>;

export function usePrototypeState(): PrototypeState {
  const search = useSyncExternalStore(subscribe, () => location.search);
  const params = new URLSearchParams(search);
  const key = PROTOTYPE ? params.get('state') : null;
  if (key === null || !PROTOTYPE_STATES.includes(key as never)) return { key: null, fixture: null, isOpen: false };
  const fixture = FIXTURES[key] ?? null;
  return { key, fixture, isOpen: fixture !== null && (key === 'details-open' || params.get('panel') === '1') };
}

const write = (change: (params: URLSearchParams) => void) => {
  const url = new URL(location.href);
  change(url.searchParams);
  history.replaceState(history.state, '', url);
  dispatchEvent(new Event(EVENT));
};

const setState = (key: string) =>
  write((params) => {
    params.set('state', key);
    params.delete('panel');
  });

const setPanel = (isOpen: boolean, key: string) =>
  write((params) => {
    params.set('state', key === 'details-open' ? 'setup-fault' : key);
    if (isOpen) params.set('panel', '1');
    else params.delete('panel');
  });

type Group = { key: string; label: string; short: string; isCompact: boolean; states: string[] | null; cards: unknown[] };

export function prototypeGroups<T extends Group>(groups: T[], state: PrototypeState, stuck: T): T[] {
  if (state.fixture === null) return groups;
  const rest = groups.map((group, at) => (at === 0 ? { ...group, cards: group.cards.slice(1) } : group));
  const kept = rest.filter((group) => group.cards.length > 0 || group.key === 'stuck');
  if (kept.some((group) => group.key === 'stuck')) return kept;
  const at = kept.findIndex((group) => group.key !== 'answer');
  kept.splice(at < 0 ? kept.length : at, 0, { ...stuck, cards: [] });
  return kept;
}

const TONE = 'text-destructive';
const NOTE = 'm-0 text-[0.75rem] leading-[1.45] [overflow-wrap:anywhere]';

function Actions({ fixture, name }: { fixture: Fixture; name: string }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  useEffect(() => {
    if (busy === null) return;
    const timer = setTimeout(() => {
      setFailure(`${busy} failed: the daemon is not running, so no run started. Start the daemon, then ${busy.toLowerCase()} again.`);
      setBusy(null);
    }, 1400);
    return () => clearTimeout(timer);
  }, [busy]);
  if (fixture.actions.length === 0 && fixture.limit === null) return null;
  const busyText = (label: string) => (label === 'Resume' ? 'Resuming…' : label === 'Start fresh' ? 'Starting…' : 'Trying again…');
  return (
    <div className="flex flex-col gap-2" data-name={name}>
      {fixture.actions.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {fixture.actions.map((label, at) => {
            const isBusy = busy === label;
            return (
              <Button
                key={label}
                variant={at === 0 ? 'primary' : 'secondary'}
                size="action"
                aria-disabled={busy !== null ? 'true' : undefined}
                aria-busy={isBusy ? 'true' : undefined}
                className="min-h-7 min-w-24"
                onClick={() => {
                  if (busy !== null) return;
                  setFailure(null);
                  setBusy(label);
                }}
              >
                <Icon name={isBusy ? 'works' : label === 'Start fresh' ? 'run' : 'refresh'} />
                <span className="label">{isBusy ? busyText(label) : label}</span>
              </Button>
            );
          })}
        </div>
      )}
      {fixture.limit && <p className={cn(NOTE, 'text-muted-foreground')}>{fixture.limit}</p>}
      <p className={cn(NOTE, 'text-destructive')} role="alert" hidden={failure === null}>
        {failure}
      </p>
    </div>
  );
}

function Account({ fixture, id }: { fixture: Fixture; id: string }) {
  return (
    <div className="flex flex-col gap-1.5" role="status" id={id}>
      <p className={cn(NOTE, 'text-card-foreground')}>
        <span className="font-semibold text-foreground">{fixture.cause}. </span>
        {fixture.detail}
      </p>
      {fixture.fix && <p className={cn(NOTE, 'text-muted-foreground')}>{fixture.fix}</p>}
      {fixture.status && (
        <p className={cn(NOTE, 'flex items-center gap-1.5 font-medium text-card-foreground [&_.icon]:size-[13px]')}>
          <Icon name="clock" />
          <span>
            {fixture.status.text} <time dateTime={fixture.status.time}>{fixture.status.time}</time>
          </span>
        </p>
      )}
    </div>
  );
}

export function PrototypeFailedCard({ state }: { state: PrototypeState }) {
  const id = useId();
  const fixture = state.fixture as Fixture;
  const key = state.key as string;
  return (
    <article className="card is-needs relative flex flex-none flex-col gap-1.5 rounded-xl border border-border bg-card px-3.5 py-3 [box-shadow:var(--raise)]" data-state="failed" aria-labelledby={`${id}-1t`} aria-describedby={`${id}-1d`}>
      <div className="flex min-h-[18px] min-w-0 flex-wrap items-center gap-x-[7px] gap-y-1 font-mono text-[0.71875rem] leading-none text-muted-foreground">
        <span className="inline-flex items-center gap-1.5 font-sans text-[0.75rem] font-semibold text-destructive [&_.icon]:size-[13px]">
          <Icon name="alert" />
          Failed
        </span>
        <span className="opacity-60">·</span>
        <span>{ISSUE.number}</span>
        <span className="opacity-60">·</span>
        <span>{ISSUE.step}</span>
        <span className="opacity-60">·</span>
        <span className="font-sans">{ISSUE.agent}</span>
        <button type="button" className="ml-auto inline-flex min-h-6 min-w-6 cursor-pointer items-center rounded-md border border-transparent bg-transparent px-2 font-sans text-[0.75rem] font-medium text-card-foreground underline-offset-3 hover:underline focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-ring" aria-expanded={state.isOpen} onClick={() => setPanel(!state.isOpen, key)}>
          {state.isOpen ? 'Hide details' : 'Details'}
        </button>
      </div>
      <h4 className="m-0 min-w-0 font-sans text-[0.875rem] leading-[1.38] font-semibold tracking-[-0.012em] text-pretty text-foreground [overflow-wrap:anywhere]" id={`${id}-1t`}>
        {ISSUE.title}
      </h4>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2" role="status" id={`${id}-1d`}>
        <p className="m-0 min-w-0 flex-1 basis-[15rem] text-[0.78125rem] leading-[1.45] text-card-foreground [overflow-wrap:anywhere]">
          <span className="font-semibold text-destructive">{fixture.cause}</span>
          <span className="text-muted-foreground"> · </span>
          {fixture.detail}
          {fixture.status && (
            <span className="text-muted-foreground">
              {' · '}
              {fixture.status.text} <time dateTime={fixture.status.time}>{fixture.status.time}</time>
            </span>
          )}
        </p>
        <Actions fixture={{ ...fixture, limit: null }} name={`v1-${key}`} />
      </div>
    </article>
  );
}

const LABEL =
  'flex items-center gap-[7px] text-[0.6875rem] leading-none font-semibold tracking-[0.07em] text-muted-foreground uppercase';

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className={LABEL}>{title}</h3>
      {children}
    </section>
  );
}

export function PrototypePanel() {
  const state = usePrototypeState();
  if (!state.isOpen || state.fixture === null) return null;
  const { fixture, key } = state;
  return (
    <section
      className="flex min-h-0 min-w-0 flex-1 animate-panel-in flex-col overflow-hidden rounded-3xl border border-border-strong bg-panel"
      id="prototype-panel"
      aria-labelledby="prototype-panel-title"
      data-state="failed"
    >
      <div className="relative flex min-h-12 flex-none items-center gap-1 border-b border-border pr-2.5 pl-4">
        <div className="flex min-w-0 flex-1 items-center gap-[7px] font-mono text-[0.71875rem] text-muted-foreground">
          <span>{ISSUE.number}</span>
          <span className="opacity-60">·</span>
          <span>{ISSUE.step}</span>
          <span className="opacity-60">·</span>
          <span className="font-sans">{ISSUE.agent}</span>
        </div>
        <button
          type="button"
          className="grid size-7 cursor-pointer place-items-center rounded-lg border-0 bg-transparent text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-ring"
          aria-label="Close the details"
          onClick={() => setPanel(false, key as string)}
        >
          <Icon name="close" />
        </button>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-4 pt-4 pb-[22px]">
        <h2 className="m-0 text-[1.03125rem] leading-[1.4] font-semibold tracking-[-0.016em] text-pretty text-foreground [overflow-wrap:anywhere]" id="prototype-panel-title">
          {ISSUE.title}
        </h2>
        <p className={cn('m-0 inline-flex w-fit items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[0.8125rem] font-semibold bg-[color-mix(in_srgb,var(--danger)_13%,transparent)] text-[color-mix(in_srgb,var(--fg)_30%,var(--danger))] [&_.icon]:size-[14px]')}>
          <Icon name="alert" />
          Failed: {fixture.cause}
        </p>
        <Section title="Cause">
          <p className={cn(NOTE, 'text-[0.8125rem] text-foreground')}>{fixture.cause}</p>
        </Section>
        <Section title="What happened">
          <p className="m-0 rounded-lg border border-border bg-secondary px-2.5 py-2 font-mono text-[0.71875rem] leading-[1.5] text-card-foreground [overflow-wrap:anywhere]">
            {fixture.detail}
          </p>
        </Section>
        {fixture.fix && (
          <Section title="How to fix">
            <p className={cn(NOTE, 'text-[0.8125rem] text-card-foreground')}>{fixture.fix}</p>
          </Section>
        )}
        {fixture.status && (
          <Section title="Next retry">
            <p className={cn(NOTE, 'text-[0.8125rem] text-card-foreground')}>
              {fixture.status.text} <time dateTime={fixture.status.time}>{fixture.status.time}</time>
            </p>
          </Section>
        )}
        <Section title="Action">
          <Actions fixture={fixture} name={`panel-${key}`} />
        </Section>
      </div>
    </section>
  );
}

const isEditable = (target: EventTarget | null) =>
  target instanceof Element && target.closest('input, select, textarea, [contenteditable]') !== null;

export function PrototypeBar() {
  const state = usePrototypeState();
  const [isOpen, setOpen] = useState(false);
  useEffect(() => {
    const cycle = (event: KeyboardEvent) => {
      if ((event.key !== '[' && event.key !== ']') || event.ctrlKey || event.metaKey || event.altKey) return;
      if (isEditable(event.target)) return;
      const at = PROTOTYPE_STATES.indexOf((state.key ?? 'rest') as never);
      const step = event.key === ']' ? 1 : -1;
      setState(PROTOTYPE_STATES[(at + step + PROTOTYPE_STATES.length) % PROTOTYPE_STATES.length] as string);
    };
    addEventListener('keydown', cycle);
    return () => removeEventListener('keydown', cycle);
  }, [state.key]);
  if (state.key === null) return null;
  return (
    <div
      className="fixed bottom-[calc(var(--dock,0px)+10px)] left-1/2 z-[100] flex max-w-[calc(100vw-16px)] -translate-x-1/2 flex-wrap items-center justify-center gap-x-2.5 gap-y-1 rounded-2xl border-2 border-white bg-black px-3 py-1.5 font-mono text-[0.75rem] text-white shadow-[0_4px_24px_rgba(0,0,0,0.6)]"
      role="region"
      aria-label="Prototype bar, not part of the design"
      data-prototype-bar=""
    >
      <span className="rounded-sm bg-white px-1.5 py-0.5 font-bold text-black">A</span>
      <span className="[overflow-wrap:anywhere]">{SOURCE}</span>
      <div className="relative">
        <button
          type="button"
          className="min-h-6 cursor-pointer rounded-md border border-white bg-black px-2 font-mono text-white focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-yellow-300"
          aria-expanded={isOpen}
          aria-haspopup="true"
          onClick={() => setOpen(!isOpen)}
          onKeyDown={(event) => event.key === 'Escape' && setOpen(false)}
        >
          {state.key} ▾
        </button>
        {isOpen && (
          <ul
            className="absolute bottom-full left-0 z-[101] m-0 mb-2 flex list-none flex-col rounded-lg border-2 border-white bg-black p-1"
            aria-label="Prototype states"
          >
            {PROTOTYPE_STATES.map((each) => (
              <li key={each}>
                <button
                  type="button"
                  className={cn(
                    'min-h-6 w-full cursor-pointer rounded-md border-0 bg-black px-2 py-1 text-left font-mono whitespace-nowrap text-white hover:bg-white hover:text-black focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-yellow-300',
                    each === state.key && 'font-bold underline',
                  )}
                  aria-current={each === state.key ? 'true' : undefined}
                  onClick={() => {
                    setState(each);
                    setOpen(false);
                  }}
                >
                  {each}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <span className="text-[0.6875rem] opacity-80 phone:hidden">[ ] cycle</span>
    </div>
  );
}
