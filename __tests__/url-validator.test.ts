import {
  validateUrlLocal,
  applyHeadResult,
  applySafeBrowsingResult,
} from "../src/lib/url-validator";

// ── validateUrlLocal ───────────────────────────────────────────────────────

describe("validateUrlLocal", () => {
  test("clean HTTPS URL scores 100 (all local checks pass)", () => {
    const r = validateUrlLocal("https://example.com/some/path");
    expect(r.checks.parseable).toBe(true);
    expect(r.checks.validScheme).toBe(true);
    expect(r.checks.notIpAddress).toBe(true);
    expect(r.checks.noUserInfo).toBe(true);
    expect(r.checks.notShortener).toBe(true);
    expect(r.checks.noSuspiciousKeywords).toBe(true);
    expect(r.checks.notPunycode).toBe(true);
    expect(r.checks.validTld).toBe(true);
    expect(r.checks.noBrandSquat).toBe(true);
    expect(r.score).toBe(100);
    expect(r.safe).toBe(true);
    expect(r.flags).toHaveLength(0);
  });

  test("URL with path and query string passes all checks", () => {
    const r = validateUrlLocal(
      "https://shop.example.com/products?id=42&ref=home",
    );
    expect(r.checks.parseable).toBe(true);
    expect(r.score).toBe(100);
    expect(r.safe).toBe(true);
  });

  test("bare domain without scheme is auto-prepended and analysed", () => {
    const r = validateUrlLocal("example.com");
    expect(r.checks.parseable).toBe(true);
    expect(r.checks.validScheme).toBe(true); // auto-prepended https
    expect(r.safe).toBe(true);
  });

  test("completely invalid string → score=0 and parseable=false", () => {
    const r = validateUrlLocal("not a url !!!");
    expect(r.checks.parseable).toBe(false);
    expect(r.score).toBe(0);
    expect(r.safe).toBe(false);
    expect(r.flags).toContain("Not a valid URL structure");
  });

  test("FTP scheme is flagged as invalid scheme", () => {
    const r = validateUrlLocal("ftp://files.example.com/data.csv");
    expect(r.checks.validScheme).toBe(false);
    expect(r.flags.some((f) => f.toLowerCase().includes("scheme"))).toBe(true);
  });

  test("raw IPv4 address is flagged", () => {
    const r = validateUrlLocal("http://192.168.1.1/admin");
    expect(r.checks.notIpAddress).toBe(false);
    expect(r.flags.some((f) => f.toLowerCase().includes("ip"))).toBe(true);
  });

  test("URL shortener is flagged", () => {
    const r = validateUrlLocal("https://bit.ly/3xAbCdE");
    expect(r.checks.notShortener).toBe(false);
    expect(r.flags.some((f) => f.toLowerCase().includes("shortener"))).toBe(
      true,
    );
  });

  test("Punycode domain is flagged", () => {
    const r = validateUrlLocal("https://xn--pple-43d.com");
    expect(r.checks.notPunycode).toBe(false);
    expect(r.flags.some((f) => f.toLowerCase().includes("punycode"))).toBe(
      true,
    );
  });

  test("brand squatting domain (paypal-secure.com) is flagged", () => {
    const r = validateUrlLocal("https://paypal-secure.com/login");
    expect(r.checks.noBrandSquat).toBe(false);
    expect(r.flags.some((f) => f.toLowerCase().includes("brand"))).toBe(true);
    // Score loses the 15-pt noBrandSquat bonus; message warns about impersonation
    expect(r.message.toLowerCase()).toMatch(/brand|impersonat/);
  });

  test("legitimate paypal.com is NOT flagged as brand squatting", () => {
    const r = validateUrlLocal("https://www.paypal.com/signin");
    expect(r.checks.noBrandSquat).toBe(true);
    expect(r.flags.every((f) => !f.toLowerCase().includes("brand"))).toBe(true);
  });

  test("suspicious path keywords are flagged", () => {
    const r = validateUrlLocal("https://example.com/verify-account/step1");
    expect(r.checks.noSuspiciousKeywords).toBe(false);
    expect(r.flags.some((f) => f.toLowerCase().includes("phishing"))).toBe(
      true,
    );
  });

  test("embedded credentials (@) in URL are flagged", () => {
    const r = validateUrlLocal("https://paypal.com@evil.com");
    // paypal.com becomes the username (or parsed differently), evil.com is the host
    // either noUserInfo is false OR noBrandSquat is false
    const suspicious = !r.checks.noUserInfo || !r.checks.noBrandSquat;
    expect(suspicious).toBe(true);
  });

  test("resolves starts as null (not yet checked)", () => {
    const r = validateUrlLocal("https://example.com");
    expect(r.checks.resolves).toBeNull();
    expect(r.checks.safeBrowsing).toBeNull();
  });
});

// ── applyHeadResult ────────────────────────────────────────────────────────

describe("applyHeadResult", () => {
  function base() {
    return validateUrlLocal("https://example.com");
  }

  test("resolves=true adds +5 bonus to score", () => {
    const r = base();
    const before = r.score;
    const after = applyHeadResult(r, true);
    expect(after.checks.resolves).toBe(true);
    expect(after.score).toBeGreaterThanOrEqual(before);
    expect(after.score).toBeLessThanOrEqual(100);
  });

  test("resolves=false caps score at 70", () => {
    const r = base();
    const after = applyHeadResult(r, false);
    expect(after.checks.resolves).toBe(false);
    expect(after.score).toBeLessThanOrEqual(70);
  });

  test("resolves=null leaves score unchanged", () => {
    const r = base();
    const before = r.score;
    const after = applyHeadResult(r, null);
    expect(after.checks.resolves).toBeNull();
    expect(after.score).toBe(before);
  });
});

// ── applySafeBrowsingResult ────────────────────────────────────────────────

describe("applySafeBrowsingResult", () => {
  function base() {
    return validateUrlLocal("https://example.com");
  }

  test("isFlagged=true caps score to ≤5", () => {
    const r = applyHeadResult(base(), true);
    const after = applySafeBrowsingResult(r, true);
    expect(after.checks.safeBrowsing).toBe(false);
    expect(after.score).toBeLessThanOrEqual(5);
    expect(after.safe).toBe(false);
  });

  test("isFlagged=true prepends Safe Browsing flag to flags array", () => {
    const r = base();
    const after = applySafeBrowsingResult(r, true);
    expect(after.flags[0]).toMatch(/safe browsing/i);
  });

  test("isFlagged=false sets safeBrowsing=true and updates source", () => {
    const r = base();
    const after = applySafeBrowsingResult(r, false);
    expect(after.checks.safeBrowsing).toBe(true);
    expect(after.source).toBe("safe-browsing");
  });

  test("isFlagged=false does not reduce score", () => {
    const r = applyHeadResult(base(), true);
    const before = r.score;
    const after = applySafeBrowsingResult(r, false);
    expect(after.score).toBeGreaterThanOrEqual(before);
  });

  test("isFlagged=true message warns about Safe Browsing", () => {
    const r = base();
    const after = applySafeBrowsingResult(r, true);
    expect(after.message.toLowerCase()).toContain("safe browsing");
  });
});
