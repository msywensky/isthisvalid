import { DISPOSABLE_DOMAINS } from "./disposable-domains";
import type { SmtpVerifyResult } from "./smtp-provider";

// RFC 5322–inspired regex — strict enough for MVP, permissive enough to not
// reject valid international addresses.
const EMAIL_REGEX =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/;

// Common role-based prefixes that are often unreachable or team inboxes
const ROLE_PREFIXES = new Set([
  // System / mail infrastructure
  "admin",
  "administrator",
  "webmaster",
  "hostmaster",
  "postmaster",
  "mailer-daemon",
  "mailerdaemon",
  "bounce",
  "bounces",
  "root",
  "smtp",
  "imap",
  "pop",
  "pop3",
  "ftp",
  "dns",
  "www",
  "web",
  "sysadmin",

  // Security / abuse
  "abuse",
  "security",
  "phishing",
  "spam",
  "spamreport",

  // No-reply variants
  "noreply",
  "no-reply",
  "donotreply",
  "do-not-reply",
  "no_reply",
  "donot-reply",

  // Support / customer service
  "support",
  "help",
  "helpdesk",
  "service",
  "services",
  "customerservice",
  "customer-service",
  "customercare",
  "care",
  "feedback",
  "enquiries",
  "enquiry",

  // Contact / general
  "info",
  "information",
  "contact",
  "hello",
  "hi",
  "general",
  "reception",
  "office",
  "team",

  // Marketing / comms
  "sales",
  "marketing",
  "newsletter",
  "newsletters",
  "news",
  "press",
  "media",
  "pr",
  "alerts",
  "alert",
  "notifications",
  "notification",
  "notify",
  "updates",
  "unsubscribe",
  "list",
  "lists",
  "mail",
  "email",

  // Business functions
  "billing",
  "finance",
  "accounts",
  "account",
  "accounting",
  "payroll",
  "invoices",
  "invoice",
  "orders",
  "order",
  "purchasing",
  "procurement",
  "payments",
  "payment",
  "hr",
  "humanresources",
  "human-resources",
  "recruiting",
  "recruitment",
  "jobs",
  "careers",
  "hiring",
  "legal",
  "compliance",
  "privacy",
  "gdpr",
  "it",
  "ops",
  "devops",
  "operations",
  "management",
  "manager",

  // E-commerce
  "shop",
  "store",
  "reservations",
  "booking",
  "bookings",
  "returns",
  "refunds",

  // Executive (rarely personal inboxes)
  "ceo",
  "cfo",
  "cto",
  "coo",
  "founders",
]);

export interface ValidationChecks {
  /** Passes basic regex syntax check */
  syntax: boolean;
  /** Domain is not in the disposable list */
  notDisposable: boolean;
  /** Local-part is not a generic role account */
  notRole: boolean;
  /** Domain has a valid TLD (≥2 chars) */
  validTld: boolean;
  /** Domain has at least one MX record (null = not checked / DNS error) */
  hasMx: boolean | null;
  /** External API confirmed deliverability (null = not checked) */
  apiDeliverable: boolean | null;
}

export interface EmailValidationResult {
  email: string;
  valid: boolean;
  /** 0–100 confidence score */
  score: number;
  checks: ValidationChecks;
  /** Human-friendly, cheeky message for the UI */
  message: string;
  /** Suggested fix (e.g. typo correction) */
  suggestion?: string;
  /** Which validation path was used */
  source: "local" | "emailable" | "zerobounce";
}

/** Common free-provider typos and their corrections */
const TYPO_MAP: Record<string, string> = {
  // ── Gmail ───────────────────────────────────────────────────────────────
  "gmial.com": "gmail.com",
  "gmai.com": "gmail.com",
  "gmali.com": "gmail.com",
  "gnail.com": "gmail.com",
  "gmail.co": "gmail.com",
  "gamil.com": "gmail.com",
  "gmaill.com": "gmail.com",    // doubled l
  "gmail.con": "gmail.com",    // .con (adjacent to .com on keyboard)
  "gmail.cmo": "gmail.com",    // .cmo (transposed)
  "gmail.ocm": "gmail.com",    // .ocm (transposed)
  // ── Hotmail ─────────────────────────────────────────────────────────────
  "hotmali.com": "hotmail.com",
  "hotmal.com": "hotmail.com",
  "hotmaill.com": "hotmail.com", // doubled l
  "hotmail.con": "hotmail.com",
  "hotmail.cmo": "hotmail.com",
  "hotmail.ocm": "hotmail.com",
  // ── Yahoo ────────────────────────────────────────────────────────────────
  "yahooo.com": "yahoo.com",
  "yaho.com": "yahoo.com",
  "yhaoo.com": "yahoo.com",     // transposed
  "yahoo.con": "yahoo.com",
  "yahoo.cmo": "yahoo.com",
  "yahoo.ocm": "yahoo.com",
  // ── Outlook ──────────────────────────────────────────────────────────────
  "outook.com": "outlook.com",
  "outlok.com": "outlook.com",
  "outlookk.com": "outlook.com", // doubled k
  "outlook.con": "outlook.com",
  "outlook.cmo": "outlook.com",
  "outlook.ocm": "outlook.com",
  // ── iCloud ───────────────────────────────────────────────────────────────
  "iclod.com": "icloud.com",
  "iclould.com": "icloud.com",   // extra l
  "icolud.com": "icloud.com",   // transposed
  "icloud.con": "icloud.com",
  "icloud.cmo": "icloud.com",
  // ── Protonmail ───────────────────────────────────────────────────────────
  "protonmali.com": "protonmail.com",
  "protonmal.com": "protonmail.com",  // missing i
  "protonmai.com": "protonmail.com",  // missing l
  "protonmail.con": "protonmail.com",
  "protonmail.cmo": "protonmail.com",
};

