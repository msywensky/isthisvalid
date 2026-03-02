/**
 * Phone Number Validation Library
 *
 * Local checks are synchronous and use libphonenumber-js (Google's libphonenumber
 * compiled to JS). No API key required. No network calls.
 *
 * applyCarrierResult merges in async carrier-API enrichment when a key is present.
 */
import { parsePhoneNumberFromString } from "libphonenumber-js/max";
import { getAreaCodeLocation } from "./us-area-codes";

// ── Types ─────────────────────────────────────────────────────────────────────

export type LineType =
  | "MOBILE"
  | "FIXED_LINE"
  | "FIXED_LINE_OR_MOBILE"
  | "TOLL_FREE"
  | "PREMIUM_RATE"
  | "SHARED_COST"
  | "VOIP"
  | "PERSONAL_NUMBER"
  | "PAGER"
  | "UAN"
  | "VOICEMAIL"
  | "UNKNOWN";

export type PhoneSource = "local" | "numverify" | "abstract";

export interface PhoneValidationResult {
  // ── Core verdict ────────────────────────────────────────────────────────────
  /** True if the number is structurally valid per ITU-T rules. */
  valid: boolean;
  /** Confidence score 0–100. */
  score: number;
  /** Short human-readable verdict label. */
  label: string;
  /** Longer human-readable explanation. */
  message: string;

  // ── Input echo ──────────────────────────────────────────────────────────────
  input: string;

  // ── Parsed data ─────────────────────────────────────────────────────────────
  /** E.164 canonical form, e.g. "+14155552671". Null if unparseable. */
  phoneE164: string | null;
  /** ISO 3166-1 alpha-2 country code, e.g. "US". Null if undetected. */
  countryCode: string | null;
  /** Full country name in English, e.g. "United States". Null if undetected. */
  countryName: string | null;
  /** National format, e.g. "(415) 555-2671". Null if unparseable. */
  nationalFormat: string | null;
  /** International format, e.g. "+1 415 555 2671". Null if unparseable. */
  internationalFormat: string | null;
  /** ITU-T line type. Null if unparseable. */
  lineType: LineType | null;
  /**
   * Best-effort geographic location derived from the area code (US only).
   * Reflects the area code's assigned region, not the subscriber's actual location.
   * Mobile numbers may be used far from the area code's origin.
   */
  location: string | null;

  // ── Checks ───────────────────────────────────────────────────────────────────
  checks: {
    /** libphonenumber could parse the input at all. */
    parseable: boolean;
    /** Digit count is correct for the identified country. */
    validLength: boolean;
    /** Matches ITU-T prefix rules for the identified country. */
    validPattern: boolean;
    /** Passes the looser plausibility check (length only). */
    possibleNumber: boolean;
    /** A country code could be identified. */
    countryDetected: boolean;
  };

  // ── Carrier enrichment (API-gated, null until applyCarrierResult) ───────────
  carrier: string | null;
  lineActive: boolean | null;
  ported: boolean | null;

  // ── Flags ────────────────────────────────────────────────────────────────────
  flags: string[];

  // ── Source ───────────────────────────────────────────────────────────────────
  source: PhoneSource;
}

