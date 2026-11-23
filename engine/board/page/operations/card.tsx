import { cn } from 'cn';
import { Fragment, memo, type ReactNode, type RefObject, useEffect, useRef } from 'react';
import type { Registry } from '../../../lib/host/names.ts';
import type { IssueKey } from '../../../lib/tracker/key.ts';
import type { RowSource, StartPair } from '../../../lib/workflow/effort.ts';
import type { Action, Board, Card as CardData, Column, MenuEntry } from '../../types.ts';
import { age, agentOf, LIVE, laneTrack, shortPath, startName, stateLabel } from '../../view.ts';
import { Icon } from '../app/icon.tsx';
import { buttonVariants } from '../ui/button.tsx';
import { Card as CardSurface } from '../ui/card.tsx';
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '../ui/dropdown-menu.tsx';
import { Entries, FirstFocus } from '../ui/menu-entries.tsx';
import { copy } from '../ui.ts';
import { actionsOf, copyWhat, menuName, menuOf, runEntries } from './actions.ts';
import { type Launch, SLOW_START, SLOW_START_TEXT } from './cards.ts';
import { columnId, columnStop } from './keys.ts';
import { ActionButton, GateLabel, IconButton, Link, Mark, PrChips, Timed } from './parts.tsx';
import { type MenuKind, type ScreenState, screen, useScreen } from './state.ts';

export type Env = Readonly<{
  registry: Registry;
  flow: Board['flow'];
  auto: Board['daemon']['auto'];
  agents: Board['agents'];
  noRun: Board['noRun'];
  record: unknown;
  next: Board['next'];
  starts: Board['starts'];
  tracker: Board['tracker'];
}>;

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

export function UnseenDot({ className }: { className?: string }) {
  return (
    <i
      className={cn(
        'size-[7px] flex-none rounded-[50%] bg-foreground shadow-[0_0_0_3px_color-mix(in_srgb,var(--fg)_14%,transparent)]',
        className,
      )}
      title="Changed since you last looked"
    >
      <span className="sr-only">Changed since you last looked</span>
    </i>
  );
}

const SEG_NOW: Record<string, string> = {
  works:
    'animate-[flow_1.6s_linear_infinite] [background:linear-gradient(90deg,var(--working)_30%,color-mix(in_srgb,var(--working)_75%,var(--card))_50%,var(--working)_70%)_0_0/300%_100%] [box-shadow:none]',
  waits: 'bg-needs [box-shadow:none]',
  blocked: 'bg-needs [box-shadow:none]',
  'no-progress': 'bg-destructive [box-shadow:none]',
  'dirty-tree': 'bg-caution [box-shadow:none]',
  starts: 'bg-transparent [box-shadow:inset_0_0_0_1.5px_var(--working)]',
};

const segOf = (state: string, cardState: string | null) =>
  state === 'done'
    ? 'w-3.5 bg-muted-foreground [box-shadow:none]'
    : state === 'now'
      ? `w-5 ${SEG_NOW[cardState ?? ''] ?? 'bg-foreground [box-shadow:none]'}`
      : 'w-3.5 bg-transparent [box-shadow:inset_0_0_0_1px_var(--fg3)]';

function Track({ card, flow }: { card: CardData; flow: Board['flow'] }) {
  const steps = laneTrack(card, flow);
  if (!steps) return null;
  const at = steps.findIndex((step) => step.state === 'now');
  return (
    <span
      className="ml-auto inline-flex flex-none items-center gap-[3px] pl-2"
      data-track=""
      role="img"
      aria-label={`Step ${at + 1} of ${steps.length}: ${steps[at]?.name}`}
      title={steps
        .map((step) => (step.state === 'next' ? step.name : `${step.name} (${step.state === 'now' ? 'now' : 'done'})`))
        .join(' · ')}
    >
      {steps.map((step) => (
        <i key={step.name} className={`h-1.5 rounded-[3px] ${segOf(step.state, card.state)}`} />
      ))}
    </span>
  );
}

