import { type MouseEvent, useLayoutEffect, useRef } from 'react';
import type { Host } from '../../../lib/host/names.ts';
import type { IssueKey } from '../../../lib/tracker/key.ts';
import type { Step } from '../../../lib/workflow/workflow.ts';
import { stateLabel } from '../../view.ts';
import { Icon } from '../app/icon.tsx';
import { Button } from '../ui/button.tsx';
import { useFocusedKey } from '../ui/focused-key.ts';
import { ViewBoundary } from '../ui/view-boundary.tsx';
import { type QueueState, queueStore, useQueue } from './state.ts';

const DISABLED = 'aria-disabled:cursor-default aria-disabled:opacity-50';
const PHONE_TAP = 'phone:min-h-11 phone:min-w-11';
const PRESS =
  'active:scale-none active:[transform:scale(0.97)] aria-disabled:active:scale-none aria-disabled:active:[transform:none]';
const ICON_PRESS = 'active:scale-none aria-disabled:active:scale-none';
const NUMBER = 'block font-mono text-[0.6875rem] leading-[normal] text-muted-foreground';
const TITLE = 'block font-medium wrap-anywhere text-foreground';
const EMPTY = 'm-0 border-t border-t-border px-4 py-5 text-muted-foreground';
const NOTE = 'mt-1.5 mb-0 max-w-[65ch] text-card-foreground';
const LIST = 'm-0 list-none';
const PICKER_NOTE = 'mt-1 mb-5 text-muted-foreground';
const SUBHEAD = 'text-[0.8125rem]';
const TONE = 'text-working group-data-[state=me-gate]/queue:text-needs';
const SECTION =
  'group/queue min-h-0 min-w-0 flex-1 overflow-y-auto text-foreground phone:scroll-pb-[calc(var(--dock)+8px)]';
const SEGMENT = `min-h-[26px] rounded-[7px] border-0 bg-transparent px-2.5 py-0 text-[0.78125rem] leading-none font-medium whitespace-nowrap text-card-foreground phone:min-h-11 phone:px-2 [&:hover:not([aria-disabled=true])]:text-foreground aria-pressed:bg-card aria-pressed:text-foreground aria-pressed:[box-shadow:var(--raise)] ${DISABLED}`;

let scrollOffset = 0;

const controlKey = (node: HTMLElement) => node.dataset.control ?? null;
const isEnabled = (node: HTMLElement) => node.getAttribute('aria-disabled') !== 'true';
const pressed = (action: () => unknown) => (event: MouseEvent<HTMLButtonElement>) => {
  if (isEnabled(event.currentTarget)) action();
};

function TextButton({
  text,
  control,
  label,
  isDisabled = false,
  action,
}: {
  text: string;
  control: string;
  label?: string;
  isDisabled?: boolean;
  action: () => unknown;
}) {
  return (
    <Button
      variant="secondary"
      size="action"
      className={`${PHONE_TAP} ${DISABLED} ${PRESS}`}
      data-control={control}
      aria-label={label}
      aria-disabled={isDisabled}
      onClick={pressed(action)}
    >
      {text}
    </Button>
  );
}

function IconControl({
  name,
  label,
  control,
  className = '',
  isDisabled,
  action,
}: {
  name: string;
  label: string;
  control: string;
  className?: string;
  isDisabled: boolean;
  action: () => unknown;
}) {
  return (
    <Button
      variant="icon"
      size="icon"
      className={`size-[30px] p-1.5 ${PHONE_TAP} ${DISABLED} ${ICON_PRESS} ${className}`}
      aria-label={label}
      title={label}
      data-control={control}
      aria-disabled={isDisabled}
      onClick={(event) => {
        event.stopPropagation();
        pressed(action)(event);
      }}
    >
      <Icon name={name} />
    </Button>
  );
}

