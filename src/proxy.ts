/**
 * Next.js Edge Middleware
 *
 * Responsibilities:
 *   1. CORS — lock API routes to known origins.
 *      Browser-initiated cross-origin POST requests from third-party sites
 *      are rejected with 403. Direct server-to-server calls (no Origin header)
 *      are allowed (curl, Postman, health checks, etc.).
 *
 * Rate limiting is intentionally kept per-route (not here) because the text
 * route has a separate daily spend cap that the other routes don't share.
 */
import { NextRequest, NextResponse } from "next/server";

// Origins that may call the API from a browser.
// In production only the canonical domain is allowed.
// In development localhost is added automatically.
const ALLOWED_ORIGINS: ReadonlySet<string> = new Set([
  "https://isthisvalid.com",
  "https://www.isthisvalid.com",
  ...(process.env.NODE_ENV !== "production"
    ? ["http://localhost:3000", "http://127.0.0.1:3000"]
    : []),
]);

const CORS_HEADERS_ALLOWED = {
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
} as const;

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Only intercept API routes — all other routes pass through untouched.
  if (!pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  const origin = req.headers.get("origin");

  // ── CORS preflight ────────────────────────────────────────────────────────
  if (req.method === "OPTIONS") {
    if (!origin || !ALLOWED_ORIGINS.has(origin)) {
      // Unknown origin — deny preflight so the browser won't send the actual request.
      return new NextResponse(null, { status: 403 });
    }
    const res = new NextResponse(null, { status: 204 });
    res.headers.set("Access-Control-Allow-Origin", origin);
    Object.entries(CORS_HEADERS_ALLOWED).forEach(([k, v]) =>
      res.headers.set(k, v),
    );
    return res;
  }

  // ── Cross-origin request from an untrusted browser origin ─────────────────
  // Requests with NO Origin header are direct/server-to-server calls and are
  // allowed. Only browser-initiated cross-origin requests carry an Origin header.
  if (origin && !ALLOWED_ORIGINS.has(origin)) {
    return NextResponse.json(
      { error: "Cross-origin requests are not allowed." },
      { status: 403 },
    );
  }

  // ── Allowed request — pass through, add CORS header for the response ──────
  const res = NextResponse.next();
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    res.headers.set("Access-Control-Allow-Origin", origin);
  }
  return res;
}

export const config = {
  // Run only on API routes — skip static assets, _next internals, etc.
  matcher: ["/api/:path*"],
};
