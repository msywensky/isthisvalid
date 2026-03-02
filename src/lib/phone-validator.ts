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
  /**
   * API-provided geographic location (e.g. "Catasauqua, Pennsylvania").
   * When present, replaces the local area-code guess in the result.
   */
  city?: string | null;
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

/**
 * Returns the score delta for a given line type.
 * Exported so applyCarrierResult can swap out the libphonenumber guess
 * for the API-provided type without rerunning the full score pipeline.
 */
export function getLineTypeBonus(lineType: LineType | null): number {
  switch (lineType) {
    case "MOBILE":
    case "FIXED_LINE":
      return 15;
    case "FIXED_LINE_OR_MOBILE":
      return 10;
    case "TOLL_FREE":
      return 5;
    case "PERSONAL_NUMBER":
      return 3;
    case "SHARED_COST":
      return -5;
    case "VOIP":
      return -20;
    case "PAGER":
    case "UAN":
      return -10;
    case "PREMIUM_RATE":
      return -35;
    default:
      return 0;
  }
}

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
  score += getLineTypeBonus(lineType);

  return Math.max(0, Math.min(100, score));
}

// ── Label & message generation ────────────────────────────────────────────────

export function buildLabel(
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

export function buildMessage(
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

export function buildFlags(
  lineType: LineType | null,
  isValid: boolean,
): string[] {
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

/**
 * Caribbean and Pacific island nations share the +1 NANP country code with
 * the US, so their numbers look like domestic calls. Dialing them from the US
 * incurs international rates — the mechanic behind one-ring scams.
 * US territories (PR, GU, VI, AS, MP) are excluded; they share +1 without
 * international charges.
 */
const NANP_SAFE = new Set(["US", "CA", "PR", "GU", "VI", "AS", "MP"]);

function nanpWarningFlag(
  callingCode: string | undefined,
  countryCode: string | null,
  countryName: string | null,
): string | null {
  if (callingCode === "1" && countryCode && !NANP_SAFE.has(countryCode)) {
    return `Caribbean/Pacific NANP number — despite the +1 prefix, calling ${countryName ?? countryCode} from the US incurs international rates. Often used in one-ring callback scams.`;
  }
  return null;
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

  // Warn when a NANP (+1) number belongs to a foreign country — calling it
  // from the US incurs international charges despite the familiar +1 prefix.
  const nanpWarn = nanpWarningFlag(
    phone.countryCallingCode,
    countryCode,
    countryName,
  );
  if (nanpWarn) flags.push(nanpWarn);

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
  const carrierLineType = coerceLineType(data.lineType.toUpperCase());
  // Prefer API line type when it disagrees with libphonenumber (API has real-time carrier data)
  const resolvedLineType =
    carrierLineType !== "UNKNOWN" ? carrierLineType : result.lineType;

  // Recompute the score by swapping out the old line-type contribution and
  // substituting the API-provided one. Without this step a VOIP number that
  // libphonenumber guesses as FIXED_LINE_OR_MOBILE (+10) would carry the
  // wrong base score and the API bonus would push it even higher instead
  // of correctly penalising it (VOIP = −20).
  const oldLineTypeBonus = getLineTypeBonus(result.lineType);
  const newLineTypeBonus = getLineTypeBonus(resolvedLineType);
  const apiBonus = data.active ? (data.scoreBonus ?? 10) : 0;
  const newScore = Math.max(
    0,
    Math.min(
      100,
      result.score - oldLineTypeBonus + newLineTypeBonus + apiBonus,
    ),
  );

  // Regenerate label, message and flags with the corrected line type so the
  // UI reflects what the carrier API actually told us.
  const lineTypeChanged = resolvedLineType !== result.lineType;
  const label = lineTypeChanged
    ? buildLabel(
        result.checks.parseable,
        result.valid,
        result.checks.possibleNumber,
        resolvedLineType,
      )
    : result.label;
  const message = lineTypeChanged
    ? buildMessage(
        result.checks.parseable,
        result.valid,
        result.checks.possibleNumber,
        resolvedLineType,
        result.countryName,
      )
    : result.message;
  // Always spread to avoid mutating the source result's flags array.
  const flags = lineTypeChanged
    ? buildFlags(resolvedLineType, result.valid)
    : [...result.flags];

  // Preserve the Caribbean/Pacific warning through carrier enrichment —
  // buildFlags doesn't have access to country data so it can't emit it.
  // Derive calling code from the E.164 string already in the result.
  const callingCode = result.phoneE164?.startsWith("+1") ? "1" : undefined;
  const nanpWarn = nanpWarningFlag(
    callingCode,
    result.countryCode,
    result.countryName,
  );
  if (nanpWarn && !flags.includes(nanpWarn)) flags.push(nanpWarn);

  return {
    ...result,
    score: newScore,
    label,
    message,
    flags,
    lineType: resolvedLineType,
    carrier: data.carrier || null,
    lineActive: data.active,
    ported: data.ported,
    // Replace the area-code guess with the carrier API's actual location when provided.
    location: data.city ?? result.location,
  };
}
