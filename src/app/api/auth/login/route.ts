import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createSessionToken, setSessionCookie, verifyPassword } from "@/lib/auth";
import { handleApiError, jsonError, rateLimit, clientIp } from "@/lib/api-utils";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const email = String(body?.email ?? "").trim().toLowerCase();
    const password = String(body?.password ?? "");

    if (!email || !password) return jsonError("Please enter your email and password.");

    // Brute-force brake: 10 attempts per minute per email+IP.
    if (!rateLimit(`login:${email}:${clientIp(req)}`, 10, 60_000)) {
      return jsonError("Too many sign-in attempts. Please wait a minute and try again.", 429);
    }

    const profile = await db.profile.findUnique({ where: { email } });
    if (!profile || !verifyPassword(password, profile.passwordHash)) {
      return jsonError("Incorrect email or password.", 401);
    }

    await setSessionCookie(profile.id);
    // The token also goes in the body: the client stores it and sends it via the
    // x-session-token header when the environment blocks cookies (cross-site iframe).
    return NextResponse.json({
      ok: true,
      onboarded: profile.onboarded,
      isAdmin: profile.isAdmin,
      token: createSessionToken(profile.id),
    });
  } catch (err) {
    return handleApiError(err);
  }
}
