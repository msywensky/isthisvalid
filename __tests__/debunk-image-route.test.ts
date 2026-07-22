/**
 * Unit tests for POST /api/debunk/image
 *
 * All external dependencies (SightEngine, rate limiters, Redis) are mocked so
 * the tests run offline with no API keys required.
 */
import { NextRequest } from "next/server";
import { POST } from "@/app/api/debunk/image/route";
import type { ImageDebunkResult } from "@/lib/image-debunker";

// ── Mocks ────────────────────────────────────────────────────────────────────

jest.mock("@/lib/sightengine-client");
jest.mock("@/lib/rate-limit");

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

const mockCallSightengine = callSightengine as jest.MockedFunction<
  typeof callSightengine
>;
const mockIsSightengineConfigured =
  isSightengineConfigured as jest.MockedFunction<
    typeof isSightengineConfigured
  >;
const mockGetSightengineModelLabel =
  getSightengineModelLabel as jest.MockedFunction<
    typeof getSightengineModelLabel
  >;
const mockCheckRateLimit = checkRateLimit as jest.MockedFunction<
  typeof checkRateLimit
>;
const mockCheckDailyImageLimit = checkDailyImageLimit as jest.MockedFunction<
  typeof checkDailyImageLimit
>;
const mockGetRedis = getRedis as jest.MockedFunction<typeof getRedis>;

// ── Constants ─────────────────────────────────────────────────────────────────

/**
 * Minimal valid JPEG bytes (JFIF magic bytes).
 * Must start with ff d8 ff to be treated as a real JPEG.
 */
const JPEG_BYTES = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01,
  0x00, 0x00, 0x01,
]);

/** A valid SightEngine raw response for an AI-generated image. */
const AI_SIGHTENGINE_RESPONSE = {
  status: "success",
  request: { id: "req_abc123", timestamp: 1746000000, operations: 1 },
  type: { ai_generated: 0.85 },
  media: { id: "med_abc123", uri: "https://sightengine.com/img.jpg" },
};

