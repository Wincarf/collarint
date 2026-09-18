import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { handleApiError, jsonError } from "@/lib/api-utils";
import { parseSkills } from "@/lib/serialize";
import { skillsMatch } from "@/lib/matching";
import { PRESET_SKILLS } from "@/lib/skills";
import { aiMode } from "@/lib/ai";
import type { AdminStats } from "@/lib/types";

export const dynamic = "force-dynamic";

/** GET /api/admin/stats — metrics + skills heatmap (admin only) */
export async function GET(req: NextRequest) {
  try {
    const user = await requireUser(req);
    if (!user.isAdmin) return jsonError("Access restricted to administrators.", 403);

    const [profiles, mentorships, sessions, tasks] = await Promise.all([
      db.profile.findMany(),
      db.mentorship.findMany(),
      db.session.findMany(),
      db.task.findMany(),
    ]);

    const onboarded = profiles.filter((p) => p.onboarded);
    const completedSessions = sessions.filter((s) => s.completed).length;
    const activeMentorships = mentorships.filter((m) => m.status === "active").length;
    const pendingInvites = mentorships.filter((m) => m.status === "pending").length;

    // Heatmap: for each catalog skill, count supply (teaches) and demand (wants to learn)
    const allSkills: string[] = [...PRESET_SKILLS];
    // includes custom skills that appear in profiles
    for (const p of onboarded) {
      for (const s of [...parseSkills(p.teachSkills), ...parseSkills(p.learnSkills)]) {
        if (!allSkills.some((k) => skillsMatch(k, s.name))) allSkills.push(s.name);
      }
    }

    const heatmap = allSkills
      .map((skill) => {
        const teachCount = onboarded.filter((p) =>
          parseSkills(p.teachSkills).some((s) => skillsMatch(s.name, skill))
        ).length;
        const learnCount = onboarded.filter((p) =>
          parseSkills(p.learnSkills).some((s) => skillsMatch(s.name, skill))
        ).length;
        const balance = learnCount === 0 ? teachCount : (teachCount - learnCount) / Math.max(teachCount + learnCount, 1);
        return { skill, teachCount, learnCount, balance };
      })
      .sort((a, b) => b.teachCount + b.learnCount - (a.teachCount + a.learnCount));

    const abundantSkills = heatmap
      .filter((h) => h.balance > 0.15 && h.teachCount > 0)
      .map((h) => h.skill)
      .slice(0, 4);
    const rareSkills = heatmap
      .filter((h) => h.balance < -0.15 && h.learnCount > 0)
      .map((h) => h.skill)
      .slice(0, 4);

    const stats: AdminStats = {
      totalMembers: profiles.length,
      onboardedMembers: onboarded.length,
      activeMentorships,
      pendingInvites,
      completedSessions,
      hoursMentored: completedSessions, // 1 session ≈ 1h (program standard)
      totalTasks: tasks.length,
      completedTasks: tasks.filter((t) => t.completed).length,
      heatmap,
      abundantSkills,
      rareSkills,
      aiMode: aiMode(),
    };

    return NextResponse.json(stats);
  } catch (err) {
    return handleApiError(err);
  }
}
