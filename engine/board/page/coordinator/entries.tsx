import { cn } from 'cn';
import type { CoordinatorKey } from '../../../lib/coordinator/types.ts';
import type { ChatBlock, ChatCall, ChatEntry, ChatInline, ChatText } from '../../types.ts';
import { clock } from '../../view.ts';
import { Icon } from '../app/icon.tsx';
import { Link } from '../operations/parts.tsx';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../ui/collapsible.tsx';
import { coordinator, useCoordinator } from './coordinator.ts';
import { IN_FLIGHT, KEYS, type LogItem } from './rules.ts';

const VERBS: Record<ChatCall['state'], string> = { runs: 'Running', done: 'Used', failed: 'Failed', waits: 'Waiting' };
const MARKS: Record<ChatCall['state'], string> = { runs: 'works', done: 'check', failed: 'xcircle', waits: 'target' };
const INLINE_CODE = 'rounded-[4px] bg-secondary px-1 py-px font-mono text-[0.75rem] leading-none font-normal';
const TEXT =
  'm-0 rounded-lg bg-secondary p-2.5 font-mono text-[0.75rem] leading-[1.55] font-normal whitespace-pre-wrap [overflow-wrap:anywhere]';
const TRIGGER =
  'flex min-h-7 w-full cursor-pointer items-center gap-2 border-0 bg-transparent px-0 py-1 text-left text-muted-foreground [font:inherit] [&:hover]:text-foreground phone:min-h-11 aria-expanded:[&_.i-chevron]:[transform:rotate(90deg)] [&_.i-chevron]:ml-auto [&_.i-chevron]:[transition:transform_0.2s_ease-out] [&_.i-works]:animate-[turn_1.2s_linear_infinite] [&_.i-works]:text-working';
const SUMMARY = 'min-w-0 truncate font-mono text-[0.71875rem] leading-[1.4] font-normal';
const STACK = '[&_:is(li,blockquote)>*+*]:mt-[7px]';
const HEADINGS = ['h3', 'h4', 'h5', 'h6'] as const;

const seconds = (calls: readonly ChatCall[]) => {
  const starts = calls.map((call) => Date.parse(call.startedAt ?? ''));
  const ends = calls.map((call) => Date.parse(call.endedAt ?? ''));
  if ([...starts, ...ends].some(Number.isNaN)) return null;
  return Math.round((Math.max(...ends) - Math.min(...starts)) / 1000);
};

const steps = (count: number) => `${count} step${count === 1 ? '' : 's'}`;

function Inline({ parts }: { parts: readonly ChatInline[] }) {
  return parts.map((part, at) => {
    if (typeof part === 'string') return part;
    if (part.k === 'link')
      return (
        <Link key={at} className="underline underline-offset-2" url={part.href}>
          <Inline parts={part.c} />
        </Link>
      );
    const Tag = part.k;
    return (
      <Tag key={at} className={Tag === 'code' ? INLINE_CODE : undefined}>
        <Inline parts={part.c} />
      </Tag>
    );
  });
}

function Block({ part }: { part: ChatBlock }) {
  switch (part.k) {
    case 'p':
      return (
        <p className="m-0">
          <Inline parts={part.c} />
        </p>
      );
    case 'h': {
      const Heading = HEADINGS[part.level - 1] ?? 'h6';
      return (
        <Heading className="m-0 font-sans text-[0.84375rem] leading-[1.3] font-semibold">
          <Inline parts={part.c} />
        </Heading>
      );
    }
    case 'code':
      return <pre className={TEXT}>{part.text}</pre>;
    case 'list': {
      const items = part.items.map((item, at) => (
        <li key={at}>
          <Blocks parts={item} />
        </li>
      ));
      return part.ordered ? (
        <ol className="m-0 pl-[18px]" start={part.start ?? undefined}>
          {items}
        </ol>
      ) : (
        <ul className="m-0 pl-[18px]">{items}</ul>
      );
    }
    case 'quote':
      return (
        <blockquote className="m-0 border-l-2 border-border-strong pl-[18px] text-card-foreground">
          <Blocks parts={part.c} />
        </blockquote>
      );
    case 'rule':
      return <hr className="m-0 border-0 border-t border-border" />;
  }
}

function Blocks({ parts }: { parts: readonly ChatBlock[] }) {
  return parts.map((part, at) => <Block key={at} part={part} />);
}

