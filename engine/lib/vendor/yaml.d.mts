export interface Alias {
  source: string;
}

export interface Scalar {
  tag?: string;
  type?: "BLOCK_FOLDED" | "BLOCK_LITERAL" | "PLAIN" | "QUOTE_DOUBLE" | "QUOTE_SINGLE";
  source?: string;
  value: unknown;
}

export interface Pair {
  key: unknown;
  value: unknown;
}

export interface YAMLMap {
  tag?: string;
  items: Pair[];
}

export interface YAMLSeq {
  tag?: string;
  items: unknown[];
}

export interface ScalarTag {
  tag: string;
  default?: boolean | "key";
  collection?: never;
  test?: RegExp;
}

export interface CollectionTag {
  tag: string;
  default?: boolean | "key";
  collection: "map" | "seq";
  test?: never;
}

export interface Document {
  contents: unknown;
  directives: { docStart: true | null };
  errors: Error[];
  range: [number, number, number];
  schema: { tags: Array<CollectionTag | ScalarTag> };
  toJS(): unknown;
}

export interface ParseOptions {
  uniqueKeys?: boolean;
}

export interface SchemaOptions {
  schema?: "core";
  merge?: boolean;
  customTags?: "timestamp"[];
}

export declare function parseAllDocuments(source: string, options?: ParseOptions & SchemaOptions): Document[];
export declare function isAlias(node: unknown): node is Alias;
export declare function isMap(node: unknown): node is YAMLMap;
export declare function isScalar(node: unknown): node is Scalar;
export declare function isSeq(node: unknown): node is YAMLSeq;

export interface SourceToken {
  type: "byte-order-mark" | "doc-mode" | "doc-start" | "space" | "comment" | "newline" |
    "directive-line" | "anchor" | "tag" | "seq-item-ind" | "explicit-key-ind" | "map-value-ind" |
    "flow-map-start" | "flow-map-end" | "flow-seq-start" | "flow-seq-end" | "flow-error-end" |
    "comma" | "block-scalar-header";
  source: string;
  offset: number;
  indent: number;
}
export interface CollectionItem {
  start: SourceToken[];
  key?: Token | null;
  sep?: SourceToken[];
  value?: Token;
}
export type Token =
  | SourceToken
  | { type: "document"; offset: number; start: SourceToken[]; value?: Token; end?: SourceToken[] }
  | { type: "block-map" | "block-seq"; offset: number; indent: number; items: CollectionItem[] }
  | { type: "flow-collection"; offset: number; indent: number; start: SourceToken; items: CollectionItem[]; end: SourceToken[] }
  | { type: "block-scalar"; offset: number; indent: number; props: Token[]; source: string }
  | { type: "alias" | "scalar" | "single-quoted-scalar" | "double-quoted-scalar"; offset: number; indent: number; source: string; end?: SourceToken[] }
  | { type: "doc-end"; offset: number; source: string; end?: SourceToken[] }
  | { type: "error" | "directive"; offset: number; source: string };
export declare class Parser {
  parse(source: string): Generator<Token, void>;
}
export declare namespace CST {
  function resolveAsScalar(token: Token | null | undefined): { value: string } | null;
  function setScalarValue(token: Token, value: string, options?: { type?: "QUOTE_DOUBLE" }): void;
  function stringify(token: Token): string;
}
