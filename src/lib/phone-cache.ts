/**
 * Carrier lookup result cache via Upstash Redis.
 *
 * Caches AbstractAPI / NumVerify results so repeated checks of the same
 * phone number skip the paid API entirely.
 *
 * Key:   itv:phone:<sha256(e164)>
 * TTL:   30 days (carrier assignment is stable; much slower to change than email)
 * No-op: when Redis is not configured (local dev without Upstash env vars)
 *
 * Normalisation: the E.164 form produced by libphonenumber-js is used as the
 * canonical key input. This means "+1 (800) 555-1234", "18005551234", and
 * "+1-800-555-1234" all produce the same cache key once the local validator
 * has parsed them into "+18005551234".
 *
 * Privacy: The raw phone number is NEVER stored — not in the key (hashed)
 * and not in the value. The fields `input`, `phoneE164`, `nationalFormat`,
 * and `internationalFormat` are stripped before writing; they are
 * re-hydrated by the caller (the API route) on read.
 */

import { createHash } from "crypto";
import { getRedis } from "@/lib/rate-limit";
import type { PhoneValidationResult } from "@/lib/phone-validator";

const TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days
const KEY_PREFIX = "itv:phone:";

function cacheKey(e164: string): string {
  const hash = createHash("sha256").update(e164).digest("hex");
  return `${KEY_PREFIX}${hash}`;
}

/** Subset of PhoneValidationResult that is safe to persist (no phone numbers). */
type CachedPhoneResult = Omit<
  PhoneValidationResult,
  "input" | "phoneE164" | "nationalFormat" | "internationalFormat"
>;

/**
 * Returns a cached PhoneValidationResult, or null on cache miss / no Redis.
 * Phone-number fields (`input`, `phoneE164`, `nationalFormat`,
 * `internationalFormat`) are re-stamped by the API route after this call.
 */
export async function getCachedPhoneResult(
  e164: string,
): Promise<CachedPhoneResult | null> {
  const redis = getRedis();
  if (!redis) return null;

  try {
    const cached = await redis.get<CachedPhoneResult>(cacheKey(e164));
    return cached ?? null;
  } catch (err) {
    console.warn("[phone-cache] get error:", err);
    return null;
  }
}

/**
 * Stores a PhoneValidationResult in Redis with a 30-day TTL.
 * Only caches results enriched by a real carrier API (not local-only).
 * No-op when Redis is not configured.
 */
export async function setCachedPhoneResult(
  e164: string,
  result: PhoneValidationResult,
): Promise<void> {
  const redis = getRedis();
  if (!redis) return;

  // Only cache results enriched by a real carrier provider
  if (result.source === "local") return;

  // Strip all phone-number-containing fields before persisting — they must
  // never appear in the Redis value. The API route re-hydrates them on read.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const {
    input: _input,
    phoneE164: _phoneE164,
    nationalFormat: _nationalFormat,
    internationalFormat: _internationalFormat,
    ...sanitized
  } = result;

  try {
    await redis.set(cacheKey(e164), sanitized, { ex: TTL_SECONDS });
  } catch (err) {
    console.warn("[phone-cache] set error:", err);
  }
}
