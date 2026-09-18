// AI Coach context builder — ensures the coach NEVER answers generically:
// injects goal, plan, session history and tasks.

import type { CoachMessage, Mentorship, Profile, Session, Task } from "@prisma/client";
import { parsePlan, parseSkills } from "./serialize";
import { LEVEL_LABELS } from "./types";

function fmtDate(d: Date | null): string {
  if (!d) return "to be scheduled";
  return d.toLocaleDateString("en-US", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  });
}

export interface MentorshipBundle {
  mentorship: Mentorship;
  mentee: Profile;
  mentor: Profile;
  sessions: Session[];
  tasks: Task[];
  messages: CoachMessage[];
}

export function buildCoachContext(b: MentorshipBundle): string {
  const plan = parsePlan(b.mentorship.plan);
  const pendingTasks = b.tasks.filter((t) => !t.completed);
  const doneTasks = b.tasks.filter((t) => t.completed);
  const completedSessions = b.sessions.filter((s) => s.completed);
  const nextSession = b.sessions.find((s) => !s.completed && s.scheduledAt && s.scheduledAt > new Date());
  const menteeFirst = b.mentee.name.split(" ")[0];
  const mentorFirst = b.mentor.name.split(" ")[0];

  const lines: string[] = [];
  lines.push(`## MENTORSHIP CONTEXT`);
  lines.push(`- Mentee: ${b.mentee.name} (${b.mentee.roleTitle ?? "JCI member"})`);
  lines.push(`- Mentor: ${b.mentor.name} (${b.mentor.roleTitle ?? "JCI member"})`);
  lines.push(
    `- Skills the mentor teaches: ${parseSkills(b.mentor.teachSkills).map((s) => `${s.name} (${LEVEL_LABELS[s.level] ?? s.level})`).join(", ") || "not provided"}`
  );
  lines.push(`- Mentee's main goal: ${b.mentee.mainGoal ?? "not provided"}`);
  lines.push(
    `- Skills the mentee wants to develop: ${parseSkills(b.mentee.learnSkills).map((s) => s.name).join(", ") || "not provided"}`
  );
  lines.push(`- Mentee's weekly availability: ${b.mentee.weeklyAvailability ?? "not provided"}`);

  if (plan) {
    lines.push(`\n## MENTORSHIP PLAN (${plan.sessions.length} sessions)`);
    for (const s of plan.sessions) {
      lines.push(`- Session ${s.number} — ${s.title}: ${s.objective} (topics: ${s.topics.join("; ")})`);
    }
  }

  lines.push(`\n## SESSIONS (${completedSessions.length} completed)`);
  if (completedSessions.length === 0) {
    lines.push("- No sessions completed yet.");
  }
  for (const s of completedSessions) {
    lines.push(`- Session of ${fmtDate(s.scheduledAt)}:`);
    if (s.notes) lines.push(`  · What was discussed: ${s.notes}`);
    if (s.commitments) lines.push(`  · Commitments made: ${s.commitments}`);
  }
  if (nextSession) {
    lines.push(`- NEXT SESSION scheduled: ${fmtDate(nextSession.scheduledAt)}`);
  }

  lines.push(`\n## TASKS`);
  lines.push(`- Pending (${pendingTasks.length}):`);
  for (const t of pendingTasks) lines.push(`  · ${t.title}${t.dueDate ? ` (due: ${fmtDate(t.dueDate)})` : ""}`);
  if (pendingTasks.length === 0) lines.push("  · none");
  if (doneTasks.length > 0) {
    lines.push(`- Completed (${doneTasks.length}): ${doneTasks.map((t) => t.title).join("; ")}`);
  }

  const recent = [...b.messages]
    .sort((a, c) => a.createdAt.getTime() - c.createdAt.getTime())
    .slice(-8);
  if (recent.length > 0) {
    lines.push(`\n## RECENT COACH MESSAGES (${menteeFirst} ↔ you)`);
    for (const m of recent) {
      const who = m.role === "user" ? menteeFirst : "Coach";
      lines.push(`- ${who}: ${m.content.slice(0, 400)}`);
    }
  }

  lines.push(
    `\nOpening guideline: greet ${menteeFirst} by name, show that you know the current state of their mentorship with ${mentorFirst} (cite the plan, real sessions and tasks) and get straight to the point.`
  );
  return lines.join("\n");
}

/** Session preparation prompt (agenda + 5 questions). */
export function buildPrepPrompt(b: MentorshipBundle, nextPlanSession: string | null): string {
  const context = buildCoachContext(b);
  const menteeFirst = b.mentee.name.split(" ")[0];
  const mentorFirst = b.mentor.name.split(" ")[0];
  return `${context}

## TASK
Generate the SESSION PREPARATION for ${menteeFirst} to bring to the next session with ${mentorFirst}.
${nextPlanSession ? `The next plan session is: "${nextPlanSession}".` : "Base it on the current state of the mentorship."}

Exact reply format (markdown, in English):

## Next session agenda
1. [opening item — 2 to 3 min]
2. [central item connected to the plan and pending tasks]
3. [central item 2]
4. [closing item — align commitments and next step]

## 5 questions to bring to your mentor
1. [specific, open-ended question]
2. ...
5. [final question about next steps]

## Reminder
[1 short sentence about a relevant pending commitment, if any]

Rules: the questions must be specific to the context (goal, plan, recent sessions, pending tasks) — generic questions like "how can I improve?" are forbidden. 250 words maximum in total.`;
}

export function buildTemplatePrep(b: MentorshipBundle, nextPlanSession: string | null): string {
  const menteeFirst = b.mentee.name.split(" ")[0];
  const mentorFirst = b.mentor.name.split(" ")[0];
  const plan = parsePlan(b.mentorship.plan);
  const pending = b.tasks.filter((t) => !t.completed);
  const goal = b.mentee.mainGoal ?? "your development goal";
  const nextTitle = nextPlanSession ?? "the next step of the plan";

  const questions = [
    `How did this stage (${nextTitle}) show up in your own career, ${mentorFirst}?`,
    `What are the most common mistakes people make when starting to work on this — and how do I avoid them?`,
    `Given my goal ("${goal.slice(0, 90)}"), where should I start this week?`,
    pending.length > 0
      ? `About the task "${pending[0].title}": what would you do differently in my place?`
      : `How will I know I am genuinely making progress on this skill?`,
    `What would need to be true two sessions from now for us to consider this stage conquered?`,
  ];

  return `## Next session agenda
1. Quick check-in — how the week went and task status (5 min)
2. ${nextTitle} — context and expectations (15 min)
3. Questions brought by ${menteeFirst} based on the mentoring goal (20 min)
4. Wrap-up — commitments for the week and next date (10 min)

## 5 questions to bring to your mentor
${questions.map((q, i) => `${i + 1}. ${q}`).join("\n")}

## Reminder
${pending.length > 0 ? `You have ${pending.length} pending task(s): "${pending[0].title}".` : `All tasks are up to date — great job, ${menteeFirst}!`}`;
}
