// CSRF hardening for the API (Next.js 16 "proxy" convention, runs before routes).
//
// Browsers attach an Origin header to every cross-site POST/PATCH/PUT/DELETE —
// including form submissions with enctype="text/plain", which are NOT blocked
// by SameSite cookies alone. Since all mutating endpoints expect JSON, we
// reject any mutation whose Origin host does not match the deployment host.
// Requests without an Origin header (curl, server-to-server, same-origin GETs)
// pass through; JSON POSTs from our own pages always carry a same-origin
// Origin, including inside the preview iframe (the page itself is our origin).

import { NextRequest, NextResponse } from "next/server";

export function proxy(req: NextRequest) {
  const origin = req.headers.get("origin");
  if (!origin || ["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    return NextResponse.next();
  }

  try {
    const originHost = new URL(origin).host;
    const host =
      req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "";
    if (!originHost || originHost !== host) {
      return NextResponse.json(
        { error: "Cross-origin request blocked." },
        { status: 403 }
      );
    }
  } catch {
    return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/api/:path*",
};