function StartLabel({ pair }: { pair: StartPair<RowSource> }) {
  const name = startName(pair);
  return (
    <span
      className="inline-flex min-h-[18px] cursor-help items-stretch font-mono text-[0.6875rem] leading-none font-medium whitespace-nowrap text-card-foreground"
      title={name}
      role="img"
      aria-label={name}
    >
      {(['model', 'level'] as const).map((part) => {
        const isDefault = pair.source[part] === 'default';
        const bothDefault = pair.source.model === 'default' && pair.source.level === 'default';
        return (
          <span
            key={part}
            className={cn(
              'inline-flex items-center gap-[3px] px-[7px] text-foreground [&_svg.icon]:size-[9px]',
              part === 'model'
                ? 'rounded-l-[9px] bg-[color-mix(in_srgb,var(--fg)_17%,transparent)]'
                : 'rounded-r-[9px] bg-accent text-card-foreground',
              part === 'level' && pair.source.model !== 'default' && !isDefault && 'ml-px',
              isDefault && 'border border-dashed border-current bg-transparent px-1.5 text-muted-foreground',
              isDefault && part === 'level' && bothDefault && 'border-l-0 pl-[7px]',
            )}
            data-part={part}
            data-source={pair.source[part]}
          >
            {pair.source[part] === 'pinned' && <Icon name="pin" />}
            <span>{pair[part]}</span>
          </span>
        );
      })}
    </span>
  );
}

const STATE_TEXT: Record<string, string> = {
  works: 'text-working',
  waits: 'text-needs',
  blocked: 'text-needs',
  'dirty-tree': 'text-caution',
  'no-progress': 'text-destructive',
};
const STATUS =
  'inline-flex items-center overflow-hidden font-sans text-[0.75rem] leading-[1.2] font-medium [&>*]:flex-none [&>*]:whitespace-nowrap [&>:last-child]:min-w-0 [&>:last-child]:text-ellipsis [&_.icon]:size-[13px]';
const DETAIL = "font-normal text-muted-foreground before:mr-[7px] before:opacity-70 before:content-['·'_/_'']";

function Status({
  card,
  env,
  hasGlyph = true,
  isShort = false,
  className,
}: {
  card: CardData;
  env: Env;
  hasGlyph?: boolean;
  isShort?: boolean;
  className?: string;
}) {
  const quiet = isShort ? 'text-muted-foreground' : 'text-card-foreground';
  if (card.state === 'set-aside')
    return (
      <span
        className={cn(
          STATUS,
          'min-w-0 gap-1 rounded-[999px] border border-dashed border-border-strong py-px pr-[7px] pl-[5px] text-card-foreground [&>:last-child]:flex-[0_1_auto] [&>:last-child]:overflow-hidden [&_.icon]:size-3',
          className,
        )}
      >
        <Icon name="aside" />
        <span className="font-semibold text-foreground first-letter:uppercase">{stateLabel(card)}</span>
        {card.step && <span className={cn(DETAIL, 'mono cq-300:hidden')}>{card.step}</span>}
      </span>
    );
  if (card.state) {
    const agent = isShort ? null : agentOf(card, env.registry);
    return (
      <span
        className={cn(
          STATUS,
          'min-w-0 gap-[7px] [&>:last-child]:flex-[0_1_auto] [&>:last-child]:overflow-hidden',
          STATE_TEXT[card.state] ?? quiet,
          card.state === 'starts' && '[&_.icon]:animate-[turn_0.9s_linear_infinite] [&_.icon]:text-working',
          className,
        )}
      >
        {hasGlyph && <Icon name={STATUS_ICONS[card.state] ?? 'pending'} />}
        <span className="first-letter:uppercase">{stateLabel(card)}</span>
        {agent && (
          <span
            className={cn(
              DETAIL,
              'cq-360:absolute cq-360:-m-px cq-360:size-px cq-360:overflow-hidden cq-360:[clip:rect(0_0_0_0)] cq-360:whitespace-nowrap',
            )}
          >
            {agent.name}
          </span>
        )}
        {!isShort && card.step && card.step !== card.type && (
          <span className={cn(DETAIL, 'mono cq-300:hidden')}>{card.step}</span>
        )}
      </span>
    );
  }
  if (!card.step)
    return <span className={cn(STATUS, 'min-w-0 gap-[7px] [&>:last-child]:overflow-hidden', quiet, className)} />;
  return (
    <span
      className={cn(
        STATUS,
        'min-w-[auto] gap-1 overflow-visible [&>:last-child]:flex-none [&>:last-child]:overflow-visible [&_.icon]:text-muted-foreground',
        isShort && 'flex-wrap gap-y-1',
        quiet,
        className,
      )}
    >
      {hasGlyph && <Icon name="pending" />}
      <span className="font-normal text-muted-foreground">next</span>
      <span className="mono font-normal text-foreground">{card.step}</span>
      {card.effort && <StartLabel pair={card.effort} />}
      {card.gate === 'auto' && <GateLabel mode={env.auto} />}
    </span>
  );
}

