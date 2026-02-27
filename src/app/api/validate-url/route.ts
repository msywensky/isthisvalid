import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  validateUrlLocal,
  applyHeadResult,
  applySafeBrowsingResult,
  applyRdapResult,
  applyRedirectResult,
  getRegisteredDomain,
} from "@/lib/url-validator";
import { checkRateLimit } from "@/lib/rate-limit";

const RequestSchema = z.object({
  url: z
    .string()
    .min(1, "URL is required")
    .max(2048, "URL exceeds maximum length")
    .trim(),
});

/**
 * POST /api/validate-url
 *
 * Body: { url: string }
 * Returns: UrlValidationResult
 *
 * Pipeline:
 *   1. Rate limit (Upstash, no-op if unconfigured)
 *   2. validateUrlLocal() — free, instant
 *   3. HEAD request — does the URL actually resolve?
 *   4. Google Safe Browsing API — known malware/phishing lists
 */
export async function POST(req: NextRequest) {
  // Rate limiting — shared key space with email validation
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

  const { url } = parsed.data;

  // Local checks (free, instant)
  const localResult = validateUrlLocal(url);

  // Early exit for unparseable URLs — no point doing network checks
  if (!localResult.checks.parseable) {
    return NextResponse.json(localResult, { headers: securityHeaders() });
  }

  // ── HEAD request + RDAP domain-age check (parallel) ─────────────────────
  // HEAD checks whether the URL resolves (and follows redirects).
  // RDAP determines how long ago the domain was registered.
  // SSRF guard: skip server-side fetch for private/reserved hosts.
  const targetHostname = new URL(localResult.url).hostname;
  const registeredDomain = getRegisteredDomain(targetHostname);
  const headCheck: Promise<{
    resolves: boolean | null;
    finalUrl: string | null;
  }> = isPrivateHost(targetHostname)
    ? Promise.resolve({ resolves: null, finalUrl: null })
    : checkResolves(localResult.url);
  const [{ resolves, finalUrl }, isOldDomain] = await Promise.all([
    headCheck,
    checkDomainAge(registeredDomain),
  ]);
  let resultWithHead = applyHeadResult(localResult, resolves);

  // If the URL redirected to a different domain, analyse the destination
  if (finalUrl) {
    try {
      const destHostname = new URL(finalUrl).hostname;
      if (destHostname !== targetHostname) {
        const destLocal = validateUrlLocal(finalUrl);
        resultWithHead = applyRedirectResult(
          resultWithHead,
          destLocal,
          finalUrl,
        );
      }
    } catch {
      // Invalid redirect URL — ignore
    }
  }

  // Merge RDAP domain-age result
  const resultWithRdap = applyRdapResult(resultWithHead, isOldDomain);

  // ── Google Safe Browsing ──────────────────────────────────────────────────
  // Docs: https://developers.google.com/safe-browsing/v4/lookup-api
  // Free tier: 10 000 requests / day.
  const safeBrowsingKey = process.env.GOOGLE_SAFE_BROWSING_API_KEY;
  if (!safeBrowsingKey) {
    return NextResponse.json(resultWithRdap, { headers: securityHeaders() });
  }

  // Early exit: already clearly dangerous — skip Google to save quota.
  if (resultWithRdap.score < 50) {
    return NextResponse.json(resultWithRdap, { headers: securityHeaders() });
  }

  try {
    const isFlagged = await checkSafeBrowsing(localResult.url, safeBrowsingKey);
    const final = applySafeBrowsingResult(resultWithRdap, isFlagged);
    return NextResponse.json(final, { headers: securityHeaders() });
  } catch (err) {
    // Safe Browsing was configured but failed — cap the score so we don't
    // show a falsely clean result. The user is warned via safeBrowsingError.
    console.error("[validate-url] Safe Browsing API error:", err);
    const cappedScore = Math.min(resultWithRdap.score, 75);
    const degraded: typeof resultWithRdap = {
      ...resultWithRdap,
      score: cappedScore,
      safe: cappedScore >= 80 && resultWithRdap.safe,
      safeBrowsingError: true,
    };
    return NextResponse.json(degraded, { headers: securityHeaders() });
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Sends a HEAD request to the URL and follows up to 5 redirects manually,
 * returning both the resolve status and the final destination URL (if
 * the chain ended on a different domain than the original).
 *
 * Returns:
 *   resolves: true  — a server responded at some hop
 *             false — NXDOMAIN / domain does not exist
 *             null  — timeout or transient error (don't penalise)
 *   finalUrl: the last URL in the redirect chain, or null if no redirect
 */
async function checkResolves(
  url: string,
): Promise<{ resolves: boolean | null; finalUrl: string | null }> {
  const MAX_REDIRECTS = 5;
  let currentUrl = url;

  for (let i = 0; i <= MAX_REDIRECTS; i++) {
    try {
      const res = await fetch(currentUrl, {
        method: "HEAD",
        redirect: "manual",
        signal: AbortSignal.timeout(5_000),
        headers: {
          "User-Agent": "IsThisValid-Bot/1.0 (+https://isthisvalid.com)",
        },
      });

      if (res.status < 600) {
        const isRedirect = res.status >= 300 && res.status < 400;
        const location = res.headers.get("location");

        if (isRedirect && location && i < MAX_REDIRECTS) {
          try {
            const nextUrl = new URL(location, currentUrl).href;
            if (nextUrl === currentUrl) break; // circular redirect
            currentUrl = nextUrl;
            continue;
          } catch {
            break; // invalid redirect URL
          }
        }

        const finalUrl = currentUrl !== url ? currentUrl : null;
        return { resolves: true, finalUrl };
      }
      return { resolves: false, finalUrl: null };
    } catch (err: unknown) {
      if (err instanceof TypeError) {
        const cause = (err as TypeError & { cause?: { code?: string } }).cause;
        const code = cause?.code ?? "";
        if (
          code === "ENOTFOUND" ||
          code === "EAI_NONAME" ||
          code === "EAI_AGAIN"
        ) {
          return { resolves: false, finalUrl: null };
        }
      }
      return { resolves: null, finalUrl: null };
    }
  }

  // Max redirects reached — server is alive but chain is unusually long
  const finalUrl = currentUrl !== url ? currentUrl : null;
  return { resolves: true, finalUrl };
}

/**
 * Queries rdap.org (a unified RDAP aggregator) to determine when a domain
 * was first registered.
 *
 * Returns:
 *   true  — domain was registered ≥ 30 days ago (not newly registered)
 *   false — domain was registered < 30 days ago (high phishing risk)
 *   null  — RDAP unavailable, no registration event, or timeout
 */
async function checkDomainAge(domain: string): Promise<boolean | null> {
  try {
    const res = await fetch(
      `https://rdap.org/domain/${encodeURIComponent(domain)}`,
      {
        headers: { Accept: "application/rdap+json" },
        signal: AbortSignal.timeout(4_000),
      },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      events?: Array<{ eventAction: string; eventDate: string }>;
    };
    const registration = (data.events ?? []).find(
      (e) => e.eventAction === "registration",
    );
    if (!registration) return null;
    const regDate = new Date(registration.eventDate);
    if (isNaN(regDate.getTime())) return null;
    const ageDays = (Date.now() - regDate.getTime()) / (1000 * 60 * 60 * 24);
    return ageDays >= 30;
  } catch {
    return null;
  }
}

/**
 * Queries the Google Safe Browsing v4 Lookup API.
 * Docs: https://developers.google.com/safe-browsing/v4/lookup-api
 *
 * Uses POST with a JSON body — the v5 REST endpoint returns protobuf by
 * default and does not support JSON output, so we use v4 which is a proper
 * JSON REST API using the same API key.
 *
 * Returns true if the URL is listed in any threat list, false if clean.
 * Throws on API error (call site handles graceful fallback).
 */
async function checkSafeBrowsing(
  url: string,
  apiKey: string,
): Promise<boolean> {
  const endpoint = `https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${encodeURIComponent(apiKey)}`;

  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client: { clientId: "isthisvalid", clientVersion: "1.0" },
      threatInfo: {
        threatTypes: [
          "MALWARE",
          "SOCIAL_ENGINEERING",
          "UNWANTED_SOFTWARE",
          "POTENTIALLY_HARMFUL_APPLICATION",
        ],
        platformTypes: ["ANY_PLATFORM"],
        threatEntryTypes: ["URL"],
        threatEntries: [{ url }],
      },
    }),
    signal: AbortSignal.timeout(5_000),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `Safe Browsing API returned ${res.status}: ${body.trim() || "[no body]"}`,
    );
  }

  const data = (await res.json()) as { matches?: unknown[] };
  // `matches` is absent or empty when clean; present with entries when flagged
  return Array.isArray(data.matches) && data.matches.length > 0;
}

