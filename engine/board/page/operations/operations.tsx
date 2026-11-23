import { QueueHost } from '../app/hosts.tsx';
import { ChatButton } from '../coordinator/button.tsx';
import { CoordinatorPanel } from '../coordinator/panel.tsx';
import { badgeText, TABS, type Tab } from '../shell.ts';
import { useShellStore } from '../store.ts';
import { Badge } from '../ui/badge.tsx';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs.tsx';
import { History } from './history.tsx';
import { Panel } from './panel.tsx';
import { setTab } from './state.ts';
import { Board } from './views.tsx';

const NAMES: Record<Tab, string> = { agents: 'Agents', pipeline: 'Pipeline', queue: 'Queue', history: 'History' };
const CONTROLS: Partial<Record<Tab, string>> = { agents: 'tp-board', pipeline: 'tp-board', history: 'history-pane' };

export function Operations() {
  const { tab, pane, details } = useShellStore((state) => state.shell);
  const isPhone = useShellStore((state) => state.isPhone);
  const agents = useShellStore((state) => state.inputs.badges.agents);
  const queueCount = useShellStore((state) => state.inputs.queueCount);
  return (
    <div
      className="group/ops grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_clamp(360px,30vw,452px)] grid-rows-[minmax(0,1fr)] gap-3.5 phone:grid-cols-[minmax(0,1fr)] min-[720px]:data-[tab=pipeline]:grid-cols-[minmax(0,1fr)] min-[720px]:data-[tab=pipeline]:data-[details]:grid-cols-[minmax(0,1fr)_clamp(360px,30vw,452px)]"
      id="area-operations"
      data-tab={tab}
      data-pane={pane}
      data-details={details === null ? undefined : ''}
    >
      <div
        className="flex min-h-0 min-w-0 flex-col phone:group-data-[pane=agents]/ops:hidden min-[720px]:group-data-[tab=pipeline]/ops:contents min-[720px]:group-data-[tab=pipeline]/ops:[&>.coordinator]:hidden [&>.coordinator]:flex-1"
        id="center"
      >
        <CoordinatorPanel />
        <Panel />
      </div>
      <Tabs
        value={tab}
        onValueChange={(value) => {
          const next = TABS.find((each) => each === value);
          if (next) setTab(next);
        }}
        render={<section />}
        className="min-h-0 min-w-0 flex-col overflow-hidden rounded-3xl border border-border bg-panel phone:group-data-[pane=chat]/ops:hidden min-[720px]:group-data-[tab=pipeline]/ops:[grid-area:1/1]"
        id="pane"
        aria-label="Work views"
        tabIndex={-1}
      >
        <div className="flex min-h-12 flex-none items-center gap-2 border-b border-border px-2.5 py-2 phone:p-1.5">
          <div className="contents" hidden={tab !== 'pipeline' || isPhone}>
            <ChatButton />
          </div>
          <TabsList activateOnFocus loopFocus id="tabs" aria-label="Work views">
            {TABS.map((each) => (
              <TabsTrigger
                key={each}
                value={each}
                id={`tab-${each}`}
                data-tab={each}
                tabIndex={each === tab ? 0 : -1}
                {...(CONTROLS[each] ? { 'aria-controls': CONTROLS[each] } : {})}
                aria-label={each === 'agents' ? (agents === 0 ? 'Agents' : `Agents, ${agents} need you`) : undefined}
              >
                <span className="label">
                  {each === 'queue' && queueCount > 0 ? `Queue ${queueCount}` : NAMES[each]}
                </span>
                {each === 'agents' && (
                  <Badge variant="tab" id="agents-badge" hidden={agents === 0}>
                    {badgeText(agents)}
                  </Badge>
                )}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
        {/* A Base UI panel keeps a closed view mounted and inert for a frame: two boards, and a lost focus. */}
        {(tab === 'agents' || tab === 'pipeline') && (
          <div
            key={tab}
            className={`flex min-h-0 flex-1 flex-col gap-2.5 px-2.5 pt-2.5 phone:scroll-pb-[calc(var(--dock)+8px)] ${tab === 'pipeline' ? 'overflow-hidden pb-2.5' : 'overflow-y-auto pb-0'}`}
            id="tp-board"
            role="tabpanel"
            aria-labelledby={`tab-${tab}`}
          >
            <Board />
          </div>
        )}
        <TabsContent
          value="queue"
          keepMounted
          tabIndex={undefined}
          className="flex min-h-0 flex-1 flex-col [&>.queue]:min-h-0 [&>.queue]:flex-1"
        >
          <QueueHost />
        </TabsContent>
        <History />
      </Tabs>
    </div>
  );
}
