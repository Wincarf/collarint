import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { handleApiError, jsonError } from "@/lib/api-utils";
import { mentorshipToDTO } from "@/lib/serialize";

export const dynamic = "force-dynamic";

/** GET /api/mentorships/[id] — detalhe completo da mentoria (apenas participantes) */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(req);
    const { id } = await ctx.params;

    const mentorship = await db.mentorship.findUnique({
      where: { id },
      include: { mentor: true, mentee: true, sessions: true, tasks: true, sessionPreps: true },
    });

    if (!mentorship) return jsonError("Mentoria não encontrada.", 404);
    if (mentorship.mentorId !== user.id && mentorship.menteeId !== user.id && !user.isAdmin) {
      return jsonError("Sem permissão para ver esta mentoria.", 403);
    }

    return NextResponse.json({ mentorship: mentorshipToDTO(mentorship) });
  } catch (err) {
    return handleApiError(err);
  }
}
