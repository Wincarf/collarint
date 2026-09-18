// Serializadores Prisma → DTO (parse dos campos JSON armazenados como string)

import type { CoachMessage, Mentorship, Notification, Profile, Session, SessionPrep, Task } from "@prisma/client";
import type {
  CoachMessageDTO,
  EmbeddingPayload,
  MentorshipDTO,
  MentorshipPlan,
  NotificationDTO,
  ProfileDTO,
  SessionDTO,
  SkillEntry,
  TaskDTO,
} from "./types";
import { avatarColorFor } from "./skills";

export function parseSkills(raw: string | null): SkillEntry[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function profileToDTO(p: Profile): ProfileDTO {
  return {
    id: p.id,
    name: p.name,
    email: p.email,
    roleTitle: p.roleTitle,
    city: p.city,
    avatarColor: avatarColorFor(p.id, p.avatarColor),
    teachSkills: parseSkills(p.teachSkills),
    learnSkills: parseSkills(p.learnSkills),
    mainGoal: p.mainGoal,
    weeklyAvailability: p.weeklyAvailability,
    onboarded: p.onboarded,
    isAdmin: p.isAdmin,
  };
}

export function embeddingOf(raw: string | null): EmbeddingPayload | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && Array.isArray(parsed.vector)) {
      return { mode: parsed.mode === "openai" ? "openai" : "local", vector: parsed.vector };
    }
    return null;
  } catch {
    return null;
  }
}

export function sessionToDTO(s: Session): SessionDTO {
  return {
    id: s.id,
    scheduledAt: s.scheduledAt ? s.scheduledAt.toISOString() : null,
    notes: s.notes,
    commitments: s.commitments,
    completed: s.completed,
  };
}

export function taskToDTO(t: Task): TaskDTO {
  return {
    id: t.id,
    title: t.title,
    dueDate: t.dueDate ? t.dueDate.toISOString() : null,
    completed: t.completed,
    source: t.source,
    createdAt: t.createdAt.toISOString(),
  };
}

export function coachMessageToDTO(m: CoachMessage): CoachMessageDTO {
  return {
    id: m.id,
    role: m.role === "user" ? "user" : "assistant",
    content: m.content,
    createdAt: m.createdAt.toISOString(),
  };
}

export function parsePlan(raw: string | null): MentorshipPlan | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.sessions)) return parsed as MentorshipPlan;
    return null;
  } catch {
    return null;
  }
}

export function mentorshipToDTO(
  m: Mentorship & {
    mentor: Profile;
    mentee: Profile;
    sessions: Session[];
    tasks: Task[];
    sessionPreps: SessionPrep[];
  }
): MentorshipDTO {
  const preps = [...m.sessionPreps].sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
  );
  return {
    id: m.id,
    status: m.status,
    inviteMessage: m.inviteMessage,
    plan: parsePlan(m.plan),
    createdAt: m.createdAt.toISOString(),
    mentor: profileToDTO(m.mentor),
    mentee: profileToDTO(m.mentee),
    sessions: m.sessions
      .map(sessionToDTO)
      .sort((a, b) => {
        if (!a.scheduledAt) return 1;
        if (!b.scheduledAt) return -1;
        return a.scheduledAt.localeCompare(b.scheduledAt);
      }),
    tasks: m.tasks
      .map(taskToDTO)
      .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1)),
    latestPrep: preps[0]
      ? { content: preps[0].content, createdAt: preps[0].createdAt.toISOString() }
      : null,
  };
}

export function notificationToDTO(n: Notification): NotificationDTO {
  let payload: { mentorshipId?: string } | null = null;
  if (n.payload) {
    try {
      payload = JSON.parse(n.payload);
    } catch {
      payload = null;
    }
  }
  return {
    id: n.id,
    type: n.type,
    title: n.title,
    body: n.body,
    payload,
    read: n.read,
    createdAt: n.createdAt.toISOString(),
  };
}