function Row({
  number,
  index,
  numbers,
  queue,
}: {
  number: IssueKey;
  index: number;
  numbers: readonly IssueKey[];
  queue: QueueState;
}) {
  const { submitted, state, isBusy, isAuthoritative } = queue;
  const next = submitted?.next;
  const step = next?.kind === 'run' ? next.step : submitted?.record?.current?.step;
  const isLocked = isBusy || !isAuthoritative || !submitted?.actions.edit;
  return (
    <li
      className={`flex min-w-0 items-center gap-3 py-4${index > 1 ? ' border-t border-t-border' : ''}`}
      data-number={number}
    >
      <span
        className={`w-5 flex-[0_0_20px] text-center font-mono text-[0.75rem] leading-[normal] ${index === 0 ? TONE : 'text-muted-foreground'}`}
      >
        {index + 1}
      </span>
      <div className="grid min-w-0 flex-1 grid-cols-[1fr] gap-1">
        <span className={NUMBER}>{`#${number}`}</span>
        <span className={TITLE}>{queueStore.find(number)?.title ?? `Issue #${number}`}</span>
        <span className={`text-[0.6875rem] ${index === 0 ? TONE : 'text-muted-foreground'}`}>
          {index === 0
            ? `${state === 'me-gate' ? 'Waiting for approval' : state === 'error' ? 'Stopped' : state === 'running' ? 'Running' : 'Saved · starting'}${step ? ` · ${step}` : ''}`
            : 'Waiting'}
        </span>
      </div>
      {index > 0 && (
        <div className="flex flex-none gap-0.5">
          {(['up', 'down'] as const).map((direction) => (
            <IconControl
              key={direction}
              name="chevron"
              label={`Move #${number} ${direction}`}
              control={`${direction}-${number}`}
              className={
                direction === 'up' ? '[&_.icon]:[transform:rotate(-90deg)]' : '[&_.icon]:[transform:rotate(90deg)]'
              }
              isDisabled={isLocked || (direction === 'up' ? index === 1 : index === numbers.length - 1)}
              action={() => queueStore.act({ kind: 'move', number, direction, expected: queueStore.expected() })}
            />
          ))}
          <IconControl
            name="close"
            label={`Remove #${number} from queue`}
            control={`remove-${number}`}
            isDisabled={isLocked}
            action={() => queueStore.act({ kind: 'remove', number, expected: queueStore.expected() })}
          />
        </div>
      )}
    </li>
  );
}

const headingText = ({ isBusy, state, submitted }: QueueState) => {
  const first = submitted?.record?.numbers[0];
  if (isBusy) return 'Saving the queue';
  if (state === 'empty') return 'Ready for work';
  if (state === 'starting') return `Starting #${first}`;
  if (state === 'running') return `Running #${first}`;
  return state === 'me-gate' ? 'Your approval is needed' : 'The queue stopped';
};

