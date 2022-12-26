export interface HaydiPlugin {
  name: string;

  command?: "build" | "serve" | "either";
  platform?: "browser" | "server" | "either";

  resolve?(ctx: ResolveContext): Awaitable<ResolveResult | undefined>;
  load?(ctx: LoadContext): Awaitable<LoadResult | undefined>;
  transform?(ctx: TransformContext): Awaitable<TransformResult | undefined>;
}

export type Awaitable<T> = T | Promise<T>;

export interface PluginContext {
  command: "build" | "serve";
  platform: "browser" | "server";
}

export interface ResolveContext extends PluginContext {
  specifier: string;
  parent?: URL;
}

export interface ResolveResult {
  url: URL;
  type?: string;
}

export interface LoadContext extends PluginContext {
  url: URL;
  type?: string;
}

export interface LoadResult {
  code: string;
  type: string;
}

export interface TransformContext extends PluginContext {
  url: URL;
  type: string;
  code: string;
}

export interface TransformResult {
  code: string;
  map?: SourceMap;
  type: string;
}

export interface SourceMap {
  file?: string | null;
  names: string[];
  mappings: string;
  sourceRoot?: string;
  sources: (string | null)[];
  sourcesContent?: (string | null)[];
  version: number;
}
