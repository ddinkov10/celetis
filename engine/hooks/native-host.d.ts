export interface Metadata {
  kind: 'file' | 'dir' | string;
  isLink?: boolean;
  size?: number;
  mtimeMs?: number;
}

declare global {
  const crypto: {
    randomUUID(): string;
    subtle: { digest(algorithm: string, data: Uint8Array): Promise<ArrayBuffer> };
  };
  class TextEncoder {
    encode(input?: string): Uint8Array;
  }
}
export interface NativeFailure {
  kind: string;
  message?: string;
  budget: number;
}
export interface NativeFile {
  filePath?: string;
  content?: string;
  startLine?: number;
  numLines?: number;
  totalLines?: number;
  truncatedByTokenCap?: boolean;
  contentSha256?: string;
}
export interface FileResult {
  type: string;
  source?: string;
  file?: NativeFile;
}
export interface ToolReply {
  result?: FileResult | string;
  text?: string;
  deny?: string;
  isError?: boolean;
  context?: string[];
}
export interface ReadInput {
  tool: string;
  file_path: string;
  tool_use_id?: string;
  agentId?: string;
  offset?: number;
  limit?: number;
}
export interface ToolInput {
  tool: string;
  tool_use_id: string;
  agentId?: string;
  file_path?: string;
  offset?: number;
  limit?: number;
}
export interface TextBlock {
  type: 'text';
  text: string;
}
export interface OtherBlock {
  type: 'tool_use' | 'tool_result';
  id?: string;
}
export interface Delivery {
  door: string;
  origin: { kind: string; tool?: string };
  uuid: string;
  agentId?: string;
  message: { type: string; role: string; isMeta?: boolean; content: (TextBlock | OtherBlock)[] };
}
export interface SkillInput {
  skill: string;
  path?: string;
  source: string;
  pluginName: string;
  text?: string;
  frontmatter?: Record<string, unknown>;
  agentId?: string;
}
export interface TurnInput {
  turnId: string;
  index: number;
  model?: string;
  messageCount?: number;
  agentId?: string;
}
export type TurnChunk =
  | { kind: 'text'; index: number; text: string }
  | { kind: 'stop'; stopReason: string; usage: null };
export interface TurnResult {
  turnId: string;
  index: number;
  answer: string;
  toolUses: unknown[];
  stopReason: string;
  usage: null;
}
export interface Events {
  'skill.prompt': { input: SkillInput; output: { text: string } };
  'session.append': { input: Delivery; output: Delivery };
  'tool.call': { input: ToolInput; output: ToolReply };
  'tool.check': {
    input: { tool: string; tool_use_id?: string; input: { file_path: string } };
    output: { decision: string; reason?: string; rule?: string };
  };
  'fs.stat': { input: { path: string }; output: { value?: Metadata; deny?: string } };
  'turn.step': { input: TurnInput; output: TurnResult };
}
export type EventName = keyof Events;
export interface Next<K extends EventName> {
  (
    input: Events[K]['input'],
  ): K extends 'turn.step' ? AsyncGenerator<TurnChunk, TurnResult | undefined> : Promise<Events[K]['output']>;
  called: boolean;
  error: NativeFailure;
  origin: { plugin: string; tier: string };
}
export type Handler<K extends EventName> = (
  $: NativeTools,
  input: Events[K]['input'],
  next: Next<K>,
) => K extends 'turn.step'
  ? AsyncGenerator<TurnChunk, TurnResult | undefined>
  : Events[K]['output'] | Promise<Events[K]['output']>;
export interface NativeOn {
  <K extends EventName>(name: K, handler: Handler<K>): { catch(handler: Handler<K>): void };
  <K extends EventName>(
    name: K,
    filter: Partial<Events[K]['input']>,
    handler: Handler<K>,
  ): { catch(handler: Handler<K>): void };
}
export type Register = (on: NativeOn) => void;
export interface NativeTools {
  plugin: { root: string };
  fs: { stat(path: string): Promise<Metadata> };
  tool: { call(input: ReadInput): Promise<ToolReply> };
  session: { root(): Promise<string>; cwd(): Promise<string>; id(): Promise<string> };
  ui: { log(text: string): void };
}
