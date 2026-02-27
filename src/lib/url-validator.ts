/**
 * URL Validation Library
 *
 * Local checks run synchronously in < 1 ms.
 * applyHeadResult and applySafeBrowsingResult merge in async check outcomes.
 */

// ── Known URL shorteners ───────────────────────────────────────────────────
const URL_SHORTENERS = new Set([
  "bit.ly",
  "tinyurl.com",
  "t.co",
  "goo.gl",
  "ow.ly",
  "is.gd",
  "buff.ly",
  "adf.ly",
  "tiny.cc",
  "rb.gy",
  "cutt.ly",
  "shorturl.at",
  "bit.do",
  "short.link",
  "lnkd.in",
  "fb.me",
  "su.pr",
  "ift.tt",
  "dlvr.it",
  "smarturl.it",
  // Additional shorteners
  "t.ly",
  "v.gd",
  "clck.ru",
  "qr.ae",
  "chilp.it",
  "bc.vc",
  "x.co",
  "snip.ly",
  "po.st",
  "bl.ink",
  "short.io",
  "rebrand.ly",
  "switchy.io",
  "soo.gd",
  "mcaf.ee",
]);

// ── Brand → canonical domain (for squatting detection) ────────────────────
const KNOWN_BRANDS: Record<string, string> = {
  // Finance / payment
  paypal: "paypal.com",
  amazon: "amazon.com",
  ebay: "ebay.com",
  chase: "chase.com",
  wellsfargo: "wellsfargo.com",
  bankofamerica: "bankofamerica.com",
  coinbase: "coinbase.com",
  binance: "binance.com",
  citibank: "citibank.com",
  amex: "americanexpress.com",
  americanexpress: "americanexpress.com",
  venmo: "venmo.com",
  robinhood: "robinhood.com",
  schwab: "schwab.com",
  fidelity: "fidelity.com",
  hsbc: "hsbc.com",
  stripe: "stripe.com",
  // Tech
  apple: "apple.com",
  microsoft: "microsoft.com",
  google: "google.com",
  facebook: "facebook.com",
  instagram: "instagram.com",
  twitter: "twitter.com",
  linkedin: "linkedin.com",
  yahoo: "yahoo.com",
  whatsapp: "whatsapp.com",
  netflix: "netflix.com",
  dropbox: "dropbox.com",
  adobe: "adobe.com",
  steam: "steampowered.com",
  github: "github.com",
  discord: "discord.com",
  tiktok: "tiktok.com",
  reddit: "reddit.com",
  spotify: "spotify.com",
  zoom: "zoom.us",
  twitch: "twitch.tv",
  shopify: "shopify.com",
  // Retail / logistics
  walmart: "walmart.com",
  target: "target.com",
  etsy: "etsy.com",
  airbnb: "airbnb.com",
  uber: "uber.com",
  lyft: "lyft.com",
  doordash: "doordash.com",
  fedex: "fedex.com",
  ups: "ups.com",
  dhl: "dhl.com",
  usps: "usps.com",
  // Security
  norton: "norton.com",
  mcafee: "mcafee.com",
  // Government
  irs: "irs.gov",
};

// ── Phishing path/query patterns (specific combos, not single words) ───────
// Designed to match phishing URLs without false-positiving on bank.com/login.
const SUSPICIOUS_PATH_PATTERNS = [
  /verify[-_]?account/i,
  /confirm[-_]?identity/i,
  /update[-_]?(?:your[-_]?)?payment/i,
  /account[-_]?(?:has[-_]?been[-_]?)?suspend/i,
  /security[-_]?alert[-_]?(?:click|verify|confirm)/i,
  /(?:click|tap)[-_]?here[-_]?(?:to[-_]?)?(?:verify|confirm|unlock)/i,
  // Additional phishing templates
  /recover[-_]?(?:your[-_]?)?account/i,
  /secure[-_]?login/i,
  /login[-_]?confirm/i,
  /unlock[-_]?(?:your[-_]?)?account/i,
  /limited[-_]?access/i,
  /unusual[-_]?(?:sign[-_]?in|activity)/i,
];

