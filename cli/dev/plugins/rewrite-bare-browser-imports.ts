import { lexer, MagicString } from "../../deps.ts";
import { HaydiPlugin } from "../types.ts";

export function rewriteBareBrowserImports(): HaydiPlugin {
	return {
		name: "haydi:rewrite-bare-browser-imports",

		platform: "browser",

		async transform(ctx) {
			if (ctx.type !== "application/javascript") {
				return;
			}

			await lexer.init;
			const [imports] = lexer.parse(ctx.code, ctx.url.pathname);

			const ms = new MagicString(ctx.code);

			for (const decl of imports) {
				if (!decl.n) {
					console.warn(
						`Cannot analyze import ${
							ctx.code.slice(decl.s, decl.e)
						} in ${ctx.url.href}`,
					);
				}

				const s = decl.n as string;
				if (s[0] === "." || s[0] === "/") {
					continue;
				}

				const resolved = await ctx.container.resolve(
					s,
					ctx.url,
					"browser",
				);

				if (!resolved) {
					continue;
				}

				ms.overwrite(
					decl.s,
					decl.e,
					JSON.stringify(resolved.url.href).slice(1, -1),
				);
			}

			return {
				code: ms.toString(),
				type: "application/javascript",
				map: ms.generateMap(),
			};
		},
	};
}

interface Locatable {
	start: number;
	end: number;
}
