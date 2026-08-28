import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/lib/api";
import type { Election, ElectionResults, ElectionStatus, NonVoter } from "@/types/api";

export const electionKeys = {
  all: ["elections"] as const,
  list: () => [...electionKeys.all, "list"] as const,
  active: () => [...electionKeys.all, "active"] as const,
  detail: (id: string) => [...electionKeys.all, "detail", id] as const,
  results: (id: string) => [...electionKeys.all, "results", id] as const,
  nonVoters: (id: string) => [...electionKeys.all, "non-voters", id] as const,
};

export function useElections() {
  return useQuery<Election[]>({
    queryKey: electionKeys.list(),
    queryFn: async () => (await api.get("/api/elections/")).data,
  });
}

export function useActiveElection() {
  return useQuery<Election | null>({
    queryKey: electionKeys.active(),
    queryFn: async () => {
      const res = await api.get("/api/elections/active");
      return res.status === 204 ? null : res.data;
    },
  });
}

export function useElection(id?: string) {
  return useQuery<Election>({
    queryKey: electionKeys.detail(id || ""),
    queryFn: async () => (await api.get(`/api/elections/${id}`)).data,
    enabled: !!id,
  });
}

export function useElectionResults(id?: string, refetchMs = 5000) {
  return useQuery<ElectionResults>({
    queryKey: electionKeys.results(id || ""),
    queryFn: async () => (await api.get(`/api/elections/${id}/results`)).data,
    enabled: !!id,
    refetchInterval: refetchMs,
  });
}

interface CreateElectionPayload {
  title: string;
  description?: string | null;
  class_id: string;
  starts_at: string;
  ends_at: string;
}

export function useCreateElection() {
  const qc = useQueryClient();
  return useMutation<Election, Error, CreateElectionPayload>({
    mutationFn: async (payload) =>
      (await api.post("/api/elections/", payload)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: electionKeys.all });
    },
  });
}

interface UpdateElectionPayload {
  id: string;
  patch: Partial<CreateElectionPayload>;
}

export function useUpdateElection() {
  const qc = useQueryClient();
  return useMutation<Election, Error, UpdateElectionPayload>({
    mutationFn: async ({ id, patch }) =>
      (await api.patch(`/api/elections/${id}`, patch)).data,
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: electionKeys.all });
      qc.invalidateQueries({ queryKey: electionKeys.detail(vars.id) });
    },
  });
}

export function useDeleteElection() {
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: async (id) => {
      await api.delete(`/api/elections/${id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: electionKeys.all });
    },
  });
}

export function useSetElectionStatus() {
  const qc = useQueryClient();
  return useMutation<Election, Error, { id: string; status: Extract<ElectionStatus, "open" | "closed"> }>({
    mutationFn: async ({ id, status }) =>
      (await api.post(`/api/elections/${id}/${status === "open" ? "open" : "close"}`)).data,
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: electionKeys.all });
      qc.invalidateQueries({ queryKey: electionKeys.detail(vars.id) });
    },
  });
}

export function useNonVoters(id?: string, enabled = true) {
  return useQuery<NonVoter[]>({
    queryKey: electionKeys.nonVoters(id || ""),
    queryFn: async () => (await api.get(`/api/elections/${id}/non-voters`)).data,
    enabled: !!id && enabled,
    refetchInterval: enabled ? 10_000 : false,
  });
}

