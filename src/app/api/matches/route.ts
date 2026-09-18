import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { handleApiError } from "@/lib/api-utils";
import { embeddingOf, parseSkills } from "@/lib/serialize";
import type { EmbeddableProfile, ScoredMatch } from "@/lib/matching";
import { scoreMatch, fallbackReason } from "@/lib/matching";
import { profileToDTO } from "@/lib/serialize";
import { chatJSON, aiMode } from "@/lib/ai";
import { PRESET_SKILLS } from "@/lib/skills";
import type { MatchResult, SkillEntry } from "@/lib/types";

export const dynamic = "force-dynamic";

interface ApiMatch {
  userId: string;
  name: string;
  roleTitle: string | null;
  city: string | null;
  avatarColor: string;
  weeklyAvailability: string | null;
  teachSkills: SkillEntry[];
  commonSkills: string[];
  score: number;
  reason: string;
  semantic: number;
  overlapRatio: number;
}

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser(req);
    if (!user.onboarded) {
      return NextResponse.json({ matches: [], needsOnboarding: true });
    }

    const menteeSkills = parseSkills(user.learnSkills);
    if (menteeSkills.length === 0) {
      return NextResponse.json({ matches: [] });
    }

    const others = await db.profile.findMany({
      where: { id: { not: user.id }, onboarded: true },
    });

    const toEmbeddable = (p: typeof user): EmbeddableProfile => ({
      id: p.id,
      name: p.name,
      teachSkills: parseSkills(p.teachSkills),
      learnSkills: parseSkills(p.learnSkills),
      mainGoal: p.mainGoal,
      teachEmbedding: embeddingOf(p.teachEmbedding),
      learnEmbedding: embeddingOf(p.learnEmbedding),
    });

    const mentee = toEmbeddable(user);

    const scored: ScoredMatch[] = others
      .filter((o) => parseSkills(o.teachSkills).length > 0)
      .map((o) => scoreMatch(mentee, toEmbeddable(o)))
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    const reasons = await generateReasons(user.name, mentee, scored);

    const matches: ApiMatch[] = scored.map((m, i) => {
      const dto = profileToDTO(others.find((o) => o.id === m.mentor.id)!);
      return {
        userId: m.mentor.id,
        name: m.mentor.name,
        roleTitle: dto.roleTitle,
        city: dto.city,
        avatarColor: dto.avatarColor,
        weeklyAvailability: dto.weeklyAvailability,
        teachSkills: dto.teachSkills,
        commonSkills: m.overlap.matched,
        score: Math.round(m.score * 100),
        reason: reasons[i] ?? fallbackReason(m),
        semantic: Math.round(m.semantic * 100),
        overlapRatio: Math.round(m.overlap.ratio * 100),
      };
    });

    return NextResponse.json({
      matches,
      aiMode: aiMode(),
      learnGoal: user.mainGoal,
      presetSkills: PRESET_SKILLS,
    });
  } catch (err) {
    return handleApiError(err);
  }
}

/** Generates the matches' explanatory sentences in a single AI call (fast). */
async function generateReasons(
  userName: string,
  mentee: EmbeddableProfile,
  matches: ScoredMatch[]
): Promise<(string | null)[]> {
  if (matches.length === 0) return [];
  if (aiMode() !== "openai") {
    return matches.map(() => null); // fallback: data-driven template
  }
  try {
    const list = matches
      .map(
        (m, i) =>
          `${i + 1}. ${m.mentor.name} — teaches: ${m.mentor.teachSkills.map((s) => `${s.name}(${s.level})`).join(", ")}; masters ${m.overlap.matched.length} of ${m.overlap.learnCount} sought skills${m.overlap.matched.length ? ` (${m.overlap.matched.join(", ")})` : ""}; semantic affinity ${Math.round(m.semantic * 100)}%`
      )
      .join("\n");

    const result = await chatJSON<{ reasons: string[] }>([
      {
        role: "system",
        content:
          'You are the Collarint Coach, the AI of the JCI mentoring platform. For each mentor match, write ONE sentence in English explaining why they are a good match for the mentee, citing concrete data (e.g.: "Jose masters 3 of the 4 skills you are looking for, especially Project Management"). Tone: professional, warm, direct. Reply ONLY with JSON: {"reasons":["sentence 1","sentence 2",...]} with the same number of matches as the input, in the same order.',
      },
      {
        role: "user",
        content: `Mentee: ${userName}\nGoal: ${mentee.mainGoal ?? "(not provided)"}\nWants to learn: ${mentee.learnSkills.map((s) => s.name).join(", ")}\n\nMatches:\n${list}`,
      },
    ]);
    if (Array.isArray(result.reasons) && result.reasons.length === matches.length) {
      return result.reasons.map((r) => String(r).slice(0, 300));
    }
    return matches.map(() => null);
  } catch (e) {
    console.error("[matches] AI reasons failed:", e);
    return matches.map(() => null);
  }
}
