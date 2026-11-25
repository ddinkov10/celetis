import { useQuery } from '@tanstack/react-query';
import { cn } from 'cn';
import { useState } from 'react';
import { grammar } from '../../../lib/tracker/grammar.ts';
import type { IssueKey } from '../../../lib/tracker/key.ts';
import type { BoardHistory, HistoryRow } from '../../types.ts';
import { clock } from '../../view.ts';
import { Icon } from '../app/icon.tsx';
import { viewOptions } from '../query.ts';
import { useShellStore } from '../store.ts';
import { Button, buttonVariants } from '../ui/button.tsx';
import { TabsContent } from '../ui/tabs.tsx';
import { SERVER_DOWN } from '../ui.ts';
import { act } from './actions.ts';
import { Link, useKeptFocus, useKeptScroll, WARNING } from './parts.tsx';
import { screen, useScreen } from './state.ts';

const NOTE = 'my-3.5 text-[0.75rem] text-muted-foreground';
const ACTION = 'w-7 p-0 [grid-area:action] phone:min-h-11 phone:min-w-11';
const LINK = '[a&:hover]:underline [a&:hover]:underline-offset-[3px]';

const makeVisual = async (number: IssueKey) => {
  if (screen.visualPresses().has(number)) return;
  screen.setVisualPresses((presses) => presses.add(number));
  await act('/api/visual', { number }, 'Make visual failed');
  screen.setVisualPresses((presses) => presses.delete(number));
};

function VisualControl({ entry, isPressed }: { entry: HistoryRow; isPressed: boolean }) {
  const { number } = entry;
  const state = isPressed && entry.visual === 'none' ? 'starting' : entry.visual;
  if (state === 'ready') {
    const name = `Open the visual of #${number}`;
    return (
      <a
        className={buttonVariants({ variant: 'secondary', size: 'action', className: ACTION })}
        href={`/visual/${entry.sha}`}
        target="_blank"
        rel="noreferrer"
        aria-label={name}
        title={name}
        data-visual={number}
      >
        <Icon name="open" />
      </a>
    );
  }
  if (state === 'making') {
    const name = `The visual of #${number} is in the making`;
    return (
      <span
        className="inline-flex min-h-7 w-7 items-center justify-center gap-1.5 rounded-lg border phone:min-h-11 phone:min-w-11 border-[color-mix(in_srgb,var(--working)_30%,transparent)] bg-[color-mix(in_srgb,var(--working)_10%,transparent)] p-0 text-[0.78125rem] leading-none font-medium text-[color-mix(in_srgb,var(--working)_80%,var(--fg))] [grid-area:action] [&_.icon]:size-[13px] [&_.icon]:animate-turn"
        role="status"
        tabIndex={-1}
        aria-label={name}
        title={name}
        data-visual={number}
      >
        <Icon name="pending" />
      </span>
    );
  }
  const name = state === 'starting' ? `Starting the visual of #${number}` : `Make the visual of #${number}`;
  return (
    <Button
      variant="secondary"
      size="action"
      className={ACTION}
      aria-busy={state === 'starting' ? 'true' : undefined}
      aria-label={name}
      title={name}
      data-visual={number}
      onClick={state === 'starting' ? undefined : () => void makeVisual(number)}
    >
      <Icon name="diff" />
    </Button>
  );
}

