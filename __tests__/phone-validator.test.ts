import {
  validatePhoneLocal,
  applyCarrierResult,
  type PhoneValidationResult,
} from "../src/lib/phone-validator";

// ── validatePhoneLocal — format parsing ───────────────────────────────────────

describe("format parsing", () => {
  test("E.164 format parses correctly", () => {
    const r = validatePhoneLocal("+14155552671");
    expect(r.checks.parseable).toBe(true);
    expect(r.phoneE164).toBe("+14155552671");
    expect(r.countryCode).toBe("US");
  });

  test("international format with spaces parses correctly", () => {
    const r = validatePhoneLocal("+1 415 555 2671");
    expect(r.checks.parseable).toBe(true);
    expect(r.phoneE164).toBe("+14155552671");
  });

  test("international format with dashes parses correctly", () => {
    const r = validatePhoneLocal("+1-415-555-2671");
    expect(r.checks.parseable).toBe(true);
    expect(r.phoneE164).toBe("+14155552671");
  });

  test("international format with parentheses parses correctly", () => {
    const r = validatePhoneLocal("+1 (415) 555-2671");
    expect(r.checks.parseable).toBe(true);
    expect(r.phoneE164).toBe("+14155552671");
  });

  test("leading 00 international prefix normalised to +", () => {
    // 0044... → +44...
    const r = validatePhoneLocal("00447400123456");
    expect(r.checks.parseable).toBe(true);
    expect(r.countryCode).toBe("GB");
  });

  test("UK number in E.164 parses correctly", () => {
    const r = validatePhoneLocal("+447400123456");
    expect(r.checks.parseable).toBe(true);
    expect(r.countryCode).toBe("GB");
    expect(r.countryName).toBe("United Kingdom");
  });

  test("German number parses and detects country", () => {
    const r = validatePhoneLocal("+4915123456789");
    expect(r.checks.parseable).toBe(true);
    expect(r.countryCode).toBe("DE");
    expect(r.countryName).toBe("Germany");
  });

  test("completely invalid string → parseable false, score 0", () => {
    const r = validatePhoneLocal("not a phone");
    expect(r.checks.parseable).toBe(false);
    expect(r.score).toBe(0);
    expect(r.valid).toBe(false);
    expect(r.phoneE164).toBeNull();
    expect(r.lineType).toBeNull();
  });

  test("too short → parseable false", () => {
    const r = validatePhoneLocal("123");
    expect(r.checks.parseable).toBe(false);
    expect(r.score).toBe(0);
  });

  test("empty string → parseable false", () => {
    const r = validatePhoneLocal("  ");
    expect(r.checks.parseable).toBe(false);
    expect(r.score).toBe(0);
  });

  test("input is echoed in result", () => {
    const r = validatePhoneLocal("+14155552671");
    expect(r.input).toBe("+14155552671");
  });

  test("10-digit US number without +1 defaults to US", () => {
    const r = validatePhoneLocal("4155552671");
    expect(r.checks.parseable).toBe(true);
    expect(r.countryCode).toBe("US");
    expect(r.phoneE164).toBe("+14155552671");
  });

  test("US number with dashes and no +1 defaults to US", () => {
    const r = validatePhoneLocal("415-555-2671");
    expect(r.checks.parseable).toBe(true);
    expect(r.countryCode).toBe("US");
  });

  test("US number with parentheses and no +1 defaults to US", () => {
    const r = validatePhoneLocal("(415) 555-2671");
    expect(r.checks.parseable).toBe(true);
    expect(r.countryCode).toBe("US");
    expect(r.valid).toBe(true);
  });

  test("explicit +1 prefix still works", () => {
    const r = validatePhoneLocal("+14155552671");
    expect(r.checks.parseable).toBe(true);
    expect(r.countryCode).toBe("US");
    expect(r.phoneE164).toBe("+14155552671");
  });
});

// ── validatePhoneLocal — validity ─────────────────────────────────────────────

