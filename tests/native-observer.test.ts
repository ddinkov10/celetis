import { test as bunTest, describe, expect } from 'bun:test';
import { type NativeOn, type NativeTools, nativeHost, type Register } from './lib/native-host.ts';

const observerModules = {
  source: new URL('./manual/native-observer/hooks/register.ts', import.meta.url),
  generated: new URL('./manual/native-observer/hooks/register.js', import.meta.url),
};
for (const delivery of ['source', 'generated'] as const)
  describe(delivery, () => {
    let register: Register;
    type Body = ($: NativeTools, on: NativeOn) => Promise<void>;
    function nativeTest(name: string, run: Body): void;
    function nativeTest(name: string, options: { plugins: { register: Register }[] }, run: Body): void;
    function nativeTest(name: string, options: any, run?: Body) {
      bunTest(name, async () => {
        const module = await import(observerModules[delivery].href);
        register = module.register;
        const { $, on } = nativeHost([
          { register, root: new URL('./manual/native-observer/', import.meta.url).pathname.replace(/\/$/, '') },
          ...(run ? options.plugins : []),
        ]);
        await (run ?? options)($, on);
      });
    }

    const filePath = decodeURIComponent(
      new URL('./manual/native-observer/project/.celetis.yaml', import.meta.url).pathname,
    );
    const metadataClient = {
      name: 'metadata-client',
      register(on: any) {
        on('skill.prompt', async ($: any, e: any) => {
          try {
            await $.fs.stat(e.path);
            return { text: 'No rejection' };
          } catch (error) {
            return { text: String(error) };
          }
        });
      },
    };

    nativeTest('compact observation hashes content and preserves the actual result', async ($, on) => {
      const content = 'x'.repeat(9000);
      const result = {
        result: { type: 'text', file: { filePath, content, startLine: 1, numLines: 1, totalLines: 1 } },
        text: content,
        context: [content],
      };
      const logs: any[] = [];
      on('tool.call', () => result);
      on('ui.log', (_$, e) => {
        logs.push(JSON.parse(e.text));
        return { value: undefined };
      });
      const actual = await $.tool.call({ tool: 'Read', file_path: filePath });
      const observed = logs.find((row) => row.event === 'tool.result').result;
      expect(actual).toEqual(result);
      expect(observed.result.file.content).toBeUndefined();
      expect(observed.result.file.contentSha256).toBe(
        'e797e2af6f05c24cdd064793ce60a9d01302d9a3b0e5dff5bb0c046b87f2f668',
      );
      expect(observed.result.file.totalLines).toBe(1);
      expect(JSON.stringify(observed).length < 1000).toBe(true);
    });

    nativeTest('native error observation retains exact permission text', async ($, on) => {
      const result = {
        result: 'Native permission failure',
        text: '<tool_use_error>exact denied path</tool_use_error>',
        isError: true,
      };
      const logs: any[] = [];
      on('tool.call', () => result);
      on('ui.log', (_$, e) => {
        logs.push(JSON.parse(e.text));
        return { value: undefined };
      });
      expect(await $.tool.call({ tool: 'Read', file_path: filePath })).toEqual(result);
      expect(logs.find((row) => row.event === 'tool.result').result).toEqual(result);
    });

    for (const code of ['ENOENT', 'EACCES']) {
      nativeTest(
        `metadata observation preserves native ${code} rejection`,
        { plugins: [metadataClient] },
        async ($, on) => {
          const logs: any[] = [];
          const path = `${filePath}.${code}`;
          on('fs.stat', () => ({ deny: code }));
          on('ui.log', (_$, e) => {
            logs.push(JSON.parse(e.text));
            return { value: undefined };
          });
          const failure = await $.skill.prompt({
            skill: 'metadata-client:probe',
            path,
            source: 'plugin',
            pluginName: 'metadata-client',
            text: '',
            frontmatter: {},
          });
          expect(failure.text.endsWith(code)).toBe(true);
          const call = logs.find((row) => row.event === 'fs.stat.start');
          const result = logs.find((row) => row.event === 'fs.stat.result');
          expect(result).toBeDefined();
          expect(result.id).toBe(call.id);
          expect(result.input).toEqual(call.input);
          expect(result.origin).toEqual(call.origin);
          expect(result.input.path).toBe(path);
          expect(result.result.deny).toBe(code);
          expect(result.result.deny.endsWith(code)).toBe(true);
        },
      );

      nativeTest(`thrown metadata ${code} is logged and rethrown unchanged`, async () => {
        const handlers: any = {};
        register((event: string, ...args: any[]) => {
          handlers[event] = args[args.length - 1];
          return { catch() {} };
        });
        const logs: any[] = [];
        const $ = {
          plugin: { root: '/fixture/observer' },
          ui: {
            log(text: string) {
              logs.push(JSON.parse(text));
            },
          },
        };
        const error = new Error(`fs.stat: ${code}`);
        const next = Object.assign(
          async () => {
            throw error;
          },
          { origin: { plugin: 'celetis', tier: 'user' } },
        );
        let failure;
        try {
          await handlers['fs.stat']($, { path: '/fixture/project/.celetis.yaml' }, next);
        } catch (caught) {
          failure = caught;
        }
        expect(failure).toBe(error);
        expect(logs).toHaveLength(2);
        expect(logs[1].input).toEqual(logs[0].input);
        expect(logs[1].origin).toEqual(next.origin);
        expect(logs[1].id).toBe(logs[0].id);
        expect(logs[1].result).toEqual({ deny: String(error) });
      });
    }
  });
