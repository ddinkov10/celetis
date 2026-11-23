import { useQuery } from '@tanstack/react-query';
import { cn } from 'cn';
import type { ComponentProps, ReactNode } from 'react';
import type { Board } from '../../types.ts';
import { ChatMark } from '../coordinator/button.tsx';
import { useCoordinator } from '../coordinator/coordinator.ts';
import { Operations } from '../operations/operations.tsx';
import { viewOptions } from '../query.ts';
import { AREA_ICONS, AREA_NAMES, AREAS, type Area, badgeText, FIND_KEY, isChatShown } from '../shell.ts';
import { shellStore, useShellStore } from '../store.ts';
import { Badge } from '../ui/badge.tsx';
import { Button } from '../ui/button.tsx';
import {
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  Sidebar as SidebarRoot,
} from '../ui/sidebar.tsx';
import { capital, SERVER_DOWN } from '../ui.ts';
import { Control } from './control.tsx';
import { Home } from './home.tsx';
import { Icon } from './icon.tsx';

const SKIP =
  'absolute -top-[60px] left-2 z-[200] inline-flex min-h-8 items-center rounded-lg border border-border-strong bg-card px-3 text-[0.78125rem] leading-none font-medium text-foreground focus:top-2 focus:shadow-float phone:min-h-11';

const BANNER =
  "banner m-0 flex items-center gap-2.5 rounded-xl border border-border-strong bg-secondary px-3.5 py-[9px] text-[0.78125rem] text-foreground [overflow-wrap:anywhere] before:size-[7px] before:flex-none before:rounded-full before:bg-muted-foreground before:content-['']";
const WARN =
  'border-[color-mix(in_srgb,var(--amber)_30%,transparent)] bg-[color-mix(in_srgb,var(--amber)_9%,transparent)] before:bg-caution';

const BADGES: Partial<Record<Area, { id: string; count: 'home' | 'operations' }>> = {
  home: { id: 'home-badge', count: 'home' },
  operations: { id: 'ops-badge', count: 'operations' },
};

const needLabel = (name: string, count: number) => (count === 0 ? name : `${name}, ${count} need you`);
const current = (isCurrent: boolean) => (isCurrent ? ('page' as const) : undefined);

const failedItems = (data: Board | undefined, isDown: boolean): string[] => {
  const name = capital(data?.tracker ?? 'Issues');
  const fresh = isDown ? SERVER_DOWN : data?.source.error ? `cannot read: ${data.source.error}` : null;
  return [...(fresh ? [`${name}: ${fresh}`] : []), ...(data?.terminal.ok === false ? ['herdr: down'] : [])];
};

type ControlMark = ReturnType<typeof useControlMark>;
const useControlMark = () => {
  const { data, isError } = useQuery(viewOptions);
  const updateAccent = useShellStore((state) => state.inputs.updateAccent);
  const failed = failedItems(data, isError);
  const name = ['Control', ...failed].join(', ');
  return {
    'aria-label': failed.length ? name : undefined,
    title: failed.length ? name : undefined,
    'data-mark': failed.length ? 'fail' : updateAccent ? 'update' : undefined,
  };
};

