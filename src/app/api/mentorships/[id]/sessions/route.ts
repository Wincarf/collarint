import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { handleApiError, jsonError } from "@/lib/api-utils";
import { sessionToDTO } from "@/lib/serialize";
import { firstName } from "@/lib/text";

export const dynamic = "force-dynamic";

/**
 * POST /api/mentorships/[id]/sessions
 * { action: "schedule", date: ISO } — schedules the next session (mentor)
 * { action: "record", sessionId, notes, commitments } — logs a session
 * { action: "complete", sessionId } — marks as completed
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
    const isMentor = mentorship.mentorId === user.id;
    const isMentee = mentorship.menteeId === user.id;
    if (!isMentor && !isMentee) return jsonError("No permission.", 403);
    if (mentorship.status !== "active") return jsonError("Mentorship is not active.");

    if (action === "schedule") {
      if (!isMentor) return jsonError("Only the mentor schedules the sessions.", 403);
      const dateStr = String(body?.date ?? "");
      const date = new Date(dateStr);
      if (!dateStr || isNaN(date.getTime())) return jsonError("Enter a valid date and time.");

      const session = await db.session.create({
        data: { mentorshipId: id, scheduledAt: date },
      });

      await db.notification.create({
        data: {
          userId: mentorship.menteeId,
          type: "session_scheduled",
          title: `Next session with ${firstName(mentorship.mentor.name)} scheduled`,
          body: date.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }),
          payload: JSON.stringify({ mentorshipId: id }),
        },
      });

      return NextResponse.json({ ok: true, session: sessionToDTO(session) });
    }

    if (action === "record" || action === "complete") {
      const sessionId = String(body?.sessionId ?? "");
      const session = await db.session.findUnique({ where: { id: sessionId } });
      if (!session || session.mentorshipId !== id) return jsonError("Session not found.", 404);

      const notes = String(body?.notes ?? "").trim().slice(0, 3000);
      const commitments = String(body?.commitments ?? "").trim().slice(0, 3000);

      const updated = await db.session.update({
        where: { id: sessionId },
        data: {
          notes: notes || session.notes,
          commitments: commitments || session.commitments,
          completed: action === "complete" ? true : session.completed,
        },
      });

      if (action === "complete") {
        await db.notification.create({
          data: {
            userId: isMentor ? mentorship.menteeId : mentorship.mentorId,
            type: "session_recorded",
            title: `Session of ${firstName(isMentor ? mentorship.mentor.name : mentorship.mentee.name)} logged`,
            body: notes ? notes.slice(0, 140) : "Session record updated.",
            payload: JSON.stringify({ mentorshipId: id }),
          },
        });
      }

      return NextResponse.json({ ok: true, session: sessionToDTO(updated) });
    }

    return jsonError("Invalid action. Use 'schedule', 'record' or 'complete'.");
  } catch (err) {
    return handleApiError(err);
  }
}
