import { cn } from 'cn';
import { type FocusEvent, type MouseEvent, type ReactNode, useEffect, useLayoutEffect, useRef } from 'react';
import type { Registry } from '../../../lib/host/names.ts';
import type { Pull } from '../../../lib/resolver/types.ts';
import type { Action, Card, DaemonView } from '../../types.ts';
import { age, agentOf, clock, knownAgent, prFacts } from '../../view.ts';
import { Icon } from '../app/icon.tsx';
import { Button, buttonVariants, TAP } from '../ui/button.tsx';
import { AGENT_ICONS, safeUrl, TYPES } from '../ui.ts';
import { pressId, screen, useScreen } from './state.ts';

export const WARNING =
  'm-0 rounded-lg border border-[color-mix(in_srgb,var(--amber)_30%,transparent)] bg-[color-mix(in_srgb,var(--amber)_9%,transparent)] px-2.5 py-2 text-[0.75rem] leading-[1.45] text-foreground [overflow-wrap:anywhere]';

const MARK = 'grid min-h-[18px] w-[18px] flex-none place-items-center rounded-xs';
const LETTER = `${MARK} font-sans text-[0.6875rem] leading-none font-semibold text-foreground`;
const BOXED = 'bg-accent [box-shadow:inset_0_0_0_1px_var(--line-strong)]';
const NUM = 'whitespace-nowrap text-card-foreground tabular-nums';
const NUM_LINK = `inline-flex min-h-6 min-w-6 items-center [&:hover]:text-foreground ${TAP}`;
const CHIP =
  'inline-flex min-h-[22px] items-center gap-1.5 rounded-sm border pr-2 pl-1.5 font-sans text-[0.71875rem] leading-none font-medium whitespace-nowrap [&_.icon]:size-3';
const CHIP_LINK = `[&:hover]:border-border-strong [&:hover]:text-foreground ${TAP}`;
const NEUTRAL = 'border-border bg-secondary text-card-foreground';
const GOOD =
  'border-[color-mix(in_srgb,var(--ready)_28%,transparent)] bg-[color-mix(in_srgb,var(--ready)_8%,transparent)] text-ready';
const WAITING = `${NEUTRAL} [&_.icon]:text-muted-foreground`;
const CHIP_TONES: Record<string, string> = {
  pr: `${NEUTRAL} font-mono font-normal`,
  'checks-pass': GOOD,
  'checks-fail':
    'border-[color-mix(in_srgb,var(--danger)_30%,transparent)] bg-[color-mix(in_srgb,var(--danger)_8%,transparent)] text-destructive',
  'checks-pending': WAITING,
  'review-approved': GOOD,
  'review-changes':
    'border-[color-mix(in_srgb,var(--amber)_30%,transparent)] bg-[color-mix(in_srgb,var(--amber)_8%,transparent)] text-caution',
  'review-required': WAITING,
};
const GATE =
  'inline-flex min-h-[18px] cursor-help items-center rounded-xs px-1.5 font-sans text-[0.6875rem] leading-none font-medium';
const GATE_ON = 'bg-[color-mix(in_srgb,var(--ready)_13%,transparent)] text-ready';
const GATE_OFF = 'border border-dashed border-border-strong bg-transparent text-card-foreground';

export function Link({
  className,
  anchorClassName,
  url,
  label,
  title,
  children,
}: {
  className: string;
  anchorClassName?: string;
  url?: string | null;
  label?: string;
  title?: string;
  children: ReactNode;
}) {
  const href = safeUrl(url);
  const shared = { 'aria-label': label, title };
  return href ? (
    <a {...shared} className={cn(className, anchorClassName) || undefined} href={href} target="_blank" rel="noreferrer">
      {children}
    </a>
  ) : (
    <span {...shared} className={className || undefined}>
      {children}
    </span>
  );
}

export function Num({
  url,
  className,
  children,
}: {
  url: string | null | undefined;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link className={cn(NUM, className)} anchorClassName={NUM_LINK} url={url}>
      {children}
    </Link>
  );
}

export function Timed({
  iso,
  isFine = false,
  suffix = '',
  className = '',
}: {
  iso: string;
  isFine?: boolean;
  suffix?: string;
  className?: string;
}) {
  const now = useScreen((state) => state.now);
  return (
    <time className={cn('time tabular-nums', className)} dateTime={iso} title={clock(iso, true)}>
      {`${age(iso, now, isFine)}${suffix}`}
    </time>
  );
}

export function Mark({
  card,
  registry,
  identifiedByText = false,
}: {
  card: Card;
  registry: Registry;
  identifiedByText?: boolean;
}) {
  const agent = agentOf(card, registry);
  if (agent) {
    const known = knownAgent(registry, card.agent) ? card.agent : null;
    return (
      <span className={cn(LETTER, (known === null || known === 'opencode') && BOXED)} title={agent.name}>
        {known ? (
          <img
            className={known === 'opencode' ? 'size-3 object-contain' : 'size-[18px] object-contain'}
            src={AGENT_ICONS[known]}
            alt={identifiedByText ? '' : agent.name}
          />
        ) : (
          agent.letter
        )}
      </span>
    );
  }
  const name = Object.hasOwn(TYPES, card.type as string)
    ? (TYPES[card.type as string] as string)
    : card.number === null
      ? 'terminal'
      : 'nolane';
  return (
    <span
      className={`${MARK} text-card-foreground [&_.icon]:size-[13px]`}
      title={!card.type && card.number !== null ? 'No lane yet' : undefined}
    >
      <Icon name={name} />
    </span>
  );
}

