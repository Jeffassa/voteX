import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

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

export function useCastVote() {
  const qc = useQueryClient();
  return useMutation<VoteReceipt, Error, CastVotePayload>({
    mutationFn: async (payload) =>
      (await api.post("/api/votes/", payload)).data,
    onSuccess: (data) => {
      // Le reçu N'EST PAS persisté : il contient `candidate_id`, donc le choix
      // de l'électeur. L'écrire dans localStorage laissait le secret du vote
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
