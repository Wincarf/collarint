import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { handleApiError, jsonError } from "@/lib/api-utils";
import { taskToDTO } from "@/lib/serialize";

export const dynamic = "force-dynamic";

/** GET /api/mentorships/[id]/tasks — lists the mentorship's tasks */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(req);
    const { id } = await ctx.params;

    const mentorship = await db.mentorship.findUnique({ where: { id } });
    if (!mentorship) return jsonError("Mentorship not found.", 404);
    if (mentorship.mentorId !== user.id && mentorship.menteeId !== user.id) {
      return jsonError("No permission.", 403);
    }

    const tasks = await db.task.findMany({
      where: { mentorshipId: id },
      orderBy: [{ completed: "asc" }, { dueDate: "asc" }],
    });

    return NextResponse.json({ tasks: tasks.map(taskToDTO) });
  } catch (err) {
    return handleApiError(err);
  }
}

/** POST /api/mentorships/[id]/tasks — creates a manual task */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(req);
    const { id } = await ctx.params;
    const body = await req.json().catch(() => null);
    const title = String(body?.title ?? "").trim().slice(0, 160);
    const dueDateStr = String(body?.dueDate ?? "");
    const dueDate = dueDateStr ? new Date(dueDateStr) : null;

    if (title.length < 3) return jsonError("Describe the task (minimum 3 characters).");

    const mentorship = await db.mentorship.findUnique({ where: { id } });
    if (!mentorship) return jsonError("Mentorship not found.", 404);
    if (mentorship.mentorId !== user.id && mentorship.menteeId !== user.id) {
      return jsonError("No permission.", 403);
    }

    const task = await db.task.create({
      data: {
        mentorshipId: id,
        title,
        dueDate: dueDate && !isNaN(dueDate.getTime()) ? dueDate : null,
        source: "user",
      },
    });

    return NextResponse.json({ ok: true, task: taskToDTO(task) });
  } catch (err) {
    return handleApiError(err);
  }
}