describe("validity", () => {
  test("valid US number → valid true, both checks pass", () => {
    const r = validatePhoneLocal("+14155552671");
    expect(r.valid).toBe(true);
    expect(r.checks.validLength).toBe(true);
    expect(r.checks.validPattern).toBe(true);
    expect(r.checks.possibleNumber).toBe(true);
  });

  test("valid UK mobile → valid true", () => {
    const r = validatePhoneLocal("+447400123456");
    expect(r.valid).toBe(true);
    expect(r.checks.validLength).toBe(true);
  });

  test("valid number produces formatted outputs", () => {
    const r = validatePhoneLocal("+14155552671");
    expect(r.phoneE164).toBe("+14155552671");
    expect(r.nationalFormat).toBeTruthy();
    expect(r.internationalFormat).toBeTruthy();
  });

  test("invalid number → valid false, checks false, formatters null", () => {
    const r = validatePhoneLocal("not a phone");
    expect(r.valid).toBe(false);
    expect(r.checks.validLength).toBe(false);
    expect(r.checks.validPattern).toBe(false);
    expect(r.nationalFormat).toBeNull();
    expect(r.internationalFormat).toBeNull();
  });

  test("source is local for local-only result", () => {
    const r = validatePhoneLocal("+14155552671");
    expect(r.source).toBe("local");
  });
});

// ── validatePhoneLocal — country detection ────────────────────────────────────

describe("country detection", () => {
  test("US number (+1) → countryCode US", () => {
    const r = validatePhoneLocal("+14155552671");
    expect(r.countryCode).toBe("US");
    expect(r.checks.countryDetected).toBe(true);
  });

  test("UK number (+44) → countryCode GB", () => {
    const r = validatePhoneLocal("+447400123456");
    expect(r.countryCode).toBe("GB");
    expect(r.checks.countryDetected).toBe(true);
  });

  test("Australian number (+61) → countryCode AU", () => {
    const r = validatePhoneLocal("+61412345678");
    expect(r.countryCode).toBe("AU");
    expect(r.countryName).toBe("Australia");
    expect(r.checks.countryDetected).toBe(true);
  });

  test("French number (+33) → countryCode FR", () => {
    const r = validatePhoneLocal("+33612345678");
    expect(r.countryCode).toBe("FR");
    expect(r.countryName).toBe("France");
  });

  test("unparseable → country null, countryDetected false", () => {
    const r = validatePhoneLocal("invalid");
    expect(r.countryCode).toBeNull();
    expect(r.countryName).toBeNull();
    expect(r.checks.countryDetected).toBe(false);
  });
});

// ── validatePhoneLocal — line type scoring ────────────────────────────────────

describe("line type scoring", () => {
  test("US toll-free (800) → lineType TOLL_FREE", () => {
    const r = validatePhoneLocal("+18005550199");
    expect(r.checks.parseable).toBe(true);
    expect(r.lineType).toBe("TOLL_FREE");
    expect(r.label).toBe("Toll-Free Number");
  });

  test("US premium-rate (900) → lineType PREMIUM_RATE, score low, flagged", () => {
    const r = validatePhoneLocal("+19005550199");
    expect(r.checks.parseable).toBe(true);
    expect(r.lineType).toBe("PREMIUM_RATE");
    expect(r.score).toBeLessThan(50);
    expect(r.label).toBe("Premium-Rate Number");
    expect(r.flags.some((f) => f.toLowerCase().includes("premium"))).toBe(true);
  });

  test("UK mobile → lineType MOBILE, score ≥ 75", () => {
    const r = validatePhoneLocal("+447400123456");
    expect(r.lineType).toBe("MOBILE");
    expect(r.score).toBeGreaterThanOrEqual(75);
    expect(r.label).toBe("Valid Mobile Number");
  });

  test("UK landline → FIXED_LINE, score ≥ 75", () => {
    const r = validatePhoneLocal("+441174960000");
    expect(r.lineType).toBe("FIXED_LINE");
    expect(r.score).toBeGreaterThanOrEqual(75);
    expect(r.label).toBe("Valid Landline Number");
  });

  test("TOLL_FREE label is correct", () => {
    const r = validatePhoneLocal("+18005550199");
    expect(r.label).toBe("Toll-Free Number");
  });

  test("PREMIUM_RATE message warns about scams", () => {
    const r = validatePhoneLocal("+19005550199");
    expect(r.message.toLowerCase()).toContain("premium");
  });

  test("MOBILE score is higher than PREMIUM_RATE score", () => {
    const mobile = validatePhoneLocal("+447400123456");
    const premium = validatePhoneLocal("+19005550199");
    expect(mobile.score).toBeGreaterThan(premium.score);
  });

  test("unparseable score is 0", () => {
    const r = validatePhoneLocal("garbage input");
    expect(r.score).toBe(0);
  });

  test("valid mobile score is ≥ 70 (valid sentiment threshold)", () => {
    const r = validatePhoneLocal("+447400123456");
    expect(r.score).toBeGreaterThanOrEqual(70);
  });
});

// ── validatePhoneLocal — flags ────────────────────────────────────────────────

