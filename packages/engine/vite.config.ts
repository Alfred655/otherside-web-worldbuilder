import { defineConfig } from "vite";

export default defineConfig({
  server: {
    port: 3000,
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
          proxy.on("proxyRes", (proxyRes, req) => {
            console.log(`[vite-proxy] ← ${proxyRes.statusCode} ${req.url}`);
          });
        },
      },
    },
  },
});