function Intake({ inBar }: { inBar: boolean }) {
  const { reason, pending } = useShellStore((state) => state.inputs.intake);
  return (
    <div
      className={cn(
        'flex flex-none gap-1.5',
        inBar ? 'relative items-center justify-center' : 'flex-col items-stretch',
      )}
    >
      <Button
        variant="outline"
        id="intake"
        aria-describedby="intake-reason"
        aria-disabled={reason !== null}
        aria-busy={pending}
        title={reason ?? 'Open a fresh intake session'}
        onClick={() => shellStore.handlers().intake()}
        className={
          inBar
            ? 'h-12 w-[calc(100%-8px)] flex-col rounded-xl gap-1 border-border-strong bg-accent p-0 text-[0.6875rem] leading-none text-foreground aria-disabled:border-border aria-disabled:bg-transparent aria-disabled:text-muted-foreground [&_.icon]:box-content [&_.icon]:size-[18px] [&_.icon]:rounded-[14px] [&_.icon]:px-[15px] [&_.icon]:py-[3px]'
            : 'h-8 justify-start gap-2.5 px-2.5 rail:h-[50px] rail:flex-col rail:justify-center rail:gap-[5px] rail:px-0.5 rail:py-1.5 rail:text-center rail:text-[0.6875rem] rail:leading-[1.1]'
        }
      >
        <Icon name="spark" />
        <span className="label">{pending ? 'Opening…' : 'New intake'}</span>
      </Button>
      <span
        id="intake-reason"
        className={cn(
          'text-xs text-card-foreground [overflow-wrap:anywhere]',
          inBar
            ? 'pointer-events-none absolute bottom-[calc(100%+8px)] left-1/2 w-max max-w-[calc(100vw-32px)] -translate-x-1/2 rounded-sm border border-border bg-card px-2 py-1'
            : 'px-2.5 rail:p-0 rail:text-center rail:text-[0.6875rem]',
        )}
        hidden={pending || reason === null}
      >
        {pending ? '' : (reason ?? '')}
      </span>
    </div>
  );
}

function SkipLinks() {
  const shell = useShellStore((state) => state.shell);
  const isPhone = useShellStore((state) => state.isPhone);
  const isOps = shell.area === 'operations';
  const isDetails = isOps && shell.details !== null && (!isPhone || shell.pane === 'chat');
  return (
    <div className="contents" id="skips">
      <a className={SKIP} href="#side">
        Skip to the sidebar
      </a>
      <a
        className={SKIP}
        id="skip-center"
        href={!isOps ? `#area-${shell.area}` : isDetails ? '#panel' : '#coordinator'}
        hidden={isOps && !isChatShown(shell, isPhone) && !isDetails}
      >
        {!isOps ? 'Skip to the work area' : isDetails ? 'Skip to the details' : 'Skip to the chat'}
      </a>
      <a className={SKIP} id="skip-pane" href="#pane" hidden={!isOps || (isPhone && shell.pane !== 'agents')}>
        Skip to the work views
      </a>
    </div>
  );
}

function Destination({ area, mark }: { area: Area; mark?: ControlMark }) {
  const isCurrent = useShellStore((state) => !state.isPhone && state.shell.area === area);
  const badges = useShellStore((state) => state.inputs.badges);
  const badge = BADGES[area];
  const count = badge ? badges[badge.count] : 0;
  return (
    <SidebarMenuButton
      data-area={area}
      aria-current={current(isCurrent)}
      {...(mark ?? { 'aria-label': badge ? needLabel(AREA_NAMES[area], count) : undefined })}
      className={cn(
        area === 'control' &&
          'data-mark:after:absolute data-mark:after:top-1/2 data-mark:after:right-2.5 data-mark:after:-mt-1 data-mark:after:size-2 data-mark:after:rounded-full data-mark:after:bg-needs data-mark:after:content-[""] data-[mark=fail]:after:bg-caution rail:data-mark:after:top-1 rail:data-mark:after:right-auto rail:data-mark:after:left-[calc(50%+6px)] rail:data-mark:after:mt-0',
      )}
      onClick={() => shellStore.handlers().go(area)}
    >
      <Icon name={AREA_ICONS[area]} />
      <span className="label min-w-0 flex-1 rail:flex-none">{AREA_NAMES[area]}</span>
      {badge && (
        <Badge
          variant="count"
          id={badge.id}
          className="rail:absolute rail:top-[3px] rail:left-[calc(50%+4px)]"
          hidden={count === 0}
        >
          {badgeText(count)}
        </Badge>
      )}
    </SidebarMenuButton>
  );
}

function ControlDestination() {
  return <Destination area="control" mark={useControlMark()} />;
}