// ── High-abuse TLDs ────────────────────────────────────────────────────────
// TLDs disproportionately associated with phishing and malware per ICANN and
// threat intelligence reports. Flagged as a risk signal, not a hard fail.
const SUSPICIOUS_TLDS = new Set([
  // Historical Freenom TLDs — legacy abuse remains widespread
  "tk",
  "ml",
  "ga",
  "cf",
  "gq",
  // High-abuse generic TLDs
  "xyz",
  "top",
  "icu",
  "click",
  "surf",
  "cyou",
  "cfd",
  "sbs",
  "dad",
]);

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Extracts the eTLD+1 (registered domain) from a hostname.
 * Simplified: takes the last two dot-separated parts.
 * Good enough for the brand squatting check.
 */
function getRegisteredDomain(hostname: string): string {
  const parts = hostname.split(".");
  return parts.length >= 2 ? parts.slice(-2).join(".") : hostname;
}

/** Returns false if a brand name appears in the hostname on the wrong domain. */
function checkBrandSquat(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  const registered = getRegisteredDomain(lower);

  for (const [brand, canonical] of Object.entries(KNOWN_BRANDS)) {
    // Match brand as a word boundary (separated by dot, hyphen, or string edge)
    const pattern = new RegExp(`(^|[.-])${brand}([.-]|$)`, "i");
    if (pattern.test(lower) && registered !== canonical) {
      return false; // brand name present but wrong registered domain
    }
  }
  return true;
}

// ── Types ──────────────────────────────────────────────────────────────────

export interface UrlValidationChecks {
  /** String can be parsed as a URL */
  parseable: boolean;
  /** Scheme is http or https */
  validScheme: boolean;
  /** Host is not a raw IPv4/IPv6 address */
  notIpAddress: boolean;
  /** No credentials embedded in the URL (phishing trick) */
  noUserInfo: boolean;
  /** Not a known URL shortening service */
  notShortener: boolean;
  /** No phishing-specific keyword combinations in path/query */
  noSuspiciousKeywords: boolean;
  /** Domain does not use Punycode (potential homograph attack) */
  notPunycode: boolean;
  /** Domain has a valid TLD */
  validTld: boolean;
  /** Domain does not impersonate a known brand */
  noBrandSquat: boolean;
  /** Hostname does not have an unusually deep subdomain structure (< 5 labels) */
  notExcessiveSubdomains: boolean;
  /** TLD is not from a set with disproportionately high abuse rates */
  notSuspiciousTld: boolean;
  /** Google Safe Browsing: true = clean, false = flagged, null = not checked */
  safeBrowsing: boolean | null;
  /** HEAD request: true = resolves, false = NXDOMAIN, null = timeout/skipped */
  resolves: boolean | null;
}

export interface UrlValidationResult {
  /** Normalised URL (from URL parser, or raw input if unparseable) */
  url: string;
  /** Overall safety verdict */
  safe: boolean;
  /** 0–100 confidence score */
  score: number;
  checks: UrlValidationChecks;
  message: string;
  /** Human-readable list of specific warnings */
  flags: string[];
  source: "local" | "safe-browsing";
  /**
   * True when the Safe Browsing API key is configured but the API call
   * failed. The result is based on local checks only and may be incomplete.
   */
  safeBrowsingError?: boolean;
}

// ── Core local validation ──────────────────────────────────────────────────

