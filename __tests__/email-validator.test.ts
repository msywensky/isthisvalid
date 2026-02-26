import {
  validateEmailLocal,
  mergeEmailableResult,
  mergeSmtpResult,
  applyMxResult,
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
    expect(merged.score).toBeLessThanOrEqual(20);
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
    expect(merged.score).toBeLessThanOrEqual(20);
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
