// Helpers for API routes — standardized responses and auth handling

import { NextResponse } from "next/server";
import { AuthError } from "./auth";

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export function handleApiError(err: unknown) {
  if (err instanceof AuthError) {
    return jsonError("Session expired. Please sign in again.", 401);
  }
  console.error("[api]", err);
  // Internal details (e.g. database errors) stay in the server log — the
  // client only gets a generic message, so nothing about the implementation
  // leaks through error responses.
  return jsonError("Something went wrong on our side. Please try again.", 500);
}

// ---------- lightweight in-memory rate limiting (demo scale) ----------

// Sliding window of timestamps per key. Enough to stop runaway loops and
// brute-force attempts in the demo; a production deployment would swap this
// for a shared store (e.g. Redis/Supabase edge limits).
const buckets = new Map<string, number[]>();

export function rateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const hits = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (hits.length >= max) {
    buckets.set(key, hits);
    return false;
  }
  hits.push(now);
  buckets.set(key, hits);
  // Opportunistic cleanup so the map cannot grow unbounded.
  if (buckets.size > 5000) {
    for (const [k, v] of buckets) {
      if (v.every((t) => now - t > windowMs)) buckets.delete(k);
    }
  }
  return true;
}

/** Client IP as seen by the platform (behind the HTTPS proxy), for coarse limits. */
export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "local";
}
