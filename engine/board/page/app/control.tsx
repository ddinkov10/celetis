import { useQuery } from '@tanstack/react-query';
import { cn } from 'cn';
import { memo, type ReactNode, useEffect, useState } from 'react';
import type { Board, DaemonView } from '../../types.ts';
import { age, clock } from '../../view.ts';
import { AgentOrder } from '../agents/agents.tsx';
import { viewOptions } from '../query.ts';
import { shellStore, useShellStore } from '../store.ts';
import { THEME_WORDS } from '../theme/choice.ts';
import { Button } from '../ui/button.tsx';
import { Card, CardDescription, CardTitle } from '../ui/card.tsx';
import { Toggle } from '../ui/toggle.tsx';
import { $, capital, SERVER_DOWN } from '../ui.ts';
import { Icon } from './icon.tsx';

type Tone = 'ok' | 'fail' | 'wait' | 'off';

const AUTO: Record<DaemonView['auto'], { tone: Tone; title: string; words: string }> = {
  on: { tone: 'ok', title: 'Auto mode starts each auto step.', words: 'Auto mode is on.' },
  off: { tone: 'off', title: 'Auto mode is off: auto steps wait.', words: 'Auto mode is off.' },
  stopping: { tone: 'off', title: 'Auto mode stops after its current work.', words: 'Auto mode is stopping.' },
};

const SMALL =
  'h-6 gap-[7px] rounded-sm border-0 px-2 transition-all duration-0 text-xs font-normal phone:min-h-11 phone:min-w-11';

function Code({ children }: { children: string }) {
  return <code className="font-mono text-xs leading-none">{children}</code>;
}

function Row({ isFirst = false, children }: { isFirst?: boolean; children: ReactNode }) {
  return (
    <div
      className={cn(
        'mt-3.5 flex flex-wrap items-center justify-end gap-x-4 gap-y-2.5 phone:justify-start',
        !isFirst && 'border-t border-border pt-3.5',
      )}
    >
      {children}
    </div>
  );
}

function RowText({ id, label, help }: { id: string; label: string; help: string }) {
  return (
    <div className="min-w-0 flex-[1_1_280px] phone:basis-full">
      <span className="text-[0.8125rem] font-medium text-foreground" id={`${id}-label`}>
        {label}
      </span>
      <p className="mt-0.5 mb-0 text-xs leading-[1.45] text-pretty text-muted-foreground" id={`${id}-help`}>
        {help}
      </p>
    </div>
  );
}

const UpdateHost = memo(
  () => (
    <button
      type="button"
      className="sb-btn update-open"
      id="update-open"
      aria-controls="update-dialog"
      aria-expanded="false"
      aria-label="Check for updates, Celetis"
      title="Check for updates, Celetis"
    >
      <span className="label">Check for updates</span>
    </button>
  ),
  () => true,
);

function Automation({ daemon, isDown }: { daemon: DaemonView | null; isDown: boolean }) {
  const auto = isDown ? null : (daemon?.auto ?? null);
  return (
    <Card id="ctl-auto" aria-labelledby="ctl-auto-title">
      <CardTitle id="ctl-auto-title">Automation</CardTitle>
      <CardDescription>
        Auto mode of the daemon starts each auto step by itself. The board shows its state only.
      </CardDescription>
      <p className="mt-3 mb-0 text-[0.8125rem] text-card-foreground" id="ctl-auto-state">
        {isDown ? (
          <>
            No daemon answers. Start it in a terminal: <Code>celetis daemon start</Code>
          </>
        ) : auto ? (
          AUTO[auto].words
        ) : (
          'The daemon state is not read yet.'
        )}
      </p>
      <p className="mt-3 mb-0 text-[0.8125rem] text-card-foreground" id="ctl-auto-command" hidden={auto === null}>
        {auto && (
          <>
            Change it in a terminal: <Code>{`celetis daemon auto ${auto === 'on' ? 'off' : 'on'}`}</Code>
          </>
        )}
      </p>
    </Card>
  );
}

const DOT: Record<Tone, string> = {
  ok: 'bg-ready',
  fail: 'bg-caution',
  wait: 'bg-muted-foreground',
  off: 'bg-muted-foreground',
};

