import type {
  TextClassification,
  TextDebunkResult,
} from "@isthisvalid/core/text-debunker";

import { Colors } from "@/constants/colors";
import ClassificationResultCard from "@/components/ClassificationResultCard";

/**
 * Result card for the Text/SMS scam checker. Thin wrapper around the shared
 * ClassificationResultCard (see that file) with Text's classification
 * config and copy — mirrors web's TextResultCard.tsx shape.
 */
export interface TextResultCardProps {
  result: TextDebunkResult;
}

const CLASS_CONFIG: Record<
  TextClassification,
  {
    label: string;
    emoji: string;
    ring: string;
    badgeText: string;
    badgeBg: string;
    cardBorder: string;
    cardBg: string;
  }
> = {
  scam: {
    label: "Scam Detected",
    emoji: "🚨",
    ring: "#ef4444",
    badgeText: Colors.rose400,
    badgeBg: Colors.roseCheckBg,
    cardBorder: Colors.roseBorder,
    cardBg: Colors.rose950,
  },
  smishing: {
    label: "Smishing Detected",
    emoji: "🎣",
    ring: "#ef4444",
    badgeText: Colors.rose400,
    badgeBg: Colors.roseCheckBg,
    cardBorder: Colors.roseBorder,
    cardBg: Colors.rose950,
  },
  spam: {
    label: "Spam",
    emoji: "📢",
    ring: "#eab308",
    badgeText: Colors.yellow400,
    badgeBg: Colors.yellowCheckBg,
    cardBorder: Colors.yellowBorder,
    cardBg: Colors.yellow950,
  },
  suspicious: {
    label: "Suspicious",
    emoji: "⚠️",
    ring: "#eab308",
    badgeText: Colors.yellow400,
    badgeBg: Colors.yellowCheckBg,
    cardBorder: Colors.yellowBorder,
    cardBg: Colors.yellow950,
  },
  legit: {
    label: "Looks Legit",
    emoji: "✅",
    ring: "#4ade80",
    badgeText: Colors.lime300,
    badgeBg: Colors.limeCheckBg,
    cardBorder: Colors.limeBorder,
    cardBg: Colors.lime950,
  },
};

export default function TextResultCard({ result }: TextResultCardProps) {
  const cfg = CLASS_CONFIG[result.classification];
  const displayScore = 100 - result.riskScore;

  return (
    <ClassificationResultCard
      cardBorder={cfg.cardBorder}
      cardBg={cfg.cardBg}
      badgeBg={cfg.badgeBg}
      badgeTextColor={cfg.badgeText}
      emoji={cfg.emoji}
      label={cfg.label}
      summary={result.summary}
      displayScore={displayScore}
      ringColor={cfg.ring}
      confidence={result.confidence}
      confidenceLabel="AI Confidence"
      confidenceColor={Colors.violet500}
      flags={result.flags}
      flagsHeading="Red Flags Detected"
      showPositiveNote={result.flags.length === 0 && result.safe}
      positiveNoteText="No specific red flags detected"
      positiveNoteColor="#4ade80"
      explanation={result.explanation}
      sourceBadgeText={`${result.modelLabel ?? "Claude"} · AI Analysis`}
    />
  );
}
