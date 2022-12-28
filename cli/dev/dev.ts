import { AdapterRequestContext, compose, importMaps, path } from "../deps.ts";
import { createAppHandler } from "./middleware/app-handler.ts";
import { createStaticServer } from "./middleware/static.ts";
import { createTransformMiddleware } from "./middleware/transform.ts";
import { PluginContainer } from "./plugin-container.ts";
import { esbuildTransform } from "./plugins/esbuild.ts";
import { fileLoader } from "./plugins/file-loader.ts";
import { importMapResolver } from "./plugins/import-map-resolver.ts";
import { createModuleToFunctionBodyTransform } from "./plugins/module-to-function-body.ts";
import { netLoader } from "./plugins/net-loader.ts";
import { rewriteBareBrowserImports } from "./plugins/rewrite-bare-browser-imports.ts";

startDevServer();

interface DevServerConfig {
	root?: string;
	port?: number;
	sourceMap?: boolean;
}

async function startDevServer(config: DevServerConfig = {}) {
	const { root = Deno.cwd(), port = 5173 } = config;

	const container = new PluginContainer(
		[
			fileLoader({ root }),
			esbuildTransform(),
			createModuleToFunctionBodyTransform(),
			importMapResolver({
				serverMap: await loadImportMap(
					path.resolve(root, "import-map.server.json"),
				),
				browserMap: await loadImportMap(
					path.resolve(root, "import-map.browser.json"),
				),
			}),
			netLoader(),
			rewriteBareBrowserImports(),
		],
		"serve",
	);

	const hattipHandler = compose([
		createStaticServer({ root }),
		createTransformMiddleware({ container }),
		createAppHandler({ root, container }),
	]);

	const listener = Deno.listen({ port });
	console.log(`Listening on http://localhost:${port}`);

	for await (const conn of listener) {
		handleConnection(conn);
	}

	async function handleConnection(conn: Deno.Conn) {
		const httpConn = Deno.serveHttp(conn);
		for await (const requestEvent of httpConn) {
			const { request, respondWith } = requestEvent;
			const response = await handleRequest(request, conn);
			respondWith(response);
		}
	}

	function handleRequest(request: Request, connection: Deno.Conn) {
		const context: AdapterRequestContext = {
			request,
			ip: (connection.remoteAddr as Deno.NetAddr).hostname ?? "127.0.0.1",
			waitUntil() {
				// No op
			},
			passThrough() {
				// No op
			},
			platform: { connection },
		};

		return hattipHandler(context);
	}
}

async function loadImportMap(
	name: string,
): Promise<importMaps.ImportMap | undefined> {
	try {
		const file = await Deno.readTextFile(name);
		return JSON.parse(file);
	} catch (error) {
		if (error instanceof Deno.errors.NotFound) {
			return undefined;
		}

		throw error;
	}
}