function StatusRow({
  id,
  tone,
  title,
  name,
  children,
}: {
  id: string;
  tone: Tone;
  title: string;
  name: string;
  children: ReactNode;
}) {
  return (
    <span
      className="mt-3 flex min-h-7 min-w-0 items-center gap-[7px] text-[0.8125rem] tabular-nums"
      id={id}
      data-tone={tone}
      title={title || undefined}
    >
      <i className={cn('size-1.5 flex-none rounded-full', DOT[tone])} />
      <span className="text-muted-foreground">{name}</span>
      <span
        className={cn('min-w-0 font-medium wrap-anywhere', tone === 'fail' ? 'text-caution' : 'text-card-foreground')}
      >
        {children}
      </span>
    </span>
  );
}

const useNow = () => {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  return now;
};

function Status({ data, isDown }: { data: Board | undefined; isDown: boolean }) {
  const now = useNow();
  const control = useShellStore((state) => state.control);
  const source = data?.source ?? { readAt: null, error: null };
  const name = capital(data?.tracker ?? 'Issues');
  const readAgain = data?.tracker ? `Read ${data.tracker} again` : 'Read the issues again';
  const terminal = data?.terminal;
  const daemon = data?.daemon ?? null;
  const freshTone: Tone = isDown || source.error ? 'fail' : source.readAt ? 'ok' : 'wait';
  const freshTitle =
    !isDown && source.error
      ? `cannot read: ${source.error}`
      : source.readAt
        ? `${name} was read at ${clock(source.readAt)}`
        : '';
  const terminalTone: Tone = terminal?.ok === true ? 'ok' : terminal?.ok === false ? 'fail' : 'wait';
  const daemonItem = isDown
    ? { text: 'not running', tone: 'fail' as const, title: 'The board server does not answer.' }
    : daemon
      ? {
          text: `auto ${daemon.auto}`,
          tone: AUTO[daemon.auto].tone,
          title: `The daemon PID ${daemon.pid} runs. ${AUTO[daemon.auto].title}`,
        }
      : { text: 'checking', tone: 'wait' as const, title: '' };
  return (
    <Card id="ctl-status" aria-labelledby="ctl-status-title">
      <CardTitle id="ctl-status-title">Board status</CardTitle>
      <CardDescription>What the board reads, and the parts that Run and Go use.</CardDescription>
      <StatusRow id="fresh" tone={freshTone} title={freshTitle} name={name}>
        {isDown ? (
          SERVER_DOWN
        ) : source.error ? (
          `cannot read: ${source.error}`
        ) : source.readAt ? (
          <>
            read{' '}
            <time className="time" dateTime={source.readAt} title={clock(source.readAt, true)}>
              {age(source.readAt, now)} ago
            </time>
          </>
        ) : (
          'no data yet'
        )}
      </StatusRow>
      <StatusRow
        id="terminal"
        tone={terminalTone}
        title={terminal?.error ? `herdr: ${terminal.error}` : 'Run and Go use herdr'}
        name="herdr"
      >
        {terminal?.ok === true ? 'up' : terminal?.ok === false ? 'down' : 'checking'}
      </StatusRow>
      <StatusRow id="daemon" tone={daemonItem.tone} title={daemonItem.title} name="Daemon">
        {daemonItem.text}
      </StatusRow>
      <Button
        variant="outline"
        id="refresh"
        className="mt-3 phone:min-h-11 phone:min-w-11 data-done:[&_.icon]:text-ready"
        aria-busy={control.refresh === 'busy' || undefined}
        data-done={control.refresh === 'done' ? '' : undefined}
        title={control.refresh === 'done' ? `${readAgain}: done` : `${readAgain} (r)`}
        onClick={() => void shellStore.refresh()}
      >
        <Icon name="refresh" />
        <span className="label">Refresh</span>
      </Button>
    </Card>
  );
}

