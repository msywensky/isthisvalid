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

// Second-level labels used in ccTLD compound suffixes (e.g. co.uk, com.au).
// When the final two labels of a hostname match one of these, the registered
// domain is the last THREE labels — otherwise we'd split paypal.co.uk into
// "co.uk" and falsely flag it as brand squatting on the legitimate PayPal site.
const CCTLD_SECOND_LEVELS = new Set([
  // United Kingdom & Commonwealth
  "co.uk",
  "org.uk",
  "me.uk",
  "net.uk",
  "gov.uk",
  "ac.uk",
  "ltd.uk",
  "plc.uk",
  // Australia
  "com.au",
  "net.au",
  "org.au",
  "edu.au",
  "gov.au",
  "asn.au",
  "id.au",
  // Japan
  "co.jp",
  "or.jp",
  "ne.jp",
  "ac.jp",
  "go.jp",
  "gr.jp",
  // New Zealand
  "co.nz",
  "net.nz",
  "org.nz",
  "govt.nz",
  "ac.nz",
  // South Africa
  "co.za",
  "org.za",
  "net.za",
  "gov.za",
  "ac.za",
  // India
  "co.in",
  "net.in",
  "org.in",
  "gov.in",
  "ac.in",
  // South Korea
  "co.kr",
  "or.kr",
  "ne.kr",
  "ac.kr",
  "go.kr",
  // Brazil
  "com.br",
  "net.br",
  "org.br",
  "gov.br",
  "edu.br",
  // Argentina
  "com.ar",
  "net.ar",
  "org.ar",
  "gov.ar",
  // Mexico
  "com.mx",
  "org.mx",
  "net.mx",
  "gob.mx",
  // Colombia
  "com.co",
  "net.co",
  "org.co",
  // Peru
  "com.pe",
  "net.pe",
  "org.pe",
  // Venezuela
  "com.ve",
  "net.ve",
  "org.ve",
  // Israel
  "co.il",
  "net.il",
  "org.il",
  "ac.il",
  // Kenya
  "co.ke",
  "or.ke",
  "ac.ke",
  // Ghana
  "com.gh",
  "org.gh",
  // Nigeria
  "com.ng",
  "org.ng",
  "net.ng",
  // Tanzania
  "co.tz",
  "or.tz",
  "ac.tz",
  // Egypt
  "com.eg",
  "org.eg",
  "net.eg",
  // Other widely-used compound TLDs
  "com.tr",
  "com.sg",
  "com.hk",
  "com.tw",
  "com.ph",
  "com.my",
  "com.pk",
  "com.cn",
  "net.cn",
  "org.cn",
  "co.id",
  "com.vn",
  "net.vn",
  "com.ua",
  "net.ua",
  "org.ua",
  "com.bd",
  "net.bd",
]);

/**
 * Extracts the eTLD+1 (registered domain) from a hostname.
 * Handles two-part ccTLD suffixes (co.uk, com.au, etc.) so that
 * www.paypal.co.uk correctly returns "paypal.co.uk" instead of "co.uk".
 */
/** @internal Exported for unit testing only. */
export function getRegisteredDomain(hostname: string): string {
  const parts = hostname.split(".");
  if (parts.length >= 3) {
    const twoPartTld = parts.slice(-2).join(".");
    if (CCTLD_SECOND_LEVELS.has(twoPartTld)) {
      return parts.slice(-3).join(".");
    }
  }
  return parts.length >= 2 ? parts.slice(-2).join(".") : hostname;
}

/** Returns false if a brand name appears in the hostname on the wrong domain. */
/** @internal Exported for unit testing only. */
export function checkBrandSquat(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  const registered = getRegisteredDomain(lower);

  for (const [brand, canonical] of Object.entries(KNOWN_BRANDS)) {
    // Match brand as a word boundary (separated by dot, hyphen, or string edge)
    const pattern = new RegExp(`(^|[.-])${brand}([.-]|$)`, "i");
    if (!pattern.test(lower)) continue;

    // Exact canonical domain — legitimate (paypal.com → paypal.com)
    if (registered === canonical) continue;

    // Brand is the first label of the registered domain — verify the suffix
    // is a compound ccTLD we explicitly recognise (e.g. co.uk, com.au).
    // This prevents any arbitrary multi-part domain from silently bypassing
    // the check: a brand squatter using an obscure compound suffix like
    // paypal.edu.tk would still be caught.
    const ccTldSuffix = registered.slice(brand.length + 1); // e.g. "co.uk"
    if (
      registered.startsWith(`${brand}.`) &&
      CCTLD_SECOND_LEVELS.has(ccTldSuffix)
    )
      continue;

    // Brand appears in the hostname under a different registered domain → squat
    return false;
  }
  return true;
}

