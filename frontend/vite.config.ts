/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    css: false,
  },
  server: {
    host: true,
    port: 5173,
    strictPort: true,
    // ⚠️ Ne JAMAIS mettre `allowedHosts: true` — bug Vite 5.4.21 qui rend le
    // serveur inopérant (timeout sur toutes les requêtes). Lister explicitement.
    allowedHosts: [
      "localhost",
      "127.0.0.1",
      ".ngrok-free.app",
      ".ngrok.io",
      ".ngrok.app",
      ".ngrok-free.dev",
    ],
    watch: { usePolling: true, interval: 200 },
    proxy: {
      "/api": {
        target: "http://backend:8000",
        changeOrigin: true,
        cookieDomainRewrite: "",
      },
    },
  },
});
