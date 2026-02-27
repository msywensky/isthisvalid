/**
 * SMTP result cache via Upstash Redis.
 *
 * Caches ZeroBounce / Emailable results so repeated checks of the same
 * email address skip the paid API entirely.
 *
 * Key:   itv:smtp:<sha256(lowercased email)>
 * TTL:   7 days (email deliverability status rarely changes faster)
 * No-op: when Redis is not configured (local dev without Upstash env vars)
 *
 * Privacy: Only the SHA-256 hash of the email is stored as the key.
 * The full EmailValidationResult is stored as the value (no raw email in key).
 */

import { createHash } from "crypto";
import { getRedis } from "@/lib/rate-limit";
import type { EmailValidationResult } from "@/lib/email-validator";

const TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days
const KEY_PREFIX = "itv:smtp:";

function cacheKey(email: string): string {
  const hash = createHash("sha256")
    .update(email.toLowerCase().trim())
    .digest("hex");
  return `${KEY_PREFIX}${hash}`;
}

/**
 * Returns a cached EmailValidationResult, or null on cache miss / no Redis.
 */
export async function getCachedSmtpResult(
  email: string,
): Promise<EmailValidationResult | null> {
  const redis = getRedis();
  if (!redis) return null;

  try {
    const cached = await redis.get<EmailValidationResult>(cacheKey(email));
    return cached ?? null;
  } catch (err) {
    console.warn("[smtp-cache] get error:", err);
    return null;
  }
}

/**
 * Stores an EmailValidationResult in Redis with a 7-day TTL.
 * Only caches results that came from an SMTP provider (not local-only).
 * No-op when Redis is not configured.
 */
export async function setCachedSmtpResult(
  email: string,
  result: EmailValidationResult,
): Promise<void> {
  const redis = getRedis();
  if (!redis) return;

  // Only cache results enriched by a real SMTP provider
  if (result.source === "local") return;

  try {
    await redis.set(cacheKey(email), result, { ex: TTL_SECONDS });
  } catch (err) {
    console.warn("[smtp-cache] set error:", err);
  }
}
