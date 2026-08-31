import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const apiPort = process.env.BOOKKIN_API_PORT ?? "8080";
const apiProxyTarget = process.env.BOOKKIN_API_PROXY_TARGET ?? `http://127.0.0.1:${apiPort}`;

export default defineConfig({
  build: {
    outDir: "dist/client",
  },
  optimizeDeps: {
    include: ["react", "react-dom/client", "@mui/material", "@tanstack/react-query"],
  },
  server: {
    host: "0.0.0.0",
    port: 4173,
    strictPort: true,
    allowedHosts: ["terminal.local", "localhost", "127.0.0.1", "johns-MacBook-Air.local"],
    proxy: {
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
    environment: "jsdom",
    globals: true,
    include: ["src/**/*.test.{ts,tsx}"],
    setupFiles: ["./src/test/setup.ts"],
    css: true,
    maxWorkers: 2,
    testTimeout: 15_000,
  },
});
