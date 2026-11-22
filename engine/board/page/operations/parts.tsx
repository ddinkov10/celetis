import { type FocusEvent, type MouseEvent, type ReactNode, useEffect, useLayoutEffect, useRef } from 'react';
import type { Registry } from '../../../lib/host/names.ts';
import type { Pull } from '../../../lib/resolver/types.ts';
import type { Action, Card, DaemonView } from '../../types.ts';
import { age, agentOf, clock, knownAgent, prFacts } from '../../view.ts';
import { Icon } from '../app/icon.tsx';
import { Button, buttonVariants } from '../ui/button.tsx';
import { AGENT_ICONS, safeUrl, TYPES } from '../ui.ts';
import { pressId, screen, useScreen } from './state.ts';

export function Link({
  className,
  url,
  label,
  title,
  children,
}: {
  className: string;
  url?: string | null;
  label?: string;
  title?: string;
  children: ReactNode;
}) {
  const href = safeUrl(url);
  const shared = { className: className || undefined, 'aria-label': label, title };
  return href ? (
    <a {...shared} href={href} target="_blank" rel="noreferrer">
      {children}
    </a>
  ) : (
    <span {...shared}>{children}</span>
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
    <time className={`time ${className}`.trim()} dateTime={iso} title={clock(iso, true)}>
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
      <span className={`mark agent agent-${known ?? 'other'}${known ? ' agent-image' : ''}`} title={agent.name}>
        {known ? <img src={AGENT_ICONS[known]} alt={identifiedByText ? '' : agent.name} /> : agent.letter}
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
      className={`mark type-${card.type ?? 'none'}`}
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
    <div className="chips">
      {items.map((item) => (
        <Link key={item.kind} className={`chip2 chip-${item.kind}`} url={item.url}>
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
      className={`${on ? 'gate gate-auto' : 'gate gate-auto is-off'} ${className}`.trim()}
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
