import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle } from "react-native-svg";

import type {
  TextClassification,
  TextDebunkResult,
} from "@isthisvalid/core/text-debunker";

import { Colors } from "@/constants/colors";

/**
 * Result card for the Text/SMS scam checker. Distinct from the shared
 * ResultCard (email/URL/phone's pass-fail check breakdown) because the web
 * app's TextResultCard.tsx has its own shape: a classification badge, a
 * circular score ring, an AI-confidence bar, and a red-flags list — ported
 * 1:1 here, including the ring's exact SVG geometry.
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

const RING_RADIUS = 52;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;
const RING_OFFSET = RING_CIRCUMFERENCE * 0.25; // start at 12 o'clock

export default function TextResultCard({ result }: TextResultCardProps) {
  const cfg = CLASS_CONFIG[result.classification];
  const displayScore = 100 - result.riskScore;
  const fill = (displayScore / 100) * RING_CIRCUMFERENCE;

  return (
    <View
      style={[
        styles.card,
        { borderColor: cfg.cardBorder, backgroundColor: cfg.cardBg },
      ]}
    >
      <View style={[styles.badgeRow, { backgroundColor: cfg.badgeBg }]}>
        <Text style={styles.badgeEmoji}>{cfg.emoji}</Text>
        <View style={styles.badgeTextCol}>
          <Text style={[styles.badgeLabel, { color: cfg.badgeText }]}>
            {cfg.label}
          </Text>
          <Text style={styles.summary}>{result.summary}</Text>
        </View>
      </View>

      <View style={styles.scoreRow}>
        <View style={styles.ringWrap}>
          <Svg width={120} height={120} viewBox="0 0 120 120">
            <Circle
              cx={60}
              cy={60}
              r={RING_RADIUS}
              fill="none"
              stroke={Colors.zinc800}
              strokeWidth={9}
            />
            <Circle
              cx={60}
              cy={60}
              r={RING_RADIUS}
              fill="none"
              stroke={cfg.ring}
              strokeWidth={9}
              strokeLinecap="round"
              strokeDasharray={`${fill.toFixed(2)} ${RING_CIRCUMFERENCE.toFixed(2)}`}
              strokeDashoffset={RING_OFFSET.toFixed(2)}
            />
          </Svg>
          <View style={styles.ringCenter}>
            <Text style={styles.ringScore}>{displayScore}</Text>
            <Text style={styles.ringMax}>/ 100</Text>
          </View>
        </View>

        <View style={styles.confidenceCol}>
          <Text style={styles.confidenceLabel}>AI Confidence</Text>
          <View style={styles.confidenceTrack}>
            <View
              style={[
                styles.confidenceFill,
                { width: `${result.confidence}%` },
              ]}
            />
          </View>
          <Text style={styles.confidenceValue}>
            <Text style={styles.confidenceValueStrong}>
              {result.confidence}%
            </Text>{" "}
            confident
          </Text>
        </View>
      </View>

      {result.flags.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Red Flags Detected</Text>
          {result.flags.map((flag, i) => (
            <View key={i} style={styles.flagRow}>
              <Text style={styles.flagMark}>✗</Text>
              <Text style={styles.flagText}>{flag}</Text>
            </View>
          ))}
        </View>
      )}

      {result.flags.length === 0 && result.safe && (
        <View style={styles.noFlagsRow}>
          <Text style={styles.noFlagsMark}>✓</Text>
          <Text style={styles.noFlagsText}>No specific red flags detected</Text>
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Analysis</Text>
        <Text style={styles.explanation}>{result.explanation}</Text>
      </View>

      <View style={styles.sourceRow}>
        <Text style={styles.sourceLabel}>Powered by</Text>
        <View style={styles.sourceBadge}>
          <Text style={styles.sourceBadgeText}>
            {result.modelLabel ?? "Claude"} · AI Analysis
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 16, borderWidth: 2, padding: 20, gap: 16 },
  badgeRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    borderRadius: 12,
    padding: 12,
  },
  badgeEmoji: { fontSize: 22 },
  badgeTextCol: { flex: 1, gap: 2 },
  badgeLabel: { fontSize: 17, fontWeight: "700" },
  summary: { color: Colors.zinc300, fontSize: 13, lineHeight: 18 },
  scoreRow: { flexDirection: "row", alignItems: "center", gap: 20 },
  ringWrap: {
    width: 120,
    height: 120,
    alignItems: "center",
    justifyContent: "center",
  },
  ringCenter: { position: "absolute", alignItems: "center" },
  ringScore: { color: Colors.white, fontSize: 24, fontWeight: "800" },
  ringMax: { color: Colors.zinc500, fontSize: 11 },
  confidenceCol: { flex: 1, gap: 6 },
  confidenceLabel: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    color: Colors.zinc500,
  },
  confidenceTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: Colors.zinc800,
    overflow: "hidden",
  },
  confidenceFill: {
    height: 8,
    borderRadius: 999,
    backgroundColor: Colors.violet500,
  },
  confidenceValue: { color: Colors.zinc300, fontSize: 13 },
  confidenceValueStrong: { color: Colors.white, fontWeight: "700" },
  section: { gap: 6 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    color: Colors.zinc500,
  },
  flagRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  flagMark: { color: "#ef4444", fontWeight: "700", fontSize: 13 },
  flagText: { flex: 1, color: Colors.zinc300, fontSize: 13, lineHeight: 18 },
  noFlagsRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  noFlagsMark: { color: "#4ade80", fontSize: 13 },
  noFlagsText: { color: "#4ade80", fontSize: 13 },
  explanation: { color: Colors.zinc300, fontSize: 13, lineHeight: 19 },
  sourceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.zinc800,
  },
  sourceLabel: { color: Colors.zinc400, fontSize: 11 },
  sourceBadge: {
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.zinc700,
    backgroundColor: Colors.zinc800,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  sourceBadgeText: { color: Colors.zinc400, fontSize: 11 },
});
