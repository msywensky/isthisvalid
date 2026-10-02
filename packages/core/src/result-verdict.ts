/**
 * Verdict (sentiment + label) for each tool's result — the single source of
 * truth for score thresholds and badge wording. Used by the web and mobile
 * result cards and by share-text.ts, so the badge a user sees and the text
 * they share can never disagree. Colours stay in each card (per-platform UI).
 */
import type { EmailValidationResult } from "./email-validator";
import type { PhoneValidationResult } from "./phone-validator";
import type { TextClassification } from "./text-debunker";
import type { ImageClassification } from "./image-debunker";

export type Sentiment = "safe" | "warn" | "danger";

export interface Verdict {
  sentiment: Sentiment;
  label: string;
}

/** Email and phone share thresholds: ≥70 (and valid) = safe, <30 = danger. */
function scoreVerdict(
  valid: boolean,
  score: number,
  structurallyOk: boolean,
  warnLabel: string,
): Verdict {
  if (valid && score >= 70) return { sentiment: "safe", label: "Valid" };
  if (!structurallyOk || score < 30) {
    return { sentiment: "danger", label: "Invalid" };
  }
  return { sentiment: "warn", label: warnLabel };
}

export function getEmailVerdict(r: EmailValidationResult): Verdict {
  return scoreVerdict(r.valid, r.score, r.checks.syntax, "Risky");
}

export function getPhoneVerdict(r: PhoneValidationResult): Verdict {
  return scoreVerdict(r.valid, r.score, r.checks.parseable, "Suspicious");
}

/** URL thresholds are stricter than email/phone: ≥80 = Safe, ≥50 = Suspicious. */
export function getUrlVerdict(score: number): Verdict {
  if (score >= 80) return { sentiment: "safe", label: "Safe" };
  if (score >= 50) return { sentiment: "warn", label: "Suspicious" };
  return { sentiment: "danger", label: "Dangerous" };
}

export const TEXT_CLASSIFICATION_LABELS: Record<TextClassification, string> = {
  scam: "Scam Detected",
  smishing: "Smishing Detected",
  spam: "Spam",
  suspicious: "Suspicious",
  legit: "Looks Legit",
};

export const IMAGE_CLASSIFICATION_LABELS: Record<ImageClassification, string> =
  {
    "ai-generated": "AI-Generated",
    uncertain: "Uncertain",
    authentic: "Appears Authentic",
  };
