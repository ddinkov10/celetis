import type { NativeOn, NativeTools, ToolReply } from '../../../types/native-host.d.ts';

let sequence = 0;

function owned($: NativeTools, path: string) {
  const root = $.plugin.root.slice(0, $.plugin.root.lastIndexOf('/'));
  return typeof path === 'string' && path.startsWith(`${root}/`);
}

function log(
  $: NativeTools,
  event: string,
  id: string | number | undefined,
  input: unknown,
  result: unknown,
  origin: unknown,
) {
  $.ui.log(JSON.stringify({ event, id, input, result, origin }));
}

async function readResult(result: ToolReply) {
  const value = { ...result };
  if (result.isError || result.deny) return value;
  delete value.context;
  delete value.text;
  if (typeof result.result === 'object' && result.result.type === 'text' && result.result.file) {
    const { content, ...file } = result.result.file;
    const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(content ?? '')));
    const contentSha256 = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
    value.result = { ...result.result, file: { ...file, contentSha256 } };
  }
  return value;
}

export function register(on: NativeOn) {
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
