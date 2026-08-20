/**
 * Input Router — decides which validation pipeline a raw pasted string belongs to,
 * and pulls checkable entities (links, phone numbers) out of prose messages.
 *
 * Pure and DOM-free so it is unit-testable under the repo's node-only Jest config.
 * No network calls: extraction filters candidates through the existing synchronous
 * local validators (`validateUrlLocal`, `validatePhoneLocal`), which are free.
 *
 * NOTE: `src/lib/qr-content.ts` performs a deliberately similar dangerous-scheme
 * guard. The duplication is intentional — that module is a *whole-payload* QR
 * classifier with a different union (wifi/tel/mailto) that `useQrScanner` depends
 * on, while this module is prose-aware. Both are regression-tested separately.
 * If you change the dangerous-scheme list here, check the other file too.
 */
import { validateUrlLocal } from "./url-validator";
import { validatePhoneLocal } from "./phone-validator";

// ── Types ──────────────────────────────────────────────────────────────────

export type DetectedKind = "email" | "url" | "phone" | "text";

export type DetectedInput =
  | { kind: "email"; value: string; raw: string }
  | { kind: "url"; value: string; raw: string }
  | { kind: "phone"; value: string; raw: string }
  | { kind: "text"; value: string; raw: string };

// ── Fan-out caps ───────────────────────────────────────────────────────────

/**
 * Maximum number of URLs found inside a pasted message that are checked
 * automatically. `checkRateLimit` is a 20/min sliding window shared by every
 * API route under one Redis prefix, so an uncapped fan-out on a link-heavy
 * message would exhaust the caller's whole budget in one submission.
 * Worst case here is 1 (primary) + 3 (sub-checks) = 4 of 20.
 */
export const MAX_AUTO_URL_CHECKS = 3;

/**
 * Maximum number of phone numbers surfaced as on-demand buttons. Phone lookups
 * consume paid provider quota, so they are never dispatched automatically.
 */
export const MAX_PHONE_SUGGESTIONS = 3;

/** `/api/validate-phone` rejects inputs outside this range. */
const PHONE_VALUE_MAX_LENGTH = 25;

// ── Patterns ───────────────────────────────────────────────────────────────

/**
 * Schemes that must NEVER be classified as `url` and handed to the URL checker
 * or rendered as a clickable target. Mirrors the guarantee `classifyQrContent`
 * makes for QR payloads.
 */
const DANGEROUS_SCHEME_RE = /^(?:javascript|data|file|vbscript|blob):/i;

