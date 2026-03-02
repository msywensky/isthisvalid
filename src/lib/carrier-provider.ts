/**
 * Carrier API provider abstraction for phone number enrichment.
 *
 * Follows the same pattern as smtp-provider.ts — implement CarrierProvider,
 * register in getCarrierProvider(). Priority order (first configured key wins):
 *   1. AbstractAPI  (ABSTRACT_API_PHONE_KEY)  — 250 free/month
 *   2. NumVerify    (NUMVERIFY_API_KEY)        — 100 free/month
 *
 * If no key is configured, getCarrierProvider() returns null and the route
 * falls back to the local libphonenumber result.
 *
 * Both providers return carrier name and line type (mobile/landline/voip/etc).
 * Neither free tier provides number portability (ported) or live line-active status.
 */

import type { CarrierData } from "./phone-validator";

// ── Provider interface ────────────────────────────────────────────────────────

export interface CarrierProvider {
  readonly name: "abstract" | "numverify";
  lookup(e164: string): Promise<CarrierData>;
}

// ── Line type normalisation ───────────────────────────────────────────────────

/**
 * Normalize provider-specific line type strings into our internal LineType
 * vocabulary (SCREAMING_SNAKE_CASE, matches libphonenumber-js values).
 */
function normalizeLineType(raw: string | null | undefined): string {
  if (!raw) return "UNKNOWN";
  switch (raw.toLowerCase().replace(/[-_ ]/g, "")) {
    case "mobile":
    case "wireless":
      return "MOBILE";
    case "landline":
    case "fixedline":
    case "fixed":
      return "FIXED_LINE";
    case "fixedlineormobile":
      return "FIXED_LINE_OR_MOBILE";
    case "voip":
      return "VOIP";
    case "tollfree":
    case "tollfreeline":
      return "TOLL_FREE";
    case "premiumrate":
    case "premiumrateline":
      return "PREMIUM_RATE";
    case "sharedcost":
    case "specialservices":
      return "SHARED_COST";
    case "pager":
      return "PAGER";
    case "satellite":
      return "PERSONAL_NUMBER";
    case "uan":
      return "UAN";
    default:
      return "UNKNOWN";
  }
}

// ── AbstractAPI Phone Intelligence ────────────────────────────────────────────
// Docs:     https://app.abstractapi.com/api/phone-intelligence/documentation
// Endpoint: GET https://phoneintelligence.abstractapi.com/v1/?api_key=KEY&phone=DIGITS
// Free:     250 requests / month
//
// Response shape (relevant fields):
// {
//   "phone_carrier":    { "name": "Verizon Wireless", "line_type": "mobile" },
//   "phone_validation": { "is_valid": true, "line_status": "active", "is_voip": false },
//   "phone_location":   { "region": "Catasauqua", "city": "Pennsylvania" }
//                        ↑ confusingly: "region" = city/suburb, "city" = state
// }

export class AbstractApiProvider implements CarrierProvider {
  readonly name = "abstract" as const;

  constructor(private readonly apiKey: string) {}

