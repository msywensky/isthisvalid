import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle } from "react-native-svg";

import { Colors } from "@/constants/colors";

/**
 * Result card for the Email screen. Mirrors the web app's ResultCard.tsx
 * (used by web's email tool only) — sentiment badge, score ring, message,
 * suggestion, and a pass/fail check breakdown. Phone and URL have their own
 * dedicated cards (PhoneResultCard/UrlResultCard) on both platforms, since
 * their result shapes and sentiment thresholds differ.
 */
export type Sentiment = "valid" | "warn" | "invalid";

export interface CheckItem {
  label: string;
  pass: boolean;
  /** Full-width row — for checks that only sometimes apply (e.g. MX, mailbox reachability). */
  wide?: boolean;
}

export interface ResultCardProps {
  score: number;
  sentiment: Sentiment;
  message: string;
  /** Full sentence, e.g. "Did you mean gmail.com?" — a 💡 is prepended automatically. */
  detail?: string;
  checks: CheckItem[];
  /** e.g. "ZeroBounce + local checks" / "local checks" */
  source: string;
}

const sentimentMeta: Record<
  Sentiment,
  {
    border: string;
    bg: string;
    badge: string;
    icon: string;
    label: string;
    ring: string;
  }
> = {
  valid: {
    border: Colors.limeBorder,
    bg: Colors.lime950,
    badge: Colors.lime600,
    icon: "✅",
    label: "Valid",
    ring: Colors.lime500,
  },
  warn: {
    border: Colors.yellowBorder,
    bg: Colors.yellow950,
    badge: Colors.yellow600,
    icon: "⚠️",
    label: "Risky",
    ring: Colors.yellow500,
  },
  invalid: {
    border: Colors.roseBorder,
    bg: Colors.rose950,
    badge: Colors.rose600,
    icon: "❌",
    label: "Invalid",
    ring: Colors.rose400,
  },
};

const RING_RADIUS = 20;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

function ScoreRing({ score, ringColor }: { score: number; ringColor: string }) {
  const offset = RING_CIRCUMFERENCE - (score / 100) * RING_CIRCUMFERENCE;
  return (
    <View style={styles.ringWrap}>
      <Svg width={56} height={56} viewBox="0 0 56 56" style={styles.ringSvg}>
        <Circle
          cx={28}
          cy={28}
          r={RING_RADIUS}
          fill="none"
          stroke={Colors.zinc800}
          strokeWidth={6}
        />
        <Circle
          cx={28}
          cy={28}
          r={RING_RADIUS}
          fill="none"
          stroke={ringColor}
          strokeWidth={6}
          strokeDasharray={`${RING_CIRCUMFERENCE.toFixed(2)} ${RING_CIRCUMFERENCE.toFixed(2)}`}
          strokeDashoffset={offset.toFixed(2)}
          strokeLinecap="round"
        />
      </Svg>
      <Text style={styles.ringScore}>{score}</Text>
    </View>
  );
}

export function ResultCard({
  score,
  sentiment,
  message,
  detail,
  checks,
  source,
}: ResultCardProps) {
  const s = sentimentMeta[sentiment];
  return (
    <View
      style={[styles.card, { borderColor: s.border, backgroundColor: s.bg }]}
    >
      <View style={styles.header}>
        <View style={styles.badgeRow}>
          <Text style={styles.badgeIcon}>{s.icon}</Text>
          <View style={[styles.sentimentBadge, { backgroundColor: s.badge }]}>
            <Text style={styles.sentimentBadgeText}>{s.label}</Text>
          </View>
        </View>
        <ScoreRing score={score} ringColor={s.ring} />
      </View>

      <Text style={styles.message}>{message}</Text>

      {detail && <Text style={styles.detail}>💡 {detail}</Text>}

      <View style={styles.checksGrid}>
        {checks.map((c) => (
          <View
            key={c.label}
            style={[
              styles.checkRow,
              c.wide && styles.checkRowWide,
              {
                backgroundColor: c.pass
                  ? Colors.limeCheckBg
                  : Colors.roseCheckBg,
              },
            ]}
          >
            <Text style={{ color: c.pass ? Colors.lime300 : Colors.rose300 }}>
              {c.pass ? "✓" : "✗"}
            </Text>
            <Text
              style={[
                styles.checkLabel,
                { color: c.pass ? Colors.lime300 : Colors.rose300 },
              ]}
            >
              {c.label}
            </Text>
          </View>
        ))}
      </View>

      <Text style={styles.source}>
        Validated via <Text style={styles.sourceValue}>{source}</Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 16, borderWidth: 2, padding: 20, gap: 14 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 12,
  },
  badgeRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  badgeIcon: { fontSize: 20 },
  sentimentBadge: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  sentimentBadgeText: {
    color: Colors.white,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  ringWrap: {
    width: 56,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
  },
  ringSvg: { transform: [{ rotate: "-90deg" }] },
  ringScore: {
    position: "absolute",
    color: Colors.white,
    fontSize: 12,
    fontWeight: "800",
  },
  message: { color: Colors.white, fontSize: 16, fontWeight: "500" },
  detail: { color: Colors.amber400, fontSize: 13 },
  checksGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  checkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minWidth: "47%",
    flexGrow: 1,
  },
  checkRowWide: { minWidth: "100%" },
  checkLabel: { fontSize: 13 },
  source: { color: Colors.zinc500, fontSize: 11, textAlign: "right" },
  sourceValue: { color: Colors.zinc400, fontWeight: "600" },
});
