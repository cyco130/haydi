import { HaydiPlugin } from "../types.ts";

export function netLoader(): HaydiPlugin {
	return {
		name: "haydi:net-loader",

		async load(ctx) {
			if (ctx.url.protocol !== "https:") {
				return;
			}

			console.log("Downloading", ctx.url.href);
			const response = await fetch(ctx.url.href, { redirect: "follow" });
			return {
				code: await response.text(),
				type: response.headers.get("content-type") ?? "application/javascript",
			};
		},
	};
}
