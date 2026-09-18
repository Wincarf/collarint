import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { handleApiError, jsonError } from "@/lib/api-utils";
import { mentorshipToDTO } from "@/lib/serialize";
import { generatePlan } from "@/lib/plan";
import { parseSkills } from "@/lib/serialize";
import { firstName } from "@/lib/text";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * POST /api/mentorships/[id]/respond
 * The mentor accepts ({action:"accept"}) or declines ({action:"decline"}).
 * On accept, automatically generates the 4-session plan (AI with fallback).
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(req);
    const { id } = await ctx.params;
    const body = await req.json().catch(() => null);
    const action = String(body?.action ?? "");

    const mentorship = await db.mentorship.findUnique({
      where: { id },
      include: { mentor: true, mentee: true },
    });

    if (!mentorship) return jsonError("Mentorship not found.", 404);
    if (mentorship.mentorId !== user.id) {
      return jsonError("Only the mentor can respond to the invite.", 403);
    }
    if (mentorship.status !== "pending") {
      return jsonError("This invite has already been answered.", 409);
    }

    if (action === "decline") {
      const declined = await db.mentorship.update({
        where: { id },
        data: { status: "declined" },
      });
      await db.notification.create({
        data: {
          userId: mentorship.menteeId,
          type: "mentorship_declined",
          title: `${firstName(mentorship.mentor.name)} could not accept your mentorship request`,
          body: "Explore other matches that fit your goal — there are more mentors on the platform.",
          payload: JSON.stringify({ mentorshipId: id }),
        },
      });
      return NextResponse.json({ ok: true, status: declined.status });
    }

    if (action !== "accept") return jsonError("Invalid action. Use 'accept' or 'decline'.");

    // 1) marks as active
    await db.mentorship.update({ where: { id }, data: { status: "active" } });

    // 2) generates the 4-session plan (AI → template fallback)
    const plan = await generatePlan(
      mentorship.mentee,
      mentorship.mentor,
      parseSkills(mentorship.mentee.learnSkills),
      parseSkills(mentorship.mentor.teachSkills)
    );
    await db.mentorship.update({
      where: { id },
      data: { plan: JSON.stringify(plan) },
    });

    // 3) coach welcome message with the plan context
    const sess1 = plan.sessions[0];
    await db.coachMessage.create({
      data: {
        mentorshipId: id,
        role: "assistant",
        content: `Good news: **${firstName(mentorship.mentor.name)}** accepted to be your mentor!\n\nI have already prepared a **4-session plan** connecting your goal with their experience. We start with **Session 1 — ${sess1?.title ?? "Diagnosis"}**: ${sess1?.objective ?? "initial alignment"}.\n\nUse this chat whenever you need help between sessions — I can put together your agenda, review commitments and create tasks.\n\n**Concrete action:** talk to ${firstName(mentorship.mentor.name)} to schedule Session 1 and tell me the date — I will get you ready for it.`,
      },
    });

    // 4) notifies the mentee
    await db.notification.create({
      data: {
        userId: mentorship.menteeId,
        type: "mentorship_accepted",
        title: `${firstName(mentorship.mentor.name)} accepted your mentorship!`,
        body: `4-session plan generated. Session 1: ${sess1?.title ?? "Diagnosis"}.`,
        payload: JSON.stringify({ mentorshipId: id }),
      },
    });

    const full = await db.mentorship.findUnique({
      where: { id },
      include: { mentor: true, mentee: true, sessions: true, tasks: true, sessionPreps: true },
    });

    return NextResponse.json({ ok: true, mentorship: full ? mentorshipToDTO(full) : null });
  } catch (err) {
    return handleApiError(err);
  }
}
