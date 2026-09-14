import type {
  ImageClassification,
  ImageDebunkResult,
} from "@isthisvalid/core/image-debunker";

import { Colors } from "@/constants/colors";
import ClassificationResultCard from "@/components/ClassificationResultCard";

/**
 * Result card for the Image authenticity checker. Thin wrapper around the
 * shared ClassificationResultCard (see that file) with Image's
 * classification config and copy — mirrors web's ImageResultCard.tsx shape.
 */
export interface ImageResultCardProps {
  result: ImageDebunkResult;
}

const CLASS_CONFIG: Record<
  ImageClassification,
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
  "ai-generated": {
    label: "AI-Generated",
    emoji: "🤖",
    ring: Colors.rose500,
    badgeText: Colors.rose400,
    badgeBg: Colors.roseCheckBg,
    cardBorder: Colors.roseBorder,
    cardBg: Colors.rose950,
  },
  uncertain: {
    label: "Uncertain",
    emoji: "⚠️",
    ring: Colors.yellow500,
    badgeText: Colors.yellow400,
    badgeBg: Colors.yellowCheckBg,
    cardBorder: Colors.yellowBorder,
    cardBg: Colors.yellow950,
  },
  authentic: {
    label: "Appears Authentic",
    emoji: "✅",
    ring: "#4ade80",
    badgeText: Colors.lime400,
    badgeBg: Colors.limeCheckBg,
    cardBorder: Colors.limeBorder,
    cardBg: Colors.lime950,
  },
};

export default function ImageResultCard({ result }: ImageResultCardProps) {
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
      confidenceLabel="Detection Confidence"
      confidenceColor={Colors.emerald500}
      flags={result.flags}
      flagsHeading="Detection Signals"
      showPositiveNote={result.flags.length === 0 && result.safe}
      positiveNoteText="No manipulation signals detected"
      positiveNoteColor={Colors.lime400}
      explanation={result.explanation}
      sourceBadgeText={`${result.modelLabel ?? "AI Detection"} · AI Detection`}
    />
  );
}