/**
 * Returns a full corrected email address (e.g. "user@gmail.com") when the
 * domain looks like a common typo, or undefined if no match.
 */
function getTypoSuggestion(localPart: string, domain: string): string | undefined {
  const corrected = TYPO_MAP[domain.toLowerCase()];
  if (!corrected) return undefined;
  return `${localPart}@${corrected}`;
}

/**
 * Runs all local checks synchronously. No network calls.
 */
export function validateEmailLocal(rawEmail: string): EmailValidationResult {
  const email = rawEmail.trim().toLowerCase();
  const [localPart, domain] = email.split("@");

  const syntaxOk = EMAIL_REGEX.test(email);
  // A domain must have at least one dot AND the final segment must be ≥ 2 chars.
  // This correctly fails "localhost" (no dot) while passing "example.com".
  const tldOk = domain
    ? domain.includes(".") && domain.split(".").at(-1)!.length >= 2
    : false;
  const isDisposable = domain ? DISPOSABLE_DOMAINS.has(domain) : false;
  // Strip plus-addressing (+tag) before role check so that
  // noreply+bounce@company.com is correctly identified as a role address.
  const roleLocal = localPart ? localPart.split("+")[0] : "";
  const isRole = roleLocal ? ROLE_PREFIXES.has(roleLocal) : false;

  const checks: ValidationChecks = {
    syntax: syntaxOk,
    notDisposable: !isDisposable,
    notRole: !isRole,
    validTld: tldOk,
    hasMx: null,
    apiDeliverable: null,
  };

  const score = computeScore(checks);
  const valid = syntaxOk && !isDisposable && tldOk;

  return {
    email,
    valid,
    score,
    checks,
    message: buildMessage(valid, checks, email),
    suggestion: domain ? getTypoSuggestion(localPart, domain) : undefined,
    source: "local",
  };
}

function computeScore(checks: ValidationChecks): number {
  let score = 0;
  if (checks.syntax) score += 40;
  if (checks.validTld) score += 15;
  if (checks.notDisposable) score += 25;
  if (checks.notRole) score += 10;
  // hasMx: confirmed MX = small bonus; no MX = heavy penalty
  if (checks.hasMx === true) score = Math.min(score + 5, 100);
  if (checks.hasMx === false) score = Math.min(score, 15);
  // apiDeliverable overrides everything
  if (checks.apiDeliverable === true) score = Math.min(score + 10, 100);
  if (checks.apiDeliverable === false) score = Math.min(score, 20);
  return Math.min(score, 100);
}

function buildMessage(
  valid: boolean,
  checks: ValidationChecks,
  email: string,
): string {
  void email;
  if (!checks.syntax)
    return "Yikes. That's not even close to an email address.";
  if (!checks.validTld) return "That TLD looks sus. Did you finish typing?";
  if (!checks.notDisposable)
    return "Caught you! That's a disposable address — great for spam, bad for trust.";
  if (checks.hasMx === false)
    return "That domain has no mail server. Emails sent there vanish into the void.";
  if (!checks.notRole)
    return "Role address detected — deliverability may be unpredictable.";
  if (checks.apiDeliverable === false)
    return "Our API says that mailbox doesn't exist. Ghost address!";
  if (valid && checks.apiDeliverable === true)
    return "Looking good! Syntax ✓, not disposable ✓, and the mailbox is live.";
  if (valid) return "Looks legit! Syntax checks out and it's not a throwaway.";
  return "Something's off. Double-check the address.";
}

/**
 * Apply a DNS MX check result to a local validation result.
 * Call this in the API route after validateEmailLocal and before Emailable.
 */
export function applyMxResult(
  local: EmailValidationResult,
  hasMx: boolean | null,
): EmailValidationResult {
  const checks: ValidationChecks = { ...local.checks, hasMx };
  const score = computeScore(checks);
  // hasMx=false means the domain genuinely cannot receive mail
  const valid = local.valid && hasMx !== false;
  return {
    ...local,
    valid,
    score,
    checks,
    message: buildMessage(valid, checks, local.email),
  };
}

/** Merge local result with a normalised SmtpVerifyResult from any provider */
export function mergeSmtpResult(
  local: EmailValidationResult,
  smtp: SmtpVerifyResult,
): EmailValidationResult {
  const checks: ValidationChecks = {
    ...local.checks,
    apiDeliverable:
      smtp.deliverable === true ? true : smtp.undeliverable ? false : null,
    notDisposable: local.checks.notDisposable && !smtp.disposable,
  };

  const score = computeScore(checks);
  const valid =
    local.checks.syntax &&
    checks.notDisposable &&
    local.checks.hasMx !== false &&
    (smtp.deliverable === true || (!smtp.undeliverable && local.valid));

  return {
    ...local,
    valid,
    score,
    checks,
    message: buildMessage(valid, checks, local.email),
    source: smtp.source,
  };
}

/**
 * Merge local result with Emailable API response.
 * @deprecated Use mergeSmtpResult with an EmailableProvider instead.
 * Kept for backward compatibility with existing tests.
 */
export function mergeEmailableResult(
  local: EmailValidationResult,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  apiData: Record<string, any>,
): EmailValidationResult {
  const smtp: SmtpVerifyResult = {
    deliverable: apiData.state === "deliverable" ? true : null,
    undeliverable: apiData.state === "undeliverable",
    disposable: Boolean(apiData.disposable),
    source: "emailable",
  };
  return mergeSmtpResult(local, smtp);
}
