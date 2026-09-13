import { StyleSheet, Text, View } from "react-native";

import { Colors } from "@/constants/colors";

/**
 * Shared result card for every /check/* tool screen (score-based tools:
 * email, URL, phone). Each screen owns its own domain logic for deriving a
 * Sentiment from its result shape — this component only renders.
 */
export type Sentiment = "valid" | "warn" | "invalid";

export interface ResultCardProps {
  /** e.g. "Instant local check" / "Full server result" */
  label: string;
  score: number;
  sentiment: Sentiment;
  message: string;
  /** Optional secondary line — e.g. a typo suggestion */
  detail?: string;
  source: string;
}

const sentimentStyles: Record<
  Sentiment,
  { border: string; bg: string; badge: string }
> = {
  valid: {
    border: Colors.limeBorder,
    bg: Colors.lime950,
    badge: Colors.lime600,
  },
  warn: {
    border: Colors.yellowBorder,
    bg: Colors.yellow950,
    badge: Colors.yellow600,
  },
  invalid: {
    border: Colors.roseBorder,
    bg: Colors.rose950,
    badge: Colors.rose600,
  },
};

export function ResultCard({
  label,
  score,
  sentiment,
  message,
  detail,
  source,
}: ResultCardProps) {
  const s = sentimentStyles[sentiment];
  return (
    <View
      style={[styles.card, { borderColor: s.border, backgroundColor: s.bg }]}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.cardLabel}>{label}</Text>
        <View style={[styles.scoreBadge, { backgroundColor: s.badge }]}>
          <Text style={styles.scoreBadgeText}>{score}/100</Text>
        </View>
      </View>
      <Text style={styles.message}>{message}</Text>
      {detail && <Text style={styles.detail}>{detail}</Text>}
      <Text style={styles.source}>source: {source}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 12, borderWidth: 1, padding: 16, gap: 8 },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cardLabel: { color: Colors.white, fontWeight: "600" },
  scoreBadge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  scoreBadgeText: { color: Colors.white, fontSize: 12, fontWeight: "700" },
  message: { color: Colors.zinc300 },
  detail: { color: Colors.amber500, fontSize: 13 },
  source: { color: Colors.zinc500, fontSize: 11 },
});
