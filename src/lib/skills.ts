// Preset skill catalog of the JCI mentoring program

import type { SkillEntry, SkillLevel } from "./types";

export const PRESET_SKILLS = [
  "Leadership",
  "Project Management",
  "Finance",
  "Sales",
  "Public Speaking",
  "Storytelling",
  "Digital Marketing",
  "Negotiation",
  "Entrepreneurship",
  "Networking",
  "Human Resources",
  "Technology/AI",
] as const;

export const AVATAR_COLORS = [
  "#0A1F44",
  "#D4A843",
  "#1F4A7A",
  "#7A5C1F",
  "#2E6E5C",
  "#6E2E50",
  "#4A2E6E",
  "#2E5A6E",
  "#8A5A2E",
  "#2E6E42",
  "#5C2E6E",
  "#6E4A2E",
];

export function isValidSkillLevel(level: string): level is SkillLevel {
  return level === "iniciante" || level === "intermediario" || level === "avancado";
}

export function sanitizeSkills(raw: unknown): SkillEntry[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: SkillEntry[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const name = String((item as Record<string, unknown>).name ?? "").trim();
    const levelRaw = String((item as Record<string, unknown>).level ?? "iniciante");
    if (!name || name.length > 60) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      name: name.slice(0, 60),
      level: isValidSkillLevel(levelRaw) ? levelRaw : "iniciante",
    });
  }
  return out.slice(0, 20);
}

export function skillNames(entries: SkillEntry[]): string[] {
  return entries.map((s) => s.name);
}

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function avatarColorFor(id: string, fallback?: string | null): string {
  if (fallback) return fallback;
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}
