import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle } from "react-native-svg";

import type { PhoneValidationResult } from "@isthisvalid/core/phone-validator";

import { Colors } from "@/constants/colors";

/**
 * Result card for the Phone checker — ported 1:1 from the web app's
 * PhoneResultCard.tsx: sentiment header + line-type badge + score ring,
 * input echo, label/message, a prominent Caribbean/NANP one-ring-scam
 * callout (pulled out of the generic flags list), a formatted-number detail
 * grid, the pass/fail check breakdown, remaining flags, and a source badge.
 */
export interface PhoneResultCardProps {
  result: PhoneValidationResult;
}

type Sentiment = "valid" | "warn" | "invalid";

function getSentiment(result: PhoneValidationResult): Sentiment {
  if (result.valid && result.score >= 70) return "valid";
  if (!result.checks.parseable || result.score < 30) return "invalid";
  return "warn";
}

function lineTypeLabel(lineType: string): string {
  switch (lineType) {
    case "MOBILE":
      return "Mobile";
    case "FIXED_LINE":
      return "Landline";
    case "FIXED_LINE_OR_MOBILE":
      return "Mobile or Landline";
    case "TOLL_FREE":
      return "Toll-Free";
    case "VOIP":
      return "VoIP";
    case "PREMIUM_RATE":
      return "Premium Rate";
    case "SHARED_COST":
      return "Shared Cost";
    case "PAGER":
      return "Pager";
    case "UAN":
      return "Universal Access";
    case "PERSONAL_NUMBER":
      return "Personal";
    case "VOICEMAIL":
      return "Voicemail";
    default:
      return lineType.replace(/_/g, " ");
  }
}

const SENTIMENT_META: Record<
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
    label: "Suspicious",
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

function sourceLabel(source: PhoneValidationResult["source"]): string {
  if (source === "numverify") return "Numverify + libphonenumber";
  if (source === "abstract") return "Abstract API + libphonenumber";
  return "libphonenumber (Google)";
}

export default function PhoneResultCard({ result }: PhoneResultCardProps) {
  const sentiment = getSentiment(result);
  const s = SENTIMENT_META[sentiment];

  const nanpFlag = result.flags.find((f) => f.includes("Caribbean"));
  const otherFlags = result.flags.filter((f) => !f.includes("Caribbean"));

  return (
    <View
      style={[styles.card, { borderColor: s.border, backgroundColor: s.bg }]}
    >
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerIcon}>{s.icon}</Text>
          <View style={[styles.sentimentBadge, { backgroundColor: s.badge }]}>
            <Text style={styles.sentimentBadgeText}>{s.label}</Text>
          </View>
          {result.lineType && result.lineType !== "UNKNOWN" && (
            <View style={styles.lineTypeBadge}>
              <Text style={styles.lineTypeBadgeText}>
                {lineTypeLabel(result.lineType)}
              </Text>
            </View>
          )}
        </View>
        <ScoreRing score={result.score} ringColor={s.ring} />
      </View>

      <Text style={styles.inputEcho}>{result.input}</Text>

      <View style={styles.labelBlock}>
        <Text style={styles.label}>{result.label}</Text>
        <Text style={styles.message}>{result.message}</Text>
      </View>

      {nanpFlag && (
        <View style={styles.nanpBox}>
          <Text style={styles.nanpIcon}>⚠️</Text>
          <Text style={styles.nanpText}>{nanpFlag}</Text>
        </View>
      )}

      {result.checks.parseable && (
        <View style={styles.detailGrid}>
          {result.phoneE164 && (
            <Detail label="E.164" value={result.phoneE164} />
          )}
          {result.internationalFormat && (
            <Detail label="International" value={result.internationalFormat} />
          )}
          {result.nationalFormat && result.countryName && (
            <Detail label="National" value={result.nationalFormat} />
          )}
          {result.countryName && (
            <Detail
              label="Country"
              value={`${result.countryCode} · ${result.countryName}`}
            />
          )}
          {result.location && (
            <Detail
              label={
                result.source === "local" ? "Area code region" : "Location"
              }
              value={result.location}
              note={
                result.source === "local"
                  ? "Based on area code — mobile numbers may differ"
                  : undefined
              }
            />
          )}
          {result.carrier && <Detail label="Carrier" value={result.carrier} />}
        </View>
      )}

      <View style={styles.checksGrid}>
        <CheckRow label="Parseable" pass={result.checks.parseable} />
        <CheckRow label="Valid format" pass={result.checks.validPattern} />
        <CheckRow label="Valid length" pass={result.checks.validLength} />
        <CheckRow
          label="Country detected"
          pass={result.checks.countryDetected}
        />
        {result.lineActive !== null && (
          <CheckRow label="Line active" pass={result.lineActive} wide />
        )}
      </View>

      {otherFlags.length > 0 && (
        <View style={styles.flagsList}>
          {otherFlags.map((flag, i) => (
            <View key={i} style={styles.flagRow}>
              <Text style={styles.flagIcon}>⚠</Text>
              <Text style={styles.flagText}>{flag}</Text>
            </View>
          ))}
        </View>
      )}

      <Text style={styles.source}>
        Validated via{" "}
        <Text style={styles.sourceValue}>{sourceLabel(result.source)}</Text>
      </Text>
    </View>
  );
}

