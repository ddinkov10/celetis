import { cn } from 'cn';
import { useEffect, useState } from 'react';
import type { Board } from '../../types.ts';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AgentsColumns, HumanStrip } from './cards.tsx';
import { useBoard, useNow, useUpdate } from './data.ts';
import { Icon } from './icon.tsx';
import { Palette } from './palette.tsx';
import { PrototypeBar, type State } from './prototype-bar.tsx';

const FIND_KEY = /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘K' : 'Ctrl K';
const AREAS = [
  ['home', 'Home', 'home'],
  ['operations', 'Operations', 'board'],
  ['control', 'Control', 'sliders'],
  ['throughput', 'Throughput', 'trend'],
] as const;
type Area = (typeof AREAS)[number][0];
const phone = matchMedia('(max-width: 719px)');

const dot = 'absolute size-2 rounded-full bg-needs';

function Sidebar({ board, area, setArea, needs, isAccent, openPalette }: { board: Board | null; area: Area; setArea: (area: Area) => void; needs: number; isAccent: boolean; openPalette: () => void }) {
  return (
    <nav
      id="side"
      aria-label="Board"
      className="col-start-1 row-start-1 flex min-h-0 flex-col gap-1.5 overflow-y-auto border-r border-border bg-background px-2.5 pt-3 pb-2.5 rail:px-2 rail:pt-2.5 rail:pb-2 phone:min-h-14 phone:flex-row phone:items-center phone:gap-2 phone:overflow-visible phone:border-r-0 phone:border-b phone:px-4 phone:py-1.5"
    >
      <div className="mb-1.5 flex min-h-9 min-w-0 items-center gap-2.5 px-1.5 rail:min-h-0 rail:flex-col rail:gap-1.5 rail:px-0 rail:pt-0.5 rail:pb-1 phone:m-0 phone:min-h-0 phone:flex-1 phone:p-0">
        <span className="grid size-[26px] flex-none place-items-center rounded-lg bg-foreground text-background">
          <Icon name="logo" className="size-3.5" />
        </span>
        <h1 className="sr-only">Agent board</h1>
        <span className="min-w-0 truncate text-base leading-none font-semibold tracking-[-0.012em] text-foreground rail:max-w-full rail:text-[0.6875rem] leading-none rail:font-medium rail:text-ink-muted">
          {board?.repo}
        </span>
      </div>
      <Button
        variant="outline"
        className="min-h-8 justify-start gap-2.5 px-2.5 rail:min-h-[50px] rail:flex-col rail:justify-center rail:gap-[5px] rail:px-0.5 rail:py-1.5 rail:text-[0.6875rem] rail:leading-[1.1] phone:hidden"
      >
        <Icon name="spark" />
        <span>New intake</span>
      </Button>
      <button
        type="button"
        onClick={openPalette}
        aria-label="Search or run a step: the cards, history, and commands"
        aria-keyshortcuts="Control+K Meta+K /"
        className="flex min-h-8 w-full items-center gap-2.5 rounded-lg border border-border bg-secondary pr-1.5 pl-2.5 text-left text-[0.78125rem] leading-none text-muted-foreground transition-colors duration-150 hover:border-input hover:text-ink-muted rail:min-h-[50px] rail:flex-col rail:justify-center rail:gap-[5px] rail:px-0.5 rail:py-1.5 rail:text-center rail:text-[0.6875rem] leading-none rail:font-medium phone:size-11 phone:min-h-11 phone:justify-center phone:p-0"
      >
        <Icon name="search" className="size-3.5" />
        <span className="min-w-0 flex-1 truncate rail:flex-none rail:text-ink-muted phone:hidden">Search</span>
        <kbd className="rail:hidden phone:hidden">{FIND_KEY}</kbd>
      </button>
      <ul className="m-0 mt-2 flex list-none flex-col gap-0.5 overflow-y-auto border-t border-border p-0 pt-2.5 phone:hidden">
        {AREAS.map(([key, name, icon]) => (
          <li key={key}>
            <button
              type="button"
              aria-current={area === key ? 'page' : undefined}
              onClick={() => setArea(key)}
              className="relative flex min-h-[34px] w-full items-center gap-2.5 rounded-lg border border-transparent bg-transparent pr-2 pl-2.5 text-left text-[0.78125rem] leading-none font-medium text-ink-muted transition-colors duration-150 hover:bg-secondary hover:text-foreground focus-visible:-outline-offset-2 aria-[current=page]:border-border aria-[current=page]:bg-accent aria-[current=page]:text-foreground rail:min-h-[50px] rail:flex-col rail:justify-center rail:gap-[5px] rail:px-0.5 rail:py-1.5 rail:text-center rail:text-[0.6875rem] rail:leading-[1.1]"
            >
              <Icon name={icon} />
              <span className="min-w-0 flex-1 rail:flex-none">{name}</span>
              {key === 'operations' && needs > 0 && (
                <Badge variant="alert" className="rail:absolute rail:top-[3px] rail:left-[calc(50%+4px)]">
                  {needs}
                </Badge>
              )}
              {key === 'control' && isAccent && <i className={cn(dot, 'top-1/2 right-2.5 -mt-1 rail:top-1 rail:right-auto rail:left-[calc(50%+6px)] rail:mt-0')} />}
            </button>
          </li>
        ))}
      </ul>
      <div className="mt-auto flex flex-col items-stretch gap-0.5 border-t border-border px-0.5 pt-2.5 text-xs text-muted-foreground rail:hidden phone:hidden">
        <span aria-hidden="true" className="mb-1.5 flex flex-wrap gap-x-2.5 gap-y-1.5 border-b border-border px-2 pb-2 [&_kbd]:min-h-[18px] [&_kbd]:min-w-[18px] [&_kbd]:px-1">
          <span className="inline-flex items-center gap-1.5">
            <kbd>j</kbd>
            <kbd>k</kbd>Move
          </span>
          <span className="inline-flex items-center gap-1.5">
            <kbd>{FIND_KEY}</kbd>Search
          </span>
        </span>
      </div>
    </nav>
  );
}

