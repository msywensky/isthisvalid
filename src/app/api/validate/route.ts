import { NextRequest, NextResponse } from "next/server";
import { promises as dns } from "dns";
import { z } from "zod";
import {
  validateEmailLocal,
  applyMxResult,
  mergeSmtpResult,
} from "@/lib/email-validator";
import { getSmtpProvider } from "@/lib/smtp-provider";
import { checkRateLimit } from "@/lib/rate-limit";

const RequestSchema = z.object({
  email: z
    .string()
    .min(1, "Email is required")
    .max(254, "Email exceeds RFC 5321 max length") // RFC 5321 max
    .trim(),
});

/**
 * POST /api/validate
 *
 * Body: { email: string }
 * Returns: EmailValidationResult
 *
 * If EMAILABLE_API_KEY is set, results are enriched via the Emailable API.
 * Falls back to local regex + disposable-domain checks otherwise.
 *
 * Rate limiting: Not built-in here — use Vercel's Edge Middleware or an
 * upstream proxy (e.g. Vercel's built-in DDoS, or an Upstash Redis limiter)
 * for production. See ARCHITECTURE.md for details.
 */
export async function POST(req: NextRequest) {
  // Rate limiting (no-op if Upstash env vars are not set)
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

  // Parse + validate body
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

  const { email } = parsed.data;

  // Always run local checks first (free, instant)
  const localResult = validateEmailLocal(email);

  // Early exit for obviously invalid emails — no point calling paid API or DNS
  if (!localResult.checks.syntax) {
    return NextResponse.json(localResult, { headers: securityHeaders() });
  }

  // ── MX record check ────────────────────────────────────────────────────────
  // Verifies the domain has at least one mail server. Free, ~50 ms DNS lookup.
  // Saves Emailable credits by rejecting domains with no MX records upfront.
  const domain = email.split("@")[1];
  const hasMx = await resolveMx(domain);
  const resultWithMx = applyMxResult(localResult, hasMx);

  // Domain has no mail server — definitely undeliverable, skip paid API
  if (hasMx === false) {
    return NextResponse.json(resultWithMx, { headers: securityHeaders() });
  }

  // ── SMTP verification via pluggable provider ────────────────────────────────
  // ZeroBounce is used when ZEROBOUNCE_API_KEY is set (preferred — 100 free/month).
  // Falls back to Emailable when EMAILABLE_API_KEY is set.
  // Returns local+MX result if neither key is configured.
  const provider = getSmtpProvider();
  if (!provider) {
    return NextResponse.json(resultWithMx, { headers: securityHeaders() });
  }

  try {
    const smtpResult = await provider.verify(email);
    const merged = mergeSmtpResult(resultWithMx, smtpResult);
    return NextResponse.json(merged, { headers: securityHeaders() });
  } catch (err) {
    console.error(`[validate] ${provider.name} error:`, err);
    return NextResponse.json(resultWithMx, { headers: securityHeaders() });
  }
}

/** Minimal security headers for API responses */
function securityHeaders(): HeadersInit {
  return {
    "Content-Type": "application/json",
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": "no-store",
  };
}

/**
 * DNS MX record lookup with a 3 s timeout.
 * Returns:
 *   true  — at least one MX record found (domain can receive email)
 *   false — domain exists but has no MX records (ENODATA / ENOTFOUND)
 *   null  — DNS timeout or transient error (don’t penalise the user)
 */
async function resolveMx(domain: string): Promise<boolean | null> {
  const timeout = new Promise<null>((resolve) =>
    setTimeout(() => resolve(null), 3_000),
  );
  const lookup = dns
    .resolveMx(domain)
    .then((records) => records.length > 0)
    .catch((err: NodeJS.ErrnoException) => {
      const noMx = ["ENODATA", "ENOTFOUND", "ESERVFAIL", "EREFUSED"];
      return noMx.includes(err.code ?? "") ? false : null;
    });
  return Promise.race([lookup, timeout]);
}
