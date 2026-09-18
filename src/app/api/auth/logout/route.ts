import { NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/auth";
import { handleApiError } from "@/lib/api-utils";

export async function POST() {
  try {
    await clearSessionCookie();
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
