import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  callSightengine,
  isSightengineConfigured,
  getSightengineModelLabel,
} from "@/lib/sightengine-client";
import {
  checkRateLimit,
  checkDailyImageLimit,
  getRedis,
} from "@/lib/rate-limit";
import {
  isAcceptedMimeType,
  MAX_IMAGE_BYTES,
  SightengineRawResponseSchema,
  normalizeProviderResponse,
  type ImageDebunkResult,
} from "@/lib/image-debunker";

const CACHE_TTL_SECONDS = 86_400; // 24 hours
const CACHE_PREFIX = "itv:image:";

function cacheKey(bytes: Uint8Array): string {
  return CACHE_PREFIX + createHash("sha256").update(bytes).digest("hex");
}

/**
 * POST /api/debunk/image
 *
 * Body: multipart/form-data with field "file" (binary image)
 * Returns: ImageDebunkResult
 *
 * Pipeline:
 *   1. Per-minute rate limit
 *   2. SightEngine availability check
 *   3. Parse + validate FormData (MIME, size)
 *   4. SHA-256 of bytes
 *   5. Cache lookup  ← hits return here, daily budget not consumed
 *   6. Per-day spend cap
 *   7. Call SightEngine
 *   8. Validate raw response (Zod)
 *   9. Normalize + coerce
 *  10. Cache write
 */
export async function POST(req: NextRequest) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    req.headers.get("x-real-ip") ??
    "anonymous";

  // ── Per-minute rate limit ──────────────────────────────────────────────────
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

  // ── SightEngine availability check ────────────────────────────────────────
  if (!isSightengineConfigured()) {
    return NextResponse.json(
      { error: "Image analysis is not configured. Please try again later." },
      { status: 503 },
    );
  }

  // ── Parse FormData ─────────────────────────────────────────────────────────
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data." }, { status: 400 });
  }

  const file = form.get("file");
  if (!file || !(file instanceof Blob)) {
    return NextResponse.json(
      { error: "Missing or invalid file field." },
      { status: 422 },
    );
  }

  if (!isAcceptedMimeType(file.type)) {
    return NextResponse.json(
      {
        error:
          "Unsupported file type. Please upload a JPEG, PNG, WebP, or GIF.",
      },
      { status: 422 },
    );
  }

  if (file.size > MAX_IMAGE_BYTES) {
    return NextResponse.json(
      { error: "File too large. Maximum size is 4 MB." },
      { status: 422 },
    );
  }

  // ── Read bytes + compute hash ─────────────────────────────────────────────
  const bytes = new Uint8Array(await file.arrayBuffer());
  const key = cacheKey(bytes);
  const redis = getRedis();

  // ── Cache lookup (before daily cap — hits are free) ───────────────────────
  if (redis) {
    try {
      const cached = await redis.get<ImageDebunkResult>(key);
      if (cached) {
        return NextResponse.json(cached, {
          headers: {
            "Cache-Control": "no-store",
            "X-Content-Type-Options": "nosniff",
            "X-Cache": "HIT",
          },
        });
      }
    } catch (err) {
      console.warn("[debunk/image] Cache read failed:", err);
    }
  }

  // ── Per-day spend cap — only burned on a cache miss ──────────────────────
  const daily = await checkDailyImageLimit(ip);
  if (!daily.success) {
    return NextResponse.json(
      {
        error:
          "You've reached the daily limit for image analysis. Please try again tomorrow.",
      },
      {
        status: 429,
        headers: {
          "Retry-After": daily.reset
            ? String(Math.ceil((daily.reset - Date.now()) / 1000))
            : "86400",
        },
      },
    );
  }

  // ── Call SightEngine ──────────────────────────────────────────────────────
  const filename = file instanceof File ? file.name || "upload" : "upload";
  let rawResponse: unknown;
  try {
    rawResponse = await callSightengine(bytes, file.type, filename);
  } catch (err) {
    console.error("[debunk/image] SightEngine API error:", err);
    return NextResponse.json(
      { error: "Image analysis failed. Please try again." },
      { status: 502 },
    );
  }

  if (!rawResponse) {
    return NextResponse.json(
      { error: "Image analysis is not available." },
      { status: 503 },
    );
  }

  // ── Validate raw SightEngine response ─────────────────────────────────────
  const parsed = SightengineRawResponseSchema.safeParse(rawResponse);
  if (!parsed.success) {
    console.error(
      "[debunk/image] SightEngine response failed schema validation:",
      parsed.error.issues,
    );
    return NextResponse.json(
      { error: "Unexpected response from image analysis. Please try again." },
      { status: 502 },
    );
  }

  // ── Normalize + coerce ────────────────────────────────────────────────────
  const normalized = normalizeProviderResponse(parsed.data);
  const result: ImageDebunkResult = {
    ...normalized,
    modelLabel: getSightengineModelLabel(),
  };

  // ── Cache write (fire-and-forget) ─────────────────────────────────────────
  if (redis) {
    redis
      .set(key, result, { ex: CACHE_TTL_SECONDS })
      .catch((err) => console.warn("[debunk/image] Cache write failed:", err));
  }

  return NextResponse.json(result, {
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "X-Cache": "MISS",
    },
  });
}
