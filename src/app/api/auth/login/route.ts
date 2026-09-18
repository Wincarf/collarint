import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createSessionToken, setSessionCookie, verifyPassword } from "@/lib/auth";
import { handleApiError, jsonError } from "@/lib/api-utils";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const email = String(body?.email ?? "").trim().toLowerCase();
    const password = String(body?.password ?? "");

    if (!email || !password) return jsonError("Informe email e senha.");

    const profile = await db.profile.findUnique({ where: { email } });
    if (!profile || !verifyPassword(password, profile.passwordHash)) {
      return jsonError("Email ou senha incorretos.", 401);
    }

    await setSessionCookie(profile.id);
    // O token também vai no corpo: o cliente o guarda e envia via header
    // x-session-token quando o ambiente bloqueia cookies (ex.: iframe cross-site).
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