function Preferences() {
  const { theme, notify, keys } = useShellStore((state) => state.settings);
  const isNotifying = useShellStore((state) => state.control.isNotifying);
  const isBlocked = 'Notification' in window && Notification.permission === 'denied';
  const isOn = notify && !isBlocked;
  const themeLabel = `Theme: ${THEME_WORDS[theme]}. Press to change`;
  return (
    <Card id="ctl-prefs" aria-labelledby="ctl-prefs-title">
      <CardTitle id="ctl-prefs-title">Notifications, keys, and theme</CardTitle>
      <CardDescription>Settings of this browser. A change takes effect at once.</CardDescription>
      <Row isFirst>
        <RowText
          id="notify"
          label="Notify"
          help="A system notification shows when a card needs you and the board is not in front."
        />
        <Toggle
          variant="default"
          size="sm"
          id="notify"
          className="phone:-ms-2 phone:min-h-11 phone:min-w-11 data-pressed:[&_.icon]:text-foreground"
          pressed={isOn}
          aria-busy={isNotifying || undefined}
          title={
            isBlocked
              ? 'The browser blocks notifications for this page'
              : isOn
                ? 'A system notification shows when a card needs you'
                : 'Show a system notification when a card needs you'
          }
          onPressedChange={() => void shellStore.toggleNotify()}
        >
          <Icon name={isOn ? 'bell' : 'bell-off'} />
          <span className="text-muted-foreground">Notify</span>
          <b className="font-medium text-card-foreground">{isBlocked ? 'blocked' : isOn ? 'on' : 'off'}</b>
        </Toggle>
      </Row>
      <Row>
        <RowText
          id="keys"
          label="Single-key shortcuts"
          help="j k h l v d r / ?. The keys of a focused card always work."
        />
        <Toggle
          id="keys-switch"
          className="phone:min-h-11 phone:min-w-11"
          pressed={keys}
          aria-labelledby="keys-label"
          aria-describedby="keys-help"
          onPressedChange={(next) => shellStore.setKeys(next)}
        >
          {keys ? 'On' : 'Off'}
        </Toggle>
        <Button
          variant="ghost"
          id="keys-open"
          className={SMALL}
          title="Keyboard shortcuts (?)"
          onClick={() => $('keys').showModal()}
        >
          <Icon name="keyboard" />
          <span>Keys</span>
        </Button>
      </Row>
      <Row>
        <RowText id="theme" label="Theme" help="System follows the setting of the device." />
        <span className="text-[0.78125rem] text-card-foreground" id="theme-words">
          {THEME_WORDS[theme]}
        </span>
        <Button
          variant="ghost"
          id="theme"
          className="size-6 gap-0 rounded-sm p-0 transition-all duration-0 phone:size-11 [&_.icon]:size-3.5"
          aria-label={themeLabel}
          title={themeLabel}
          onClick={() => shellStore.cycleTheme()}
        >
          <Icon name={`theme-${theme}`} />
        </Button>
      </Row>
    </Card>
  );
}

export function Control() {
  const { data, isError } = useQuery(viewOptions);
  return (
    <section
      className="area-screen content-start items-start justify-center justify-items-stretch gap-3.5 overflow-auto grid-cols-[minmax(0,min(100%,720px))] p-5 phone:scroll-pb-[calc(var(--dock)+8px)] phone:p-3"
      id="area-control"
      aria-labelledby="area-control-title"
    >
      <h2 className="text-sm leading-[1.38] font-semibold tracking-[-0.012em] text-foreground" id="area-control-title">
        Control
      </h2>
      <Card id="ctl-agents" tabIndex={-1} aria-labelledby="ctl-agents-title">
        <CardTitle id="ctl-agents-title">Agents</CardTitle>
        <CardDescription>
          New default work uses the first available agent. Drag a handle, or press it for the move actions.
        </CardDescription>
        <div className="mt-3">
          <AgentOrder />
        </div>
      </Card>
      <Automation daemon={data?.daemon ?? null} isDown={isError} />
      <Card id="ctl-updates" aria-labelledby="ctl-updates-title">
        <CardTitle id="ctl-updates-title">Updates</CardTitle>
        <CardDescription>
          The installed engine and plugins of Celetis. Update and restart needs your click, and the daemon restarts
          after it.
        </CardDescription>
        <div className="mt-3">
          <UpdateHost />
        </div>
      </Card>
      <Preferences />
      <Status data={data} isDown={isError} />
    </section>
  );
}