  async lookup(e164: string): Promise<CarrierData> {
    // Phone Intelligence API accepts digits-only (no + prefix).
    const phoneParam = e164.startsWith("+") ? e164.slice(1) : e164;
    const url =
      `https://phoneintelligence.abstractapi.com/v1/` +
      `?api_key=${this.apiKey}` +
      `&phone=${phoneParam}`;

    const res = await fetch(url, {
      signal: AbortSignal.timeout(8_000),
      next: { revalidate: 0 },
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(
        `AbstractAPI error: ${res.status} ${res.statusText}${body ? ` — ${body.slice(0, 200)}` : ""}`,
      );
    }

    const data = (await res.json()) as Record<string, unknown>;

    const carrierObj = data.phone_carrier as
      | Record<string, unknown>
      | undefined;
    const validationObj = data.phone_validation as
      | Record<string, unknown>
      | undefined;
    const locationObj = data.phone_location as
      | Record<string, unknown>
      | undefined;

    const carrierName =
      typeof carrierObj?.name === "string" && carrierObj.name
        ? carrierObj.name
        : "";

    // is_voip is authoritative — override line_type when true.
    const isVoip = Boolean(validationObj?.is_voip);
    const rawLineType = isVoip
      ? "voip"
      : (carrierObj?.line_type as string | undefined);

    const isActive =
      typeof validationObj?.line_status === "string"
        ? validationObj.line_status === "active"
        : Boolean(validationObj?.is_valid);

    // AbstractAPI confusingly puts the city/suburb in "region" and the state
    // in "city". Combine both when present for a useful display string.
    const apiRegion =
      typeof locationObj?.region === "string" && locationObj.region
        ? locationObj.region
        : null;
    const apiState =
      typeof locationObj?.city === "string" && locationObj.city
        ? locationObj.city
        : null;
    const city =
      apiRegion && apiState
        ? `${apiRegion}, ${apiState}`
        : (apiRegion ?? apiState ?? null);

    return {
      carrier: carrierName,
      lineType: normalizeLineType(rawLineType),
      active: isActive,
      ported: false,
      scoreBonus: 10,
      city,
    };
  }
}

// ── NumVerify ─────────────────────────────────────────────────────────────────
// Docs:     https://numverify.com/documentation
// Endpoint: GET http://apilayer.net/api/validate?access_key=KEY&number=E164
// Free:     100 requests / month
//
// Response shape (relevant fields):
// {
//   "valid": true,
//   "carrier": "AT&T Mobility LLC",
//   "line_type": "mobile" | "fixed-line" | "voip" | "toll-free" | ...
// }
//
// IMPORTANT: The NumVerify free tier requires plain HTTP — HTTPS is a paid
// feature. Using HTTPS on the free plan returns { success: false } with an
// "https_access_restricted" error. We intentionally use http:// here.

export class NumverifyProvider implements CarrierProvider {
  readonly name = "numverify" as const;

  constructor(private readonly apiKey: string) {}

  async lookup(e164: string): Promise<CarrierData> {
    // NumVerify strips the leading "+" — pass digits only
    const digits = e164.replace(/^\+/, "");
    const url =
      `http://apilayer.net/api/validate` +
      `?access_key=${this.apiKey}` +
      `&number=${encodeURIComponent(digits)}` +
      `&format=1`;

    const res = await fetch(url, {
      signal: AbortSignal.timeout(8_000),
      next: { revalidate: 0 },
    });

    if (!res.ok) {
      throw new Error(`NumVerify error: ${res.status} ${res.statusText}`);
    }

    const data = (await res.json()) as Record<string, unknown>;

    // NumVerify returns { success: false, error: { ... } } on auth/quota failure
    if (data.success === false) {
      const errInfo = data.error as Record<string, unknown> | undefined;
      throw new Error(
        `NumVerify API error: ${errInfo?.info ?? errInfo?.type ?? "unknown"}`,
      );
    }

    const valid = Boolean(data.valid);
    const rawType = data.line_type as string | undefined;
    const carrier =
      typeof data.carrier === "string" && data.carrier ? data.carrier : "";

    return {
      carrier,
      lineType: normalizeLineType(rawType),
      active: valid,
      ported: false,
      scoreBonus: 10,
    };
  }
}

// ── Factory ───────────────────────────────────────────────────────────────────

/**
 * Returns the first configured carrier provider, or null if no API keys are set.
 * AbstractAPI is preferred (more generous free tier).
 */
export function getCarrierProvider(): CarrierProvider | null {
  const abstractKey = process.env.ABSTRACT_API_PHONE_KEY;
  if (abstractKey) return new AbstractApiProvider(abstractKey);

  const numverifyKey = process.env.NUMVERIFY_API_KEY;
  if (numverifyKey) return new NumverifyProvider(numverifyKey);

  return null;
}
