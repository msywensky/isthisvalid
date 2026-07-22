/**
 * SightEngine AI image detection client.
 *
 * Activates only when SIGHTENGINE_API_USER + SIGHTENGINE_API_SECRET are set.
 * Falls back gracefully (returns null) when not configured.
 *
 * Retry strategy: 3 retries with exponential backoff (1 s → 2 s → 4 s).
 * Retries on 429, 5xx, and network/timeout errors — SightEngine's transient
 * error codes are not fully documented, so we cast a wide net and tighten
 * once we observe real-world failure patterns.
 */

const SIGHTENGINE_ENDPOINT = "https://api.sightengine.com/1.0/check.json";
const MAX_RETRIES = 3;
const RETRY_BASE_MS = 1_000;
const RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503, 504]);

const API_USER = process.env.SIGHTENGINE_API_USER ?? null;
const API_SECRET = process.env.SIGHTENGINE_API_SECRET ?? null;
const MODEL_LABEL = process.env.SIGHTENGINE_MODEL_LABEL ?? "SightEngine";

export function isSightengineConfigured(): boolean {
  return API_USER !== null && API_SECRET !== null;
}

export function getSightengineModelLabel(): string {
  return MODEL_LABEL;
}

/**
 * POST image bytes to SightEngine and return the parsed JSON body.
 * Returns null when credentials are not configured.
 * Retries up to MAX_RETRIES times on transient errors.
 * Throws on non-retryable errors — callers should catch and return 502.
 */
export async function callSightengine(
  bytes: ArrayBuffer | Uint8Array,
  mimeType: string,
  filename: string,
): Promise<unknown> {
  if (!API_USER || !API_SECRET) return null;

  let lastError: unknown;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      const delayMs = RETRY_BASE_MS * 2 ** (attempt - 1);
      console.warn(
        `[sightengine-client] Retrying in ${delayMs}ms (attempt ${attempt}/${MAX_RETRIES})`,
      );
      await new Promise((r) => setTimeout(r, delayMs));
    }

    let response: Response;
    try {
      // SightEngine auth is via form fields, not headers
      const blobData =
        bytes instanceof Uint8Array
          ? (bytes.buffer as ArrayBuffer)
          : (bytes as ArrayBuffer);
      const form = new FormData();
      form.append(
        "media",
        new Blob([blobData], { type: mimeType }),
        filename || "upload",
      );
      form.append("models", "genai");
      form.append("api_user", API_USER);
      form.append("api_secret", API_SECRET);

      response = await fetch(SIGHTENGINE_ENDPOINT, {
        method: "POST",
        body: form,
        signal: AbortSignal.timeout(30_000),
      });
    } catch (err) {
      // Network failure or timeout — retryable
      lastError = err;
      if (attempt < MAX_RETRIES) continue;
      throw err;
    }

    if (response.ok) {
      return await response.json();
    }

    // Non-ok response
    if (RETRYABLE_STATUS_CODES.has(response.status) && attempt < MAX_RETRIES) {
      lastError = new Error(`SightEngine API error ${response.status}`);
      continue;
    }

    // Non-retryable HTTP error (4xx ≠ 429)
    throw new Error(`SightEngine API error ${response.status}`);
  }

  throw lastError;
}
