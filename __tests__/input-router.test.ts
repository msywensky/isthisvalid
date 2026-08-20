import {
  detectInputKind,
  extractUrls,
  extractPhones,
  MAX_AUTO_URL_CHECKS,
  MAX_PHONE_SUGGESTIONS,
} from "@/lib/input-router";

describe("detectInputKind", () => {
  describe("basic kinds", () => {
    it("detects an email address", () => {
      const r = detectInputKind("user@example.com");
      expect(r.kind).toBe("email");
      expect(r.value).toBe("user@example.com");
    });

    it("detects an explicit https URL", () => {
      const r = detectInputKind("https://example.com/login");
      expect(r.kind).toBe("url");
      expect(r.value).toBe("https://example.com/login");
    });

    it("detects a bare domain as a URL", () => {
      expect(detectInputKind("example.com").kind).toBe("url");
    });

    it("detects a bare domain with a path as a URL", () => {
      expect(detectInputKind("paypal-secure.com/verify").kind).toBe("url");
    });

    it("detects a formatted phone number", () => {
      const r = detectInputKind("+1 555 123 4567");
      expect(r.kind).toBe("phone");
    });

    it("detects prose as text", () => {
      const r = detectInputKind(
        "Your package could not be delivered. Please confirm your address.",
      );
      expect(r.kind).toBe("text");
    });

    it("preserves the raw input on every result", () => {
      const raw = "  user@example.com  ";
      const r = detectInputKind(raw);
      expect(r.raw).toBe(raw);
      expect(r.value).toBe("user@example.com");
    });
  });

  describe("empty input", () => {
    it("treats an empty string as text", () => {
      const r = detectInputKind("");
      expect(r.kind).toBe("text");
      expect(r.value).toBe("");
    });

    it("treats a whitespace-only string as text", () => {
      const r = detectInputKind("   \n\t  ");
      expect(r.kind).toBe("text");
      expect(r.value).toBe("");
    });
  });

  describe("dangerous schemes (security regression)", () => {
    // Mirrors the guarantee qr-content.test.ts makes for classifyQrContent:
    // these must never be classified as "url" and handed to the URL checker.
    const dangerous = [
      "javascript:alert(1)",
      "JavaScript:alert(document.cookie)",
      "data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==",
      "file:///etc/passwd",
      "vbscript:msgbox(1)",
      "blob:https://example.com/1234",
    ];

    it.each(dangerous)("classifies %s as text, never url", (input) => {
      const r = detectInputKind(input);
      expect(r.kind).toBe("text");
      expect(r.kind).not.toBe("url");
    });
  });

  describe("scheme handling", () => {
    it("unwraps mailto: and strips the subject", () => {
      const r = detectInputKind("mailto:a@b.com?subject=hi");
      expect(r.kind).toBe("email");
      expect(r.value).toBe("a@b.com");
    });

    it("unwraps tel:", () => {
      const r = detectInputKind("tel:+15551234567");
      expect(r.kind).toBe("phone");
      expect(r.value).toBe("+15551234567");
    });

    it("strips tel: parameters", () => {
      const r = detectInputKind("tel:+15551234567;phone-context=+1");
      expect(r.value).toBe("+15551234567");
    });

    it("falls back to text for an unsupported scheme", () => {
      expect(detectInputKind("ftp://files.example.com").kind).toBe("text");
    });
  });

  describe("ambiguity — precedence order", () => {
    it("treats support@paypal.com as an email, not a URL", () => {
      expect(detectInputKind("support@paypal.com").kind).toBe("email");
    });

    it("treats a bare 10-digit number as a phone", () => {
      expect(detectInputKind("1234567890").kind).toBe("phone");
    });

    it("treats an IPv4 literal as a URL, not a phone", () => {
      const r = detectInputKind("192.168.1.1");
      expect(r.kind).toBe("url");
      expect(r.kind).not.toBe("phone");
    });

    it("treats an IPv4 literal with a path as a URL", () => {
      expect(detectInputKind("203.0.113.5/login").kind).toBe("url");
    });

    it("treats a spaced phone number as a phone, not prose", () => {
      const r = detectInputKind("+1 555 123 4567");
      expect(r.kind).toBe("phone");
      expect(r.kind).not.toBe("text");
    });

    it("handles bracketed and hyphenated US formatting", () => {
      expect(detectInputKind("(555) 123-4567").kind).toBe("phone");
    });

    it("handles unicode dashes copied from a messaging app", () => {
      expect(detectInputKind("555–123–4567").kind).toBe("phone");
    });

    it("treats too-few digits as text, not a phone", () => {
      expect(detectInputKind("12345").kind).toBe("text");
    });

    it("treats too-many digits as text, not a phone", () => {
      expect(detectInputKind("12345678901234567890").kind).toBe("text");
    });

    it("collapses whitespace in the phone value", () => {
      expect(detectInputKind("+1   555   123   4567").value).toBe(
        "+1 555 123 4567",
      );
    });

    it("falls back to E.164 when formatting exceeds the API length cap", () => {
      // /api/validate-phone rejects anything over 25 characters.
      const spaced = "+1 ( 5 5 5 ) 1 2 3 - 4 5 6 7";
      expect(spaced.length).toBeGreaterThan(25);

      const r = detectInputKind(spaced);
      expect(r.kind).toBe("phone");
      expect(r.value).toBe("+15551234567");
      expect(r.value.length).toBeLessThanOrEqual(25);
    });

    it("treats a number with trailing words as prose", () => {
      expect(detectInputKind("+1 555 123 4567 ext. 22").kind).toBe("text");
    });
  });
});

