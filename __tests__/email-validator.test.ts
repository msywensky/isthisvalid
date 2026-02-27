import {
  validateEmailLocal,
  mergeEmailableResult,
  mergeSmtpResult,
  applyMxResult,
  type EmailValidationResult,
} from "@/lib/email-validator";
import { DISPOSABLE_DOMAINS } from "@/lib/disposable-domains";

describe("validateEmailLocal", () => {
  // ── Valid emails ─────────────────────────────────────────────────────────
  it("passes a standard valid email", () => {
    const r = validateEmailLocal("user@example.com");
    expect(r.valid).toBe(true);
    expect(r.checks.syntax).toBe(true);
    expect(r.checks.validTld).toBe(true);
    expect(r.checks.notDisposable).toBe(true);
    expect(r.score).toBeGreaterThanOrEqual(70);
  });

  it("passes subdomains", () => {
    const r = validateEmailLocal("hello@mail.example.co.uk");
    expect(r.valid).toBe(true);
  });

  it("passes plus-addressed email", () => {
    const r = validateEmailLocal("user+tag@gmail.com");
    expect(r.valid).toBe(true);
    expect(r.checks.syntax).toBe(true);
  });

  // ── Invalid syntax ────────────────────────────────────────────────────────
  it("fails on missing @", () => {
    const r = validateEmailLocal("notanemail");
    expect(r.valid).toBe(false);
    expect(r.checks.syntax).toBe(false);
    // Score = notDisposable(25) + notRole(10) = 35, syntax/TLD fail = 0
    expect(r.score).toBeLessThan(40);
  });

  it("fails on missing local part", () => {
    const r = validateEmailLocal("@example.com");
    expect(r.valid).toBe(false);
    expect(r.checks.syntax).toBe(false);
  });

  it("fails on missing domain", () => {
    const r = validateEmailLocal("user@");
    expect(r.valid).toBe(false);
    expect(r.checks.syntax).toBe(false);
  });

  it("fails on single-label TLD (no dot in domain)", () => {
    const r = validateEmailLocal("user@localhost");
    expect(r.valid).toBe(false);
    expect(r.checks.validTld).toBe(false);
  });

  it("trims whitespace before checking", () => {
    const r = validateEmailLocal("  user@example.com  ");
    expect(r.email).toBe("user@example.com");
    expect(r.valid).toBe(true);
  });

  // ── Disposable email ──────────────────────────────────────────────────────
  it("flags mailinator.com as disposable", () => {
    const r = validateEmailLocal("throwaway@mailinator.com");
    expect(r.valid).toBe(false);
    expect(r.checks.notDisposable).toBe(false);
    // Score = syntax(40) + TLD(15) + role(10) = 65; disposable gives 0
    expect(r.score).toBeLessThan(70);
  });

  it("flags yopmail.com as disposable", () => {
    const r = validateEmailLocal("test@yopmail.com");
    expect(r.checks.notDisposable).toBe(false);
  });

  it("flags 10minutemail.com as disposable", () => {
    const r = validateEmailLocal("tmp@10minutemail.com");
    expect(r.checks.notDisposable).toBe(false);
  });

  // ── Role-based ────────────────────────────────────────────────────────────
  it("detects admin@ as a role address", () => {
    const r = validateEmailLocal("admin@company.com");
    expect(r.checks.notRole).toBe(false);
    // Still syntactically valid though
    expect(r.checks.syntax).toBe(true);
  });

  it("detects noreply@ as a role address", () => {
    const r = validateEmailLocal("noreply@company.com");
    expect(r.checks.notRole).toBe(false);
  });

  it("does not flag regular users as role", () => {
    const r = validateEmailLocal("john@company.com");
    expect(r.checks.notRole).toBe(true);
  });

  // ── Typo suggestions ──────────────────────────────────────────────────────
  it("suggests full corrected email for gmial.com", () => {
    const r = validateEmailLocal("user@gmial.com");
    expect(r.suggestion).toBe("user@gmail.com");
  });

  it("suggests full corrected email for hotmali.com", () => {
    const r = validateEmailLocal("user@hotmali.com");
    expect(r.suggestion).toBe("user@hotmail.com");
  });

  it("preserves local part including plus-tag in suggestion", () => {
    const r = validateEmailLocal("firstname.last+tag@gmial.com");
    expect(r.suggestion).toBe("firstname.last+tag@gmail.com");
  });

  it("returns no suggestion for a correctly-spelled domain", () => {
    const r = validateEmailLocal("user@gmail.com");
    expect(r.suggestion).toBeUndefined();
  });

  // ── Score ─────────────────────────────────────────────────────────────────
  it("source is always 'local'", () => {
    expect(validateEmailLocal("a@b.com").source).toBe("local");
  });
});