describe("flags", () => {
  test("premium-rate number produces flag", () => {
    const r = validatePhoneLocal("+19005550199");
    expect(r.flags.length).toBeGreaterThan(0);
    expect(r.flags.some((f) => f.toLowerCase().includes("premium"))).toBe(true);
  });

  test("valid non-suspicious number has no flags", () => {
    const r = validatePhoneLocal("+447400123456");
    expect(r.flags).toHaveLength(0);
  });

  test("unparseable number has a flag", () => {
    const r = validatePhoneLocal("not a number");
    expect(r.flags.length).toBeGreaterThan(0);
  });
});

// ── validatePhoneLocal — carrier fields null before enrichment ────────────────

describe("carrier fields before enrichment", () => {
  test("carrier is null before enrichment", () => {
    const r = validatePhoneLocal("+14155552671");
    expect(r.carrier).toBeNull();
  });

  test("lineActive is null before enrichment", () => {
    const r = validatePhoneLocal("+14155552671");
    expect(r.lineActive).toBeNull();
  });

  test("ported is null before enrichment", () => {
    const r = validatePhoneLocal("+14155552671");
    expect(r.ported).toBeNull();
  });
});

// ── applyCarrierResult ────────────────────────────────────────────────────────

describe("applyCarrierResult", () => {
  function baseResult(): PhoneValidationResult {
    return validatePhoneLocal("+447400123456");
  }

  test("merges carrier name", () => {
    const enriched = applyCarrierResult(baseResult(), {
      carrier: "EE",
      lineType: "MOBILE",
      ported: false,
      active: true,
    });
    expect(enriched.carrier).toBe("EE");
  });

  test("active confirmation adds score bonus", () => {
    const base = baseResult();
    const enriched = applyCarrierResult(base, {
      carrier: "EE",
      lineType: "MOBILE",
      ported: false,
      active: true,
    });
    expect(enriched.score).toBeGreaterThan(base.score);
  });

  test("inactive line does not add score bonus", () => {
    const base = baseResult();
    const enriched = applyCarrierResult(base, {
      carrier: "EE",
      lineType: "MOBILE",
      ported: false,
      active: false,
    });
    expect(enriched.score).toBe(base.score);
  });

  test("score does not exceed 100", () => {
    const base = baseResult();
    const enriched = applyCarrierResult(base, {
      carrier: "EE",
      lineType: "MOBILE",
      ported: false,
      active: true,
      scoreBonus: 999,
    });
    expect(enriched.score).toBeLessThanOrEqual(100);
  });

  test("sets lineActive from carrier data", () => {
    const enriched = applyCarrierResult(baseResult(), {
      carrier: "EE",
      lineType: "MOBILE",
      ported: false,
      active: true,
    });
    expect(enriched.lineActive).toBe(true);
  });

  test("sets ported from carrier data", () => {
    const enriched = applyCarrierResult(baseResult(), {
      carrier: "EE",
      lineType: "MOBILE",
      ported: true,
      active: true,
    });
    expect(enriched.ported).toBe(true);
  });

  test("source becomes numverify after enrichment", () => {
    const enriched = applyCarrierResult(baseResult(), {
      carrier: "EE",
      lineType: "MOBILE",
      ported: false,
      active: true,
    });
    expect(enriched.source).toBe("numverify");
  });

  test("API lineType overrides local when not UNKNOWN", () => {
    const enriched = applyCarrierResult(baseResult(), {
      carrier: "EE",
      lineType: "FIXED_LINE",
      ported: false,
      active: true,
    });
    expect(enriched.lineType).toBe("FIXED_LINE");
  });

  test("original result is not mutated", () => {
    const base = baseResult();
    const originalScore = base.score;
    applyCarrierResult(base, {
      carrier: "EE",
      lineType: "MOBILE",
      ported: false,
      active: true,
    });
    expect(base.score).toBe(originalScore);
    expect(base.carrier).toBeNull();
  });
});

// ── Scoring order regression ──────────────────────────────────────────────────

describe("scoring regressions", () => {
  test("premium-rate score is always < 50 (warn/invalid zone)", () => {
    const r = validatePhoneLocal("+19005550199");
    expect(r.score).toBeLessThan(50);
  });

  test("valid mobile score is always ≥ 70 (valid zone)", () => {
    const r = validatePhoneLocal("+447400123456");
    expect(r.score).toBeGreaterThanOrEqual(70);
  });

  test("unparseable score is always 0", () => {
    for (const input of ["abc", "+++", "000", "   "]) {
      const r = validatePhoneLocal(input);
      expect(r.score).toBe(0);
    }
  });
});
