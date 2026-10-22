import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { type FileResult, projectEvents, type StreamBlock, type StreamRow } from './native-entry-events.ts';

export interface CustomInput {
  cwd: string;
  plugin: string;
  pluginSources: { path: string; sha256: string; source?: string }[];
  observerSources?: { path: string; sha256: string; source?: string }[];
  config: { path: string; source: string; sha256: string; kind: string };
  git: { path: string; kind: string };
  tools?: string;
  settings?: unknown;
  goal?: string;
  prompt?: string;
  metadataRecording?: string;
  mcpConfig?: string;
  messages?: unknown[] | null;
}
export interface CustomCheck {
  name: string;
  marker: string;
  checkout?: string;
  reads?: number;
  lane?: string;
  stderr?: string;
  setupFound?: boolean;
}
interface Flat extends StreamBlock {
  owner?: string;
  native?: boolean;
  result?: FileResult;
  session?: string;
  nativePath?: string;
  metadata?: Record<string, unknown>;
  path?: string;
}
interface Proof {
  path: string;
  kind?: string;
}
const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
const body = (value: unknown) =>
  typeof value === 'string'
    ? value
    : Array.isArray(value)
      ? value.map((part) => (record(part).type === 'text' ? (record(part).text ?? '') : '')).join('\n')
      : '';