export function validateUrlLocal(rawUrl: string): UrlValidationResult {
  const trimmed = rawUrl.trim();
  const flags: string[] = [];

  // Attempt to parse — auto-prepend https:// if no scheme present so bare
  // domains like "paypal-secure.com" are still analysed correctly.
  let parsed: URL;
  try {
    // If the input already has any scheme (e.g. ftp://, javascript:), use it as-is
    // so the scheme check can correctly flag non-http(s) protocols.
    // Only auto-prepend https:// for bare domains (e.g. "paypal-secure.com").
    const hasExplicitScheme = /^[a-z][a-z0-9+\-.]*:\/\//i.test(trimmed);
    const toParse = hasExplicitScheme ? trimmed : `https://${trimmed}`;
    parsed = new URL(toParse);
  } catch {
    return {
      url: trimmed,
      safe: false,
      score: 0,
      checks: {
        parseable: false,
        validScheme: false,
        notIpAddress: false,
        noUserInfo: false,
        notShortener: false,
        noSuspiciousKeywords: false,
        notPunycode: false,
        validTld: false,
        noBrandSquat: false,
        notExcessiveSubdomains: true,
        notSuspiciousTld: true,
        safeBrowsing: null,
        resolves: null,
      },
      message: "That doesn't look like a URL. Is it missing the https://?",
      flags: ["Not a valid URL structure"],
      source: "local",
    };
  }

  const hostname = parsed.hostname.toLowerCase();
  const fullUrl = parsed.href;

  // --- individual checks ---

  const validScheme =
    parsed.protocol === "https:" || parsed.protocol === "http:";
  if (!validScheme) flags.push(`Unusual scheme: ${parsed.protocol}`);

  // Raw IPv4 (1.2.3.4) or IPv6 ([::1]) in host
  const isIp =
    /^(\d{1,3}\.){3}\d{1,3}$/.test(hostname) || hostname.startsWith("[");
  if (isIp) flags.push("Raw IP address — legitimate sites use domain names");

  const hasUserInfo = parsed.username.length > 0 || parsed.password.length > 0;
  if (hasUserInfo)
    flags.push(
      "Credentials in URL — classic trick to spoof the real destination",
    );

  const isShortener = URL_SHORTENERS.has(hostname);
  if (isShortener)
    flags.push(`URL shortener (${hostname}) hides the real destination`);

  const hasSuspiciousKeywords = SUSPICIOUS_PATH_PATTERNS.some((p) =>
    p.test(fullUrl),
  );
  if (hasSuspiciousKeywords)
    flags.push("Phishing-specific keyword pattern in URL path");

  const hasPunycode = hostname.includes("xn--");
  if (hasPunycode)
    flags.push(
      "Punycode domain — may use lookalike characters to impersonate a real site",
    );

  const tldPart = hostname.split(".").at(-1) ?? "";
  const validTld = hostname.includes(".") && tldPart.length >= 2;
  if (!validTld) flags.push("Invalid or missing TLD");

  const noBrandSquat = checkBrandSquat(hostname);
  if (!noBrandSquat)
    flags.push("Domain appears to impersonate a well-known brand");

  // Excessive subdomain depth — phishing sites commonly use many subdomain
  // levels to bury the real registered domain (e.g. paypal.com.verify.evil.com).
  // Threshold: 5+ labels (3+ subdomains beyond the eTLD+1).
  const hostLabels = hostname.split(".");
  const hasExcessiveSubdomains = hostLabels.length >= 5;
  if (hasExcessiveSubdomains)
    flags.push(
      "Unusually deep subdomain structure — a common phishing technique",
    );

  // High-abuse TLD — not a hard fail but a meaningful risk signal.
  const tldLower = tldPart.toLowerCase();
  const hasSuspiciousTld = SUSPICIOUS_TLDS.has(tldLower);
  if (hasSuspiciousTld)
    flags.push(
      `High-risk TLD (.${tldLower}) — disproportionately associated with phishing and malware`,
    );

  const checks: UrlValidationChecks = {
    parseable: true,
    validScheme,
    notIpAddress: !isIp,
    noUserInfo: !hasUserInfo,
    notShortener: !isShortener,
    noSuspiciousKeywords: !hasSuspiciousKeywords,
    notPunycode: !hasPunycode,
    validTld,
    noBrandSquat,
    notExcessiveSubdomains: !hasExcessiveSubdomains,
    notSuspiciousTld: !hasSuspiciousTld,
    safeBrowsing: null,
    resolves: null,
  };

  const score = computeScore(checks);
  const safe = score >= 70;

  return {
    url: parsed.href,
    safe,
    score,
    checks,
    message: buildMessage(safe, checks),
    flags,
    source: "local",
  };
}

// ── Scoring ────────────────────────────────────────────────────────────────

