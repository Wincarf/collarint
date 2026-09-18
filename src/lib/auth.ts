// Autenticação por email+senha com cookie httpOnly assinado (HMAC-SHA256).
// Projetada para migrar para Supabase Auth sem alterar as telas: basta preencher
// as variáveis SUPABASE_* no .env e as telas continuam chamando os mesmos endpoints.

import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { db } from "./db";
import type { Profile } from "@prisma/client";

const COOKIE_NAME = "jci_session";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 dias

function authSecret(): string {
  return process.env.AUTH_SECRET || "jci-collarint-dev-secret-change-in-prod";
}

// ---------- senhas ----------

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const candidate = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  if (candidate.length !== expected.length) return false;
  return timingSafeEqual(candidate, expected);
}

// ---------- token ----------

function sign(value: string): string {
  return createHmac("sha256", authSecret()).update(value).digest("base64url");
}

export function createSessionToken(profileId: string): string {
  const payload = Buffer.from(
    JSON.stringify({ pid: profileId, exp: Date.now() + SESSION_TTL_MS })
  ).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

function parseSessionToken(token: string | undefined | null): string | null {
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  const expected = sign(payload);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (typeof data.pid !== "string" || typeof data.exp !== "number") return null;
    if (data.exp < Date.now()) return null;
    return data.pid;
  } catch {
    return null;
  }
}

// ---------- cookies ----------

export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  maxAge: SESSION_TTL_MS / 1000,
};

export async function setSessionCookie(profileId: string): Promise<void> {
  const store = await cookies();
  store.set(COOKIE_NAME, createSessionToken(profileId), SESSION_COOKIE_OPTIONS);
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.set(COOKIE_NAME, "", { ...SESSION_COOKIE_OPTIONS, maxAge: 0 });
}

// ---------- usuário atual ----------

export async function getSessionProfile(req?: NextRequest): Promise<Profile | null> {
  let token: string | undefined | null;
  if (req) {
    token = req.cookies.get(COOKIE_NAME)?.value;
  } else {
    const store = await cookies();
    token = store.get(COOKIE_NAME)?.value;
  }
  const pid = parseSessionToken(token);
  if (!pid) return null;
  return db.profile.findUnique({ where: { id: pid } });
}

export class AuthError extends Error {}

/** Para API routes: retorna o profile autenticado ou lança AuthError. */
export async function requireUser(req?: NextRequest): Promise<Profile> {
  const profile = await getSessionProfile(req);
  if (!profile) throw new AuthError("Não autenticado");
  return profile;
}