function securityHeaders(): HeadersInit {
  return {
    "Content-Type": "application/json",
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": "no-store",
  };
}

/**
 * Returns true if the hostname is in private/reserved address space.
 * Prevents SSRF by refusing to issue server-side HEAD requests to
 * loopback, RFC-1918 ranges, link-local, or special-use hostnames.
 */
function isPrivateHost(hostname: string): boolean {
  const h = hostname.toLowerCase();

  // Named special-use hostnames
  if (h === "localhost" || h.endsWith(".local") || h.endsWith(".internal")) {
    return true;
  }

  // IPv6 loopback (URL API stores brackets: [::1])
  if (h === "[::1]" || h === "::1") return true;

  // Other reserved IPv6 ranges (brackets included when from URL API)
  const ipv6Host = h.startsWith("[") && h.endsWith("]") ? h.slice(1, -1) : h;
  if (
    ipv6Host.startsWith("fc") || // fc00::/7 unique-local (fc00–fdff)
    ipv6Host.startsWith("fd") || // fc00::/7 unique-local
    ipv6Host.startsWith("fe8") || // fe80::/10 link-local
    ipv6Host.startsWith("fe9") ||
    ipv6Host.startsWith("fea") ||
    ipv6Host.startsWith("feb") ||
    ipv6Host.startsWith("::ffff:") || // IPv4-mapped IPv6
    ipv6Host.startsWith("2001:db8:") || // 2001:db8::/32 documentation
    ipv6Host === "::" // unspecified
  ) {
    return true;
  }

  // Dotted-decimal IPv4 — check against reserved CIDR blocks
  const m = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (m) {
    const [a, b] = [Number(m[1]), Number(m[2])];
    if (a === 0) return true; // 0.0.0.0/8
    if (a === 10) return true; // 10.0.0.0/8
    if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 (shared)
    if (a === 127) return true; // 127.0.0.0/8 loopback
    if (a === 169 && b === 254) return true; // 169.254.0.0/16 link-local
    if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
    if (a === 192 && b === 168) return true; // 192.168.0.0/16
    if (a === 198 && (b === 18 || b === 19)) return true; // 198.18.0.0/15
    if (a === 203 && b === 0 && Number(m[3]) === 113) return true; // 203.0.113.0/24 (TEST-NET)
  }

  return false;
}
