import fs from 'node:fs';
import {
  bunFloor,
  type Config,
  ConfigError,
  type ConfigSource,
  formatConfigError,
  parseConfigText,
  validateConfig,
} from './config-core.ts';

const notRegularFile = 'need a regular, readable file, with no symlink';

export function readSnapshot(file: string): Uint8Array {
  let before: fs.BigIntStats;
  try {
    before = fs.lstatSync(file, { bigint: true });
  } catch {
    throw new ConfigError([], notRegularFile);
  }
  if (!before.isFile()) throw new ConfigError([], notRegularFile);
  let fd: number;
  try {
    fd = fs.openSync(file, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
  } catch (error) {
    throw new ConfigError([], `cannot open the file: ${(error as NodeJS.ErrnoException).code}`);
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

if (import.meta.main) {
  const checkout = process.argv[2] ?? 'undefined';
  try {
    console.log(JSON.stringify(readConfig(checkout)));
  } catch (error) {
    if (!(error instanceof ConfigError)) throw error;
    console.error(formatConfigError(checkout, error));
    process.exit(2);
  }
}