function BottomBar({ needs, isAccent, pane, setPane }: { needs: number; isAccent: boolean; pane: 'chat' | 'agents'; setPane: (pane: 'chat' | 'agents') => void }) {
  const item =
    'relative flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl border-0 bg-transparent p-0 text-[0.6875rem] leading-none font-medium text-muted-foreground hover:text-foreground aria-[current=page]:text-foreground [&_svg]:box-content [&_svg]:size-[18px] [&_svg]:rounded-[14px] [&_svg]:px-[15px] [&_svg]:py-[5px] aria-[current=page]:[&_svg]:bg-accent';
  return (
    <nav
      aria-label="Panes"
      className="fixed inset-x-0 bottom-0 z-7 hidden h-[70px] grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.25fr)_minmax(0,1fr)_minmax(0,1fr)] items-center border-t border-border bg-background px-2 py-1.5 phone:grid"
    >
      <button type="button" className={item} aria-current={pane === 'chat' ? 'page' : undefined} onClick={() => setPane('chat')}>
        <Icon name="message" />
        <span>Chat</span>
        <i aria-hidden="true" className="absolute top-1.5 left-[calc(50%+9px)] size-[7px] rounded-full shadow-[inset_0_0_0_1.5px_var(--muted-foreground)]" />
      </button>
      <button type="button" className={item} aria-current={pane === 'agents' ? 'page' : undefined} onClick={() => setPane('agents')}>
        <Icon name="board" />
        <span>Agents</span>
        {needs > 0 && (
          <Badge variant="alert" className="absolute top-0.5 left-[calc(50%+6px)]">
            {needs}
          </Badge>
        )}
      </button>
      <div className="relative flex justify-center">
        <button
          type="button"
          className={cn(item, 'min-h-12 w-[calc(100%-8px)] border border-input bg-accent text-foreground [&_svg]:py-[3px]')}
        >
          <Icon name="spark" />
          <span>New intake</span>
        </button>
      </div>
      <button type="button" className={item}>
        <Icon name="sliders" />
        <span>Control</span>
        {isAccent && <i className={cn(dot, 'top-1.5 left-[calc(50%+8px)]')} />}
      </button>
      <button type="button" className={item} aria-label="More board actions" aria-haspopup="menu">
        <Icon name="dots" />
        <span>More</span>
      </button>
    </nav>
  );
}

