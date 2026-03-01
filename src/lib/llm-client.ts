/**
 * Anthropic Claude client wrapper.
 *
 * Activates only when ANTHROPIC_API_KEY is set in the environment.
 * Falls back gracefully (returns null) when not configured, so local dev
 * and deployments without the key degrade cleanly.
 */
import Anthropic from "@anthropic-ai/sdk";

// Model and token cap are overridable via env vars so you can switch to a
// cheaper/faster model (e.g. Haiku) or reduce tokens in dev without a code change.
//   ANTHROPIC_MODEL      — defaults to claude-sonnet-4-20250514
//   ANTHROPIC_MAX_TOKENS — defaults to 1024
const MODEL =
  process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-20250514";
const ENV_MAX_TOKENS = process.env.ANTHROPIC_MAX_TOKENS
  ? parseInt(process.env.ANTHROPIC_MAX_TOKENS, 10)
  : null;

const key = process.env.ANTHROPIC_API_KEY;
let _client: Anthropic | null = null;
if (key) {
  _client = new Anthropic({ apiKey: key });
}

/**
 * Call Claude with a system prompt and user message.
 * Returns the raw text response, or null if the client is not configured.
 * Throws on network / API errors — caller should catch.
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
}

/** True when ANTHROPIC_API_KEY is set and the client is initialised. */
export function isLlmConfigured(): boolean {
  return _client !== null;
}