function LiveLine({ card }: { card: CardData }) {
  if (!card.diff) return null;
  return (
    <div
      className="flex min-h-[18px] min-w-0 items-center gap-2 font-mono text-[0.75rem] leading-none font-normal text-card-foreground [&_.icon]:size-[13px] [&_.icon]:text-working"
      title="Changed since the branch left its base"
    >
      <Icon name="diff" />
      <span className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap">{`${card.diff.files} ${card.diff.files === 1 ? 'file' : 'files'} changed`}</span>
      <span className="ml-auto flex-none text-muted-foreground tabular-nums">
        <i className="text-card-foreground not-italic">{`+${card.diff.added}`}</i>
        {` −${card.diff.removed}`}
      </span>
    </div>
  );
}

const ACT =
  'm-0 rounded-lg border border-[color-mix(in_srgb,var(--needs-tint)_22%,transparent)] bg-[color-mix(in_srgb,var(--needs-tint)_7%,transparent)] px-2.5 py-2 text-[0.75rem] leading-[1.45] text-card-foreground [overflow-wrap:anywhere]';

function ActLine({ card }: { card: CardData }) {
  const what = copyWhat(card);
  const act = card.act as string;
  if (!what) return <p className={ACT}>{card.act}</p>;
  return (
    <p className={cn(ACT, 'flex items-center gap-1.5 border-border bg-secondary py-[3px] pr-[3px] pl-2.5')}>
      <code
        className="min-w-0 flex-1 font-mono text-[0.71875rem] leading-normal font-normal text-foreground [overflow-wrap:normal]"
        title={act}
      >
        {shortPath(act)
          .split('/')
          .map((part, index) => (
            <Fragment key={index}>{index ? [<wbr key="w" />, `/${part}`] : part}</Fragment>
          ))}
      </code>
      <IconButton
        name="copy"
        label={`Copy the ${what}`}
        title={`Copy the ${what} (c)`}
        className="phone:size-11"
        press={() => copy(act, what)}
      />
    </p>
  );
}

const NOTE = 'm-0 text-[0.75rem] leading-[1.45] [overflow-wrap:anywhere]';

function StartLine({ number, launch, isCompact }: { number: IssueKey; launch: Launch; isCompact: boolean }) {
  const now = useScreen((state) => state.now);
  const isSlow = launch.phase === 'pending' && now - launch.at >= SLOW_START;
  useEffect(() => {
    if (isSlow) screen.announceStart(number);
  }, [isSlow, number]);
  return (
    <p className={cn(NOTE, 'text-card-foreground', isCompact && 'col-[2/-1]')} data-number={number} hidden={!isSlow}>
      {isSlow ? `${SLOW_START_TEXT} · ${age(new Date(launch.at).toISOString(), now, true)}` : null}
    </p>
  );
}

function StartNote({
  card,
  failure,
  launch,
  isCompact,
}: {
  card: CardData;
  failure?: string;
  launch?: Launch;
  isCompact: boolean;
}) {
  if (failure !== undefined)
    return <p className={cn(NOTE, 'text-destructive', isCompact && 'col-[2/-1]')}>{`Last start failed: ${failure}`}</p>;
  if (card.state !== 'starts' || card.number === null || launch?.phase !== 'pending') return null;
  return <StartLine number={card.number} launch={launch} isCompact={isCompact} />;
}