function Coordinator({ board }: { board: Board }) {
  const view = board.coordinator;
  const absent = view.state === 'none';
  return (
    <section id="coordinator" aria-labelledby="coordinator-title" className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-3xl border border-input bg-panel">
      <header className="flex min-h-12 flex-none flex-wrap items-center gap-x-2 gap-y-1.5 border-b border-border py-2 pr-2.5 pl-5">
        <h2 id="coordinator-title" className="text-base leading-none font-semibold tracking-[-0.012em] text-foreground">
          Coordinator
        </h2>
        <span className="font-mono text-[0.71875rem] leading-none text-muted-foreground">{view.host}</span>
        <Badge variant="pill" className="bg-secondary text-ink-muted">
          {absent ? 'no session' : view.state}
        </Badge>
      </header>
      <div className="relative flex min-h-0 flex-1">
        <div
          role="log"
          tabIndex={0}
          aria-label="Conversation with the coordinator"
          className="m-0 flex min-w-0 flex-1 flex-col overflow-y-auto px-[max(20px,calc((100%-72ch)/2))] pt-[18px] pb-7 text-sm leading-[1.55] text-foreground phone:px-3.5 phone:pt-4 phone:pb-6"
        >
          {absent && (
            <div className="my-auto py-12 text-center">
              <p className="m-0 font-semibold">No coordinator session</p>
              <p className="m-0 mt-1 text-[0.78125rem] leading-[1.5] text-muted-foreground">Start a session to steer the runs from here.</p>
            </div>
          )}
        </div>
      </div>
      <div className="flex flex-none flex-col gap-2 px-[max(14px,calc((100%-104ch)/2-14px))] pb-3.5 phone:px-2.5 phone:pb-2.5">
        {absent && view.actions.includes('open') && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <Button className="phone:min-h-11">Start a session</Button>
          </div>
        )}
      </div>
    </section>
  );
}

