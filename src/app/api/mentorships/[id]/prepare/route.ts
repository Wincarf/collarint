import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { handleApiError, jsonError } from "@/lib/api-utils";
import { buildPrepPrompt, buildTemplatePrep } from "@/lib/coach-context";
import { aiMode, chatComplete } from "@/lib/ai";
import { parsePlan } from "@/lib/serialize";
import { firstName } from "@/lib/text";

export const dynamic = "force-dynamic";
export const maxDuration = 90;

/**
 * POST /api/mentorships/[id]/prepare
 * Generates the structured agenda + 5 questions for the mentee's next session.
 * Persisted in session_preps so the mentor can view it.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(req);
    const { id } = await ctx.params;

    const mentorship = await db.mentorship.findUnique({
      where: { id },
      include: { mentor: true, mentee: true },
    });
    if (!mentorship) return jsonError("Mentorship not found.", 404);
    if (mentorship.menteeId !== user.id) {
      return jsonError("Only the mentee generates the session preparation.", 403);
    }
    if (mentorship.status !== "active") return jsonError("Mentorship is not active.");

    const [sessions, tasks, messages] = await Promise.all([
      db.session.findMany({ where: { mentorshipId: id } }),
      db.task.findMany({ where: { mentorshipId: id } }),
      db.coachMessage.findMany({ where: { mentorshipId: id }, orderBy: { createdAt: "asc" } }),
    ]);

    // next plan session = first not completed
    const plan = parsePlan(mentorship.plan);
    const completedCount = sessions.filter((s) => s.completed).length;
    const nextPlanSession = plan?.sessions[completedCount]?.title ?? null;

    const bundle = {
      mentorship,
      mentee: mentorship.mentee,
      mentor: mentorship.mentor,
      sessions,
      tasks,
      messages,
    };

    let content: string;
    if (aiMode() === "openai") {
      try {
        content = await chatComplete([
          {
            role: "system",
            content:
              "You are the Collarint Coach, the AI of the JCI mentoring platform. Generate the requested session preparation, exactly in the requested format, in English, using the real mentorship context.",
          },
          { role: "user", content: buildPrepPrompt(bundle, nextPlanSession) },
        ]);
      } catch (e) {
        console.error("[prepare] IA falhou, usando template:", e);
        content = buildTemplatePrep(bundle, nextPlanSession);
      }
    } else {
      try {
        const text = await chatComplete([
          {
            role: "system",
            content:
              "You are the Collarint Coach, the AI of the JCI mentoring platform. Generate the requested session preparation, exactly in the requested format, in English, using the real mentorship context.",
          },
          { role: "user", content: buildPrepPrompt(bundle, nextPlanSession) },
        ]);
        content = text;
      } catch (e) {
        console.error("[prepare] fallback IA falhou, usando template:", e);
        content = buildTemplatePrep(bundle, nextPlanSession);
      }
    }

    const prep = await db.sessionPrep.create({
      data: { mentorshipId: id, content },
    });

    await db.notification.create({
      data: {
        userId: mentorship.mentorId,
        type: "prep_generated",
        title: `${firstName(mentorship.mentee.name)} prepared the next session`,
        body: "Check the agenda and questions they will bring to the session.",
        payload: JSON.stringify({ mentorshipId: id }),
      },
    });

    return NextResponse.json({
      ok: true,
      prep: { content: prep.content, createdAt: prep.createdAt.toISOString() },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