// ── Typosquat / entropy / structural helpers ──────────────────────────────

/** Compute Levenshtein edit distance between two strings (two-row DP). */
function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const curr: number[] = [i];
    for (let j = 1; j <= n; j++) {
      curr[j] =
        a[i - 1] === b[j - 1]
          ? prev[j - 1]
          : 1 + Math.min(prev[j], curr[j - 1], prev[j - 1]);
    }
    prev = curr;
  }
  return prev[n];
}

/**
 * Normalise a domain label for typosquat comparison.
 * Substitutes common digit/symbol lookalikes and strips hyphens so that
 * "paypa1" → "paypal" and "g00gle" → "google" before distance comparison.
 */
function normalizeLabel(label: string): string {
  return label
    .toLowerCase()
    .replace(/1/g, "l")
    .replace(/0/g, "o")
    .replace(/3/g, "e")
    .replace(/5/g, "s")
    .replace(/4/g, "a")
    .replace(/8/g, "b")
    .replace(/6/g, "g")
    .replace(/7/g, "t")
    .replace(/-/g, "");
}

/**
 * Returns false if the registered-domain label closely resembles a known brand
 * via digit/symbol substitution or Levenshtein edit distance ≤ 1, without
 * being the legitimate canonical domain.
 * @internal Exported for unit testing only.
 */
export function checkTyposquat(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  const registered = getRegisteredDomain(lower);
  const registeredLabel = registered.split(".")[0];
  const normalized = normalizeLabel(registeredLabel);

  for (const [brand, canonical] of Object.entries(KNOWN_BRANDS)) {
    if (registered === canonical) continue;
    if (brand.length < 4) continue; // too short → too many false positives

    // Exact match after digit/symbol normalisation (e.g. paypa1 → paypal)
    if (normalized === brand) return false;

    // Levenshtein ≤ 1 after normalisation — only for longer brands (≥ 6 chars)
    // to avoid false positives on short common words (e.g. "apple" ↔ "maple").
    if (
      brand.length >= 6 &&
      Math.abs(normalized.length - brand.length) <= 2 &&
      levenshtein(normalized, brand) <= 1
    ) {
      return false;
    }
  }
  return true;
}

/** Shannon entropy of a string in bits per character. */
function shannonEntropy(s: string): number {
  if (s.length === 0) return 0;
  const freq: Record<string, number> = {};
  for (const c of s) freq[c] = (freq[c] ?? 0) + 1;
  return Object.values(freq).reduce((h, count) => {
    const p = count / s.length;
    return h - p * Math.log2(p);
  }, 0);
}

/**
 * Returns true if any hostname label shows high character entropy consistent
 * with a DGA (Domain Generation Algorithm) or random-string domain.
 * Only triggered for labels ≥ 12 characters — short labels naturally vary.
 */
function hasHighEntropy(hostname: string): boolean {
  const labels = hostname.split(".");
  const nonTldLabels = labels.slice(0, -1);
  return nonTldLabels.some(
    (label) => label.length >= 12 && shannonEntropy(label) > 3.8,
  );
}

/**
 * Returns true if any single hostname label contains 3 or more hyphens.
 * Legitimate domains rarely need this; it is a common pattern in phishing
 * infrastructure (e.g. secure-paypal-login-verify.com).
 */