function Sidebar() {
  const { data } = useQuery(viewOptions);
  const isPhone = useShellStore((state) => state.isPhone);
  const hints = useShellStore((state) => state.inputs.hints);
  return (
    <SidebarRoot id="side" aria-label="Board">
      <SidebarHeader>
        <span
          className="grid size-[26px] flex-none place-items-center rounded-lg bg-foreground text-background [&_.icon]:size-3.5"
          id="logo"
        >
          <Icon name="logo" />
        </span>
        <h1 className="sr-only">Agent board</h1>
        <span
          className="min-w-0 truncate text-sm leading-none font-semibold tracking-[-0.012em] text-foreground rail:max-w-full rail:text-[0.6875rem] rail:font-medium rail:text-card-foreground"
          id="repo"
          title={data?.repo}
        >
          {data?.repo}
        </span>
      </SidebarHeader>
      {!isPhone && <Intake inBar={false} />}
      <Button
        variant="outline"
        id="find"
        aria-label="Search or run a step: the cards, history, and commands"
        aria-keyshortcuts="Control+K Meta+K /"
        className="h-8 w-full justify-start gap-2.5 py-0 pr-1.5 pl-2.5 text-left leading-normal font-normal text-muted-foreground hover:bg-secondary hover:text-card-foreground rail:h-[50px] rail:flex-col rail:justify-center rail:gap-[5px] rail:px-0.5 rail:py-1.5 rail:text-center rail:text-[0.6875rem] rail:leading-[1.1] rail:font-medium phone:size-11 phone:flex-none phone:justify-center phone:p-0 [&_.icon]:size-3.5"
      >
        <Icon name="search" />
        <span className="min-w-0 flex-1 truncate rail:flex-none rail:text-card-foreground phone:hidden">Search</span>
        <kbd className="rail:hidden phone:hidden">{FIND_KEY}</kbd>
      </Button>
      <SidebarMenu id="dests">
        {AREAS.map((area) => (
          <SidebarMenuItem key={area}>
            {area === 'control' ? <ControlDestination /> : <Destination area={area} />}
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
      <SidebarFooter id="side-foot">
        <span
          className="mb-1.5 flex flex-wrap gap-x-2.5 gap-y-1.5 border-b border-border px-2 pb-2"
          id="hints"
          aria-hidden="true"
        >
          {hints.map((pair) => (
            <span className="inline-flex items-center gap-1.5" key={pair.join(' ')}>
              {pair.slice(0, -1).map((key) => (
                <kbd className="min-h-[18px] min-w-[18px] px-1 text-[0.6875rem]" key={key}>
                  {key}
                </kbd>
              ))}
              {pair.at(-1)}
            </span>
          ))}
        </span>
      </SidebarFooter>
    </SidebarRoot>
  );
}

function AreaBox({ area, children }: { area: Area; children: ReactNode }) {
  const isShown = useShellStore((state) => state.shell.area === area);
  return (
    <div className={isShown ? 'contents' : undefined} hidden={!isShown}>
      {children}
    </div>
  );
}

function Throughput() {
  return (
    <section className="area-screen" id="area-throughput" aria-labelledby="area-throughput-title">
      <div className="area-empty">
        <h2 id="area-throughput-title">Throughput is not built yet.</h2>
        <p>Throughput will show how fast the issues move from intent to the trunk.</p>
      </div>
    </section>
  );
}

function Work() {
  const { data, isError } = useQuery(viewOptions);
  const area = useShellStore((state) => state.shell.area);
  return (
    <main className="work" id="work" tabIndex={-1} aria-label="Work area" data-area={area}>
      <div className="flex-none not-has-[.banner:not([hidden])]:hidden">
        <p className={cn(BANNER, WARN)} id="dirty" role="alert" hidden={!data?.noRun}>
          {data?.noRun}
        </p>
        <p className={BANNER} id="stale" role="alert" hidden={!isError && !data?.source.error}>
          The board read failed. The cards and history show the last good read.
        </p>
      </div>
      <AreaBox area="home">
        <Home />
      </AreaBox>
      <AreaBox area="control">
        <Control />
      </AreaBox>
      <AreaBox area="throughput">
        <Throughput />
      </AreaBox>
      <AreaBox area="operations">
        <Operations />
      </AreaBox>
    </main>
  );
}

function DockItem({ className, ...props }: ComponentProps<typeof Button>) {
  return (
    <Button
      variant="ghost"
      className={cn(
        'relative h-14 flex-col gap-1 rounded-xl border-0 p-0 transition-all duration-0 hover:bg-transparent text-[0.6875rem] leading-none text-muted-foreground aria-[current=page]:text-foreground aria-expanded:text-foreground [&_.icon]:box-content [&_.icon]:size-[18px] [&_.icon]:rounded-[14px] [&_.icon]:px-[15px] [&_.icon]:py-[5px] aria-[current=page]:[&_.icon]:bg-accent aria-expanded:[&_.icon]:bg-accent',
        className,
      )}
      {...props}
    />
  );
}

function BottomBar() {
  const shell = useShellStore((state) => state.shell);
  const isPhone = useShellStore((state) => state.isPhone);
  const chat = useCoordinator((state) => state.mirror);
  const agents = useShellStore((state) => state.inputs.badges.agents);
  const moreOpen = useShellStore((state) => state.inputs.moreOpen);
  const mark = useControlMark();
  const isOps = shell.area === 'operations';
  return (
    <nav
      id="bar"
      aria-label="Panes"
      className="fixed inset-x-0 bottom-0 z-[7] hidden h-[var(--dock)] grid-cols-[repeat(3,minmax(0,1fr))_minmax(0,1.25fr)_repeat(2,minmax(0,1fr))] items-center border-t border-border bg-background px-2 py-1.5 [anchor-name:--bar] phone:grid"
    >
      <DockItem
        id="pb-home"
        aria-current={current(isPhone && shell.area === 'home')}
        onClick={() => shellStore.handlers().go('home')}
      >
        <Icon name="home" />
        <span className="label">Home</span>
      </DockItem>
      <DockItem
        className="min-h-11"
        id="pb-chat"
        data-state={chat.state}
        data-stale={chat.stale ? '' : undefined}
        data-new={chat.unseen ? '' : undefined}
        aria-label={chat.label}
        title={chat.title}
        aria-current={current(isPhone && isOps && shell.pane === 'chat')}
        onClick={() => shellStore.handlers().showChat()}
      >
        <Icon name="message" />
        <span className="label">Chat</span>
        <ChatMark state={chat.state} stale={chat.stale} className="absolute top-1.5 left-[calc(50%+9px)]" />
      </DockItem>
      <DockItem
        id="pb-agents"
        aria-label={needLabel('Agents', agents)}
        aria-current={current(isPhone && isOps && shell.pane === 'agents')}
        onClick={() => shellStore.handlers().agents()}
      >
        <Icon name="board" />
        <span className="label">Agents</span>
        <Badge variant="count" className="absolute top-0.5 left-[calc(50%+6px)]" id="now-badge" hidden={agents === 0}>
          {badgeText(agents)}
        </Badge>
      </DockItem>
      {isPhone && <Intake inBar />}
      <DockItem
        id="pb-control"
        className="data-mark:after:absolute data-mark:after:top-1.5 data-mark:after:left-[calc(50%+8px)] data-mark:after:size-2 data-mark:after:rounded-full data-mark:after:bg-needs data-mark:after:content-[''] data-[mark=fail]:after:bg-caution"
        aria-current={current(isPhone && shell.area === 'control')}
        {...mark}
        onClick={() => shellStore.handlers().go('control')}
      >
        <Icon name="sliders" />
        <span className="label">Control</span>
      </DockItem>
      <DockItem
        id="board-more"
        aria-label="More board actions"
        aria-haspopup="menu"
        aria-expanded={moreOpen}
        aria-current={current(isPhone && shell.area === 'throughput')}
        title="More board actions"
      >
        <Icon name="dots" />
        <span className="label">More</span>
      </DockItem>
    </nav>
  );
}

export function Shell() {
  return (
    <>
      <SkipLinks />
      <Sidebar />
      <Work />
      <BottomBar />
    </>
  );
}
