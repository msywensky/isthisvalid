/**
 * Anthropic Claude client wrapper.
 *
 * Activates only when ANTHROPIC_API_KEY is set in the environment.
 * Falls back gracefully (returns null) when not configured, so local dev
 * and deployments without the key degrade cleanly.
 */
import Anthropic, { APIError } from "@anthropic-ai/sdk";

// Model and token cap are overridable via env vars so you can switch to a
// cheaper/faster model (e.g. Haiku 4.5) or reduce tokens in dev without a code change.
//   ANTHROPIC_MODEL      — defaults to claude-sonnet-4-20250514
//   ANTHROPIC_MAX_TOKENS — defaults to 1024
const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-20250514";
const ENV_MAX_TOKENS = process.env.ANTHROPIC_MAX_TOKENS
  ? parseInt(process.env.ANTHROPIC_MAX_TOKENS, 10)
  : null;

const key = process.env.ANTHROPIC_API_KEY;
let _client: Anthropic | null = null;
if (key) {
  _client = new Anthropic({ apiKey: key });
}

// 529 "Overloaded" is a transient Anthropic capacity error. We retry up to
// MAX_RETRIES times with exponential backoff before giving up.
const MAX_RETRIES = 3;
const RETRY_BASE_MS = 1_000; // 1 s → 2 s → 4 s

/**
 * Call Claude with a system prompt and user message.
 * Returns the raw text response, or null if the client is not configured.
 * Automatically retries up to 3 times on 529 Overloaded errors.
 * Throws on other network / API errors — caller should catch.
 */
export async function callClaude(
  system: string,
  userMessage: string,
  maxTokens = 1024,
  timeoutMs = 30_000,
): Promise<string | null> {
  if (!_client) return null;

  // ENV_MAX_TOKENS overrides the caller-supplied default when set, allowing
  // a cheap/low-token config in dev without touching call sites.
  const effectiveMaxTokens = ENV_MAX_TOKENS ?? maxTokens;

  let lastError: unknown;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await _client.messages.create(
        {
          model: MODEL,
          max_tokens: effectiveMaxTokens,
          system,
          messages: [{ role: "user", content: userMessage }],
        },
        { signal: AbortSignal.timeout(timeoutMs) },
      );

      const block = response.content[0];
      if (block.type !== "text") return null;
      return block.text.trim();
    } catch (err) {
      lastError = err;

      // Only retry on 529 Overloaded — all other errors propagate immediately.
      if (
        err instanceof APIError &&
        err.status === 529 &&
        attempt < MAX_RETRIES
      ) {
        const delayMs = RETRY_BASE_MS * 2 ** attempt;
        console.warn(
          `[llm-client] Anthropic 529 Overloaded — retrying in ${delayMs}ms (attempt ${attempt + 1}/${MAX_RETRIES})`,
        );
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        continue;
      }

      throw err;
    }
  }

  throw lastError;
}

/** True when ANTHROPIC_API_KEY is set and the client is initialised. */
export function isLlmConfigured(): boolean {
  return _client !== null;
}

/**
 * Derives a human-readable display label from the active model string.
 * Examples:
 *   claude-sonnet-4-20250514   → "Claude Sonnet 4"
 *   claude-3-5-haiku-20241022  → "Claude 3.5 Haiku"
 *   claude-3-5-sonnet-20241022 → "Claude 3.5 Sonnet"
 */
export function getModelLabel(): string {
  const stripped = MODEL.replace(/^claude-/i, "") // remove "claude-" prefix
    .replace(/-\d{8}$/, ""); // remove trailing date e.g. -20250514

  // Merge consecutive digit-only segments with "." (e.g. "3","5" → "3.5")
  const parts = stripped.split("-");
  const merged: string[] = [];
  let numericGroup: string[] = [];

  for (const part of parts) {
    if (/^\d+$/.test(part)) {
      numericGroup.push(part);
    } else {
      if (numericGroup.length > 0) {
        merged.push(numericGroup.join("."));
        numericGroup = [];
      }
      merged.push(part.charAt(0).toUpperCase() + part.slice(1));
    }
  }
  if (numericGroup.length > 0) merged.push(numericGroup.join("."));

  return "Claude " + merged.join(" ");
}