// ── Plus-addressing role check ────────────────────────────────────────────────
// The +tag suffix must be stripped before the ROLE_PREFIXES lookup so that
// noreply+bounce@company.com is correctly identified as a role address.
describe("validateEmailLocal — plus-addressed role detection", () => {
  it("flags noreply+bounce@ as a role address", () => {
    const r = validateEmailLocal("noreply+bounce@company.com");
    expect(r.checks.notRole).toBe(false);
    expect(r.checks.syntax).toBe(true);
  });

  it("flags admin+anything@ as a role address", () => {
    const r = validateEmailLocal("admin+foo@example.com");
    expect(r.checks.notRole).toBe(false);
  });

  it("flags support+ticket123@ as a role address", () => {
    const r = validateEmailLocal("support+ticket123@company.com");
    expect(r.checks.notRole).toBe(false);
  });

  it("does not flag a real user with a plus tag as a role address", () => {
    const r = validateEmailLocal("alice+newsletter@example.com");
    expect(r.checks.notRole).toBe(true);
  });

  it("plus-addressed real user email remains valid", () => {
    const r = validateEmailLocal("user+tag@gmail.com");
    expect(r.valid).toBe(true);
    expect(r.checks.notRole).toBe(true);
  });
});

// ── Expanded typo map ──────────────────────────────────────────────────────────────
describe("validateEmailLocal — typo suggestions", () => {
  // .con (fat-finger, adjacent to .com)
  it.each([
    ["gmail.con", "gmail.com"],
    ["yahoo.con", "yahoo.com"],
    ["hotmail.con", "hotmail.com"],
    ["outlook.con", "outlook.com"],
    ["icloud.con", "icloud.com"],
    ["protonmail.con", "protonmail.com"],
  ])("suggests correction for %s", (typo, correct) => {
    const r = validateEmailLocal(`user@${typo}`);
    expect(r.suggestion).toBe(`user@${correct}`);
  });

  // .cmo (transposed extension)
  it.each([
    ["gmail.cmo", "gmail.com"],
    ["yahoo.cmo", "yahoo.com"],
    ["hotmail.cmo", "hotmail.com"],
    ["outlook.cmo", "outlook.com"],
  ])("suggests correction for %s", (typo, correct) => {
    const r = validateEmailLocal(`user@${typo}`);
    expect(r.suggestion).toBe(`user@${correct}`);
  });

  // .ocm (transposed extension)
  it.each([
    ["gmail.ocm", "gmail.com"],
    ["hotmail.ocm", "hotmail.com"],
    ["outlook.ocm", "outlook.com"],
  ])("suggests correction for %s", (typo, correct) => {
    const r = validateEmailLocal(`user@${typo}`);
    expect(r.suggestion).toBe(`user@${correct}`);
  });

  // Doubled/missing/transposed letters within domain names
  it.each([
    ["gmaill.com", "gmail.com"],
    ["hotmaill.com", "hotmail.com"],
    ["outlookk.com", "outlook.com"],
    ["yhaoo.com", "yahoo.com"],
    ["iclould.com", "icloud.com"],
    ["icolud.com", "icloud.com"],
    ["protonmal.com", "protonmail.com"],
    ["protonmai.com", "protonmail.com"],
  ])("suggests correction for %s", (typo, correct) => {
    const r = validateEmailLocal(`user@${typo}`);
    expect(r.suggestion).toBe(`user@${correct}`);
  });

  // Suggestion includes the full local part, not just the domain
  it("includes local part in the full suggestion string", () => {
    const r = validateEmailLocal("jane.doe@gmial.com");
    expect(r.suggestion).toBe("jane.doe@gmail.com");
  });

  // No suggestion for an unknown (non-typo) domain
  it("returns undefined for an unknown domain", () => {
    const r = validateEmailLocal("user@randomdomain.com");
    expect(r.suggestion).toBeUndefined();
  });
});