function hasExcessiveHyphens(hostname: string): boolean {
  return hostname
    .split(".")
    .some((label) => (label.match(/-/g) ?? []).length >= 3);
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
  /** Domain label does not closely resemble a known brand (typosquat / digit substitution) */
  notTyposquat: boolean;
  /** No hostname label exhibits high character entropy (DGA / random-string domain) */
  notHighEntropy: boolean;
  /** No individual hostname label contains 3 or more hyphens */
  notExcessiveHyphens: boolean;
  /** Domain was registered ≥ 30 days ago; null = RDAP not yet checked */
  notNewlyRegistered: boolean | null;
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
  /** Final URL after following redirects; absent if no redirect occurred */
  redirectedTo?: string;
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
        notTyposquat: true,
        notHighEntropy: true,
        notExcessiveHyphens: true,
        notNewlyRegistered: null,
        safeBrowsing: null,
        resolves: null,
      },
      message: "That doesn't look like a URL. Is it missing the https://?",
      flags: ["Not a valid URL structure"],
      source: "local",
    };
  }

  const hostname = parsed.hostname.toLowerCase();

  // --- individual checks ---

  const validScheme =
    parsed.protocol === "https:" || parsed.protocol === "http:";
  if (!validScheme) flags.push(`Unusual scheme: ${parsed.protocol}`);

  // Raw IPv4 (1.2.3.4) or IPv6 ([::1]) in host.
  // The WHATWG URL parser normalises hex (0x7f000001), octal (0177.0.0.1),
  // and integer (2130706433) IPv4 forms to dotted-decimal, so the dotted
  // regex covers those after parsing. The additional patterns guard against
  // environments or future parsers that may skip normalisation.
  const isIp =
    /^(\d{1,3}\.){3}\d{1,3}$/.test(hostname) || // dotted-decimal (and normalised forms)
    hostname.startsWith("[") || // IPv6 / IPv4-mapped IPv6
    /^\d+$/.test(hostname) || // pure integer, e.g. 2130706433
    /^0x[0-9a-f]+$/i.test(hostname); // hex integer, e.g. 0x7f000001
  if (isIp) flags.push("Raw IP address — legitimate sites use domain names");

  const hasUserInfo = parsed.username.length > 0 || parsed.password.length > 0;
  if (hasUserInfo)
    flags.push(
      "Credentials in URL — classic trick to spoof the real destination",
    );

  // Strip leading www. before checking the shortener set — www.bit.ly is the
  // same service as bit.ly but would otherwise be missed.
  const hostnameNoWww = hostname.startsWith("www.")
    ? hostname.slice(4)
    : hostname;
  const isShortener = URL_SHORTENERS.has(hostnameNoWww);
  if (isShortener)
    flags.push(`URL shortener (${hostnameNoWww}) hides the real destination`);

  // Test only the path and query string — running patterns over the full href
  // would match hostnames like "secure-login-checker.legit.com" on patterns
  // like /secure[-_]?login/i, producing false positives.
  const pathAndQuery = parsed.pathname + parsed.search;
  const hasSuspiciousKeywords = SUSPICIOUS_PATH_PATTERNS.some((p) =>
    p.test(pathAndQuery),
  );
  if (hasSuspiciousKeywords)
    flags.push("Phishing-specific keyword pattern in URL path");

  // Check each label individually — a label must start with "xn--" to be
  // Punycode. A bare includes("xn--") check would false-positive on hostnames
  // like "bigxn--data.com" where the string appears mid-label.
  const hasPunycode = hostname
    .split(".")
    .some((label) => label.startsWith("xn--"));
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

  // Typosquat — digit substitution or small-edit match to a known brand
  const notTyposquat = checkTyposquat(hostname);
  if (!notTyposquat)
    flags.push(
      "Domain closely resembles a known brand — likely a typosquatting attack",
    );

  // High entropy — random-looking label consistent with DGA / malware C2
  const notHighEntropy = !hasHighEntropy(hostname);
  if (!notHighEntropy)
    flags.push(
      "Hostname uses a random-looking character pattern — associated with malware and scam infrastructure",
    );

  // Excessive hyphens — hyphen-stuffed labels used in phishing domain names
  const notExcessiveHyphens = !hasExcessiveHyphens(hostname);
  if (!notExcessiveHyphens)
    flags.push(
      "Hostname label contains 3+ hyphens — a common phishing domain pattern",
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
    notTyposquat,
    notHighEntropy,
    notExcessiveHyphens,
    notNewlyRegistered: null,
    safeBrowsing: null,
    resolves: null,
  };

  const score = computeScore(checks);
  // Use ≥80 to align with the UI threshold in UrlResultCard (getSentiment).
  // Additionally, a suspicious TLD scoring exactly 80 (due to the computeScore
  // cap) should not be considered Safe — block it explicitly.
  const safe =
    score >= 80 &&
    checks.noBrandSquat &&
    checks.notTyposquat &&
    checks.notExcessiveSubdomains &&
    checks.notSuspiciousTld;

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
  // Typosquat cap — forces into the suspicious zone (< 80) so it can never
  // be marked Safe regardless of other passing checks.
  if (!checks.notTyposquat) score = Math.min(score, 79);
  // Excessive hyphens — mild deduction (subtractive; floored at 0).
  if (!checks.notExcessiveHyphens) score = Math.max(score - 8, 0);
  // Resolve bonus/penalty applied first, then structural caps.
  // Order matters: the subdomain/TLD caps must come AFTER the resolve bonus so
  // a +5 resolve bonus cannot push a capped score above the cap ceiling.
  if (checks.resolves === true) score = Math.min(score + 5, 100);
  if (checks.resolves === false) score = Math.min(score, 70);
  // Structural / TLD / entropy / age caps — applied after resolve bonus
  if (checks.notExcessiveSubdomains === false) score = Math.min(score, 60);
  if (checks.notSuspiciousTld === false) score = Math.min(score, 80);
  if (!checks.notHighEntropy) score = Math.min(score, 75);
  if (checks.notNewlyRegistered === false) score = Math.min(score, 70);
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
  if (!checks.notTyposquat)
    return "⚠️ This domain closely resembles a known brand — likely a typosquatting attack.";
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
  if (checks.notNewlyRegistered === false)
    return "⚠️ This domain was registered within the last 30 days — a major red flag for phishing.";
  if (!checks.notHighEntropy)
    return "This domain uses an unusual random-looking name — a pattern common in malware and scam infrastructure.";
  if (!checks.notExcessiveHyphens)
    return "This domain uses multiple hyphens in a single label — a pattern common in phishing URLs.";
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
  const safe =
    score >= 80 &&
    checks.safeBrowsing !== false &&
    checks.noBrandSquat &&
    checks.notTyposquat &&
    checks.notExcessiveSubdomains &&
    checks.notSuspiciousTld &&
    checks.notNewlyRegistered !== false;
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
  const safe =
    score >= 80 &&
    !isFlagged &&
    checks.noBrandSquat &&
    checks.notTyposquat &&
    checks.notExcessiveSubdomains &&
    checks.notSuspiciousTld &&
    checks.notNewlyRegistered !== false;
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