function AsideChip({ action }: { action: Action }) {
  const isOpen = action.isBusy;
  return (
    <button
      type="button"
      className={cn(
        'group/chip ml-1 inline-flex [&_.icon]:size-[13px] h-[26px] min-w-[26px] shrink-0 cursor-pointer items-center gap-0 py-0 rounded-[7px] border border-transparent bg-transparent px-1.5 text-[0.75rem] font-medium text-muted-foreground transition-[background,border-color,color,gap] duration-150 ease-[ease] group-focus-within/card:text-card-foreground group-[:hover]/card:text-card-foreground focus-visible:gap-[5px] focus-visible:border-border focus-visible:bg-accent focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-1 focus-visible:outline-ring no-hover:gap-[5px] phone:relative phone:before:absolute phone:before:top-1/2 phone:before:left-1/2 phone:before:h-[max(100%,44px)] phone:before:w-[max(100%,44px)] phone:before:content-[""] phone:before:[transform:translate(-50%,-50%)]',
        !action.isDisabled &&
          '[&:hover]:gap-[5px] [&:hover]:border-border [&:hover]:bg-accent [&:hover]:text-foreground',
        action.isDisabled && 'cursor-not-allowed opacity-[0.42]',
        isOpen && 'cursor-not-allowed gap-[5px] opacity-70',
      )}
      title={action.title}
      aria-label={action.name}
      aria-disabled={action.isDisabled ? 'true' : undefined}
      aria-busy={action.isBusy ? 'true' : undefined}
      onClick={() => void action.run?.()}
    >
      <Icon name={action.icon} />
      <span
        className={cn(
          'max-w-0 overflow-hidden whitespace-nowrap transition-[max-width] duration-200 ease-[cubic-bezier(0.2,0.8,0.2,1)] group-focus-visible/chip:max-w-[80px] no-hover:max-w-[80px]',
          !action.isDisabled && 'group-[:hover]/chip:max-w-[80px]',
          isOpen &&
            'max-w-[100px] group-focus-visible/chip:max-w-[100px] group-[:hover]/chip:max-w-[100px] no-hover:max-w-[100px]',
        )}
      >
        {action.label}
      </span>
    </button>
  );
}

// Base UI asks after the menu closed; a pick or a click may have moved the focus by then.
const finalFocus = (trigger: RefObject<HTMLElement | null>, key: string, column: RefObject<string | null>) => () => {
  if (screen.get().menu !== null) return false;
  const active = document.activeElement;
  if (active !== null && active !== document.body && !active.closest('[data-slot="dropdown-menu-content"]'))
    return false;
  return (
    (trigger.current?.isConnected ? trigger.current : null) ??
    document.querySelector<HTMLElement>(`#tp-board .card[data-key="${CSS.escape(key)}"]`) ??
    columnStop(column.current) ??
    true
  );
};

