import { cn } from 'cn';
import { type ReactElement, useMemo } from 'react';
import Markdown, { type Components, type ExtraProps } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ViewBoundary } from '../ui/view-boundary.tsx';
import { safeUrl } from '../ui.ts';
import { Link } from './parts.tsx';

type Images = Readonly<Record<string, string>>;

const ALIGN: Record<string, string> = { left: 'text-left', center: 'text-center', right: 'text-right' };
const LINK = 'underline underline-offset-2';
const CELL = 'border border-border px-2.5 py-1.5 align-top [overflow-wrap:normal]';
const BODY = cn(
  'flex min-w-0 flex-col gap-3 text-[0.8125rem] leading-normal text-foreground [overflow-wrap:anywhere]',
  '[&_:where(p,ul,ol,blockquote,pre,h1,h2,h3,h4,h5,h6,hr)]:m-0 [&_:is(p,li,blockquote)]:text-pretty',
  '[&_:is(h1,h2,h3,h4,h5,h6)]:mt-1 [&_:is(h1,h2,h3,h4,h5,h6)]:leading-[1.3] [&_:is(h1,h2,h3,h4,h5,h6)]:font-semibold',
  '[&_h1]:text-[1.03125rem] [&_h2]:text-[0.875rem] [&_:is(h3,h4,h5,h6)]:text-[0.8125rem]',
  '[&_:is(ul,ol)]:pl-[18px] [&_ul]:list-disc [&_ol]:list-decimal [&_:is(li,blockquote)>*+*]:mt-[7px]',
  '[&_blockquote]:border-l-2 [&_blockquote]:border-border-strong [&_blockquote]:pl-[18px] [&_blockquote]:text-card-foreground',
  '[&_:not(pre)>code]:rounded-[4px] [&_:not(pre)>code]:bg-secondary [&_:not(pre)>code]:px-1 [&_:not(pre)>code]:py-px [&_:not(pre)>code]:font-mono [&_:not(pre)>code]:text-[0.75rem]',
  '[&_hr]:border-0 [&_hr]:border-t [&_hr]:border-border',
);
const PRE =
  'overflow-x-auto rounded-lg bg-secondary p-2.5 font-mono text-[0.75rem] leading-[1.55] font-normal whitespace-pre [overflow-wrap:normal]';

export const issueUrl = (url: string, key: string, tag: string, images: Images): string => {
  if (tag === 'img' && key === 'src') return Object.hasOwn(images, url) ? (images[url] as string) : url;
  if (key === 'href') return safeUrl(url) ?? '';
  return '';
};

type HastNode = NonNullable<ExtraProps['node']>['children'][number];

const textOf = (node: HastNode): string =>
  node.type === 'text' ? node.value : node.type === 'element' ? node.children.map(textOf).join('') : '';
const headersOf = (node: HastNode): HastNode[] =>
  node.type !== 'element' ? [] : node.tagName === 'th' ? [node] : node.children.flatMap(headersOf);
const tableName = (node: ExtraProps['node']): string => {
  const names = (node?.children ?? [])
    .filter((child) => child.type === 'element' && child.tagName === 'thead')
    .flatMap(headersOf)
    .slice(0, 3)
    .map(textOf)
    .filter(Boolean);
  return names.length ? `Table: ${names.join(', ')}` : 'Table';
};

const cell =
  (Tag: 'th' | 'td'): NonNullable<Components['td']> =>
  ({ node, style: _style, className, ...props }) => (
    <Tag
      {...props}
      className={cn(CELL, Tag === 'th' && 'font-semibold', ALIGN[String(node?.properties.align)], className)}
    />
  );

const componentsOf = (images: Images): Components => {
  const embedded = new Set(Object.values(images));
  return {
    a: ({ href, children }) => (
      <Link className="" anchorClassName={LINK} url={href}>
        {children}
      </Link>
    ),
    img: ({ src, alt = '' }) => {
      const url = typeof src === 'string' ? src : '';
      if (embedded.has(url)) return <img src={url} alt={alt} className="h-auto max-w-full" />;
      return safeUrl(url) ? (
        <Link className="" anchorClassName={LINK} url={url}>
          {alt || url}
        </Link>
      ) : (
        <span>{`${alt} (${url})`}</span>
      );
    },
    table: ({ node, ...props }) => (
      <section
        className="overflow-x-auto"
        aria-label={tableName(node)}
        // biome-ignore lint/a11y/noNoninteractiveTabindex: a wide table scrolls by keyboard, so it is a tab stop
        tabIndex={0}
      >
        <table {...props} className="border-collapse" />
      </section>
    ),
    th: cell('th'),
    td: cell('td'),
    pre: ({ node: _node, className, ...props }) => (
      <section
        className="overflow-x-auto rounded-lg"
        aria-label="Code"
        // biome-ignore lint/a11y/noNoninteractiveTabindex: a wide code block scrolls by keyboard, so it is a tab stop
        tabIndex={0}
      >
        <pre {...props} className={cn(PRE, 'w-max min-w-full', className)} />
      </section>
    ),
  };
};

export function IssueMarkdown({ text, images }: { text: string; images: Images }): ReactElement {
  const components = useMemo(() => componentsOf(images), [images]);
  return (
    <ViewBoundary snapshot={text} fallback={<pre className={cn(PRE, 'whitespace-pre-wrap')}>{text}</pre>}>
      <div className={BODY}>
        <Markdown
          remarkPlugins={[remarkGfm]}
          skipHtml
          urlTransform={(url, key, node) => issueUrl(url, key, node.tagName, images)}
          components={components}
        >
          {text}
        </Markdown>
      </div>
    </ViewBoundary>
  );
}
