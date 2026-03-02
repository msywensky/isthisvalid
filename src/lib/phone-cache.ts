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
 * Privacy: Only the SHA-256 hash of the E.164 number is stored as the key.
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

/**
 * Returns a cached PhoneValidationResult, or null on cache miss / no Redis.
 */
export async function getCachedPhoneResult(
  e164: string,
): Promise<PhoneValidationResult | null> {
  const redis = getRedis();
  if (!redis) return null;

  try {
    const cached = await redis.get<PhoneValidationResult>(cacheKey(e164));
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

  try {
    await redis.set(cacheKey(e164), result, { ex: TTL_SECONDS });
  } catch (err) {
    console.warn("[phone-cache] set error:", err);
  }
}
