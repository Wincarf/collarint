"use client";

// Cliente HTTP tipado da aplicação

import type {
  AdminStats,
  CoachMessageDTO,
  MatchResult,
  MentorshipDTO,
  NotificationDTO,
  ProfileDTO,
  TaskDTO,
} from "@/lib/types";

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const token = readToken();
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      // Fallback de sessão para ambientes que bloqueiam cookies (preview em iframe)
      ...(token ? { "x-session-token": token } : {}),
      ...(options?.headers ?? {}),
    },
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || "Erro de conexão. Tente novamente.");
  }
  return data as T;
}

// Token de sessão: guardado junto do cookie httpOnly para que o login continue
// funcionando mesmo quando o navegador recusa cookies de terceiros no iframe.
const TOKEN_KEY = "jci_session_token";

function readToken(): string | null {
  try {
    return window.localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function saveToken(token: string): void {
  try {
    window.localStorage.setItem(TOKEN_KEY, token);
  } catch {
    // localStorage indisponível — o cookie segue como mecanismo principal
  }
}

function clearToken(): void {
  try {
    window.localStorage.removeItem(TOKEN_KEY);
  } catch {
    // ignora
  }
}

export const api = {
  me: () => request<{ user: ProfileDTO | null }>("/api/auth/me"),

  login: async (email: string, password: string) => {
    const data = await request<{ ok: boolean; onboarded: boolean; isAdmin: boolean; token?: string }>(
      "/api/auth/login",
      {
        method: "POST",
        body: JSON.stringify({ email, password }),
      }
    );
    if (data.token) saveToken(data.token);
    return data;
  },

  register: async (name: string, email: string, password: string) => {
    const data = await request<{ ok: boolean; token?: string }>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ name, email, password }),
    });
    if (data.token) saveToken(data.token);
    return data;
  },

  logout: async () => {
    try {
      return await request<{ ok: boolean }>("/api/auth/logout", { method: "POST" });
    } finally {
      clearToken();
    }
  },

  saveProfile: (payload: {
    teachSkills: unknown;
    learnSkills: unknown;
    mainGoal: string;
    weeklyAvailability: string;
  }) =>
    request<{ ok: boolean; user: ProfileDTO }>("/api/profile", {
      method: "PUT",
      body: JSON.stringify(payload),
    }),

  matches: () =>
    request<{
      matches: MatchResult[];
      aiMode: "openai" | "fallback";
      learnGoal: string | null;
    }>("/api/matches"),

  mentorships: () =>
    request<{ asMentee: MentorshipDTO[]; asMentor: MentorshipDTO[] }>("/api/mentorships"),

  mentorship: (id: string) => request<{ mentorship: MentorshipDTO }>(`/api/mentorships/${id}`),

  propose: (mentorId: string, message: string) =>
    request<{ ok: boolean; id: string }>("/api/mentorships", {
      method: "POST",
      body: JSON.stringify({ mentorId, message }),
    }),

  respond: (id: string, action: "accept" | "decline") =>
    request<{ ok: boolean; mentorship: MentorshipDTO | null }>(`/api/mentorships/${id}/respond`, {
      method: "POST",
      body: JSON.stringify({ action }),
    }),

  scheduleSession: (id: string, date: string) =>
    request<{ ok: boolean }>(`/api/mentorships/${id}/sessions`, {
      method: "POST",
      body: JSON.stringify({ action: "schedule", date }),
    }),

  recordSession: (id: string, sessionId: string, notes: string, commitments: string, complete: boolean) =>
    request<{ ok: boolean }>(`/api/mentorships/${id}/sessions`, {
      method: "POST",
      body: JSON.stringify({ action: complete ? "complete" : "record", sessionId, notes, commitments }),
    }),

  coachHistory: (id: string) =>
    request<{ messages: CoachMessageDTO[]; aiMode: "openai" | "fallback" }>(
      `/api/mentorships/${id}/coach`
    ),

  coachSend: (id: string, message: string) =>
    request<{
      ok: boolean;
      userMessage: CoachMessageDTO;
      assistantMessage: CoachMessageDTO;
      createdTasks: Array<{ id: string; title: string }>;
    }>(`/api/mentorships/${id}/coach`, {
      method: "POST",
      body: JSON.stringify({ message }),
    }),

  prepare: (id: string) =>
    request<{ ok: boolean; prep: { content: string; createdAt: string } }>(
      `/api/mentorships/${id}/prepare`,
      { method: "POST" }
    ),

  tasks: (id: string) => request<{ tasks: TaskDTO[] }>(`/api/mentorships/${id}/tasks`),

  createTask: (id: string, title: string, dueDate?: string) =>
    request<{ ok: boolean; task: TaskDTO }>(`/api/mentorships/${id}/tasks`, {
      method: "POST",
      body: JSON.stringify({ title, dueDate }),
    }),

  toggleTask: (taskId: string, completed: boolean) =>
    request<{ ok: boolean; task: TaskDTO }>(`/api/tasks/${taskId}`, {
      method: "PATCH",
      body: JSON.stringify({ completed }),
    }),

  notifications: () =>
    request<{ notifications: NotificationDTO[]; unread: number }>("/api/notifications"),

  markNotifications: (id?: string) =>
    request<{ ok: boolean }>("/api/notifications", {
      method: "PATCH",
      body: JSON.stringify(id ? { id } : {}),
    }),

  adminStats: () => request<AdminStats>("/api/admin/stats"),
};
