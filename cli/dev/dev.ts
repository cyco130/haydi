import { AdapterRequestContext, compose, MagicString } from "../deps.ts";
import { createStaticServer } from "./middleware/static.ts";
import { createTransformMiddleware } from "./middleware/transform.ts";
import { PluginContainer } from "./plugin-container.ts";
import { esbuildTransform } from "./plugins/esbuild.ts";
import { fileLoader } from "./plugins/file-loader.ts";

startDevServer();

interface DevServerConfig {
  root?: string;
  port?: number;
  sourceMap?: boolean;
}

async function startDevServer(config: DevServerConfig = {}) {
  const {
    root = Deno.cwd(),
    port = 5173,
  } = config;

  const container = new PluginContainer([
    fileLoader({ root }),
    esbuildTransform(),
    {
      name: "haydi:meh",
      transform(ctx) {
        if (ctx.type === "application/javascript") {
          const ms = new MagicString(ctx.code, { filename: ctx.url.pathname });

          const toBeMoved = `console.log("After");\n`;
          const start = ctx.code.indexOf(toBeMoved);
          const end = start + toBeMoved.length;
          ms.move(start, end, 0);

          const map = ms.generateMap();

          map.sources = [ctx.url.pathname];
          map.sourcesContent = [ctx.code];

          return {
            code: ms.toString(),
            type: "application/javascript",
            map,
          };
        }
      },
    },
  ], "serve");

  const hattipHandler = compose([
    createStaticServer({ root }),
    createTransformMiddleware({ container }),
  ]);

  const listener = Deno.listen({ port });

  for await (const conn of listener) {
    handleConnection(conn);
  }

  async function handleConnection(conn: Deno.Conn) {
    const httpConn = Deno.serveHttp(conn);
    for await (const requestEvent of httpConn) {
      const { request, respondWith } = requestEvent;
      const response = await handleRequest(request, conn);
      respondWith(response);
    }
  }

  function handleRequest(request: Request, connection: Deno.Conn) {
    const context: AdapterRequestContext = {
      request,
      ip: (connection.remoteAddr as Deno.NetAddr).hostname ?? "127.0.0.1",
      waitUntil() {
        // No op
      },
      passThrough() {
        // No op
      },
      platform: { connection },
    };

    return hattipHandler(context);
  }
}