/** A valid SightEngine raw response for an authentic image. */
const AUTHENTIC_SIGHTENGINE_RESPONSE = {
  status: "success",
  request: { id: "req_def456", timestamp: 1746000000, operations: 1 },
  type: { ai_generated: 0.001 },
  media: { id: "med_def456", uri: "https://sightengine.com/img2.jpg" },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

async function makeImageRequest(
  fileBytes: Buffer = JPEG_BYTES,
  mimeType = "image/jpeg",
  filename = "test.jpg",
  ip = "1.2.3.4",
): Promise<NextRequest> {
  const form = new FormData();
  form.append(
    "file",
    new File([fileBytes.buffer as ArrayBuffer], filename, {
      type: mimeType,
    }),
  );

  return new NextRequest("http://localhost/api/debunk/image", {
    method: "POST",
    headers: { "x-forwarded-for": ip },
    body: form,
  });
}

function makeMockRedis(cachedValue: unknown = null) {
  return {
    get: jest.fn().mockResolvedValue(cachedValue),
    set: jest.fn().mockResolvedValue("OK"),
  };
}

// ── Default mock state ────────────────────────────────────────────────────────

beforeEach(() => {
  mockIsSightengineConfigured.mockReturnValue(true);
  mockGetSightengineModelLabel.mockReturnValue("SightEngine");
  mockCheckRateLimit.mockResolvedValue({ success: true });
  mockCheckDailyImageLimit.mockResolvedValue({ success: true });
  mockGetRedis.mockReturnValue(null); // no Redis cache by default
  mockCallSightengine.mockResolvedValue(AI_SIGHTENGINE_RESPONSE);
});

// ── Happy path ────────────────────────────────────────────────────────────────

describe("POST /api/debunk/image — happy path", () => {
  test("returns 200 with correct ImageDebunkResult shape for an AI image", async () => {
    const res = await POST(await makeImageRequest());
    const body: ImageDebunkResult = await res.json();

    expect(res.status).toBe(200);
    expect(body.classification).toBe("ai-generated");
    expect(typeof body.confidence).toBe("number");
    expect(typeof body.riskScore).toBe("number");
    expect(typeof body.safe).toBe("boolean");
    expect(body.safe).toBe(false); // ai-generated is always unsafe
    expect(Array.isArray(body.flags)).toBe(true);
    expect(typeof body.explanation).toBe("string");
    expect(body.source).toBe("sightengine");
  });

  test("cache miss response has X-Cache: MISS header", async () => {
    const res = await POST(await makeImageRequest());
    expect(res.headers.get("X-Cache")).toBe("MISS");
  });

  test("result includes modelLabel from getSightengineModelLabel", async () => {
    const res = await POST(await makeImageRequest());
    const body: ImageDebunkResult = await res.json();
    expect(body.modelLabel).toBe("SightEngine");
  });

  test("authentic image returns safe=true", async () => {
    mockCallSightengine.mockResolvedValue(AUTHENTIC_SIGHTENGINE_RESPONSE);

    const res = await POST(await makeImageRequest());
    const body: ImageDebunkResult = await res.json();

    expect(res.status).toBe(200);
    expect(body.classification).toBe("authentic");
    expect(body.safe).toBe(true);
  });
});

// ── Cache behaviour ───────────────────────────────────────────────────────────

describe("POST /api/debunk/image — result cache", () => {
  test("returns cached result with X-Cache: HIT without calling SightEngine", async () => {
    const cached: ImageDebunkResult = {
      classification: "ai-generated",
      confidence: 70,
      riskScore: 85,
      safe: false,
      summary: "This image appears to have been generated by AI.",
      flags: ["AI generation probability: 85%"],
      explanation: "Cached result.",
      source: "sightengine",
      modelLabel: "SightEngine",
    };
    mockGetRedis.mockReturnValue(makeMockRedis(cached) as never);

    const res = await POST(await makeImageRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(res.headers.get("X-Cache")).toBe("HIT");
    expect(body.explanation).toBe("Cached result.");
    expect(mockCallSightengine).not.toHaveBeenCalled();
  });

  test("cache hit: checkDailyImageLimit is NOT called", async () => {
    const cached: ImageDebunkResult = {
      classification: "authentic",
      confidence: 100,
      riskScore: 0,
      safe: true,
      summary: "This image appears to be authentic.",
      flags: [],
      explanation: "Cached.",
      source: "sightengine",
    };
    mockGetRedis.mockReturnValue(makeMockRedis(cached) as never);

    await POST(await makeImageRequest());

    expect(mockCheckDailyImageLimit).not.toHaveBeenCalled();
  });

  test("cache miss: checkDailyImageLimit IS called before SightEngine", async () => {
    const redis = makeMockRedis(null);
    mockGetRedis.mockReturnValue(redis as never);

    await POST(await makeImageRequest());

    expect(mockCheckDailyImageLimit).toHaveBeenCalledTimes(1);
    expect(mockCallSightengine).toHaveBeenCalledTimes(1);
  });

  test("cache miss: writes result to Redis after successful SightEngine call", async () => {
    const redis = makeMockRedis(null);
    mockGetRedis.mockReturnValue(redis as never);

    const res = await POST(await makeImageRequest());

    expect(res.status).toBe(200);
    await Promise.resolve(); // fire-and-forget write tick
    expect(redis.set).toHaveBeenCalledTimes(1);
  });

  test("non-fatal Redis read failure proceeds to SightEngine", async () => {
    const redis = {
      get: jest.fn().mockRejectedValue(new Error("Redis down")),
      set: jest.fn().mockResolvedValue("OK"),
    };
    mockGetRedis.mockReturnValue(redis as never);

    const res = await POST(await makeImageRequest());

    expect(res.status).toBe(200);
    expect(mockCallSightengine).toHaveBeenCalledTimes(1);
  });
});

// ── Rate limiting ─────────────────────────────────────────────────────────────

describe("POST /api/debunk/image — rate limiting", () => {
  test("returns 429 when per-minute rate limit is exceeded", async () => {
    mockCheckRateLimit.mockResolvedValue({
      success: false,
      reset: Date.now() + 30_000,
    });

    const res = await POST(await makeImageRequest());
    const body = await res.json();

    expect(res.status).toBe(429);
    expect(body.error).toMatch(/too many requests/i);
    expect(res.headers.get("Retry-After")).toBeDefined();
  });

  test("returns 429 when daily spend cap is exceeded", async () => {
    mockCheckDailyImageLimit.mockResolvedValue({
      success: false,
      reset: Date.now() + 3_600_000,
    });

    const res = await POST(await makeImageRequest());
    const body = await res.json();

    expect(res.status).toBe(429);
    expect(body.error).toMatch(/daily limit/i);
    expect(res.headers.get("Retry-After")).toBeDefined();
  });

  test("does not call SightEngine when per-minute rate limit is exceeded", async () => {
    mockCheckRateLimit.mockResolvedValue({ success: false });

    await POST(await makeImageRequest());

    expect(mockCallSightengine).not.toHaveBeenCalled();
  });

  test("does not call SightEngine when daily rate limit is exceeded", async () => {
    mockCheckDailyImageLimit.mockResolvedValue({ success: false });

    await POST(await makeImageRequest());

    expect(mockCallSightengine).not.toHaveBeenCalled();
  });
});

// ── SightEngine availability ───────────────────────────────────────────────────

describe("POST /api/debunk/image — SightEngine availability", () => {
  test("returns 503 when SightEngine credentials are not configured", async () => {
    mockIsSightengineConfigured.mockReturnValue(false);

    const res = await POST(await makeImageRequest());
    const body = await res.json();

    expect(res.status).toBe(503);
    expect(body.error).toMatch(/not configured/i);
  });

  test("does not call SightEngine when not configured", async () => {
    mockIsSightengineConfigured.mockReturnValue(false);

    await POST(await makeImageRequest());

    expect(mockCallSightengine).not.toHaveBeenCalled();
  });
});

// ── Input validation ──────────────────────────────────────────────────────────

describe("POST /api/debunk/image — input validation", () => {
  test("returns 422 when file field is missing", async () => {
    const form = new FormData();
    const req = new NextRequest("http://localhost/api/debunk/image", {
      method: "POST",
      headers: { "x-forwarded-for": "1.2.3.4" },
      body: form,
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(422);
    expect(body.error).toMatch(/missing|invalid/i);
  });

  test("returns 422 when file has wrong MIME type (text/plain)", async () => {
    const res = await POST(
      await makeImageRequest(
        Buffer.from("hello world"),
        "text/plain",
        "test.txt",
      ),
    );
    const body = await res.json();

    expect(res.status).toBe(422);
    expect(body.error).toMatch(/unsupported file type/i);
  });

  test("returns 422 when .txt renamed to .jpg but blob type is text/plain", async () => {
    const res = await POST(
      await makeImageRequest(
        Buffer.from("not an image"),
        "text/plain",
        "sneaky.jpg",
      ),
    );
    const body = await res.json();

    expect(res.status).toBe(422);
    expect(body.error).toMatch(/unsupported file type/i);
  });

  test("returns 422 when file exceeds 4 MB", async () => {
    const bigBuffer = Buffer.alloc(4 * 1024 * 1024 + 1, 0xff);

    const res = await POST(
      await makeImageRequest(bigBuffer, "image/jpeg", "big.jpg"),
    );
    const body = await res.json();

    expect(res.status).toBe(422);
    expect(body.error).toMatch(/too large/i);
  });

  test("accepts valid PNG file", async () => {
    const pngBytes = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ]);

    const res = await POST(
      await makeImageRequest(pngBytes, "image/png", "test.png"),
    );

    expect(res.status).toBe(200);
  });

  test("accepts valid WebP file", async () => {
    const webpBytes = Buffer.from([0x52, 0x49, 0x46, 0x46]);

    const res = await POST(
      await makeImageRequest(webpBytes, "image/webp", "test.webp"),
    );

    expect(res.status).toBe(200);
  });

  test("accepts valid GIF file", async () => {
    const gifBytes = Buffer.from("GIF89a");

    const res = await POST(
      await makeImageRequest(gifBytes, "image/gif", "test.gif"),
    );

    expect(res.status).toBe(200);
  });
});

// ── SightEngine error handling ────────────────────────────────────────────────

describe("POST /api/debunk/image — SightEngine error handling", () => {
  test("returns 502 when callSightengine throws", async () => {
    mockCallSightengine.mockRejectedValue(new Error("Network failure"));

    const res = await POST(await makeImageRequest());
    const body = await res.json();

    expect(res.status).toBe(502);
    expect(body.error).toMatch(/image analysis failed/i);
  });

  test("returns 503 when callSightengine returns null", async () => {
    mockCallSightengine.mockResolvedValue(null);

    const res = await POST(await makeImageRequest());
    const body = await res.json();

    expect(res.status).toBe(503);
    expect(body.error).toMatch(/not available/i);
  });

  test("returns 502 when SightEngine response fails Zod schema validation", async () => {
    mockCallSightengine.mockResolvedValue({
      // Missing required fields
      status: "success",
    });

    const res = await POST(await makeImageRequest());
    const body = await res.json();

    expect(res.status).toBe(502);
    expect(body.error).toMatch(/unexpected response/i);
  });

  test("returns 502 when SightEngine returns non-success status", async () => {
    mockCallSightengine.mockResolvedValue({
      status: "failure",
      error: { code: 1, message: "Invalid API key" },
    });

    const res = await POST(await makeImageRequest());

    expect(res.status).toBe(502);
  });
});

// ── modelLabel in result ──────────────────────────────────────────────────────

describe("POST /api/debunk/image — modelLabel", () => {
  test("getSightengineModelLabel is used as modelLabel in result", async () => {
    mockGetSightengineModelLabel.mockReturnValue("SightEngine v2");

    const res = await POST(await makeImageRequest());
    const body: ImageDebunkResult = await res.json();

    expect(body.modelLabel).toBe("SightEngine v2");
  });
});
