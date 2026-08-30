/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

// `import.meta.dirname` plutôt que `__dirname` : Vite 8 avertit que le
// chargeur natif de configuration, appelé à devenir le défaut, ne fournit pas
// les variables CommonJS.
const projectRoot = import.meta.dirname;

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(projectRoot, "src"),
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    css: false,
    // Le pool "forks" (défaut de Vitest 4) n'arrive pas à démarrer ses workers
    // sur cette machine : « Timeout waiting for worker to respond ».
    pool: "threads",
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