function computeScore(checks: UrlValidationChecks): number {
  if (!checks.parseable) return 0;

  let score = 0;
  if (checks.validScheme) score += 10;
  if (checks.notIpAddress) score += 15;
  if (checks.noUserInfo) score += 10;
  if (checks.notShortener) score += 10;
  if (checks.noSuspiciousKeywords) score += 20;
  if (checks.notPunycode) score += 10;
  if (checks.validTld) score += 10;
  if (checks.noBrandSquat) score += 15;
  // Structural / TLD risk caps — applied before resolve/safeBrowsing
  if (checks.notExcessiveSubdomains === false) score = Math.min(score, 60);
  if (checks.notSuspiciousTld === false) score = Math.min(score, 80);
  // resolve bonus / penalty
  if (checks.resolves === true) score = Math.min(score + 5, 100);
  if (checks.resolves === false) score = Math.min(score, 70);
  // Safe Browsing hard-overrides
  if (checks.safeBrowsing === false) score = Math.min(score, 5);

  return Math.min(score, 100);
}

// ── Messages ───────────────────────────────────────────────────────────────

function buildMessage(safe: boolean, checks: UrlValidationChecks): string {
  if (checks.safeBrowsing === false)
    return "🚨 Google Safe Browsing has flagged this URL as malicious. Do not visit.";
  if (!checks.noBrandSquat)
    return "⚠️ This URL appears to impersonate a trusted brand — classic phishing.";
  if (!checks.notIpAddress)
    return "Suspicious — real websites use domain names, not raw IP addresses.";
  if (!checks.notExcessiveSubdomains)
    return "Suspiciously deep subdomain chain — legitimate sites rarely use this many levels.";
  if (!checks.noUserInfo)
    return "The @ in this URL is a known trick to disguise the real destination.";
  if (!checks.notShortener)
    return "URL shortener detected — we can't see where this really leads without following it.";
  if (!checks.notPunycode)
    return "This domain uses Punycode — it may be impersonating another site using lookalike characters.";
  if (!checks.notSuspiciousTld)
    return "This TLD is heavily associated with phishing and malware — proceed with extreme caution.";
  if (!checks.noSuspiciousKeywords)
    return "The URL path contains patterns commonly found in phishing pages.";
  if (!checks.validTld)
    return "That TLD doesn't look right. Is the URL complete?";
  if (checks.resolves === false)
    return "URL looks structurally fine but the site does not appear to be reachable.";
  if (safe && checks.safeBrowsing === true)
    return "Looks clean! Passed all local checks and Google Safe Browsing confirmed it's not flagged.";
  if (safe)
    return "Looks clean! No suspicious patterns detected. Stay alert with unexpected links.";
  return "Several checks raised concerns — treat this URL with caution.";
}

// ── Merge helpers (called after async checks in the API route) ────────────

/**
 * Merge the result of a HEAD request into an existing local result.
 * resolves: true → site is reachable, false → NXDOMAIN, null → timeout/skip.
 */
export function applyHeadResult(
  result: UrlValidationResult,
  resolves: boolean | null,
): UrlValidationResult {
  const checks: UrlValidationChecks = { ...result.checks, resolves };
  const score = computeScore(checks);
  const safe = score >= 70 && checks.safeBrowsing !== false && checks.notExcessiveSubdomains;
  return {
    ...result,
    safe,
    score,
    checks,
    message: buildMessage(safe, checks),
  };
}

/**
 * Merge Google Safe Browsing result.
 * isFlagged: true → URL is in a threat list.
 */
export function applySafeBrowsingResult(
  result: UrlValidationResult,
  isFlagged: boolean,
): UrlValidationResult {
  const checks: UrlValidationChecks = {
    ...result.checks,
    safeBrowsing: !isFlagged,
  };
  const score = computeScore(checks);
  const safe = score >= 70 && !isFlagged;
  const flags = isFlagged
    ? ["Google Safe Browsing: FLAGGED as malicious", ...result.flags]
    : result.flags;
  return {
    ...result,
    safe,
    score,
    checks,
    flags,
    message: buildMessage(safe, checks),
    source: "safe-browsing",
  };
}
