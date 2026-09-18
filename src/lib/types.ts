// Tipos compartilhados entre servidor e cliente — JCI Collarint

export type SkillLevel = "iniciante" | "intermediario" | "avancado";

export interface SkillEntry {
  name: string;
  level: SkillLevel;
}

export interface EmbeddingPayload {
  mode: "local" | "openai";
  vector: number[];
}

export interface PlanSession {
  number: number;
  title: string;
  objective: string;
  topics: string[];
}

export interface MentorshipPlan {
  generatedBy: "ai" | "template";
  createdAt: string;
  sessions: PlanSession[];
}

export interface CoachTaskSuggestion {
  title: string;
  dueInDays?: number;
}

export interface CoachChatResult {
  reply: string;
  tasks?: CoachTaskSuggestion[];
}

export interface MatchResult {
  userId: string;
  name: string;
  roleTitle: string | null;
  city: string | null;
  avatarColor: string;
  weeklyAvailability: string | null;
  teachSkills: SkillEntry[];
  commonSkills: string[]; // skills que o usuário busca e o match ensina
  score: number; // 0-100
  reason: string;
}

export interface ProfileDTO {
  id: string;
  name: string;
  email: string;
  roleTitle: string | null;
  city: string | null;
  avatarColor: string;
  teachSkills: SkillEntry[];
  learnSkills: SkillEntry[];
  mainGoal: string | null;
  weeklyAvailability: string | null;
  onboarded: boolean;
  isAdmin: boolean;
}

export interface SessionDTO {
  id: string;
  scheduledAt: string | null;
  notes: string | null;
  commitments: string | null;
  completed: boolean;
}

export interface TaskDTO {
  id: string;
  title: string;
  dueDate: string | null;
  completed: boolean;
  source: string;
  createdAt: string;
}

export interface CoachMessageDTO {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

export interface MentorshipDTO {
  id: string;
  status: string;
  inviteMessage: string | null;
  plan: MentorshipPlan | null;
  createdAt: string;
  mentor: ProfileDTO;
  mentee: ProfileDTO;
  sessions: SessionDTO[];
  tasks: TaskDTO[];
  latestPrep: { content: string; createdAt: string } | null;
}

export interface NotificationDTO {
  id: string;
  type: string;
  title: string;
  body: string | null;
  payload: { mentorshipId?: string } | null;
  read: boolean;
  createdAt: string;
}

export interface AdminStats {
  totalMembers: number;
  onboardedMembers: number;
  activeMentorships: number;
  pendingInvites: number;
  completedSessions: number;
  hoursMentored: number;
  totalTasks: number;
  completedTasks: number;
  heatmap: Array<{
    skill: string;
    teachCount: number;
    learnCount: number;
    balance: number; // >0 abunda, <0 rara
  }>;
  abundantSkills: string[];
  rareSkills: string[];
  aiMode: "openai" | "fallback";
}

export const LEVEL_LABELS: Record<SkillLevel, string> = {
  iniciante: "Iniciante",
  intermediario: "Intermediário",
  avancado: "Avançado",
};
