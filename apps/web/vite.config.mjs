import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

const apiPort = process.env.SILVAE_API_PORT ?? "8080";
const apiProxyTarget = process.env.SILVAE_API_PROXY_TARGET ?? `http://127.0.0.1:${apiPort}`;

export default defineConfig({
  resolve: {
    alias: {
      "@": resolve(import.meta.dirname, "src"),
    },
  },
  build: {
    outDir: "dist/client",
    chunkSizeWarningLimit: 700,
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: "vendor-three", test: /node_modules\/.*\/three\// },
            { name: "vendor-editor", test: /node_modules\/.*\/(@tiptap|prosemirror-)/ },
            { name: "vendor-antv-g", test: /node_modules\/.*\/(@antv\/(g|g-[^/]+|util)|gl-matrix)\// },
            { name: "vendor-graph-layout", test: /node_modules\/.*\/(@antv\/(layout|algorithm|graphlib)|d3-[^/]+)\// },
            { name: "vendor-g6", test: /node_modules\/.*\/(@antv\/g6|@ant-design\/graphs)\// },
          ],
        },
      },
    },
  },
  optimizeDeps: {
    include: ["react", "react-dom/client", "@tanstack/react-query", "antd", "@ant-design/icons"],
  },
  server: {
    host: "0.0.0.0",
    port: Number(process.env.SILVAE_WEB_PORT || 4173),
    strictPort: true,
    allowedHosts: ["terminal.local", "localhost", "127.0.0.1", "johns-MacBook-Air.local"],
    proxy: {
      "/robots.txt": {target: apiProxyTarget, changeOrigin: true},
      "/api": {
        target: apiProxyTarget,
        changeOrigin: true,
      },
    },
    warmup: {
      clientFiles: ["./src/main.tsx"],
    },
  },
  plugins: [react()],
  test: {
    env: {
      VITE_DEMO_MODE: "true",
    },
    execArgv: process.allowedNodeEnvironmentFlags.has("--no-experimental-webstorage")
      ? ["--no-experimental-webstorage"]
      : [],
    environment: "jsdom",
    globals: true,
    include: ["src/**/*.test.{ts,tsx}"],
    setupFiles: ["./src/test/setup.ts"],
    css: true,
    maxWorkers: 2,
    testTimeout: 30_000,
  },
});
