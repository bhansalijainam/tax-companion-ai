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
          const workspace = await server.ssrLoadModule("/server/workspace.ts");
          const chunks: Buffer[] = [];
          for await (const chunk of req) chunks.push(chunk as Buffer);
          // Real host + port, so Better Auth's origin checks match the browser
          const request = new Request(new URL(req.url, `http://${req.headers.host ?? "localhost"}`), {
            method: req.method,
            headers: req.headers as Record<string, string>,
            body: req.method === "GET" || req.method === "HEAD" ? undefined : Buffer.concat(chunks),
          });
          const route = req.url.split("?")[0];
          const response: Response =
            route === "/api/health" ? await handlers.handleHealth()
            : route === "/api/extract" && req.method === "POST" ? await handlers.handleExtract(request)
            : route === "/api/chat" && req.method === "POST" ? await handlers.handleChat(request)
            : (await workspace.routeWorkspace(request)) ?? new Response(JSON.stringify({ error: "Not found" }), { status: 404 });
          res.statusCode = response.status;
          response.headers.forEach((v, k) => { if (k !== "set-cookie") res.setHeader(k, v); });
          const cookies = response.headers.getSetCookie();
          if (cookies.length) res.setHeader("set-cookie", cookies);
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
      rollupOptions: {
        output: {
          manualChunks: {
            react: ["react", "react-dom", "react-router-dom"],
            ui: ["@radix-ui/react-dialog", "@radix-ui/react-select", "@radix-ui/react-collapsible", "@radix-ui/react-switch", "lucide-react", "sonner"],
            markdown: ["react-markdown", "remark-gfm"],
          },
        },
      },
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
