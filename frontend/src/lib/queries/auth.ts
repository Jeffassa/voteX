import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, onLogout as registerLogoutCallback } from "@/lib/api";
import { useAuthStore } from "@/stores/auth";
import type { Me } from "@/types/api";

export const authKeys = {
  me: ["auth", "me"] as const,
  sessions: ["auth", "sessions"] as const,
};

export function useMe(enabled = true) {
  return useQuery<Me>({
    queryKey: authKeys.me,
    queryFn: async () => (await api.get("/api/auth/me")).data,
    enabled,
    staleTime: 60_000,
    retry: false,
  });
}

interface LoginInput {
  matricule: string;
  password: string;
}

interface LoginResponse {
  role: "student" | "admin" | "super_admin";
  user_id: string;
}

export function useLogin() {
  const markLoggedIn = useAuthStore((s) => s.markLoggedIn);
  const queryClient = useQueryClient();

  return useMutation<LoginResponse, Error, LoginInput>({
    mutationFn: async ({ matricule, password }) => {
      const form = new URLSearchParams();
      form.append("username", matricule);
      form.append("password", password);
      const { data } = await api.post<LoginResponse>("/api/auth/login", form, {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      });
      return data;
    },
    onSuccess: () => {
      markLoggedIn();
      queryClient.invalidateQueries({ queryKey: authKeys.me });
    },
  });
}

export function useLogout() {
  const markLoggedOut = useAuthStore((s) => s.markLoggedOut);
  const queryClient = useQueryClient();

  return async () => {
    try {
      await api.post("/api/auth/logout");
    } catch {
      // best-effort
    }
    markLoggedOut();
    queryClient.clear();
  };
}

// Branche le store sur les déconnexions forcées par l'interceptor api
registerLogoutCallback(() => {
  useAuthStore.getState().markLoggedOut();
});

export function useRequestPasswordReset() {
  return useMutation<void, Error, { email: string }>({
    mutationFn: async ({ email }) => {
      await api.post("/api/auth/password-reset/request", { email });
    },
  });
}

export function useConfirmPasswordReset() {
  return useMutation<void, Error, { token: string; new_password: string }>({
    mutationFn: async ({ token, new_password }) => {
      await api.post("/api/auth/password-reset/confirm", { token, new_password });
    },
  });
}

export interface SessionInfo {
  id: string;
  jti: string;
  user_agent: string | null;
  ip_address: string | null;
  created_at: string | null;
  expires_at: string | null;
}

export function useSessions() {
  return useQuery<SessionInfo[]>({
    queryKey: authKeys.sessions,
    queryFn: async () => (await api.get("/api/auth/sessions")).data,
  });
}

export function useRevokeAllSessions() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, void>({
    mutationFn: async () => {
      await api.post("/api/auth/sessions/revoke-all");
    },
    onSuccess: () => {
      queryClient.clear();
      if (typeof window !== "undefined") window.location.href = "/login";
    },
  });
}
