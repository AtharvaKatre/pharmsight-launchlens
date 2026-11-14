import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// In development the Vite server proxies /api to the FastAPI backend, so the browser
// only ever talks to one origin and the backend needs no CORS configuration.
const apiTarget = process.env.PHARMSIGHT_API_URL ?? "http://localhost:8000";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: { "/api": { target: apiTarget, changeOrigin: true } },
  },
  preview: {
    proxy: { "/api": { target: apiTarget, changeOrigin: true } },
  },
  build: {
    rollupOptions: {
      output: {
        // Keep the large charting library and React in their own long-cacheable chunks.
        manualChunks: {
          react: ["react", "react-dom", "react-router-dom"],
          charts: ["recharts"],
        },
      },
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
    css: false,
  },
});