function Landed({
  history,
  error,
  presses,
}: {
  history: BoardHistory | null | undefined;
  error: string | null | undefined;
  presses: ReadonlySet<IssueKey>;
}) {
  return (
    <>
      <div className="flex min-h-12 flex-none items-center justify-between gap-3 py-2.5 pr-2.5 pl-4 phone:min-h-14">
        <h2 className="m-0 text-[0.875rem] text-foreground [overflow-wrap:anywhere]">
          {history ? `Landed on ${history.trunk}` : 'Landed history'}
        </h2>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-[18px] pb-[18px] phone:scroll-pb-[calc(var(--dock)+8px)]">
        {!history ? (
          <p className={NOTE}>{error ? `Cannot read history: ${error}` : 'Loading landed history…'}</p>
        ) : (
          <>
            {error && (
              <p className={WARNING} role="status">
                {`${error}. History shows the last good read.`}
              </p>
            )}
            <p className={NOTE}>Latest 20 issues.</p>
            {history.entries.length ? (
              <ol className="m-0 list-none p-0">
                {history.entries.map((entry) => (
                  <li
                    key={entry.number}
                    className="grid grid-cols-[46px_minmax(0,1fr)_auto] items-center gap-x-2.5 gap-y-1.5 border-b border-border py-4 text-[0.8125rem] [grid-template-areas:'number_title_action''number_meta_action'] [&:hover]:bg-secondary"
                  >
                    <Link
                      className={cn(
                        'font-mono text-[0.75rem] text-muted-foreground [align-self:start] [grid-area:number]',
                        LINK,
                      )}
                      url={entry.url}
                    >{`#${entry.number}`}</Link>
                    <Link
                      className={cn(
                        'text-foreground [align-self:end] [overflow-wrap:anywhere] [grid-area:title]',
                        LINK,
                      )}
                      url={entry.url}
                    >
                      {entry.title}
                    </Link>
                    <span className="flex items-baseline gap-1.5 text-[0.75rem] text-muted-foreground [align-self:start] [grid-area:meta]">
                      <CommitLink entry={entry} />
                      <span aria-hidden="true">·</span>
                      <time dateTime={entry.committedAt} title={`Commit time: ${clock(entry.committedAt, true)}`}>
                        {clock(entry.committedAt, true)}
                      </time>
                    </span>
                    <VisualControl entry={entry} isPressed={presses.has(entry.number)} />
                  </li>
                ))}
              </ol>
            ) : (
              <p className={NOTE}>
                {grammar().kind === 'local'
                  ? 'The local tracker does not list landed issues.'
                  : `No landed issues found on ${history.trunk}.`}
              </p>
            )}
            {history.url && (
              <Link
                className="mt-4 inline-block text-card-foreground underline underline-offset-[3px] [overflow-wrap:anywhere]"
                url={history.url}
              >{`View ${history.trunk}`}</Link>
            )}
          </>
        )}
      </div>
    </>
  );
}

function CommitLink({ entry }: { entry: HistoryRow }) {
  return (
    <Link
      className={cn('font-mono text-[0.75rem] text-muted-foreground', LINK)}
      url={entry.commitUrl}
      label={`Commit ${entry.sha}`}
      title={entry.sha}
    >
      {entry.sha.slice(0, 7)}
    </Link>
  );
}

export function History() {
  const isShown = useShellStore((state) => state.shell.tab === 'history');
  const [wasShown, setShown] = useState(isShown);
  if (isShown && !wasShown) setShown(true);
  const history = useScreen((state) => state.read?.history);
  const sourceError = useScreen((state) => state.read?.source.error);
  const presses = useScreen((state) => state.visualPresses);
  const { isError } = useQuery(viewOptions);
  const kept = useKeptFocus<HTMLDivElement>((box, lost) => {
    const visual = lost.dataset.visual;
    const href = lost.getAttribute('href');
    const label = lost.getAttribute('aria-label');
    const match = [...box.querySelectorAll<HTMLElement>('a, button, [data-visual]')].find((node) =>
      visual
        ? node.dataset.visual === visual
        : href
          ? node.getAttribute('href') === href &&
            node.className === lost.className &&
            node.getAttribute('aria-label') === label
          : node.getAttribute('aria-label') === label,
    );
    return match ?? box.querySelector<HTMLElement>('button');
  });
  useKeptScroll(() => [...(kept.ref.current?.querySelectorAll<HTMLElement>('.overflow-y-auto') ?? [])], history);
  return (
    <TabsContent
      {...kept}
      value="history"
      keepMounted
      render={<section />}
      className="flex min-h-0 flex-1 flex-col"
      id="history-pane"
      tabIndex={undefined}
      data-state={wasShown ? 'history' : undefined}
    >
      {wasShown && <Landed history={history} error={isError ? SERVER_DOWN : sourceError} presses={presses} />}
    </TabsContent>
  );
}
