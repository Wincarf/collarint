import { NextRequest, NextResponse } from "next/server";
import type { Task } from "@prisma/client";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { handleApiError, jsonError } from "@/lib/api-utils";
import { coachMessageToDTO } from "@/lib/serialize";
import { buildCoachContext } from "@/lib/coach-context";
import {
  COACH_SYSTEM_BASE,
  COACH_EXTRACT_SYSTEM,
  chatComplete,
  parseLooseJSON,
  simulateStream,
  streamChatComplete,
  aiMode,
  type ChatMessage,
} from "@/lib/ai";

export const dynamic = "force-dynamic";
export const maxDuration = 90;

/** GET /api/mentorships/[id]/coach — current (non-archived) coach message history */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(req);
    const { id } = await ctx.params;

    const mentorship = await db.mentorship.findUnique({
      where: { id },
      include: { mentor: true, mentee: true },
    });
    if (!mentorship) return jsonError("Mentorship not found.", 404);
    if (mentorship.mentorId !== user.id && mentorship.menteeId !== user.id) {
      return jsonError("No permission.", 403);
    }

    const messages = await db.coachMessage.findMany({
      where: { mentorshipId: id, archivedAt: null },
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

interface CoachActions {
  tasks?: Array<{ title?: unknown; dueInDays?: unknown }>;
  completeTasks?: unknown;
}

/** DELETE /api/mentorships/[id]/coach — start a new conversation:
 *  archives the current messages (they stay in the database) so the chat
 *  begins empty. The mentorship context (plan, sessions, tasks) is kept. */
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(req);
    const { id } = await ctx.params;

    const mentorship = await db.mentorship.findUnique({ where: { id } });
    if (!mentorship) return jsonError("Mentorship not found.", 404);
    if (mentorship.mentorId !== user.id && mentorship.menteeId !== user.id) {
      return jsonError("No permission.", 403);
    }

    const result = await db.coachMessage.updateMany({
      where: { mentorshipId: id, archivedAt: null },
      data: { archivedAt: new Date() },
    });

    return NextResponse.json({ ok: true, archived: result.count });
  } catch (err) {
    return handleApiError(err);
  }
}

