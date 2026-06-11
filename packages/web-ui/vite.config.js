import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
    plugins: [react()],
    server: {
        port: 5173,
        proxy: {
            "/api": {
                target: "http://localhost:8080",
                changeOrigin: true,
                // Required for SSE streaming — don't buffer the response
                configure: (proxy) => {
                    proxy.on("proxyRes", (proxyRes) => {
                        if (proxyRes.headers["content-type"]?.includes("text/event-stream")) {
                            // Disable buffering/compression for SSE
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
});
//# sourceMappingURL=vite.config.js.map