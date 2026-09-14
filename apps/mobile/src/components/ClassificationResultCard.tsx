import { StyleSheet, Text, View } from "react-native";

import { Colors } from "@/constants/colors";
import ScoreRing from "@/components/ScoreRing";

/**
 * Shared shape behind TextResultCard and ImageResultCard — on web these are
 * two near-identical files (classification badge + ring, confidence bar,
 * flags list, explanation, source badge); on mobile they're the same
 * component with per-tool colors/labels passed in, to avoid maintaining two
 * copies of the same layout.
 */
export interface ClassificationResultCardProps {
  cardBorder: string;
  cardBg: string;
  badgeBg: string;
  badgeTextColor: string;
  emoji: string;
  label: string;
  summary: string;
  displayScore: number;
  ringColor: string;
  confidence: number;
  confidenceLabel: string;
  confidenceColor: string;
  flags: string[];
  flagsHeading: string;
  showPositiveNote: boolean;
  positiveNoteText: string;
  positiveNoteColor: string;
  explanation: string;
  /** Fully composed, e.g. "Claude · AI Analysis" or "SightEngine · AI Detection". */
  sourceBadgeText: string;
}

export default function ClassificationResultCard({
  cardBorder,
  cardBg,
  badgeBg,
  badgeTextColor,
  emoji,
  label,
  summary,
  displayScore,
  ringColor,
  confidence,
  confidenceLabel,
  confidenceColor,
  flags,
  flagsHeading,
  showPositiveNote,
  positiveNoteText,
  positiveNoteColor,
  explanation,
  sourceBadgeText,
}: ClassificationResultCardProps) {
  return (
    <View
      style={[
        styles.card,
        { borderColor: cardBorder, backgroundColor: cardBg },
      ]}
    >
      <View style={[styles.badgeRow, { backgroundColor: badgeBg }]}>
        <View style={styles.badgeRowLeft}>
          <Text style={styles.badgeEmoji}>{emoji}</Text>
          <View style={styles.badgeTextCol}>
            <Text style={[styles.badgeLabel, { color: badgeTextColor }]}>
              {label}
            </Text>
            <Text style={styles.summary}>{summary}</Text>
          </View>
        </View>
        <ScoreRing score={displayScore} ringColor={ringColor} />
      </View>

      <View style={styles.confidenceCol}>
        <Text style={styles.confidenceLabel}>{confidenceLabel}</Text>
        <View style={styles.confidenceTrack}>
          <View
            style={[
              styles.confidenceFill,
              { width: `${confidence}%`, backgroundColor: confidenceColor },
            ]}
          />
        </View>
        <Text style={styles.confidenceValue}>
          <Text style={styles.confidenceValueStrong}>{confidence}%</Text>{" "}
          confident
        </Text>
      </View>

      {flags.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{flagsHeading}</Text>
          {flags.map((flag, i) => (
            <View key={i} style={styles.flagRow}>
              <Text style={styles.flagMark}>✗</Text>
              <Text style={styles.flagText}>{flag}</Text>
            </View>
          ))}
        </View>
      )}

      {showPositiveNote && (
        <View style={styles.noFlagsRow}>
          <Text style={[styles.noFlagsMark, { color: positiveNoteColor }]}>
            ✓
          </Text>
          <Text style={[styles.noFlagsText, { color: positiveNoteColor }]}>
            {positiveNoteText}
          </Text>
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Analysis</Text>
        <Text style={styles.explanation}>{explanation}</Text>
      </View>

      <View style={styles.sourceRow}>
        <Text style={styles.sourceLabel}>Powered by</Text>
        <View style={styles.sourceBadge}>
          <Text style={styles.sourceBadgeText}>{sourceBadgeText}</Text>
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
    justifyContent: "space-between",
    gap: 12,
    borderRadius: 12,
    padding: 12,
  },
  badgeRowLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    minWidth: 0,
  },
  badgeEmoji: { fontSize: 22 },
  badgeTextCol: { flex: 1, gap: 2 },
  badgeLabel: { fontSize: 17, fontWeight: "700" },
  summary: { color: Colors.zinc300, fontSize: 13, lineHeight: 18 },
  confidenceCol: { gap: 6 },
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
  confidenceFill: { height: 8, borderRadius: 999 },
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
  noFlagsMark: { fontSize: 13 },
  noFlagsText: { fontSize: 13 },
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
