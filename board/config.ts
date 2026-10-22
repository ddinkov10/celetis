import { access, constants, lstat, realpath } from 'node:fs/promises';
import { isAbsolute, join, sep } from 'node:path';
import { bindRuntime } from './runtime.ts';
import type { Command, Config } from './types.ts';

export class ConfigError extends Error {
  override name = 'ConfigError';
}

const LISTS = ['data', 'run', 'resume'] as const;
const KEYS = [...LISTS, 'port'];
export const NUMBER = '{n}';
export const AGENT = '{agent}';
const CONTROL = /[\u0000-\u001f\u007f]/;
const BRACE = /[{}]/;

function refuse(message: string): never {
  throw new ConfigError(message);
}
const isUnder = (folder: string, path: string) => path.startsWith(`${folder}${sep}`);
const isList = (value: unknown): value is Command =>
  Array.isArray(value) && value.length > 0 && value.every((item) => typeof item === 'string');

const checkFile = async (main: string, real: string, subject: string) => {
  if (real !== main && !isUnder(main, real)) refuse(`${subject} resolves to a place outside the main checkout`);
  if (isUnder(join(main, '.claude', 'worktrees'), real)) refuse(`${subject} resolves into a lane worktree`);
  if (!(await lstat(real)).isFile()) refuse(`${subject} is not a regular file`);
};

const readList = async (main: string, key: string, list: unknown): Promise<Command> => {
  if (!isList(list)) refuse(`"${key}" is not a list of strings with one item or more`);
  const [first, ...rest] = list;
  if (isAbsolute(first)) refuse(`"${key}": the first item is an absolute path`);
  if (first.split(sep).includes('..')) refuse(`"${key}": the first item has a ".." part`);
  const control = `"${key}": an item or a path has a control character`;
  if (list.some((item) => CONTROL.test(item))) refuse(control);
  if (key === 'data') {
    if (list.some((item) => BRACE.test(item))) refuse('"data": an item has "{" or "}"');
  } else if (key === 'run') {
    if (list.some((item) => BRACE.test(item) && item !== NUMBER && item !== AGENT))
      refuse(`"${key}": an item has "{" or "}" and is not {n}`);
    if (!rest.includes(NUMBER)) refuse(`"${key}" has no {n} item`);
  } else {
    if (list.some((item) => BRACE.test(item) && item !== NUMBER))
      refuse(`"${key}": an item has "{" or "}" and is not {n}`);
    if (!rest.includes(NUMBER)) refuse(`"${key}" has no {n} item`);
  }
  const subject = `"${key}": ${first}`;
  const real = await realpath(join(main, first)).catch(() => refuse(`${subject} does not exist`));
  await checkFile(main, real, subject);
  await access(real, constants.X_OK).catch(() => refuse(`${subject} is not executable`));
  if (CONTROL.test(real)) refuse(control);
  return bindRuntime([real, ...rest]);
};

export const parseConfig = async (main: string, source: string, subject: string): Promise<Config> => {
  const config: Config = { data: null, run: null, resume: null, port: null };
  let json: Record<string, unknown>;
  try {
    json = JSON.parse(source);
  } catch {
    refuse(`${subject} is not JSON`);
  }
  if (typeof json !== 'object' || json === null || Array.isArray(json)) refuse(`${subject} is not a JSON object`);
  for (const key of Object.keys(json))
    if (!KEYS.includes(key)) refuse(`${JSON.stringify(key)} is not a key of the config`);
  for (const key of LISTS) if (Object.hasOwn(json, key)) config[key] = await readList(main, key, json[key]);
  if (Object.hasOwn(json, 'port')) {
    if (!Number.isInteger(json.port) || (json.port as number) < 1024 || (json.port as number) > 65535)
      refuse('"port" is not an integer from 1024 to 65535');
    config.port = json.port as number;
  }
  return config;
};
