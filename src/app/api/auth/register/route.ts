import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hashPassword, setSessionCookie } from "@/lib/auth";
import { handleApiError, jsonError } from "@/lib/api-utils";
import { AVATAR_COLORS } from "@/lib/skills";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const email = String(body?.email ?? "").trim().toLowerCase();
    const name = String(body?.name ?? "").trim();
    const password = String(body?.password ?? "");

    if (!email || !email.includes("@")) return jsonError("Informe um email válido.");
    if (name.length < 2) return jsonError("Informe seu nome completo.");
    if (password.length < 6) return jsonError("A senha precisa ter no mínimo 6 caracteres.");

    const existing = await db.profile.findUnique({ where: { email } });
    if (existing) return jsonError("Já existe uma conta com este email. Faça login.", 409);

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
    return NextResponse.json({ ok: true, onboarded: false });
  } catch (err) {
    return handleApiError(err);
  }
}