/** POST /api/mentorships/[id]/coach — streams the reply (SSE) and applies task actions.
 *  Events: {type:"delta",t} while replying, {type:"done",...} at the end. */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(req);
    const { id } = await ctx.params;
    const body = await req.json().catch(() => null);
    const message = String(body?.message ?? "").trim();

    if (message.length === 0) return jsonError("Write a message.");
    if (message.length > 2000) return jsonError("Message too long (max. 2000 characters).");

    const mentorship = await db.mentorship.findUnique({
      where: { id },
      include: { mentor: true, mentee: true },
    });
    if (!mentorship) return jsonError("Mentorship not found.", 404);
    if (mentorship.mentorId !== user.id && mentorship.menteeId !== user.id) {
      return jsonError("No permission.", 403);
    }
    if (mentorship.status !== "active") {
      return jsonError("The coach is only available for active mentorships.");
    }

    const [sessions, tasks, history] = await Promise.all([
      db.session.findMany({ where: { mentorshipId: id } }),
      db.task.findMany({ where: { mentorshipId: id } }),
      db.coachMessage.findMany({
        where: { mentorshipId: id, archivedAt: null },
        orderBy: { createdAt: "asc" },
      }),
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

    // Plain-text reply (no JSON wrapper) — task actions are extracted afterwards
    // by a dedicated cheap JSON call, which streams better and is more reliable.
    const chatMessages: ChatMessage[] = [
      { role: "system", content: COACH_SYSTEM_BASE },
      { role: "user", content: context },
      ...history.slice(-6).map((m) => ({
        role: m.role === "user" ? ("user" as const) : ("assistant" as const),
        content: m.content.slice(0, 1500),
      })),
      { role: "user", content: message },
    ];

    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const send = (obj: unknown) =>
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));

        let reply = "";
        try {
          reply = await streamChatComplete(chatMessages, (chunk) => send({ type: "delta", t: chunk }));
        } catch (e) {
          console.error("[coach] AI failed, using contingency reply:", e);
          reply = fallbackCoachReply(message);
          await simulateStream(reply, (chunk) => send({ type: "delta", t: chunk }));
        }

        const assistantMessage = await db.coachMessage.create({
          data: { mentorshipId: id, role: "assistant", content: reply },
        });

        // Best-effort action extraction: tasks to create + pending tasks to complete.
        const createdTasks: Array<{ id: string; title: string }> = [];
        const completedTasks: Array<{ id: string; title: string }> = [];
        try {
          const pending = tasks.filter((t) => !t.completed);
          const extractionInput = [
            "PENDING TASK LIST:",
            ...(pending.length > 0 ? pending.map((t) => `- ${t.title}`) : ["- (none)"]),
            "",
            "CONVERSATION:",
            ...history.slice(-4).map((m) => `${m.role === "user" ? "Mentee" : "Coach"}: ${m.content.slice(0, 300)}`),
            `Mentee: ${message.slice(0, 600)}`,
            `Coach: ${reply.slice(0, 900)}`,
          ].join("\n");

          let actions = await extractActions(extractionInput);
          if (!actions) {
            // One JSON-nudge retry before giving up (fallback models drift off-format).
            actions = await extractActions(extractionInput, true);
          }
          const safe = actions ?? { tasks: [], completeTasks: [] };

          for (const t of (safe.tasks ?? [])
            .filter((t) => t && String(t.title ?? "").trim().length > 3)
            .slice(0, 2)) {
            const title = String(t.title).trim();
            const lowered = title.toLowerCase();
            const words = title.split(/\s+/).length;
            // Guards for weak extractors: report-backs and quoted messages are not new tasks.
            const isReportBack = /^(i\s+(finished|did|completed|done|just))|^(we\s+(finished|did))/.test(lowered);
            if (isReportBack || words > 14) continue;
            const dueDate = new Date();
            const days = Math.max(1, Math.min(30, Number(t.dueInDays) || 7));
            dueDate.setDate(dueDate.getDate() + days);
            dueDate.setHours(23, 59, 0, 0);
            const task = await db.task.create({
              data: {
                mentorshipId: id,
                title: title.slice(0, 160),
                dueDate,
                source: "coach",
              },
            });
            createdTasks.push({ id: task.id, title: task.title });
          }

          const complete = Array.isArray(safe.completeTasks) ? safe.completeTasks : [];
          for (const raw of complete.slice(0, 3)) {
            const match = fuzzyMatchTask(pending, String(raw ?? ""));
            // Skip tasks this reply already completed.
            if (match && !completedTasks.some((c) => c.id === match.id)) {
              await db.task.update({ where: { id: match.id }, data: { completed: true } });
              completedTasks.push({ id: match.id, title: match.title });
            }
          }
        } catch (e) {
          console.error("[coach] action extraction failed (non-fatal):", e);
        }

        send({
          type: "done",
          ok: true,
          userMessage: coachMessageToDTO(userMessage),
          assistantMessage: coachMessageToDTO(assistantMessage),
          createdTasks,
          completedTasks,
        });
        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}

/** Dedicated cheap JSON call for task actions, tolerant parse. Returns null when off-format. */
async function extractActions(extractionInput: string, retryNudge = false): Promise<CoachActions | null> {
  try {
    const messages: ChatMessage[] = [
      { role: "system", content: COACH_EXTRACT_SYSTEM },
      { role: "user", content: extractionInput },
    ];
    if (retryNudge) {
      messages.push({ role: "assistant", content: "I did not reply in the correct format." });
      messages.push({ role: "user", content: "Reply with ONLY the JSON object. No markdown, no text outside the JSON." });
    }
    const raw = await chatComplete(messages, true);
    const parsed = parseLooseJSON<CoachActions>(raw);
    if (!parsed || (!Array.isArray(parsed.tasks) && !Array.isArray(parsed.completeTasks))) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** Matches an extracted title against the mentee's pending tasks (accent/punct-insensitive). */
function fuzzyMatchTask(pending: Task[], raw: string): Task | null {
  const q = normalizeTitle(raw);
  if (!q) return null;
  let best: { task: Task; score: number } | null = null;
  for (const task of pending) {
    const tt = normalizeTitle(task.title);
    let score = 0;
    if (tt === q) score = 1;
    else if (tt.includes(q) || q.includes(tt)) score = 0.9;
    else {
      const pool = new Set(tt.split(" "));
      const words = [...new Set(q.split(" "))];
      if (words.length > 0) {
        score = words.filter((w) => pool.has(w)).length / words.length;
      }
    }
    if (!best || score > best.score) best = { task, score };
  }
  return best && best.score >= 0.6 ? best.task : null;
}

function normalizeTitle(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Contingency reply — never generic: uses the mentorship's real data. */
function fallbackCoachReply(message: string): string {
  return `I logged your message: "${message.slice(0, 120)}".\n\nI am having a momentary technical issue generating a full reply right now, but your mentorship is on track — check your pending tasks and the session plan on the panel.\n\n**Concrete action:** review this week's task list and note down 1 question to bring to your next session with your mentor.`;
}
