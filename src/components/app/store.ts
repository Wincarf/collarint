"use client";

// Estado global da SPA (navegação + sessão)

import { create } from "zustand";
import type { NotificationDTO, ProfileDTO } from "@/lib/types";

export type View =
  | { name: "home" }
  | { name: "matches" }
  | { name: "mentorship"; id: string }
  | { name: "mentor" }
  | { name: "admin" };

interface AppState {
  user: ProfileDTO | null;
  loadingUser: boolean;
  view: View;
  unread: number;
  notifications: NotificationDTO[];
  setView: (view: View) => void;
  setUser: (user: ProfileDTO | null) => void;
  setLoadingUser: (loading: boolean) => void;
  setNotifications: (items: NotificationDTO[], unread: number) => void;
}

export const useApp = create<AppState>((set) => ({
  user: null,
  loadingUser: true,
  view: { name: "home" },
  unread: 0,
  notifications: [],
  setView: (view) => set({ view }),
  setUser: (user) => set({ user }),
  setLoadingUser: (loadingUser) => set({ loadingUser }),
  setNotifications: (notifications, unread) => set({ notifications, unread }),
}));