// ── mergeEmailableResult ────────────────────────────────────────────────────
describe("mergeEmailableResult", () => {
  const baseLocal = validateEmailLocal("user@example.com");

  it("marks deliverable=true when API returns deliverable state", () => {
    const merged = mergeEmailableResult(baseLocal, {
      state: "deliverable",
      disposable: false,
    });
    expect(merged.checks.apiDeliverable).toBe(true);
    expect(merged.source).toBe("emailable");
    expect(merged.score).toBe(100);
  });

  it("marks deliverable=false when API returns undeliverable state", () => {
    const merged = mergeEmailableResult(baseLocal, {
      state: "undeliverable",
      disposable: false,
    });
    expect(merged.checks.apiDeliverable).toBe(false);
    expect(merged.valid).toBe(false);
    expect(merged.score).toBeLessThanOrEqual(10);
  });

  it("flags disposable if API says so even if local missed it", () => {
    const merged = mergeEmailableResult(baseLocal, {
      state: "deliverable",
      disposable: true,
    });
    expect(merged.checks.notDisposable).toBe(false);
  });

  it("preserves hasMx from applyMxResult through the merge", () => {
    const withMx = applyMxResult(baseLocal, true);
    const merged = mergeEmailableResult(withMx, {
      state: "deliverable",
      disposable: false,
    });
    expect(merged.checks.hasMx).toBe(true);
    expect(merged.source).toBe("emailable");
  });

  it("treats unknown API state as unconfirmed (null)", () => {
    const merged = mergeEmailableResult(baseLocal, {
      state: "unknown",
      disposable: false,
    });
    expect(merged.checks.apiDeliverable).toBeNull();
  });
});

// ── applyMxResult ─────────────────────────────────────────────────────────
describe("applyMxResult", () => {
  const base = validateEmailLocal("user@example.com");

  it("starts with hasMx=null from local validation", () => {
    expect(base.checks.hasMx).toBeNull();
  });

  it("sets hasMx=true and gives a small score bonus", () => {
    const r = applyMxResult(base, true);
    expect(r.checks.hasMx).toBe(true);
    expect(r.score).toBeGreaterThan(base.score);
    expect(r.valid).toBe(true);
  });

  it("sets hasMx=false, caps score, and marks invalid", () => {
    const r = applyMxResult(base, false);
    expect(r.checks.hasMx).toBe(false);
    expect(r.score).toBeLessThanOrEqual(15);
    expect(r.valid).toBe(false);
    expect(r.message).toMatch(/no mail server/i);
  });

  it("hasMx=null leaves score and validity unchanged", () => {
    const r = applyMxResult(base, null);
    expect(r.checks.hasMx).toBeNull();
    expect(r.score).toBe(base.score);
    expect(r.valid).toBe(base.valid);
  });

  it("hasMx=false on disposable domain preserves invalid verdict", () => {
    const disposable = validateEmailLocal("test@mailinator.com");
    const r = applyMxResult(disposable, false);
    expect(r.valid).toBe(false);
    expect(r.score).toBeLessThanOrEqual(15);
  });
});

// ── mergeSmtpResult ───────────────────────────────────────────────────────────
describe("mergeSmtpResult", () => {
  const baseLocal = validateEmailLocal("user@example.com");
  const baseWithMx = applyMxResult(baseLocal, true);

  it("marks deliverable=true and sets score to 100", () => {
    const merged = mergeSmtpResult(baseWithMx, {
      deliverable: true,
      undeliverable: false,
      disposable: false,
      source: "zerobounce",
    });
    expect(merged.checks.apiDeliverable).toBe(true);
    expect(merged.valid).toBe(true);
    expect(merged.score).toBe(100);
    expect(merged.source).toBe("zerobounce");
  });

  it("marks undeliverable=true, caps score, and sets valid=false", () => {
    const merged = mergeSmtpResult(baseWithMx, {
      deliverable: null,
      undeliverable: true,
      disposable: false,
      source: "zerobounce",
    });
    expect(merged.checks.apiDeliverable).toBe(false);
    expect(merged.valid).toBe(false);
    expect(merged.score).toBeLessThanOrEqual(10);
  });

  it("propagates disposable=true even if local missed it", () => {
    const merged = mergeSmtpResult(baseWithMx, {
      deliverable: true,
      undeliverable: false,
      disposable: true,
      source: "zerobounce",
    });
    expect(merged.checks.notDisposable).toBe(false);
  });

  it("sets apiDeliverable=null when deliverability is unknown", () => {
    const merged = mergeSmtpResult(baseWithMx, {
      deliverable: null,
      undeliverable: false,
      disposable: false,
      source: "zerobounce",
    });
    expect(merged.checks.apiDeliverable).toBeNull();
  });

  it("carries source from the SmtpVerifyResult (emailable)", () => {
    const merged = mergeSmtpResult(baseWithMx, {
      deliverable: true,
      undeliverable: false,
      disposable: false,
      source: "emailable",
    });
    expect(merged.source).toBe("emailable");
  });

  it("preserves hasMx from the local+MX result", () => {
    const merged = mergeSmtpResult(baseWithMx, {
      deliverable: true,
      undeliverable: false,
      disposable: false,
      source: "zerobounce",
    });
    expect(merged.checks.hasMx).toBe(true);
  });
});