function Pane({ board, now }: { board: Board; now: number }) {
  const needs = board.columns.needs.length;
  return (
    <section id="pane" tabIndex={-1} aria-label="Work views" className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-3xl border border-border bg-panel">
      <Tabs defaultValue="agents" className="min-h-0 flex-1">
        <div className="flex min-h-12 flex-none items-center gap-2 border-b border-border px-2.5 py-2 phone:p-1.5">
          <TabsList aria-label="Work views" className="phone:flex-1">
            <TabsTrigger value="agents">
              <span>Agents</span>
              {needs > 0 && <Badge variant="alert">{needs}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
            <TabsTrigger value="queue">Queue</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="agents" className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto px-2.5 pt-2.5">
          <HumanStrip board={board} now={now} />
          <AgentsColumns board={board} now={now} />
        </TabsContent>
        {(['pipeline', 'queue', 'history'] as const).map((tab) => (
          <TabsContent key={tab} value={tab} className="m-auto p-8 text-center text-xs text-muted-foreground">
            The prototype does not port this tab.
          </TabsContent>
        ))}
      </Tabs>
    </section>
  );
}

const Placeholder = ({ title, text }: { title: string; text: string }) => (
  <section className="m-auto max-w-[44ch] text-center">
    <h2 className="text-base font-semibold text-foreground">{title}</h2>
    <p className="mt-1 text-sm">{text}</p>
  </section>
);

export function App() {
  const board = useBoard();
  const update = useUpdate();
  const now = useNow();
  const params = new URLSearchParams(location.search);
  const [state, setStateRaw] = useState<State>((params.get('state') as State) ?? 'operations-rest');
  const [area, setArea] = useState<Area>('operations');
  const [pane, setPane] = useState<'chat' | 'agents'>('chat');
  const [isPhone, setPhone] = useState(phone.matches);
  useEffect(() => {
    const change = () => setPhone(phone.matches);
    phone.addEventListener('change', change);
    return () => phone.removeEventListener('change', change);
  }, []);
  const setState = (next: State) => {
    setStateRaw(next);
    const url = new URL(location.href);
    url.searchParams.set('variant', 'A');
    url.searchParams.set('state', next);
    history.replaceState(null, '', url);
  };
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.key === 'k' && (event.metaKey || event.ctrlKey)) || (event.key === '/' && !(event.target instanceof HTMLInputElement))) {
        event.preventDefault();
        setState('operations-palette');
      }
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, []);
  const needs = board?.columns.needs.length ?? 0;
  const isAccent = update?.update.phase === 'available';
  const running = board?.columns.running[0];
  useEffect(() => {
    if (board) document.title = `${needs > 0 ? `(${needs}) ` : ''}${board.repo} · Agent board`;
  }, [board, needs]);
  return (
    <div className="grid h-dvh grid-cols-[232px_minmax(0,1fr)] grid-rows-[minmax(0,1fr)] overflow-hidden rail:grid-cols-[88px_minmax(0,1fr)] phone:grid-cols-[minmax(0,1fr)] phone:grid-rows-[auto_minmax(0,1fr)]">
      <div className="contents">
        {[
          ['#side', 'Skip to the sidebar'],
          ['#coordinator', 'Skip to the chat'],
          ['#pane', 'Skip to the work views'],
        ].map(([href, text]) => (
          <a key={href} href={href} className="sr-only z-60 rounded-lg bg-card px-3 py-2 text-foreground shadow-lg focus:not-sr-only focus:fixed focus:top-2 focus:left-2">
            {text}
          </a>
        ))}
      </div>
      <Sidebar board={board} area={area} setArea={setArea} needs={needs} isAccent={isAccent} openPalette={() => setState('operations-palette')} />
      <main aria-label="Work area" className="col-start-2 row-start-1 flex min-h-0 min-w-0 flex-col gap-3 px-4 pt-3 pb-3.5 phone:col-start-1 phone:row-start-2 phone:px-3 phone:pt-3 phone:pb-[82px]">
        {area === 'operations' && board && (
          <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_clamp(360px,30vw,452px)] grid-rows-[minmax(0,1fr)] gap-3.5 phone:grid-cols-[minmax(0,1fr)]">
            {!(isPhone && pane === 'agents') && (
              <div className="flex min-h-0 min-w-0 flex-col">
                <Coordinator board={board} />
              </div>
            )}
            {!(isPhone && pane === 'chat') && <Pane board={board} now={now} />}
          </div>
        )}
        {area === 'home' && <Placeholder title="Home is not built yet." text="The prototype ports only Operations." />}
        {area === 'control' && <Placeholder title="Control" text="The prototype does not port Control." />}
        {area === 'throughput' && <Placeholder title="Throughput is not built yet." text="The prototype ports only Operations." />}
      </main>
      <BottomBar needs={needs} isAccent={isAccent} pane={pane} setPane={setPane} />
      {board && <Palette board={board} open={state === 'operations-palette'} onOpenChange={(open) => setState(open ? 'operations-palette' : 'operations-rest')} />}
      <AlertDialog open={state === 'operations-stop-dialog'} onOpenChange={(open) => setState(open ? 'operations-stop-dialog' : 'operations-rest')}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Stop the {running?.step ?? 'implement'} session of #{running?.number ?? 332}?</AlertDialogTitle>
            <AlertDialogDescription>
              The agent ends and its tab closes. The issue moves to Idle as set aside, and auto mode skips it. Resume opens the saved session again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel autoFocus>Cancel</AlertDialogCancel>
            <AlertDialogAction>Stop session</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {PROTOTYPE_BAR && <PrototypeBar state={state} setState={setState} />}
    </div>
  );
}
