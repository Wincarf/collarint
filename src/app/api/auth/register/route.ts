import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hashPassword, createSessionToken, setSessionCookie } from "@/lib/auth";
import { handleApiError, jsonError, rateLimit, clientIp } from "@/lib/api-utils";
import { AVATAR_COLORS } from "@/lib/skills";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const email = String(body?.email ?? "").trim().toLowerCase();
    const name = String(body?.name ?? "").trim();
    const password = String(body?.password ?? "");

    if (!email || !email.includes("@") || email.length > 120) return jsonError("Please enter a valid email.");
    if (name.length < 2) return jsonError("Please enter your full name.");
    if (password.length < 6) return jsonError("The password needs at least 6 characters.");

    // Anti-abuse brake: 10 new accounts per minute per IP.
    if (!rateLimit(`register:${clientIp(req)}`, 10, 60_000)) {
      return jsonError("Too many accounts created from this connection. Please wait a minute.", 429);
    }

    const existing = await db.profile.findUnique({ where: { email } });
    if (existing) return jsonError("There is already an account with this email. Please sign in.", 409);

    let hash = 0;
    for (let i = 0; i < email.length; i++) hash = (hash * 31 + email.charCodeAt(i)) >>> 0;
    const avatarColor = AVATAR_COLORS[hash % AVATAR_COLORS.length];

    const profile = await db.profile.create({
      data: {
        email,
        name: name.slice(0, 80),
        passwordHash: hashPassword(password),
        avatarColor,
      },
    });

    await setSessionCookie(profile.id);
    // Token in the body as a fallback for environments that block cookies (iframe).
    return NextResponse.json({ ok: true, onboarded: false, token: createSessionToken(profile.id) });
  } catch (err) {
    return handleApiError(err);
  }
}
