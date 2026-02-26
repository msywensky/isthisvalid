/**
 * SMTP verification provider abstraction.
 *
 * Plug in any provider by implementing SmtpProvider and registering it
 * in getSmtpProvider(). Priority order (first key wins):
 *   1. ZeroBounce  (ZEROBOUNCE_API_KEY)  — 100 free/month, refreshes
 *   2. Emailable   (EMAILABLE_API_KEY)   — 250 one-time free, then paid
 */

// ── Normalised result ────────────────────────────────────────────────────────

export interface SmtpVerifyResult {
  /** Provider confirmed the mailbox exists */
  deliverable: boolean | null;
  /** Provider confirmed the mailbox does NOT exist */
  undeliverable: boolean;
  /** Provider flagged address as disposable / temporary */
  disposable: boolean;
  /** Which provider performed the check */
  source: "emailable" | "zerobounce";
}

// ── Provider interface ────────────────────────────────────────────────────────

export interface SmtpProvider {
  readonly name: "emailable" | "zerobounce";
  verify(email: string): Promise<SmtpVerifyResult>;
}

// ── Emailable ─────────────────────────────────────────────────────────────────
// Docs: https://emailable.com/docs/api
// Response field: state = "deliverable" | "undeliverable" | "risky" | "unknown"

export class EmailableProvider implements SmtpProvider {
  readonly name = "emailable" as const;

  constructor(private readonly apiKey: string) {}

  async verify(email: string): Promise<SmtpVerifyResult> {
    const url = `https://api.emailable.com/v1/verify?email=${encodeURIComponent(email)}&api_key=${this.apiKey}`;
    const res = await fetch(url, {
      method: "GET",
      signal: AbortSignal.timeout(8_000),
      // Disable Next.js data cache — results must be fresh per request
      next: { revalidate: 0 },
    });

    if (!res.ok) {
      throw new Error(`Emailable API error: ${res.status}`);
    }

    const data = (await res.json()) as Record<string, unknown>;
    const state = data.state as string | undefined;

    return {
      deliverable: state === "deliverable" ? true : null,
      undeliverable: state === "undeliverable",
      disposable: Boolean(data.disposable),
      source: "emailable",
    };
  }
}

// ── ZeroBounce ────────────────────────────────────────────────────────────────
// Docs: https://www.zerobounce.net/docs/email-validation-api-quickstart/
// Response field: status = "valid" | "invalid" | "catch-all" | "unknown" |
//                          "spamtrap" | "abuse" | "do_not_mail"

export class ZeroBounceProvider implements SmtpProvider {
  readonly name = "zerobounce" as const;

  constructor(private readonly apiKey: string) {}

  async verify(email: string): Promise<SmtpVerifyResult> {
    const url =
      `https://api.zerobounce.net/v2/validate` +
      `?api_key=${this.apiKey}` +
      `&email=${encodeURIComponent(email)}` +
      `&ip_address=`;

    const res = await fetch(url, {
      signal: AbortSignal.timeout(8_000),
      next: { revalidate: 0 },
    });

    if (!res.ok) {
      throw new Error(`ZeroBounce API error: ${res.status}`);
    }

    const data = (await res.json()) as Record<string, unknown>;
    const status = data.status as string | undefined;
    const subStatus = data.sub_status as string | undefined;

    return {
      deliverable: status === "valid" ? true : null,
      undeliverable: status === "invalid",
      // ZeroBounce flags disposable addresses via sub_status
      disposable: subStatus === "disposable" || subStatus === "temp_email",
      source: "zerobounce",
    };
  }
}

// ── Factory ───────────────────────────────────────────────────────────────────

/**
 * Returns the first configured SMTP provider, or null if no API keys are set.
 * ZeroBounce is preferred when both keys are present (free monthly credits).
 */
export function getSmtpProvider(): SmtpProvider | null {
  const zbKey = process.env.ZEROBOUNCE_API_KEY;
  if (zbKey) return new ZeroBounceProvider(zbKey);

  const emKey = process.env.EMAILABLE_API_KEY;
  if (emKey) return new EmailableProvider(emKey);

  return null;
}
