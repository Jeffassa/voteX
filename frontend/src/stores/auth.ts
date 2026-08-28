import { create } from "zustand";

/**
 * Store d'authentification — modèle cookie-based.
 *
 * Plus AUCUN token n'est stocké côté client. La session vit dans les cookies
 * httpOnly que le navigateur envoie automatiquement. Le store ne sert qu'à
 * indiquer "est-ce qu'on a tenté un login dans cette tab" pour optimiser
 * l'affichage initial (éviter de flasher la landing avant que /me ne réponde).
 *
 * La source de vérité reste TOUJOURS la réponse serveur /api/auth/me.
 */

interface AuthState {
  /** Hint optimiste — pas une preuve d'auth. */
  hasSessionHint: boolean;
  markLoggedIn: () => void;
  markLoggedOut: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  hasSessionHint: false,
  markLoggedIn: () => set({ hasSessionHint: true }),
  markLoggedOut: () => set({ hasSessionHint: false }),
}));
