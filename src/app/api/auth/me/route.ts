import { NextResponse } from "next/server";
import { getSessionProfile } from "@/lib/auth";
import { profileToDTO } from "@/lib/serialize";
import { handleApiError } from "@/lib/api-utils";

export async function GET() {
  try {
    const profile = await getSessionProfile();
    if (!profile) return NextResponse.json({ user: null });
    return NextResponse.json({ user: profileToDTO(profile) });
  } catch (err) {
    return handleApiError(err);
  }
}
