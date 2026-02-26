/**
 * Unit tests for src/lib/smtp-cache.ts
 *
 * Redis and rate-limit module are mocked so tests run offline with no
 * Upstash credentials required.
 */

import { getCachedSmtpResult, setCachedSmtpResult } from "@/lib/smtp-cache";
import type { EmailValidationResult } from "@/lib/email-validator";

// ── Mocks ────────────────────────────────────────────────────────────────────

jest.mock("@/lib/rate-limit");

import { getRedis } from "@/lib/rate-limit";

const mockGetRedis = getRedis as jest.MockedFunction<typeof getRedis>;

// Build a reusable mock Redis object matching the subset of the Upstash client
// that smtp-cache.ts actually calls.
function makeMockRedis(overrides: Partial<{ get: jest.Mock; set: jest.Mock }> = {}) {
  return {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue("OK"),
    ...overrides,
  };
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

const ZEROBOUNCE_RESULT: EmailValidationResult = {
  email: "user@example.com",
  valid: true,
  score: 100,
  source: "zerobounce",
  message: "Looking good!",
  checks: {
    syntax: true,
    notDisposable: true,
    notRole: true,
    validTld: true,
    hasMx: true,
    apiDeliverable: true,
  },
};

const EMAILABLE_RESULT: EmailValidationResult = {
  ...ZEROBOUNCE_RESULT,
  source: "emailable",
};

const LOCAL_RESULT: EmailValidationResult = {
  ...ZEROBOUNCE_RESULT,
  source: "local",
  score: 85,
  checks: { ...ZEROBOUNCE_RESULT.checks, apiDeliverable: null },
};

// ── getCachedSmtpResult ───────────────────────────────────────────────────────

describe("getCachedSmtpResult", () => {
  beforeEach(() => jest.resetAllMocks());

  it("returns null when Redis is not configured", async () => {
    mockGetRedis.mockReturnValue(null);
    const result = await getCachedSmtpResult("user@example.com");
    expect(result).toBeNull();
  });

  it("returns null on a cache miss (redis.get returns null)", async () => {
    const redis = makeMockRedis({ get: jest.fn().mockResolvedValue(null) });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockGetRedis.mockReturnValue(redis as any);

    const result = await getCachedSmtpResult("user@example.com");
    expect(result).toBeNull();
    expect(redis.get).toHaveBeenCalledTimes(1);
  });

  it("returns a cached EmailValidationResult on a cache hit", async () => {
    const redis = makeMockRedis({
      get: jest.fn().mockResolvedValue(ZEROBOUNCE_RESULT),
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockGetRedis.mockReturnValue(redis as any);

    const result = await getCachedSmtpResult("user@example.com");
    expect(result).toEqual(ZEROBOUNCE_RESULT);
  });

  it("returns null and does not throw when redis.get rejects", async () => {
    const redis = makeMockRedis({
      get: jest.fn().mockRejectedValue(new Error("connection timeout")),
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockGetRedis.mockReturnValue(redis as any);

    await expect(getCachedSmtpResult("user@example.com")).resolves.toBeNull();
  });

  it("uses the same cache key for the same email (case-insensitive)", async () => {
    const redis = makeMockRedis({
      get: jest.fn().mockResolvedValue(ZEROBOUNCE_RESULT),
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockGetRedis.mockReturnValue(redis as any);

    await getCachedSmtpResult("USER@EXAMPLE.COM");
    await getCachedSmtpResult("user@example.com");

    // Both calls should use the identical key
    expect(redis.get).toHaveBeenCalledTimes(2);
    const [key1] = redis.get.mock.calls[0] as [string];
    const [key2] = redis.get.mock.calls[1] as [string];
    expect(key1).toBe(key2);
  });

  it("uses different cache keys for different emails", async () => {
    const redis = makeMockRedis();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockGetRedis.mockReturnValue(redis as any);

    await getCachedSmtpResult("alice@example.com");
    await getCachedSmtpResult("bob@example.com");

    const [key1] = redis.get.mock.calls[0] as [string];
    const [key2] = redis.get.mock.calls[1] as [string];
    expect(key1).not.toBe(key2);
  });

  it("cache key starts with the expected prefix and does not contain the raw email", async () => {
    const redis = makeMockRedis();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockGetRedis.mockReturnValue(redis as any);

    await getCachedSmtpResult("secret@example.com");

    const [key] = redis.get.mock.calls[0] as [string];
    expect(key).toMatch(/^itv:smtp:/);
    expect(key).not.toContain("secret");
    expect(key).not.toContain("example.com");
  });
});

// ── setCachedSmtpResult ───────────────────────────────────────────────────────

describe("setCachedSmtpResult", () => {
  beforeEach(() => jest.resetAllMocks());

  it("is a no-op when Redis is not configured", async () => {
    mockGetRedis.mockReturnValue(null);
    await expect(
      setCachedSmtpResult("user@example.com", ZEROBOUNCE_RESULT),
    ).resolves.toBeUndefined();
  });

  it("is a no-op when the result source is 'local' (not an SMTP provider result)", async () => {
    const redis = makeMockRedis();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockGetRedis.mockReturnValue(redis as any);

    await setCachedSmtpResult("user@example.com", LOCAL_RESULT);
    expect(redis.set).not.toHaveBeenCalled();
  });

  it("stores a ZeroBounce result in Redis", async () => {
    const redis = makeMockRedis();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockGetRedis.mockReturnValue(redis as any);

    await setCachedSmtpResult("user@example.com", ZEROBOUNCE_RESULT);

    expect(redis.set).toHaveBeenCalledTimes(1);
    const [key, value] = redis.set.mock.calls[0] as [string, unknown];
    expect(key).toMatch(/^itv:smtp:/);
    expect(value).toEqual(ZEROBOUNCE_RESULT);
  });

  it("stores an Emailable result in Redis", async () => {
    const redis = makeMockRedis();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockGetRedis.mockReturnValue(redis as any);

    await setCachedSmtpResult("user@example.com", EMAILABLE_RESULT);

    expect(redis.set).toHaveBeenCalledTimes(1);
  });

  it("stores with a 7-day TTL (604 800 seconds)", async () => {
    const redis = makeMockRedis();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockGetRedis.mockReturnValue(redis as any);

    await setCachedSmtpResult("user@example.com", ZEROBOUNCE_RESULT);

    const [, , options] = redis.set.mock.calls[0] as [string, unknown, { ex: number }];
    expect(options).toMatchObject({ ex: 60 * 60 * 24 * 7 });
  });

  it("does not throw when redis.set rejects", async () => {
    const redis = makeMockRedis({
      set: jest.fn().mockRejectedValue(new Error("write failed")),
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockGetRedis.mockReturnValue(redis as any);

    await expect(
      setCachedSmtpResult("user@example.com", ZEROBOUNCE_RESULT),
    ).resolves.toBeUndefined();
  });

  it("uses the same key format as getCachedSmtpResult for the same email", async () => {
    const redis = makeMockRedis();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockGetRedis.mockReturnValue(redis as any);

    await getCachedSmtpResult("test@domain.com");
    await setCachedSmtpResult("test@domain.com", ZEROBOUNCE_RESULT);

    const [getKey] = redis.get.mock.calls[0] as [string];
    const [setKey] = redis.set.mock.calls[0] as [string];
    expect(setKey).toBe(getKey);
  });
});