/** Whole-string email shape. Deliberately stricter than the prose scanner. */
const EMAIL_SHAPE_RE =
  /^[a-z0-9._%+'-]+@[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9-]+)*\.[a-z]{2,}$/i;

/** Whole-string bare domain with an alphabetic TLD, optional path/query/fragment. */
const BARE_DOMAIN_RE =
  /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9-]+)*\.[a-z]{2,}(?:[/?#]\S*)?$/i;

/** Dotted-quad IPv4 literal with optional port and path. */
const IPV4_RE =
  /^(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(?::\d{1,5})?(?:[/?#]\S*)?$/;

/**
 * Unicode dashes that phones and messaging apps substitute for the ASCII
 * hyphen. Normalised away before the phone-shape test so a number copied out
 * of Messages still routes correctly.
 */
const UNICODE_DASH_RE = /[‐-―−]/g;

/** Characters allowed in a bare phone-number string (besides digits). */
const PHONE_SHAPE_RE = /^[+\d\s().-]+$/;

/** Explicit http(s) URL inside prose. */
const PROSE_URL_RE = /\bhttps?:\/\/[^\s<>"'`]+/gi;

/** Bare domain inside prose (filtered against EXTRACTABLE_TLDS below). */
const PROSE_BARE_DOMAIN_RE =
  /\b[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9-]+)*\.[a-z]{2,}(?:[/?#][^\s<>"'`]*)?/gi;

/** Email address inside prose — masked out before URL/phone scanning. */
const PROSE_EMAIL_RE =
  /\b[a-z0-9._%+'-]+@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9-]+)*\.[a-z]{2,}\b/gi;

/** Candidate phone run inside prose: starts and ends with a digit. */
const PROSE_PHONE_RE = /\+?\d(?:[\d\s().-]{4,20})\d/g;

/** Trailing characters stripped from an extracted candidate. */
const TRAILING_PUNCTUATION_RE = /[.,;:!?)\]}'"»>]+$/;

/**
 * TLDs accepted when extracting a *bare* domain from prose.
 *
 * Prose extraction needs this allowlist because a bare-domain regex alone
 * happily matches ordinary sentences with a missing space ("etc.Also",
 * "sorry.Call") and every false positive costs a real API call from the shared
 * 20/min budget. Explicit `http(s)://` links bypass this list entirely, so a
 * scam link on an exotic TLD is still caught whenever it is written as a URL.
 *
 * Contains the common generic/hosting TLDs plus every entry in the
 * url-validator's high-abuse SUSPICIOUS_TLDS list and the ccTLDs most often
 * seen in smishing.
 */
const EXTRACTABLE_TLDS = new Set([
  // Common generics
  "com",
  "net",
  "org",
  "info",
  "biz",
  "co",
  "io",
  "app",
  "dev",
  "me",
  "tv",
  "cc",
  "site",
  "online",
  "store",
  "shop",
  "live",
  "link",
  "life",
  "world",
  "pro",
  "xyz",
  "vip",
  "club",
  "space",
  "website",
  "fun",
  "one",
  "now",
  "page",
  "help",
  "support",
  "email",
  "cloud",
  "digital",
  "network",
  "agency",
  "services",
  "solutions",
  "group",
  "team",
  "today",
  "news",
  "blog",
  "gov",
  "edu",
  "mil",
  "int",
  // High-abuse TLDs (mirrors SUSPICIOUS_TLDS in url-validator.ts)
  "tk",
  "ml",
  "ga",
  "cf",
  "gq",
  "top",
  "icu",
  "click",
  "surf",
  "cyou",
  "cfd",
  "sbs",
  "dad",
  // ccTLDs commonly seen in smishing / phishing
  "uk",
  "us",
  "ca",
  "au",
  "nz",
  "de",
  "fr",
  "es",
  "it",
  "nl",
  "be",
  "ch",
  "at",
  "se",
  "no",
  "dk",
  "fi",
  "pl",
  "pt",
  "ie",
  "ru",
  "cn",
  "jp",
  "kr",
  "in",
  "br",
  "mx",
  "za",
  "sg",
  "hk",
  "tw",
  "ph",
  "my",
  "th",
  "vn",
  "id",
  "tr",
  "gr",
  "cz",
  "ro",
  "hu",
  "ua",
  "il",
  "ae",
  "sa",
  "ng",
  "ke",
]);

// ── Detection ──────────────────────────────────────────────────────────────

/**
 * Classifies a raw pasted string into the pipeline that should handle it.
 *
 * The precedence chain below IS the correctness surface of the smart input —
 * every rule is ordered deliberately. Read the comments before reordering.
 */
export function detectInputKind(raw: string): DetectedInput {
  const trimmed = raw.trim();

  // 1. Empty / whitespace-only — nothing to route.
  if (trimmed === "") {
    return { kind: "text", value: "", raw };
  }

  // 2. Dangerous schemes FIRST. javascript:/data:/file:/vbscript:/blob: are
  //    never treated as a URL, so they are never rendered as a clickable
  //    target or sent to the URL checker. Same guarantee as classifyQrContent.
  if (DANGEROUS_SCHEME_RE.test(trimmed)) {
    return { kind: "text", value: trimmed, raw };
  }

  // 3. Explicit mailto: / tel: schemes.
  if (/^mailto:/i.test(trimmed)) {
    // Strip the query string (?subject=…) exactly like qr-content.ts does.
    const address = trimmed.slice(7).split("?")[0].trim();
    return { kind: "email", value: address, raw };
  }
  if (/^tel:/i.test(trimmed)) {
    // Strip any ;phone-context= parameters.
    const number = trimmed.slice(4).split(";")[0].trim();
    return { kind: "phone", value: normalisePhoneValue(number), raw };
  }

  // 4. IPv4 literal BEFORE the phone-shape test.
  //    "192.168.1.1" is made only of digits and dots, and dots are phone
  //    separators — without this rule it would be read as a 9-digit phone
  //    number. It must also come before the bare-domain rule, whose alphabetic
  //    TLD requirement rejects it.
  if (IPV4_RE.test(trimmed)) {
    return { kind: "url", value: trimmed, raw };
  }

  // 5. Phone shape BEFORE the prose test. "+1 555 123 4567" contains spaces,
  //    so a naive "has whitespace ⇒ prose" check would misroute it.
  const dashNormalised = trimmed.replace(UNICODE_DASH_RE, "-");
  if (PHONE_SHAPE_RE.test(dashNormalised)) {
    const digitCount = countDigits(dashNormalised);
    if (digitCount >= 7 && digitCount <= 15) {
      return { kind: "phone", value: normalisePhoneValue(dashNormalised), raw };
    }
  }

  // 6. Anything else containing internal whitespace or a newline is prose.
  if (/\s/.test(trimmed)) {
    return { kind: "text", value: trimmed, raw };
  }

  // ── Below here: a single whitespace-free token ──

  // 7. "@" beats bare-domain, so support@paypal.com is an email, not a URL.
  if (EMAIL_SHAPE_RE.test(trimmed)) {
    return { kind: "email", value: trimmed, raw };
  }

  // 8. Explicit http(s) URL.
  if (/^https?:\/\//i.test(trimmed)) {
    return { kind: "url", value: trimmed, raw };
  }

  // 9. Bare domain with an alphabetic TLD (paypal-secure.com, example.co.uk/x).
  if (BARE_DOMAIN_RE.test(trimmed)) {
    return { kind: "url", value: trimmed, raw };
  }

  // 10. Fallback — unrecognised single token (including ftp:// and friends).
  return { kind: "text", value: trimmed, raw };
}

// ── Prose extraction ───────────────────────────────────────────────────────

/**
 * Pulls checkable links out of a pasted message.
 *
 * Strategy: match permissively, then filter each candidate through the free,
 * synchronous `validateUrlLocal`. Deduplicated case-insensitively, in the order
 * they appear. Returns every match — the fan-out cap (MAX_AUTO_URL_CHECKS) is
 * applied by the caller so the UI can show how many were found but not checked.
 */
export function extractUrls(text: string): string[] {
  // Mask email addresses first so "support@paypal.com" doesn't also yield the
  // bare domain "paypal.com" as a separate link.
  const masked = maskEmails(text);

  const candidates: string[] = [];

  for (const match of masked.matchAll(PROSE_URL_RE)) {
    candidates.push(match[0]);
  }

  // Remove the explicit URLs before scanning for bare domains, otherwise the
  // host of "https://example.com/x" is matched a second time.
  const withoutExplicit = masked.replace(PROSE_URL_RE, " ");
  for (const match of withoutExplicit.matchAll(PROSE_BARE_DOMAIN_RE)) {
    candidates.push(match[0]);
  }

  return dedupe(
    candidates
      .map(stripTrailingPunctuation)
      .filter((c) => c !== "")
      .filter(isExtractableUrl),
  );
}

/**
 * Pulls callback numbers out of a pasted message.
 *
 * Same strategy as extractUrls: permissive match, then filter through the free
 * `validatePhoneLocal`. URLs and emails are masked out first so digits inside a
 * link or address are never read as a phone number.
 */
export function extractPhones(text: string): string[] {
  const masked = maskEmails(text).replace(PROSE_URL_RE, " ");

  const candidates: string[] = [];
  for (const match of masked.matchAll(PROSE_PHONE_RE)) {
    candidates.push(match[0].trim());
  }

  return dedupe(
    candidates
      .map(stripTrailingPunctuation)
      .filter((c) => c !== "")
      .filter(isExtractablePhone)
      .map(normalisePhoneValue),
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────

function countDigits(value: string): number {
  return (value.match(/\d/g) ?? []).length;
}

/**
 * Produces a phone string the `/api/validate-phone` route will accept:
 * whitespace collapsed, and — if still longer than the route's 25-char cap —
 * reduced to E.164 (or bare digits) so a heavily formatted number still works.
 */
function normalisePhoneValue(value: string): string {
  const collapsed = value.trim().replace(/\s+/g, " ");
  if (collapsed.length <= PHONE_VALUE_MAX_LENGTH) return collapsed;

  const local = validatePhoneLocal(collapsed);
  if (local.phoneE164) return local.phoneE164;

  const digits = collapsed.replace(/\D/g, "");
  return collapsed.trimStart().startsWith("+") ? `+${digits}` : digits;
}

function stripTrailingPunctuation(value: string): string {
  return value.replace(TRAILING_PUNCTUATION_RE, "");
}

function maskEmails(text: string): string {
  return text.replace(PROSE_EMAIL_RE, (match) => " ".repeat(match.length));
}

/** Case-insensitive dedupe that preserves first-seen order and casing. */
function dedupe(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(value);
  }
  return out;
}

function isExtractableUrl(candidate: string): boolean {
  // Never extract a dangerous scheme, even from prose.
  if (DANGEROUS_SCHEME_RE.test(candidate)) return false;

  const hasExplicitScheme = /^https?:\/\//i.test(candidate);

  // Bare domains must sit on a recognised TLD — see EXTRACTABLE_TLDS.
  if (!hasExplicitScheme && !hasExtractableTld(candidate)) return false;

  const local = validateUrlLocal(candidate);
  return local.checks.parseable && local.checks.validTld;
}

function hasExtractableTld(candidate: string): boolean {
  const host = candidate.split(/[/?#]/)[0];
  const tld = host.split(".").at(-1)?.toLowerCase() ?? "";
  return EXTRACTABLE_TLDS.has(tld);
}

function isExtractablePhone(candidate: string): boolean {
  const digitCount = countDigits(candidate);
  if (digitCount < 7 || digitCount > 15) return false;

  const local = validatePhoneLocal(candidate);
  return local.checks.parseable && local.valid;
}
