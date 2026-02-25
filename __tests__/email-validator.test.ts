import {
  validateEmailLocal,
  mergeEmailableResult,
  applyMxResult,
} from "@/lib/email-validator";

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
  it("suggests gmail.com for gmial.com", () => {
    const r = validateEmailLocal("user@gmial.com");
    expect(r.suggestion).toContain("gmail.com");
  });

  it("suggests hotmail.com for hotmali.com", () => {
    const r = validateEmailLocal("user@hotmali.com");
    expect(r.suggestion).toContain("hotmail.com");
  });

  // ── Score ─────────────────────────────────────────────────────────────────
  it("source is always 'local'", () => {
    expect(validateEmailLocal("a@b.com").source).toBe("local");
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
