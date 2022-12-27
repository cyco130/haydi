import { esbuild } from "../../deps.ts";
import { HaydiPlugin } from "../types.ts";

export function esbuildTransform(): HaydiPlugin {
	return {
		name: "haydi:esbuild",

		async transform(ctx) {
			if (ctx.type === "application/typescript") {
				const result = await esbuild.transform(ctx.code, {
					loader: "ts",
					target: "esnext",
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
