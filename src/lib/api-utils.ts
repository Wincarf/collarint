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
  const message = err instanceof Error ? err.message : "Internal error";
  return jsonError(message, 500);
}

export function parseJson<T>(raw: unknown): T {
  if (raw === null || raw === undefined) throw new Error("Empty request body");
  return raw as T;
}
