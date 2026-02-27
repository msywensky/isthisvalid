import {
  validateUrlLocal,
  applyHeadResult,
  applySafeBrowsingResult,
  getRegisteredDomain,
  checkBrandSquat,
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

// ── Excessive subdomain depth ──────────────────────────────────────────────

describe("excessive subdomain depth check", () => {
  test("5 labels (3 subdomains) is flagged as excessive", () => {
    const r = validateUrlLocal("https://login.secure.verify.bank.evil.com");
    expect(r.checks.notExcessiveSubdomains).toBe(false);
    expect(r.flags.some((f) => f.toLowerCase().includes("subdomain"))).toBe(
      true,
    );
    expect(r.score).toBeLessThanOrEqual(60);
  });

  test("4 labels (2 subdomains) is acceptable", () => {
    const r = validateUrlLocal("https://api.shop.example.com");
    expect(r.checks.notExcessiveSubdomains).toBe(true);
    expect(r.flags.every((f) => !f.toLowerCase().includes("subdomain"))).toBe(
      true,
    );
  });

  test("3 labels (1 subdomain, e.g. www.example.com) is acceptable", () => {
    const r = validateUrlLocal("https://www.example.com");
    expect(r.checks.notExcessiveSubdomains).toBe(true);
  });

  test("2 labels (no subdomain, e.g. example.com) is acceptable", () => {
    const r = validateUrlLocal("https://example.com");
    expect(r.checks.notExcessiveSubdomains).toBe(true);
  });

  test("classically structured phishing URL is flagged", () => {
    // paypal.com appears as subdomain; excessive depth hides the real domain
    const r = validateUrlLocal(
      "https://paypal.com.secure.verify.attacker.com/login",
    );
    expect(r.checks.notExcessiveSubdomains).toBe(false);
    expect(r.safe).toBe(false);
  });

  test("excessive subdomain message is specific", () => {
    const r = validateUrlLocal("https://a.b.c.d.example.com");
    expect(r.message.toLowerCase()).toMatch(/subdomain/);
  });
});

// ── Suspicious / high-abuse TLD ───────────────────────────────────────────

describe("notSuspiciousTld check", () => {
  test(".tk TLD is flagged as high-risk", () => {
    const r = validateUrlLocal("https://free-bank.tk");
    expect(r.checks.notSuspiciousTld).toBe(false);
    expect(r.flags.some((f) => f.toLowerCase().includes("high-risk tld"))).toBe(
      true,
    );
    expect(r.score).toBeLessThanOrEqual(80);
  });

  test(".ml TLD is flagged as high-risk", () => {
    const r = validateUrlLocal("https://prize-winner.ml");
    expect(r.checks.notSuspiciousTld).toBe(false);
  });

  test(".xyz TLD is flagged as high-risk", () => {
    const r = validateUrlLocal("https://crypto-airdrop.xyz");
    expect(r.checks.notSuspiciousTld).toBe(false);
    expect(r.score).toBeLessThanOrEqual(80);
  });

  test(".top TLD is flagged as high-risk", () => {
    const r = validateUrlLocal("https://download-free.top");
    expect(r.checks.notSuspiciousTld).toBe(false);
  });

  test(".com TLD is not flagged", () => {
    const r = validateUrlLocal("https://example.com");
    expect(r.checks.notSuspiciousTld).toBe(true);
  });

  test(".org TLD is not flagged", () => {
    const r = validateUrlLocal("https://nonprofit.org");
    expect(r.checks.notSuspiciousTld).toBe(true);
  });

  test(".net TLD is not flagged", () => {
    const r = validateUrlLocal("https://backbone.net");
    expect(r.checks.notSuspiciousTld).toBe(true);
  });

  test("suspicious TLD message is specific", () => {
    const r = validateUrlLocal("https://phish.tk");
    expect(r.message.toLowerCase()).toMatch(/tld|phishing|malware/);
  });
});

// ── Expanded URL shorteners ────────────────────────────────────────────────

describe("expanded URL shortener detection", () => {
  test("t.ly is detected as a shortener", () => {
    const r = validateUrlLocal("https://t.ly/abc123");
    expect(r.checks.notShortener).toBe(false);
  });

  test("v.gd is detected as a shortener", () => {
    const r = validateUrlLocal("https://v.gd/xyz");
    expect(r.checks.notShortener).toBe(false);
  });

  test("rebrand.ly is detected as a shortener", () => {
    const r = validateUrlLocal("https://rebrand.ly/mylink");
    expect(r.checks.notShortener).toBe(false);
  });

  test("snip.ly is detected as a shortener", () => {
    const r = validateUrlLocal("https://snip.ly/ref");
    expect(r.checks.notShortener).toBe(false);
  });
});

// ── Expanded brand squatting ───────────────────────────────────────────────

describe("expanded brand squatting detection", () => {
  test("walmart-deals.com is flagged as brand squat", () => {
    const r = validateUrlLocal("https://walmart-deals.com/checkout");
    expect(r.checks.noBrandSquat).toBe(false);
  });

  test("stripe-payment.co is flagged as brand squat", () => {
    const r = validateUrlLocal("https://stripe-payment.co/invoice");
    expect(r.checks.noBrandSquat).toBe(false);
  });

  test("discord-gift.com is flagged as brand squat", () => {
    const r = validateUrlLocal("https://discord-gift.com/nitro");
    expect(r.checks.noBrandSquat).toBe(false);
  });

  test("fedex-tracking.com is flagged as brand squat", () => {
    const r = validateUrlLocal("https://fedex-tracking.com/package");
    expect(r.checks.noBrandSquat).toBe(false);
  });

  test("irs-refund.com is flagged as brand squat", () => {
    const r = validateUrlLocal("https://irs-refund.com/claim");
    expect(r.checks.noBrandSquat).toBe(false);
  });

  test("zoom-meeting.com is flagged as brand squat", () => {
    const r = validateUrlLocal("https://zoom-meeting.com/join");
    expect(r.checks.noBrandSquat).toBe(false);
  });

  test("zoom.us is NOT flagged (legitimate canonical)", () => {
    const r = validateUrlLocal("https://zoom.us/join/123");
    expect(r.checks.noBrandSquat).toBe(true);
  });

  test("github.com is NOT flagged", () => {
    const r = validateUrlLocal("https://github.com/user/repo");
    expect(r.checks.noBrandSquat).toBe(true);
  });
});

// ── Expanded phishing path patterns ──────────────────────────────────────

describe("expanded phishing path detection", () => {
  test("/recover-account path is flagged", () => {
    const r = validateUrlLocal("https://example.com/recover-account/step1");
    expect(r.checks.noSuspiciousKeywords).toBe(false);
  });

  test("/secure-login path is flagged", () => {
    const r = validateUrlLocal("https://example.com/secure-login");
    expect(r.checks.noSuspiciousKeywords).toBe(false);
  });

  test("/login-confirm path is flagged", () => {
    const r = validateUrlLocal("https://example.com/login-confirm");
    expect(r.checks.noSuspiciousKeywords).toBe(false);
  });

  test("/unlock-account path is flagged", () => {
    const r = validateUrlLocal("https://example.com/unlock-account/user");
    expect(r.checks.noSuspiciousKeywords).toBe(false);
  });

  test("/limited-access path is flagged", () => {
    const r = validateUrlLocal("https://bank.phish.com/limited-access");
    expect(r.checks.noSuspiciousKeywords).toBe(false);
  });

  test("/unusual-signin path is flagged", () => {
    const r = validateUrlLocal("https://example.com/unusual-signin/verify");
    expect(r.checks.noSuspiciousKeywords).toBe(false);
  });
});

// ── getRegisteredDomain ───────────────────────────────────────────────────

describe("getRegisteredDomain", () => {
  test("simple .com domain returns last two parts", () => {
    expect(getRegisteredDomain("www.example.com")).toBe("example.com");
  });

  test("bare two-part domain is returned as-is", () => {
    expect(getRegisteredDomain("example.com")).toBe("example.com");
  });

  test("co.uk compound suffix returns three parts", () => {
    expect(getRegisteredDomain("www.paypal.co.uk")).toBe("paypal.co.uk");
  });

  test("com.au compound suffix returns three parts", () => {
    expect(getRegisteredDomain("shop.amazon.com.au")).toBe("amazon.com.au");
  });

  test("com.br compound suffix returns three parts", () => {
    expect(getRegisteredDomain("www.mercadolibre.com.br")).toBe(
      "mercadolibre.com.br",
    );
  });

  test("deeply nested subdomain with .co.uk still extracts correctly", () => {
    expect(getRegisteredDomain("a.b.c.example.co.uk")).toBe("example.co.uk");
  });

  test("hostname with no dots is returned as-is", () => {
    expect(getRegisteredDomain("localhost")).toBe("localhost");
  });
});

// ── checkBrandSquat ───────────────────────────────────────────────────────

describe("checkBrandSquat", () => {
  test("legitimate paypal.com returns true (not a squat)", () => {
    expect(checkBrandSquat("paypal.com")).toBe(true);
  });

  test("paypal-secure.com is flagged as brand squat", () => {
    expect(checkBrandSquat("paypal-secure.com")).toBe(false);
  });

  test("www.paypal.co.uk is NOT flagged (ccTLD legitimate)", () => {
    expect(checkBrandSquat("www.paypal.co.uk")).toBe(true);
  });

  test("www.amazon.com.au is NOT flagged (ccTLD legitimate)", () => {
    expect(checkBrandSquat("www.amazon.com.au")).toBe(true);
  });

  test("paypal.evil.com is flagged (brand in subdomain, wrong registered domain)", () => {
    expect(checkBrandSquat("paypal.evil.com")).toBe(false);
  });

  test("microsoft-login.net is flagged as brand squat", () => {
    expect(checkBrandSquat("microsoft-login.net")).toBe(false);
  });

  test("unrelated domain is not flagged", () => {
    expect(checkBrandSquat("totallynormal.com")).toBe(true);
  });
});

// ── IP address detection (hex / integer forms) ───────────────────────────

describe("IP address detection edge cases", () => {
  test("dotted-decimal IPv4 is flagged", () => {
    const r = validateUrlLocal("http://192.168.1.1/admin");
    expect(r.checks.notIpAddress).toBe(false);
  });

  test("pure integer IPv4 (2130706433 = 127.0.0.1) is flagged", () => {
    // WHATWG URL parser normalises 2130706433 to 127.0.0.1 (dotted-decimal),
    // which the dotted regex then catches.
    const r = validateUrlLocal("http://2130706433/");
    expect(r.checks.notIpAddress).toBe(false);
  });

  test("hex integer IPv4 (0x7f000001 = 127.0.0.1) is flagged", () => {
    // WHATWG normalises 0x7f000001 to 127.0.0.1 (dotted-decimal).
    const r = validateUrlLocal("http://0x7f000001/");
    expect(r.checks.notIpAddress).toBe(false);
  });

  test("IPv6 loopback is flagged", () => {
    const r = validateUrlLocal("http://[::1]/admin");
    expect(r.checks.notIpAddress).toBe(false);
  });
});
