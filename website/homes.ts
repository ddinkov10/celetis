import { existsSync, readdirSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';

export type Home = { folder: string; label: string };

export const homes: Home[] = [
  { folder: 'explanation', label: 'Explanation' },
  { folder: 'tutorials', label: 'Tutorials' },
  { folder: 'how-to', label: 'How-to guides' },
  { folder: 'reference', label: 'Reference' },
];

const docs = resolve('../docs');

const documents = (folder: string): string[] =>
  existsSync(join(docs, folder))
    ? readdirSync(join(docs, folder), { recursive: true, encoding: 'utf8' })
        // The docs plugin globs with `exclude: []` and skips dot paths, so both count the same files.
        .filter((path) => path.endsWith('.md') && !path.split(sep).some((part) => part.startsWith('.')))
        .map((path) => join(folder, path))
        .sort()
    : [];

export const published: Home[] = homes.filter(({ folder }) => documents(folder).length > 0);

const first = homes[0];
export const homePage: string | undefined =
  first && existsSync(join(docs, first.folder, 'overview.md'))
    ? join(first.folder, 'overview.md')
    : published.map(({ folder }) => documents(folder)[0])[0];
