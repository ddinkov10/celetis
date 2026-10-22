export const BUN_NEEDED = 'Bun 1.4.2 or later is necessary';

export const isBunOk = (version: string): boolean => Bun.semver.order(version, '1.4.2') >= 0;

export const cleanPath = (value: string, delimiter = ':'): string =>
  value
    .split(delimiter)
    .filter((item) => !/node_modules\/\.bin\/*$/.test(item))
    .join(delimiter);
