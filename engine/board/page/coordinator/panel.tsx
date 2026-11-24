import { cn } from 'cn';
import { type FormEvent, type KeyboardEvent, useLayoutEffect, useRef } from 'react';
import { Icon } from '../app/icon.tsx';
import { Timed } from '../operations/parts.tsx';
import { Button } from '../ui/button.tsx';
import { Textarea } from '../ui/textarea.tsx';
import { SERVER_DOWN } from '../ui.ts';
import { coordinator, timeOf, useCoordinator } from './coordinator.ts';
import { CoordinatorLog } from './log.tsx';
import { bannerOf, hintOf, IN_FLIGHT, LIMIT, sendBlock, WORDS } from './rules.ts';

const LIVE =
  'bg-[color-mix(in_srgb,var(--working)_12%,transparent)] text-[color-mix(in_srgb,var(--fg)_30%,var(--working))] [&_.time]:text-inherit';
const NEEDS =
  'bg-[color-mix(in_srgb,var(--needs-tint)_12%,transparent)] text-[color-mix(in_srgb,var(--fg)_20%,var(--needs))] [&_.time]:text-inherit';

const gate = (reason: string | null, title: string) => ({ 'aria-disabled': reason !== null, title: reason ?? title });

const sendOnEnter = (event: KeyboardEvent<HTMLTextAreaElement>) => {
  if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing || event.keyCode === 229) return;
  event.preventDefault();
  event.currentTarget.form?.requestSubmit();
};

const focusEntry = () => {
  const target = ['coordinator-field', 'coordinator-start']
    .map((id) => document.getElementById(id) as HTMLElement)
    .find((node) => node.checkVisibility());
  (target ?? (document.getElementById('coordinator-log') as HTMLElement)).focus({ preventScroll: true });
};

const submit = (event: FormEvent) => {
  event.preventDefault();
  coordinator.send();
};

