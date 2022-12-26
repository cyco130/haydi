import { path } from "../../deps.ts";
import { HaydiPlugin } from "../types.ts";

export interface FileLoaderOptions {
  root: string;
}

export function fileLoader(options: FileLoaderOptions): HaydiPlugin {
  const { root } = options;

  return {
    name: "file-loader",

    async resolve(ctx) {
      if (ctx.specifier[0] !== "/") return undefined;

      try {
        const p = path.join(root, ctx.specifier);
        const stat = await Deno.stat(p);
        if (stat.isFile) {
          return {
            url: path.toFileUrl(p),
          };
        }
      } catch (error) {
        if (error instanceof Deno.errors.NotFound) {
          return undefined;
        }

        throw error;
      }
    },

    async load(ctx) {
      if (ctx.url.protocol !== "file:") return undefined;

      try {
        const code = await Deno.readTextFile(ctx.url);
        const ext = path.extname(ctx.url.pathname);
        const type = extentionToTypeMap[ext];

        if (type) {
          return { code, type };
        }

        return undefined;
      } catch (error) {
        if (error instanceof Deno.errors.NotFound) {
          return undefined;
        }

        throw error;
      }
    },
  };
}

const extentionToTypeMap: Record<string, string | undefined> = {
  ".js": "application/javascript",
  ".ts": "application/typescript",
};
