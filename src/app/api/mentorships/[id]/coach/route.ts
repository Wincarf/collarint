import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { handleApiError, jsonError } from "@/lib/api-utils";
import { coachMessageToDTO } from "@/lib/serialize";
import { buildCoachContext } from "@/lib/coach-context";
import { COACH_SYSTEM_BASE, COACH_JSON_INSTRUCTION, chatJSON, aiMode, chatComplete } from "@/lib/ai";
import type { CoachChatResult } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 90;

/** GET /api/mentorships/[id]/coach — histórico de mensagens do coach */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(req);
    const { id } = await ctx.params;

    const mentorship = await db.mentorship.findUnique({
      where: { id },
      include: { mentor: true, mentee: true },
    });
    if (!mentorship) return jsonError("Mentoria não encontrada.", 404);
    if (mentorship.mentorId !== user.id && mentorship.menteeId !== user.id) {
      return jsonError("Sem permissão.", 403);
    }

    const messages = await db.coachMessage.findMany({
      where: { mentorshipId: id },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({
      messages: messages.map(coachMessageToDTO),
      aiMode: aiMode(),
    });
  } catch (err) {
    return handleApiError(err);
  }
}

/** POST /api/mentorships/[id]/coach — envia mensagem ao coach (JSON: reply + tasks opcionais) */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(req);
    const { id } = await ctx.params;
    const body = await req.json().catch(() => null);
    const message = String(body?.message ?? "").trim();

    if (message.length === 0) return jsonError("Escreva uma mensagem.");
    if (message.length > 2000) return jsonError("Mensagem muito longa (máx. 2000 caracteres).");

    const mentorship = await db.mentorship.findUnique({
      where: { id },
      include: { mentor: true, mentee: true },
    });
    if (!mentorship) return jsonError("Mentoria não encontrada.", 404);
    if (mentorship.mentorId !== user.id && mentorship.menteeId !== user.id) {
      return jsonError("Sem permissão.", 403);
    }
    if (mentorship.status !== "active") {
      return jsonError("O coach só está disponível para mentorias ativas.");
    }

    const [sessions, tasks, history] = await Promise.all([
      db.session.findMany({ where: { mentorshipId: id } }),
      db.task.findMany({ where: { mentorshipId: id } }),
      db.coachMessage.findMany({ where: { mentorshipId: id }, orderBy: { createdAt: "asc" } }),
    ]);

    const context = buildCoachContext({
      mentorship,
      mentee: mentorship.mentee,
      mentor: mentorship.mentor,
      sessions,
      tasks,
      messages: history,
    });

    const userMessage = await db.coachMessage.create({
      data: { mentorshipId: id, role: "user", content: message },
    });

    let result: CoachChatResult;
    try {
      if (aiMode() === "openai") {
        result = await chatJSON<CoachChatResult>([
          { role: "system", content: COACH_SYSTEM_BASE + "\n\n" + COACH_JSON_INSTRUCTION },
          { role: "user", content: context },
          ...history.slice(-6).map((m) => ({
            role: m.role === "user" ? ("user" as const) : ("assistant" as const),
            content: m.content.slice(0, 1500),
          })),
          { role: "user", content: message },
        ]);
        if (!result?.reply) throw new Error("resposta sem reply");
      } else {
        // Fallback: z-ai-web-dev-sdk em modo texto (sem JSON estruturado)
        const text = await chatComplete([
          { role: "system", content: COACH_SYSTEM_BASE + "\n\n" + COACH_JSON_INSTRUCTION },
          { role: "user", content: context },
          ...history.slice(-6).map((m) => ({
            role: m.role === "user" ? ("user" as const) : ("assistant" as const),
            content: m.content.slice(0, 1500),
          })),
          { role: "user", content: message },
        ]);
        result = extractResult(text);
      }
    } catch (e) {
      console.error("[coach] IA falhou, usando resposta de contingência:", e);
      result = {
        reply: fallbackCoachReply(message),
      };
    }

    const assistantMessage = await db.coachMessage.create({
      data: { mentorshipId: id, role: "assistant", content: result.reply },
    });

    // Criação de tarefas sugeridas pelo coach
    const createdTasks: Array<{ id: string; title: string }> = [];
    const suggestions = (result.tasks ?? []).filter((t) => t && String(t.title).trim().length > 3).slice(0, 2);
    for (const t of suggestions) {
      const dueDate = new Date();
      const days = Math.max(1, Math.min(30, Number(t.dueInDays) || 7));
      dueDate.setDate(dueDate.getDate() + days);
      dueDate.setHours(23, 59, 0, 0);
      const task = await db.task.create({
        data: {
          mentorshipId: id,
          title: String(t.title).trim().slice(0, 160),
          dueDate,
          source: "coach",
        },
      });
      createdTasks.push({ id: task.id, title: task.title });
    }

    return NextResponse.json({
      ok: true,
      userMessage: coachMessageToDTO(userMessage),
      assistantMessage: coachMessageToDTO(assistantMessage),
      createdTasks,
    });
  } catch (err) {
    return handleApiError(err);
  }
}

/** Extrai {reply, tasks} de resposta em texto livre (tolerante a cercas de código). */
function extractResult(raw: string): CoachChatResult {
  try {
    const cleaned = raw
      .replace(/```(?:json)?/gi, "")
      .trim();
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) {
      const parsed = JSON.parse(cleaned.slice(start, end + 1));
      if (parsed?.reply && typeof parsed.reply === "string") {
        return {
          reply: parsed.reply,
          tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [],
        };
      }
    }
  } catch {
    // segue para o fallback
  }
  return { reply: raw.trim() };
}

/** Resposta de contingência — nunca genérica: usa dados reais da mentoria. */
function fallbackCoachReply(message: string): string {
  return `Registrei sua mensagem: "${message.slice(0, 120)}".\n\nEstou com dificuldade técnica momentânea para gerar uma resposta completa agora, mas sua mentoria está no trilho — confira suas tarefas pendentes e o plano de sessões no painel.\n\n**Ação concreta:** revise a lista de tarefas da semana e anote 1 dúvida para levar à próxima sessão com seu mentor.`;
}