function CardMenu({
  kind,
  card,
  cardKey,
  isCompact,
  menu,
  anchor,
  trigger,
  column,
  list,
  children,
}: {
  kind: MenuKind;
  card: CardData;
  cardKey: string;
  isCompact: boolean;
  menu: MenuKind | null;
  anchor: RefObject<HTMLElement | null>;
  trigger: RefObject<HTMLElement | null>;
  column: RefObject<string | null>;
  list: () => (MenuEntry | 'rule')[];
  children?: ReactNode;
}) {
  const close = () => screen.closeMenu(cardKey, kind);
  return (
    <DropdownMenu
      open={menu === kind}
      modal={false}
      onOpenChange={(isOpen) => (isOpen ? screen.openMenu(cardKey, kind, isCompact) : close())}
    >
      {children}
      <DropdownMenuContent
        anchor={anchor}
        aria-label={menuName(card, kind === 'actions' ? 'Actions of' : 'Run options of')}
        finalFocus={finalFocus(trigger, cardKey, column)}
      >
        <FirstFocus />
        <Entries list={list} close={close} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export type CardProps = Readonly<{
  card: CardData;
  cardKey: string;
  column: Column;
  isCompact: boolean;
  level: 'h2' | 'h3' | 'h4';
  isSelected: boolean;
  isUnseen: boolean;
  isStop: boolean;
  isBelow?: boolean;
  isHold?: boolean;
  isPipeline: boolean;
  menu: ScreenState['menu'];
  env: Env;
  isAside: boolean;
  isStopping: boolean;
  refusal?: string;
  failure?: string;
  launch?: Launch;
}>;

const RINGS = {
  plain: {
    none: '[box-shadow:var(--raise)]',
    fg: '[box-shadow:0_0_0_1px_color-mix(in_srgb,var(--fg3)_80%,transparent),var(--raise)]',
    needs: '[box-shadow:0_0_0_1px_color-mix(in_srgb,var(--needs)_80%,transparent),var(--raise)]',
  },
  stripe: {
    none: '[box-shadow:inset_3px_0_0_var(--needs-tint),var(--raise)]',
    fg: '[box-shadow:inset_3px_0_0_var(--needs-tint),0_0_0_1px_color-mix(in_srgb,var(--fg3)_80%,transparent),var(--raise)]',
    needs:
      '[box-shadow:inset_3px_0_0_var(--needs-tint),0_0_0_1px_color-mix(in_srgb,var(--needs)_80%,transparent),var(--raise)]',
  },
} as const;

const lookOf = (isSelected: boolean, isWaits: boolean, isStripe: boolean) =>
  cn(
    isSelected
      ? isWaits
        ? 'border-[color-mix(in_srgb,var(--needs)_80%,transparent)]'
        : 'border-[color-mix(in_srgb,var(--fg3)_80%,transparent)]'
      : isWaits
        ? 'border-[color-mix(in_srgb,var(--needs-tint)_55%,transparent)]'
        : '[&:hover]:border-border-strong',
    isWaits
      ? "isolate bg-[color-mix(in_srgb,var(--needs-tint)_6%,var(--card))] [--fg3:var(--fg2)] before:pointer-events-none before:absolute before:inset-0 before:z-[-1] before:animate-[attention_3s_cubic-bezier(0.45,0,0.55,1)_infinite] before:rounded-[inherit] before:bg-[color-mix(in_srgb,var(--needs-tint)_10%,transparent)] before:content-[''] motion-reduce:before:opacity-70"
      : '[&:hover]:bg-card-hover',
    RINGS[isStripe ? 'stripe' : 'plain'][isSelected ? (isWaits ? 'needs' : 'fg') : 'none'],
  );

const OPEN = {
  stop: { idle: 'open-288:hidden open-304:hidden', busy: 'open-317:hidden open-333:hidden' },
  aside: { idle: 'open-324:hidden open-340:hidden', busy: 'open-353:hidden open-369:hidden' },
} as const;

export const Card = memo(function Card({
  card,
  cardKey,
  column,
  isCompact,
  level,
  isSelected,
  isUnseen,
  isStop,
  isBelow,
  isHold,
  isPipeline,
  menu,
  env,
  refusal,
  failure,
  launch,
}: CardProps) {
  const node = useRef<HTMLElement>(null);
  const more = useRef<HTMLButtonElement>(null);
  const runWith = useRef<HTMLButtonElement>(null);
  const columnOf = useRef<string | null>(null);
  useEffect(() => {
    const col = node.current?.closest('.col');
    columnOf.current = col ? columnId(col) : null;
  });
  const actions = actionsOf(card);
  const [main] = actions;
  const isQuiet = column !== 'needs';
  const text = card.title || `Issue #${card.number}`;
  const Heading = level;
  const title = (
    <Heading
      className={cn(
        'm-0 line-clamp-2 min-w-0 font-sans text-[0.875rem] leading-[1.38] font-semibold tracking-[-0.012em] text-pretty text-foreground [&_a:hover]:underline [&_a:hover]:decoration-border-strong [&_a:hover]:underline-offset-3',
        isCompact && 'text-[0.8125rem] leading-[1.125rem] font-medium',
      )}
      id={`t-${cardKey}`}
      title={text}
    >
      <Link className="" url={card.url}>
        {text}
      </Link>
    </Heading>
  );
  const number = (
    <Link className={isCompact ? 'num flex-none whitespace-nowrap' : 'num'} url={card.url}>
      {`#${card.number}`}
    </Link>
  );
  const runs = runEntries(card);
  const hasTrigger = menu !== null && (menu.kind === 'run' ? runs.length > 0 : menu.isCompact === isCompact);
  const open = hasTrigger ? menu.kind : null;
  useEffect(() => {
    if (menu !== null && !hasTrigger) screen.closeMenu(cardKey, menu.kind);
  });
  const runMenu =
    runs.length === 0 ? null : (
      <CardMenu
        kind="run"
        card={card}
        cardKey={cardKey}
        isCompact={isCompact}
        menu={open}
        anchor={runWith}
        trigger={runWith}
        column={columnOf}
        list={() => runEntries(card)}
      >
        <DropdownMenuTrigger
          ref={runWith}
          className={buttonVariants({
            variant: 'icon',
            size: 'icon',
            className: cn('[&_.i-chevron]:[transform:rotate(90deg)]', isCompact && 'phone:h-11 phone:min-w-11'),
          })}
          aria-label={runs.includes('rule') ? 'Run with another agent or at another level' : 'Run with another agent'}
          title={runs.includes('rule') ? 'Run with another agent or at another level' : 'Run with another agent'}
        >
          <Icon name="chevron" />
        </DropdownMenuTrigger>
      </CardMenu>
    );
  const isIconOnly = isPipeline && isCompact && main !== undefined && !main.isMain;
  const mainButton = main ? (
    <ActionButton
      card={card}
      key={main.id}
      action={main}
      isQuiet={isQuiet}
      className={cn(
        isCompact ? 'phone:h-11 phone:min-w-11' : 'phone:h-11',
        isCompact && !runMenu && '[grid-area:1/3] cq-259:justify-self-start cq-259:[grid-area:3/2]',
        isIconOnly && 'w-7 p-0 [&_.label]:hidden',
      )}
    />
  ) : null;
  const aside =
    card.state === 'set-aside' && card.path
      ? `The lane worktree has uncommitted changes: ${shortPath(card.path)}`
      : null;
  const headAct = actions.find((action) => action.id === 'aside' || action.id === 'stop');
  const chipKind = headAct?.icon === 'stop' ? 'stop' : headAct?.icon === 'aside' ? 'aside' : null;
  const hideOnOpen = chipKind ? cn(OPEN[chipKind].idle, headAct?.isBusy && OPEN[chipKind].busy) : '';
  const isWaits = card.state === 'waits';
  const isNext = !card.state && Boolean(card.step);
  const className = cn(
    '@container cursor-default',
    isCompact
      ? 'compact flex-col grid grid-cols-[18px_minmax(0,1fr)_auto] items-center gap-x-2.5 gap-y-[5px] py-2.5 pr-2.5 pl-3'
      : 'flex flex-col gap-2 px-3.5 py-3',
    'relative flex-none transition-[border-color,background-color] duration-150 ease-[ease]',
    lookOf(isSelected, isWaits, isPipeline && column === 'needs'),
    isHold && 'w-[340px] phone:w-auto',
    isSelected && 'is-selected',
    isUnseen && 'is-unseen',
    column === 'needs' && 'is-needs',
  );
  const warning = isCompact ? 'warning col-[2/-1] mt-1.5 px-2 py-[5px]' : 'warning';
  const body = isCompact ? (
    <>
      <Mark card={card} registry={env.registry} />
      <div className="contents">
        {title}
        <div className="col-[2/-1] flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1 overflow-hidden font-mono text-[0.75rem] leading-[1.3] font-normal text-muted-foreground">
          {number}
          {card.type && card.type !== card.step && (
            <span className="inline-flex flex-none gap-1.5 whitespace-nowrap cq-340:hidden">
              <span className="sep">·</span>
              {card.type}
            </span>
          )}
          <span className={isNext ? 'sep hidden flex-none whitespace-nowrap' : 'sep flex-none whitespace-nowrap'}>
            ·
          </span>
          <Status
            card={card}
            env={env}
            hasGlyph={card.state === 'starts'}
            isShort
            className="flex-[0_1_auto] whitespace-nowrap"
          />
        </div>
        <StartNote card={card} failure={failure} launch={launch} isCompact />
        {card.warning && <p className={warning}>{card.warning}</p>}
        {aside && <p className={warning}>{aside}</p>}
      </div>
      {mainButton &&
        (runMenu ? (
          <div className="inline-flex items-center gap-1.5 [grid-area:1/3] cq-259:justify-self-start cq-259:[grid-area:3/2]">
            {mainButton}
            {runMenu}
          </div>
        ) : (
          mainButton
        ))}
      {isUnseen && <UnseenDot className="absolute top-[9px] left-[5px]" />}
    </>
  ) : (
    <>
      <div className="flex h-[18px] min-w-0 items-center gap-[7px] [&:not(:has(>[data-track]))>button:first-of-type]:ml-auto font-mono text-[0.71875rem] leading-none font-normal text-muted-foreground phone:min-h-8">
        {isUnseen && <UnseenDot />}
        <Mark card={card} registry={env.registry} identifiedByText={Boolean(card.state)} />
        {number}
        {card.type && (
          <>
            <span className={cn('sep', hideOnOpen)}>·</span>
            <span className={cn('min-w-0 overflow-hidden text-ellipsis whitespace-nowrap', hideOnOpen)}>
              {card.type}
            </span>
          </>
        )}
        <Track card={card} flow={env.flow} />
        {headAct && <AsideChip action={headAct} />}
        <DropdownMenuTrigger
          ref={more}
          className={buttonVariants({
            variant: 'icon',
            size: 'icon',
            className: '-mt-[5px] -mr-1.5 -mb-[5px] phone:-mt-1.5 phone:-mr-2 phone:-mb-1.5 phone:size-11',
          })}
          aria-label="More actions (m)"
          title="More actions (m)"
        >
          <Icon name="dots" />
        </DropdownMenuTrigger>
      </div>
      {title}
      <StartNote card={card} failure={failure} launch={launch} isCompact={false} />
      {card.state === 'works' && <LiveLine card={card} />}
      <PrChips pr={card.pr} />
      {card.act && card.state !== 'no-progress' && <ActLine card={card} />}
      {card.warning && <p className={warning}>{card.warning}</p>}
      {refusal && <p className={warning}>{refusal}</p>}
      <div className="flex min-h-7 items-center justify-between gap-2.5 cq-360:flex-col cq-360:items-stretch">
        <Status card={card} env={env} />
        <div className="flex flex-none items-center gap-2 cq-360:justify-end">
          {card.state !== 'starts' && (
            <Timed
              iso={card.since}
              isFine={Boolean(card.sessionId) && LIVE.has(card.state as string)}
              className="mr-0.5 font-mono text-[0.71875rem] leading-none font-normal text-muted-foreground normal-nums cq-360:mr-auto"
            />
          )}
          {mainButton}
          {runMenu}
        </div>
      </div>
    </>
  );
  return (
    <CardMenu
      kind="actions"
      card={card}
      cardKey={cardKey}
      isCompact={isCompact}
      menu={open}
      anchor={isCompact ? node : more}
      trigger={isCompact ? node : more}
      column={columnOf}
      list={() => menuOf(card, cardKey)}
    >
      <CardSurface
        inset="none"
        render={<article />}
        ref={node}
        className={`card ${className}`}
        data-state={card.state ?? 'next'}
        data-key={cardKey}
        data-url={card.url ?? undefined}
        data-hidden={isBelow === undefined ? undefined : String(isBelow)}
        tabIndex={isStop ? 0 : -1}
        aria-labelledby={`t-${cardKey}`}
      >
        {body}
      </CardSurface>
    </CardMenu>
  );
});
