import fs from 'node:fs';
import { resolve } from 'node:path';
import type { Host } from '../host/names.ts';
import { engineRevision } from '../release/release.ts';
import {
  bunFloor,
  type Config,
  ConfigError,
  type ConfigReader,
  type ConfigSource,
  parseConfigText,
  validateConfig,
} from './core.ts';

const notRegularFile = 'need a regular, readable file, with no symlink';

export function readSnapshot(file: string): Uint8Array {
  let before: fs.BigIntStats;
  try {
    before = fs.lstatSync(file, { bigint: true });
  } catch (error) {
    throw new ConfigError([], notRegularFile, (error as NodeJS.ErrnoException).code);
  }
  if (!before.isFile()) throw new ConfigError([], notRegularFile);
  let fd: number;
  try {
    fd = fs.openSync(file, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
  } catch (error) {
    const { code } = error as NodeJS.ErrnoException;
    throw new ConfigError([], `cannot open the file: ${code}`, code);
  }
  try {
    const opened = fs.fstatSync(fd, { bigint: true });
    if (opened.dev !== before.dev || opened.ino !== before.ino) {
      throw new ConfigError([], 'the file changed during the read');
    }
    return fs.readFileSync(fd);
  } finally {
    fs.closeSync(fd);
  }
}

function decode(bytes: Uint8Array): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    throw new ConfigError([], 'invalid UTF-8');
  }
}

export function readConfigSource(checkout: string): ConfigSource {
  if (Bun.semver.order(Bun.version, bunFloor) < 0) {
    throw new ConfigError([], `need Bun >=${bunFloor} on PATH, found ${Bun.version}`);
  }
  return parseConfigText(decode(readSnapshot(`${checkout}/.celetis.yaml`)));
}

export function readConfig(checkout: string): Config {
  return validateConfig(readConfigSource(checkout));
}

let daemon = false;

export function readAsDaemon(): void {
  daemon = true;
}

export async function engineReader(host?: Host): Promise<ConfigReader> {
  const root = resolve(import.meta.dir, '../../..');
  const part = await engineRevision(root).then(
    (revision) => `the engine ${revision.slice(0, 12)}`,
    () => `the engine at ${root}`,
  );
  const act = daemon
    ? 'run celetis update, then restart the daemon'
    : host === 'codex'
      ? 'run celetis update, then start a new Codex session'
      : 'run celetis update';
  return { part, act };
}