// ── Expanded role-prefix list ─────────────────────────────────────────────────
describe("validateEmailLocal — expanded role prefixes", () => {
  const domain = "company.com";

  // Mail infrastructure (added in expansion)
  it.each([
    "bounce",
    "smtp",
    "imap",
    "pop",
    "pop3",
    "dns",
    "www",
    "sysadmin",
    "mailerdaemon",
  ])("detects '%s' as a role address", (prefix) => {
    const r = validateEmailLocal(`${prefix}@${domain}`);
    expect(r.checks.notRole).toBe(false);
    expect(r.checks.syntax).toBe(true);
  });

  // No-reply variants (added in expansion)
  it.each(["no_reply", "donot-reply"])(
    "detects '%s' as a role address",
    (prefix) => {
      const r = validateEmailLocal(`${prefix}@${domain}`);
      expect(r.checks.notRole).toBe(false);
    },
  );

  // Support / customer service
  it.each(["helpdesk", "customerservice", "customercare", "enquiries"])(
    "detects '%s' as a role address",
    (prefix) => {
      const r = validateEmailLocal(`${prefix}@${domain}`);
      expect(r.checks.notRole).toBe(false);
    },
  );

  // Business functions
  it.each([
    "accounting",
    "payroll",
    "invoices",
    "procurement",
    "gdpr",
    "compliance",
    "humanresources",
  ])("detects '%s' as a role address", (prefix) => {
    const r = validateEmailLocal(`${prefix}@${domain}`);
    expect(r.checks.notRole).toBe(false);
  });

  // E-commerce
  it.each(["shop", "store", "reservations", "bookings", "returns", "refunds"])(
    "detects '%s' as a role address",
    (prefix) => {
      const r = validateEmailLocal(`${prefix}@${domain}`);
      expect(r.checks.notRole).toBe(false);
    },
  );

  // Communications
  it.each([
    "newsletter",
    "newsletters",
    "press",
    "media",
    "alerts",
    "unsubscribe",
    "list",
  ])("detects '%s' as a role address", (prefix) => {
    const r = validateEmailLocal(`${prefix}@${domain}`);
    expect(r.checks.notRole).toBe(false);
  });

  // Executive titles (rarely personal inboxes)
  it.each(["ceo", "cfo", "cto", "coo", "founders"])(
    "detects '%s' as a role address",
    (prefix) => {
      const r = validateEmailLocal(`${prefix}@${domain}`);
      expect(r.checks.notRole).toBe(false);
    },
  );

  // Sanity — legitimate user names that look like they could be role-ish
  it.each(["shopkeeper", "newsdesk", "ceoremy", "alertsme"])(
    "does not flag partial-match '%s' as a role address",
    (prefix) => {
      const r = validateEmailLocal(`${prefix}@${domain}`);
      expect(r.checks.notRole).toBe(true);
    },
  );
});

// ── Disposable domain coverage ────────────────────────────────────────────────
describe("DISPOSABLE_DOMAINS (merged mailchecker + disposable-email-domains)", () => {
  it("contains more than 50 000 entries after the mailchecker merge", () => {
    expect(DISPOSABLE_DOMAINS.size).toBeGreaterThan(50_000);
  });

  it("still includes classic domains from the original package", () => {
    expect(DISPOSABLE_DOMAINS.has("mailinator.com")).toBe(true);
    expect(DISPOSABLE_DOMAINS.has("yopmail.com")).toBe(true);
    expect(DISPOSABLE_DOMAINS.has("10minutemail.com")).toBe(true);
    expect(DISPOSABLE_DOMAINS.has("guerrillamail.com")).toBe(true);
    expect(DISPOSABLE_DOMAINS.has("sharklasers.com")).toBe(true);
  });

  it("does not flag legitimate domains as disposable", () => {
    expect(DISPOSABLE_DOMAINS.has("gmail.com")).toBe(false);
    expect(DISPOSABLE_DOMAINS.has("outlook.com")).toBe(false);
    expect(DISPOSABLE_DOMAINS.has("yahoo.com")).toBe(false);
    expect(DISPOSABLE_DOMAINS.has("icloud.com")).toBe(false);
    expect(DISPOSABLE_DOMAINS.has("protonmail.com")).toBe(false);
  });

  it("validateEmailLocal flags known mailchecker-only domains", () => {
    // These domains exist in the mailchecker list
    const domains = ["guerrillamail.com", "sharklasers.com"];
    for (const d of domains) {
      const r = validateEmailLocal(`test@${d}`);
      expect(r.checks.notDisposable).toBe(false);
      expect(r.valid).toBe(false);
    }
  });
});

