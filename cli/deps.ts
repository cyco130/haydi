export { serveFile } from "https://deno.land/std@0.170.0/http/file_server.ts";
export * as path from "https://deno.land/std@0.170.0/path/mod.ts";

export * as esbuild from "https://deno.land/x/esbuild@v0.16.10/mod.js";
export { default as MagicString } from "https://deno.land/x/magic_string@v1.0.0/mod.ts";

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
