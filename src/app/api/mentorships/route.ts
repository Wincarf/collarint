import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { handleApiError, jsonError } from "@/lib/api-utils";
import { mentorshipToDTO } from "@/lib/serialize";

export const dynamic = "force-dynamic";

/** GET /api/mentorships — lista mentorias do usuário (como mentor ou mentorado) */
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

/** POST /api/mentorships — propor mentoria a um mentor */
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser(req);
    const body = await req.json().catch(() => null);
    const mentorId = String(body?.mentorId ?? "");
    const message = String(body?.message ?? "").trim();

    if (!mentorId) return jsonError("Selecione um mentor.");
    if (mentorId === user.id) return jsonError("Você não pode propor mentoria para si mesmo.");
    if (message.length < 10) return jsonError("Escreva uma mensagem de convite (mínimo 10 caracteres).");

    const mentor = await db.profile.findUnique({ where: { id: mentorId } });
    if (!mentor || !mentor.onboarded) return jsonError("Mentor não encontrado.", 404);

    // Evita duplicidade: convite pendente ou mentoria ativa já existente com o par
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
          ? "Você já tem um convite pendente com este mentor."
          : "Você já tem uma mentoria ativa com este mentor.",
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
        title: `${user.name} quer ser mentorado por você`,
        body: `"${message.slice(0, 140)}${message.length > 140 ? "..." : ""}"`,
        payload: JSON.stringify({ mentorshipId: created.id }),
      },
    });

    return NextResponse.json({ ok: true, id: created.id });
  } catch (err) {
    return handleApiError(err);
  }
}