/**
 * Merge the result of an RDAP domain-age check.
 * isOld: true  = domain registered ≥ 30 days ago (not suspicious)
 *        false = domain registered < 30 days ago (high phishing risk)
 *        null  = RDAP unavailable or timed out (don't penalise)
 */
export function applyRdapResult(
  result: UrlValidationResult,
  isOld: boolean | null,
): UrlValidationResult {
  const notNewlyRegistered: boolean | null = isOld;
  const checks: UrlValidationChecks = { ...result.checks, notNewlyRegistered };
  const score = computeScore(checks);
  const safe =
    score >= 80 &&
    checks.safeBrowsing !== false &&
    checks.noBrandSquat &&
    checks.notTyposquat &&
    checks.notExcessiveSubdomains &&
    checks.notSuspiciousTld &&
    checks.notNewlyRegistered !== false;
  const flags =
    isOld === false
      ? [
          "Domain registered within the last 30 days — a strong phishing signal",
          ...result.flags,
        ]
      : result.flags;
  return {
    ...result,
    safe,
    score,
    checks,
    flags,
    message: buildMessage(safe, checks),
  };
}

/**
 * Merge findings from a cross-domain redirect into the original result.
 * Called when a HEAD request reveals the submitted URL redirects to a
 * different domain.  The destination is independently analysed with
 * validateUrlLocal() and any new flags are surfaced to the user.
 */
export function applyRedirectResult(
  result: UrlValidationResult,
  destResult: UrlValidationResult,
  finalUrl: string,
): UrlValidationResult {
  const mergedScore = Math.min(result.score, destResult.score);
  const mergedSafe = result.safe && destResult.safe;
  const extraFlags = destResult.flags
    .filter((f) => !result.flags.includes(f))
    .map((f) => `Redirect destination: ${f}`);
  const mergedFlags =
    extraFlags.length > 0 ? [...result.flags, ...extraFlags] : result.flags;
  return {
    ...result,
    redirectedTo: finalUrl,
    score: mergedScore,
    safe: mergedSafe,
    flags: mergedFlags,
    message: mergedSafe ? result.message : destResult.message,
  };
}
