import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import type { IssueKey } from '../../../lib/tracker/key.ts';
import type { IssueItem, IssueView } from '../../types.ts';
import { clock } from '../../view.ts';
import { issueKey, readIssue } from '../query.ts';
import { Badge } from '../ui/badge.tsx';
import { IssueMarkdown } from './markdown.tsx';
import { WARNING } from './parts.tsx';

const HEAD = 'flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.75rem] leading-normal text-muted-foreground';
const NO_ITEMS: ReadonlySet<string> = new Set();

const Time = ({ at }: { at: string }) => (
  <time className="font-mono text-[0.71875rem] font-normal tabular-nums" dateTime={at}>
    {clock(at, true)}
  </time>
);

const New = () => <Badge>New</Badge>;

function Item({ item, images, isNew }: { item: IssueItem; images: IssueView['images']; isNew: boolean }) {
  if (item.kind === 'label')
    return (
      <li className={HEAD}>
        <span>{item.change === 'added' ? 'Added' : 'Removed'}</span>
        <Badge variant="outline">{item.name}</Badge>
        <Time at={item.at} />
        {isNew && <New />}
      </li>
    );
  return (
    <li className="flex flex-col gap-2">
      <div className={HEAD}>
        <b className="font-medium text-card-foreground">{item.author ?? 'unknown'}</b>
        <Time at={item.at} />
        {isNew && <New />}
      </div>
      <IssueMarkdown text={item.body} images={images} />
    </li>
  );
}

export function Conversation({
  number,
  revision,
  onCount,
}: {
  number: IssueKey;
  revision: string | null;
  onCount?: (comments: number) => void;
}) {
  const { data, error, isPlaceholderData } = useQuery({
    queryKey: issueKey(number, revision),
    queryFn: readIssue,
    placeholderData: keepPreviousData,
  });
  const kept = useRef<IssueView | null>(null);
  if (data) kept.current = data;
  const view = kept.current;
  const marks = useRef<{ view: IssueView | null; ids: ReadonlySet<string> | null; fresh: ReadonlySet<string> }>({
    view: null,
    ids: null,
    fresh: NO_ITEMS,
  });
  if (view && marks.current.view !== view) {
    const ids = new Set(view.items.map((item) => item.id));
    const before = marks.current.ids;
    marks.current = { view, ids, fresh: before ? new Set([...ids].filter((id) => !before.has(id))) : NO_ITEMS };
  }
  const { fresh } = marks.current;
  const [line, setLine] = useState('');
  useEffect(() => {
    if (fresh.size === 0) return;
    setLine('');
    const timer = setTimeout(() => setLine(fresh.size === 1 ? '1 new item' : `${fresh.size} new items`), 100);
    return () => clearTimeout(timer);
  }, [fresh]);
  const comments = data && !isPlaceholderData ? data.items.filter((item) => item.kind === 'comment').length : null;
  useEffect(() => {
    if (comments !== null) onCount?.(comments);
  }, [comments, onCount]);
  const failure = error && <p className={WARNING}>{`Cannot read the issue: ${error.message}`}</p>;
  return (
    <>
      {view ? (
        <>
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="secondary">{view.state === 'open' ? 'Open' : 'Closed'}</Badge>
            {view.labels.map((label) => (
              <Badge key={label} variant="outline">
                {label}
              </Badge>
            ))}
          </div>
          {failure}
          <ol className="m-0 flex list-none flex-col gap-4 p-0 [&>li+li]:border-t [&>li+li]:border-border [&>li+li]:pt-4">
            <li className="flex flex-col gap-2">
              <h3 className="m-0 text-[0.75rem] leading-normal font-medium text-card-foreground">Description</h3>
              {view.body ? (
                <IssueMarkdown text={view.body} images={view.images} />
              ) : (
                <p className="m-0 text-[0.8125rem] text-muted-foreground">No description.</p>
              )}
            </li>
            {view.items.map((item) => (
              <Item key={item.id} item={item} images={view.images} isNew={fresh.has(item.id)} />
            ))}
          </ol>
        </>
      ) : (
        (failure ?? <p className="m-0 text-[0.8125rem] text-muted-foreground">Loading the issue…</p>)
      )}
      <p className="sr-only" role="status">
        {line}
      </p>
    </>
  );
}
