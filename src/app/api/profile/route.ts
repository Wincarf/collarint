import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { handleApiError, jsonError } from "@/lib/api-utils";
import { sanitizeSkills } from "@/lib/skills";
import { embedText, aiMode } from "@/lib/ai";
import { LEVEL_LABELS } from "@/lib/types";
import { profileToDTO } from "@/lib/serialize";

function skillsToText(entries: ReturnType<typeof sanitizeSkills>, kind: "teach" | "learn", goal: string | null): string {
  const prefix = kind === "teach" ? "Skills I can teach" : "Skills I want to learn";
  return `${prefix}: ${entries.map((s) => `${s.name} (${LEVEL_LABELS[s.level] ?? s.level} level)`).join(", ")}. Goal: ${goal ?? ""}`;
}

export async function PUT(req: NextRequest) {
  try {
    const user = await requireUser(req);
    const body = await req.json().catch(() => null);

    const teach = sanitizeSkills(body?.teachSkills);
    const learn = sanitizeSkills(body?.learnSkills);
    const mainGoal = String(body?.mainGoal ?? "").trim().slice(0, 600);
    const availability = String(body?.weeklyAvailability ?? "");
    const roleTitle = String(body?.roleTitle ?? "").trim().slice(0, 80);
    const city = String(body?.city ?? "").trim().slice(0, 80);

    if (!["1h", "2h", "4h+"].includes(availability)) {
      return jsonError("Invalid weekly availability.");
    }
    if (teach.length === 0 && learn.length === 0) {
      return jsonError("Add at least one skill to teach or to learn.");
    }

    const goal = mainGoal || null;
    const [teachEmb, learnEmb] = await Promise.all([
      teach.length > 0 ? embedText(skillsToText(teach, "teach", goal)) : Promise.resolve(null),
      learn.length > 0 ? embedText(skillsToText(learn, "learn", goal)) : Promise.resolve(null),
    ]);

    const updated = await db.profile.update({
      where: { id: user.id },
      data: {
        teachSkills: JSON.stringify(teach),
        learnSkills: JSON.stringify(learn),
        mainGoal: goal,
        weeklyAvailability: availability,
        roleTitle: roleTitle || user.roleTitle,
        city: city || user.city,
        teachEmbedding: teachEmb ? JSON.stringify(teachEmb) : user.teachEmbedding,
        learnEmbedding: learnEmb ? JSON.stringify(learnEmb) : user.learnEmbedding,
        onboarded: true,
      },
    });

    return NextResponse.json({ ok: true, user: profileToDTO(updated), aiMode: aiMode() });
  } catch (err) {
    return handleApiError(err);
  }
}