// ── Local-part dot validation (RFC 5321) ──────────────────────────────────────
// The broad character class in EMAIL_REGEX allows dots anywhere; the secondary
// isLocalPartStructurallyValid() check gates these cases.
describe("validateEmailLocal — local-part dot validation", () => {
  it("rejects consecutive dots in local part (user..name@)", () => {
    const r = validateEmailLocal("user..name@example.com");
    expect(r.checks.syntax).toBe(false);
    expect(r.valid).toBe(false);
  });

  it("rejects leading dot in local part (.user@)", () => {
    const r = validateEmailLocal(".user@example.com");
    expect(r.checks.syntax).toBe(false);
    expect(r.valid).toBe(false);
  });

  it("rejects trailing dot in local part (user.@)", () => {
    const r = validateEmailLocal("user.@example.com");
    expect(r.checks.syntax).toBe(false);
    expect(r.valid).toBe(false);
  });

  it("accepts dots in the middle of the local part (first.last@)", () => {
    const r = validateEmailLocal("first.last@example.com");
    expect(r.checks.syntax).toBe(true);
    expect(r.valid).toBe(true);
  });

  it("accepts multiple valid dots in local part (a.b.c@)", () => {
    const r = validateEmailLocal("a.b.c@example.com");
    expect(r.checks.syntax).toBe(true);
    expect(r.valid).toBe(true);
  });
});

// ── Typo domain score capping ─────────────────────────────────────────────────
// When a domain is a known typo, the local score must be capped at 65 so that
// the UI shows a yellow/risky ring rather than a green pass.
describe("validateEmailLocal — typo domain score cap", () => {
  it("caps score at 65 when domain is a known typo", () => {
    const r = validateEmailLocal("user@gmail.con");
    expect(r.score).toBeLessThanOrEqual(65);
    expect(r.suggestion).toBeDefined();
  });

  it("uses a typo hint message when suggestion is present and email is valid", () => {
    const r = validateEmailLocal("user@gmail.con");
    expect(r.message).toMatch(/typo/i);
    expect(r.message).toContain("user@gmail.com");
  });

  it("does not cap score for a correctly-spelled domain", () => {
    const r = validateEmailLocal("user@example.com");
    expect(r.score).toBe(90); // syntax(40)+tld(15)+notDisposable(25)+notRole(10)
    expect(r.suggestion).toBeUndefined();
  });

  it("applyMxResult preserves typo cap when hasMx=null (DNS timeout)", () => {
    const local = validateEmailLocal("user@gmail.con");
    const withMx = applyMxResult(local, null);
    expect(withMx.score).toBeLessThanOrEqual(65);
    expect(withMx.message).toMatch(/typo/i);
  });

  it("applyMxResult with hasMx=false overrides typo cap (already capped at 15)", () => {
    const local = validateEmailLocal("user@gmail.con");
    const withMx = applyMxResult(local, false);
    expect(withMx.score).toBeLessThanOrEqual(15);
    expect(withMx.valid).toBe(false);
  });

  it("applyMxResult with hasMx=true still holds typo cap at ≤65", () => {
    // Even when MX records confirm the domain is live, the score must stay ≤65
    // until the SMTP provider explicitly verifies the mailbox (apiDeliverable=true).
    // This prevents the no-provider early-exit path in the API route from
    // returning an inflated score (e.g. 95) for a typo domain.
    const local = validateEmailLocal("user@gmail.con");
    const withMx = applyMxResult(local, true);
    expect(withMx.score).toBeLessThanOrEqual(65);
    expect(withMx.suggestion).toBeDefined();
  });
});

// ── Exact score values ────────────────────────────────────────────────────────
// Pinning the scoring weights catches accidental regressions if computeScore
// is modified. Update these when intentionally changing point values.
describe("computeScore — exact score values", () => {
  it("clean valid email (no MX, no API) scores exactly 90", () => {
    const r = validateEmailLocal("user@example.com");
    expect(r.score).toBe(90); // syntax(40)+tld(15)+notDisposable(25)+notRole(10)
  });

  it("role address scores exactly 80 (notRole penalty of 10)", () => {
    const r = validateEmailLocal("admin@example.com");
    expect(r.score).toBe(80); // syntax(40)+tld(15)+notDisposable(25)+notRole(0)
  });

  it("disposable address scores exactly 65 (notDisposable penalty of 25)", () => {
    const r = validateEmailLocal("user@mailinator.com");
    expect(r.score).toBe(65); // syntax(40)+tld(15)+notDisposable(0)+notRole(10)
  });

  it("invalid syntax scores 35 (no syntax/tld points)", () => {
    const r = validateEmailLocal("notanemail");
    expect(r.score).toBe(35); // syntax(0)+tld(0)+notDisposable(25)+notRole(10)
  });

  it("applyMxResult hasMx=true gives +5 bonus (capped at 100)", () => {
    const local = validateEmailLocal("user@example.com"); // 90
    const r = applyMxResult(local, true);
    expect(r.score).toBe(95); // 90 + 5
  });

  it("applyMxResult hasMx=false caps score at 15", () => {
    const local = validateEmailLocal("user@example.com"); // 90
    const r = applyMxResult(local, false);
    expect(r.score).toBe(15);
  });

  it("mergeSmtpResult deliverable=true pushes score to 100", () => {
    const local = applyMxResult(validateEmailLocal("user@example.com"), true); // 95
    const r = mergeSmtpResult(local, {
      deliverable: true,
      undeliverable: false,
      disposable: false,
      source: "zerobounce",
    });
    expect(r.score).toBe(100); // min(95 + 10, 100)
  });
});

