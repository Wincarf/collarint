"use client";

// Typed HTTP client of the application

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
      // Session fallback for environments that block cookies (preview in an iframe)
      ...(token ? { "x-session-token": token } : {}),
      ...(options?.headers ?? {}),
    },
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || "Connection error. Please try again.");
  }
  return data as T;
}

// Session token: stored alongside the httpOnly cookie so the login keeps working
// even when the browser refuses third-party cookies.
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
    // localStorage unavailable — the cookie remains the primary mechanism
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

  coachSendStream: async (
    id: string,
    message: string,
    handlers: { onDelta: (chunk: string) => void }
  ) => {
    const token = readToken();
    const res = await fetch(`/api/mentorships/${id}/coach`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Session fallback for environments that block cookies (preview in an iframe)
        ...(token ? { "x-session-token": token } : {}),
      },
      body: JSON.stringify({ message }),
      cache: "no-store",
    });
    if (!res.ok || !res.body) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(data.error || "Connection error. Please try again.");
    }

    // SSE: data: {"type":"delta","t":"..."} ... data: {"type":"done", ...}
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let final: {
      ok: boolean;
      userMessage: CoachMessageDTO;
      assistantMessage: CoachMessageDTO;
      createdTasks: Array<{ id: string; title: string }>;
      completedTasks: Array<{ id: string; title: string }>;
    } | null = null;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split("\n\n");
      buffer = parts.pop() ?? "";
      for (const part of parts) {
        const line = part.split("\n").find((l) => l.startsWith("data:"));
        if (!line) continue;
        try {
          const evt = JSON.parse(line.slice(5).trim()) as
            | { type: "delta"; t: string }
            | {
                type: "done";
                ok: boolean;
                userMessage: CoachMessageDTO;
                assistantMessage: CoachMessageDTO;
                createdTasks: Array<{ id: string; title: string }>;
                completedTasks: Array<{ id: string; title: string }>;
              };
          if (evt.type === "delta") handlers.onDelta(evt.t);
          else if (evt.type === "done") final = evt;
        } catch {
          // partial frame — ignored
        }
      }
    }

    if (!final) throw new Error("The Coach reply was interrupted. Please try again.");
    return final;
  },

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
