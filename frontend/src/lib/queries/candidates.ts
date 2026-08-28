import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/lib/api";
import type { Candidate } from "@/types/api";

export const candidateKeys = {
  all: ["candidates"] as const,
  byElection: (electionId: string) => [...candidateKeys.all, "election", electionId] as const,
  detail: (id: string) => [...candidateKeys.all, "detail", id] as const,
};

export function useCandidates(electionId?: string) {
  return useQuery<Candidate[]>({
    queryKey: candidateKeys.byElection(electionId || ""),
    queryFn: async () =>
      (await api.get(`/api/candidates/election/${electionId}`)).data,
    enabled: !!electionId,
  });
}

interface CreateCandidatePayload {
  election_id: string;
  student_id: string;
  slogan?: string | null;
  program?: string | null;
  biography?: string | null;
  photo_url?: string | null;
}

export function useCreateCandidate() {
  const qc = useQueryClient();
  return useMutation<Candidate, Error, CreateCandidatePayload>({
    mutationFn: async (payload) =>
      (await api.post("/api/candidates/", payload)).data,
    onSuccess: (data) => {
      qc.invalidateQueries({
        queryKey: candidateKeys.byElection(data.election_id),
      });
    },
  });
}
