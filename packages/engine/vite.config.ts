import { defineConfig } from "vite";
import path from "path";

export default defineConfig({
  server: {
    port: 3000,
    fs: {
      // Allow serving files from the project root (for assets/ directory)
      allow: [path.resolve(__dirname, "../..")],
    },
    proxy: {
      "/api": {
        target: "http://127.0.0.1:3001",
        changeOrigin: true,
        timeout: 0, // no timeout on incoming socket
        configure: (proxy) => {
          proxy.on("error", (err, _req, res) => {
            console.error("[vite-proxy] error:", err.message);
            if ("writeHead" in res && typeof res.writeHead === "function") {
              try {
                (res as any).writeHead(502, { "Content-Type": "application/json" });
                (res as any).end(JSON.stringify({ error: `Proxy error: ${err.message}` }));
              } catch {
                // response already sent
              }
            }
          });
          proxy.on("proxyReq", (_proxyReq, req) => {
            console.log(`[vite-proxy] → ${req.method} ${req.url}`);
          });
          proxy.on("proxyRes", (proxyRes, req, res) => {
            console.log(`[vite-proxy] ← ${proxyRes.statusCode} ${req.url}`);
            // Flush headers immediately for SSE so events stream through the proxy
            if (proxyRes.headers["content-type"]?.includes("text/event-stream")) {
              (res as any).flushHeaders?.();
            }
          });
        },
      },
    },
  },
});
