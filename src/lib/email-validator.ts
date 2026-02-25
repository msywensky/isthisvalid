import { DISPOSABLE_DOMAINS } from "./disposable-domains";

// RFC 5322–inspired regex — strict enough for MVP, permissive enough to not
// reject valid international addresses.
const EMAIL_REGEX =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/;

// Common role-based prefixes that are often unreachable or team inboxes
const ROLE_PREFIXES = new Set([
  "admin",
  "administrator",
  "webmaster",
  "hostmaster",
  "postmaster",
  "abuse",
  "security",
  "noreply",
  "no-reply",
  "donotreply",
  "do-not-reply",
  "mailer-daemon",
  "support",
  "help",
  "info",
  "contact",
  "sales",
  "marketing",
  "billing",
  "finance",
  "hr",
  "jobs",
  "careers",
  "legal",
  "privacy",
  "spam",
  "root",
  "ops",
  "devops",
  "team",
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
  source: "local" | "emailable";
}

/** Common free-provider typos and their corrections */
const TYPO_MAP: Record<string, string> = {
  "gmial.com": "gmail.com",
  "gmai.com": "gmail.com",
  "gmali.com": "gmail.com",
  "gnail.com": "gmail.com",
  "gmail.co": "gmail.com",
  "gamil.com": "gmail.com",
  "hotmali.com": "hotmail.com",
  "hotmal.com": "hotmail.com",
  "yahooo.com": "yahoo.com",
  "yaho.com": "yahoo.com",
  "outook.com": "outlook.com",
  "outlok.com": "outlook.com",
  "iclod.com": "icloud.com",
  "protonmali.com": "protonmail.com",
};

function getTypoSuggestion(domain: string): string | undefined {
  const lower = domain.toLowerCase();
  return TYPO_MAP[lower]
    ? `${lower.split(".")[0]} → ${TYPO_MAP[lower]}`
    : undefined;
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
  const isRole = localPart ? ROLE_PREFIXES.has(localPart) : false;

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
    suggestion: domain ? getTypoSuggestion(domain) : undefined,
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

/** Merge local result with Emailable API response */
export function mergeEmailableResult(
  local: EmailValidationResult,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  apiData: Record<string, any>,
): EmailValidationResult {
  const deliverable = apiData.state === "deliverable";
  const undeliverable = apiData.state === "undeliverable";

  const checks: ValidationChecks = {
    ...local.checks, // preserves hasMx from applyMxResult
    apiDeliverable: deliverable ? true : undeliverable ? false : null,
    notDisposable: local.checks.notDisposable && !apiData.disposable,
  };

  const score = computeScore(checks);
  const valid =
    local.checks.syntax &&
    checks.notDisposable &&
    local.checks.hasMx !== false &&
    (deliverable || (!undeliverable && local.valid));

  return {
    ...local,
    valid,
    score,
    checks,
    message: buildMessage(valid, checks, local.email),
    source: "emailable",
  };
}
