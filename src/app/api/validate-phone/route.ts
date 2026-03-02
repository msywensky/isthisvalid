import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { validatePhoneLocal } from "@/lib/phone-validator";
import { checkRateLimit } from "@/lib/rate-limit";

const RequestSchema = z.object({
  phone: z
    .string()
    .min(5, "Phone number is too short")
    .max(25, "Phone number is too long")
    .trim(),
});

function securityHeaders(): Record<string, string> {
  return {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
  };
}

/**
 * POST /api/validate-phone
 *
 * Body: { phone: string }
 * Returns: PhoneValidationResult
 *
 * Pipeline:
 *   1. Rate limit (Upstash, no-op if unconfigured)
 *   2. Zod validation
 *   3. validatePhoneLocal() — free, instant, libphonenumber-js
 *   4. Early exit if !parseable
 *   5. (Future) Carrier API enrichment gated on NUMVERIFY_API_KEY
 */
export async function POST(req: NextRequest) {
  // ── 1. Rate limit ───────────────────────────────────────────────────────────
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    req.headers.get("x-real-ip") ??
    "anonymous";

  const rl = await checkRateLimit(ip);
  if (!rl.success) {
    return NextResponse.json(
      { error: "Too many requests. Slow down a bit." },
      {
        status: 429,
        headers: {
          "Retry-After": rl.reset
            ? String(Math.ceil((rl.reset - Date.now()) / 1000))
            : "60",
        },
      },
    );
  }

  // ── 2. Parse + validate body ─────────────────────────────────────────────────
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 422 },
    );
  }

  const { phone } = parsed.data;

  // ── 3. Local checks (free, instant) ─────────────────────────────────────────
  const localResult = validatePhoneLocal(phone);

  // ── 4. Early exit for unparseable numbers ────────────────────────────────────
  if (!localResult.checks.parseable) {
    return NextResponse.json(localResult, {
      headers: securityHeaders(),
    });
  }

  // ── 5. Carrier API enrichment (future) ───────────────────────────────────────
  // When NUMVERIFY_API_KEY is set, call the carrier API and applyCarrierResult().
  // Currently a no-op — local result is returned directly.

  return NextResponse.json(localResult, { headers: securityHeaders() });
}
