// Email+password authentication with a signed httpOnly cookie (HMAC-SHA256).
// Designed to migrate to Supabase Auth without changing the screens: just fill
// the SUPABASE_* variables in .env and the screens keep calling the same endpoints.

import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies, headers } from "next/headers";
import type { NextRequest } from "next/server";
import { db } from "./db";
import type { Profile } from "@prisma/client";

const COOKIE_NAME = "jci_session";
const HEADER_NAME = "x-session-token";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 dias

let warnedAboutSecret = false;

function authSecret(): string {
  if (!process.env.AUTH_SECRET && !warnedAboutSecret) {
    warnedAboutSecret = true;
    console.warn("[auth] AUTH_SECRET is not set — using the development fallback. Set it in .env before deploying.");
  }
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

// The platform runs behind an HTTPS proxy (see Caddyfile) and may be displayed
// inside an iframe of a different origin. "Lax" cookies are dropped in that
// context by modern browsers, which used to break the login. When the request
// comes over HTTPS we use SameSite=None; Secure (accepted in iframes); in local
// http dev we keep lax, since "none" requires "secure".
async function isSecureRequest(): Promise<boolean> {
  try {
    const h = await headers();
    const proto = h.get("x-forwarded-proto") ?? "";
    return proto.split(",")[0]?.trim() === "https";
  } catch {
    return false;
  }
}

async function sessionCookieOptions(maxAge = SESSION_TTL_MS / 1000) {
  const secure = await isSecureRequest();
  return {
    httpOnly: true,
    sameSite: (secure ? "none" : "lax") as "none" | "lax",
    secure,
    path: "/",
    maxAge,
  };
}

export async function setSessionCookie(profileId: string): Promise<void> {
  const store = await cookies();
  store.set(COOKIE_NAME, createSessionToken(profileId), await sessionCookieOptions());
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.set(COOKIE_NAME, "", await sessionCookieOptions(0));
}

// ---------- current user ----------

// The session is resolved first from the x-session-token header (robust
// fallback for environments that block third-party cookies, e.g. preview in
// an iframe) and then from the httpOnly cookie (primary path).
export async function getSessionProfile(req?: NextRequest): Promise<Profile | null> {
  let token: string | undefined | null;
  if (req) {
    token = req.cookies.get(COOKIE_NAME)?.value ?? req.headers.get(HEADER_NAME);
  } else {
    const [store, h] = await Promise.all([cookies(), headers()]);
    token = store.get(COOKIE_NAME)?.value ?? h.get(HEADER_NAME);
  }
  const pid = parseSessionToken(token);
  if (!pid) return null;
  return db.profile.findUnique({ where: { id: pid } });
}

export class AuthError extends Error {}

/** For API routes: returns the authenticated profile or throws AuthError. */
export async function requireUser(req?: NextRequest): Promise<Profile> {
  const profile = await getSessionProfile(req);
  if (!profile) throw new AuthError("Not authenticated");
  return profile;
}
