export {
	type Deferred,
	deferred,
} from "https://deno.land/std@0.170.0/async/deferred.ts";
export { serveFile } from "https://deno.land/std@0.170.0/http/file_server.ts";
export * as path from "https://deno.land/std@0.170.0/path/mod.ts";

export * as esbuild from "https://deno.land/x/esbuild@v0.16.10/mod.js";

export { default as remapping } from "https://esm.sh/@ampproject/remapping@2.2.0";
export type {
	AdapterRequestContext,
	HattipHandler,
} from "https://esm.sh/@hattip/core@0.0.24/index.d.ts";
export {
	compose,
	type RequestContext,
	type RequestHandler,
} from "https://esm.sh/@hattip/compose@0.0.24";
import * as acorn from "https://esm.sh/acorn@8.8.1";
export { acorn };
export * as lexer from "https://esm.sh/es-module-lexer@1.1.0";
export * as estreeWalker from "https://esm.sh/estree-walker@3.0.1";
export * as estree from "https://esm.sh/@types/estree@1.0.0/index.d.ts";
export { default as MagicString } from "https://esm.sh/magic-string@0.27.0";
export { extract_names as extractNames } from "https://esm.sh/periscopic@3.0.4";
export * as importMaps from "https://deno.land/x/importmap@0.2.1/mod.ts";
