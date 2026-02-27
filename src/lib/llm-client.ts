/**
 * Anthropic Claude client wrapper.
 *
 * Activates only when ANTHROPIC_API_KEY is set in the environment.
 * Falls back gracefully (returns null) when not configured, so local dev
 * and deployments without the key degrade cleanly.
 */
import Anthropic from "@anthropic-ai/sdk";

// Pin the model — update here when upgrading
const MODEL = "claude-sonnet-4-20250514";

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

  const response = await _client.messages.create(
    {
      model: MODEL,
      max_tokens: maxTokens,
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
