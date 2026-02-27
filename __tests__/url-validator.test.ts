import {
  validateUrlLocal,
  applyHeadResult,
  applySafeBrowsingResult,
  applyRdapResult,
  applyRedirectResult,
  getRegisteredDomain,
  checkBrandSquat,
  checkTyposquat,
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

  // Newly added ccTLD entries (issue E)
  test("co.il compound suffix returns three parts", () => {
    expect(getRegisteredDomain("www.example.co.il")).toBe("example.co.il");
  });

  test("com.co compound suffix returns three parts", () => {
    expect(getRegisteredDomain("www.example.com.co")).toBe("example.com.co");
  });

  test("co.ke compound suffix returns three parts", () => {
    expect(getRegisteredDomain("www.example.co.ke")).toBe("example.co.ke");
  });

  test("com.eg compound suffix returns three parts", () => {
    expect(getRegisteredDomain("www.example.com.eg")).toBe("example.com.eg");
  });

  test("net.cn compound suffix returns three parts", () => {
    expect(getRegisteredDomain("www.example.net.cn")).toBe("example.net.cn");
  });

  test("ac.uk compound suffix returns three parts", () => {
    expect(getRegisteredDomain("www.ox.ac.uk")).toBe("ox.ac.uk");
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

  // Issue F — ccTLD bypass now gated on CCTLD_SECOND_LEVELS membership
  test("paypal.co.il is not flagged (recognised ccTLD compound suffix)", () => {
    expect(checkBrandSquat("paypal.co.il")).toBe(true);
  });

  test("amazon.com.eg is not flagged (recognised ccTLD compound suffix)", () => {
    expect(checkBrandSquat("amazon.com.eg")).toBe(true);
  });

  test("paypal on an unrecognised compound suffix IS flagged", () => {
    // edu.tk is not in CCTLD_SECOND_LEVELS so it is NOT a ccTLD bypass —
    // getRegisteredDomain returns the last two parts ("edu.tk"), the brand
    // pattern matches in the subdomain, and registered !== canonical.
    const r = validateUrlLocal("https://paypal.edu.tk");
    expect(r.checks.noBrandSquat).toBe(false);
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

// ── checkTyposquat ────────────────────────────────────────────────────────

describe("checkTyposquat", () => {
  test("legitimate domain returns true", () => {
    expect(checkTyposquat("paypal.com")).toBe(true);
  });

  test("digit substitution 1→l is caught (paypa1.com)", () => {
    expect(checkTyposquat("paypa1.com")).toBe(false);
  });

  test("digit substitution 0→o is caught (g00gle.com)", () => {
    expect(checkTyposquat("g00gle.com")).toBe(false);
  });

  test("single character dropped (paypl.com)", () => {
    expect(checkTyposquat("paypl.com")).toBe(false);
  });

  test("character doubled (ppaypal.com) is caught", () => {
    // 'ppaypal' is Levenshtein distance 1 from 'paypal'
    expect(checkTyposquat("ppaypal.com")).toBe(false);
  });

  test("combined digit + extra char (paypa1l.com) is caught", () => {
    // normalises to 'paypal' → distance 1 from 'paypal' → but actually normalises to 'paypall'
    // distance 1 from 'paypal' → flagged
    expect(checkTyposquat("paypa1l.com")).toBe(false);
  });

  test("unrelated short common word is not flagged (maple.com)", () => {
    // 'maple' is distance 1 from 'apple' but 'apple' < 6 chars after norm — wait, apple IS 5 chars = brand.length < 6, so skip the Levenshtein check
    // Actually apple has length 5, and brand.length >= 6 guard should prevent the false positive
    expect(checkTyposquat("maple.com")).toBe(true);
  });

  test("canonical brand subdomain is not flagged (www.paypal.com)", () => {
    expect(checkTyposquat("www.paypal.com")).toBe(true);
  });

  test("brand in path-like position does not affect hostname check", () => {
    // paypaling.com — 'paypaling' vs 'paypal': distance 3 → not flagged
    expect(checkTyposquat("paypaling.com")).toBe(true);
  });

  test("microsoft with digit (micros0ft.com) is caught", () => {
    expect(checkTyposquat("micros0ft.com")).toBe(false);
  });
});

// ── notHighEntropy check ──────────────────────────────────────────────────

describe("notHighEntropy check", () => {
  test("clean short domain has notHighEntropy=true", () => {
    const r = validateUrlLocal("https://example.com");
    expect(r.checks.notHighEntropy).toBe(true);
  });

  test("normal branded domain has notHighEntropy=true", () => {
    const r = validateUrlLocal("https://microsoftofficedownload.com");
    expect(r.checks.notHighEntropy).toBe(true);
  });

  test("DGA-like random label (≥12 chars) triggers notHighEntropy=false", () => {
    // 18-char label with all unique chars → Shannon entropy ≈ 4.17 > 3.8
    const r = validateUrlLocal("https://xvqzmbfpkjhgdlnrst.com");
    expect(r.checks.notHighEntropy).toBe(false);
    expect(r.score).toBeLessThanOrEqual(75);
    expect(r.flags.some((f) => f.includes("random-looking"))).toBe(true);
  });

  test("short label (< 12 chars) is not flagged even if high entropy", () => {
    // 'xkcd' is short — below the threshold
    const r = validateUrlLocal("https://xkcd.com");
    expect(r.checks.notHighEntropy).toBe(true);
  });
});

// ── notExcessiveHyphens check ─────────────────────────────────────────────

describe("notExcessiveHyphens check", () => {
  test("normal hyphenated domain passes (my-example.com)", () => {
    const r = validateUrlLocal("https://my-example.com");
    expect(r.checks.notExcessiveHyphens).toBe(true);
  });

  test("double-hyphen domain passes (my-cool-site.com)", () => {
    const r = validateUrlLocal("https://my-cool-site.com");
    expect(r.checks.notExcessiveHyphens).toBe(true);
  });

  test("3 hyphens in one label is flagged (secure-paypal-login-verify.com)", () => {
    const r = validateUrlLocal("https://secure-paypal-login-verify.com");
    expect(r.checks.notExcessiveHyphens).toBe(false);
    expect(r.flags.some((f) => f.includes("hyphens"))).toBe(true);
  });

  test("score is reduced for excessive hyphens", () => {
    const clean = validateUrlLocal("https://example.com");
    const hyph = validateUrlLocal("https://secure-paypal-login-verify.com");
    // hyph should score lower (also caught by brand squat, but deduction still applies)
    expect(hyph.score).toBeLessThan(clean.score);
  });

  test("hyphens spread across different labels are not flagged", () => {
    // Each label has only 1 hyphen
    const r = validateUrlLocal("https://sub-domain.my-site.com");
    expect(r.checks.notExcessiveHyphens).toBe(true);
  });
});

// ── applyRdapResult ───────────────────────────────────────────────────────

describe("applyRdapResult", () => {
  function base() {
    return validateUrlLocal("https://example.com");
  }

  test("isOld=null (RDAP unavailable) leaves score unchanged", () => {
    const r = base();
    const result = applyRdapResult(r, null);
    expect(result.score).toBe(r.score);
    expect(result.checks.notNewlyRegistered).toBeNull();
    expect(result.safe).toBe(true);
  });

  test("isOld=true (established domain) leaves score unchanged", () => {
    const r = base();
    const result = applyRdapResult(r, true);
    expect(result.score).toBe(r.score);
    expect(result.checks.notNewlyRegistered).toBe(true);
    expect(result.safe).toBe(true);
  });

  test("isOld=false (new domain) caps score at ≤70", () => {
    const r = base();
    const result = applyRdapResult(r, false);
    expect(result.score).toBeLessThanOrEqual(70);
    expect(result.checks.notNewlyRegistered).toBe(false);
    expect(result.safe).toBe(false);
  });

  test("isOld=false prepends a flag about newly registered domain", () => {
    const r = base();
    const result = applyRdapResult(r, false);
    expect(result.flags[0]).toMatch(/30 days/);
  });

  test("isOld=false sets safe=false even when score was 100", () => {
    const r = base();
    expect(r.score).toBe(100);
    const result = applyRdapResult(r, false);
    expect(result.safe).toBe(false);
  });

  test("message reflects newly-registered warning", () => {
    const r = base();
    const result = applyRdapResult(r, false);
    expect(result.message).toMatch(/30 days/);
  });
});

// ── applyRedirectResult ───────────────────────────────────────────────────

describe("applyRedirectResult", () => {
  function base() {
    return validateUrlLocal("https://bit.ly/abc123");
  }

  test("takes the minimum score of original and destination", () => {
    const orig = validateUrlLocal("https://example.com"); // score 100
    const dest = validateUrlLocal("https://paypal-secure.com"); // brand squat
    const result = applyRedirectResult(orig, dest, "https://paypal-secure.com");
    expect(result.score).toBeLessThanOrEqual(orig.score);
    expect(result.score).toBe(Math.min(orig.score, dest.score));
  });

  test("sets redirectedTo to the final URL", () => {
    const orig = base();
    const dest = validateUrlLocal("https://example.com");
    const result = applyRedirectResult(orig, dest, "https://example.com");
    expect(result.redirectedTo).toBe("https://example.com");
  });

  test("destination flags are prefixed with 'Redirect destination:'", () => {
    const orig = validateUrlLocal("https://example.com");
    const dest = validateUrlLocal("https://paypal-secure.com");
    const result = applyRedirectResult(orig, dest, "https://paypal-secure.com");
    const prefixed = result.flags.filter((f) =>
      f.startsWith("Redirect destination:"),
    );
    expect(prefixed.length).toBeGreaterThan(0);
  });

  test("safe=false if destination is unsafe", () => {
    const orig = validateUrlLocal("https://example.com");
    // Brand squat → noBrandSquat=false → safe=false
    const dest = validateUrlLocal("https://paypal-verify.com");
    const result = applyRedirectResult(orig, dest, "https://paypal-verify.com");
    expect(result.safe).toBe(false);
  });

  test("safe=true if both original and destination are clean", () => {
    const orig = validateUrlLocal("https://example.com");
    const dest = validateUrlLocal("https://other.com");
    const result = applyRedirectResult(orig, dest, "https://other.com");
    expect(result.safe).toBe(true);
  });
});

// ── Scoring-order regression tests ────────────────────────────────────────
// These guard specific cap-ordering interactions that were previously buggy.

describe("scoring order regressions", () => {
  test("typosquat + resolves=true: score stays ≤79 (resolve bonus cannot bypass the cap)", () => {
    // paypa1.com passes all other local checks but fails notTyposquat.
    // Cap must hold at ≤79 even after the +5 resolve bonus is applied.
    const local = validateUrlLocal("https://paypa1.com");
    expect(local.checks.notTyposquat).toBe(false);
    const withHead = applyHeadResult(local, true); // +5 resolve bonus
    expect(withHead.score).toBeLessThanOrEqual(79);
    expect(withHead.safe).toBe(false);
  });

  test("typosquat + resolves=null: score stays ≤79", () => {
    const local = validateUrlLocal("https://paypa1.com");
    const withHead = applyHeadResult(local, null);
    expect(withHead.score).toBeLessThanOrEqual(79);
    expect(withHead.safe).toBe(false);
  });

  test("typosquat + RDAP old: score stays ≤79", () => {
    const local = validateUrlLocal("https://ppaypal.com");
    const withHead = applyHeadResult(local, true);
    const withRdap = applyRdapResult(withHead, true); // established domain
    expect(withRdap.score).toBeLessThanOrEqual(79);
    expect(withRdap.safe).toBe(false);
  });
});
