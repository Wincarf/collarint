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
  const res = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options?.headers ?? {}) },
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || "Erro de conexão. Tente novamente.");
  }
  return data as T;
}

export const api = {
  me: () => request<{ user: ProfileDTO | null }>("/api/auth/me"),

  login: (email: string, password: string) =>
    request<{ ok: boolean; onboarded: boolean; isAdmin: boolean }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  register: (name: string, email: string, password: string) =>
    request<{ ok: boolean }>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ name, email, password }),
    }),

  logout: () => request<{ ok: boolean }>("/api/auth/logout", { method: "POST" }),

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
