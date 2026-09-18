// CSRF hardening for the API (Next.js 16 "proxy" convention, runs before routes).
//
// Browsers attach an Origin header to every cross-site POST/PATCH/PUT/DELETE —
// including form submissions with enctype="text/plain", which are NOT blocked
// by SameSite cookies alone. Since all mutating endpoints expect JSON, we
// reject any mutation that does not come from our own origin.
//
// Two signals, in order of trustworthiness:
//  1. Sec-Fetch-Site (every modern browser): the browser itself declares the
//     relationship between the page that fired the request and this origin.
//     "cross-site" is the classic CSRF vector and is rejected. This works
//     behind reverse proxies / preview gateways that rewrite the Host header,
//     because the browser only ever sees the public URL of the page.
//  2. Origin host fallback (legacy browsers without Sec-Fetch-): the Origin
//     host must equal Host or one of the X-Forwarded-Host entries (comma
//     list), so deployments behind a proxy that forwards the public host
//     keep working.
//
// Requests without an Origin header (curl, server-to-server) and same-origin
// GETs pass through, as before.

import { NextRequest, NextResponse } from "next/server";

function blocked() {
  return NextResponse.json(
    { error: "Cross-origin request blocked." },
    { status: 403 }
  );
}

export function proxy(req: NextRequest) {
  const method = req.method.toUpperCase();
  if (!req.headers.get("origin") || ["GET", "HEAD", "OPTIONS"].includes(method)) {
    return NextResponse.next();
  }

  // 1) Modern browsers: trust the browser's own site classification.
  const secFetchSite = req.headers.get("sec-fetch-site");
  if (secFetchSite) {
    if (secFetchSite === "cross-site") return blocked();
    return NextResponse.next();
  }

  // 2) Legacy fallback: Origin host must match Host / X-Forwarded-Host.
  try {
    const originHeader = req.headers.get("origin") as string;
    const originHost = new URL(originHeader).host;
    const forwarded = (req.headers.get("x-forwarded-host") ?? "")
      .split(",")
      .map((h) => h.trim())
      .filter(Boolean);
    const candidates = new Set([req.headers.get("host") ?? "", ...forwarded]);
    if (originHost && candidates.has(originHost)) {
      return NextResponse.next();
    }
    return blocked();
  } catch {
    return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
  }
}

export const config = {
  matcher: "/api/:path*",
};