function Text({ value }: { value: ChatText }) {
  return (
    <>
      <pre className={TEXT}>{value.text}</pre>
      {value.cut > 0 && (
        <p className="m-0 text-[0.75rem] text-muted-foreground">{`(${value.cut} characters left out)`}</p>
      )}
    </>
  );
}

type OnToggle = (row: string, isOpen: boolean) => void;

function Call({ call, onToggle }: { call: ChatCall; onToggle: OnToggle }) {
  const row = `c:${call.id}`;
  const isOpen = useCoordinator((state) => state.openRows.get(row) ?? false);
  return (
    <Collapsible open={isOpen} onOpenChange={(value) => onToggle(row, value)} data-state={call.state} render={<li />}>
      <CollapsibleTrigger
        className={cn(
          TRIGGER,
          call.state === 'done' && '[&_.i-check]:text-ready',
          call.state === 'failed' && '[&_.i-xcircle]:text-destructive',
          call.state === 'waits' && '[&_.i-target]:text-needs',
        )}
        data-row={row}
      >
        <Icon name={MARKS[call.state]} />
        <span
          className={cn(
            'flex-none',
            call.state === 'runs' && 'text-card-foreground',
            call.state === 'failed' && 'text-destructive',
          )}
        >
          {VERBS[call.state]}
        </span>{' '}
        <span className="flex-none font-medium text-card-foreground">{call.tool}</span>{' '}
        <span className={SUMMARY}>{call.summary}</span>
        <Icon name="chevron" />
      </CollapsibleTrigger>
      <CollapsibleContent keepMounted className="flex flex-col gap-2 pt-1 pb-2 pl-6" render={<div />}>
        <Text value={call.input} />
        {call.result && (
          <>
            <p className="m-0 text-[0.75rem] font-medium text-card-foreground">
              {call.state === 'failed' ? 'Error:' : 'Result:'}
            </p>
            <Text value={call.result} />
          </>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}

function Run({ entry, onToggle }: { entry: Extract<ChatEntry, { kind: 'steps' }>; onToggle: OnToggle }) {
  const isLive = entry.calls.some((call) => call.state === 'runs' || call.state === 'waits');
  const failed = entry.calls.filter((call) => call.state === 'failed').length;
  const time = isLive ? null : seconds(entry.calls);
  const words = isLive
    ? `Running ${steps(entry.calls.length)}`
    : `Ran ${steps(entry.calls.length)}${failed ? `, ${failed} failed` : ''}${time === null ? '' : ` · ${time}s`}`;
  const row = `s:${entry.id}`;
  const isOpen = useCoordinator((state) => state.openRows.get(row) ?? isLive);
  return (
    <Collapsible
      open={isOpen}
      onOpenChange={(value) => onToggle(row, value)}
      data-state={isLive ? 'runs' : failed ? 'failed' : 'done'}
      render={<li />}
    >
      <CollapsibleTrigger
        className={cn(
          TRIGGER,
          isLive && 'text-card-foreground',
          !isLive && !failed && '[&_.i-check]:text-ready',
          failed && '[&_.i-alert]:text-destructive',
        )}
        data-row={row}
      >
        <Icon name={isLive ? 'works' : failed ? 'alert' : 'check'} />
        <span className="flex-none">{words}</span>
        <Icon name="chevron" />
      </CollapsibleTrigger>
      <CollapsibleContent keepMounted className="m-0 mt-0.5 flex list-none flex-col p-0 pl-6" render={<ol />}>
        {entry.calls.map((call) => (
          <Call key={call.id} call={call} onToggle={onToggle} />
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}

function Entry({ entry, onToggle }: { entry: ChatEntry; onToggle: OnToggle }) {
  switch (entry.kind) {
    case 'you':
      return (
        <li className="flex justify-end">
          <p
            className="m-0 max-w-[80%] rounded-2xl bg-accent px-3 py-[7px] whitespace-pre-wrap phone:max-w-[90%]"
            title={entry.at ? clock(entry.at, true) : undefined}
          >
            {entry.text}
          </p>
        </li>
      );
    case 'agent':
      return (
        <li className={cn('flex flex-col gap-[7px]', STACK)}>
          <Blocks parts={entry.blocks} />
        </li>
      );
    case 'note':
      return (
        <li className="self-center rounded-[999px] bg-secondary px-2.5 py-0.5 text-[0.75rem] text-muted-foreground">{`${entry.text.replace(/\.$/, '')}${entry.at ? ` · ${clock(entry.at)}` : ''}`}</li>
      );
    case 'steps':
      return <Run entry={entry} onToggle={onToggle} />;
  }
}

function KeyButton({ name }: { name: CoordinatorKey }) {
  const busy = useCoordinator((state) => state.busy);
  const { cap, name: words } = KEYS[name];
  const differs = cap !== words;
  const wait = busy && busy !== 'key' ? `Wait: ${IN_FLIGHT[busy]}` : null;
  return (
    <button
      type="button"
      className="inline-grid min-h-7 min-w-8 place-items-center rounded-lg border border-b-2 border-border-strong bg-secondary px-2 py-0 text-foreground [transition:background-color_0.15s,transform_0.1s] [&:hover]:bg-accent active:[transform:scale(0.97)] aria-disabled:cursor-not-allowed aria-disabled:opacity-[0.42] phone:min-h-11 phone:min-w-11"
      data-key={name}
      aria-label={differs ? words : undefined}
      aria-disabled={wait !== null}
      aria-busy={busy === 'key'}
      title={wait ?? `Press ${words} in the session`}
      onClick={() => void coordinator.pressKey(name)}
    >
      <kbd
        className="h-auto min-w-0 border-0 bg-transparent p-0 font-mono text-[0.75rem] leading-none font-medium"
        aria-hidden={differs ? true : undefined}
      >
        {cap}
      </kbd>
    </button>
  );
}

function Ask({ item }: { item: Extract<LogItem, { kind: 'ask' }> }) {
  return (
    <li>
      {/* biome-ignore lint/a11y/useSemanticElements: a fieldset would change the DOM that the styles find */}
      <div
        className="flex flex-col gap-2 rounded-[10px] bg-[color-mix(in_srgb,var(--needs-tint)_9%,transparent)] px-3 pt-2 pb-3"
        role="group"
        aria-labelledby="coordinator-ask-name"
      >
        <p className="m-0 flex min-h-7 items-center gap-2 font-semibold text-[color-mix(in_srgb,var(--fg)_20%,var(--needs))] phone:flex-wrap phone:gap-y-0.5">
          <Icon name="target" />
          <span id="coordinator-ask-name">{item.call ? `Waiting on you: ${item.call.tool}` : 'Waiting on you'}</span>
          {item.call && (
            <>
              {' '}
              <span className="min-w-0 truncate font-mono text-[0.75rem] leading-[1.4] font-normal text-card-foreground phone:flex-[1_0_100%] phone:pl-6">
                {item.call.summary}
              </span>
            </>
          )}
        </p>
        {item.lines.length > 0 && (
          <pre className={cn(TEXT, 'ml-6 bg-transparent p-0 text-[0.75rem] leading-[1.6] phone:ml-0')}>
            {item.lines.join('\n')}
          </pre>
        )}
        {item.keys.length > 0 && (
          <div className="ml-6 flex flex-wrap gap-1.5 phone:ml-0 phone:grid phone:grid-cols-4">
            {item.keys.map((key) => (
              <KeyButton key={key} name={key} />
            ))}
          </div>
        )}
      </div>
    </li>
  );
}

function Item({ item, onToggle }: { item: LogItem; onToggle: OnToggle }) {
  switch (item.kind) {
    case 'entry':
      return <Entry entry={item.entry} onToggle={onToggle} />;
    case 'answer':
      return (
        <li className="flex items-center gap-2 text-muted-foreground [&_.i-check]:text-ready">
          <Icon name={item.isAnswered ? 'check' : 'target'} />
          <span>{item.words}</span>
        </li>
      );
    case 'ask':
      return <Ask item={item} />;
    case 'works':
      return (
        <li className="flex items-center gap-2 text-card-foreground [&_.i-works]:animate-[turn_1.2s_linear_infinite] [&_.i-works]:text-working">
          <Icon name="works" />
          <span>The coordinator works</span>
        </li>
      );
    case 'empty':
      return (
        <li className="my-auto py-12 text-center">
          <p className="m-0 font-semibold">{item.title}</p>
          <p className="m-0 mt-1 text-[0.78125rem] text-muted-foreground">{item.text}</p>
        </li>
      );
  }
}

export function Entries({ items, onToggle }: { items: readonly LogItem[]; onToggle: OnToggle }) {
  return items.map((item) => <Item key={item.key} item={item} onToggle={onToggle} />);
}
