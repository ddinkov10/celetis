let sequence = 0;

function owned($, path) {
  const root = $.plugin.root.slice(0, $.plugin.root.lastIndexOf('/'));
  return typeof path === 'string' && path.startsWith(root + '/');
}

function log($, event, id, input, result, origin) {
  $.ui.log(JSON.stringify({ event, id, input, result, origin }));
}

async function readResult(result) {
  const value = { ...result };
  if (result.isError || result.deny) return value;
  delete value.context;
  delete value.text;
  if (result.result?.type === 'text') {
    const { content, ...file } = result.result.file;
    const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(content)));
    const contentSha256 = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
    value.result = { ...result.result, file: { ...file, contentSha256 } };
  }
  return value;
}

export function register(on) {
  on('fs.stat', async ($, e, next) => {
    const id = ++sequence;
    if (owned($, e.path)) log($, 'fs.stat.start', id, e, null, next.origin);
    try {
      const result = await next(e);
      if (owned($, e.path)) log($, 'fs.stat.result', id, e, result, next.origin);
      return result;
    } catch (error) {
      if (owned($, e.path)) log($, 'fs.stat.result', id, e, { deny: String(error) }, next.origin);
      throw error;
    }
  });
  on('tool.call', { tool: 'Read' }, async ($, e, next) => {
    if (owned($, e.file_path)) log($, 'tool.start', e.tool_use_id, e, null, next.origin);
    const result = await next(e);
    if (owned($, e.file_path)) log($, 'tool.result', e.tool_use_id, e, await readResult(result), next.origin);
    return result;
  });
  on('tool.check', { tool: 'Read' }, async ($, e, next) => {
    const result = await next(e);
    if (owned($, e.input.file_path)) log($, 'tool.check', e.tool_use_id, e, result, next.origin);
    return result;
  });
}