function kind(value: unknown): string | undefined {
  if (typeof value === 'string')
    return (
      { file: 'file', dir: 'directory', symlink: 'symlink', ENOENT: 'missing', 'error: ENOENT': 'missing' } as Record<
        string,
        string
      >
    )[value];
  const data = record(value);
  const first = (names: string[]) => names.find((name) => Object.hasOwn(data, name));
  const link = data[first(['isSymbolicLink', 'symlink', 'link']) ?? ''],
    file = data[first(['isFile', 'file', 'regular']) ?? ''],
    directory = data[first(['isDirectory', 'directory', 'dir']) ?? ''];
  if (link === true) return 'symlink';
  if (file === true && directory !== true && link === false) return 'file';
  if (directory === true && file !== true && link === false) return 'directory';
  if (data.code === 'ENOENT' && file !== true && directory !== true) return 'missing';
}
function relativePath(code: string, name: string) {
  const roots = [...code.matchAll(/\b(?:const|let|var)\s+root\s*=\s*["']([^"']+)["']/g)];
  if (roots.length !== 1 || !roots[0]?.[1]?.startsWith('/')) return;
  const hasPath = [...code.matchAll(/for\s*\(\s*(?:const|let|var)\s+p\s+of\s*\[([^\]]+)\]/g)].some((match) =>
    [...String(match[1]).matchAll(/["']([^"']+)["']/g)].some((value) => value[1] === name),
  );
  if (!hasPath || !/\blstat\s*\(\s*(root\s*\+\s*["']\/["']\s*\+\s*p|`\$\{root\}\/\$\{p\}`)\s*\)/.test(code)) return;
  return `${roots[0][1]}/${name}`;
}
function proofs(text: string, code: string): Proof[] {
  const records = (value: unknown): Proof[] => {
    if (Array.isArray(value)) {
      if (
        value.length === 3 &&
        typeof value[0] === 'string' &&
        value[0].startsWith('/') &&
        ['.git', '.celetis.yaml'].includes(String(value[1]))
      )
        return [{ path: `${value[0].replace(/\/$/, '')}/${value[1]}`, kind: kind(value[2]) }];
      return value.flatMap(records);
    }
    const data = record(value),
      items: Proof[] = [];
    const path = data.path ?? data.filePath;
    if (typeof path === 'string') items.push({ path, kind: kind(data) });
    for (const [key, value] of Object.entries(data)) {
      if (key.startsWith('/')) items.push({ path: key, kind: kind(value) });
      else if (key === '.git' || key === '.celetis.yaml') {
        const path = relativePath(code, key);
        if (path) items.push({ path, kind: kind(value) });
      } else items.push(...records(value));
    }
    return items;
  };
  const result: Proof[] = [];
  try {
    result.push(...records(JSON.parse(text)));
  } catch {}
  for (const object of text.match(/\{[^{}]*\}/g) ?? []) {
    const path = /(?:\{|,)\s*["']?(?:path|filePath)["']?\s*:\s*["'](\/[^"']+)["']/.exec(object)?.[1];
    if (!path) continue;
    const data: Record<string, boolean> = {};
    for (const field of object.matchAll(
      /(?:\{|,)\s*["']?(isFile|file|regular|isDirectory|directory|dir|isSymbolicLink|symlink|link)["']?\s*:\s*(true|false)/g,
    ))
      if (field[1]) data[field[1]] = field[2] === 'true';
    result.push({ path, kind: kind(data) });
  }
  for (const line of text.split('\n')) {
    const path = /^(?:Error: )?ENOENT:[^\n]*lstat ["']([^"'\n]+)["']$/.exec(line)?.[1];
    if (path) result.push({ path, kind: 'missing' });
  }
  return result;
}
function flatten(rows: StreamRow[]): Flat[] {
  return rows.flatMap<Flat>((row) => {
    if (row.type === 'native_metadata')
      return [
        {
          type: 'native_metadata',
          path: typeof row.path === 'string' ? row.path : undefined,
          metadata: record(row.result),
          session: row.session_id,
        },
      ];
    if (row.type !== 'assistant' && row.type !== 'user') return [];
    const result = typeof row.tool_use_result === 'object' && row.tool_use_result ? row.tool_use_result : undefined;
    return (Array.isArray(row.message?.content) ? row.message.content : []).map((block) => ({
      ...block,
      owner: row.type,
      native: row.native,
      result,
      session: row.session_id,
      nativePath: result?.worktreePath,
    }));
  });
}
const whole = (
  result: FileResult | undefined,
  path: string,
  hash: string | undefined,
  source?: string,
  native = false,
) => {
  const file = result?.file;
  return (
    result?.type === 'text' &&
    file?.filePath === path &&
    file.startLine === 1 &&
    typeof file.numLines === 'number' &&
    file.numLines === file.totalLines &&
    file.truncatedByTokenCap !== true &&
    (source === undefined
      ? typeof hash === 'string' && file.contentSha256 === hash
      : file.content === source || (native && file.contentSha256 === hash))
  );
};
export function evaluateCustom(spec: CustomInput, input: unknown[], check: CustomCheck): string[] {
  const rows = input as StreamRow[],
    events = flatten(rows),
    errors: string[] = [],
    name = check.name,
    expected = check.reads ?? 1,
    path = check.checkout ? `${check.checkout}/.celetis.yaml` : spec.config.path;
  const fail = (valid: boolean, reason: string) => {
    if (!valid) errors.push(reason);
  };
  const host = `${spec.plugin}/docs/hosts/entry.md`,
    skills = `${spec.plugin}/skills/`;
  const files = events.filter(
    (event) =>
      event.type === 'tool_use' &&
      (['Read', 'Glob', 'Grep'].includes(event.name ?? '') ||
        (event.name === 'mcp__node_repl__js' && String(event.input?.code).includes('lstat'))) &&
      !(
        event.name === 'Read' &&
        event.input?.file_path?.startsWith(skills) &&
        event.input.file_path.endsWith('/SKILL.md')
      ),
  );
  const hosts = files.filter((event) => event.name === 'Read' && event.input?.file_path === host);
  const hostHash = spec.pluginSources.find((source) => source.path === host)?.sha256;
  fail(files[0]?.name === 'Read' && files[0]?.input?.file_path === host, 'host entry must be first');
  fail(
    name === 'borrowed' ? hosts.length >= 1 && hosts.length <= 2 : hosts.length === Math.max(expected, 1),
    'host entry count',
  );
  fail(
    hosts.every((call) =>
      events.some(
        (reply, index) =>
          reply.type === 'tool_result' &&
          reply.tool_use_id === call.id &&
          reply.is_error !== true &&
          (!reply.native ||
            whole(reply.result, host, hostHash) ||
            (reply.result?.type === 'file_unchanged' &&
              reply.result.source !== 'seeded' &&
              reply.result.file?.filePath === host &&
              events
                .slice(0, index)
                .some(
                  (previous) =>
                    previous.type === 'tool_result' &&
                    previous.is_error !== true &&
                    whole(previous.result, host, hostHash),
                ))),
      ),
    ),
    'complete host result',
  );
  const after = name === 'enter-worktree' ? rows.findIndex((row) => row.type === 'result') + 1 : 0,
    startup = flatten(rows.slice(after));
  const reads = startup.filter(
    (event) => event.type === 'tool_use' && event.name === 'Read' && event.input?.file_path === path,
  );
  const replyIndex = (id: string | undefined) =>
    startup.findIndex((event) => event.type === 'tool_result' && event.tool_use_id === id);
  const first = reads[0]
    ? replyIndex(reads[0].id)
    : startup.findLastIndex((event) => event.type === 'tool_result' || event.type === 'native_metadata');
  fail(
    first >= 0 &&
      startup.every((event, index) => event.owner !== 'assistant' || event.type !== 'text' || index > first),
    'text before entry completion',
  );
  if (reads.length === 2) {
    const target = name === 'borrowed' ? 'lesson' : 'guide';
    const at = startup.findIndex(
      (event) =>
        event.type === 'tool_use' &&
        ((event.name === 'Read' && event.input?.file_path === `${skills}${target}/SKILL.md`) ||
          (event.name === 'Skill' && event.input?.skill === `celetis:${target}`)),
    );
    const last = replyIndex(reads[1]?.id);
    fail(
      at >= 0 &&
        last >= 0 &&
        startup.every(
          (event, index) => event.owner !== 'assistant' || event.type !== 'text' || index < at || index > last,
        ),
      'text inside reference entry',
    );
  }
  const metadata: { index: number; error: boolean; records: Proof[] }[] = [];
  for (let index = 0; index < events.length; index++) {
    const event = events[index];
    if (!event) continue;
    if (event.type === 'native_metadata') {
      const data = event.metadata ?? {},
        value = record(data.value);
      metadata.push({
        index,
        error: data.deny != null,
        records: [
          {
            path: event.path ?? '',
            kind:
              value.isLink === true
                ? 'symlink'
                : value.isLink === false && value.kind === 'file'
                  ? 'file'
                  : value.isLink === false && value.kind === 'dir'
                    ? 'directory'
                    : /ENOENT$/.test(String(data.deny ?? ''))
                      ? 'missing'
                      : undefined,
          },
        ],
      });
    } else if (event.type === 'tool_result') {
      const call = events
        .slice(0, index)
        .find(
          (call) =>
            call.type === 'tool_use' &&
            call.id === event.tool_use_id &&
            call.name === 'mcp__node_repl__js' &&
            /\blstat\s*\(/.test(call.input?.code ?? ''),
        );
      if (call)
        metadata.push({
          index,
          error: event.is_error === true,
          records: proofs(body(event.content), call.input?.code ?? ''),
        });
    }
  }
  const metadataBefore = (path: string, kind: string, before: number) =>
    metadata.some(
      (item) =>
        item.index < before &&
        (!item.error || kind === 'missing') &&
        item.records.some((record) => record.path === path && record.kind === (kind === 'regular' ? 'file' : kind)),
    );
  const session = rows.find((row) => row.type === 'result')?.session_id;
  const boundBefore = (before: number) => {
    let pending: Flat | undefined, bound: string | undefined;
    for (const event of events.slice(0, before)) {
      if (event.type === 'tool_use' && ['EnterWorktree', 'ExitWorktree'].includes(event.name ?? '')) {
        bound = undefined;
        pending = event.name === 'EnterWorktree' ? event : undefined;
      } else if (event.type === 'tool_result' && pending && pending.id === event.tool_use_id) {
        bound =
          event.is_error !== true &&
          typeof session === 'string' &&
          session.length > 0 &&
          pending.session === session &&
          event.session === session &&
          pending.input?.path?.startsWith('/') &&
          event.nativePath === pending.input.path
            ? pending.input.path
            : undefined;
        pending = undefined;
      }
    }
    return bound === spec.git.path.replace(/\/.git$/, '');
  };
  const rootBefore = (before: number) => boundBefore(before) || metadataBefore(spec.git.path, spec.git.kind, before);
  fail(
    events
      .filter((event) => event.type === 'tool_use' && event.name === 'mcp__node_repl__js')
      .every(
        (event) =>
          !/readFile|readlink|createReadStream|\b(open|read|readv|readdir|opendir|writeFile|appendFile|unlink|rename|mkdir|chmod|chown|copyFile|exec|spawn)\s*\(|child_process|\bprocess\b|\byaml\s*[.]|parseDocument|import\s*\([^)]*yaml/.test(
            event.input?.code ?? '',
          ),
      ),
    'non-metadata native code',
  );
  fail(
    !path ||
      (rootBefore(events.length) &&
        (!['missing', 'symlink'].includes(spec.config.kind) || metadataBefore(path, spec.config.kind, events.length))),
    'metadata for current checkout',
  );
  fail(
    events.every(
      (event, index) =>
        event.type !== 'tool_use' ||
        event.name !== 'Read' ||
        (event.input?.file_path === path
          ? metadataBefore(path, 'file', index) && rootBefore(index)
          : event.input?.file_path?.endsWith('/.git')
            ? metadataBefore(event.input.file_path, 'file', index)
            : true),
    ),
    'metadata before Read',
  );
  const configCalls = events.filter(
    (event) =>
      event.owner === 'assistant' &&
      event.type === 'tool_use' &&
      event.name === 'Read' &&
      event.input?.file_path?.includes('.celetis.yaml'),
  );
  fail(
    configCalls.length === expected &&
      configCalls.every(
        (event) => event.input?.file_path === path && event.input.offset == null && event.input.limit == null,
      ),
    'whole config request count and path',
  );
  if (check.marker !== 'blocked' && expected > 0 && !['missing', 'missing-lane'].includes(name)) {
    const isReply = (event: Flat) =>
      event.owner === 'user' &&
      event.type === 'tool_result' &&
      configCalls.some((call) => call.id === event.tool_use_id);
    fail(
      events.every(
        (event, index) =>
          !isReply(event) ||
          (event.is_error !== true &&
            (whole(event.result, path, spec.config.sha256, spec.config.source, event.native) ||
              (event.result?.type === 'file_unchanged' &&
                event.result.source !== 'seeded' &&
                event.result.file?.filePath === path &&
                events
                  .slice(0, index)
                  .some(
                    (previous) =>
                      isReply(previous) &&
                      previous.is_error !== true &&
                      whole(previous.result, path, spec.config.sha256, spec.config.source, previous.native),
                  )))),
      ),
      'complete config content',
    );
    fail(
      configCalls.every((call) =>
        events.some(
          (reply) =>
            isReply(reply) &&
            reply.tool_use_id === call.id &&
            reply.is_error !== true &&
            ['text', 'file_unchanged'].includes(reply.result?.type ?? ''),
        ),
      ),
      'successful matching config reply',
    );
  }
  const answer = events
    .filter((event) => event.owner === 'assistant' && event.type === 'text')
    .map((event) => event.text ?? '')
    .join('\n');
  let marker = check.marker;
  if (marker === 'blocked') {
    const read = configCalls[0],
      at = events.indexOf(read as Flat),
      permission = (event: Flat) =>
        event.type === 'tool_result' &&
        event.tool_use_id === read?.id &&
        event.is_error === true &&
        /permission|not permitted|access denied|EACCES|EPERM/i.test(body(event.content));
    fail(
      configCalls.length === 1 &&
        typeof read?.id === 'string' &&
        read.id.length > 0 &&
        (rows.some(
          (row) =>
            row.type === 'result' &&
            row.permission_denials?.some(
              (denial) =>
                denial.tool_name === 'Read' && denial.tool_use_id === read.id && denial.tool_input.file_path === path,
            ),
        ) ||
          (read.native === true && events.slice(at + 1).some((event) => event.native === true && permission(event)))) &&
        events.slice(at + 1).some(permission) &&
        events.slice(at + 1).every((event) => event.type !== 'tool_use'),
      'exact denial and no later tool',
    );
    fail(
      /permission|denied|blocked|cannot read|not permitted/i.test(answer) &&
        !answer.includes('scripts/celetis --agent claude next-step'),
      'blocked entry response',
    );
    marker = '';
  } else if (marker === 'invalid') {
    const field = ['malformed', 'ambiguous', 'symlink', 'null-config'].includes(name)
      ? '<document>'
      : name === 'unknown-field'
        ? 'custom.unknown'
        : 'custom.guide';
    const without = answer.replaceAll(path, '');
    const general =
      /invalid|ambiguous|duplicate|symlink|symbolic|malformed|syntax error|not allowed|failed validation|(not|isn.t|aren.t).*(valid|accepted|allowed)/i.test(
        without,
      );
    const folded =
      name === 'folded' &&
      without.toLowerCase().includes("config schema doesn't accept folded blocks") &&
      !/(config|file) is (valid|accepted as-is)|folded blocks are (accepted|allowed)/i.test(without);
    const unknown =
      name === 'unknown-field' &&
      without.toLowerCase().includes("field the schema doesn't allow") &&
      !/(config|file) is (valid|accepted as-is)|custom[.]unknown is (valid|accepted|allowed)|schema (accepts|allows) custom[.]unknown/i.test(
        without,
      );
    fail(
      answer.includes(path) &&
        answer.includes(field) &&
        (general || folded || unknown) &&
        /stop|cannot|can.t|unable|blocked|refus/i.test(answer) &&
        !answer.includes('scripts/celetis --agent claude next-step'),
      'invalid config response',
    );
    marker = '';
  } else if (name !== 'borrowed')
    fail(answer.includes('scripts/celetis --agent claude next-step'), 'host-specific guide advice');
  fail(
    (answer.match(/CUSTOM_(FROM_[A-Z]+|HANDOFF_WRITING|BORROWED_REVIEW|BORROWED_LESSON)/g) ?? []).sort().join('\n') ===
      marker,
    'exact custom markers',
  );
  fail(!/UNRELATED_CUSTOM_MUST_NOT_RUN|SETUP_MUST_NOT_RUN|CUSTOM_FROM_SUBFOLDER/.test(answer), 'unrelated custom data');
  fail(
    !/fatal:|Shell command (failed|permission check failed)/.test(JSON.stringify(rows) + (check.stderr ?? '')) &&
      !check.setupFound,
    'native failure or setup execution',
  );
  fail(
    events.every(
      (event) =>
        event.owner !== 'assistant' ||
        event.type !== 'tool_use' ||
        ['Skill', 'Read', 'Glob', 'Grep', 'EnterWorktree', 'mcp__node_repl__js'].includes(event.name ?? ''),
    ),
    'unexpected tool',
  );
  if (marker === 'CUSTOM_FROM_ROOT') {
    const final = rows
      .filter((row) => row.type === 'result')
      .map((row) => (typeof row.result === 'string' ? row.result : ''))
      .join('\n');
    fail(final.includes('CUSTOM_FROM_ROOT') && !final.includes('UNRELATED_CUSTOM_MUST_NOT_RUN'), 'custom final result');
  }
  if (name === 'enter-worktree') {
    const turns = rows.filter((row) => row.type === 'result'),
      first = rows.findIndex((row) => row.type === 'result'),
      initial = flatten(rows.slice(0, first));
    const calls = initial.filter(
      (event) =>
        event.owner === 'assistant' &&
        event.type === 'tool_use' &&
        event.name === 'EnterWorktree' &&
        event.input?.path === (check.lane ?? check.checkout),
    );
    fail(
      turns.length === 2 &&
        turns.every((row) => row.is_error !== true && row.subtype === 'success') &&
        typeof turns[0]?.session_id === 'string' &&
        turns[0].session_id.length > 0 &&
        new Set(turns.map((row) => row.session_id)).size === 1 &&
        calls.length === 1 &&
        initial.some(
          (event) =>
            event.type === 'tool_result' &&
            event.is_error !== true &&
            calls.some((call) => call.id === event.tool_use_id),
        ) &&
        initial.every(
          (event) =>
            event.owner !== 'assistant' ||
            event.type !== 'tool_use' ||
            (event.name !== 'Skill' && !(event.name === 'Read' && event.input?.file_path?.endsWith('/.celetis.yaml'))),
        ),
      'two-turn native worktree protocol',
    );
  }
  return errors;
}
export async function checkCustomArtifacts(
  directory: string,
  check: CustomCheck,
): Promise<{ code: number; stdout: string }> {
  let status: string;
  try {
    status = (await readFile(join(directory, `${check.name}.status`), 'utf8')).replace(/\n+$/, '');
  } catch {
    return { code: 2, stdout: `ERROR: ${check.name}: missing client exit status\n` };
  }
  if (!/^(0|[1-9][0-9]{0,2})$/.test(status) || Number(status) > 255)
    return { code: 2, stdout: `ERROR: ${check.name}: invalid client exit status\n` };
  if (status !== '0') return { code: 2, stdout: `ERROR: ${check.name}: client exited with status ${status}\n` };
  const rows = (await readFile(join(directory, `${check.name}.jsonl`), 'utf8'))
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line));
  const events = projectEvents(rows);
  await writeFile(
    join(directory, `${check.name}.events.jsonl`),
    `${events.map((event) => JSON.stringify(event)).join('\n')}\n`,
  );
  if (events.some((event) => record(event).type === 'result' && record(event).is_error === true))
    return { code: 2, stdout: `ERROR: ${check.name}: Claude Code could not run the test\n` };
  const spec = JSON.parse(await readFile(join(directory, `${check.name}.input.json`), 'utf8')) as CustomInput;
  const stderr = await readFile(join(directory, `${check.name}.err`), 'utf8');
  const errors = evaluateCustom(spec, events, { ...check, stderr });
  const answer = flatten(events as StreamRow[])
    .filter((event) => event.owner === 'assistant' && event.type === 'text')
    .map((event) => event.text ?? '')
    .join('\n');
  return errors.length
    ? { code: 1, stdout: `FAIL: ${check.name}\n${answer}\n${stderr}` }
    : { code: 0, stdout: `PASS: ${check.name}\n` };
}
