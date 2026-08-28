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
      if (data && data.election_id) {
        try {
          localStorage.setItem(`vote_receipt_${data.election_id}`, JSON.stringify(data));
        } catch {
          // Fallback silencieux si localStorage indisponible
        }
      }
      qc.invalidateQueries({ queryKey: voteKeys.mine });
      qc.invalidateQueries({ queryKey: electionKeys.results(data.election_id) });
    },
  });
}

export async function verifyVoteHash(hash: string): Promise<VoteVerification> {
  return (await api.get(`/api/votes/verify/${hash}`)).data;
}