function Detail({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note?: string;
}) {
  return (
    <View style={styles.detailBox}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue} numberOfLines={1}>
        {value}
      </Text>
      {note && <Text style={styles.detailNote}>{note}</Text>}
    </View>
  );
}

function CheckRow({
  label,
  pass,
  wide,
}: {
  label: string;
  pass: boolean;
  wide?: boolean;
}) {
  return (
    <View
      style={[
        styles.checkRow,
        wide && styles.checkRowWide,
        { backgroundColor: pass ? Colors.limeCheckBg : Colors.roseCheckBg },
      ]}
    >
      <Text style={{ color: pass ? Colors.lime300 : Colors.rose300 }}>
        {pass ? "✓" : "✗"}
      </Text>
      <Text
        style={[
          styles.checkLabel,
          { color: pass ? Colors.lime300 : Colors.rose300 },
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

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

const styles = StyleSheet.create({
  card: { borderRadius: 16, borderWidth: 2, padding: 20, gap: 14 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 12,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  headerIcon: { fontSize: 20 },
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
  lineTypeBadge: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.zinc700,
    backgroundColor: Colors.zinc800,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  lineTypeBadgeText: { fontSize: 11, fontWeight: "600", color: Colors.zinc400 },
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
  inputEcho: { color: Colors.zinc300, fontSize: 13, fontFamily: "monospace" },
  labelBlock: { gap: 2 },
  label: { color: Colors.white, fontSize: 16, fontWeight: "600" },
  message: { color: Colors.zinc400, fontSize: 13 },
  nanpBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.amberBorder,
    backgroundColor: Colors.amber950,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  nanpIcon: { fontSize: 15, color: Colors.amber400 },
  nanpText: { flex: 1, color: Colors.amber300, fontSize: 13, lineHeight: 18 },
  detailGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  detailBox: {
    minWidth: "47%",
    flexGrow: 1,
    borderRadius: 10,
    backgroundColor: "rgba(39, 39, 42, 0.6)", // zinc-800/60
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 2,
  },
  detailLabel: {
    fontSize: 10,
    letterSpacing: 0.5,
    textTransform: "uppercase",
    color: Colors.zinc500,
  },
  detailValue: { color: Colors.zinc200, fontSize: 13, fontFamily: "monospace" },
  detailNote: { color: Colors.zinc500, fontSize: 10, fontStyle: "italic" },
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
  flagsList: { gap: 6 },
  flagRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  flagIcon: { color: Colors.yellow400, fontSize: 12 },
  flagText: { flex: 1, color: Colors.yellow400, fontSize: 12, lineHeight: 17 },
  source: { color: Colors.zinc500, fontSize: 11, textAlign: "right" },
  sourceValue: { color: Colors.zinc400, fontWeight: "600" },
});
