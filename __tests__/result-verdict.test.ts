import {
  getEmailVerdict,
  getPhoneVerdict,
  getUrlVerdict,
  IMAGE_CLASSIFICATION_LABELS,
  TEXT_CLASSIFICATION_LABELS,
} from "../src/lib/result-verdict";
import type { EmailValidationResult } from "../src/lib/email-validator";
import type { PhoneValidationResult } from "../src/lib/phone-validator";

// Only the fields the verdict functions read — the rest of the result shape
// is irrelevant to thresholds.
function email(valid: boolean, score: number, syntax = true) {
  return { valid, score, checks: { syntax } } as EmailValidationResult;
}
function phone(valid: boolean, score: number, parseable = true) {
  return { valid, score, checks: { parseable } } as PhoneValidationResult;
}

describe("getEmailVerdict", () => {
  test("valid at score 70 is safe / Valid", () => {
    expect(getEmailVerdict(email(true, 70))).toEqual({
      sentiment: "safe",
      label: "Valid",
    });
  });

  test("valid at score 69 is warn / Risky", () => {
    expect(getEmailVerdict(email(true, 69))).toEqual({
      sentiment: "warn",
      label: "Risky",
    });
  });

  test("score 30 is warn, score 29 is danger / Invalid", () => {
    expect(getEmailVerdict(email(true, 30)).sentiment).toBe("warn");
    expect(getEmailVerdict(email(true, 29))).toEqual({
      sentiment: "danger",
      label: "Invalid",
    });
  });

  test("high score but valid: false is not safe", () => {
    expect(getEmailVerdict(email(false, 90)).sentiment).toBe("warn");
  });

  test("failed syntax is danger regardless of score", () => {
    expect(getEmailVerdict(email(false, 60, false)).sentiment).toBe("danger");
  });
});

describe("getPhoneVerdict", () => {
  test("valid at score 70 is safe / Valid", () => {
    expect(getPhoneVerdict(phone(true, 70))).toEqual({
      sentiment: "safe",
      label: "Valid",
    });
  });

  test("valid at score 69 is warn / Suspicious", () => {
    expect(getPhoneVerdict(phone(true, 69))).toEqual({
      sentiment: "warn",
      label: "Suspicious",
    });
  });

  test("score 30 is warn, score 29 is danger / Invalid", () => {
    expect(getPhoneVerdict(phone(true, 30)).sentiment).toBe("warn");
    expect(getPhoneVerdict(phone(true, 29))).toEqual({
      sentiment: "danger",
      label: "Invalid",
    });
  });

  test("unparseable is danger regardless of score", () => {
    expect(getPhoneVerdict(phone(false, 60, false)).sentiment).toBe("danger");
  });
});

describe("getUrlVerdict", () => {
  test.each([
    [100, "safe", "Safe"],
    [80, "safe", "Safe"],
    [79, "warn", "Suspicious"],
    [50, "warn", "Suspicious"],
    [49, "danger", "Dangerous"],
    [0, "danger", "Dangerous"],
  ])("score %i → %s / %s", (score, sentiment, label) => {
    expect(getUrlVerdict(score)).toEqual({ sentiment, label });
  });
});

describe("classification labels", () => {
  test("every text classification has a non-empty label", () => {
    for (const c of [
      "scam",
      "smishing",
      "spam",
      "suspicious",
      "legit",
    ] as const) {
      expect(TEXT_CLASSIFICATION_LABELS[c]).toBeTruthy();
    }
  });

  test("every image classification has a non-empty label", () => {
    for (const c of ["ai-generated", "uncertain", "authentic"] as const) {
      expect(IMAGE_CLASSIFICATION_LABELS[c]).toBeTruthy();
    }
  });
});
