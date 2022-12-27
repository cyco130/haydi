import type { RequestContext } from "../../cli/deps.ts";
import { message } from "./mod.ts";

export function requestHandler(ctx: RequestContext): Response {
	console.log(ctx.method, ctx.url.href);
	return new Response(message);
}
