import {
  buildImageStrip,
  buildShareText,
  defangUrl,
  defangUrlsInText,
  SITE_URL,
} from "../src/lib/share-text";
import type { EmailValidationResult } from "../src/lib/email-validator";
import type { UrlValidationResult } from "../src/lib/url-validator";
import type { PhoneValidationResult } from "../src/lib/phone-validator";
import type { TextDebunkResult } from "../src/lib/text-debunker";
import type {
  ImageClassification,
  ImageDebunkResult,
} from "../src/lib/image-debunker";
import {
  classifyQrContent,
  QR_WIFI_WARNING,
  type NonUrlQrContent,
} from "../src/lib/qr-content";

// Fixtures carry only the fields share-text reads.
function urlResult(
  url: string,
  score: number,
  redirectedTo?: string,
): UrlValidationResult {
  return { url, score, redirectedTo } as UrlValidationResult;
}

function phoneResult(
  internationalFormat: string | null,
  input = "4155552671",
): PhoneValidationResult {
  return {
    valid: true,
    score: 80,
    input,
    internationalFormat,
    checks: { parseable: true },
  } as PhoneValidationResult;
}

function imageResult(
  classification: ImageClassification,
  riskScore: number,
  modelLabel?: string,
): ImageDebunkResult {
  return { classification, riskScore, modelLabel } as ImageDebunkResult;
}

describe("defangUrl", () => {
  test("https scheme and host dots", () => {
    expect(defangUrl("https://paypa1-login.com/verify")).toBe(
      "hxxps://paypa1-login[.]com/verify",
    );
  });

  test("http scheme", () => {
    expect(defangUrl("http://evil.example")).toBe("hxxp://evil[.]example");
  });

  test("no scheme — host dots only", () => {
    expect(defangUrl("evil.co.uk/login")).toBe("evil[.]co[.]uk/login");
  });

  test("uppercase scheme keeps its case after hxxp", () => {
    expect(defangUrl("HTTPS://Evil.com")).toBe("hxxpS://Evil[.]com");
  });

  test("dots in the path, query and fragment are untouched", () => {
    expect(defangUrl("https://a.com/file.php?x=1.2#s.t")).toBe(
      "hxxps://a[.]com/file.php?x=1.2#s.t",
    );
  });

  test("port is preserved", () => {
    expect(defangUrl("https://evil.com:8080/x.y")).toBe(
      "hxxps://evil[.]com:8080/x.y",
    );
  });
});

describe("defangUrlsInText", () => {
  test("explicit URL in prose", () => {
    expect(defangUrlsInText("Go to https://evil.com/pay now")).toBe(
      "Go to hxxps://evil[.]com/pay now",
    );
  });

  test("bare domain in prose, trailing full stop kept", () => {
    expect(defangUrlsInText("Visit paypal-secure.com.")).toBe(
      "Visit paypal-secure[.]com.",
    );
  });

  test("two URLs", () => {
    expect(defangUrlsInText("a.com and https://b.net/x")).toBe(
      "a[.]com and hxxps://b[.]net/x",
    );
  });

  test("a domain contained in a longer URL is defanged once", () => {
    expect(defangUrlsInText("https://evil.com/login then also evil.com")).toBe(
      "hxxps://evil[.]com/login then also evil[.]com",
    );
  });

  test("email address is left untouched", () => {
    expect(defangUrlsInText("Email support@paypal.com today")).toBe(
      "Email support@paypal.com today",
    );
  });

  test("email untouched even when the same domain also appears as a link", () => {
    expect(defangUrlsInText("support@paypal.com or paypal.com")).toBe(
      "support@paypal.com or paypal[.]com",
    );
  });

  test("differently-cased repeats are all defanged", () => {
    expect(defangUrlsInText("evil.com or EVIL.COM")).toBe(
      "evil[.]com or EVIL[.]COM",
    );
  });

  test("a listed domain never matches the front of a longer word", () => {
    expect(defangUrlsInText("evil.com, not evil.community")).toBe(
      "evil[.]com, not evil.community",
    );
  });

  test("no URLs → unchanged", () => {
    expect(defangUrlsInText("Your code is 123456")).toBe("Your code is 123456");
  });
});

