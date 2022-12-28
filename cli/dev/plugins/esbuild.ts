import { esbuild } from "../../deps.ts";
import { HaydiPlugin } from "../types.ts";

export function esbuildTransform(): HaydiPlugin {
	return {
		name: "haydi:esbuild",

		async transform(ctx) {
			const loaders: Record<string, esbuild.Loader | undefined> = {
				"application/typescript": "ts",
				"text/jsx": "jsx",
				"text/tsx": "tsx",
			};

			const loader = loaders[ctx.type];

			if (loader) {
				const result = await esbuild.transform(ctx.code, {
					loader,
					target: "es2022",
					supported: { "import-assertions": false },
					sourcefile: ctx.url.pathname,
					sourcemap: true,
				});

				return {
					code: result.code,
					type: "application/javascript",
					map: JSON.parse(result.map),
				};
			}
		},
	};
}
