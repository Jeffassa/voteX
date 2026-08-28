import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/lib/api";
import { authKeys } from "@/lib/queries/auth";
import type { ImportReport, Me, StudentBrief, UserRole } from "@/types/api";

export interface AdminStudent extends StudentBrief {
  email: string;
  role: UserRole;
  class_id: string | null;
  is_active: boolean;
  created_at: string;
}

export const studentKeys = {
  all: ["students"] as const,
  list: (filters: { class_id?: string; search?: string }) =>
    [...studentKeys.all, "list", filters] as const,
  detail: (id: string) => [...studentKeys.all, "detail", id] as const,
};

interface ListFilters {
  class_id?: string;
  search?: string;
  enabled?: boolean;
}

export function useStudents({ class_id, search, enabled = true }: ListFilters = {}) {
  return useQuery<AdminStudent[]>({
    queryKey: studentKeys.list({ class_id, search }),
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (class_id) params.class_id = class_id;
      if (search) params.search = search;
      return (await api.get("/api/students/", { params })).data;
    },
    enabled,
  });
}

interface RegisterPayload {
  matricule: string;
  first_name: string;
  last_name: string;
  email: string;
  password: string;
  class_id?: string;
}

export function useCreateStudent() {
  const qc = useQueryClient();
  return useMutation<AdminStudent, Error, RegisterPayload>({
    mutationFn: async (payload) => (await api.post("/api/auth/register", payload)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: studentKeys.all });
    },
  });
}

interface UpdateStudentPayload {
  id: string;
  patch: {
    first_name?: string;
    last_name?: string;
    email?: string;
    class_id?: string | null;
    photo_url?: string | null;
    is_active?: boolean;
  };
}

export function useUpdateStudent() {
  const qc = useQueryClient();
  return useMutation<AdminStudent, Error, UpdateStudentPayload>({
    mutationFn: async ({ id, patch }) =>
      (await api.patch(`/api/students/${id}`, patch)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: studentKeys.all });
    },
  });
}

export function useDeleteStudent() {
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: async (id) => {
      await api.delete(`/api/students/${id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: studentKeys.all });
    },
  });
}

export function useChangeRole() {
  const qc = useQueryClient();
  return useMutation<AdminStudent, Error, { id: string; role: UserRole }>({
    mutationFn: async ({ id, role }) =>
      (await api.post(`/api/students/${id}/role`, { role })).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: studentKeys.all });
    },
  });
}

interface SelfUpdatePayload {
  first_name?: string;
  last_name?: string;
  email?: string;
  matricule?: string;
  photo_url?: string;
}

export function useUpdateMyProfile() {
  const qc = useQueryClient();
  return useMutation<Me, Error, SelfUpdatePayload>({
    mutationFn: async (payload) =>
      (await api.patch("/api/students/me/profile", payload)).data,
    onSuccess: (data) => {
      qc.setQueryData(authKeys.me, data);
    },
  });
}

export function useChangePassword() {
  return useMutation<void, Error, { old_password: string; new_password: string }>({
    mutationFn: async ({ old_password, new_password }) => {
      await api.post("/api/auth/me/change-password", {
        token: old_password,
        new_password,
      });
    },
  });
}

interface ImportPayload {
  file: File;
  dryRun: boolean;
  autoCreateClasses?: boolean;
  defaultLevel?: string;
}

export function useImportStudents() {
  const qc = useQueryClient();
  return useMutation<ImportReport, Error, ImportPayload>({
    mutationFn: async ({ file, dryRun, autoCreateClasses, defaultLevel }) => {
      const form = new FormData();
      form.append("file", file);
      const params = new URLSearchParams({ dry_run: String(dryRun) });
      if (autoCreateClasses) {
        params.set("auto_create_classes", "true");
        if (defaultLevel) params.set("default_level", defaultLevel);
      }
      const { data } = await api.post<ImportReport>(
        `/api/students/import?${params.toString()}`,
        form,
        { headers: { "Content-Type": "multipart/form-data" } }
      );
      return data;
    },
    onSuccess: (_, vars) => {
      if (!vars.dryRun) {
        qc.invalidateQueries({ queryKey: studentKeys.all });
        // Aussi invalider classes si on a peut-être créé des classes auto
        if (vars.autoCreateClasses) {
          qc.invalidateQueries({ queryKey: ["classes"] });
        }
      }
    },
  });
}
