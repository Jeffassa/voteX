import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";

import { api } from "@/lib/api";
import { electionKeys } from "@/lib/queries/elections";
import type { VoteReceipt, VoteVerification } from "@/types/api";

export const voteKeys = {
  mine: ["votes", "mine"] as const,
  verify: (hash: string) => ["votes", "verify", hash] as const,
};

export function useMyVotes() {
  return useQuery<VoteReceipt[]>({
    queryKey: voteKeys.mine,
    queryFn: async () => (await api.get("/api/votes/me")).data,
  });
}

interface CastVotePayload {
  election_id: string;
  candidate_id: string | null;
}

/**
 * Jeton de reçu par scrutin, tiré avant le premier envoi et renvoyé à chaque
 * nouvel essai : si la réponse d'un vote enregistré s'est perdue (réseau
 * coupé, délai dépassé), le serveur redonne le même reçu au lieu de « déjà
 * voté ». En mémoire seulement : écrit dans le stockage du navigateur, il
 * survivrait à la session sur une machine partagée. Effacé au reçu.
 */
const receiptKeys = new Map<string, string>();

function receiptKeyFor(electionId: string): string {
  let key = receiptKeys.get(electionId);
  if (!key) {
    const bytes = crypto.getRandomValues(new Uint8Array(24));
    key = btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    receiptKeys.set(electionId, key);
  }
  return key;
}

/** Délais avant les nouveaux essais automatiques, après une erreur réseau ou serveur. */
const RETRY_DELAYS_MS = [1000, 3000];

export async function castVote(payload: CastVotePayload): Promise<VoteReceipt> {
  const body = { ...payload, receipt_key: receiptKeyFor(payload.election_id) };
  for (let attempt = 0; ; attempt++) {
    try {
      const { data } = await api.post<VoteReceipt>("/api/votes/", body);
      receiptKeys.delete(payload.election_id);
      return data;
    } catch (err) {
      // Sans réponse (réseau, délai) ou erreur du serveur : le vote est peut-être
      // passé, le même jeton le dira. Une réponse 4xx, elle, est définitive.
      const status = axios.isAxiosError(err) ? err.response?.status : undefined;
      const transient = axios.isAxiosError(err) && (status === undefined || status >= 500);
      if (!transient || attempt >= RETRY_DELAYS_MS.length) throw err;
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAYS_MS[attempt]));
    }
  }
}

export function useCastVote() {
  const qc = useQueryClient();
  return useMutation<VoteReceipt, Error, CastVotePayload>({
    mutationFn: castVote,
    onSuccess: (data) => {
      // Le reçu N'EST PAS persisté : rapproché du choix affiché à l'écran, il
      // le désignerait. L'écrire dans localStorage laissait le secret du vote
      // sur la machine — souvent une machine partagée de salle info — à la
      // portée d'un XSS, d'une extension ou de l'utilisateur suivant. Aucun
      // écran ne le relisait : la copie ne servait qu'à fuiter.
      qc.invalidateQueries({ queryKey: voteKeys.mine });
      qc.invalidateQueries({ queryKey: electionKeys.results(data.election_id) });
    },
  });
}

export async function verifyVoteHash(hash: string): Promise<VoteVerification> {
  return (await api.get(`/api/votes/verify/${hash}`)).data;
}
