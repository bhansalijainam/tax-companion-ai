import { defineConfig, loadEnv, type Plugin, type ViteDevServer } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import type { IncomingMessage, ServerResponse } from "http";

/**
 * Serves server/handlers.ts at /api/* during `npm run dev`, mirroring the Vercel
 * functions in api/. Keeps the API key server-side in local development too.
 */
function apiDevServer(): Plugin {
  return {
    name: "tax-companion-api",
    configureServer(server: ViteDevServer) {
      server.middlewares.use(async (req: IncomingMessage, res: ServerResponse, next) => {
        if (!req.url?.startsWith("/api/")) return next();
        try {
          const handlers = await server.ssrLoadModule("/server/handlers.ts");
          const chunks: Buffer[] = [];
          for await (const chunk of req) chunks.push(chunk as Buffer);
          const request = new Request(new URL(req.url, "http://localhost"), {
            method: req.method,
            headers: req.headers as Record<string, string>,
            body: req.method === "GET" || req.method === "HEAD" ? undefined : Buffer.concat(chunks),
          });
          const route = req.url.split("?")[0];
          const response: Response =
            route === "/api/health" ? await handlers.handleHealth()
            : route === "/api/extract" && req.method === "POST" ? await handlers.handleExtract(request)
            : route === "/api/chat" && req.method === "POST" ? await handlers.handleChat(request)
            : new Response(JSON.stringify({ error: "Not found" }), { status: 404 });
          res.statusCode = response.status;
          response.headers.forEach((v, k) => res.setHeader(k, v));
          res.end(Buffer.from(await response.arrayBuffer()));
        } catch (err) {
          server.config.logger.error(String(err));
          res.statusCode = 500;
          res.end(JSON.stringify({ error: "Internal error" }));
        }
      });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Expose non-VITE_ variables (ANTHROPIC_API_KEY, LLM_MODEL, ...) to the dev API only.
  // They are never bundled into client code.
  Object.assign(process.env, loadEnv(mode, process.cwd(), ""));
  return {
    server: {
      host: "localhost", // dev server only on loopback (vite dev-server advisories); use --host to expose
      port: 8080,
      hmr: { overlay: false },
    },
    plugins: [react(), apiDevServer()],
    build: {
      // Vite 8 bundles with Rolldown: object-form `manualChunks` is unsupported, so the
      // vendor split is expressed as code-splitting groups. Each group matches the listed
      // packages and (by default) pulls in their dependencies; higher priority wins.
      rolldownOptions: {
        output: {
          codeSplitting: {
            groups: [
              { name: "react", priority: 30, test: /[\\/]node_modules[\\/](react|react-dom|react-router-dom)[\\/]/ },
              {
                name: "ui",
                priority: 20,
                test: /[\\/]node_modules[\\/](@radix-ui[\\/]react-(dialog|select|collapsible|switch)|lucide-react|sonner)[\\/]/,
              },
              { name: "markdown", priority: 10, test: /[\\/]node_modules[\\/](react-markdown|remark-gfm)[\\/]/ },
            ],
          },
        },
      },
    },
    resolve: {
      alias: {
        "@": path.resolve(import.meta.dirname, "./src"),
      },
    },
  };
});
