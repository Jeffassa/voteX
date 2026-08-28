import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/lib/api";
import type { AdminDashboard, ClassRoom } from "@/types/api";

export const adminKeys = {
  dashboard: ["admin", "dashboard"] as const,
  audit: (limit: number) => ["admin", "audit", limit] as const,
  pendingStudents: ["admin", "pending-students"] as const,
};

export interface AuditEvent {
  id: string;
  actor_id: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  details: string | null;
  ip_address: string | null;
  created_at: string;
}

export function useAuditLog(limit = 100) {
  return useQuery<AuditEvent[]>({
    queryKey: adminKeys.audit(limit),
    queryFn: async () => (await api.get(`/api/admin/audit?limit=${limit}`)).data,
    refetchInterval: 30_000,
  });
}

export const classKeys = {
  all: ["classes"] as const,
};

export function useAdminDashboard() {
  return useQuery<AdminDashboard>({
    queryKey: adminKeys.dashboard,
    queryFn: async () => (await api.get("/api/admin/dashboard")).data,
  });
}

export function useClasses() {
  return useQuery<ClassRoom[]>({
    queryKey: classKeys.all,
    queryFn: async () => (await api.get("/api/classes/")).data,
  });
}

interface CreateClassPayload {
  name: string;
  level: string;
  field: string;
}

export function useCreateClass() {
  const qc = useQueryClient();
  return useMutation<ClassRoom, Error, CreateClassPayload>({
    mutationFn: async (payload) => (await api.post("/api/classes/", payload)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: classKeys.all }),
  });
}

export function useUpdateClass() {
  const qc = useQueryClient();
  return useMutation<ClassRoom, Error, { id: string; patch: Partial<CreateClassPayload> }>({
    mutationFn: async ({ id, patch }) => (await api.patch(`/api/classes/${id}`, patch)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: classKeys.all }),
  });
}

export function useDeleteClass() {
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: async (id) => {
      await api.delete(`/api/classes/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: classKeys.all }),
  });
}

export function usePendingStudents() {
  return useQuery<any[]>({
    queryKey: adminKeys.pendingStudents,
    queryFn: async () => (await api.get("/api/admin/pending-students")).data,
  });
}

export function useActivateStudent() {
  const qc = useQueryClient();
  return useMutation<any, Error, string>({
    mutationFn: async (id) => (await api.patch(`/api/admin/activate-student/${id}`)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: adminKeys.pendingStudents });
      qc.invalidateQueries({ queryKey: ["students"] });
    },
  });
}
