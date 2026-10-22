export const NODE_NEEDED = 'Node 22.18, or Node 24.2 or later, is necessary';

export const isNodeOk = (version) => {
  const [major, minor] = version.split('.').map(Number);
  return major === 22 ? minor >= 18 : major === 24 ? minor >= 2 : major > 24;
};

export const cleanPath = (value, delimiter = ':') =>
  value
    .split(delimiter)
    .filter((item) => !/node_modules\/\.bin\/*$/.test(item))
    .join(delimiter);
