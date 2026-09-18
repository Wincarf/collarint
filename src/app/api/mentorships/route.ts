import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { handleApiError, jsonError } from "@/lib/api-utils";
import { mentorshipToDTO } from "@/lib/serialize";

export const dynamic = "force-dynamic";

/** GET /api/mentorships — lists the user's mentorships (as mentor or mentee) */
export async function GET(req: NextRequest) {
  try {
    const user = await requireUser(req);

    const rows = await db.mentorship.findMany({
      where: {
        OR: [{ mentorId: user.id }, { menteeId: user.id }],
      },
      include: {
        mentor: true,
        mentee: true,
        sessions: true,
        tasks: true,
        sessionPreps: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      asMentee: rows.filter((r) => r.menteeId === user.id).map(mentorshipToDTO),
      asMentor: rows.filter((r) => r.mentorId === user.id).map(mentorshipToDTO),
    });
  } catch (err) {
    return handleApiError(err);
  }
}

/** POST /api/mentorships — propose a mentorship to a mentor */
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser(req);
    const body = await req.json().catch(() => null);
    const mentorId = String(body?.mentorId ?? "");
    const message = String(body?.message ?? "").trim();

    if (!mentorId) return jsonError("Select a mentor.");
    if (mentorId === user.id) return jsonError("You cannot request a mentorship from yourself.");
    if (message.length < 10) return jsonError("Write an invite message (minimum 10 characters).");

    const mentor = await db.profile.findUnique({ where: { id: mentorId } });
    if (!mentor || !mentor.onboarded) return jsonError("Mentor not found.", 404);

    // Prevents duplicates: pending invite or active mentorship already existing for the pair
    const existing = await db.mentorship.findFirst({
      where: {
        mentorId,
        menteeId: user.id,
        status: { in: ["pending", "active"] },
      },
    });
    if (existing) {
      return jsonError(
        existing.status === "pending"
          ? "You already have a pending invite with this mentor."
          : "You already have an active mentorship with this mentor.",
        409
      );
    }

    const created = await db.mentorship.create({
      data: {
        mentorId,
        menteeId: user.id,
        status: "pending",
        inviteMessage: message.slice(0, 1000),
      },
    });

    await db.notification.create({
      data: {
        userId: mentorId,
        type: "mentorship_invite",
        title: `${user.name} wants you as their mentor`,
        body: `"${message.slice(0, 140)}${message.length > 140 ? "..." : ""}"`,
        payload: JSON.stringify({ mentorshipId: created.id }),
      },
    });

    return NextResponse.json({ ok: true, id: created.id });
  } catch (err) {
    return handleApiError(err);
  }
}