export interface CarrierData {
  carrier: string;
  lineType: string;
  ported: boolean;
  /** Whether the line is confirmed active by the carrier API. */
  active: boolean;
  /** Score bonus applied by the carrier API confirmation (+15 max). */
  scoreBonus?: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getCountryName(isoCode: string): string | null {
  try {
    const dn = new Intl.DisplayNames(["en"], { type: "region" });
    return dn.of(isoCode) ?? null;
  } catch {
    return null;
  }
}

/**
 * Normalise raw input so libphonenumber has the best chance of parsing it.
 * - Leading "00" → "+"  (international dialling prefix)
 * - Strips visual separators that confuse some parsers
 */
function normaliseInput(raw: string): string {
  const trimmed = raw.trim();
  // Convert 00-prefixed international format → E.164 prefix
  if (/^00[1-9]/.test(trimmed)) {
    return "+" + trimmed.slice(2);
  }
  return trimmed;
}

function coerceLineType(raw: string | undefined): LineType {
  const allowed: LineType[] = [
    "MOBILE",
    "FIXED_LINE",
    "FIXED_LINE_OR_MOBILE",
    "TOLL_FREE",
    "PREMIUM_RATE",
    "SHARED_COST",
    "VOIP",
    "PERSONAL_NUMBER",
    "PAGER",
    "UAN",
    "VOICEMAIL",
  ];
  if (raw && (allowed as string[]).includes(raw)) return raw as LineType;
  return "UNKNOWN";
}

// ── Score computation ─────────────────────────────────────────────────────────

function computeScore(
  parseable: boolean,
  isValid: boolean,
  isPossible: boolean,
  countryDetected: boolean,
  lineType: LineType | null,
): number {
  if (!parseable) return 0;

  let score = isValid ? 60 : isPossible ? 35 : 20;

  if (countryDetected) score += 5;

  switch (lineType) {
    case "MOBILE":
    case "FIXED_LINE":
      score += 15;
      break;
    case "FIXED_LINE_OR_MOBILE":
      score += 10;
      break;
    case "TOLL_FREE":
      score += 5;
      break;
    case "PERSONAL_NUMBER":
      score += 3;
      break;
    case "SHARED_COST":
      score -= 5;
      break;
    case "VOIP":
      score -= 20;
      break;
    case "PAGER":
    case "UAN":
      score -= 10;
      break;
    case "PREMIUM_RATE":
      score -= 35;
      break;
  }

  return Math.max(0, Math.min(100, score));
}

// ── Label & message generation ────────────────────────────────────────────────

function buildLabel(
  parseable: boolean,
  isValid: boolean,
  isPossible: boolean,
  lineType: LineType | null,
): string {
  if (!parseable) return "Invalid Phone Number";
  if (!isValid && !isPossible) return "Invalid Phone Number";
  if (!isValid) return "Unrecognised Format";

  switch (lineType) {
    case "MOBILE":
      return "Valid Mobile Number";
    case "FIXED_LINE":
      return "Valid Landline Number";
    case "FIXED_LINE_OR_MOBILE":
      return "Valid Phone Number";
    case "TOLL_FREE":
      return "Toll-Free Number";
    case "PREMIUM_RATE":
      return "Premium-Rate Number";
    case "SHARED_COST":
      return "Shared-Cost Number";
    case "VOIP":
      return "VoIP Number";
    case "PERSONAL_NUMBER":
      return "Personal Number";
    case "PAGER":
      return "Pager Number";
    case "UAN":
      return "Universal Access Number";
    case "VOICEMAIL":
      return "Voicemail Access Number";
    default:
      return "Valid Phone Number";
  }
}

function buildMessage(
  parseable: boolean,
  isValid: boolean,
  isPossible: boolean,
  lineType: LineType | null,
  countryName: string | null,
): string {
  if (!parseable) {
    return "This doesn't look like a valid phone number. Check the country code and digit count.";
  }
  if (!isValid && !isPossible) {
    return "The number format doesn't match any known numbering plan. Double-check the digits.";
  }
  if (!isValid) {
    return "The number is plausible but doesn't fully match the expected format for its country.";
  }

  const country = countryName ? ` in ${countryName}` : "";

  switch (lineType) {
    case "MOBILE":
      return `Structurally valid mobile number${country}.`;
    case "FIXED_LINE":
      return `Structurally valid landline number${country}.`;
    case "FIXED_LINE_OR_MOBILE":
      return `Valid number${country} — could be mobile or landline.`;
    case "TOLL_FREE":
      return `This is a toll-free number${country} — no charge to the caller.`;
    case "PREMIUM_RATE":
      return "⚠️ Premium-rate numbers charge above standard rates and are commonly used in callback scams. Do not call back unknown missed calls from these numbers.";
    case "SHARED_COST":
      return `Shared-cost number${country} — both caller and recipient share the call cost.`;
    case "VOIP":
      return "VoIP number — physical location and carrier cannot be confirmed. Often used by scammers to disguise their real number.";
    case "PERSONAL_NUMBER":
      return `Personal routing number${country} — calls are forwarded to the subscriber's actual line.`;
    case "PAGER":
      return `Pager number${country}.`;
    case "UAN":
      return `Universal Access Number${country} — typically used by businesses.`;
    case "VOICEMAIL":
      return `Voicemail access number${country}.`;
    default:
      return `Structurally valid number${country}.`;
  }
}

// ── Flags ─────────────────────────────────────────────────────────────────────

function buildFlags(lineType: LineType | null, isValid: boolean): string[] {
  const flags: string[] = [];

  if (!isValid) {
    flags.push("Number format could not be fully verified");
  }

  switch (lineType) {
    case "PREMIUM_RATE":
      flags.push("Premium-rate number — commonly used in callback scams");
      break;
    case "VOIP":
      flags.push("VoIP number — location and carrier unverifiable");
      break;
    case "SHARED_COST":
      flags.push("Caller may be charged above standard rate");
      break;
    case "PAGER":
      flags.push("Pager number — rarely used today");
      break;
  }

  return flags;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Pure synchronous phone number analysis.
 * No network calls. Uses libphonenumber-js (Google's numbering plan data).
 */
export function validatePhoneLocal(raw: string): PhoneValidationResult {
  const input = raw.trim();
  const normalised = normaliseInput(input);

  // Attempt parse — if no leading "+" (no explicit country code), default to US.
  // This lets users enter 10-digit US numbers without the +1 prefix.
  // Guard: only apply the US default when there are enough digit characters to
  // form a plausible subscriber number (≥7). Shorter inputs skip the default so
  // they correctly fail validation instead of partially matching.
  const hasExplicitCC = normalised.startsWith("+");
  const digitCount = (normalised.match(/\d/g) ?? []).length;
  const phone =
    hasExplicitCC || digitCount < 7
      ? parsePhoneNumberFromString(normalised)
      : parsePhoneNumberFromString(normalised, "US");

  if (!phone) {
    return {
      valid: false,
      score: 0,
      label: "Invalid Phone Number",
      message:
        "This doesn't look like a valid phone number. US numbers can be entered without +1 (e.g. 4155552671). For other countries, include the country code (e.g. +44...).",
      input,
      phoneE164: null,
      countryCode: null,
      countryName: null,
      nationalFormat: null,
      internationalFormat: null,
      lineType: null,
      checks: {
        parseable: false,
        validLength: false,
        validPattern: false,
        possibleNumber: false,
        countryDetected: false,
      },
      location: null,
      carrier: null,
      lineActive: null,
      ported: null,
      flags: [
        "Could not parse — for non-US numbers include country code (e.g. +44...)",
      ],
      source: "local",
    };
  }

  const isValid = phone.isValid();
  const isPossible = phone.isPossible();
  const countryCode = phone.country ?? null;
  const countryName = countryCode ? getCountryName(countryCode) : null;
  const countryDetected = countryCode !== null;
  const lineType = coerceLineType(phone.getType());
  const location = getAreaCodeLocation(
    countryCode,
    phone.nationalNumber ?? null,
  );

  const score = computeScore(
    true,
    isValid,
    isPossible,
    countryDetected,
    lineType,
  );

  const label = buildLabel(true, isValid, isPossible, lineType);
  const message = buildMessage(
    true,
    isValid,
    isPossible,
    lineType,
    countryName,
  );
  const flags = buildFlags(lineType, isValid);

  return {
    valid: isValid,
    score,
    label,
    message,
    input,
    phoneE164: phone.format("E.164"),
    countryCode,
    countryName,
    nationalFormat: isValid ? phone.formatNational() : null,
    internationalFormat: isValid ? phone.formatInternational() : null,
    lineType,
    location,
    checks: {
      parseable: true,
      validLength: isValid,
      validPattern: isValid,
      possibleNumber: isPossible,
      countryDetected,
    },
    carrier: null,
    lineActive: null,
    ported: null,
    flags,
    source: "local",
  };
}

/**
 * Merge carrier API enrichment into a local result.
 * Follows the same immutable-merge pattern as applyMxResult / applyHeadResult.
 */
export function applyCarrierResult(
  result: PhoneValidationResult,
  data: CarrierData,
): PhoneValidationResult {
  const scoreBonus = data.active ? (data.scoreBonus ?? 15) : 0;
  const newScore = Math.min(100, result.score + scoreBonus);

  const carrierLineType = coerceLineType(data.lineType.toUpperCase());
  // Prefer API line type when it disagrees with local (API has real-time data)
  const resolvedLineType =
    carrierLineType !== "UNKNOWN" ? carrierLineType : result.lineType;

  return {
    ...result,
    score: newScore,
    lineType: resolvedLineType,
    carrier: data.carrier || null,
    lineActive: data.active,
    ported: data.ported,
    source: "numverify",
  };
}
