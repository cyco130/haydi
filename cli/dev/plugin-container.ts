import { remapping } from "../deps.ts";
import type {
  HaydiPlugin,
  LoadResult,
  ResolveResult,
  SourceMap,
  TransformResult,
} from "./types.ts";

export class PluginContainer {
  #plugins: HaydiPlugin[];
  #command: "build" | "serve";

  constructor(plugins: HaydiPlugin[], command: "build" | "serve") {
    this.#plugins = plugins.filter((p) =>
      !p.command || p.command === command || p.command === "either"
    );
    this.#command = command;
  }

  async resolve(
    specifier: string,
    parent: URL | undefined,
    platform: "browser" | "server",
  ): Promise<ResolveResult | undefined> {
    for (const plugin of this.#plugins) {
      if (
        plugin.platform && plugin.platform !== platform &&
        plugin.platform !== "either"
      ) {
        continue;
      }

      if (plugin.resolve) {
        const result = await plugin.resolve({
          specifier,
          parent,
          command: this.#command,
          platform,
        });
        if (result) {
          return result;
        }
      }
    }

    return undefined;
  }

  async load(
    url: URL,
    type: string | undefined,
    platform: "browser" | "server",
  ): Promise<LoadResult> {
    for (const plugin of this.#plugins) {
      if (
        plugin.platform && plugin.platform !== platform &&
        plugin.platform !== "either"
      ) {
        continue;
      }

      if (plugin.load) {
        const result = await plugin.load({
          url,
          type,
          command: this.#command,
          platform,
        });
        if (result) {
          return result;
        }
      }
    }

    throw new Error(`No loader found for ${url}`);
  }

  async loadAndTransform(
    url: URL,
    type: string | undefined,
    platform: "browser" | "server",
  ): Promise<TransformResult> {
    const loaded: TransformResult = await this.load(
      url,
      type,
      platform,
    );

    const maps: SourceMap[] = [];

    for (const plugin of this.#plugins) {
      if (
        plugin.platform && plugin.platform !== platform &&
        plugin.platform !== "either"
      ) {
        continue;
      }

      if (plugin.transform) {
        const result = await plugin.transform({
          url,
          type: loaded.type,
          code: loaded.code,
          command: this.#command,
          platform,
        });

        if (result) {
          loaded.code = result.code;
          loaded.type = result.type ?? loaded.type;

          if (result.map) {
            maps.unshift(result.map);
          }
        }
      }
    }

    // deno-lint-ignore no-explicit-any
    const map = remapping(maps as any[], () => null);
    loaded.map = map as SourceMap;

    return loaded;
  }
}