export function CoordinatorPanel() {
  const state = useCoordinator((each) => each);
  const {
    view,
    shown,
    aged,
    isOpen,
    isDown,
    busy,
    line,
    host,
    chatAt,
    chatError,
    linesAt,
    linesError,
    text,
    focusAsks,
  } = state;
  const root = useRef<HTMLElement>(null);
  const hadFocus = root.current?.contains(document.activeElement) === true;
  useLayoutEffect(() => {
    if (focusAsks > 0) focusEntry();
  }, [focusAsks]);
  useLayoutEffect(() => {
    if (!isOpen || !hadFocus) return;
    const active = document.activeElement;
    if (active instanceof HTMLElement && root.current?.contains(active) && active.checkVisibility()) return;
    focusEntry();
  });

  const ended = shown === 'ended';
  const absent = shown === 'none' || ended;
  const can = (action: (typeof view.actions)[number]) => view.actions.includes(action) && !ended;
  const cause = view.error ?? (isDown ? SERVER_DOWN : null);
  const chatCause = isOpen ? (chatError ?? cause) : null;
  const linesCause = isOpen && shown === 'dialog' ? linesError : null;
  const banner = bannerOf({ ended, chatCause, linesCause, chatAt, linesAt, timeOf });
  const age = absent ? null : view.since;
  const wait = busy ? `Wait: ${IN_FLIGHT[busy]}` : null;
  const block = sendBlock({ busy, state: shown, canSay: can('say'), text });
  const [hint, tone] = hintOf({ text, busy, line, state: shown });
  const startLine = line?.act === 'open' ? line.text : null;

  return (
    <section
      ref={root}
      className="coordinator group/co flex min-h-0 min-w-0 flex-col overflow-hidden rounded-3xl border border-border-strong bg-panel"
      id="coordinator"
      aria-labelledby="coordinator-title"
      data-state={shown}
      data-stale={ended || chatCause !== null || linesCause !== null || aged ? '' : undefined}
      hidden={!isOpen}
    >
      <header className="flex min-h-12 flex-none flex-wrap items-center gap-x-2 gap-y-1.5 border-b border-border py-2 pr-2.5 pl-5">
        <h2
          className="font-sans text-[0.875rem] leading-none font-semibold tracking-[-0.012em] text-foreground"
          id="coordinator-title"
        >
          Coordinator
        </h2>
        <span
          className="font-mono text-[0.71875rem] leading-none font-normal text-muted-foreground"
          id="coordinator-host"
        >
          {host}
        </span>
        <span
          className={cn(
            'inline-flex min-h-6 items-center gap-1.5 rounded-md py-1 pr-[9px] pl-[7px] font-sans text-[0.75rem] leading-[1.25] font-medium [&_.time]:font-mono [&_.time]:text-[0.75rem] [&_.time]:leading-none [&_.time]:font-normal [&_.time]:normal-nums',
            shown === 'works' || shown === 'starting'
              ? LIVE
              : shown === 'dialog'
                ? NEEDS
                : 'bg-secondary text-card-foreground [&_.time]:text-muted-foreground',
          )}
          id="coordinator-head-state"
        >
          <span>{WORDS[shown]}</span>
          {age && <Timed iso={age} isFine={shown === 'starting' || shown === 'works' || shown === 'dialog'} />}
        </span>
        <span className="ml-auto flex items-center gap-1.5">
          <Button
            type="button"
            variant="quiet"
            size="action"
            className="phone:min-h-11"
            id="coordinator-interrupt"
            hidden={!can('interrupt')}
            aria-busy={busy === 'interrupt'}
            {...gate(busy && busy !== 'interrupt' ? wait : null, 'Press the stop key in the session')}
            onClick={() => coordinator.interrupt()}
          >
            <span className="label">Interrupt</span>
          </Button>
          <Button
            type="button"
            variant="quiet"
            size="action"
            className="phone:min-h-11"
            id="coordinator-end"
            hidden={!can('end')}
            aria-busy={busy === 'end'}
            {...gate(busy && busy !== 'end' ? wait : null, 'Send the exit request of the host to the session')}
            onClick={() => coordinator.end()}
          >
            <span className="label">End session</span>
          </Button>
          <Button
            type="button"
            variant="quiet"
            size="action"
            className="phone:min-h-11"
            id="coordinator-go"
            title="Show the tab of the session in the Herdr app"
            hidden={!can('go') || !view.sessionId}
            onClick={() => coordinator.go()}
          >
            <Icon name="go" />
            <span className="label">Go</span>
          </Button>
        </span>
      </header>
      <p
        className="m-0 flex-none border-b border-border bg-secondary px-5 py-2 text-[0.78125rem] text-foreground [overflow-wrap:anywhere] data-[tone=error]:shadow-[inset_3px_0_var(--danger)]"
        id="coordinator-banner"
        role="status"
        data-tone={ended ? 'plain' : 'error'}
        hidden={banner === null}
      >
        {banner}
      </p>
      <div className="relative flex min-h-0 flex-1">
        <CoordinatorLog />
      </div>
      <div className="flex flex-none flex-col gap-2 px-[max(14px,calc((100%-104ch)/2-14px))] pb-3.5 font-mono text-[0.78125rem] leading-[1.5] font-normal phone:px-2.5 phone:pb-2.5">
        <form
          className="flex flex-col overflow-hidden rounded-xl border border-border-strong bg-card font-sans text-[0.8125rem] leading-[1.5] shadow-raise has-[textarea:focus-visible]:outline-2 has-[textarea:focus-visible]:outline-offset-2 has-[textarea:focus-visible]:outline-solid has-[textarea:focus-visible]:outline-ring has-[textarea[aria-invalid=true]]:border-[color-mix(in_srgb,var(--danger)_55%,transparent)]"
          id="coordinator-form"
          hidden={absent}
          onSubmit={submit}
        >
          <Textarea
            className="w-auto"
            id="coordinator-field"
            rows={1}
            aria-label="Message to the coordinator"
            aria-describedby="coordinator-hint"
            aria-invalid={text.length > LIMIT || (line?.act === 'say' && line.tone === 'error')}
            placeholder="Write to the coordinator"
            value={text}
            onChange={(event) => coordinator.setText(event.target.value)}
            onKeyDown={sendOnEnter}
          />
          <div className="flex items-center gap-2.5 pt-1 pr-2 pb-2 pl-3.5">
            <p
              className="m-0 flex-1 text-[0.75rem] text-muted-foreground [overflow-wrap:anywhere] whitespace-pre-line data-[tone=error]:text-destructive"
              id="coordinator-hint"
              data-tone={tone}
              role={tone === 'plain' ? undefined : tone === 'error' ? 'alert' : 'status'}
            >
              {hint}
            </p>
            <Button
              type="submit"
              variant="primary"
              size="action"
              className="phone:min-h-11"
              id="coordinator-send"
              aria-busy={busy === 'say'}
              {...gate(block, 'Send the message (Enter)')}
            >
              <span className="label">{busy === 'say' ? 'Sending' : 'Send'}</span>
            </Button>
          </div>
        </form>
        <div
          className="flex flex-wrap items-center gap-x-3 gap-y-2 font-sans text-[0.78125rem] leading-[1.5]"
          id="coordinator-start-block"
          hidden={!(absent && view.actions.includes('open'))}
        >
          <p
            className="m-0 flex-[1_1_100%] text-destructive [overflow-wrap:anywhere] whitespace-pre-line"
            id="coordinator-start-text"
            role={startLine ? 'alert' : undefined}
            hidden={startLine === null}
          >
            {startLine}
          </p>
          <Button
            type="button"
            variant="primary"
            size="action"
            className="phone:min-h-11"
            id="coordinator-start"
            {...gate(wait, 'Start a coordinator session in a quiet tab of the Herdr app')}
            onClick={() => coordinator.start()}
          >
            <span className="label">{ended ? 'Start a new session' : 'Start a session'}</span>
          </Button>
        </div>
      </div>
    </section>
  );
}