describe("buildShareText", () => {
  test("email", () => {
    const result = {
      email: "jane@example.com",
      valid: true,
      score: 85,
      checks: { syntax: true },
    } as EmailValidationResult;
    expect(buildShareText({ kind: "email", result })).toBe(
      "I checked this email address on IsThisValid:\n" +
        "jane@example.com\n" +
        "Verdict: Valid (score 85/100)\n\n" +
        `Check one yourself: ${SITE_URL}/check/email`,
    );
  });

  test("url — dangerous, with redirect", () => {
    const result = urlResult(
      "https://paypa1-login.com/verify",
      12,
      "https://evil.example/x",
    );
    expect(buildShareText({ kind: "url", result })).toBe(
      "I checked this link on IsThisValid:\n" +
        "hxxps://paypa1-login[.]com/verify\n" +
        "Redirects to: hxxps://evil[.]example/x\n" +
        "Verdict: Dangerous (score 12/100)\n" +
        "⚠️ Don't open this link.\n\n" +
        `Check one yourself: ${SITE_URL}/check/url`,
    );
  });

  test("url — no redirect line when redirectedTo is absent", () => {
    const text = buildShareText({
      kind: "url",
      result: urlResult("https://a.com/", 90),
    });
    expect(text).not.toContain("Redirects to");
  });

  test("url — warning at 79, none at 80", () => {
    const at79 = buildShareText({
      kind: "url",
      result: urlResult("https://a.com/", 79),
    });
    const at80 = buildShareText({
      kind: "url",
      result: urlResult("https://a.com/", 80),
    });
    expect(at79).toContain("Don't open this link");
    expect(at80).not.toContain("Don't open this link");
    expect(at80).toContain("Verdict: Safe (score 80/100)");
  });

  test("phone", () => {
    expect(
      buildShareText({ kind: "phone", result: phoneResult("+1 415 555 2671") }),
    ).toBe(
      "I checked this phone number on IsThisValid:\n" +
        "+1 415 555 2671\n" +
        "Verdict: Valid (score 80/100)\n\n" +
        `Check one yourself: ${SITE_URL}/check/phone`,
    );
  });

  test("phone — falls back to the raw input when unformattable", () => {
    const text = buildShareText({
      kind: "phone",
      result: phoneResult(null, "12345"),
    });
    expect(text.split("\n")[1]).toBe("12345");
  });

  test("text — message in full, links defanged, site link not defanged", () => {
    const result = {
      classification: "smishing",
      riskScore: 95,
      summary: "This is a delivery scam.",
    } as TextDebunkResult;
    const text = buildShareText({
      kind: "text",
      result,
      message: "  USPS: pay at https://usps-redeliver.xyz/pay now  ",
    });
    expect(text).toBe(
      "I checked this message on IsThisValid:\n" +
        '"USPS: pay at hxxps://usps-redeliver[.]xyz/pay now"\n' +
        "Verdict: Smishing Detected (risk 95/100)\n" +
        "This is a delivery scam.\n\n" +
        `Check one yourself: ${SITE_URL}/check/text`,
    );
    expect(text).toContain("https://isthisvalid.com/check/text");
  });

  test("image", () => {
    expect(
      buildShareText({
        kind: "image",
        result: imageResult("ai-generated", 92),
      }),
    ).toBe(
      "I checked this image on IsThisValid:\n" +
        "Verdict: Likely AI-generated · AI risk score 92/100\n" +
        "Automated estimate, not proof.\n\n" +
        `Check one yourself: ${SITE_URL}/check/image`,
    );
  });
});

describe("buildShareText — non-link QR content", () => {
  function qr(raw: string) {
    return classifyQrContent(raw) as NonUrlQrContent;
  }

  test("tel", () => {
    expect(
      buildShareText({ kind: "qr", content: qr("tel:+14155552671") }),
    ).toBe(
      "I checked this QR code on IsThisValid:\n" +
        "Contains: Phone Number\n" +
        "+14155552671\n" +
        "⚠️ Check a number from an unexpected QR code before you call it.\n\n" +
        `Check one yourself: ${SITE_URL}/check/qr`,
    );
  });

  test("email — mailto query string not included", () => {
    const text = buildShareText({
      kind: "qr",
      content: qr("mailto:billing@example.com?subject=Pay"),
    });
    expect(text.split("\n").slice(1, 4)).toEqual([
      "Contains: Email Address",
      "billing@example.com",
      "⚠️ Check an address from an unexpected QR code before you email it.",
    ]);
    expect(text).not.toContain("subject");
  });

  test("wifi — network details and the card's warning", () => {
    const text = buildShareText({
      kind: "qr",
      content: qr("WIFI:T:WPA;S:CoffeeShop;P:hunter2;H:true;;"),
    });
    expect(text.split("\n").slice(1, 4)).toEqual([
      "Contains: Wi-Fi Network",
      "Network: CoffeeShop (WPA, hidden)",
      `⚠️ ${QR_WIFI_WARNING}`,
    ]);
  });

  test("[Regression] wifi password never appears in share text", () => {
    const text = buildShareText({
      kind: "qr",
      content: qr("WIFI:T:WPA;S:Home;P:s3cretPass!;;"),
    });
    expect(text).not.toContain("s3cretPass!");
  });

  test("text — quoted with links defanged; empty text shown as (empty)", () => {
    const text = buildShareText({
      kind: "qr",
      content: { kind: "text", text: "Pay at https://evil.com/x now", raw: "" },
    });
    expect(text).toContain("Contains: Plain Text");
    expect(text).toContain('"Pay at hxxps://evil[.]com/x now"');
    expect(
      buildShareText({
        kind: "qr",
        content: { kind: "text", text: "", raw: "" },
      }),
    ).toContain("\n(empty)\n");
  });
});

describe("buildImageStrip", () => {
  test.each([
    [
      "ai-generated",
      92,
      "Likely AI-generated · AI risk score 92/100",
      "danger",
    ],
    ["uncertain", 55, "Inconclusive · AI risk score 55/100", "warn"],
    [
      "authentic",
      12,
      "No strong signs of AI generation · AI risk score 12/100",
      "safe",
    ],
  ] as const)(
    "%s → headline + %s sentiment",
    (c, risk, headline, sentiment) => {
      const strip = buildImageStrip(imageResult(c, risk));
      expect(strip.headline).toBe(headline);
      expect(strip.sentiment).toBe(sentiment);
    },
  );

  test("detail uses modelLabel, falling back to SightEngine", () => {
    expect(buildImageStrip(imageResult("uncertain", 50)).detail).toBe(
      "Automated estimate by SightEngine, not proof · isthisvalid.com",
    );
    expect(
      buildImageStrip(imageResult("uncertain", 50, "SightEngine GenAI")).detail,
    ).toBe(
      "Automated estimate by SightEngine GenAI, not proof · isthisvalid.com",
    );
  });

  describe("[Regression] image share wording never claims authenticity", () => {
    test.each(["ai-generated", "uncertain", "authentic"] as const)(
      "%s",
      (c) => {
        const result = imageResult(c, 10);
        const strip = buildImageStrip(result);
        const all = [
          strip.headline,
          strip.detail,
          buildShareText({ kind: "image", result }),
        ].join("\n");
        expect(all).not.toMatch(/authentic/i);
      },
    );
  });
});
