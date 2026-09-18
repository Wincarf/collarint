// Helpers para API routes — resposta padronizada e tratamento de auth

import { NextResponse } from "next/server";
import { AuthError } from "./auth";

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export function handleApiError(err: unknown) {
  if (err instanceof AuthError) {
    return jsonError("Sessão expirada. Faça login novamente.", 401);
  }
  console.error("[api]", err);
  const message = err instanceof Error ? err.message : "Erro interno";
  return jsonError(message, 500);
}

export function parseJson<T>(raw: unknown): T {
  if (raw === null || raw === undefined) throw new Error("Corpo da requisição vazio");
  return raw as T;
}