// ── buildMessage coverage ─────────────────────────────────────────────────────
describe("buildMessage — all message branches", () => {
  it("returns syntax error message when syntax fails", () => {
    const r = validateEmailLocal("notanemail");
    expect(r.message).toMatch(/not even close/i);
  });

  it("returns syntax error message for no-TLD domain (localhost)", () => {
    // EMAIL_REGEX enforces a TLD (.[a-zA-Z]{2,}), so "user@localhost" fails
    // the regex → syntax=false hits the !checks.syntax branch before TLD.
    // The TLD message branch in buildMessage is currently unreachable via the
    // public API; it exists as a safety net for future regex relaxation.
    const r = validateEmailLocal("user@localhost");
    expect(r.checks.syntax).toBe(false);
    expect(r.message).toMatch(/not even close/i);
  });

  it("returns disposable message when domain is disposable", () => {
    const r = validateEmailLocal("user@mailinator.com");
    expect(r.message).toMatch(/disposable/i);
  });

  it("returns no-mail-server message after hasMx=false", () => {
    const r = applyMxResult(validateEmailLocal("user@example.com"), false);
    expect(r.message).toMatch(/no mail server/i);
  });

  it("returns role address message when role is detected", () => {
    const r = validateEmailLocal("admin@example.com");
    expect(r.message).toMatch(/role address/i);
  });

  it("returns ghost address message when apiDeliverable=false", () => {
    const r = mergeSmtpResult(
      applyMxResult(validateEmailLocal("user@example.com"), true),
      {
        deliverable: null,
        undeliverable: true,
        disposable: false,
        source: "zerobounce",
      },
    );
    expect(r.message).toMatch(/ghost address/i);
  });

  it("returns live mailbox message when apiDeliverable=true", () => {
    const r = mergeSmtpResult(
      applyMxResult(validateEmailLocal("user@example.com"), true),
      {
        deliverable: true,
        undeliverable: false,
        disposable: false,
        source: "zerobounce",
      },
    );
    expect(r.message).toMatch(/mailbox is live/i);
  });

  it("returns legit message for valid email with no API check", () => {
    const r = validateEmailLocal("user@example.com");
    expect(r.message).toMatch(/legit/i);
  });
});

// ── Case normalization ────────────────────────────────────────────────────────
describe("validateEmailLocal — case normalization", () => {
  it("normalizes uppercase email to lowercase", () => {
    const r = validateEmailLocal("USER@GMAIL.COM");
    expect(r.email).toBe("user@gmail.com");
    expect(r.valid).toBe(true);
  });

  it("normalizes mixed-case input", () => {
    const r = validateEmailLocal("First.Last@Example.COM");
    expect(r.email).toBe("first.last@example.com");
  });

  it("uppercase typo domain is still matched in TYPO_MAP", () => {
    const r = validateEmailLocal("USER@GMAIL.CON");
    expect(r.suggestion).toBeDefined();
    expect(r.suggestion).toBe("user@gmail.com");
  });
});

// ── Hyphenated role prefixes ──────────────────────────────────────────────────
describe("validateEmailLocal — hyphenated role prefixes", () => {
  it("detects no-reply@ as a role address", () => {
    expect(validateEmailLocal("no-reply@company.com").checks.notRole).toBe(
      false,
    );
  });

  it("detects do-not-reply@ as a role address", () => {
    expect(validateEmailLocal("do-not-reply@company.com").checks.notRole).toBe(
      false,
    );
  });

  it("detects mailer-daemon@ as a role address", () => {
    expect(validateEmailLocal("mailer-daemon@company.com").checks.notRole).toBe(
      false,
    );
  });

  it("detects human-resources@ as a role address", () => {
    expect(
      validateEmailLocal("human-resources@company.com").checks.notRole,
    ).toBe(false);
  });

  it("detects customer-service@ as a role address", () => {
    expect(
      validateEmailLocal("customer-service@company.com").checks.notRole,
    ).toBe(false);
  });
});

