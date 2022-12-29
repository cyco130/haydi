import { RequestHandler } from "../../deps.ts";
import { PluginContainer } from "../plugin-container.ts";

export interface TransformOptions {
	container: PluginContainer;
}

export function createTransformMiddleware(
	options: TransformOptions,
): RequestHandler {
	const { container } = options;

	return async function transformMiddleware(ctx) {
		const referer = ctx.request.headers.get("referer");
		const resolved = await container.resolve(
			"/src" + ctx.url.pathname,
			referer ? new URL(referer) : undefined,
			"browser",
		);

		if (resolved) {
			const loaded = await container.loadAndTransform(
				resolved.url,
				resolved.type,
				"browser",
			);

			if (!loaded) {
				return;
			}

			let { code, map } = loaded;

			if (map) {
				code += `\n//# sourceMappingURL=data:application/json;base64,${
					btoa(
						JSON.stringify(map),
					)
				}`;
			}

			return new Response(code, {
				headers: { "content-type": loaded.type },
			});
		}
	};
}
