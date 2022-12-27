import { path, RequestHandler } from "../../deps.ts";
import { PluginContainer } from "../plugin-container.ts";

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

		const module = await options.container.loadServerModule(
			path.toFileUrl(serverModule),
		);

		const { requestHandler } = module as { requestHandler?: RequestHandler };
		if (typeof requestHandler !== "function") {
			console.warn("No request handler exported from server.ts");
			return;
		}

		return requestHandler(ctx);
	};
}
