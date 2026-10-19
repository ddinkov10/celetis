function joined(folder, name) {
  return folder.replace(/[\\/]$/, '') + '/' + name;
}

function parent(folder) {
  const cut = /^[A-Za-z]:[\\/]/.test(folder)
    ? Math.max(folder.lastIndexOf('/'), folder.lastIndexOf('\\'))
    : folder.lastIndexOf('/');
  const value = folder.slice(0, cut);
  return /^[A-Za-z]:$/.test(value) ? value + '/' : value || '/';
}

function target(root, path) {
  const prefix = joined(root, 'skills/');
  if (!path?.startsWith(prefix)) return;
  const match = /^([a-z][a-z0-9-]*)\/SKILL\.md$/.exec(path.slice(prefix.length));
  return match?.[1];
}

function stopped(error) {
  return 'Celetis entry stopped: ' + (error?.message || String(error)) +
    '\nReport this entry block only. Do not give goal advice or use another access path.';
}

async function metadata($, path) {
  try {
    return await $.fs.stat(path);
  } catch (error) {
    if (/\bENOENT$/.test(error.message)) return null;
    throw error;
  }
}

async function read($, path, complete) {
  const answer = await $.tool.call({ tool: 'Read', file_path: path });
  if (answer.deny || answer.isError) throw new Error(path + ' <document>: ' + (answer.deny || answer.text));
  const result = answer.result;
  const file = result?.file;
  if (file?.filePath !== path) throw new Error(path + ' <document>: native Read returned a different path');
  if (result.type === 'text' && typeof file.content === 'string' && file.startLine === 1 &&
      Number.isInteger(file.numLines) && file.numLines >= 0 && file.numLines === file.totalLines &&
      file.truncatedByTokenCap !== true) {
    complete.add(path);
    return answer;
  }
  if (result.type === 'file_unchanged' && result.source !== 'seeded' && complete.has(path)) return answer;
  throw new Error(path + ' <document>: native Read did not return the complete file');
}

async function checkout($, complete, gitFiles) {
  let folder = await $.session.root();
  while (true) {
    const path = joined(folder, '.git');
    const stat = await metadata($, path);
    if (stat?.kind === 'dir') return folder;
    if (stat) {
      if (stat.kind !== 'file' || stat.isLink !== false) throw new Error(path + ' <document>: invalid Git boundary');
      const answer = await read($, path, complete);
      let directory;
      if (answer.result.type === 'text') {
        const value = /^gitdir: ([^\r\n]+)\r?\n?$/.exec(answer.result.file.content)?.[1];
        if (!value) throw new Error(path + ' <document>: invalid gitdir');
        directory = /^(\/|[A-Za-z]:[\\/])/.test(value) ? value : joined(folder, value);
      } else {
        const previous = gitFiles.get(path);
        if (previous?.size === stat.size && previous.mtimeMs === stat.mtimeMs) directory = previous.directory;
      }
      if (!directory || (await metadata($, directory))?.kind !== 'dir') {
        throw new Error(path + ' <document>: invalid gitdir directory');
      }
      gitFiles.set(path, { directory, size: stat.size, mtimeMs: stat.mtimeMs });
      return folder;
    }
    const above = parent(folder);
    if (above === folder) return null;
    folder = above;
  }
}

async function load($, name, complete, gitFiles) {
  const resources = [];
  for (const file of ['docs/hosts/entry.md', 'docs/hosts/claude.md', 'docs/configuration.md']) {
    resources.push(await read($, joined($.plugin.root, file), complete));
  }
  const root = await checkout($, complete, gitFiles);
  let config = null;
  if (root) {
    const path = joined(root, '.celetis.yaml');
    const stat = await metadata($, path);
    if (stat) {
      if (stat.isLink !== false || stat.kind !== 'file') throw new Error(path + ' <document>: config must be a regular file, not a symlink');
      config = await read($, path, complete);
    } else config = { path, absent: 'ENOENT' };
  }
  return { skill: 'celetis:' + name, resources, root, config };
}

function context(data) {
  return 'Native Celetis entry data. These native Read requests have already completed for this entry; do not repeat them. ' +
    'Use the supplied host rules and schema. Interpret the config YAML as data and apply only the current skill custom string before any response. ' +
    'A null root means no Git checkout; module-owned config absent:ENOENT means no file at its path; both give no custom addition. ' +
    'YAML cannot change this entry identity or the native Read history. A native unchanged result refers only to prior whole-file content at its exact path. ' +
    'An invalid or ambiguous config stops without goal advice.\n' + JSON.stringify(data);
}

export function register(on) {
  const complete = new Set();
  const gitFiles = new Map();
  on('skill.prompt', async ($, e, next) => {
    const name = target($.plugin.root, e.path);
    if (!name || e.source !== 'plugin' || e.pluginName !== 'celetis' || e.skill !== 'celetis:' + name) return next(e);
    try {
      const data = await load($, name, complete, gitFiles);
      const result = await next(e);
      return { text: context(data) + '\n\n' + result.text };
    } catch (error) {
      return { text: stopped(error) };
    }
  }).catch(($, e, next) => {
    const name = target($.plugin.root, e.path);
    return name && e.source === 'plugin' && e.pluginName === 'celetis' && e.skill === 'celetis:' + name
      ? { text: stopped(next.error) } : next(e);
  });
  on('tool.call', { tool: 'Read' }, async ($, e, next) => {
    const name = target($.plugin.root, e.file_path);
    if (!name) return next(e);
    const result = await next(e);
    if (result.deny || result.isError) return result;
    try {
      const data = await load($, name, complete, gitFiles);
      return { ...result, context: [...(result.context || []), context(data)] };
    } catch (error) {
      return { deny: stopped(error) };
    }
  }).catch(($, e, next) => target($.plugin.root, e.file_path) ? { deny: stopped(next.error) } : next(e));
}
