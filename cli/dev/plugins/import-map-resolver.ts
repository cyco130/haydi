import { importMaps } from "../../deps.ts";
import { HaydiPlugin } from "../types.ts";

export interface ImportMapResolverOptions {
	serverMap?: importMaps.ImportMap;
	browserMap?: importMaps.ImportMap;
}

export function importMapResolver(
	options: ImportMapResolverOptions,
): HaydiPlugin {
	const { serverMap, browserMap } = options;

	return {
		name: "haydi:import-map-resolver",

		resolve(ctx) {
			const map = ctx.platform === "server" ? serverMap : browserMap;
			if (!map || !ctx.parent) {
				return;
			}

			const resolvedImportMap = importMaps.resolveImportMap(
				map,
				ctx.parent,
			);

			const resolvedModuleSpecifier = importMaps.resolveModuleSpecifier(
				ctx.specifier,
				resolvedImportMap,
				ctx.parent,
			);

			return {
				url: new URL(resolvedModuleSpecifier),
			};
		},
	};
}
