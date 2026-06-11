import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

const monorepoRoot = resolve(__dirname, "../..");

export default defineConfig(() => {
  return {
    plugins: [react()],
    // Load VITE_* vars from monorepo root .env (single source of truth across api-server + web-ui)
    envDir: monorepoRoot,
    server: {
      port: 5173,
      proxy: {
        "/api": {
          target: "http://localhost:8080",
          changeOrigin: true,
          configure: (proxy) => {
            proxy.on("proxyRes", (proxyRes) => {
              if (proxyRes.headers["content-type"]?.includes("text/event-stream")) {
                proxyRes.headers["cache-control"] = "no-cache";
                proxyRes.headers["x-accel-buffering"] = "no";
              }
            });
          },
        },
      },
    },
    build: {
      outDir: "dist",
      sourcemap: true,
    },
  };
});
