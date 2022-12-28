import { acorn, estree, estreeWalker, MagicString } from "../../deps.ts";
import { HaydiPlugin } from "../types.ts";

export function rewriteBareBrowserImports(): HaydiPlugin {
	return {
		name: "haydi:rewrite-bare-browser-imports",

		platform: "browser",

		async transform(ctx) {
			if (ctx.type !== "application/javascript") {
				return;
			}

			const ast = acorn.parse(ctx.code, {
				sourceType: "module",
				ecmaVersion: "latest",
				locations: true,
				allowHashBang: true,
			});

			const ms = new MagicString(ctx.code);
			const importDeclarations: (estree.ImportDeclaration)[] = [];

			estreeWalker.walk(ast, {
				enter(node: estree.BaseNode) {
					if (node.type === "ImportDeclaration") {
						importDeclarations.push(
							node as estree.ImportDeclaration,
						);
					}
				},
			});

			for (const decl of importDeclarations) {
				const source = decl.source as typeof decl.source & Locatable;
				const s = source.value as string;
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
					source.start,
					source.end,
					JSON.stringify(resolved.url.href),
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
