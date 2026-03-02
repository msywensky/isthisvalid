import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { validatePhoneLocal, applyCarrierResult } from "@/lib/phone-validator";
import { getCarrierProvider } from "@/lib/carrier-provider";
import { checkRateLimit } from "@/lib/rate-limit";
import { getCachedPhoneResult, setCachedPhoneResult } from "@/lib/phone-cache";

// libphonenumber-js/max bundles ~1.5 MB of metadata that must be evaluated in
// Node.js. Without this, Next.js may place the route in the Edge runtime where
// the metadata bundle gets XHR-loaded — blocked as a cross-origin request.
export const runtime = "nodejs";

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
 *   5. Carrier API enrichment (AbstractAPI → NumVerify fallback, gated on env key)
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

  // ── 5. Carrier API enrichment ────────────────────────────────────────────────
  // AbstractAPI preferred (250 free/mo), NumVerify fallback (100 free/mo).
  // No-op when neither key is configured — local result returned directly.
  const carrier = getCarrierProvider();
  if (carrier && localResult.phoneE164) {
    const e164 = localResult.phoneE164;

    // ── 5a. Cache lookup ── hits avoid consuming monthly API quota ──────────────
    const cached = await getCachedPhoneResult(e164);
    if (cached) {
      return NextResponse.json(cached, { headers: securityHeaders() });
    }

    // ── 5b. Cache miss — call the carrier API ───────────────────────────────────
    try {
      const carrierData = await carrier.lookup(e164);
      const enriched = applyCarrierResult(localResult, carrierData);
      const withSource = { ...enriched, source: carrier.name };

      // Fire-and-forget cache write — don't add latency to the hot path
      void setCachedPhoneResult(e164, withSource);

      return NextResponse.json(withSource, { headers: securityHeaders() });
    } catch (err) {
      // Carrier API failure is non-fatal — return the local result.
      console.warn(
        `[validate-phone] Carrier API (${carrier.name}) failed:`,
        err,
      );
    }
  }

  return NextResponse.json(localResult, { headers: securityHeaders() });
}
