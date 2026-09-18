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
 * Mentor aceita ({action:"accept"}) ou recusa ({action:"decline"}).
 * Ao aceitar, gera automaticamente o plano de 4 sessões (IA com fallback).
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
    if (mentorship.mentorId !== user.id) {
      return jsonError("Apenas o mentor pode responder ao convite.", 403);
    }
    if (mentorship.status !== "pending") {
      return jsonError("Este convite já foi respondido.", 409);
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
          title: `${firstName(mentorship.mentor.name)} não pôde aceitar sua proposta de mentoria`,
          body: "Explore outros matches compatíveis com seu objetivo — há mais mentores na plataforma.",
          payload: JSON.stringify({ mentorshipId: id }),
        },
      });
      return NextResponse.json({ ok: true, status: declined.status });
    }

    if (action !== "accept") return jsonError("Ação inválida. Use 'accept' ou 'decline'.");

    // 1) marca como ativa
    await db.mentorship.update({ where: { id }, data: { status: "active" } });

    // 2) gera o plano de 4 sessões (IA → fallback template)
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

    // 3) mensagem de boas-vindas do coach com o contexto do plano
    const sess1 = plan.sessions[0];
    await db.coachMessage.create({
      data: {
        mentorshipId: id,
        role: "assistant",
        content: `Boa notícia: **${firstName(mentorship.mentor.name)}** aceitou ser seu mentor!\n\nJá preparei um **plano de 4 sessões** conectando seu objetivo com a experiência dele. Começamos pela **Sessão 1 — ${sess1?.title ?? "Diagnóstico"}**: ${sess1?.objective ?? "alinhamento inicial"}.\n\nUse este chat sempre que precisar de ajuda entre as sessões — posso montar sua pauta, revisar compromissos e criar tarefas.\n\n**Ação concreta:** converse com ${firstName(mentorship.mentor.name)} para agendar a Sessão 1 e me diga a data — eu te preparo para ela.`,
      },
    });

    // 4) notifica o mentorado
    await db.notification.create({
      data: {
        userId: mentorship.menteeId,
        type: "mentorship_accepted",
        title: `${firstName(mentorship.mentor.name)} aceitou sua mentoria!`,
        body: `Plano de 4 sessões gerado. Sessão 1: ${sess1?.title ?? "Diagnóstico"}.`,
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