describe("extractUrls", () => {
  it("pulls the link out of a realistic smishing SMS", () => {
    const sms =
      "USPS: your package is on hold. Update your address at usps-redelivery.com/track or call 1-800-555-0199.";
    expect(extractUrls(sms)).toEqual(["usps-redelivery.com/track"]);
  });

  it("pulls an explicit https link out of prose", () => {
    const sms = "Verify now: https://secure-chase.example.com/login please.";
    expect(extractUrls(sms)).toEqual([
      "https://secure-chase.example.com/login",
    ]);
  });

  it("strips trailing punctuation", () => {
    expect(extractUrls("Visit example.com.")).toEqual(["example.com"]);
    expect(extractUrls("Go to https://example.com/a, now")).toEqual([
      "https://example.com/a",
    ]);
    expect(extractUrls("(see example.com)")).toEqual(["example.com"]);
  });

  it("deduplicates case-insensitively, preserving first-seen casing", () => {
    expect(extractUrls("example.com and EXAMPLE.COM and Example.com")).toEqual([
      "example.com",
    ]);
  });

  it("does not emit the host of an explicit link a second time", () => {
    expect(extractUrls("go to https://example.com/a now")).toEqual([
      "https://example.com/a",
    ]);
  });

  it("does not extract the domain of an email address as a link", () => {
    expect(extractUrls("Contact support@paypal.com for help")).toEqual([]);
  });

  it("rejects sentence text that looks like a domain", () => {
    // A missing space after a full stop must not become an API call.
    expect(extractUrls("Package delayed.Also confirm details")).toEqual([]);
    expect(extractUrls("Sorry.Call us back")).toEqual([]);
  });

  it("never extracts a dangerous scheme", () => {
    expect(extractUrls("click javascript:alert(1) now")).toEqual([]);
    expect(extractUrls("open file:///etc/passwd")).toEqual([]);
  });

  it("returns an empty array (not null) when there is nothing to find", () => {
    expect(extractUrls("Hey, are we still on for lunch tomorrow?")).toEqual([]);
  });

  it("returns every match — the fan-out cap is the caller's job", () => {
    const many =
      "one.com two.com three.com four.com five.com are all in this message";
    const found = extractUrls(many);
    expect(found).toHaveLength(5);
    expect(found.length).toBeGreaterThan(MAX_AUTO_URL_CHECKS);
  });

  it("exposes a fan-out cap of 3 to bound the shared rate-limit budget", () => {
    expect(MAX_AUTO_URL_CHECKS).toBe(3);
  });
});

describe("extractPhones", () => {
  it("pulls the callback number out of a realistic smishing SMS", () => {
    const sms =
      "USPS: your package is on hold. Update at usps-redelivery.com or call 1-800-555-0199.";
    expect(extractPhones(sms)).toEqual(["1-800-555-0199"]);
  });

  it("finds an E.164 number in prose", () => {
    expect(extractPhones("Reply or call +14155552671 today")).toEqual([
      "+14155552671",
    ]);
  });

  it("deduplicates repeated numbers", () => {
    const found = extractPhones(
      "Call 415-555-2671 or 415-555-2671 to confirm.",
    );
    expect(found).toEqual(["415-555-2671"]);
  });

  it("does not read digits inside a URL as a phone number", () => {
    expect(
      extractPhones("Track at https://example.com/track/14155552671 now"),
    ).toEqual([]);
  });

  it("rejects junk digit runs that are not valid numbers", () => {
    expect(extractPhones("Order 000000000 confirmed")).toEqual([]);
    expect(extractPhones("Reference 1111111111111111 attached")).toEqual([]);
  });

  it("returns an empty array (not null) when there is nothing to find", () => {
    expect(extractPhones("Hey, are we still on for lunch tomorrow?")).toEqual(
      [],
    );
  });

  it("exposes an on-demand phone cap of 3", () => {
    expect(MAX_PHONE_SUGGESTIONS).toBe(3);
  });
});

describe("[Smart input regression] combined message", () => {
  const sms =
    "Chase Alert: unusual activity on your account. Verify at chase-secure-verify.com/auth or call (800) 555-0142 immediately.";

  it("classifies the whole message as text", () => {
    expect(detectInputKind(sms).kind).toBe("text");
  });

  it("finds the embedded link", () => {
    expect(extractUrls(sms)).toContain("chase-secure-verify.com/auth");
  });

  it("finds the embedded callback number", () => {
    expect(extractPhones(sms)).toHaveLength(1);
  });
});
