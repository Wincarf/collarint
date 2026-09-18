import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { handleApiError, jsonError } from "@/lib/api-utils";
import { sessionToDTO } from "@/lib/serialize";
import { firstName } from "@/lib/text";

export const dynamic = "force-dynamic";

/**
 * POST /api/mentorships/[id]/sessions
 * { action: "schedule", date: ISO } — agenda próxima sessão (mentor)
 * { action: "record", sessionId, notes, commitments } — registra sessão
 * { action: "complete", sessionId } — marca como realizada
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
    if (!mentorship) return jsonError("Mentoria não encontrada.", 404);
    const isMentor = mentorship.mentorId === user.id;
    const isMentee = mentorship.menteeId === user.id;
    if (!isMentor && !isMentee) return jsonError("Sem permissão.", 403);
    if (mentorship.status !== "active") return jsonError("Mentoria não está ativa.");

    if (action === "schedule") {
      if (!isMentor) return jsonError("Apenas o mentor agenda as sessões.", 403);
      const dateStr = String(body?.date ?? "");
      const date = new Date(dateStr);
      if (!dateStr || isNaN(date.getTime())) return jsonError("Informe data e hora válidas.");

      const session = await db.session.create({
        data: { mentorshipId: id, scheduledAt: date },
      });

      await db.notification.create({
        data: {
          userId: mentorship.menteeId,
          type: "session_scheduled",
          title: `Próxima sessão com ${firstName(mentorship.mentor.name)} agendada`,
          body: date.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }),
          payload: JSON.stringify({ mentorshipId: id }),
        },
      });

      return NextResponse.json({ ok: true, session: sessionToDTO(session) });
    }

    if (action === "record" || action === "complete") {
      const sessionId = String(body?.sessionId ?? "");
      const session = await db.session.findUnique({ where: { id: sessionId } });
      if (!session || session.mentorshipId !== id) return jsonError("Sessão não encontrada.", 404);

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
            title: `Sessão de ${firstName(isMentor ? mentorship.mentor.name : mentorship.mentee.name)} registrada`,
            body: notes ? notes.slice(0, 140) : "Registro de sessão atualizado.",
            payload: JSON.stringify({ mentorshipId: id }),
          },
        });
      }

      return NextResponse.json({ ok: true, session: sessionToDTO(updated) });
    }

    return jsonError("Ação inválida. Use 'schedule', 'record' ou 'complete'.");
  } catch (err) {
    return handleApiError(err);
  }
}
