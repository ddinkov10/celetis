// yaml 2.9.1: the declarations of only the calls that ../config.ts makes.
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
