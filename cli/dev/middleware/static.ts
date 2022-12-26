import { path, RequestHandler, serveFile } from "../../deps.ts";

export interface ServeStaticOptions {
  root?: string;
}

export function createStaticServer(
  options: ServeStaticOptions = {},
): RequestHandler {
  const root = options?.root ? path.resolve(options?.root) : Deno.cwd();

  return async function staticServer(ctx) {
    const p = path.join(root, "public", ctx.url.pathname);

    const stat = await tryStat(p);
    if (!stat) return;

    if (stat.isFile) {
      return serveFile(ctx.request, p, { fileInfo: stat });
    } else if (stat.isDirectory) {
      const index = path.join(p, "index.html");
      const indexStat = await tryStat(index);
      if (indexStat && indexStat.isFile) {
        return serveFile(ctx.request, index, { fileInfo: indexStat });
      }
    }
  };
}

async function tryStat(path: string) {
  try {
    return await Deno.stat(path);
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      return null;
    }

    throw error;
  }
}
