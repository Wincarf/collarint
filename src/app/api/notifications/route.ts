import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { handleApiError } from "@/lib/api-utils";
import { notificationToDTO } from "@/lib/serialize";

export const dynamic = "force-dynamic";

/** GET /api/notifications — lists the user's notifications */
export async function GET(req: NextRequest) {
  try {
    const user = await requireUser(req);
    const notifications = await db.notification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 30,
    });
    return NextResponse.json({
      notifications: notifications.map(notificationToDTO),
      unread: notifications.filter((n) => !n.read).length,
    });
  } catch (err) {
    return handleApiError(err);
  }
}

/** PATCH /api/notifications — marks all (or one) as read */
export async function PATCH(req: NextRequest) {
  try {
    const user = await requireUser(req);
    const body = await req.json().catch(() => null);
    const id = body?.id ? String(body.id) : null;

    await db.notification.updateMany({
      where: { userId: user.id, ...(id ? { id } : {}) },
      data: { read: true },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