// ── Role address validity and score ──────────────────────────────────────────
// Role emails are syntactically valid (can receive mail) but risky.
// valid=true is intentional — they're flagged via score+message, not banned.
describe("validateEmailLocal — role address valid=true", () => {
  it("role address is valid=true (syntax passes, not disposable)", () => {
    const r = validateEmailLocal("admin@example.com");
    expect(r.valid).toBe(true);
    expect(r.checks.syntax).toBe(true);
    expect(r.checks.notRole).toBe(false);
  });

  it("role address with hasMx=false becomes valid=false after MX check", () => {
    const r = applyMxResult(validateEmailLocal("admin@example.com"), false);
    expect(r.valid).toBe(false);
  });

  it("role address with hasMx=true remains valid=true", () => {
    const r = applyMxResult(validateEmailLocal("admin@example.com"), true);
    expect(r.valid).toBe(true);
  });
});

// ── mergeSmtpResult — edge cases ─────────────────────────────────────────────
describe("mergeSmtpResult — edge cases", () => {
  it("stays invalid when base is disposable even if SMTP says deliverable", () => {
    // A disposable domain the local check caught; API erroneously says deliverable.
    // The notDisposable flag is preserved from local: local.checks.notDisposable=false.
    const disposableLocal = validateEmailLocal("user@mailinator.com");
    // mailinator has real MX records, so simulate hasMx=true
    const withMx = applyMxResult(disposableLocal, true);
    const merged = mergeSmtpResult(withMx, {
      deliverable: true,
      undeliverable: false,
      disposable: false, // API missed it
      source: "zerobounce",
    });
    // notDisposable from local is false; merged inherits it
    expect(merged.checks.notDisposable).toBe(false);
    expect(merged.valid).toBe(false);
  });

  it("conflicting deliverable+undeliverable: deliverable wins (apiDeliverable=true)", () => {
    const local = applyMxResult(validateEmailLocal("user@example.com"), true);
    const merged = mergeSmtpResult(local, {
      deliverable: true,
      undeliverable: true, // contradictory — deliverable takes precedence
      disposable: false,
      source: "zerobounce",
    });
    expect(merged.checks.apiDeliverable).toBe(true);
  });

  it("suggestion field is preserved through mergeSmtpResult", () => {
    const typoLocal = validateEmailLocal("user@gmail.con");
    expect(typoLocal.suggestion).toBeDefined();
    const withMx = applyMxResult(typoLocal, true);
    const merged = mergeSmtpResult(withMx, {
      deliverable: true,
      undeliverable: false,
      disposable: false,
      source: "zerobounce",
    });
    expect(merged.suggestion).toBe("user@gmail.com");
  });
});

// ── Bug regression: four bugs found and fixed ─────────────────────────────────
// Each test documents the failure mode before the fix and asserts the correct
// post-fix behaviour so any future regression surfaces immediately.

describe("Bug regression: mergeSmtpResult typo score cap (Bug 1)", () => {
  // Before fix: computeScore() was called bare, discarding the ≤65 cap that
  // validateEmailLocal applied. After SMTP confirmed deliverability, a typo
  // domain like gmail.con could surface with score=100 — a green result.
  it("preserves ≤65 cap after SMTP merge when apiDeliverable=null", () => {
    const local = applyMxResult(validateEmailLocal("user@gmail.con"), null);
    const merged = mergeSmtpResult(local, {
      deliverable: null,
      undeliverable: false,
      disposable: false,
      source: "zerobounce",
    });
    expect(merged.score).toBeLessThanOrEqual(65);
  });

  it("lifts cap when SMTP explicitly confirms deliverability (domain is real)", () => {
    // apiDeliverable=true means the provider verified the mailbox exists;
    // trust it and lift the speculative typo cap.
    const local = applyMxResult(validateEmailLocal("user@gmail.con"), true);
    const merged = mergeSmtpResult(local, {
      deliverable: true,
      undeliverable: false,
      disposable: false,
      source: "zerobounce",
    });
    expect(merged.score).toBeGreaterThan(65);
  });
});

