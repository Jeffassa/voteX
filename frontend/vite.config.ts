/// <reference types="vitest" />
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

import { seoFiles } from "./seo.config";

// `import.meta.dirname` plutôt que `__dirname` : Vite 8 avertit que le
// chargeur natif de configuration, appelé à devenir le défaut, ne fournit pas
// les variables CommonJS.
const projectRoot = import.meta.dirname;

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, projectRoot, "VITE_");

  // L'API est un service distinct, sur sa propre origine : un build de
  // production doit dire où la trouver. Sans cette garde, le client retombait
  // en silence sur http://localhost:8000 — un site publié qui n'appelait
  // aucune API, ou pire, celle du poste de l'utilisateur.
  if (command === "build" && mode === "production" && !env.VITE_API_URL) {
    throw new Error(
      "VITE_API_URL est requis pour un build de production (ex. https://api.smartvote.esatic.ci)."
    );
  }

  return {
  plugins: [react(), seoFiles(env.VITE_SITE_URL)],
  build: {
    // Bibliothèques stables regroupées : leur empreinte change rarement, le
    // navigateur les garde en cache d'un déploiement à l'autre.
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (!id.includes("node_modules")) return undefined;
          if (/[\\/]node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/.test(id)) return "react";
          if (/[\\/]node_modules[\\/](@tanstack|axios|zustand)[\\/]/.test(id)) return "data";
          return undefined;
        },
      },
    },
  },
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
      // Nom du service dans le réseau Docker : c'est par là que la sonde
      // blackbox interroge le frontend. Sans cette entrée, Vite répond 403
      // (protection anti-DNS-rebinding) et l'alerte FrontendDown tire en
      // permanence — une supervision qui crie au loup ne sert plus à rien.
      "smartvote-frontend",
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
};
});