function QueueBody() {
  const root = useRef<HTMLElement>(null);
  const focused = useFocusedKey(root, controlKey);
  const queue = useQueue((state) => state);
  const { board, submitted, isBusy, isUncertain, state, isAuthoritative, chosen, available } = queue;
  useLayoutEffect(() => {
    if (!root.current) return;
    root.current.scrollTop = scrollOffset;
    // A clamp that keeps the position fires no scroll event, so read the offset back here.
    scrollOffset = root.current.scrollTop;
  }, []);
  useLayoutEffect(() => {
    const section = root.current;
    const key = focused.current;
    if (!section || key === null) return;
    const active = document.activeElement;
    if (active instanceof HTMLElement && section.contains(active) && controlKey(active) === key && isEnabled(active))
      return;
    const controls = [...section.querySelectorAll<HTMLElement>('[data-control]')].filter(isEnabled);
    const target =
      controls.find((control) => controlKey(control) === key) ??
      controls.find((control) => /^(up|down|remove|add)-/.test(controlKey(control) ?? '')) ??
      section.querySelector<HTMLElement>('[data-control="heading"]');
    target?.focus({ preventScroll: true });
  });
  if (!board) return <section ref={root} className={SECTION} id="queue" />;
  const record = submitted?.record;
  const numbers = record?.numbers ?? [];
  const first = numbers[0];
  const next = submitted?.next;
  const warning = !isAuthoritative
    ? 'The queue state is unavailable. Refresh before acting.'
    : (submitted?.error ?? board.noRun);
  const choices: [string, string, boolean][] = [['', 'Default order', true]];
  for (const host of Object.keys(board.registry) as Host[])
    choices.push([host, board.registry[host].short, board.agents?.[host]?.available === true]);
  return (
    <section
      ref={root}
      className={SECTION}
      id="queue"
      data-state={state}
      aria-busy={isBusy}
      onScroll={(event) => {
        scrollOffset = event.currentTarget.scrollTop;
      }}
    >
      <header className="flex flex-wrap items-center justify-between gap-2 px-4 pt-4">
        <div className="flex min-w-0 items-baseline gap-2.5">
          <h2 className="text-[0.875rem] font-semibold">Issue queue</h2>
          <span className="whitespace-nowrap text-muted-foreground tabular-nums">{`${numbers.length} remaining`}</span>
        </div>
      </header>
      <div className="px-4 pt-4">
        <h3
          tabIndex={-1}
          data-control="heading"
          className="text-[1.03125rem] font-semibold group-data-[state=error]/queue:text-destructive group-data-[state=me-gate]/queue:text-needs group-data-[state=running]/queue:text-working"
        >
          {headingText(queue)}
        </h3>
        <p className={NOTE}>
          {state === 'starting'
            ? 'Your issue is saved. Waiting for a verified session.'
            : state === 'me-gate'
              ? 'Continue starts the displayed step. Later issues stay queued.'
              : 'Add issues at any time. Finished issues leave automatically.'}
        </p>
        {warning && (
          <p className={`${NOTE} wrap-anywhere`} role="alert">
            {warning}
          </p>
        )}
        {record?.act && <p className={`${NOTE} wrap-anywhere`}>{record.act}</p>}
        <section className="mt-6">
          <h4 className={SUBHEAD}>Current issue</h4>
          {first ? (
            <ol className={`${LIST} p-0`}>
              <Row number={first} index={0} numbers={numbers} queue={queue} />
            </ol>
          ) : (
            <p className={`${NOTE} pt-4`}>No issue is running.</p>
          )}
        </section>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="flex min-w-0 flex-wrap items-center gap-2 text-card-foreground phone:flex-col phone:items-start phone:gap-1.5">
          <span>Agent</span>
          {/* biome-ignore lint/a11y/useSemanticElements: a fieldset brings its own box, and preflight is off. */}
          <div
            className="inline-flex max-w-full gap-0.5 rounded-[9px] bg-secondary p-0.5"
            role="group"
            aria-label="Queue agent"
          >
            {choices.map(([value, text, isUsable]) => (
              <button
                key={value || 'default'}
                type="button"
                className={SEGMENT}
                data-control={`agent-${value || 'default'}`}
                aria-pressed={(chosen ?? '') === value}
                aria-disabled={!isUsable || numbers.length > 0 || isBusy || !isAuthoritative}
                onClick={pressed(() => queueStore.setAgent(value))}
              >
                {text}
              </button>
            ))}
          </div>
        </div>
        {submitted?.actions.continue && next?.kind === 'run' ? (
          <TextButton
            text="Continue queue"
            control="continue"
            isDisabled={isBusy || !isAuthoritative}
            action={() => queueStore.act({ kind: 'continue', step: next.step, expected: queueStore.expected() })}
          />
        ) : submitted?.actions.retry ? (
          <TextButton
            text="Try again"
            control="retry"
            isDisabled={isBusy || !isAuthoritative}
            action={() =>
              queueStore.act({
                kind: 'retry',
                step: next?.kind === 'run' ? next.step : null,
                expected: queueStore.expected(),
              })
            }
          />
        ) : null}
        {isUncertain && (
          <TextButton text="Refresh queue" control="refresh" isDisabled={isBusy} action={() => queueStore.refresh()} />
        )}
      </div>
      <div className="flex min-w-0 flex-col border-t border-t-border">
        <section className="pt-4">
          <h3 className={`px-4 ${SUBHEAD}`}>Up next</h3>
          {numbers.length > 1 ? (
            <ol className={`${LIST} px-4 pb-4`} aria-label="Waiting issues" start={2}>
              {numbers.slice(1).map((number, index) => (
                <Row key={number} number={number} index={index + 1} numbers={numbers} queue={queue} />
              ))}
            </ol>
          ) : (
            <p className={EMPTY}>No issue waits.</p>
          )}
        </section>
        <section className="min-w-0 border-t border-t-border p-4">
          <h3 className={SUBHEAD}>Add from the board</h3>
          <p className={PICKER_NOTE}>
            Add puts the issue at the end of the queue, and starts the queue when it is empty.
          </p>
          {available.map((card) => {
            const { number } = card;
            const isSelected = numbers.includes(number);
            return (
              <div className="flex items-center gap-5 border-t border-t-border py-3.5" key={number}>
                <div className="min-w-0 flex-1">
                  <span className={NUMBER}>{`#${number}`}</span>
                  <span className={`${TITLE} mt-1`}>{card.title}</span>
                  <span className="mt-[3px] block font-mono text-[0.71875rem] leading-[1.2] text-muted-foreground">{`next ${card.step} · ${card.state ? stateLabel(card) : 'ready'}`}</span>
                </div>
                <TextButton
                  text={isSelected ? 'In queue' : 'Add'}
                  control={`add-${number}`}
                  label={`Add #${number} to queue`}
                  isDisabled={
                    isSelected ||
                    isBusy ||
                    !isAuthoritative ||
                    !submitted?.actions.add ||
                    !queueStore.hostAvailable(chosen) ||
                    Boolean(board.noRun)
                  }
                  action={() =>
                    queueStore.act({ kind: 'add', number, step: card.step as Step, expected: queueStore.expected() })
                  }
                />
              </div>
            );
          })}
          {!available.length && <p className={PICKER_NOTE}>No runnable issues are available.</p>}
        </section>
      </div>
    </section>
  );
}

export function Queue() {
  const snapshot = useQueue((state) => state);
  return (
    <ViewBoundary snapshot={snapshot} fallback={<section className={SECTION} id="queue" />}>
      <QueueBody />
    </ViewBoundary>
  );
}