describe("Bug regression: mergeSmtpResult typo message drop (Bug 2)", () => {
  // Before fix: buildMessage() had no knowledge of local.suggestion, so the
  // typo hint message was silently replaced by the generic deliverability
  // message even though suggestion was still present in the result object.
  it("retains typo hint message after SMTP merge when apiDeliverable=null", () => {
    const local = applyMxResult(validateEmailLocal("user@gmail.con"), null);
    const merged = mergeSmtpResult(local, {
      deliverable: null,
      undeliverable: false,
      disposable: false,
      source: "zerobounce",
    });
    expect(merged.message).toMatch(/typo/i);
    expect(merged.message).toContain("user@gmail.com");
  });

  it("suggestion field and message agree (no split-brain state)", () => {
    const local = applyMxResult(validateEmailLocal("user@gmail.con"), null);
    const merged = mergeSmtpResult(local, {
      deliverable: null,
      undeliverable: false,
      disposable: false,
      source: "zerobounce",
    });
    // message must reference the same address as suggestion
    expect(merged.suggestion).toBeDefined();
    expect(merged.message).toContain(merged.suggestion!);
  });

  it("shows live-mailbox message (not typo hint) when SMTP confirms deliverable", () => {
    const local = applyMxResult(validateEmailLocal("user@gmail.con"), true);
    const merged = mergeSmtpResult(local, {
      deliverable: true,
      undeliverable: false,
      disposable: false,
      source: "zerobounce",
    });
    expect(merged.message).toMatch(/mailbox is live/i);
  });
});

describe("Bug regression: mergeSmtpResult valid misses validTld (Bug 3)", () => {
  // Before fix: when smtp.deliverable=true short-circuited, the branch never
  // consulted local.checks.validTld, allowing an email that failed the TLD
  // check locally to emerge as valid=true after SMTP claimed deliverability.
  it("invalid TLD remains invalid=false even when smtp.deliverable=true", () => {
    // Craft a local result where validTld=false and valid=false, then simulate
    // an optimistic SMTP response.
    const badTldLocal = validateEmailLocal("user@nodot"); // fails regex → syntaxOk=false
    // Force a plausible scenario: syntax=true but tld=false by overriding checks
    const fakeLocal: EmailValidationResult = {
      ...badTldLocal,
      checks: { ...badTldLocal.checks, syntax: true, validTld: false },
      valid: false, // tldOk=false keeps local.valid false
    };
    const withMx = applyMxResult(fakeLocal, true);
    const merged = mergeSmtpResult(withMx, {
      deliverable: true,
      undeliverable: false,
      disposable: false,
      source: "zerobounce",
    });
    expect(merged.valid).toBe(false);
  });
});

describe("Bug regression: apiDeliverable=false cap weaker than hasMx=false (Bug 4)", () => {
  // Before fix: apiDeliverable=false capped at ≤20, hasMx=false capped at ≤15.
  // A confirmed-undeliverable mailbox is a stronger negative signal than a
  // missing MX record (which could be transient), so its cap should be lower.
  it("confirmed-undeliverable caps score at ≤10 (below the no-MX cap of ≤15)", () => {
    const local = applyMxResult(validateEmailLocal("user@example.com"), true); // 95
    const merged = mergeSmtpResult(local, {
      deliverable: null,
      undeliverable: true,
      disposable: false,
      source: "zerobounce",
    });
    // Must be below the hasMx=false cap of 15
    expect(merged.score).toBeLessThanOrEqual(10);
  });

  it("no-MX caps at ≤15, so confirmed-undeliverable is always a lower score", () => {
    const noMxScore = applyMxResult(
      validateEmailLocal("user@example.com"),
      false,
    ).score;
    const undeliverableLocal = applyMxResult(
      validateEmailLocal("user@example.com"),
      true,
    );
    const undeliverableScore = mergeSmtpResult(undeliverableLocal, {
      deliverable: null,
      undeliverable: true,
      disposable: false,
      source: "zerobounce",
    }).score;
    expect(undeliverableScore).toBeLessThanOrEqual(noMxScore);
  });
});

describe("Bug regression: applyMxResult hasMx=true leaked inflated typo score (Bug 5)", () => {
  // Before fix: applyMxResult only re-applied the ≤65 cap when hasMx===null.
  // When hasMx===true, computeScore() lifted the score to 95. If no SMTP
  // provider was configured the API route returned resultWithMx directly,
  // so a typo domain that happened to have MX records surfaced at score=95
  // instead of ≤65. Fix: always cap when suggestion is set; lift only in
  // mergeSmtpResult when apiDeliverable===true.
  it("hasMx=true does not lift typo score above 65 in applyMxResult", () => {
    const local = validateEmailLocal("user@gmail.con");
    expect(local.score).toBeLessThanOrEqual(65);
    const withMx = applyMxResult(local, true);
    expect(withMx.score).toBeLessThanOrEqual(65);
  });

  it("cap is only lifted by mergeSmtpResult with apiDeliverable=true", () => {
    const withMx = applyMxResult(validateEmailLocal("user@gmail.con"), true);
    const lifted = mergeSmtpResult(withMx, {
      deliverable: true,
      undeliverable: false,
      disposable: false,
      source: "zerobounce",
    });
    expect(lifted.score).toBeGreaterThan(65);
    expect(lifted.checks.apiDeliverable).toBe(true);
  });
});
