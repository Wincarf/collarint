import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { handleApiError, jsonError } from "@/lib/api-utils";
import { taskToDTO } from "@/lib/serialize";

export const dynamic = "force-dynamic";

/** PATCH /api/tasks/[id] — toggle completion | DELETE — remove */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(req);
    const { id } = await ctx.params;

    const task = await db.task.findUnique({
      where: { id },
      include: { mentorship: true },
    });
    if (!task) return jsonError("Task not found.", 404);
    if (task.mentorship.mentorId !== user.id && task.mentorship.menteeId !== user.id) {
      return jsonError("No permission.", 403);
    }

    const body = await req.json().catch(() => null);
    const completed =
      body && typeof body.completed === "boolean" ? body.completed : !task.completed;

    const updated = await db.task.update({
      where: { id },
      data: { completed },
    });

    return NextResponse.json({ ok: true, task: taskToDTO(updated) });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(req);
    const { id } = await ctx.params;

    const task = await db.task.findUnique({
      where: { id },
      include: { mentorship: true },
    });
    if (!task) return jsonError("Task not found.", 404);
    if (task.mentorship.mentorId !== user.id && task.mentorship.menteeId !== user.id) {
      return jsonError("No permission.", 403);
    }

    await db.task.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
