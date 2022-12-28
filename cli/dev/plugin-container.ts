import { deferred, remapping } from "../deps.ts";
import {
	DYNAMIC_IMPORT_KEY,
	EXPORT_ALL_KEY,
	IMPORT_KEY,
	IMPORT_META_KEY,
	MODULE_EXPORTS_KEY,
} from "./plugins/module-to-function-body.ts";
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
	#serverModules: Map<string, ServerModule> = new Map();
	#pendingServerModules: Map<string, Promise<ServerModule>> = new Map();

	constructor(plugins: HaydiPlugin[], command: "build" | "serve") {
		this.#plugins = plugins.filter(
			(p) => !p.command || p.command === command || p.command === "either",
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
				plugin.platform &&
				plugin.platform !== platform &&
				plugin.platform !== "either"
			) {
				continue;
			}

			if (plugin.resolve) {
				const result = await plugin.resolve({
					container: this,
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

		if (specifier[0] === "." && parent?.protocol === "file:") {
			return { url: new URL(specifier, parent) };
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
				plugin.platform &&
				plugin.platform !== platform &&
				plugin.platform !== "either"
			) {
				continue;
			}

			if (plugin.load) {
				const result = await plugin.load({
					container: this,
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
		const loaded: TransformResult = await this.load(url, type, platform);

		const maps: SourceMap[] = [];

		for (const plugin of this.#plugins) {
			if (
				plugin.platform &&
				plugin.platform !== platform &&
				plugin.platform !== "either"
			) {
				continue;
			}

			if (plugin.transform) {
				const result = await plugin.transform({
					container: this,
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

	async loadServerModule(url: URL) {
		const urlCopy = new URL(url);
		urlCopy.searchParams.delete("_v");
		const key = urlCopy.toString();
		const existing = this.#serverModules.get(key);
		if (existing) {
			return existing.evalResult;
		}

		if (this.#pendingServerModules.has(key)) {
			return (await this.#pendingServerModules.get(key)!).evalResult;
		}

		const deferredModule = deferred<ServerModule>();
		this.#pendingServerModules.set(key, deferredModule);

		const loaded = await this.loadAndTransform(
			new URL(key),
			"application/javascript",
			"server",
		);

		const fn = new AsyncFunction(
			MODULE_EXPORTS_KEY,
			IMPORT_KEY,
			DYNAMIC_IMPORT_KEY,
			EXPORT_ALL_KEY,
			IMPORT_META_KEY,
			`"use strict";` + loaded.code,
		);

		let exports: unknown = {};

		const importServerModule = async (specifier: string) => {
			const resolved = await this.resolve(
				specifier,
				new URL(key),
				"server",
			);

			if (!resolved) {
				throw new Error(`Could not resolve ${specifier} from ${key}`);
			}

			return this.loadServerModule(resolved.url);
		};

		await fn(
			// MODULE_EXPORTS
			exports,
			// IMPORT
			importServerModule,
			// DYNAMIC_IMPORT
			importServerModule,
			// EXPORT_ALL
			(all: unknown) => {
				exports = all;
			},
		);

		const module: ServerModule = {
			url: key,
			files: new Set(),
			loadResult: loaded,
			evalResult: exports,
		};

		this.#serverModules.set(key, module);
		this.#pendingServerModules.delete(key);
		deferredModule.resolve(module);

		return module.evalResult;
	}
}

const AsyncFunction = Object.getPrototypeOf(async function () {})
	.constructor as typeof Function;

export interface ServerModule {
	url: string;
	files: Set<string>;
	loadResult: TransformResult;
	evalResult: unknown;
}
