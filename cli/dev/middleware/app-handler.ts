import { path, RequestHandler, serveFile } from "../../deps.ts";
import { PluginContainer } from "../plugin-container.ts";
import {
	DYNAMIC_IMPORT_KEY,
	EXPORT_ALL_KEY,
	IMPORT_KEY,
	IMPORT_META_KEY,
	MODULE_EXPORTS_KEY,
} from "../plugins/module-to-function-body.ts";

export interface AppHandlerOptions {
	root: string;
	container: PluginContainer;
}

export function createAppHandler(options: AppHandlerOptions): RequestHandler {
	return async function appHandler(ctx) {
		let stat: Deno.FileInfo;
		const serverModule = path.resolve(options.root, "server.ts");

		try {
			stat = await Deno.stat(serverModule);
		} catch (error) {
			if (error instanceof Deno.errors.NotFound) {
				return;
			}

			throw error;
		}

		if (!stat.isFile) {
			return;
		}

		const module = await options.container.loadAndTransform(
			path.toFileUrl(serverModule),
			"application/javascript",
			"server",
		);

		const fn = new AsyncFunction(
			MODULE_EXPORTS_KEY,
			IMPORT_KEY,
			DYNAMIC_IMPORT_KEY,
			EXPORT_ALL_KEY,
			IMPORT_META_KEY,
			`"use strict";` + module.code,
		);

		const exports: any = {};

		await fn(exports, (...args: unknown[]) => {
			console.log("IMPORT_KEY", args);
		});

		return exports.requestHandler(ctx);
	};
}

async function fn() {}
const AsyncFunction = Object.getPrototypeOf(fn).constructor as typeof Function;
