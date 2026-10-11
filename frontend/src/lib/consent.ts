import { create } from "zustand";

import { api } from "@/lib/api";

/**
 * Consentement à la mesure d'audience.
 *
 * Le choix n'est PAS conservé côté navigateur : ni stockage local, ni cookie
 * lisible par le script (voir src/test/no-browser-storage.test.ts). Le serveur
 * le dépose dans un cookie httpOnly `sv_consent` et le relit sur
 * `GET /api/consent`. Il refuse d'ailleurs de compter une mesure sans ce
 * cookie : le respect du refus ne dépend pas de ce seul fichier.
 *
 * `analytics === null` : le visiteur n'a pas encore répondu → bannière.
 */
interface ConsentState {
  analytics: boolean | null;
  loaded: boolean;
  /** Bannière rouverte volontairement (lien « Gérer les cookies »). */
  reopened: boolean;
  load: () => Promise<void>;
  choose: (analytics: boolean) => Promise<void>;
  reopen: () => void;
}

export const useConsentStore = create<ConsentState>((set) => ({
  analytics: null,
  loaded: false,
  reopened: false,
  load: async () => {
    try {
      const { data } = await api.get<{ analytics: boolean | null }>("/api/consent");
      set({ analytics: data.analytics, loaded: true });
    } catch {
      // API injoignable : on n'affiche rien et on ne mesure rien.
      set({ analytics: false, loaded: false });
    }
  },
  choose: async (analytics) => {
    if (!analytics) {
      // Un refus vaut tout de suite, même si l'enregistrement échoue : il ne
      // doit jamais être contredit par une mesure.
      set({ analytics: false, reopened: false });
      await api.put("/api/consent", { analytics: false }).catch(() => undefined);
      return;
    }
    // Un accord, lui, n'active la mesure qu'une fois le cookie posé : le serveur
    // ignore toute mesure arrivée sans lui, et la première page vue partait
    // avant la réponse.
    set({ reopened: false });
    try {
      await api.put("/api/consent", { analytics: true });
      set({ analytics: true });
    } catch {
      set({ analytics: null }); // la bannière reviendra à la prochaine visite
    }
  },
  reopen: () => set({ reopened: true }),
}));

export function analyticsAllowed(): boolean {
  return useConsentStore.getState().analytics === true;
}
