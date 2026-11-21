import { existsSync, statSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { homePage, homes } from './homes.ts';

const repository = 'https://github.com/ddinkov10/celetis';
const branch = 'main';
const root = resolve('..');

function githubUrl(source: string, url: string): string {
  const cut = url.indexOf('#');
  const path = cut < 0 ? url : url.slice(0, cut);
  const fragment = cut < 0 ? '' : url.slice(cut);
  const target = resolve(dirname(resolve(source)), decodeURIComponent(path));
  const inside = relative(root, target);
  if (inside === '..' || inside.startsWith(`..${sep}`) || isAbsolute(inside))
    throw new Error(`${source}: the link ${url} leaves the repository`);
  if (!existsSync(target)) throw new Error(`${source}: the link ${url} names no file`);
  const kind = statSync(target).isDirectory() ? 'tree' : 'blob';
  return `${repository}/${kind}/${branch}/${encodeURI(inside.split(sep).join('/'))}${fragment}`;
}

type Node = { type: string; url?: string; children?: Node[] };

const fileLinks = () => (tree: Node, file: { path: string }) => {
  const visit = (node: Node) => {
    if (
      (node.type === 'link' || node.type === 'definition') &&
      node.url !== undefined &&
      !/^[a-z][a-z\d+.-]*:/i.test(node.url) &&
      !node.url.startsWith('#') &&
      !node.url.startsWith('/') &&
      !/\.mdx?$/.test(node.url.split('#')[0] ?? '')
    )
      node.url = githubUrl(file.path, node.url);
    for (const child of node.children ?? []) visit(child);
  };
  visit(tree);
};

type FrontMatter = { frontMatter: Record<string, unknown>; content: string };
type FrontMatterParams = {
  filePath: string;
  fileContent: string;
  defaultParseFrontMatter: (params: { filePath: string; fileContent: string }) => Promise<FrontMatter>;
};

export default {
  title: 'celetis',
  url: 'https://ddinkov10.github.io',
  baseUrl: '/celetis/',
  trailingSlash: false,
  onBrokenLinks: 'throw',
  markdown: {
    format: 'detect',
    mermaid: true,
    parseFrontMatter: async (params: FrontMatterParams): Promise<FrontMatter> => {
      const result = await params.defaultParseFrontMatter(params);
      if (homePage === undefined || resolve(params.filePath) !== resolve('../docs', homePage)) return result;
      return { ...result, frontMatter: { ...result.frontMatter, slug: '/', sidebar_position: 0 } };
    },
    hooks: {
      onBrokenMarkdownLinks: ({ sourceFilePath, url }: { sourceFilePath: string; url: string }) =>
        githubUrl(sourceFilePath, url),
    },
  },
  themes: ['@docusaurus/theme-mermaid'],
  presets: [
    [
      'classic',
      {
        docs: {
          path: '../docs',
          include: homes.map(({ folder }) => `${folder}/**/*.md`),
          exclude: [],
          routeBasePath: '/',
          sidebarPath: './sidebars.ts',
          beforeDefaultRemarkPlugins: [fileLinks],
        },
        blog: false,
      },
    ],
  ],
  themeConfig: {
    navbar: {
      title: 'celetis',
      items: [{ href: repository, label: 'GitHub', position: 'right' }],
    },
    // A wide diagram scales down to the page column, so the default font renders too small.
    mermaid: { options: { themeVariables: { fontSize: '1.5rem' } } },
  },
};
