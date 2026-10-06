import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "react-hot-toast";

import App from "./App";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { HERO_POSTER, loadBallotBoxScene, wantsHero3d } from "./components/three/heroScene";
// Polices servies par l'application, sous-ensemble latin uniquement. Google
// Fonts bloquait le premier rendu (feuille de style externe) et transmettait
// l'adresse IP de chaque visiteur à un tiers, sans consentement.
import "@fontsource-variable/geist";
import "@fontsource-variable/geist-mono";
// Serif des titres et des chiffres ; l'italique sert aux slogans des candidats.
import "@fontsource-variable/newsreader";
import "@fontsource-variable/newsreader/wght-italic.css";
import "./index.css";

// Accueil : l'image de l'urne et la 3D partent dès maintenant, en même temps
// que le code de la page, au lieu d'attendre qu'elle s'affiche (trois
// téléchargements en cascade retardaient l'urne de plusieurs secondes).
if (window.location.pathname === "/") {
  const preload = document.createElement("link");
  preload.rel = "preload";
  preload.as = "image";
  preload.href = HERO_POSTER.src;
  preload.setAttribute("imagesrcset", HERO_POSTER.srcSet);
  preload.setAttribute("imagesizes", HERO_POSTER.sizes);
  preload.setAttribute("fetchpriority", "high");
  document.head.append(preload);
  if (wantsHero3d()) void loadBallotBoxScene();
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 30,
      refetchOnWindowFocus: false,
      retry: (failureCount, error: any) => {
        // Pas de retry sur 4xx (erreurs métier — auth, validation, etc.)
        const status = error?.response?.status;
        if (status && status >= 400 && status < 500) return false;
        return failureCount < 2;
      },
    },
  },
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <App />
          <Toaster position="top-right" />
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