const chipIcon = (kind: string) =>
  kind === 'pr'
    ? 'pr'
    : kind.startsWith('checks-fail')
      ? 'xcircle'
      : kind.startsWith('checks-pass') || kind === 'review-approved'
        ? 'check'
        : 'clock';

export function PrChips({ pr }: { pr: Pull | null | undefined }) {
  const items = prFacts(pr);
  if (items.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <Link key={item.kind} className={cn(CHIP, CHIP_TONES[item.kind])} anchorClassName={CHIP_LINK} url={item.url}>
          <Icon name={chipIcon(item.kind)} />
          {item.text}
        </Link>
      ))}
    </div>
  );
}

export function GateLabel({ mode, className = '' }: { mode: DaemonView['auto']; className?: string }) {
  const on = mode === 'on';
  return (
    <span
      className={cn(GATE, on ? GATE_ON : GATE_OFF, className)}
      title={on ? 'Auto mode of the daemon starts this step by itself' : 'Auto mode is off: this step waits for Run.'}
    >
      {on ? 'auto' : 'auto off'}
    </span>
  );
}

export function IconButton({
  name,
  label,
  press,
  className = '',
  title = label,
}: {
  name: string;
  label: string;
  press: (event: MouseEvent<HTMLButtonElement>) => unknown;
  className?: string;
  title?: string;
}) {
  return (
    <Button
      variant="icon"
      size="icon"
      className={className}
      aria-label={label}
      title={title}
      onClick={(event) => {
        event.stopPropagation();
        press(event);
      }}
    >
      <Icon name={name} />
    </Button>
  );
}

export function ActionButton({
  card,
  action,
  isQuiet = false,
  className: extra = '',
}: {
  card: Card;
  action: Action;
  isQuiet?: boolean;
  className?: string;
}) {
  const isBusy = useScreen((state) => state.pressing.has(pressId(card, action)));
  const variant = isQuiet || action.isGhost ? 'secondary' : 'primary';
  const shared = {
    title: action.title,
    'aria-label': action.name,
    'aria-disabled': action.isDisabled ? ('true' as const) : undefined,
  };
  const inner = (
    <>
      <Icon name={action.icon} />
      <span className="label">{isBusy && action.busy ? action.busy : action.label}</span>
    </>
  );
  if (action.href)
    return (
      <a
        {...shared}
        data-slot="button"
        className={buttonVariants({ variant, size: 'action', className: extra })}
        href={safeUrl(action.href) ?? undefined}
        target="_blank"
        rel="noreferrer"
        onClick={(event) => event.stopPropagation()}
      >
        {inner}
      </a>
    );
  return (
    <Button
      variant={variant}
      size="action"
      className={extra}
      {...shared}
      aria-busy={isBusy ? 'true' : undefined}
      onClick={(event) => {
        event.stopPropagation();
        void screen.press(card, action);
      }}
    >
      {inner}
    </Button>
  );
}

// Chrome scroll anchoring moves a scroller when a read puts content above its view; the old redraw left the scroll alone.
// A write to scrollTop ends a smooth scroll, so a scroller between its scroll and scrollend events keeps its own position.
export const useKeptScroll = (find: () => HTMLElement[], content: unknown) => {
  const tops = useRef(new Map<HTMLElement, number>());
  const scrolling = useRef(new WeakSet<EventTarget>());
  const was = useRef(content);
  if (was.current !== content) tops.current = new Map(find().map((node) => [node, node.scrollTop] as const));
  useEffect(() => {
    const start = (event: Event) => scrolling.current.add(event.target as EventTarget);
    const end = (event: Event) => scrolling.current.delete(event.target as EventTarget);
    document.addEventListener('scroll', start, true);
    document.addEventListener('scrollend', end, true);
    return () => {
      document.removeEventListener('scroll', start, true);
      document.removeEventListener('scrollend', end, true);
    };
  }, []);
  useLayoutEffect(() => {
    if (was.current !== content)
      for (const [node, top] of tops.current)
        if (node.isConnected && !scrolling.current.has(node)) node.scrollTop = top;
    was.current = content;
  });
};

export const useKeptFocus = <T extends HTMLElement>(find: (box: T, lost: HTMLElement) => HTMLElement | null) => {
  const ref = useRef<T>(null);
  const focused = useRef<HTMLElement | null>(null);
  const held = useRef(false);
  // Read before the commit: a removed focused node leaves the focus on body after it.
  held.current = ref.current?.contains(document.activeElement) ?? false;
  useLayoutEffect(() => {
    const lost = focused.current;
    if (!ref.current || !lost || lost.isConnected) return;
    focused.current = null;
    if (held.current && document.activeElement === document.body)
      find(ref.current, lost)?.focus({ preventScroll: true });
  });
  return {
    ref,
    onFocus: (event: FocusEvent) => {
      focused.current = event.target as HTMLElement;
    },
    onBlur: (event: FocusEvent) => {
      if (event.relatedTarget) focused.current = null;
    },
  };
};
