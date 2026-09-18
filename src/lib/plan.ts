// 4-session mentorship plan generation (AI with deterministic fallback)

import type { MentorshipPlan, PlanSession } from "./types";
import type { Profile } from "@prisma/client";
import { chatJSON, aiMode } from "./ai";
import type { SkillEntry } from "./types";
import { LEVEL_LABELS } from "./types";
import { parsePlan } from "./serialize";

function planSystemPrompt(): string {
  return `You are the Collarint Coach, the AI of the JCI mentoring platform.
Your task is to create a MENTORSHIP PLAN with exactly 4 sessions for a mentor/mentee pair.
The plan must be specific to the mentee's goal and leverage the mentor's skills — nothing generic.

Reply ONLY with valid JSON in the format:
{"sessions":[{"number":1,"title":"short session title","objective":"clear 1-sentence objective","topics":["topic 1","topic 2","topic 3"]}]}
Rules: exactly 4 sessions numbered 1 to 4; Session 1 is always diagnosis/alignment; Session 4 consolidates and leaves a continuity plan; titles must be specific to the context (nothing like "Session 2"). Write everything in English.`;
}

function planUserPrompt(menteeName: string, menteeGoal: string | null, menteeLearn: SkillEntry[], mentorName: string, mentorTeach: SkillEntry[]): string {
  const fmt = (s: SkillEntry) => `${s.name} (${LEVEL_LABELS[s.level] ?? s.level})`;
  return `Mentee: ${menteeName}
Mentee's main goal: ${menteeGoal ?? "(not provided)"}
Skills the mentee wants to develop: ${menteeLearn.map(fmt).join(", ") || "(not provided)"}

Mentor: ${mentorName}
Skills the mentor teaches: ${mentorTeach.map(fmt).join(", ") || "(not provided)"}

Create the 4-session plan.`;
}

/** High-quality deterministic plan — used as fallback when AI is unavailable. */
export function buildTemplatePlan(mentee: Profile, mentor: Profile, menteeLearn: SkillEntry[], mentorTeach: SkillEntry[]): MentorshipPlan {
  const first = mentor.name.split(" ")[0];
  const goal = mentee.mainGoal ?? "develop the skills being sought";
  const skillA = menteeLearn[0]?.name ?? mentorTeach[0]?.name ?? "the core topic";
  const skillB = menteeLearn[1]?.name ?? skillA;
  const sessions: PlanSession[] = [
    {
      number: 1,
      title: "Diagnosis and expectation alignment",
      objective: `Map the starting point for development and connect the goal to the real context.`,
      topics: ["Current situation and challenges", "Goal priorities", "Mentorship expectations"],
    },
    {
      number: 2,
      title: `Hands-on foundations of ${skillA}`,
      objective: `Transfer ${first}'s experience in ${skillA} with real cases and applicable frameworks.`,
      topics: [`${skillA} in practice`, "Real cases from the mentor", "Framework applied to the context"],
    },
    {
      number: 3,
      title: `Going deeper into ${skillB === skillA ? "challenging day-to-day situations" : skillB}`,
      objective: "Work through real situations brought by the mentee with direct feedback from the mentor.",
      topics: ["Real situations from the mentee", "Mentor feedback", "Course corrections"],
    },
    {
      number: 4,
      title: "Consolidation and continuity plan",
      objective: "Consolidate learnings and define the post-mentorship development plan.",
      topics: ["Progress review", "The next 90 days", "Final commitments"],
    },
  ];
  return { generatedBy: "template", createdAt: new Date().toISOString(), sessions };
}

/**
 * Generates the plan with AI; if it fails (no key or error), uses the template.
 * Never throws.
 */
export async function generatePlan(
  mentee: Profile,
  mentor: Profile,
  menteeLearn: SkillEntry[],
  mentorTeach: SkillEntry[]
): Promise<MentorshipPlan> {
  if (aiMode() === "openai") {
    try {
      const raw = await chatJSON<{ sessions: PlanSession[] }>([
        { role: "system", content: planSystemPrompt() },
        {
          role: "user",
          content: planUserPrompt(mentee.name, mentee.mainGoal, menteeLearn, mentor.name, mentorTeach),
        },
      ]);
      if (Array.isArray(raw.sessions) && raw.sessions.length === 4) {
        const sessions = raw.sessions.map((s, i) => ({
          number: i + 1,
          title: String(s.title ?? `Session ${i + 1}`).slice(0, 80),
          objective: String(s.objective ?? "").slice(0, 300),
          topics: Array.isArray(s.topics) ? s.topics.slice(0, 4).map((t) => String(t).slice(0, 80)) : [],
        }));
        return { generatedBy: "ai", createdAt: new Date().toISOString(), sessions };
      }
    } catch (e) {
      console.error("[plan] AI failed, using template:", e);
    }
  }
  return buildTemplatePlan(mentee, mentor, menteeLearn, mentorTeach);
}

export { parsePlan };
