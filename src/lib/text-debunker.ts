/**
 * Shared types for the text/SMS debunking tool.
 * Used by both the API route and client components.
 */

export type TextClassification =
  | "scam"
  | "smishing"
  | "spam"
  | "suspicious"
  | "legit";

export interface TextDebunkResult {
  /** AI classification of the message */
  classification: TextClassification;
  /** How confident the AI is in its classification (0–100) */
  confidence: number;
  /** Risk level of the message (0 = safe, 100 = definite scam) */
  riskScore: number;
  /** True when riskScore < 50 */
  safe: boolean;
  /** One-sentence plain-English verdict */
  summary: string;
  /** Specific red-flag phrases or techniques found in the message */
  flags: string[];
  /** 2–3 sentence explanation of key indicators */
  explanation: string;
  /** Data source identifier */
  source: "claude";
}
