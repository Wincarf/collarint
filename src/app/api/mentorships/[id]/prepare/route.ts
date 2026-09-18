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
 * Gera a pauta estruturada + 5 perguntas para a próxima sessão do mentorado.
 * Persistida em session_preps para o mentor poder visualizar.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(req);
    const { id } = await ctx.params;

    const mentorship = await db.mentorship.findUnique({
      where: { id },
      include: { mentor: true, mentee: true },
    });
    if (!mentorship) return jsonError("Mentoria não encontrada.", 404);
    if (mentorship.menteeId !== user.id) {
      return jsonError("Apenas o mentorado gera a preparação da sessão.", 403);
    }
    if (mentorship.status !== "active") return jsonError("Mentoria não está ativa.");

    const [sessions, tasks, messages] = await Promise.all([
      db.session.findMany({ where: { mentorshipId: id } }),
      db.task.findMany({ where: { mentorshipId: id } }),
      db.coachMessage.findMany({ where: { mentorshipId: id }, orderBy: { createdAt: "asc" } }),
    ]);

    // próxima sessão do plano = primeira não concluída
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
              "Você é o Coach Collarint, IA da plataforma de mentoria da JCI Brasil. Gere a preparação de sessão pedida, exatamente no formato solicitado, em português do Brasil, usando o contexto real da mentoria.",
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
              "Você é o Coach Collarint, IA da plataforma de mentoria da JCI Brasil. Gere a preparação de sessão pedida, exatamente no formato solicitado, em português do Brasil, usando o contexto real da mentoria.",
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
        title: `${firstName(mentorship.mentee.name)} preparou a próxima sessão`,
        body: "Confira a pauta e as perguntas que ele/ela vai levar à sessão.",
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
