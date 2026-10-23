import { dirname } from 'node:path';

type NativeHandler = ($: NativeTools, input: any, next: any) => any;
export interface NativeOn {
  (event: string, handler: NativeHandler): { catch(handler: NativeHandler): void };
  (event: string, filter: Record<string, unknown>, handler: NativeHandler): { catch(handler: NativeHandler): void };
}
export type Register = (on: NativeOn) => void;
export interface NativeTools {
  plugin: { root: string };
  fs: { stat(path: string): Promise<any> };
  tool: { call(input: any): Promise<any>; check(input: any): Promise<any> };
  skill: { prompt(input: any): Promise<any> };
  session: {
    root(): Promise<string>;
    cwd(): Promise<string>;
    repo(): Promise<any>;
    start(input: any): Promise<any>;
    append(input: any): Promise<any>;
  };
  ui: { log(text: string): void };
  turn: { step(input: any): AsyncGenerator<any, any> };
}

export function nativeHost(plugins: { register: Register; root?: string; name?: string }[]): {
  $: NativeTools;
  on: NativeOn;
} {
  const hooks = new Map<
    string,
    { handler: any; filter?: Record<string, unknown>; caught?: any; root: string; name: string }[]
  >();
  const root = dirname(dirname(import.meta.dir));
  let owner = { root, name: 'celetis' };
  const on: NativeOn = (event: string, ...args: any[]) => {
    const hook = {
      handler: args.at(-1),
      filter: args.length > 1 ? args[0] : undefined,
      ...owner,
      caught: undefined as NativeHandler | undefined,
    };
    const list = hooks.get(event) ?? [];
    list.push(hook);
    hooks.set(event, list);
    return {
      catch(handler) {
        hook.caught = handler;
      },
    };
  };
  const selected = (event: string, input: any) =>
    (hooks.get(event) ?? []).filter(
      (hook) => !hook.filter || Object.entries(hook.filter).every(([key, value]) => input[key] === value),
    );
  const tools = (agentId?: string, pluginRoot = root): NativeTools => {
    const input = (value: any) =>
      agentId !== undefined && value.agentId === undefined ? { ...value, agentId } : value;
    const value = async (event: string, args: any) => {
      const result = await dispatch(event, input(args));
      if (result?.deny !== undefined) throw new Error(`${event}: ${result.deny}`);
      return result?.value;
    };
    return {
      plugin: { root: pluginRoot },
      fs: { stat: (path) => value('fs.stat', { path }) },
      tool: { call: (e) => dispatch('tool.call', input(e)), check: (e) => dispatch('tool.check', input(e)) },
      skill: { prompt: (e) => dispatch('skill.prompt', input(e)) },
      session: {
        root: () => value('session.root', {}),
        cwd: () => value('session.cwd', {}),
        repo: () => value('session.repo', {}),
        start: (e) => dispatch('session.start', input(e)),
        append: (e) => dispatch('session.append', input(e)),
      },
      ui: {
        log(text) {
          void dispatch('ui.log', input({ text }));
        },
      },
      turn: { step: (e) => stream(input(e)) },
    };
  };
  const terminal = (event: string, input: any) => {
    if (event === 'session.append') return input;
    if (event === 'skill.prompt') return { text: input.text ?? '' };
    if (event === 'ui.log') return { value: undefined };
    if (event === 'tool.check') return { decision: 'allow' };
    throw new Error(`No native test handler for ${event}`);
  };
  const dispatch = async (event: string, input: any): Promise<any> => {
    const chain = selected(event, input);
    const run = async (at: number, e: any): Promise<any> => {
      const hook = chain[at];
      if (!hook) return terminal(event, e);
      const next = Object.assign(
        (replacement = e) => {
          next.called = true;
          return run(at + 1, replacement);
        },
        {
          called: false,
          error: undefined as any,
          origin: { plugin: hook.name, tier: 'user' },
        },
      );
      try {
        return await hook.handler(tools(e.agentId, hook.root), e, next);
      } catch (error) {
        if (!hook.caught) throw error;
        next.error = { kind: 'throw', message: error instanceof Error ? error.message : String(error), budget: 1000 };
        return hook.caught(tools(e.agentId, hook.root), e, next);
      }
    };
    return run(0, input);
  };
  async function* stream(input: any): AsyncGenerator<any, any> {
    const chain = selected('turn.step', input);
    async function* run(at: number, e: any): AsyncGenerator<any, any> {
      const hook = chain[at];
      if (!hook) throw new Error('No native test handler for turn.step');
      const next = Object.assign(
        (replacement = e) => {
          next.called = true;
          return run(at + 1, replacement);
        },
        {
          called: false,
          error: undefined as any,
          origin: { plugin: hook.name, tier: 'user' },
        },
      );
      try {
        return yield* hook.handler(tools(e.agentId, hook.root), e, next);
      } catch (error) {
        if (!hook.caught) throw error;
        next.error = { kind: 'throw', message: error instanceof Error ? error.message : String(error), budget: 1000 };
        const result = yield* hook.caught(tools(e.agentId, hook.root), e, next);
        if (result === undefined) throw error;
        return result;
      }
    }
    return yield* run(0, input);
  }
  for (const plugin of plugins) {
    owner = { root: plugin.root ?? root, name: plugin.name ?? 'celetis' };
    plugin.register(on);
  }
  owner = { root, name: 'test' };
  return { $: tools(), on };
}
