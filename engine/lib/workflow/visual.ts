import { lstat } from 'node:fs/promises';
import { join } from 'node:path';

export function visualFolder(main: string): string {
  return join(main, 'docs/superpowers/visuals');
}

export function visualPage(main: string, sha: string): string {
  return join(visualFolder(main), `${sha}.html`);
}

export function partialPage(main: string, sha: string): string {
  return join(visualFolder(main), `${sha}.partial.html`);
}

export function visualLink(issue: number): string {
  return `#${issue} visual`;
}

export async function hasPage(main: string, sha: string): Promise<boolean> {
  return (await lstat(visualPage(main, sha)).catch(() => null))?.isFile() ?? false;
}
