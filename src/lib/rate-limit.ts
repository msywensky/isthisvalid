/**
 * Rate limiting via Upstash Redis + @upstash/ratelimit.
 *
 * Activates only when UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN are
 * set. Falls back to no-op (returns success: true) when not configured, so
 * local dev and no-key deploys work without changes.
 *
 * Limits:
 *   - General tools:   20 requests / minute per IP  (sliding window)
 *   - Text/LLM tool:  20 requests / day   per IP  (fixed window, cost protection)
 */
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const { UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN } = process.env;

let _redis: Redis | null = null;
let _limiter: Ratelimit | null = null;
let _dailyTextLimiter: Ratelimit | null = null;

/** Returns the shared Redis client, or null when not configured. */
export function getRedis(): Redis | null {
  return _redis;
}

if (UPSTASH_REDIS_REST_URL && UPSTASH_REDIS_REST_TOKEN) {
  _redis = new Redis({
    url: UPSTASH_REDIS_REST_URL,
    token: UPSTASH_REDIS_REST_TOKEN,
  });

  // General per-minute limiter — shared across email + URL tools
  _limiter = new Ratelimit({
    redis: _redis,
    limiter: Ratelimit.slidingWindow(20, "1 m"),
    analytics: false,
    prefix: "itv:rl",
  });

  // Per-day limiter — text/SMS tool only, protects LLM spend
  // 20 requests per IP per 24-hour window. Rotating-IP abusers are handled
  // by the Anthropic spend cap set in the Anthropic console.
  _dailyTextLimiter = new Ratelimit({
    redis: _redis,
    limiter: Ratelimit.fixedWindow(20, "1 d"),
    analytics: false,
    prefix: "itv:daily:text",
  });
}

type LimitResult = { success: boolean; remaining?: number; reset?: number };

/**
 * Check whether the given identifier (IP address) is within the per-minute
 * rate limit. Returns `{ success: true }` when rate limiting is not configured.
 */
export async function checkRateLimit(identifier: string): Promise<LimitResult> {
  if (!_limiter) return { success: true };
  const result = await _limiter.limit(identifier);
  return {
    success: result.success,
    remaining: result.remaining,
    reset: result.reset,
  };
}

/**
 * Check the per-day cap for the text/LLM route.
 * Limit: 20 calls per IP per 24-hour fixed window.
 * Returns `{ success: true }` when rate limiting is not configured.
 */
export async function checkDailyTextLimit(
  identifier: string,
): Promise<LimitResult> {
  if (!_dailyTextLimiter) return { success: true };
  const result = await _dailyTextLimiter.limit(identifier);
  return {
    success: result.success,
    remaining: result.remaining,
    reset: result.reset,
  };
}
